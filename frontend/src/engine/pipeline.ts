// ============================================================================
// ФАЙЛ: frontend/src/engine/pipeline.ts
// НАЗНАЧЕНИЕ: Инициализация и управление графическим конвейером (Render Pipeline)
// ЧТО ДЕЛАЕТ ЭТОТ ФАЙЛ:
// 1. Настраивает холст HTML5 Canvas с учетом плотности пикселей (Retina / High-DPI).
// 2. Проверяет аппаратную поддержку WebGPU в браузере пользователя.
// 3. Предоставляет быстрые утилиты преобразования цветов и координат для рендера.
// ============================================================================

export interface PipelineCapabilities {
    webgpuSupported: boolean;
    devicePixelRatio: number;
    viewportWidth: number;
    viewportHeight: number;
}

export class RenderPipeline {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private capabilities: PipelineCapabilities;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
            throw new Error('[Pipeline] Не удалось инициализировать графический контекст холста.');
        }
        this.ctx = context;

        this.capabilities = {
            webgpuSupported: typeof navigator !== 'undefined' && 'gpu' in navigator,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2),
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
        };

        this.updateViewportSize();
    }

    // Пересчет буфера пикселей под точное разрешение экрана без размытия
    public updateViewportSize(): { width: number; height: number } {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = window.innerWidth;
        const height = window.innerHeight;

        this.capabilities.devicePixelRatio = dpr;
        this.capabilities.viewportWidth = width;
        this.capabilities.viewportHeight = height;

        this.canvas.width = Math.floor(width * dpr);
        this.canvas.height = Math.floor(height * dpr);
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Сбрасываем матрицу трансформации и масштабируем под DPI
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        return { width, height };
    }

    public getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    public getCapabilities(): Readonly<PipelineCapabilities> {
        return this.capabilities;
    }

    // Утилита перевода HEX-цвета (#38bdf8) в строку rgba(r, g, b, alpha)
    public static hexToRgba(hex: string, alpha: number): string {
        const cleanHex = hex.replace('#', '');
        const bigint = parseInt(cleanHex, 16);
        const r = (bigint >> 16) & 255;
        const g = (bigint >> 8) & 255;
        const b = bigint & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
    }
}