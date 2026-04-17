import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// This route handles the Supabase email confirmation callback
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const type = requestUrl.searchParams.get("type");
  
  // If this is a confirmation link
  if (code && type === "email_confirmation") {
    try {
      // Exchange the confirmation code for a session
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      
      if (error) {
        console.error("Error verifying email:", error);
        return NextResponse.redirect(new URL("/auth/login?error=VerificationFailed", request.url));
      }
      
      // Redirect to login page with success message
      return NextResponse.redirect(new URL("/auth/login?verified=true", request.url));
    } catch (error) {
      console.error("Error in callback:", error);
      return NextResponse.redirect(new URL("/auth/login?error=VerificationFailed", request.url));
    }
  }
  
  // Handle other Auth confirmations or redirects
  return NextResponse.redirect(new URL("/auth/login", request.url));
} 