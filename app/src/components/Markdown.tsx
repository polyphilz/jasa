import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex, rehypeHighlight];

export const Markdown = memo(({ text }: { text: string }) => (
  <div className="prose prose-sm prose-invert max-w-none prose-headings:text-balance prose-p:text-pretty prose-pre:border prose-a:text-accent prose-pre:border-line prose-pre:bg-surface">
    <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins}>
      {text}
    </ReactMarkdown>
  </div>
));
