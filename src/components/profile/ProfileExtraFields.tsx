import type { FieldErrors, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/Input";
import {
  PROFILE_COUNTRY_MAX,
  PROFILE_INSTITUTION_MAX,
} from "@/services/useMe";

type ProfileExtraFieldValues = {
  country?: string | null;
  institution?: string | null;
};

type ProfileExtraFieldsProps<T extends ProfileExtraFieldValues> = {
  /** Prefix of the input ids and test ids: `<idPrefix>-country`, `<idPrefix>-institution`. */
  idPrefix: "profile" | "profile-required";
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
};

/**
 * Country and institution inputs, shared by the profile dialog and the required profile
 * dialog so both show the same labels, limits and messages. Required with
 * FEATURE_PROFILE_FIELDS on: the schema each form passes to its resolver enforces it.
 */
export const ProfileExtraFields = <T extends ProfileExtraFieldValues>({
  idPrefix,
  register,
  errors,
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
          <Input
            id={countryId}
            data-testid={countryId}
            className="w-full"
            placeholder="For example Italy"
            maxLength={PROFILE_COUNTRY_MAX}
            aria-required="true"
            aria-invalid={Boolean(fieldErrors?.country)}
            aria-describedby={fieldErrors?.country ? `${countryId}-error` : undefined}
            {...register("country" as Path<T>)}
            type="text"
          />
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
