// @ts-check
// ============================================================================
// ФАЙЛ: frontend/astro.config.mjs
// НАЗНАЧЕНИЕ: Конфигурация сборки Astro для публикации на GitHub Pages (/universe/)
// ============================================================================
import { defineConfig } from 'astro/config';

export default defineConfig({
    site: 'https://dubnovalexey.github.io',
    base: '/universe',
    build: {
        assets: '_astro',
    },
});