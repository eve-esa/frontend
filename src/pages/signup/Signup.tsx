import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { useSignup } from "@/services/useSignup";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCircleCheck,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { useState } from "react";
import { routes } from "@/utilities/routes";

const SignUpSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export type SignUpFormValidation = z.infer<typeof SignUpSchema>;

export const SignUp = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<SignUpFormValidation>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(SignUpSchema),
  });

  const watchedValues = watch();
  const isEmailValid = !!watchedValues.email && !errors?.email;
  const isPasswordValid = !!watchedValues.password && !errors?.password;

  const [showPassword, setShowPassword] = useState(false);

  const { mutate: signup } = useSignup();

  const onSubmit = (data: SignUpFormValidation) => {
    signup(data);
  };

  return (
    <>
      <p className="text-natural-50 text-2xl">Sign up</p>

      {/* EMAIL */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="email" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Email *</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("email")}
            placeholder="type your email to access"
            error={!!errors?.email}
            success={isEmailValid}
            endSlot={
              isEmailValid && (
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="text-success-100 h-6"
                />
              )
            }
          />
          {errors?.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* PASSWORD */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="password" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Password *</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("password")}
            placeholder="insert your password"
            autoComplete="new-password"
            name="password"
            error={!!errors?.password}
            success={isPasswordValid}
            type={showPassword ? "text" : "password"}
            endSlot={
              <div className="flex items-center gap-2">
                {isPasswordValid && (
                  <FontAwesomeIcon
                    icon={faCircleCheck}
                    className="text-success-100 h-6"
                  />
                )}
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
          {errors?.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
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
        SIGN UP NOW
      </Button>

      <div className="flex justify-center gap-6 mt-8">
        <AnimatedLink href={routes.LOGIN.path}>
          Already have an account?
        </AnimatedLink>
      </div>
    </>
  );
};

SignUp.displayName = "SignUp";
