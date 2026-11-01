// Out-of-band image checks for a submitted dossier (DT-13). Advisory flags only — the moderator
// decides. Two checks run here:
//   - Duplicate file: the photo's sha256 (from _storage metadata) already appears in a validated
//     dossier. This is an exact-duplicate stand-in; perceptual near-duplicate matching (dHash,
//     Hamming ≤ 6) is a documented later upgrade — it needs an image-decoding dependency and would
//     then move this module to a `"use node"` action.
//   - Photo date: the JPEG EXIF DateTimeOriginal is missing, or earlier than the cause's creation.
// The reused-invoice and spend-vs-net checks run synchronously in `proofs.submit`.
// This runs in the default Convex runtime (DataView + ctx.storage.get only, no Node APIs).

import { v } from "convex/values";

import { fr } from "../lib/strings.fr";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";

/** Parses EXIF `DateTimeOriginal` from a JPEG, as epoch ms (UTC), or null if absent/unreadable. */
function jpegExifDate(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null; // not a JPEG

  // Find the APP1 (Exif) segment.
  let offset = 2;
  let exifStart = -1;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) break;
    const marker = view.getUint8(offset + 1);
    const size = view.getUint16(offset + 2);
    if (marker === 0xda) break; // start of scan — no metadata beyond here
    if (marker === 0xe1 && offset + 10 <= view.byteLength) {
      // "Exif\0\0"
      if (
        view.getUint32(offset + 4) === 0x45786966 &&
        view.getUint16(offset + 8) === 0x0000
      ) {
        exifStart = offset + 10;
        break;
      }
    }
    offset += 2 + size;
  }
  if (exifStart < 0) return null;

  // TIFF header: byte order, then IFD0 offset (relative to exifStart).
  const le = view.getUint16(exifStart) === 0x4949; // "II" little-endian, "MM" big-endian
  const u16 = (p: number) => view.getUint16(p, le);
  const u32 = (p: number) => view.getUint32(p, le);
  if (exifStart + 8 > view.byteLength) return null;
  const ifd0 = exifStart + u32(exifStart + 4);

  const findTag = (ifd: number, tag: number): number | null => {
    if (ifd + 2 > view.byteLength) return null;
    const count = u16(ifd);
    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      if (entry + 12 > view.byteLength) break;
      if (u16(entry) === tag) return u32(entry + 8);
    }
    return null;
  };

  const exifIfdOffset = findTag(ifd0, 0x8769); // ExifIFDPointer
  if (exifIfdOffset === null) return null;
  const valuePtr = findTag(exifStart + exifIfdOffset, 0x9003); // DateTimeOriginal
  if (valuePtr === null) return null;

  const start = exifStart + valuePtr;
  if (start + 19 > view.byteLength) return null;
  // "YYYY:MM:DD HH:MM:SS"
  let text = "";
  for (let i = 0; i < 19; i++) text += String.fromCharCode(view.getUint8(start + i));
  const m = text.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
}

export const run = internalAction({
  args: { proofId: v.id("proofs") },
  handler: async (ctx, { proofId }): Promise<{ flagged: number }> => {
    const data = await ctx.runQuery(internal.proofs.checkData, { proofId });
    if (!data) return { flagged: 0 };

    const flags: Array<{ itemId: (typeof data.photos)[number]["id"]; reason: string }> = [];
    for (const photo of data.photos) {
      if (photo.sha256 && data.publishedHashes.includes(photo.sha256)) {
        flags.push({ itemId: photo.id, reason: fr.proofFlags.duplicateImage });
        continue;
      }
      const blob = await ctx.storage.get(photo.fileId);
      if (!blob) continue;
      const taken = jpegExifDate(new Uint8Array(await blob.arrayBuffer()));
      if (taken === null) {
        flags.push({ itemId: photo.id, reason: fr.proofFlags.exifMissing });
      } else if (taken < data.causeCreatedAt) {
        flags.push({ itemId: photo.id, reason: fr.proofFlags.exifOld });
      }
    }

    if (flags.length > 0) await ctx.runMutation(internal.proofs.applyImageFlags, { flags });
    return { flagged: flags.length };
  },
});
