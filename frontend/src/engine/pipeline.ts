// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/pipeline.ts
// НАЗНАЧЕНИЕ: Графический конвейер High-DPI / WebGPU Probe и Blue-Noise Dither (v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Инициализировать холст с учётом DPR-кэпа из QualityGovernor (HIGH/MEDIUM/LOW).
// 2. Проверять поддержку WebGPU и регистрировать честный статус в IntegrationRegistry.
// 3. Генерировать процедурный паттерн синего шума (Blue-Noise Dithering 64x64)
//    против бандинга тёмных градиентов (#020308–#060B19) по MASTER 00 раздел 3.
// 4. Предоставлять быстрые цветовые утилиты и метод очистки ресурсов dispose().
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { qualityGovernor } from '../core/qualityGovernor';
import { resourceLedger } from '../core/resourceLedger';
import { DeterministicPRNG } from '../core/prng';

export interface RenderCapabilities {
    viewportWidth: number;
    viewportHeight: number;
    dpr: number;
    webgpuAvailable: boolean;
    activeBackend: 'WebGPU' | 'Canvas2D-HighDPI';
}

export class RenderPipeline {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private capabilities: RenderCapabilities;
    private ditherPattern: CanvasPattern | null = null;
    private isDisposed = false;

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

    // Асинхронная проверка доступности WebGPU для честного статуса в IntegrationRegistry
    private async probeWebGpuSupport(): Promise<void> {
        if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
            integrationRegistry.updateModuleStatus('webgpu-render', 'fallback', 0);
            integrationRegistry.updateModuleStatus('canvas2d-render', 'ready', 0.8);
            return;
        }

        const t0 = performance.now();
        try {
            const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
            const adapter = await gpu.requestAdapter();
            const loadMs = performance.now() - t0;

            if (adapter) {
                this.capabilities.webgpuAvailable = true;
                // Первый кадр всегда рисуется быстрым Canvas2D-путём (MASTER 01), WebGPU готов как сопроцессор
                integrationRegistry.updateModuleStatus('webgpu-render', 'ready', loadMs);
            } else {
                integrationRegistry.updateModuleStatus('webgpu-render', 'fallback', loadMs);
            }
        } catch {
            integrationRegistry.updateModuleStatus('webgpu-render', 'fallback', performance.now() - t0);
        }
    }

    // Генерация тайла дизеринга 64x64 для устранения ступенчатости (banding) тёмных фонов
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
                // Комбинация матрицы Байера и высокочастотного детерминированного шума (аппроксимация Blue-Noise)
                const bayer = (((x & 1) << 2) | ((y & 1) << 1) | ((x ^ y) & 1)) / 8.0;
                const grain = (bayer * 0.65 + rng.nextFloat() * 0.35) * 255;
                const val = grain > 128 ? 220 : 18;
                data[idx] = val;
                data[idx + 1] = val;
                data[idx + 2] = 245;
                data[idx + 3] = 4; // Деликатная прозрачность ~1.5% против banding
            }
        }

        tileCtx.putImageData(imgData, 0, 0);
        this.ditherPattern = this.ctx.createPattern(tile, 'repeat');
        resourceLedger.trackAllocation('textures', 1);
    }

    public updateViewportSize(): { width: number; height: number; dpr: number } {
        const maxDpr = qualityGovernor.getProfile().maxDpr;
        const rawDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const dpr = Math.min(maxDpr, Math.max(1, rawDpr));
        const width = typeof window !== 'undefined' ? Math.max(320, window.innerWidth) : 1920;
        const height = typeof window !== 'undefined' ? Math.max(320, window.innerHeight) : 1080;

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

    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    public getCapabilities(): Readonly<RenderCapabilities> {
        return this.capabilities;
    }

    public getDitherPattern(): CanvasPattern | null {
        return this.ditherPattern;
    }

    public dispose(): void {
        if (this.isDisposed) return;
        this.isDisposed = true;
        if (this.ditherPattern) {
            this.ditherPattern = null;
            resourceLedger.trackRelease('textures', 1);
        }
    }

    // Быстрое преобразование HEX-цвета в строку rgba(r, g, b, alpha)
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
}