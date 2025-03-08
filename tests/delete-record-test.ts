#!/usr/bin/env node

/**
 * DELETE Record Test
 * Tests the ability to delete records via the MCP server
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
  logger.info("DELETE Record Test");
  
  // Find the server executable
  const serverPath = findServerPath();
  
  // Start the server
  const serverProcess = startServer(serverPath);
  
  try {
    // Wait for server to start
    await sleep(1000);
    
    // First ensure the test table exists
    await createTestTable(serverProcess);
    
    // Insert some test records to delete
    await insertTestRecords(serverProcess);
    
    // Test delete record functionality
    await testDeleteRecord(serverProcess);
    
    // Show success message
    logger.info("\nDELETE Record test completed!", {
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
 * Create a test table for deleting records
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
          CREATE TABLE IF NOT EXISTS test_delete_records (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            status TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
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
 * Insert test records that will be deleted
 */
async function insertTestRecords(serverProcess: ChildProcess): Promise<void> {
  logger.info("Inserting test records...");
  
  // Create a batch operation request to insert multiple records
  const batchRequest = {
    jsonrpc: '2.0',
    id: '2',
    method: 'callTool',
    params: {
      name: 'batchOperations',
      arguments: {
        operations: [
          {
            type: 'insert',
            table: 'test_delete_records',
            values: {
              name: "Keep This Record",
              status: "keep"
            }
          },
          {
            type: 'insert',
            table: 'test_delete_records',
            values: {
              name: "Delete This Record",
              status: "delete"
            }
          },
          {
            type: 'insert',
            table: 'test_delete_records',
            values: {
              name: "Also Delete This Record",
              status: "delete"
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
          logger.info("Insert batch response:", { response });
          
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
    logger.info("Sending batch insert request");
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
 * Test the deleteRecord functionality
 */
async function testDeleteRecord(serverProcess: ChildProcess): Promise<void> {
  logger.info("Testing deleteRecord...");
  
  // Create the delete request
  const deleteRequest = {
    jsonrpc: '2.0',
    id: '3',
    method: 'callTool',
    params: {
      name: 'deleteRecord',
      arguments: {
        table: 'test_delete_records',
        filter: {
          status: "delete"
        },
        returning: '*'
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
          logger.info("Delete record response:", { response });
          
          // Verify the response contains the expected data
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              const parsedContent = JSON.parse(content);
              if (parsedContent.success) {
                logger.info("✅ Records deleted successfully");
                
                // Verify that the correct number of records were deleted
                const deletedRecords = parsedContent.data;
                const expectedCount = 2; // We inserted 2 records with status "delete"
                
                if (Array.isArray(deletedRecords) && deletedRecords.length === expectedCount) {
                  logger.info(`✅ Deleted ${deletedRecords.length} records as expected`);
                  
                  // Verify that all deleted records had status "delete"
                  const allDeletedHaveCorrectStatus = deletedRecords.every(
                    record => record.status === "delete"
                  );
                  
                  if (allDeletedHaveCorrectStatus) {
                    logger.info("✅ All deleted records had status 'delete'");
                  } else {
                    logger.warn("❌ Some deleted records did not have status 'delete'");
                  }
                } else {
                  logger.warn(`❌ Expected to delete ${expectedCount} records, but deleted ${Array.isArray(deletedRecords) ? deletedRecords.length : 0}`);
                }
              } else {
                logger.warn("❌ Delete operation failed");
              }
            } catch (e) {
              logger.warn("❌ Could not parse content", { content });
            }
          }
          
          // After verifying the delete, let's check if the "keep" records are still there
          checkRemainingRecords(serverProcess).catch(error => {
            logger.error("Error checking remaining records", { error });
          });
          
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
    logger.info("Sending deleteRecord request:", { request: deleteRequest });
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(deleteRequest) + '\n');
    
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
 * Check if the "keep" records are still in the database
 */
async function checkRemainingRecords(serverProcess: ChildProcess): Promise<void> {
  logger.info("Checking remaining records...");
  
  // Create a query to fetch remaining records
  const queryRequest = {
    jsonrpc: '2.0',
    id: '4',
    method: 'callTool',
    params: {
      name: 'query',
      arguments: {
        sql: 'SELECT * FROM test_delete_records ORDER BY id'
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
              
              if (Array.isArray(parsedContent) && parsedContent.length === 1) {
                const remainingRecord = parsedContent[0];
                
                if (remainingRecord.status === "keep" && remainingRecord.name === "Keep This Record") {
                  logger.info("✅ The record with status 'keep' was not deleted");
                } else {
                  logger.warn("❌ Expected only the 'keep' record to remain, but found different records");
                }
              } else {
                logger.warn(`❌ Expected 1 record to remain, but found ${Array.isArray(parsedContent) ? parsedContent.length : 0}`);
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
    logger.info("Sending query request to check remaining records");
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