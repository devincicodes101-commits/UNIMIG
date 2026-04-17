import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
      {/* Subtle background texture */}
      <div className="absolute inset-0 z-0 pointer-events-none" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(0_0%_0%/0.03),transparent)]" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Brand header */}
        <div className="flex flex-col items-center mb-8">
          <h2 className="mt-4 text-center text-4xl font-black tracking-tighter text-foreground sm:text-5xl uppercase">
            UNIMIG
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground max-w-xs leading-relaxed">
            Intelligent coaching and management assistant.
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl border border-border shadow-xl shadow-black/5 overflow-hidden">
          <div className="px-6 py-10 sm:px-10">
            {children}
          </div>
        </div>

        {/* Bottom note */}
        <p className="mt-6 text-center text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} UNIMIG &middot; By Devinci Codes
        </p>
      </div>
    </div>
  );
}
