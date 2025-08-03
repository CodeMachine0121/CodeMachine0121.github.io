/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				primary: "var(--color-primary)",
				secondary: "var(--color-secondary)",
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
									color: theme('colors.gray.300'),
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
