import { useState, type ReactNode } from "react";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/Dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/Select";
import type {
  McpPreferredCitation,
  McpServerAttribution,
  McpServerAuthor,
} from "@/services/useGetMcpServers";

type McpAttributionProps = {
  attribution: McpServerAttribution | null;
  serverName: string;
};

const linkClass =
  "underline break-all text-success-200 in-data-[theme=light]:text-success-100";

// The payload only carries http(s) URLs. Anything else is treated as unset
// so a stray value cannot become an href. Do not build a GitHub URL from alias.
const httpUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }
  return null;
};

const namedAuthors = (authors: McpServerAuthor[]): McpServerAuthor[] =>
  authors.filter((author) => author.name.trim());

const showTitle = (attribution: McpServerAttribution, serverName: string) => {
  const title = attribution.title.trim();
  if (!title) return false;
  // The dialog heading is the server name. Repeat the citation title only
  // when it differs, or when there is no author to credit.
  if (namedAuthors(attribution.authors).length === 0) return true;
  return title !== serverName.trim();
};

const preferredHasCredits = (citation: McpPreferredCitation | null) => {
  if (!citation) return false;
  const authors = Array.isArray(citation.authors) ? citation.authors : [];
  return (
    authors.some((name) => name.trim()) ||
    Boolean(citation.year?.trim()) ||
    Boolean(citation.title.trim()) ||
    Boolean(citation.doi?.trim())
  );
};

const hasVisibleCredits = (
  attribution: McpServerAttribution,
  serverName: string,
) =>
  showTitle(attribution, serverName) ||
  Boolean(attribution.abstract?.trim()) ||
  namedAuthors(attribution.authors).length > 0 ||
  Boolean(attribution.license?.trim()) ||
  Boolean(httpUrl(attribution.repository_url)) ||
  preferredHasCredits(attribution.preferred_citation);

const ExternalLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <a href={href} target="_blank" rel="noreferrer" className={linkClass}>
    {children}
  </a>
);

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-x-4 border-b border-primary-400/40 py-2">
    <dt className="text-xs 3xl:text-base text-natural-200">{label}</dt>
    <dd className="min-w-0 break-words text-sm 3xl:text-lg text-natural-50">
      {children}
    </dd>
  </div>
);

const AuthorDropdown = ({
  names,
  value,
  onValueChange,
  label,
}: {
  names: string[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
}) => {
  const index = Number(value);
  const selected = names[index] ?? names[0] ?? "";

  return (
    <Select
      value={names[index] ? value : "0"}
      onValueChange={(next) => {
        // Radix can emit "" when the hidden select remounts.
        if (!next) return;
        onValueChange(next);
      }}
    >
      <SelectTrigger aria-label={label} className="h-9 p-2">
        <span className="truncate">{selected}</span>
      </SelectTrigger>
      <SelectContent>
        {names.map((name, itemIndex) => (
          <SelectItem key={`${name}-${itemIndex}`} value={String(itemIndex)}>
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const ServerAuthors = ({ authors }: { authors: McpServerAuthor[] }) => {
  const [value, setValue] = useState("0");
  if (authors.length === 1) return <AuthorRows author={authors[0]} />;

  const index = Number(value);
  const selected = authors[index] ?? authors[0];

  return (
    <>
      <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-4 border-b border-primary-400/40 py-2">
        <dt className="text-xs 3xl:text-base text-natural-200">Authors</dt>
        <dd className="min-w-0">
          <AuthorDropdown
            names={authors.map((author) => author.name.trim())}
            value={authors[index] ? value : "0"}
            onValueChange={setValue}
            label="Authors"
          />
        </dd>
      </div>
      <AuthorRows author={selected} />
    </>
  );
};

const AuthorRows = ({ author }: { author: McpServerAuthor }) => {
  const href = httpUrl(author.website) ?? httpUrl(author.github_url);
  const orcid = httpUrl(author.orcid);
  const affiliation = author.affiliation?.trim() ?? "";
  const name = author.name.trim();

  return (
    <>
      <Row label="Author">
        {href ? <ExternalLink href={href}>{name}</ExternalLink> : name}
      </Row>
      {affiliation ? <Row label="Affiliation">{affiliation}</Row> : null}
      {orcid ? (
        <Row label="ORCID">
          <ExternalLink href={orcid}>{orcid}</ExternalLink>
        </Row>
      ) : null}
    </>
  );
};

const PreferredCitationRows = ({
  citation,
}: {
  citation: McpPreferredCitation;
}) => {
  const authors = (Array.isArray(citation.authors) ? citation.authors : [])
    .map((name) => name.trim())
    .filter(Boolean);
  const year = citation.year?.trim() ?? "";
  const title = citation.title.trim();
  const doi = citation.doi?.trim() ?? "";
  const url = httpUrl(citation.url);
  const [authorValue, setAuthorValue] = useState("0");

  if (!authors.length && !year && !title && !doi) return null;

  return (
    <>
      <div className="pt-4 pb-1 text-sm 3xl:text-lg font-semibold text-natural-50">
        Cite this work
      </div>
      {authors.length > 1 ? (
        <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-x-4 border-b border-primary-400/40 py-2">
          <dt className="text-xs 3xl:text-base text-natural-200">Authors</dt>
          <dd className="min-w-0">
            <AuthorDropdown
              names={authors}
              value={authorValue}
              onValueChange={setAuthorValue}
              label="Preferred citation authors"
            />
          </dd>
        </div>
      ) : authors.length === 1 ? (
        <Row label="Authors">{authors[0]}</Row>
      ) : null}
      {year ? <Row label="Year">{year}</Row> : null}
      {title ? (
        <Row label="Title">
          {url ? <ExternalLink href={url}>{title}</ExternalLink> : title}
        </Row>
      ) : null}
      {doi ? <Row label="DOI">{doi}</Row> : null}
    </>
  );
};

export const McpAttributionDetails = ({
  attribution,
  serverName,
}: {
  attribution: McpServerAttribution;
  serverName: string;
}) => {
  const authors = namedAuthors(attribution.authors);
  const license = attribution.license?.trim() ?? "";
  const repository = httpUrl(attribution.repository_url);
  const title = attribution.title.trim();
  const abstract = attribution.abstract?.trim() ?? "";

  return (
    <dl
      className="flex flex-col font-['NotesESA']"
      data-testid="mcp-attribution-details"
    >
      {showTitle(attribution, serverName) ? (
        <Row label="Title">{title}</Row>
      ) : null}
      {abstract ? <Row label="Abstract">{abstract}</Row> : null}
      {authors.length > 0 ? <ServerAuthors authors={authors} /> : null}
      {license ? <Row label="License">{license}</Row> : null}
      {repository ? (
        <Row label="Repository">
          <ExternalLink href={repository}>{repository}</ExternalLink>
        </Row>
      ) : null}
      {attribution.preferred_citation ? (
        <PreferredCitationRows citation={attribution.preferred_citation} />
      ) : null}
    </dl>
  );
};

export const McpAttributionButton = ({
  attribution,
  serverName,
}: McpAttributionProps) => {
  if (!attribution || !hasVisibleCredits(attribution, serverName)) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Citation for ${serverName}`}
          data-testid="mcp-attribution"
          className="shrink-0 cursor-pointer rounded-md p-1 text-natural-200 hover:bg-natural-700 hover:text-natural-50"
        >
          <FontAwesomeIcon icon={faCircleInfo} className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent
        data-testid="mcp-attribution-dialog"
        className="max-h-[85vh] overflow-y-auto sm:max-w-xl"
      >
        <DialogHeader>
          <DialogTitle>{serverName}</DialogTitle>
          <DialogDescription className="sr-only">
            Citation for {serverName}
          </DialogDescription>
        </DialogHeader>
        <McpAttributionDetails
          attribution={attribution}
          serverName={serverName}
        />
      </DialogContent>
    </Dialog>
  );
};
