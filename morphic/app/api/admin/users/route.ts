import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { isAdmin } from "@/lib/auth";

// GET: Fetch all users (admin only)
export async function GET(req: NextRequest) {
  try {
    // Check if user is admin
    const adminAccess = await isAdmin();
    if (!adminAccess) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("id, email, name, role, created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users });
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// PATCH: Update user role (admin only)
export async function PATCH(req: NextRequest) {
  try {
    // Check if user is admin
    const adminAccess = await isAdmin();
    if (!adminAccess) {
      return NextResponse.json(
        { error: "Unauthorized. Admin access required." },
        { status: 403 }
      );
    }

    const { userId, role } = await req.json();

    if (!userId || !role) {
      return NextResponse.json(
        { error: "User ID and role are required" },
        { status: 400 }
      );
    }

    // Validate role is one of the allowed types
    const VALID_ROLES = ["admin", "management", "sales", "support", "operations", "accounting", "unassigned"];
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` },
        { status: 400 }
      );
    }

    // Update user role
    const { error } = await supabaseAdmin
      .from("users")
      .update({ role })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error updating user role:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update user role" },
      { status: 500 }
    );
  }
} 