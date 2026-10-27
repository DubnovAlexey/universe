// ============================================================================
// ФАЙЛ: frontend/src/tests/ouroborosFieldMorph.test.ts
// НАЗНАЧЕНИЕ: Проверить передачу экранных частиц в объёмную форму без новой физики.
// РАЗДЕЛЫ: 1. Фикстуры; 2. Концы и интерполяция; 3. Границы и стабильные индексы.
// ФУНКЦИИ: makeGeometry, runOuroborosFieldMorphChecks.
// ============================================================================
import { applyOuroborosFieldMorph, type OuroborosFieldSource } from '../core/ouroborosFieldMorph';
import { fillOuroborosPoints, OUROBOROS_STRIDE } from '../core/ouroborosModel';
import type { OuroborosLayout } from '../core/ouroborosEpisode';

// НАЧАЛО РАЗДЕЛА 1. ФИКСТУРЫ
// НАЧАЛО ФУНКЦИИ makeGeometry
function makeGeometry(count: number): Float32Array {
    const points = new Float32Array(count * OUROBOROS_STRIDE);
    fillOuroborosPoints(points, 104729, count, 17, 1, 0.4);
    return points;
}
// КОНЕЦ ФУНКЦИИ makeGeometry
const SOURCES: readonly OuroborosFieldSource[] = Object.freeze([
    Object.freeze({ x: 384, y: 320, radius: 1.25 }),
    Object.freeze({ x: 640, y: 448, radius: 2.5 }),
    Object.freeze({ x: 512, y: 384, radius: 0.75 }),
]);
const LAYOUT: OuroborosLayout = { centerX: 512, centerY: 384, scale: 128 };
// КОНЕЦ РАЗДЕЛА 1. ФИКСТУРЫ

// НАЧАЛО ФУНКЦИИ runOuroborosFieldMorphChecks
export function runOuroborosFieldMorphChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. КОНЦЫ И ИНТЕРПОЛЯЦИЯ
    const points = makeGeometry(12);
    const original = points.slice();
    const sourcesBefore = JSON.stringify(SOURCES);
    const zeroApplied = applyOuroborosFieldMorph(points, 12, SOURCES, LAYOUT, 0, 104729);
    let exactSources = true;
    for (let i = 0; i < 12; i++) {
        const offset = i * OUROBOROS_STRIDE;
        const source = SOURCES[i % SOURCES.length];
        const perspective = 3 / (3 + points[offset + 2]);
        exactSources &&= LAYOUT.centerX + points[offset] * LAYOUT.scale * perspective === source.x &&
            LAYOUT.centerY - points[offset + 1] * LAYOUT.scale * perspective === source.y &&
            points[offset + 2] === 0 && points[offset + 3] === 0 && points[offset + 4] === 0 &&
            points[offset + 5] === -1 && points[offset + 6] === source.radius && points[offset + 7] === 1;
    }
    check(zeroApplied && exactSources && points[1] > 0 && points[9] < 0 && JSON.stringify(SOURCES) === sourcesBefore,
        'Morph zero projects each point onto its actual source particle with source radius, front normal and dust material without mutating sources');

    points.set(original);
    const originalBits = new Uint32Array(original.buffer);
    check(applyOuroborosFieldMorph(points, 12, SOURCES, LAYOUT, 1, 104729) &&
        new Uint32Array(points.buffer).every((value, index) => value === originalBits[index]),
        'Morph one preserves every original packed geometry bit, including Rust normals and satellite/dust kinds');

    const screenSources = [{ x: 37.125, y: 81.375, radius: 0.9 }, { x: 302.7777, y: 550.125, radius: 2.12 }];
    const phoneLayout = { centerX: 195, centerY: 497.96, scale: 79.95 };
    points.set(original);
    applyOuroborosFieldMorph(points, 12, screenSources, phoneLayout, 0, 104729);
    let subpixelMatch = true;
    for (let i = 0; i < 12; i++) {
        const source = screenSources[i % screenSources.length];
        subpixelMatch &&= Math.abs(phoneLayout.centerX + points[i * 8] * phoneLayout.scale - source.x) < 0.00003 &&
            Math.abs(phoneLayout.centerY - points[i * 8 + 1] * phoneLayout.scale - source.y) < 0.00003;
    }
    check(subpixelMatch,
        'Arbitrary fractional CSS source coordinates survive Float32 inverse projection with less than 0.00003px error');

    const vertical = new Float32Array([0, -0.75, 0, 0, 0, -1, 1, 0]);
    applyOuroborosFieldMorph(vertical, 1, [{ x: 512, y: 248, radius: 1 }], LAYOUT, 0.5, 104729);
    check(vertical[1] === 0.15625 && LAYOUT.centerY - vertical[1] * LAYOUT.scale === 364,
        'Source-to-target interpolation uses screenY=centerY-worldY*scale, preserving the actual upper/lower field orientation');

    const transition = new Float32Array([1, 2, 0.5, 0, 0, 1, 4, 0, -1, 1, -0.5, 0, 0, -1, 6, 2]);
    const transitionTarget = transition.slice();
    const source = [{ x: 0, y: 0, radius: 2 }];
    const layout = { centerX: 0, centerY: 0, scale: 1 };
    let smoothNormals = true;
    let smoothSizes = true;
    for (const progress of [0.001, 0.25, 0.5, 0.75, 0.999]) {
        transition.set(transitionTarget);
        applyOuroborosFieldMorph(transition, 2, source, layout, progress, 104729);
        for (let i = 0; i < 2; i++) {
            const offset = i * 8;
            smoothNormals &&= transition.subarray(offset, offset + 8).every(Number.isFinite) &&
                Math.abs(Math.hypot(transition[offset + 3], transition[offset + 4], transition[offset + 5]) - 1) < 1e-6;
            smoothSizes &&= transition[offset + 6] >= 2 && transition[offset + 6] <= transitionTarget[offset + 6];
        }
        if (progress === 0.5) smoothSizes &&= transition[0] === 0.5 && transition[1] === 1 && transition[2] === 0.25 && transition[6] === 3;
        if (progress === 0.001) smoothSizes &&= Math.abs(transition[0]) < 0.000001;
        if (progress === 0.999) smoothSizes &&= Math.abs(transition[0] - 1) < 0.000001;
    }
    check(smoothNormals && smoothSizes,
        'C2 source handoff eases near both ends, interpolates position/radius and keeps antipodal lighting normals finite and unit length');
    transition.set(transitionTarget);
    applyOuroborosFieldMorph(transition, 2, source, layout, 0.49, 104729);
    const beforeMaterial = transition[7] === 1 && transition[15] === 1;
    transition.set(transitionTarget);
    applyOuroborosFieldMorph(transition, 2, source, layout, 0.51, 104729);
    check(beforeMaterial && transition[7] === 0 && transition[15] === 2,
        'Body and satellite materials emerge from dust only after the midpoint while continuous fields retain their source handoff');
    // КОНЕЦ РАЗДЕЛА 2. КОНЦЫ И ИНТЕРПОЛЯЦИЯ

    // НАЧАЛО РАЗДЕЛА 3. ГРАНИЦЫ И СТАБИЛЬНЫЕ ИНДЕКСЫ
    const full = makeGeometry(12);
    const prefix = full.slice(0, 5 * 8);
    applyOuroborosFieldMorph(full, 12, SOURCES, LAYOUT, 0.45, 104729);
    applyOuroborosFieldMorph(prefix, 5, SOURCES, LAYOUT, 0.45, 104729);
    check(prefix.every((value, index) => value === full[index]) && JSON.stringify(SOURCES) === sourcesBefore,
        'Quality counts preserve the same i modulo source mapping and common point trajectories without changing field particles');

    let atomic = true;
    const invalidCases = [
        { count: 12, sources: [] as readonly OuroborosFieldSource[], layout: LAYOUT, morph: 0.5, seed: 104729 },
        { count: 12, sources: [{ x: NaN, y: 0, radius: 1 }], layout: LAYOUT, morph: 0.5, seed: 104729 },
        { count: 12, sources: [{ x: 0, y: 0, radius: -1 }], layout: LAYOUT, morph: 0.5, seed: 104729 },
        { count: 12, sources: SOURCES, layout: { ...LAYOUT, scale: 0 }, morph: 0.5, seed: 104729 },
        { count: 12, sources: SOURCES, layout: LAYOUT, morph: Infinity, seed: 104729 },
        { count: 12.5, sources: SOURCES, layout: LAYOUT, morph: 0.5, seed: 104729 },
        { count: 13, sources: SOURCES, layout: LAYOUT, morph: 0.5, seed: 104729 },
        { count: 12, sources: SOURCES, layout: LAYOUT, morph: 0.5, seed: -1 },
    ];
    for (const invalid of invalidCases) {
        points.set(original);
        atomic &&= !applyOuroborosFieldMorph(points, invalid.count, invalid.sources, invalid.layout, invalid.morph, invalid.seed) &&
            new Uint32Array(points.buffer).every((value, index) => value === originalBits[index]);
    }
    check(atomic,
        'Malformed, empty or undersized field handoffs are safe no-ops with no partial packed-buffer writes');
    // КОНЕЦ РАЗДЕЛА 3. ГРАНИЦЫ И СТАБИЛЬНЫЕ ИНДЕКСЫ
}
// КОНЕЦ ФУНКЦИИ runOuroborosFieldMorphChecks
