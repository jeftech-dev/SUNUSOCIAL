import * as React from "react";

import { cn } from "@/lib/utils";

// shadcn/ui input, themed: 1.5px border in --input (3:1 on white), 14px radius as in the prototype.
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-12 w-full min-w-0 rounded-lg border-[1.5px] border-input bg-card px-3 text-[15px] text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive file:mr-3 file:rounded-full file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-secondary-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
