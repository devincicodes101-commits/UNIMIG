"use client";

import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function AuthStatus() {
  const { data: session, status } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      {status === "loading" ? (
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      ) : session ? (
        <>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsMenuOpen(v => !v)}
              className="flex items-center justify-center h-8 w-8 rounded-full bg-foreground text-background text-sm font-semibold shadow-sm transition-all duration-200 hover:scale-105 ring-2 ring-foreground/10 hover:ring-foreground/25"
            >
              {session.user.name?.charAt(0).toUpperCase() ||
                session.user.email?.charAt(0).toUpperCase()}
            </button>
          </div>

          {isMenuOpen && (
            <div className="absolute right-0 mt-2.5 w-64 py-1.5 bg-white rounded-xl shadow-lg shadow-black/8 z-50 border border-border animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="px-4 py-3">
                <p className="text-xs text-muted-foreground mb-0.5">Signed in as</p>
                <p className="text-sm font-medium text-foreground truncate">
                  {session.user.email}
                </p>
                {session.user.role && (
                  <span className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-muted-foreground border border-border">
                    {session.user.role}
                  </span>
                )}
              </div>

              <div className="h-px bg-border mx-1 my-1" />

              {session.user.role === "admin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-foreground/70 hover:text-foreground hover:bg-muted transition-colors duration-150 rounded-lg mx-1"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Admin Panel
                </Link>
              )}

              <div className="h-px bg-border mx-1 my-1" />

              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  signOut({ redirect: true, callbackUrl: "/" });
                }}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors duration-150 rounded-lg mx-1"
              >
                Sign out
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-200 px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            Sign in
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-semibold bg-foreground text-background px-3.5 py-1.5 rounded-lg hover:bg-foreground/90 transition-all duration-200 shadow-sm"
          >
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}
