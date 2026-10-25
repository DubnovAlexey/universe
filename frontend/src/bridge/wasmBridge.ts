// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/wasmBridge.ts
// НАЗНАЧЕНИЕ: Мост Rust/WebAssembly и детерминированное симплектическое ядро (v2.5)
// ЗАДАЧИ ФАЙЛА:
// 1. Загружать C-ABI v1 без блокировки первого кадра (?wasm=0 отключает Rust).
// 2. Интегрировать орбиты Velocity Verlet серией устойчивых подшагов (subSteps * subDt === safeDt),
//    полностью исключая потерю времени шага при любой частоте кадров (20..144 FPS).
// 3. Вычислять истинный относительный дрейф полной механической энергии ΔE/E₀.
// РАЗДЕЛЫ: контракт ABI v1; состояние провайдеров; инициализация и миграция;
//          загрузка и проверка памяти; общий шаг TS/Rust; чтение результатов.
// ФУНКЦИИ: initKuramotoOscillators — reset; attachWasmExports/uploadCurrentState —
// миграция; tryLoadWasmModule — асинхронная загрузка; useTypescriptFallback — отказ;
// refreshMemoryViewsIfNeeded — указатели; stepSymplecticPhysics — расчёт;
// getKuramotoPhase/getOrbitPosition/getIntegratedSimSec/isWasmActive — диагностика.
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { DeterministicPRNG } from '../core/prng';
import type { SceneBufferSoA } from '../core/sceneBuffer';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТ ABI И ЧИСЛЕННЫЕ КОНСТАНТЫ
export interface RustWasmExports {
    memory: WebAssembly.Memory;
    get_abi_version: () => number;
    get_active_count: () => number;
    init_bodies: (seed: number, count: number) => number;
    step_verlet_nbody: (
        dt: number,
        gravity: number,
        kuramotoCoupling: number
    ) => number; // ABI v1: 1 = complete successful step/no-op, 0 = rejection.
    get_positions_ptr: () => number;
    get_velocities_ptr: () => number;
    get_phases_ptr: () => number;
    get_omegas_ptr: () => number;
    get_integrated_time: () => number;
    commit_uploaded_state: (baselineEnergy: number, integratedSec: number) => number;
    get_energy_drift: () => number;
    get_kuramoto_r: () => number;
    // Reference scalar magnitude only: stress=0.25, time=0; Canvas optics stay in TS.
    evaluate_lens_refraction: (
        x: number, y: number, lensX: number, lensY: number,
        lensRadius: number, revealIntensity: number
    ) => number;
}

export interface PhysicsStepTelemetry {
    energyDriftRatio: number;
    kuramotoOrderR: number;
    barycenter1: [number, number];
    barycenter2: [number, number];
    stepDurationMs: number;
    isWasmNative: boolean;
}

const VERLET_ENSEMBLE_COUNT = 64;
const GM_CONSERVATIVE = 4900.0;
const PLUMMER_SOFTENING_SQ = 64.0;
const MAX_STABLE_SUBSTEP_SEC = 0.004;
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. ПРОВАЙДЕРЫ, МИГРАЦИЯ И ОБЩИЙ ШАГ
export class WasmPhysicsBridge {
    private wasmExports: RustWasmExports | null = null;
    private cachedMemoryBuffer: ArrayBufferLike | null = null;
    private wasmPosView: Float32Array | null = null;
    private wasmVelView: Float32Array | null = null;
    private wasmPhaseView: Float32Array | null = null;
    private wasmOmegaView: Float32Array | null = null;
    private currentSeed = 104729;
    private activeCount = 1024;
    private nativeActive = false;

    private kuramotoPhases: Float32Array = new Float32Array(1024);
    private naturalOmegas: Float32Array = new Float32Array(1024);
    private verletOrbitPos: Float32Array = new Float32Array(VERLET_ENSEMBLE_COUNT * 2);
    private verletOrbitVel: Float32Array = new Float32Array(VERLET_ENSEMBLE_COUNT * 2);
    private baselineTotalEnergy = 0;
    private integratedSimSec = 0;
    private isInitialized = false;

    // НАЧАЛО ФУНКЦИИ constructor
    constructor(initialSeed = 104729) {
        this.initKuramotoOscillators(initialSeed);
    }
    // КОНЕЦ ФУНКЦИИ constructor

    // НАЧАЛО ФУНКЦИИ computeEnsembleTotalEnergy
    private computeEnsembleTotalEnergy(): number {
        let totalEnergy = 0;
        for (let i = 0; i < VERLET_ENSEMBLE_COUNT; i++) {
            const i2 = i * 2;
            const px = this.verletOrbitPos[i2];
            const py = this.verletOrbitPos[i2 + 1];
            const vx = this.verletOrbitVel[i2];
            const vy = this.verletOrbitVel[i2 + 1];

            const r = Math.sqrt(px * px + py * py + PLUMMER_SOFTENING_SQ);
            const kinetic = 0.5 * (vx * vx + vy * vy);
            const potential = -GM_CONSERVATIVE / r;
            totalEnergy += kinetic + potential;
        }
        return totalEnergy;
    }
    // КОНЕЦ ФУНКЦИИ computeEnsembleTotalEnergy

    // НАЧАЛО ФУНКЦИИ initKuramotoOscillators
    public initKuramotoOscillators(seed: number, activeCount = this.activeCount): void {
        this.currentSeed = seed >>> 0;
        this.nativeActive = false;
        this.activeCount = Number.isFinite(activeCount)
            ? Math.max(0, Math.min(1024, Math.floor(activeCount))) : 0;
        const rng = new DeterministicPRNG(seed);
        for (let i = 0; i < this.kuramotoPhases.length; i++) {
            this.kuramotoPhases[i] = rng.nextRange(0, Math.PI * 2);
            this.naturalOmegas[i] =
                rng.nextRange(0.85, 1.45) * (i % 2 === 0 ? 1 : -1);
        }

        for (let i = 0; i < VERLET_ENSEMBLE_COUNT; i++) {
            const angle =
                (i / VERLET_ENSEMBLE_COUNT) * Math.PI * 2 +
                rng.nextRange(-0.05, 0.05);
            const r = 65.0 + (i % 8) * 28.0;
            const vCirc = Math.sqrt(
                (GM_CONSERVATIVE * r * r) /
                Math.pow(r * r + PLUMMER_SOFTENING_SQ, 1.5)
            );
            this.verletOrbitPos[i * 2] = Math.cos(angle) * r;
            this.verletOrbitPos[i * 2 + 1] = Math.sin(angle) * r;
            this.verletOrbitVel[i * 2] = -Math.sin(angle) * vCirc;
            this.verletOrbitVel[i * 2 + 1] = Math.cos(angle) * vCirc;
        }

        this.baselineTotalEnergy = this.computeEnsembleTotalEnergy();
        this.integratedSimSec = 0;
        this.isInitialized = true;
        if (this.wasmExports) {
            try {
                this.uploadCurrentState();
            } catch {
                this.useTypescriptFallback();
            }
        }
    }
    // КОНЕЦ ФУНКЦИИ initKuramotoOscillators

    /**
     * Проверяет, что переданный объект экспортов WASM реализует полный C-ABI контракт.
     */
    // НАЧАЛО ФУНКЦИИ validateWasmExportsContract
    public static validateWasmExportsContract(
        exports: Partial<RustWasmExports> | null | undefined
    ): exports is RustWasmExports {
        if (!exports || !(exports.memory instanceof WebAssembly.Memory)) return false;
        const functions: (keyof RustWasmExports)[] = [
            'get_abi_version', 'get_active_count', 'init_bodies', 'step_verlet_nbody',
            'get_positions_ptr', 'get_velocities_ptr', 'get_phases_ptr', 'get_omegas_ptr',
            'get_integrated_time', 'commit_uploaded_state', 'get_energy_drift', 'get_kuramoto_r',
            'evaluate_lens_refraction',
        ];
        if (!functions.every((name) => typeof exports[name] === 'function')) return false;
        try { return exports.get_abi_version!() === 1; } catch { return false; }
    }
    // КОНЕЦ ФУНКЦИИ validateWasmExportsContract

    /** Adopt the latest TS state, including progress made while the download was in flight. */
    // НАЧАЛО ФУНКЦИИ attachWasmExports
    public attachWasmExports(exports: Partial<RustWasmExports>): boolean {
        if (!WasmPhysicsBridge.validateWasmExportsContract(exports)) return false;
        try {
            this.wasmExports = exports;
            this.uploadCurrentState();
            this.nativeActive = false;
            integrationRegistry.updateModuleStatus('wasm-physics', 'loading');
            return true;
        } catch {
            this.useTypescriptFallback();
            return false;
        }
    }
    // КОНЕЦ ФУНКЦИИ attachWasmExports

    // НАЧАЛО ФУНКЦИИ useTypescriptFallback
    public useTypescriptFallback(): void {
        this.wasmExports = null;
        this.cachedMemoryBuffer = null;
        this.wasmPosView = this.wasmVelView = null;
        this.wasmPhaseView = this.wasmOmegaView = null;
        this.nativeActive = false;
        integrationRegistry.updateModuleStatus('wasm-physics', 'fallback');
    }
    // КОНЕЦ ФУНКЦИИ useTypescriptFallback

    // НАЧАЛО ФУНКЦИИ tryLoadWasmModule
    public async tryLoadWasmModule(): Promise<boolean> {
        if (typeof window === 'undefined' || typeof WebAssembly === 'undefined') {
            integrationRegistry.updateModuleStatus('wasm-physics', 'fallback', 0);
            return false;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('wasm') === '0') {
            integrationRegistry.updateModuleStatus('wasm-physics', 'fallback', 0);
            return false;
        }

        const t0 = performance.now();
        integrationRegistry.updateModuleStatus('wasm-physics', 'loading');

        try {
            const baseUrl =
                (import.meta as unknown as { env?: { BASE_URL?: string } }).env
                    ?.BASE_URL ?? '/';
            const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
            const wasmUrl = `${normalizedBase}wasm/physics_engine.wasm`;

            const response = await fetch(wasmUrl, { method: 'GET', cache: 'no-cache' });
            if (!response.ok) {
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            const bytes = await response.arrayBuffer();
            if (bytes.byteLength < 8) {
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            const magicView = new Uint8Array(bytes, 0, 4);
            const isValidWasmMagic =
                magicView[0] === 0x00 &&
                magicView[1] === 0x61 &&
                magicView[2] === 0x73 &&
                magicView[3] === 0x6d;

            if (!isValidWasmMagic) {
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            const instantiated = await WebAssembly.instantiate(bytes, { env: {} });
            const rawExports = instantiated.instance.exports as Partial<RustWasmExports>;

            if (!WasmPhysicsBridge.validateWasmExportsContract(rawExports)) {
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            // Adoption reads current seed/count: a restart during fetch takes precedence.
            return this.attachWasmExports(rawExports);
        } catch {
            integrationRegistry.updateModuleStatus(
                'wasm-physics',
                'fallback',
                performance.now() - t0
            );
            return false;
        }
    }
    // КОНЕЦ ФУНКЦИИ tryLoadWasmModule

    // НАЧАЛО ФУНКЦИИ refreshMemoryViewsIfNeeded
    private refreshMemoryViewsIfNeeded(): boolean {
        if (!this.wasmExports || this.wasmExports.get_active_count() !== this.activeCount) return false;
        const buffer = this.wasmExports.memory.buffer;
        const pointers = [this.wasmExports.get_positions_ptr(), this.wasmExports.get_velocities_ptr(),
            this.wasmExports.get_phases_ptr(), this.wasmExports.get_omegas_ptr()];
        const lengths = [VERLET_ENSEMBLE_COUNT * 3, VERLET_ENSEMBLE_COUNT * 3, 1024, 1024];
        if (pointers.some((ptr, i) => !Number.isInteger(ptr) || ptr <= 0 || ptr % 4 !== 0 ||
            ptr + lengths[i] * 4 > buffer.byteLength)) return false;
        const views = [this.wasmPosView, this.wasmVelView, this.wasmPhaseView, this.wasmOmegaView];
        if (this.cachedMemoryBuffer !== buffer || views.some((view, i) => !view || view.byteOffset !== pointers[i])) {
            [this.wasmPosView, this.wasmVelView, this.wasmPhaseView, this.wasmOmegaView] =
                pointers.map((ptr, i) => new Float32Array(buffer, ptr, lengths[i]));
            this.cachedMemoryBuffer = buffer;
        }
        return true;
    }
    // КОНЕЦ ФУНКЦИИ refreshMemoryViewsIfNeeded

    // НАЧАЛО ФУНКЦИИ uploadCurrentState
    private uploadCurrentState(): void {
        if (!this.wasmExports) throw new Error('No WASM provider');
        this.wasmExports.init_bodies(this.currentSeed, this.activeCount);
        if (!this.refreshMemoryViewsIfNeeded()) throw new Error('Invalid WASM memory layout');
        this.wasmPhaseView!.set(this.kuramotoPhases);
        this.wasmOmegaView!.set(this.naturalOmegas);
        for (let i = 0; i < VERLET_ENSEMBLE_COUNT; i++) {
            this.wasmPosView![i * 3] = this.verletOrbitPos[i * 2];
            this.wasmPosView![i * 3 + 1] = this.verletOrbitPos[i * 2 + 1];
            this.wasmVelView![i * 3] = this.verletOrbitVel[i * 2];
            this.wasmVelView![i * 3 + 1] = this.verletOrbitVel[i * 2 + 1];
        }
        if (this.wasmExports.commit_uploaded_state(this.baselineTotalEnergy, this.integratedSimSec) !== 1) {
            throw new Error('WASM rejected uploaded state');
        }
    }
    // КОНЕЦ ФУНКЦИИ uploadCurrentState

    // НАЧАЛО ФУНКЦИИ stepSymplecticPhysics
    public stepSymplecticPhysics(
        sceneBuffer: SceneBufferSoA,
        activeCount: number,
        fixedDt: number,
        simTimeSec: number,
        centerX: number,
        centerY: number,
        viewportWidth: number,
        viewportHeight: number,
        kuramotoCouplingK: number
    ): PhysicsStepTelemetry {
        const startMs = performance.now();
        const count = Number.isFinite(activeCount)
            ? Math.max(0, Math.min(1024, sceneBuffer.capacity, Math.floor(activeCount))) : 0;
        const safeCoupling = Number.isFinite(kuramotoCouplingK) ? kuramotoCouplingK : 0;
        const safeDt = Number.isFinite(fixedDt) && fixedDt > 0 && Number.isFinite(kuramotoCouplingK)
            ? Math.min(0.05, fixedDt) : 0;
        if (count !== this.activeCount) {
            this.activeCount = count;
            if (this.wasmExports) {
                try { this.uploadCurrentState(); } catch { this.useTypescriptFallback(); }
            }
        }

        const orbitAngle = simTimeSec * 0.42;
        const sepX = viewportWidth * 0.18;
        const sepY = viewportHeight * 0.11;
        const b1x = centerX + Math.cos(orbitAngle) * sepX;
        const b1y = centerY + Math.sin(orbitAngle) * sepY;
        const b2x = centerX - Math.cos(orbitAngle) * sepX * 1.06;
        const b2y = centerY - Math.sin(orbitAngle) * sepY * 1.06;

        if (this.wasmExports) {
            try {
                const expectedTime = this.integratedSimSec + (count > 0 ? safeDt : 0);
                if (this.wasmExports.step_verlet_nbody(safeDt, 1.0, safeCoupling) !== 1) {
                    throw new Error('WASM rejected physics step');
                }
                if (!this.refreshMemoryViewsIfNeeded()) throw new Error('WASM memory changed incompatibly');
                const drift = this.wasmExports.get_energy_drift();
                const order = this.wasmExports.get_kuramoto_r();
                const integratedTime = this.wasmExports.get_integrated_time();
                if (!this.wasmPosView!.every(Number.isFinite) || !this.wasmVelView!.every(Number.isFinite) ||
                    !this.wasmPhaseView!.every(Number.isFinite) || !Number.isFinite(drift) || drift < 0 ||
                    !Number.isFinite(order) || order < 0 || order > 1 ||
                    !Number.isFinite(integratedTime) || Math.abs(integratedTime - expectedTime) > 1e-8) {
                    throw new Error('WASM returned invalid state');
                }
                // Commit complete mirrors only after validation: failures resume TS from its last good step.
                this.kuramotoPhases.set(this.wasmPhaseView!);
                for (let i = 0; i < VERLET_ENSEMBLE_COUNT; i++) {
                    this.verletOrbitPos[i * 2] = this.wasmPosView![i * 3];
                    this.verletOrbitPos[i * 2 + 1] = this.wasmPosView![i * 3 + 1];
                    this.verletOrbitVel[i * 2] = this.wasmVelView![i * 3];
                    this.verletOrbitVel[i * 2 + 1] = this.wasmVelView![i * 3 + 1];
                }
                this.integratedSimSec = integratedTime;
                this.nativeActive = true;
                const dur = performance.now() - startMs;
                integrationRegistry.updateModuleStatus('wasm-physics', 'ready');
                integrationRegistry.recordModuleStep('wasm-physics', dur, 24, 1024 * 4 + 64 * 4 * 4);
                return { energyDriftRatio: drift, kuramotoOrderR: Number(order.toFixed(4)),
                    barycenter1: [b1x, b1y], barycenter2: [b2x, b2y], stepDurationMs: dur, isWasmNative: true };
            } catch {
                this.useTypescriptFallback();
            }
        }

        if (safeDt > 0 && count > 0) {
            // Разбиваем safeDt на целое число малых симплектических подшагов (<= 4 мс),
            // чтобы сумма subSteps * subDt в точности равнялась safeDt без потери времени
            const subSteps = Math.max(1, Math.ceil(safeDt / MAX_STABLE_SUBSTEP_SEC));
            const subDt = safeDt / subSteps;
            const halfDt = 0.5 * subDt;
            const halfDtSq = 0.5 * subDt * subDt;

            for (let step = 0; step < subSteps; step++) {
                let stepCos = 0;
                let stepSin = 0;
                for (let i = 0; i < count; i++) {
                    stepCos += Math.cos(this.kuramotoPhases[i]);
                    stepSin += Math.sin(this.kuramotoPhases[i]);
                }
                const stepMeanAngle = Math.atan2(
                    stepSin / Math.max(1, count),
                    stepCos / Math.max(1, count)
                );

                for (let i = 0; i < count; i++) {
                    const theta = this.kuramotoPhases[i];
                    const dTheta =
                        this.naturalOmegas[i] +
                        safeCoupling * Math.sin(stepMeanAngle - theta);
                    const nextTheta = (theta + dTheta * subDt) % (Math.PI * 2);
                    this.kuramotoPhases[i] =
                        nextTheta < 0 ? nextTheta + Math.PI * 2 : nextTheta;
                }

                for (let i = 0; i < VERLET_ENSEMBLE_COUNT; i++) {
                    const i2 = i * 2;
                    const px = this.verletOrbitPos[i2];
                    const py = this.verletOrbitPos[i2 + 1];
                    const vx = this.verletOrbitVel[i2];
                    const vy = this.verletOrbitVel[i2 + 1];

                    const r0Sq = px * px + py * py + PLUMMER_SOFTENING_SQ;
                    const r0 = Math.sqrt(r0Sq);
                    const invR0Cubed = 1.0 / (r0Sq * r0);
                    const ax0 = -GM_CONSERVATIVE * px * invR0Cubed;
                    const ay0 = -GM_CONSERVATIVE * py * invR0Cubed;

                    const nextPx = px + vx * subDt + ax0 * halfDtSq;
                    const nextPy = py + vy * subDt + ay0 * halfDtSq;

                    const r1Sq = nextPx * nextPx + nextPy * nextPy + PLUMMER_SOFTENING_SQ;
                    const r1 = Math.sqrt(r1Sq);
                    const invR1Cubed = 1.0 / (r1Sq * r1);
                    const ax1 = -GM_CONSERVATIVE * nextPx * invR1Cubed;
                    const ay1 = -GM_CONSERVATIVE * nextPy * invR1Cubed;

                    const nextVx = vx + (ax0 + ax1) * halfDt;
                    const nextVy = vy + (ay0 + ay1) * halfDt;

                    this.verletOrbitPos[i2] = nextPx;
                    this.verletOrbitPos[i2 + 1] = nextPy;
                    this.verletOrbitVel[i2] = nextVx;
                    this.verletOrbitVel[i2 + 1] = nextVy;
                }

                this.integratedSimSec += subDt;
            }
        }

        let sumCos = 0;
        let sumSin = 0;
        for (let i = 0; i < count; i++) {
            sumCos += Math.cos(this.kuramotoPhases[i]);
            sumSin += Math.sin(this.kuramotoPhases[i]);
        }
        const kuramotoOrderR = Math.min(
            1.0,
            Math.hypot(sumCos / Math.max(1, count), sumSin / Math.max(1, count))
        );

        const totalMechanicalEnergy = this.computeEnsembleTotalEnergy();
        if (this.baselineTotalEnergy === 0 && totalMechanicalEnergy !== 0) {
            this.baselineTotalEnergy = totalMechanicalEnergy;
        }

        const measuredDrift =
            this.baselineTotalEnergy !== 0
                ? Math.abs(
                    (totalMechanicalEnergy - this.baselineTotalEnergy) /
                    this.baselineTotalEnergy
                )
                : 0.0;
        const energyDriftRatio = Number.isFinite(measuredDrift) ? measuredDrift : 0.0;

        const dur = performance.now() - startMs;
        integrationRegistry.recordModuleStep('ts-core', dur, count * 12, count * 12);

        return {
            energyDriftRatio,
            kuramotoOrderR: Number(kuramotoOrderR.toFixed(4)),
            barycenter1: [b1x, b1y],
            barycenter2: [b2x, b2y],
            stepDurationMs: dur,
            isWasmNative: false,
        };
    }
    // КОНЕЦ ФУНКЦИИ stepSymplecticPhysics

    // НАЧАЛО ФУНКЦИИ getKuramotoPhase
    public getKuramotoPhase(index: number): number {
        return this.kuramotoPhases[index % this.kuramotoPhases.length] ?? 0;
    }
    // КОНЕЦ ФУНКЦИИ getKuramotoPhase

    // НАЧАЛО ФУНКЦИИ getOrbitPosition
    public getOrbitPosition(orbitIndex: number): [number, number] {
        const idx = Math.max(0, Math.min(VERLET_ENSEMBLE_COUNT - 1, orbitIndex)) * 2;
        return [this.verletOrbitPos[idx], this.verletOrbitPos[idx + 1]];
    }
    // КОНЕЦ ФУНКЦИИ getOrbitPosition

    // НАЧАЛО ФУНКЦИИ getIntegratedSimSec
    public getIntegratedSimSec(): number {
        return this.integratedSimSec;
    }
    // КОНЕЦ ФУНКЦИИ getIntegratedSimSec

    // НАЧАЛО ФУНКЦИИ isInitializedReady
    public isInitializedReady(): boolean {
        return this.isInitialized;
    }
    // КОНЕЦ ФУНКЦИИ isInitializedReady

    // НАЧАЛО ФУНКЦИИ isWasmActive
    public isWasmActive(): boolean {
        return this.nativeActive;
    }
    // КОНЕЦ ФУНКЦИИ isWasmActive
}
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ОБЩИЙ ЭКЗЕМПЛЯР ПРИЛОЖЕНИЯ
export const wasmPhysicsBridge = new WasmPhysicsBridge();
// КОНЕЦ РАЗДЕЛА 3
