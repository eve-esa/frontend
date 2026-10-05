import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import { PROFILE_INSTITUTION_MAX } from "@/services/useMe";
import { countryOptions } from "@/utilities/countries";
import { cn } from "@/lib/utils";

type ProfileExtraFieldValues = {
  country?: string | null;
  institution?: string | null;
};

type ProfileExtraFieldsProps<T extends ProfileExtraFieldValues> = {
  /** Prefix of the input ids and test ids: `<idPrefix>-country`, `<idPrefix>-institution`. */
  idPrefix: "profile" | "profile-required";
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  /** The country the profile has: kept as an option when it is not in the list. */
  storedCountry?: string | null;
};

/**
 * Country picker and institution input, shared by the profile dialog and the required profile
 * dialog so both show the same labels, limits and messages. Required with
 * FEATURE_PROFILE_FIELDS on: the schema each form passes to its resolver enforces it.
 */
export const ProfileExtraFields = <T extends ProfileExtraFieldValues>({
  idPrefix,
  register,
  errors,
  storedCountry,
}: ProfileExtraFieldsProps<T>) => {
  const fieldErrors = errors as FieldErrors<ProfileExtraFieldValues>;
  const countryId = `${idPrefix}-country`;
  const institutionId = `${idPrefix}-institution`;

  return (
    <>
      {/* COUNTRY */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor={countryId} className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Country*</p>
        </label>
        <div className="flex flex-col gap-2">
          {/* A native select: the browser's own type-to-search works over the
              whole list, on desktop and on mobile. */}
          <select
            id={countryId}
            data-testid={countryId}
            className={cn(
              "rounded-lg h-12 w-full min-w-0 px-3 text-base outline-none cursor-pointer",
              "border shadow-xs bg-primary-200 text-natural-100 border-primary-400"
            )}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors?.country)}
            aria-describedby={fieldErrors?.country ? `${countryId}-error` : undefined}
            {...register("country" as Path<T>)}
          >
            <option value="">Select a country</option>
            {countryOptions(storedCountry).map((name) => (
              <option key={name} value={name} data-testid={`${countryId}-option`}>
                {name}
              </option>
            ))}
          </select>
          {fieldErrors?.country && (
            <p id={`${countryId}-error`} className="text-sm text-red-500">
              {fieldErrors.country.message}
            </p>
          )}
        </div>
      </div>

      {/* INSTITUTION */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor={institutionId} className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Institution*</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            id={institutionId}
            data-testid={institutionId}
            className="w-full"
            placeholder="Your university, agency or company"
            maxLength={PROFILE_INSTITUTION_MAX}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors?.institution)}
            aria-describedby={fieldErrors?.institution ? `${institutionId}-error` : undefined}
            {...register("institution" as Path<T>)}
            type="text"
          />
          {fieldErrors?.institution && (
            <p id={`${institutionId}-error`} className="text-sm text-red-500">
              {fieldErrors.institution.message}
            </p>
          )}
        </div>
      </div>
    </>
  );
};
