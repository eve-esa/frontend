import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProfileExtraFields } from "@/components/profile/ProfileExtraFields";
import { FIELD_ERROR_CLASS } from "@/components/profile/fieldError";
import {
  ProfileSchema,
  RequiredProfileSchema,
  useGetProfile,
  type ProfileType,
} from "@/services/useMe";
import {
  toProfileFormValues,
  toProfileUpdate,
  useUpdateProfile,
} from "@/services/useUpdateProfile";
import { PROFILE_FIELDS_ENABLED } from "@/utilities/features";
import { SettingsPanel, SettingsSection } from "./SettingsSection";

const LABEL_CLASS = "font-['NotesESA'] text-sm";

/**
 * The profile form of the profile dialog as a page section: same schema, same request body,
 * same hooks, one Save at the bottom that stays disabled until a field changes.
 */
export const ProfileSection = () => {
  const { data: profile, isLoading } = useGetProfile();
  const [justSaved, setJustSaved] = useState(false);

  const { mutate: updateProfile, isPending } = useUpdateProfile(() =>
    setJustSaved(true)
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid, isDirty },
  } = useForm<ProfileType>({
    // With the flag on, country and institution cannot be emptied here: the
    // required profile dialog would ask for them again on the next render.
    resolver: zodResolver(
      PROFILE_FIELDS_ENABLED ? RequiredProfileSchema : ProfileSchema
    ),
  });

  // Prefill when the profile loads, and again after a save refetches it, which
  // also makes the form clean.
  useEffect(() => {
    if (profile) {
      reset(toProfileFormValues(profile));
    }
  }, [profile, reset]);

  useEffect(() => {
    if (isDirty) setJustSaved(false);
  }, [isDirty]);

  const onSubmit = (data: ProfileType) => {
    updateProfile(toProfileUpdate(data, PROFILE_FIELDS_ENABLED, profile));
  };

  const status = isPending
    ? "Saving."
    : isDirty
      ? "You have unsaved changes."
      : justSaved
        ? "Saved."
        : "No changes to save.";

  return (
    <SettingsSection
      id="profile"
      title="Profile"
      lead={
        PROFILE_FIELDS_ENABLED
          ? "Your name and affiliation. Your email comes from your sign-in and cannot be edited here."
          : "Your name. Your email comes from your sign-in and cannot be edited here."
      }
    >
      <SettingsPanel>
        {isLoading ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col gap-5"
            noValidate
          >
            <div className="flex flex-col gap-2">
              <label htmlFor="profile-email" className={LABEL_CLASS}>
                Email
              </label>
              <Input
                id="profile-email"
                data-testid="profile-email"
                type="email"
                readOnly
                aria-describedby="profile-email-hint"
                className="w-full text-natural-200"
                {...register("email")}
              />
              <p id="profile-email-hint" className="text-sm text-natural-200">
                Managed by your sign-in provider.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-2 md:gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="profile-first-name" className={LABEL_CLASS}>
                  First name
                </label>
                <Input
                  id="profile-first-name"
                  data-testid="profile-first-name"
                  type="text"
                  aria-invalid={Boolean(errors?.first_name)}
                  aria-describedby={
                    errors?.first_name ? "profile-first-name-error" : undefined
                  }
                  {...register("first_name")}
                />
                {errors?.first_name && (
                  <p
                    id="profile-first-name-error"
                    className={FIELD_ERROR_CLASS}
                  >
                    {errors.first_name.message}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="profile-last-name" className={LABEL_CLASS}>
                  Last name
                </label>
                <Input
                  id="profile-last-name"
                  data-testid="profile-last-name"
                  type="text"
                  aria-invalid={Boolean(errors?.last_name)}
                  aria-describedby={
                    errors?.last_name ? "profile-last-name-error" : undefined
                  }
                  {...register("last_name")}
                />
                {errors?.last_name && (
                  <p id="profile-last-name-error" className={FIELD_ERROR_CLASS}>
                    {errors.last_name.message}
                  </p>
                )}
              </div>

              {PROFILE_FIELDS_ENABLED && (
                <ProfileExtraFields
                  idPrefix="profile"
                  register={register}
                  errors={errors}
                  storedCountry={profile?.country}
                />
              )}
            </div>

            <div className="mt-1 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-primary-400 pt-4">
              <p
                id="settings-profile-status"
                role="status"
                data-testid="settings-profile-status"
                className="mr-auto text-sm text-natural-200"
              >
                {status}
              </p>
              <Button
                type="submit"
                size="md"
                data-testid="settings-profile-save"
                disabled={isPending || !isValid || !isDirty}
                aria-describedby="settings-profile-status"
              >
                Save changes
              </Button>
            </div>
          </form>
        )}
      </SettingsPanel>
    </SettingsSection>
  );
};
