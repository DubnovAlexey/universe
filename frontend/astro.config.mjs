// @ts-check
// ============================================================================
// ФАЙЛ: frontend/astro.config.mjs
// НАЗНАЧЕНИЕ: Конфигурация Astro (UNIVERSE v2.5)
//   - В режиме локальной разработки (astro dev) открывается прямо на '/'
//     (http://localhost:4321/), чтобы не выдавать 404 на корневом маршруте.
//   - В режиме продакшен-сборки (astro build) использует base: '/universe'
//     для публикации на GitHub Pages.
// ============================================================================
import { defineConfig } from 'astro/config';

const isProductionBuild = process.env.NODE_ENV === 'production';

export default defineConfig({
    site: 'https://dubnovalexey.github.io',
    base: isProductionBuild ? '/universe' : '/',
    build: {
        assets: '_astro',
    },
});