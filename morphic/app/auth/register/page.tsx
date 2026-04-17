"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name },
          emailRedirectTo: undefined,
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        const userData = {
          id: data.user.id,
          email: data.user.email!,
          name,
          role: "unassigned",
          created_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("users")
          .insert(userData);

        if (insertError) {
          setError(`Note: User created but profile data could not be saved: ${insertError.message}`);
        }
      }

      router.push("/auth/login?registered=true");
      setIsLoading(false);

    } catch (error: any) {
      console.error("Registration failed:", error);
      setError(error.message || "Registration failed. Please try again.");
      setIsLoading(false);
    }
  };

  const inputClass = "block w-full rounded-2xl border border-border px-4 py-3 bg-white text-foreground placeholder-muted-foreground/50 focus:ring-2 focus:ring-foreground/10 focus:border-foreground/40 transition-all outline-none text-sm";

  return (
    <div className="space-y-7 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Get Started
        </p>
        <h3 className="mt-1.5 text-2xl font-bold text-foreground">
          Create your UNIMIG account
        </h3>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-sm flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
            Full Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="John Doe"
          />
        </div>

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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
              Password
            </label>
            <input
              id="password"
              name="password"
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
              Confirm
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClass}
              placeholder="••••••••"
            />
          </div>
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
              Creating Account...
            </span>
          ) : "Create Account"}
        </button>
      </form>

      <div className="text-center pt-1">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/auth/login" className="font-bold text-foreground hover:text-foreground/70 transition-colors underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
