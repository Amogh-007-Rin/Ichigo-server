# Backend Requirements & Implementation Instructions
## ASCIIfy — Backend Specification

---

## 1. Overview

ASCIIfy is a media conversion + social platform. The backend must handle:
- Auth & user management
- Media upload, processing, and storage
- Real-time ASCII conversion for images
- Async video processing pipeline
- Social features (gallery, likes, saves, follows, comments)
- Export generation (PNG, GIF, MP4, HTML, TXT)
- Freemium subscription & plan enforcement

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | **Node.js 20 LTS** | Async I/O, rich ecosystem |
| Framework | **Fastify** | Faster than Express, schema validation built-in |
| Language | **TypeScript** | Type safety across the codebase |
| Database | **PostgreSQL 16** | Relational data, full-text search, JSONB for metadata |
| ORM | **Prisma** | Type-safe queries, migrations |
| Cache / Queue | **Redis 7** | Session cache, job queues, rate limiting |
| Job Queue | **BullMQ** (on Redis) | Video processing, export jobs |
| File Storage | **AWS S3 / Cloudflare R2** | Original uploads + processed outputs |
| CDN | **Cloudflare CDN** | Fast global delivery of ASCII renders |
| Auth | **JWT + Refresh Tokens** | Stateless, scalable |
| Email | **Resend** | Transactional emails |
| Payments | **Stripe** | Subscriptions + webhooks |
| Container | **Docker + Docker Compose** | Local dev parity |
| CI/CD | **GitHub Actions** | Automated test + deploy |

---

## 3. Folder Structure

```
backend/
├── src/
│   ├── config/             # Env, constants, plan limits
│   ├── modules/
│   │   ├── auth/           # Register, login, refresh, OAuth
│   │   ├── users/          # Profile, settings, follow system
│   │   ├── media/          # Upload, conversion, export
│   │   ├── gallery/        # Public feed, pins, board system
│   │   ├── social/         # Likes, saves, comments, follows
│   │   ├── subscriptions/  # Stripe plans, webhooks
│   │   └── notifications/  # In-app + email notifications
│   ├── workers/
│   │   ├── videoProcessor.ts
│   │   └── exportGenerator.ts
│   ├── lib/
│   │   ├── ascii/          # Core ASCII conversion engine
│   │   ├── storage/        # S3/R2 abstraction
│   │   ├── redis/          # Cache + queue client
│   │   └── prisma.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── rateLimiter.ts
│   │   └── planEnforcer.ts
│   └── server.ts
├── prisma/
│   └── schema.prisma
├── workers/                # BullMQ worker process (separate)
├── Dockerfile
└── docker-compose.yml
```

---

## 4. Database Schema (Prisma)

```prisma
model User {
  id            String        @id @default(cuid())
  email         String        @unique
  username      String        @unique
  displayName   String?
  avatarUrl     String?
  bio           String?
  passwordHash  String?
  provider      AuthProvider  @default(EMAIL)
  plan          Plan          @default(FREE)
  stripeCustomerId String?    @unique
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  uploads       MediaItem[]
  likes         Like[]
  saves         Save[]
  comments      Comment[]
  followers     Follow[]      @relation("following")
  following     Follow[]      @relation("follower")
  notifications Notification[]
}

model MediaItem {
  id              String        @id @default(cuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  type            MediaType     // IMAGE | VIDEO
  title           String?
  description     String?
  tags            String[]
  isPublic        Boolean       @default(true)

  // Storage
  originalUrl     String        // S3 URL of raw upload
  asciiOutputUrl  String?       // Rendered PNG/GIF/MP4
  htmlOutputUrl   String?       // HTML embed version
  txtOutputUrl    String?       // Raw text version

  // Conversion settings (stored as JSON)
  settings        Json          // { mode, charset, density, colorMode, fontSize, invert, edgeDetect, animSpeed }

  // Stats
  likesCount      Int           @default(0)
  savesCount      Int           @default(0)
  viewsCount      Int           @default(0)
  downloadsCount  Int           @default(0)

  status          ProcessingStatus @default(PENDING)
  errorMessage    String?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  likes           Like[]
  saves           Save[]
  comments        Comment[]
}

model Like {
  id          String    @id @default(cuid())
  userId      String
  mediaItemId String
  user        User      @relation(fields: [userId], references: [id])
  media       MediaItem @relation(fields: [mediaItemId], references: [id])
  createdAt   DateTime  @default(now())

  @@unique([userId, mediaItemId])
}

model Save {
  id          String    @id @default(cuid())
  userId      String
  mediaItemId String
  boardId     String?
  user        User      @relation(fields: [userId], references: [id])
  media       MediaItem @relation(fields: [mediaItemId], references: [id])
  board       Board?    @relation(fields: [boardId], references: [id])
  createdAt   DateTime  @default(now())

  @@unique([userId, mediaItemId])
}

model Board {
  id          String    @id @default(cuid())
  userId      String
  name        String
  description String?
  isPublic    Boolean   @default(true)
  coverUrl    String?
  saves       Save[]
  createdAt   DateTime  @default(now())
}

model Comment {
  id          String    @id @default(cuid())
  userId      String
  mediaItemId String
  body        String
  user        User      @relation(fields: [userId], references: [id])
  media       MediaItem @relation(fields: [mediaItemId], references: [id])
  createdAt   DateTime  @default(now())
}

model Follow {
  followerId  String
  followingId String
  follower    User      @relation("follower", fields: [followerId], references: [id])
  following   User      @relation("following", fields: [followingId], references: [id])
  createdAt   DateTime  @default(now())

  @@id([followerId, followingId])
}

model Notification {
  id          String    @id @default(cuid())
  userId      String
  type        NotifType
  payload     Json
  isRead      Boolean   @default(false)
  user        User      @relation(fields: [userId], references: [id])
  createdAt   DateTime  @default(now())
}

enum AuthProvider { EMAIL GOOGLE GITHUB }
enum Plan { FREE PRO ENTERPRISE }
enum MediaType { IMAGE VIDEO }
enum ProcessingStatus { PENDING PROCESSING DONE FAILED }
enum NotifType { LIKE SAVE COMMENT FOLLOW }
```

---

## 5. Plan Limits & Enforcement

```typescript
// src/config/plans.ts
export const PLAN_LIMITS = {
  FREE: {
    maxFileSizeMB: 10,
    maxUploadsPerMonth: 20,
    maxResolutionPx: 1280,
    videoAllowed: false,
    exportFormats: ['PNG', 'TXT'],
    watermark: true,
  },
  PRO: {
    maxFileSizeMB: 100,
    maxUploadsPerMonth: 500,
    maxResolutionPx: 3840,
    videoAllowed: true,
    exportFormats: ['PNG', 'JPG', 'GIF', 'MP4', 'HTML', 'TXT'],
    watermark: false,
  },
  ENTERPRISE: {
    maxFileSizeMB: 500,
    maxUploadsPerMonth: Infinity,
    maxResolutionPx: Infinity,
    videoAllowed: true,
    exportFormats: ['PNG', 'JPG', 'GIF', 'MP4', 'HTML', 'TXT'],
    watermark: false,
    apiAccess: true,
  },
};
```

Enforce via `planEnforcer.ts` middleware on every upload route — check plan, file size, monthly quota from Redis counter.

---

## 6. Core ASCII Conversion Engine

```
src/lib/ascii/
├── imageToAscii.ts     # Sharp → pixel grid → char mapping
├── videoToAscii.ts     # FFmpeg frame extraction → per-frame imageToAscii
├── charsets.ts         # Built-in + custom character sets
├── colorMapper.ts      # RGB → ANSI / HTML colour span
├── edgeDetector.ts     # Sobel operator for edge mode
└── exportRenderer.ts   # ASCII → PNG (canvas) / HTML / TXT / GIF / MP4
```

### Image Conversion Flow
1. Receive buffer from S3 presigned upload
2. Use **Sharp** to resize to target density grid (e.g. 200 cols × 100 rows)
3. For each pixel: map brightness to ASCII char from chosen charset
4. If colour mode: map RGB to HTML `<span style="color:…">` or ANSI codes
5. If edge detect: apply Sobel filter first, map edges to `|`, `-`, `/`, `\`
6. Return ASCII string + render to PNG via **node-canvas**

### Video Conversion Flow (BullMQ Worker)
1. Upload video to S3, enqueue job with `mediaItemId`
2. Worker: download to `/tmp`, extract frames via **FFmpeg** at target FPS
3. Convert each frame with `imageToAscii.ts`
4. Re-encode frames to MP4 (ASCII video) or GIF via FFmpeg
5. Upload output to S3, update `MediaItem.status = DONE`, notify user via WebSocket

---

## 7. API Routes

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/refresh
GET    /api/auth/me
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/google          (OAuth)
GET    /api/auth/github          (OAuth)
```

### Media
```
POST   /api/media/presign          # Get S3 presigned URL for upload
POST   /api/media                  # Create MediaItem record after upload
GET    /api/media/:id              # Get single item
PUT    /api/media/:id              # Update title/description/tags/settings
DELETE /api/media/:id              # Soft delete
POST   /api/media/:id/convert      # Trigger/re-trigger conversion
GET    /api/media/:id/status       # Poll conversion status
POST   /api/media/:id/export       # Request export in specific format
GET    /api/media/my               # User's own uploads (paginated)
```

### Gallery (Pinterest-style feed)
```
GET    /api/gallery                # Public masonry feed (infinite scroll, cursor-based)
GET    /api/gallery/trending       # Sorted by likes + saves last 7 days
GET    /api/gallery/following      # Feed from followed users
GET    /api/gallery/search         # Full-text search on title/tags
GET    /api/gallery/tags/:tag      # Filter by tag
```

### Social
```
POST   /api/social/like/:mediaId
DELETE /api/social/like/:mediaId
POST   /api/social/save/:mediaId   # Save to board
DELETE /api/social/save/:mediaId
POST   /api/social/comment/:mediaId
DELETE /api/social/comment/:id
GET    /api/social/comments/:mediaId
POST   /api/social/follow/:userId
DELETE /api/social/follow/:userId
```

### Boards
```
GET    /api/boards                 # User's boards
POST   /api/boards
GET    /api/boards/:id
PUT    /api/boards/:id
DELETE /api/boards/:id
GET    /api/boards/:id/items       # Items saved to board
```

### Users
```
GET    /api/users/:username        # Public profile
GET    /api/users/:username/media  # Their public uploads
GET    /api/users/:username/boards # Their public boards
PUT    /api/users/me               # Update own profile
```

### Notifications
```
GET    /api/notifications
PATCH  /api/notifications/read-all
```

### Subscriptions
```
GET    /api/subscriptions/plans
POST   /api/subscriptions/checkout    # Stripe checkout session
POST   /api/subscriptions/portal      # Stripe customer portal
POST   /api/subscriptions/webhook     # Stripe webhook handler
```

---

## 8. Real-time (WebSockets)

Use **Fastify-websocket** for:
- Live conversion progress updates (`conversion:progress`, `conversion:done`, `conversion:failed`)
- New notification delivery
- Live like/save counter updates on gallery items

```typescript
// Event shape example
{ event: 'conversion:done', mediaItemId: 'xxx', outputUrl: 'https://...' }
```

---

## 9. Rate Limiting

Use **Redis** + `@fastify/rate-limit`:

| Endpoint | Free | Pro | Enterprise |
|---|---|---|---|
| Upload | 10/hour | 100/hour | 500/hour |
| Convert | 10/hour | 100/hour | Unlimited |
| Export | 5/hour | 50/hour | Unlimited |
| Gallery read | 200/min | 200/min | 500/min |
| Auth endpoints | 10/15min | 10/15min | 10/15min |

---

## 10. Security Checklist

- [ ] All file uploads validated by MIME type (not just extension) using **file-type** library
- [ ] S3 presigned URLs expire in 5 minutes
- [ ] Uploaded files scanned by **ClamAV** (async) before making public
- [ ] JWT signed with RS256, refresh tokens rotated on each use
- [ ] Passwords hashed with **argon2**
- [ ] CORS locked to frontend domain only
- [ ] All user inputs sanitised with **DOMPurify** on save (for comments/descriptions)
- [ ] SQL injection impossible via Prisma parameterised queries
- [ ] Rate limiting on all public endpoints
- [ ] Stripe webhook signature verified with `stripe.webhooks.constructEvent`
- [ ] Helmet.js security headers on all responses
- [ ] Content moderation queue for reported public posts

---

## 11. Environment Variables

```env
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_REGION=
CLOUDFLARE_R2_ENDPOINT=      # Alternative to S3
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_ENTERPRISE_PRICE_ID=
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
FRONTEND_URL=
PORT=3001
NODE_ENV=
```

---

## 12. Deployment

- **Containerise** backend + BullMQ worker as separate Docker services
- Deploy to **Railway**, **Render**, or **AWS ECS**
- Use **managed PostgreSQL** (Railway, Supabase, or AWS RDS)
- Use **managed Redis** (Upstash or Railway)
- Run DB migrations in CI before deploy: `npx prisma migrate deploy`
- Health check endpoint: `GET /api/health`
- Separate worker Dockerfile — scale independently from API

---

## 13. Testing Strategy

- **Unit tests**: ASCII conversion logic, plan enforcer, charsets — **Vitest**
- **Integration tests**: All API routes with test DB — **Supertest + Vitest**
- **E2E**: Upload → convert → export full flow
- **Load test**: Gallery feed + conversion queue under concurrent users — **k6**
