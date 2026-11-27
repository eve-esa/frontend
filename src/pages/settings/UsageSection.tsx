import type { ReactNode } from "react";
import dayjs from "dayjs";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { FIELD_ERROR_CLASS } from "@/components/profile/fieldError";
import { useGetUserMessageStats } from "@/services/useGetUserMessageStats";
import {
  useRecountStorageUsage,
  useStorageUsage,
  type StorageUsageResponse,
} from "@/services/useStorageUsage";
import { useTokenUsage, type TokenUsageResponse } from "@/services/useTokenUsage";
import { STORAGE_QUOTA_ENABLED } from "@/utilities/features";
import { formatBytes } from "@/utilities/formatBytes";
import "@/utilities/dayjs";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

const NUMBER = new Intl.NumberFormat("en-US");

const GRAMS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const KILOGRAMS = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const KILOGRAMS_LARGE = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

/** Grams below 1 kg, so a small footprint does not read as 0. */
const formatCo2eq = (kg: number): string => {
  if (kg <= 0) return "0 g";
  if (kg < 1) {
    const grams = kg * 1000;
    return grams < 0.1 ? "Under 0.1 g" : `${GRAMS.format(grams)} g`;
  }
  return `${(kg < 100 ? KILOGRAMS : KILOGRAMS_LARGE).format(kg)} kg`;
};

/** The backend sends UTC without an offset; the budget window is a UTC window. */
const formatPeriodDate = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const date = dayjs.utc(value);
  return date.isValid() ? `${date.format("D MMMM YYYY")} UTC` : null;
};

const BIG_CLASS = "text-[28px] leading-9 font-bold text-natural-50";
const BIG_UNIT_CLASS = "ml-1.5 text-sm font-normal text-natural-200";

const Fact = ({
  label,
  value,
  testId,
}: {
  label: string;
  value: ReactNode;
  testId?: string;
}) => (
  <div>
    <dt className="text-sm text-natural-200">{label}</dt>
    <dd
      data-testid={testId}
      className="mt-0.5 text-md font-bold text-natural-50"
    >
      {value}
    </dd>
  </div>
);

const FACTS_CLASS = "m-0 grid grid-cols-2 gap-4 md:grid-cols-4";

/** Used share as a whole percentage rounded down, so 99.5% never reads as full. */
const usedPercent = (usage: TokenUsageResponse): number => {
  const ratio =
    usage.used_ratio ??
    (usage.max_tokens ? usage.used_tokens / usage.max_tokens : 0);
  return Math.min(100, Math.max(0, Math.floor(ratio * 100)));
};

/** The two period rows, left out when the API gives no period. */
const PeriodFacts = ({ usage }: { usage: TokenUsageResponse }) => {
  const start = formatPeriodDate(usage.period_start);
  const end = formatPeriodDate(usage.period_end);
  return (
    <>
      {start && <Fact label="Period started" value={start} />}
      {end && (
        <Fact label="Resets" value={end} testId="settings-usage-reset" />
      )}
    </>
  );
};

const TokenBudget = () => {
  const { data: usage, isLoading, isError, refetch } = useTokenUsage();

  let body: ReactNode;
  if (isLoading) {
    body = <Skeleton className="h-[160px] w-full" />;
  } else if (isError || !usage) {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className={FIELD_ERROR_CLASS}>
          Could not load your token usage.
        </p>
        <Button
          variant="outline"
          size="md"
          data-testid="settings-usage-retry"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (usage.unlimited) {
    body = (
      <>
        <p className={BIG_CLASS} data-testid="settings-usage-unlimited">
          Unlimited
        </p>
        <dl className={`${FACTS_CLASS} mt-4`}>
          <Fact
            label="Used this period"
            value={NUMBER.format(usage.used_tokens)}
            testId="settings-usage-used"
          />
          <PeriodFacts usage={usage} />
        </dl>
      </>
    );
  } else {
    const percent = usedPercent(usage);
    body = (
      <>
        <p className={BIG_CLASS}>
          <span data-testid="settings-usage-used">
            {NUMBER.format(usage.used_tokens)}
          </span>
          <small className={BIG_UNIT_CLASS}>
            of{" "}
            <span data-testid="settings-usage-limit">
              {usage.max_tokens === null
                ? "Not available"
                : NUMBER.format(usage.max_tokens)}
            </span>{" "}
            tokens used
          </small>
        </p>
        <div
          role="progressbar"
          aria-label="Tokens used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          data-testid="settings-usage-bar"
          className="mt-3 mb-4 h-2 overflow-hidden rounded-sm bg-primary-500"
        >
          <div
            className="h-full bg-success-200 in-data-[theme=light]:bg-focus"
            style={{ width: `${percent}%` }}
          />
        </div>
        <dl className={FACTS_CLASS}>
          <Fact
            label="Remaining"
            value={
              usage.remaining_tokens === null
                ? "Not available"
                : NUMBER.format(usage.remaining_tokens)
            }
            testId="settings-usage-remaining"
          />
          <Fact
            label="Used"
            value={
              percent === 0 && usage.used_tokens > 0 ? "Under 1%" : `${percent}%`
            }
          />
          <PeriodFacts usage={usage} />
        </dl>
      </>
    );
  }

  return (
    <SettingsPanel>
      <h2 className="text-lg font-bold text-natural-50">Token budget</h2>
      <p className="mt-1 mb-4 text-sm text-natural-200">
        Chats and API requests draw from the same budget.
      </p>
      {body}
    </SettingsPanel>
  );
};

const storagePercent = (usage: StorageUsageResponse): number => {
  const ratio =
    usage.used_ratio ??
    (usage.max_bytes ? usage.used_bytes / usage.max_bytes : 0);
  return Math.min(100, Math.max(0, Math.floor(ratio * 100)));
};

const StorageBudget = () => {
  const { data: usage, isLoading, isError, refetch } = useStorageUsage();
  const recount = useRecountStorageUsage();

  let body: ReactNode;
  if (isLoading) {
    body = <Skeleton className="h-[120px] w-full" />;
  } else if (isError || !usage) {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p role="alert" className={FIELD_ERROR_CLASS}>
          Could not load your storage usage.
        </p>
        <Button
          variant="outline"
          size="md"
          data-testid="settings-storage-retry"
          onClick={() => void refetch()}
        >
          Try again
        </Button>
      </div>
    );
  } else if (usage.unlimited || usage.max_bytes === null) {
    body = (
      <>
        <p className={BIG_CLASS} data-testid="settings-storage-unlimited">
          Unlimited
        </p>
        <dl className={`${FACTS_CLASS} mt-4`}>
          <Fact
            label="Stored"
            value={formatBytes(usage.used_bytes)}
            testId="settings-storage-used"
          />
        </dl>
      </>
    );
  } else {
    const percent = storagePercent(usage);
    body = (
      <>
        <p className={BIG_CLASS}>
          <span data-testid="settings-storage-used">
            {formatBytes(usage.used_bytes)}
          </span>
          <small className={BIG_UNIT_CLASS}>
            of{" "}
            <span data-testid="settings-storage-limit">
              {formatBytes(usage.max_bytes)}
            </span>{" "}
            used
          </small>
        </p>
        <div
          role="progressbar"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          data-testid="settings-storage-bar"
          className="mt-3 mb-4 h-2 overflow-hidden rounded-sm bg-primary-500"
        >
          <div
            className="h-full bg-success-200 in-data-[theme=light]:bg-focus"
            style={{ width: `${percent}%` }}
          />
        </div>
        <dl className={FACTS_CLASS}>
          <Fact
            label="Remaining"
            value={formatBytes(usage.remaining_bytes ?? 0)}
            testId="settings-storage-remaining"
          />
          <Fact
            label="Used"
            value={
              percent === 0 && usage.used_bytes > 0 ? "Under 1%" : `${percent}%`
            }
          />
        </dl>
      </>
    );
  }

  return (
    <SettingsPanel className="mt-4">
      <h2 className="text-lg font-bold text-natural-50">Storage</h2>
      <p className="mt-1 mb-4 text-sm text-natural-200">
        Files, sandbox workspace and large tool results. Delete files or
        conversations to free space.
      </p>
      {body}
      {usage && (
        <div className="mt-4">
          {recount.isError && (
            <p role="alert" className={`${FIELD_ERROR_CLASS} mb-3`}>
              Could not recalculate your storage.
            </p>
          )}
          <Button
            variant="outline"
            size="md"
            data-testid="settings-storage-recount"
            onClick={() => recount.mutate()}
            disabled={recount.isPending}
          >
            {recount.isPending ? "Calculating..." : "Recalculate"}
          </Button>
        </div>
      )}
    </SettingsPanel>
  );
};

const Activity = () => {
  // Nothing is fetched until a Calculate click, as in the CO2eq dialog. Totals
  // cached by an earlier visit show at once, and every click fetches again.
  const { data, isFetching, isError, refetch } = useGetUserMessageStats(false);

  return (
    <SettingsPanel className="mt-4">
      <h2 className="text-lg font-bold text-natural-50">Activity and CO2eq</h2>
      <p className="mt-1 mb-4 text-sm text-natural-200">
        All your messages since you joined. The totals are computed when you
        ask for them.
      </p>

      {isFetching && !data ? (
        <Skeleton className="h-[120px] w-full" />
      ) : data ? (
        <div data-testid="settings-usage-stats">
          <dl className={FACTS_CLASS}>
            <Fact label="Messages" value={NUMBER.format(data.message_count)} />
            <Fact
              label="Input characters"
              value={NUMBER.format(data.input_characters)}
            />
            <Fact
              label="Output characters"
              value={NUMBER.format(data.output_characters)}
            />
            <Fact
              label="Total characters"
              value={NUMBER.format(data.total_characters)}
            />
          </dl>
          <p className={`${BIG_CLASS} mt-4`}>
            <span data-testid="settings-usage-co2eq">
              {formatCo2eq(data.co2eq_kg)}
            </span>
            <small className={BIG_UNIT_CLASS}>CO2eq</small>
          </p>
          <p className="mt-1 text-sm text-natural-200">
            Estimate, not yet verified. Characters divided by 4 give tokens,
            multiplied by a fixed factor per token.
          </p>
        </div>
      ) : null}

      {isError && !isFetching && (
        <p role="alert" className={`${FIELD_ERROR_CLASS} mb-3`}>
          Could not calculate your activity.
        </p>
      )}

      <div className={data ? "mt-4" : undefined}>
        <Button
          variant="outline"
          size="md"
          data-testid="settings-usage-calculate"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? "Calculating..." : data ? "Recalculate" : "Calculate"}
        </Button>
      </div>
    </SettingsPanel>
  );
};

/** What the account has used: the token budget of the period, storage, and the activity totals. */
export const UsageSection = () => (
  <SettingsSection
    id="usage"
    title="Usage"
    lead={
      STORAGE_QUOTA_ENABLED
        ? "Your token budget for this period, your storage, and your activity since you joined."
        : "Your token budget for this period and your activity since you joined."
    }
  >
    <TokenBudget />
    {STORAGE_QUOTA_ENABLED && <StorageBudget />}
    <Activity />
  </SettingsSection>
);
