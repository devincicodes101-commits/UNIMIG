import { getAuthSession, isAdmin } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ArrowLeft } from "lucide-react";

const cards = [
  {
    title: "User Management",
    description: "Assign and manage roles for employees across the organisation.",
    href: "/admin/users",
    label: "Manage Users",
  },
  {
    title: "Document Management",
    description: "Upload PDFs and files into each role's knowledge namespace.",
    href: "/admin/documents",
    label: "Manage Documents",
  },
  {
    title: "Conversation Logs",
    description: "Browse and review all employee Q&A sessions for quality assurance.",
    href: "/admin/conversations",
    label: "View Logs",
  },
  {
    title: "System Prompts",
    description: "Customise the AI assistant's behaviour and tone per role.",
    href: "/admin/prompts",
    label: "Edit Prompts",
  },
  {
    title: "Feedback Management",
    description: "Review user corrections and improve AI response quality.",
    href: "/admin/feedback",
    label: "Manage Feedback",
  },
  {
    title: "Retrieval Debugger",
    description: "Trace the full Pinecone retrieval pipeline and verify what documents are indexed.",
    href: "/admin/debug",
    label: "Debug Retrieval",
  },
];

export default async function AdminDashboardPage() {
  const session = await getAuthSession();
  const adminAccess = await isAdmin();

  if (!session || !adminAccess) {
    redirect("/auth/login?error=AccessDenied");
  }

  return (
    <div className="max-w-7xl mx-auto pt-4 pb-10 px-6">
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-4"
        >
          <ArrowLeft size={15} strokeWidth={2.5} />
          Back to Chat
        </Link>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Control Center</p>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">
          Manage knowledge, users, prompts and quality assurance.
        </p>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(({ href, title, description, label }) => (
            <Link
              key={href}
              href={href}
              className="group relative bg-muted rounded-2xl border border-border overflow-hidden flex flex-col transition-all duration-300 hover:bg-white hover:shadow-xl hover:shadow-black/8 hover:-translate-y-1.5 hover:border-foreground/20"
            >
              {/* Top accent bar */}
              <div className="h-[3px] w-full bg-foreground origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

              <div className="p-5 flex flex-col flex-1">
                {/* Text */}
                <h2 className="text-[15px] font-bold text-foreground tracking-tight mb-1.5">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                  {description}
                </p>

                {/* Footer CTA */}
                <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground/80 group-hover:text-foreground transition-colors duration-200">
                    {label}
                  </span>
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center group-hover:bg-foreground group-hover:text-background transition-all duration-300 -rotate-45 group-hover:rotate-0">
                    <ArrowUpRight size={14} strokeWidth={2.5} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
      </div>
    </div>
  );
}