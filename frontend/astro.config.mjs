// @ts-check
// ============================================================================
// ФАЙЛ: frontend/astro.config.mjs
// НАЗНАЧЕНИЕ: Конфигурация Astro (UNIVERSE v2.5)
//   - В режиме локальной разработки (astro dev) открывается прямо на '/'
//     (http://localhost:4321/), чтобы не выдавать 404 на корневом маршруте.
//   - В режиме продакшен-сборки (astro build) использует base: '/universe'
//     для публикации на GitHub Pages.
// ФУНКЦИИ: Выбор базового пути и формирование декларативной конфигурации Astro.
// ОГЛАВЛЕНИЕ РАЗДЕЛОВ:
//   1. Импорт defineConfig и определение режима сборки.
//   2. Конфигурация сайта, базового пути и каталога ресурсов.
// ============================================================================
// РАЗДЕЛ 1. ЗАВИСИМОСТЬ И РЕЖИМ СБОРКИ
import { defineConfig } from 'astro/config';

const isProductionBuild = process.env.NODE_ENV === 'production';

// РАЗДЕЛ 2. ДЕКЛАРАТИВНАЯ КОНФИГУРАЦИЯ ASTRO
export default defineConfig({
    site: 'https://dubnovalexey.github.io',
    base: isProductionBuild ? '/universe' : '/',
    build: {
        assets: '_astro',
    },
    // Панель разработчика Astro появляется только в astro dev и перекрывает нижние кнопки HUD.
    devToolbar: {
        enabled: false,
    },
});