# System Architecture
## ASCIIfy — Tech Stack & Infrastructure

---

## 1. Product Summary

ASCIIfy is a full-stack SaaS platform that converts images and videos into ASCII art, combined with a Pinterest-style social gallery where users can upload, discover, like, save, and download ASCII content. It operates on a freemium model with three tiers: Free, Pro, and Enterprise.

---

## 2. High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│           Next.js 14 App (SSR / SSG / RSC / CSR)            │
│     Browser ←→ WebSocket (Socket.io) for live updates        │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / WSS
┌────────────────────────▼────────────────────────────────────┐
│                      API GATEWAY                             │
│             Cloudflare (WAF + DDoS + CDN)                    │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                    BACKEND LAYER                              │
│              Fastify (Node.js 20 / TypeScript)                │
│          REST API + WebSocket Server (Socket.io)              │
└──────┬──────────────┬────────────────┬──────────────────────┘
       │              │                │
┌──────▼──────┐ ┌─────▼─────┐  ┌──────▼──────┐
│ PostgreSQL  │ │  Redis 7  │  │  BullMQ     │
│ (Primary DB)│ │ (Cache +  │  │  Workers    │
│             │ │  Queues)  │  │  (Video     │
│             │ │           │  │   Processing│
└─────────────┘ └───────────┘  │   + Exports)│
                                └──────┬──────┘
                                       │
                              ┌────────▼────────┐
                              │  FFmpeg + Sharp  │
                              │  (Media Engine) │
                              └────────┬────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────┐
│                    STORAGE LAYER                              │
│      Cloudflare R2 / AWS S3 (Original + Processed Files)     │
│      Cloudflare CDN (Edge delivery of ASCII outputs)         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Full Tech Stack Reference

### Frontend
| Category | Technology | Version |
|---|---|---|
| Framework | Next.js | 14.x (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| UI Library | shadcn/ui | Latest |
| State | Zustand | 4.x |
| Server State | TanStack Query | 5.x |
| Forms | React Hook Form + Zod | 7.x / 3.x |
| Animation | Framer Motion | 11.x |
| Canvas | HTML5 Canvas API | Native |
| WebSocket | Socket.io-client | 4.x |
| Auth Client | next-auth | v5 |
| Upload | react-dropzone | 11.x |
| Masonry | react-masonry-css | 1.x |
| Icons | Lucide React | Latest |
| Fonts | JetBrains Mono, Inter | via next/font |

### Backend
| Category | Technology | Version |
|---|---|---|
| Runtime | Node.js | 20 LTS |
| Framework | Fastify | 4.x |
| Language | TypeScript | 5.x |
| ORM | Prisma | 5.x |
| Database | PostgreSQL | 16.x |
| Cache | Redis | 7.x |
| Queue | BullMQ | 5.x |
| Auth | JWT (RS256) + argon2 | - |
| Email | Resend SDK | Latest |
| Payments | Stripe SDK | Latest |
| WebSocket | Socket.io | 4.x |
| File Validation | file-type | 19.x |
| Security | Helmet.js | 7.x |

### Media Processing
| Category | Technology | Purpose |
|---|---|---|
| Image manipulation | Sharp | Resize, pixel extraction |
| Video processing | FFmpeg (via fluent-ffmpeg) | Frame extraction, encoding |
| Canvas rendering | node-canvas | ASCII → PNG server-side |
| Edge detection | Custom Sobel (TypeScript) | Edge detect mode |
| Client preview | HTML5 Canvas API | Live browser preview |

### Infrastructure & DevOps
| Category | Technology |
|---|---|
| Containers | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| Hosting (Frontend) | Vercel |
| Hosting (Backend) | Railway or Render |
| Hosting (Workers) | Railway (separate service) |
| Database | Supabase PostgreSQL or Railway |
| Redis | Upstash Redis |
| File Storage | Cloudflare R2 (primary) |
| CDN | Cloudflare |
| Monitoring | Sentry (errors) + Grafana (metrics) |
| Logging | Pino (structured JSON logs) |
| Analytics | PostHog (self-hostable) |

---

## 4. Service Architecture

### Services Overview

```
┌─────────────────────────────────────────┐
│  Service           │  Instances          │
├─────────────────────────────────────────┤
│  Next.js Frontend  │  Vercel Edge        │
│  Fastify API       │  1–N (autoscale)    │
│  BullMQ Worker     │  1–N (separate)     │
│  PostgreSQL        │  1 primary + 1 read │
│  Redis             │  1 (Upstash)        │
│  Cloudflare R2     │  Managed            │
└─────────────────────────────────────────┘
```

### Why Separate the Worker?
The BullMQ video processing worker is CPU and I/O intensive (FFmpeg). Running it as a separate Docker service means:
- API server stays responsive under heavy conversion load
- Workers can be scaled independently
- Worker crashes don't affect API availability

---

## 5. Data Flow — Image Conversion

```
User browser
    │
    ├─ 1. POST /api/media/presign
    │       ← { presignedUrl, mediaItemId }
    │
    ├─ 2. PUT file → Cloudflare R2 (direct, no backend)
    │
    ├─ 3. POST /api/media { mediaItemId, settings }
    │       ← { status: 'processing' }
    │
    ├─ 4. Client-side: render live preview on canvas (browser)
    │       (Sharp not used here — pure HTML5 Canvas)
    │
    └─ 5. Server: Sharp processes image in-memory
            → ASCII string generated
            → Render to PNG via node-canvas
            → Upload output to R2
            → Update MediaItem record
            → Return outputUrl to client
```

---

## 6. Data Flow — Video Conversion

```
User browser
    │
    ├─ 1. POST /api/media/presign → upload video to R2
    │
    ├─ 2. POST /api/media → BullMQ job enqueued
    │       ← { status: 'pending', jobId }
    │
    ├─ 3. WebSocket subscription: client listens for jobId events
    │
    └─ 4. Worker picks up job:
            ├─ Download video from R2 to /tmp
            ├─ FFmpeg: extract frames at target FPS
            ├─ Convert each frame to ASCII (imageToAscii)
            ├─ FFmpeg: re-encode ASCII frames → MP4 / GIF
            ├─ Upload outputs to R2
            ├─ Update MediaItem status = DONE
            └─ Emit WebSocket event: conversion:done → client updates UI
```

---

## 7. Storage Architecture

### Cloudflare R2 Bucket Structure
```
asciify-media/
├── originals/
│   └── {userId}/{mediaItemId}/original.{ext}
├── outputs/
│   └── {userId}/{mediaItemId}/
│       ├── ascii.png
│       ├── ascii.gif
│       ├── ascii.mp4
│       ├── ascii.html
│       └── ascii.txt
└── avatars/
    └── {userId}/avatar.{ext}
```

### Why Cloudflare R2?
- Zero egress fees (S3 charges per GB downloaded)
- Native CDN integration
- S3-compatible API (drop-in with AWS SDK)
- Ideal for media-heavy SaaS

---

## 8. Authentication Architecture

```
Registration / Login
    │
    ├─ Email/Password: argon2 hash → stored in DB
    │
    ├─ OAuth: Google / GitHub → next-auth → JWT
    │
    └─ Token flow:
         Access Token:  JWT RS256, 15min TTL, stored in memory
         Refresh Token: opaque random token, 30d TTL, httpOnly cookie
         Rotation: refresh token rotated on every use (prevents theft)
```

---

## 9. Subscription & Plan Architecture

```
User signs up → FREE plan (default)

Upgrade flow:
    │
    ├─ POST /api/subscriptions/checkout
    │       ← Stripe Checkout Session URL
    │
    ├─ User completes payment on Stripe-hosted page
    │
    ├─ Stripe sends webhook → POST /api/subscriptions/webhook
    │       ├─ checkout.session.completed → update User.plan = PRO
    │       ├─ customer.subscription.deleted → downgrade to FREE
    │       └─ invoice.payment_failed → notify user, grace period
    │
    └─ All API routes check User.plan via planEnforcer middleware

Plans:
    FREE:       10MB uploads, images only, 20/month, watermarked exports
    PRO:        100MB uploads, video + images, 500/month, all export formats
    ENTERPRISE: 500MB uploads, unlimited, API access, no watermarks
```

---

## 10. Scalability Plan

### Phase 1 — Launch (0–1k users)
- Single Fastify API instance
- Single BullMQ worker instance
- Supabase PostgreSQL (free tier)
- Upstash Redis (free tier)
- Cloudflare R2 (pay per use)
- Vercel hobby/pro for frontend
- **Estimated monthly cost: ~$20–50**

### Phase 2 — Growth (1k–50k users)
- Fastify API: 2–4 instances behind load balancer (Railway autoscale)
- BullMQ workers: 3–5 instances
- PostgreSQL: dedicated instance + 1 read replica
- Redis: Upstash paid tier
- Add CDN caching for gallery feed responses (60s TTL)
- **Estimated monthly cost: ~$150–400**

### Phase 3 — Scale (50k+ users)
- Move to AWS ECS / Kubernetes
- PostgreSQL: AWS RDS Multi-AZ
- Redis: ElastiCache cluster
- Separate read/write API deployments
- Worker pool autoscales with queue depth
- Add edge caching for gallery with Cloudflare Workers
- **Estimated monthly cost: $800–2000+**

---

## 11. Monitoring & Observability

| Tool | Purpose |
|---|---|
| **Sentry** | Error tracking (frontend + backend) |
| **Pino** | Structured JSON logging in Fastify |
| **Grafana + Prometheus** | API latency, queue depth, conversion times |
| **BullMQ Board UI** | Visual job queue dashboard |
| **Uptime monitoring** | Better Uptime or UptimeRobot |
| **PostHog** | User analytics, funnel tracking, feature flags |
| **Stripe Dashboard** | Revenue, churn, MRR |

### Key Metrics to Track
- Conversion success rate (target > 99%)
- Average image conversion time (target < 2s)
- Average video processing time per minute of video
- Queue depth (alert if > 50 pending jobs)
- API p95 latency (target < 200ms)
- Gallery feed load time (target < 300ms)
- Monthly active users, conversion volume, export downloads
- Free → Pro upgrade conversion rate

---

## 12. Security Architecture

| Layer | Measure |
|---|---|
| Network | Cloudflare WAF, DDoS protection |
| Auth | JWT RS256, argon2 hashing, refresh token rotation |
| Uploads | MIME validation, file-type library, ClamAV async scan |
| Storage | S3 presigned URLs (5min expiry), private bucket |
| API | Helmet.js, CORS locked to frontend domain |
| Rate Limiting | Redis-backed per-IP + per-user limits |
| Database | Prisma parameterised queries, no raw SQL |
| Payments | Stripe webhook signature verification |
| Secrets | Environment variables only, never in code |
| GDPR | Data export endpoint, account deletion, privacy policy |

---

## 13. CI/CD Pipeline

```
GitHub Push → main branch
    │
    ├─ GitHub Actions:
    │   ├─ Install dependencies
    │   ├─ TypeScript type check
    │   ├─ Run Vitest unit + integration tests
    │   ├─ Run ESLint + Prettier check
    │   ├─ Build Docker image (backend)
    │   └─ Deploy:
    │       ├─ Frontend → Vercel (automatic on push)
    │       ├─ Backend → Railway (Docker deploy)
    │       └─ Worker → Railway (Docker deploy)
    │
    └─ Post-deploy:
        ├─ Run Prisma migrations
        └─ Smoke test: GET /api/health → 200 OK
```

---

## 14. Unique Differentiators to Build Towards

These features will set ASCIIfy apart from generic converters:

1. **ASCII Themes** — pre-designed visual styles (Matrix green, Retro amber, Neon RGB, Newspaper greyscale) users can one-click apply
2. **Custom Character Sets** — users define their own character palette and can share/publish them publicly
3. **Animated Wallpaper Mode** — export short video loops as screensaver-ready ASCII animations
4. **Embed Widget** — one-line `<script>` tag to embed an animated ASCII art piece on any website
5. **API Access (Enterprise)** — REST API for developers to integrate ASCII conversion into their own apps
6. **Community Challenges** — weekly themed challenges ("convert a sunset", "ASCII portrait of your pet") with a leaderboard
7. **Collections / Trending Tags** — curated collections by the ASCIIfy team to drive discovery
8. **Download Pack** — bundle all export formats into a single ZIP download

---

## 15. Domain & Launch Checklist

- [ ] Register domain (asciify.art or similar)
- [ ] Set up Cloudflare on domain (DNS + WAF + CDN)
- [ ] Configure R2 bucket with custom domain
- [ ] Set up Stripe account, create products + prices
- [ ] Configure Google & GitHub OAuth apps
- [ ] Set up Resend sending domain + DKIM
- [ ] Configure Sentry projects (frontend + backend)
- [ ] Set up PostHog project
- [ ] Write Privacy Policy + Terms of Service
- [ ] GDPR: cookie consent banner, data export endpoint
- [ ] Launch on Product Hunt + ASCII art communities (Reddit r/ASCII_Art)
