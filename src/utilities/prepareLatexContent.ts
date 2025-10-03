/**
 * Converts LaTeX delimiters from \( \) and \[ \] format to $ and $$ format
 * for proper rendering with react-markdown and remark-math
 */
export const prepareLatexContent = (content: string): string => {
  let processedContent = content.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => {
    return `$$${latex}$$`;
  });
  processedContent = processedContent.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => {
    return `$${latex}$`;
  });
  return processedContent;
};

