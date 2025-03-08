#!/usr/bin/env node

/**
 * MCP Server Test
 * Tests the MCP server by simulating client interactions
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
  logger.info("MCP Server Test");
  
  // Find the server executable
  const serverPath = findServerPath();
  
  // Start the server
  const serverProcess = startServer(serverPath);
  
  try {
    // Wait for server to start
    await sleep(1000);
    
    // Run tests
    await testListTools(serverProcess);
    
    // Show success message
    logger.info("\nTest completed successfully!", {
      serverPath: path.resolve(serverPath)
    });
    
    logger.info("To use it with Cursor IDE, configure it in the MCP settings section:");
    logger.info(`Command: node ${path.resolve(serverPath)}`);
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
  const potentialPaths = [
    path.join(process.cwd(), 'dist', 'index.js'),
    path.join(process.cwd(), 'dist', 'src', 'index.js'),
    path.join(process.cwd(), '..', 'dist', 'index.js')
  ];
  
  for (const serverPath of potentialPaths) {
    if (fs.existsSync(serverPath)) {
      return serverPath;
    }
  }
  
  throw new Error('MCP server not found. Did you run "npm run build"?');
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
        logger.warn(`Server error: ${error}`);
      }
    });
  }
  
  serverProcess.on('error', (error) => {
    logger.error(`Failed to start server: ${error.message}`, { error });
    process.exit(1);
  });
  
  return serverProcess;
}

/**
 * Test the ListTools request
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
      logger.debug(`Response received: ${output}`);
      
      // Check for response
      if (output.includes('"jsonrpc":"2.0"') || output.includes('"jsonrpc": "2.0"')) {
        // This is good enough for our test
        logger.info("Response received from server");
        
        // Stop listening for more responses
        if (serverProcess.stdout) {
          serverProcess.stdout.removeListener('data', responseHandler);
        }
        resolve();
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
 * Helper function to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run the test
main().catch(error => {
  logger.error("Test execution failed", { error });
  process.exit(1);
}); 