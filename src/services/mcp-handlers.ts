/**
 * MCP Server Handlers
 * Implements all MCP request handlers for Postgres/Supabase
 */
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import * as supabaseService from './supabase.js';

/**
 * Sets up all request handlers for the MCP server
 */
export function setupRequestHandlers(server: Server): void {
  // Handler for listing all database tables as resources
  server.setRequestHandler(ListResourcesRequestSchema, handleListResources);
  
  // Handler for reading schema information about a table
  server.setRequestHandler(ReadResourceRequestSchema, handleReadResource);
  
  // Handler for listing available tools
  server.setRequestHandler(ListToolsRequestSchema, handleListTools);
  
  // Handler for executing tools (SQL queries)
  server.setRequestHandler(CallToolRequestSchema, handleCallTool);
}

/**
 * Helper function to create a resource URI for a table
 */
function createResourceUri(tableName: string): string {
  const projectRef = supabaseService.getProjectRef();
  return `supabase://${projectRef}.supabase.co/tables/${tableName}`;
}

/**
 * Handler for listing all database tables as resources
 */
async function handleListResources() {
  try {
    const { tables, error } = await supabaseService.listTables();
    
    if (error) {
      console.warn('Could not list tables:', error.message);
      return { resources: [] };
    }
    
    return {
      resources: tables.map((tableName) => ({
        uri: createResourceUri(tableName),
        mimeType: "application/json",
        name: `"${tableName}" database table`,
      })),
    };
  } catch (error) {
    console.error('Error listing resources:', error);
    return { resources: [] };
  }
}

/**
 * Handler for reading schema information about a table
 */
async function handleReadResource(request: any) {
  try {
    const uri = request.params.uri;
    const matches = uri.match(/supabase:\/\/[^\/]+\/tables\/([^\/]+)/);
    
    if (!matches) {
      throw new Error(`Invalid resource URI: ${uri}`);
    }
    
    const tableName = matches[1];
    const { schema, error } = await supabaseService.getTableSchema(tableName);
    
    if (error) {
      console.warn(`Could not get schema for table ${tableName}:`, error.message);
      return {
        contents: [
          {
            uri: request.params.uri,
            mimeType: "application/json",
            text: JSON.stringify({ error: "Could not access schema with current permissions" }, null, 2),
          },
        ],
      };
    }
    
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(schema, null, 2),
        },
      ],
    };
  } catch (error: any) {
    console.error('Error reading resource:', error);
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify({ error: error.message || "Failed to read resource" }, null, 2),
        },
      ],
    };
  }
}

/**
 * Handler for listing available tools
 */
async function handleListTools() {
  return {
    tools: [
      {
        name: "query",
        description: "Run a read-only SQL query on the Supabase database",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string" },
          },
        },
      },
      {
        name: "createTable",
        description: "Create a new table in the Supabase database",
        inputSchema: {
          type: "object",
          properties: {
            sql: { 
              type: "string",
              description: "SQL CREATE TABLE statement"
            },
          },
        },
      },
    ],
  };
}

/**
 * Handler for executing tools (SQL queries)
 */
async function handleCallTool(request: any) {
  const sql = request.params.arguments?.sql as string;
  
  if (request.params.name === "query") {
    try {
      const { data, error } = await supabaseService.executeSqlQuery(sql);
      
      if (error) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              error: true, 
              message: error.message 
            }, null, 2) 
          }],
          isError: true,
        };
      }
      
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            error: true, 
            message: error.message || String(error)
          }, null, 2) 
        }],
        isError: true,
      };
    }
  } else if (request.params.name === "createTable") {
    try {
      // Validate that the SQL statement is a CREATE TABLE statement
      if (!sql.toUpperCase().includes('CREATE TABLE')) {
        throw new Error('SQL statement must be a CREATE TABLE statement');
      }
      
      const { data, error } = await supabaseService.executeWriteSqlQuery(sql);
      
      if (error) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              error: true, 
              message: error.message 
            }, null, 2) 
          }],
          isError: true,
        };
      }
      
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({
            success: true,
            message: "Table created successfully",
            data: data
          }, null, 2) 
        }],
        isError: false,
      };
    } catch (error: any) {
      return {
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            error: true, 
            message: error.message || String(error)
          }, null, 2) 
        }],
        isError: true,
      };
    }
  }
  
  throw new Error(`Unknown tool: ${request.params.name}`);
} 