# Organic Fabric - Google Docs to WordPress Automation

Automated system for processing Google Docs/Docx files and publishing them to WordPress with AI-generated images.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Google Cloud account (for Drive API and Vertex AI)
- OpenAI API key
- WordPress site with REST API enabled

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Generate Prisma Client:**
   ```bash
   npm run db:generate
   ```

4. **Run database migrations:**
   ```bash
   npm run db:migrate
   ```

## 📁 Project Structure

```
/organicfabric
├── /src
│   ├── /core              # Business logic orchestration
│   │   ├── job-runner.ts  # Job orchestrator
│   │   ├── state.ts       # State management
│   │   ├── logger.ts      # Logging utilities
│   │   └── errors.ts      # Custom error types
│   ├── /adapters          # External service integrations
│   │   ├── drive.ts       # Google Drive API
│   │   ├── wordpress.ts   # WordPress REST API
│   │   ├── llm-openai.ts  # OpenAI integration
│   │   └── image-vertex-imagen.ts  # Vertex AI images
│   ├── /pipelines         # Content processing
│   │   ├── parse-input.ts # Document parsing
│   │   ├── image-pick.ts  # Image generation
│   │   ├── format-content.ts  # HTML formatting
│   │   ├── widgets.ts     # Widget insertion
│   │   └── sanitize.ts    # HTML sanitization
│   ├── /config            # Configuration management
│   │   ├── index.ts       # Config exports
│   │   ├── widgets.ts     # Widget definitions
│   │   └── providers.ts   # Provider configs
│   ├── /db                # Database access
│   │   └── prisma.ts      # Prisma Client
│   └── index.ts           # Application entry
├── /api
│   └── /cron
│       └── poll-drive.ts  # Vercel cron endpoint
└── /prisma
    └── schema.prisma      # Database schema
```

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Compile TypeScript to JavaScript
- `npm start` - Run production build
- `npm run lint` - Check code quality
- `npm run format` - Format code with Prettier
- `npm run db:generate` - Generate Prisma Client
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio GUI

### Database Schema

The system uses two main models:

**Job** - Represents a document processing job
- Tracks status: NEW → CLAIMED → IMAGES_PICKED → POST_RENDERED → WP_DRAFTED → DONE/ERROR
- Stores job metadata and WordPress post information

**Artifact** - Stores intermediate processing results
- Types: RAW_TEXT, HTML, WIDGET_DECISION, IMAGE_META
- Used for debugging and recovery

## 🌐 Deployment

### Vercel Deployment

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Configure environment variables in Vercel dashboard**

3. **Deploy:**
   ```bash
   vercel
   ```

### Environment Variables

Required environment variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `OPENAI_API_KEY` - OpenAI API key
- `VERTEX_PROJECT_ID` - Google Cloud project ID
- `WP_API_URL` - WordPress REST API URL
- `WP_USERNAME` - WordPress username
- `WP_PASSWORD` - WordPress application password

## 🏗️ Architecture

### Job Processing Pipeline

1. **Poll Drive** - Cron job discovers new documents
2. **Parse Input** - Convert document to structured format
3. **Image Generation** - Create images using Vertex AI
4. **Format Content** - Transform to WordPress HTML
5. **Widget Insertion** - Add widgets/shortcodes
6. **Sanitize** - Clean and validate HTML
7. **WordPress Publish** - Create draft in WordPress

### State Machine

Jobs progress through defined states with artifact storage at each stage for debugging and recovery.

## 📝 Next Steps

After initial setup, implement:

1. Google Drive authentication and polling
2. Document parsing with mammoth
3. OpenAI content formatting
4. Vertex AI image generation
5. WordPress posting logic
6. Vercel cron configuration
7. Error handling and retry mechanisms
8. Monitoring and logging
9. Integration tests

## 📄 License

ISC
