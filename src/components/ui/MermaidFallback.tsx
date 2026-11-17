import { useIsCodeFenceIncomplete, type MermaidErrorComponentProps } from "streamdown";

// What a mermaid block shows when the diagram does not render. The parse
// error never reaches the user (lazyMermaid logs it at debug level):
// - the fence is still streaming: the same placeholder as while the diagram
//   loads, since a half-written diagram is expected not to parse;
// - otherwise: the source as code, inside the block that already carries the
//   "mermaid" label and the copy button, and one muted line under it.
// Muted line: primary-300, Silver on the dark ground, Deep Space -1 in light.
export const MermaidFallbackView = ({
  chart,
  incomplete,
}: {
  chart: string;
  incomplete: boolean;
}) => {
  if (incomplete) {
    return (
      <div data-testid="mermaid-pending" className="my-4 flex justify-center p-4">
        <div className="flex items-center space-x-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-current border-b-2" />
          <span className="text-sm">Loading diagram...</span>
        </div>
      </div>
    );
  }
  return (
    <div data-testid="mermaid-fallback">
      <pre
        data-testid="mermaid-fallback-code"
        className="m-0 p-4 font-mono text-sm whitespace-pre-wrap [overflow-wrap:anywhere]"
      >
        <code>{chart}</code>
      </pre>
      <p data-testid="mermaid-fallback-note" className="px-4 pb-3 text-xs text-primary-300">
        Diagram could not be drawn
      </p>
    </div>
  );
};

const MermaidFallback = ({ chart }: MermaidErrorComponentProps) => {
  const incomplete = useIsCodeFenceIncomplete();
  return <MermaidFallbackView chart={chart} incomplete={incomplete} />;
};

export default MermaidFallback;
