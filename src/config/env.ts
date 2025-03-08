/**
 * Environment variable handling module
 * Centralizes all environment loading logic in a single place
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Types for environment variables
export interface EnvironmentVariables {
  // Supabase configuration
  SUPABASE_PROJECT_URL: string;
  SUPABASE_API_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  
  // Database configuration
  DB_PASSWORD: string;
  
  // Environment selection
  ACTIVE_ENV: 'dev' | 'test' | 'prod';
  
  // CRUD operations permissions
  ALLOW_CREATE_OPERATIONS: boolean;
  ALLOW_UPDATE_OPERATIONS: boolean;
  ALLOW_DELETE_OPERATIONS: boolean;
  
  // Other variables will be included in the raw object
  [key: string]: string | boolean;
}

/**
 * Loads environment variables from .env file
 * Searches for .env files in multiple locations for flexibility
 */
export function loadEnvVars(): EnvironmentVariables {
  // Get the directory where the code is executing
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  
  // Look in these places for .env files
  const envPaths = [
    // Current directory
    path.join(process.cwd(), '.env'),
    
    // Project root (if running from dist or src)
    path.join(process.cwd(), '..', '.env'),
    
    // Dist directory
    path.join(process.cwd(), 'dist', '.env'),
    
    // Config directory
    path.join(process.cwd(), 'config', '.env')
  ];
  
  const envVars: Record<string, string> = {};
  let envContent: string | null = null;
  let loadedFrom: string | null = null;
  
  // Try each path until we find a valid .env file
  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      try {
        envContent = fs.readFileSync(envPath, 'utf8');
        loadedFrom = envPath;
        break;
      } catch (err) {
        console.warn(`Failed to read .env file from ${envPath}:`, err);
      }
    }
  }
  
  if (!envContent) {
    console.warn('No .env file found. Using default environment variables.');
    return getDefaultEnvVars();
  }
  
  console.log(`Loaded environment from: ${loadedFrom}`);
  
  // Parse environment variables
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      const value = valueParts.join('='); // Handle values that might contain '='
      if (key && value !== undefined) {
        envVars[key.trim()] = value.trim();
      }
    }
  }
  
  return {
    SUPABASE_PROJECT_URL: envVars.SUPABASE_PROJECT_URL || '',
    SUPABASE_API_KEY: envVars.SUPABASE_API_KEY || '',
    SUPABASE_SERVICE_KEY: envVars.SUPABASE_SERVICE_KEY || '',
    DB_PASSWORD: envVars.DB_PASSWORD || '',
    ACTIVE_ENV: (envVars.ACTIVE_ENV as 'dev' | 'test' | 'prod') || 'dev',
    
    // Parse boolean values for CRUD operation permissions
    ALLOW_CREATE_OPERATIONS: parseBoolean(envVars.ALLOW_CREATE_OPERATIONS, false),
    ALLOW_UPDATE_OPERATIONS: parseBoolean(envVars.ALLOW_UPDATE_OPERATIONS, false),
    ALLOW_DELETE_OPERATIONS: parseBoolean(envVars.ALLOW_DELETE_OPERATIONS, false),
    
    ...envVars
  };
}

/**
 * Helper function to parse boolean environment variables
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return ['true', '1', 'yes'].includes(value.toLowerCase());
}

/**
 * Returns default environment variables when no .env file is found
 */
function getDefaultEnvVars(): EnvironmentVariables {
  return {
    SUPABASE_PROJECT_URL: '',
    SUPABASE_API_KEY: '',
    SUPABASE_SERVICE_KEY: '',
    DB_PASSWORD: '',
    ACTIVE_ENV: 'dev',
    ALLOW_CREATE_OPERATIONS: false,
    ALLOW_UPDATE_OPERATIONS: false,
    ALLOW_DELETE_OPERATIONS: false
  };
}

/**
 * Determines if the service key should be used for a specific operation type
 * @param operationType The SQL operation type (CREATE, INSERT, UPDATE, DELETE, etc.)
 * @returns True if the service key should be used, false otherwise
 */
export function shouldUseServiceKey(operationType: string): boolean {
  const type = operationType.toUpperCase();
  
  if (type.startsWith('CREATE') && !env.ALLOW_CREATE_OPERATIONS) {
    return true;
  }
  
  if ((type.startsWith('UPDATE') || type.startsWith('ALTER')) && !env.ALLOW_UPDATE_OPERATIONS) {
    return true;
  }
  
  if (type.startsWith('DELETE') && !env.ALLOW_DELETE_OPERATIONS) {
    return true;
  }
  
  return false;
}

/**
 * Gets a constructed database URL based on environment variables
 * Can be used for direct PostgreSQL connections
 */
export function getDatabaseUrl(env: EnvironmentVariables): string {
  const projectRef = env.SUPABASE_PROJECT_URL 
    ? env.SUPABASE_PROJECT_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] 
    : '';
  
  if (!projectRef) {
    throw new Error('Invalid SUPABASE_PROJECT_URL format');
  }
  
  // Get the appropriate database URL for the current environment
  switch (env.ACTIVE_ENV) {
    case 'prod':
      return `postgresql://postgres:${env.DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
    case 'test':
      return `postgresql://postgres:${env.DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
    case 'dev':
    default:
      return `postgresql://postgres:${env.DB_PASSWORD}@db.${projectRef}.supabase.co:5432/postgres?sslmode=require`;
  }
}

/**
 * Gets the transaction pooler URL based on environment variables
 */
export function getTransactionPoolerUrl(env: EnvironmentVariables): string {
  const projectRef = env.SUPABASE_PROJECT_URL 
    ? env.SUPABASE_PROJECT_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] 
    : '';
  
  if (!projectRef) {
    throw new Error('Invalid SUPABASE_PROJECT_URL format');
  }
  
  return `postgres://postgres.${projectRef}:${env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;
}

/**
 * Gets the session pooler URL based on environment variables
 */
export function getSessionPoolerUrl(env: EnvironmentVariables): string {
  const projectRef = env.SUPABASE_PROJECT_URL 
    ? env.SUPABASE_PROJECT_URL.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] 
    : '';
  
  if (!projectRef) {
    throw new Error('Invalid SUPABASE_PROJECT_URL format');
  }
  
  return `postgres://postgres.${projectRef}:${env.DB_PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`;
}

// Export a singleton instance of environment variables
export const env = loadEnvVars(); 