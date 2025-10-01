import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons";
import { routes } from "@/utilities/routes";
import { useNavigate } from "react-router-dom";
import { useForgotPassword } from "@/services/useForgotPassword";
import { LOCAL_STORAGE_LOGIN_EMAIL } from "@/utilities/localStorage";

const ForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export type ForgotPasswordFormValidation = z.infer<typeof ForgotPasswordSchema>;

export const ForgotPassword = () => {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<ForgotPasswordFormValidation>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: {
      email: localStorage.getItem(LOCAL_STORAGE_LOGIN_EMAIL) || "",
    },
  });

  const { mutate: resetPassword } = useForgotPassword();

  const onSubmit = (data: ForgotPasswordFormValidation) => {
    resetPassword(data);
  };

  return (
    <>
      <div className="flex items-center gap-6">
        <FontAwesomeIcon
          icon={faChevronLeft}
          className="text-natural-50 h-6 cursor-pointer transition-all duration-300 ease-in-out hover:text-primary-300"
          onClick={() => navigate(routes.LOGIN.path)}
        />
        <p className="text-natural-50 text-2xl">Forgot password</p>
      </div>

      <span className="text-natural-200 text-sm font-['NotesESA']">
        We’ll send you an email from where you will be able to reset your
        password. Type the email you are using with the account.
      </span>

      {/* EMAIL */}

      <div className="flex w-full justify-center flex-col gap-2">
        <label htmlFor="email" className="flex items-center gap-1">
          <p className="font-['NotesESA'] text-sm">Email*</p>
        </label>
        <div className="flex flex-col gap-2">
          <Input
            className="w-full"
            {...register("email")}
            placeholder="type your email to access"
          />
          {errors?.email && (
            <p className="text-sm text-red-500">{errors.email.message}</p>
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
    </>
  );
};

ForgotPassword.displayName = "ForgotPassword";
