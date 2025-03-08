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
 * Executes a write SQL query (CREATE, INSERT, UPDATE, DELETE)
 * Uses a different RPC function that has write permissions
 */
export async function executeWriteSqlQuery(sql: string): Promise<{ data: any; error: any }> {
  const supabase = getSupabaseClient();
  
  try {
    // Try to use the sqlwrite RPC function if it exists
    // Note: This function needs to be created in your Supabase project with appropriate permissions
    const result = await supabase.rpc('sqlwrite', { query: sql });
    
    return result;
  } catch (error) {
    console.warn('SQL write operation failed:', error);
    
    // If the RPC function doesn't exist, try a direct approach with REST API
    // This is for demonstration and might not work with default permissions
    try {
      // For CREATE TABLE operations, we can try to use the REST API
      // Note: This would require the appropriate permissions set up in Supabase
      if (sql.toUpperCase().includes('CREATE TABLE')) {
        const tableName = extractTableName(sql);
        if (tableName) {
          // This is just a placeholder - Supabase REST API doesn't directly support CREATE TABLE
          // In a real implementation, you'd need to create the table via the Supabase dashboard
          // or implement a custom server-side function
          return {
            data: { message: `Table creation attempted: ${tableName}` },
            error: {
              message: 'Create table operations require special permissions. Please create this table through the Supabase dashboard or check your RPC function setup.',
              details: 'The sqlwrite RPC function is not available or you lack permissions.'
            }
          };
        }
      }
    } catch (secondaryError) {
      console.error('Secondary approach also failed:', secondaryError);
    }
    
    return {
      data: null,
      error: {
        message: 'SQL write operation failed. The sqlwrite RPC function may not be available or you lack the required permissions.',
        details: error
      }
    };
  }
}

/**
 * Helper function to extract table name from a CREATE TABLE statement
 * Very basic implementation - would need improvement for complex SQL
 */
function extractTableName(sql: string): string | null {
  // Simple regex to extract table name from CREATE TABLE statement
  const match = sql.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?([^"\s(),]+)"?|([^"\s(),]+))/i);
  return match ? (match[1] || match[2]) : null;
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