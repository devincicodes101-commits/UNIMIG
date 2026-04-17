"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  const errorMessages: Record<string, string> = {
    Configuration: "There is a problem with the server configuration.",
    AccessDenied: "You do not have access to this resource.",
    Verification: "The verification link may have been expired or already used.",
    CredentialsSignin: "The email or password you entered is incorrect.",
    default: "An unexpected error occurred. Please try again.",
  };

  const errorMessage = error ? errorMessages[error] || errorMessages.default : errorMessages.default;

  return (
    <div className="space-y-6">
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl">
        <h2 className="text-base font-semibold mb-1.5">Authentication Error</h2>
        <p className="text-sm">{errorMessage}</p>
      </div>

      <div className="flex flex-col space-y-3">
        <Link
          href="/auth/login"
          className="w-full text-center px-4 py-3 rounded-2xl text-sm font-bold text-white bg-foreground hover:bg-foreground/90 transition-all active:scale-[0.98] shadow-sm"
        >
          Try signing in again
        </Link>

        <Link
          href="/"
          className="w-full text-center px-4 py-3 rounded-2xl text-sm font-medium text-foreground bg-white border border-border hover:bg-secondary transition-all"
        >
          Return to home page
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorContent />
    </Suspense>
  );
}
