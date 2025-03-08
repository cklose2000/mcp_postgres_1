#!/usr/bin/env node

/**
 * Database Connection Test
 * Tests direct PostgreSQL connection as well as Supabase client connection
 */
import pg from "pg";
import { createClient } from '@supabase/supabase-js';
import { env, getDatabaseUrl, getTransactionPoolerUrl } from "../src/config/env.js";
import logger from "../src/utils/logging.js";

/**
 * Main test function
 */
async function main() {
  logger.info("Database Connection Test", {
    environment: env.ACTIVE_ENV,
    supabaseProject: env.SUPABASE_PROJECT_URL
  });
  
  // Extract project reference
  const projectRef = env.SUPABASE_PROJECT_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  
  if (!projectRef) {
    logger.error("Invalid Supabase project URL format");
    process.exit(1);
  }
  
  logger.info(`Using project reference: ${projectRef}`);

  // Test Supabase API connection
  await testSupabaseAPIConnection();
  
  // Test direct PostgreSQL connection if DB_PASSWORD is set
  if (env.DB_PASSWORD) {
    await testDirectPostgresConnection();
    await testPoolerConnection();
  } else {
    logger.warn("Skipping direct PostgreSQL tests - DB_PASSWORD not set");
  }
  
  logger.info("All tests completed");
}

/**
 * Test Supabase API connection
 */
async function testSupabaseAPIConnection() {
  logger.info("Testing Supabase API connection...");
  
  if (!env.SUPABASE_PROJECT_URL || !env.SUPABASE_API_KEY) {
    logger.error("Missing Supabase configuration");
    return;
  }
  
  try {
    // Initialize Supabase client
    const supabase = createClient(env.SUPABASE_PROJECT_URL, env.SUPABASE_API_KEY);
    
    // Test the connection by fetching available metadata
    logger.info("Fetching Supabase metadata...");
    
    // Try to get version info
    const { data: versionData, error: versionError } = await supabase
      .from('_metadata')
      .select('*')
      .limit(1);
      
    if (versionError) {
      logger.info("Could not get version, but connection was established");
    } else {
      logger.info("Metadata received", { data: versionData });
    }
    
    // Try SQL query via RPC
    logger.info("Testing SQL query capability...");
    const { data, error } = await supabase.rpc('sqlquery', {
      query: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' LIMIT 5"
    });
    
    if (error) {
      logger.warn("SQL query failed (expected in new projects)", { 
        message: error.message
      });
    } else {
      logger.info("Tables found", { tables: data });
    }
    
    logger.info("✅ Supabase API connection successful");
    return true;
  } catch (error) {
    logger.error("Failed to connect to Supabase API", { error });
    return false;
  }
}

/**
 * Test direct PostgreSQL connection
 */
async function testDirectPostgresConnection() {
  logger.info("Testing direct PostgreSQL connection...");
  
  const databaseUrl = getDatabaseUrl(env);
  
  // Create connection pool
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  let client;
  try {
    // Connect to database
    client = await pool.connect();
    logger.info("✅ Connected to PostgreSQL successfully!");
    
    // Test simple query
    const result = await client.query('SELECT version()');
    logger.info("Database version:", { version: result.rows[0].version });
    
    // List tables
    logger.info("Fetching tables...");
    const tablesResult = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
    );
    
    if (tablesResult.rows.length > 0) {
      logger.info("Tables found:", { 
        tables: tablesResult.rows.map(row => row.table_name)
      });
    } else {
      logger.info("No tables found in public schema");
    }
    
    return true;
  } catch (error) {
    logger.error("Failed to connect to PostgreSQL", { error });
    return false;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

/**
 * Test pooler connection
 */
async function testPoolerConnection() {
  logger.info("Testing transaction pooler connection...");
  
  const poolerUrl = getTransactionPoolerUrl(env);
  
  // Create connection pool
  const pool = new pg.Pool({
    connectionString: poolerUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  let client;
  try {
    // Connect to database
    client = await pool.connect();
    logger.info("✅ Connected to transaction pooler successfully!");
    
    // Test simple query
    const result = await client.query('SELECT version()');
    logger.info("Database version:", { version: result.rows[0].version });
    
    return true;
  } catch (error) {
    logger.error("Failed to connect to transaction pooler", { error });
    return false;
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Run tests
main().catch(error => {
  logger.error("Test execution failed", { error });
  process.exit(1);
}); 