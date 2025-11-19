import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { useLogin } from "@/services/useLogin";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { routes } from "@/utilities/routes";
import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Spinner } from "@/components/ui/Spinner";
import { LOCAL_STORAGE_LOGIN_EMAIL } from "@/utilities/localStorage";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
});

export type LoginFormValidation = z.infer<typeof LoginSchema>;

export const Login = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    control,
    watch,
  } = useForm<LoginFormValidation>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(LoginSchema),
    defaultValues: {
      email: localStorage.getItem(LOCAL_STORAGE_LOGIN_EMAIL) || "",
      rememberMe: false,
    },
  });

  const { mutate: login, isPending } = useLogin();

  const onSubmit = (data: LoginFormValidation) => {
    login(data);
  };

  const [showPassword, setShowPassword] = useState(false);
  const watchedEmail = watch("email");

  // Store email in localStorage when user types
  useEffect(() => {
    if (watchedEmail && watchedEmail.trim() !== "") {
      localStorage.setItem(LOCAL_STORAGE_LOGIN_EMAIL, watchedEmail);
    }
  }, [watchedEmail]);

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <p className="text-natural-50 text-2xl">Log in</p>

      {/* EMAIL */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="email" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">
            Email<span className="text-success-200 text-lg">*</span>
          </p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("email")}
            placeholder="type your email to access"
            autoComplete="new-email"
            name="email"
            type="email"
          />
          {errors?.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
          )}
        </div>
      </div>

      {/* PASSWORD */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="password" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">
            Password<span className="text-success-200 text-lg">*</span>
          </p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("password")}
            placeholder="insert your password"
            autoComplete="new-password"
            name="password"
            type={showPassword ? "text" : "password"}
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
          {errors?.password && (
            <p className="text-sm text-red-500">{errors.password.message}</p>
          )}
        </div>
      </div>

      {/* REMEMBER ME */}

      <div className="flex items-center gap-2 mt-6">
        <Controller
          name="rememberMe"
          control={control}
          render={({ field }) => (
            <Checkbox
              id="rememberMe"
              checked={field.value}
              onCheckedChange={field.onChange}
              ref={field.ref}
            />
          )}
        />
        <label
          htmlFor="rememberMe"
          className="text-sm text-natural-200 font-['NotesESA'] cursor-pointer"
        >
          Remember me
        </label>
      </div>

      {/* SUBMIT BUTTON */}

      <Button
        type="submit"
        size="lg"
        variant="outline"
        className="w-full"
        disabled={!isValid || isPending}
      >
        {isPending ? <Spinner variant="white" size="sm" /> : "LOGIN NOW"}
      </Button>

      <div className="flex justify-center gap-6 mt-6">
        <AnimatedLink href={routes.FORGOT_PASSWORD.path}>
          Forgot password
        </AnimatedLink>
        {/* <AnimatedLink href={routes.SIGN_UP.path}>
            Don't have an account?
          </AnimatedLink> */}
      </div>
    </form>
  );
};

Login.displayName = "Login";
