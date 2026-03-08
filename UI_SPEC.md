# UI/UX Specification — AI Marketing Platform
# Visual Reference: Holo AI (tryholo.ai)
# Stack: Next.js 15 + Tailwind CSS v4 + shadcn/ui + Cairo/Inter fonts
# Market: Egypt & Arab World (RTL default)

---

## 1. VISUAL LANGUAGE — "THE MAGIC CANVAS"

### Color System
```css
/* Structural (Sidebar, Header, Cards) */
--bg-base:        #0f1117   /* Near-black canvas — main app background */
--bg-surface:     #1a1d27   /* Card / panel surface */
--bg-elevated:    #22263a   /* Elevated cards, dropdowns, modals */
--bg-sidebar:     #13151f   /* Sidebar background — slightly darker than base */
--border:         #2a2d3e   /* Subtle borders between elements */
--border-active:  #0d7e8a   /* Teal border on focused/active elements */

/* Brand Colors */
--primary:        #0d7e8a   /* Deep Teal — navigation, headers, selected states */
--primary-hover:  #0a6b75
--primary-glow:   rgba(13,126,138,0.15)  /* Glow behind AI action buttons */
--accent:         #f5a623   /* Warm Amber — "Magic" AI actions, CTAs, highlights */
--accent-hover:   #e09415
--accent-glow:    rgba(245,166,35,0.15)

/* Text */
--text-primary:   #f0f2f8   /* Main readable text */
--text-secondary: #8b8fa8   /* Secondary labels, metadata */
--text-muted:     #545770   /* Placeholder, disabled */

/* Status */
--success:        #22c55e
--warning:        #f5a623   /* Same as accent — consistent */
--danger:         #ef4444
--info:           #0d7e8a   /* Same as primary */

/* Special — AI Magic effect */
--magic-gradient: linear-gradient(135deg, #0d7e8a 0%, #f5a623 100%)
```

### Typography
```css
/* Arabic (RTL) — Cairo */
font-family: 'Cairo', sans-serif;
/* English (LTR) — Inter */
font-family: 'Inter', sans-serif;

/* Scale */
--text-xs:   11px   /* Tags, badges */
--text-sm:   13px   /* Secondary UI, timestamps */
--text-base: 15px   /* Body, chat messages */
--text-lg:   17px   /* Card titles */
--text-xl:   20px   /* Section headings */
--text-2xl:  24px   /* Page titles */
--text-3xl:  30px   /* Hero text, onboarding steps */
```

### Elevation & Shadows (dark theme)
```css
--shadow-card:   0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px var(--border)
--shadow-modal:  0 24px 64px rgba(0,0,0,0.6)
--shadow-glow-primary: 0 0 20px rgba(13,126,138,0.3)
--shadow-glow-accent:  0 0 20px rgba(245,166,35,0.3)
```

### Border Radius
```css
--radius-sm:   4px    /* Badges, input fields */
--radius-md:   8px    /* Cards, buttons */
--radius-lg:   12px   /* Modals, large panels */
--radius-xl:   16px   /* Chat bubbles */
--radius-full: 9999px /* Pills, avatars */
```

### Micro-interactions (Framer Motion)
- **Page transitions:** fade + slide 8px (200ms ease-out)
- **Card hover:** scale(1.01) + shadow-glow (150ms)
- **AI "Magic" button:** pulse glow animation on idle, solid on hover
- **Loading skeletons:** animated gradient shimmer (#1a1d27 → #22263a)
- **Success states:** brief green flash then fade to normal
- **Streaming text:** character-by-character reveal (no cursor blink)
- **"Press and Hold" dashboard entry:** High-value areas (approve plan, publish) use a 1.5s hold-to-confirm interaction. Button fills with teal from left while held. Releases = cancels. Full fill = action fires. Prevents accidental triggers.
- **RTL swipe direction:** All swipe/drag gestures flow right-to-left (swipe RIGHT = approve, swipe LEFT = reject — matches Arabic reading direction)

---

## 2. GLOBAL LAYOUT — DASHBOARD SHELL

```
┌──────────────────────────────────────────────────────────────────┐
│ SIDEBAR (260px fixed, bg-sidebar)          HEADER (56px fixed)   │
│ ┌──────────────┐ ┌────────────────────────────────────────────┐  │
│ │ Logo + Name  │ │ Breadcrumb        [Search] [Notif] [Avatar]│  │
│ ├──────────────┤ ├────────────────────────────────────────────┤  │
│ │ Brand        │ │                                            │  │
│ │ Switcher     │ │         PAGE CONTENT AREA                  │  │
│ ├──────────────┤ │         (scrollable, p-6)                  │  │
│ │ NAV ITEMS    │ │                                            │  │
│ │              │ │                                            │  │
│ │ 🏠 الرئيسية  │ │                                            │  │
│ │ 🤖 الوكيل   │ │                                            │  │
│ │ 📅 الخطط    │ │                                            │  │
│ │ 🔍 البحث    │ │                                            │  │
│ │ 📱 السوشيال │ │                                            │  │
│ │ 🧠 الذاكرة  │ │                                            │  │
│ ├──────────────┤ │                                            │  │
│ │ USAGE METER  │ │                                            │  │
│ │ ████░░ 8/12  │ │                                            │  │
│ ├──────────────┤ └────────────────────────────────────────────┘  │
│ │ 💳 ترقّى     │                                                  │
│ │ ⚙️ إعدادات  │                                                  │
│ └──────────────┘                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Sidebar Details
- **Width:** 260px desktop, slides off-canvas on mobile (drawer)
- **Brand Switcher:** Top of sidebar below logo. Dropdown with brand avatars + "إضافة براند" button
- **Nav items:** Icon (20px) + Arabic label. Active state: teal left border (4px) + bg-elevated background + teal text
- **Usage Meter:** Compact progress bar for posts quota. Turns amber at 80%, red at 100%
- **Upgrade CTA:** Amber gradient button at bottom — only shown on Free/Starter tiers
- **Collapsed sidebar (mobile):** Icons only, 64px wide. Tooltip on hover.

### Header Details
- **Height:** 56px, bg-surface, bottom border
- **Left (RTL: Right):** Page breadcrumb in text-secondary
- **Right (RTL: Left):** Search icon → expands inline | Notification bell with badge | Avatar dropdown (profile, settings, logout)
- **Kill switch banner:** Appears ABOVE header when `READ_ONLY_MODE` active. Amber background, full-width, dismissible after 5min.

---

## 3. AUTH PAGES

### Layout
- Centered vertically and horizontally
- Background: `--bg-base` with subtle radial gradient (#0d7e8a at 5% opacity, center)
- Card: `max-w-[420px]`, `bg-surface`, `radius-lg`, `shadow-modal`, `p-8`
- Logo centered above card

### Login Page
```
┌─────────────────────────────────┐
│         [Logo + اسم المنصة]      │
│                                 │
│  أهلاً بيك تاني 👋               │
│  سجّل دخولك عشان تكمل            │
│                                 │
│  [_____ البريد الإلكتروني _____] │
│  [________ كلمة السر __________] │
│                          [نسيت؟] │
│                                 │
│  [████ سجّل الدخول ████████████] │
│                                 │
│  ─────────── أو ───────────     │
│                                 │
│  [G  الدخول بحساب Google      ] │
│                                 │
│  مش عندك حساب؟  [سجّل هنا]       │
└─────────────────────────────────┘
```
- Primary button: teal gradient, full width, 44px height
- Google button: bg-elevated, white Google icon, border
- Error: red text inline under the field (not toast)
- `AUTH_INVALID_CREDENTIALS` → red inline under password field

### Register Page
Same card layout, fields: name, email, password (show/hide toggle), phone (optional).
Progress indicator not needed — single step.
After submit → redirect to `/verify-email?email=...`

### Verify Email Page
```
┌─────────────────────────────────┐
│  📧 تحقق من إيميلك               │
│  بعتنا كود لـ ahmed@test.com     │
│                                 │
│  [_] [_] [_]  [_] [_] [_]      │  ← 6 boxes, auto-focus
│                                 │
│  [████ تأكيد الكود █████████]   │
│                                 │
│  ما وصلكش الكود؟                 │
│  [إعادة الإرسال] ← disabled 60s │
│  (إعادة الإرسال بعد ٤٥ ثانية)   │
└─────────────────────────────────┘
```
- Each OTP digit = separate input, 52px × 52px, center-aligned
- Auto-advance to next box on input
- Auto-submit when 6th digit entered
- Countdown timer displayed inline under resend button

---

## 4. ONBOARDING — "THE MAGIC SCAN"

Full-screen wizard. Blocks dashboard until complete.

### Step Indicator (top of screen)
```
① براند  ──  ② السوق  ──  ③ الهوية  ──  ④ المنافسين  ──  ⑤ السوشيال
```
Active step: teal circle. Completed: teal filled with checkmark. Future: muted.

### Step 1 — Brand Basics
Center-focused, minimal:
```
ادخل رابط موقع البراند بتاعك

[🌐 https://yourwebsite.com          ]
           [→ ابدأ التحليل]
```
Button triggers the "Magic Scan" animation.

### Magic Scan Animation (while scraper runs)
Full-screen overlay. Spider animation crawling across a simplified site wireframe.
Status text streams live:
```
🔍 بنحلل الموقع...
📄 لقينا 12 صفحة
🎨 استخرجنا الألوان والشعار
📦 لقينا 5 منتجات
✅ خلصنا التحليل!
```
Each line fades in as the scraper progresses (via Socket.io `research:page` events).

### Step 2 — Identity Verification (NEW — from Holo video)
After scan completes, show a review grid BEFORE proceeding. User confirms or corrects what was extracted.

```
┌─────────────────────────────────────────────────────────────┐
│ ✅ تم تحليل الموقع — راجع النتائج                           │
├──────────────────┬──────────────────────────────────────────┤
│ هوية البراند     │ المنتجات المكتشفة                        │
│                  │                                          │
│ [Logo preview]   │ ┌──────┐ ┌──────┐ ┌──────┐ [+ إضافة]  │
│ الألوان:         │ │[img] │ │[img] │ │[img] │             │
│ ● #0d7e8a       │ │منتج١ │ │منتج٢ │ │منتج٣ │             │
│ ● #f5a623       │ │[✏️]  │ │[✏️]  │ │[×]   │             │
│                  │ └──────┘ └──────┘ └──────┘             │
│ الصناعة:        │                                          │
│ أكل وشراب ✓     │ اسحب صورة هنا أو [اختار من جهازك]       │
│ [تغيير]         │                                          │
└──────────────────┴──────────────────────────────────────────┘
│                    [← رجوع]  [التالي — حدد السوق →]        │
└─────────────────────────────────────────────────────────────┘
```
- Each product card: thumbnail + editable name + delete button
- "إضافة منتج" → file upload or URL input
- Wrong industry? → dropdown to correct it
- Logo wrong? → upload replacement

### Step 3 — Brand DNA (agent-assisted)
Split view:
- **Left:** Chat with agent. Agent asks structured questions about tone, audience, UVP.
- **Right:** Live Brand DNA card that fills in as agent extracts info.

```
┌──────────────────────┬──────────────────────┐
│ 🤖 الوكيل            │ 🧬 هوية البراند       │
│                      │                      │
│ "إيه اللي بيميز      │ الاسم: Nano Banana    │
│  البراند بتاعك عن    │ الأسلوب: خفيف وعفوي  │
│  المنافسين؟"         │ الجمهور: ——           │
│                      │ اللهجة: مصري          │
│ [___ اكتب هنا ___]  │ الـ UVP: ——           │
└──────────────────────┴──────────────────────┘
```

**Dialect Selector** — prominent dropdown in Brand DNA card:
```
اللهجة: [مصري ▼]
  ● مصري
  ○ سعودي
  ○ خليجي
  ○ شامي
  ○ مغربي
  ○ فصحى
  ○ English
```

---

## 5. BRAND OVERVIEW PAGE

Dashboard for a single brand. Card-based grid layout.

```
┌─────────────────────────────────────────────────────────────┐
│ Nano Banana                    [+ خطة جديدة] [⚙️ إعدادات]  │
├──────────────┬──────────────┬──────────────┬────────────────┤
│ 📅 خطط نشطة  │ 📝 محتوى     │ 📱 منصور      │ 🔍 أبحاث      │
│      2       │  اليوم: 3    │  ✓ Facebook  │    1 جاري      │
│   [افتح]     │  [عرض]       │  ✓ Instagram │    [عرض]       │
├──────────────┴──────────────┴──────────────┴────────────────┤
│ QUICK ACTIONS                                               │
│ [🤖 اسأل الوكيل] [📅 اعمل خطة] [🔍 حلل منافس] [📱 انشر]   │
├─────────────────────────────────────────────────────────────┤
│ RECENT CONTENT (last 3 items)                               │
│ [thumbnail] بوست - 15 مارس - مسودة    [عرض]                │
│ [thumbnail] ريل  - 18 مارس - معتمد    [نشر الآن]           │
│ [thumbnail] بوست - 20 مارس - منشور ✓  [إحصائيات]          │
└─────────────────────────────────────────────────────────────┘
```

---

## 5B. IDEA SWIPE PAGE — "تدريب الذوق" (from Holo video)

A Tinder-style interface for training the agent on content preferences. Accessible from the brand dashboard quick actions.

```
┌─────────────────────────────────────────────────────────────┐
│ 🃏 درّب الوكيل على ذوقك          Nano Banana               │
│ اسحب يمين = يعجبني ✓   اسحب شمال = مش مناسب ✗              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌───────────────────────┐                     │
│              │                       │                     │
│              │   [content preview]   │                     │
│              │                       │                     │
│              │  كابشن:               │                     │
│              │  "أفضل وجبة لفطارك"   │                     │
│              │                       │                     │
│              │  النوع: بوست  FB+IG   │                     │
│              └───────────────────────┘                     │
│                                                             │
│           [✗ مش مناسب]          [✓ يعجبني]                 │
│                                                             │
│           ─────────── ١٢ / ٢٠ بطاقة ───────────           │
└─────────────────────────────────────────────────────────────┘
```

**Backend Integration:**
- Right swipe → `POST /api/agent/memory` with `category: "preference"`, `content: "user approved this style"`
- Left swipe → `POST /api/agent/memory` with `category: "preference"`, `content: "user rejected this style"`
- After 20 swipes → agent uses preferences in all future caption generation
- Swipe history visible in Memory Browser under category "تفضيلات"

---

The most important page. Full-height, split-screen on desktop.

```
┌─────────────────────────────────────────────────────────────────┐
│ HEADER: 🤖 الوكيل الذكي — Nano Banana   [🧠 ١٢ ذكرى] [سياق ▼] │
├────────────────────────────────┬────────────────────────────────┤
│                                │ CONTEXT PANEL (collapsible)    │
│  CHAT WINDOW                   │                                │
│  (scrollable, flex-col)        │ 🧬 هوية البراند                │
│                                │ النبرة: عفوي ومرح              │
│  ┌──────────────────────────┐  │ اللهجة: مصري                   │
│  │ 👤 (user bubble - right) │  │                                │
│  │ عايز تساعدني تعمل خطة    │  │ 📅 الخطة الحالية               │
│  │ مارس لنانو بنانا         │  │ مارس 2026 — مسودة              │
│  └──────────────────────────┘  │                                │
│                                │ 📊 الحصة المتبقية              │
│  ┌──────────────────────────┐  │ المنشورات: ████░░ 8/12         │
│  │ TOOL CALL (inline badge) │  │                                │
│  │ 🔍 بيحلل المنافسين...    │  │ 🔍 آخر بحث                    │
│  │    فحص صفحة ٣ من ١٠...  │  │ competitor.com — مكتمل ✓       │
│  │ ▼ تم تحليل ٣ مواقع       │  │                                │
│  └──────────────────────────┘  └────────────────────────────────┘
│                                │
│  ┌──────────────────────────┐  │
│  │ 🤖 (agent bubble - left) │  │
│  │ تمام! بناءً على تحليل    │  │
│  │ السوق...  [streaming ▌]  │  │
│  └──────────────────────────┘  │
│                                │
├────────────────────────────────┘
│ INPUT BAR                                                       │
│ ┌─────────────────────────────────────────────────────────┐    │
│ │ 📎  [اكتب رسالتك هنا...                              ]  │    │
│ │                                              [إرسال ▶]  │    │
│ └─────────────────────────────────────────────────────────┘    │
│  ATTACHED FILES (chips above input when files attached)         │
│  [📄 brand-brief.pdf  ×]  [⚠️ ملف PDF — ممكن يكون ناقص]       │
└─────────────────────────────────────────────────────────────────┘
```

### Chat Bubble Styles
- **User:** right-aligned (RTL: left), bg-primary, text-white, radius-xl (round top corners, sharp bottom-right)
- **Agent:** left-aligned (RTL: right), bg-elevated, text-primary, radius-xl (round top corners, sharp bottom-left)
- **Tool call badge:** full-width, bg-elevated, left border (4px teal), amber spinner icon, updates in place
- **Tool result:** collapsible card under badge, green left border when complete
- **Streaming text:** renders character by character with a blinking amber cursor at end

### Memory Indicator Badge (header)
```
🧠 ١٢ ذكرى  →  links to /brands/[id]/memory
```
Teal pill badge. Shows memory count. Click → opens memory browser.

### Rate Limit UX
When `RATE_LIMIT_EXCEEDED` in chat context:
```
⏳ بعت رسايل كتير أوي. ريّح شوية.
   (إرسال بعد ٤٢ ثانية)
```
Input and send button disabled. Countdown visible. No toast.

### Dialect Toggle (floating pill — RTL top-left corner of chat)
```
[🗣️ مصري ▼]  ← teal pill, click to change dialect
```
Changing dialect triggers agent to rewrite last caption in new dialect.

---

## 7. CONTENT CALENDAR PAGE

### Calendar View
```
┌──────────────────────────────────────────────────────────────┐
│ خطة مارس ٢٠٢٦     [← فبراير] [أبريل →]   [قائمة | شبكة]   │
├──────┬──────┬──────┬──────┬──────┬──────┬──────────────────┤
│  أحد │ اثن  │ ثلاثا│  أربع│ خميس │ جمعة │  سبت             │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────┤
│      │      │      │      │      │  ١   │  ٢               │
│      │      │      │      │      │[post]│                  │
│      │      │      │      │      │  🟡  │                  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────────────────┤
│  ٣   │  ٤   │  ٥   │  ٦   │  ٧   │  ٨   │  ٩               │
│      │[reel]│      │[post]│      │      │  [story]         │
│      │  🟢  │      │  🔵  │      │      │  🟣              │
└──────┴──────┴──────┴──────┴──────┴──────┴──────────────────┘
```

### Content Card (in calendar cell)
```
┌─────────────┐
│ [thumbnail] │  ← 40×40px image or placeholder shimmer
│ F  post     │  ← Platform icon + content type
│ ●●● مسودة  │  ← Status dot + Arabic label
└─────────────┘
```
Status dot colors: gray=pending, blue=draft, teal=approved, purple=scheduled, green=posted

Click card → opens Content Item Editor as a right-side panel (not modal).

### Content Item Editor (right panel, 400px wide)
```
┌──────────────────────────────────────┐
│ [× إغلاق]      بوست — ١٥ مارس       │
├──────────────────────────────────────┤
│ ASSET PREVIEW (large, live)          │
│ ┌────────────────────────────────┐   │
│ │                                │   │
│ │      [generated image]         │   │
│ │                                │   │
│ │ [🖌️ ممحاية]  [⬆ تحسين الجودة] │   │
│ └────────────────────────────────┘   │
│                                      │
│ VERSION HISTORY (thumbnail strip)    │
│ [v1🟢] [v2] [v3] ← click to preview │
│  current ↑                           │
├──────────────────────────────────────┤
│ ASSET SLOTS                          │
│                                      │
│ Caption  ✓  [Claude Sonnet]          │
│ "أفضل منتجاتنا لهذا الموسم..."       │
│ [✏️ تعديل]                           │
│                                      │
│ Image    ⏳ جاري التوليد...          │
│ [████████░░░░░░░░░░░░] 60%          │
│                                      │
│ Design   — ينتظر الصورة              │
│                                      │
├──────────────────────────────────────┤
│ [✓ اعتمد]  [📅 جدول]  [🚀 انشر الآن]│
└──────────────────────────────────────┘
```

### Object Eraser Tool (from Holo video — brush interaction)
When user clicks 🖌️ icon on image preview:
- Image gets a brush overlay cursor
- User draws/highlights area to remove (semi-transparent red mask)
- Chat input pre-fills: "شيل الجزء ده من الصورة"
- User can edit the instruction then send
- Agent calls image.worker with mask coordinates
- Preview updates in place, new version appended to history strip

### Version History Strip
```
[v1 أصلي] → [v2 بعد الممحاية] → [v3 + تعديل النص] → [v4 حجم أكبر]
      ↑ current
```
- Each thumbnail: 48×48px, rounded, teal border on current
- Click → previews that version (read-only unless latest)
- "استرجع هذه النسخة" button appears when viewing older version
- Max 10 versions stored per content item

### Generation Progress (after plan approval)
```
┌──────────────────────────────────────────────────────────┐
│ 🔄 جاري توليد المحتوى                     8/12 مكتمل     │
│ ████████████████░░░░░░░░░░░░  67%                        │
│                                                          │
│ بوست ١  ✓  بوست ٢  ✓  بوست ٣  ⏳  ريل ١  ✓  ريل ٢  ⏳  │
└──────────────────────────────────────────────────────────┘
```
Each item dot is clickable → opens that item's editor.

---

## 8. COMPETITOR RESEARCH PAGE

### Research Jobs List
```
┌──────────────────────────────────────────────────────────────┐
│ أبحاث المنافسين                         [+ بحث جديد]         │
├──────────────────────────────────────────────────────────────┤
│ competitor.com     🟢 مكتمل   ٣٧ صفحة   ٣ مارس  [عرض]       │
│ rival-brand.com    🟡 جاري    ١٤ صفحة   ٨ مارس  [عرض]       │
│ brand3.com         🔴 فشل             ٥ مارس  [إعادة]       │
└──────────────────────────────────────────────────────────────┘
```

### Research Job Detail — Live Terminal
```
┌──────────────────────────────────────────────────────────────┐
│ competitor.com                    [🟡 جاري البحث — ١٤/٣٠]   │
├──────────────────────────────────────────────────────────────┤
│ TERMINAL (dark bg, monospace-style but Cairo font)            │
│                                                              │
│ 📄 صفحة ١  /home           "موقع رائد في..."                │
│ 📄 صفحة ٢  /about          "من نحن — شركة متخصصة..."        │
│ ⚠️ صفحة ٣  /admin    →     خطأ في الوصول                   │
│ 📄 صفحة ٤  /pricing        "أسعارنا — باقة أساسية..."       │
│ 🛡️ صفحة ٥  /blog/post-1    تم تنظيف المحتوى               │
│ ⏳ جاري فحص المزيد...                                        │
│                                                              │
│ [auto-scroll to latest — pauses if user scrolls up]          │
└──────────────────────────────────────────────────────────────┘
```

Source cards (below terminal when complete):
```
┌──────────────────────────────────────────┐
│ 🌐 competitor.com/pricing  [↗ زيارة]     │
│ 🛡️ تم تنظيف المحتوى  ← amber badge      │
│                                          │
│ "أسعار المنافس: باقة أساسية بـ ٢٩٩ ج.م" │
│ [▼ المصدر الكامل]                        │
└──────────────────────────────────────────┘
```

---

## 9. BILLING PAGE

### Usage Dashboard
```
┌──────────────────────────────────────────────────────────────┐
│ خطتك: Starter          ٢٩٩ ج.م/شهر        [ترقّى ⬆]        │
│ تجديد الاشتراك: ١ أبريل ٢٠٢٦                                │
├──────────────────────────────────────────────────────────────┤
│ USAGE METERS (2-column grid)                                  │
│                                                              │
│ المنشورات        الصور                                       │
│ ████████░░ 8/12  ████████░░ 8/12                            │
│                                                              │
│ الفيديوهات       البراندات                                   │
│ ░░░░░░░░░░ 0/0   ████░░░░░░ 1/1                             │
│ (مش في خطتك)                                                │
├──────────────────────────────────────────────────────────────┤
│ إجمالي التكلفة: $2.40 / $5.00     [تفاصيل ▼] (auto-open >50%)│
│                                                              │
│ Claude (captions/agent)  $1.30  ██████░░░░                  │
│ صور (DALL-E/Flux)        $0.60  ███░░░░░░░                  │
│ فيديو (Runway)           $0.30  ██░░░░░░░░                  │
│ صوت (ElevenLabs)         $0.20  █░░░░░░░░░                  │
└──────────────────────────────────────────────────────────────┘
```

### Plan Cards
```
┌──────────┬──────────┬──────────┬──────────┐
│  مجاني   │ Starter✓ │  Growth  │  Agency  │
│  $0      │ ٢٩٩ج.م  │ ٦٩٩ج.م  │ ١٤٩٩ج.م │
│──────────│──────────│──────────│──────────│
│ ٢ منشور  │ [live]   │ [live]   │ [live]   │
│ FB فقط  │ FB+IG    │ +TikTok  │ الكل     │
│          │          │+ فيديو   │+ يوتيوب  │
│          │ الخطة    │          │          │
│          │ الحالية  │ [ترقّى]  │ [ترقّى]  │
└──────────┴──────────┴──────────┴──────────┘
```
Current plan: teal border + "الخطة الحالية" badge.
Numbers fetched dynamically from `usage.limits` — never hardcoded.

### Plan Status Banners
**past_due** → red banner across top of billing page:
```
🔴 فشل تجديد اشتراكك. حدّث بيانات الدفع عشان تكمل. [تحديث الدفع]
```
**trialing** → subtle amber banner:
```
🟡 تجربة مجانية — تنتهي في ١٥ مارس ٢٠٢٦. [ترقّى الآن]
```

---

## 10. ADMIN DASHBOARD

Dark theme, same shell. Different sidebar color: `#0f1117` with teal accent.

### Platform Overview Cards (4-column grid)
```
┌──────────────┬──────────────┬──────────────┬──────────────┐
│ 👥 المستخدمين│ 💰 الإيراد   │ 🤖 تكلفة AI  │ ⚙️ قوائم الانتظار│
│    1,247     │ ٤٢,٠٠٠ ج.م  │   $128.40   │  3 مهمة معلقة │
│  +12 اليوم  │ هذا الشهر    │  هذا الشهر  │              │
└──────────────┴──────────────┴──────────────┴──────────────┘
```

### Kill Switches Panel (red alert card if any active)
```
┌─────────────────────────────────────────────────────────────┐
│ 🔴 مفاتيح الإيقاف النشطة                                    │
│ KILL_VIDEO — توليد الفيديو متوقف                            │
│ [تفعيل الفيديو] ← links to .env instructions               │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. MODALS & OVERLAYS

### QuotaExceededModal
```
┌──────────────────────────────────────────────┐
│  🚫 وصلت للحد                                │
│                                              │
│  استخدمت كل منشوراتك لهذا الشهر (12/12)     │
│                                              │
│  ترقّى للـ Growth وهتاخد:                   │
│  ✓ 40 منشور/شهر                             │
│  ✓ توليد فيديو                              │
│  ✓ TikTok                                   │
│                                              │
│  [إلغاء]        [ترقّى لـ Growth — ٦٩٩ج.م]  │
└──────────────────────────────────────────────┘
```

### Cost Confirmation Modal (before expensive jobs)
```
┌──────────────────────────────────────────────┐
│  تأكيد توليد المحتوى                         │
│                                              │
│  هيتم توليد 12 قطعة محتوى:                  │
│  • 8 بوستات  (Caption + Image + Design)      │
│  • 4 ريلز   (Caption + Video + Voice + Design│
│                                              │
│  التأثير على حصتك:                           │
│  الصور:  ████████░░  8/12 → 12/12 ⚠️ ممتلئ  │
│  فيديو:  ███░░░░░░░  1/4  → 5/4  🔴 تجاوز  │
│                                              │
│  [إلغاء]              [تأكيد التوليد ✓]      │
└──────────────────────────────────────────────┘
```

### KillSwitchBanner (READ_ONLY_MODE only)
```
🔧 المنصة في وضع القراءة فقط دلوقتي. شغالين على الموضوع — هنرجع قريباً. [×]
```
Amber background. Pinned above header. Dismiss hides for 5 min.

---

## 12. EMPTY STATES

Each section has a unique illustrated empty state:

**No brands:**
```
    [illustration: empty shop front]
    ما عندكش براندات لحد دلوقتي
    ابدأ بإضافة أول براند عشان تبدأ
    [+ إضافة براند]
```

**No content generated:**
```
    [illustration: robot placing first card on calendar]
    ما فيش محتوى اتولّد لحد دلوقتي
    اعتمد الخطة عشان نبدأ التوليد
    [اعتمد الخطة]
```

**Agent memory empty:**
```
    [illustration: empty brain with sparkles]
    الوكيل لسه ما اتعلمش حاجة عن البراند
    كلّمه أكتر عشان يبدأ يتذكر!
```

---

## 13. NOTIFICATIONS

**Toast positioning:** Bottom-center (RTL: bottom-center, same)
- Success: dark card + green left border + checkmark
- Error: dark card + red left border + × icon
- Info: dark card + teal left border
- Duration: 4 seconds, slide up animation

**Notification Bell (header):**
Dropdown with last 5 notifications. Each has icon, Arabic text, timestamp.
```
🟢 تم نشر بوستك على Facebook
🟡 الخطة جاهزة للمراجعة
🔴 فشل توليد الفيديو — [إعادة المحاولة]
```

---

## 14. MOBILE RESPONSIVENESS

- **Sidebar:** Hidden on mobile. Bottom tab bar with 5 icons (Home, Agent, Plans, Social, Billing)
- **Content Calendar:** Switches to list view on mobile (calendar grid too dense)
- **Agent Chat:** Full screen on mobile, context panel hidden (collapsible via button)
- **Admin pages:** Table → card list on mobile
- **Breakpoints:** sm=640, md=768, lg=1024, xl=1280

---

## 15. RTL IMPLEMENTATION RULES

**NEVER use:**
`ml-*` `mr-*` `pl-*` `pr-*` `left-*` `right-*` `text-left` `text-right`
`float-left` `float-right` `border-l-*` `border-r-*`

**ALWAYS use:**
`ms-*` `me-*` `ps-*` `pe-*` `start-*` `end-*` `text-start` `text-end`
`border-s-*` `border-e-*`

**Layout direction:**
Sidebar is on the RIGHT in RTL (Arabic). Main content is on the LEFT.
Agent chat bubbles: user on LEFT (reading direction start), agent on RIGHT — REVERSED from English convention.

**Animations:**
Slide-in animations reverse direction in RTL. Use `dir` attribute to flip.
Tinder swipe: swipe RIGHT = approve (direction of teal), swipe LEFT = reject.

---

## 16. LOADING STATES

**Page skeleton:** Full page shimmer matching the expected layout.
**Card skeleton:** Gray rounded rectangles in place of content.
**Agent streaming:** Text appears character by character (no skeleton — stream directly).
**Image generation:** Blurred placeholder → progress bar → reveal with fade-in.
**Button loading:** Spinner replaces icon, text stays, button disabled.

---

## 17. FEATURE LOCKED STATES (PlanFeatureGuard)

When a feature requires a higher plan:
```
┌──────────────────────────────────┐
│  🔒 [Feature Name]               │
│  متاح في خطة Growth وأعلى       │
│  [ترقّى لـ Growth]               │
└──────────────────────────────────┘
```
- Grayed overlay on the feature area
- Lock icon (amber/gold)
- Clear upgrade CTA
- Never hide the feature — always show locked state

---

## 18. PAGE-BY-PAGE COMPONENT CHECKLIST

| Page | Key Components |
|---|---|
| Login | LoginForm, GoogleSignInButton, ErrorInline |
| Register | RegisterForm, PasswordStrengthBar |
| Verify Email | OtpInput (6 boxes), CountdownTimer, ResendButton |
| Forgot Password | EmailForm → OtpInput → NewPasswordForm |
| Onboarding | StepIndicator, MagicScanAnimation, BrandDNAEditor, DialectSelector |
| Brand List | BrandCard (grid), EmptyState, AddBrandButton |
| Brand Overview | MetricCards, QuickActions, RecentContent |
| Agent Chat | ChatWindow, MessageBubble, ToolCallBadge, TypingIndicator, ChatInput, MemoryIndicator, DialectToggle, FileAttachChip |
| Content Calendar | CalendarGrid, ContentCard, ContentItemEditor (side panel), GenerationProgressBar, AssetSlotRow, ModelBadge |
| Research List | ResearchJobCard, StatusBadge |
| Research Detail | LiveTerminal, SourceCard, SanitizedBadge |
| Social Accounts | PlatformConnectCard, OAuthButton |
| Billing | UsageMeter, PlanCard, CostBreakdown, PlanStatusBanner |
| Settings | ProfileForm, LanguageToggle, PasswordChangeForm |
| Admin Dashboard | PlatformMetricCard, KillSwitchPanel, AIUsageChart |
| Admin Users | UserTable, UserDetailDrawer, PlanOverrideForm |
| Memory Browser | MemoryCard, CategoryFilter, PinButton, DeleteButton |
