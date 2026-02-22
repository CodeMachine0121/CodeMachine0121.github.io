# Giscus Comment System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a Giscus comment section to each blog post page, with full dark/light theme sync.

**Architecture:** Create a single `GiscusComments.astro` component that dynamically injects the Giscus script and uses a `MutationObserver` to detect theme changes, then sends `postMessage` to the Giscus iframe. Add the component to both blog page files.

**Tech Stack:** Astro 5, Giscus (GitHub Discussions), vanilla JS MutationObserver + postMessage

---

## Prerequisites (Manual Steps Before Coding)

These must be done by the repo owner before implementing:

1. Go to your GitHub repo → **Settings** → **Features** → enable **Discussions**
2. Install Giscus GitHub App: https://github.com/apps/giscus → select your repo
3. Go to https://giscus.app, fill in:
   - Repository: `CodeMachine0121/CodeMachine0121.github.io`
   - Page ↔️ Discussion mapping: **Pathname**
   - Discussion category: **General**
4. Copy the generated `data-repo-id` and `data-category-id` values — you will need them in Task 1

---

## Task 1: Create GiscusComments.astro Component

**Files:**
- Create: `src/components/common/GiscusComments.astro`

**Step 1: Create the file**

Create `src/components/common/GiscusComments.astro` with the following content.

> Replace `YOUR_REPO_ID` and `YOUR_CATEGORY_ID` with the values you copied from giscus.app.

```astro
---
// No server-side props needed
---

<div class="giscus-wrapper mt-16 pt-8 border-t border-[var(--color-border)]">
  <div class="giscus"></div>
</div>

<script is:inline>
  (function () {
    const GISCUS_ORIGIN = 'https://giscus.app';

    function getGiscusTheme() {
      const theme = document.documentElement.dataset.theme;
      return theme === 'dark' ? 'dark' : 'light';
    }

    function loadGiscus() {
      const script = document.createElement('script');
      script.src = 'https://giscus.app/client.js';
      script.setAttribute('data-repo', 'CodeMachine0121/CodeMachine0121.github.io');
      script.setAttribute('data-repo-id', 'YOUR_REPO_ID');
      script.setAttribute('data-category', 'General');
      script.setAttribute('data-category-id', 'YOUR_CATEGORY_ID');
      script.setAttribute('data-mapping', 'pathname');
      script.setAttribute('data-strict', '0');
      script.setAttribute('data-reactions-enabled', '1');
      script.setAttribute('data-emit-metadata', '0');
      script.setAttribute('data-input-position', 'bottom');
      script.setAttribute('data-theme', getGiscusTheme());
      script.setAttribute('data-lang', 'zh-TW');
      script.setAttribute('data-loading', 'lazy');
      script.crossOrigin = 'anonymous';
      script.async = true;

      const container = document.querySelector('.giscus');
      if (container) {
        container.appendChild(script);
      }
    }

    function sendThemeToGiscus(theme) {
      const iframe = document.querySelector('iframe.giscus-frame');
      if (iframe) {
        iframe.contentWindow.postMessage(
          { giscus: { setConfig: { theme } } },
          GISCUS_ORIGIN
        );
      }
    }

    // Load Giscus on page load
    loadGiscus();

    // Watch for theme changes on <html data-theme="...">
    const observer = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'data-theme') {
          sendThemeToGiscus(getGiscusTheme());
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  })();
</script>
```

**Step 2: Verify the file was created**

```bash
ls src/components/common/GiscusComments.astro
```

Expected: file exists

**Step 3: Commit**

```bash
git add src/components/common/GiscusComments.astro
git commit -m "feat: add GiscusComments component with theme sync"
```

---

## Task 2: Add GiscusComments to Standalone Blog Posts

**Files:**
- Modify: `src/pages/blogs/[slug].astro`

**Step 1: Open the file and locate PostNavigation**

The file currently has:
```astro
<PostNavigation {prevPost} {nextPost} />
```

**Step 2: Add the import and component**

At the top of the frontmatter (between `---`), add the import after the existing imports:

```astro
import GiscusComments from '../../components/common/GiscusComments.astro';
```

Then, after `<PostNavigation {prevPost} {nextPost} />`, add:

```astro
<GiscusComments />
```

The resulting section should look like:

```astro
        <PostNavigation {prevPost} {nextPost} />

        <GiscusComments />

        <div class="back-to-top fixed bottom-8 right-8 opacity-0 invisible transition-all z-30">
```

**Step 3: Start dev server and verify**

```bash
bun run dev
```

Open http://localhost:4321/blogs/[any-slug] in browser. Scroll to bottom — you should see either the Giscus widget loaded (if repo-id is filled in) or an empty container div.

**Step 4: Commit**

```bash
git add src/pages/blogs/\[slug\].astro
git commit -m "feat: add Giscus comments to standalone blog posts"
```

---

## Task 3: Add GiscusComments to Series Blog Posts

**Files:**
- Modify: `src/pages/blogs/[...slug].astro`

**Step 1: Add the import**

In the frontmatter, add after existing imports:

```astro
import GiscusComments from '../../components/common/GiscusComments.astro';
```

**Step 2: Add the component after PostNavigation**

Same as Task 2 — insert `<GiscusComments />` after `<PostNavigation {prevPost} {nextPost} />`.

**Step 3: Verify**

Open http://localhost:4321/blogs/[series-slug] in browser. Scroll to bottom and confirm the comment section appears.

**Step 4: Commit**

```bash
git add "src/pages/blogs/[...slug].astro"
git commit -m "feat: add Giscus comments to series blog posts"
```

---

## Task 4: Verify Theme Sync

**No files to create — manual testing only**

**Step 1: Open any blog post in the browser**

```bash
bun run dev
```

Navigate to any blog post page.

**Step 2: Test theme toggle**

1. If the Giscus comment section is visible, click the theme toggle button in the navbar
2. Confirm the Giscus iframe theme switches from light↔dark without reloading the page
3. Check the browser console for any errors

> Note: Giscus iframe requires the repo and discussion to exist. If `data-repo-id` is placeholder, the iframe won't load — that's expected until prerequisites are completed.

**Step 3: Build check**

```bash
bun run build
```

Expected: build completes without TypeScript or Astro check errors.

**Step 4: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: resolve any build issues with Giscus integration"
```

---

## Done

After Task 4, every blog post page will have:
- A Giscus comment section below `PostNavigation`
- Automatic dark/light theme sync via `postMessage`
- Lazy-loaded iframe (Giscus `data-loading="lazy"`)
- Chinese Traditional UI (`data-lang="zh-TW"`)

Readers need a GitHub account to comment. Comments are stored as GitHub Discussions in your repo.
