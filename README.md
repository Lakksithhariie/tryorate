# Orate — Voice-Profile Rephraser

**"Rewrite it like you, on a good day."**

Orate is an AI writing assistant that preserves your unique voice. Unlike generic AI tools that flatten your style, Orate learns how you write and applies that voice to rewrites.

## Architecture

```
┌─────────────────────┐     HTTPS      ┌──────────────────────────────┐
│   Chrome Extension  │ ◄────────────► │   Vercel Serverless API      │
│   (Manifest V3)     │                │   /api/auth/*                │
│                     │                │   /api/samples/*             │
│   • Content Script  │                │   /api/profile/*             │
│   • Popup UI        │                │   /api/rewrite/*             │
│   • Background SW   │                │   /api/user/*                │
└─────────────────────┘                └──────────┬───────────────────┘
                                                  │
                                     ┌─────────────┼─────────────┐
                                     │             │             │
                                     ▼             ▼             ▼
                               ┌──────────┐  ┌──────────┐  ┌──────────┐
                               │ Neon DB  │  │ Groq API │  │ Resend   │
                               │(Postgres)│  │ (LLM)   │  │ (Email)  │
                               └──────────┘  └──────────┘  └──────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Neon PostgreSQL database
- Groq API key
- Resend API key

### 1. Clone and Install

```bash
git clone <repo>
cd orate
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Fill in your environment variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string with `?pgbouncer=true` |
| `JWT_SECRET` | Generate with `openssl rand -hex 32` |
| `GROQ_API_KEY` | From Groq dashboard |
| `RESEND_API_KEY` | From Resend dashboard |
| `EMAIL_FROM` | Verified sender email |
| `FRONTEND_URL` | Your frontend URL |

### 3. Database Setup

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 4. Local Development

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

### 5. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

Or connect your GitHub repo to Vercel for auto-deploy.

### 6. Load Chrome Extension

1. Open Chrome → Extensions → Developer mode ON
2. Click "Load unpacked"
3. Select the `extension/` folder
4. Update `API_BASE_URL` in extension files to your Vercel URL

## API Endpoints

### Authentication
- `POST /api/auth/magic-link` - Request magic link email
- `POST /api/auth/verify` - Verify magic link and get JWT
- `GET /api/auth/me` - Get current user

### Writing Samples
- `POST /api/samples/submit` - Submit text sample
- `POST /api/samples/upload` - Upload DOCX/TXT file

### Voice Profile
- `GET /api/profile` - Get voice profile
- `POST /api/profile/build` - Build profile from samples

### Rewriting
- `POST /api/rewrite` - Rewrite text
- `POST /api/rewrite/feedback` - Submit feedback (accept/edit/reject)

### User Management
- `GET /api/user/export` - Export all user data (GDPR)
- `GET /api/user/account` - Get account info
- `DELETE /api/user/account` - Delete account

### Health
- `GET /api/health` - Health check

## Key Features

- **Magic Link Auth** - Passwordless email authentication
- **Sample Ingestion** - Paste text or upload DOCX/TXT (3-10 samples, min 1500 words)
- **Voice Profile** - AI analyzes your writing style across 30+ dimensions
- **Smart Rewriting** - GPT-OSS 20B/120B via Groq, model selected by token count
- **Feedback Loop** - Accept/edit/reject signals improve your profile
- **GDPR Compliant** - Full data export and deletion

## Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js (Vercel Serverless) |
| ORM | Prisma |
| Database | Neon PostgreSQL |
| NLP | `compromise` + LLM |
| LLM | Groq API (GPT-OSS 20B/120B) |
| Auth | JWT (jose) |
| Email | Resend |
| Validation | Zod |

## Development

### Database Migrations

```bash
# Create migration
npx prisma migrate dev --name <name>

# Apply migrations
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

### Testing

```bash
# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Project Structure

```
orate/
├── api/                    # Vercel serverless functions
│   ├── auth/              # Authentication endpoints
│   ├── samples/           # Sample submission
│   ├── profile/           # Voice profile management
│   ├── rewrite/           # Rewriting and feedback
│   ├── user/              # User management (GDPR)
│   └── health.js          # Health check
├── lib/                   # Shared utilities
│   ├── db.js             # Prisma client
│   ├── auth.js           # JWT handling
│   ├── llm.js            # Groq client
│   ├── email.js          # Resend email
│   ├── text-analysis.js  # NLP with compromise
│   ├── file-parser.js    # DOCX/TXT parsing
│   └── middleware.js     # CORS, auth, errors
├── prisma/
│   └── schema.prisma     # Database schema
├── extension/            # Chrome extension
│   ├── manifest.json
│   ├── popup/
│   ├── content/
│   └── background/
├── vercel.json           # Vercel config
└── package.json
```

## Environment Variables

All required environment variables are documented in `.env.example`.

**Important:** Never commit `.env.local` or any files containing secrets.

## License

MIT

## Support

For issues and questions, visit [tryorate.cc](https://tryorate.cc) or open an issue on GitHub.
