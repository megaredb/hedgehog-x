import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';

export default defineConfig({
	define: {
		'process.env.NODE_ENV': process.env.NODE_ENV === 'production' ? '"production"' : '"development"'
	},
	plugins: [
		tailwindcss(),

		sveltekit({
			compilerOptions: {
				runes: ({ filename }) =>
					filename ? (filename.split(/[/\\]/).includes('node_modules') ? undefined : true) : true
			},
			adapter: adapter(),
			typescript: {
				config: (config) => {
					config.include.push('../drizzle.config.ts');
				}
			},
			serviceWorker: {
				register: false
			},
			paths: {
				relative: false
			}
		}),

		SvelteKitPWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',

			injectManifest: {
				globPatterns: [
					'client/**/*.{js,css,ico,png,svg,webp,webm,webmanifest}',
					'prerendered/**/*.{html,json}'
				]
			},

			manifest: {
				name: 'HEDGEHOG.INC',
				short_name: 'HEDGEHOG.INC',
				description: 'Аудиокниги от HEDGEHOG.INC',
				display: 'standalone',
				theme_color: '#ffffff',
				start_url: '/',
				scope: '/',
				id: '/',
				screenshots: [
					{
						src: 'screenshot-1920x1080.webp',
						sizes: '1920x1080',
						type: 'image/webp',
						form_factor: 'wide'
					},
					{
						src: 'screenshot-1170x2532.webp',
						sizes: '1170x2532',
						type: 'image/webp',
						form_factor: 'narrow'
					}
				],
				icons: [
					{ src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
					{ src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
					{ src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
					{
						src: 'maskable-icon-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		})
	],
	server: { allowedHosts: ['hedgehog-inc.localhost', 'preview.hedgehog-inc.localhost'] },
	ssr: {
		noExternal: ['bits-ui']
	}
});
