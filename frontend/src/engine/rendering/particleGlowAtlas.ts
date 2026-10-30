// ============================================================================
// ФАЙЛ: frontend/src/engine/rendering/particleGlowAtlas.ts
// НАЗНАЧЕНИЕ: Ограниченный атлас повторяющихся свечений частиц с исходным fallback.
// РАЗДЕЛЫ: 1. Палитры и мера; 2. Единственная текстура контекста; 3. Публичный lifecycle.
// ФУНКЦИИ: getParticleGlowMode, getParticleGlowReferenceRadius, prepareParticleGlowAtlas,
// drawParticleGlow, disposeParticleGlowAtlas, getParticleGlowAtlasStats.
// Атлас сохраняет внешний радиус и исходные stops; внутренние 0.4/0.5 CSSpx
// приближены логарифмическими образцами с ошибкой не более 0.03125 CSSpx.
// ============================================================================
import { resourceLedger } from '../../core/resourceLedger';

// НАЧАЛО РАЗДЕЛА 1. ПАЛИТРЫ И ОГРАНИЧЕННАЯ МЕРА
export type ParticleGlowKind = 'halo-blue' | 'halo-indigo' | 'halo-ice' | 'bokeh';
export type ParticleGlowMode = 'atlas' | 'gradient';
export interface ParticleGlowAtlasStats {
    readonly ready: boolean;
    readonly bytes: number;
    readonly sprites: number;
    readonly builds: number;
    readonly atlasDraws: number;
    readonly fallbackDraws: number;
}

const TILE_SIZE = 96;
const TILE_RADIUS = 44;
const MIN_RADIUS = 1;
const MAX_RADIUS = 20;
const RADIUS_STEP = 1.125;
const LOG_STEP = Math.log(RADIUS_STEP);
const RADIUS_COUNT = Math.round(Math.log(MAX_RADIUS / MIN_RADIUS) / LOG_STEP) + 1;
const COLUMNS = 12;
const KINDS: readonly ParticleGlowKind[] = ['halo-blue', 'halo-indigo', 'halo-ice', 'bokeh'];
const SPRITE_COUNT = RADIUS_COUNT * KINDS.length;
const ROWS = Math.ceil(SPRITE_COUNT / COLUMNS);
const WIDTH = TILE_SIZE * COLUMNS;
const HEIGHT = TILE_SIZE * ROWS;
const BYTES = WIDTH * HEIGHT * 4;
const EMPTY_STATS: ParticleGlowAtlasStats = Object.freeze({
    ready: false, bytes: 0, sprites: 0, builds: 0, atlasDraws: 0, fallbackDraws: 0,
});
const contexts = new WeakMap<CanvasRenderingContext2D, ContextAtlas>();

// НАЧАЛО ФУНКЦИИ getParticleGlowMode
/** Диагностический A/B-переключатель не изменяет геометрию или состояние симуляции. */
export function getParticleGlowMode(search: string): ParticleGlowMode {
    return new URLSearchParams(search).get('glow') === 'gradient' ? 'gradient' : 'atlas';
}
// КОНЕЦ ФУНКЦИИ getParticleGlowMode

// НАЧАЛО ФУНКЦИИ getParticleGlowReferenceRadius
/** Внешний радиус рисуется точно; образец определяет только отношение внутреннего радиуса. */
export function getParticleGlowReferenceRadius(radius: number): number | null {
    if (!Number.isFinite(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS) return null;
    const index = Math.max(0, Math.min(RADIUS_COUNT - 1, Math.round(Math.log(radius / MIN_RADIUS) / LOG_STEP)));
    return MIN_RADIUS * RADIUS_STEP ** index;
}
// КОНЕЦ ФУНКЦИИ getParticleGlowReferenceRadius

// НАЧАЛО ФУНКЦИИ addStops
/** Alpha всех stops масштабируется общей прозрачностью вызова, включая родительскую. */
function addStops(gradient: CanvasGradient, kind: ParticleGlowKind): void {
    if (kind === 'bokeh') {
        gradient.addColorStop(0, 'rgba(125, 211, 252, 0.26)');
        gradient.addColorStop(0.6, 'rgba(99, 102, 241, 0.09)');
    } else {
        gradient.addColorStop(0, kind === 'halo-blue' ? 'rgba(125, 211, 252, 1)'
            : kind === 'halo-indigo' ? 'rgba(99, 102, 241, 1)' : 'rgba(186, 230, 253, 1)');
    }
    gradient.addColorStop(1, 'rgba(2, 3, 8, 0)');
}
// КОНЕЦ ФУНКЦИИ addStops
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ЕДИНСТВЕННАЯ ТЕКСТУРА КОНТЕКСТА
class ContextAtlas {
    readonly mode: ParticleGlowMode;
    private canvas: HTMLCanvasElement | null = null;
    private unavailable = false;
    private builds = 0;
    private atlasDraws = 0;
    private fallbackDraws = 0;

    // НАЧАЛО ФУНКЦИИ constructor
    constructor(private readonly target: CanvasRenderingContext2D) {
        this.mode = getParticleGlowMode(typeof window === 'undefined' ? '' : window.location?.search ?? '');
    }
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО ФУНКЦИИ prepare
    /** Вызывается заранее при инициализации; повторный вызов не выделяет новую текстуру. */
    prepare(): boolean {
        if (this.canvas) return true;
        if (this.unavailable) return false;
        let canvas: HTMLCanvasElement | null = null;
        try {
            const owner = this.target.canvas?.ownerDocument ?? (typeof document === 'undefined' ? null : document);
            if (!owner?.createElement || typeof this.target.drawImage !== 'function') {
                this.unavailable = true;
                return false;
            }
            canvas = owner.createElement('canvas');
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            const ctx = canvas.getContext('2d');
            if (!ctx || typeof ctx.createRadialGradient !== 'function') {
                canvas.width = canvas.height = 0;
                this.unavailable = true;
                return false;
            }
            for (let kindIndex = 0; kindIndex < KINDS.length; kindIndex++) {
                for (let index = 0; index < RADIUS_COUNT; index++) {
                    const sprite = kindIndex * RADIUS_COUNT + index;
                    const x = sprite % COLUMNS * TILE_SIZE + TILE_SIZE / 2;
                    const y = Math.floor(sprite / COLUMNS) * TILE_SIZE + TILE_SIZE / 2;
                    const reference = MIN_RADIUS * RADIUS_STEP ** index;
                    const inner = (KINDS[kindIndex] === 'bokeh' ? 0.5 : 0.4) / reference * TILE_RADIUS;
                    const gradient = ctx.createRadialGradient(x, y, inner, x, y, TILE_RADIUS);
                    addStops(gradient, KINDS[kindIndex]);
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(x, y, TILE_RADIUS, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            this.canvas = canvas;
            this.builds++;
            resourceLedger.trackPageLifetimeAllocation('textures', 1);
            return true;
        } catch {
            if (canvas) canvas.width = canvas.height = 0;
            this.unavailable = true;
            return false;
        }
    }
    // КОНЕЦ ФУНКЦИИ prepare

    // НАЧАЛО ФУНКЦИИ draw
    draw(kind: ParticleGlowKind, x: number, y: number, radius: number, alpha: number, mode: ParticleGlowMode): boolean {
        const kindIndex = KINDS.indexOf(kind);
        if (mode === 'gradient' || kindIndex < 0 || !Number.isFinite(x) || !Number.isFinite(y) ||
            !Number.isFinite(alpha) || !Number.isFinite(radius) || radius < MIN_RADIUS || radius > MAX_RADIUS ||
            !Number.isFinite(this.target.globalAlpha) ||
            (this.target.globalCompositeOperation !== 'source-over' && this.target.globalCompositeOperation !== 'lighter')) {
            this.fallbackDraws++;
            return false;
        }
        if (alpha <= 0) return true;
        if (!this.prepare()) {
            this.fallbackDraws++;
            return false;
        }
        const index = Math.max(0, Math.min(RADIUS_COUNT - 1, Math.round(Math.log(radius / MIN_RADIUS) / LOG_STEP)));
        const sprite = kindIndex * RADIUS_COUNT + index;
        const extent = radius * TILE_SIZE / TILE_RADIUS;
        const previousAlpha = this.target.globalAlpha;
        try {
            this.target.globalAlpha = previousAlpha * Math.min(1, alpha);
            this.target.drawImage(this.canvas!, sprite % COLUMNS * TILE_SIZE, Math.floor(sprite / COLUMNS) * TILE_SIZE,
                TILE_SIZE, TILE_SIZE, x - extent / 2, y - extent / 2, extent, extent);
            this.atlasDraws++;
            return true;
        } catch {
            this.unavailable = true;
            this.dispose();
            this.fallbackDraws++;
            return false;
        } finally {
            this.target.globalAlpha = previousAlpha;
        }
    }
    // КОНЕЦ ФУНКЦИИ draw

    // НАЧАЛО ФУНКЦИИ dispose
    /** Повторное освобождение не понижает baseline книги ресурсов ещё раз. */
    dispose(): void {
        if (!this.canvas) return;
        this.canvas.width = this.canvas.height = 0;
        this.canvas = null;
        resourceLedger.trackPageLifetimeRelease('textures', 1);
    }
    // КОНЕЦ ФУНКЦИИ dispose

    // НАЧАЛО ФУНКЦИИ snapshot
    snapshot(): ParticleGlowAtlasStats {
        return { ready: this.canvas !== null, bytes: this.canvas ? BYTES : 0,
            sprites: this.canvas ? SPRITE_COUNT : 0, builds: this.builds,
            atlasDraws: this.atlasDraws, fallbackDraws: this.fallbackDraws };
    }
    // КОНЕЦ ФУНКЦИИ snapshot
}
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПУБЛИЧНЫЙ ЖИЗНЕННЫЙ ЦИКЛ
// НАЧАЛО ФУНКЦИИ contextAtlas
function contextAtlas(ctx: CanvasRenderingContext2D): ContextAtlas {
    let atlas = contexts.get(ctx);
    if (!atlas) {
        atlas = new ContextAtlas(ctx);
        contexts.set(ctx, atlas);
    }
    return atlas;
}
// КОНЕЦ ФУНКЦИИ contextAtlas

// НАЧАЛО ФУНКЦИИ prepareParticleGlowAtlas
export function prepareParticleGlowAtlas(ctx: CanvasRenderingContext2D, mode?: ParticleGlowMode): boolean {
    const atlas = contextAtlas(ctx);
    return (mode ?? atlas.mode) === 'atlas' && atlas.prepare();
}
// КОНЕЦ ФУНКЦИИ prepareParticleGlowAtlas

// НАЧАЛО ФУНКЦИИ drawParticleGlow
/** false оставляет вызывающему исходный radialGradient; размер или частота эффектов не меняются. */
export function drawParticleGlow(ctx: CanvasRenderingContext2D, kind: ParticleGlowKind, x: number, y: number,
    outerRadius: number, alpha: number, mode?: ParticleGlowMode): boolean {
    const atlas = contextAtlas(ctx);
    return atlas.draw(kind, x, y, outerRadius, alpha, mode ?? atlas.mode);
}
// КОНЕЦ ФУНКЦИИ drawParticleGlow

// НАЧАЛО ФУНКЦИИ disposeParticleGlowAtlas
export function disposeParticleGlowAtlas(ctx: CanvasRenderingContext2D): void {
    contexts.get(ctx)?.dispose();
    contexts.delete(ctx);
}
// КОНЕЦ ФУНКЦИИ disposeParticleGlowAtlas

// НАЧАЛО ФУНКЦИИ getParticleGlowAtlasStats
/** Создаёт снимок только при явном запросе диагностики, не на каждом кадре. */
export function getParticleGlowAtlasStats(ctx: CanvasRenderingContext2D): Readonly<ParticleGlowAtlasStats> {
    return contexts.get(ctx)?.snapshot() ?? EMPTY_STATS;
}
// КОНЕЦ ФУНКЦИИ getParticleGlowAtlasStats
// КОНЕЦ РАЗДЕЛА 3
