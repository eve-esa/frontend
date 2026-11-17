import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isUserFile, providerSlug, type CitationSource } from "@/utilities/citations";

/**
 * How a provider looks next to a source: its lowercase text slug in mono
 * (`wiley`, `esa`, `oa`), never a logo, initials or a licence pill. The
 * user's files draw a file type icon and a lock plus `Your files` in the own
 * colour. Colours (BRAND.md): text natural-50 ("Text"), muted primary-300
 * ("Secondary text"), own trace-agent ("Trace agent step", Trusty Azure +1 in
 * light).
 */

const Svg = ({ children, className }: { children: ReactNode; className?: string }) => (
  <svg
    viewBox="0 0 16 16"
    aria-hidden="true"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

export const LockIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="3" y="7" width="10" height="7" rx="1" />
    <path d="M5.25 7V5a2.75 2.75 0 0 1 5.5 0v2" />
  </Svg>
);
export const OpenIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5M11.5 9.5v4h-9v-9h4" />
  </Svg>
);
export const CopyIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <rect x="5" y="5" width="8.5" height="8.5" rx="1" />
    <path d="M11 5V2.5H2.5V11H5" />
  </Svg>
);
export const PageIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 1.75h5l3 3v9.5H4z" />
    <path d="M9 1.75v3h3M6 8.5h4M6 11h4" />
  </Svg>
);
const PdfIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 1.75h5l3 3v9.5H4z" />
    <path d="M9 1.75v3h3M5.75 11.75h1v-2.5h-1zM8 9.25v2.5M8 9.25h1.5M8 10.5h1.25" />
  </Svg>
);
const TextIcon = ({ className }: { className?: string }) => (
  <Svg className={className}>
    <path d="M4 1.75h5l3 3v9.5H4z" />
    <path d="M9 1.75v3h3M6 8h4M6 10h4M6 12h2.5" />
  </Svg>
);
export const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg viewBox="0 0 10 10" aria-hidden="true" className={cn("size-2.5 transition-transform", open && "rotate-180")}>
    <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

const isPdf = (source: CitationSource) =>
  source.file?.mime === "application/pdf" || /\.pdf$/i.test(source.file?.name ?? source.title);

/** File type icon plus a lock, in the own colour. */
export const OwnMark = ({ source, small = false }: { source?: CitationSource; small?: boolean }) => {
  const Icon = source && !isPdf(source) ? TextIcon : PdfIcon;
  return (
    <span aria-hidden="true" className="inline-flex flex-none items-end gap-px text-trace-agent">
      <Icon className={small ? "size-3.5" : "size-4"} />
      <LockIcon className={small ? "size-[9px]" : "size-2.5"} />
    </span>
  );
};

/**
 * The provider slug as a text label. `muted` puts it in the secondary tier
 * (lists, on the card and list surfaces); `meta` in the chip meta tier
 * natural-200, which keeps 4.5:1 on the chip fill at rest and on hover; the
 * card header keeps the text tier.
 */
export const ProviderSlug = ({
  source,
  muted = false,
  meta = false,
  small = false,
  testId,
}: {
  source: CitationSource;
  muted?: boolean;
  meta?: boolean;
  small?: boolean;
  testId?: string;
}) => {
  if (isUserFile(source)) {
    return (
      <span className="inline-flex min-w-0 flex-none items-center gap-1">
        <OwnMark source={source} small={small} />
        <span data-testid={testId} data-provider={source.provider} className="whitespace-nowrap text-trace-agent">
          Your files
        </span>
      </span>
    );
  }
  return (
    <span
      data-testid={testId}
      data-provider={source.provider}
      className={cn("flex-none font-mono whitespace-nowrap lowercase", meta ? "text-natural-200" : muted ? "text-primary-300" : "text-natural-50")}
    >
      {providerSlug(source)}
    </span>
  );
};
