import { AnimatedLink } from "@/components/ui/AnimatedLink";
import { Spinner } from "@/components/ui/Spinner";
import { useVerify } from "@/services/useVerify";
import { routes } from "@/utilities/routes";
import { useSearchParams } from "react-router-dom";
import { useEffect } from "react";

const pendingVerifyKeys = new Set<string>();

export const Verify = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email")?.trim() ?? "";
  const code = searchParams.get("code")?.trim() ?? "";

  const { mutate, isPending, isError } = useVerify();

  useEffect(() => {
    if (!email || !code) return;
    const key = `${email}\0${code}`;
    if (pendingVerifyKeys.has(key)) return;
    pendingVerifyKeys.add(key);
    mutate(
      { email, activation_code: code },
      {
        onError: () => {
          pendingVerifyKeys.delete(key);
        },
      }
    );
  }, [email, code, mutate]);

  if (!email || !code) {
    return (
      <>
        <p className="text-natural-50 text-2xl">Verify account</p>
        <p className="text-natural-200 text-sm font-['NotesESA']">
          This link is missing the email or verification code. Open the link from
          your activation email, or sign up again.
        </p>
        <div className="flex justify-center gap-6 mt-8">
          <AnimatedLink href={routes.LOGIN.path}>Log in</AnimatedLink>
          <AnimatedLink href={routes.SIGN_UP.path}>Sign up</AnimatedLink>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-natural-50 text-2xl">Verify account</p>
      {isPending && (
        <div className="flex flex-col items-center gap-4 text-natural-200 text-sm font-['NotesESA']">
          <Spinner variant="white" size="sm" />
          <p>Verifying your account…</p>
        </div>
      )}
      {isError && !isPending && (
        <div className="flex flex-col gap-6">
          <p className="text-natural-200 text-sm font-['NotesESA']">
            Verification failed. The code may be invalid or expired.
          </p>
          <div className="flex justify-center gap-6">
            <AnimatedLink href={routes.LOGIN.path}>Log in</AnimatedLink>
            <AnimatedLink href={routes.SIGN_UP.path}>Sign up</AnimatedLink>
          </div>
        </div>
      )}
    </>
  );
};

Verify.displayName = "Verify";
