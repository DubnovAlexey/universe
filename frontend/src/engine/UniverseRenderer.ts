// ============================================================================
// ФАЙЛ: frontend/src/engine/UniverseRenderer.ts
// НАЗНАЧЕНИЕ: Состояние симуляции, диспетчер Canvas-проходов и единственный цикл RAF.
// РАЗДЕЛЫ: 1. Состояние и ввод; 2. Кадр; 3. Запуск, остановка и часы.
// ДИАГНОСТИКА: markRenderPass записывает 10 последовательных интервалов только при ?profile=1;
// один renderPasses переиспользуется, обычный просмотр не создаёт карту/дополнительные часы.
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
import { getVisualSignals, publishVisualSignals } from '../core/visualSignals';
import { prewarmGlyphPool } from '../core/glyphGrammar';
import { BackgroundFields } from './backgroundFields';
import { OuroborosEffect } from './ouroboros/OuroborosEffect';
import { FrameDiagnostics, type FrameWorkBreakdown } from '../core/frameDiagnostics';
import { sceneExplanationFocus } from '../core/sceneExplanationFocus';
import { renderExplanationFocusPass } from './passes/explanationFocusPass';
import { renderExplanationAssemblyPass } from './passes/explanationAssemblyPass';
import { LensDispersionPass } from './passes/lensDispersionPass';
import { prepareParticleGlowAtlas, disposeParticleGlowAtlas, getParticleGlowAtlasStats } from './rendering/particleGlowAtlas';
import {
    renderBreathingLightEchoRings, renderSpiralDustAndCanyons,
    renderCurvedFieldSignals, renderCorticalHemispheresAndKeplerRings,
} from './passes/cosmosPass';
import { renderTopologyEdgesAndPulses, renderMultiEchelonParticles } from './passes/nexusPass';
import { renderBreachLensAndSubQuantumZ4 } from './passes/breachPass';
import {
    renderSingularityCoronaAndBlackHole, renderZeroSilenceActC, renderCipherOdometerStage,
} from './passes/singularityPass';

/** Наибольший шаг физики за один вызов: прежний предел кадра, на котором держится устойчивость интеграторов. */
const PHYSICS_MAX_STEP_SEC = 0.05;
/** ?clock=story: подшагов на кадр не больше четырёх (до 0,2 с физики), сюжет — до 0,25 с за кадр. */
const PHYSICS_MAX_SUBSTEPS = 4;
const STORY_MAX_DT_SEC = 0.25;
const RENDER_PASS_LABELS = ['base', 'dust-signals', 'phase-backdrop', 'breach', 'topology',
    'lens-particles', 'focus', 'odometer', 'ouroboros', 'explanation-assembly'] as const;
type RenderPassLabel = typeof RENDER_PASS_LABELS[number];

export class UniverseRenderer {
    // НАЧАЛО РАЗДЕЛА 1. СОСТОЯНИЕ, ИНИЦИАЛИЗАЦИЯ И ВВОД
    private readonly pipeline: RenderPipeline;
    private readonly simulation: VoidPhaseSimulation;
    private readonly ouroboros: OuroborosEffect;
    private readonly frameDiagnostics: FrameDiagnostics;
    /** Только числовые поля: диагностика копирует карту при сохранении пика, не в каждом проходе. */
    private readonly renderPasses: Record<RenderPassLabel, number> | null;
    private renderPassMarkMs = 0;
    private readonly lensDispersion = new LensDispersionPass();
    private lastGlowDiagnosticsMs = -Infinity;

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
    /**
     * ?clock=story (ADR-002, BUG-09): часы сюжета идут по реальному времени (до STORY_MAX_DT_SEC за кадр),
     * а физика делит такой кадр на равные подшаги не длиннее прежних 50 мс. Без флага при FPS < 20 шаг
     * обрезался до 50 мс и 108 секунд сюжета растягивались (на 10–12 FPS — до ≈190 с).
     */
    private readonly storyClock = typeof window !== 'undefined' &&
        new URLSearchParams(window.location?.search ?? '').get('clock') === 'story';

    // --- НАЧАЛО ФУНКЦИИ constructor (UniverseRenderer) ---
    constructor(private readonly canvas: HTMLCanvasElement) {
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
        this.renderPasses = this.frameDiagnostics.enabled ? {
            base: 0, 'dust-signals': 0, 'phase-backdrop': 0, breach: 0, topology: 0,
            'lens-particles': 0, focus: 0, odometer: 0, ouroboros: 0, 'explanation-assembly': 0,
        } : null;
        // Один bounded-атлас создаётся до первого RAF и переживает смену фаз/циклов.
        const context = this.pipeline.getContext();
        prepareParticleGlowAtlas(context);
        resourceLedger.registerPageDisposable(() => {
            disposeParticleGlowAtlas(context);
            sceneExplanationFocus.reset();
        });
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

    // НАЧАЛО ФУНКЦИИ needsViewportResize
    /** Позволяет пропустить повторный window resize ещё до остановки hover-барабанов. */
    public needsViewportResize(): boolean { return this.pipeline.needsViewportResize(); }
    // КОНЕЦ ФУНКЦИИ needsViewportResize

    // --- НАЧАЛО ФУНКЦИИ handleResize ---
    /**
     * Пересчитывает размеры холста и масштабирует координаты симуляции при изменении окна.
     */
    public handleResize = (): void => {
        const { width, height, changed } = this.pipeline.updateViewportSize();
        if (!changed) return;
        const logicalResize = width !== this.width || height !== this.height;
        this.width = width;
        this.height = height;
        // Новый backing DPR не меняет координаты сцены и предыдущую позицию интерполяции.
        if (logicalResize) {
            this.simulation.resize(width, height);
            stressStore.syncViewportSize(width, height);
        }
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

    // НАЧАЛО ФУНКЦИИ markRenderPass
    /** Граница последовательного участка; без профиля не читает часы и не выделяет объект. */
    private markRenderPass(label: RenderPassLabel): void {
        if (!this.renderPasses) return;
        const nowMs = performance.now();
        this.renderPasses[label] += Math.max(0, nowMs - this.renderPassMarkMs);
        this.renderPassMarkMs = nowMs;
    }
    // КОНЕЦ ФУНКЦИИ markRenderPass

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
        this.markRenderPass('base');

        // Эпизод очищает GPU-слой при входе в Точку Нуля даже до раннего return.
        if (phase === '05_SINGULARITY' && act === 'ACT_C_ZERO_SILENCE') {
            this.ouroboros.render(ctx, state, getVisualSignals(), w, h, this.pipeline.getCapabilities().dpr);
            this.markRenderPass('ouroboros');
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
            this.markRenderPass('dust-signals');

            renderZeroSilenceActC(ctx, cx, cy, minSide, simTimeSec);
            ctx.restore();
            integrationRegistry.recordModuleStep(
                'canvas2d-render',
                performance.now() - renderStartMs
            );
            this.markRenderPass('phase-backdrop');
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
        this.markRenderPass('dust-signals');

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
        this.markRenderPass('phase-backdrop');

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
        this.markRenderPass('breach');

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
        this.markRenderPass('topology');

        // 9. Отрисовка частиц, сом нейронов и боке переднего плана по эшелонам глубины Z0..Z3
        this.lensDispersion.render(ctx, particles, simTimeSec, state);
        renderMultiEchelonParticles(
            ctx,
            particles,
            simTimeSec,
            phase,
            state.layers.layer5_truthXRayMode,
            audioSnap
        );
        this.markRenderPass('lens-particles');

        // Акцент использует только существующие координаты и не раскрывает скрытый граф.
        renderExplanationFocusPass(ctx, particles, edges, getVisualSignals(), sceneExplanationFocus.getSnapshot(),
            state.layers.layer3_topologyGraph || state.layers.layer5_truthXRayMode);

        ctx.restore();
        this.markRenderPass('focus');

        // 10. Квантовый одометр на холсте (разлёт символов из Точки Нуля в Акте D)
        if (isOdometerStage) {
            renderCipherOdometerStage(ctx, w, h, state);
        }
        this.markRenderPass('odometer');

        this.ouroboros.render(ctx, state, getVisualSignals(), w, h, this.pipeline.getCapabilities().dpr, particles);

        ctx.restore();
        integrationRegistry.recordModuleStep(
            'canvas2d-render',
            performance.now() - renderStartMs
        );
        // Здесь также учитывается существующий короткий bookkeeping реестра после рисования.
        this.markRenderPass('ouroboros');
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
        if (this.renderPasses) {
            for (const label of RENDER_PASS_LABELS) this.renderPasses[label] = 0;
        }
        const profileWork: FrameWorkBreakdown | undefined = this.frameDiagnostics.enabled
            ? { setupMs: 0, simulationMs: 0, uiMs: 0, renderMs: 0, renderPasses: this.renderPasses! } : undefined;
        let profileMarkMs = profileStartMs;

        try {
            const rawDtMs = Math.max(1.0, nowMs - this.lastFrameTimeMs);
            this.lastFrameTimeMs = nowMs;
            const clampedDtSec = Math.min(this.storyClock ? STORY_MAX_DT_SEC : PHYSICS_MAX_STEP_SEC, rawDtMs / 1000.0);

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
                // Без флага кадр всегда даёт один шаг (simDtSec ≤ 50 мс). С ?clock=story длинный кадр медленного
                // устройства делится на равные подшаги ≤ 50 мс; дальше 4 подшагов «проскальзывает» физика, а не сюжет.
                const substeps = this.storyClock
                    ? Math.min(PHYSICS_MAX_SUBSTEPS, Math.ceil(simDtSec / PHYSICS_MAX_STEP_SEC - 1e-9)) : 1;
                const stepSec = this.storyClock ? Math.min(PHYSICS_MAX_STEP_SEC, simDtSec / substeps) : simDtSec;
                // Фон течёт по «зрительным часам»: шум не перескакивает на restart 5→1.
                const visualOffsetSec = Number.isFinite(state.visualClockOffsetSec) ? state.visualClockOffsetSec : 0;
                for (let substep = 1; substep <= substeps; substep++) {
                    const substepSimSec = substep === substeps ? nextSimSec : state.telemetry.simulationTimeSec + stepSec * substep;
                    stressStore.stepPhysics(stepSec);
                    this.backgroundFields.step(stepSec, substepSimSec + visualOffsetSec, state.seed);
                    this.simulation.update(
                        stepSec,
                        state.currentPhase,
                        1.0,
                        state.gravityMultiplier,
                        substepSimSec
                    );
                }
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

            let glyphWarmupMs = 0;
            try {
                const visualTimings = publishVisualSignals(universeStore.getState(), audioSnap, stressStore.getState(), !!profileWork, () => {
                    const signals = getVisualSignals();
                    const renderState = universeStore.getState();
                    // Скрытые мобильные каскады не прогревают шрифты: готовим словарь по одному
                    // readback в кадр в ранних актах 05, до первого появления Canvas/DOM-одометра.
                    if (!signals.isPaused && !signals.reducedMotion && signals.phase === '05_SINGULARITY' &&
                        (renderState.singularityAct === 'ACT_A_ACCRETION' || renderState.singularityAct === 'ACT_B_LOGIC')) {
                        const warmupStartMs = profileWork ? performance.now() : 0;
                        prewarmGlyphPool(signals.phase);
                        if (profileWork) glyphWarmupMs = performance.now() - warmupStartMs;
                    }
                    sceneExplanationFocus.advance(signals);
                    const renderStartMs = profileWork ? performance.now() : 0;
                    if (profileWork) this.renderPassMarkMs = renderStartMs;
                    try {
                        this.renderFrame(nextSimSec, universeStore.getState(), audioSnap);
                        // Пыль окна — в том же Canvas; DOM применяется после всех текстовых измерений.
                        renderExplanationAssemblyPass(this.pipeline.getContext(), this.getSimParticles(), nowMs);
                        this.markRenderPass('explanation-assembly');
                    } finally {
                        if (profileWork) profileWork.renderMs = performance.now() - renderStartMs;
                    }
                });
                if (profileWork) {
                    if (visualTimings && glyphWarmupMs > 0) visualTimings['glyph-font-warmup'] = glyphWarmupMs;
                    profileWork.visualSignals = visualTimings;
                }
            } finally {
                // UI включает store, расчёты и конечную запись DOM; Canvas учитывается отдельно.
                if (profileWork) profileWork.uiMs = Math.max(0, performance.now() - profileMarkMs - (profileWork.renderMs ?? 0));
            }
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
                if (nowMs - this.lastGlowDiagnosticsMs >= 500) {
                    this.lastGlowDiagnosticsMs = nowMs;
                    this.canvas.dataset.glowProfile = JSON.stringify(getParticleGlowAtlasStats(this.pipeline.getContext()));
                }
            }
            if (this.isRunning) {
                this.rafId = requestAnimationFrame(this.loop);
            }
        }
    };
    // --- КОНЕЦ ФУНКЦИИ loop ---
    // КОНЕЦ РАЗДЕЛА 3. ЖИЗНЕННЫЙ ЦИКЛ И ЧАСЫ
}
