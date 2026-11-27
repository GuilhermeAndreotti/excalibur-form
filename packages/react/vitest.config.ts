import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: { conditions: ['@excalibur-form/source'] },
	test: {
		environment: 'jsdom',
		include: ['src/**/*.test.{ts,tsx}'],
		coverage: {
			include: ['src/**/*.{ts,tsx}'],
			exclude: ['src/**/*.test.{ts,tsx}', 'src/index.ts'],
			thresholds: { lines: 90, functions: 90, branches: 85 },
		},
	},
});
