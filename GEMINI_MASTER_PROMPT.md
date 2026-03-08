# MASTER IMPLEMENTATION PROMPT
# AI Marketing Platform — Full Frontend
# For: Gemini 3.1 Pro (thinking: high)
# Attach: FRONTEND.md + UI_SPEC.md

---

You are building the complete frontend for an AI-powered social media marketing platform targeting the Egyptian and Arab market.

You have TWO reference documents attached:
1. **FRONTEND.md** — single source of truth for architecture, routes, API contracts, state management, error handling, RTL rules, Socket.io events, and kill switch behavior
2. **UI_SPEC.md** — single source of truth for every screen's visual design, layout, color system, component specs, interactions, and animations

**Read both documents IN FULL before writing a single line of code.** Everything you need is in them. Do not invent patterns that contradict either document.

---

## TECH STACK

- Next.js 15 App Router — TypeScript strict mode (`"strict": true` in tsconfig)
- Tailwind CSS v4 + tailwindcss-rtl plugin
- shadcn/ui component library
- React Hook Form + Zod for all forms
- Zustand for global state
- Axios for HTTP
- Socket.io Client for real-time events
- Framer Motion for animations
- next-intl (Arabic default locale `ar`, English fallback `en`)
- Cairo font (Arabic), Inter font (English)
- date-fns with Arabic locale for date formatting

---

## NON-NEGOTIABLE RULES (apply to every phase, every file)

1. **RTL layout only.** Never use `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left`, `text-right`, `border-l-`, `border-r-` for layout. Always: `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`, `border-s-`, `border-e-`.

2. **Access token in Zustand memory only.** Never `localStorage`, never `sessionStorage`, never JS-set cookies. The refresh token is httpOnly — the browser handles it automatically.

3. **Google OAuth = full page redirect.** `window.location.href = process.env.NEXT_PUBLIC_API_URL + '/api/auth/google'`. No Next.js API route.

4. **Error messages from backend directly.** `error.response.data.message` is already localized by the backend. Never pass it through `t()`.

5. **Always use ErrorCode enum.** Never switch on raw strings.

6. **Zero `any` in TypeScript.** Every prop, response, event, store action must be fully typed.

7. **Cairo for Arabic, Inter for English.** Applied via `lang` attribute on `<html>`.

8. **No hardcoded Arabic UI strings in JSX.** All user-facing static text through next-intl `t()`. Backend error messages render as-is.

9. **Forms: React Hook Form + Zod only.** No `useState` for form fields.

10. **No `<form>` HTML element.** Use `<div>` with React Hook Form's `handleSubmit`.

11. **Plan limits never hardcoded.** All quota numbers come from `usage.limits` API response. Never write `12 posts` or `40 posts` in code.

12. **Every file passes `tsc --noEmit` with 0 errors** before moving to the next file.

---

## QUALITY GATE (runs after EVERY phase)

```bash
npx tsc --noEmit
npm run lint
```

Both must pass clean. Report the output after each phase. Do not start the next phase until the current phase shows 0 errors and 0 lint warnings.

---

## PHASE GATE PROTOCOL

After completing each phase:
1. Run `npx tsc --noEmit` — show me the output
2. Run `npm run lint` — show me the output
3. Write a brief summary: files created, key decisions made
4. Wait for my confirmation before starting the next phase

**I will reply "next" to proceed or flag issues to fix first.**

---

---

# PHASE 1 — FOUNDATION + AUTH

## Goal
Build the entire foundation layer (API client, stores, error handling, types, middleware) and all auth pages. Every subsequent phase depends on this being correct.

## Files to create (in this exact order)

### 1.1 — Types
**`types/api.ts`**
```typescript
// Global API response wrapper
interface ApiResponse<T> {
  success: boolean
  data: T
  message: string
  errorCode?: string
}

// User type
interface IUser {
  _id: string
  name: string
  email: string
  role: 'user' | 'admin'
  plan: {
    tier: 'free' | 'starter' | 'growth' | 'agency'
    status: 'active' | 'trialing' | 'past_due' | 'cancelled'
    periodEnd?: string
  }
  usage: {
    postsGenerated: number
    imagesGenerated: number
    videosGenerated: number
    voiceoversGenerated: number
    aiCostUsd: number
  }
  limits: {
    postsPerMonth: number
    imagesPerMonth: number
    videosPerMonth: number
    voiceoversPerMonth: number
    brandsAllowed: number
    aiCostLimitUsd: number
  }
  isVerified: boolean
  lang: 'ar' | 'en'
  phone?: string
  createdAt: string
}
```

**`types/brand.ts`** — IBrand, IBrandDNA, ITargetAudience, ArabicDialect enum
**`types/plan.ts`** — IMarketingPlan, IContentItem, PlanStatus, ContentType, ContentStatus enums
**`types/research.ts`** — IResearchJob, ResearchJobStatus enum
**`types/social.ts`** — ISocialAccount, SocialPlatform enum
**`types/billing.ts`** — ISubscription, IBillingUsage, PlanTier type
**`types/agent.ts`** — IChatMessage, IAgentMemory, MemoryCategory enum, IToolCall

### 1.2 — Error Codes
**`lib/errorCodes.ts`**
```typescript
export enum ErrorCode {
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  EMAIL_NOT_VERIFIED       = 'EMAIL_NOT_VERIFIED',
  OTP_EXPIRED              = 'OTP_EXPIRED',
  OTP_INVALID              = 'OTP_INVALID',
  ACCOUNT_SUSPENDED        = 'ACCOUNT_SUSPENDED',
  ACCOUNT_BANNED           = 'ACCOUNT_BANNED',
  ACCOUNT_INACTIVE         = 'ACCOUNT_INACTIVE',
  TOKEN_EXPIRED            = 'TOKEN_EXPIRED',
  TOKEN_INVALID            = 'TOKEN_INVALID',
  TOKEN_MISSING            = 'TOKEN_MISSING',
  RESOURCE_NOT_FOUND       = 'RESOURCE_NOT_FOUND',
  ALREADY_EXISTS           = 'ALREADY_EXISTS',
  FORBIDDEN                = 'FORBIDDEN',
  RATE_LIMIT_EXCEEDED      = 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED           = 'QUOTA_EXCEEDED',
  COST_LIMIT_EXCEEDED      = 'COST_LIMIT_EXCEEDED',
  VALIDATION_ERROR         = 'VALIDATION_ERROR',
  KILL_SWITCH_ACTIVE       = 'KILL_SWITCH_ACTIVE',
  IDEMPOTENCY_CONFLICT     = 'IDEMPOTENCY_CONFLICT',
  INTERNAL_ERROR           = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE      = 'SERVICE_UNAVAILABLE',
}
```

### 1.3 — API Client
**`lib/api/client.ts`**
- Axios instance, baseURL from `NEXT_PUBLIC_API_URL`
- Request interceptor: attach `Authorization: Bearer {token}` from Zustand store
- Response interceptor: on 401 → call `POST /api/auth/refresh` once silently → update store → retry original request. On second 401 → `clearAuth()` → redirect `/login`
- `withCredentials: true` (for httpOnly refresh token cookie)

### 1.4 — API Modules
**`lib/api/auth.ts`** — register, login, verifyEmail, resendOtp, forgotPassword, resetPassword, refreshToken, getMe, updateProfile, changePassword, logout

**`lib/api/brand.ts`** — createBrand, getBrands, getBrand, updateBrand, deleteBrand

**`lib/api/plan.ts`** — generatePlan, getPlan, getPlans, updateContentItem, approvePlan

**`lib/api/research.ts`** — startCrawl, getJob, getJobs

**`lib/api/agent.ts`** — sendMessage, getChatHistory, getMemory, deleteMemory, addMemory

**`lib/api/social.ts`** — getConnectUrl, getAccounts, publish, schedule, disconnect

**`lib/api/billing.ts`** — getUsage, createCheckout, cancelSubscription

**`lib/api/admin.ts`** — getPlatformStats, getUserGrowth, getContentMetrics, getAiUsage, getRevenue, getUsers, getUser, overridePlan, resetUsage

### 1.5 — Stores
**`stores/authStore.ts`**
- Zustand store
- State: `accessToken: string | null`, `user: IUser | null`, `isAuthenticated: boolean`
- Actions: `setAuth(token: string, user: IUser)`, `clearAuth()`, `setToken(token: string)`, `updateUser(user: Partial<IUser>)`
- Token in memory ONLY — no persistence

**`stores/brandStore.ts`**
- State: `brands: IBrand[]`, `activeBrand: IBrand | null`, `isLoading: boolean`
- Actions: `setBrands`, `setActiveBrand`, `addBrand`, `updateBrand`
- Persisted to sessionStorage (brandId only, not full object — re-fetch on load)

**`stores/uiStore.ts`**
- State: `sidebarCollapsed: boolean`, `activeKillSwitches: string[]`
- Actions: `toggleSidebar`, `setKillSwitches`

### 1.6 — Error Handler
**`lib/errorHandler.ts`**
Central function `handleApiError(error: unknown, router: AppRouterInstance): string | null`
- Returns inline error message string for field-level errors
- Returns null and navigates for account-level errors
- Calls toast for infrastructure errors

```
ErrorCode.AUTH_INVALID_CREDENTIALS → return error.response.data.message
ErrorCode.EMAIL_NOT_VERIFIED       → router.push('/verify-email?email=...'), return null
ErrorCode.OTP_EXPIRED              → return error.response.data.message
ErrorCode.OTP_INVALID              → return error.response.data.message
ErrorCode.ACCOUNT_SUSPENDED        → router.push('/suspended'), return null
ErrorCode.ACCOUNT_BANNED           → router.push('/banned'), return null
ErrorCode.RATE_LIMIT_EXCEEDED      → return error.response.data.message (caller shows countdown)
ErrorCode.QUOTA_EXCEEDED           → open QuotaExceededModal, return null
ErrorCode.VALIDATION_ERROR         → return error.response.data.message
ErrorCode.KILL_SWITCH_ACTIVE       → toast (amber), return null
ErrorCode.INTERNAL_ERROR           → toast (red), return null
default                            → toast (red), return null
```

### 1.7 — Socket Client
**`lib/socket.ts`**
- Socket.io client instance, lazy initialization
- `getSocket(token: string): Socket` — connects with auth token, returns singleton
- `disconnectSocket(): void`
- Typed event constants matching backend events

### 1.8 — Middleware
**`middleware.ts`**
- Protects `/dashboard/*` — unauthenticated → redirect `/login`
- Protects `/admin/*` — non-admin → redirect `/dashboard`
- Authenticated users on `/login`, `/register` → redirect `/dashboard`
- Auth state determined by presence of refresh token cookie (httpOnly, so check via a lightweight `/api/auth/me` ping or trust the cookie existence)

### 1.9 — Auth Layout
**`app/(auth)/layout.tsx`**
- No sidebar, no header
- Full viewport, bg `#0f1117`, subtle radial teal glow center
- Logo + platform name centered above card
- Card: `max-w-[420px]`, `bg-[#1a1d27]`, `rounded-xl`, `p-8`, `shadow-[0_24px_64px_rgba(0,0,0,0.6)]`

### 1.10 — Shared Auth Components
**`components/auth/OtpInput.tsx`**
- 6 individual inputs, 52×52px each, row layout
- Auto-advance on digit entry
- Backspace returns to previous
- Paste: spread across all 6
- Calls `onComplete(otp: string)` when all 6 filled

**`components/auth/GoogleSignInButton.tsx`**
- `window.location.href = process.env.NEXT_PUBLIC_API_URL + '/api/auth/google'`
- Google SVG icon, "الدخول بحساب Google", bg-elevated, full width

**`components/auth/CountdownTimer.tsx`**
- Props: `seconds: number`, `onComplete: () => void`
- Arabic text: "إعادة الإرسال بعد ٤٥ ثانية"
- Hides when countdown reaches 0

**`components/auth/PasswordStrengthBar.tsx`**
- 4 segments, RTL fill direction
- Strength: weak (red) → fair (orange) → good (yellow) → strong (green)
- Checks: length ≥8, uppercase, number, special char

### 1.11 — Auth Pages
**`app/(auth)/login/page.tsx`** + **`components/auth/LoginForm.tsx`**
Layout from UI_SPEC.md Section 3:
- Heading "أهلاً بيك تاني 👋"
- Email + password fields (show/hide toggle on password)
- "نسيت كلمة السر؟" end-aligned link
- Primary teal button "سجّل الدخول"
- Divider "── أو ──"
- GoogleSignInButton
- Footer link to /register
- Inline field errors (never toast for auth errors)
- On success: store token + user → redirect `/dashboard`

**`app/(auth)/register/page.tsx`** + **`components/auth/RegisterForm.tsx`**
- Fields: name, email, password + PasswordStrengthBar, phone (optional)
- On success → redirect `/verify-email?email={email}`

**`app/(auth)/verify-email/page.tsx`**
- Reads `email` from searchParams
- OtpInput (6 boxes) + auto-submit
- Resend button disabled 60s with CountdownTimer
- On success → redirect `/dashboard`

**`app/(auth)/forgot-password/page.tsx`**
- Two-step single page (no navigation between steps)
- Step 1: email input → "إرسال الكود"
- Step 2 (after step 1 success): OtpInput + new password + confirm → "تغيير كلمة السر"
- Step indicator at top

**`app/(auth)/reset-password/page.tsx`**
- Reads `email` + `otp` from searchParams (deep link from email)
- New password + confirm password
- On success → redirect `/login`

**`app/(auth)/suspended/page.tsx`** + **`app/(auth)/banned/page.tsx`**
- Simple centered message pages
- Contact support link

---

# PHASE 2 — DASHBOARD SHELL

## Goal
Build the persistent layout that wraps every dashboard page: sidebar, header, brand switcher. This is the container everything lives inside.

## Files to create

**`app/(dashboard)/layout.tsx`**
- Sidebar (260px, fixed) + main content area (flex-1, overflow-y-auto)
- Header (56px, fixed top of content area)
- Mobile: sidebar hidden, bottom tab bar shown

**`components/layout/Sidebar.tsx`**
- Logo + platform name at top
- BrandSwitcher below logo
- Nav items (from UI_SPEC.md Section 2):
  - 🏠 الرئيسية → `/dashboard`
  - 🤖 الوكيل → `/dashboard/agent`
  - 📅 الخطط → `/dashboard/plans`
  - 🔍 البحث → `/dashboard/research`
  - 📱 السوشيال → `/dashboard/social`
  - 🧠 الذاكرة → `/dashboard/memory`
- Active state: teal `border-s-4` + bg-elevated + teal text
- UsageMeter at bottom (posts quota, turns amber at 80%, red at 100%)
- Upgrade CTA button (amber gradient) — only shown for free/starter tiers
- Settings + profile links at very bottom
- Collapsed to 64px on mobile (icons only)

**`components/layout/Header.tsx`**
- Breadcrumb (start side, RTL)
- Search icon (expands inline on click)
- Notification bell with unread count badge
- User avatar dropdown: profile, settings, logout
- KillSwitchBanner — renders ABOVE header when READ_ONLY_MODE active (amber, full-width, dismissible)

**`components/layout/BrandSwitcher.tsx`**
- Shows active brand name + avatar
- Dropdown: all user brands with avatars
- "إضافة براند جديد" button at bottom of dropdown
- On brand change: update brandStore, re-fetch relevant data

**`components/layout/BottomTabBar.tsx`** (mobile only)
- 5 tabs: Home, Agent, Plans, Social, Billing
- Icons + Arabic labels
- Active tab: teal color

**`components/layout/KillSwitchBanner.tsx`**
- Amber background, full width, pinned above header
- Message: "🔧 المنصة في وضع القراءة فقط دلوقتي. شغالين على الموضوع — هنرجع قريباً."
- Dismiss button — hides for 5 minutes (sessionStorage flag)
- Fetches active kill switches from `GET /api/health` on mount

**`components/layout/NotificationDropdown.tsx`**
- Last 10 notifications
- Each: icon + Arabic text + relative timestamp
- Mark all as read button
- Empty state if none

**`app/(dashboard)/dashboard/page.tsx`** — placeholder "أهلاً [name]" page (full brand overview built in Phase 3)

---

# PHASE 3 — ONBOARDING + BRAND PAGES

## Goal
Build the onboarding wizard (blocks dashboard until complete) and all brand-related pages.

## Files to create

**`app/(dashboard)/onboarding/page.tsx`**
Full-screen wizard, 5 steps, blocks dashboard for new users.

Step indicator component at top:
① البراند ── ② المنتجات ── ③ السوق ── ④ الهوية ── ⑤ السوشيال

**`components/onboarding/StepIndicator.tsx`**
- Teal circle = active, teal filled + checkmark = completed, muted = future

**`components/onboarding/Step1_BrandUrl.tsx`**
- Centered URL input
- "ابدأ التحليل" button → triggers research crawl
- Transitions to MagicScanAnimation

**`components/onboarding/MagicScanAnimation.tsx`**
- Full-screen overlay during scrape
- Spider animation (CSS/Framer Motion) crawling a simplified wireframe
- Status lines stream in one by one via Socket.io `research:page` events:
  "🔍 بنحلل الموقع..." → "📄 لقينا X صفحة" → "🎨 استخرجنا الألوان والشعار" → "📦 لقينا X منتجات" → "✅ خلصنا!"
- On completion → transition to Step2

**`components/onboarding/Step2_IdentityVerification.tsx`**
Split panel from UI_SPEC.md Section 4:
- Left: detected brand identity (logo preview, colors, industry dropdown to correct)
- Right: product grid (auto-detected cards, each editable/deletable, + add missing products)
- Product card: thumbnail + editable name + delete button
- "إضافة منتج" → file upload or URL input modal

**`components/onboarding/Step3_MarketSetup.tsx`**
- Target country (Egypt pre-selected)
- Target city (Cairo pre-selected, searchable dropdown)
- Age range slider (dual handle)
- Gender select
- Interests multi-select tags

**`components/onboarding/Step4_BrandDNA.tsx`**
Split panel (agent chat left, live Brand DNA card right):
- Agent asks structured questions about tone, audience, UVP
- Brand DNA card fills in real-time as agent extracts answers
- DialectSelector prominent dropdown: مصري | سعودي | خليجي | شامي | مغربي | فصحى | English

**`components/onboarding/Step5_SocialConnect.tsx`**
- Platform connect cards: Facebook, Instagram, TikTok, LinkedIn, YouTube
- Each: platform icon + "ربط الحساب" button → OAuth redirect
- Skip option: "ربط لاحقاً"
- On finish → redirect `/dashboard`

**`app/(dashboard)/brands/page.tsx`**
- Grid of BrandCard components
- Empty state if no brands
- "إضافة براند جديد" button → triggers onboarding flow

**`components/brand/BrandCard.tsx`**
- Brand logo/avatar, name, industry, connected platforms icons
- Quick stats: active plans count, last activity
- Click → navigate to brand overview

**`app/(dashboard)/brands/[brandId]/page.tsx`** (Brand Overview)
Layout from UI_SPEC.md Section 5:
- 4 metric cards (active plans, today's content, connected platforms, running research)
- Quick action buttons (talk to agent, create plan, research competitor, publish)
- Recent content list (last 3 items with thumbnails)

**`app/(dashboard)/brands/[brandId]/settings/page.tsx`**
- Brand DNA editor (tone, dialect, colors, UVP)
- Target audience editor

**`app/(dashboard)/brands/[brandId]/assets/page.tsx`**
- Upload zone for logos, fonts, brand files
- Asset grid with delete

**`app/(dashboard)/brands/[brandId]/documents/page.tsx`**
- Upload PDFs, DOCX brand guides
- Document list with preview + delete

---

# PHASE 4 — AGENT CHAT PAGE

## Goal
Build the most important page in the app: the AI agent chat with real-time streaming, tool call visualization, context panel, and dialect switching.

## Files to create

**`app/(dashboard)/brands/[brandId]/agent/page.tsx`**
Full-height split-screen layout from UI_SPEC.md Section 6.

**`components/agent/ChatWindow.tsx`**
- Scrollable message list, flex-col
- Auto-scrolls to bottom on new messages
- Pauses auto-scroll if user has scrolled up
- "رسالة جديدة ↓" floating button when paused with new messages incoming

**`components/agent/MessageBubble.tsx`**
Props: `message: IChatMessage`
- User bubble: end-aligned, bg-primary, text-white, radius-xl
- Agent bubble: start-aligned, bg-elevated, text-primary, radius-xl
- Renders markdown in agent messages (bold, lists, code blocks)
- Streaming: renders `content` as it arrives, amber blinking cursor at end while streaming

**`components/agent/ToolCallBadge.tsx`**
Props: `toolCall: IToolCall`
- Full-width card, bg-elevated, teal start-border (4px)
- Icon + tool name + status (spinning amber = running, green check = done, red × = failed)
- Collapsible: click to expand/collapse tool result
- Tool result: rendered in a dark code-style block
- Updates in place as status changes (no re-mount)

**`components/agent/TypingIndicator.tsx`**
- Three animated dots, start-aligned
- Shown while agent is processing but before first streaming token arrives

**`components/agent/ChatInput.tsx`**
- Textarea (auto-resize, max 6 rows)
- Paperclip icon for file attachment (PDF, image)
- Send button (teal) — disabled while sending
- File chips above input when files attached: "[📄 filename.pdf ×]"
- PDF parseWarning chip in amber if backend returns one
- Ctrl+Enter or Cmd+Enter to send
- Enter alone = new line

**`components/agent/ContextPanel.tsx`**
Right panel, collapsible (260px wide):
- Brand DNA summary (tone, dialect)
- Active plan info (month, status)
- Usage quota bar (posts remaining)
- Last research job (competitor name, status)
- Collapse button → panel hides, main chat expands

**`components/agent/MemoryIndicator.tsx`**
Header badge: "🧠 ١٢ ذكرى"
- Teal pill
- Click → navigate to `/brands/[brandId]/memory`

**`components/agent/DialectToggle.tsx`**
Floating pill, top-start corner of chat area:
- Current dialect displayed: "[🗣️ مصري ▼]"
- Click → dropdown with all 7 dialect options
- On change → send message to agent asking to rewrite last caption in new dialect

**Socket.io integration (in agent page):**
Connect on mount using `getSocket(accessToken)`.
Listen to events:
- `agent:token` → append to streaming message
- `agent:tool_start` → add ToolCallBadge with pending state
- `agent:tool_result` → update ToolCallBadge with result
- `agent:done` → mark message complete, hide TypingIndicator
- `agent:error` → show error bubble
Disconnect on unmount.

**Rate limit UX:**
On `RATE_LIMIT_EXCEEDED`:
- Disable input + send button
- Show inline under input: "⏳ بعت رسايل كتير أوي — إرسال بعد ٤٢ ثانية"
- Countdown with enable on complete
- Never a toast

---

# PHASE 5 — CONTENT CALENDAR + PLAN PAGES

## Goal
Build the marketing plan pages, content calendar with generation pipeline, and the content item editor with asset slots, version history, and object eraser.

## Files to create

**`app/(dashboard)/brands/[brandId]/plans/page.tsx`**
- List of all plans for this brand
- Each plan: month/year, status badge, content count, approve/view button
- "إنشاء خطة جديدة" button → opens CreatePlanModal

**`components/plan/CreatePlanModal.tsx`**
Fields: month (dropdown), year, posts per month (slider 4–30).
Cost estimate shown before confirming (calculated from posts × average cost).
Uses "press and hold" confirm button (1.5s hold to fire) from UI_SPEC.md.

**`app/(dashboard)/brands/[brandId]/plans/[planId]/page.tsx`**
Tab layout: [📅 التقويم] [📋 القائمة]

**`components/plan/CalendarGrid.tsx`**
From UI_SPEC.md Section 7:
- 7-column calendar (RTL: السبت → الأحد column order)
- Arabic day names, Arabic numerals
- Content cards in cells
- Month navigation (← →)
- Toggle between calendar and list view

**`components/plan/ContentCard.tsx`** (calendar cell card)
- 40×40px thumbnail (shimmer placeholder if no image yet)
- Platform icon + content type label
- Status dot (gray/blue/teal/purple/green) + Arabic status label
- Click → opens ContentItemEditor as right slide-in panel

**`components/plan/ContentItemEditor.tsx`**
Right panel (400px), slides in from end side.
From UI_SPEC.md Section 7:
- Large asset preview at top
- Object Eraser button (🖌️) overlaid on image
- "تحسين الجودة" upscale button
- Version history thumbnail strip below preview
- Asset slots section: Caption, Image, Design, Video, Voice (only relevant ones per content type)
- Each slot shows: asset type, generating model badge, status, content preview, edit button
- Action buttons: اعتمد / جدول / انشر الآن

**`components/plan/AssetSlotRow.tsx`**
Single asset row:
- Asset type icon + label
- Model badge (e.g., "Claude Sonnet", "DALL-E 3")
- Status: pending (gray) | generating (spinner + progress bar) | ready (green check) | failed (red + retry)

**`components/plan/ObjectEraser.tsx`**
- Canvas overlay on the image preview
- Brush cursor when active
- Draws semi-transparent red mask where user drags
- "مسح الاختيار" to clear mask
- "تطبيق" button → fires with mask bounds to agent chat

**`components/plan/VersionHistoryStrip.tsx`**
- Horizontal scrollable row of version thumbnails
- Each: 48×48px, version label, teal border on current
- Click → preview that version (read-only)
- "استرجع هذه النسخة" button on old versions

**`components/plan/GenerationProgressBanner.tsx`**
Shown during bulk generation after plan approval:
- Overall progress bar: "جاري توليد المحتوى — 8/12 مكتمل"
- Individual item dots (clickable)
- Collapses when all done

**`components/plan/PlanApproveButton.tsx`**
"Press and Hold" UX from UI_SPEC.md:
- 1.5 second hold to confirm approval
- Teal fill sweeps from start to end while held
- Release before complete = cancel
- Full fill = fires `PUT /api/plan/:id/approve`
- Shows CostConfirmModal before hold interaction

**`components/plan/CostConfirmModal.tsx`**
From UI_SPEC.md Section 11:
- Lists all assets to be generated
- Shows quota impact per asset type
- Warns if will exceed quota (red indicator)
- Cancel / Confirm buttons

---

# PHASE 6 — COMPETITOR RESEARCH PAGE

## Goal
Build the research jobs list and the live terminal detail view for competitor analysis.

## Files to create

**`app/(dashboard)/brands/[brandId]/research/page.tsx`**
From UI_SPEC.md Section 8:
- Research jobs list (competitor URL, status badge, pages scraped, date, view/retry buttons)
- "بحث منافس جديد" button → opens StartResearchModal

**`components/research/StartResearchModal.tsx`**
Fields: competitor URL, scraping tier (Basic/Deep dropdown).
Idempotency-Key generated client-side (UUID v4) and sent with request.

**`components/research/ResearchJobCard.tsx`**
- Competitor URL + favicon
- Status badge (جاري/مكتمل/فشل) with correct colors
- Pages scraped count
- Date (Arabic relative: "منذ ٣ أيام")
- View button / Retry button if failed

**`app/(dashboard)/brands/[brandId]/research/[jobId]/page.tsx`**
Job detail page with live terminal.

**`components/research/LiveTerminal.tsx`**
From UI_SPEC.md Section 8:
- Dark bg panel, Cairo font (not monospace — still Arabic-readable)
- Each scraped page as a row: icon (📄/⚠️/🛡️) + page path + extracted excerpt
- Auto-scrolls to latest (pauses if user scrolls up)
- Sanitized badge (amber "تم تنظيف المحتوى") on flagged pages
- Socket.io: listens to `research:page` events while job is running
- Polling fallback: `GET /api/research/job/:id` every 5s if Socket.io not available

**`components/research/SourceCard.tsx`**
For each completed source:
- URL + external link icon
- Sanitized badge if content was cleaned
- Extracted excerpt (collapsible to full)
- Copy button for the excerpt

---

# PHASE 7 — IDEA SWIPE PAGE

## Goal
Build the Tinder-style content preference training interface that feeds AgentLearning in the backend.

## Files to create

**`app/(dashboard)/brands/[brandId]/swipe/page.tsx`**
From UI_SPEC.md Section 5B.

**`components/swipe/SwipeCard.tsx`**
- Large content preview card (image + caption + content type)
- Framer Motion drag gesture (x-axis only)
- Drag right past threshold → approve (green overlay + ✓)
- Drag left past threshold → reject (red overlay + ✗)
- Snap back to center if released before threshold
- RTL: right = approve (teal direction)

**`components/swipe/SwipeControls.tsx`**
- [✗ مش مناسب] and [✓ يعجبني] buttons below card
- Keyboard: → key = approve, ← key = reject

**`components/swipe/SwipeProgress.tsx`**
- "١٢ / ٢٠ بطاقة" progress indicator
- Done state: "🎉 خلصت! الوكيل اتعلم ذوقك" with summary of preferences learned

**Backend wiring:**
- Right swipe → `POST /api/agent/memory` body: `{ brandId, category: 'preference', content: 'وافق على هذا النوع من المحتوى: [content type + style description]', source: 'IdeaSwipe' }`
- Left swipe → `POST /api/agent/memory` body: `{ brandId, category: 'preference', content: 'رفض هذا النوع من المحتوى: [content type + style description]', source: 'IdeaSwipe' }`
- Batch: collect swipes locally, flush to backend every 5 swipes (not 1 request per swipe)

---

# PHASE 8 — SOCIAL ACCOUNTS PAGE

## Goal
Build the social media account connection management page.

## Files to create

**`app/(dashboard)/brands/[brandId]/social/page.tsx`**

**`components/social/PlatformConnectCard.tsx`**
For each platform (Facebook, Instagram, TikTok, LinkedIn, YouTube):
- Platform logo (colored SVG)
- Platform name in Arabic + English
- If connected: account name/page name, green connected badge, disconnect button
- If not connected: "ربط الحساب" teal button → `GET /api/social/connect/{platform}?brandId={id}` → redirect to authUrl
- Connecting state: spinner

**`components/social/ConnectedAccountBadge.tsx`**
- Platform icon + page/profile name
- Follower count (if available)
- Connected since date
- Disconnect button (requires confirmation modal)

**`components/social/DisconnectConfirmModal.tsx`**
"هل أنت متأكد إنك عايز تفصل حساب [Platform] '[AccountName]'؟"
Cancel / Disconnect (red, hold-to-confirm 1.5s)

**OAuth callback handling:**
`app/(dashboard)/social/callback/page.tsx` — shows "جاري الاتصال..." spinner while backend processes, then redirects back to social page with success/error message.

---

# PHASE 9 — BILLING PAGE

## Goal
Build the billing and subscription management page with dynamic usage meters, plan cards, and checkout flow.

## Files to create

**`app/(dashboard)/billing/page.tsx`**
From UI_SPEC.md Section 9.

**`components/billing/UsageMeter.tsx`**
Props: `used: number`, `limit: number`, `label: string`, `unit: string`
- Progress bar: teal fill, amber at >80%, red at >95%
- Label: "المنشورات — 8 / 12"
- NEVER hardcode the limit number — always from props

**`components/billing/CostBreakdown.tsx`**
- Total cost vs limit (progress bar)
- Per-model breakdown rows: model name + cost + mini bar
- Auto-expands if total > 50% of limit
- All numbers from API — never hardcoded

**`components/billing/PlanCard.tsx`**
Props: `tier`, `price`, `features`, `isCurrent`, `onUpgrade`
- Current plan: teal border + "الخطة الحالية" badge
- Upgrade target: amber CTA button
- Feature list dynamically from API (not hardcoded)
- Grayed out features user doesn't have access to

**`components/billing/PlanStatusBanner.tsx`**
- `past_due`: red banner "🔴 فشل تجديد اشتراكك — [تحديث بيانات الدفع]"
- `trialing`: amber banner "🟡 تجربة مجانية — تنتهي في [date]"
- `cancelled`: gray banner "الاشتراك منتهي — [تجديد]"

**`components/billing/QuotaExceededModal.tsx`**
From UI_SPEC.md Section 11:
- What was exceeded (posts/images/video etc.)
- What they'd get by upgrading to next tier
- Cancel / Upgrade CTA

**`components/billing/CheckoutButton.tsx`**
- Calls `POST /api/billing/checkout` with tier + billingCycle
- Generates Idempotency-Key (UUID v4)
- Redirects to `checkoutUrl` (Paymob)

**`app/(dashboard)/billing/success/page.tsx`**
Post-Paymob return page: success message, updated plan summary, "ابدأ الاستخدام" button.

**`app/(dashboard)/billing/cancel/page.tsx`**
Post-Paymob cancel return: gentle message, retry option.

---

# PHASE 10 — ADMIN DASHBOARD

## Goal
Build the admin-only section: platform metrics, kill switch status, user management, AI usage analytics.

## Files to create

**`app/(admin)/layout.tsx`**
Same shell as dashboard but with admin-specific sidebar items.
Middleware already protects this route group (non-admins → redirect dashboard).

**`app/(admin)/admin/page.tsx`** (Platform Overview)
From UI_SPEC.md Section 10:

**`components/admin/PlatformMetricCard.tsx`**
4-column grid:
- Total users (with today's delta)
- Monthly revenue (EGP)
- AI cost this month (USD)
- Pending queue jobs

**`components/admin/KillSwitchPanel.tsx`**
- Red alert card if any switches active
- Lists each active switch with Arabic name
- Links to .env instructions for deactivation
- Green card if all switches inactive: "✅ كل السيستمات شغالة"

**`components/admin/AIUsageChart.tsx`**
- Recharts BarChart — per-model cost breakdown
- Date range selector (7d / 30d / 90d)
- Tooltip with Arabic labels

**`app/(admin)/admin/users/page.tsx`**
- Searchable, filterable user table
- Columns: name, email, plan tier, status, AI cost, joined date, actions
- Mobile: card list

**`components/admin/UserTable.tsx`**
**`components/admin/UserDetailDrawer.tsx`**
Right drawer with full user detail:
- Profile info
- Plan + billing status
- Usage stats
- AI cost history (small chart)
- Actions: Override Plan, Reset Usage, Extend Subscription, Suspend, Ban

**`components/admin/PlanOverrideForm.tsx`**
- Tier select + period end date
- Confirms before saving

---

# PHASE 11 — POLISH & PRODUCTION READINESS

## Goal
Complete the app: empty states, loading skeletons, toast system, mobile responsiveness, error boundaries, and SEO metadata.

## Files to create

### Toast System
**`components/ui/ToastProvider.tsx`**
- Bottom-center positioning (RTL: bottom-center, same)
- Dark card + colored start-border
- Success (green), Error (red), Info (teal), Warning (amber)
- 4-second auto-dismiss with slide-up animation
- Max 3 toasts stacked

**`lib/toast.ts`**
- `toast.success(message)`
- `toast.error(message)`
- `toast.info(message)`
- `toast.warning(message)`

### Empty States
**`components/ui/EmptyState.tsx`**
Props: `illustration`, `title`, `description`, `action?: { label, onClick }`

Implement specific empty states (from UI_SPEC.md Section 12) for:
- No brands
- No plans
- No content generated
- No research jobs
- Agent memory empty
- No social accounts connected
- No notifications

### Loading Skeletons
**`components/ui/Skeleton.tsx`** — base shimmer component
**`components/ui/SkeletonCard.tsx`** — card-shaped skeleton
**`components/ui/SkeletonTable.tsx`** — table rows skeleton
**`components/ui/SkeletonCalendar.tsx`** — calendar grid skeleton

Each page should have a `loading.tsx` file (Next.js 15 convention) that renders the matching skeleton.

### Error Boundaries
**`components/ui/ErrorBoundary.tsx`**
- Catches render errors
- Shows Arabic error message + retry button
- Reports to Sentry (if configured)

**`app/error.tsx`** — global error page
**`app/not-found.tsx`** — 404 page (Arabic)

### Feature Guard
**`components/ui/PlanFeatureGuard.tsx`**
From UI_SPEC.md Section 17:
- Wraps features that require higher plan
- Shows lock overlay with upgrade CTA
- Never hides the feature — always shows locked state
- Props: `requiredTier`, `currentTier`, `children`

### Mobile Responsiveness Audit
For every page built in Phases 2–10:
- Sidebar → bottom tab bar on mobile (already built in Phase 2)
- Content calendar → list view on mobile
- Agent chat → full screen, context panel hidden (toggle button)
- Admin tables → card list on mobile
- All modals → full-screen sheet on mobile

### SEO + Metadata
**`app/layout.tsx`** — root layout
- Cairo + Inter fonts loaded via `next/font`
- Default metadata (Arabic)
- `<html lang="ar" dir="rtl">`

Page-level metadata for all main pages.

### Environment Variables (`.env.example`)
```
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=منصتك التسويقية
```

---

## FINAL QUALITY GATE (after Phase 11)

```bash
npx tsc --noEmit
npm run lint
npm run build
```

All three must pass with 0 errors and 0 warnings.

Report the output of all three commands.

---

## START NOW

Begin with **Phase 1**. Work through it file by file in the exact order listed. Run `tsc --noEmit` after every file. When Phase 1 is complete and clean, report back with:

1. The full `tsc --noEmit` output
2. The full `npm run lint` output  
3. A list of all files created
4. Any architectural decisions you made that weren't specified

Wait for my confirmation before starting Phase 2.
