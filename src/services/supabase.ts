/**
 * Supabase service - Handles all interactions with Supabase
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env, shouldUseServiceKey } from '../config/env.js';

// Cache the Supabase client instances
let supabaseClient: SupabaseClient | null = null;
let supabaseServiceClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client instance with standard permissions
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
 * Returns a Supabase client instance with elevated service role permissions
 * Uses a cached instance if already created
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!supabaseServiceClient) {
    if (!env.SUPABASE_PROJECT_URL || !env.SUPABASE_SERVICE_KEY) {
      throw new Error('Missing Supabase service key configuration. Please check your .env file.');
    }
    
    supabaseServiceClient = createClient(env.SUPABASE_PROJECT_URL, env.SUPABASE_SERVICE_KEY);
  }
  
  return supabaseServiceClient;
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
 * Uses the appropriate client based on the operation type and environment settings
 */
export async function executeWriteSqlQuery(sql: string): Promise<{ data: any; error: any }> {
  // Extract the operation type to determine which client to use
  const operationType = sql.trim().split(' ')[0].toUpperCase();
  const useServiceRole = shouldUseServiceKey(operationType);
  
  // Get the appropriate client based on permissions
  const supabase = useServiceRole 
    ? getSupabaseServiceClient() 
    : getSupabaseClient();
  
  try {
    // Log which client we're using (for debugging)
    console.debug(`Executing ${operationType} operation with ${useServiceRole ? 'service' : 'standard'} client`);
    
    // Try to use the sqlwrite RPC function
    const result = await supabase.rpc('sqlwrite', { query: sql });
    
    return result;
  } catch (error) {
    console.warn('SQL write operation failed:', error);
    
    // If the RPC function doesn't exist, provide a helpful error message
    return {
      data: null,
      error: {
        message: `SQL write operation failed. The sqlwrite RPC function may not be available or you may lack the required permissions. Operation type: ${operationType}`,
        details: error,
        help: useServiceRole ? 
          "This operation requires a service role key. Please make sure SUPABASE_SERVICE_KEY is properly configured in your .env file." :
          "This operation might require elevated permissions. Consider setting the appropriate ALLOW_*_OPERATIONS flag to false in your .env file to use the service role key."
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

/**
 * Executes an INSERT operation using Supabase
 * Provides a safer, structured way to insert data compared to raw SQL
 */
export async function executeInsert(
  table: string, 
  values: Record<string, any>, 
  returning: string = '*'
): Promise<{ data: any; error: any }> {
  // Determine if we should use the service role key based on configuration
  const useServiceRole = shouldUseServiceKey('INSERT');
  
  // Get the appropriate client
  const supabase = useServiceRole 
    ? getSupabaseServiceClient() 
    : getSupabaseClient();
  
  try {
    // Using Supabase's built-in insert method which is safer than raw SQL
    const { data, error } = await supabase
      .from(table)
      .insert(values)
      .select(returning);
    
    if (error) {
      console.warn('Insert operation failed:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Insert operation exception:', error);
    return {
      data: null,
      error: {
        message: `Failed to insert into ${table}`,
        details: error
      }
    };
  }
}

/**
 * Executes an UPDATE operation using Supabase
 * Provides a safer, structured way to update data compared to raw SQL
 */
export async function executeUpdate(
  table: string, 
  values: Record<string, any>,
  filter: Record<string, any>,
  returning: string = '*'
): Promise<{ data: any; error: any }> {
  // Determine if we should use the service role key based on configuration
  const useServiceRole = shouldUseServiceKey('UPDATE');
  
  // Get the appropriate client
  const supabase = useServiceRole 
    ? getSupabaseServiceClient() 
    : getSupabaseClient();
  
  try {
    // Using Supabase's built-in update method which is safer than raw SQL
    let query = supabase
      .from(table)
      .update(values);
    
    // Apply all filter conditions
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
    
    // Add returning clause
    const { data, error } = await query.select(returning);
    
    if (error) {
      console.warn('Update operation failed:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Update operation exception:', error);
    return {
      data: null,
      error: {
        message: `Failed to update records in ${table}`,
        details: error
      }
    };
  }
}

/**
 * Executes a DELETE operation using Supabase
 * Provides a safer, structured way to delete data compared to raw SQL
 */
export async function executeDelete(
  table: string, 
  filter: Record<string, any>,
  returning: string = '*'
): Promise<{ data: any; error: any }> {
  // Determine if we should use the service role key based on configuration
  const useServiceRole = shouldUseServiceKey('DELETE');
  
  // Get the appropriate client
  const supabase = useServiceRole 
    ? getSupabaseServiceClient() 
    : getSupabaseClient();
  
  try {
    // Safety check - prevent deleting all records accidentally
    if (Object.keys(filter).length === 0) {
      return {
        data: null,
        error: {
          message: 'Delete operations require a filter to prevent accidental deletion of all records'
        }
      };
    }
    
    // Using Supabase's built-in delete method which is safer than raw SQL
    let query = supabase
      .from(table)
      .delete();
    
    // Apply all filter conditions
    for (const [key, value] of Object.entries(filter)) {
      query = query.eq(key, value);
    }
    
    // Add returning clause
    const { data, error } = await query.select(returning);
    
    if (error) {
      console.warn('Delete operation failed:', error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (error) {
    console.error('Delete operation exception:', error);
    return {
      data: null,
      error: {
        message: `Failed to delete records from ${table}`,
        details: error
      }
    };
  }
}

/**
 * Executes a set of operations within a transaction
 * All operations will either succeed together or fail together
 */
export async function executeTransaction(
  operations: Array<{
    type: 'insert' | 'update' | 'delete';
    table: string;
    values?: Record<string, any>;
    filter?: Record<string, any>;
    returning?: string;
  }>
): Promise<{ 
  success: boolean;
  results: Array<{
    success: boolean;
    operation: any;
    data?: any;
    error?: any;
  }>;
  error?: any;
}> {
  // Determine if we should use the service role key based on the operations
  // If any operation requires service role, use it for the entire transaction
  const hasInsert = operations.some(op => op.type === 'insert');
  const hasUpdate = operations.some(op => op.type === 'update');
  const hasDelete = operations.some(op => op.type === 'delete');
  
  let useServiceRole = false;
  if (hasInsert && shouldUseServiceKey('INSERT')) useServiceRole = true;
  if (hasUpdate && shouldUseServiceKey('UPDATE')) useServiceRole = true;
  if (hasDelete && shouldUseServiceKey('DELETE')) useServiceRole = true;
  
  // Get the appropriate client
  const supabase = useServiceRole 
    ? getSupabaseServiceClient() 
    : getSupabaseClient();
  
  try {
    const results: Array<{
      success: boolean;
      operation: any;
      data?: any;
      error?: any;
    }> = [];
    
    // Begin a transaction
    console.log("Starting transaction for batch operations");
    
    // Execute an RPC function that handles the transaction on the server
    const { data, error } = await supabase.rpc('execute_transaction', {
      operations_json: JSON.stringify(operations)
    });
    
    if (error) {
      console.error("Transaction failed:", error);
      return {
        success: false,
        results: [],
        error: {
          message: "Transaction failed",
          details: error
        }
      };
    }
    
    // If the RPC function isn't available, tell the user how to set it up
    if (!data || !Array.isArray(data)) {
      return {
        success: false,
        results: [],
        error: {
          message: "Transaction failed - execute_transaction RPC function not available",
          details: "You need to create the 'execute_transaction' function in your Supabase project. See documentation for details."
        }
      };
    }
    
    // Process the results
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      const result = data[i];
      
      results.push({
        success: !result.error,
        operation,
        data: result.data || null,
        error: result.error || null
      });
    }
    
    return {
      success: true,
      results
    };
  } catch (error) {
    console.error("Transaction exception:", error);
    return {
      success: false,
      results: [],
      error: {
        message: "Transaction failed due to an unexpected error",
        details: error
      }
    };
  }
}

// Export a singleton instance of the Supabase client
export const supabase = getSupabaseClient(); 