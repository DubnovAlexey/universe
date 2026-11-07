// ============================================================================
// ФАЙЛ: frontend/src/tests/projectPlanets.test.ts
// НАЗНАЧЕНИЕ: Ветка site — каталог проектов, орбиты планет, пауза сцены и музыки под открытым проектом.
// РАЗДЕЛЫ: 1. Каталог; 2. Орбиты; 3. Пауза сцены; 4. Музыка под открытым проектом.
// ФУНКЦИИ: runProjectPlanetChecks.
// ============================================================================
import {
    PORTFOLIO_PROJECTS, PROJECT_SITE_ORIGIN, projectIconUrl, projectInitials, projectName, projectUrl,
} from '../core/projectCatalog';
import { createPlanetOrbits, planetPose, PLANET_EDGE_MARGIN_PX } from '../core/planetOrbits';
import { universeStore } from '../store/universeState';
import { AudioSyncEngine } from '../utils/audioSync';
import { integrationRegistry } from '../core/integrationRegistry';

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
    check(PORTFOLIO_PROJECTS.every(project => projectUrl(project) === `${PROJECT_SITE_ORIGIN}/${project.id}/`) &&
        projectUrl({ id: 'a b' }) === `${PROJECT_SITE_ORIGIN}/a%20b/`,
        'Each project opens its live GitHub Pages site; unusual repository names are URL-encoded');
    const mars = PORTFOLIO_PROJECTS.find(project => project.id === 'Mars-project2')!;
    const rings = PORTFOLIO_PROJECTS.find(project => project.id === 'Olympic-Rings-Gallery')!;
    const fridge = PORTFOLIO_PROJECTS.find(project => project.id === 'smart-fridge-app')!;
    check(projectIconUrl(rings) === `${PROJECT_SITE_ORIGIN}/Olympic-Rings-Gallery/img/zoich.png` &&
        projectIconUrl(mars) === null && projectIconUrl(fridge) === null &&
        projectIconUrl({ id: 'x', icon: { path: '/icon.svg' } }) === `${PROJECT_SITE_ORIGIN}/x/icon.svg`,
        'A planet face is the favicon from the project\'s own site; emoji and missing icons resolve to no file');
    check(projectName(mars, 'ru') === 'Новейшие марсианские хроники' && projectName(mars, 'he') === 'The Newest Martian Chronicles' &&
        projectInitials('Новейшие марсианские хроники') === 'НМ' && projectInitials('Star Wars (HTML)') === 'SW' &&
        projectInitials('Clock') === 'C' && projectInitials(' — ') === '•',
        'Names follow the interface language; temporary initials take the first letters of two words');
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. ОРБИТЫ
    const orbits = createPlanetOrbits(PORTFOLIO_PROJECTS.length);
    const again = createPlanetOrbits(PORTFOLIO_PROJECTS.length);
    check(orbits.length === PORTFOLIO_PROJECTS.length && JSON.stringify(orbits) === JSON.stringify(again) &&
        createPlanetOrbits(-3).length === 0 && createPlanetOrbits(Number.NaN).length === 0,
        'Orbits are deterministic for one seed, one per project, and invalid counts produce none');
    let inside = true, finite = true, depthRange = true;
    for (const [w, h] of [[1366, 768], [390, 844], [2560, 1080]] as const) {
        for (const orbit of orbits) {
            for (let t = 0; t <= 400; t += 4.7) {
                const pose = planetPose(orbit, t, w, h);
                finite &&= [pose.x, pose.y, pose.scale, pose.opacity].every(Number.isFinite);
                inside &&= pose.x >= PLANET_EDGE_MARGIN_PX - 1e-6 && pose.x <= w - PLANET_EDGE_MARGIN_PX + 1e-6 &&
                    pose.y >= PLANET_EDGE_MARGIN_PX - 1e-6 && pose.y <= h - PLANET_EDGE_MARGIN_PX + 1e-6;
                depthRange &&= pose.scale >= 0.8 - 1e-9 && pose.scale <= 1 + 1e-9 && pose.opacity >= 0.68 - 1e-9 && pose.opacity <= 1 + 1e-9;
            }
        }
    }
    check(finite && inside && depthRange,
        'On desktop, phone and ultra-wide screens every planet stays fully on screen; nearer planets are larger and brighter');
    const step = orbits.map(orbit => {
        const a = planetPose(orbit, 10, 1366, 768), b = planetPose(orbit, 10 + 1 / 60, 1366, 768);
        return Math.hypot(b.x - a.x, b.y - a.y);
    });
    const start = orbits.map(orbit => planetPose(orbit, 0, 1366, 768));
    let closest = Infinity;
    for (let i = 0; i < start.length; i++) for (let j = i + 1; j < start.length; j++) {
        closest = Math.min(closest, Math.hypot(start[i].x - start[j].x, start[i].y - start[j].y));
    }
    check(Math.max(...step) < 1.2 && Math.min(...step) > 0.05 && closest > 24,
        'Planets drift calmly (under 1.2 px per 60 Hz frame on 1366×768) and start spread out, not stacked on each other');
    const garbage = planetPose(orbits[0], Number.NaN, Number.NaN, -5);
    check([garbage.x, garbage.y].every(Number.isFinite), 'Invalid time or viewport values still give a finite position');
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
}
// КОНЕЦ ФУНКЦИИ runProjectPlanetChecks
