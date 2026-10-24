// ============================================================================
// ФАЙЛ: frontend/scripts/verify-wasm-runtime.mjs
// НАЗНАЧЕНИЕ: Проверить реальный Rust/WASM ABI и его связь с видимой сценой.
// РАЗДЕЛЫ: 1. Артефакт и SSR; 2. Паритет/жизненный цикл; 3. Геометрия сцены.
// ФУНКЦИИ: instantiate — отдельный экземпляр WASM; step — общий сценарий шага;
// compare — сравнение провайдеров; sampleScene — сквозная публикация геометрии.
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
    console.log(`WASM runtime verification: ${passed}/${passed} PASSED (${bytes.length} bytes, ABI v1, no imports)`);
} finally {
    await server.close();
}
