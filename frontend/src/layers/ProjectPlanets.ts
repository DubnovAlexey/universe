// ============================================================================
// ФАЙЛ: frontend/src/layers/ProjectPlanets.ts
// НАЗНАЧЕНИЕ: Планеты-проекты, которые летают по сцене после первого просмотра UNIVERSE (ветка site).
// РАЗДЕЛЫ: 1. Настройки; 2. Разметка планеты; 3. Наведение, касание и нажатие; 4. Пробуждение и полёт на кадре;
//          5. Язык и освобождение.
// ФУНКЦИИ: mountProjectPlanets.
// Сначала посетитель смотрит сам UNIVERSE: планет нет. Они появляются вместе с визиткой первого цикла — собранными
// в кольцо вокруг Уробороса — и дальше не пропадают: после перезапуска разлетаются по экрану, в фазах 01–04 держатся
// ближе к краям, чтобы не закрывать рисунок по центру, а к концу пятой фазы снова стягиваются к Уроборосу.
// В покое планета приглушена под общий тон сцены, её фавикон виден как чёрно-белый рисунок; при наведении (или фокусе
// с клавиатуры) «пелена спадает»: планета останавливается, растёт, проступают её настоящий цвет, фавикон и название
// по кругу. Нажатие открывает проект (onOpen). На телефоне первое касание показывает планету, второе открывает.
// Полёт считается в core/planetOrbits.ts на собственных часах планеты и пишется только в transform и opacity
// в общем кадре сцены (subscribeVisualSignals), поэтому DOM не перестраивается и сцена не дёргается.
// ?planets=1 в адресе будит планеты сразу — чтобы посмотреть их без ожидания финала.
// ============================================================================
import { getLocale, subscribeLocale, translateUi, type Locale } from '../core/locale';
import {
    createPlanetOrbits, easePlanetSpread, planetPose, planetSpreadTarget, PLANET_HOVER_PX, PLANET_SIZE_PX, type PlanetOrbit,
} from '../core/planetOrbits';
import { PORTFOLIO_PROJECTS, projectIconUrl, projectName, type PortfolioProject } from '../core/projectCatalog';
import { subscribeVisualSignals } from '../core/visualSignals';
import { universeStore } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. НАСТРОЙКИ
/** Мышь ушла — планета ждёт столько, прежде чем полететь: дрожание руки не дёргает её. */
const HOVER_RELEASE_MS = 250;
/** Касание на телефоне: столько планета показывает себя и ждёт второго касания. */
const TOUCH_PREVIEW_MS = 4000;
const SVG_NS = 'http://www.w3.org/2000/svg';
let ringSerial = 0;

interface PlanetRuntime {
    readonly project: PortfolioProject;
    readonly orbit: PlanetOrbit;
    readonly el: HTMLButtonElement;
    readonly ringText: SVGTextPathElement;
    /** Собственные часы полёта, с. */
    time: number;
    hovered: boolean;
    focused: boolean;
    previewUntil: number;
    releaseTimer: number;
    lastPointer: string;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. РАЗМЕТКА ПЛАНЕТЫ
// НАЧАЛО ФУНКЦИИ fillFace
/** Лицо планеты: фавикон с сайта проекта или его эмодзи; своего значка нет — планета без рисунка. */
function fillFace(face: HTMLElement, project: PortfolioProject): void {
    face.textContent = '';
    const url = projectIconUrl(project);
    if (url) {
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        img.referrerPolicy = 'no-referrer';
        img.addEventListener('error', () => { img.remove(); face.dataset.kind = 'none'; }, { once: true });
        img.src = url;
        face.dataset.kind = 'image';
        face.append(img);
    } else if (project.icon && 'emoji' in project.icon) {
        face.textContent = project.icon.emoji;
        face.dataset.kind = 'emoji';
    } else {
        face.dataset.kind = 'none';
    }
}
// КОНЕЦ ФУНКЦИИ fillFace

// НАЧАЛО ФУНКЦИИ createRing
/** Название бежит по окружности над планетой; центр текста — верхняя точка круга. */
function createRing(): { svg: SVGSVGElement; text: SVGTextPathElement } {
    const id = `project-planet-ring-${++ringSerial}`;
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add('project-planet__ring');
    const path = document.createElementNS(SVG_NS, 'path');
    path.id = id;
    path.setAttribute('d', 'M 8 60 A 52 52 0 1 1 112 60 A 52 52 0 1 1 8 60');
    path.setAttribute('fill', 'none');
    const text = document.createElementNS(SVG_NS, 'text');
    const textPath = document.createElementNS(SVG_NS, 'textPath');
    textPath.setAttribute('href', `#${id}`);
    textPath.setAttribute('startOffset', '25%');
    textPath.setAttribute('text-anchor', 'middle');
    text.append(textPath);
    svg.append(path, text);
    return { svg, text: textPath };
}
// КОНЕЦ ФУНКЦИИ createRing

// НАЧАЛО ФУНКЦИИ label
function label(project: PortfolioProject, locale: Locale): string {
    return `${projectName(project, locale)} — ${translateUi('открыть проект', locale)}`;
}
// КОНЕЦ ФУНКЦИИ label
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО ФУНКЦИИ mountProjectPlanets
export function mountProjectPlanets(
    root: HTMLElement | null,
    onOpen: (project: PortfolioProject, opener: HTMLElement) => void,
    projects: readonly PortfolioProject[] = PORTFOLIO_PROJECTS,
): () => void {
    if (!root || typeof window === 'undefined') return () => {};
    const locale = getLocale();
    const orbits = createPlanetOrbits(projects.length);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const wakeEarly = new URLSearchParams(window.location?.search ?? '').get('planets') === '1';
    let width = window.innerWidth;
    let height = window.innerHeight;
    let awake = false;
    let spread = 0;
    const cleanups: (() => void)[] = [];
    root.setAttribute('aria-label', translateUi('Проекты портфолио', locale));
    // До пробуждения планет не видно, и Tab их не находит
    root.inert = true;
    root.setAttribute('aria-hidden', 'true');

    const planets: PlanetRuntime[] = projects.map((project, index) => {
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `project-planet project-planet--${project.tier}`;
        el.dataset.projectId = project.id;
        el.setAttribute('aria-label', label(project, locale));
        el.style.setProperty('--planet-color', project.color);
        el.style.setProperty('--planet-size', `${PLANET_SIZE_PX[project.tier]}px`);
        el.style.setProperty('--planet-hover', `${PLANET_HOVER_PX}px`);
        // Планета нарисована в размере наведения и в покое уменьшена: при наведении она растёт до 1:1 — фавикон чёткий.
        el.style.setProperty('--planet-shrink', (PLANET_SIZE_PX[project.tier] / PLANET_HOVER_PX).toFixed(3));
        el.style.setProperty('--planet-arrive-delay', `${(index * 0.12).toFixed(2)}s`);
        const body = document.createElement('span');
        body.className = 'project-planet__body';
        body.setAttribute('aria-hidden', 'true');
        const face = document.createElement('span');
        face.className = 'project-planet__face';
        fillFace(face, project);
        body.append(face);
        const ring = createRing();
        ring.text.textContent = projectName(project, locale);
        el.append(body, ring.svg);
        root.append(el);
        return {
            project, orbit: orbits[index], el, ringText: ring.text,
            time: 0, hovered: false, focused: false, previewUntil: 0, releaseTimer: 0, lastPointer: 'mouse',
        };
    });

    // НАЧАЛО РАЗДЕЛА 3. НАВЕДЕНИЕ, КАСАНИЕ И НАЖАТИЕ
    const isHeld = (planet: PlanetRuntime, now: number): boolean =>
        planet.hovered || planet.focused || planet.previewUntil > now;
    const syncHeldClass = (planet: PlanetRuntime): void => {
        planet.el.classList.toggle('is-held', isHeld(planet, performance.now()));
    };

    for (const planet of planets) {
        const { el } = planet;
        const onEnter = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') return;
            window.clearTimeout(planet.releaseTimer);
            planet.hovered = true;
            syncHeldClass(planet);
        };
        const onLeave = (event: PointerEvent): void => {
            if (event.pointerType === 'touch') return;
            window.clearTimeout(planet.releaseTimer);
            planet.releaseTimer = window.setTimeout(() => {
                planet.hovered = false;
                syncHeldClass(planet);
            }, HOVER_RELEASE_MS);
        };
        const onDown = (event: PointerEvent): void => { planet.lastPointer = event.pointerType || 'mouse'; };
        const onFocus = (): void => { planet.focused = true; syncHeldClass(planet); };
        const onBlur = (): void => { planet.focused = false; syncHeldClass(planet); };
        const onClick = (): void => {
            const now = performance.now();
            if (planet.lastPointer === 'touch' && planet.previewUntil <= now) {
                // Первое касание: показать планету крупно с названием и подождать второго.
                for (const other of planets) if (other !== planet && other.previewUntil > now) {
                    other.previewUntil = 0;
                    syncHeldClass(other);
                }
                planet.previewUntil = now + TOUCH_PREVIEW_MS;
                syncHeldClass(planet);
                window.setTimeout(() => syncHeldClass(planet), TOUCH_PREVIEW_MS + 20);
                return;
            }
            planet.previewUntil = 0;
            planet.lastPointer = 'mouse';
            syncHeldClass(planet);
            onOpen(planet.project, el);
        };
        el.addEventListener('pointerenter', onEnter);
        el.addEventListener('pointerleave', onLeave);
        el.addEventListener('pointerdown', onDown);
        el.addEventListener('focus', onFocus);
        el.addEventListener('blur', onBlur);
        el.addEventListener('click', onClick);
        cleanups.push(() => {
            window.clearTimeout(planet.releaseTimer);
            el.removeEventListener('pointerenter', onEnter);
            el.removeEventListener('pointerleave', onLeave);
            el.removeEventListener('pointerdown', onDown);
            el.removeEventListener('focus', onFocus);
            el.removeEventListener('blur', onBlur);
            el.removeEventListener('click', onClick);
        });
    }
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ПРОБУЖДЕНИЕ И ПОЛЁТ НА КАДРЕ
    const onResize = (): void => { width = window.innerWidth; height = window.innerHeight; };
    window.addEventListener('resize', onResize);
    cleanups.push(() => window.removeEventListener('resize', onResize));

    const wake = (initialSpread: number): void => {
        awake = true;
        spread = initialSpread;
        root.inert = false;
        root.removeAttribute('aria-hidden');
        root.classList.add('is-awake');
    };

    const place = (dtSec: number, frozen: boolean): void => {
        const now = performance.now();
        const half = PLANET_HOVER_PX / 2;
        for (const planet of planets) {
            const held = isHeld(planet, now);
            if (!frozen && !held) planet.time += dtSec;
            const pose = planetPose(planet.orbit, planet.time, width, height, spread);
            const scale = held ? 1 : pose.scale;
            planet.el.style.transform =
                `translate3d(${(pose.x - half).toFixed(1)}px, ${(pose.y - half).toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
            planet.el.style.opacity = held ? '1' : pose.opacity.toFixed(2);
        }
    };

    const unsubscribeFrame = subscribeVisualSignals((signals, frame) => {
        const state = universeStore.getState();
        if (!awake) {
            if (!wakeEarly && !state.finaleReachedOnce) return;
            // Первый раз — вместе с визиткой: кольцом вокруг Уробороса; по ссылке ?planets=1 — сразу по своей фазе.
            wake(state.finaleReachedOnce ? 0 : planetSpreadTarget(state.currentPhase, state.singularityAct, signals.phaseProgress));
        }
        const dt = Number.isFinite(signals.frameDtSec) ? Math.min(0.1, Math.max(0, signals.frameDtSec)) : 0;
        const still = Boolean(reducedMotion?.matches) || signals.reducedMotion;
        const frozen = signals.isPaused || still;
        const target = planetSpreadTarget(state.currentPhase, state.singularityAct, signals.phaseProgress);
        if (still) spread = target;
        else if (!signals.isPaused) spread = easePlanetSpread(spread, target, dt);
        if (frame) frame.write(() => place(dt, frozen));
        else place(dt, frozen);
    }, 'project-planets');
    cleanups.push(unsubscribeFrame);
    // КОНЕЦ РАЗДЕЛА 4

    // НАЧАЛО РАЗДЕЛА 5. ЯЗЫК И ОСВОБОЖДЕНИЕ
    cleanups.push(subscribeLocale((nextLocale) => {
        root.setAttribute('aria-label', translateUi('Проекты портфолио', nextLocale));
        for (const planet of planets) {
            planet.el.setAttribute('aria-label', label(planet.project, nextLocale));
            planet.ringText.textContent = projectName(planet.project, nextLocale);
        }
    }));

    return () => {
        for (const cleanup of cleanups.splice(0)) cleanup();
        for (const planet of planets) planet.el.remove();
        root.classList.remove('is-awake');
    };
    // КОНЕЦ РАЗДЕЛА 5
}
// КОНЕЦ ФУНКЦИИ mountProjectPlanets
