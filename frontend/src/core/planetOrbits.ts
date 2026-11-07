// ============================================================================
// ФАЙЛ: frontend/src/core/planetOrbits.ts
// НАЗНАЧЕНИЕ: Орбиты планет-проектов — чистая математика без DOM (ветка site).
// РАЗДЕЛЫ: 1. Размеры и контракт; 2. Создание орбит; 3. Положение на кадре.
// ФУНКЦИИ: createPlanetOrbits, planetPose.
// Каждая планета летит по своему наклонному эллипсу вокруг центра сцены — там, где в финале собирается
// Уроборос. Эллипсы растянуты почти на весь экран, поэтому планеты «летают по экрану», а не толпятся у центра.
// Нижняя половина эллипса считается «ближе к зрителю»: там планета чуть крупнее и ярче, вверху — дальше и бледнее.
// Орбиты детерминированы зерном: один и тот же набор при каждой загрузке.
// ============================================================================
import { DeterministicPRNG } from './prng';
import type { PlanetTier } from './projectCatalog';

// НАЧАЛО РАЗДЕЛА 1. РАЗМЕРЫ И КОНТРАКТ
/** Диаметр планеты в покое, CSS px; при наведении все растут до PLANET_HOVER_PX — так виден фавикон. */
export const PLANET_SIZE_PX: Readonly<Record<PlanetTier, number>> = Object.freeze({ flagship: 30, showcase: 23, mini: 17 });
export const PLANET_HOVER_PX = 46;
/** Отступ от края экрана: планета целиком видна и её можно нажать. */
export const PLANET_EDGE_MARGIN_PX = 28;

export interface PlanetOrbit {
    /** Полуоси в долях половины ширины и половины высоты экрана. */
    readonly rx: number;
    readonly ry: number;
    /** Наклон эллипса, рад. */
    readonly tilt: number;
    /** Время одного оборота, с: медленно и спокойно. */
    readonly periodSec: number;
    /** Начальный угол, рад: планеты стартуют разнесёнными по кругу. */
    readonly phase: number;
    /** 1 — против часовой стрелки, −1 — по часовой. */
    readonly direction: 1 | -1;
}

export interface PlanetPose {
    readonly x: number;
    readonly y: number;
    /** −1 — дальняя (верхняя) точка орбиты, +1 — ближняя (нижняя). */
    readonly depth: number;
    /** Масштаб и непрозрачность от глубины. */
    readonly scale: number;
    readonly opacity: number;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. СОЗДАНИЕ ОРБИТ
// НАЧАЛО ФУНКЦИИ createPlanetOrbits
/** Полосы радиусов перемешаны, чтобы соседние по каталогу проекты не летали рядом. */
export function createPlanetOrbits(count: number, seed = 104729): PlanetOrbit[] {
    const total = Math.max(0, Math.floor(Number.isFinite(count) ? count : 0));
    const prng = new DeterministicPRNG(seed ^ 0x5eed9a1e);
    const bands = Array.from({ length: total }, (_, index) => index);
    for (let i = bands.length - 1; i > 0; i--) {
        const j = Math.floor(prng.nextFloat() * (i + 1));
        [bands[i], bands[j]] = [bands[j], bands[i]];
    }
    return bands.map((band, index) => {
        const spread = total > 1 ? band / (total - 1) : 0.5;
        return Object.freeze({
            rx: 0.42 + spread * 0.5 + prng.nextRange(-0.03, 0.03),
            ry: 0.36 + spread * 0.52 + prng.nextRange(-0.03, 0.03),
            tilt: prng.nextRange(-0.32, 0.32),
            periodSec: prng.nextRange(85, 175),
            phase: (index / Math.max(1, total)) * Math.PI * 2 + prng.nextRange(-0.2, 0.2),
            direction: prng.nextFloat() < 0.8 ? 1 : -1,
        });
    });
}
// КОНЕЦ ФУНКЦИИ createPlanetOrbits
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПОЛОЖЕНИЕ НА КАДРЕ
// НАЧАЛО ФУНКЦИИ planetPose
/** Положение планеты на собственных часах timeSec; экран любой ширины, центр — середина сцены. */
export function planetPose(orbit: Readonly<PlanetOrbit>, timeSec: number, width: number, height: number): PlanetPose {
    const w = Number.isFinite(width) ? Math.max(1, width) : 1;
    const h = Number.isFinite(height) ? Math.max(1, height) : 1;
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    const angle = orbit.phase + orbit.direction * (Math.PI * 2 * t) / orbit.periodSec;
    const ex = Math.cos(angle) * orbit.rx * w * 0.5;
    const ey = Math.sin(angle) * orbit.ry * h * 0.5;
    const cos = Math.cos(orbit.tilt);
    const sin = Math.sin(orbit.tilt);
    const margin = Math.min(PLANET_EDGE_MARGIN_PX, w * 0.25, h * 0.25);
    const x = Math.min(w - margin, Math.max(margin, w * 0.5 + ex * cos - ey * sin));
    const y = Math.min(h - margin, Math.max(margin, h * 0.5 + ex * sin + ey * cos));
    const depth = Math.sin(angle);
    const near = (depth + 1) * 0.5;
    return { x, y, depth, scale: 0.8 + near * 0.2, opacity: 0.68 + near * 0.32 };
}
// КОНЕЦ ФУНКЦИИ planetPose
// КОНЕЦ РАЗДЕЛА 3
