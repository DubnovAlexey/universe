// ============================================================================
// ФАЙЛ: frontend/src/core/projectCatalog.ts
// НАЗНАЧЕНИЕ: Каталог проектов портфолио, которые летают в сцене планетами (ветка site).
// РАЗДЕЛЫ: 1. Контракт; 2. Каталог; 3. Адреса, имена и значки.
// ФУНКЦИИ: projectUrl, projectRepoUrl, projectIconUrl, projectName.
// Каждый проект — самостоятельный сайт на GitHub Pages (https://dubnovalexey.github.io/<id>/). UNIVERSE его не
// копирует: просмотрщик открывает живую страницу и ссылку на её код, а значок планеты — фавикон этой же страницы.
// Когда Алексей добавит проекту фавикон, достаточно вписать путь в icon; пока его нет, планета без рисунка.
// ============================================================================
import type { Locale } from './locale';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ
/** flagship — крупные планеты-флагманы, showcase — витрина, mini — мини-проекты и учебный путь. */
export type PlanetTier = 'flagship' | 'showcase' | 'mini';

/** Значок планеты: путь к фавикону внутри сайта проекта или символ-эмодзи; null — своего значка пока нет. */
export type PlanetIcon = { readonly path: string } | { readonly emoji: string } | null;

export interface PortfolioProject {
    /** Имя репозитория — оно же путь сайта на GitHub Pages. */
    readonly id: string;
    readonly name: { readonly ru: string; readonly en: string };
    readonly tier: PlanetTier;
    /** Цвет планеты: издалека видно, что проекты разные. */
    readonly color: string;
    readonly icon: PlanetIcon;
}

export const PROJECT_SITE_ORIGIN = 'https://dubnovalexey.github.io';
export const PROJECT_REPO_ORIGIN = 'https://github.com/DubnovAlexey';
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. КАТАЛОГ
// Порядок — от флагманов к мини-проектам. Цвета разнесены по кругу оттенков и подобраны под тему проекта.
export const PORTFOLIO_PROJECTS: readonly PortfolioProject[] = Object.freeze([
    { id: 'cosmo-game-hub', name: { ru: 'Cosmo Game Hub', en: 'Cosmo Game Hub' }, tier: 'flagship',
        color: '#7c5cff', icon: { path: 'favicon.webp' } },
    { id: 'smart-fridge-app', name: { ru: 'Умный холодильник', en: 'Smart Fridge' }, tier: 'flagship',
        color: '#38bdf8', icon: { emoji: '❄️' } },
    { id: 'Olympic-Rings-Gallery', name: { ru: 'Olympic Rings Gallery', en: 'Olympic Rings Gallery' }, tier: 'showcase',
        color: '#facc15', icon: { path: 'img/zoich.png' } },
    { id: 'Three-Pixels-to-Centaur', name: { ru: 'Три пикселя до Центавра', en: 'Three Pixels to Centauri' }, tier: 'showcase',
        color: '#c084fc', icon: { path: 'assets/images/favicon.webp' } },
    // Props — учебная игра про пропсы React (пещеры вампира Графа Пропсулы); значок — вампир из коллекции Алексея.
    { id: 'Props', name: { ru: 'Props — Пещеры Графа Пропсулы', en: 'Props — The Caves of Count Propsula' }, tier: 'showcase',
        color: '#a3123a', icon: { path: 'favicon.webp' } },
    { id: 'Mars-project2', name: { ru: 'Новейшие марсианские хроники', en: 'The Newest Martian Chronicles' }, tier: 'showcase',
        color: '#f05a28', icon: null },
    { id: 'cosmo-market', name: { ru: 'Cosmo Market', en: 'Cosmo Market' }, tier: 'showcase',
        color: '#34d399', icon: { path: 'favicon/favicon.svg' } },
    { id: 'Best-Coffee-Regions_05L', name: { ru: 'The Best Coffee Regions', en: 'The Best Coffee Regions' }, tier: 'showcase',
        color: '#b7793f', icon: { path: 'img/Image20260629205240.jpg' } },
    { id: 'Library', name: { ru: 'Моя библиотека', en: 'My Library' }, tier: 'showcase',
        color: '#2dd4bf', icon: { path: 'favicon.webp' } },
    { id: 'AI_Logistic_Pipeline', name: { ru: 'AI Logistic Pipeline', en: 'AI Logistic Pipeline' }, tier: 'showcase',
        color: '#22c55e', icon: { path: 'favicon.webp' } },
    { id: 'Cosmo-Glass-Chess', name: { ru: 'Cyber Chess', en: 'Cyber Chess' }, tier: 'showcase',
        color: '#e879f9', icon: { path: 'favicon.webp' } },
    { id: 'star-wars-ts-routing', name: { ru: 'Star Wars', en: 'Star Wars' }, tier: 'showcase',
        color: '#fde047', icon: { path: 'star-wars-icon-png-8.jpg' } },
    { id: 'todo-ts', name: { ru: 'To-Do List', en: 'To-Do List' }, tier: 'showcase',
        color: '#60a5fa', icon: { path: 'favicon.webp' } },
    { id: 'weather-ts', name: { ru: 'Weather', en: 'Weather' }, tier: 'showcase',
        color: '#93c5fd', icon: { path: 'favicon.webp' } },
    { id: 'devil-cat-card', name: { ru: 'Devil Cat Card', en: 'Devil Cat Card' }, tier: 'showcase',
        color: '#ef4444', icon: { path: 'src/img/Devil%20Cat.jpg' } },
    { id: 'cosmo-martians', name: { ru: 'Cosmo Martians', en: 'Cosmo Martians' }, tier: 'mini',
        color: '#84cc16', icon: { emoji: '👽' } },
    { id: 'game-of-life-main', name: { ru: 'Game of Life', en: 'Game of Life' }, tier: 'mini',
        color: '#a3e635', icon: { path: 'favicon.webp' } },
    { id: 'Clock', name: { ru: 'Clock', en: 'Clock' }, tier: 'mini',
        color: '#f472b6', icon: { path: 'favicon.webp' } },
    { id: 'Shakshuka', name: { ru: 'Shakshuka', en: 'Shakshuka' }, tier: 'mini',
        color: '#fb7185', icon: { path: 'favicon.webp' } },
    { id: 'L_12_HandCrafts', name: { ru: 'HandCrafts', en: 'HandCrafts' }, tier: 'mini',
        color: '#d97706', icon: { path: 'favicon.webp' } },
    { id: 'L_09_Google', name: { ru: 'Google Search Forms', en: 'Google Search Forms' }, tier: 'mini',
        color: '#4ade80', icon: { path: 'favicon.webp' } },
    { id: 'Star_Wars', name: { ru: 'Star Wars (HTML)', en: 'Star Wars (HTML)' }, tier: 'mini',
        color: '#cbd5e1', icon: { path: 'Images/star-wars-icon-png-8.jpg' } },
] satisfies readonly PortfolioProject[]);
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. АДРЕСА, ИМЕНА И ЗНАЧКИ
// НАЧАЛО ФУНКЦИИ projectUrl
/** Живой сайт проекта на GitHub Pages. */
export function projectUrl(project: Pick<PortfolioProject, 'id'>): string {
    return `${PROJECT_SITE_ORIGIN}/${encodeURIComponent(project.id)}/`;
}
// КОНЕЦ ФУНКЦИИ projectUrl

// НАЧАЛО ФУНКЦИИ projectRepoUrl
/** Репозиторий проекта на GitHub — посмотреть код, а не только сам проект. */
export function projectRepoUrl(project: Pick<PortfolioProject, 'id'>): string {
    return `${PROJECT_REPO_ORIGIN}/${encodeURIComponent(project.id)}`;
}
// КОНЕЦ ФУНКЦИИ projectRepoUrl

// НАЧАЛО ФУНКЦИИ projectIconUrl
/** Фавикон с сайта проекта; null — у проекта нет своего файла-значка. */
export function projectIconUrl(project: Pick<PortfolioProject, 'id' | 'icon'>): string | null {
    if (!project.icon || !('path' in project.icon)) return null;
    return projectUrl(project) + project.icon.path.replace(/^\/+/, '');
}
// КОНЕЦ ФУНКЦИИ projectIconUrl

// НАЧАЛО ФУНКЦИИ projectName
/** Русский интерфейс показывает русское имя, остальные языки — международное. */
export function projectName(project: Pick<PortfolioProject, 'name'>, locale: Locale): string {
    return locale === 'ru' ? project.name.ru : project.name.en;
}
// КОНЕЦ ФУНКЦИИ projectName

// КОНЕЦ РАЗДЕЛА 3
