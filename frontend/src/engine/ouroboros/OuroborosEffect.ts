// ============================================================================
// ФАЙЛ: frontend/src/engine/ouroboros/OuroborosEffect.ts
// НАЗНАЧЕНИЕ: Общий эпизод Rust/TS-геометрии, WebGPU и резервного Canvas.
// РАЗДЕЛЫ: 1. Состояние; 2. Общий кадр; 3. GPU и освобождение; 4. Диагностика.
// ФУНКЦИИ: constructor, hasSameGpuPoints, render, initializeGpu,
// failGpu, releaseAtlas, dispose, publishDiagnostics.
// ============================================================================
import { smootherstep, type UniverseState } from '../../store/universeState';
import type { VisualSignalSnapshot } from '../../core/visualSignals';
import { evaluateOuroborosEpisode, getOuroborosLayout } from '../../core/ouroborosEpisode';
import { OUROBOROS_CAPACITY } from '../../core/ouroborosModel';
import { applyOuroborosFieldMorph } from '../../core/ouroborosFieldMorph';
import { qualityGovernor } from '../../core/qualityGovernor';
import { wasmPhysicsBridge } from '../../bridge/wasmBridge';
import { integrationRegistry } from '../../core/integrationRegistry';
import { resourceLedger } from '../../core/resourceLedger';
import { OuroborosGpuRenderer } from './gpuRenderer';
import { createGlowAtlas, renderOuroborosCanvas, renderOuroborosFilaments } from './canvasRenderer';
import type { OuroborosFrame } from './types';

export class OuroborosEffect {
    // НАЧАЛО РАЗДЕЛА 1. СОСТОЯНИЕ
    private readonly overlay: HTMLCanvasElement | null;
    private readonly preview: boolean;
    private readonly disabled: boolean;
    private readonly forceCanvas: boolean;
    private readonly order = new Uint16Array(OUROBOROS_CAPACITY);
    private readonly lastGpuPoints = new Float32Array(OUROBOROS_CAPACITY * 8);
    private fieldLinked = false;
    private atlas: readonly HTMLCanvasElement[] | null = null;
    private gpu: OuroborosGpuRenderer | null = null;
    private attemptedGpu = false;
    private gpuReady = false;
    private gpuResourcesTracked = false;
    private disposed = false;
    private energy = 0;
    private diagnosticStamp = -1;
    private lastGpuTime = Number.NaN;
    private lastGpuWidth = 0;
    private lastGpuHeight = 0;
    private lastGpuDpr = 0;
    private lastGpuCount = -1;
    private lastGpuSeed = -1;
    private lastGpuOpacity = -1;
    private lastGpuMorph = -1;
    private lastGpuEnergy = -1;
    private lastGpuCenterY = -1;
    private readonly frame: OuroborosFrame = {
        points: new Float32Array(0), count: 0,
        uniforms: { width: 1, height: 1, dpr: 1, timeSec: 0, opacity: 0, morph: 0,
            energy: 0, centerX: 0, centerY: 0, scale: 1 },
    };

    // НАЧАЛО ФУНКЦИИ constructor
    constructor(canvas: HTMLCanvasElement) {
        const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location?.search ?? '');
        this.preview = params.get('ouroboros') === 'preview';
        this.disabled = params.get('ouroboros') === '0';
        this.forceCanvas = params.get('gpu') === '0';
        this.overlay = canvas.ownerDocument?.getElementById('ouroboros-canvas') as HTMLCanvasElement | null;
        if (this.overlay && !this.disabled) resourceLedger.registerPageDisposable(() => this.dispose());
    }
    // КОНЕЦ ФУНКЦИИ constructor
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. ОБЩИЙ КАДР
    // НАЧАЛО ФУНКЦИИ hasSameGpuPoints
    /** Фиксированные часы не скрывают изменение источников при resize или смене поля. */
    private hasSameGpuPoints(): boolean {
        for (let i = 0; i < this.frame.count * 8; i++) {
            if (this.frame.points[i] !== this.lastGpuPoints[i]) return false;
        }
        return true;
    }
    // КОНЕЦ ФУНКЦИИ hasSameGpuPoints

    // НАЧАЛО ФУНКЦИИ render
    public render(ctx: CanvasRenderingContext2D, state: Readonly<UniverseState>, signals: Readonly<VisualSignalSnapshot>,
        width: number, height: number, dpr: number,
        sources: readonly { x: number; y: number; radius: number }[] = []): void {
        if (this.disposed || this.disabled || !this.overlay) return;
        const episode = evaluateOuroborosEpisode(state, this.preview);
        if (episode.opacity <= 0.001) {
            this.overlay.style.visibility = 'hidden';
            // Компиляция и pixel self-test выполняются до появления визитки, а не в её первом кадре.
            if (!this.attemptedGpu && !this.forceCanvas && state.currentPhase === '05_SINGULARITY' &&
                state.telemetry.phaseElapsedSec < 13.6) {
                this.initializeGpu({ points: new Float32Array([0, 0, 0, 0, 0, -1, 1, 0]), count: 1,
                    uniforms: { ...this.frame.uniforms, width, height, dpr, centerX: width / 2, centerY: height / 2, opacity: 0 } });
            }
            this.publishDiagnostics(state, 'inactive');
            return;
        }
        if (!signals.isPaused && !signals.reducedMotion) {
            this.energy = Math.min(1, signals.low * 0.45 + signals.heartbeat * 0.3 + signals.kuramotoR * 0.25);
        }
        const profile = qualityGovernor.getProfile();
        const maxCount = this.forceCanvas || (this.attemptedGpu && !this.gpuReady) ? 1536 : OUROBOROS_CAPACITY;
        const count = Math.max(512, Math.floor(maxCount * profile.particleMultiplier));
        const baseLayout = getOuroborosLayout(width, height);
        const rise = state.reducedMotion ? 1 : smootherstep(0, 12, state.finaleRiseElapsedSec ?? 12);
        const layout = { ...baseLayout, centerY: baseLayout.centerY + height * 0.1 * (1 - rise) };
        this.frame.points = wasmPhysicsBridge.sampleOuroboros(state.seed, count, episode.timeSec, 1, this.energy);
        this.frame.count = wasmPhysicsBridge.getOuroborosCount();
        this.fieldLinked = applyOuroborosFieldMorph(this.frame.points, this.frame.count, sources, layout, episode.morph, state.seed);
        if (!this.fieldLinked) {
            this.overlay.style.visibility = 'hidden';
            this.publishDiagnostics(state, 'inactive');
            return;
        }
        Object.assign(this.frame.uniforms, layout, episode, { width, height, dpr, energy: this.energy });
        renderOuroborosFilaments(ctx, this.frame);

        if (!this.attemptedGpu && !this.forceCanvas) this.initializeGpu();
        let submitted = false;
        if (this.gpuReady && this.gpu) {
            this.gpu.resize({ width, height, dpr });
            const u = this.frame.uniforms;
            const unchanged = this.lastGpuTime === u.timeSec && this.lastGpuWidth === width &&
                this.lastGpuHeight === height && this.lastGpuDpr === dpr && this.lastGpuCount === this.frame.count &&
                this.lastGpuSeed === state.seed && this.lastGpuOpacity === u.opacity &&
                this.lastGpuMorph === u.morph && this.lastGpuEnergy === u.energy && this.lastGpuCenterY === u.centerY &&
                this.hasSameGpuPoints();
            if (!unchanged) {
                const started = performance.now();
                submitted = this.gpu.render(this.frame);
                if (submitted) {
                    integrationRegistry.recordModuleStep('webgpu-render', performance.now() - started, this.frame.count * 32);
                    this.lastGpuTime = u.timeSec;
                    this.lastGpuWidth = width;
                    this.lastGpuHeight = height;
                    this.lastGpuDpr = dpr;
                    this.lastGpuCount = this.frame.count;
                    this.lastGpuSeed = state.seed;
                    this.lastGpuOpacity = u.opacity;
                    this.lastGpuMorph = u.morph;
                    this.lastGpuEnergy = u.energy;
                    this.lastGpuCenterY = u.centerY;
                    this.lastGpuPoints.set(this.frame.points.subarray(0, this.frame.count * 8));
                }
            } else submitted = true;
            this.overlay.style.visibility = submitted ? 'visible' : 'hidden';
        }
        if (!submitted) {
            this.overlay.style.visibility = 'hidden';
            if (!this.atlas) {
                this.atlas = createGlowAtlas(this.overlay.ownerDocument);
                resourceLedger.trackPageLifetimeAllocation('textures', this.atlas.length);
            }
            renderOuroborosCanvas(ctx, this.frame, this.atlas, this.order);
        }
        this.publishDiagnostics(state, episode.morph >= 0.98 ? 'formed' : 'transition');
    }
    // КОНЕЦ ФУНКЦИИ render
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. GPU И ОСВОБОЖДЕНИЕ
    // НАЧАЛО ФУНКЦИИ initializeGpu
    private initializeGpu(initialFrame: OuroborosFrame = this.frame): void {
        if (!this.overlay) return;
        this.attemptedGpu = true;
        const started = performance.now();
        integrationRegistry.updateModuleStatus('webgpu-render', 'loading');
        const gpu = new OuroborosGpuRenderer(this.overlay, (message) => this.failGpu(message));
        this.gpu = gpu;
        void gpu.init(initialFrame).then((ready) => {
            if (this.disposed || this.gpu !== gpu) { gpu.dispose(); return; }
            if (!ready || !gpu.getStats().initialized) { this.failGpu(gpu.getStats().lastError ?? 'WebGPU unavailable'); return; }
            this.gpuReady = true;
            this.releaseAtlas();
            this.lastGpuTime = Number.NaN;
            this.gpuResourcesTracked = true;
            resourceLedger.trackPageLifetimeAllocation('buffers', 2);
            resourceLedger.trackPageLifetimeAllocation('textures', 1);
            integrationRegistry.updateModuleStatus('webgpu-render', 'ready', performance.now() - started, '');
            this.diagnosticStamp = -1;
        }).catch((error: unknown) => this.failGpu(error instanceof Error ? error.message : String(error)));
    }
    // КОНЕЦ ФУНКЦИИ initializeGpu

    // НАЧАЛО ФУНКЦИИ failGpu
    private failGpu(message: string): void {
        this.gpuReady = false;
        this.lastGpuTime = Number.NaN;
        this.gpu?.dispose();
        if (this.gpuResourcesTracked) {
            resourceLedger.trackPageLifetimeRelease('buffers', 2);
            resourceLedger.trackPageLifetimeRelease('textures', 1);
            this.gpuResourcesTracked = false;
        }
        if (this.overlay) this.overlay.style.visibility = 'hidden';
        if (!this.disposed) integrationRegistry.updateModuleStatus('webgpu-render', 'fallback', undefined, message);
        this.diagnosticStamp = -1;
    }
    // КОНЕЦ ФУНКЦИИ failGpu

    // НАЧАЛО ФУНКЦИИ releaseAtlas
    private releaseAtlas(): void {
        if (!this.atlas) return;
        resourceLedger.trackPageLifetimeRelease('textures', this.atlas.length);
        for (const sprite of this.atlas) sprite.width = sprite.height = 0;
        this.atlas = null;
    }
    // КОНЕЦ ФУНКЦИИ releaseAtlas

    // НАЧАЛО ФУНКЦИИ dispose
    public dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.failGpu('Disposed');
        this.releaseAtlas();
    }
    // КОНЕЦ ФУНКЦИИ dispose
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ДИАГНОСТИКА
    // НАЧАЛО ФУНКЦИИ publishDiagnostics
    private publishDiagnostics(state: Readonly<UniverseState>, phase: string): void {
        if (!this.overlay) return;
        const stamp = Math.floor(state.telemetry.simulationTimeSec * 2);
        if (stamp === this.diagnosticStamp && this.overlay.dataset.ouroborosState === phase) return;
        this.diagnosticStamp = stamp;
        const stats = this.gpu?.getStats();
        this.overlay.dataset.ouroborosState = phase;
        this.overlay.dataset.backend = this.gpuReady ? 'webgpu' : 'canvas2d';
        this.overlay.dataset.geometry = wasmPhysicsBridge.isOuroborosWasmActive() ? 'rust-wasm' : 'typescript';
        this.overlay.dataset.points = phase === 'inactive' ? '0' : String(this.frame.count);
        this.overlay.dataset.submittedFrames = String(stats?.submittedFrames ?? 0);
        this.overlay.dataset.validationErrors = String(stats?.validationErrors ?? 0);
        this.overlay.dataset.gpuError = stats?.lastError ?? '';
        this.overlay.dataset.mode = this.preview ? 'preview' : 'cycle';
        this.overlay.dataset.morph = phase === 'inactive' ? '0' : this.frame.uniforms.morph.toFixed(3);
        this.overlay.dataset.opacity = phase === 'inactive' ? '0' : this.frame.uniforms.opacity.toFixed(3);
        this.overlay.dataset.scenePhase = state.currentPhase;
        this.overlay.dataset.sceneTime = state.telemetry.phaseElapsedSec.toFixed(2);
        this.overlay.dataset.cardRise = state.finaleRiseElapsedSec === null ? 'waiting' : state.finaleRiseElapsedSec.toFixed(2);
    }
    // КОНЕЦ ФУНКЦИИ publishDiagnostics
    // КОНЕЦ РАЗДЕЛА 4
}
