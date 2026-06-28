/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ['selector', '[data-theme="dark"]'],
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				// Hand-drawn: Latin handwriting first, CJK kaishu fallback per-glyph.
				heading: ['Kalam', 'LXGW WenKai TC', 'Patrick Hand', 'Noto Sans TC', 'sans-serif'],
				body: ['Patrick Hand', 'LXGW WenKai TC', 'Noto Sans TC', 'sans-serif'],
				sans: ['Patrick Hand', 'LXGW WenKai TC', 'Noto Sans TC', 'sans-serif'],
			},
			colors: {
				primary: "var(--color-primary)",
				secondary: "var(--color-secondary)",
				// Hand-drawn palette aliases (theme-aware via --hd-* custom props)
				ink: "var(--hd-ink)",
				"ink-soft": "var(--hd-ink-soft)",
				paper: "var(--hd-paper)",
				"paper-offset": "var(--hd-paper-offset)",
				surface: "var(--hd-surface)",
				accent: "var(--hd-accent)",
				"accent-2": "var(--hd-accent-2)",
				note: "var(--hd-note)",
			},
			boxShadow: {
				hd: "4px 4px 0 0 var(--hd-shadow)",
				"hd-sm": "2px 2px 0 0 var(--hd-shadow)",
				"hd-lg": "8px 8px 0 0 var(--hd-shadow)",
			},
			borderRadius: {
				wobbly: "255px 15px 225px 15px / 15px 225px 15px 255px",
				"wobbly-md": "15px 225px 15px 255px / 255px 15px 225px 15px",
				"wobbly-sm": "14px 6px 12px 8px / 8px 12px 6px 14px",
			},
			textColor: {
				default: "var(--color-text)",
				offset: "var(--color-text-offset)",
			},
			backgroundColor: {
				default: "var(--color-background)",
				offset: "var(--color-background-offset)",
				border: "var(--color-border)",
			},
						typography: (theme) => ({
							DEFAULT: {
								css: {
									color: 'var(--color-text)',
									pre: {
										padding: '1rem',
										borderRadius: '0.375rem',
										backgroundColor: theme('colors.gray.800'),
										color: theme('colors.gray.100'),
										overflow: 'auto',
										width: '100%',
									},
									code: {
										color: theme('colors.pink.500'),
										backgroundColor: theme('colors.gray.100'),
										borderRadius: '0.25rem',
										padding: '0.2em 0.4em',
										fontWeight: '400',
									},
									'code::before': {
										content: '""',
									},
									'code::after': {
										content: '""',
									},
									img: {
										marginTop: '2em',
										marginBottom: '2em',
										borderRadius: '0.375rem',
									},
									'@media (max-width: 640px)': {
										fontSize: '0.9375rem',
										h1: {
											fontSize: '1.75rem',
										},
										h2: {
											fontSize: '1.5rem',
										},
										h3: {
											fontSize: '1.25rem',
										},
										pre: {
											fontSize: '0.8125rem',
										},
									},
								},
							},
							dark: {
								css: {
									color: 'var(--color-text)',
									h1: {
										color: theme('colors.white'),
									},
									h2: {
										color: theme('colors.white'),
									},
									h3: {
										color: theme('colors.white'),
									},
									h4: {
										color: theme('colors.white'),
									},
									strong: {
										color: theme('colors.white'),
									},
									code: {
										color: theme('colors.pink.400'),
										backgroundColor: theme('colors.gray.800'),
									},
									pre: {
										backgroundColor: theme('colors.gray.900'),
										color: theme('colors.gray.200'),
									},
								},
							},
						}),
			borderColor: {
				default: "var(--color-border)",
			},
			animation: {
				"spin-slower": "spin 35s ease infinite",
				"spin-slow": "spin 25s ease-in-out infinite reverse",
			},
		}
	},
	plugins: [
		require('@tailwindcss/typography')
	],
}
