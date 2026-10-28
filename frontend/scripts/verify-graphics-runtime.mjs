// ============================================================================
// ФАЙЛ: frontend/scripts/verify-graphics-runtime.mjs
// НАЗНАЧЕНИЕ: Проверить lifecycle настоящего GPU-рендерера через управляемый WebGPU mock.
// РАЗДЕЛЫ: 1. Окружение; 2. WebGPU-контракт; 3. Готовность и ошибки; 4. Async disposal;
//          5. Изменяемое поле, повтор отправки и освобождение Canvas-атласа.
// ФУНКЦИИ: deferred, drain, makeFrame, makeGpu, assertReleased, verify.
// Проверка компиляции WGSL и изображения на настоящем GPU выполняется в браузере.
// ============================================================================
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// НАЧАЛО РАЗДЕЛА 1. ОКРУЖЕНИЕ И УПРАВЛЯЕМЫЕ PROMISE
const frontendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const globals = ['navigator', 'GPUBufferUsage', 'GPUTextureUsage', 'GPUShaderStage', 'GPUMapMode'];
const originalGlobals = new Map(globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
const renderers = new Set();
let server;
let checks = 0;

// НАЧАЛО ФУНКЦИИ deferred
function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}
// КОНЕЦ ФУНКЦИИ deferred
// НАЧАЛО ФУНКЦИИ drain
async function drain() { for (let step = 0; step < 32; step++) await Promise.resolve(); }
// КОНЕЦ ФУНКЦИИ drain
// НАЧАЛО ФУНКЦИИ makeFrame
function makeFrame() {
    return { points: new Float32Array([0.2, 0, 0, 0, 0, -1, 4, 2]), count: 1,
        uniforms: { width: 200, height: 120, dpr: 3, timeSec: 0, opacity: 1,
            morph: 0.5, energy: 0.7, centerX: 100, centerY: 60, scale: 45 } };
}
// КОНЕЦ ФУНКЦИИ makeFrame
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. УПРАВЛЯЕМЫЙ WEBGPU-КОНТРАКТ
// НАЧАЛО ФУНКЦИИ makeGpu
function makeGpu(options = {}) {
    const lost = deferred();
    const calls = { submits: 0, maps: 0, deviceRequests: 0, deviceDestroys: 0,
        configurations: [], pipelines: [], pointWrites: [], draws: [] };
    const resources = [];
    const handlers = new Set();
    const resource = (kind, descriptor) => {
        const item = { kind, descriptor, destroyed: false, destroyCalls: 0,
            destroy() { this.destroyed = true; this.destroyCalls++; },
            createView() { assert.equal(this.destroyed, false); return { texture: this }; } };
        resources.push(item);
        return item;
    };
    const device = {
        limits: { maxTextureDimension2D: 8192 }, lost: lost.promise,
        addEventListener(type, callback) { assert.equal(type, 'uncapturederror'); handlers.add(callback); },
        removeEventListener(_type, callback) { handlers.delete(callback); },
        destroy() { calls.deviceDestroys++; lost.resolve({ reason: 'destroyed', message: '' }); },
        pushErrorScope(type) { assert.equal(type, 'validation'); },
        async popErrorScope() { return options.failure === 'validation' ? { message: 'Injected validation error' } : null; },
        createShaderModule() {
            return { async getCompilationInfo() { return { messages: options.failure === 'shader'
                ? [{ type: 'error', lineNum: 4, linePos: 2, message: 'Injected shader error' }] : [] }; } };
        },
        createBuffer(descriptor) {
            const item = resource('buffer', descriptor);
            const bytes = new Uint8Array(descriptor.size);
            Object.assign(item, { mapState: 'unmapped', async mapAsync() {
                calls.maps++; this.mapState = 'pending';
                if (options.readbackGate) await options.readbackGate.promise;
                if (options.failure === 'map') throw new Error('Injected readback rejection');
                this.mapState = 'mapped';
                if (options.failure !== 'empty') bytes.set([30, 80, 110, 220], 16 * 256 + 16 * 4);
            }, getMappedRange() { return bytes.buffer; }, unmap() { this.mapState = 'unmapped'; } });
            return item;
        },
        createTexture(descriptor) { return resource('texture', descriptor); },
        createBindGroupLayout() { return {}; }, createPipelineLayout() { return {}; }, createBindGroup() { return {}; },
        async createRenderPipelineAsync(descriptor) {
            calls.pipelines.push(descriptor);
            if (options.failure === 'pipeline') throw new Error('Injected pipeline rejection');
            return options.pipelineGate ? await options.pipelineGate.promise : {};
        },
        createCommandEncoder() {
            return { beginRenderPass() { return { setBindGroup() {}, setVertexBuffer() {}, setPipeline() {},
                draw(vertices, instances) { calls.draws.push([vertices, instances]); }, end() {} }; },
            copyTextureToBuffer() {}, finish() { return {}; } };
        },
        queue: {
            writeBuffer(buffer, _offset, data, dataOffset = 0, size) {
                if (buffer.descriptor.label === 'ouroboros-points') {
                    calls.pointWrites.push(Array.from(new Float32Array(data, dataOffset, size / 4)));
                }
            },
            submit() { calls.submits++; },
            async onSubmittedWorkDone() {
                if (options.queueGate) await options.queueGate.promise;
                if (options.failure === 'queue') throw new Error('Injected queue rejection');
            },
        },
    };
    const adapter = { async requestDevice() {
        calls.deviceRequests++;
        if (options.failure === 'device') throw new Error('Injected device rejection');
        return options.deviceGate ? await options.deviceGate.promise : device;
    } };
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { gpu: {
        async requestAdapter() {
            if (options.failure === 'adapter') throw new Error('Injected adapter rejection');
            return options.adapterGate ? await options.adapterGate.promise : adapter;
        }, getPreferredCanvasFormat: () => 'bgra8unorm',
    } } });
    const context = { configure(configuration) {
        if (options.failure === 'resize') throw new Error('Injected resize rejection');
        calls.configurations.push(configuration);
    }, unconfigure() {}, getCurrentTexture: () => ({ createView: () => ({}) }) };
    return { adapter, device, lost, calls, resources, handlers,
        canvas: { width: 0, height: 0, style: {}, getContext: () => context } };
}
// КОНЕЦ ФУНКЦИИ makeGpu
// НАЧАЛО ФУНКЦИИ assertReleased
function assertReleased(gpu) {
    assert.equal(gpu.calls.deviceDestroys, 1, 'The owned device is destroyed once');
    assert.equal(gpu.handlers.size, 0, 'Uncaptured-error listener is removed');
    assert(gpu.resources.every((item) => item.destroyed && item.destroyCalls === 1), 'Every allocated buffer/texture is destroyed once');
}
// КОНЕЦ ФУНКЦИИ assertReleased
// НАЧАЛО ФУНКЦИИ verify
async function verify(label, run) { await run(); checks++; console.log(`[PASS] ${label}`); }
// КОНЕЦ ФУНКЦИИ verify
// КОНЕЦ РАЗДЕЛА 2

try {
    for (const [name, value] of Object.entries({
        GPUBufferUsage: { VERTEX: 1, UNIFORM: 2, COPY_DST: 4, COPY_SRC: 8, MAP_READ: 16 },
        GPUTextureUsage: { RENDER_ATTACHMENT: 1, COPY_SRC: 2 }, GPUShaderStage: { VERTEX: 1, FRAGMENT: 2 }, GPUMapMode: { READ: 1 },
    })) Object.defineProperty(globalThis, name, { configurable: true, value });
    server = await createServer({ root: frontendDirectory, logLevel: 'error', server: { middlewareMode: true, hmr: false } });
    const { OuroborosGpuRenderer } = await server.ssrLoadModule('/src/engine/ouroboros/gpuRenderer.ts');
    const fixture = (options) => {
        const gpu = makeGpu(options), failures = [];
        const renderer = new OuroborosGpuRenderer(gpu.canvas, (message) => failures.push(message));
        renderers.add(renderer);
        return { gpu, renderer, failures };
    };

    // НАЧАЛО РАЗДЕЛА 3. ГОТОВНОСТЬ, РАЗМЕРЫ И ОШИБКИ
    await verify('READY waits for readback and queue completion; init retains its input and uses the packed premultiplied contract', async () => {
        const readbackGate = deferred(), queueGate = deferred();
        const { gpu, renderer, failures } = fixture({ readbackGate, queueGate });
        const frame = makeFrame(), initialX = frame.points[0];
        const ready = renderer.init(frame);
        assert.equal(renderer.init(frame), ready);
        frame.points[0] = 99;
        await drain();
        assert.equal(gpu.calls.submits, 1); assert.equal(gpu.calls.maps, 1);
        assert.equal(renderer.getStats().initialized, false);
        readbackGate.resolve(); await drain();
        assert.equal(gpu.calls.submits, 2); assert.equal(renderer.getStats().initialized, false);
        queueGate.resolve(); assert.equal(await ready, true);
        assert.equal(renderer.getStats().submittedFrames, 1);
        assert.equal(gpu.calls.pointWrites.at(-1)[0], initialX);
        const core = gpu.calls.pipelines[0], glow = gpu.calls.pipelines[1];
        assert.equal(core.vertex.buffers[0].arrayStride, 32);
        assert.deepEqual(core.vertex.buffers[0].attributes.map((item) => item.offset), [0, 12, 24, 28]);
        assert.equal(core.depthStencil.depthWriteEnabled, true); assert.equal(glow.depthStencil.depthWriteEnabled, false);
        assert.equal(core.fragment.targets[0].blend.color.srcFactor, 'one');
        assert.equal(gpu.calls.configurations[0].alphaMode, 'premultiplied');
        assert(gpu.calls.draws.every(([vertices, count]) => vertices === 6 && count === 1));
        renderer.dispose(); renderer.dispose(); assertReleased(gpu); assert.equal(failures.length, 0);
    });

    await verify('Resize caps DPR, retains unchanged depth and destroys replaced depth; invalid frames fail once', async () => {
        const { gpu, renderer, failures } = fixture();
        const frame = makeFrame(); assert.equal(await renderer.init(frame), true);
        assert.equal(gpu.canvas.width, 300);
        const firstDepth = gpu.resources.find((item) => item.descriptor.label === 'ouroboros-depth');
        const allocations = gpu.resources.length;
        renderer.resize(frame.uniforms); assert.equal(gpu.resources.length, allocations);
        renderer.resize({ width: 240, height: 160, dpr: 4 });
        assert.equal(gpu.canvas.width, 360); assert.equal(firstDepth.destroyCalls, 1);
        assert.equal(renderer.render(frame), true);
        assert.equal(renderer.render({ ...frame, count: 3073 }), false);
        assert.equal(renderer.render(frame), false); assert.equal(renderer.getStats().validationErrors, 1);
        renderer.dispose(); renderer.dispose(); assertReleased(gpu); assert.equal(failures.length, 1);
    });

    for (const failure of ['shader', 'empty', 'validation', 'map', 'queue', 'pipeline', 'adapter', 'device', 'resize']) {
        await verify(`${failure} rejection produces one fallback and never READY`, async () => {
            const { gpu, renderer, failures } = fixture({ failure });
            assert.equal(await renderer.init(makeFrame()), false);
            assert.equal(renderer.getStats().initialized, false); assert.equal(renderer.getStats().validationErrors, 1);
            assert(renderer.getStats().lastError); assert.equal(failures.length, 1);
            renderer.dispose(); renderer.dispose();
            if (!['adapter', 'device'].includes(failure)) assertReleased(gpu);
        });
    }
    // КОНЕЦ РАЗДЕЛА 3

    // НАЧАЛО РАЗДЕЛА 4. ПОТЕРЯ УСТРОЙСТВА И ОПОЗДАВШИЕ РЕЗУЛЬТАТЫ
    await verify('Device loss and uncaptured errors disable rendering, release resources and report fallback once', async () => {
        for (const source of ['lost', 'uncaptured']) {
            const { gpu, renderer, failures } = fixture(); assert.equal(await renderer.init(makeFrame()), true);
            if (source === 'lost') gpu.lost.resolve({ reason: 'unknown', message: 'Injected device loss' });
            else [...gpu.handlers].forEach((handler) => handler({ error: { message: 'Injected uncaptured error' } }));
            await drain(); assert.equal(renderer.getStats().initialized, false); assert.equal(renderer.render(makeFrame()), false);
            assert.equal(failures.length, 1); renderer.dispose(); renderer.dispose(); assertReleased(gpu);
        }
    });
    for (const stage of ['adapter', 'device', 'pipeline']) {
        await verify(`Disposal during pending ${stage} ignores late results and leaves no owned GPU resources`, async () => {
            const gate = deferred(), { gpu, renderer, failures } = fixture({ [`${stage}Gate`]: gate });
            const ready = renderer.init(makeFrame()); await drain(); renderer.dispose(); renderer.dispose();
            gate.resolve(stage === 'adapter' ? gpu.adapter : stage === 'device' ? gpu.device : {});
            assert.equal(await ready, false); await drain();
            assert.equal(renderer.getStats().initialized, false); assert.equal(renderer.render(makeFrame()), false);
            assert.equal(gpu.calls.submits, 0); assert.equal(failures.length, 0);
            if (stage === 'adapter') assert.equal(gpu.calls.deviceRequests, 0);
            else assertReleased(gpu);
        });
    }
    // КОНЕЦ РАЗДЕЛА 4

    // НАЧАЛО РАЗДЕЛА 5. КЕШ КООРДИНАТОРА И CANVAS-АТЛАС
    await verify('Changed field submits A→B once, unchanged B is cached, failed C retries and the page atlas releases once', async () => {
        const { OuroborosEffect } = await server.ssrLoadModule('/src/engine/ouroboros/OuroborosEffect.ts');
        const { universeStore } = await server.ssrLoadModule('/src/store/universeState.ts');
        const { getVisualSignals } = await server.ssrLoadModule('/src/core/visualSignals.ts');
        const { resourceLedger } = await server.ssrLoadModule('/src/core/resourceLedger.ts');
        const { integrationRegistry } = await server.ssrLoadModule('/src/core/integrationRegistry.ts');
        const { wasmPhysicsBridge } = await server.ssrLoadModule('/src/bridge/wasmBridge.ts');
        const saved = [resourceLedger, integrationRegistry, wasmPhysicsBridge].map((target) =>
            ({ target, descriptors: Object.getOwnPropertyDescriptors(target) }));
        let effect;
        try {
            for (const { target } of saved) Object.defineProperties(target, Object.getOwnPropertyDescriptors(new target.constructor()));
            const document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({
                createRadialGradient: () => ({ addColorStop() {} }), fillRect() {},
            }) }) };
            const overlay = { style: {}, dataset: {}, ownerDocument: document };
            effect = new OuroborosEffect({ ownerDocument: { getElementById: () => overlay } });
            let submissions = 0, failNext = false;
            Object.assign(effect, { attemptedGpu: true, gpuReady: true, gpu: {
                resize() {}, dispose() {}, getStats: () => ({ initialized: true,
                    submittedFrames: submissions, validationErrors: 0, lastError: null }),
                render() { submissions++; const accepted = !failNext; failNext = false; return accepted; },
            } });
            const base = universeStore.getState();
            const state = { ...base, currentPhase: '05_SINGULARITY', singularityAct: 'ACT_D_GITHUB_CARD',
                finaleReachedOnce: true, finaleRiseElapsedSec: 2, cycleCount: 1, isPaused: true, reducedMotion: false,
                telemetry: { ...base.telemetry, simulationTimeSec: 100, phaseElapsedSec: 20.55 } };
            const signals = { ...getVisualSignals(), isPaused: true };
            const context = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, drawImage() {} };
            await verify('An invisible warm-up starts GPU initialization once before ACT_D and performs no field or Canvas drawing', async () => {
                const prewarm = new OuroborosEffect({ ownerDocument: { getElementById: () => overlay } });
                let initializations = 0;
                Object.assign(prewarm, { initializeGpu(frame) {
                    initializations++;
                    this.attemptedGpu = true;
                    assert.equal(frame.count, 1); assert.equal(frame.uniforms.opacity, 0);
                    assert(frame.points.every(Number.isFinite));
                } });
                const early = { ...state, singularityAct: 'ACT_A_ACCRETION', finaleReachedOnce: false,
                    finaleRiseElapsedSec: null, telemetry: { ...state.telemetry, phaseElapsedSec: 2 } };
                prewarm.render(context, early, signals, 1000, 800, 1);
                prewarm.render(context, early, signals, 1000, 800, 1);
                assert.equal(initializations, 1); assert.equal(overlay.style.visibility, 'hidden');
                assert.equal(prewarm.atlas, null);
                prewarm.dispose();
            });
            const observed = [];
            const draw = (x, y) => {
                effect.render(context, state, signals, 1000, 800, 1, [{ x, y, radius: 1 }]);
                observed.push(submissions);
            };
            draw(100, 200); draw(180, 240); draw(180, 240);
            failNext = true; draw(210, 260);
            const atlas = effect.atlas;
            assert.equal(resourceLedger.getCounters().textures, 3);
            draw(210, 260); draw(210, 260);
            assert.deepEqual(observed, [1, 2, 2, 3, 4, 4]);
            effect.dispose(); effect.dispose();
            resourceLedger.disposeAllPageResources();
            assert.equal(resourceLedger.getCounters().textures, 0);
            assert.equal(resourceLedger.getCounters().underflowCount, 0);
            assert(atlas.every((sprite) => sprite.width === 0 && sprite.height === 0));
            assert.equal(resourceLedger.disposeCycleResources().leakFree, true);

            await verify('Reduced motion freezes the form and center through rise-clock changes, while a paused resize submits exactly once', async () => {
                effect = new OuroborosEffect({ ownerDocument: { getElementById: () => overlay } });
                let submitted = 0;
                const sent = [];
                Object.assign(effect, { attemptedGpu: true, gpuReady: true, gpu: {
                    resize() {}, dispose() {}, getStats: () => ({ initialized: true,
                        submittedFrames: submitted, validationErrors: 0, lastError: null }),
                    render(frame) { submitted++; sent.push({ time: frame.uniforms.timeSec, centerY: frame.uniforms.centerY }); return true; },
                } });
                const stillState = { ...state, cycleCount: 2, reducedMotion: true };
                const stillSignals = { ...signals, reducedMotion: true };
                let firstPoints, firstCenter;
                // Нулевая граница ещё не видна; сравниваем только активные кадры формы.
                stillState.finaleRiseElapsedSec = 0;
                stillState.telemetry = { ...stillState.telemetry, phaseElapsedSec: 18.55 };
                effect.render(context, stillState, stillSignals, 1000, 800, 1, [{ x: 100, y: 200, radius: 1 }]);
                assert.equal(submitted, 0);
                for (const elapsed of [0.5, 6, 12]) {
                    stillState.finaleRiseElapsedSec = elapsed;
                    stillState.telemetry = { ...stillState.telemetry, phaseElapsedSec: 18.55 + elapsed };
                    effect.render(context, stillState, stillSignals, 1000, 800, 1, [{ x: 100, y: 200, radius: 1 }]);
                    const points = effect.frame.points.subarray(0, effect.frame.count * 8);
                    firstPoints ??= points.slice();
                    firstCenter ??= effect.frame.uniforms.centerY;
                    assert.equal(effect.frame.uniforms.timeSec, 0);
                    assert.equal(effect.frame.uniforms.centerY, firstCenter);
                    assert(points.every((value, index) => value === firstPoints[index]), 'Reduced motion retains every stationary position and normal');
                }
                assert.equal(submitted, 1);
                effect.render(context, stillState, stillSignals, 1100, 840, 1, [{ x: 100, y: 200, radius: 1 }]);
                effect.render(context, stillState, stillSignals, 1100, 840, 1, [{ x: 100, y: 200, radius: 1 }]);
                assert.equal(submitted, 2);
                assert(sent.every((frame) => frame.time === 0));
                assert.notEqual(sent[1].centerY, sent[0].centerY);
                effect.dispose(); resourceLedger.disposeAllPageResources();
                assert.equal(resourceLedger.getCounters().underflowCount, 0);
            });
        } finally {
            effect?.dispose();
            for (const { target, descriptors } of saved) {
                for (const key of Reflect.ownKeys(target)) if (!Object.hasOwn(descriptors, key)) Reflect.deleteProperty(target, key);
                Object.defineProperties(target, descriptors);
            }
        }
    });
    // КОНЕЦ РАЗДЕЛА 5
    console.log(`Graphics lifecycle: ${checks}/${checks} PASSED (mock WebGPU; browser validation remains separate)`);
} finally {
    try {
        for (const renderer of renderers) renderer.dispose();
    } finally {
        try {
            await drain();
            for (const [name, descriptor] of originalGlobals) {
                if (descriptor) Object.defineProperty(globalThis, name, descriptor);
                else Reflect.deleteProperty(globalThis, name);
            }
        } finally {
            await server?.close();
        }
    }
}
