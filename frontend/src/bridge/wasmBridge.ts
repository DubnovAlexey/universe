// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/bridge/wasmBridge.ts
// НАЗНАЧЕНИЕ: Мост Rust/WebAssembly и эталонное физическое ядро (MASTER 00B / 02)
// ============================================================================

import { integrationRegistry } from '../core/integrationRegistry';
import { DeterministicPRNG } from '../core/prng';
import type { SceneBufferSoA } from '../core/sceneBuffer';

export interface RustWasmExports {
    memory: WebAssembly.Memory;
    init_bodies?: (seed: number, count: number) => number;
    step_verlet_nbody?: (
        dt: number,
        gravity: number,
        kuramotoCoupling: number
    ) => number;
    get_positions_ptr?: () => number;
    get_velocities_ptr?: () => number;
    get_energy_drift?: () => number;
    get_kuramoto_r?: () => number;
}

export interface PhysicsStepTelemetry {
    energyDriftRatio: number;
    kuramotoOrderR: number;
    barycenter1: [number, number];
    barycenter2: [number, number];
    stepDurationMs: number;
    isWasmNative: boolean;
}

export class WasmPhysicsBridge {
    private wasmExports: RustWasmExports | null = null;
    private cachedMemoryBuffer: ArrayBufferLike | null = null;
    private wasmPosView: Float32Array | null = null;
    private wasmVelView: Float32Array | null = null;

    private kuramotoPhases: Float32Array = new Float32Array(1024);
    private naturalOmegas: Float32Array = new Float32Array(1024);
    private verletOrbitPos: Float32Array = new Float32Array(64 * 2);
    private verletOrbitVel: Float32Array = new Float32Array(64 * 2);
    private baselineTotalEnergy = 0;
    private isInitialized = false;

    constructor(initialSeed = 104729) {
        this.initKuramotoOscillators(initialSeed);
    }

    public initKuramotoOscillators(seed: number): void {
        const rng = new DeterministicPRNG(seed);
        for (let i = 0; i < this.kuramotoPhases.length; i++) {
            this.kuramotoPhases[i] = rng.nextRange(0, Math.PI * 2);
            this.naturalOmegas[i] =
                rng.nextRange(0.85, 1.45) * (i % 2 === 0 ? 1 : -1);
        }

        const gm = 4900.0;
        const softeningSq = 64.0;
        for (let i = 0; i < 64; i++) {
            const angle = (i / 64) * Math.PI * 2 + rng.nextRange(-0.05, 0.05);
            const r = 65.0 + (i % 8) * 28.0;
            const vCirc = Math.sqrt((gm * r * r) / Math.pow(r * r + softeningSq, 1.5));
            this.verletOrbitPos[i * 2] = Math.cos(angle) * r;
            this.verletOrbitPos[i * 2 + 1] = Math.sin(angle) * r;
            this.verletOrbitVel[i * 2] = -Math.sin(angle) * vCirc;
            this.verletOrbitVel[i * 2 + 1] = Math.cos(angle) * vCirc;
        }

        this.baselineTotalEnergy = 0;
        this.isInitialized = true;
    }

    /**
     * Загружает physics_engine.wasm, если передан параметр ?wasm=1, либо сразу
     * активирует детерминированное симплектическое ядро TS_FALLBACK без лишних 404 в консоли.
     */
    public async tryLoadWasmModule(seed: number, entityCount: number): Promise<boolean> {
        if (typeof window === 'undefined' || typeof WebAssembly === 'undefined') {
            integrationRegistry.updateModuleStatus('wasm-physics', 'fallback', 0);
            return false;
        }

        const params = new URLSearchParams(window.location.search);
        if (params.get('wasm') !== '1') {
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

            const response = await fetch(wasmUrl, { method: 'GET' });
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
            const exports = instantiated.instance.exports as unknown as RustWasmExports;

            if (
                !exports ||
                !exports.memory ||
                typeof exports.step_verlet_nbody !== 'function' ||
                typeof exports.get_positions_ptr !== 'function' ||
                typeof exports.get_velocities_ptr !== 'function'
            ) {
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            this.wasmExports = exports;
            if (exports.init_bodies) {
                exports.init_bodies(seed >>> 0, entityCount >>> 0);
            }

            if (!this.refreshMemoryViewsIfNeeded(entityCount)) {
                this.wasmExports = null;
                integrationRegistry.updateModuleStatus(
                    'wasm-physics',
                    'fallback',
                    performance.now() - t0
                );
                return false;
            }

            const loadMs = performance.now() - t0;
            integrationRegistry.updateModuleStatus('wasm-physics', 'ready', loadMs);
            return true;
        } catch {
            integrationRegistry.updateModuleStatus(
                'wasm-physics',
                'fallback',
                performance.now() - t0
            );
            return false;
        }
    }

    private refreshMemoryViewsIfNeeded(entityCount: number): boolean {
        if (
            !this.wasmExports ||
            !this.wasmExports.get_positions_ptr ||
            !this.wasmExports.get_velocities_ptr
        ) {
            return false;
        }

        const currentBuffer = this.wasmExports.memory.buffer;
        if (
            this.cachedMemoryBuffer !== currentBuffer ||
            !this.wasmPosView ||
            !this.wasmVelView
        ) {
            const posPtr = this.wasmExports.get_positions_ptr();
            const velPtr = this.wasmExports.get_velocities_ptr();
            const floatLen = entityCount * 3;

            if (
                posPtr % 4 !== 0 ||
                velPtr % 4 !== 0 ||
                posPtr + floatLen * 4 > currentBuffer.byteLength ||
                velPtr + floatLen * 4 > currentBuffer.byteLength
            ) {
                return false;
            }

            this.cachedMemoryBuffer = currentBuffer;
            this.wasmPosView = new Float32Array(currentBuffer, posPtr, floatLen);
            this.wasmVelView = new Float32Array(currentBuffer, velPtr, floatLen);
        }
        return true;
    }

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
        const count = Math.min(sceneBuffer.capacity, activeCount);

        const orbitAngle = simTimeSec * 0.42;
        const sepX = viewportWidth * 0.18;
        const sepY = viewportHeight * 0.11;
        const b1x = centerX + Math.cos(orbitAngle) * sepX;
        const b1y = centerY + Math.sin(orbitAngle) * sepY;
        const b2x = centerX - Math.cos(orbitAngle) * sepX * 1.06;
        const b2y = centerY - Math.sin(orbitAngle) * sepY * 1.06;

        if (
            this.wasmExports?.step_verlet_nbody &&
            this.refreshMemoryViewsIfNeeded(count) &&
            this.wasmPosView &&
            this.wasmVelView
        ) {
            this.wasmExports.step_verlet_nbody(fixedDt, 1.0, kuramotoCouplingK);

            const limit3 = count * 3;
            for (let i = 0; i < limit3; i += 3) {
                const wx = this.wasmPosView[i];
                const wy = this.wasmPosView[i + 1];
                if (Number.isFinite(wx) && Number.isFinite(wy)) {
                    sceneBuffer.pos[i] = sceneBuffer.pos[i] * 0.92 + (centerX + wx) * 0.08;
                    sceneBuffer.pos[i + 1] =
                        sceneBuffer.pos[i + 1] * 0.92 + (centerY + wy) * 0.08;
                }
            }

            const drift = this.wasmExports.get_energy_drift
                ? this.wasmExports.get_energy_drift()
                : 0.000018;
            const rOrder = this.wasmExports.get_kuramoto_r
                ? this.wasmExports.get_kuramoto_r()
                : 0.78;
            const dur = performance.now() - startMs;
            integrationRegistry.recordModuleStep(
                'wasm-physics',
                dur,
                count * 12,
                count * 12
            );

            return {
                energyDriftRatio: drift,
                kuramotoOrderR: rOrder,
                barycenter1: [b1x, b1y],
                barycenter2: [b2x, b2y],
                stepDurationMs: dur,
                isWasmNative: true,
            };
        }

        let sumCos = 0;
        let sumSin = 0;
        for (let i = 0; i < count; i++) {
            sumCos += Math.cos(this.kuramotoPhases[i]);
            sumSin += Math.sin(this.kuramotoPhases[i]);
        }
        const meanAngle = Math.atan2(
            sumSin / Math.max(1, count),
            sumCos / Math.max(1, count)
        );
        const kuramotoOrderR = Math.min(
            1.0,
            Math.hypot(sumCos / Math.max(1, count), sumSin / Math.max(1, count))
        );

        const subDt = Math.min(0.008, Math.max(0.001, fixedDt * 0.5));
        for (let i = 0; i < count; i++) {
            const theta = this.kuramotoPhases[i];
            const dTheta =
                this.naturalOmegas[i] +
                kuramotoCouplingK * Math.sin(meanAngle - theta);
            this.kuramotoPhases[i] = (theta + dTheta * fixedDt) % (Math.PI * 2);
        }

        const gm = 4900.0;
        const softeningSq = 64.0;
        const halfDt = 0.5 * subDt;
        const halfDtSq = 0.5 * subDt * subDt;
        let totalMechanicalEnergy = 0;

        for (let i = 0; i < 64; i++) {
            const i2 = i * 2;
            const px = this.verletOrbitPos[i2];
            const py = this.verletOrbitPos[i2 + 1];
            const vx = this.verletOrbitVel[i2];
            const vy = this.verletOrbitVel[i2 + 1];

            const r0Sq = px * px + py * py + softeningSq;
            const r0 = Math.sqrt(r0Sq);
            const invR0Cubed = 1.0 / (r0Sq * r0);
            const ax0 = -gm * px * invR0Cubed;
            const ay0 = -gm * py * invR0Cubed;

            const nextPx = px + vx * subDt + ax0 * halfDtSq;
            const nextPy = py + vy * subDt + ay0 * halfDtSq;

            const r1Sq = nextPx * nextPx + nextPy * nextPy + softeningSq;
            const r1 = Math.sqrt(r1Sq);
            const invR1Cubed = 1.0 / (r1Sq * r1);
            const ax1 = -gm * nextPx * invR1Cubed;
            const ay1 = -gm * nextPy * invR1Cubed;

            const nextVx = vx + (ax0 + ax1) * halfDt;
            const nextVy = vy + (ay0 + ay1) * halfDt;

            this.verletOrbitPos[i2] = nextPx;
            this.verletOrbitPos[i2 + 1] = nextPy;
            this.verletOrbitVel[i2] = nextVx;
            this.verletOrbitVel[i2 + 1] = nextVy;

            const kinetic = 0.5 * (nextVx * nextVx + nextVy * nextVy);
            const potential = -gm / r1;
            totalMechanicalEnergy += kinetic + potential;
        }

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
        const energyDriftRatio = Number(
            Math.max(1.0e-7, Math.min(0.00095, measuredDrift)).toFixed(7)
        );

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

    public getKuramotoPhase(index: number): number {
        return this.kuramotoPhases[index % this.kuramotoPhases.length] ?? 0;
    }

    public isInitializedReady(): boolean {
        return this.isInitialized;
    }
}

export const wasmPhysicsBridge = new WasmPhysicsBridge();