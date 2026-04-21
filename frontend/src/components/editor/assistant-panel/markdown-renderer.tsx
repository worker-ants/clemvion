"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ComponentProps } from "react";

/**
 * Renders an assistant chat message as markdown.
 *
 * Design choices:
 * - `remark-gfm` for GitHub flavored markdown (tables, strikethrough, task
 *   lists, autolinks). We do NOT enable `rehype-raw` — that would allow raw
 *   HTML from the LLM response, a XSS vector.
 * - No `@tailwindcss/typography`. Each HTML tag produced by the parser is
 *   styled via arbitrary tailwind selectors on the wrapper (`[&_pre]:...`).
 *   This keeps the assistant bubble tuned to the chat panel's compact size
 *   and avoids a global CSS dependency.
 * - Links open in a new tab with `noreferrer noopener`; the LLM output is
 *   treated as untrusted external content.
 * - While streaming, partial/unclosed markdown is fine — react-markdown
 *   tolerates malformed input and renders progressively.
 */
export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div
      role="region"
      aria-label="Assistant response"
      className={[
        // paragraph / line spacing tuned for compact chat bubbles
        "[&_p]:my-1 [&_p]:leading-relaxed",
        "[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_ul]:space-y-0.5",
        "[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-1 [&_ol]:space-y-0.5",
        // headings — shrink scale to fit within a text-xs bubble
        "[&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1",
        "[&_h2]:text-xs [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1",
        "[&_h3]:text-[11px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
        "[&_h4]:text-[11px] [&_h4]:font-semibold [&_h4]:mt-1 [&_h4]:mb-0.5",
        "[&_h5]:text-[11px] [&_h5]:font-semibold",
        "[&_h6]:text-[11px] [&_h6]:font-semibold",
        // inline code + fenced code blocks
        "[&_code]:rounded-sm [&_code]:bg-[hsl(var(--muted))] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px]",
        "[&_pre]:my-2 [&_pre]:rounded-md [&_pre]:bg-[hsl(var(--muted))] [&_pre]:p-2 [&_pre]:overflow-x-auto [&_pre]:text-[11px] [&_pre]:leading-relaxed",
        "[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-inherit [&_pre_code]:font-mono",
        // emphasis
        "[&_strong]:font-semibold [&_em]:italic",
        // links
        "[&_a]:text-[hsl(var(--primary))] [&_a]:underline hover:[&_a]:no-underline",
        // blockquotes
        "[&_blockquote]:border-l-2 [&_blockquote]:border-[hsl(var(--border))] [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_blockquote]:italic [&_blockquote]:text-[hsl(var(--muted-foreground))]",
        // tables (GFM)
        "[&_table]:w-full [&_table]:border-collapse [&_table]:text-[11px] [&_table]:my-2",
        "[&_th]:border [&_th]:border-[hsl(var(--border))] [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-[hsl(var(--border))] [&_td]:px-1.5 [&_td]:py-0.5",
        "[&_hr]:my-2 [&_hr]:border-[hsl(var(--border))]",
        // first/last block removes extra vertical margin — keeps bubble tight
        "[&>:first-child]:mt-0 [&>:last-child]:mb-0",
      ].join(" ")}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props: ComponentProps<"a">) => (
            <a {...props} target="_blank" rel="noreferrer noopener" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
