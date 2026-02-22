# View Counter Design

**Date:** 2026-02-22
**Feature:** Article view count tracking with Firestore + Netlify Functions

## Requirements

- Track view count per article
- Storage: Firebase Firestore (server-side, via Netlify Functions)
- Display: Article header + article list cards (eye icon + number)
- Deduplication: Session-based (one count per browser session per article)

## Architecture

### Data Flow

```
Browser                    Netlify Function              Firebase Firestore
   │                            │                               │
   │  GET /api/views?slug=xxx   │                               │
   │ ─────────────────────────► │  firestore.doc(slug).get()   │
   │                            │ ────────────────────────────► │
   │                            │ ◄──────────────── { count }  │
   │ ◄──────── { count: 42 }   │                               │
   │                            │                               │
   │  POST /api/views           │                               │
   │  { slug }                  │  FieldValue.increment(1)     │
   │ ─────────────────────────► │ ────────────────────────────► │
   │ ◄──────── { count: 43 }   │ ◄──────────────── { count }  │
```

### Firestore Schema

- Collection: `pageViews`
- Document ID: article slug (e.g., `my-first-post`, `series/chapter-1`)
- Fields: `{ count: number }`

### Session Deduplication

Client-side logic on article page load:

```
Page loads
  ├── sessionStorage["viewed_${slug}"] exists?
  │     └── YES → GET /api/views?slug=xxx  (read-only)
  └── NO  → POST /api/views { slug }       (increment + set sessionStorage)
```

Article list page always uses read-only GET.

## Files

### New Files

| File | Purpose |
|------|---------|
| `netlify/functions/views.ts` | Single Function handling GET (read) and POST (increment) |
| `src/components/common/ViewCounter.astro` | Eye icon + count display, `mode: "increment" \| "read"` prop |

### Modified Files

| File | Change |
|------|--------|
| `netlify.toml` | Add functions directory config |
| `src/pages/blogs/[slug].astro` | Add `<ViewCounter slug={blog.slug} mode="increment" />` in header |
| `src/pages/blogs/[...slug].astro` | Same as above |
| `src/components/sections/blog/BlogItem.astro` | Add `<ViewCounter slug={blog.slug} mode="read" />` |

### Environment Variables

Server-side only (Netlify env vars, never exposed to browser):

```
FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=
```

## UI Mockup

**Article page header:**
```
My Article Title
Article description here.
January 1, 2024  👁 42
```

**Article list card:**
```
┌─────────────────────────────────┐
│ Article Title                   │
│ January 1, 2024  👁 42          │
│ Article description excerpt...  │
└─────────────────────────────────┘
```

## Dependencies

- `firebase-admin` — installed in project root, used by Netlify Function
- No new client-side dependencies (vanilla fetch + sessionStorage)
