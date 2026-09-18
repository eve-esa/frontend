import { useEffect, useRef } from "react";
import { JsonView, type Props as JsonViewProps } from "react-json-view-lite";

type JsonTreeStyle = NonNullable<JsonViewProps["style"]>;

// react-json-view-lite takes class names only; the arrows and the "..." of a
// collapsed node are ::after content, defined in index.css (.json-tree-*).
// Every node is its own div with this padding, so nesting indents; the
// top-level entries have theirs removed on the container.
const JSON_TREE_STYLE: JsonTreeStyle = {
  container:
    "font-mono text-[12px] leading-5 text-natural-100 whitespace-pre-wrap [overflow-wrap:anywhere] [&>div]:pl-0",
  basicChildStyle: "m-0 pl-4",
  childFieldsContainer: "m-0 p-0 list-none",
  label: "mr-1.5 text-json-key",
  clickableLabel: "mr-1.5 text-json-key cursor-pointer",
  nullValue: "italic text-json-null",
  undefinedValue: "italic text-json-null",
  numberValue: "text-json-number",
  stringValue: "text-json-string",
  booleanValue: "text-json-boolean",
  otherValue: "text-natural-200",
  punctuation: "text-primary-300",
  expandIcon: "json-tree-expander json-tree-expand",
  collapseIcon: "json-tree-expander json-tree-collapse",
  collapsedContent: "json-tree-collapsed",
  noQuotesForStringValues: false,
  quotesForFieldNames: false,
  stringifyStringValues: false,
  ariaLables: { expandJson: "Expand", collapseJson: "Collapse" },
};

// Stable on purpose: the library re-applies these to every node whenever the
// function identity changes, which would undo what the user expanded.
const expandAll = () => true;
const expandNone = () => false;

type JsonTreeProps = {
  data: object;
  /**
   * "all" opens every node. "top" shows the top-level keys with their values
   * collapsed, for large outputs.
   */
  expand: "all" | "top";
  label: string;
  className?: string;
};

/**
 * A syntax-coloured, collapsible JSON tree. Top-level keys are listed without
 * the enclosing braces. It renders what it is given: cut long strings first
 * (truncateForDisplay in utilities/agentTrace.ts), since nothing is
 * virtualised.
 */
export const JsonTree = ({ data, expand, label, className }: JsonTreeProps) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // With the top level flattened the library leaves every toggle out of the
  // tab order (it only enables the root's), so hand the first one the roving
  // tab stop; its arrow-key handling moves it from there.
  useEffect(() => {
    const toggles =
      containerRef.current?.querySelectorAll<HTMLElement>("[role=button]");
    if (!toggles?.length) return;
    if (![...toggles].some((toggle) => toggle.tabIndex === 0)) {
      toggles[0].tabIndex = 0;
    }
  }, [data]);

  return (
    <div ref={containerRef} className={className}>
      <JsonView
        data={data}
        style={JSON_TREE_STYLE}
        shouldExpandNode={expand === "all" ? expandAll : expandNone}
        compactTopLevel
        aria-label={label}
      />
    </div>
  );
};
