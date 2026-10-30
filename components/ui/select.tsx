import * as React from "react";

import { cn } from "@/lib/utils";

/** Native select styled like Input: accessible and reliable on low-end phones. */
function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "h-12 w-full rounded-lg border-[1.5px] border-input bg-card px-3 text-[15px] text-foreground aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { NativeSelect };
