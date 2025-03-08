#!/usr/bin/env node

/**
 * INSERT Record Test
 * Tests the ability to insert records via the MCP server
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
  logger.info("INSERT Record Test");
  
  // Find the server executable
  const serverPath = findServerPath();
  
  // Start the server
  const serverProcess = startServer(serverPath);
  
  try {
    // Wait for server to start
    await sleep(1000);
    
    // First ensure the test table exists
    await createTestTable(serverProcess);
    
    // Test insert record functionality
    await testInsertRecord(serverProcess);
    
    // Show success message
    logger.info("\nINSERT Record test completed!", {
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
 * Create a test table for inserting records
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
          CREATE TABLE IF NOT EXISTS test_records (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER,
            email TEXT,
            active BOOLEAN DEFAULT true,
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
    logger.info("Sending createTable request:", { request: createTableRequest });
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
 * Test the insertRecord functionality
 */
async function testInsertRecord(serverProcess: ChildProcess): Promise<void> {
  logger.info("Testing insertRecord...");
  
  // Create a sample record to insert
  const testRecord = {
    name: "Test User",
    age: 30,
    email: "test@example.com",
    active: true
  };
  
  // Create the request
  const insertRequest = {
    jsonrpc: '2.0',
    id: '2',
    method: 'callTool',
    params: {
      name: 'insertRecord',
      arguments: {
        table: 'test_records',
        values: testRecord,
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
          logger.info("Insert record response:", { response });
          
          // Verify the response contains the expected data
          const content = response.result?.content?.[0]?.text;
          if (content) {
            try {
              const parsedContent = JSON.parse(content);
              if (parsedContent.success) {
                logger.info("✅ Record inserted successfully");
                
                // Verify the returned data matches what we sent
                const returnedRecord = parsedContent.data?.[0];
                if (returnedRecord) {
                  const allMatching = Object.entries(testRecord).every(
                    ([key, value]) => returnedRecord[key] === value
                  );
                  
                  if (allMatching) {
                    logger.info("✅ Returned data matches inserted values");
                  } else {
                    logger.warn("❌ Returned data does not match inserted values");
                  }
                }
              } else {
                logger.warn("❌ Insert operation failed");
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
    logger.info("Sending insertRecord request:", { request: insertRequest });
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(insertRequest) + '\n');
    
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