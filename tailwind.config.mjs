import typography from '@tailwindcss/typography';

/**
 * 色彩與字體一律對應 src/styles/tokens.css 的變數，這裡不寫任何實際色值。
 *
 * @type {import('tailwindcss').Config}
 */
export default {
	darkMode: ['selector', '[data-theme="dark"]'],
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				sans: 'var(--font-sans)',
				serif: 'var(--font-serif)',
				mono: 'var(--font-mono)',
			},
			colors: {
				bg: 'var(--color-bg)',
				surface: 'var(--color-surface)',
				ink: 'var(--color-ink)',
				muted: 'var(--color-muted)',
				line: 'var(--color-line)',
				accent: 'var(--color-accent)',
				'accent-soft': 'var(--color-accent-soft)',
			},
			maxWidth: {
				measure: 'var(--measure)',
				page: 'var(--page-width)',
			},
			borderRadius: {
				DEFAULT: 'var(--radius)',
			},
			// 文章正文的配色交給 token，深淺色自動跟著變，不需要 prose-invert。
			// 間距與元件細節在 src/styles/article.css。
			typography: {
				DEFAULT: {
					css: {
						maxWidth: 'var(--measure)',
						'--tw-prose-body': 'var(--color-ink)',
						'--tw-prose-headings': 'var(--color-ink)',
						'--tw-prose-lead': 'var(--color-muted)',
						'--tw-prose-links': 'var(--color-accent)',
						'--tw-prose-bold': 'var(--color-ink)',
						'--tw-prose-counters': 'var(--color-muted)',
						'--tw-prose-bullets': 'var(--color-muted)',
						'--tw-prose-hr': 'var(--color-line)',
						'--tw-prose-quotes': 'var(--color-ink)',
						'--tw-prose-quote-borders': 'var(--color-accent)',
						'--tw-prose-captions': 'var(--color-muted)',
						'--tw-prose-code': 'var(--color-ink)',
						'--tw-prose-pre-code': 'var(--color-ink)',
						'--tw-prose-pre-bg': 'var(--color-code-bg)',
						'--tw-prose-th-borders': 'var(--color-line)',
						'--tw-prose-td-borders': 'var(--color-line)',
						'code::before': { content: '""' },
						'code::after': { content: '""' },
						'blockquote p:first-of-type::before': { content: '""' },
						'blockquote p:last-of-type::after': { content: '""' },
					},
				},
			},
		},
	},
	plugins: [typography],
};
