#!/usr/bin/env node

/**
 * CREATE TABLE Test
 * Tests the ability to create tables via the MCP server
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
  logger.info("CREATE TABLE Test");
  
  // Find the server executable
  const serverPath = findServerPath();
  
  // Start the server
  const serverProcess = startServer(serverPath);
  
  try {
    // Wait for server to start
    await sleep(1000);
    
    // Test create table functionality
    await testListTools(serverProcess);
    await testCreateTable(serverProcess);
    
    // Show success message
    logger.info("\nCREATE TABLE test completed!", {
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
 * Test the ListTools request to verify our createTable tool is available
 */
async function testListTools(serverProcess: ChildProcess): Promise<void> {
  logger.info("Testing ListTools request...");
  
  // Create the request
  const listToolsRequest = {
    jsonrpc: '2.0',
    id: '1',
    method: 'listTools',
    params: {}
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
          logger.info("Response received:", { response });
          
          // Verify the createTable tool is in the response
          if (response.result && response.result.tools) {
            const tools = response.result.tools;
            const hasCreateTable = tools.some((tool: any) => tool.name === "createTable");
            
            if (hasCreateTable) {
              logger.info("✅ createTable tool is available");
            } else {
              logger.warn("❌ createTable tool is not available");
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
    logger.info("Sending request:", { request: listToolsRequest });
    if (!serverProcess.stdin) {
      reject(new Error('Server process stdin is null'));
      return;
    }
    serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
    
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
 * Test the CREATE TABLE functionality
 */
async function testCreateTable(serverProcess: ChildProcess): Promise<void> {
  logger.info("Testing CREATE TABLE...");
  
  // Create the request
  const createTableRequest = {
    jsonrpc: '2.0',
    id: '2',
    method: 'callTool',
    params: {
      name: 'createTable',
      arguments: {
        sql: 'CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())'
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
          logger.info("CREATE TABLE response:", { response });
          
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
    logger.info("Sending request:", { request: createTableRequest });
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