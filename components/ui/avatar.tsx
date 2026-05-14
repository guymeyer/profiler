import { cn, initials } from "@/lib/utils";

function hashColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 90%)`;
}

function hashFg(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return `hsl(${hue} 60% 28%)`;
}

export function Avatar({
  name,
  size = 40,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold shrink-0 border border-border/60",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: hashColor(name),
        color: hashFg(name),
        fontSize: Math.max(10, size * 0.4),
        letterSpacing: "-0.02em",
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </div>
  );
}
