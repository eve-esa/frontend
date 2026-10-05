import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import {
  RequiredProfileFieldsSchema,
  type ProfileType,
  type RequiredProfileFieldsType,
} from "@/services/useMe";
import {
  toRequiredProfileUpdate,
  useUpdateProfile,
} from "@/services/useUpdateProfile";
import { useLogout } from "@/services/useLogout";
import { ProfileExtraFields } from "./ProfileExtraFields";

// Every way out of the dialog other than saving or signing out is cancelled.
const keepOpen = (event: Event) => event.preventDefault();

type ProfileRequiredDialogProps = {
  profile: ProfileType;
  onSaved: () => void;
};

/**
 * Asks for country and institution and cannot be dismissed: no close button, Escape and an
 * outside click do nothing. Saving goes through the same `PATCH /users` as the profile dialog,
 * with the names the user already has, so only the two fields change.
 */
export const ProfileRequiredDialog = ({
  profile,
  onSaved,
}: ProfileRequiredDialogProps) => {
  const { mutate: updateProfile, isPending } = useUpdateProfile(onSaved);
  const { mutate: logout, isPending: isLoggingOut } = useLogout();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<RequiredProfileFieldsType>({
    resolver: zodResolver(RequiredProfileFieldsSchema),
    mode: "onChange",
    defaultValues: {
      country: profile.country ?? "",
      institution: profile.institution ?? "",
    },
  });

  const onSubmit = (data: RequiredProfileFieldsType) => {
    updateProfile(toRequiredProfileUpdate(profile, data));
  };

  return (
    <Dialog open={true} onOpenChange={() => undefined}>
      <DialogContent
        data-testid="profile-required-dialog"
        // Scrolls inside the viewport so Save stays reachable on a short
        // mobile screen with the keyboard open.
        className="max-h-[90dvh] overflow-y-auto"
        showCloseButton={false}
        onEscapeKeyDown={keepOpen}
        onPointerDownOutside={keepOpen}
        onInteractOutside={keepOpen}
      >
        <DialogHeader>
          <DialogTitle>Complete your profile</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          Tell us your country and institution before you start. You can
          change them later from your profile.
        </DialogDescription>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-4 mt-4"
        >
          <ProfileExtraFields
            idPrefix="profile-required"
            register={register}
            errors={errors}
            storedCountry={profile.country}
          />

          <div className="flex gap-2 justify-end mt-4">
            <Button
              variant="ghost"
              size="md"
              type="button"
              data-testid="profile-required-logout"
              disabled={isLoggingOut}
              onClick={() => logout()}
            >
              {isLoggingOut ? <Spinner size="xs" /> : "Logout"}
            </Button>
            <Button
              disabled={isPending || !isValid}
              size="md"
              type="submit"
              data-testid="profile-required-save"
            >
              Save
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
