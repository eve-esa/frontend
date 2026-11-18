import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { FIELD_ERROR_CLASS } from "@/components/profile/fieldError";
import { useGetUserMessageStats } from "@/services/useGetUserMessageStats";
import { useTokenUsage, type TokenUsageResponse } from "@/services/useTokenUsage";
import { formatApiDate } from "@/utilities/dayjs";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

const NUMBER = new Intl.NumberFormat("en-US");

const CO2EQ = new Intl.NumberFormat("en-US", {
  style: "decimal",
  maximumFractionDigits: 2,
});

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

/** Used share as a whole percentage, from the API ratio or from the two counts. */
const usedPercent = (usage: TokenUsageResponse): number => {
  const ratio =
    usage.used_ratio ??
    (usage.max_tokens ? usage.used_tokens / usage.max_tokens : 0);
  return Math.min(100, Math.max(0, Math.round(ratio * 100)));
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
          <Fact
            label="Period started"
            value={formatApiDate(usage.period_start) ?? "Not available"}
          />
          <Fact
            label="Resets"
            value={formatApiDate(usage.period_end) ?? "Not available"}
            testId="settings-usage-reset"
          />
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
          <Fact label="Used" value={`${percent}%`} />
          <Fact
            label="Period started"
            value={formatApiDate(usage.period_start) ?? "Not available"}
          />
          <Fact
            label="Resets"
            value={formatApiDate(usage.period_end) ?? "Not available"}
            testId="settings-usage-reset"
          />
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

const Activity = () => {
  // Nothing is fetched until the first Calculate, as in the CO2eq dialog.
  const [shouldFetch, setShouldFetch] = useState(false);
  const { data, isFetching, isError, refetch } =
    useGetUserMessageStats(shouldFetch);

  const onCalculate = async () => {
    if (!shouldFetch) setShouldFetch(true);
    else await refetch();
  };

  return (
    <SettingsPanel className="mt-4">
      <h2 className="text-lg font-bold text-natural-50">Activity and CO2eq</h2>
      <p className="mt-1 mb-4 text-sm text-natural-200">
        All your messages since you joined. The totals are computed when you
        ask for them.
      </p>

      {shouldFetch && isFetching && !data ? (
        <Skeleton className="h-[120px] w-full" />
      ) : shouldFetch && data ? (
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
              {CO2EQ.format(data.co2eq_kg)} kg
            </span>
            <small className={BIG_UNIT_CLASS}>CO2eq</small>
          </p>
          <p className="mt-1 text-sm text-natural-200">
            Estimate, not yet verified. Characters divided by 4 give tokens,
            multiplied by a fixed factor per token.
          </p>
        </div>
      ) : null}

      {shouldFetch && isError && !isFetching && (
        <p role="alert" className={`${FIELD_ERROR_CLASS} mb-3`}>
          Could not calculate your activity.
        </p>
      )}

      <div className={shouldFetch && data ? "mt-4" : undefined}>
        <Button
          variant="outline"
          size="md"
          data-testid="settings-usage-calculate"
          onClick={() => void onCalculate()}
          disabled={isFetching}
        >
          {isFetching ? "Calculating..." : data ? "Recalculate" : "Calculate"}
        </Button>
      </div>
    </SettingsPanel>
  );
};

/** What the account has used in the current period: the token budget and the activity totals. */
export const UsageSection = () => (
  <SettingsSection
    id="usage"
    title="Usage"
    lead="What your account has used in the current period."
  >
    <TokenBudget />
    <Activity />
  </SettingsSection>
);
