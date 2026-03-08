# AI Marketing Platform — Frontend Architecture
# For: Next.js 15 App Router (TypeScript, Tailwind CSS v4, shadcn/ui)

---

## TABLE OF CONTENTS

| # | Section |
|---|---|
| 1 | [Why Next.js 15](#why-nextjs-15) |
| 2 | [Tech Stack](#tech-stack) |
| 3 | [Folder Structure](#folder-structure) |
| 4 | [Design System](#design-system) |
| 5 | [RTL & Arabic Support](#rtl--arabic-support) |
| 6 | [Authentication Flow](#authentication-flow) |
| 7 | [Route Map (All Pages)](#route-map) |
| 8 | [Onboarding Flow](#onboarding-flow) |
| 9 | [Agent Chat](#agent-chat) |
| 10 | [Content Calendar & Generation Pipeline](#content-calendar--generation-pipeline) |
| 11 | [Social Publishing Flow](#social-publishing-flow) |
| 12 | [Billing & Plans Flow](#billing--plans-flow) |
| 13 | [Admin Dashboard](#admin-dashboard) |
| 14 | [API Client Layer](#api-client-layer) |
| 15 | [State Management](#state-management) |
| 16 | [Real-Time (Socket.io)](#real-time-socketio) |
| 17 | [Error Handling & Kill Switch UX](#error-handling--kill-switch-ux) |
| 18 | [Plan Enforcement UX](#plan-enforcement-ux) |
| 19 | [Image Assets — Nano Banana 2 Prompts](#image-assets--nano-banana-2-prompts) |
| 20 | [Environment Variables](#environment-variables) |
| 21 | [Developer Quickstart](#developer-quickstart) |

---

## WHY NEXT.JS 15

Next.js 15 App Router is the only correct choice for this platform. Here is why, mapped to our actual requirements:

| Requirement | How Next.js solves it |
|---|---|
| Auth-protected routes without flash | `middleware.ts` at edge — redirect before paint |
| Dashboard shell stays mounted on navigation | Nested layouts with `layout.tsx` |
| Arabic SSR — no FOUT (Flash of Unstyled Text) | Server Components render with `dir="rtl"` + Cairo font before hydration |
| Content calendar with generated images | `next/image` — automatic WebP, lazy load, blur placeholder |
| Analytics pages need fast initial data | Server Components fetch data before rendering |
| SEO for landing/marketing pages | Static/ISR pages with `generateMetadata()` |
| Agent chat is purely interactive | Client Component — `"use client"` — full Socket.io support |
| Fine-grained loading states | `loading.tsx` per route segment |
| Role-based UI (user vs admin) | Middleware reads JWT claim, redirects admin to `/admin/...` |

---

## TECH STACK

### Core
- **Next.js 15** — App Router (NOT Pages Router)
- **TypeScript** — strict mode, same rules as backend: no `any`, no implicit types
- **Tailwind CSS v4** — utility-first, RTL plugin (`tailwindcss-rtl`)
- **shadcn/ui** — component library built on Radix UI + Tailwind (headless, accessible, RTL-ready)

### Data & State
- **TanStack Query v5** (`@tanstack/react-query`) — server state, caching, background refetch
- **Zustand** — minimal client state (auth user, active brand, UI preferences)
- **Socket.io client** — agent chat streaming, job status updates

### Forms & Validation
- **React Hook Form** — performant forms, no re-renders
- **Zod** — schema validation (mirrors backend Joi rules — keep them in sync)

### Fonts
- **Cairo** — primary Arabic/Latin font (Google Fonts — supports both scripts)
- **Inter** — English-only fallback (loaded only in `lang=en` context)

### Internationalization
- **next-intl** — AR/EN messages, locale routing, RTL direction switching

### UI Utilities
- **Framer Motion** — micro-animations (page transitions, skeleton reveals, agent typing)
- **date-fns** — date formatting (includes Arabic locale for calendar display)
- **recharts** — analytics charts (usage stats, content performance)
- **react-hot-toast** — toast notifications (positioned correctly for RTL)

### Dev Tools
- **ESLint** + **Prettier** — same strictness as backend
- **Vitest** + **Testing Library** — component tests

---

## FOLDER STRUCTURE

```
frontend/
  src/
    app/                          ← Next.js App Router
      (auth)/                     ← Route group: unauthenticated layout
        login/
          page.tsx
        register/
          page.tsx
        verify-email/
          page.tsx
        forgot-password/
          page.tsx
        reset-password/
          page.tsx
      (dashboard)/                ← Route group: main app layout (sidebar + header)
        layout.tsx                ← Dashboard shell — sidebar, header, breadcrumb
        page.tsx                  ← Redirects to /dashboard/brands
        onboarding/               ← Multi-step brand setup (blocks access until complete)
          page.tsx
        brands/
          page.tsx                ← Brand list (grid of brand cards)
          [brandId]/
            page.tsx              ← Brand overview (metrics summary)
            agent/
              page.tsx            ← AI agent chat
            plan/
              page.tsx            ← Marketing plan list
              [planId]/
                page.tsx          ← Plan detail + content calendar
                content/
                  [itemId]/
                    page.tsx      ← Single content item editor
            research/
              page.tsx            ← Competitor research jobs list
              [jobId]/
                page.tsx          ← Research job detail + competitor analysis
            social/
              page.tsx            ← Connected social accounts
        billing/
          page.tsx                ← Usage dashboard + upgrade CTA
          checkout/
            page.tsx              ← Paymob checkout redirect handler
        settings/
          page.tsx                ← Account settings (name, phone, language, password)
      (admin)/                    ← Route group: admin-only layout
        layout.tsx                ← Admin layout (admin nav, different sidebar)
        dashboard/
          page.tsx                ← Platform metrics overview
        users/
          page.tsx                ← User management table
          [userId]/
            page.tsx              ← User detail + plan override
        ai-usage/
          page.tsx                ← AI spend breakdown
        analytics/
          page.tsx                ← Platform analytics
      layout.tsx                  ← Root layout — sets lang, dir, fonts, providers
      globals.css
      not-found.tsx
      error.tsx

    components/
      ui/                         ← shadcn/ui primitives (auto-generated, never edit)
      layout/
        Sidebar.tsx
        Header.tsx
        BrandSwitcher.tsx
        LanguageSwitcher.tsx
        NotificationBell.tsx
      auth/
        LoginForm.tsx
        RegisterForm.tsx
        OtpInput.tsx
        GoogleSignInButton.tsx
      brand/
        BrandCard.tsx
        BrandForm.tsx
        BrandDNAEditor.tsx
        SocialAccountCard.tsx
        PlatformConnectButton.tsx
      agent/
        ChatWindow.tsx            ← full chat UI + streaming
        MessageBubble.tsx
        ToolCallBadge.tsx         ← shows when agent uses a tool (research, memory etc.)
        TypingIndicator.tsx
        ChatInput.tsx
        MemoryIndicator.tsx       ← shows agent memory is active
      content/
        ContentCalendar.tsx       ← monthly grid view
        ContentCard.tsx           ← single post card in calendar
        AssetPreview.tsx          ← image/video/voiceover preview
        GenerationStatus.tsx      ← BullMQ job progress indicator
        ContentItemEditor.tsx
        PlatformBadge.tsx
      plan/
        PlanCard.tsx
        PlanStrategyView.tsx
        OccasionTag.tsx           ← Egyptian/Arab cultural occasion tags
      billing/
        UsageMeter.tsx            ← used/limit progress bar per resource
        PlanCard.tsx              ← pricing card (free/starter/growth/agency)
        UpgradeBanner.tsx         ← shown when quota is near/exceeded
      analytics/
        MetricCard.tsx
        UsageChart.tsx
        CostBreakdown.tsx
      shared/
        ErrorBoundary.tsx
        KillSwitchBanner.tsx      ← shown when 503 with KILL_SWITCH_ACTIVE code
        QuotaExceededModal.tsx    ← shown on QUOTA_EXCEEDED error
        SubscriptionExpiredModal.tsx
        ConfirmDialog.tsx
        EmptyState.tsx
        LoadingSpinner.tsx
        ArabicText.tsx            ← enforces Cairo font + correct text direction

    hooks/
      useAuth.ts                  ← Zustand auth store + token refresh
      useBrand.ts                 ← active brand context
      useSocket.ts                ← Socket.io connection singleton
      useAgentChat.ts             ← chat state + streaming handler
      useContentGeneration.ts     ← BullMQ job polling
      usePlanLimits.ts            ← quota display helpers
      useToast.ts                 ← react-hot-toast wrapper with Arabic defaults
      useDirection.ts             ← returns 'rtl' | 'ltr' based on lang

    lib/
      api/
        client.ts                 ← Axios instance with interceptors (auth headers, refresh)
        auth.ts                   ← auth API calls
        brand.ts                  ← brand API calls
        agent.ts                  ← agent API calls
        plan.ts                   ← plan API calls
        content.ts                ← content API calls
        social.ts                 ← social API calls
        billing.ts                ← billing API calls
        research.ts               ← research API calls
        admin.ts                  ← admin API calls
      socket.ts                   ← Socket.io client singleton
      queryClient.ts              ← TanStack Query client config
      utils.ts                    ← cn(), formatDate(), formatEGP() etc.
      constants.ts                ← PLAN_LIMITS mirror (keep in sync with backend)
      errorCodes.ts               ← ErrorCode enum mirror (keep in sync with backend)

    types/
      api.ts                      ← Response shapes mirroring backend interfaces
      user.ts
      brand.ts
      content.ts
      billing.ts
      agent.ts

    middleware.ts                  ← Auth guard + admin redirect
    i18n/
      ar.json                      ← Arabic translations (Egyptian Arabic default)
      en.json                      ← English translations
```

---

## DESIGN SYSTEM

### Color Palette

```css
/* Primary — deep teal (trust, professionalism, digital) */
--primary:        hsl(185 85% 30%)   /* #0d7e8a */
--primary-hover:  hsl(185 85% 25%)
--primary-light:  hsl(185 85% 95%)

/* Accent — warm amber (Egyptian gold, energy, AI) */
--accent:         hsl(38 95% 55%)    /* #f5a623 */
--accent-hover:   hsl(38 95% 48%)

/* Success / Warning / Danger — standard semantic */
--success:        hsl(142 71% 45%)
--warning:        hsl(38 95% 55%)
--danger:         hsl(0 84% 60%)

/* Neutrals */
--background:     hsl(220 20% 97%)
--surface:        hsl(0 0% 100%)
--border:         hsl(220 15% 90%)
--text-primary:   hsl(220 25% 12%)
--text-secondary: hsl(220 15% 45%)
--text-muted:     hsl(220 10% 65%)
```

### Typography

```css
/* Arabic (RTL) — Cairo for all weights */
font-family: 'Cairo', 'Arial', sans-serif;

/* English (LTR) — Inter */
font-family: 'Inter', 'Arial', sans-serif;

/* Scale */
--text-xs:   0.75rem   /* 12px — tags, labels */
--text-sm:   0.875rem  /* 14px — secondary text */
--text-base: 1rem      /* 16px — body */
--text-lg:   1.125rem  /* 18px — subheadings */
--text-xl:   1.25rem   /* 20px — card titles */
--text-2xl:  1.5rem    /* 24px — section headings */
--text-3xl:  1.875rem  /* 30px — page headings */
--text-4xl:  2.25rem   /* 36px — hero/landing */
```

### Spacing

Follow Tailwind's default 4px grid. Dashboard uses 6/8/10/12 spacing. Forms use 4/6.

### Border Radius

```
--radius-sm:  4px   (inputs, badges)
--radius-md:  8px   (cards, dropdowns)
--radius-lg:  12px  (modals, panels)
--radius-xl:  16px  (agent chat bubbles)
--radius-full: 9999px (avatars, pills)
```

### Shadows

```
--shadow-sm:  0 1px 3px rgba(0,0,0,0.08)  (cards at rest)
--shadow-md:  0 4px 12px rgba(0,0,0,0.10) (cards hover, modals)
--shadow-lg:  0 8px 24px rgba(0,0,0,0.12) (dropdowns, popovers)
```

### Component Conventions

- All interactive elements have `focus-visible` ring using `--primary`
- Hover states use 5% darker fill or border color shift — never color changes
- Loading states: skeleton shimmer (same background hue, animated gradient)
- Empty states: centered illustration + Arabic primary text + action button
- Every destructive action (delete, cancel subscription) requires `ConfirmDialog`

---

## RTL & ARABIC SUPPORT

### Root Layout Setup

```tsx
// app/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { Cairo, Inter } from 'next/font/google'

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export default function RootLayout({ children, params: { locale } }) {
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const font = locale === 'ar' ? cairo.variable : inter.variable

  return (
    <html lang={locale} dir={dir} className={font}>
      <body>{children}</body>
    </html>
  )
}
```

### Tailwind RTL Rules

```
ms-* → margin-inline-start (replaces ml-* for RTL-safe spacing)
me-* → margin-inline-end   (replaces mr-*)
ps-* → padding-inline-start
pe-* → padding-inline-end
start-* → inset-inline-start (replaces left-*)
end-*   → inset-inline-end   (replaces right-*)

text-start → text-align: start (right in RTL, left in LTR)
text-end   → text-align: end
```

**Rule: Never use `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-` in layout components. Always use logical properties.**

### Three Language Layers (mirror backend)

1. **UI language (`lang` field)** — `next-intl` locale. Controls all static strings in the UI. Default: `ar`.
2. **Agent conversation dialect** — auto-detected by backend Claude. Frontend just renders what the backend returns. No frontend logic needed.
3. **Content dialect (`brandDNA.contentDialect`)** — set during brand onboarding. Stored on brand profile. Frontend displays it as a tag on content items.

**Frontend never translates content.** It only controls the UI shell language.

---

## AUTHENTICATION FLOW

### JWT Strategy

```
Access token:  JWT, 15min expiry, stored in memory (Zustand)
Refresh token: JWT, 7-day expiry, stored in httpOnly cookie (set by backend)
```

**Never store the access token in localStorage or sessionStorage.** Memory only.

### Token Refresh Flow

```
Axios interceptor:
  → Request fails with 401
  → POST /api/auth/refresh (sends httpOnly cookie automatically)
  → Backend returns new access token
  → Retry original request with new token
  → If refresh also fails → clear auth state → redirect to /login
```

### Middleware (Route Guard)

```ts
// middleware.ts
import { NextResponse } from 'next/server'
import { verifyToken } from './lib/auth'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('refreshToken')

  // Public routes — no auth needed
  if (pathname.startsWith('/(auth)') || pathname === '/') {
    return NextResponse.next()
  }

  // Admin routes — require admin role in token
  if (pathname.startsWith('/admin')) {
    const payload = verifyToken(token)
    if (!payload || payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  // Protected routes — require valid token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}
```

### Auth Pages UX Rules

- **Login page**: email + password. Google Sign-In button. "Forgot Password?" link. Arabic error messages from `ErrorCode` enum.
- **Register page**: name, email, password, phone (optional). After submit → redirect to `/verify-email`.
- **Verify Email page**: 6-digit OTP input. Resend button (disabled for 60s after send). Timer countdown.
- **Forgot Password**: email input → sends OTP → verify OTP → set new password.
- **Google Sign-In**: button triggers `window.location.href = process.env.NEXT_PUBLIC_API_URL + '/api/auth/google'`. The backend handles the full OAuth redirect flow, sets the `httpOnly` refresh token cookie, and redirects back to `[FRONTEND_URL]/login?google=success`. **No Next.js API route needed** — the frontend never acts as OAuth middleman.

---

## ROUTE MAP

Complete mapping of every page to its backend API endpoints.

### Public Routes

| Route | Purpose | Backend Endpoints |
|---|---|---|
| `/` | Landing page (marketing) | None — static |
| `/login` | Email/password login | `POST /api/auth/login` |
| `/register` | New account registration | `POST /api/auth/register` |
| `/verify-email` | OTP email verification | `POST /api/auth/verify-email`, `POST /api/auth/resend-otp` |
| `/forgot-password` | Password reset initiation | `POST /api/auth/forgot-password` |
| `/reset-password` | Set new password | `POST /api/auth/reset-password` |

### Dashboard Routes (Authenticated)

| Route | Purpose | Backend Endpoints |
|---|---|---|
| `/onboarding` | First-time brand setup wizard | `POST /api/brand`, `POST /api/agent/chat` |
| `/brands` | Brand overview list | `GET /api/brand` |
| `/brands/[brandId]` | Brand metrics dashboard | `GET /api/brand/[brandId]` |
| `/brands/[brandId]/settings` | Brand DNA + tone + dialect | `GET /api/brand/[brandId]`, `PUT /api/brand/[brandId]` |
| `/brands/[brandId]/assets` | Uploaded logos, fonts, brand files | `GET /api/brand/[brandId]`, `POST /api/upload` |
| `/brands/[brandId]/documents` | Context docs (PDFs, DOCX, brand guides) | `POST /api/upload`, agent file ingestion |
| `/brands/[brandId]/agent` | AI agent chat | `POST /api/agent/chat`, Socket.io |
| `/brands/[brandId]/plan` | Marketing plans list | `GET /api/plan?brandId=X` |
| `/brands/[brandId]/plan/[planId]` | Plan detail + calendar | `GET /api/plan/[planId]` |
| `/brands/[brandId]/plan/[planId]/content/[itemId]` | Content item editor | `GET /api/plan/[planId]`, `PUT /api/plan/[planId]/item/[itemId]` |
| `/brands/[brandId]/research` | Competitor research list | `GET /api/research/job?brandId=X` |
| `/brands/[brandId]/research/[jobId]` | Research job detail + live terminal | `GET /api/research/job/[jobId]`, Socket.io `research:*` |
| `/brands/[brandId]/memory` | Agent memory browser | `GET /api/agent/memory?brandId=X`, `DELETE /api/agent/memory/[id]` |
| `/brands/[brandId]/plan/[planId]/analytics` | Plan performance report | `GET /api/analytics/[planId]` |
| `/brands/[brandId]/social` | Social accounts management | `GET /api/social/accounts/[brandId]` |
| `/billing` | Usage dashboard + plans | `GET /api/billing/usage` |
| `/billing/checkout` | Post-Paymob return handler | `GET /api/billing/usage` (revalidate) |
| `/settings` | Account settings | `GET /api/auth/me`, `PATCH /api/auth/update-profile` |

### Admin Routes

| Route | Purpose | Backend Endpoints |
|---|---|---|
| `/admin/dashboard` | Platform overview | `GET /api/analytics/platform` |
| `/admin/users` | User management | `GET /api/admin/users` |
| `/admin/users/[userId]` | User detail + overrides | `GET /api/admin/users/[userId]`, `PUT /api/admin/users/[userId]/plan`, `POST /api/admin/users/[userId]/reset-usage`, `POST /api/admin/users/[userId]/extend-subscription` |
| `/admin/ai-usage` | AI spend breakdown | `GET /api/analytics/ai-usage` |
| `/admin/analytics` | Full platform analytics | `GET /api/analytics/platform`, `GET /api/analytics/content` |

---

## ONBOARDING FLOW

Onboarding blocks dashboard access until complete. It runs as a full-screen wizard.

### Steps

```
Step 1: Brand basics
  Fields: businessName, industry, website (optional)
  Backend: POST /api/brand

Step 2: Target market
  Fields: country (dropdown — Egypt/Saudi/UAE/Jordan etc.), city (optional)
  UI note: country selection auto-suggests contentDialect

Step 3: Brand DNA (agent-assisted)
  User describes brand in natural language → agent extracts:
    - Brand tone (Professional/Playful/Bold/Casual)
    - Target audience (age range, gender, interests, pain points)
    - UVP (unique value proposition)
    - Brand colors (color picker or let agent suggest)
    - Content dialect (auto-set based on country, user can override)
      Override dropdown MUST map strictly to the backend `ArabicDialect` enum:
      | Display (Arabic) | Enum value |
      |---|---|
      | مصري | `egyptian` |
      | سعودي | `saudi` |
      | خليجي | `gulf` |
      | شامي | `levantine` |
      | مغربي | `moroccan` |
      | فصحى | `msa` |
      | English | `english` |
      Never send a free-text dialect string — backend Joi validation will reject it.
  Backend: POST /api/agent/chat (streamed via Socket.io)
  Save: PUT /api/brand/[brandId] (saves brandDNA)

Step 4: Competitors (optional but recommended)
  User adds competitor website URLs
  Agent initiates background research job
  Backend: POST /api/research/crawl (enqueues BullMQ job)
  UI: "محتاج ٢-٥ دقائق — هنبعتلك إشعار لما يخلص"

Step 5: Social accounts (optional, can skip)
  Connect Facebook → GET /api/social/connect/facebook
  Connect Instagram → GET /api/social/connect/instagram
  UI: OAuth popup. On callback → refresh brand state.

Step 6: Complete
  CTA: "اعمل أول خطة تسويقية"
  Redirect: /brands/[brandId]/agent
```

### Onboarding State

Progress is tracked on the brand document (`onboardingComplete: boolean`).
If user refreshes mid-onboarding → resume from last completed step (stored in Zustand + localStorage).

---

## AGENT CHAT

The agent chat page is the **core product experience**. It must be fast, beautiful, and feel like a real AI assistant.

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Brand name + memory status indicator           │
├──────────────────────────────────┬──────────────────────┤
│                                  │ CONTEXT PANEL        │
│  CHAT WINDOW                     │ (collapsible)        │
│  - Messages (scrollable)         │                      │
│  - Tool call badges (inline)     │ - Brand DNA summary  │
│  - Typing indicator              │ - Active plan        │
│  - Agent memory indicator        │ - Recent research    │
│                                  │ - Usage quota        │
├──────────────────────────────────┴──────────────────────┤
│  INPUT BAR: textarea + send + attach file               │
└─────────────────────────────────────────────────────────┘
```

### Message Rendering & Tool Execution Timeline

The agent follows a `thinking → tool → thinking → tool → answer` pattern. The chat stream must render all of these states visually — never collapse them into a single message.

```ts
// Complete event type — covers every phase of an agent turn
type ChatEvent =
  | { type: 'assistant_token';    token: string }
  | { type: 'tool_call';          name: string; label: string }  // "🔍 بيبحث عن المنافسين..."
  | { type: 'tool_progress';      progress: string }              // "فحص صفحة ٣ من ١٠..."
  | { type: 'tool_result';        name: string; summary: string } // collapsible result card
  | { type: 'assistant_done';     message: IMessage }
  | { type: 'agent_error';        code: ErrorCode; message: string }

// Rendering rules:
// user            → right-aligned card, teal background
// assistant_token → left-aligned card, streaming character by character (ref + flushSync)
// tool_call       → inline badge with spinner: "🔍 بيبحث..."
// tool_progress   → sub-text under badge, updates in place
// tool_result     → collapsible card under badge: "تم تحليل ٣ مواقع منافسة ▼"
// assistant_done  → finalizes streaming message
```

**Tool name → Arabic label mapping:**
```ts
const TOOL_LABELS: Record<string, string> = {
  research:            '🔍 بيحلل المنافسين...',
  memory:              '🧠 بيتذكر...',
  planning:            '📅 بيخطط...',
  social_analysis:     '📊 بيحلل السوشيال ميديا...',
  competitor_extract:  '🕵️ بيستخرج بيانات المنافس...',
  brand_learning:      '💡 بيتعلم عن البراند...',
}
```

### Streaming Implementation

```ts
// hooks/useAgentChat.ts
const socket = useSocket()

socket.on('agent:token', (token: string) => {
  setStreamingMessage(prev => prev + token)
})

socket.on('agent:tool_call', (tool: { name: string; status: string }) => {
  addChatEvent({ type: 'tool_call', name: tool.name, label: TOOL_LABELS[tool.name] ?? tool.name })
})

socket.on('agent:tool_progress', (data: { name: string; progress: string }) => {
  updateToolProgress(data.name, data.progress)
})

socket.on('agent:tool_result', (data: { name: string; summary: string }) => {
  finalizeToolResult(data.name, data.summary)
})

socket.on('agent:done', (message: IMessage) => {
  finalizeMessage(message)
  setStreamingMessage('')
})

socket.on('agent:error', (error: { code: ErrorCode; message: string }) => {
  handleAgentError(error)
})
```

### Memory Indicator

Show a subtle badge when the agent has loaded memories for this brand:
```
💡 الوكيل عنده ذاكرة لـ ١٢ ذكرى من آخر ٣ أشهر  [استعرض الذاكرة ↗]
```
Fetch from `/api/brand/[brandId]` — show count of recent `AgentLearning` documents. Badge links to `/brands/[brandId]/memory`.

### Chat History Persistence

On mount, the agent chat page must load previous messages before opening the Socket.io connection. Without this, a page refresh loses the entire conversation.

```ts
// hooks/useAgentChat.ts — initialization
useEffect(() => {
  async function loadHistory() {
    const { data } = await api.get(`/agent/history?brandId=${brandId}&limit=50`)
    // data.messages: IMessage[] — most recent 50 messages, sorted oldest→newest
    setMessages(data.messages)
    scrollToBottom()
  }

  loadHistory().then(() => {
    // Only open socket AFTER history is loaded to avoid message ordering issues
    socket.emit('join:brand', brandId)
  })
}, [brandId])
```

**Pagination:** History scrolls upward (infinite scroll). When user scrolls to top → `GET /api/agent/history?brandId=X&before=[oldestMessageId]&limit=50`.

**Conversation isolation:** Each brand has its own chat history. Switching brands via `useSwitchBrand()` resets messages and re-fetches history for the new brand.

### Agent Memory Browser (`/brands/[brandId]/memory`)

Users must be able to inspect, delete, and understand what the agent has learned about their brand. This is essential for trust.

```
┌─────────────────────────────────────────────────────────┐
│  ذاكرة الوكيل — براند: [اسم البراند]    [١٢ ذكرى]      │
├─────────────────────────────────────────────────────────┤
│  🏷️ competitor_insight  │ من: محادثة  │ ٣ مارس ٢٠٢٦     │
│  "منافس X بيقدم خصم ٢٠٪ للعملاء الجدد"                  │
│  [📌 تثبيت]  [🗑️ حذف]                                    │
├─────────────────────────────────────────────────────────┤
│  🏷️ brand_preference    │ من: تغذية راجعة │ ١ مارس      │
│  "العميل بيفضل محتوى خفيف وفكاهي"                        │
│  [📌 تثبيت]  [🗑️ حذف]                                    │
└─────────────────────────────────────────────────────────┘
```

API endpoints:
- `GET /api/agent/memory?brandId=X` — list memories (paginated)
- `DELETE /api/agent/memory/[id]` — delete a memory point from Qdrant + MongoDB
- Memory categories map to `MemoryCategory` enum: `competitor_insight`, `brand_preference`, `audience_insight`, `content_feedback`, `strategy_note`, `general`

### Rate Limit Handling (Chat-Specific)

The agent chat endpoint enforces **20 requests per minute** per user (`agentChatLimiter`). A toast while the input remains active is confusing in a chat context.

When the chat API returns `429 RATE_LIMIT_EXCEEDED`:
- **Disable** the `ChatInput` textarea and send button immediately
- Show an **inline message** directly above the input bar (not a toast):
  ```
  ⏳ بعت رسايل كتير أوي. ريّح شوية وحاول تاني.
  ```
- Start a **60-second countdown** visible in the input bar: `(إبعت بعد ٤٥ ثانية)`
- Re-enable the input automatically when the countdown ends
- Do **not** show a toast for this error code in chat context

### File Upload

User can attach files to any chat message for the agent to analyze. The backend (`POST /api/upload`) enforces strict limits — the frontend must validate **before** the API call.

**Supported file types and size limits:**

| Type | Extensions | Max size |
|---|---|---|
| Images | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | 10 MB |
| Documents | `.pdf`, `.doc`, `.docx`, `.txt`, `.md` | 10 MB |
| Spreadsheets | `.xlsx`, `.xls`, `.csv` | 10 MB |
| Design files | `.ai`, `.eps`, `.psd` | 50 MB |
| Vector graphics | `.svg` | 2 MB |

**Hard limits (frontend + backend):**
- Maximum **5 files per message** — show a validation error if user tries to attach a 6th
- File picker must show file type icons (PDF icon, Excel icon, Photoshop icon) not just generic file icons

**`parseWarning` handling:**

When the backend parses `.psd`, `.ai`, or `.eps` files, it returns a `parseWarning` field in the response:
```ts
// POST /api/upload response
{
  success: true,
  data: { url: '...', fileType: 'psd', parseWarning: 'ملف Photoshop — الـ AI ممكن ميفهمش كل التفاصيل' }
}
```
The `ChatInput` component **must** display this warning inline, directly under the attached file chip, as a yellow alert before the user sends the message:
```
📎 brand-logo.psd  ×
⚠️ ملف Photoshop — الـ AI ممكن ميفهمش كل التفاصيل
```
This is not a toast — it persists attached to the file until the user removes it or sends the message.

---

## CONTENT CALENDAR & GENERATION PIPELINE

### Calendar View

Monthly grid calendar. Each day cell shows scheduled content items as cards.

```
┌────────────────────────────────────────────────────────────┐
│  مارس ٢٠٢٦                    [← شهر سابق] [شهر تالي →]   │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────┤
│  أحد │ اثن  │ثلاثا│  أربع│ خميس │ جمعة │  سبت             │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────┤
│      │      │      │      │      │  ١   │  ٢               │
│      │      │      │      │      │ post │                  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────┤
│  ٣   │  ٤   │  ٥   │  ٦   │  ٧   │  ٨   │  ٩               │
│      │ reel │      │ post │      │      │  story           │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────────────┘
```

Each content card shows:
- Platform icon (Facebook/Instagram/TikTok/Twitter)
- Content type badge (post/reel/story/carousel/ad)
- Status chip: `pending_generation` → `draft` → `approved` → `scheduled` → `posted`
- Thumbnail (once image is generated)

### Content Item Statuses (mirror backend `ContentStatus` enum)

| Status | Color | Arabic label | User action |
|---|---|---|---|
| `pending_generation` | Gray | جاري التوليد | — (waiting) |
| `draft` | Blue | مسودة | Review → Approve |
| `approved` | Teal | معتمد | Schedule or Publish now |
| `scheduled` | Purple | مجدول | View schedule |
| `posted` | Green | تم النشر | View metrics |

### Generation Pipeline UX

Content generation is async (BullMQ workers). Frontend must show live progress.

```
[User approves plan]
      ↓
POST /api/plan/[planId]/approve
      ↓
Backend enqueues 5 workers per content item:
  1. caption.worker   → generates caption + hashtags
  2. image.worker     → generates image
  3. video.worker     → generates video (if plan supports)
  4. voiceover.worker → generates voiceover (if plan supports)
  5. design.worker    → generates final designed post
      ↓
PRIMARY: Socket.io events drive UI updates
  socket.on('job:complete', ({ contentItemId }) => {
    queryClient.invalidateQueries({ queryKey: ['plan', planId] })
  })
  socket.on('job:failed', ({ contentItemId, error }) => {
    markItemFailed(contentItemId, error)
  })
      ↓
FALLBACK: TanStack Query polls only when socket is disconnected
  refetchInterval: isSocketConnected ? false : 5000
  (Video jobs can take 5 minutes — do not poll every 3s)
      ↓
All assets ready → status → 'draft' → user reviews
```

**Why socket-first:** Video generation (Runway ML) can take 3-5 minutes. Polling every 3s for 5 minutes = 100 unnecessary requests per video item. Socket event fires exactly once when done.

### Asset Preview

- Images: `next/image` with blur placeholder, click to expand full-size
- Videos: HTML5 `<video>` with controls, poster frame
- Voiceovers: HTML5 `<audio>` with waveform visualization
- Designs: `next/image` (final PNG from Canva/Puppeteer renderer)

**Model Transparency Badge** — each asset slot shows which model generated it:

```
┌─────────────────────────────────────────┐
│ Caption      ✓  [Claude Sonnet]          │
│ Image        ✓  [DALL-E / Flux]          │
│ Video        ✓  [Runway Gen-3]           │
│ Voiceover    ✓  [ElevenLabs]             │
│ Design       ✓  [Puppeteer Renderer]     │
└─────────────────────────────────────────┘
```

Model badge maps from `IGeneratedAsset.model` field. Read from the asset metadata — do not hardcode. This matters for debugging, pricing transparency, and future model swaps.

### ContentType → Asset Slot Mapping (STRICT)

`ContentItemEditor.tsx` **must** conditionally render asset slots based on `contentType`. Never show a slot the backend will never populate.

```ts
// Phase 6 enforces this mapping at the worker level:
const ASSET_SLOTS: Record<ContentType, AssetType[]> = {
  post:      ['caption', 'image', 'design'],
  story:     ['caption', 'image', 'design'],
  carousel:  ['caption', 'image', 'design'],
  ad:        ['caption', 'image', 'design'],
  reel:      ['caption', 'video', 'voiceover', 'design'],
}

// In ContentItemEditor.tsx:
const slots = ASSET_SLOTS[contentItem.contentType]

// ✅ Only render slots that match the content type
// A "post" must never show an empty voiceover or video slot
// A "reel" must never show a standalone image slot
{slots.includes('video') && <VideoAssetSlot asset={videoAsset} />}
{slots.includes('voiceover') && <VoiceoverAssetSlot asset={voiceoverAsset} />}
{slots.includes('image') && <ImageAssetSlot asset={imageAsset} />}
```

This also applies to generation buttons — "Generate Video" must not render for a `post` content type.

---

## SOCIAL PUBLISHING FLOW

### Connected Accounts Page

Cards for each supported platform:
```
Facebook  [متصل ✓ — الصفحة: "اسم الصفحة"] [فصل]
Instagram [متصل ✓ — @handle]               [فصل]
TikTok    [غير متصل]    [ربط الحساب →]
Twitter   [غير متصل]    [ربط الحساب →]
YouTube   [غير متصل]    [ربط الحساب →]
```

### OAuth Connect Flow

```
[User clicks "ربط الحساب"]
      ↓
GET /api/social/connect/[platform]?brandId=X
      ↓
Backend returns OAuth URL
      ↓
Frontend opens URL in same tab (redirect flow)
(NOT a popup — Meta requires same-tab redirect for Business Login)
      ↓
User authorizes on Facebook/Instagram
      ↓
Meta redirects to /api/social/callback (fixed backend URL)
Backend exchanges code → encrypts tokens → saves to brand
      ↓
Backend redirects to: [FRONTEND_URL]/brands/[brandId]/social?connected=facebook
      ↓
Frontend detects query param → shows success toast → reloads accounts
```

### Publish / Schedule

From the content item detail page:
- **Publish now**: `POST /api/social/publish/[contentItemId]`
- **Schedule**: date/time picker → `POST /api/social/schedule/[contentItemId]` with `scheduledAt`

Show platform-specific constraints:
- Instagram: image required (cannot text-only post)
- Facebook: text-only allowed
- TikTok: video required

---

## BILLING & PLANS FLOW

### Usage Dashboard (`/billing`)

```
┌────────────────────────────────────────────────────────────┐
│ خطتك الحالية: Starter  │  ٢٩٩ ج.م/شهر  │ [ترقّى]          │
│ تجديد الاشتراك: ١ أبريل ٢٠٢٦                               │
├────────────────────────────────────────────────────────────┤
│ USAGE METERS                                                │
│ المنشورات    ████████░░  8/12                               │
│ الصور       ████████░░  8/12                               │
│ الفيديوهات  ░░░░░░░░░░  0/0  (مش في خطتك)                 │
│ البراندات   ████░░░░░░  1/1                                │
├────────────────────────────────────────────────────────────┤
│ إجمالي الاستخدام الشهري: $2.40 / $5.00    [تفاصيل ▼]        │
│                                                            │
│  AI Spend Breakdown:                                       │
│  Claude (captions/agent)  $1.30                            │
│  Images (DALL-E/Flux)     $0.60                            │
│  Video (Runway)           $0.30                            │
│  Voiceover (ElevenLabs)   $0.20                            │
└────────────────────────────────────────────────────────────┘
```

Cost breakdown fetched from `GET /api/billing/usage` — the usage summary already includes aggregated AI cost. The per-model breakdown is available from the same `AiUsageLog` collection. The collapsible breakdown section is shown by default when monthly spend exceeds 50% of cap.

### Plan Cards

Show all 4 tiers. Current plan highlighted. Annual toggle (shows annual savings).

**CRITICAL: Never hardcode plan limits in the UI.** Numbers like "12 posts" or "40 posts" come from the user's `limits` object returned in `GET /api/auth/me` and `GET /api/billing/usage`. If `planLimits.ts` changes on the backend, the frontend must reflect it automatically.

```ts
// ✅ Correct — derives limits from user object
const { data: usage } = useQuery(['billing', 'usage'], billingApi.getUsage)
// usage.limits.postsPerMonth → show this number, never hardcode it

// ❌ Wrong — will drift when backend changes planLimits.ts
const PLAN_POSTS = { starter: 12, growth: 40, agency: 120 }
```

Illustrative plan display (actual numbers always from backend):
```
[Free]          [Starter ✓ Current]   [Growth]        [Agency]
مجانًا          ٢٩٩ ج.م/شهر           ٦٩٩ ج.م/شهر    ١٤٩٩ ج.م/شهر
[limits.posts]  [limits.posts]        [limits.posts]  [limits.posts]
Facebook فقط   Facebook + Instagram  + TikTok        كل المنصات
...             ...                   ...             ...
[الخطة الحالية] [ترقّى]               [ترقّى]         [ترقّى]
```

### Checkout Flow

```
[User clicks "ترقّى"]
      ↓
POST /api/billing/checkout { tier, billingCycle }
      ↓
Backend calls Paymob API → returns clientSecret
      ↓
Frontend redirects: window.location.href = paymob_checkout_url
      ↓
User completes payment on Paymob (card/Fawry/Vodafone Cash)
      ↓
Paymob POSTs webhook to backend /api/billing/webhook
Backend upgrades user plan
      ↓
Paymob redirects user to: [FRONTEND_URL]/billing/checkout?success=true
Frontend shows success toast → reloads /billing page → new plan displayed
```

### Plan Status UI States

The `UserPlan.status` field has four values — each requires a distinct UI response:

| Status | UI Response |
|---|---|
| `active` | Normal dashboard — show renewal date |
| `trialing` | Subtle trial banner: "تجربة مجانية — تنتهي في [date]" with upgrade CTA |
| `past_due` | **Red banner on billing page** — "فشل تجديد الاشتراك. حدّث بيانات الدفع عشان تكمل." + "تحديث بيانات الدفع" button → redirect to Paymob |
| `cancelled` | `SubscriptionExpiredModal` on every protected route — plan expired, renew to continue |

**`past_due` is not the same as expired.** The user still has access (grace period), but gets a persistent red banner — not a modal that blocks the UI — so they can fix their payment method without losing their work session.

### Error Handling

| Backend Error Code | Frontend Action |
|---|---|
| `QUOTA_EXCEEDED` | Show `QuotaExceededModal` with upgrade CTA and exact numbers (used/limit) |
| `SUBSCRIPTION_EXPIRED` | Show `SubscriptionExpiredModal` with renew button |
| `PAYMENT_FAILED` | Toast: backend-localized message |
| `COST_CAP_EXCEEDED` | Toast: backend-localized message |

---

## ADMIN DASHBOARD

Accessible only at `/admin/...`. Middleware redirects non-admin users to `/brands`.

### Pages

**`/admin/dashboard`**
Platform health overview:
- Total users (active/suspended/banned)
- Monthly revenue (EGP)
- Active subscriptions by tier (pie chart)
- AI spend today / this month
- BullMQ queue depths (jobs waiting per queue)
- Active kill switches (red alert if any are `true`)

**`/admin/users`**
Sortable/filterable table. Columns: name, email, plan, status, created, last login.
Actions: View, Suspend, Activate, Delete.

**`/admin/users/[userId]`**
Full user detail. Sections:
- Profile info
- Plan & billing (plan tier, period end, usage meters)
- Admin overrides:
  - `PUT /api/admin/users/[userId]/plan` — set tier manually + copy limits from `planLimits.ts`
  - `POST /api/admin/users/[userId]/reset-usage` — zero all usage counters
  - `POST /api/admin/users/[userId]/extend-subscription` — add 1-365 days to period end (modal: input N days → confirm → call API)
- AI usage table (model, cost, context, timestamp)

**`/admin/ai-usage`**
`GET /api/analytics/ai-usage` — spend breakdown for last 30 days.
Grouped by user, model, context. Sortable by cost.

---

## API CLIENT LAYER

### Axios Instance

```ts
// lib/api/client.ts
import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  withCredentials: true,     // sends httpOnly refresh token cookie automatically
  timeout: 30_000,
})

// Attach access token to every request
api.interceptors.request.use(config => {
  const token = useAuthStore.getState().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 — attempt token refresh
api.interceptors.response.use(
  response => response,
  async error => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      try {
        const { data } = await api.post('/auth/refresh')
        useAuthStore.getState().setAccessToken(data.data.accessToken)
        return api(original)
      } catch {
        useAuthStore.getState().logout()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
```

### Response Shape

All backend responses follow:
```ts
interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  errorCode?: string   // matches ErrorCode enum
}
```

Always destructure `data.data` from successful responses.
On error, read `error.response.data.errorCode` to route to the right UI handler.

### Idempotency — REQUIRED for Side-Effecting Operations

All frontend calls that start a job, publish, or charge **must** send an `Idempotency-Key` header (UUID v4). This matches the backend's BullMQ `jobId`-level idempotency enforcement.

Endpoints requiring an idempotency key:
- `POST /api/plan/[planId]/approve` — starts content generation workers
- `POST /api/research/crawl` — starts competitor crawl
- `POST /api/social/publish/[itemId]` — publishes to social platform
- `POST /api/social/schedule/[itemId]` — schedules a post
- `POST /api/billing/checkout` — initiates Paymob payment (prevents double-charge on refresh)

```ts
import { v4 as uuidv4 } from 'uuid'

// Attach idempotency key per-request for side-effecting calls
export const planApi = {
  approve: (planId: string) =>
    api.post(`/plan/${planId}/approve`, {}, {
      headers: { 'Idempotency-Key': uuidv4() }
    }),
}

// If backend returns 409 IdempotencyConflict → do NOT create a new job
// error.response.data.errorCode === 'IDEMPOTENCY_CONFLICT'
// → queryClient.invalidateQueries(['plan', planId]) — show existing job progress instead
```

### API Functions (example pattern)

```ts
// lib/api/brand.ts
import api from './client'
import type { IBrandProfile } from '../../types/brand'

export const brandApi = {
  list:   ()         => api.get<ApiResponse<IBrandProfile[]>>('/brand'),
  get:    (id: string) => api.get<ApiResponse<IBrandProfile>>(`/brand/${id}`),
  create: (data: CreateBrandInput) => api.post<ApiResponse<IBrandProfile>>('/brand', data),
  update: (id: string, data: UpdateBrandInput) => api.put(`/brand/${id}`, data),
  delete: (id: string) => api.delete(`/brand/${id}`),
}
```

---

## STATE MANAGEMENT

### Zustand Stores

```ts
// stores/authStore.ts
interface AuthState {
  user: IUser | null
  accessToken: string | null
  isLoading: boolean
  setUser: (user: IUser) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

// stores/brandStore.ts
interface BrandState {
  activeBrandId: string | null
  setActiveBrand: (id: string) => void
}
```

**Brand switching must include full state invalidation.** Data leaking between brands is a critical UX and security bug.

```ts
// hooks/useSwitchBrand.ts
function useSwitchBrand() {
  const queryClient = useQueryClient()
  const socket = useSocket()
  const { activeBrandId, setActiveBrand } = useBrandStore()
  const { resetChatState } = useAgentChatStore()

  return function switchBrand(newBrandId: string) {
    if (newBrandId === activeBrandId) return

    // 1. Leave old socket room
    if (activeBrandId) socket.emit('leave:brand', activeBrandId)

    // 2. Clear ALL server-state cache (brands, plans, research, agent)
    queryClient.clear()

    // 3. Reset client-side chat state
    resetChatState()

    // 4. Join new socket room + update store
    socket.emit('join:brand', newBrandId)
    setActiveBrand(newBrandId)
  }
}
```

// stores/uiStore.ts
interface UIState {
  sidebarOpen: boolean
  lang: 'ar' | 'en'
  setSidebarOpen: (open: boolean) => void
  setLang: (lang: 'ar' | 'en') => void
}
```

### TanStack Query

Use for all server state. Key conventions:

```ts
// Query keys — always arrays
['brand', brandId]               // single brand
['brands', userId]               // brand list
['plan', planId]                 // single plan
['plans', brandId]               // plan list
['billing', 'usage']             // billing usage
['agent', 'chat', brandId]       // chat history
['research', 'job', jobId]       // job status (set staleTime: 0 for polling)
```

For content generation — **socket-first, polling as fallback:**
```ts
const { isConnected } = useSocket()

useQuery({
  queryKey: ['plan', planId],
  queryFn: () => planApi.get(planId),
  // Only poll when socket is disconnected (fallback mode)
  // Video jobs take 3-5 min — 3s polling = 60-100 unnecessary requests
  refetchInterval: (data) => {
    if (isConnected) return false  // socket handles updates
    const hasGenerating = data?.contentItems.some(
      item => item.status === 'pending_generation'
    )
    return hasGenerating ? 5000 : false  // 5s fallback interval
  }
})

// Socket drives live updates
socket.on('job:complete', ({ contentItemId }) => {
  queryClient.invalidateQueries({ queryKey: ['plan', planId] })
})
```

---

## REAL-TIME (SOCKET.IO)

### Connection

```ts
// lib/socket.ts
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(token: string): Socket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL!, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function disconnectSocket() {
  socket?.disconnect()
  socket = null
}
```

### Events to Handle

```
// Inbound (backend → frontend)

// Agent chat
agent:token         — streaming token from Claude
agent:tool_call     — tool being used by agent (name, status)
agent:done          — message complete (full IMessage object)
agent:error         — agent error with ErrorCode + localized message

// Content generation (BullMQ workers)
job:progress        — BullMQ job status update { jobId, contentItemId, status }
job:complete        — content item fully generated { contentItemId }
                      → triggers queryClient.invalidateQueries(['plan', planId])
job:failed          — generation failure { contentItemId, assetType, error }
                      → mark the specific asset slot as failed, show retry button
social:published    — post successfully published { contentItemId, platform, postId }

// Competitor research (Scrapling Spider streaming)
research:status     — job status changed { jobId, status }
research:page       — spider discovered a page { jobId, pageNumber, url, title }
research:page_error — spider failed on a page { jobId, url, error }
research:complete   — full crawl finished { jobId, pagesScraped }
```

### Live Research Crawler UI

The `/brands/[brandId]/research/[jobId]` page has a **live terminal component** that streams the Scrapling spider's progress in real time:

```
┌─────────────────────────────────────────────────────────┐
│  بحث المنافسين — competitor.com          [🟡 جاري البحث] │
├─────────────────────────────────────────────────────────┤
│  📄 صفحة ١  /about                                       │
│             "من نحن — شركة رائدة في..."                  │
│  📄 صفحة ٢  /services                                    │
│             "خدماتنا — تصميم، تطوير..."                  │
│  ⚠️ صفحة ٣  /admin → خطأ في الوصول                      │
│  📄 صفحة ٤  /pricing                                     │
│             "أسعارنا — باقة أساسية..."                   │
│  ⏳ جاري فحص المزيد من الصفحات...                        │
└─────────────────────────────────────────────────────────┘
```

Implementation pattern:
```ts
// hooks/useResearchStream.ts
const { pages, errors, status } = useResearchStream(jobId)

socket.on('research:page', ({ pageNumber, url, title }) => {
  addPage({ pageNumber, url, title })
  scrollTerminalToBottom()
})

socket.on('research:page_error', ({ url, error }) => {
  addError({ url, error })
})

socket.on('research:complete', ({ pagesScraped }) => {
  setStatus('completed')
  queryClient.invalidateQueries(['research', 'job', jobId])
})
```

**Auto-scroll:** The terminal auto-scrolls to the latest entry. If the user scrolls up to read, auto-scroll pauses. Resumes when they scroll back to bottom.


### Worker Failure Recovery UX

When a BullMQ worker fails, show a retry action on the specific asset slot — not a generic error toast for the whole content item.

```
┌─────────────────────────────────────────────────────┐
│ Caption    ✓  "أفضل منتجاتنا لهذا الموسم..."        │
│ Image      ✗  فشل التوليد  [إعادة المحاولة 🔄]       │
│ Video      ⏳ جاري التوليد...                        │
│ Design     —  ينتظر الصورة                          │
└─────────────────────────────────────────────────────┘
```

Retry maps to the failed asset type:
```ts
socket.on('job:failed', ({ contentItemId, assetType, error }) => {
  markAssetFailed(contentItemId, assetType)
})

// Retry button calls (each includes Idempotency-Key header):
// POST /api/content/[itemId]/retry/image
// POST /api/content/[itemId]/retry/video
// POST /api/content/[itemId]/retry/caption
```

### Research Result Provenance

Every competitor research result card (from `GET /api/research/job/[jobId]`) must show source provenance and sanitization status:

```
┌──────────────────────────────────────────────────┐
│ 🌐 competitor.com/pricing  [زيارة الموقع ↗]      │
│ 🛡️ تم تنظيف المحتوى                               │  ← tooltip: "تم حذف التعليمات الخبيثة من المحتوى قبل التحليل"
│                                                  │
│  "أسعار المنافس: باقة أساسية بـ ٢٩٩ ج.م..."      │
└──────────────────────────────────────────────────┘
```

- **`SourceBadge`**: shows domain + direct link to original page
- **Sanitized indicator**: shown when backend's `sanitizeScrape()` stripped adversarial content. Tooltip: `"تم حذف تعليمات خبيثة من محتوى الموقع ده قبل ما يوصل للـ AI"`
- **Agent claims from research**: if agent cites a competitor fact, show a collapsible "المصدر" section with the raw scraped passage so the user can verify

---

## ERROR HANDLING & KILL SWITCH UX

### API Error Localization Rule

**Critical:** The backend already localizes all error messages into Arabic or English based on `req.user.lang` before sending them. **Never translate API errors using `next-intl`.** Always render `error.response.data.message` directly.

**ErrorCode enum rule:** Frontend must maintain `lib/errorCodes.ts` as a mirror of the backend `ErrorCode` enum. Never switch on raw strings — always use the enum constant.

```ts
// lib/errorCodes.ts — mirror of backend ErrorCode enum
export enum ErrorCode {
  QuotaExceeded = 'QUOTA_EXCEEDED',
  CostCapReached = 'COST_CAP_EXCEEDED',
  PlanExpired = 'SUBSCRIPTION_EXPIRED',
  KillSwitchActive = 'KILL_SWITCH_ACTIVE',
  RateLimitExceeded = 'RATE_LIMIT_EXCEEDED',
  IdempotencyConflict = 'IDEMPOTENCY_CONFLICT',
  // ... mirror all backend ErrorCode values
}

// Usage:
if (err.response?.data?.errorCode === ErrorCode.QuotaExceeded) {
  showQuotaExceededModal({ used: err.response.data.used, limit: err.response.data.limit })
}
```

```ts
// ✅ Correct — backend already localized the message
toast.error(error.response.data.message)

// ❌ Wrong — double-translation, ignores backend's localization
toast.error(t('errors.costCapReached'))
```

`next-intl` is strictly for **static UI shell elements** — button labels, nav links, page titles, placeholder text. Never for API response messages.

---

### Error Code → UI Mapping

```ts
// Every API call wraps the error and routes it here
function handleApiError(
  errorCode: string,
  message: string,              // use this directly — already localized by backend
  meta?: { switchActive?: string; used?: number; limit?: number }
) {
  switch (errorCode) {
    case 'KILL_SWITCH_ACTIVE':
      // Granular kill switch handling — inspect meta.switchActive
      handleKillSwitch(meta?.switchActive, message)
      break
    case 'QUOTA_EXCEEDED':
      showQuotaExceededModal()       // modal with plan comparison + upgrade CTA
      break
    case 'SUBSCRIPTION_EXPIRED':
      showSubscriptionExpiredModal() // modal with renew CTA
      break
    case 'COST_CAP_EXCEEDED':
      toast.error(message)           // backend message, already in Arabic/English
      break
    case 'RATE_LIMIT_EXCEEDED':
      // In agent chat context: disable input inline, not a generic toast
      // (see Agent Chat section for chat-specific handling)
      if (context === 'agent_chat') {
        disableChatInputTemporarily(message, 60_000) // 1 minute
      } else {
        toast.error(message)
      }
      break
    case 'AUTH_TOKEN_EXPIRED':
      // handled by Axios interceptor (silent refresh)
      break

    // ── Auth / Account status — require navigation, not just toast ──
    case 'AUTH_INVALID_CREDENTIALS':
      setLoginFormError(message)         // inline under password field
      break
    case 'EMAIL_NOT_VERIFIED':
      router.push('/verify-email')       // redirect — user must verify before using app
      break
    case 'OTP_EXPIRED':
    case 'OTP_INVALID':
      setOtpError(message)               // inline under OTP input
      break
    case 'ACCOUNT_SUSPENDED':
      router.push('/suspended')          // full-page — user cannot use app
      break
    case 'ACCOUNT_BANNED':
      router.push('/banned')             // full-page — permanent block
      break
    case 'ACCOUNT_INACTIVE':
      router.push('/inactive')           // full-page — contact support
      break

    // ── Resource errors — contextual inline ──
    case 'RESOURCE_NOT_FOUND':
      router.push('/404')
      break
    case 'VALIDATION_ERROR':
      setFormErrors(meta?.fields)        // inline field errors if available
      break
    case 'IDEMPOTENCY_CONFLICT':
      queryClient.invalidateQueries()    // show existing job state
      break

    // ── Infrastructure ──
    case 'SCRAPING_ERROR':
      setResearchJobError(message)       // inline on research job page
      break
    case 'SERVICE_UNAVAILABLE':
      showMaintenanceBanner(message)     // same as kill switch banner
      break
    case 'AI_PROVIDER_ERROR':
      toast.error(message)               // job is queued — non-blocking
      break

    default:
      toast.error(message)  // backend-localized message
  }
}
```

**Rule:** Auth/account errors always navigate away — never leave the user on the same page with a toast. Resource and validation errors are inline. Infrastructure errors are banners or toasts depending on severity.

### Kill Switch Health Polling

Kill switch state is the **authoritative source from `GET /api/health`**, not just inferred from API errors. The root layout must poll health at startup and every 60 seconds.

```ts
// app/layout.tsx (or a root ClientComponent)
useEffect(() => {
  async function fetchHealth() {
    const { data } = await api.get('/api/health')
    // Response: { db: 'ok', redis: 'ok', qdrant: 'ok', killSwitches: { KILL_VIDEO: true, ... } }
    setKillSwitches(data.data.killSwitches || {})
  }
  fetchHealth()
  const id = setInterval(fetchHealth, 60_000)
  return () => clearInterval(id)
}, [])
```

This enables **proactive** UI disabling before a user attempts a blocked action — rather than waiting for a 503 error response. Store `killSwitches` in `uiStore`. Components read from the store to disable buttons and show tooltips: `"الخدمة دي مش متاحة دلوقتي"`.

### Granular Kill Switch Handling

The backend has 9 kill switches with distinct scopes. **Never show a platform-wide banner for a feature-specific switch.**

```ts
function handleKillSwitch(switchActive: string | undefined, message: string) {
  switch (switchActive) {
    case 'DISABLE_VIDEO_GENERATION':
      // Disable the "Generate Video" button on content items inline
      // Show inline message on video asset slot: message (already Arabic/English)
      disableVideoGeneration(message)
      break

    case 'DISABLE_VOICEOVER_GENERATION':
      disableVoiceoverGeneration(message)
      break

    case 'DISABLE_CONTENT_GENERATION':
      // Disable all generation buttons platform-wide
      disableAllContentGeneration(message)
      break

    case 'DISABLE_DEEP_RESEARCH':
      // Disable the "Start Research" button on competitor research page
      disableResearch(message)
      break

    case 'DISABLE_PAYMENT_GATEWAYS':
      // Disable checkout button, show message inline on billing page
      disableCheckout(message)
      break

    case 'DISABLE_SUBSCRIPTION_MANAGEMENT':
      disableCancellation(message)
      break

    case 'DISABLE_AGENT':
      // Disable chat input, show message in chat window
      disableAgentChat(message)
      break

    case 'READ_ONLY_MODE':
      // Full platform banner — this is the only case that justifies it
      showKillSwitchBanner(message)
      break

    default:
      // Unknown switch — show banner as safe fallback
      showKillSwitchBanner(message)
  }
}
```

**`KILL_OPUS` is invisible to the frontend.** The backend silently downgrades Claude Opus → Sonnet. The response succeeds normally. Never show any UI state for this switch — it is a backend-only cost-reduction mechanism.

### Kill Switch Banner

```tsx
// components/shared/KillSwitchBanner.tsx
// Only shown for READ_ONLY_MODE or unknown switches
// Arabic: "المنصة في وضع القراءة فقط دلوقتي. شغالين على الموضوع، هنرجعلك قريباً."
// Dismiss button — hides for 5 min then re-checks on next API call
```

---

## PLAN ENFORCEMENT UX

### Quota Progress Bars

Shown on the billing page and as a compact widget in the sidebar.
Turn orange at 80%. Turn red at 100%.

```
المنشورات  ████████░░  8/12  (⚠️ قرّبت من الحد)
الصور     ██████████  12/12 (🔴 وصلت للحد — ترقّى)
الفيديوهات  ٣٠ استخدام  ∞    (Custom plan — unlimited)
```

**Custom plan (`null` limits) — critical rule:**

The `custom` enterprise plan has `null` for its limit fields. `UsageMeter.tsx` **must** handle `null` gracefully — never do math with `null` (produces `NaN` and crashes).

```tsx
// components/billing/UsageMeter.tsx
function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="flex justify-between items-center">
        <span>{label}</span>
        <span className="text-muted">{used} / <span className="text-lg">∞</span> — <span className="text-xs">غير محدود</span></span>
      </div>
    )
  }

  const pct = Math.min((used / limit) * 100, 100)
  const color = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-primary'

  return (
    <div>
      <div className="flex justify-between mb-1">
        <span>{label}</span>
        <span>{used}/{limit}</span>
      </div>
      <div className="h-2 bg-border rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
```

### Cost Confirmation for Expensive Jobs

Before starting high-cost operations, the UI must show a confirmation modal that surfaces quota impact **before** the API call is made.

Jobs that require confirmation:
- **Competitor deep crawl** (`POST /api/research/crawl`) — shows estimated pages, scraping tier
- **Plan content generation** (`POST /api/plan/[planId]/approve`) — shows item count, models used, quota delta

```
┌─────────────────────────────────────────────────────┐
│  تأكيد توليد المحتوى                                 │
│                                                     │
│  هيتم توليد ١٢ قطعة محتوى:                          │
│  • ٨ بوستات  (Caption + Image + Design)             │
│  • ٤ ريلز   (Caption + Video + Voiceover + Design)  │
│                                                     │
│  التأثير على الحصة:                                  │
│  الصور:      ████████░░  8/12 → ١٢/١٢ (ممتلئ)       │
│  فيديوهات:  ███░░░░░░░  1/4  → ٥/٤ (⚠️ يتجاوز)      │
│                                                     │
│  [إلغاء]                    [تأكيد التوليد ✓]       │
└─────────────────────────────────────────────────────┘
```

If the job would exceed a quota limit, show the overage inline and require upgrade before confirming. On confirm → API call includes `Idempotency-Key` header.

### Upgrade CTAs

- When quota is at 80%: subtle banner in the relevant section
- When quota is at 100%: `QuotaExceededModal` blocks the action with plan comparison
- When plan is expired: `SubscriptionExpiredModal` on every protected page

### Feature Gates — `PlanFeatureGuard`

Use a `PlanFeatureGuard` wrapper component for all plan-gated features. Show locked state (not hidden) so users know the feature exists and can upgrade.

```tsx
// components/shared/PlanFeatureGuard.tsx
<PlanFeatureGuard feature="video_generation" requiredTier="growth">
  <GenerateVideoButton />
</PlanFeatureGuard>

// Shows locked state for free/starter:
// [🔒 فيديوهات AI متاحة في Growth وأعلى]  [ترقّى لـ Growth]
```

Feature → minimum tier mapping (mirrors backend `planLimits.ts`):

| Feature | Min tier |
|---|---|
| `video_generation` | `growth` |
| `voiceover_generation` | `growth` |
| `tiktok_publishing` | `growth` |
| `youtube_publishing` | `agency` |
| `multi_brand` | `starter` |
| `competitor_research` | `starter` |
| `agent_chat` | `free` |

### Navigation-Level Kill Switch Hiding

When a kill switch is active, **hide** the nav menu item entirely — don't show a disabled state. A disabled nav item with no explanation is confusing; hiding it is cleaner.

```ts
// Navigation items conditionally rendered based on uiStore.killSwitches
const navItems = [
  { label: 'بحث المنافسين', href: '/research', hideWhen: 'DISABLE_DEEP_RESEARCH' },
  { label: 'الوكيل الذكي',  href: '/agent',    hideWhen: 'DISABLE_AGENT' },
  // ...
]

// Render:
{navItems
  .filter(item => !item.hideWhen || !killSwitches[item.hideWhen])
  .map(item => <NavLink key={item.href} {...item} />)
}
```

**Exception:** `READ_ONLY_MODE` shows the banner instead of hiding nav — the whole platform is affected.

---

## IMAGE ASSETS — NANO BANANA 2 PROMPTS

Generate these via Gemini app → Image generation with Nano Banana 2.

---

### 1. App Logo / Brand Mark

**Prompt:**
```
A minimalist logo for an AI marketing platform called "Marketer AI" targeting the Arab world. 
The logo is an abstract geometric mark combining a speech bubble (representing AI conversation) 
and a rising bar chart (representing growth). Colors: deep teal (#0d7e8a) and warm amber (#f5a623). 
Clean vector style, no gradients, works on both light and dark backgrounds. 
Square format 512x512px, white background, plenty of margin. No text.
```

---

### 2. Landing Page Hero Illustration

**Prompt:**
```
A flat-design hero illustration for an Arabic AI marketing platform. 
An Arab businessman in modern business casual clothing sits at a sleek desk with a laptop, 
chatting with a friendly AI assistant shown as a glowing teal orb floating beside him. 
The screen shows a content calendar and social media posts being generated in Arabic. 
The office is modern, bright, minimal. Color palette: teal (#0d7e8a), amber (#f5a623), warm white. 
Egyptian-inspired subtle patterns in the background wall. 
Aspect ratio 16:9, no text in the image.
```

---

### 3. Onboarding Step Illustrations (5 images)

**Step 1 — Brand Setup:**
```
A flat illustration of a person building a brand identity. 
A young Arab woman placing colorful brand elements (logo, color swatches, icons) 
onto a large digital canvas. Modern, clean, teal and amber palette. 16:9 no text.
```

**Step 2 — Target Market:**
```
Flat illustration of a map of the Arab world (Egypt, Saudi Arabia, UAE, Jordan highlighted) 
with small people avatars representing target audiences in each city. 
Modern, minimal, teal palette. No text. 16:9.
```

**Step 3 — AI Brand DNA:**
```
Flat illustration of a brain made of interconnected dots and lines (neural network style) 
with brand elements (color palette, font, tone icons) feeding into it. 
Teal and amber palette, clean, modern. No text. 16:9.
```

**Step 4 — Competitor Research:**
```
Flat illustration of a magnifying glass hovering over competitor website cards 
with charts and analytics extracted from them. AI analysis in progress, glowing nodes. 
Teal palette. No text. 16:9.
```

**Step 5 — Social Connect:**
```
Flat illustration showing Facebook, Instagram, TikTok platform icons 
connected by glowing lines to a central brand hub. Clean, modern, teal/amber. No text. 16:9.
```

---

### 4. Empty State Illustrations (per section)

**No brands yet:**
```
Cute minimal flat illustration of an empty shop front with a "Open Soon" sign, 
warm friendly style, teal color scheme, inviting not sad. Square format. No text.
```

**No content generated yet:**
```
Minimal flat illustration of a blank content calendar with a small robot gently 
placing the first post card onto it. Friendly, encouraging. Teal/amber. Square. No text.
```

**No social accounts connected:**
```
Minimal flat illustration of unconnected social media platform icons (silhouettes) 
with dotted lines suggesting they could be connected. Friendly, simple. 
Teal palette. Square. No text.
```

**Research in progress:**
```
Minimal flat illustration of a tiny robot with a magnifying glass 
crawling through web pages. Fun, not threatening. Teal/amber. Square. No text.
```

---

### 5. Feature Locked Illustration (plan gate)

**Prompt:**
```
A small friendly lock icon illustration — a padlock with a sparkle/star on it 
suggesting something premium behind it. Flat design, amber/gold color, 
friendly not punishing. Square 256x256px. No text.
```

---

### 6. Agent Chat Avatar

**Prompt:**
```
A friendly AI assistant avatar. A glowing teal orb with subtle inner light 
and soft radial glow. Abstract, professional, not cartoonish. 
Feels intelligent and trustworthy. Circle crop ready. 256x256px white background.
```

---

### 7. 404 Page

**Prompt:**
```
A friendly, slightly humorous flat illustration of an Arab astronaut floating 
in space looking at a street sign that points in wrong directions. 
Stars and planets in background. Teal and amber palette. 16:9. No text.
```

---

## SENTRY & OBSERVABILITY

The backend uses Sentry (Phase 10). The frontend must match:

```ts
// instrumentation.ts (Next.js 15 instrumentation hook)
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENV,  // 'production' | 'staging'
  tracesSampleRate: 0.1,
})

// Attach user + brand context on every error
export function attachSentryContext(userId: string, brandId?: string) {
  Sentry.setUser({ id: userId })
  Sentry.setContext('brand', { brandId })
}
```

On unhandled errors, Sentry captures with `brandId` and `planId` context so ops can correlate frontend crashes with backend Sentry traces.

---

## ENVIRONMENT VARIABLES

```env
# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# Google OAuth (frontend callback handling)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=

# Paymob (redirect URLs)
NEXT_PUBLIC_PAYMOB_RETURN_URL=http://localhost:3001/billing/checkout

# App
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_APP_NAME=Marketer AI
```

---

## DEVELOPER QUICKSTART

```bash
# 1. Install deps
npm install

# 2. Copy env
cp .env.example .env.local

# 3. Generate shadcn/ui components
npx shadcn@latest init
npx shadcn@latest add button input card dialog sheet toast badge progress tabs

# 4. Start dev server
npm run dev

# 5. TypeScript check
npx tsc --noEmit

# 6. Access app
open http://localhost:3001
```

### First Page to Build

Start with the auth pages (login/register/verify-email) — they're isolated, have no backend dependencies beyond the auth endpoints, and establish the design system foundation. Once auth works end-to-end, move to the onboarding flow.

### Page Build Order (recommended)

1. Auth pages (login, register, verify-email, forgot-password)
2. Dashboard shell (layout, sidebar, header, brand switcher)
3. Onboarding wizard
4. Agent chat
5. Content calendar + item viewer
6. Social accounts page
7. Billing / usage page
8. Research pages
9. Settings
10. Admin dashboard

---

## CRITICAL RULES (mirror backend CLAUDE.md)

1. **No `any` in TypeScript.** Every prop, API response, and event payload must be typed.
2. **API types mirror backend interfaces.** When backend adds a field, add it here too.
3. **ErrorCode enum lives in `lib/errorCodes.ts`.** Matches backend exactly. Never use raw strings.
4. **Three language layers never mix.** UI strings via `next-intl`. Agent text rendered as-is. Content dialect displayed as a tag only.
5. **Never store access tokens in localStorage.** Memory (Zustand) only.
6. **RTL logical properties only.** No `ml-`, `mr-`, `pl-`, `pr-` in layout/spacing. Use `ms-`, `me-`, `ps-`, `pe-`.
7. **Quota errors always show upgrade path.** Never just show "limit reached" with no action.
8. **Kill switch banner is persistent.** Not a toast. Users must know a feature is degraded.
9. **Content generation polling stops when complete.** Never poll indefinitely. Check all items status before deciding interval.
10. **Admin routes are completely isolated.** Different layout, different nav, middleware-guarded.
