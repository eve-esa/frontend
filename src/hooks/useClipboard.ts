import React from "react";

export const useClipboard = () => {
  const [isCopied, setIsCopied] = React.useState(false);
  const [isClipboardEnabled, setIsClipboardEnabled] =
    React.useState<boolean>(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    setIsClipboardEnabled(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const copyToClipboard = async (text: string) => {
    try {
      // Try modern clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for mobile and older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        const successful = document.execCommand("copy");
        document.body.removeChild(textArea);

        if (!successful) {
          throw new Error("Copy failed");
        }
      }

      setIsCopied(true);
      timeoutRef.current = setTimeout(() => setIsCopied(false), 1000);
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  };

  return { copyToClipboard, isCopied, isClipboardEnabled };
};
