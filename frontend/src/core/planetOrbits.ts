// ============================================================================
// ФАЙЛ: frontend/src/core/planetOrbits.ts
// НАЗНАЧЕНИЕ: Орбиты планет-проектов — чистая математика без DOM (ветка site).
// РАЗДЕЛЫ: 1. Размеры и контракт; 2. Создание орбит; 3. Разлёт по фазам; 4. Положение на кадре.
// ФУНКЦИИ: createPlanetOrbits, planetSpreadTarget, easePlanetSpread, planetPose.
// У каждой планеты две орбиты вокруг центра сцены. «Широкая» растянута почти на весь экран и обходит центр стороной:
// в фазах 01–04 планеты летают ближе к краям и не закрывают рисунок, который идёт по центру. «Собранная» — тесное
// кольцо вокруг Уробороса в финале. Разлёт spread (1 — широко, 0 — собраны) плавно меняется по фазам: к концу
// пятой фазы планеты стягиваются к Уроборосу, после перезапуска снова разлетаются.
// Нижняя половина орбиты считается «ближе к зрителю»: там планета чуть крупнее и ярче, вверху — дальше и бледнее.
// Орбиты детерминированы зерном: один и тот же набор при каждой загрузке.
// ============================================================================
import { DeterministicPRNG } from './prng';
import type { PlanetTier } from './projectCatalog';
import type { PhaseId, SingularityAct } from '../store/universeState';

// НАЧАЛО РАЗДЕЛА 1. РАЗМЕРЫ И КОНТРАКТ
/** Диаметр планеты в покое, CSS px; при наведении все растут до PLANET_HOVER_PX — так виден фавикон. */
export const PLANET_SIZE_PX: Readonly<Record<PlanetTier, number>> = Object.freeze({ flagship: 30, showcase: 23, mini: 17 });
export const PLANET_HOVER_PX = 46;
/** Отступ от края экрана: планета целиком видна и её можно нажать. */
export const PLANET_EDGE_MARGIN_PX = 28;
/** Радиус кольца Уробороса в долях меньшей стороны экрана — как в getOuroborosLayout (core/ouroborosEpisode.ts). */
export const OUROBOROS_SCALE_SHARE = 0.232;
/** За сколько секунд разлёт проходит ~63 % пути к цели: перестройка спокойная, без рывков. */
export const PLANET_SPREAD_TAU_SEC = 3.5;

export interface PlanetOrbit {
    /** Широкая орбита: полуоси в долях половины ширины и половины высоты экрана. */
    readonly rx: number;
    readonly ry: number;
    readonly tilt: number;
    /** Собранная орбита: радиус в радиусах кольца Уробороса и её наклон. */
    readonly gather: number;
    readonly gatherTilt: number;
    /** Время одного оборота, с. */
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
            rx: 0.6 + spread * 0.33 + prng.nextRange(-0.02, 0.02),
            ry: 0.54 + spread * 0.36 + prng.nextRange(-0.02, 0.02),
            tilt: prng.nextRange(-0.28, 0.28),
            gather: 1.32 + spread * 0.62 + prng.nextRange(-0.04, 0.04),
            gatherTilt: prng.nextRange(-0.14, 0.14),
            periodSec: prng.nextRange(70, 145),
            phase: (index / Math.max(1, total)) * Math.PI * 2 + prng.nextRange(-0.06, 0.06),
            direction: prng.nextFloat() < 0.8 ? 1 : -1,
        });
    });
}
// КОНЕЦ ФУНКЦИИ createPlanetOrbits
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. РАЗЛЁТ ПО ФАЗАМ
// НАЧАЛО ФУНКЦИИ planetSpreadTarget
/** Куда стремится разлёт: в фазах 01–04 широко (1); в пятой фазе планеты стягиваются и к визитке (акт D)
 *  собраны вокруг Уробороса (0); перезапуск держит их собранными, новая фаза 01 снова разводит их. */
export function planetSpreadTarget(phase: PhaseId, act: SingularityAct, phaseProgress: number): number {
    if (phase !== '05_SINGULARITY') return 1;
    if (act === 'ACT_D_GITHUB_CARD' || act === 'RESTART_COLLAPSE') return 0;
    const p = Number.isFinite(phaseProgress) ? Math.max(0, Math.min(1, phaseProgress)) : 0;
    // Визитка начинается около 64 % пятой фазы: к этому моменту кольцо планет уже стянуто.
    const x = Math.max(0, Math.min(1, (p - 0.2) / 0.44));
    return 1 - x * x * (3 - 2 * x);
}
// КОНЕЦ ФУНКЦИИ planetSpreadTarget

// НАЧАЛО ФУНКЦИИ easePlanetSpread
/** Плавное приближение разлёта к цели по реальному времени кадра. */
export function easePlanetSpread(current: number, target: number, dtSec: number, tauSec = PLANET_SPREAD_TAU_SEC): number {
    const from = Number.isFinite(current) ? current : target;
    const dt = Number.isFinite(dtSec) ? Math.max(0, dtSec) : 0;
    if (!(tauSec > 0)) return target;
    if (dt === 0) return from;
    return target + (from - target) * Math.exp(-dt / tauSec);
}
// КОНЕЦ ФУНКЦИИ easePlanetSpread
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ПОЛОЖЕНИЕ НА КАДРЕ
// НАЧАЛО ФУНКЦИИ planetPose
/** Положение планеты на собственных часах timeSec; spread смешивает собранную и широкую орбиты. */
export function planetPose(orbit: Readonly<PlanetOrbit>, timeSec: number, width: number, height: number, spread = 1): PlanetPose {
    const w = Number.isFinite(width) ? Math.max(1, width) : 1;
    const h = Number.isFinite(height) ? Math.max(1, height) : 1;
    const t = Number.isFinite(timeSec) ? timeSec : 0;
    const s = Number.isFinite(spread) ? Math.max(0, Math.min(1, spread)) : 1;
    const ring = Math.min(w, h) * OUROBOROS_SCALE_SHARE * orbit.gather;
    const radiusX = ring + (orbit.rx * w * 0.5 - ring) * s;
    const radiusY = ring * 0.82 + (orbit.ry * h * 0.5 - ring * 0.82) * s;
    const tilt = orbit.gatherTilt + (orbit.tilt - orbit.gatherTilt) * s;
    const angle = orbit.phase + orbit.direction * (Math.PI * 2 * t) / orbit.periodSec;
    const ex = Math.cos(angle) * radiusX;
    const ey = Math.sin(angle) * radiusY;
    const cos = Math.cos(tilt);
    const sin = Math.sin(tilt);
    const margin = Math.min(PLANET_EDGE_MARGIN_PX, w * 0.25, h * 0.25);
    const x = Math.min(w - margin, Math.max(margin, w * 0.5 + ex * cos - ey * sin));
    const y = Math.min(h - margin, Math.max(margin, h * 0.5 + ex * sin + ey * cos));
    const depth = Math.sin(angle);
    const near = (depth + 1) * 0.5;
    return { x, y, depth, scale: 0.8 + near * 0.2, opacity: 0.68 + near * 0.32 };
}
// КОНЕЦ ФУНКЦИИ planetPose
// КОНЕЦ РАЗДЕЛА 4
