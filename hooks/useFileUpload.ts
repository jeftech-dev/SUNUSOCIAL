"use client";

import { useMutation } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Uploads one file for a signed-in structure/hospital and returns its storage id. The browser PUTs
 * the bytes straight to a short-lived Convex upload URL; the linking mutation (`causes.create`,
 * `proofs.submit`) then validates the stored file's size and type (convex/files.ts `validateUpload`).
 */
export function useFileUpload(): (file: File) => Promise<Id<"_storage">> {
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  return async (file: File) => {
    const url = await generateUploadUrl({});
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) throw new Error("upload_failed");
    const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
    return storageId;
  };
}
