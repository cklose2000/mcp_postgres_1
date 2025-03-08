/**
 * Test script for CREATE TABLE functionality in the MCP server
 */
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

// Get the directory name in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the server executable
const serverPath = path.join(__dirname, 'dist', 'index.js');

// Start the server
console.log(`Starting MCP server from: ${serverPath}`);
const serverProcess = spawn('node', [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Buffer to accumulate data from the server
let dataBuffer = '';

// Process server output
serverProcess.stdout.on('data', (data) => {
  const output = data.toString();
  dataBuffer += output;
  
  // Process complete JSON objects in the buffer
  let jsonStart = dataBuffer.indexOf('{');
  let jsonEnd = dataBuffer.indexOf('}', jsonStart);
  
  while (jsonStart >= 0 && jsonEnd >= 0) {
    try {
      // Extract a complete JSON object
      const jsonStr = dataBuffer.substring(jsonStart, jsonEnd + 1);
      const response = JSON.parse(jsonStr);
      
      // Handle the response
      console.log(`Received response for id ${response.id}:`);
      console.log(JSON.stringify(response, null, 2));
      
      if (response.id === "1") {
        console.log("\nSending callTool request to create a table...");
        const callToolRequest = {
          jsonrpc: "2.0",
          id: "2",
          method: "callTool",
          params: {
            name: "createTable",
            arguments: {
              sql: "CREATE TABLE IF NOT EXISTS test_table (id SERIAL PRIMARY KEY, name TEXT NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW())"
            }
          }
        };
        
        console.log("Request:", JSON.stringify(callToolRequest, null, 2));
        serverProcess.stdin.write(JSON.stringify(callToolRequest) + '\n');
      } 
      else if (response.id === "2") {
        console.log("\nCreate table operation complete. Results shown above.");
        console.log("Shutting down...");
        serverProcess.kill();
        process.exit(0);
      }
    } catch (e) {
      // Partial JSON or not valid JSON, ignore and continue
      console.log("Skipping non-JSON or partial output");
    }
    
    // Remove the processed part from the buffer
    dataBuffer = dataBuffer.substring(jsonEnd + 1);
    jsonStart = dataBuffer.indexOf('{');
    jsonEnd = dataBuffer.indexOf('}', jsonStart);
  }
});

// Log any errors
serverProcess.stderr.on('data', (data) => {
  const error = data.toString().trim();
  if (error) {
    console.error(`Server error: ${error}`);
  }
});

// First, send a listTools request
setTimeout(() => {
  const listToolsRequest = {
    jsonrpc: "2.0",
    id: "1",
    method: "listTools",
    params: {}
  };
  
  console.log("Sending listTools request:", JSON.stringify(listToolsRequest, null, 2));
  serverProcess.stdin.write(JSON.stringify(listToolsRequest) + '\n');
}, 1000);

// Set a timeout to kill the server after 10 seconds
setTimeout(() => {
  console.log("Test timeout reached. Shutting down...");
  serverProcess.kill();
  process.exit(1);
}, 10000); 