// ============================================================================
// ФАЙЛ: frontend/src/engine/UniverseRenderer.ts
// НАЗНАЧЕНИЕ: Состояние симуляции, диспетчер Canvas-проходов и единственный цикл RAF.
// РАЗДЕЛЫ: 1. Состояние и ввод; 2. Кадр; 3. Запуск, остановка и часы.
// ============================================================================

import {
    smootherstep, universeStore, type PhaseId, type SingularityAct, type UniverseState,
} from '../store/universeState';
import { stressStore } from '../store/stressState';
import { RenderPipeline } from './pipeline';
import {
    VoidPhaseSimulation, type QuantumParticle, type SynapticPulse, type TopologyEdge,
} from '../phases/01_void';
import { cipherOdometerEngine } from '../bridge/cipherOdometerEngine';
import { audioSync, type AudioModulationSnapshot } from '../utils/audioSync';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { publishVisualSignals } from '../core/visualSignals';
import { BackgroundFields } from './backgroundFields';
import { OuroborosEffect } from './ouroboros/OuroborosEffect';
import { getVisualSignals } from '../core/visualSignals';
import { FrameDiagnostics, type FrameWorkBreakdown } from '../core/frameDiagnostics';
import {
    renderBreathingLightEchoRings, renderSpiralDustAndCanyons,
    renderCurvedFieldSignals, renderCorticalHemispheresAndKeplerRings,
} from './passes/cosmosPass';
import { renderTopologyEdgesAndPulses, renderMultiEchelonParticles } from './passes/nexusPass';
import { renderBreachLensAndSubQuantumZ4 } from './passes/breachPass';
import {
    renderSingularityCoronaAndBlackHole, renderZeroSilenceActC, renderCipherOdometerStage,
} from './passes/singularityPass';

export class UniverseRenderer {
    // НАЧАЛО РАЗДЕЛА 1. СОСТОЯНИЕ, ИНИЦИАЛИЗАЦИЯ И ВВОД
    private readonly pipeline: RenderPipeline;
    private readonly simulation: VoidPhaseSimulation;
    private readonly ouroboros: OuroborosEffect;
    private readonly frameDiagnostics: FrameDiagnostics;

    private width = 1920;
    private height = 1080;

    private readonly backgroundFields = new BackgroundFields();

    private rafId = 0;
    private isRunning = false;
    private lastFrameTimeMs = 0;
    private lastTrackedPhase: PhaseId = '01_VOID';
    private lastTrackedAct: SingularityAct = 'INACTIVE';
    private lastSeed = 0;
    private lastCycleCount = 1;
    private consecutiveFrameErrors = 0;

    // --- НАЧАЛО ФУНКЦИИ constructor (UniverseRenderer) ---
    constructor(canvas: HTMLCanvasElement) {
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.width = caps.viewportWidth;
        this.height = caps.viewportHeight;
        stressStore.syncViewportSize(this.width, this.height);

        this.simulation = new VoidPhaseSimulation(this.width, this.height);

        const initialState = universeStore.getState();
        this.lastSeed = initialState.seed;
        this.lastCycleCount = initialState.cycleCount;
        this.lastTrackedPhase = initialState.currentPhase;
        this.lastTrackedAct = initialState.singularityAct;

        this.initProceduralBackgroundFields(initialState.seed);
        this.ouroboros = new OuroborosEffect(canvas);
        this.frameDiagnostics = new FrameDiagnostics(canvas);
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (UniverseRenderer) ---

    // --- НАЧАЛО ФУНКЦИИ initProceduralBackgroundFields ---
    /** Сбрасывает фоновые поля в прежней точке жизненного цикла рендерера. */
    public initProceduralBackgroundFields(seed: number): void {
        this.backgroundFields.reset(seed);
    }
    // --- КОНЕЦ ФУНКЦИИ initProceduralBackgroundFields ---

    // --- НАЧАЛО ФУНКЦИИ getSimParticles ---
    /**
     * Возвращает массив активных квантовых частиц из фазового ядра VoidPhaseSimulation.
     */
    private getSimParticles(): ReadonlyArray<QuantumParticle> {
        const sim = this.simulation as unknown as {
            getParticles?: () => ReadonlyArray<QuantumParticle>;
            particles?: ReadonlyArray<QuantumParticle>;
        };
        return sim.getParticles ? sim.getParticles() : (sim.particles ?? []);
    }
    // --- КОНЕЦ ФУНКЦИИ getSimParticles ---

    // --- НАЧАЛО ФУНКЦИИ getSimEdges ---
    /**
     * Возвращает массив криволинейных рёбер графа NEXUS из фазового ядра.
     */
    private getSimEdges(): ReadonlyArray<TopologyEdge> {
        const sim = this.simulation as unknown as {
            getEdges?: () => ReadonlyArray<TopologyEdge>;
            edges?: ReadonlyArray<TopologyEdge>;
        };
        return sim.getEdges ? sim.getEdges() : (sim.edges ?? []);
    }
    // --- КОНЕЦ ФУНКЦИИ getSimEdges ---

    // --- НАЧАЛО ФУНКЦИИ getSimPulses ---
    /**
     * Возвращает массив активных комет синаптических импульсов из фазового ядра.
     */
    private getSimPulses(): ReadonlyArray<SynapticPulse> {
        const sim = this.simulation as unknown as {
            getPulses?: () => ReadonlyArray<SynapticPulse>;
            pulses?: ReadonlyArray<SynapticPulse>;
        };
        return sim.getPulses ? sim.getPulses() : (sim.pulses ?? []);
    }
    // --- КОНЕЦ ФУНКЦИИ getSimPulses ---

    // --- НАЧАЛО ФУНКЦИИ handleResize ---
    /**
     * Пересчитывает размеры холста и масштабирует координаты симуляции при изменении окна.
     */
    public handleResize = (): void => {
        const { width, height } = this.pipeline.updateViewportSize();
        this.width = width;
        this.height = height;
        this.simulation.resize(width, height);
        stressStore.syncViewportSize(width, height);
    };
    // --- КОНЕЦ ФУНКЦИИ handleResize ---

    // --- НАЧАЛО ФУНКЦИИ setPointerState ---
    /**
     * Передаёт координаты курсора/касания в контроллер упругой линзы stressStore
     * и в движок квантового одометра cipherOdometerEngine.
     */
    public setPointerState(
        clientX: number,
        clientY: number,
        isDown?: boolean,
        isInside = true
    ): void {
        cipherOdometerEngine.notifyPointerHover(clientX, clientY);

        if (!isInside) {
            stressStore.clearPointer();
            return;
        }

        stressStore.updatePointer(clientX, clientY, this.width, this.height);
        if (typeof isDown === 'boolean') {
            stressStore.setBreaching(isDown, true);
            if (isDown) {
                audioSync.triggerShockwavePulse(
                    0.65,
                    clientX / Math.max(1, this.width),
                    clientY / Math.max(1, this.height)
                );
            }
        }
    }
    // --- КОНЕЦ ФУНКЦИИ setPointerState ---

    // КОНЕЦ РАЗДЕЛА 1. СОСТОЯНИЕ, ИНИЦИАЛИЗАЦИЯ И ВВОД

    // НАЧАЛО РАЗДЕЛА 2. ПОРЯДОК ОТРИСОВКИ КАДРА

    // --- НАЧАЛО ФУНКЦИИ renderFrame ---
    /**
     * Выполняет полную послойную отрисовку текущего кадра симуляции:
     * вакуум и дизеринг -> пылевые облака M31 -> полевые сигналы -> кольца RS Puppis ->
     * полушария NEXUS -> Чёрная дыра и корона NGC 6543 -> мембрана BREACH LENS ->
     * граф и кометы импульсов -> частицы Z0..Z3 -> квантовый одометр финала.
     */
    private renderFrame(
        simTimeSec: number,
        state: Readonly<UniverseState>,
        audioSnap: AudioModulationSnapshot
    ): void {
        const renderStartMs = performance.now();
        const ctx = this.pipeline.getContext();
        const w = this.width;
        const h = this.height;
        const minSide = Math.min(w, h);

        const cx = w * 0.5 + state.camera.driftX;
        const cy = h * 0.5 + state.camera.driftY;
        const zoom = state.camera.zoom;

        ctx.save();

        // 1. Базовый обсидиановый вакуум (#020308) и полуночный индиго (#060B19)
        ctx.fillStyle = '#020308';
        ctx.fillRect(0, 0, w, h);

        const vacuumGrad = ctx.createRadialGradient(
            cx,
            cy,
            minSide * 0.03,
            cx,
            cy,
            minSide * 0.92 * zoom
        );
        vacuumGrad.addColorStop(0.0, 'rgba(18, 24, 58, 0.52)');
        vacuumGrad.addColorStop(0.45, 'rgba(6, 11, 25, 0.34)');
        vacuumGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        ctx.fillStyle = vacuumGrad;
        ctx.fillRect(0, 0, w, h);

        // Наложение Blue-Noise дизеринга против ступенчатости тёмных градиентов
        const dither = this.pipeline.getDitherPattern();
        if (dither) {
            ctx.fillStyle = dither;
            ctx.fillRect(0, 0, w, h);
        }

        const phase = state.currentPhase;
        const act = state.singularityAct;

        // Эпизод очищает GPU-слой при входе в Точку Нуля даже до раннего return.
        if (phase === '05_SINGULARITY' && act === 'ACT_C_ZERO_SILENCE') {
            this.ouroboros.render(ctx, state, getVisualSignals(), w, h, this.pipeline.getCapabilities().dpr);
        }

        // Короткий 0.45-секундный импульс максимального сжатия в Точке Нуля (Акт C)
        // непосредственно перед вылетом из неё визитки DUBNOV ALEXEY
        if (phase === '05_SINGULARITY' && act === 'ACT_C_ZERO_SILENCE') {
            ctx.save();
            ctx.globalAlpha = 0.36;
            renderSpiralDustAndCanyons(
                ctx,
                cx,
                cy,
                minSide * zoom,
                simTimeSec,
                phase,
                audioSnap,
                this.backgroundFields.clouds
            );
            renderCurvedFieldSignals(ctx, cx, cy, w, h, simTimeSec, this.backgroundFields.signals);
            ctx.restore();

            renderZeroSilenceActC(ctx, cx, cy, minSide, simTimeSec);
            ctx.restore();
            integrationRegistry.recordModuleStep(
                'canvas2d-render',
                performance.now() - renderStartMs
            );
            return;
        }

        const isOdometerStage =
            phase === '05_SINGULARITY' &&
            (act === 'ACT_D_GITHUB_CARD' || act === 'RESTART_COLLAPSE');
        const sceneVisibility = isOdometerStage
            ? Math.max(0.32, 1.0 - state.githubCardAssemblyProgress * 0.58)
            : 1.0;

        const particles = this.getSimParticles();
        const edges = this.getSimEdges();
        const pulses = this.getSimPulses();

        ctx.save();
        ctx.globalAlpha = sceneVisibility;

        // 2. Спиралевидные газопылевые облака и тёмные каньоны поглощения M31 / NGC 3169
        renderSpiralDustAndCanyons(
            ctx,
            cx,
            cy,
            minSide * zoom,
            simTimeSec,
            phase,
            audioSnap,
            this.backgroundFields.clouds
        );

        // 3. Редкие криволинейные сигналы с шумовым поворотом направления
        renderCurvedFieldSignals(ctx, cx, cy, w, h, simTimeSec, this.backgroundFields.signals);

        // 4. Нестабильные дышащие кольца светового эха RS Puppis (Фаза 01_VOID и переход в 02_GENESIS)
        if (phase === '01_VOID' || phase === '02_GENESIS') {
            const voidWeight =
                phase === '01_VOID'
                    ? 1.0
                    : Math.max(
                        0.0,
                        1.0 - smootherstep(0.0, 0.55, state.telemetry.phaseProgress)
                    );
            if (voidWeight > 0.01) {
                renderBreathingLightEchoRings(
                    ctx,
                    cx,
                    cy,
                    minSide * zoom,
                    simTimeSec,
                    voidWeight,
                    particles,
                    audioSnap
                );
            }
        }

        // 5. Кеплеровский каркас из 5 колец и ореол полушарий мозга (Фазы 03_EVOLUTION и 04_COLLAPSE)
        if (phase === '03_EVOLUTION' || phase === '04_COLLAPSE') {
            renderCorticalHemispheresAndKeplerRings(
                ctx,
                cx,
                cy,
                w * zoom,
                h * zoom,
                simTimeSec,
                phase,
                state.telemetry.phaseProgress
            );
        }

        // 6. Многооболочечная корона «Кошачьего глаза» NGC 6543 и Чёрная дыра (Фаза 05_SINGULARITY)
        if (phase === '05_SINGULARITY') {
            renderSingularityCoronaAndBlackHole(
                ctx,
                cx,
                cy,
                minSide * zoom,
                simTimeSec,
                act,
                state.singularityActProgress,
                audioSnap
            );
        }

        // 7. Органическая мембрана BREACH LENS и глубинный эшелон Z4 («обратная сторона Вселенной»)
        renderBreachLensAndSubQuantumZ4(
            ctx,
            cx,
            cy,
            w,
            h,
            simTimeSec,
            state,
            particles,
            audioSnap,
            this.backgroundFields.nodes
        );

        // 8. Отрисовка 3 классов кривых Безье графа NEXUS и комет синаптических импульсов
        if (state.layers.layer3_topologyGraph || state.layers.layer5_truthXRayMode) {
            renderTopologyEdgesAndPulses(
                ctx,
                edges,
                pulses,
                phase,
                state.telemetry.phaseProgress,
                state.layers.layer5_truthXRayMode,
                audioSnap
            );
        }

        // 9. Отрисовка частиц, сом нейронов и боке переднего плана по эшелонам глубины Z0..Z3
        renderMultiEchelonParticles(
            ctx,
            particles,
            simTimeSec,
            phase,
            state.layers.layer5_truthXRayMode,
            audioSnap
        );

        ctx.restore();

        // 10. Квантовый одометр на холсте (разлёт символов из Точки Нуля в Акте D)
        if (isOdometerStage) {
            renderCipherOdometerStage(ctx, w, h, state);
        }

        this.ouroboros.render(ctx, state, getVisualSignals(), w, h, this.pipeline.getCapabilities().dpr, particles);

        ctx.restore();
        integrationRegistry.recordModuleStep(
            'canvas2d-render',
            performance.now() - renderStartMs
        );
    }
    // --- КОНЕЦ ФУНКЦИИ renderFrame ---

    // КОНЕЦ РАЗДЕЛА 2. ПОРЯДОК ОТРИСОВКИ КАДРА

    // НАЧАЛО РАЗДЕЛА 3. ЖИЗНЕННЫЙ ЦИКЛ И ЧАСЫ

    // НАЧАЛО ФУНКЦИИ resetFrameTimingContinuity
    /** Скрытая вкладка не оставляет ложный длинный интервал в диагностике активного кадра. */
    public resetFrameTimingContinuity(): void { this.frameDiagnostics.resetContinuity(); }
    // КОНЕЦ ФУНКЦИИ resetFrameTimingContinuity

    // --- НАЧАЛО ФУНКЦИИ start ---
    /**
     * Запускает главный цикл requestAnimationFrame рендерера.
     */
    public start(): void {
        if (this.isRunning) return;
        this.resetFrameTimingContinuity();
        this.isRunning = true;
        this.lastFrameTimeMs = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
    }
    // --- КОНЕЦ ФУНКЦИИ start ---

    // --- НАЧАЛО ФУНКЦИИ stop ---
    /**
     * Останавливает главный цикл requestAnimationFrame рендерера.
     */
    public stop(): void {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ stop ---

    // --- НАЧАЛО ФУНКЦИИ loop ---
    /**
     * Главный цикл кадра requestAnimationFrame.
     * Обёрнут в защитный блок try / catch / finally, гарантирующий, что даже при
     * возникновении нештатного исключения планировщик requestAnimationFrame продолжит
     * работу и сцена никогда не зависнет на мёртвом кадре.
     */
    private loop = (nowMs: number): void => {
        if (!this.isRunning) return;
        const profileStartMs = this.frameDiagnostics.enabled ? performance.now() : 0;
        const profileGapMs = Math.max(0, nowMs - this.lastFrameTimeMs);
        const profileWork: FrameWorkBreakdown | undefined = this.frameDiagnostics.enabled
            ? { setupMs: 0, simulationMs: 0, uiMs: 0, renderMs: 0 } : undefined;
        let profileMarkMs = profileStartMs;

        try {
            const rawDtMs = Math.max(1.0, nowMs - this.lastFrameTimeMs);
            this.lastFrameTimeMs = nowMs;
            const clampedDtSec = Math.min(0.05, rawDtMs / 1000.0);

            const state = universeStore.getState();

            if (state.seed !== this.lastSeed) {
                this.lastSeed = state.seed;
                this.initProceduralBackgroundFields(state.seed);
            }

            if (state.cycleCount !== this.lastCycleCount) {
                this.lastCycleCount = state.cycleCount;
                resourceLedger.disposeCycleResources();
            }

            if (
                state.currentPhase !== this.lastTrackedPhase ||
                state.singularityAct !== this.lastTrackedAct
            ) {
                this.lastTrackedPhase = state.currentPhase;
                this.lastTrackedAct = state.singularityAct;
                audioSync.transitionToPhase(state.currentPhase, state.singularityAct);
                stressStore.setTargetStress(state.phaseMeta.baseEntropy);
            }

            const isActiveSim = !state.isPaused && !state.isTabHidden;
            const simDtSec = isActiveSim ? clampedDtSec * state.timeScale : 0.0;
            // Часы сохраняют дробный шаг: округление каждого кадра даёт дрейф на 120/144 Гц.
            const nextSimSec = state.telemetry.simulationTimeSec + simDtSec;
            const nextPhaseElapsed = state.telemetry.phaseElapsedSec + simDtSec;

            // Музыка звучит непрерывно на протяжении всего цикла без принудительного глушения
            const audioSnap = audioSync.updateRealtimeModulation(
                nextSimSec,
                state.currentPhase,
                false
            );
            if (profileWork) {
                const endMs = performance.now();
                profileWork.setupMs = endMs - profileMarkMs;
                profileMarkMs = endMs;
            }

            if (isActiveSim && simDtSec > 0) {
                stressStore.stepPhysics(simDtSec);
                this.backgroundFields.step(simDtSec, nextSimSec, state.seed);
                this.simulation.update(
                    simDtSec,
                    state.currentPhase,
                    1.0,
                    state.gravityMultiplier,
                    nextSimSec
                );
            }

            if (profileWork) {
                const endMs = performance.now();
                profileWork.simulationMs = endMs - profileMarkMs;
                profileMarkMs = endMs;
            }
            const latestState = universeStore.getState();
            const particles = this.getSimParticles();
            const edges = this.getSimEdges();
            const pulses = this.getSimPulses();
            this.pipeline.syncQualityProfile();
            const caps = this.pipeline.getCapabilities();

            // Сначала продвигаем часы фазы и подакта сингулярности,
            // чтобы renderFrame всегда рисовал актуальный подакт текущего кадра
            if (isActiveSim && latestState.singularityAct === 'RESTART_COLLAPSE') {
                universeStore.updateTelemetry({
                    frameTimeMs: Number(rawDtMs.toFixed(1)),
                    simulationTimeSec: nextSimSec,
                    phaseElapsedSec: nextPhaseElapsed,
                    audioStatus: audioSnap.status,
                    silenceRmsDb: audioSnap.rmsDb,
                });
            } else if (isActiveSim) {
                universeStore.updateTelemetry({
                    frameTimeMs: Number(rawDtMs.toFixed(1)),
                    activeParticles: particles.length,
                    activeConnections: edges.length,
                    activePulses: pulses.length,
                    simulationTimeSec: nextSimSec,
                    phaseElapsedSec: nextPhaseElapsed,
                    engineBackend: caps.activeBackend,
                    wasmStatus: latestState.telemetry.wasmStatus,
                    pythonBackendStatus:
                        integrationRegistry.getModule('server-ws')?.status === 'ready'
                            ? 'WS_CONNECTED'
                            : integrationRegistry.getModule('pyodide-graph')?.status === 'ready'
                                ? 'PYODIDE_LOCAL'
                                : 'CLIENT_ONLY',
                    audioStatus: audioSnap.status,
                    silenceRmsDb: audioSnap.rmsDb,
                });
            }

            const visualTimings = publishVisualSignals(universeStore.getState(), audioSnap, stressStore.getState(), !!profileWork);
            if (profileWork) profileWork.visualSignals = visualTimings;
            if (profileWork) {
                const endMs = performance.now();
                profileWork.uiMs = endMs - profileMarkMs;
                profileMarkMs = endMs;
            }
            this.renderFrame(nextSimSec, universeStore.getState(), audioSnap);
            if (profileWork) profileWork.renderMs = performance.now() - profileMarkMs;
            this.consecutiveFrameErrors = 0;
        } catch (err: unknown) {
            this.consecutiveFrameErrors++;
            if (this.consecutiveFrameErrors <= 3) {
                const msg =
                    err instanceof Error ? err.message : 'Неизвестное исключение кадра';
                const storeWithReport = universeStore as unknown as {
                    reportRendererError?: (m: string) => void;
                    addTerminalLog: (m: string, tag?: string) => void;
                };
                if (storeWithReport.reportRendererError) {
                    storeWithReport.reportRendererError(msg);
                } else {
                    storeWithReport.addTerminalLog(msg, 'renderer:error');
                }
            }
        } finally {
            if (this.frameDiagnostics.enabled) {
                this.frameDiagnostics.record(profileGapMs, performance.now() - profileStartMs,
                    universeStore.getState(), nowMs, profileWork);
            }
            if (this.isRunning) {
                this.rafId = requestAnimationFrame(this.loop);
            }
        }
    };
    // --- КОНЕЦ ФУНКЦИИ loop ---
    // КОНЕЦ РАЗДЕЛА 3. ЖИЗНЕННЫЙ ЦИКЛ И ЧАСЫ
}
