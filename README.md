# PostgreSQL MCP Server for Cursor IDE

A Model Context Protocol (MCP) server that connects to Supabase PostgreSQL databases and integrates with Cursor IDE.

## Features

- Connects to Supabase PostgreSQL databases using the Supabase JavaScript client
- Lists database tables and their schemas
- Allows running read-only SQL queries directly from Cursor IDE
- Comprehensive error handling and logging
- Environment-specific configuration
- Robust testing tools

## Project Structure

```
postgres-mcp-server/
├── src/                     # Source code
│   ├── config/              # Configuration modules
│   ├── services/            # Core services
│   └── utils/               # Utility functions
├── tests/                   # Test scripts
├── config/                  # Configuration files
│   └── .env.sample          # Sample environment variables
├── dist/                    # Build output (generated)
├── tsconfig.json            # TypeScript configuration
├── build.tsconfig.json      # TypeScript build configuration (excludes tests)
├── test.tsconfig.json       # TypeScript test configuration (includes tests)
├── .env                     # Environment variables (not committed)
└── README.md                # Documentation
```

## Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/cklose2000/mcp_postgres_1.git
   cd postgres-mcp-server
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   # Copy the sample environment file
   npm run prepare-env
   
   # Edit the .env file with your actual Supabase credentials
   # Required variables:
   # - SUPABASE_PROJECT_URL
   # - SUPABASE_API_KEY
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Run tests**
   ```bash
   # Test the Supabase API connection and database
   npm run test:db
   
   # Test the MCP server
   npm run test:mcp
   
   # Run all tests
   npm test
   ```

## Cursor IDE Configuration

1. Open Cursor IDE Settings → MCP section
2. Click "Add new MCP server"
3. Fill in:
   - **Name**: `supabase-postgres`
   - **Type**: `command`
   - **Command**: 
   ```
   node /absolute/path/to/postgres-mcp-server/dist/index.js
   ```
4. Click "Add" to save

## Development

### Running in development mode

```bash
npm run dev
```

This will start the server with auto-reload on file changes.

### TypeScript Configuration

The project uses three TypeScript configuration files:

- **tsconfig.json**: The base TypeScript configuration
- **build.tsconfig.json**: Build-specific configuration that excludes test files, used by `npm run build` and `npm run dev`
- **test.tsconfig.json**: Test-specific configuration that includes both source and test files, used by `npm test`

This separation ensures that the build process is clean and focuses only on the application code, while tests can be run separately when needed.

### Environment Variables

The server uses environment variables for configuration. Create a `.env` file in the project root with:

```
# Supabase Project Configuration
SUPABASE_PROJECT_URL=https://your-project-ref.supabase.co
SUPABASE_API_KEY=your-supabase-api-key

# Database Password (optional, only for direct connections)
DB_PASSWORD=your_database_password_here

# Active environment (dev, test, or prod)
ACTIVE_ENV=dev
```

### Security Notes

- Never commit the `.env` file (it's already in `.gitignore`)
- Use `.env.sample` as a template for required variables
- All sensitive data is stored only in the `.env` file
- The code sanitizes inputs to prevent SQL injection

## Limitations

- When using the anon key, some database operations may be restricted due to Row Level Security (RLS) policies
- SQL queries will only work if your project has the `sqlquery` RPC function defined or if the anon key has permission to execute arbitrary SQL

## Troubleshooting

If Cursor isn't accessing your database correctly:

1. Run the test scripts to verify your connection works:
   ```bash
   npm run test:db       # Tests the database connection
   npm run test:mcp      # Tests the MCP server
   ```
2. Check your API key and project URL in the .env file
3. Make sure Supabase allows connections from your IP address
4. Verify the path in your command is correct (must be absolute)
5. Try restarting Cursor IDE 