import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import {
  ProfileSchema,
  RequiredProfileSchema,
  useGetProfile,
  type ProfileType,
} from "@/services/useMe";
import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  toProfileFormValues,
  toProfileUpdate,
  useUpdateProfile,
} from "@/services/useUpdateProfile";
import { AppVersion } from "@/components/ui/AppVersion";
import { PROFILE_FIELDS_ENABLED } from "@/utilities/features";
import { ProfileExtraFields } from "./ProfileExtraFields";

type ProfileDialogProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export const ProfileDialog = ({ isOpen, onOpenChange }: ProfileDialogProps) => {
  const { data: profile } = useGetProfile();

  const { mutate: updateProfile, isPending } = useUpdateProfile(() =>
    onOpenChange(false)
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

  // Reset form values when profile data loads
  useEffect(() => {
    if (profile) {
      reset(toProfileFormValues(profile));
    }
  }, [profile]);

  const onSubmit = (data: ProfileType) => {
    updateProfile(toProfileUpdate(data, PROFILE_FIELDS_ENABLED, profile));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent data-testid="profile-dialog">
        <DialogHeader>
          <DialogTitle>Profile</DialogTitle>
        </DialogHeader>
        <DialogDescription>Update your profile information.</DialogDescription>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 mt-4"
        >
          {/* EMAIL */}

          <div className="flex w-full justify-center flex-col gap-2">
            <label htmlFor="email" className="flex items-center gap-1">
              <p className="font-['NotesESA'] text-sm">Email*</p>
            </label>
            <div className="flex flex-col gap-2">
              <Input
                className="w-full"
                data-testid="profile-email"
                {...register("email")}
                disabled
                type="email"
              />
              {errors?.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
          </div>

          {/* FIRST NAME */}

          <div className="flex w-full justify-center flex-col gap-2">
            <label htmlFor="first_name" className="flex items-center gap-1">
              <p className="font-['NotesESA'] text-sm">First Name</p>
            </label>
            <div className="flex flex-col gap-2">
              <Input
                className="w-full"
                data-testid="profile-first-name"
                {...register("first_name")}
                type="text"
              />
              {errors?.first_name && (
                <p className="text-sm text-red-500">
                  {errors.first_name.message}
                </p>
              )}
            </div>
          </div>

          {/* LAST NAME */}

          <div className="flex w-full justify-center flex-col gap-2">
            <label htmlFor="last_name" className="flex items-center gap-1">
              <p className="font-['NotesESA'] text-sm">Last Name</p>
            </label>
            <div className="flex flex-col gap-2">
              <Input
                className="w-full"
                data-testid="profile-last-name"
                {...register("last_name")}
                type="text"
              />
              {errors?.last_name && (
                <p className="text-sm text-red-500">
                  {errors.last_name.message}
                </p>
              )}
            </div>
          </div>

          {PROFILE_FIELDS_ENABLED && (
            <ProfileExtraFields
              idPrefix="profile"
              register={register}
              errors={errors}
            />
          )}

          {/* The running version and commit. They used to sit in the footer of
              the app's own login page, which moving sign-in to the identity
              provider deleted, leaving AppVersion imported by nothing and
              therefore tree-shaken out of the bundle entirely. Sharing the
              button row costs no vertical space and keeps it out of the way.

              ml-auto on the buttons rather than justify-end on the row:
              AppVersion renders nothing when neither value is set, which is
              every local build, and justify-between would then pull the buttons
              to the left. */}
          <div className="flex items-center gap-2 mt-4">
            <AppVersion className="text-left" />

            <div className="flex gap-2 ml-auto">
              <Button
                tabIndex={-1}
                variant="ghost"
                size="md"
                data-testid="profile-cancel"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                disabled={isPending || !isValid || !isDirty}
                tabIndex={-1}
                size="md"
                type="submit"
                data-testid="profile-save"
              >
                Update Profile
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
