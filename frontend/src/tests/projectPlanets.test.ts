// ============================================================================
// ФАЙЛ: frontend/src/tests/projectPlanets.test.ts
// НАЗНАЧЕНИЕ: Ветка site — каталог проектов, орбиты и разлёт планет по фазам, пауза сцены и музыки под проектом,
//             холст обычной вкладки под страницей проекта.
// РАЗДЕЛЫ: 1. Каталог; 2. Орбиты и разлёт; 3. Пауза сцены; 4. Музыка под открытым проектом; 5. Холст под проектом.
// ФУНКЦИИ: runProjectPlanetChecks.
// ============================================================================
import {
    PORTFOLIO_PROJECTS, PROJECT_REPO_ORIGIN, PROJECT_SITE_ORIGIN, projectIconUrl, projectName, projectRepoUrl, projectUrl,
} from '../core/projectCatalog';
import {
    createPlanetOrbits, easePlanetSpread, OUROBOROS_SCALE_SHARE, planetPose, planetSpreadTarget, PLANET_EDGE_MARGIN_PX,
} from '../core/planetOrbits';
import { universeStore } from '../store/universeState';
import { AudioSyncEngine } from '../utils/audioSync';
import { integrationRegistry } from '../core/integrationRegistry';
import { isProjectDocumentReady, PAGE_CANVAS_DARK, PAGE_CANVAS_LIGHT, pageCanvasColor } from '../layers/ProjectViewer';

// Управляемый HTMLAudioElement: play() сразу «успешен», события вызываются вручную
class CoverAudioFixture {
    static instances: CoverAudioFixture[] = [];
    readonly attributes = new Map<string, string>();
    readonly listeners = new Map<string, (() => void)[]>();
    loop = false; preload = ''; volume = 1; muted = false; paused = true;
    currentTime = 0; duration = 408; readyState = 0; ended = false; error: { code: number } | null = null;
    playCalls = 0;
    constructor() { CoverAudioFixture.instances.push(this); }
    set src(value: string) { this.attributes.set('src', value); }
    get src(): string { return this.attributes.get('src') ?? ''; }
    setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
    getAttribute(name: string): string | null { return this.attributes.get(name) ?? null; }
    addEventListener(name: string, callback: () => void): void {
        const list = this.listeners.get(name) ?? []; list.push(callback); this.listeners.set(name, list);
    }
    emit(name: string): void { this.listeners.get(name)?.forEach(callback => callback()); }
    load(): void { /* источник уже назначен */ }
    play(): Promise<void> { this.playCalls++; this.paused = false; return Promise.resolve(); }
    pause(): void { this.paused = true; }
}

// НАЧАЛО ФУНКЦИИ runProjectPlanetChecks
export function runProjectPlanetChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 1. КАТАЛОГ
    const ids = PORTFOLIO_PROJECTS.map(project => project.id);
    const colors = PORTFOLIO_PROJECTS.map(project => project.color.toLowerCase());
    check(PORTFOLIO_PROJECTS.length >= 20 && new Set(ids).size === ids.length && !ids.includes('universe'),
        'The catalogue lists every portfolio project once (20+ planets) and never UNIVERSE itself');
    check(colors.every(color => /^#[0-9a-f]{6}$/.test(color)) && new Set(colors).size === colors.length,
        'Every planet has its own valid #rrggbb colour, so the projects differ from afar');
    check(PORTFOLIO_PROJECTS.every(project => projectUrl(project) === `${PROJECT_SITE_ORIGIN}/${project.id}/` &&
            projectRepoUrl(project) === `${PROJECT_REPO_ORIGIN}/${project.id}`) &&
        projectUrl({ id: 'a b' }) === `${PROJECT_SITE_ORIGIN}/a%20b/` && projectRepoUrl({ id: 'a b' }) === `${PROJECT_REPO_ORIGIN}/a%20b`,
        'Each project opens its live GitHub Pages site and links its source repository; unusual names are URL-encoded');
    const mars = PORTFOLIO_PROJECTS.find(project => project.id === 'Mars-project2')!;
    const rings = PORTFOLIO_PROJECTS.find(project => project.id === 'Olympic-Rings-Gallery')!;
    const fridge = PORTFOLIO_PROJECTS.find(project => project.id === 'smart-fridge-app')!;
    check(projectIconUrl(rings) === `${PROJECT_SITE_ORIGIN}/Olympic-Rings-Gallery/img/zoich.png` &&
        projectIconUrl(mars) === null && projectIconUrl(fridge) === null &&
        projectIconUrl({ id: 'x', icon: { path: '/icon.svg' } }) === `${PROJECT_SITE_ORIGIN}/x/icon.svg`,
        'A planet face is the favicon from the project\'s own site; emoji and missing icons resolve to no file');
    check(projectName(mars, 'ru') === 'Новейшие марсианские хроники' && projectName(mars, 'he') === 'The Newest Martian Chronicles' &&
        projectName(rings, 'es') === 'Olympic Rings Gallery',
        'Names follow the interface language: Russian names in Russian, international names elsewhere');
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. ОРБИТЫ И РАЗЛЁТ
    const orbits = createPlanetOrbits(PORTFOLIO_PROJECTS.length);
    const again = createPlanetOrbits(PORTFOLIO_PROJECTS.length);
    check(orbits.length === PORTFOLIO_PROJECTS.length && JSON.stringify(orbits) === JSON.stringify(again) &&
        createPlanetOrbits(-3).length === 0 && createPlanetOrbits(Number.NaN).length === 0,
        'Orbits are deterministic for one seed, one per project, and invalid counts produce none');
    let inside = true, finite = true, depthRange = true, wideAvoidsCentre = true, ringAroundOuroboros = true;
    for (const [w, h] of [[1366, 768], [390, 844], [2560, 1080]] as const) {
        const ouroboros = Math.min(w, h) * OUROBOROS_SCALE_SHARE;
        for (const orbit of orbits) {
            for (let t = 0; t <= 400; t += 4.7) {
                for (const spread of [0, 0.5, 1]) {
                    const pose = planetPose(orbit, t, w, h, spread);
                    finite &&= [pose.x, pose.y, pose.scale, pose.opacity].every(Number.isFinite);
                    inside &&= pose.x >= PLANET_EDGE_MARGIN_PX - 1e-6 && pose.x <= w - PLANET_EDGE_MARGIN_PX + 1e-6 &&
                        pose.y >= PLANET_EDGE_MARGIN_PX - 1e-6 && pose.y <= h - PLANET_EDGE_MARGIN_PX + 1e-6;
                    depthRange &&= pose.scale >= 0.8 - 1e-9 && pose.scale <= 1 + 1e-9 &&
                        pose.opacity >= 0.68 - 1e-9 && pose.opacity <= 1 + 1e-9;
                    const fromCentre = Math.hypot((pose.x - w / 2) / (w / 2), (pose.y - h / 2) / (h / 2));
                    if (spread === 1) wideAvoidsCentre &&= fromCentre > 0.38;
                    if (spread === 0 && w >= 1000) {
                        const r = Math.hypot(pose.x - w / 2, pose.y - h / 2);
                        ringAroundOuroboros &&= r > ouroboros * 0.95 && r < ouroboros * 2.1;
                    }
                }
            }
        }
    }
    check(finite && inside && depthRange,
        'On desktop, phone and ultra-wide screens every planet stays fully on screen at any spread; nearer planets are larger and brighter');
    check(wideAvoidsCentre && ringAroundOuroboros,
        'Spread out, planets keep away from the centre drawing; gathered, they ring the Ouroboros instead of covering it');
    check(planetSpreadTarget('01_VOID', 'INACTIVE', 0.5) === 1 && planetSpreadTarget('03_EVOLUTION', 'INACTIVE', 0) === 1 &&
        planetSpreadTarget('05_SINGULARITY', 'ACT_A_ACCRETION', 0.1) === 1 &&
        planetSpreadTarget('05_SINGULARITY', 'ACT_B_LOGIC', 0.42) > 0.3 && planetSpreadTarget('05_SINGULARITY', 'ACT_B_LOGIC', 0.42) < 0.7 &&
        planetSpreadTarget('05_SINGULARITY', 'ACT_C_ZERO_SILENCE', 0.64) === 0 &&
        planetSpreadTarget('05_SINGULARITY', 'ACT_D_GITHUB_CARD', 0.7) === 0 &&
        planetSpreadTarget('05_SINGULARITY', 'RESTART_COLLAPSE', 0.99) === 0 &&
        planetSpreadTarget('05_SINGULARITY', 'ACT_B_LOGIC', Number.NaN) === 1,
        'Planets fly wide in phases 01-04, gather during phase 05 and ring the Ouroboros from the business card through the restart');
    const eased = easePlanetSpread(0, 1, 3.5);
    check(Math.abs(eased - (1 - Math.exp(-1))) < 1e-9 && easePlanetSpread(0.3, 0.3, 5) === 0.3 &&
        easePlanetSpread(0.2, 1, 0) === 0.2 && easePlanetSpread(Number.NaN, 0.6, 1) === 0.6 && easePlanetSpread(0, 1, 1, 0) === 1,
        'The spread follows its target smoothly in real time (63% in 3.5 s), never jumps, and survives invalid input');
    const step = orbits.map(orbit => {
        const a = planetPose(orbit, 10, 1366, 768), b = planetPose(orbit, 10 + 1 / 60, 1366, 768);
        return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const start = orbits.map(orbit => planetPose(orbit, 0, 1366, 768));
    let closest = Infinity;
    for (let i = 0; i < start.length; i++) for (let j = i + 1; j < start.length; j++) {
        closest = Math.min(closest, Math.hypot(start[i].x - start[j].x, start[i].y - start[j].y));
    }
    check(Math.max(...step) < 1.4 && Math.min(...step) > 0.1 && closest > 24,
        'Planets drift calmly (under 1.4 px per 60 Hz frame on 1366x768) and start spread out, not stacked on each other');
    const garbage = planetPose(orbits[0], Number.NaN, Number.NaN, -5, Number.NaN);
    check([garbage.x, garbage.y].every(Number.isFinite), 'Invalid time, viewport or spread values still give a finite position');
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ПАУЗА СЦЕНЫ
    try {
        universeStore.setTabHidden(false);
        universeStore.setSceneCovered(true);
        const coveredHidden = universeStore.getState().isTabHidden;
        universeStore.setTabHidden(true);
        universeStore.setSceneCovered(false);
        const stillHiddenByTab = universeStore.getState().isTabHidden;
        universeStore.setSceneCovered(true);
        universeStore.setTabHidden(false);
        const stillHiddenByProject = universeStore.getState().isTabHidden;
        universeStore.setSceneCovered(false);
        check(coveredHidden && stillHiddenByTab && stillHiddenByProject && !universeStore.getState().isTabHidden,
            'An open project and a hidden tab are independent reasons to stop the scene; it runs again only when both are gone');
    } finally {
        universeStore.setSceneCovered(false);
        universeStore.setTabHidden(false);
    }
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. МУЗЫКА ПОД ОТКРЫТЫМ ПРОЕКТОМ
    const names = ['window', 'navigator', 'Audio'] as const;
    const globals = names.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
    const statusDescriptor = Object.getOwnPropertyDescriptor(integrationRegistry, 'updateModuleStatus');
    const storeDescriptor = Object.getOwnPropertyDescriptor(universeStore, 'setAudioEnabled');
    try {
        Object.defineProperty(globalThis, 'window', { configurable: true,
            value: { addEventListener: () => {}, removeEventListener: () => {} } });
        Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone' } });
        Object.defineProperty(globalThis, 'Audio', { configurable: true, value: CoverAudioFixture });
        Object.defineProperty(integrationRegistry, 'updateModuleStatus', { configurable: true, value: () => {} });
        Object.defineProperty(universeStore, 'setAudioEnabled', { configurable: true, value: () => {} });
        CoverAudioFixture.instances.length = 0;
        const engine = new AudioSyncEngine();
        const audio = CoverAudioFixture.instances[0];
        engine.startPlayback(true);
        audio.emit('playing');
        engine.setCovered(true);
        const pausedUnderProject = audio.paused && engine.isCovered();
        const callsWhileCovered = audio.playCalls;
        engine.startPlayback(true);
        audio.paused = false; audio.emit('playing');
        const silentWhileCovered = audio.playCalls === callsWhileCovered && audio.paused;
        engine.setCovered(false);
        check(pausedUnderProject && silentWhileCovered && !engine.isCovered() && audio.playCalls === callsWhileCovered + 1 &&
            !audio.paused && engine.isEnabled(),
            'Opening a project pauses the UNIVERSE music, gestures cannot restart it underneath, and closing resumes it');

        engine.setEnabled(false);
        engine.setCovered(true);
        engine.setCovered(false);
        const mutedStaysMuted = audio.paused && !engine.isEnabled();
        engine.setEnabled(true);
        audio.emit('playing');
        engine.setEnabled(false);
        engine.setEnabled(true);
        engine.setCovered(true);
        engine.setCovered(true);
        engine.setCovered(false);
        check(mutedStaysMuted && engine.isEnabled() && !engine.isCovered(),
            'A muted scene stays muted after a project closes; repeated cover calls are harmless');
    } finally {
        for (const [name, descriptor] of globals) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);
        }
        if (statusDescriptor) Object.defineProperty(integrationRegistry, 'updateModuleStatus', statusDescriptor);
        else Reflect.deleteProperty(integrationRegistry, 'updateModuleStatus');
        if (storeDescriptor) Object.defineProperty(universeStore, 'setAudioEnabled', storeDescriptor);
        else Reflect.deleteProperty(universeStore, 'setAudioEnabled');
        CoverAudioFixture.instances.length = 0;
    }
    // КОНЕЦ РАЗДЕЛА 4

    // НАЧАЛО РАЗДЕЛА 5. ХОЛСТ ПОД ПРОЕКТОМ
    // Страница без своего фона (Cosmo Market, Game of Life, Shakshuka) в обычной вкладке лежит на белом холсте.
    const page = (scheme: string, url = `${PROJECT_SITE_ORIGIN}/cosmo-market/`, body: object | null = {}) => ({
        URL: url, body, documentElement: {} as Element,
        defaultView: { getComputedStyle: () => ({ colorScheme: scheme }) },
    });
    check(pageCanvasColor(page('normal'), false) === PAGE_CANVAS_LIGHT && pageCanvasColor(page('normal'), true) === PAGE_CANVAS_LIGHT &&
        pageCanvasColor(page('dark'), false) === PAGE_CANVAS_DARK && pageCanvasColor(page('light dark'), false) === PAGE_CANVAS_LIGHT &&
        pageCanvasColor(page('light dark'), true) === PAGE_CANVAS_DARK && pageCanvasColor(null, true) === PAGE_CANVAS_LIGHT,
    'A project page gets the canvas of a normal tab: white, dark only when the page itself asks for a dark scheme');
    check(!isProjectDocumentReady(null) && !isProjectDocumentReady(page('normal', 'about:blank')) &&
        !isProjectDocumentReady(page('normal', `${PROJECT_SITE_ORIGIN}/cosmo-market/`, null)) && isProjectDocumentReady(page('normal')),
    'The canvas waits for the project document itself, not for the blank placeholder before navigation');
    // КОНЕЦ РАЗДЕЛА 5
}
// КОНЕЦ ФУНКЦИИ runProjectPlanetChecks
