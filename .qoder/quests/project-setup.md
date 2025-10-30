# Project Setup Design: Google Docs to WordPress Automation

## 1. Overview

This design document outlines the initial project structure and configuration for an automation system that processes Google Docs/Docx files and publishes them to WordPress. The system will use a job-based architecture with state management, external integrations, and content processing pipelines.

## 2. Goals

- Establish a TypeScript-based Node.js project with modern tooling
- Configure Prisma ORM with PostgreSQL for job state persistence
- Define a modular architecture with clear separation of concerns: core orchestration, external adapters, and processing pipelines
- Provide boilerplate code structure with empty function signatures for rapid development
- Ensure the project is ready for deployment on Vercel with serverless cron jobs

## 3. Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| Runtime | Node.js | Server-side JavaScript execution |
| Language | TypeScript | Type-safe development |
| Database | PostgreSQL | Relational data storage |
| ORM | Prisma | Database client and migrations |
| Google Integration | googleapis | Access Google Drive API |
| WordPress Integration | axios | REST API client for WordPress |
| Document Parsing | mammoth | Parse .docx files to HTML |
| HTML Processing | dompurify, jsdom | Server-side HTML sanitization |
| Templating | handlebars | Template rendering |
| Configuration | dotenv | Environment variable management |
| Code Quality | ESLint, Prettier | Linting and formatting |
| Deployment | Vercel | Serverless hosting |

## 4. Project Structure

The project follows a layered architecture pattern:

```
/organicfabric
  /src
    /core           # Business logic orchestration
    /adapters       # External service integrations
    /pipelines      # Content processing workflows
    /config         # Configuration management
    /db             # Database client setup
  /api
    /cron           # Vercel serverless endpoints
  /prisma
    schema.prisma   # Database schema definition
```

### 4.1 Core Layer

Responsible for job orchestration, state management, and cross-cutting concerns.

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| job-runner.ts | Orchestrates job execution through pipeline stages | runJob(jobId: string) |
| state.ts | Manages job lifecycle and state transitions | createJob(...), updateJobStatus(...) |
| logger.ts | Centralized logging interface | logger object with info/error methods |
| errors.ts | Custom error types for domain-specific failures | IntegrationError class |

### 4.2 Adapters Layer

Encapsulates communication with external services.

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| drive.ts | Google Drive API operations | listNewFiles(), renameFile(...), getFileContent(...) |
| wordpress.ts | WordPress REST API client | createPost(...), uploadMedia(...) |
| llm-openai.ts | OpenAI content formatting | formatContent(...) |
| image-vertex-imagen.ts | Google Vertex AI image generation | generateImages(...) |

### 4.3 Pipelines Layer

Implements content transformation and processing logic.

| Module | Purpose | Key Exports |
|--------|---------|-------------|
| parse-input.ts | Convert Google Docs/Docx to structured format | parseDocument(...) |
| image-pick.ts | Generate and upload images | generateAndUploadImages(...) |
| format-content.ts | Transform content to WordPress-compatible HTML | renderHtml(...) |
| widgets.ts | Insert WordPress widgets/shortcodes | insertWidgetsIntoHtml(...) |
| sanitize.ts | Clean and validate HTML output | sanitizeHtml(dirtyHtml: string) |

### 4.4 Configuration Layer

Manages application configuration and constants.

| Module | Purpose |
|--------|---------|
| index.ts | Central configuration export |
| widgets.ts | Widget definitions and templates |
| providers.ts | External service provider configurations |

### 4.5 Database Layer

Provides database access through Prisma Client.

| Module | Purpose |
|--------|---------|
| prisma.ts | Singleton Prisma Client instance |

### 4.6 API Layer

Serverless endpoints for Vercel deployment.

| Endpoint | Purpose |
|----------|---------|
| /api/cron/poll-drive.ts | Scheduled task to poll Google Drive for new documents |

## 5. Data Model

The system uses a job-based architecture with artifact storage for intermediate processing results.

### 5.1 Job Entity

Represents a single document processing job.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | String | Unique job identifier | Primary key, CUID |
| fileId | String | Google Drive file identifier | Required |
| revisionId | String | Document revision identifier | Required |
| status | String | Current job state | Required, enum-like |
| errorCode | String | Error classification if failed | Nullable |
| errorMessage | String | Detailed error description | Nullable |
| startedAt | DateTime | Job creation timestamp | Default: now() |
| finishedAt | DateTime | Job completion timestamp | Nullable |
| postId | Int | WordPress post ID | Nullable |
| postEditLink | String | WordPress post edit URL | Nullable |
| artifacts | Artifact[] | Related processing artifacts | Relation |

**Unique Constraint**: (fileId, revisionId) - prevents duplicate processing of the same document revision.

### 5.2 Job Status Flow

The job progresses through defined states:

1. **NEW** - Job created, awaiting processing
2. **CLAIMED** - Job picked up by worker
3. **IMAGES_PICKED** - Images generated and selected
4. **POST_RENDERED** - Final HTML content prepared
5. **WP_DRAFTED** - Draft created in WordPress
6. **DONE** - Job completed successfully
7. **ERROR** - Job failed with error details

### 5.3 Artifact Entity

Stores intermediate processing results for debugging and recovery.

| Field | Type | Description | Constraints |
|-------|------|-------------|-------------|
| id | String | Unique artifact identifier | Primary key, CUID |
| jobId | String | Parent job reference | Foreign key to Job |
| kind | String | Artifact type identifier | Required |
| content | Json | Artifact data | Required, JSON |
| createdAt | DateTime | Creation timestamp | Default: now() |
| Job | Job | Parent job relation | Relation |

### 5.4 Artifact Types

| Kind | Content Schema | Purpose |
|------|----------------|---------|
| RAW_TEXT | { text: string } | Original parsed document text |
| HTML | { html: string } | Formatted HTML content |
| WIDGET_DECISION | { widgets: Array<{type, position, config}> } | Widget placement decisions |
| IMAGE_META | { images: Array<{url, alt, wpMediaId}> } | Generated image metadata |

## 6. TypeScript Configuration

### 6.1 Compiler Options

| Option | Value | Rationale |
|--------|-------|-----------|
| target | ES2022 | Modern Node.js runtime support |
| module | NodeNext | ESM/CJS interop for Node.js |
| moduleResolution | NodeNext | Proper module resolution |
| strict | true | Maximum type safety |
| esModuleInterop | true | Compatibility with CommonJS modules |
| skipLibCheck | true | Faster compilation |
| forceConsistentCasingInFileNames | true | Cross-platform consistency |
| rootDir | src | Source code location |
| outDir | dist | Compilation output |

## 7. Code Quality Configuration

### 7.1 ESLint Rules

- Extend @typescript-eslint/recommended
- Integrate Prettier for formatting
- Enforce consistent code style
- Detect common TypeScript pitfalls

### 7.2 Prettier Configuration

| Option | Value |
|--------|-------|
| semi | true |
| singleQuote | true |
| tabWidth | 2 |
| trailingComma | es5 |
| printWidth | 100 |

## 8. Environment Configuration

The application requires the following environment variables:

| Variable | Description | Provider |
|----------|-------------|----------|
| DATABASE_URL | PostgreSQL connection string | Vercel Postgres |
| GOOGLE_CLIENT_ID | Google OAuth client ID | Google Cloud Console |
| GOOGLE_CLIENT_SECRET | Google OAuth client secret | Google Cloud Console |
| GOOGLE_REDIRECT_URI | OAuth callback URL | Application URL |
| OPENAI_API_KEY | OpenAI API key | OpenAI Platform |
| VERTEX_PROJECT_ID | Google Cloud project ID | Google Cloud Console |
| VERTEX_LOCATION | Vertex AI region | Google Cloud Console |
| WP_API_URL | WordPress REST API base URL | WordPress site |
| WP_USERNAME | WordPress admin username | WordPress site |
| WP_PASSWORD | WordPress application password | WordPress site |

## 9. Package Dependencies

### 9.1 Production Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| @prisma/client | Latest | Database ORM client |
| googleapis | Latest | Google Drive API |
| axios | Latest | HTTP client for WordPress |
| mammoth | Latest | DOCX to HTML conversion |
| dompurify | Latest | HTML sanitization |
| jsdom | Latest | DOM API for Node.js |
| handlebars | Latest | Template engine |
| dotenv | Latest | Environment configuration |

### 9.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | Latest | TypeScript compiler |
| @types/node | Latest | Node.js type definitions |
| prisma | Latest | Prisma CLI and migrations |
| ts-node | Latest | TypeScript execution |
| eslint | Latest | Code linting |
| @typescript-eslint/parser | Latest | TypeScript ESLint parser |
| @typescript-eslint/eslint-plugin | Latest | TypeScript ESLint rules |
| prettier | Latest | Code formatting |
| eslint-config-prettier | Latest | Disable conflicting ESLint rules |
| eslint-plugin-prettier | Latest | Run Prettier as ESLint rule |

## 10. Build and Development Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| dev | ts-node src/index.ts | Development mode with TypeScript |
| build | tsc | Compile TypeScript to JavaScript |
| start | node dist/index.js | Run production build |
| lint | eslint src --ext .ts | Check code quality |
| format | prettier --write "src/**/*.ts" | Format code |
| db:generate | prisma generate | Generate Prisma Client |
| db:migrate | prisma migrate dev | Run database migrations |
| db:studio | prisma studio | Open Prisma Studio GUI |

## 11. Initial Boilerplate Structure

### 11.1 Core Module Signatures

**job-runner.ts**
- Function: runJob
- Parameters: jobId (string)
- Returns: Promise<void>
- Purpose: Execute all pipeline stages for a job

**state.ts**
- Function: createJob
- Parameters: fileId (string), revisionId (string)
- Returns: Promise<Job>
- Purpose: Initialize new job record

- Function: updateJobStatus
- Parameters: jobId (string), status (string), metadata (object)
- Returns: Promise<Job>
- Purpose: Transition job to new state

**logger.ts**
- Export: logger object
- Methods: info(...args), error(...args), warn(...args), debug(...args)
- Purpose: Structured logging interface

**errors.ts**
- Class: IntegrationError extends Error
- Properties: code (string), service (string), originalError (Error)
- Purpose: Typed error handling for external service failures

### 11.2 Adapter Module Signatures

**drive.ts**
- listNewFiles(): Promise<Array<{id, name, modifiedTime}>>
- renameFile(fileId: string, newName: string): Promise<void>
- getFileContent(fileId: string): Promise<Buffer>

**wordpress.ts**
- createPost(title: string, content: string, status: string): Promise<{id, editLink}>
- uploadMedia(fileBuffer: Buffer, filename: string): Promise<{id, url}>

**llm-openai.ts**
- formatContent(rawText: string, instructions: string): Promise<string>

**image-vertex-imagen.ts**
- generateImages(prompts: string[]): Promise<Array<{prompt, imageUrl}>>

### 11.3 Pipeline Module Signatures

**parse-input.ts**
- parseDocument(fileBuffer: Buffer, mimeType: string): Promise<{text, rawHtml}>

**image-pick.ts**
- generateAndUploadImages(jobId: string, content: string): Promise<Array<{url, alt, wpMediaId}>>

**format-content.ts**
- renderHtml(rawContent: string, images: Array<any>): Promise<string>

**widgets.ts**
- insertWidgetsIntoHtml(html: string, widgets: Array<any>): Promise<string>

**sanitize.ts**
- sanitizeHtml(dirtyHtml: string): string

### 11.4 Configuration Module Structure

**config/index.ts**
- Export all configuration from widgets.ts and providers.ts

**config/widgets.ts**
- Export: widgets array (empty initially)
- Schema: Array<{name, template, position}>

**config/providers.ts**
- Export: providers object (empty initially)
- Schema: {[key: string]: ProviderConfig}

### 11.5 Database Module Structure

**db/prisma.ts**
- Import PrismaClient from @prisma/client
- Export singleton instance: prisma
- Handle connection lifecycle

### 11.6 API Endpoint Structure

**api/cron/poll-drive.ts**
- Import NextApiRequest, NextApiResponse types
- Export default async handler function
- Trigger job discovery and creation workflow
- Return JSON response with status

## 12. Git Ignore Configuration

The following items must be excluded from version control:

- node_modules/ - dependency installations
- dist/ - compiled output
- .env - environment secrets
- .env.local, .env.*.local - local overrides
- .vercel/ - deployment metadata
- .DS_Store - macOS metadata
- *.log - log files
- .prisma/ - generated Prisma artifacts (if not needed)

## 13. Deployment Considerations

### 13.1 Vercel Configuration

The project is designed for Vercel serverless deployment:

- API routes in /api directory are automatically deployed as serverless functions
- Cron jobs configured via vercel.json
- Environment variables managed through Vercel dashboard
- PostgreSQL database via Vercel Postgres addon

### 13.2 Database Migrations

- Prisma migrations stored in prisma/migrations/
- Run migrations during deployment via build hook
- Use shadow database for migration validation in development

## 14. Implementation Steps

### Step 1: Initialize Package Configuration
Create package.json with all specified dependencies and scripts.

### Step 2: Configure TypeScript
Create tsconfig.json with compiler options for modern Node.js targeting ES2022 with strict type checking.

### Step 3: Configure Code Quality Tools
Create .eslintrc.js and .prettierrc.json with TypeScript-compatible rules.

### Step 4: Define Database Schema
Create prisma/schema.prisma with Job and Artifact models, PostgreSQL provider configuration.

### Step 5: Create Directory Structure
Establish all directories: src/core, src/adapters, src/pipelines, src/config, src/db, api/cron.

### Step 6: Generate Boilerplate Files
Create all TypeScript files with empty function exports matching the signatures defined in section 11.

### Step 7: Configure Git
Create .gitignore with patterns for node_modules, dist, .env, .vercel, and other generated artifacts.

### Step 8: Install Dependencies
Execute npm install to download and install all packages.

### Step 9: Generate Prisma Client
Run prisma generate to create type-safe database client.

### Step 10: Verify Compilation
Run TypeScript compiler in check mode to ensure all boilerplate compiles without errors.

## 15. Success Criteria

The project setup is complete when:

1. All configuration files are created and valid
2. All dependencies are installed without conflicts
3. Directory structure matches the defined architecture
4. All boilerplate files exist with proper TypeScript exports
5. Project compiles successfully with tsc --noEmit
6. ESLint and Prettier run without errors
7. Prisma schema is valid and client is generated
8. Git repository is initialized with proper ignore rules

## 16. Next Steps

After initial setup, the following development phases will proceed:

1. Implement Google Drive authentication and polling logic
2. Build document parsing pipeline with mammoth integration
3. Integrate OpenAI for content formatting
4. Implement Vertex AI image generation
5. Build WordPress posting logic
6. Configure Vercel cron job scheduling
7. Add error handling and retry mechanisms
8. Implement logging and monitoring
9. Create deployment configuration for Vercel
- generateAndUploadImages(jobId: string, content: string): Promise<Array<{url, alt, wpMediaId}>>

**format-content.ts**
- renderHtml(rawContent: string, images: Array<any>): Promise<string>

**widgets.ts**
- insertWidgetsIntoHtml(html: string, widgets: Array<any>): Promise<string>

**sanitize.ts**
- sanitizeHtml(dirtyHtml: string): string

### 11.4 Configuration Module Structure

**config/index.ts**
- Export all configuration from widgets.ts and providers.ts

**config/widgets.ts**
- Export: widgets array (empty initially)
- Schema: Array<{name, template, position}>

**config/providers.ts**
- Export: providers object (empty initially)
- Schema: {[key: string]: ProviderConfig}

### 11.5 Database Module Structure

**db/prisma.ts**
- Import PrismaClient from @prisma/client
- Export singleton instance: prisma
- Handle connection lifecycle

### 11.6 API Endpoint Structure

**api/cron/poll-drive.ts**
- Import NextApiRequest, NextApiResponse types
- Export default async handler function
- Trigger job discovery and creation workflow
- Return JSON response with status

## 12. Git Ignore Configuration

The following items must be excluded from version control:

- node_modules/ - dependency installations
- dist/ - compiled output
- .env - environment secrets
- .env.local, .env.*.local - local overrides
- .vercel/ - deployment metadata
- .DS_Store - macOS metadata
- *.log - log files
- .prisma/ - generated Prisma artifacts (if not needed)

## 13. Deployment Considerations

### 13.1 Vercel Configuration

The project is designed for Vercel serverless deployment:

- API routes in /api directory are automatically deployed as serverless functions
- Cron jobs configured via vercel.json
- Environment variables managed through Vercel dashboard
- PostgreSQL database via Vercel Postgres addon

### 13.2 Database Migrations

- Prisma migrations stored in prisma/migrations/
- Run migrations during deployment via build hook
- Use shadow database for migration validation in development

## 14. Implementation Steps

### Step 1: Initialize Package Configuration
Create package.json with all specified dependencies and scripts.

### Step 2: Configure TypeScript
Create tsconfig.json with compiler options for modern Node.js targeting ES2022 with strict type checking.

### Step 3: Configure Code Quality Tools
Create .eslintrc.js and .prettierrc.json with TypeScript-compatible rules.

### Step 4: Define Database Schema
Create prisma/schema.prisma with Job and Artifact models, PostgreSQL provider configuration.

### Step 5: Create Directory Structure
Establish all directories: src/core, src/adapters, src/pipelines, src/config, src/db, api/cron.

### Step 6: Generate Boilerplate Files
Create all TypeScript files with empty function exports matching the signatures defined in section 11.

### Step 7: Configure Git
Create .gitignore with patterns for node_modules, dist, .env, .vercel, and other generated artifacts.

### Step 8: Install Dependencies
Execute npm install to download and install all packages.

### Step 9: Generate Prisma Client
Run prisma generate to create type-safe database client.

### Step 10: Verify Compilation
Run TypeScript compiler in check mode to ensure all boilerplate compiles without errors.

## 15. Success Criteria

The project setup is complete when:

1. All configuration files are created and valid
2. All dependencies are installed without conflicts
3. Directory structure matches the defined architecture
4. All boilerplate files exist with proper TypeScript exports
5. Project compiles successfully with tsc --noEmit
6. ESLint and Prettier run without errors
7. Prisma schema is valid and client is generated
8. Git repository is initialized with proper ignore rules

## 16. Next Steps

After initial setup, the following development phases will proceed:

1. Implement Google Drive authentication and polling logic
2. Build document parsing pipeline with mammoth integration
3. Integrate OpenAI for content formatting
4. Implement Vertex AI image generation
5. Build WordPress posting logic
6. Configure Vercel cron job scheduling
7. Add error handling and retry mechanisms
8. Implement logging and monitoring
9. Create deployment configuration for Vercel
10. Write integration tests for critical paths- parseDocument(fileBuffer: Buffer, mimeType: string): Promise<{text, rawHtml}>
**image-pick.ts**

