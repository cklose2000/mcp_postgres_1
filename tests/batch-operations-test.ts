#!/usr/bin/env node

/**
 * Batch Operations Test
 * Tests the ability to execute multiple operations in a single request
 */
import { spawn, ChildProcess } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import logger from '../src/utils/logging.js';

/**
 * Main test function
 */
async function main() {
  logger.info("Batch Operations Test");
  
  // Find the server executable
  const serverPath = findServerPath();
  
  // Start the server
  const serverProcess = startServer(serverPath);
  
  try {
    // Wait for server to start
    await sleep(1000);
    
    // First ensure the test table exists
    await createTestTable(serverProcess);
    
    // Test batch operations
    await testBatchOperations(serverProcess);
    
    // Verify the results of the batch operations
    await verifyResults(serverProcess);
    
    // Show success message
    logger.info("\nBatch Operations test completed!", {
      serverPath: path.resolve(serverPath)
    });
  } catch (error) {
    logger.error("Test failed", { error });
  } finally {
    // Clean up
    logger.info("Shutting down server...");
    serverProcess.kill();
  }
}

/**
 * Find the server executable
 */
function findServerPath(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const projectRoot = path.resolve(__dirname, '..');
  
  // Check in the dist directory
  const serverPath = path.join(projectRoot, 'dist', 'index.js');
  
  if (fs.existsSync(serverPath)) {
    return serverPath;
  }
  
  throw new Error(`Server executable not found at ${serverPath}`);
}

/**
 * Start the MCP server
 */
function startServer(serverPath: string): ChildProcess {
  logger.info("Starting MCP server...", { serverPath });
  
  const serverProcess = spawn('node', [serverPath], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  if (serverProcess.stdout) {
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        logger.debug(`Server output: ${output}`);
      }
    });
  }
  
  if (serverProcess.stderr) {
    serverProcess.stderr.on('data', (data) => {
      const error = data.toString().trim();
      if (error) {
        logger.error(`Server error: ${error}`);
      }
    });
  }
  
  serverProcess.on('error', (error) => {
    logger.error("Server process error", { error });
  });
  
  serverProcess.on('exit', (code, signal) => {
    logger.debug(`Server process exited with code ${code} and signal ${signal}`);
  });
  
  return serverProcess;
}

/**
 * Create a test table for batch operations
 */
async function createTestTable(serverProcess: ChildProcess): Promise<void> {
  logger.info("Creating test table...");
  
  // Create the request
  const createTableRequest = {
    jsonrpc: '2.0',
    id: '1',
    method: 'callTool',
    params: {
      name: 'createTable',
      arguments: {
        sql: `
          CREATE TABLE IF NOT EXISTS test_batch_operations (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
          )
        `
      }
    }
  };
  
  return new Promise((resolve, reject) => {
    // Set up response handler
    const responseHandler = (data: Buffer) => {
      const output = data.toString().trim();
      
      try {
        // Try to parse the response as JSON
        if (output.includes('{') && output.includes('}')) {
          // Extract the JSON part of the response
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}') + 1;
          const jsonStr = output.substring(jsonStart, jsonEnd);
          
          const response = JSON.parse(jsonStr);
          logger.info("Create table response:", { response });
          
          // Stop listening for more responses
          if (serverProcess.stdout) {
            serverProcess.stdout.removeListener('data', responseHandler);
          }
          resolve();
        }
      } catch (error) {
        // If we can't parse JSON yet, continue listening
        logger.debug("Received non-JSON output or partial response");
      }
    };
    
    // Listen for response
    if (!serverProcess.stdout) {
      reject(new Error('Server process stdout is null'));
      return;
    }
    serverProcess.stdout.on('data', responseHandler);
    
    // Send the request
    logger.info("Sending createTable request");
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(createTableRequest) + '\n');
    
    // Set a timeout
    setTimeout(() => {
      if (serverProcess.stdout) {
        serverProcess.stdout.removeListener('data', responseHandler);
      }
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

/**
 * Test batch operations functionality
 */
async function testBatchOperations(serverProcess: ChildProcess): Promise<void> {
  logger.info("Testing batch operations...");
  
  // Create a batch operation request
  const batchRequest = {
    jsonrpc: '2.0',
    id: '2',
    method: 'callTool',
    params: {
      name: 'batchOperations',
      arguments: {
        operations: [
          // Insert operation #1
          {
            type: 'insert',
            table: 'test_batch_operations',
            values: {
              name: "User 1",
              status: "active",
              notes: "First user"
            }
          },
          // Insert operation #2
          {
            type: 'insert',
            table: 'test_batch_operations',
            values: {
              name: "User 2",
              status: "inactive",
              notes: "Second user"
            }
          },
          // Insert operation #3
          {
            type: 'insert',
            table: 'test_batch_operations',
            values: {
              name: "User 3",
              status: "active",
              notes: "Will be updated"
            }
          },
          // Update operation
          {
            type: 'update',
            table: 'test_batch_operations',
            values: {
              notes: "Updated via batch operation",
              status: "updated"
            },
            filter: {
              name: "User 3"
            }
          },
          // Delete operation
          {
            type: 'delete',
            table: 'test_batch_operations',
            filter: {
              status: "inactive"
            }
          }
        ]
      }
    }
  };
  
  return new Promise((resolve, reject) => {
    // Set up response handler
    const responseHandler = (data: Buffer) => {
      const output = data.toString().trim();
      
      try {
        // Try to parse the response as JSON
        if (output.includes('{') && output.includes('}')) {
          // Extract the JSON part of the response
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}') + 1;
          const jsonStr = output.substring(jsonStart, jsonEnd);
          
          const response = JSON.parse(jsonStr);
          logger.info("Batch operations response:", { response });
          
          // Verify the response contains the expected data
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              const parsedContent = JSON.parse(content);
              
              if (parsedContent.success) {
                logger.info("✅ Batch operations executed successfully");
                
                // Verify results for each operation
                const results = parsedContent.results;
                
                if (Array.isArray(results) && results.length === 5) {
                  logger.info(`✅ Got results for all ${results.length} operations`);
                  
                  // Check each result
                  results.forEach((result, index) => {
                    if (result.success) {
                      logger.info(`✅ Operation ${index + 1} succeeded: ${result.operation.type}`);
                    } else {
                      logger.warn(`❌ Operation ${index + 1} failed: ${result.error}`);
                    }
                  });
                } else {
                  logger.warn(`❌ Expected results for 5 operations, but got ${Array.isArray(results) ? results.length : 0}`);
                }
              } else {
                logger.warn("❌ Batch operations failed");
              }
            } catch (e) {
              logger.warn("❌ Could not parse content", { content });
            }
          }
          
          // Stop listening for more responses
          if (serverProcess.stdout) {
            serverProcess.stdout.removeListener('data', responseHandler);
          }
          resolve();
        }
      } catch (error) {
        // If we can't parse JSON yet, continue listening
        logger.debug("Received non-JSON output or partial response");
      }
    };
    
    // Listen for response
    if (!serverProcess.stdout) {
      reject(new Error('Server process stdout is null'));
      return;
    }
    serverProcess.stdout.on('data', responseHandler);
    
    // Send the request
    logger.info("Sending batch operations request");
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(batchRequest) + '\n');
    
    // Set a timeout
    setTimeout(() => {
      if (serverProcess.stdout) {
        serverProcess.stdout.removeListener('data', responseHandler);
      }
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

/**
 * Verify the results of the batch operations
 */
async function verifyResults(serverProcess: ChildProcess): Promise<void> {
  logger.info("Verifying results...");
  
  // Create a query to fetch records after batch operations
  const queryRequest = {
    jsonrpc: '2.0',
    id: '3',
    method: 'callTool',
    params: {
      name: 'query',
      arguments: {
        sql: 'SELECT * FROM test_batch_operations ORDER BY id'
      }
    }
  };
  
  return new Promise((resolve, reject) => {
    // Set up response handler
    const responseHandler = (data: Buffer) => {
      const output = data.toString().trim();
      
      try {
        // Try to parse the response as JSON
        if (output.includes('{') && output.includes('}')) {
          // Extract the JSON part of the response
          const jsonStart = output.indexOf('{');
          const jsonEnd = output.lastIndexOf('}') + 1;
          const jsonStr = output.substring(jsonStart, jsonEnd);
          
          const response = JSON.parse(jsonStr);
          
          // Verify the response contains the expected data
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              const parsedContent = JSON.parse(content);
              
              if (Array.isArray(parsedContent)) {
                // We should have 2 records: User 1 and the updated User 3
                // User 2 should have been deleted
                if (parsedContent.length === 2) {
                  logger.info("✅ Expected 2 records after batch operations, found 2");
                  
                  // Find User 1 and User 3
                  const user1 = parsedContent.find((r: any) => r.name === "User 1");
                  const user3 = parsedContent.find((r: any) => r.name === "User 3");
                  
                  if (user1) {
                    if (user1.status === "active" && user1.notes === "First user") {
                      logger.info("✅ User 1 record has expected values");
                    } else {
                      logger.warn("❌ User 1 record has unexpected values", { user1 });
                    }
                  } else {
                    logger.warn("❌ Could not find User 1 record");
                  }
                  
                  if (user3) {
                    if (user3.status === "updated" && user3.notes === "Updated via batch operation") {
                      logger.info("✅ User 3 was updated correctly");
                    } else {
                      logger.warn("❌ User 3 was not updated correctly", { user3 });
                    }
                  } else {
                    logger.warn("❌ Could not find User 3 record");
                  }
                  
                  // Check that User 2 is not present
                  const user2 = parsedContent.find((r: any) => r.name === "User 2");
                  if (!user2) {
                    logger.info("✅ User 2 was deleted as expected");
                  } else {
                    logger.warn("❌ User 2 should have been deleted but is still present", { user2 });
                  }
                } else {
                  logger.warn(`❌ Expected 2 records after batch operations, but found ${parsedContent.length}`);
                }
              } else {
                logger.warn("❌ Expected an array of records");
              }
            } catch (e) {
              logger.warn("❌ Could not parse content", { content });
            }
          }
          
          // Stop listening for more responses
          if (serverProcess.stdout) {
            serverProcess.stdout.removeListener('data', responseHandler);
          }
          resolve();
        }
      } catch (error) {
        // If we can't parse JSON yet, continue listening
        logger.debug("Received non-JSON output or partial response");
      }
    };
    
    // Listen for response
    if (!serverProcess.stdout) {
      reject(new Error('Server process stdout is null'));
      return;
    }
    serverProcess.stdout.on('data', responseHandler);
    
    // Send the request
    logger.info("Sending query request to verify results");
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(queryRequest) + '\n');
    
    // Set a timeout
    setTimeout(() => {
      if (serverProcess.stdout) {
        serverProcess.stdout.removeListener('data', responseHandler);
      }
      reject(new Error('Timeout waiting for response'));
    }, 5000);
  });
}

/**
 * Simple sleep function
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
main().catch(error => {
  logger.error("Unhandled error", { error });
  process.exit(1);
}); 