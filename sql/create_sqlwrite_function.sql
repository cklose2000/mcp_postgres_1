-- SQL file to create the sqlwrite function in Supabase
-- Execute this in the Supabase SQL Editor

-- Function that allows controlled write operations
CREATE OR REPLACE FUNCTION public.sqlwrite(query TEXT)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
  operation TEXT;
BEGIN
  -- Extract operation type for security validation
  operation := UPPER(SUBSTRING(TRIM(query) FROM 1 FOR 6));
  
  -- Log the operation (optional)
  RAISE NOTICE 'Executing operation: %', operation;
  
  -- Only allow specific write operations
  IF operation NOT IN ('CREATE', 'INSERT', 'UPDATE', 'DELETE', 'ALTER ') THEN
    RETURN jsonb_build_object('error', true, 'message', 'Operation not allowed. Only CREATE, INSERT, UPDATE, DELETE, and ALTER operations are permitted.');
  END IF;
  
  -- Execute with security controls
  EXECUTE query;
  
  -- For operations that don't return data, return success message
  IF operation IN ('INSERT', 'UPDATE', 'DELETE') THEN
    -- Get number of affected rows (when available)
    GET DIAGNOSTICS result = ROW_COUNT;
    RETURN jsonb_build_object('success', true, 'affected_rows', result);
  ELSE
    -- For CREATE and ALTER operations
    RETURN jsonb_build_object('success', true, 'message', 'Operation executed successfully');
  END IF;

EXCEPTION WHEN OTHERS THEN
  -- Return detailed error information
  RETURN jsonb_build_object(
    'error', true, 
    'message', SQLERRM, 
    'detail', SQLSTATE,
    'query', query
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION public.sqlwrite(TEXT) TO authenticated;
-- Note: You may want to restrict this further depending on your security requirements

-- Add comment explaining the function
COMMENT ON FUNCTION public.sqlwrite(TEXT) IS 'Executes controlled write operations (CREATE, INSERT, UPDATE, DELETE, ALTER) with security measures.'; 