// ============================================================================
// ФАЙЛ: frontend/scripts/verify-wasm-runtime.mjs
// НАЗНАЧЕНИЕ: Проверить реальный Rust/WASM ABI и его связь с видимой сценой.
// РАЗДЕЛЫ: 1. Артефакт и SSR; 2. Паритет/жизненный цикл; 3. Геометрия сцены;
//          4. Скалярный эталон BREACH при фиксированных stress=0.25/time=0.
// ФУНКЦИИ: instantiate — отдельный экземпляр WASM; step — общий сценарий шага;
// compare — сравнение провайдеров; sampleScene — сквозная публикация геометрии.
// verifyLensRefractionMagnitude — эталон длины смещения; runtime-оптика остаётся TS.
// ============================================================================
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// НАЧАЛО РАЗДЕЛА 1. АРТЕФАКТ И SSR
const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bytes = await readFile(path.join(frontendDirectory, 'public/wasm/physics_engine.wasm'));
const module = await WebAssembly.compile(bytes);
assert.deepEqual(WebAssembly.Module.imports(module), [], 'Raw ABI must not require JS glue');
const server = await createServer({ root: frontendDirectory, logLevel: 'error', server: { middlewareMode: true } });

// НАЧАЛО ФУНКЦИИ instantiate: isolated linear memory per scenario.
async function instantiate() {
    return (await WebAssembly.instantiate(module, {})).exports;
}
// КОНЕЦ ФУНКЦИИ instantiate
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО ФУНКЦИИ verifyLensRefractionMagnitude: compare only the six-argument scalar ABI.
function verifyLensRefractionMagnitude(exports, stressStore) {
    const state = stressStore.getState();
    const savedState = { ...state };
    const radii = [0, 7, 7.999, 8, 24, 140, 512];
    const centers = [[0, 0], [480, 270], [-128.25, 31.5], [1920, 1080]];
    const angles = [0, Math.PI / 8, Math.PI / 3, Math.PI / 2, Math.PI * 1.25, Math.PI * 2 - 0.001];
    const normalizedDistances = [0, 0.2, 0.55, 0.7599, 0.76, 0.7601, 0.8, 0.94,
        1, 1.06, 1.2, 1.2399, 1.24, 1.2401, 1.5, 2];
    let samples = 0;
    let nonzeroSamples = 0;
    let zeroSamples = 0;
    let maximumError = 0;
    const integratedTime = exports.get_integrated_time();
    try {
        // Normalize all ABI inputs to f32 before both implementations. The raw
        // export fixes stress/time and returns magnitude, not rim/dispersion.
        for (const [lensX, lensY] of centers) {
            for (const radius of radii) {
                for (const reveal of [0, 0.38, 0.85, 1]) {
                    Object.assign(state, { lensX: Math.fround(lensX), lensY: Math.fround(lensY),
                        currentBreachRadius: Math.fround(radius), revealIntensity: Math.fround(reveal),
                        globalStress: Math.fround(0.25), isBreaching: false });
                    for (const angle of angles) {
                        const localRadius = Math.max(8, stressStore.getDeformedLensRadiusAtAngle(angle, 0));
                        for (const distance of normalizedDistances) {
                            const x = Math.fround(state.lensX + Math.cos(angle) * localRadius * distance);
                            const y = Math.fround(state.lensY + Math.sin(angle) * localRadius * distance);
                            state.isBreaching = false;
                            const offset = stressStore.getBoundaryRefractionOffset(x, y, 0);
                            const expected = Math.hypot(offset.dx, offset.dy);
                            const actual = exports.evaluate_lens_refraction(x, y, state.lensX, state.lensY,
                                state.currentBreachRadius, state.revealIntensity);
                            const error = Math.abs(actual - expected);
                            assert.ok(Number.isFinite(actual) && actual >= 0, 'Finite BREACH magnitude');
                            // Rust uses f32 throughout the optical kernel; TS
                            // evaluates normalized inputs with f64 intermediates.
                            assert.ok(error <= 0.0002,
                                `BREACH magnitude r=${radius} reveal=${reveal} angle=${angle} d=${distance}: ${actual} vs ${expected}`);
                            maximumError = Math.max(maximumError, error);
                            if (expected === 0) {
                                assert.equal(actual, 0, 'Center/inner/outside samples produce zero displacement');
                                zeroSamples++;
                            } else {
                                nonzeroSamples++;
                            }
                            // Breach mode only changes the TS dispersion factor;
                            // it is deliberately absent from the scalar Rust ABI.
                            state.isBreaching = true;
                            const breaching = stressStore.getBoundaryRefractionOffset(x, y, 0);
                            assert.equal(breaching.dx, offset.dx);
                            assert.equal(breaching.dy, offset.dy);
                            assert.ok(Math.abs(offset.dispersionFactor - offset.rimHighlight * 0.35) < 1e-12);
                            assert.ok(Math.abs(breaching.dispersionFactor - offset.rimHighlight * 0.85) < 1e-12);
                            samples++;
                        }
                    }
                }
            }
        }
        assert.ok(zeroSamples > 0 && nonzeroSamples > 0, 'Cover zero and nonzero optical samples');
        assert.equal(exports.get_integrated_time(), integratedTime, 'Optical reference calls do not advance physics');
        return { samples, maximumError };
    } finally {
        Object.assign(state, savedState);
    }
}
// КОНЕЦ ФУНКЦИИ verifyLensRefractionMagnitude

try {
    const { WasmPhysicsBridge, wasmPhysicsBridge } = await server.ssrLoadModule('/src/bridge/wasmBridge.ts');
    const { SceneBufferSoA } = await server.ssrLoadModule('/src/core/sceneBuffer.ts');
    const seed = 104729;
    const buffer = new SceneBufferSoA(1024, seed);
    let passed = 0;

    // НАЧАЛО ФУНКЦИИ step: shared input contract for TS and actual WASM.
    function step(provider, dt, count = 96) {
        return provider.stepSymplecticPhysics(buffer, count, dt, 0, 480, 270, 960, 540, 1.2);
    }
    // КОНЕЦ ФУНКЦИИ step

    // НАЧАЛО ФУНКЦИИ compare: finite trajectories and phase parity with explicit tolerances.
    function compare(ts, native, count = 96) {
        assert.ok(Math.abs(ts.getIntegratedSimSec() - native.getIntegratedSimSec()) < 1e-8);
        for (let i = 0; i < count; i++) {
            assert.ok(Math.abs(ts.getKuramotoPhase(i) - native.getKuramotoPhase(i)) < 2e-5, `phase ${i}`);
        }
        for (let i = 0; i < 64; i++) {
            const a = ts.getOrbitPosition(i);
            const b = native.getOrbitPosition(i);
            assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.002, `orbit ${i}`);
        }
    }
    // КОНЕЦ ФУНКЦИИ compare

    // НАЧАЛО РАЗДЕЛА 2. ПАРИТЕТ И ЖИЗНЕННЫЙ ЦИКЛ
    const ts = new WasmPhysicsBridge(seed);
    const native = new WasmPhysicsBridge(seed);
    ts.initKuramotoOscillators(seed, 96);
    native.initKuramotoOscillators(seed, 96);
    const exports = await instantiate();
    assert.equal(exports.get_abi_version(), 1);
    assert.ok(native.attachWasmExports(exports));
    const schedule = [0.016, 0.008, 0.033, 0.005, 0, 0.05];
    let lastTs;
    let lastNative;
    for (let frame = 0; frame < 600; frame++) {
        const dt = schedule[frame % schedule.length];
        lastTs = step(ts, dt);
        lastNative = step(native, dt);
        assert.equal(lastNative.isWasmNative, true, `native step ${frame} must execute`);
    }
    compare(ts, native);
    assert.ok(Math.abs(lastTs.energyDriftRatio - lastNative.energyDriftRatio) < 1e-7);
    console.log('[PASS] Actual WASM: 600 mixed-dt steps match TS phases, 64 orbits and energy'); passed++;

    exports.memory.grow(1);
    step(ts, 0.016, 32); step(native, 0.016, 32);
    compare(ts, native, 32);
    assert.equal(exports.get_active_count(), 32);
    console.log('[PASS] Memory growth and changed active count rebuild valid views without losing state'); passed++;

    ts.initKuramotoOscillators(7, 48); native.initKuramotoOscillators(7, 48);
    step(ts, 0.016, 48); assert.equal(step(native, 0.016, 48).isWasmNative, true);
    compare(ts, native, 48);
    assert.ok(Math.abs(native.getIntegratedSimSec() - 0.016) < 1e-8);
    const late = new WasmPhysicsBridge(seed);
    late.initKuramotoOscillators(7, 48);
    step(late, 0.016, 48);
    assert.ok(late.attachWasmExports(await instantiate()));
    step(ts, 0.008, 48); step(late, 0.008, 48);
    compare(ts, late, 48);
    console.log('[PASS] Seed/reset and late WASM adoption preserve the latest in-flight TS state'); passed++;

    assert.ok(native.attachWasmExports({ ...exports, step_verlet_nbody: () => { throw new Error('Injected provider failure'); } }));
    step(ts, 0.008, 48);
    assert.equal(step(native, 0.016, 48).isWasmNative, false);
    compare(ts, native, 48);
    assert.equal(native.isWasmActive(), false);
    const malformed = new WasmPhysicsBridge(seed);
    assert.equal(malformed.attachWasmExports({ ...exports, get_phases_ptr: () => 3 }), false);
    assert.equal(malformed.attachWasmExports({ ...exports, get_abi_version: () => 2 }), false);
    assert.equal(malformed.attachWasmExports({ ...exports, evaluate_lens_refraction: undefined }), false,
        'The required scalar optical export must exist');
    const rejected = new WasmPhysicsBridge(seed);
    assert.ok(rejected.attachWasmExports({ ...await instantiate(), step_verlet_nbody: () => 0 }));
    assert.equal(step(rejected, 0).isWasmNative, false, 'Nonthrowing rejection at dt=0 must not report ACTIVE');
    assert.equal(rejected.isWasmActive(), false);
    console.log('[PASS] Trap/rejected step resume TS; invalid ABI/pointers are rejected'); passed++;
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ПРОВАЙДЕР → ГЕОМЕТРИЯ → ГРАФ → SOA/DIGEST
    const { VoidPhaseSimulation } = await server.ssrLoadModule('/src/phases/01_void.ts');
    const { universeStore } = await server.ssrLoadModule('/src/store/universeState.ts');

    // НАЧАЛО ФУНКЦИИ sampleScene: consume provider phases before publishing visible geometry.
    async function sampleScene(changeNativePhase) {
        wasmPhysicsBridge.useTypescriptFallback();
        universeStore.setPhase('02_GENESIS');
        universeStore.updateTelemetry({ phaseElapsedSec: 18.7, simulationTimeSec: 35.7 });
        const simulation = new VoidPhaseSimulation(960, 540);
        if (changeNativePhase) {
            const sceneExports = await instantiate();
            assert.ok(wasmPhysicsBridge.attachWasmExports(sceneExports));
            const phases = new Float32Array(sceneExports.memory.buffer, sceneExports.get_phases_ptr(), 1024);
            for (let i = 0; i < phases.length; i++) phases[i] = (phases[i] + 1.5) % (Math.PI * 2);
        }
        simulation.update(0.016, '02_GENESIS', 1, 1, 35.716);
        const particles = simulation.getParticles();
        const soa = universeStore.getSceneBuffer();
        for (let i = 0; i < particles.length; i++) {
            assert.equal(soa.pos[i * 3], Math.fround(particles[i].x), `published x ${i}`);
            assert.equal(soa.pos[i * 3 + 1], Math.fround(particles[i].y), `published y ${i}`);
        }
        const edges = simulation.getEdges();
        assert.ok(edges.length > 0);
        for (const edge of edges) {
            // Graph endpoints use the shared 0.01px quantization contract.
            assert.ok(Math.abs(edge.x1 - particles[edge.fromIndex].x) <= 0.005001);
            assert.ok(Math.abs(edge.y1 - particles[edge.fromIndex].y) <= 0.005001);
            assert.ok(Math.abs(edge.x2 - particles[edge.toIndex].x) <= 0.005001);
            assert.ok(Math.abs(edge.y2 - particles[edge.toIndex].y) <= 0.005001);
        }
        return { x: particles.map((p) => p.x), digest: soa.getDigestHex(), native: wasmPhysicsBridge.isWasmActive() };
    }
    // КОНЕЦ ФУНКЦИИ sampleScene

    const original = await sampleScene(false);
    const changed = await sampleScene(true);
    assert.equal(changed.native, true);
    assert.ok(changed.x.some((x, i) => Math.abs(x - original.x[i]) > 1e-5));
    assert.notEqual(changed.digest, original.digest);
    console.log('[PASS] Real WASM phases change visible GENESIS geometry; graph and SoA use the same result'); passed++;
    wasmPhysicsBridge.useTypescriptFallback();
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ФИКСИРОВАННЫЙ СКАЛЯРНЫЙ ЭТАЛОН BREACH
    const { stressStore } = await server.ssrLoadModule('/src/store/stressState.ts');
    const optical = verifyLensRefractionMagnitude(await instantiate(), stressStore);
    console.log(`[PASS] Actual WASM BREACH magnitude: ${optical.samples} normalized samples, stress=0.25/time=0, max error ${optical.maximumError.toExponential(2)} px; Canvas vector optics remain TS`); passed++;
    // КОНЕЦ РАЗДЕЛА 4
    console.log(`WASM runtime verification: ${passed}/${passed} PASSED (${bytes.length} bytes, ABI v1, no imports)`);
} finally {
    await server.close();
}
