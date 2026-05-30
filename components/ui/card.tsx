import * as React from "react";
import { cn } from "@/lib/utils";

// Notion-shaped: the default Card is *visually transparent* — no border, no
// shadow, no background. It's just a layout block whose padding makes
// content readable. To get a visible boundary, opt in with `variant="bordered"`
// (a thin border for tables/forms) or `variant="callout"` (subtle tinted bg
// for things that genuinely need to stand apart).

type Variant = "plain" | "bordered" | "callout";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  plain: "",
  bordered: "border border-border rounded-lg",
  callout: "bg-muted rounded-lg",
};

export function Card({
  className,
  variant = "plain",
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        // Padding is the only universal thing about cards now. Removing
        // borders/shadows is the headline change.
        "p-5",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-3", className)} {...props} />;
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold tracking-tight leading-snug",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-sm text-muted-foreground mt-1", className)}
      {...props}
    />
  );
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pb-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "pt-3 mt-3 border-t border-border flex items-center justify-between",
        className,
      )}
      {...props}
    />
  );
}
