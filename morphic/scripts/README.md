# Database Migration Scripts

This directory contains SQL scripts for database migrations.

## Prompt Configuration Migration

To set up the prompt configuration table in Supabase:

1. Login to your Supabase dashboard at https://app.supabase.com/
2. Navigate to your project
3. Go to the SQL Editor
4. Create a new query
5. Copy the contents of `supabase-prompt-config.sql` into the query editor
6. Run the query

This script will:
- Create the `prompt_config` table
- Set up Row Level Security policies
- Create default prompt configuration

## Table Structure

The `prompt_config` table has the following columns:

- `id`: UUID primary key
- `behavior`: Text field for AI behavior style
- `tone`: Text field for AI tone of voice
- `num_replies`: Integer for number of replies/messages to generate
- `additional_instructions`: Text field for any additional instructions
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update

## Row Level Security

The table has RLS policies that:
- Allow admin users to read the configuration
- Allow admin users to insert new configurations 