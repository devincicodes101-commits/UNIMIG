import { redirect } from "next/navigation";
import { getAuthSession } from "@/lib/auth";

export default async function UserDashboardPage() {
  const session = await getAuthSession();

  if (!session) {
    redirect("/auth/login?callbackUrl=/dashboard");
  }

  return (
    <div className="max-w-7xl mx-auto pt-10 pb-10 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">Overview</p>
        <h1 className="text-3xl font-bold text-foreground">Your Dashboard</h1>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-5 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            Welcome, {session.user.name || session.user.email}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This is your personal dashboard.
          </p>
        </div>
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

            <div className="bg-white rounded-xl border border-border p-5 hover:border-foreground/20 hover:shadow-sm transition-all duration-200">
              <h3 className="text-base font-semibold text-foreground mb-2">Your Profile</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Update your account information and preferences.
              </p>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 shadow-sm active:scale-[0.98]">
                Edit Profile
              </button>
            </div>

            <div className="bg-white rounded-xl border border-border p-5 hover:border-foreground/20 hover:shadow-sm transition-all duration-200">
              <h3 className="text-base font-semibold text-foreground mb-2">Recent Activity</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                View your recent chats and searches.
              </p>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 shadow-sm active:scale-[0.98]">
                View Activity
              </button>
            </div>

            <div className="bg-white rounded-xl border border-border p-5 hover:border-foreground/20 hover:shadow-sm transition-all duration-200">
              <h3 className="text-base font-semibold text-foreground mb-2">Saved Items</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                Access your saved responses and documents.
              </p>
              <button className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-background bg-foreground hover:bg-foreground/90 transition-all duration-200 shadow-sm active:scale-[0.98]">
                View Saved
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
