"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { supabase } from "@/lib/supabase";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  const registered = searchParams.get("registered") === "true";
  const reset = searchParams.get("reset") === "true";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setLocalError("Invalid email or password. Please try again.");
        setIsLoading(false);
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch (error: any) {
      setLocalError(error.message || "Login failed. Please try again.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const redirectTo = `${window.location.origin}/auth/bridge?callbackUrl=${encodeURIComponent(callbackUrl)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      setLocalError(error.message || "Google sign-in failed.");
      setGoogleLoading(false);
    }
    // On success the browser is redirected to Google — no further action here.
  };

  const errorMessage =
    localError ||
    (error === "CredentialsSignin"
      ? "Invalid email or password"
      : error === "DomainNotAllowed"
        ? "Your email domain is not allowed. Please use your company Google account."
        : error === "AccessDenied"
          ? "Access denied. Contact your administrator."
          : error
            ? "An error occurred. Please try again."
            : null);

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Welcome Back
        </p>
        <h3 className="mt-1.5 text-2xl font-bold text-foreground">
          Sign in to your account
        </h3>
      </div>

      {registered && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Registration successful! Please sign in.
        </div>
      )}

      {reset && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Password updated. Sign in with your new password.
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {errorMessage}
        </div>
      )}

      {/* Google SSO */}
      <button
        id="google-signin-btn"
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading || isLoading}
        className="w-full flex items-center justify-center gap-3 py-3 px-4 border border-border rounded-2xl bg-white hover:bg-secondary transition-all active:scale-[0.98] disabled:opacity-50 group shadow-sm"
      >
        <svg width="20" height="20" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-110 transition-transform shrink-0">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
        </svg>
        <span className="text-sm font-semibold text-foreground">
          {googleLoading ? "Redirecting to Google..." : "Continue with Google"}
        </span>
      </button>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span className="px-3 bg-white text-muted-foreground font-medium">
            or via Email
          </span>
        </div>
      </div>

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-5" autoComplete="off">
        <div className="space-y-2">
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="off"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="block w-full rounded-2xl border border-border px-4 py-3 bg-white text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-foreground/10 focus:border-foreground/40 transition-all outline-none text-sm"
            placeholder="name@company.com"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between ml-1">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Password
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="block w-full rounded-2xl border border-border px-4 py-3 bg-white text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-foreground/10 focus:border-foreground/40 transition-all outline-none text-sm"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading || googleLoading}
          className="w-full flex justify-center py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-foreground hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-lg shadow-black/10 mt-2"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Signing in...
            </span>
          ) : "Sign in"}
        </button>
      </form>

      <div className="text-center pt-1">
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/auth/register" className="font-bold text-foreground hover:text-foreground/70 transition-colors underline underline-offset-2">
            Register for free
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
