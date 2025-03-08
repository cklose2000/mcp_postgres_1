#!/usr/bin/env node

/**
 * PostgreSQL MCP Server
 * Connects to Supabase PostgreSQL and exposes database functionality via MCP
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { env } from "./config/env.js";
import { setupRequestHandlers } from "./services/mcp-handlers.js";
import logger from "./utils/logging.js";

/**
 * Initialize and start the MCP server
 */
async function main() {
  try {
    // Log startup information
    logger.info("Starting PostgreSQL MCP Server", {
      version: "0.1.0",
      environment: env.ACTIVE_ENV,
      supabaseProject: env.SUPABASE_PROJECT_URL
    });
    
    // Check for required configuration
    if (!env.SUPABASE_PROJECT_URL || !env.SUPABASE_API_KEY) {
      logger.error("Missing required configuration", {
        supabaseProjectUrl: !!env.SUPABASE_PROJECT_URL,
        supabaseApiKey: !!env.SUPABASE_API_KEY
      });
      console.error("Missing Supabase configuration. Please check your .env file.");
      console.error("Required variables: SUPABASE_PROJECT_URL, SUPABASE_API_KEY");
      process.exit(1);
    }
    
    // Create the MCP server
    const server = new Server(
      {
        name: "postgres-mcp-server",
        version: "0.1.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );
    
    // Set up all request handlers
    setupRequestHandlers(server);
    
    // Set up graceful shutdown
    setupGracefulShutdown();
    
    // Connect to the transport and start the server
    const transport = new StdioServerTransport();
    logger.info("Connecting to transport");
    await server.connect(transport);
    
    logger.info("Server started and connected to transport");
  } catch (error) {
    logger.error("Failed to start server", { error });
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown() {
  // Handle process termination
  process.on('SIGINT', () => {
    logger.info("Received SIGINT, shutting down gracefully");
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    logger.info("Received SIGTERM, shutting down gracefully");
    process.exit(0);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error("Uncaught exception", { error });
    console.error("Uncaught exception:", error);
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason) => {
    logger.error("Unhandled promise rejection", { reason });
    console.error("Unhandled promise rejection:", reason);
    process.exit(1);
  });
}

// Start the server
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
}); 