"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

// Notion-shaped markdown renderer. Sans-serif throughout, generous line
// height, restrained headings (weight + size carry hierarchy — no color).
// Used for rendering the body content of research / PRD / memo artifacts.

interface Props {
  children: string;
  className?: string;
}

export function MarkdownBody({ children, className }: Props) {
  return (
    <div className={cn("markdown-body", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-[20px] font-semibold tracking-tight mt-6 mb-3 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[17px] font-semibold tracking-tight mt-6 mb-2.5 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold tracking-tight mt-5 mb-2 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[14px] font-semibold tracking-tight mt-4 mb-1.5 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[14px] leading-relaxed text-foreground/90 my-3 first:mt-0 last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="text-[14px] leading-relaxed text-foreground/90 list-disc pl-5 my-3 space-y-1.5">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="text-[14px] leading-relaxed text-foreground/90 list-decimal pl-5 my-3 space-y-1.5">
              {children}
            </ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-foreground/30 pl-4 my-4 text-foreground/80 italic">
              {children}
            </blockquote>
          ),
          code: ({ children, className }) => {
            // ReactMarkdown passes className like "language-ts" for code
            // blocks vs none for inline code.
            const isBlock = !!className;
            if (isBlock) {
              return (
                <code className="block bg-muted rounded p-3 text-[13px] font-mono leading-normal overflow-x-auto my-3">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.9em] font-mono">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-3">{children}</pre>,
          a: ({ children, href }) => (
            <a
              href={href}
              target={href?.startsWith("http") ? "_blank" : undefined}
              rel={
                href?.startsWith("http") ? "noopener noreferrer" : undefined
              }
              className="text-foreground underline decoration-1 underline-offset-2 hover:text-primary hover:decoration-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-6 border-border" />,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          table: ({ children }) => (
            <div className="my-4 overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left font-medium text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-3 first:pl-0 last:pr-0">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="py-2 px-3 first:pl-0 last:pr-0 border-b border-border/60 align-top">
              {children}
            </td>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
