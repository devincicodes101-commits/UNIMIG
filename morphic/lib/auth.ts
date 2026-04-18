import { NextAuthOptions, getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase, supabaseAdmin } from "./supabase";
import { z } from "zod";

// ─────────────────────────────────────────────
// Role Types
// ─────────────────────────────────────────────
export type UserRole =
  | "admin"
  | "management"
  | "sales"
  | "support"
  | "operations"
  | "accounting"
  | "unassigned"; // Default until admin assigns a role

export type User = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

// ─────────────────────────────────────────────
// Extend next-auth types
// ─────────────────────────────────────────────
declare module "next-auth" {
  interface Session {
    user: User;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    email: string;
    roleRefreshedAt?: number;
  }
}

const ROLE_CACHE_MS = 5 * 60 * 1000; // re-check role from DB at most every 5 minutes

// ─────────────────────────────────────────────
// Allowed email domains
// ─────────────────────────────────────────────
// Domain restriction has been removed to allow any email domain.
// ─────────────────────────────────────────────
// Credentials schema (kept for local dev)
// ─────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// ─────────────────────────────────────────────
// Helper: get or create user in Supabase
// ─────────────────────────────────────────────
async function getOrCreateUser(
  id: string,
  email: string,
  name: string | null
): Promise<User> {
  console.log("[AUTH:getOrCreateUser] Looking up user by id:", id, "email:", email);

  let { data: userData, error: userError } = await supabase
    .from("users")
    .select("id, role, name, email")
    .eq("id", id)
    .single();

  console.log("[AUTH:getOrCreateUser] select by id result:", { userData, error: userError?.message, code: userError?.code });

  // If not found by id, try by email (handles cases where id format differs)
  if (userError && userError.code === "PGRST116") {
    console.log("[AUTH:getOrCreateUser] Not found by id, trying email lookup...");
    const { data: emailData, error: emailError } = await supabase
      .from("users")
      .select("id, role, name, email")
      .eq("email", email)
      .single();

    console.log("[AUTH:getOrCreateUser] select by email result:", { emailData, error: emailError?.message, code: emailError?.code });

    if (!emailError && emailData) {
      // Found by email — update the id to match Google's sub
      console.log("[AUTH:getOrCreateUser] Found by email, updating id from", emailData.id, "to", id);
      await supabase.from("users").update({ id }).eq("email", email);
      userData = emailData;
      userError = null;
    }
  }

  if (userError && userError.code === "PGRST116") {
    // Truly new user — create with "unassigned" role
    console.log("[AUTH:getOrCreateUser] New user — creating record with role=unassigned");
    const newUser = {
      id,
      email,
      name: name || null,
      role: "unassigned" as UserRole,
      created_at: new Date().toISOString(),
    };
    const { error: insertError } = await supabase.from("users").insert(newUser);
    if (insertError) {
      console.error("[AUTH:getOrCreateUser] Insert failed:", insertError.message, insertError.code);
    } else {
      console.log("[AUTH:getOrCreateUser] New user inserted successfully");
    }
    userData = { id, role: "unassigned", name, email };
  } else if (userError) {
    console.error("[AUTH:getOrCreateUser] Unexpected Supabase error:", userError.message, userError.code);
  }

  const result = {
    id,
    email: userData?.email || email,
    name: userData?.name || name || null,
    role: (userData?.role as UserRole) || "unassigned",
  };
  console.log("[AUTH:getOrCreateUser] Returning user:", result);
  return result;
}

// ─────────────────────────────────────────────
// NextAuth Configuration
// ─────────────────────────────────────────────
export const authOptions: NextAuthOptions = {
  pages: {
    signIn: "/auth/login",
    signOut: "/auth/logout",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  debug: false,
  providers: [
    // ── Supabase OAuth bridge (Google sign-in goes through Supabase) ──
    CredentialsProvider({
      id: "supabase-oauth",
      name: "Supabase OAuth",
      credentials: {
        access_token: { label: "Access Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.access_token) return null;
          console.log("[AUTH:supabase-oauth] Verifying Supabase access token");

          // Use the admin client to verify the JWT — doesn't mutate the anon client's session.
          const { data, error } = await supabaseAdmin.auth.getUser(
            credentials.access_token
          );

          if (error || !data.user) {
            console.error("[AUTH:supabase-oauth] Token verification failed:", error?.message);
            return null;
          }

          const sUser = data.user;
          const user = await getOrCreateUser(
            sUser.id,
            sUser.email!,
            sUser.user_metadata?.full_name || sUser.user_metadata?.name || null
          );
          console.log("[AUTH:supabase-oauth] Bridge successful for:", user.email);
          return user;
        } catch (err: any) {
          console.error("[AUTH:supabase-oauth] Unexpected error:", err);
          return null;
        }
      },
    }),
    // ── Credentials (email/password via Supabase) ───
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials) return null;
          const { email, password } = loginSchema.parse(credentials);
          console.log("[AUTH:credentials] Attempting login for:", email);

          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (error) {
            console.error("[AUTH:credentials] Supabase sign-in error:", error.message, error.status);
            return null;
          }

          if (!data.user) {
            console.error("[AUTH:credentials] No user returned from Supabase");
            return null;
          }

          console.log("[AUTH:credentials] Supabase login successful, fetching user record...");

          const user = await getOrCreateUser(
            data.user.id,
            data.user.email!,
            data.user.user_metadata?.name || null
          );

          console.log("[AUTH:credentials] User record ready:", user.email);
          return user;
        } catch (error: any) {
          console.error("[AUTH:credentials] Unexpected error in authorize:", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    // ── Sign-in: allow all providers (email check handled upstream) ──
    async signIn({ user }) {
      if (!user.email) {
        console.warn("Blocked sign-in: No email provided");
        return "/auth/error?error=NoEmailProvided";
      }
      return true;
    },

    // ── JWT: attach role to token (cached; re-fetches at most every 5 min) ─────
    async jwt({ token, user, account, trigger }) {
      if (user && account) {
        const dbUser = await getOrCreateUser(
          user.id || (token.sub as string),
          user.email!,
          user.name || null
        );
        token.id = dbUser.id;
        token.role = dbUser.role;
        token.email = dbUser.email;
        token.roleRefreshedAt = Date.now();
        return token;
      }

      const stale = !token.roleRefreshedAt || Date.now() - token.roleRefreshedAt > ROLE_CACHE_MS;
      if (!token.email || (!stale && trigger !== "update")) {
        return token;
      }

      try {
        const { data } = await supabase
          .from("users")
          .select("role")
          .eq("email", token.email)
          .single();
        if (data?.role) {
          token.role = data.role as UserRole;
        }
        token.roleRefreshedAt = Date.now();
      } catch {
        // Keep existing role on transient errors; try again after cache expires.
      }
      return token;
    },

    // ── Session: expose role to frontend ─────────
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.email = token.email as string;
        console.log("[AUTH] Session ready:", { email: session.user.email, role: session.user.role });
      }
      return session;
    },
  },
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
export async function getAuthSession() {
  return getServerSession(authOptions);
}

export async function isAuthenticated() {
  const session = await getAuthSession();
  return !!session?.user;
}

export async function isAdmin() {
  const session = await getAuthSession();
  return session?.user?.role === "admin";
}

export async function getUserRole(): Promise<UserRole | null> {
  const session = await getAuthSession();
  return session?.user?.role ?? null;
}

export const ALL_ROLES: UserRole[] = [
  "admin",
  "management",
  "sales",
  "support",
  "operations",
  "accounting",
  "unassigned",
];