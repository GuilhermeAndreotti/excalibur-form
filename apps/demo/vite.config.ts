import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [react()],
	// Usa o código-fonte do core direto (sem precisar rodar o build dele).
	resolve: { conditions: ['@excalibur-form/source'] },
});
