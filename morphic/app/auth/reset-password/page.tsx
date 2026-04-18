"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function ResetPasswordContent() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Wait for Supabase to process the recovery link and establish a session.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!cancelled && data.session) {
        setReady(true);
        return true;
      }
      return false;
    };

    check().then((ok) => {
      if (ok) return;
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setReady(true);
        }
      });
      setTimeout(() => {
        if (cancelled) return;
        sub.subscription.unsubscribe();
        if (!ready) {
          setError("This reset link is invalid or has expired. Request a new one.");
        }
      }, 5000);
    });

    return () => {
      cancelled = true;
    };
  }, [ready]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;

      // Sign out the recovery-only session so the user must log in with the new password.
      await supabase.auth.signOut();
      setDone(true);
      setTimeout(() => router.replace("/auth/login?reset=true"), 1500);
    } catch (err: any) {
      console.error("Password update failed:", err);
      setError(err.message || "Could not update password. Please try again.");
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
          Reset Password
        </p>
        <h3 className="mt-1.5 text-2xl font-bold text-foreground">
          Choose a new password
        </h3>
      </div>

      {done ? (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-2xl text-sm">
          Password updated. Redirecting to sign in…
        </div>
      ) : (
        <>
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm">
              {error}
            </div>
          )}

          {!ready && !error && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-border border-t-foreground" />
            </div>
          )}

          {ready && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3.5 px-4 rounded-2xl text-sm font-bold text-white bg-foreground hover:bg-foreground/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:scale-100 shadow-lg shadow-black/10 mt-2"
              >
                {isLoading ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </>
      )}

      <div className="text-center pt-1">
        <p className="text-sm text-muted-foreground">
          <Link href="/auth/login" className="font-bold text-foreground hover:text-foreground/70 transition-colors underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground" />
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
