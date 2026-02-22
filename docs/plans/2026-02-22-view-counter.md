# View Counter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add per-article view count tracking using Firebase Firestore + Netlify Functions, displayed as an eye icon badge on article pages and in the blog list.

**Architecture:** A Netlify Function (`netlify/functions/views.ts`) acts as a proxy between the browser and Firebase Admin SDK — the Firebase credentials never reach the client. The browser uses `sessionStorage` to deduplicate counts within a session. `ViewCounter.astro` is a self-contained client component that handles both reading and incrementing.

**Tech Stack:** Firebase Admin SDK (`firebase-admin`), Netlify Functions (`@netlify/functions`), Astro static site, Tailwind CSS, vanilla `fetch` + `sessionStorage`.

---

## Prerequisites

Before starting, set up Firebase:
1. Go to [Firebase Console](https://console.firebase.google.com/) → create a project (or use existing)
2. Enable **Firestore Database** in the project (start in production mode)
3. Go to Project Settings → Service Accounts → Generate new private key → download JSON
4. Add a Firestore security rule to restrict writes to only the server (via Admin SDK bypasses rules anyway, so default "deny all" is fine for client):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /pageViews/{slug} {
         allow read: if true;   // allow public reads
         allow write: if false; // deny client writes (server uses Admin SDK)
       }
     }
   }
   ```

You will need these three values from the downloaded JSON:
- `project_id` → `FIREBASE_PROJECT_ID`
- `private_key` → `FIREBASE_PRIVATE_KEY`
- `client_email` → `FIREBASE_CLIENT_EMAIL`

---

## Task 1: Install dependencies and configure environment

**Files:**
- Modify: `package.json` (via bun add)
- Create: `.env` (local only, do not commit)
- Create: `.env.example`

**Step 1: Install Firebase Admin SDK and Netlify Functions types**

```bash
bun add firebase-admin
bun add -d @netlify/functions
```

**Step 2: Create `.env` with Firebase credentials**

Create `.env` at project root (this file should already be in `.gitignore`):

```
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nABC...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

> Note: The private key must be in double quotes to preserve the `\n` escape sequences.

**Step 3: Create `.env.example` for documentation**

```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

**Step 4: Verify `.env` is gitignored**

```bash
grep -n ".env" .gitignore
```

Expected: a line matching `.env` or `.env*`. If missing, add `.env` to `.gitignore`.

**Step 5: Commit**

```bash
git add .env.example package.json bun.lock
git commit -m "feat: install firebase-admin for view counter"
```

---

## Task 2: Create the Netlify Function

**Files:**
- Create: `netlify/functions/views.ts`
- Modify: `netlify.toml`

**Step 1: Update `netlify.toml` to register the functions directory**

Current content of `netlify.toml`:
```toml
[build]
  command = "bun run build"
```

New content:
```toml
[build]
  command = "bun run build"
  publish = "dist"

[functions]
  directory = "netlify/functions"
```

**Step 2: Create `netlify/functions/views.ts`**

```typescript
import type { Handler } from "@netlify/functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin once (persists across warm invocations)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

const db = admin.firestore();

// Firestore document IDs cannot contain "/", so we encode slugs
function slugToDocId(slug: string): string {
  return slug.replace(/\//g, "__");
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

export const handler: Handler = async (event) => {
  // Preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  // GET /api/views?slug=xxx → { count: number }
  if (event.httpMethod === "GET") {
    const slug = event.queryStringParameters?.slug;
    if (!slug) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "slug required" }),
      };
    }
    const doc = await db.collection("pageViews").doc(slugToDocId(slug)).get();
    const count = doc.exists ? (doc.data()?.count ?? 0) : 0;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ count }),
    };
  }

  // POST /api/views { slug } → { count: number }
  if (event.httpMethod === "POST") {
    let body: { slug?: string } = {};
    try {
      body = JSON.parse(event.body ?? "{}");
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "invalid JSON" }),
      };
    }
    const { slug } = body;
    if (!slug) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "slug required" }),
      };
    }
    const ref = db.collection("pageViews").doc(slugToDocId(slug));
    await ref.set(
      { count: admin.firestore.FieldValue.increment(1) },
      { merge: true }
    );
    const doc = await ref.get();
    const count = doc.data()?.count ?? 1;
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ count }),
    };
  }

  return {
    statusCode: 405,
    headers: CORS_HEADERS,
    body: JSON.stringify({ error: "Method not allowed" }),
  };
};
```

**Step 3: Verify TypeScript compiles (no errors)**

```bash
bun run check
```

Expected: no errors related to `netlify/functions/views.ts`.

> If `tsconfig.json` doesn't include `netlify/**`, TypeScript might not find it. That's OK — Netlify builds the function separately.

**Step 4: Commit**

```bash
git add netlify.toml netlify/functions/views.ts
git commit -m "feat: add Netlify Function for view counting"
```

---

## Task 3: Create ViewCounter component

**Files:**
- Create: `src/components/common/ViewCounter.astro`

**Step 1: Create `src/components/common/ViewCounter.astro`**

```astro
---
interface Props {
  slug: string;
  mode: "increment" | "read";
}

const { slug, mode } = Astro.props;
---

<span
  class="view-counter inline-flex items-center gap-1 text-sm text-offset"
  data-slug={slug}
  data-mode={mode}
  aria-label="觀看次數"
>
  <!-- Eye icon (inline SVG, no external dep) -->
  <svg
    xmlns="http://www.w3.org/2000/svg"
    class="h-4 w-4 shrink-0"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
    <path
      fill-rule="evenodd"
      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
      clip-rule="evenodd"
    />
  </svg>
  <span class="view-count" aria-live="polite">—</span>
</span>

<script>
  async function initViewCounters() {
    const counters = document.querySelectorAll<HTMLElement>(".view-counter");

    const fetchTasks = Array.from(counters).map(async (counter) => {
      const slug = counter.dataset.slug;
      const mode = counter.dataset.mode;
      const countEl = counter.querySelector<HTMLElement>(".view-count");
      if (!slug || !countEl) return;

      try {
        let count: number;
        const sessionKey = `viewed_${slug}`;

        if (mode === "increment" && !sessionStorage.getItem(sessionKey)) {
          // First visit in this session: increment
          const res = await fetch("/.netlify/functions/views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug }),
          });
          const data = await res.json();
          count = data.count;
          sessionStorage.setItem(sessionKey, "1");
        } else {
          // Read-only (list page, or already viewed this session)
          const res = await fetch(
            `/.netlify/functions/views?slug=${encodeURIComponent(slug)}`
          );
          const data = await res.json();
          count = data.count;
        }

        countEl.textContent = String(count);
      } catch {
        // Silently fail in local dev (no Netlify Functions running)
        countEl.textContent = "—";
      }
    });

    await Promise.all(fetchTasks);
  }

  document.addEventListener("DOMContentLoaded", initViewCounters);
  document.addEventListener("astro:page-load", initViewCounters);
</script>
```

**Step 2: Commit**

```bash
git add src/components/common/ViewCounter.astro
git commit -m "feat: add ViewCounter component"
```

---

## Task 4: Integrate ViewCounter into article pages

**Files:**
- Modify: `src/pages/blogs/[slug].astro`
- Modify: `src/pages/blogs/[...slug].astro`

### 4a: `[slug].astro` (standalone articles)

**Step 1: Add the import**

In `src/pages/blogs/[slug].astro`, after line 8 (the GiscusComments import), add:

```astro
import ViewCounter from '../../components/common/ViewCounter.astro';
```

**Step 2: Replace the `<time>` element with a flex row containing time + ViewCounter**

Find this block (around line 59):
```astro
<time datetime={blog.data.datetime} class="text-sm text-offset block">
    {new Date(blog.data.datetime).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
</time>
```

Replace with:
```astro
<div class="flex items-center gap-3 justify-center md:justify-start">
    <time datetime={blog.data.datetime} class="text-sm text-offset">
        {new Date(blog.data.datetime).toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' })}
    </time>
    <ViewCounter slug={blog.slug} mode="increment" />
</div>
```

**Step 3: Verify the page builds**

```bash
bun run build
```

Expected: build completes without errors.

### 4b: `[...slug].astro` (series articles)

**Step 1: Add the import**

In `src/pages/blogs/[...slug].astro`, after line 8 (GiscusComments import), add:

```astro
import ViewCounter from '../../components/common/ViewCounter.astro';
```

**Step 2: Same time → flex row replacement as 4a**

Find the `<time>` block (around line 46) and replace identically to step 4a above.

**Step 3: Build and commit**

```bash
bun run build
git add src/pages/blogs/[slug].astro src/pages/blogs/[...slug].astro
git commit -m "feat: add ViewCounter to article pages"
```

---

## Task 5: Integrate ViewCounter into BlogItem (list page)

**Files:**
- Modify: `src/components/sections/blog/BlogItem.astro`

**Step 1: Add the import**

In `src/components/sections/blog/BlogItem.astro`, add to the frontmatter:

```astro
---
import ViewCounter from '../../common/ViewCounter.astro';
const { blog, isFirst } = Astro.props;
---
```

**Step 2: Replace the `<time>` element with a flex row**

Find (around line 13):
```astro
<time datetime={blog.data.datetime} class="block mt-3 text-sm text-offset">
  {new Date(blog.data.datetime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
</time>
```

Replace with:
```astro
<div class="flex items-center gap-3 mt-3">
    <time datetime={blog.data.datetime} class="text-sm text-offset">
        {new Date(blog.data.datetime).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
    </time>
    <ViewCounter slug={blog.slug} mode="read" />
</div>
```

**Step 3: Build and commit**

```bash
bun run build
git add src/components/sections/blog/BlogItem.astro
git commit -m "feat: add ViewCounter to blog list"
```

---

## Task 6: Deploy and verify on Netlify

**Step 1: Add env vars to Netlify dashboard**

In Netlify: Site settings → Environment variables → Add:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_PRIVATE_KEY` (paste the full multi-line key in double quotes)
- `FIREBASE_CLIENT_EMAIL`

**Step 2: Push and deploy**

```bash
git push origin main
```

**Step 3: Verify the function endpoint**

After deploy, test the function directly:

```bash
# Replace with your actual Netlify URL
curl "https://your-site.netlify.app/.netlify/functions/views?slug=test-post"
```

Expected: `{"count":0}` (first call, no document yet)

```bash
curl -X POST "https://your-site.netlify.app/.netlify/functions/views" \
  -H "Content-Type: application/json" \
  -d '{"slug":"test-post"}'
```

Expected: `{"count":1}`

**Step 4: Visit an article page and verify the counter increments**

Open an article, check the network tab — you should see a POST to `/.netlify/functions/views` returning `{"count": N}`.

Reload the page — the count should stay the same (sessionStorage deduplication). Open in a new incognito window — count should increment by 1.

**Step 5: Check Firestore**

In Firebase Console → Firestore → `pageViews` collection → verify documents with slug-based IDs and incrementing counts.

---

## Local Development Notes

The Netlify Function does NOT run with `bun run dev` (Astro's dev server). To test functions locally:

```bash
bun add -d netlify-cli  # one-time
bunx netlify dev        # starts both Astro + functions
```

Without `netlify dev`, the ViewCounter will silently show `—` (the error is caught and handled gracefully).
