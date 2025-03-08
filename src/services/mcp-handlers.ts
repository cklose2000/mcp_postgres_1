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
      },
      {
        name: "updateRecord",
        description: "Update existing records in a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { 
              type: "string",
              description: "The name of the table to update"
            },
            values: {
              type: "object",
              description: "Key-value pairs of column names and values to update"
            },
            filter: {
              type: "object",
              description: "Key-value pairs to filter which records to update"
            },
            returning: {
              type: "string",
              description: "Columns to return after update (default: '*')"
            }
          },
          required: ["table", "values", "filter"]
        },
      },
      {
        name: "deleteRecord",
        description: "Delete records from a table",
        inputSchema: {
          type: "object",
          properties: {
            table: { 
              type: "string",
              description: "The name of the table to delete from"
            },
            filter: {
              type: "object",
              description: "Key-value pairs to filter which records to delete"
            },
            returning: {
              type: "string",
              description: "Columns to return from deleted records (default: '*')"
            }
          },
          required: ["table", "filter"]
        },
      },
      {
        name: "batchOperations",
        description: "Execute multiple operations in a single request",
        inputSchema: {
          type: "object",
          properties: {
            operations: {
              type: "array",
              description: "Array of operations to execute",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    description: "Operation type: insert, update, delete",
                    enum: ["insert", "update", "delete"]
                  },
                  table: {
                    type: "string",
                    description: "Table name for the operation"
                  },
                  values: {
                    type: "object",
                    description: "Values for insert/update operations"
                  },
                  filter: {
                    type: "object",
                    description: "Filter criteria for update/delete operations"
                  },
                  returning: {
                    type: "string",
                    description: "Columns to return (default: '*')"
                  }
                },
                required: ["type", "table"]
              }
            },
            useTransaction: {
              type: "boolean",
              description: "Whether to execute all operations in a transaction (default: true)"
            }
          },
          required: ["operations"]
        }
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
  } else if (request.params.name === "updateRecord") {
    try {
      const { table, values, filter, returning = '*' } = request.params.arguments;
      
      // Validate input
      if (!table) {
        throw new Error('Table name is required');
      }
      
      if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
        throw new Error('Values object is required and must contain at least one key-value pair');
      }
      
      if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
        throw new Error('Filter object is required and must contain at least one key-value pair');
      }
      
      // Sanitize table name to prevent SQL injection
      const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
      
      // If the sanitized table name doesn't match the input, it was potentially malicious
      if (sanitizedTable !== table) {
        throw new Error('Invalid table name. Table names can only contain alphanumeric characters and underscores.');
      }
      
      // Execute the update operation
      const { data, error } = await supabaseService.executeUpdate(sanitizedTable, values, filter, returning);
      
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
            message: `Record(s) in ${table} updated successfully`,
            affected_count: Array.isArray(data) ? data.length : 0,
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
  } else if (request.params.name === "deleteRecord") {
    try {
      const { table, filter, returning = '*' } = request.params.arguments;
      
      // Validate input
      if (!table) {
        throw new Error('Table name is required');
      }
      
      if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
        throw new Error('Filter object is required and must contain at least one key-value pair');
      }
      
      // Sanitize table name to prevent SQL injection
      const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
      
      // If the sanitized table name doesn't match the input, it was potentially malicious
      if (sanitizedTable !== table) {
        throw new Error('Invalid table name. Table names can only contain alphanumeric characters and underscores.');
      }

      // If no filter is provided or an empty filter, prevent deleting all records as a safety measure
      if (Object.keys(filter).length === 0) {
        throw new Error('Delete operations require a filter to prevent accidental deletion of all records');
      }
      
      // Execute the delete operation
      const { data, error } = await supabaseService.executeDelete(sanitizedTable, filter, returning);
      
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
            message: `Record(s) in ${table} deleted successfully`,
            affected_count: Array.isArray(data) ? data.length : 0,
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
  } else if (request.params.name === "batchOperations") {
    try {
      const { operations, useTransaction = true } = request.params.arguments;
      
      // Validate input
      if (!operations || !Array.isArray(operations) || operations.length === 0) {
        throw new Error('Operations array is required and must contain at least one operation');
      }
      
      // Validate and sanitize each operation
      const sanitizedOperations = [];
      const validationErrors = [];
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const { type, table, values, filter, returning = '*' } = operation;
        
        // Validate operation
        if (!type) {
          validationErrors.push({ index: i, error: 'Operation type is required' });
          continue;
        }
        
        if (!table) {
          validationErrors.push({ index: i, error: 'Table name is required' });
          continue;
        }
        
        // Sanitize table name
        const sanitizedTable = table.replace(/[^a-zA-Z0-9_]/g, '');
        if (sanitizedTable !== table) {
          validationErrors.push({ index: i, error: 'Invalid table name. Table names can only contain alphanumeric characters and underscores.' });
          continue;
        }
        
        // Type-specific validation
        switch (type.toLowerCase()) {
          case 'insert':
            if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
              validationErrors.push({ index: i, error: 'Values object is required for insert operations' });
              continue;
            }
            break;
            
          case 'update':
            if (!values || typeof values !== 'object' || Object.keys(values).length === 0) {
              validationErrors.push({ index: i, error: 'Values object is required for update operations' });
              continue;
            }
            
            if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
              validationErrors.push({ index: i, error: 'Filter object is required for update operations' });
              continue;
            }
            break;
            
          case 'delete':
            if (!filter || typeof filter !== 'object' || Object.keys(filter).length === 0) {
              validationErrors.push({ index: i, error: 'Filter object is required for delete operations' });
              continue;
            }
            break;
            
          default:
            validationErrors.push({ index: i, error: `Unknown operation type: ${type}` });
            continue;
        }
        
        // Add sanitized operation to the list
        sanitizedOperations.push({
          type: type.toLowerCase(),
          table: sanitizedTable,
          values,
          filter,
          returning
        });
      }
      
      // If there are validation errors, return them
      if (validationErrors.length > 0) {
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: false,
              message: `Validation failed for ${validationErrors.length} operations`,
              errors: validationErrors
            }, null, 2) 
          }],
          isError: true,
        };
      }
      
      let result;
      
      // Use transaction if requested (default is true)
      if (useTransaction) {
        // Execute all operations in a transaction
        result = await supabaseService.executeTransaction(sanitizedOperations);
        
        // Return the transaction results
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: result.success,
              message: result.success 
                ? `Successfully executed ${sanitizedOperations.length} operations in a transaction` 
                : `Transaction failed: ${result.error?.message || 'Unknown error'}`,
              results: result.results,
              error: result.error
            }, null, 2) 
          }],
          isError: !result.success,
        };
      } else {
        // Execute operations sequentially without a transaction (old behavior)
        const results = [];
        const errors = [];
        
        // Process each operation
        for (let i = 0; i < sanitizedOperations.length; i++) {
          const operation = sanitizedOperations[i];
          const { type, table, values, filter, returning } = operation;
          
          try {
            let operationResult;
            
            // Execute the appropriate operation type
            switch (type) {
              case 'insert':
                operationResult = await supabaseService.executeInsert(table, values!, returning);
                break;
                
              case 'update':
                operationResult = await supabaseService.executeUpdate(table, values!, filter!, returning);
                break;
                
              case 'delete':
                operationResult = await supabaseService.executeDelete(table, filter!, returning);
                break;
                
              default:
                // This shouldn't happen because we validate earlier, but just in case
                operationResult = { 
                  data: null, 
                  error: { message: `Unknown operation type: ${type}` } 
                };
                break;
            }
            
            // Add the result to the results array
            results.push({
              success: !operationResult.error,
              operation,
              data: operationResult.data,
              error: operationResult.error
            });
            
            // If this operation failed, add it to the errors array
            if (operationResult.error) {
              errors.push({
                index: i,
                type,
                table,
                error: operationResult.error
              });
            }
            
          } catch (error: any) {
            // Add the error to the errors array
            errors.push({
              index: i,
              type,
              table,
              error: error.message || String(error)
            });
            
            // Add the failed operation to the results array
            results.push({
              success: false,
              operation,
              error: error.message || String(error)
            });
          }
        }
        
        // Return the results of all operations
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              success: errors.length === 0,
              message: `Processed ${sanitizedOperations.length} operations with ${errors.length} errors`,
              results,
              errors: errors.length > 0 ? errors : undefined
            }, null, 2) 
          }],
          isError: errors.length > 0,
        };
      }
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