import type { HTMLAttributes, ReactNode } from "react";
import { isUserFile, markerLabel, type MarkerInstance } from "@/utilities/citations";
import { rehypeCitationMarkers } from "@/utilities/rehypeCitationMarkers";
import { useCitations } from "./CitationsContext";
import { CardPopover, MarkerButton } from "./SourceCard";

/** Id of the card a marker in the answer text opens. */
const markerId = (key: number) => `m${key}`;

/** A marker in the answer, rendered for the `<cite data-eve-marker>` the rehype step wrote. */
export const AnswerMarker = ({ markerKey }: { markerKey: number }) => {
  const citations = useCitations();
  const marker = citations?.markers[markerKey];
  if (!marker || marker.entries.length === 0) return null;
  const first = marker.entries[0];
  const label =
    marker.ns.length >= 3
      ? `Sources ${marker.ns[0]} to ${marker.ns[marker.ns.length - 1]}`
      : markerLabel(first);
  return (
    <MarkerButton
      id={markerId(markerKey)}
      ns={marker.ns}
      label={label}
      own={marker.ns.length === 1 && isUserFile(first)}
    />
  );
};

/** A top-level block holding markers: the card of the open one anchors to it (in place under the line on a phone). */
export const AnswerBlock = ({ markerKeys, children }: { markerKeys: number[]; children: ReactNode }) => {
  const citations = useCitations();
  const openKey = markerKeys.find((key) => citations?.openId === markerId(key));
  const marker = openKey === undefined ? undefined : citations?.markers[openKey];
  return (
    <div className="relative" data-testid="citation-block">
      {children}
      {openKey !== undefined && marker && <CardPopover id={markerId(openKey)} entries={marker.entries} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shared by both answer renderers (SmartText and StreamdownText)
// ---------------------------------------------------------------------------

type HastLike = { properties?: Record<string, unknown> };

const blockKeys = (value: unknown): number[] =>
  typeof value === "string"
    ? value.split(" ").map(Number).filter((key) => Number.isInteger(key))
    : [];

/** The rehype step both renderers add after their sanitizer; `getMarkers` reads the live list. */
export const citationRehypePlugin = (getMarkers: () => readonly MarkerInstance[] | undefined) =>
  rehypeCitationMarkers({
    restore: (key) => getMarkers()?.[key]?.ns.map((n) => `[${n}]`).join("") ?? "",
  });

/** `cite` override: our marker elements become buttons, any other `cite` stays one. */
export const CiteOverride = ({ node, children }: { node?: HastLike; children?: ReactNode }) => {
  const key = node?.properties?.dataEveMarker;
  if (typeof key === "string" && key !== "") return <AnswerMarker markerKey={Number(key)} />;
  return <cite>{children}</cite>;
};

/** `div` override: a block that holds markers gets its card slot, any other `div` renders as is. */
export const DivOverride = ({
  node,
  children,
  ...rest
}: { node?: HastLike; children?: ReactNode } & HTMLAttributes<HTMLDivElement>) => {
  const keys = blockKeys(node?.properties?.dataEveBlock);
  if (keys.length > 0) return <AnswerBlock markerKeys={keys}>{children}</AnswerBlock>;
  return <div {...rest}>{children}</div>;
};
