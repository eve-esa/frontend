import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { routes } from "@/utilities/routes";
import { useResetPassword } from "@/services/useResetPassword";
import { useSearchParams } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";

const ResetPasswordSchema = z
  .object({
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    confirm_password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export type ResetPasswordFormValidation = z.infer<typeof ResetPasswordSchema>;

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const code = searchParams.get("code");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
    trigger,
  } = useForm<ResetPasswordFormValidation>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(ResetPasswordSchema),
  });

  const watchedValues = watch();

  const { mutate: resetPassword } = useResetPassword();

  // Trigger validation on both password fields when either changes
  const handlePasswordChange = async () => {
    if (watchedValues.new_password && watchedValues.confirm_password) {
      await trigger(["new_password", "confirm_password"]);
    }
  };

  const onSubmit = (data: ResetPasswordFormValidation) => {
    resetPassword({ ...data, code: code as string });
  };

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  return (
    <>
      <p className="text-natural-50 text-2xl">Reset password</p>

      <span className="text-natural-200 text-sm font-['NotesESA']">
        We'll send you an email from where you will be able to reset your
        password. Type the email you are using with the account.
      </span>

      {/* PASSWORD */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="password" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Insert password*</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("new_password")}
            placeholder="insert your password"
            autoComplete="new-password"
            type={showPassword ? "text" : "password"}
            onChange={(e) => {
              register("new_password").onChange(e);
              handlePasswordChange();
            }}
            endSlot={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-natural-100 hover:text-primary-300 transition-colors duration-200"
                >
                  <FontAwesomeIcon
                    icon={showPassword ? faEyeSlash : faEye}
                    className="w-5 cursor-pointer"
                  />
                </button>
              </div>
            }
          />
          {errors?.new_password && (
            <p className="text-sm text-red-500">
              {errors.new_password.message}
            </p>
          )}
        </div>
      </div>

      {/* CONFIRM PASSWORD */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="confirmPassword" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Repeat password*</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("confirm_password")}
            placeholder="insert your password"
            autoComplete="new-password"
            type={showConfirmPassword ? "text" : "password"}
            onChange={(e) => {
              register("confirm_password").onChange(e);
              handlePasswordChange();
            }}
            endSlot={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-natural-100 hover:text-primary-300 transition-colors duration-200"
                >
                  <FontAwesomeIcon
                    icon={showConfirmPassword ? faEyeSlash : faEye}
                    className="w-5 cursor-pointer"
                  />
                </button>
              </div>
            }
          />
          {errors?.confirm_password && (
            <p className="text-sm text-red-500">
              {errors.confirm_password.message}
            </p>
          )}
        </div>
      </div>

      {/* SUBMIT BUTTON */}

      <Button
        type="submit"
        size="lg"
        variant="outline"
        className="w-full mt-6"
        onClick={handleSubmit(onSubmit)}
        disabled={!isValid}
      >
        RESET PASSWORD
      </Button>

      <div className="flex justify-center gap-6 mt-8">
        <AnimatedLink href={routes.LOGIN.path}>Back to login</AnimatedLink>
      </div>
    </>
  );
};

ResetPassword.displayName = "ResetPassword";
