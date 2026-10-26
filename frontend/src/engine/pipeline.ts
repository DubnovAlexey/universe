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
//     - Подраздел 2.2. Честная проверка адаптера WebGPU (probeWebGpuSupport):
//                      разделяет наличие адаптера и фактически рисующий бэкенд
//                      Canvas2D-HighDPI (устраняет замечание Аудита P1 #15).
//     - Подраздел 2.3. Генератор тайла дизеринга 64x64 (buildBlueNoiseDitherPattern)
//                      и утилиты управления размером, качеством (syncQualityProfile) и цветами.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { qualityGovernor } from '../core/qualityGovernor';
import { resourceLedger } from '../core/resourceLedger';
import { DeterministicPRNG } from '../core/prng';

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
// ============================================================================

export class RenderPipeline {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private capabilities: RenderCapabilities;
    private ditherPattern: CanvasPattern | null = null;
    private isDisposed = false;

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. КОНСТРУКТОР И ИНИЦИАЛИЗАЦИЯ HIGH-DPI КОНТЕКСТА
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ constructor (RenderPipeline) ---
    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d', {
            alpha: false,
            desynchronized: true,
        });

        if (!context) {
            throw new Error('[RenderPipeline] Не удалось инициализировать 2D-контекст холста.');
        }

        this.ctx = context;
        const maxDpr = qualityGovernor.getProfile().maxDpr;
        const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const dpr = Math.min(maxDpr, Math.max(1, rawDpr));
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
     * Проверяет наличие аппаратного адаптера WebGPU в браузере, но честно оставляет
     * статус модуля 'webgpu-render' в режиме 'fallback', так как активная отрисовка
     * сцены выполняется через высокоточный конвейер 'canvas2d-render'.
     */
    private async probeWebGpuSupport(): Promise<void> {
        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('canvas2d-render', 'ready', 0.8);

        if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
            integrationRegistry.updateModuleStatus('webgpu-render', 'unsupported', 0);
            return;
        }

        try {
            const gpu = (
                navigator as unknown as {
                    gpu: { requestAdapter: () => Promise<unknown> };
                }
            ).gpu;
            const adapter = await gpu.requestAdapter();
            const loadMs = performance.now() - t0;

            if (adapter) {
                this.capabilities.webgpuAvailable = true;
                integrationRegistry.updateModuleStatus('webgpu-render', 'fallback', loadMs);
            } else {
                integrationRegistry.updateModuleStatus('webgpu-render', 'unsupported', loadMs);
            }
        } catch {
            integrationRegistry.updateModuleStatus(
                'webgpu-render',
                'fallback',
                performance.now() - t0
            );
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
        resourceLedger.trackAllocation('textures', 1);
    }
    // --- КОНЕЦ ФУНКЦИИ buildBlueNoiseDitherPattern ---

    // --- НАЧАЛО ФУНКЦИИ updateViewportSize ---
    public updateViewportSize(): { width: number; height: number; dpr: number } {
        const maxDpr = qualityGovernor.getProfile().maxDpr;
        const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const dpr = Math.min(maxDpr, Math.max(1, rawDpr));
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
        const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const nextDpr = Math.min(qualityGovernor.getProfile().maxDpr, Math.max(1, rawDpr));
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
            resourceLedger.trackRelease('textures', 1);
        }
    }
    // --- КОНЕЦ ФУНКЦИИ dispose ---

    // --- НАЧАЛО ФУНКЦИИ hexToRgba ---
    /**
     * Быстрое преобразование HEX-цвета в строку rgba(r, g, b, alpha).
     */
    public static hexToRgba(hex: string, alpha: number): string {
        const clampedAlpha = Math.max(0, Math.min(1, alpha));
        const clean = hex.replace('#', '');
        if (clean.length !== 6) {
            return `rgba(125, 211, 252, ${clampedAlpha.toFixed(3)})`;
        }
        const num = parseInt(clean, 16);
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${clampedAlpha.toFixed(3)})`;
    }
    // --- КОНЕЦ ФУНКЦИИ hexToRgba ---
}
