"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LogoutPage() {
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      await signOut({ redirect: false });
      router.push("/");
    };

    performLogout();
  }, [router]);

  return (
    <div className="text-center">
      <p>Signing you out...</p>
    </div>
  );
} 