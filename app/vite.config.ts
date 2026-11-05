/// <reference types="vitest/config" />
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	],
	server: {
		port: 5173,
		// WSL doesn't deliver file-change events for Windows drives (/mnt/c, /mnt/e…); poll there.
		watch: { usePolling: process.cwd().startsWith('/mnt/'), interval: 300 }
	},
	test: { include: ['src/**/*.test.ts'] }
});
