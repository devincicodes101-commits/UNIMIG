import { supabaseAdmin } from "../lib/supabase";

async function setupDatabase() {
  console.log("Setting up database tables for authentication...");

  try {
    // Create users table if it doesn't exist
    const { error: createUserTableError } = await supabaseAdmin.rpc("create_table_if_not_exists", {
      table_name: "users",
      create_statement: `
        CREATE TABLE users (
          id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          email TEXT NOT NULL UNIQUE,
          name TEXT,
          role TEXT NOT NULL DEFAULT 'unassigned' CHECK (role IN ('admin', 'management', 'sales', 'support', 'operations', 'accounting', 'unassigned')),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
      `
    });

    if (createUserTableError) {
      throw createUserTableError;
    }

    // Create RLS policies for the users table
    await supabaseAdmin.rpc("setup_rls_policies", {
      table_name: "users",
      policies: [
        {
          name: "Users can view their own data",
          definition: "FOR SELECT USING (auth.uid() = id)"
        },
        {
          name: "Users can update their own data",
          definition: "FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id AND (role IS NULL OR role = 'user'))"
        },
        {
          name: "Admins can view all user data",
          definition: "FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))"
        },
        {
          name: "Admins can update all user data",
          definition: "FOR UPDATE USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))"
        }
      ]
    });

    console.log("Database setup completed successfully!");
  } catch (error) {
    console.error("Database setup failed:", error);
  }
}

// Check if this script is being run directly
if (require.main === module) {
  setupDatabase();
}

export default setupDatabase; 