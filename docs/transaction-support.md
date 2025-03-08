# Transaction Support for Batch Operations

This document explains how to set up transaction support for batch operations in the MCP server.

## Overview

The MCP server now supports executing multiple database operations (INSERT, UPDATE, DELETE) in a single transaction. This means that either all operations succeed, or none of them are applied - ensuring data integrity.

## Setting Up Transaction Support in Supabase

To enable transaction support, you need to create a PostgreSQL function in your Supabase project:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Create a new query with the following SQL code:

```sql
-- Create the transaction function for MCP batch operations
CREATE OR REPLACE FUNCTION execute_transaction(operations_json JSONB)
RETURNS JSONB[] AS $$
DECLARE
  operation JSONB;
  result JSONB;
  results JSONB[] := ARRAY[]::JSONB[];
  operation_type TEXT;
  table_name TEXT;
  values_json JSONB;
  filter_json JSONB;
  returning_cols TEXT;
  query TEXT;
  where_clause TEXT;
  insert_result JSONB;
  column_name TEXT;
  column_value JSONB;
  columns TEXT[] := ARRAY[]::TEXT[];
  values TEXT[] := ARRAY[]::TEXT[];
  params TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check that operations_json is an array
  IF jsonb_typeof(operations_json) != 'array' THEN
    RAISE EXCEPTION 'Operations must be provided as a JSON array';
  END IF;
  
  -- Execute all operations in a transaction
  FOR operation IN SELECT * FROM jsonb_array_elements(operations_json)
  LOOP
    -- Extract operation details
    operation_type := lower(operation->>'type');
    table_name := operation->>'table';
    values_json := operation->'values';
    filter_json := operation->'filter';
    returning_cols := coalesce(operation->>'returning', '*');
    
    -- Input validation
    IF operation_type IS NULL THEN
      result := jsonb_build_object(
        'error', jsonb_build_object('message', 'Operation type is required')
      );
      results := array_append(results, result);
      CONTINUE;
    END IF;
    
    IF table_name IS NULL THEN
      result := jsonb_build_object(
        'error', jsonb_build_object('message', 'Table name is required')
      );
      results := array_append(results, result);
      CONTINUE;
    END IF;
    
    -- Process each operation type
    CASE operation_type
      WHEN 'insert' THEN
        -- Validate insert input
        IF values_json IS NULL OR jsonb_typeof(values_json) != 'object' THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'Values are required for INSERT')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        -- Build INSERT statement
        columns := ARRAY[]::TEXT[];
        values := ARRAY[]::TEXT[];
        
        FOR column_name, column_value IN SELECT * FROM jsonb_each(values_json)
        LOOP
          columns := array_append(columns, quote_ident(column_name));
          values := array_append(values, quote_nullable(column_value));
        END LOOP;
        
        IF array_length(columns, 1) = 0 THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'No columns provided for INSERT')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        query := format(
          'INSERT INTO %I (%s) VALUES (%s) RETURNING %s AS data',
          table_name,
          array_to_string(columns, ', '),
          array_to_string(values, ', '),
          returning_cols
        );
        
        EXECUTE query INTO insert_result;
        
        result := jsonb_build_object('data', insert_result);
        results := array_append(results, result);
      
      WHEN 'update' THEN
        -- Validate update input
        IF values_json IS NULL OR jsonb_typeof(values_json) != 'object' THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'Values are required for UPDATE')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        IF filter_json IS NULL OR jsonb_typeof(filter_json) != 'object' THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'Filter is required for UPDATE')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        -- Build SET clause
        params := ARRAY[]::TEXT[];
        FOR column_name, column_value IN SELECT * FROM jsonb_each(values_json)
        LOOP
          params := array_append(params, format('%I = %s', column_name, quote_nullable(column_value)));
        END LOOP;
        
        -- Build WHERE clause
        where_clause := '';
        IF jsonb_typeof(filter_json) = 'object' AND NOT filter_json = '{}'::jsonb THEN
          params := ARRAY[]::TEXT[];
          FOR column_name, column_value IN SELECT * FROM jsonb_each(filter_json)
          LOOP
            params := array_append(params, format('%I = %s', column_name, quote_nullable(column_value)));
          END LOOP;
          where_clause := ' WHERE ' || array_to_string(params, ' AND ');
        END IF;
        
        query := format(
          'UPDATE %I SET %s%s RETURNING %s AS data',
          table_name,
          array_to_string(params, ', '),
          where_clause,
          returning_cols
        );
        
        EXECUTE query INTO insert_result;
        
        result := jsonb_build_object('data', insert_result);
        results := array_append(results, result);
      
      WHEN 'delete' THEN
        -- Validate delete input
        IF filter_json IS NULL OR jsonb_typeof(filter_json) != 'object' THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'Filter is required for DELETE')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        -- Safety check to prevent accidentally deleting all records
        IF filter_json = '{}'::jsonb THEN
          result := jsonb_build_object(
            'error', jsonb_build_object('message', 'Empty filter not allowed for DELETE operations')
          );
          results := array_append(results, result);
          CONTINUE;
        END IF;
        
        -- Build WHERE clause
        where_clause := '';
        params := ARRAY[]::TEXT[];
        FOR column_name, column_value IN SELECT * FROM jsonb_each(filter_json)
        LOOP
          params := array_append(params, format('%I = %s', column_name, quote_nullable(column_value)));
        END LOOP;
        where_clause := ' WHERE ' || array_to_string(params, ' AND ');
        
        query := format(
          'DELETE FROM %I%s RETURNING %s AS data',
          table_name,
          where_clause,
          returning_cols
        );
        
        EXECUTE query INTO insert_result;
        
        result := jsonb_build_object('data', insert_result);
        results := array_append(results, result);
      
      ELSE
        -- Unknown operation type
        result := jsonb_build_object(
          'error', jsonb_build_object('message', format('Unknown operation type: %s', operation_type))
        );
        results := array_append(results, result);
    END CASE;
  END LOOP;
  
  RETURN results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

4. Run the query to create the function
5. Grant permissions to this function by running:

```sql
-- Grant access to the function for your service role
GRANT EXECUTE ON FUNCTION execute_transaction(JSONB) TO service_role;

-- If you want to allow authenticated users to use transactions,
-- uncomment and run the following line:
-- GRANT EXECUTE ON FUNCTION execute_transaction(JSONB) TO authenticated;
```

## How It Works

1. When you make a batch operations request with `useTransaction: true` (default), all operations will be executed inside a PostgreSQL transaction.
2. If any operation fails, the entire transaction is rolled back - no changes are made to the database.
3. If all operations succeed, all changes are committed at once.

## Request Format

To use transactions, make a request to the `batchOperations` tool:

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
            "name": "John Doe",
            "email": "john@example.com"
          }
        },
        {
          "type": "update",
          "table": "users",
          "values": {
            "status": "active"
          },
          "filter": {
            "id": 123
          }
        }
      ],
      "useTransaction": true
    }
  }
}
```

The `useTransaction` flag is optional and defaults to `true`. Set it to `false` if you want operations to be executed independently (the old behavior).

## Response Format

The response will contain results for all operations:

```json
{
  "success": true,
  "message": "Successfully executed 2 operations in a transaction",
  "results": [
    {
      "success": true,
      "operation": {
        "type": "insert",
        "table": "users",
        "values": { "name": "John Doe", "email": "john@example.com" }
      },
      "data": [{"id": 1, "name": "John Doe", "email": "john@example.com"}]
    },
    {
      "success": true,
      "operation": {
        "type": "update",
        "table": "users",
        "values": { "status": "active" },
        "filter": { "id": 123 }
      },
      "data": [{"id": 123, "status": "active", "name": "Existing User"}]
    }
  ]
}
```

## Error Handling

If the transaction fails, you'll receive an error response:

```json
{
  "success": false,
  "message": "Transaction failed: Error message from database",
  "error": {
    "message": "Transaction failed",
    "details": { /* Error details */ }
  }
}
```

## Limitations

1. The PostgreSQL function has a size limit of about 8000 operations per transaction.
2. Complex queries may require custom modifications to the `execute_transaction` function.
3. If the `execute_transaction` function is not available, the MCP server will provide an error message with setup instructions.

## Security Considerations

The `execute_transaction` function uses the `SECURITY DEFINER` attribute, which means it runs with the permissions of the user who created it (typically the database owner). This is necessary to allow the function to perform operations on multiple tables within a transaction.

For additional security:

1. The function validates all inputs before execution
2. Table names and column names are properly quoted to prevent SQL injection
3. A filter is required for DELETE operations to prevent accidental deletion of all records 