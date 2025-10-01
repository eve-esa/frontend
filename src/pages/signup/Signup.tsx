import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { useLogin } from "@/services/useLogin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { Login } from "@/pages/login/Login";
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

  const { mutate: login } = useLogin();

  const onSubmit = (data: SignUpFormValidation) => {
    login(data);
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
            error={!!errors?.password}
            success={isPasswordValid}
            endSlot={
              isPasswordValid && (
                <FontAwesomeIcon
                  icon={faCircleCheck}
                  className="text-success-100 h-6"
                />
              )
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

Login.displayName = "Login";
