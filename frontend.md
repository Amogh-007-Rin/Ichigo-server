# Frontend Requirements & Implementation Instructions
## ASCIIfy — Frontend Specification

---

## 1. Overview

ASCIIfy's frontend is a responsive web app (desktop-first, fully mobile-friendly) with a Pinterest-style social gallery, a real-time ASCII editor for images, and an async video processing dashboard. It must feel fast, creative, and visually distinctive — the UI itself should carry an ASCII/terminal aesthetic while remaining polished and accessible.

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | SSR for gallery SEO, RSC for speed |
| Language | **TypeScript** | Full type safety |
| Styling | **Tailwind CSS** | Utility-first, fast iteration |
| UI Components | **shadcn/ui** | Accessible, unstyled base components |
| State Management | **Zustand** | Lightweight global state |
| Server State | **TanStack Query v5** | Caching, pagination, optimistic updates |
| Forms | **React Hook Form + Zod** | Validation, type-safe schemas |
| Animation | **Framer Motion** | Page transitions, gallery effects |
| Canvas / Rendering | **Fabric.js** | ASCII preview rendering on canvas |
| WebSockets | **Socket.io-client** | Real-time conversion updates |
| Auth | **next-auth v5** | Session management, OAuth |
| Upload | **react-dropzone + AWS SDK** | Direct-to-S3 presigned upload |
| Masonry Layout | **react-masonry-css** | Pinterest-style grid |
| Icons | **Lucide React** | Consistent icon set |
| Payments | **Stripe.js** | Checkout redirect |

---

## 3. Folder Structure

```
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/
│   │   ├── layout.tsx              # Main app shell with navbar
│   │   ├── page.tsx                # Landing page
│   │   ├── dashboard/page.tsx      # User dashboard
│   │   ├── editor/page.tsx         # ASCII editor
│   │   ├── gallery/page.tsx        # Public Pinterest-style gallery
│   │   ├── gallery/[id]/page.tsx   # Single artwork detail page
│   │   ├── profile/[username]/
│   │   │   ├── page.tsx            # Public profile
│   │   │   └── boards/page.tsx
│   │   ├── boards/page.tsx         # User's own boards
│   │   ├── boards/[id]/page.tsx
│   │   ├── notifications/page.tsx
│   │   └── settings/
│   │       ├── profile/page.tsx
│   │       ├── billing/page.tsx
│   │       └── account/page.tsx
│   └── api/                        # Next.js API routes (auth callbacks only)
├── components/
│   ├── ui/                         # shadcn base components
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── editor/
│   │   ├── UploadZone.tsx
│   │   ├── AsciiCanvas.tsx
│   │   ├── ControlPanel.tsx
│   │   ├── CharsetSelector.tsx
│   │   ├── ColorModeToggle.tsx
│   │   ├── DensitySlider.tsx
│   │   ├── ExportModal.tsx
│   │   └── VideoProgressBar.tsx
│   ├── gallery/
│   │   ├── MasonryGrid.tsx
│   │   ├── ArtCard.tsx
│   │   ├── ArtDetailModal.tsx
│   │   ├── FilterBar.tsx
│   │   └── SearchBar.tsx
│   ├── social/
│   │   ├── LikeButton.tsx
│   │   ├── SaveButton.tsx
│   │   ├── CommentSection.tsx
│   │   ├── ShareMenu.tsx
│   │   └── FollowButton.tsx
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── ProfileGrid.tsx
│   │   └── BoardCard.tsx
│   └── shared/
│       ├── PlanBadge.tsx
│       ├── UpgradePrompt.tsx
│       └── NotificationBell.tsx
├── hooks/
│   ├── useAsciiConverter.ts
│   ├── useUpload.ts
│   ├── useGallery.ts
│   ├── useSocialActions.ts
│   ├── useWebSocket.ts
│   └── useCurrentUser.ts
├── lib/
│   ├── api.ts                      # Typed API client (fetch wrapper)
│   ├── ascii/                      # Client-side ASCII preview engine
│   │   ├── imageToAscii.ts
│   │   └── charsets.ts
│   ├── validators/
│   └── utils.ts
├── stores/
│   ├── editorStore.ts              # Zustand: editor state
│   └── notificationStore.ts
└── types/
    └── index.ts
```

---

## 4. Pages & Features

### 4.1 Landing Page `/`
- Full-screen hero with **animated ASCII art** cycling through example outputs (typewriter effect)
- Tagline, CTA buttons: "Start for free" / "See the gallery"
- Feature highlights: Image conversion, Video conversion, Social gallery, Export formats
- Live demo: allow unauthenticated users to drop an image and get a preview (low-res, watermarked)
- Pricing section (3 tiers: Free / Pro / Enterprise)
- Footer with links

### 4.2 Auth Pages `/login` `/register`
- Clean, minimal forms
- Social login: Google + GitHub
- Email + password with Zod validation
- Password strength indicator on register
- Redirect to `/dashboard` after success

### 4.3 Dashboard `/dashboard`
- Welcome header with user avatar + plan badge
- Quick-action card: "New Conversion" → opens editor
- Stats cards: Total uploads, Likes received, Saves received, This month's usage
- Recent conversions grid (last 6 items with status indicators)
- Usage bar: uploads used / plan limit
- Upgrade CTA if on Free plan

### 4.4 ASCII Editor `/editor`

This is the core feature page. Layout: **left panel (controls) + right panel (canvas preview)**.

#### Upload Zone
- Drag-and-drop or click-to-browse
- Accepts: JPG, PNG, GIF, WEBP, MP4, MOV, AVI
- File size validation against user's plan limit shown inline
- Preview thumbnail after upload

#### Control Panel (left sidebar)
```
[ Mode ]         ● Colour  ○ Black & White
[ Charset ]      Standard | Blocks | Dense | Minimal | Custom ✏
[ Density ]      ━━━━●━━━━━  (slider 10–300 cols)
[ Font Size ]    ━━●━━━━━━━  (slider 6–20px)
[ Edge Detect ]  [ Toggle ]
[ Invert ]       [ Toggle ]
[ Anim Speed ]   ━━━━●━━━━   (video only, FPS 1–30)
```

#### ASCII Canvas (right panel)
- **Images**: Render live in real-time as sliders move — debounced 150ms
- Canvas rendered using `<canvas>` element with monospace font
- Zoom in/out controls
- Copy to clipboard button

#### Video Processing
- Shows upload progress bar
- On submit → triggers API → shows job status with animated progress bar
- WebSocket updates: `0% → 25% → 50% → 100% → Done`
- Preview thumbnail of first frame while processing

#### Export Modal
Triggered by "Export" button — shows format grid:
```
[ PNG Image ]  [ JPG Image ]  [ Animated GIF ]
[ MP4 Video ]  [ HTML Embed ] [ .TXT File    ]
```
Grayed out + lock icon for formats not in user's plan.

#### Save to Gallery
- Title, description, tags input
- Toggle: Public / Private
- Select board (or create new board inline)

---

### 4.5 Gallery `/gallery` — Pinterest-Style

- **Masonry grid** layout (2 cols mobile, 3 cols tablet, 4–5 cols desktop)
- Infinite scroll with TanStack Query `useInfiniteQuery`
- Filter bar: Trending | Latest | Following | Tags
- Search bar with debounced full-text search
- Each **ArtCard** shows:
  - ASCII art preview image
  - Author avatar + username
  - Like count + Save count
  - Hover state: Like ♥ and Save 📌 buttons appear

#### ArtCard Hover Behaviour
```
[ ASCII Preview Image          ]
[ ♥ 142    📌 38    👁 1.2k   ]
[ @username · 2 days ago       ]
```

#### ArtDetailModal (opens on card click — no page navigation)
- Full-size ASCII preview
- Author info + Follow button
- Like / Save / Share actions
- Comment section (threaded, paginated)
- Download button (format selector)
- Settings used (charset, mode, density) displayed as tags
- Related works from same user

---

### 4.6 Profile Page `/profile/[username]`
- Cover image + avatar + display name + bio + follower/following counts
- Follow / Unfollow button
- Tabs: **Creations** | **Boards** | **Liked** | **Saved**
- Masonry grid of their public content
- Board cards with cover image + item count

---

### 4.7 Boards `/boards` and `/boards/[id]`
- Grid of board cards (name, cover, item count)
- Create new board button
- Inside board: masonry grid of saved items, drag to reorder
- Board can be made public/private

---

### 4.8 Notifications `/notifications`
- List view: avatar + action text + time
- Mark all as read
- Click → navigate to relevant content
- Unread badge on bell icon in navbar

---

### 4.9 Settings
- `/settings/profile` — edit display name, bio, avatar, username
- `/settings/billing` — current plan, upgrade button, Stripe portal link, usage stats
- `/settings/account` — change email, password, delete account, connected OAuth providers

---

## 5. Design System & Visual Identity

### Theme — "Terminal meets Modern"
- **Font**: `JetBrains Mono` for ASCII previews, `Inter` for UI
- **Colour Palette**:
  - Background: `#0d0d0d` (near-black)
  - Surface: `#1a1a1a`
  - Border: `#2a2a2a`
  - Accent: `#00ff88` (terminal green — primary CTA)
  - Accent 2: `#ff6b35` (orange — likes, alerts)
  - Text primary: `#f0f0f0`
  - Text secondary: `#888888`
- **Dark mode only** at launch (fits the aesthetic perfectly)
- Subtle scanline texture overlay on hero section
- Glowing border effect on active/hover states using accent colour

### Typography Scale
```
Hero heading:     5xl / 700 / Inter
Section heading:  3xl / 600 / Inter
Card title:       base / 500 / Inter
ASCII preview:    Varies / 400 / JetBrains Mono
Body:             sm / 400 / Inter
Meta/labels:      xs / 400 / Inter
```

### Animations
- Page transitions: fade + slight upward slide (Framer Motion)
- Gallery cards: stagger-in on load (50ms delay per card)
- Like button: heart scale pop
- ASCII canvas changes: smooth transition with 150ms debounce
- Conversion progress: animated progress bar with pulse glow

---

## 6. Client-Side ASCII Engine

For **live image preview** (no server round-trip):

```typescript
// lib/ascii/imageToAscii.ts
export function convertToAscii(
  imageData: ImageData,
  options: {
    charset: string[];
    density: number;
    colorMode: 'color' | 'bw';
    invert: boolean;
    edgeDetect: boolean;
    fontSize: number;
  }
): AsciiFrame {
  // 1. Resize imageData to density × auto-height grid
  // 2. For each cell: average pixel brightness
  // 3. Map brightness (0–255) → charset index
  // 4. If edgeDetect: apply Sobel before mapping
  // 5. If colorMode='color': extract dominant RGB per cell
  // 6. Return { chars: string[][], colors: string[][] | null }
}
```

Render the output to `<canvas>` using `fillText` per character with optional colour fills.

---

## 7. State Management

### Zustand Editor Store
```typescript
interface EditorStore {
  file: File | null;
  mediaType: 'image' | 'video' | null;
  settings: ConversionSettings;
  asciiOutput: AsciiFrame | null;
  jobStatus: 'idle' | 'uploading' | 'processing' | 'done' | 'error';
  jobProgress: number;
  setFile: (file: File) => void;
  updateSettings: (partial: Partial<ConversionSettings>) => void;
  setJobStatus: (status, progress?) => void;
}
```

### TanStack Query Keys
```typescript
['gallery', filters]           // Infinite gallery feed
['gallery', 'item', id]        // Single item
['profile', username]          // User profile
['board', id]                  // Board items
['notifications']              // User notifications
['user', 'me']                 // Current user
```

---

## 8. Upload Flow (Direct to S3)

```typescript
// hooks/useUpload.ts
async function uploadFile(file: File) {
  // 1. POST /api/media/presign → { uploadUrl, mediaItemId }
  // 2. PUT file directly to S3 presigned URL (no backend bandwidth cost)
  // 3. POST /api/media with mediaItemId + settings → triggers conversion
  // 4. Subscribe to WebSocket for progress (video) or poll status (image)
}
```

Show upload progress via `XMLHttpRequest` progress event.

---

## 9. Responsive Breakpoints

| Breakpoint | Layout |
|---|---|
| < 640px (mobile) | Single column gallery, stacked editor panels, bottom nav |
| 640–1024px (tablet) | 2-col gallery, side-by-side editor |
| > 1024px (desktop) | 4–5 col gallery, 3-panel editor |

Mobile navigation: bottom tab bar with icons (Home, Gallery, Editor, Profile, Notifications)

---

## 10. SEO & Performance

- Gallery page: **SSR** via Next.js for indexable ASCII art content
- Individual artwork pages: **SSG + ISR** (revalidate: 60s) for fast loads
- `next/image` for all thumbnails with lazy loading
- ASCII preview images served from CDN
- Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, INP < 200ms
- `<meta og:image>` dynamically generated for each artwork for social sharing previews
- Sitemap auto-generated for public gallery pages

---

## 11. Key Environment Variables

```env
NEXT_PUBLIC_API_URL=
NEXT_PUBLIC_WS_URL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
```

---

## 12. Accessibility

- All interactive elements keyboard navigable
- Focus rings visible (use accent colour)
- `aria-label` on all icon-only buttons
- Gallery images include descriptive `alt` text (auto-generated from title + tags)
- Reduced motion: skip Framer Motion animations if `prefers-reduced-motion`
- Colour contrast: all text meets WCAG AA (4.5:1 minimum)
