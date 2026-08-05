"use client";

import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

export default function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-body text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          a: ({ node, ...props }) => <a {...props} className="text-primary underline underline-offset-2" />,
          pre: ({ node, ...props }) => (
            <pre {...props} className="overflow-x-auto rounded-lg border border-border bg-muted/40 p-3 my-2 text-xs" />
          ),
          code: ({ node, className, ...props }) =>
            className ? (
              <code className={className} {...props} />
            ) : (
              <code {...props} className="rounded bg-muted/50 px-1 py-0.5 text-[0.85em]" />
            ),
          ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-5 my-2 space-y-1" />,
          ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-5 my-2 space-y-1" />,
          li: ({ node, ...props }) => <li {...props} className="leading-relaxed" />,
          h1: ({ node, ...props }) => <h1 {...props} className="text-base font-extrabold my-2" />,
          h2: ({ node, ...props }) => <h2 {...props} className="text-sm font-extrabold my-2" />,
          h3: ({ node, ...props }) => <h3 {...props} className="text-sm font-bold my-1.5" />,
          p: ({ node, ...props }) => <p {...props} className="my-1.5" />,
          strong: ({ node, ...props }) => <strong {...props} className="font-bold" />,
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-2">
              <table {...props} className="w-full text-xs border-collapse" />
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
