import React, { useState } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { useClipboard } from "@/hooks/useClipboard";
import { faCopy } from "@fortawesome/free-regular-svg-icons";
import { faCheck } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import rehypeRaw from "rehype-raw";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";

type SmartTextProps = {
  text: string;
  className?: string;
};

const SmartText: React.FC<SmartTextProps> = ({ text, className }) => {
  const { copyToClipboard } = useClipboard();
  const [copiedContent, setCopiedContent] = useState<string | null>(null);

  // Base styles for all text elements
  const baseText = cn("text-natural-200 leading-6", className);
  const baseBlock = cn(baseText, "mb-4 last:mb-0");
  const baseHeading = cn(baseText, "font-bold");

  const components: Components = {
    a: (p) => (
      <a
        {...p}
        target="_blank"
        rel="noreferrer"
        className={cn(
          baseText,
          "text-success-200 hover:text-success-300 underline transition-colors"
        )}
      />
    ),
    em: ({ children }) => (
      <em className={cn(baseText, "italic")}>{children}</em>
    ),
    strong: ({ children }) => (
      <strong className={cn(baseText, "font-bold")}>{children}</strong>
    ),
    br: () => <br />,
    code: (props) => {
      const { className, children, ...rest } = props;

      // Check if it's a block code by looking at the content
      const content = String(children);
      const isBlockCode = content.includes("\n") || content.length > 50;

      if (!isBlockCode) {
        return (
          <code
            className={cn(
              baseText,
              "bg-primary-800/40 text-natural-200 px-1 rounded",
              className
            )}
            {...rest}
          >
            {children}
          </code>
        );
      }

      const handleCopy = () => {
        copyToClipboard(content);
        setCopiedContent(content);
        // Reset copied state after 1 second
        setTimeout(() => {
          setCopiedContent(null);
        }, 1000);
      };

      return (
        <code
          className={cn(
            baseText,
            "whitespace-pre-wrap break-words block bg-primary-800/40 p-4 pr-12 rounded-lg my-4 overflow-x-auto relative group",
            className
          )}
          {...rest}
        >
          {children}
          <span
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 cursor-pointer rounded-lg transition-colors"
          >
            {copiedContent === content ? (
              <FontAwesomeIcon
                icon={faCheck}
                className="w-4 h-4 text-primary-300"
              />
            ) : (
              <FontAwesomeIcon
                icon={faCopy}
                className="w-4 h-4 text-primary-300"
              />
            )}
          </span>
        </code>
      );
    },
    p: ({ children }) => {
      const content = React.Children.toArray(children);
      if (
        content.length === 1 &&
        React.isValidElement(content[0]) &&
        content[0].type === "pre"
      ) {
        return <>{content[0]}</>;
      }
      return <p className={cn(baseBlock, "whitespace-pre-wrap")}>{children}</p>;
    },
    ul: ({ children }) => (
      <ul
        className={cn(
          baseBlock,
          "list-disc list-outside pl-8 space-y-2 [&_ul]:list-[circle] [&_ul_ul]:list-[square]"
        )}
      >
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className={cn(baseBlock, "list-decimal list-outside pl-8 space-y-2")}>
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className={cn(baseBlock, "space-y-2")}>{children}</li>
    ),
    h1: ({ children }) => (
      <h1 className={cn(baseHeading, "text-2xl mb-4")}>{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className={cn(baseHeading, "text-lg mb-3")}>{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className={cn(baseHeading, "text-md mb-2")}>{children}</h3>
    ),
    blockquote: ({ children }) => {
      // Convert blockquote to div to avoid nesting issues
      return (
        <div
          className={cn(
            baseBlock,
            "border-l-4 border-primary-400 pl-4 italic text-natural-200"
          )}
        >
          {children}
        </div>
      );
    },
    hr: () => <hr className="my-6 border-natural-200" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full border border-natural-200 rounded-lg divide-y divide-natural-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-primary-500/20 text-natural-100">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="bg-primary-500/40 divide-y divide-natural-600">
        {children}
      </tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-primary-500/50 transition-colors">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-bold border-b border-natural-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-b border-natural-200">{children}</td>
    ),
  };

  return (
    <div className={cn(baseText, className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default SmartText;
