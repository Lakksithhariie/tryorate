# ORATE — Product Requirements Document

**Voice-Profile Rephraser** — *"Rewrite it like you, on a good day."*

Version 2.0 · February 2026 · tryorate.cc

> **What changed in v2.0:** The backend has been migrated from Python/FastAPI on Railway to JavaScript serverless functions on Vercel. This PRD reflects the new architecture, updated dependencies, revised deployment workflow, and adjusted tasks. All product-facing requirements (features, quality bar, acceptance criteria) remain unchanged — the migration is an infrastructure change, not a product change.

---

## Table of Contents

1. Master Context
2. Problem & Goals
3. Requirements
4. Solution Space & Constraints
5. Design System Appendix
6. Plan & Architecture Notes
7. Tasks (Ordered)
8. Acceptance Criteria & QA
9. Appendix A — Migration Changelog (v1.1 → v2.0)

---

## 1) Master Context

### Product Principles

- **Voice First** — Every feature we build must protect and amplify the writer's unique voice. If a feature flattens voice, it doesn't ship.
- **Writer Over Writing** — We serve the person, not the text. Orate exists to make writers more confident, not more dependent.
- **Show the Why** — Every suggestion comes with a reason. We never change text silently or without the writer understanding the rationale.
- **Recognize, Don't Impress** — The target emotion after a rewrite is recognition ("that's what I meant"), not awe ("that's better than I could do").
- **Earn Trust Gradually** — The tool gets better the more someone uses it. We never pretend to know a writer's voice before we've learned it.

### Voice & Tone (Product Communication)

Orate speaks like a thoughtful colleague — direct, warm, never condescending. We avoid jargon, AI hype language ("revolutionary", "cutting-edge"), and anything that sounds like marketing copy. In error states and empty states, we're honest and human. We never blame the user.

### Quality Bar

| Metric | Target | Notes |
|---|---|---|
| Rewrite latency | < 2s for ≤ 200 tokens; < 4s for > 200 tokens | Measured end-to-end from Vercel function invocation to response |
| Voice fidelity | 7/10 pilot users cannot distinguish Orate rewrite from writer's own revision | Blind A/B test |
| Availability | 99.5% uptime for backend API | Vercel's SLA covers infrastructure; Groq uptime is the primary variable |
| Cold start | Usable voice profile from 3 writing samples totaling ≥ 1,500 words | Profile generation ≤ 30s |
| Function cold start | < 500ms for serverless function initialization | Prisma client init is the bottleneck; monitor via Vercel Analytics |

### Risk & Compliance Guardrails

- **Data isolation** — A user's writing samples, voice profiles, and rewrite history are never used to train shared models or improve other users' profiles. Each user's data exists in strict isolation.
- **Encryption** — All data encrypted in transit (TLS 1.3) and at rest (AES-256 via Neon DB's built-in encryption).
- **No storage of plaintext beyond purpose** — Writing samples are stored only for the purpose of building and refining the voice profile. Users can delete all their data at any time, and deletion is permanent and immediate.
- **Content policy** — Orate does not generate new content from scratch. It rewrites user-provided text. This boundary is fundamental to the product and must be maintained.
- **Third-party AI** — All LLM inference is routed through Groq's API. We comply with Groq's Terms of Service and OpenAI's open-weight model license (Apache-2.0 for GPT-OSS). User text sent to Groq is covered by Groq's data processing agreement — Groq does not train on API inputs.
- **Serverless data handling** — Vercel serverless functions are stateless and ephemeral. No user data persists in function memory between invocations. All persistent data lives exclusively in Neon DB.

---

## 2) Problem & Goals

### Problem Statement

Today's AI writing tools — Quillbot, Wordtune, Grammarly, Hemingway, and others — share a fundamental flaw: they rewrite text into a generic, homogenized style that erases the writer's voice. Writers consistently report that AI-polished text "sounds like a college admissions essay" and "completely flattens my tone." The result is a paradox: tools designed to help writers express themselves actually make every writer sound the same.

Beyond voice erasure, these tools create a dependency loop. Writers lose confidence in their own abilities, feel ethical anxiety about using AI, and spend significant time manually "de-AI-ing" the output to make it sound human again. The manual loop of generate → humanize → feel guilty is the exact workflow Orate replaces.

There is no tool on the market that learns an individual writer's style and constrains its rewrites to stay within that style. This is the gap Orate fills.

### Target Users

**Primary Segment — Professional Content Writers**
Journalists, content marketers, copywriters, and communications professionals who write daily and have a developed personal style they want to maintain.

**Secondary Segment — Academic Writers**
Researchers, graduate students, and professors who need to polish drafts while preserving their scholarly voice and disciplinary conventions.

**Tertiary Segment — Non-Native English Writers**
Professionals who think in another language but write in English. They want grammar and fluency improvements without having their cultural voice patterns overwritten.

### Success Metrics

| Metric | Target | Measurement Method | Timeline |
|---|---|---|---|
| Voice Fidelity Score | ≥ 70% pass rate | Pilot users rate rewrites in blind A/B test (Orate vs. generic) | End of pilot (Week 12) |
| Rewrite Acceptance Rate | ≥ 55% accepted without further edits | Tracked in-product via accept / edit / reject actions | Ongoing from Week 9 |
| Rewrite Latency (p95) | < 2s for ≤ 200 tokens; < 4s for > 200 tokens | Server-side latency logging via Vercel Analytics | Ongoing from Week 7 |
| Profile Improvement Rate | ≥ 10% increase in acceptance rate over first 30 days of use | Cohort analysis comparing Week 1 vs. Week 4 acceptance rates | Week 12+ |
| Pilot Retention | ≥ 60% weekly active after 4 weeks | DAU/WAU tracking | Week 8–12 |
| NPS (Pilot Group) | ≥ 40 | In-product survey at Week 6 and Week 12 | Week 6, Week 12 |
| Deployment Success Rate | 100% of git pushes deploy without manual intervention | Vercel deployment logs | Ongoing |

---

## 3) Requirements

### Functional Requirements

#### FR-1: Writing Sample Ingestion

- User can paste or upload 3–10 writing samples during onboarding.
- Accepted formats: plain text pasted directly, .txt files, .docx files.
- Minimum total word count across all samples: 1,500 words. The system validates this before proceeding.
- Samples are stored per-user in Neon DB (as a JSONB array in the voice_profiles table) and associated with a single voice profile.
- User can add additional samples at any time after onboarding to refine their profile.
- User can view and delete individual samples from their profile settings.
- File upload size limit: 4.5 MB per file (Vercel serverless body size limit).

#### FR-2: Voice Profile Generation

- Upon sample submission, the system extracts structural features via the `compromise` NLP library (sentence length distribution, punctuation patterns, paragraph structure, vocabulary metrics).
- The system sends samples to GPT-OSS 20B via Groq for stylistic analysis (tone, warmth, humor, formality, vocabulary richness, rhetorical patterns). The LLM prompt also requests structural observations (syntactic complexity, sentence-start patterns, POS tendencies) to supplement the `compromise` output.
- The combined output is a structured voice profile stored as a JSONB object with 30–40 style dimensions.
- Profile generation completes within 30 seconds of sample submission.
- A plain-language profile summary is displayed to the user (e.g., "You tend toward short, direct sentences. You avoid jargon. You use dry humor sparingly.").
- The user can review and adjust the summary — flagging dimensions that feel inaccurate, which feeds back into the profile.

#### FR-3: Text Selection & Rewrite Trigger

- The Chrome extension injects a content script that detects text selection on any webpage.
- When the user selects text and clicks the Orate icon (or uses the keyboard shortcut Ctrl/Cmd+Shift+O), the selected text is sent to the backend for rewriting.
- The extension UI displays a compact panel near the selection showing the rewrite result.
- Maximum input length per rewrite: 1,000 tokens. Longer selections show a truncation warning.

#### FR-4: Voice-Constrained Rewriting

- The rewrite service constructs a prompt containing: (a) the user's voice profile as system-level constraints, (b) 2–3 few-shot examples drawn from the user's own writing samples, (c) the selected text as the passage to rewrite.
- The service routes to GPT-OSS 20B for inputs ≤ 200 tokens and GPT-OSS 120B for inputs > 200 tokens.
- The model returns a single rewrite (not multiple options) that adheres to the voice profile constraints.
- The rewrite preserves the original meaning and factual content — it changes how something is said, not what is said.
- Rewrite results are displayed with a diff view highlighting what changed.

#### FR-5: User Actions on Rewrite

- **Accept:** The rewrite replaces the original text in the page (where technically possible) or is copied to clipboard.
- **Edit:** The user can modify the rewrite inline before accepting. The diff between the AI rewrite and the user's edit is logged.
- **Reject:** The rewrite is dismissed. The original text remains unchanged.
- All three actions are logged as feedback signals for profile refinement.

#### FR-6: Feedback-Driven Profile Refinement

- Every rewrite event is stored: original text, generated rewrite, user action (accept/edit/reject), and if edited, the user's final version.
- A background process analyzes accumulated feedback and updates the voice profile. In the serverless architecture, this runs as a Vercel Cron Job (or is triggered inline during profile retrieval when sufficient new feedback exists).
- The update logic: edits carry the strongest signal (they show exactly how the user wants to adjust the output). Rejections signal misalignment. Acceptances confirm the current profile is working.
- The profile update frequency: after every 10 feedback events, or every 7 days, whichever comes first.

#### FR-7: Data Management (GDPR)

- User can export all their data as a JSON file (writing samples, voice profile, rewrite history).
- User can delete all their data permanently with a single action (with confirmation).
- Deletion cascades: removing a user removes all voice profiles and rewrite events via `ON DELETE CASCADE`.

### Non-Functional Requirements

#### NFR-1: Performance

- API response time (p95): < 500ms for non-LLM endpoints (auth, profile retrieval, sample submission).
- LLM endpoints (profile build, rewrite): < 4s p95 end-to-end.
- Vercel function cold start: < 500ms (Prisma client initialization is the primary factor).

#### NFR-2: Scalability

- Serverless functions auto-scale horizontally. No capacity planning required for the compute layer.
- Database connection pooling via Neon's serverless driver or PgBouncer-compatible pooled connection string. Target: support up to 50 concurrent users during pilot without connection exhaustion.

#### NFR-3: Security

- All API endpoints (except /api/health and /api/auth/magic-link and /api/auth/verify) require a valid JWT in the Authorization header.
- JWTs signed with HS256 using a 256-bit secret. Token expiry: 7 days.
- Magic link tokens expire after 10 minutes and are single-use.
- Rate limiting on auth endpoints: 5 magic link requests per email per hour. Implemented via Vercel's Edge Middleware or `@upstash/ratelimit`.
- Input validation on all endpoints using `zod` schema validation.

#### NFR-4: Reliability

- Graceful error handling: all LLM failures return a user-friendly error message, never a stack trace.
- Retry logic: LLM calls retry once on timeout (> 6s). Auth email sends retry once on failure.
- Health check endpoint (`/api/health`) returns 200 with `{ status: "ok" }` for uptime monitoring.

#### NFR-5: Observability

- Structured logging via Vercel's built-in function logs.
- Error tracking via Sentry (with PII scrubbing — strip all writing content from error reports).
- Latency monitoring via Vercel Analytics (available on Pro plan).

---

## 4) Solution Space & Constraints

### Architecture Overview

Orate is a three-component system:

1. **Chrome Extension** (content script + popup) — captures text selections, displays rewrites, collects feedback.
2. **Serverless API** (Vercel Functions) — handles auth, sample processing, profile management, rewriting, and user data operations.
3. **Database** (Neon PostgreSQL) — stores users, voice profiles, and rewrite events.

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
                              │ (Postgres)│  │ (LLM)   │  │ (Email)  │
                              └──────────┘  └──────────┘  └──────────┘
```

### Technology Stack

| Layer | Technology | Replaces (v1.1) | Rationale |
|---|---|---|---|
| Runtime | Node.js (Vercel Serverless) | Python 3.11 (Uvicorn/FastAPI) | Eliminates Docker, port binding, and Railway deployment failures |
| Framework | Vercel Serverless Functions | FastAPI | Zero-config deployment; each route is a standalone function |
| ORM | Prisma | SQLAlchemy 2.0 + Alembic | Declarative schema, type-safe queries, built-in migrations |
| Database | Neon PostgreSQL | Railway PostgreSQL | Vercel-native integration, serverless connection pooling, auto-scaling |
| NLP | `compromise` + LLM | spaCy (en_core_web_sm) | JavaScript-native; 200 KB vs. 500 MB; structural metrics supplemented by LLM |
| LLM Client | `openai` npm package | `openai` Python SDK | Same API shape — points at Groq's OpenAI-compatible endpoint |
| Auth (JWT) | `jose` npm package | `python-jose` | Standard JOSE implementation for Node.js |
| Email | `resend` npm package | Resend Python SDK | Same API, JavaScript client |
| File Parsing | `mammoth` npm package | `python-docx` | DOCX → text extraction |
| Validation | `zod` | Pydantic | Runtime schema validation with TypeScript-like DX |
| Deployment | Vercel (git push) | Railway (Docker build) | Single-command deploy, no container management |

### Why Not Railway (Context for v2.0)

The Python/FastAPI backend was originally deployed on Railway using Docker. Deployment failed repeatedly due to:

1. **$PORT binding mismatch** — Railway injects a dynamic `$PORT` at runtime. The Dockerfile CMD and Uvicorn config failed to read it correctly across multiple remediation attempts.
2. **Competing build configs** — The presence of `railway.toml`, `nixpacks.toml`, and `Dockerfile` in the same directory caused Railway's build system to make unpredictable choices.
3. **Heavy container** — spaCy's `en_core_web_sm` model added ~500 MB to the Docker image, causing slow builds and frequent timeouts.
4. **No local reproducibility** — Railway's runtime environment (port injection, networking) could not be replicated locally, making debugging a push-and-pray cycle.

The decision to migrate was made after exhausting all reasonable remediation options. The migration eliminates Docker, port binding, and the platform split (frontend on Vercel, backend on Railway) in favor of a unified Vercel deployment.

### Database Schema (3 Tables)

The schema is unchanged from v1.1. It is now defined in Prisma's schema language:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                 String         @id @default(uuid())
  email              String         @unique
  magicToken         String?        @map("magic_token")
  magicTokenExpires  DateTime?      @map("magic_token_expires")
  createdAt          DateTime       @default(now()) @map("created_at")
  voiceProfile       VoiceProfile?
  rewriteEvents      RewriteEvent[]

  @@map("users")
}

model VoiceProfile {
  id          String   @id @default(uuid())
  userId      String   @unique @map("user_id")
  samples     Json     @default("[]")
  profileData Json?    @map("profile_data")
  summaryText String?  @map("summary_text")
  updatedAt   DateTime @updatedAt @map("updated_at")
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("voice_profiles")
}

model RewriteEvent {
  id             String   @id @default(uuid())
  userId         String   @map("user_id")
  originalText   String   @map("original_text")
  rewrittenText  String   @map("rewritten_text")
  userAction     String?  @map("user_action")
  userEditedText String?  @map("user_edited_text")
  modelUsed      String?  @map("model_used")
  createdAt      DateTime @default(now()) @map("created_at")
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("rewrite_events")
}
```

#### Column-Level Mapping (Prisma ↔ SQL)

| Prisma Field | SQL Column | Type |
|---|---|---|
| `User.id` | `id` | UUID (PK) |
| `User.email` | `email` | VARCHAR, UNIQUE |
| `User.magicToken` | `magic_token` | VARCHAR, nullable |
| `User.magicTokenExpires` | `magic_token_expires` | TIMESTAMPTZ, nullable |
| `User.createdAt` | `created_at` | TIMESTAMPTZ, default now() |
| `VoiceProfile.id` | `id` | UUID (PK) |
| `VoiceProfile.userId` | `user_id` | UUID (FK → users), UNIQUE |
| `VoiceProfile.samples` | `samples` | JSONB, default '[]' |
| `VoiceProfile.profileData` | `profile_data` | JSONB, nullable |
| `VoiceProfile.summaryText` | `summary_text` | TEXT, nullable |
| `VoiceProfile.updatedAt` | `updated_at` | TIMESTAMPTZ, auto-updated |
| `RewriteEvent.id` | `id` | UUID (PK) |
| `RewriteEvent.userId` | `user_id` | UUID (FK → users) |
| `RewriteEvent.originalText` | `original_text` | TEXT |
| `RewriteEvent.rewrittenText` | `rewritten_text` | TEXT |
| `RewriteEvent.userAction` | `user_action` | VARCHAR(20), nullable |
| `RewriteEvent.userEditedText` | `user_edited_text` | TEXT, nullable |
| `RewriteEvent.modelUsed` | `model_used` | VARCHAR(50), nullable |
| `RewriteEvent.createdAt` | `created_at` | TIMESTAMPTZ, default now() |

### Model Routing Logic

| Input Tokens | Model | Rationale |
|---|---|---|
| ≤ 200 | GPT-OSS 20B | Faster (1,000 tps), cheaper ($0.075/M in), sufficient quality for short passages |
| 201 – 1,000 | GPT-OSS 120B | Higher capability needed for maintaining coherence and voice fidelity across longer text |

### Prompt Architecture

Each rewrite request constructs a prompt with three sections:

**System Prompt** (cacheable via Groq prompt caching):
Contains the voice profile translated into natural-language instructions. Example:

> "You are a rewriting assistant. Your task is to rewrite the user's text while strictly adhering to the following voice profile. Do not add information. Do not change the meaning. Only change how it is expressed.
>
> Voice Profile:
> - Sentence structure: predominantly short declarative sentences (avg 12 words). Occasional compound sentence for rhythm variation.
> - Vocabulary: plain, conversational. Avoids jargon and Latinate words when Anglo-Saxon alternatives exist.
> - Tone: direct and warm. Slight dry humor. Never sarcastic.
> - Paragraph style: leads with the main point. Supporting detail follows.
> - Punctuation: liberal use of em dashes. Rare semicolons. No exclamation marks.
> - Formality: professional but not stiff. Contractions are natural."

**Few-Shot Examples** (cacheable, part of system prompt):
2–3 pairs of (generic text → how this user would say it), constructed from the user's writing samples during profile generation.

**User Prompt** (unique per request):

> "Rewrite the following text in the voice described above. Return only the rewritten text, nothing else.
>
> [selected text here]"

### Dependencies

| Dependency | Version / Plan | Purpose | Risk |
|---|---|---|---|
| Groq API | Developer plan | LLM inference (GPT-OSS 20B + 120B) | Rate limit changes; model deprecation. Mitigated by OpenAI-compatible SDK allowing provider swap. |
| Neon DB | Free → Launch ($19/mo) | Serverless Postgres | Low risk; standard Postgres wire protocol means we can migrate to any Postgres host. |
| Vercel | Hobby (free) → Pro ($20/mo) | Serverless function hosting + deployment | Low risk; functions are standard Node.js — portable to any serverless platform (AWS Lambda, Cloudflare Workers). |
| `compromise` | latest | Lightweight NLP (sentence splitting, POS tagging, structural metrics) | Stable, actively maintained. Less accurate than spaCy for POS — mitigated by LLM supplementation. |
| `openai` (npm) | latest | Groq-compatible LLM client | Official OpenAI SDK; Groq maintains API compatibility. |
| Prisma | latest | ORM + migrations | Widely adopted, stable. Generates optimized SQL. |
| `jose` | latest | JWT sign/verify (HS256) | IETF-standard JOSE implementation. Well-audited. |
| `resend` (npm) | latest | Transactional email (magic links) | Same provider as v1.1, different SDK language. |
| `mammoth` | latest | DOCX → text extraction | Stable, no native dependencies. |
| `zod` | latest | Input validation | De facto standard for JS/TS runtime validation. |
| Chrome Web Store | Manifest V3 | Extension distribution | Policy changes could affect review/approval. We request minimal permissions to reduce risk. |

### Project Structure

```
orate/
├── api/                              # Vercel serverless functions
│   ├── auth/
│   │   ├── magic-link.js             # POST — send magic link email
│   │   ├── verify.js                 # POST — verify token, return JWT
│   │   └── me.js                     # GET  — get current user from JWT
│   ├── samples/
│   │   ├── submit.js                 # POST — submit writing sample text
│   │   └── upload.js                 # POST — upload DOCX/TXT file
│   ├── profile/
│   │   ├── index.js                  # GET  — retrieve voice profile
│   │   └── build.js                  # POST — trigger profile build
│   ├── rewrite/
│   │   ├── index.js                  # POST — rewrite text
│   │   └── feedback.js              # POST — submit feedback
│   ├── user/
│   │   ├── export.js                 # GET  — GDPR data export
│   │   └── account.js               # DELETE — delete account
│   └── health.js                     # GET  — health check
├── lib/                              # Shared utilities
│   ├── db.js                         # Prisma client singleton
│   ├── auth.js                       # JWT create/verify, magic token generation
│   ├── llm.js                        # Groq client (OpenAI SDK)
│   ├── text-analysis.js              # NLP via compromise + LLM prompts
│   ├── email.js                      # Resend email service
│   ├── file-parser.js                # DOCX/TXT extraction
│   └── middleware.js                 # Auth middleware, error handling, CORS
├── prisma/
│   └── schema.prisma                 # Database schema
├── vercel.json                       # Vercel routing config
├── package.json
├── .env.local                        # Local development env vars
└── .env.example                      # Template for required env vars
```

### Environment Variables

| Variable | Description | Source |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL pooled connection string | Neon dashboard or Vercel integration (auto-injected) |
| `JWT_SECRET` | 256-bit secret for HS256 JWT signing | Generate: `openssl rand -hex 32` |
| `GROQ_API_KEY` | Groq API access key | Groq dashboard → API Keys |
| `RESEND_API_KEY` | Resend transactional email API key | Resend dashboard → API Keys |
| `EMAIL_FROM` | Verified sender email address | e.g., `hello@orate.app` (domain verified in Resend) |
| `FRONTEND_URL` | Base URL of the frontend/extension auth flow | e.g., `https://tryorate.cc` |

> **Note:** Unlike Railway, Vercel does **not** require a `PORT` variable. Serverless functions are HTTP handlers invoked by Vercel's routing layer — they never bind to a port.

---

## 5) Design System Appendix

*(Unchanged from v1.1 — the migration does not affect the frontend or extension UI.)*

### Colors

| Token | Value | Usage |
|---|---|---|
| Surface | `#FAFAF9` | Page background |
| Surface Elevated | `#FFFFFF` | Cards, panels |
| Text Primary | `#1A1A2E` | Body text, headings |
| Text Secondary | `#6B7280` | Captions, metadata |
| Accent | `#6C63FF` | CTAs, links, active states |
| Accent Hover | `#5A52E0` | Button hover |
| Success | `#10B981` | Accepted rewrites, positive feedback |
| Warning | `#F59E0B` | Truncation warnings, near-limit states |
| Error | `#EF4444` | Errors, destructive actions |

### Typography

| Element | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | Inter | 24px | 700 |
| Heading 2 | Inter | 18px | 600 |
| Body | Inter | 14px | 400 |
| Caption | Inter | 12px | 400 |
| Code / Diff | JetBrains Mono | 13px | 400 |

### Component Patterns

- **Buttons:** Rounded corners (8px), Accent fill for primary, outlined for secondary. Min height 40px. Disabled state: 50% opacity.
- **Cards:** 1px border (`#E5E7EB`), 12px padding, 8px border-radius. Subtle shadow on hover.
- **Inputs:** 1px border, 8px padding, 4px border-radius. Focus ring: 2px Accent at 30% opacity.
- **Diff View:** Removed text in Accent with strikethrough. Added text with Success background at 15% opacity.
- **Toast Notifications:** Bottom-right, auto-dismiss after 4 seconds. Color-coded by type (success/warning/error).

---

## 6) Plan & Architecture Notes

### Deployment Pipeline

```
Developer pushes to main branch
        │
        ▼
  Vercel detects push (GitHub integration)
        │
        ▼
  Vercel builds the project
  ├── Installs npm dependencies
  ├── Runs `npx prisma generate` (generates Prisma client)
  └── Bundles each /api/*.js file as a serverless function
        │
        ▼
  Vercel deploys to production
  ├── Each API route gets its own Lambda-like function
  ├── Environment variables injected from Vercel dashboard
  └── URL: https://your-project.vercel.app/api/*
        │
        ▼
  Health check: GET /api/health → { "status": "ok" }
```

No Dockerfile. No port binding. No container orchestration. No nixpacks. No railway.toml.

### Connection Pooling Strategy

Serverless functions are ephemeral — each invocation may create a new database connection. Without pooling, this exhausts Neon's connection limit (typically 20–100 depending on plan).

**Solution:** Use Neon's pooled connection string (appends `?pgbouncer=true` to the URL). This routes all connections through Neon's built-in PgBouncer instance, multiplexing many function invocations over a small number of actual database connections.

In `lib/db.js`:

```javascript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;
const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
```

This singleton pattern ensures the Prisma client is reused across warm function invocations (same container), but safely recreated on cold starts.

### NLP Strategy (spaCy Replacement)

The Python backend used spaCy's `en_core_web_sm` for structural text analysis. This is replaced by a two-layer approach:

**Layer 1 — `compromise` (deterministic, local)**

```javascript
import nlp from 'compromise';

function analyzeStructure(text) {
  const doc = nlp(text);
  return {
    sentenceCount: doc.sentences().length,
    avgSentenceLength: /* word count / sentence count */,
    questionCount: doc.questions().length,
    vocabularyRichness: /* unique words / total words */,
    // ... punctuation patterns, paragraph stats
  };
}
```

**Layer 2 — LLM (probabilistic, contextual)**

The style analysis prompt sent to Groq is expanded to include structural observations that spaCy would have provided:

> "Analyze the following writing samples for both style AND structure. For structure, note: average sentence length, sentence-start patterns (e.g., frequently starts with pronouns, conjunctions, or articles), syntactic complexity, punctuation habits (em dashes, semicolons, exclamation marks), and paragraph structure."

This combined approach is lighter (200 KB vs. 500 MB), faster to deploy, and arguably more accurate for voice profiling because the LLM understands context and intent, not just syntax.

### CORS Configuration

If the Chrome extension makes requests from a `chrome-extension://` origin, CORS headers must be set on API responses. This is handled in `lib/middleware.js`:

```javascript
export function cors(handler) {
  return async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    return handler(req, res);
  };
}
```

For production, replace `'*'` with the specific extension origin and frontend URL.

### Vercel Limits (Hobby Plan)

| Limit | Value | Impact |
|---|---|---|
| Function timeout | 10 seconds | Groq calls typically complete in 2–5s. Profile build (multiple LLM calls) may need optimization or Pro plan (60s). |
| Request body size | 4.5 MB | Sufficient for DOCX uploads. |
| Deployments/day | 100 | More than sufficient for development. |
| Bandwidth | 100 GB/month | More than sufficient for API-only traffic. |
| Serverless execution | 100 GB-hours/month | Monitor during pilot; upgrade to Pro if needed. |

---

## 7) Tasks (Ordered)

### Phase 0 — Infrastructure Migration (NEW — Days 1–2)

> **This phase replaces the Railway deployment tasks from v1.1. All subsequent phases are renumbered but functionally unchanged.**

- **T-0.1: Initialize JavaScript project.** Create project directory, `npm init`, install dependencies (`@prisma/client`, `openai`, `resend`, `jose`, `compromise`, `mammoth`, `zod`). Install dev dependencies (`prisma`, `vercel`). Create `.env.example` with all required variables.
- **T-0.2: Set up Neon database.** Create Neon project, obtain pooled connection string. Alternatively, install Neon integration from Vercel marketplace for auto-provisioning.
- **T-0.3: Create Prisma schema and run initial migration.** Write `prisma/schema.prisma` (3 models: User, VoiceProfile, RewriteEvent). Run `npx prisma migrate dev --name init`. Verify tables created in Neon.
- **T-0.4: Create shared utilities (`lib/`).** Implement `db.js` (Prisma singleton), `auth.js` (JWT sign/verify, magic token generation), `llm.js` (Groq client via OpenAI SDK), `email.js` (Resend client), `text-analysis.js` (compromise + LLM analysis), `file-parser.js` (mammoth for DOCX, fs for TXT), `middleware.js` (CORS, auth guard, error handler).
- **T-0.5: Create health check endpoint.** Implement `api/health.js`. Verify it deploys and returns 200 on Vercel.
- **T-0.6: Connect Vercel project to GitHub repo.** Link repo in Vercel dashboard. Set environment variables (DATABASE_URL, JWT_SECRET, GROQ_API_KEY, RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL). Push and verify auto-deploy.

**Exit criteria for Phase 0:** `GET /api/health` returns `{ "status": "ok" }` from a Vercel production URL. Prisma can connect to Neon and run a simple query.

### Phase 1 — Authentication (Days 2–3)

- **T-1: Magic link request endpoint.** Build `POST /api/auth/magic-link`. Accepts `{ email }`. Generates a random token via `crypto.randomUUID()`, stores it in the `users` table with a 10-minute expiry, sends the magic link email via Resend. Validate input with `zod`.
- **T-2: Magic link verification endpoint.** Build `POST /api/auth/verify`. Accepts `{ token }`. Looks up the user by magic_token, checks expiry, nullifies the token (single-use), creates the user if they don't exist, returns a signed JWT (HS256, 7-day expiry).
- **T-3: Current user endpoint.** Build `GET /api/auth/me`. Reads JWT from Authorization header, decodes it, returns user data. This endpoint validates the full auth flow end-to-end.
- **T-4: Auth middleware.** Implement `withAuth(handler)` wrapper in `lib/middleware.js` that extracts and verifies JWT, attaches `req.userId` for downstream use. All protected endpoints wrap their handler with this.

**Exit criteria for Phase 1:** A user can request a magic link, receive an email, click the link, and make authenticated API calls with the returned JWT.

### Phase 2 — Writing Samples & NLP (Days 3–4)

- **T-5: Text sample submission endpoint.** Build `POST /api/samples/submit`. Accepts `{ text }`. Validates minimum word count. Appends to the user's `voice_profiles.samples` JSON array (creates profile record if first sample). Returns updated sample count and total word count.
- **T-6: File upload endpoint.** Build `POST /api/samples/upload`. Accepts multipart form data with a `.docx` or `.txt` file. Uses `mammoth` for DOCX extraction. Validates extracted text length. Appends to samples array.
- **T-7: Text analysis module.** Implement `lib/text-analysis.js`. Uses `compromise` for structural metrics (sentence count, avg length, vocabulary richness, punctuation patterns). Returns a structured analysis object. This replaces the spaCy `text_analysis.py` module.

**Exit criteria for Phase 2:** A user can submit text and upload DOCX/TXT files. Samples are stored correctly. Structural analysis returns consistent metrics.

### Phase 3 — Voice Profile & Rewriting (Days 4–5)

- **T-8: LLM style analysis.** Implement `analyzeStyle()` in `lib/llm.js`. Sends writing samples to Groq with a detailed system prompt requesting stylistic AND structural observations. Parses the response into a structured profile object.
- **T-9: Profile build endpoint.** Build `POST /api/profile/build`. Fetches all samples, runs `compromise` structural analysis, calls `analyzeStyle()` via Groq, merges results into a composite profile, generates a plain-language summary via `generateProfileSummary()`, stores everything in `voice_profiles`.
- **T-10: Profile retrieval endpoint.** Build `GET /api/profile`. Returns the user's current voice profile including summary text, profile data, sample count, and last updated timestamp.
- **T-11: Prompt construction.** Implement `buildRewritePrompt()` in `lib/llm.js`. Assembles the three-part prompt: system prompt (voice profile as constraints), few-shot examples (from writing samples), user prompt (text to rewrite). Implement prompt caching strategy.
- **T-12: Model routing logic.** Implement the token-based router: ≤ 200 input tokens → GPT-OSS 20B, > 200 tokens → GPT-OSS 120B. Log routing decisions. Build fallback: if model errors or times out (> 6s), retry once, then return a clear error.
- **T-13: Rewrite endpoint.** Build `POST /api/rewrite`. Accepts `{ text }`. Fetches user's voice profile, constructs prompt, calls Groq, returns rewrite. Logs the full event to `rewrite_events`. Enforces 1,000-token max input.

**Exit criteria for Phase 3:** A user with a built profile can submit text and receive a voice-matched rewrite. Model routing works correctly. Rewrite events are logged.

### Phase 4 — Feedback Loop (Days 5–6)

- **T-14: Feedback endpoint.** Build `POST /api/rewrite/feedback`. Accepts `{ rewriteEventId, action, editedText? }`. Updates the `rewrite_events` row with `user_action` and `user_edited_text`.
- **T-15: Profile update logic.** Implement feedback-driven profile refinement. Trigger: ≥ 10 feedback events or ≥ 7 days since last update. Analyze patterns in edits and rejections. Re-run style analysis incorporating feedback signals. Update `voice_profiles`. In serverless: run inline during profile retrieval when threshold is met, or as a Vercel Cron Job.
- **T-16: Profile summary display.** Ensure `GET /api/profile` returns the latest summary and `updatedAt` timestamp for the extension to display.

**Exit criteria for Phase 4:** Feedback is recorded. Profile updates trigger correctly after threshold. Updated profiles produce measurably different rewrites.

### Phase 5 — User Management & Polish (Days 6–7)

- **T-17: Data export endpoint.** Build `GET /api/user/export`. Returns all user data as JSON: user record, voice profile (including all samples), all rewrite events.
- **T-18: Account deletion endpoint.** Build `DELETE /api/user/account`. Cascading delete via Prisma (`onDelete: Cascade`) removes user, voice profile, and all rewrite events. Returns confirmation.
- **T-19: Error handling audit.** Review all endpoints for consistent error responses. Ensure: invalid input → 400, unauthorized → 401, not found → 404, server error → 500 with generic message. Never expose stack traces.
- **T-20: Input validation audit.** Ensure all endpoints validate input with `zod` schemas. Reject malformed requests before any database or LLM interaction.
- **T-21: Rate limiting.** Implement rate limiting on auth endpoints (5 requests/email/hour) using `@upstash/ratelimit` with Upstash Redis, or Vercel Edge Middleware.
- **T-22: Monitoring setup.** Configure Sentry for error tracking (with PII scrubbing). Enable Vercel Analytics for latency monitoring. Set up an external uptime monitor (e.g., Better Uptime) pinging `/api/health`.

**Exit criteria for Phase 5:** All GDPR endpoints work. Error handling is consistent. Rate limiting prevents abuse. Monitoring is active.

### Phase 6 — Integration Testing & Launch (Days 7–8)

- **T-23: End-to-end testing.** Test the complete flow: magic link → auth → submit samples → build profile → rewrite → feedback → profile update → data export → account deletion. Test from the Chrome extension against the production Vercel URL.
- **T-24: Chrome extension API URL update.** Update the extension's API base URL from the old Railway URL to the new Vercel URL. If using environment-based config, update the production config.
- **T-25: Performance validation.** Verify rewrite latency meets quality bar (< 2s for ≤ 200 tokens, < 4s for longer). Measure cold start times. Identify any endpoints approaching the 10s Hobby timeout.
- **T-26: Security review.** Verify: JWTs expire correctly, magic tokens are single-use, auth middleware rejects invalid tokens, CORS is properly scoped, no sensitive data in logs.
- **T-27: Pilot deployment.** Deploy to production. Onboard pilot users. Monitor error rates, latency, and user feedback.

---

## 8) Acceptance Criteria & QA

### Acceptance Criteria by Feature

#### AC-1: Writing Sample Ingestion

- GIVEN a user is on the onboarding screen, WHEN they paste text with fewer than 1,500 total words across all samples, THEN the system shows a validation error with the current word count and the minimum required.
- GIVEN a user uploads a .docx file, WHEN the file is processed, THEN the extracted text appears in the sample list with correct content (no formatting artifacts).
- GIVEN a user has 10 samples, WHEN they try to add an 11th, THEN the system shows a limit-reached message.
- GIVEN a user uploads a file larger than 4.5 MB, THEN the system returns a clear error before processing.

#### AC-2: Voice Profile Generation

- GIVEN a user has submitted ≥ 3 samples with ≥ 1,500 total words, WHEN they trigger profile build, THEN a structured profile is generated within 30 seconds.
- GIVEN a profile is generated, WHEN the user views it, THEN a plain-language summary describes their writing style in recognizable terms.
- GIVEN the profile build involves multiple LLM calls, WHEN any single call fails, THEN the system retries once and surfaces a clear error if it fails again.

#### AC-3: Authentication

- GIVEN a valid email address, WHEN the user requests a magic link, THEN they receive an email within 30 seconds containing a clickable link.
- GIVEN a valid magic link token, WHEN the user verifies it within 10 minutes, THEN they receive a JWT and are authenticated.
- GIVEN a magic link token older than 10 minutes, WHEN the user tries to verify it, THEN the system returns a 401 with an expiry message.
- GIVEN a magic link token that has already been used, WHEN someone tries to verify it again, THEN the system returns a 401.
- GIVEN an invalid or missing JWT, WHEN a protected endpoint is called, THEN the system returns a 401.

#### AC-4: Text Rewriting

- GIVEN a user with a built voice profile, WHEN they submit text ≤ 200 tokens, THEN the rewrite uses GPT-OSS 20B and returns within 2 seconds.
- GIVEN a user with a built voice profile, WHEN they submit text between 201–1,000 tokens, THEN the rewrite uses GPT-OSS 120B and returns within 4 seconds.
- GIVEN text longer than 1,000 tokens, WHEN submitted for rewriting, THEN the system returns a 400 error with a truncation message.
- GIVEN a successful rewrite, THEN the response preserves the original meaning while adapting the style to match the voice profile.

#### AC-5: Feedback & Profile Refinement

- GIVEN a rewrite event, WHEN the user accepts/edits/rejects, THEN the action is recorded in the `rewrite_events` table.
- GIVEN ≥ 10 feedback events since the last profile update, WHEN a profile-relevant endpoint is triggered, THEN the profile is updated with feedback incorporated.

#### AC-6: Data Management

- GIVEN an authenticated user, WHEN they request data export, THEN they receive a complete JSON containing their user record, voice profile, and all rewrite events.
- GIVEN an authenticated user, WHEN they delete their account, THEN all associated data (user, profile, events) is permanently removed from the database.
- GIVEN a deleted account, WHEN any API call is made with the old JWT, THEN the system returns a 401.

#### AC-7: Deployment & Infrastructure

- GIVEN a push to the `main` branch, WHEN Vercel detects the change, THEN the project builds and deploys without manual intervention.
- GIVEN a successful deployment, WHEN `/api/health` is called, THEN it returns `{ "status": "ok" }` with a 200 status code.
- GIVEN a serverless function cold start, WHEN measured, THEN initialization completes in < 500ms.
- GIVEN concurrent API requests, WHEN 50 users are active simultaneously, THEN no database connection errors occur (pooling works correctly).

### QA Testing Matrix

| Test Type | Scope | Tool |
|---|---|---|
| Unit tests | `lib/*.js` utilities (auth, text analysis, LLM prompt construction) | Vitest |
| Integration tests | API endpoints (request → response validation) | Vitest + supertest (or direct fetch against local Vercel dev server) |
| E2E tests | Full flow from extension to API | Manual + Playwright (if web UI exists) |
| Load testing | Concurrent users, connection pooling | k6 or Artillery against production |
| Security testing | JWT validation, token expiry, input injection | Manual audit + OWASP ZAP |

---

## 9) Appendix A — Migration Changelog (v1.1 → v2.0)

### What Changed

| Area | v1.1 (Python/Railway) | v2.0 (JavaScript/Vercel) | Reason |
|---|---|---|---|
| Language | Python 3.11 | JavaScript (Node.js) | Eliminates Docker dependency; aligns with frontend ecosystem |
| Framework | FastAPI | Vercel Serverless Functions | Zero-config deployment; no port binding |
| ORM | SQLAlchemy 2.0 + Alembic | Prisma | Declarative schema, built-in migrations, type-safe |
| Database host | Railway PostgreSQL | Neon PostgreSQL | Vercel-native integration, serverless pooling |
| NLP | spaCy (en_core_web_sm) | `compromise` + LLM | JS-native; 200 KB vs. 500 MB; context-aware |
| Deployment | Railway (Docker) | Vercel (git push) | No container management; eliminates $PORT issue |
| Validation | Pydantic | Zod | JS-native equivalent |
| JWT | python-jose | jose (npm) | Same algorithm (HS256), different runtime |
| Email SDK | resend (Python) | resend (npm) | Same service, different language |
| File parsing | python-docx | mammoth | Same capability, JS-native |

### What Did NOT Change

- **Product features:** All functional requirements (FR-1 through FR-7) are identical.
- **Database schema:** Same 3 tables, same columns, same relationships. Only the definition language changed (SQLAlchemy → Prisma).
- **API endpoints:** Same routes, same request/response shapes. Only the implementation language changed.
- **LLM integration:** Same Groq API, same models (GPT-OSS 20B/120B), same prompt architecture. The OpenAI SDK has identical method signatures in Python and JavaScript.
- **Auth flow:** Same magic link → JWT flow. Same token expiry. Same HS256 signing.
- **Quality bar:** Same latency targets, same voice fidelity goals, same availability target.
- **Chrome extension:** Completely unaffected. Only the API base URL changes.

### Decision Record

| Date | Decision | Rationale |
|---|---|---|
| Feb 2026 | Abandon Railway deployment | Persistent $PORT failures after multiple remediation attempts |
| Feb 2026 | Migrate to JavaScript | Eliminate Docker; align with Vercel's native runtime |
| Feb 2026 | Replace spaCy with compromise + LLM | spaCy is Python-only; compromise provides sufficient structural analysis; LLM handles the rest |
| Feb 2026 | Choose Neon over Supabase | Vercel-native integration; serverless pooling; standard Postgres (no vendor lock-in) |
| Feb 2026 | Use Prisma over Drizzle/Knex | Strongest migration tooling; declarative schema; widely adopted |

---

*End of Document*
