# Setting Up NextAuth.js with Supabase

This guide will help you set up authentication in your Next.js application using NextAuth.js with Supabase as the database provider.

## Prerequisites

- Supabase project already set up
- Next.js application

## Environment Variables

Create or update your `.env.local` file with the following variables:

```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-here-minimum-32-chars

# Supabase Configuration (these should already be set up)
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

To generate a secure `NEXTAUTH_SECRET`, you can use:

```bash
openssl rand -base64 32
```

## Setting Up the Database

1. Create a `users` table in your Supabase database:

```sql
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

2. Set up Row Level Security (RLS) policies for your users table:

```sql
-- Enable RLS on the users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own data
CREATE POLICY "Users can view their own data" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

-- Users can update their own data but can't change role to admin
CREATE POLICY "Users can update their own data" 
ON public.users FOR UPDATE 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND (role IS NULL OR role = 'user'));

-- Allow admins to view all user data
CREATE POLICY "Admins can view all user data" 
ON public.users FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Allow admins to update all user data
CREATE POLICY "Admins can update all user data" 
ON public.users FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));
```

## Authentication Flow

1. **Sign Up**: Users register with email/password credentials through Supabase Auth.
2. **User Creation**: After successful authentication, a user record is created in the `users` table.
3. **Login**: Users log in using their credentials, and NextAuth.js creates a session.
4. **Session Management**: NextAuth.js maintains the authenticated user session.
5. **Role-Based Access**: Middleware protects routes based on authentication and roles.

## Routes

- `/auth/login`: Login page
- `/auth/register`: Registration page
- `/auth/logout`: Logout page
- `/auth/error`: Authentication error page
- `/dashboard`: Protected user dashboard (requires authentication)
- `/admin`: Admin dashboard (requires admin role)

## Creating an Admin User

The first user with admin role must be added manually. After creating a user through the registration process, run this SQL query in the Supabase SQL editor:

```sql
UPDATE public.users
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

## Troubleshooting

- If you see "CSRF check failed" errors, ensure your `NEXTAUTH_URL` matches your application URL.
- If authentication fails, check your Supabase credentials and ensure the users table is set up correctly.
- For role-based access issues, verify the user has the correct role in the users table. 