// ============================================================================
// ФАЙЛ: frontend/src/tests/particleGlowAtlas.test.ts
// НАЗНАЧЕНИЕ: Проверить ограничение атласа, прозрачность, fallback и освобождение.
// РАЗДЕЛЫ: 1. Изолированный Canvas; 2. Мера и A/B; 3. Lifecycle и отказоустойчивость.
// ФУНКЦИИ: makeCanvasFixture, runParticleGlowAtlasChecks.
// Pixel-паритет и производительность реального Canvas проверяются в браузере отдельно.
// ============================================================================
import { resourceLedger } from '../core/resourceLedger';
import { disposeParticleGlowAtlas, drawParticleGlow, getParticleGlowAtlasStats,
    getParticleGlowMode, getParticleGlowReferenceRadius, prepareParticleGlowAtlas,
    type ParticleGlowKind } from '../engine/rendering/particleGlowAtlas';

// НАЧАЛО РАЗДЕЛА 1. ИЗОЛИРОВАННЫЙ CANVAS
interface GradientRecord { radii: readonly number[]; stops: Array<readonly [number, string]>; }
// НАЧАЛО ФУНКЦИИ makeCanvasFixture
function makeCanvasFixture(options: { missingContext?: boolean; rejectDraw?: boolean } = {}) {
    const gradients: GradientRecord[] = [];
    let allocations = 0;
    let draws = 0;
    let lastAlpha = 0;
    let lastArguments: readonly unknown[] = [];
    const texture = {
        width: 0, height: 0,
        getContext: () => options.missingContext ? null : {
            fillStyle: '', beginPath: () => {}, arc: () => {}, fill: () => {},
            createRadialGradient: (...radii: number[]) => {
                const record: GradientRecord = { radii, stops: [] };
                gradients.push(record);
                return { addColorStop: (offset: number, color: string) => { record.stops.push([offset, color]); } };
            },
        },
    };
    const target = {
        canvas: { ownerDocument: { createElement: () => { allocations++; return texture; } } },
        globalAlpha: 0.37, globalCompositeOperation: 'source-over',
        fillStyle: '#123456', imageSmoothingEnabled: false,
        drawImage: (...args: unknown[]) => {
            draws++;
            lastAlpha = target.globalAlpha;
            lastArguments = args;
            if (options.rejectDraw) throw new Error('detached image');
        },
    };
    return { ctx: target as unknown as CanvasRenderingContext2D, target, texture, gradients,
        get allocations() { return allocations; }, get draws() { return draws; },
        get lastAlpha() { return lastAlpha; }, get lastArguments() { return lastArguments; } };
}
// КОНЕЦ ФУНКЦИИ makeCanvasFixture
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ runParticleGlowAtlasChecks
export function runParticleGlowAtlasChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 2. РАДИАЛЬНАЯ МЕРА И A/B
    let boundedInnerError = true;
    for (let i = 0; i <= 20000; i++) {
        const radius = 1 + i / 20000 * 19;
        const reference = getParticleGlowReferenceRadius(radius);
        boundedInnerError &&= reference !== null &&
            Math.abs(0.5 * radius / reference - 0.5) <= 0.03125 &&
            Math.abs(0.4 * radius / reference - 0.4) <= 0.025;
    }
    check(boundedInnerError && [0, 0.99, 20.01, -1, Number.NaN, Infinity]
        .every((radius) => getParticleGlowReferenceRadius(radius) === null),
    'Glow atlas retains the exact external radius with inner-radius error <=0.03125 CSSpx; tiny/large/invalid radii keep native gradients');
    check(getParticleGlowMode('?glow=gradient') === 'gradient' && getParticleGlowMode('?glow=atlas') === 'atlas' &&
        getParticleGlowMode('?glow=unexpected') === 'atlas' && getParticleGlowMode('') === 'atlas',
    'Glow A/B accepts an explicit gradient baseline and otherwise uses the atlas without touching simulation inputs');

    const baseline = { ...resourceLedger.getCounters() };
    const fixture = makeCanvasFixture();
    try {
        const gradientMode = !prepareParticleGlowAtlas(fixture.ctx, 'gradient') &&
            !drawParticleGlow(fixture.ctx, 'halo-blue', 40, 30, 4, 0.6, 'gradient');
        check(gradientMode && fixture.allocations === 0 && fixture.draws === 0,
            'The direct-gradient A/B path creates no atlas texture and returns control to the original renderer');
        const prepared = prepareParticleGlowAtlas(fixture.ctx, 'atlas');
        const stats = getParticleGlowAtlasStats(fixture.ctx);
        const palettes = new Set(fixture.gradients.flatMap((gradient) => gradient.stops.map((stop) => stop[1])));
        check(prepared && stats.ready && stats.sprites === 104 && stats.bytes === 3981312 && stats.bytes < 4 * 1024 * 1024 &&
            fixture.allocations === 1 && fixture.gradients.length === stats.sprites &&
            palettes.has('rgba(125, 211, 252, 0.26)') && palettes.has('rgba(99, 102, 241, 0.09)') &&
            palettes.has('rgba(186, 230, 253, 1)') && palettes.has('rgba(2, 3, 8, 0)'),
        'One fixed <4MiB atlas contains all 104 radial samples with the original bokeh/halo colors, stops and transparent edge');

        const kinds: readonly ParticleGlowKind[] = ['halo-blue', 'halo-indigo', 'halo-ice', 'bokeh'];
        let stable = true;
        for (let index = 0; index < 1000; index++) {
            stable &&= drawParticleGlow(fixture.ctx, kinds[index % kinds.length], 70, 80,
                1 + index % 191 / 10, 0.6, 'atlas');
        }
        const lastRadius = 1 + 999 % 191 / 10;
        const expectedExtent = lastRadius * 96 / 44;
        check(stable && prepareParticleGlowAtlas(fixture.ctx, 'atlas') && fixture.allocations === 1 &&
            fixture.gradients.length === 104 && getParticleGlowAtlasStats(fixture.ctx).builds === 1 &&
            fixture.draws === 1000 && Math.abs(fixture.lastAlpha - 0.37 * 0.6) < 1e-14 &&
            Math.abs(Number(fixture.lastArguments[7]) - expectedExtent) < 1e-12 &&
            fixture.target.globalAlpha === 0.37 && fixture.target.fillStyle === '#123456' &&
            fixture.target.imageSmoothingEnabled === false && fixture.target.globalCompositeOperation === 'source-over',
        'Repeated colors, radii and frames reuse one atlas; parent alpha, composite mode, fillStyle and smoothing remain unchanged');

        const draws = fixture.draws;
        const fallbackRadii = [0.5, 21, Number.NaN, Infinity];
        const fallback = fallbackRadii.every((radius) => !drawParticleGlow(fixture.ctx, 'halo-blue', 0, 0, radius, 0.5, 'atlas'));
        fixture.target.globalCompositeOperation = 'copy';
        const copyFallback = !drawParticleGlow(fixture.ctx, 'bokeh', 0, 0, 3, 0.5, 'atlas');
        fixture.target.globalCompositeOperation = 'source-over';
        check(fallback && copyFallback && fixture.draws === draws && fixture.target.globalAlpha === 0.37,
            'Native fallback preserves unsupported composite semantics and extreme sizes without drawing or changing context state');
        // КОНЕЦ РАЗДЕЛА 2

        // НАЧАЛО РАЗДЕЛА 3. ОДНОКРАТНОЕ ОСВОБОЖДЕНИЕ И СБОИ
        check(resourceLedger.getCounters().textures === baseline.textures + 1,
            'Glow atlas owns exactly one page-lifetime texture in ResourceLedger');
        disposeParticleGlowAtlas(fixture.ctx);
        disposeParticleGlowAtlas(fixture.ctx);
        check(fixture.texture.width === 0 && fixture.texture.height === 0 &&
            !getParticleGlowAtlasStats(fixture.ctx).ready && resourceLedger.getCounters().textures === baseline.textures &&
            resourceLedger.getCounters().underflowCount === baseline.underflowCount,
        'Disposal releases backing pixels and the texture baseline exactly once, including repeated disposal');
    } finally {
        disposeParticleGlowAtlas(fixture.ctx);
    }

    const missing = makeCanvasFixture({ missingContext: true });
    try {
        const rejected = !prepareParticleGlowAtlas(missing.ctx, 'atlas') &&
            !drawParticleGlow(missing.ctx, 'halo-blue', 0, 0, 3, 0.5, 'atlas') &&
            !prepareParticleGlowAtlas(missing.ctx, 'atlas');
        check(rejected && missing.allocations === 1 && missing.texture.width === 0 && missing.texture.height === 0 &&
            resourceLedger.getCounters().textures === baseline.textures,
        'Missing Canvas2D support disables atlas construction once and retains the original gradient path without a texture leak');
    } finally {
        disposeParticleGlowAtlas(missing.ctx);
    }
    const failedDraw = makeCanvasFixture({ rejectDraw: true });
    try {
        const rejected = !drawParticleGlow(failedDraw.ctx, 'halo-blue', 0, 0, 3, 0.5, 'atlas') &&
            !drawParticleGlow(failedDraw.ctx, 'halo-blue', 0, 0, 3, 0.5, 'atlas');
        check(rejected && failedDraw.draws === 1 && failedDraw.allocations === 1 &&
            failedDraw.target.globalAlpha === 0.37 && !getParticleGlowAtlasStats(failedDraw.ctx).ready &&
            resourceLedger.getCounters().textures === baseline.textures &&
            resourceLedger.getCounters().underflowCount === baseline.underflowCount,
        'A rejected atlas image restores alpha, frees its texture and falls back once without repeated allocation or draw errors');
    } finally {
        disposeParticleGlowAtlas(failedDraw.ctx);
    }
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ runParticleGlowAtlasChecks
