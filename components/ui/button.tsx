import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap outline-none select-none transition-colors duration-150 ease-out motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        // Gold command strip — primary CTA, on-brand hover lightens to Gold Light.
        default:
          "bg-primary text-primary-foreground hover:bg-[color:var(--gold-light)]",
        command:
          "bg-primary text-primary-foreground hover:bg-[color:var(--gold-light)]",
        // Quiet outline — hairline border, transparent fill.
        outline:
          "border-border bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        // Ink button — secondary heavy action.
        secondary:
          "bg-foreground text-background hover:bg-foreground/90 aria-expanded:bg-foreground/90",
        ghost:
          "bg-transparent text-foreground hover:bg-muted aria-expanded:bg-muted",
        destructive:
          "bg-transparent text-destructive hover:bg-destructive/10 border-destructive/30",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-10 gap-2 px-4 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        command:
          "h-12 gap-2 px-6 text-sm has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        sm: "h-9 gap-1.5 px-3 text-[0.8125rem] has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-8 gap-1 px-2 text-xs has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        lg: "h-11 gap-2 px-5 has-data-[icon=inline-end]:pr-4 has-data-[icon=inline-start]:pl-4",
        icon: "size-10",
        "icon-sm": "size-9",
        "icon-xs": "size-8 [&_svg:not([class*='size-'])]:size-3",
        "icon-lg": "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
