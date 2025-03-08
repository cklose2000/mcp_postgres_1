/**
 * Supabase service - Handles all interactions with Supabase
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

// Cache the Supabase client to avoid creating multiple instances
let supabaseClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client instance
 * Uses a cached instance if already created
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    if (!env.SUPABASE_PROJECT_URL || !env.SUPABASE_API_KEY) {
      throw new Error('Missing Supabase configuration. Please check your .env file.');
    }
    
    supabaseClient = createClient(env.SUPABASE_PROJECT_URL, env.SUPABASE_API_KEY);
  }
  
  return supabaseClient;
}

/**
 * Gets a project reference from the Supabase URL
 */
export function getProjectRef(): string {
  const match = env.SUPABASE_PROJECT_URL.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error('Invalid SUPABASE_PROJECT_URL format');
  }
  return match[1];
}

/**
 * Executes a SQL query using Supabase's RPC functionality
 * Falls back gracefully if the RPC function doesn't exist
 */
export async function executeSqlQuery(sql: string): Promise<{ data: any; error: any }> {
  const supabase = getSupabaseClient();
  
  try {
    // Try to use the sqlquery RPC function if it exists
    const result = await supabase.rpc('sqlquery', { query: sql });
    
    return result;
  } catch (error) {
    console.warn('SQL query execution failed:', error);
    return {
      data: null,
      error: {
        message: 'SQL query execution failed. The sqlquery RPC function may not be available.',
        details: error
      }
    };
  }
}

/**
 * Lists all tables in the database
 * Uses a SQL query via RPC
 */
export async function listTables(): Promise<{ tables: string[]; error: any }> {
  const result = await executeSqlQuery(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
  );
  
  if (result.error) {
    return { tables: [], error: result.error };
  }
  
  return {
    tables: result.data.map((row: any) => row.table_name),
    error: null
  };
}

/**
 * Gets schema information for a specific table
 */
export async function getTableSchema(tableName: string): Promise<{ schema: any; error: any }> {
  // Sanitize the table name to prevent SQL injection
  const sanitizedTableName = tableName.replace(/[^a-zA-Z0-9_]/g, '');
  
  const result = await executeSqlQuery(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${sanitizedTableName}'`
  );
  
  if (result.error) {
    return { schema: null, error: result.error };
  }
  
  return {
    schema: result.data,
    error: null
  };
}

// Export a singleton instance of the Supabase client
export const supabase = getSupabaseClient(); 