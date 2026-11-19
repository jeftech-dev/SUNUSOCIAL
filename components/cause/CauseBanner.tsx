import Image from "next/image";

import { cn } from "@/lib/utils";

/** A cause's banner photo, cropped to fill its box. A tinted block while there is no photo. */
export function CauseBanner({
  url,
  sizes,
  priority = false,
  className,
}: {
  url: string | null;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-primary-soft", className)}>
      {url && (
        <Image src={url} alt="" fill sizes={sizes} priority={priority} className="object-cover" />
      )}
    </div>
  );
}
