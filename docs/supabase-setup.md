# Supabase Setup for CRUD Operations

This document explains how to configure your Supabase project to support CRUD (Create, Read, Update, Delete) operations through the MCP server.

## Prerequisites

- A Supabase account and project
- Admin access to your Supabase project
- The Supabase project URL and API keys

## 1. Creating the SQL Write Function

The MCP server uses an RPC function named `sqlwrite` to perform write operations securely. You'll need to create this function in your Supabase project:

1. Log in to your Supabase dashboard
2. Navigate to SQL Editor
3. Create a new query
4. Paste the contents of the `sql/create_sqlwrite_function.sql` file
5. Run the query

This will create a function that:
- Accepts SQL commands for CREATE, INSERT, UPDATE, DELETE, and ALTER operations
- Performs basic validation and security checks
- Returns structured responses with success/error information

## 2. Setting Up Row Level Security (RLS)

To properly secure your tables:

1. Navigate to the Authentication > Policies section in your Supabase dashboard
2. For each table that will be modified through the MCP server:
   - Create appropriate RLS policies for INSERT, UPDATE, and DELETE operations
   - Consider using the user's JWT claims to restrict operations to specific users or roles

Example RLS policy for allowing inserts (on a table named `items`):

```sql
CREATE POLICY "Users can insert their own items" 
ON public.items 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);
```

## 3. API Key Management

The MCP server needs elevated permissions to perform write operations:

1. Generate a Service Role API key from your Supabase dashboard:
   - Go to Project Settings > API
   - Find the "Service Role Key (secret)" section
   - Copy the key (it starts with "eyJ...")

2. Add this key to your `.env` file as `SUPABASE_SERVICE_KEY` (see environment setup)

⚠️ **Warning**: The Service Role key has powerful permissions. Never expose it in client-side code or public repositories.

## 4. Testing the Setup

To verify your setup is working:

1. Go to the SQL Editor in your Supabase dashboard
2. Run a test query using the RPC function:

```sql
SELECT * FROM sqlwrite('CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT)');
```

You should receive a JSON response indicating success. If you encounter errors, check your function definition and permissions.

## Troubleshooting

- **Error: permission denied**: Check that you've granted the necessary permissions to the authenticated role
- **Error: function does not exist**: Verify the function was created successfully
- **Error: relation does not exist**: Ensure you're using the correct schema (usually `public`)

## Next Steps

After completing this setup, your Supabase project will be ready to handle write operations through the MCP server. Continue with updating the MCP server code to use these new capabilities. 