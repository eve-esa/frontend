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
  useGetProfile,
  type ProfileType,
} from "@/services/useMe";
import { Input } from "@/components/ui/Input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useUpdateProfile } from "@/services/useUpdateProfile";

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
    resolver: zodResolver(ProfileSchema),
  });

  // Reset form values when profile data loads
  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile?.first_name,
        last_name: profile?.last_name,
        email: profile?.email,
      });
    }
  }, [profile]);

  const onSubmit = (data: ProfileType) => {
    updateProfile({
      first_name: data.first_name || "",
      last_name: data.last_name || "",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
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

          <div className="flex gap-2 justify-end mt-4">
            <Button
              tabIndex={-1}
              variant="ghost"
              size="md"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={isPending || !isValid || !isDirty}
              tabIndex={-1}
              size="md"
              type="submit"
            >
              Update Profile
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
