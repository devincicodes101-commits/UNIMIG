"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function BridgeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [status, setStatus] = useState<"working" | "error">("working");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const bridge = async (accessToken: string) => {
      const result = await signIn("supabase-oauth", {
        access_token: accessToken,
        redirect: false,
      });

      if (cancelled) return;

      if (result?.error) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }

      router.replace(callbackUrl);
      router.refresh();
    };

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        await bridge(data.session.access_token);
        return;
      }

      const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (cancelled) return;
        if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.access_token) {
          sub.subscription.unsubscribe();
          await bridge(session.access_token);
        }
      });

      setTimeout(() => {
        if (cancelled) return;
        sub.subscription.unsubscribe();
        setStatus("error");
        setErrorMessage("Sign-in timed out. Please try again.");
      }, 10000);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [callbackUrl, router]);

  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      {status === "working" ? (
        <>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground" />
          <p className="text-sm text-muted-foreground">Completing sign-in…</p>
        </>
      ) : (
        <>
          <p className="text-sm text-red-600">{errorMessage || "Sign-in failed."}</p>
          <a
            href="/auth/login"
            className="text-sm font-bold underline underline-offset-2"
          >
            Back to sign in
          </a>
        </>
      )}
    </div>
  );
}

export default function BridgePage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-border border-t-foreground" />
      </div>
    }>
      <BridgeContent />
    </Suspense>
  );
}
