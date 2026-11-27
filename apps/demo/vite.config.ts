import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	// Uses the packages' source directly (no need to build them first).
	resolve: { conditions: ['@excalibur-form/source'] },
});
