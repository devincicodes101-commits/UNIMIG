"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (resetError) throw resetError;
      setSent(true);
    } catch (err: any) {
      console.error("Password reset failed:", err);
      setError(err.message || "Could not send reset email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "block w-full rounded-2xl border border-border px-4 py-3 bg-white text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-foreground/10 focus:border-foreground/40 transition-all outline-none text-sm";

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Forgot Password
        </p>
        <h3 className="mt-1.5 text-2xl font-bold text-foreground">
          Reset your password
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email linked to your account and we&apos;ll send you a reset link.
        </p>
      </div>

      {sent ? (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm">
          <p className="font-semibold mb-1">Check your email</p>
          <p>
            If an account exists for <span className="font-medium">{email}</span>, a password reset link is on its way. It may take a minute.
          </p>
        </div>
      ) : (
        <>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="name@company.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-foreground hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-lg shadow-black/10 mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Sending…
                </span>
              ) : "Send reset link"}
            </button>
          </form>
        </>
      )}

      <div className="text-center pt-1">
        <p className="text-sm text-muted-foreground">
          Remembered your password?{" "}
          <Link href="/auth/login" className="font-bold text-foreground hover:text-foreground/70 transition-colors underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
