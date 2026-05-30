"use client";
import { useState } from "react";
import { Check, Clipboard, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  // Lazy getter so we don't rebuild a large prompt on every render. The
  // function is called only on click.
  getPrompt: () => string;
  label?: string;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "secondary" | "ghost" | "outline";
  disabled?: boolean;
  // When true, render an icon-only button (e.g. inline next to a list item).
  iconOnly?: boolean;
  // Accessible label / tooltip for icon-only mode.
  ariaLabel?: string;
  className?: string;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copy this prompt", text);
    return false;
  }
}

export function CopyPromptButton({
  getPrompt,
  label = "Copy prototype prompt",
  size = "sm",
  variant = "secondary",
  disabled,
  iconOnly,
  ariaLabel,
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = await copyToClipboard(getPrompt());
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleCopy}
        disabled={disabled}
        aria-label={ariaLabel ?? "Copy prototype prompt"}
        title={ariaLabel ?? "Copy prototype prompt"}
        className={cn(
          "inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0",
          copied && "text-primary",
          className,
        )}
      >
        {copied ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Clipboard className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      disabled={disabled}
      title="Copy a prompt you can paste into Claude to get a visual prototype"
      className={className}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          Copied
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5" />
          {label}
        </>
      )}
    </Button>
  );
}
