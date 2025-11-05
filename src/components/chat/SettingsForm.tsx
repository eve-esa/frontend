import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleInfo, faTimes } from "@fortawesome/free-solid-svg-icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { Slider } from "@/components/ui/Slider";
import { Button } from "@/components/ui/Button";
import { StepInput } from "@/components/ui/StepInput";
import {
  YearRangePicker,
  type YearRange,
} from "@/components/ui/YearRangePicker";
import { LOCAL_STORAGE_SETTINGS } from "@/utilities/localStorage";
import { messageDefaultSettings } from "@/utilities/messageDefaultSettings";
import { toast } from "sonner";
import { SettingsSelect } from "./SettingsSelect";
import {
  marketPerspectiveOptions,
  scientificAndTechnicalOptions,
  thematicPerspectiveOptions,
} from "@/utilities/filtersSelectOptions";
import { OptionSchema } from "@/types";
import { Autocomplete } from "../ui/Autocomplete";
import { AnimatedLink } from "../ui/AnimatedLink";
import { settingsTooltipExplanation } from "@/utilities/settingsTooltipExplanation";
import { journalOptions } from "@/utilities/journalOptions";

const AdvancedSettingsSchema = z.object({
  score_threshold: z.number(),
  temperature: z.number(),
  year: z
    .object({
      startYear: z.number().optional(),
      endYear: z.number().optional(),
    })
    .optional(),
  journal: z.string().optional(),
  thematic_perspective: OptionSchema.optional(),
  scientific_and_technical: OptionSchema.optional(),
  market_perspective: OptionSchema.optional(),
  n_citations: z
    .number()
    .max(500000, { message: "Value must be less than 500000" })
    .optional(),
  k: z.number().optional(),
});

export type AdvancedSettingsValidation = z.infer<typeof AdvancedSettingsSchema>;

type SettingsFormProps = {
  onToggle: () => void;
};

export const SettingsForm = ({ onToggle }: SettingsFormProps) => {
  const settings = JSON.parse(
    localStorage.getItem(LOCAL_STORAGE_SETTINGS) ?? "{}"
  );

  const {
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors, isValid },
  } = useForm<AdvancedSettingsValidation>({
    defaultValues: {
      score_threshold: settings?.score_threshold ?? 0.3,
      temperature: settings?.temperature ?? 0.3,
      year: settings?.year
        ? {
            startYear: settings.year.startYear,
            endYear: settings.year.endYear,
          }
        : undefined,
      journal: settings?.journal ?? undefined,
      thematic_perspective: settings?.thematic_perspective ?? undefined,
      scientific_and_technical: settings?.scientific_and_technical ?? undefined,
      market_perspective: settings?.market_perspective ?? undefined,
      n_citations: settings?.n_citations ?? 1,
      k: settings?.k ?? 1,
    },
    mode: "onChange",
    resolver: zodResolver(AdvancedSettingsSchema),
  });

  const score_threshold = watch("score_threshold");
  const temperature = watch("temperature");
  const year = watch("year");
  const n_citations = watch("n_citations");
  const thematic_perspective = watch("thematic_perspective");
  const scientific_and_technical = watch("scientific_and_technical");
  const market_perspective = watch("market_perspective");
  const k = watch("k");
  const onSubmit = (data: AdvancedSettingsValidation) => {
    localStorage.setItem(LOCAL_STORAGE_SETTINGS, JSON.stringify(data));
    toast.success("Settings saved", { duration: 1000 });
  };

  const hideClassificationFilters =
    import.meta.env.VITE_HIDE_CLASSIFICATION_FILTERS?.toLowerCase() === "true";

  return (
    <form
      className="flex flex-col h-full gap-4"
      data-tour="control-panel"
      onSubmit={handleSubmit(onSubmit)}
    >
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-6 bg-primary-700 z-10 pt-6 relative">
        <div className="flex flex-col gap-6 w-full">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-lg 3xl:text-3xl text-natural-50">
              Control Panel
            </h2>

            <FontAwesomeIcon
              icon={faTimes}
              onClick={onToggle}
              className="text-primary-50 h-6 hover:bg-natural-700 rounded-md transition-colors cursor-pointer"
            />
          </div>

          <p className="text-sm 3xl:text-xl text-natural-200 font-['NotesESA'] leading-6">
            These settings control how the assistant searches and uses documents
            during RAG (Retrieval-Augmented Generation). You can adjust how many
            documents are retrieved, how relevant they must be, and other
            filters.
          </p>
        </div>
        <div className="absolute bottom-[-26px] left-0 right-0 h-4 bg-gradient-to-b from-primary-900 to-transparent pointer-events-none" />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-8 py-6">
          <div className="flex flex-col gap-8 px-6">
            {/* Temperature */}
            <div className="flex flex-col gap-4">
              <div className="w-full flex items-center justify-between gap-1">
                <label
                  htmlFor="temperature"
                  className="flex items-center gap-1"
                >
                  <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                    {settingsTooltipExplanation.temperature.title}
                  </p>
                  {settingsTooltipExplanation.temperature.explanation && (
                    <Tooltip
                      content={
                        <>
                          {settingsTooltipExplanation.temperature.explanation}
                        </>
                      }
                      className="max-w-[280px] md:max-w-[350px]"
                    >
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className="size-4 cursor-pointer"
                      />
                    </Tooltip>
                  )}
                </label>
                <span className="font-['NotesESA'] text-sm ">
                  {temperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[temperature]}
                max={1}
                min={0}
                step={0.1}
                onValueChange={(value) => {
                  setValue("temperature", value[0], {
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            {/* Similarity threshold */}
            <div className="flex flex-col gap-4">
              <div className="w-full flex items-center justify-between gap-1">
                <label
                  htmlFor="score_threshold"
                  className="flex items-center gap-1 "
                >
                  <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                    {settingsTooltipExplanation.score_threshold.title}
                  </p>
                  {settingsTooltipExplanation.score_threshold.explanation && (
                    <Tooltip
                      content={
                        <>
                          {
                            settingsTooltipExplanation.score_threshold
                              .explanation
                          }
                        </>
                      }
                      className="max-w-[280px] md:max-w-[350px]"
                    >
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className="size-4 cursor-pointer"
                      />
                    </Tooltip>
                  )}
                </label>
                <span className="font-['NotesESA'] text-sm ">
                  {score_threshold.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[score_threshold]}
                max={1}
                min={0}
                step={0.1}
                onValueChange={(value) => {
                  setValue("score_threshold", value[0], {
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            <div className="border-t-2 border-primary-500" />
            {/* RAG Settings */}
            <span className="text-lg">RAG Settings</span>
            {/* Max documents */}
            <div className="flex flex-col gap-2 p-[1px]">
              <label htmlFor="maxDocuments" className="flex items-center gap-1">
                <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                  {settingsTooltipExplanation.k.title}
                </p>
                {settingsTooltipExplanation.k.explanation && (
                  <Tooltip
                    content={<>{settingsTooltipExplanation.k.explanation}</>}
                    className="max-w-[280px] md:max-w-[350px]"
                  >
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className="size-4 cursor-pointer"
                    />
                  </Tooltip>
                )}
              </label>
              <StepInput
                value={k ?? 0}
                onChange={(value) => {
                  setValue("k", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
              />
              {errors.k && (
                <p className="text-danger-300 text-sm ">{errors.k.message}</p>
              )}
            </div>
            {/* Document Date Range */}
            <div className="flex flex-col gap-2 p-[1px]">
              <label
                htmlFor="documentDateRange"
                className="flex items-center gap-1"
              >
                <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                  {settingsTooltipExplanation.year.title}
                </p>
                {settingsTooltipExplanation.year.explanation && (
                  <Tooltip
                    content={<>{settingsTooltipExplanation.year.explanation}</>}
                    className="max-w-[280px] md:max-w-[350px]"
                  >
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className="size-4 cursor-pointer"
                    />
                  </Tooltip>
                )}
              </label>
              <YearRangePicker
                yearRange={year as YearRange | undefined}
                placeholder="Select year range"
                onYearRangeChange={(yearRange) => {
                  setValue("year", yearRange, {
                    shouldValidate: true,
                  });
                }}
              />
            </div>
            {/* Journal */}
            <div className="flex flex-col gap-2 p-[1px]">
              <label htmlFor="journal" className="flex items-center gap-1">
                <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                  {settingsTooltipExplanation.journal.title}
                </p>
                {settingsTooltipExplanation.journal.explanation && (
                  <Tooltip
                    content={
                      <>{settingsTooltipExplanation.journal.explanation}</>
                    }
                    className="max-w-[280px] md:max-w-[350px]"
                  >
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className="size-4 cursor-pointer"
                    />
                  </Tooltip>
                )}
              </label>
              <Controller
                name="journal"
                control={control}
                render={({ field }) => (
                  <Autocomplete
                    options={journalOptions}
                    value={field.value || ""}
                    onChange={field.onChange}
                    placeholder="Enter or select journal name"
                    variant="secondary"
                  />
                )}
              />
            </div>
            {/* TOPIC FILTERS */}
            {/* Semantic Perspective */}
            {!hideClassificationFilters && (
              <div className="flex flex-col gap-2 p-[1px]">
                <label className="flex items-center gap-1">
                  <p className="font-['NotesESA'] text-sm 3xl:text-xl">
                    {settingsTooltipExplanation.thematic_perspective.title}
                  </p>
                  {settingsTooltipExplanation.thematic_perspective
                    .explanation && (
                    <Tooltip
                      content={
                        <>
                          {
                            settingsTooltipExplanation.thematic_perspective
                              .explanation
                          }
                        </>
                      }
                      className="max-w-[280px] md:max-w-[350px]"
                    >
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className="size-4 cursor-pointer"
                      />
                    </Tooltip>
                  )}
                </label>
                <Controller
                  name="thematic_perspective"
                  control={control}
                  render={({ field }) => (
                    <SettingsSelect
                      placeholder="Select value"
                      options={thematicPerspectiveOptions}
                      value={thematic_perspective}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
            {/* Scientific and Technical */}
            {!hideClassificationFilters && (
              <div className="flex flex-col gap-2 p-[1px]">
                <label className="flex items-center gap-1">
                  <p className="font-['NotesESA'] text-sm 3xl:text-xl 3xl:leading-6">
                    {settingsTooltipExplanation.scientific_and_technical.title}
                  </p>
                  {settingsTooltipExplanation.scientific_and_technical
                    .explanation && (
                    <Tooltip
                      content={
                        <>
                          {
                            settingsTooltipExplanation.scientific_and_technical
                              .explanation
                          }
                        </>
                      }
                      className="max-w-[280px] md:max-w-[350px]"
                    >
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className="size-4 cursor-pointer"
                      />
                    </Tooltip>
                  )}
                </label>
                <Controller
                  name="scientific_and_technical"
                  control={control}
                  render={({ field }) => (
                    <SettingsSelect
                      placeholder="Select value"
                      options={scientificAndTechnicalOptions}
                      value={scientific_and_technical}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
            {/* Market Perspective */}
            {!hideClassificationFilters && (
              <div className="flex flex-col gap-2 p-[1px]">
                <label className="flex items-center gap-1">
                  <p className="font-['NotesESA'] text-sm 3xl:text-xl 3xl:leading-6">
                    {settingsTooltipExplanation.market_perspective.title}
                  </p>
                  {settingsTooltipExplanation.market_perspective
                    .explanation && (
                    <Tooltip
                      content={
                        <>
                          {
                            settingsTooltipExplanation.market_perspective
                              .explanation
                          }
                        </>
                      }
                      className="max-w-[280px] md:max-w-[350px]"
                    >
                      <FontAwesomeIcon
                        icon={faCircleInfo}
                        className="size-4 cursor-pointer"
                      />
                    </Tooltip>
                  )}
                </label>
                <Controller
                  name="market_perspective"
                  control={control}
                  render={({ field }) => (
                    <SettingsSelect
                      placeholder="Select value"
                      options={marketPerspectiveOptions}
                      value={market_perspective}
                      onValueChange={field.onChange}
                    />
                  )}
                />
              </div>
            )}
            {/* Min citations */}
            <div className="flex flex-col gap-2 p-[1px]">
              <label htmlFor="maxDocuments" className="flex items-center gap-1">
                <p className="font-['NotesESA'] text-sm 3xl:text-xl 3xl:leading-6">
                  {settingsTooltipExplanation.n_citations.title}
                </p>
                {settingsTooltipExplanation.n_citations.explanation && (
                  <Tooltip
                    content={
                      <>{settingsTooltipExplanation.n_citations.explanation}</>
                    }
                    className="max-w-[280px] md:max-w-[350px]"
                  >
                    <FontAwesomeIcon
                      icon={faCircleInfo}
                      className="size-4 cursor-pointer"
                    />
                  </Tooltip>
                )}
              </label>
              <StepInput
                value={n_citations ?? 0}
                max={500000}
                step={10}
                onChange={(value) => {
                  setValue("n_citations", value, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }}
              />
              {errors.n_citations && (
                <p className="text-danger-300 text-sm ">
                  {errors.n_citations.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-4 items-center flex-none w-full px-6 sticky bottom-[-1px] bg-primary-700 z-10 py-6 mb-[-2px]">
          <div className="absolute top-[-8px] left-0 right-0 h-3 bg-gradient-to-t from-primary-900 to-transparent pointer-events-none z-10" />
          <Button
            type="submit"
            variant="outline"
            size="md"
            disabled={!isValid}
            className="w-full 3xl:text-xl"
          >
            SAVE VALUES
          </Button>
          <AnimatedLink
            onClick={() => {
              localStorage.setItem(
                LOCAL_STORAGE_SETTINGS,
                JSON.stringify(messageDefaultSettings)
              );

              // Reset all fields using Object.keys for cleaner code
              Object.keys(messageDefaultSettings).forEach((key) => {
                const fieldName = key as keyof typeof messageDefaultSettings;
                const value =
                  fieldName === "year"
                    ? undefined
                    : messageDefaultSettings[fieldName];
                setValue(fieldName, value, {
                  shouldValidate: true,
                  shouldTouch: true,
                });
              });

              toast.success("Settings reset to default values");
            }}
          >
            Reset filters to default values
          </AnimatedLink>
        </div>
      </div>
    </form>
  );
};
