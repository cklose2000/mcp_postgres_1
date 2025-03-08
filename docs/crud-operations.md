# CRUD Operations in MCP Server

This document explains how to use the CRUD (Create, Read, Update, Delete) operations provided by the MCP server.

## Prerequisites

1. Supabase project configured with the appropriate RPC functions (see [supabase-setup.md](./supabase-setup.md))
2. Environment variables configured in your `.env` file (see [Environment Variables](#environment-variables))

## Supported Operations

### 1. Create Operations

#### Creating Tables

You can create tables using the `createTable` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "createTable",
    "arguments": {
      "sql": "CREATE TABLE users (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, created_at TIMESTAMPTZ DEFAULT NOW())"
    }
  }
}
```

#### Inserting Records

You can insert records using the `insertRecord` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "insertRecord",
    "arguments": {
      "table": "users",
      "values": {
        "name": "John Doe",
        "email": "john@example.com"
      },
      "returning": "*"  // Optional, defaults to "*"
    }
  }
}
```

### 2. Read Operations

You can read data using the `query` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "query",
    "arguments": {
      "sql": "SELECT * FROM users WHERE id = 1"
    }
  }
}
```

### 3. Update Operations

You can update records using the `updateRecord` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "updateRecord",
    "arguments": {
      "table": "users",
      "values": {
        "name": "Updated Name",
        "email": "updated@example.com"
      },
      "filter": {
        "id": 1
      },
      "returning": "*"  // Optional, defaults to "*"
    }
  }
}
```

### 4. Delete Operations

You can delete records using the `deleteRecord` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "deleteRecord",
    "arguments": {
      "table": "users",
      "filter": {
        "id": 1
      },
      "returning": "*"  // Optional, defaults to "*"
    }
  }
}
```

### 5. Batch Operations

You can execute multiple operations in a single request using the `batchOperations` tool:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "callTool",
  "params": {
    "name": "batchOperations",
    "arguments": {
      "operations": [
        {
          "type": "insert",
          "table": "users",
          "values": {
            "name": "New User",
            "email": "new@example.com"
          }
        },
        {
          "type": "update",
          "table": "users",
          "values": {
            "status": "active"
          },
          "filter": {
            "id": 2
          }
        },
        {
          "type": "delete",
          "table": "users",
          "filter": {
            "status": "inactive"
          }
        }
      ]
    }
  }
}
```

## Error Handling

All CRUD operations will return a response indicating success or failure:

### Successful Response

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"success\":true,\"message\":\"Operation completed successfully\",\"data\":[...]}"
      }
    ],
    "isError": false
  }
}
```

### Error Response

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"error\":true,\"message\":\"Error message here\",\"details\":\"Additional error details\"}"
      }
    ],
    "isError": true
  }
}
```

## Environment Variables

The following environment variables control CRUD operation permissions:

- `SUPABASE_SERVICE_KEY`: Required for operations that need elevated permissions
- `ALLOW_CREATE_OPERATIONS`: Set to `true` to allow CREATE operations with the regular API key
- `ALLOW_UPDATE_OPERATIONS`: Set to `true` to allow UPDATE operations with the regular API key
- `ALLOW_DELETE_OPERATIONS`: Set to `true` to allow DELETE operations with the regular API key

For security reasons, it's recommended to keep these set to `false` in production environments and use the service key for write operations.

## Security Considerations

- All table names are sanitized to prevent SQL injection
- Values are passed as parameters to prevent SQL injection
- Operations use environment-based permissions to control access
- Service key operations provide elevated privileges and should be carefully managed
- Delete operations require filters to prevent accidental deletion of all records
- Batch operations validate each individual operation before execution

## Testing

You can test your CRUD operations using the provided test scripts:

```bash
# Test table creation
npm run test

# Test INSERT operation specifically
node dist/tests/insert-record-test.js
``` 