/// <reference types="@webgpu/types" />
// ============================================================================
// ФАЙЛ: frontend/src/engine/ouroboros/gpuRenderer.ts
// НАЗНАЧЕНИЕ: Прозрачный WebGPU-проход трёхмерных частиц с проверкой реальной отрисовки.
// РАЗДЕЛЫ: 1. Контракт GPU; 2. Инициализация; 3. Кадр/размеры; 4. Очистка.
// ФУНКЦИИ: init, initialize, selfTest, resize, render, submitFrame, writeFrame,
// encode, getStats, isCurrent, fail, releaseResources, dispose.
// Планирование кадров и выбор fallback выполняет внешний оркестратор.
// ============================================================================
import shaderSource from '../webgpu/ouroboros.wgsl?raw';
import type { OuroborosFrame, OuroborosGpuStats, OuroborosViewport } from './types';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ GPU
const MAX_POINTS = 3072;
const POINT_STRIDE = 32;
const UNIFORM_BYTES = 64;
const MAX_DPR = 1.5;
const DEPTH_FORMAT: GPUTextureFormat = 'depth24plus';
const POINT_LAYOUT: GPUVertexBufferLayout = {
    arrayStride: POINT_STRIDE, stepMode: 'instance', attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
        { shaderLocation: 2, offset: 24, format: 'float32' },
        { shaderLocation: 3, offset: 28, format: 'float32' },
    ],
};
const BLEND: GPUBlendState = {
    color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
};
// КОНЕЦ РАЗДЕЛА 1

export class OuroborosGpuRenderer {
    private device: GPUDevice | null = null;
    private context: GPUCanvasContext | null = null;
    private corePipeline: GPURenderPipeline | null = null;
    private glowPipeline: GPURenderPipeline | null = null;
    private pointBuffer: GPUBuffer | null = null;
    private uniformBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private depthTexture: GPUTexture | null = null;
    private format: GPUTextureFormat = 'bgra8unorm';
    private viewport: OuroborosViewport = { width: 1, height: 1, dpr: 1 };
    private readonly uniformData = new Float32Array(16);
    private readonly stats: OuroborosGpuStats = { submittedFrames: 0, validationErrors: 0, lastError: null, initialized: false };
    private generation = 0;
    private disposed = false;
    private failed = false;
    private initPromise: Promise<boolean> | null = null;
    private readonly handleUncapturedError = (event: GPUUncapturedErrorEvent): void => {
        this.fail(event.error.message);
    };

    constructor(private readonly canvas: HTMLCanvasElement, private readonly onFailure: (reason: string) => void) {}

    // НАЧАЛО РАЗДЕЛА 2. ИНИЦИАЛИЗАЦИЯ И ПРОВЕРКА ПИКСЕЛЕЙ
    // НАЧАЛО ФУНКЦИИ init
    public init(initialFrame: OuroborosFrame): Promise<boolean> {
        if (this.disposed || this.failed) return Promise.resolve(false);
        if (!this.initPromise) {
            if (!Number.isInteger(initialFrame.count) || initialFrame.count < 0 || initialFrame.count > MAX_POINTS ||
                initialFrame.points.length < initialFrame.count * 8) {
                this.fail('Invalid Ouroboros initial frame');
                return Promise.resolve(false);
            }
            // Асинхронная загрузка не удерживает изменяемый или растущий WASM-view.
            const retained: OuroborosFrame = { points: initialFrame.points.slice(0, initialFrame.count * 8),
                count: initialFrame.count, uniforms: { ...initialFrame.uniforms } };
            this.initPromise = this.initialize(retained, ++this.generation);
        }
        return this.initPromise;
    }
    // КОНЕЦ ФУНКЦИИ init

    // НАЧАЛО ФУНКЦИИ initialize
    private async initialize(initialFrame: OuroborosFrame, ticket: number): Promise<boolean> {
        try {
            if (typeof navigator === 'undefined' || !navigator.gpu) throw new Error('WebGPU is unavailable');
            const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
            if (!this.isCurrent(ticket)) return false;
            if (!adapter) throw new Error('WebGPU adapter is unavailable');
            const requestedDevice = await adapter.requestDevice();
            if (!this.isCurrent(ticket)) { requestedDevice.destroy(); return false; }
            const device = this.device = requestedDevice;
            device.addEventListener('uncapturederror', this.handleUncapturedError);
            void device.lost.then((info) => {
                if (this.isCurrent(ticket)) this.fail(`WebGPU device lost: ${info.message || info.reason}`);
            });
            this.context = this.canvas.getContext('webgpu');
            if (!this.context) throw new Error('WebGPU canvas context is unavailable');
            this.format = navigator.gpu.getPreferredCanvasFormat();
            device.pushErrorScope('validation');
            const module = device.createShaderModule({ label: 'ouroboros-volume', code: shaderSource });
            const compilation = await module.getCompilationInfo();
            if (!this.isCurrent(ticket)) return false;
            const errors = compilation.messages.filter((message) => message.type === 'error');
            if (errors.length) throw new Error(errors.map((message) => `${message.lineNum}:${message.linePos} ${message.message}`).join('; '));
            this.uniformBuffer = device.createBuffer({ label: 'ouroboros-uniforms', size: UNIFORM_BYTES,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
            this.pointBuffer = device.createBuffer({ label: 'ouroboros-points', size: MAX_POINTS * POINT_STRIDE,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
            const layout = device.createBindGroupLayout({ entries: [{ binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } }] });
            const pipelineLayout = device.createPipelineLayout({ bindGroupLayouts: [layout] });
            this.bindGroup = device.createBindGroup({ layout, entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }] });
            const descriptor = (core: boolean): GPURenderPipelineDescriptor => ({
                label: core ? 'ouroboros-depth-cores' : 'ouroboros-soft-light', layout: pipelineLayout,
                vertex: { module, entryPoint: core ? 'vsCore' : 'vsGlow', buffers: [POINT_LAYOUT] },
                fragment: { module, entryPoint: core ? 'fsCore' : 'fsGlow', targets: [{ format: this.format, blend: BLEND }] },
                primitive: { topology: 'triangle-list', cullMode: 'none' },
                depthStencil: { format: DEPTH_FORMAT, depthWriteEnabled: core, depthCompare: 'less-equal' },
            });
            const corePipeline = await device.createRenderPipelineAsync(descriptor(true));
            if (!this.isCurrent(ticket)) return false;
            this.corePipeline = corePipeline;
            const glowPipeline = await device.createRenderPipelineAsync(descriptor(false));
            if (!this.isCurrent(ticket)) return false;
            this.glowPipeline = glowPipeline;
            this.resize(initialFrame.uniforms);
            if (!this.isCurrent(ticket)) return false;
            await this.selfTest(device, ticket);
            if (!this.isCurrent(ticket)) return false;
            if (!this.submitFrame(initialFrame)) throw new Error(this.stats.lastError ?? 'WebGPU initial frame was not submitted');
            await device.queue.onSubmittedWorkDone();
            if (!this.isCurrent(ticket)) return false;
            const validationError = await device.popErrorScope();
            if (!this.isCurrent(ticket)) return false;
            if (validationError) throw new Error(validationError.message);
            this.stats.initialized = true;
            return true;
        } catch (error: unknown) {
            if (this.isCurrent(ticket)) this.fail(error instanceof Error ? error.message : 'WebGPU initialization failed');
            return false;
        }
    }
    // КОНЕЦ ФУНКЦИИ initialize

    // НАЧАЛО ФУНКЦИИ selfTest
    /** Настоящий offscreen draw и readback подтверждают работу шейдера до READY. */
    private async selfTest(device: GPUDevice, ticket: number): Promise<void> {
        const size = 32;
        const output = device.createTexture({ size: [size, size], format: this.format,
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC });
        const depth = device.createTexture({ size: [size, size], format: DEPTH_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        const readback = device.createBuffer({ size: size * 256, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
        try {
            this.writeFrame({ points: new Float32Array([0, 0, 0, 0, 0, -1, 6, 2]), count: 1,
                uniforms: { width: size, height: size, dpr: 1, timeSec: 0, opacity: 1, morph: 0.5, energy: 0.7,
                    centerX: size / 2, centerY: size / 2, scale: 8 } });
            const encoder = device.createCommandEncoder({ label: 'ouroboros-pixel-self-test' });
            this.encode(encoder, output.createView(), depth.createView(), 1);
            encoder.copyTextureToBuffer({ texture: output }, { buffer: readback, bytesPerRow: 256 }, [size, size]);
            device.queue.submit([encoder.finish()]);
            await readback.mapAsync(GPUMapMode.READ);
            if (!this.isCurrent(ticket)) return;
            const bytes = new Uint8Array(readback.getMappedRange());
            let hasInk = false;
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const offset = y * 256 + x * 4;
                if (bytes[offset + 3] > 12 && (bytes[offset] > 1 || bytes[offset + 1] > 1 || bytes[offset + 2] > 1)) hasInk = true;
            }
            if (!hasInk) throw new Error('WebGPU pixel self-test produced an empty image');
        } finally {
            if (readback.mapState === 'mapped') readback.unmap();
            readback.destroy(); output.destroy(); depth.destroy();
        }
    }
    // КОНЕЦ ФУНКЦИИ selfTest
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. РАЗМЕРЫ И КАДР
    // НАЧАЛО ФУНКЦИИ resize
    public resize(viewport: OuroborosViewport): void {
        if (this.disposed || this.failed) return;
        try {
            const width = Math.max(1, Number.isFinite(viewport.width) ? viewport.width : 1);
            const height = Math.max(1, Number.isFinite(viewport.height) ? viewport.height : 1);
            const limit = this.device?.limits.maxTextureDimension2D ?? 8192;
            const dpr = Math.min(MAX_DPR, Math.max(0.5, Number.isFinite(viewport.dpr) ? viewport.dpr : 1), limit / Math.max(width, height));
            const pixelWidth = Math.max(1, Math.floor(width * dpr));
            const pixelHeight = Math.max(1, Math.floor(height * dpr));
            const unchanged = this.viewport.width === width && this.viewport.height === height && this.viewport.dpr === dpr;
            this.viewport = { width, height, dpr };
            if (!this.device || !this.context || (unchanged && this.depthTexture)) return;
            this.canvas.width = pixelWidth; this.canvas.height = pixelHeight;
            this.canvas.style.width = `${width}px`; this.canvas.style.height = `${height}px`;
            this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' });
            this.depthTexture?.destroy();
            this.depthTexture = this.device.createTexture({ label: 'ouroboros-depth', size: [pixelWidth, pixelHeight],
                format: DEPTH_FORMAT, usage: GPUTextureUsage.RENDER_ATTACHMENT });
        } catch (error: unknown) {
            this.fail(error instanceof Error ? error.message : 'WebGPU resize failed');
        }
    }
    // КОНЕЦ ФУНКЦИИ resize

    // НАЧАЛО ФУНКЦИИ render
    public render(frame: OuroborosFrame): boolean {
        return this.stats.initialized && this.submitFrame(frame);
    }
    // КОНЕЦ ФУНКЦИИ render

    // НАЧАЛО ФУНКЦИИ submitFrame
    private submitFrame(frame: OuroborosFrame): boolean {
        if (this.disposed || this.failed || !this.device || !this.context || !this.depthTexture) return false;
        try {
            this.resize(frame.uniforms);
            if (!this.device || !this.context || !this.depthTexture) return false;
            this.writeFrame(frame);
            const encoder = this.device.createCommandEncoder({ label: 'ouroboros-frame' });
            this.encode(encoder, this.context.getCurrentTexture().createView(), this.depthTexture!.createView(), frame.count);
            this.device.queue.submit([encoder.finish()]);
            this.stats.submittedFrames++;
            return true;
        } catch (error: unknown) {
            this.fail(error instanceof Error ? error.message : 'WebGPU frame failed');
            return false;
        }
    }
    // КОНЕЦ ФУНКЦИИ submitFrame

    // НАЧАЛО ФУНКЦИИ writeFrame
    private writeFrame(frame: OuroborosFrame): void {
        if (!Number.isInteger(frame.count) || frame.count < 0 || frame.count > MAX_POINTS || frame.points.length < frame.count * 8 ||
            !Object.values(frame.uniforms).every(Number.isFinite) || frame.uniforms.width <= 0 ||
            frame.uniforms.height <= 0 || frame.uniforms.dpr <= 0) throw new Error('Invalid Ouroboros GPU frame');
        for (let index = 0; index < frame.count * 8; index++) {
            if (!Number.isFinite(frame.points[index])) throw new Error('Non-finite Ouroboros point');
        }
        const u = frame.uniforms;
        this.uniformData.set([u.width, u.height, this.viewport.dpr, u.timeSec,
            Math.max(0, Math.min(1, u.opacity)), Math.max(0, Math.min(1, u.morph)), Math.max(0, Math.min(1, u.energy)), Math.max(0, u.scale),
            u.centerX, u.centerY, 3, 0, 0, 0, 0, 0]);
        this.device!.queue.writeBuffer(this.uniformBuffer!, 0, this.uniformData);
        if (frame.count) this.device!.queue.writeBuffer(this.pointBuffer!, 0, frame.points.buffer, frame.points.byteOffset, frame.count * POINT_STRIDE);
    }
    // КОНЕЦ ФУНКЦИИ writeFrame

    // НАЧАЛО ФУНКЦИИ encode
    private encode(encoder: GPUCommandEncoder, color: GPUTextureView, depth: GPUTextureView, count: number): void {
        const pass = encoder.beginRenderPass({ colorAttachments: [{ view: color, clearValue: { r: 0, g: 0, b: 0, a: 0 },
            loadOp: 'clear', storeOp: 'store' }], depthStencilAttachment: {
            view: depth, depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'store' } });
        pass.setBindGroup(0, this.bindGroup!);
        pass.setVertexBuffer(0, this.pointBuffer!);
        pass.setPipeline(this.corePipeline!); pass.draw(6, count);
        pass.setPipeline(this.glowPipeline!); pass.draw(6, count);
        pass.end();
    }
    // КОНЕЦ ФУНКЦИИ encode
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ДИАГНОСТИКА И ОЧИСТКА
    // НАЧАЛО ФУНКЦИИ getStats
    public getStats(): Readonly<OuroborosGpuStats> { return { ...this.stats }; }
    // КОНЕЦ ФУНКЦИИ getStats

    // НАЧАЛО ФУНКЦИИ isCurrent
    private isCurrent(ticket: number): boolean { return !this.disposed && !this.failed && ticket === this.generation; }
    // КОНЕЦ ФУНКЦИИ isCurrent

    // НАЧАЛО ФУНКЦИИ fail
    private fail(message: string): void {
        if (this.disposed || this.failed) return;
        this.failed = true; this.generation++;
        this.stats.validationErrors++; this.stats.lastError = message; this.stats.initialized = false;
        this.releaseResources();
        try { this.onFailure(message); } catch { /* Ошибка внешнего обработчика не запускает повторный fallback. */ }
    }
    // КОНЕЦ ФУНКЦИИ fail

    // НАЧАЛО ФУНКЦИИ releaseResources
    private releaseResources(): void {
        this.depthTexture?.destroy(); this.depthTexture = null;
        this.pointBuffer?.destroy(); this.pointBuffer = null;
        this.uniformBuffer?.destroy(); this.uniformBuffer = null;
        this.corePipeline = null; this.glowPipeline = null; this.bindGroup = null;
        this.context?.unconfigure(); this.context = null;
        this.device?.removeEventListener('uncapturederror', this.handleUncapturedError);
        this.device?.destroy(); this.device = null;
    }
    // КОНЕЦ ФУНКЦИИ releaseResources

    // НАЧАЛО ФУНКЦИИ dispose
    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true; this.generation++; this.stats.initialized = false;
        this.releaseResources();
    }
    // КОНЕЦ ФУНКЦИИ dispose
    // КОНЕЦ РАЗДЕЛА 4
}
