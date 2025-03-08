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
      {
        name: "insertRecord",
        description: "Insert a new record into a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { 
              type: "string",
              description: "The name of the table to insert into"
            },
            values: {
              type: "object",
              description: "Key-value pairs of column names and values"
            },
            returning: {
              type: "string",
              description: "Columns to return after insert (default: '*')"
            }
          },
          required: ["table", "values"]
        },
      }
    ],
  };
}

/**
 * Handler for executing tools (SQL queries and more)
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
  } else if (request.params.name === "insertRecord") {
    try {
      const { table, values, returning = '*' } = request.params.arguments;
      
      // Validate input
      if (!table) {
        throw new Error('Table name is required');
      }
      
      if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
        throw new Error('Values object is required and must contain at least one key-value pair');
      }
      
      // Sanitize table name to prevent SQL injection
      const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
      
      // If the sanitized table name doesn't match the input, it was potentially malicious
      if (sanitizedTable !== table) {
        throw new Error('Invalid table name. Table names can only contain alphanumeric characters and underscores.');
      }
      
      // Construct the column and value portions of the INSERT statement
      const columns = Object.keys(values);
      const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
      const valueArray = Object.values(values);
      
      // Construct a parameterized INSERT statement
      const insertSql = `
        INSERT INTO ${sanitizedTable} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING ${returning}
      `;
      
      // Execute the query
      const { data, error } = await supabaseService.executeInsert(sanitizedTable, values, returning);
      
      if (error) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              error: true, 
              message: error.message,
              details: error.details 
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
            message: `Record inserted into ${table} successfully`,
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