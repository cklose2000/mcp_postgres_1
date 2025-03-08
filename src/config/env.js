/**
 * Environment variable handling module
 * Centralizes all environment loading logic in a single place
 */
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
/**
 * Loads environment variables from .env file
 * Searches for .env files in multiple locations for flexibility
 */
export function loadEnvVars() {
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
    const envVars = {};
    let envContent = null;
    let loadedFrom = null;
    // Try each path until we find a valid .env file
    for (const envPath of envPaths) {
        if (fs.existsSync(envPath)) {
            try {
                envContent = fs.readFileSync(envPath, 'utf8');
                loadedFrom = envPath;
                break;
            }
            catch (err) {
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
            if (key && value) {
                envVars[key.trim()] = value.trim();
            }
        }
    }
    return {
        SUPABASE_PROJECT_URL: envVars.SUPABASE_PROJECT_URL || '',
        SUPABASE_API_KEY: envVars.SUPABASE_API_KEY || '',
        DB_PASSWORD: envVars.DB_PASSWORD || '',
        ACTIVE_ENV: envVars.ACTIVE_ENV || 'dev',
        ...envVars
    };
}
/**
 * Returns default environment variables when no .env file is found
 */
function getDefaultEnvVars() {
    return {
        SUPABASE_PROJECT_URL: '',
        SUPABASE_API_KEY: '',
        DB_PASSWORD: '',
        ACTIVE_ENV: 'dev'
    };
}
/**
 * Gets a constructed database URL based on environment variables
 * Can be used for direct PostgreSQL connections
 */
export function getDatabaseUrl(env) {
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
export function getTransactionPoolerUrl(env) {
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
export function getSessionPoolerUrl(env) {
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
