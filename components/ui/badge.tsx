import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap outline-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        // Rectangular metadata label (Rautaki dossier default).
        default:
          "border-border bg-transparent text-foreground/80 uppercase tracking-[0.18em] text-[0.6875rem]",
        // Rectangular hairline metadata, micro-label typography.
        metadata:
          "border-border bg-transparent text-foreground/80 uppercase tracking-[0.22em] text-[0.6875rem] font-medium",
        // Lozenge pill — reserved for priority chips.
        pill: "rounded-full border-border bg-muted text-foreground",
        secondary: "bg-muted text-foreground",
        outline: "border-border bg-transparent text-foreground/80",
        destructive: "border-destructive/30 text-destructive",
        ghost: "bg-transparent text-foreground/80 hover:bg-muted",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
