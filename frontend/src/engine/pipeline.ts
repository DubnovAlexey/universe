// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/pipeline.ts
// НАЗНАЧЕНИЕ: Графический конвейер High-DPI Canvas2D / WebGPU Probe и
//             генератор дизеринга синим шумом Blue-Noise (UNIVERSE v2.5)
// ============================================================================
// ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ:
//   РАЗДЕЛ 1. Интерфейс возможностей конвейера (RenderCapabilities).
//   РАЗДЕЛ 2. Класс RenderPipeline:
//     - Подраздел 2.1. Инициализация 2D-контекста с DPR-кэпом из QualityGovernor.
//     - Подраздел 2.2. Проверка доступности адаптера WebGPU (probeWebGpuSupport):
//                      обновляет capabilities основного Canvas2D-конвейера,
//                      не подменяя состояние отдельного GPU-прохода Уробороса.
//     - Подраздел 2.3. Генератор тайла дизеринга 64x64 (buildBlueNoiseDitherPattern)
//                      и утилиты управления размером, качеством (syncQualityProfile) и цветами.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { qualityGovernor } from '../core/qualityGovernor';
import { resourceLedger } from '../core/resourceLedger';
import { DeterministicPRNG } from '../core/prng';
import { getDiagnosticDpr } from '../core/frameDiagnostics';

// ============================================================================
// РАЗДЕЛ 1. ИНТЕРФЕЙС ВОЗМОЖНОСТЕЙ ГРАФИЧЕСКОГО КОНВЕЙЕРА
// ============================================================================

export interface RenderCapabilities {
    viewportWidth: number;
    viewportHeight: number;
    dpr: number;
    webgpuAvailable: boolean;
    activeBackend: 'WebGPU' | 'Canvas2D-HighDPI';
}

// ============================================================================
// РАЗДЕЛ 2. КЛАСС ГРАФИЧЕСКОГО КОНВЕЙЕРА (RenderPipeline)
// Кэш строк rgba(): префикс цвета и 1001 значение прозрачности на каждый HEX.
const RGBA_STRING_CACHE = new Map<string, { readonly prefix: string; readonly values: (string | undefined)[] }>();
/**
 * Нижняя граница DPR холста. При масштабе страницы меньше 100% (DPR < 1) холст рисуется в физических
 * пикселях экрана: иначе кадр больше самого экрана, браузер его ещё и уменьшает — лишняя нагрузка и мыло.
 */
const MIN_CANVAS_DPR = 0.5;
// ============================================================================

export class RenderPipeline {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private capabilities: RenderCapabilities;
    private ditherPattern: CanvasPattern | null = null;
    private isDisposed = false;
    private readonly diagnosticDpr: number | null;

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. КОНСТРУКТОР И ИНИЦИАЛИЗАЦИЯ HIGH-DPI КОНТЕКСТА
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ constructor (RenderPipeline) ---
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.diagnosticDpr = getDiagnosticDpr(typeof window === 'undefined' ? '' : window.location?.search ?? '');
        const context = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
        });

        if (!context) {
            throw new Error('[RenderPipeline] Не удалось инициализировать 2D-контекст холста.');
        }

        this.ctx = context;
        const maxDpr = qualityGovernor.getProfile().maxDpr;
        const rawDpr = this.diagnosticDpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
        const dpr = Math.min(maxDpr, Math.max(MIN_CANVAS_DPR, rawDpr));
        const width = typeof window !== 'undefined' ? window.innerWidth : 1920;
        const height = typeof window !== 'undefined' ? window.innerHeight : 1080;

        this.capabilities = {
            viewportWidth: width,
            viewportHeight: height,
            dpr,
            webgpuAvailable: false,
            activeBackend: 'Canvas2D-HighDPI',
        };

        this.updateViewportSize();
        this.buildBlueNoiseDitherPattern();
        void this.probeWebGpuSupport();
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (RenderPipeline) ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. ЧЕСТНАЯ ПРОВЕРКА ПОДДЕРЖКИ WEBGPU
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ probeWebGpuSupport ---
    /**
     * Проверяет доступность адаптера для capabilities основного Canvas2D-конвейера.
     * Статус webgpu-render публикует OuroborosEffect после реальной GPU-отрисовки;
     * поздний результат этой проверки не меняет состояние GPU-прохода.
     */
    private async probeWebGpuSupport(): Promise<void> {
        integrationRegistry.updateModuleStatus('canvas2d-render', 'ready', 0.8);

        if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
            return;
        }

        try {
            const gpu = (
                navigator as unknown as {
                    gpu: { requestAdapter: () => Promise<unknown> };
                }
            ).gpu;
            const adapter = await gpu.requestAdapter();
            if (this.isDisposed) return;
            this.capabilities.webgpuAvailable = Boolean(adapter);
        } catch {
            if (!this.isDisposed) this.capabilities.webgpuAvailable = false;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ probeWebGpuSupport ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.3. ГЕНЕРАЦИЯ ПАТТЕРНА СИНЕГО ШУМА, RESIZE И УТИЛИТЫ ЦВЕТА
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ buildBlueNoiseDitherPattern ---
    /**
     * Генерирует тайл дизеринга 64x64 для устранения ступенчатости (banding) тёмных фонов.
     */
    private buildBlueNoiseDitherPattern(): void {
        if (typeof document === 'undefined') return;
        const size = 64;
        const tile = document.createElement('canvas');
        tile.width = size;
        tile.height = size;
        const tileCtx = tile.getContext('2d');
        if (!tileCtx) return;

        const imgData = tileCtx.createImageData(size, size);
        const data = imgData.data;
        const rng = new DeterministicPRNG(104729);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const bayer = (((x & 1) << 2) | ((y & 1) << 1) | ((x ^ y) & 1)) / 8.0;
                const grain = (bayer * 0.65 + rng.nextFloat() * 0.35) * 255;
                const val = grain > 128 ? 220 : 18;
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = 245;
                data[idx + 3] = 4;
            }
        }

        tileCtx.putImageData(imgData, 0, 0);
        this.ditherPattern = this.ctx.createPattern(tile, 'repeat');
        resourceLedger.trackPageLifetimeAllocation('textures', 1);
    }
    // --- КОНЕЦ ФУНКЦИИ buildBlueNoiseDitherPattern ---

    // --- НАЧАЛО ФУНКЦИИ updateViewportSize ---
    public updateViewportSize(): { width: number; height: number; dpr: number } {
        const maxDpr = qualityGovernor.getProfile().maxDpr;
        const rawDpr = this.diagnosticDpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
        const dpr = Math.min(maxDpr, Math.max(MIN_CANVAS_DPR, rawDpr));
        const width =
            typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 1920;
        const height =
            typeof window !== 'undefined' ? Math.max(320, window.innerHeight) : 1080;

        this.capabilities.viewportWidth = width;
        this.capabilities.viewportHeight = height;
        this.capabilities.dpr = dpr;

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { width, height, dpr };
    }
    // --- КОНЕЦ ФУНКЦИИ updateViewportSize ---

    // --- НАЧАЛО ФУНКЦИИ syncQualityProfile ---
    /** Применяет новый DPR-кэп на общем кадре без пересоздания частиц и ожидания resize. */
    public syncQualityProfile(): void {
        if (this.isDisposed) return;
        const rawDpr = this.diagnosticDpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
        const nextDpr = Math.min(qualityGovernor.getProfile().maxDpr, Math.max(MIN_CANVAS_DPR, rawDpr));
        if (nextDpr !== this.capabilities.dpr) this.updateViewportSize();
    }
    // --- КОНЕЦ ФУНКЦИИ syncQualityProfile ---

    // --- НАЧАЛО ФУНКЦИИ getContext ---
    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }
    // --- КОНЕЦ ФУНКЦИИ getContext ---

    // --- НАЧАЛО ФУНКЦИИ getCapabilities ---
    public getCapabilities(): Readonly<RenderCapabilities> {
        return this.capabilities;
    }
    // --- КОНЕЦ ФУНКЦИИ getCapabilities ---

    // --- НАЧАЛО ФУНКЦИИ getDitherPattern ---
    public getDitherPattern(): CanvasPattern | null {
        return this.ditherPattern;
    }
    // --- КОНЕЦ ФУНКЦИИ getDitherPattern ---

    // --- НАЧАЛО ФУНКЦИИ dispose ---
    public dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;
        if (this.ditherPattern) {
            this.ditherPattern = null;
            resourceLedger.trackPageLifetimeRelease('textures', 1);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ dispose ---

    // --- НАЧАЛО ФУНКЦИИ hexToRgba ---
    /**
     * Быстрое преобразование HEX-цвета в строку rgba(r, g, b, alpha).
     */
    public static hexToRgba(hex: string, alpha: number): string {
        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        // Кадр вызывает функцию тысячи раз: готовые строки по шагу 0.001 убирают мусор для GC.
        let table = RGBA_STRING_CACHE.get(hex);
        if (!table) {
            const clean = hex.replace('#', '');
            const num = clean.length === 6 ? parseInt(clean, 16) : Number.NaN;
            const prefix = Number.isFinite(num)
                ? `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, `
                : 'rgba(125, 211, 252, ';
            table = { prefix, values: new Array<string | undefined>(1001) };
            RGBA_STRING_CACHE.set(hex, table);
        }
        if (!Number.isFinite(clampedAlpha)) return `${table.prefix}${clampedAlpha.toFixed(3)})`;
        const step = Math.round(clampedAlpha * 1000);
        return table.values[step] ??= `${table.prefix}${(step / 1000).toFixed(3)})`;
    }
    // --- КОНЕЦ ФУНКЦИИ hexToRgba ---
}
