import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	server: {
		host: true, // Allows access from Docker via host.docker.internal
		port: 5173
	},
	plugins: [
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter(),

			typescript: {
				config: (config) => ({
					...config,
					include: [...config.include, '../drizzle.config.ts']
				})
			}
		}),
		SvelteKitPWA({
			srcDir: 'src',
			filename: 'service-worker.ts',
			strategies: 'injectManifest',
			manifest: {
				name: 'Hedgehog.inc',
				short_name: 'Hedgehog',
				theme_color: '#000000',
				background_color: '#000000',
				display: 'standalone',
				start_url: '/',
				scope: '/',
				icons: [
					{
						src: 'favicon.svg',
						sizes: 'any',
						type: 'image/svg+xml',
						purpose: 'any maskable'
					}
				]
			},
			injectManifest: {
				globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}']
			},
			devOptions: {
				enabled: true,
				type: 'module'
			}
		})
	]
});
