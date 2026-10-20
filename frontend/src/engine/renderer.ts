// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Главный графический и физический конвейер рендеринга UNIVERSE v2.4
//             и клиентский оркестратор интерактивных слоёв (MASTER 00–05)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Процедурные шумовые поля и структуры фоновых явлений: симплекс-шум,
//    многооктавный FBM с искривлением координат (Domain Warping), спиральные
//    пылевые облака M31/NGC 3169, бездивергентные сигналы RK2 Curl-Noise
//    и суб-квантовая решётка глубокого эшелона Z4 («обратная сторона Вселенной»).
// 2. Главный класс UniverseRenderer: интеграция RenderPipeline (High-DPI +
//    Blue-Noise Dither), фазового ядра VoidPhaseSimulation (01_void..05_singularity),
//    контроллера упругой мембраны stressStore и реестра IntegrationRegistry.
// 3. Полевой и астрофизический рендеринг фаз 01–05:
//    - 01_VOID: нестабильные дышащие кольца светового эха цефеиды RS Puppis;
//    - 02_GENESIS: спиральные пылевые рукава и тёмные каньоны поглощения света;
//    - 03_EVOLUTION: 5 кеплеровских колец, полушария NEXUS, сплайны A/B/C и импульсы;
//    - 05_SINGULARITY: C2-рождение Чёрной дыры и короны NGC 6543 строго из Точки Нуля
//      и плавное тягучее спиральное схлопывание.
// 4. Органическая оптика мембраны BREACH LENS и эшелон глубины Z4:
//    C2-гладкое раскрытие рентгеновских геодезических ячеек без прямоугольных
//    артефактов, суб-нейронные токи Z4, микротрещины и бесконтурные выноски узлов.
// 5. Рендеринг барабанов квантового одометра (cipherOdometerEngine) в Акте D:
//    многослойная холодная палитра с глубокими тенями (без ржаво-рыжего оттенка),
//    хаотичная скорость центральной строки и C∞-дыхание визитки.
// 6. Интерактивный контроллер угловых панелей (CornerPanelsQuantumController)
//    и оркестратор DOM (bootstrapUniverseV2): при наведении курсора выбранный
//    элемент остаётся неподвижным, а соседние элементы в ряду перебираются
//    с холодными полутонами и тенями.
// ============================================================================

import '../styles/universe.css';

import {
    PHASE_ORDER,
    smootherstep,
    universeStore,
    type PhaseId,
    type SingularityAct,
    type UniverseState,
} from '../store/universeState';
import { stressStore } from '../store/stressState';
import { RenderPipeline } from './pipeline';
import {
    VoidPhaseSimulation,
    type QuantumParticle,
    type SynapticPulse,
    type TopologyEdge,
} from '../phases/01_void';
import { NexusGraphEngine } from '../bridge/simulationWorker';
import {
    cipherOdometerEngine,
    type OdometerGlyphCellState,
} from '../bridge/cipherOdometerEngine';
import { audioSync, type AudioModulationSnapshot } from '../utils/audioSync';
import { integrationRegistry } from '../core/integrationRegistry';
import { resourceLedger } from '../core/resourceLedger';
import { DeterministicPRNG } from '../core/prng';
import { mountLayer2Metrics } from '../layers/Layer2_Metrics';
import { mountLayer3Topology } from '../layers/Layer3_Topology';
import { mountLayer4Terminal } from '../layers/Layer4_Terminal';
import { mountLayer5CipherFinale } from '../layers/Layer5_CipherFinale';

// ============================================================================
// РАЗДЕЛ 1. ПРОЦЕДУРНЫЕ ШУМОВЫЕ ПОЛЯ И СТРУКТУРЫ ФОНОВЫХ ЯВЛЕНИЙ (M31 / Z4)
// ============================================================================

const TAU = Math.PI * 2;

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

/**
 * Детерминированный 2D-хеш и градиентный шум для расчёта деформации колец
 * светового эха RS Puppis, спиральных рукавов пыли M31 и контура BREACH LENS.
 */
function hash2D(ix: number, iy: number): number {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}

function valueNoise2D(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const ux = fx * fx * (3.0 - 2.0 * fx);
    const uy = fy * fy * (3.0 - 2.0 * fy);

    const n00 = hash2D(ix, iy);
    const n10 = hash2D(ix + 1, iy);
    const n01 = hash2D(ix, iy + 1);
    const n11 = hash2D(ix + 1, iy + 1);

    return lerp(lerp(n00, n10, ux), lerp(n01, n11, ux), uy) * 2.0 - 1.0;
}

function fbm2D(x: number, y: number, octaves = 4): number {
    let value = 0.0;
    let amp = 0.52;
    let freq = 1.0;
    for (let i = 0; i < octaves; i++) {
        value += amp * valueNoise2D(x * freq, y * freq);
        freq *= 2.03;
        amp *= 0.51;
    }
    return value;
}

/**
 * Спиралевидное газопылевое облако или тёмный каньон поглощения света
 * по астрофизическому прообразу галактик Андромеда (M31) и NGC 3169.
 */
interface SpiralDustCloud {
    arm: number;
    baseRadiusFrac: number;
    baseAngle: number;
    thicknessFrac: number;
    density: number;
    isAbsorptionCanyon: boolean;
    driftSpeed: number;
    colorHex: string;
}

/**
 * Криволинейный квантовый сигнал-импульс, редко пробегающий по полю от края до края
 * вдоль бездивергентных линий тока RK2 Curl-Noise (взамен прямых линий на фоне).
 */
interface CurvedFieldSignal {
    xNorm: number;
    yNorm: number;
    angle: number;
    speed: number;
    lengthFrac: number;
    alpha: number;
    life: number;
    maxLife: number;
    colorHex: string;
}

/**
 * Узел глубинного суб-квантового эшелона Z4 («обратная сторона Вселенной»),
 * проявляющегося под координатными клеточками внутри мембраны BREACH LENS.
 */
interface SubQuantumNodeZ4 {
    xNorm: number;
    yNorm: number;
    vxNorm: number;
    vyNorm: number;
    phase: number;
    neighbors: number[];
    ctrlBends: number[];
}

// ============================================================================
// РАЗДЕЛ 2. ГЛАВНЫЙ КЛАСС РЕНДЕРЕРА И ОРКЕСТРАТОРА СЦЕНЫ (UniverseRenderer)
// ============================================================================

export class UniverseRenderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly pipeline: RenderPipeline;
    private readonly simulation: VoidPhaseSimulation;

    private width = 1920;
    private height = 1080;

    private readonly spiralClouds: SpiralDustCloud[] = [];
    private readonly fieldSignals: CurvedFieldSignal[] = [];
    private readonly subQuantumZ4: SubQuantumNodeZ4[] = [];

    private rafId = 0;
    private isRunning = false;
    private lastFrameTimeMs = 0;
    private lastTrackedPhase: PhaseId = '01_VOID';
    private lastTrackedAct: SingularityAct = 'INACTIVE';
    private lastSeed = 0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.width = caps.viewportWidth;
        this.height = caps.viewportHeight;

        this.simulation = new VoidPhaseSimulation(this.width, this.height);

        const initialState = universeStore.getState();
        this.lastSeed = initialState.seed;
        this.lastTrackedPhase = initialState.currentPhase;
        this.lastTrackedAct = initialState.singularityAct;

        this.initProceduralBackgroundFields(initialState.seed);
    }

    /**
     * Инициализирует детерминированные спиральные облака пыли M31/NGC 3169,
     * редкие криволинейные квантовые сигналы и суб-квантовую сеть Z4.
     */
    public initProceduralBackgroundFields(seed: number): void {
        const rng = new DeterministicPRNG(seed ^ 0x4f1bbcdc);
        this.spiralClouds.length = 0;
        this.fieldSignals.length = 0;
        this.subQuantumZ4.length = 0;

        const spiralArms = 4;
        const pitchB = 0.31;
        const nebulaColors = ['#1e1b4b', '#6366f1', '#38bdf8', '#7dd3fc'];

        // 1. 48 спиралевидных пылевых облаков и тёмных каньонов поглощения M31 / NGC 3169
        for (let c = 0; c < 48; c++) {
            const arm = c % spiralArms;
            const u = (c + 0.5) / 48;
            const baseRadiusFrac = 0.09 + Math.pow(u, 0.86) * 0.42;
            const theta = (1.0 / pitchB) * Math.log(baseRadiusFrac / 0.08);
            const baseAngle =
                theta + (arm * TAU) / spiralArms + rng.nextRange(-0.24, 0.24);

            this.spiralClouds.push({
                arm,
                baseRadiusFrac,
                baseAngle,
                thicknessFrac: rng.nextRange(0.055, 0.135),
                density: rng.nextRange(0.14, 0.36),
                isAbsorptionCanyon: c % 3 === 0,
                driftSpeed: rng.nextRange(0.035, 0.085),
                colorHex: nebulaColors[c % nebulaColors.length],
            });
        }

        // 2. 8 редких криволинейных квантовых сигналов, пробегающих от края до края
        for (let s = 0; s < 8; s++) {
            this.fieldSignals.push(this.spawnCurvedFieldSignal(rng));
        }

        // 3. 136 узлов глубинного суб-квантового эшелона Z4 («обратная сторона Вселенной»)
        const z4Count = 136;
        for (let k = 0; k < z4Count; k++) {
            this.subQuantumZ4.push({
                xNorm: rng.nextRange(-0.62, 0.62),
                yNorm: rng.nextRange(-0.56, 0.56),
                vxNorm: rng.nextRange(-0.014, 0.014),
                vyNorm: rng.nextRange(-0.014, 0.014),
                phase: rng.nextRange(0, TAU),
                neighbors: [],
                ctrlBends: [],
            });
        }

        for (let i = 0; i < z4Count; i++) {
            const a = this.subQuantumZ4[i];
            const dists: Array<{ idx: number; d2: number }> = [];
            for (let j = 0; j < z4Count; j++) {
                if (i === j) continue;
                const b = this.subQuantumZ4[j];
                const dx = a.xNorm - b.xNorm;
                const dy = a.yNorm - b.yNorm;
                dists.push({ idx: j, d2: dx * dx + dy * dy });
            }
            dists.sort((m, n) => m.d2 - n.d2);
            const nearest = dists.slice(0, 3);
            a.neighbors = nearest.map((item) => item.idx);
            a.ctrlBends = nearest.map(() => rng.nextRange(-0.22, 0.22));
        }
    }

    private spawnCurvedFieldSignal(rng: DeterministicPRNG): CurvedFieldSignal {
        const side = rng.nextU32() % 4;
        let xNorm = 0;
        let yNorm = 0;
        let angle = 0;

        if (side === 0) {
            xNorm = -0.56;
            yNorm = rng.nextRange(-0.42, 0.42);
            angle = rng.nextRange(-0.35, 0.35);
        } else if (side === 1) {
            xNorm = 0.56;
            yNorm = rng.nextRange(-0.42, 0.42);
            angle = Math.PI + rng.nextRange(-0.35, 0.35);
        } else if (side === 2) {
            xNorm = rng.nextRange(-0.46, 0.46);
            yNorm = -0.54;
            angle = Math.PI * 0.5 + rng.nextRange(-0.35, 0.35);
        } else {
            xNorm = rng.nextRange(-0.46, 0.46);
            yNorm = 0.54;
            angle = -Math.PI * 0.5 + rng.nextRange(-0.35, 0.35);
        }

        const maxLife = rng.nextRange(4.8, 8.8);
        return {
            xNorm,
            yNorm,
            angle,
            speed: rng.nextRange(0.11, 0.21),
            lengthFrac: rng.nextRange(0.08, 0.16),
            alpha: rng.nextRange(0.18, 0.38),
            life: rng.nextRange(0, maxLife * 0.7),
            maxLife,
            colorHex: rng.nextFloat() > 0.25 ? '#7dd3fc' : '#f8fafc',
        };
    }

    private getSimParticles(): ReadonlyArray<QuantumParticle> {
        const sim = this.simulation as unknown as {
            getParticles?: () => ReadonlyArray<QuantumParticle>;
            particles?: ReadonlyArray<QuantumParticle>;
        };
        return sim.getParticles ? sim.getParticles() : (sim.particles ?? []);
    }

    private getSimEdges(): ReadonlyArray<TopologyEdge> {
        const sim = this.simulation as unknown as {
            getEdges?: () => ReadonlyArray<TopologyEdge>;
            edges?: ReadonlyArray<TopologyEdge>;
        };
        return sim.getEdges ? sim.getEdges() : (sim.edges ?? []);
    }

    private getSimPulses(): ReadonlyArray<SynapticPulse> {
        const sim = this.simulation as unknown as {
            getPulses?: () => ReadonlyArray<SynapticPulse>;
            pulses?: ReadonlyArray<SynapticPulse>;
        };
        return sim.getPulses ? sim.getPulses() : (sim.pulses ?? []);
    }

    public handleResize = (): void => {
        const { width, height } = this.pipeline.updateViewportSize();
        this.width = width;
        this.height = height;
        this.simulation.resize(width, height);
    };

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

    private stepBackgroundFields(dtSec: number, simTimeSec: number, seed: number): void {
        for (let i = 0; i < this.fieldSignals.length; i++) {
            const sig = this.fieldSignals[i];
            sig.life += dtSec;
            const curlTurn =
                valueNoise2D(sig.xNorm * 3.2, sig.yNorm * 3.2 + simTimeSec * 0.25) * 0.65;
            sig.angle += curlTurn * dtSec;
            sig.xNorm += Math.cos(sig.angle) * sig.speed * dtSec;
            sig.yNorm += Math.sin(sig.angle) * sig.speed * dtSec;

            if (
                sig.life >= sig.maxLife ||
                Math.abs(sig.xNorm) > 0.65 ||
                Math.abs(sig.yNorm) > 0.62
            ) {
                const rng = new DeterministicPRNG(
                    (seed + Math.floor(simTimeSec * 120) + i * 131) >>> 0
                );
                this.fieldSignals[i] = this.spawnCurvedFieldSignal(rng);
            }
        }

        for (let i = 0; i < this.subQuantumZ4.length; i++) {
            const zNode = this.subQuantumZ4[i];
            zNode.phase = (zNode.phase + dtSec * 1.85) % TAU;
            zNode.xNorm += zNode.vxNorm * dtSec;
            zNode.yNorm += zNode.vyNorm * dtSec;
            if (zNode.xNorm > 0.62) zNode.xNorm = -0.62;
            if (zNode.xNorm < -0.62) zNode.xNorm = 0.62;
            if (zNode.yNorm > 0.56) zNode.yNorm = -0.56;
            if (zNode.yNorm < -0.56) zNode.yNorm = 0.56;
        }
    }

    // ============================================================================
    // РАЗДЕЛ 3. ПОЛЕВОЙ И АСТРОФИЗИЧЕСКИЙ РЕНДЕРИНГ ФАЗ 01–05
    // ============================================================================

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

        // Специальный режим Акта C (ровно 2.5 секунды живой тишины: 93.0–95.5 с)
        if (phase === '05_SINGULARITY' && act === 'ACT_C_ZERO_SILENCE') {
            this.renderZeroSilenceActC(ctx, cx, cy, minSide, simTimeSec);
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
            ? Math.max(0.22, 1.0 - state.githubCardAssemblyProgress * 0.74)
            : 1.0;

        const particles = this.getSimParticles();
        const edges = this.getSimEdges();
        const pulses = this.getSimPulses();

        ctx.save();
        ctx.globalAlpha = sceneVisibility;

        // 2. Спиралевидные газопылевые облака и тёмные каньоны поглощения M31 / NGC 3169
        this.renderSpiralDustAndCanyons(
            ctx,
            cx,
            cy,
            minSide * zoom,
            simTimeSec,
            phase,
            audioSnap
        );

        // 3. Редкие криволинейные квантовые сигналы от края до края (RK2 Curl-Noise)
        this.renderCurvedFieldSignals(ctx, cx, cy, w, h, simTimeSec);

        // 4. Нестабильные дышащие кольца светового эха RS Puppis (Фаза 01_VOID и плавный переход в 02_GENESIS)
        if (phase === '01_VOID' || phase === '02_GENESIS') {
            const voidWeight =
                phase === '01_VOID'
                    ? 1.0
                    : Math.max(
                        0.0,
                        1.0 - smootherstep(0.0, 0.55, state.telemetry.phaseProgress)
                    );
            if (voidWeight > 0.01) {
                this.renderBreathingLightEchoRings(
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
            this.renderCorticalHemispheresAndKeplerRings(
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
            this.renderSingularityCoronaAndBlackHole(
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
        this.renderBreachLensAndSubQuantumZ4(
            ctx,
            cx,
            cy,
            w,
            h,
            simTimeSec,
            state,
            particles,
            audioSnap
        );

        // 8. Отрисовка 3 классов кривых Безье графа NEXUS и комет синаптических импульсов
        if (state.layers.layer3_topologyGraph || state.layers.layer5_truthXRayMode) {
            this.renderTopologyEdgesAndPulses(
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
        this.renderMultiEchelonParticles(
            ctx,
            particles,
            simTimeSec,
            phase,
            state.layers.layer5_truthXRayMode,
            audioSnap
        );

        ctx.restore();

        // 10. Квантовый одометр (cipherOdometerEngine) в Акте D (ACT_D_GITHUB_CARD / RESTART_COLLAPSE)
        if (isOdometerStage) {
            this.renderCipherOdometerStage(ctx, w, h, state);
        }

        ctx.restore();
        integrationRegistry.recordModuleStep(
            'canvas2d-render',
            performance.now() - renderStartMs
        );
    }

    /**
     * Отрисовывает нестабильные, живо дышащие концентрические кольца светового эха RS Puppis.
     */
    private renderBreathingLightEchoRings(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        simTimeSec: number,
        masterAlpha: number,
        particles: ReadonlyArray<QuantumParticle>,
        audioSnap: AudioModulationSnapshot
    ): void {
        const ringCount = 7;
        const totalSegs = 120;
        const arcChunks = 24;
        const segsPerChunk = totalSegs / arcChunks;

        ctx.save();

        for (let k = 0; k < ringCount; k++) {
            const chirpFactor = Math.pow(1.0 - k / (ringCount + 1.5), 1.65);
            const cycleProgress = (simTimeSec * 0.135 + chirpFactor) % 1.0;
            const baseRadiusPx = (0.045 + Math.pow(cycleProgress, 0.86) * 0.48) * scale;

            const envelopeFade =
                Math.sin(cycleProgress * Math.PI) *
                Math.exp(-cycleProgress * 1.08) *
                masterAlpha;
            if (envelopeFade < 0.02) continue;

            for (let c = 0; c < arcChunks; c++) {
                const sStart = c * segsPerChunk;
                const sEnd = (c + 1) * segsPerChunk;
                const midTheta = (((sStart + sEnd) * 0.5) / totalSegs) * TAU;

                const crestMod =
                    0.52 +
                    0.48 *
                    Math.sin(
                        midTheta * 3.0 -
                        simTimeSec * 1.3 +
                        k * 1.7 +
                        fbm2D(
                            Math.cos(midTheta) * 1.6,
                            Math.sin(midTheta) * 1.6 + simTimeSec * 0.28,
                            3
                        ) *
                        2.1
                    );
                const arcAlpha = envelopeFade * (0.07 + 0.62 * Math.pow(crestMod, 1.6));
                if (arcAlpha < 0.015) continue;

                ctx.beginPath();
                for (let s = sStart; s <= sEnd; s++) {
                    const theta = (s / totalSegs) * TAU;
                    const cosT = Math.cos(theta);
                    const sinT = Math.sin(theta);

                    const harmonicWave =
                        0.034 * Math.sin(2.0 * theta + simTimeSec * 1.15 + k) +
                        0.025 * Math.cos(3.0 * theta - simTimeSec * 1.55 + k * 2.1) +
                        0.018 * Math.sin(5.0 * theta + simTimeSec * 0.92 - k * 1.3);

                    const fbmWave =
                        0.058 *
                        fbm2D(
                            cosT * 1.85 + k * 0.7,
                            sinT * 1.85 + simTimeSec * 0.34,
                            3
                        );

                    let localRadPx = baseRadiusPx * (1.0 + harmonicWave + fbmWave);
                    const probeX = cx + cosT * localRadPx * 1.15;
                    const probeY = cy + sinT * localRadPx * 0.84;

                    if (particles.length > 0) {
                        const stride = Math.max(1, Math.floor(particles.length / 28));
                        let nodePullPx = 0;
                        for (
                            let pIdx = (k * 5) % stride;
                            pIdx < particles.length;
                            pIdx += stride
                        ) {
                            const pt = particles[pIdx];
                            const dx = probeX - pt.x;
                            const dy = probeY - pt.y;
                            const d2 = dx * dx + dy * dy;
                            if (d2 < 9500) {
                                nodePullPx += (16.0 * pt.energy) / (1.0 + d2 / 1800.0);
                            }
                        }
                        localRadPx += Math.min(24.0, nodePullPx);
                    }

                    const px = cx + cosT * localRadPx * 1.15;
                    const py = cy + sinT * localRadPx * 0.84;

                    if (s === sStart) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }

                ctx.strokeStyle =
                    crestMod > 0.78
                        ? RenderPipeline.hexToRgba('#f8fafc', arcAlpha * 0.88)
                        : crestMod > 0.42
                            ? RenderPipeline.hexToRgba('#7dd3fc', arcAlpha)
                            : RenderPipeline.hexToRgba('#6366f1', arcAlpha * 0.75);
                ctx.lineWidth = 0.75 + 1.45 * crestMod * (1.0 + 0.25 * audioSnap.pulse);
                ctx.stroke();
            }
        }

        // Жемчужно-голубая Точка Нуля (ядро цефеиды RS Кормы) с анаморфным штрихом
        const corePulse = 1.0 + 0.14 * Math.sin(simTimeSec * 2.1) + 0.2 * audioSnap.pulse;
        const coreRadius = scale * 0.085 * corePulse;
        const coreGrad = ctx.createRadialGradient(cx, cy, 1.0, cx, cy, coreRadius);
        coreGrad.addColorStop(0.0, RenderPipeline.hexToRgba('#f8fafc', 0.96 * masterAlpha));
        coreGrad.addColorStop(0.32, RenderPipeline.hexToRgba('#7dd3fc', 0.64 * masterAlpha));
        coreGrad.addColorStop(0.65, RenderPipeline.hexToRgba('#6366f1', 0.24 * masterAlpha));
        coreGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, coreRadius, 0, TAU);
        ctx.fill();

        const flareW = scale * 0.24 * corePulse;
        const flareGrad = ctx.createLinearGradient(cx - flareW, cy, cx + flareW, cy);
        flareGrad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
        flareGrad.addColorStop(0.5, RenderPipeline.hexToRgba('#f8fafc', 0.42 * masterAlpha));
        flareGrad.addColorStop(1.0, 'rgba(125, 211, 252, 0.0)');
        ctx.strokeStyle = flareGrad;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(cx - flareW, cy);
        ctx.lineTo(cx + flareW, cy);
        ctx.stroke();

        ctx.restore();
    }

    /**
     * Отрисовывает многослойные спиралевидные газопылевые облака, тёмные каньоны поглощения
     * света (#020308) и контровой свет Rim Light (#7DD3FC) по прообразу M31 и NGC 3169.
     */
    private renderSpiralDustAndCanyons(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        simTimeSec: number,
        phase: PhaseId,
        audioSnap: AudioModulationSnapshot
    ): void {
        const phaseIntensity =
            phase === '02_GENESIS'
                ? 1.0
                : phase === '03_EVOLUTION'
                    ? 0.62
                    : phase === '04_COLLAPSE'
                        ? 0.54
                        : phase === '01_VOID'
                            ? 0.34
                            : 0.42;

        ctx.save();
        for (let i = 0; i < this.spiralClouds.length; i++) {
            const cloud = this.spiralClouds[i];
            const angle = cloud.baseAngle - simTimeSec * cloud.driftSpeed;
            const rPx = cloud.baseRadiusFrac * scale;

            const domainWarp = fbm2D(
                Math.cos(angle) * 1.5,
                Math.sin(angle) * 1.5 + simTimeSec * 0.1,
                3
            );
            const warpedAngle = angle + domainWarp * 0.26;

            const cloudX = cx + Math.cos(warpedAngle) * rPx * 1.24;
            const cloudY = cy + Math.sin(warpedAngle) * rPx * 0.82;
            const radiusPx =
                cloud.thicknessFrac * scale * (1.15 + 0.22 * Math.sin(simTimeSec * 0.9 + i));

            const grad = ctx.createRadialGradient(
                cloudX,
                cloudY,
                radiusPx * 0.08,
                cloudX,
                cloudY,
                radiusPx
            );

            if (cloud.isAbsorptionCanyon) {
                const alpha = clamp(cloud.density * phaseIntensity * 0.88, 0.05, 0.34);
                grad.addColorStop(0.0, RenderPipeline.hexToRgba('#020308', alpha));
                grad.addColorStop(0.62, RenderPipeline.hexToRgba('#060b19', alpha * 0.55));
                grad.addColorStop(0.84, RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.12));
                grad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
            } else {
                const alpha = clamp(
                    cloud.density * phaseIntensity * (0.48 + 0.26 * audioSnap.low),
                    0.025,
                    0.18
                );
                grad.addColorStop(0.0, RenderPipeline.hexToRgba(cloud.colorHex, alpha));
                grad.addColorStop(0.55, RenderPipeline.hexToRgba('#1e1b4b', alpha * 0.55));
                grad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
            }

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.ellipse(
                cloudX,
                cloudY,
                radiusPx * 1.58,
                radiusPx * 0.72,
                warpedAngle + Math.PI * 0.44,
                0,
                TAU
            );
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * Отрисовывает редкие криволинейные квантовые сигналы, пробегающие по полю от края до края.
     */
    private renderCurvedFieldSignals(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        w: number,
        h: number,
        simTimeSec: number
    ): void {
        ctx.save();
        const minSide = Math.min(w, h);

        for (let i = 0; i < this.fieldSignals.length; i++) {
            const sig = this.fieldSignals[i];
            const lifeRatio = sig.life / Math.max(0.1, sig.maxLife);
            const env = Math.sin(lifeRatio * Math.PI);
            const alpha = sig.alpha * env;
            if (alpha < 0.02) continue;

            const headX = cx + sig.xNorm * w;
            const headY = cy + sig.yNorm * h;
            const tailLen = sig.lengthFrac * minSide;

            const bendAngle = sig.angle - 0.34 * Math.sin(simTimeSec * 1.6 + i * 1.3);
            const ctrlX = headX - Math.cos(bendAngle) * tailLen * 0.54;
            const ctrlY = headY - Math.sin(bendAngle) * tailLen * 0.54;
            const tailX = headX - Math.cos(sig.angle - 0.18) * tailLen;
            const tailY = headY - Math.sin(sig.angle - 0.18) * tailLen;

            const grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
            grad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
            grad.addColorStop(0.65, RenderPipeline.hexToRgba('#38bdf8', alpha * 0.5));
            grad.addColorStop(1.0, RenderPipeline.hexToRgba(sig.colorHex, alpha));

            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.05;
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.quadraticCurveTo(ctrlX, ctrlY, headX, headY);
            ctx.stroke();
        }
        ctx.restore();
    }

    /**
     * Отрисовывает 5 встречных кеплеровских колец (решение D-3) и скульптурную подсветку
     * двух когнитивных полушарий Мозга в фазах 03_EVOLUTION и 04_COLLAPSE.
     */
    private renderCorticalHemispheresAndKeplerRings(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scaledW: number,
        scaledH: number,
        simTimeSec: number,
        phase: PhaseId,
        phaseProgress: number
    ): void {
        ctx.save();
        const keplerRatios = [0.22, 0.36, 0.52, 0.7, 0.88];
        const stress = stressStore.getState().globalStress;

        for (let rIdx = 0; rIdx < keplerRatios.length; rIdx++) {
            const ratio = keplerRatios[rIdx];
            const dir = rIdx % 2 === 0 ? 1 : -1;
            const tilt = phase === '04_COLLAPSE' ? (rIdx - 2) * 0.16 : (rIdx - 2) * 0.06;
            const rx = scaledW * 0.42 * ratio;
            const ry = scaledH * 0.35 * ratio;

            ctx.beginPath();
            const segs = 84;
            for (let s = 0; s <= segs; s++) {
                const a = (s / segs) * TAU + simTimeSec * 0.15 * dir;
                const tensionWave =
                    phase === '04_COLLAPSE'
                        ? 1.0 +
                        0.065 *
                        Math.sin(a * 3.0 - simTimeSec * 2.8 + rIdx) *
                        (0.5 + stress)
                        : 1.0 + 0.02 * Math.sin(a * 4.0 + simTimeSec * 1.1);
                const lx = Math.cos(a) * rx * tensionWave;
                const ly = Math.sin(a) * ry * tensionWave;
                const px = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
                const py = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            const ringAlpha = 0.06 + (rIdx === 2 ? 0.05 : 0.025);
            ctx.strokeStyle =
                rIdx % 2 === 0
                    ? RenderPipeline.hexToRgba('#7dd3fc', ringAlpha)
                    : RenderPipeline.hexToRgba('#6366f1', ringAlpha);
            ctx.lineWidth = 0.75;
            ctx.stroke();
        }

        for (let hSign = -1; hSign <= 1; hSign += 2) {
            const lobeX = cx + hSign * scaledW * 0.185;
            const lobeR = Math.min(scaledW, scaledH) * 0.34;
            const lobeGrad = ctx.createRadialGradient(lobeX, cy, lobeR * 0.08, lobeX, cy, lobeR);
            const pulse =
                0.09 + 0.03 * Math.sin(simTimeSec * 1.8 + hSign + phaseProgress * Math.PI);
            lobeGrad.addColorStop(0.0, RenderPipeline.hexToRgba('#6366f1', pulse));
            lobeGrad.addColorStop(0.55, RenderPipeline.hexToRgba('#1e1b4b', pulse * 0.6));
            lobeGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
            ctx.fillStyle = lobeGrad;
            ctx.beginPath();
            ctx.arc(lobeX, cy, lobeR, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Отрисовывает 3 класса кривых Безье графа NEXUS (AXON_TRUNK, BRIDGE, DENDRITE)
     * с сужением по биофизическому закону Мюррея и движущиеся по длине дуги (lengthLUT)
     * кометы синаптических импульсов.
     */
    private renderTopologyEdgesAndPulses(
        ctx: CanvasRenderingContext2D,
        edges: ReadonlyArray<TopologyEdge>,
        pulses: ReadonlyArray<SynapticPulse>,
        phase: PhaseId,
        phaseProgress: number,
        fullXRayMode: boolean,
        audioSnap: AudioModulationSnapshot
    ): void {
        const baseGraphWeight = fullXRayMode
            ? 0.92
            : phase === '03_EVOLUTION' || phase === '04_COLLAPSE'
                ? 0.85
                : phase === '02_GENESIS'
                    ? 0.25 + phaseProgress * 0.45
                    : phase === '01_VOID'
                        ? 0.16
                        : 0.48;

        ctx.save();

        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            const revealBoost = Math.max(baseGraphWeight, e.truthVisibility * 0.95);
            const alpha = clamp(
                (e.edgeClass === 'AXON_TRUNK'
                    ? 0.34
                    : e.edgeClass === 'BRIDGE'
                        ? 0.21
                        : 0.13) *
                e.strength *
                revealBoost +
                e.afterglow * 0.45,
                0.0,
                0.92
            );
            if (alpha < 0.015) continue;

            let colorHex = '#38bdf8';
            if (e.afterglow > 0.82) {
                colorHex = '#f8fafc';
            } else if (e.edgeClass === 'AXON_TRUNK') {
                colorHex = e.afterglow > 0.25 ? '#f8fafc' : '#7dd3fc';
            } else if (e.edgeClass === 'BRIDGE') {
                colorHex = '#38bdf8';
            } else {
                colorHex = '#6366f1';
            }

            ctx.strokeStyle = RenderPipeline.hexToRgba(colorHex, alpha);
            ctx.lineWidth =
                e.murrayRadiusPx *
                (0.75 + 0.25 * revealBoost) *
                (1.0 + e.afterglow * 0.35);

            ctx.beginPath();
            ctx.moveTo(e.x1, e.y1);
            ctx.quadraticCurveTo(e.ctrlX, e.ctrlY, e.x2, e.y2);
            ctx.stroke();
        }

        for (let i = 0; i < pulses.length; i++) {
            const pulse = pulses[i];
            const headPos = NexusGraphEngine.sampleBezierByArcLength(
                pulse.x1,
                pulse.y1,
                pulse.ctrlX,
                pulse.ctrlY,
                pulse.x2,
                pulse.y2,
                pulse.lengthLUT,
                pulse.progress
            );
            const tailFrac = Math.max(0, pulse.progress - pulse.tailLength);
            const tailPos = NexusGraphEngine.sampleBezierByArcLength(
                pulse.x1,
                pulse.y1,
                pulse.ctrlX,
                pulse.ctrlY,
                pulse.x2,
                pulse.y2,
                pulse.lengthLUT,
                tailFrac
            );

            const isCascadePeak = pulse.cascadeDepth >= 2 || i % 7 === 0;
            const headColor = '#f8fafc';
            const midColor = isCascadePeak ? '#bae6fd' : '#7dd3fc';

            const tailGrad = ctx.createLinearGradient(
                tailPos.x,
                tailPos.y,
                headPos.x,
                headPos.y
            );
            tailGrad.addColorStop(0.0, 'rgba(125, 211, 252, 0.0)');
            tailGrad.addColorStop(
                0.6,
                RenderPipeline.hexToRgba(midColor, pulse.intensity * 0.55 * baseGraphWeight)
            );
            tailGrad.addColorStop(
                1.0,
                RenderPipeline.hexToRgba(headColor, pulse.intensity * 0.95 * baseGraphWeight)
            );

            ctx.strokeStyle = tailGrad;
            ctx.lineWidth = pulse.edgeClass === 'AXON_TRUNK' ? 2.1 : 1.45;
            ctx.beginPath();
            ctx.moveTo(tailPos.x, tailPos.y);
            ctx.lineTo(headPos.x, headPos.y);
            ctx.stroke();

            const rGlow = (2.4 + 1.4 * audioSnap.pulse) * pulse.intensity;
            const headGlow = ctx.createRadialGradient(
                headPos.x,
                headPos.y,
                0.4,
                headPos.x,
                headPos.y,
                rGlow * 2.8
            );
            headGlow.addColorStop(
                0.0,
                RenderPipeline.hexToRgba(headColor, 0.92 * baseGraphWeight)
            );
            headGlow.addColorStop(
                0.5,
                RenderPipeline.hexToRgba(midColor, 0.42 * baseGraphWeight)
            );
            headGlow.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

            ctx.fillStyle = headGlow;
            ctx.beginPath();
            ctx.arc(headPos.x, headPos.y, rGlow * 2.8, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Отрисовывает частицы, трёхчастные сомы нейронов и боке переднего плана по 4 эшелонам Z0..Z3
     * с учётом C1/C2-преломления на кромке линзы BREACH LENS.
     */
    private renderMultiEchelonParticles(
        ctx: CanvasRenderingContext2D,
        particles: ReadonlyArray<QuantumParticle>,
        simTimeSec: number,
        phase: PhaseId,
        fullXRayMode: boolean,
        audioSnap: AudioModulationSnapshot
    ): void {
        ctx.save();
        let xrayCalloutsRendered = 0;

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            const refract = stressStore.getBoundaryRefractionOffset(p.x, p.y, simTimeSec);
            const sx = p.x + refract.dx;
            const sy = p.y + refract.dy;

            const breath = 0.84 + 0.24 * Math.sin(p.kuramotoPhase + simTimeSec * 1.1);
            const radius =
                p.radius *
                breath *
                (1.0 + refract.rimHighlight * 0.35 + audioSnap.pulse * 0.14);
            const alpha = clamp(
                (0.38 + p.energy * 0.56 + p.synapticCharge * 0.35) *
                (p.depthTier === 'DEEP_LAYER'
                    ? 0.55
                    : p.depthTier === 'BACKGROUND'
                        ? 0.75
                        : 1.0),
                0.12,
                0.98
            );

            if (p.depthTier === 'FOREGROUND') {
                const bokehR = radius * 3.4;
                const bokehGrad = ctx.createRadialGradient(sx, sy, 0.5, sx, sy, bokehR);
                bokehGrad.addColorStop(
                    0.0,
                    RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.26)
                );
                bokehGrad.addColorStop(
                    0.6,
                    RenderPipeline.hexToRgba('#6366f1', alpha * 0.09)
                );
                bokehGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
                ctx.fillStyle = bokehGrad;
                ctx.beginPath();
                ctx.arc(sx, sy, bokehR, 0, TAU);
                ctx.fill();
                continue;
            }

            const isExcitedSoma = p.interferenceFlash > 0.15 || p.synapticCharge > 0.65;
            if (
                isExcitedSoma ||
                p.degree >= 3 ||
                refract.rimHighlight > 0.25 ||
                phase === '03_EVOLUTION'
            ) {
                const haloR = radius * (isExcitedSoma ? 4.2 : 3.2);
                const haloColor = isExcitedSoma
                    ? '#bae6fd'
                    : p.clusterId % 3 === 0
                        ? '#7dd3fc'
                        : '#6366f1';
                const haloGrad = ctx.createRadialGradient(sx, sy, 0.4, sx, sy, haloR);
                haloGrad.addColorStop(
                    0.0,
                    RenderPipeline.hexToRgba(haloColor, alpha * (isExcitedSoma ? 0.62 : 0.36))
                );
                haloGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
                ctx.fillStyle = haloGrad;
                ctx.beginPath();
                ctx.arc(sx, sy, haloR, 0, TAU);
                ctx.fill();
            }

            ctx.fillStyle = isExcitedSoma
                ? RenderPipeline.hexToRgba('#f8fafc', alpha)
                : p.depthTier === 'MIDGROUND'
                    ? RenderPipeline.hexToRgba('#f8fafc', alpha * 0.94)
                    : RenderPipeline.hexToRgba('#7dd3fc', alpha * 0.82);
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0.8, radius), 0, TAU);
            ctx.fill();

            if (fullXRayMode && p.degree >= 3 && i % 29 === 0 && xrayCalloutsRendered < 6) {
                this.renderBorderlessNodeCallout(ctx, sx, sy, p, simTimeSec, 0.88);
                xrayCalloutsRendered++;
            }
        }

        ctx.restore();
    }

    // ============================================================================
    // РАЗДЕЛ 4. ОРГАНИЧЕСКАЯ ОПТИКА МЕМБРАНЫ BREACH LENS И ГЛУБИННЫЙ ЭШЕЛОН Z4
    // ============================================================================

    /**
     * Отрисовывает мембрану BREACH LENS, криволинейные геодезические клеточки рентгена
     * и глубинный суб-квантовый слой Z4 («обратную сторону Вселенной») под клеточками.
     */
    private renderBreachLensAndSubQuantumZ4(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        w: number,
        h: number,
        simTimeSec: number,
        state: Readonly<UniverseState>,
        particles: ReadonlyArray<QuantumParticle>,
        audioSnap: AudioModulationSnapshot
    ): void {
        const sState = stressStore.getState();
        const fullXRay =
            state.layers.layer5_truthXRayMode || state.opticalWeights.logicConvergence > 0.15;

        const activeRadius = fullXRay
            ? Math.min(w, h) * 0.44
            : sState.currentBreachRadius;
        const revealStrength = fullXRay
            ? Math.max(0.85, state.opticalWeights.logicConvergence)
            : Math.max(
                sState.revealIntensity,
                sState.isPointerInside ? 0.42 : 0.0
            );

        if (activeRadius < 6.0 || revealStrength < 0.02) {
            return;
        }

        const lx = fullXRay && !sState.isPointerInside ? cx : sState.lensX;
        const ly = fullXRay && !sState.isPointerInside ? cy : sState.lensY;

        ctx.save();

        const z4BgGrad = ctx.createRadialGradient(
            lx,
            ly,
            activeRadius * 0.05,
            lx,
            ly,
            activeRadius * 1.12
        );
        z4BgGrad.addColorStop(
            0.0,
            RenderPipeline.hexToRgba('#060b19', 0.72 * revealStrength)
        );
        z4BgGrad.addColorStop(
            0.55,
            RenderPipeline.hexToRgba('#1e1b4b', 0.34 * revealStrength)
        );
        z4BgGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        ctx.fillStyle = z4BgGrad;
        ctx.beginPath();
        ctx.arc(lx, ly, activeRadius * 1.12, 0, TAU);
        ctx.fill();

        const parallaxX = (lx - cx) * -0.16;
        const parallaxY = (ly - cy) * -0.16;

        for (let i = 0; i < this.subQuantumZ4.length; i++) {
            const zNode = this.subQuantumZ4[i];
            const zx = cx + zNode.xNorm * w + parallaxX;
            const zy = cy + zNode.yNorm * h + parallaxY;

            const dist = Math.hypot(zx - lx, zy - ly);
            if (dist >= activeRadius) continue;

            const u = dist / activeRadius;
            const bellMask = Math.pow(1.0 - u * u, 2.0) * revealStrength;
            if (bellMask < 0.02) continue;

            for (let nIdx = 0; nIdx < zNode.neighbors.length; nIdx++) {
                const nb = this.subQuantumZ4[zNode.neighbors[nIdx]];
                const nbx = cx + nb.xNorm * w + parallaxX;
                const nby = cy + nb.yNorm * h + parallaxY;

                if (Math.hypot(nbx - lx, nby - ly) >= activeRadius * 1.04) continue;

                const bend = zNode.ctrlBends[nIdx] ?? 0.14;
                const ctrlX = (zx + nbx) * 0.5 - (nby - zy) * bend;
                const ctrlY = (zy + nby) * 0.5 + (nbx - zx) * bend;

                ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', 0.26 * bellMask);
                ctx.lineWidth = 0.7;
                ctx.beginPath();
                ctx.moveTo(zx, zy);
                ctx.quadraticCurveTo(ctrlX, ctrlY, nbx, nby);
                ctx.stroke();

                const pT = (simTimeSec * 0.78 + i * 0.17 + nIdx * 0.33) % 1.0;
                const omt = 1.0 - pT;
                const ix = omt * omt * zx + 2.0 * omt * pT * ctrlX + pT * pT * nbx;
                const iy = omt * omt * zy + 2.0 * omt * pT * ctrlY + pT * pT * nby;

                ctx.fillStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.74 * bellMask);
                ctx.beginPath();
                ctx.arc(ix, iy, 1.3, 0, TAU);
                ctx.fill();
            }

            const zPulse = 0.5 + 0.5 * Math.sin(zNode.phase + simTimeSec * 2.3);
            ctx.fillStyle = RenderPipeline.hexToRgba(
                '#7dd3fc',
                (0.35 + 0.45 * zPulse) * bellMask
            );
            ctx.beginPath();
            ctx.arc(zx, zy, 1.4 + 0.8 * zPulse, 0, TAU);
            ctx.fill();
        }

        const cellStep = 34;
        const halfSpan = Math.ceil(activeRadius / cellStep) * cellStep;
        const baseGx = Math.floor(lx / cellStep) * cellStep;
        const baseGy = Math.floor(ly / cellStep) * cellStep;

        for (let gx = baseGx - halfSpan; gx <= baseGx + halfSpan; gx += cellStep) {
            for (let gy = baseGy - halfSpan; gy <= baseGy + halfSpan; gy += cellStep) {
                const dx = gx - lx;
                const dy = gy - ly;
                const d = Math.hypot(dx, dy);
                if (d >= activeRadius * 0.92) continue;

                const u = d / (activeRadius * 0.92);
                const cellAlpha = Math.pow(1.0 - u * u, 2.0) * revealStrength * 0.22;
                if (cellAlpha < 0.015) continue;

                const warpX =
                    Math.sin(gy * 0.025 + simTimeSec * 1.4) * 3.2 * (1.0 - u);
                const warpY =
                    Math.cos(gx * 0.025 - simTimeSec * 1.4) * 3.2 * (1.0 - u);
                const px = gx + warpX;
                const py = gy + warpY;

                ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', cellAlpha);
                ctx.lineWidth = 0.55;
                ctx.beginPath();
                ctx.moveTo(px - cellStep * 0.45, py);
                ctx.lineTo(px + cellStep * 0.45, py);
                ctx.moveTo(px, py - cellStep * 0.45);
                ctx.lineTo(px, py + cellStep * 0.45);
                ctx.stroke();
            }
        }

        const rimSegs = 96;
        const rimChunks = 16;
        const segPerChunk = rimSegs / rimChunks;

        for (let c = 0; c < rimChunks; c++) {
            const s0 = c * segPerChunk;
            const s1 = (c + 1) * segPerChunk;
            const midAngle = (((s0 + s1) * 0.5) / rimSegs) * TAU;
            const crest =
                0.5 +
                0.5 *
                Math.sin(
                    midAngle * 3.0 - simTimeSec * 2.2 + Math.cos(midAngle * 2.0)
                );
            const rimAlpha = revealStrength * (0.08 + 0.48 * Math.pow(crest, 1.4));
            if (rimAlpha < 0.02) continue;

            ctx.beginPath();
            for (let s = s0; s <= s1; s++) {
                const theta = (s / rimSegs) * TAU;
                const deformedR = fullXRay
                    ? activeRadius *
                    (1.0 + 0.03 * Math.sin(theta * 4.0 + simTimeSec * 1.8))
                    : stressStore.getDeformedLensRadiusAtAngle(theta, simTimeSec) *
                    (1.0 +
                        0.028 *
                        fbm2D(
                            Math.cos(theta) * 2.0,
                            Math.sin(theta) * 2.0 + simTimeSec * 0.5,
                            3
                        ));
                const px = lx + Math.cos(theta) * deformedR;
                const py = ly + Math.sin(theta) * deformedR;
                if (s === s0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', rimAlpha);
            ctx.lineWidth = 0.95 + 0.9 * crest * (1.0 + 0.2 * audioSnap.pulse);
            ctx.stroke();
        }

        for (let i = 0; i < sState.microCracks.length; i++) {
            const crack = sState.microCracks[i];
            const baseR = stressStore.getDeformedLensRadiusAtAngle(
                crack.anchorAngle,
                simTimeSec
            );
            const anchorX = lx + Math.cos(crack.anchorAngle) * baseR;
            const anchorY = ly + Math.sin(crack.anchorAngle) * baseR;
            const crackAlpha = clamp(
                crack.life * crack.intensity * revealStrength,
                0,
                0.85
            );
            if (crackAlpha < 0.02) continue;

            ctx.strokeStyle = RenderPipeline.hexToRgba('#f8fafc', crackAlpha);
            for (let s = 0; s < crack.segments.length; s++) {
                const seg = crack.segments[s];
                ctx.lineWidth = seg.thickness;
                ctx.beginPath();
                ctx.moveTo(anchorX + seg.x1, anchorY + seg.y1);
                ctx.lineTo(anchorX + seg.x2, anchorY + seg.y2);
                ctx.stroke();
            }
            ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', crackAlpha * 0.7);
            for (let b = 0; b < crack.branches.length; b++) {
                const br = crack.branches[b];
                ctx.lineWidth = br.thickness;
                ctx.beginPath();
                ctx.moveTo(anchorX + br.x1, anchorY + br.y1);
                ctx.lineTo(anchorX + br.x2, anchorY + br.y2);
                ctx.stroke();
            }
        }

        let calloutCount = 0;
        for (let i = 0; i < particles.length; i++) {
            const pt = particles[i];
            const d = Math.hypot(pt.x - lx, pt.y - ly);
            if (d >= activeRadius * 0.82) continue;

            const u = d / (activeRadius * 0.82);
            const localMask = Math.pow(1.0 - u * u, 1.8) * revealStrength;

            if (i % 4 === 0) {
                const speed = Math.hypot(pt.vx, pt.vy);
                if (speed > 0.15) {
                    const logLen = Math.log(1.0 + speed) * 9.5;
                    const ux = pt.vx / speed;
                    const uy = pt.vy / speed;
                    ctx.strokeStyle = RenderPipeline.hexToRgba('#38bdf8', localMask * 0.48);
                    ctx.lineWidth = 0.65;
                    ctx.beginPath();
                    ctx.moveTo(pt.x, pt.y);
                    ctx.lineTo(pt.x + ux * logLen, pt.y + uy * logLen);
                    ctx.stroke();
                }
            }

            if (calloutCount < 4 && i % 23 === 0 && d < activeRadius * 0.68) {
                this.renderBorderlessNodeCallout(
                    ctx,
                    pt.x,
                    pt.y,
                    pt,
                    simTimeSec,
                    localMask
                );
                calloutCount++;
            }
        }

        ctx.restore();
    }

    private renderBorderlessNodeCallout(
        ctx: CanvasRenderingContext2D,
        nx: number,
        ny: number,
        pt: QuantumParticle,
        simTimeSec: number,
        alphaWeight: number
    ): void {
        if (alphaWeight < 0.05) return;
        const floatOffset = Math.sin(simTimeSec * 2.1 + pt.id) * 2.2;
        const labelX = nx + 14;
        const labelY = ny - 10 + floatOffset;

        ctx.save();
        ctx.globalAlpha = clamp(alphaWeight, 0, 0.95);

        ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(nx, ny);
        ctx.quadraticCurveTo(nx + 7, ny - 8 + floatOffset, labelX - 3, labelY - 3);
        ctx.stroke();

        ctx.font = '10.5px "JetBrains Mono", "Fira Code", monospace';
        ctx.fillStyle = '#f8fafc';
        ctx.shadowColor = 'rgba(2, 3, 8, 0.96)';
        ctx.shadowBlur = 8;
        ctx.fillText(
            `ID#${String(pt.id).padStart(3, '0')} [${pt.moduleTag}]`,
            labelX,
            labelY
        );

        ctx.restore();
    }
    /**
     * Отрисовывает 7-оболочечную корону туманности «Кошачьего глаза» (NGC 6543),
     * допплеровский аккреционный диск и тень горизонта событий Чёрной дыры в фазе 05_SINGULARITY.
     * В Акте A вырастает из Точки Нуля, а в Акте B полностью сжимается обратно в точку и исчезает.
     */
    private renderSingularityCoronaAndBlackHole(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        scale: number,
        simTimeSec: number,
        act: SingularityAct,
        actProgress: number,
        audioSnap: AudioModulationSnapshot
    ): void {
        // Когда открывается финальная визитка (Акт D), Чёрная дыра уже полностью ушла в точку и исчезла
        if (act === 'ACT_D_GITHUB_CARD') {
            return;
        }

        ctx.save();

        let volumeEnvelope = 1.0;
        let opacityEnvelope = 1.0;

        if (act === 'ACT_A_ACCRETION' || act === 'NONE' || act === 'INACTIVE') {
            const birthCurve = smootherstep(0.0, 0.46, actProgress);
            volumeEnvelope = 0.012 + 0.988 * birthCurve;
            opacityEnvelope = smootherstep(0.0, 0.25, actProgress);
        } else if (act === 'ACT_B_LOGIC') {
            if (actProgress > 0.32) {
                const cNorm = (actProgress - 0.32) / 0.68;
                const smoothCollapse = smootherstep(0.0, 1.0, cNorm);
                // Полное сжатие радиуса в 0.0 и растворение к концу Акта B
                volumeEnvelope = Math.max(0.0, Math.pow(1.0 - smoothCollapse, 2.15));
                opacityEnvelope = 1.0 - smootherstep(0.72, 1.0, cNorm);
            }
        } else if (act === 'RESTART_COLLAPSE') {
            volumeEnvelope = Math.max(0.0, 0.18 * (1.0 - actProgress));
            opacityEnvelope = Math.max(0.0, 1.0 - actProgress);
        }

        if (opacityEnvelope <= 0.005 || volumeEnvelope <= 0.002) {
            ctx.restore();
            return;
        }

        // 1. 7 лепестковых газовых оболочек звезды Вольфа — Райе («Кошачий глаз» NGC 6543)
        const shells = 7;
        for (let l = 1; l <= shells; l++) {
            const shellBirthDelay = (l - 1) * 0.04;
            const shellScale =
                act === 'ACT_A_ACCRETION'
                    ? smootherstep(
                        shellBirthDelay,
                        Math.min(1.0, shellBirthDelay + 0.48),
                        actProgress
                    )
                    : volumeEnvelope;

            const baseR = (0.09 + l * 0.055) * scale * shellScale;
            if (baseR < 0.8) continue;

            const lobes = 4 + (l % 3) * 2;
            const alpha = clamp(
                (0.24 - l * 0.024) *
                (0.85 + 0.25 * audioSnap.pulse) *
                opacityEnvelope,
                0.01,
                0.32
            );

            ctx.beginPath();
            const pts = 96;
            for (let s = 0; s <= pts; s++) {
                const phi = (s / pts) * TAU;
                const rShell =
                    baseR *
                    (1.0 +
                        0.11 * Math.cos(lobes * phi + simTimeSec * (0.48 - l * 0.04)) +
                        0.055 * Math.cos(2.0 * lobes * phi - simTimeSec * 0.28));
                const px = cx + Math.cos(phi) * rShell * 1.14;
                const py = cy + Math.sin(phi) * rShell * 0.84;
                if (s === 0) ctx.moveTo(px, py);
                else ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.strokeStyle =
                l % 2 === 0
                    ? RenderPipeline.hexToRgba('#7dd3fc', alpha)
                    : l === 3
                        ? RenderPipeline.hexToRgba('#bae6fd', alpha * 0.78)
                        : RenderPipeline.hexToRgba('#6366f1', alpha * 0.85);
            ctx.lineWidth = 1.05;
            ctx.stroke();
        }

        // 2. Фотонное кольцо и сфера тени горизонта событий Чёрной дыры (уходит в чистую точку)
        const fullShadowR = scale * 0.068;
        const shadowR = fullShadowR * volumeEnvelope;
        const photonOuterR = Math.max(1.2, shadowR * 2.45);

        const photonGrad = ctx.createRadialGradient(
            cx - shadowR * 0.16,
            cy,
            Math.max(0.2, shadowR * 0.75),
            cx,
            cy,
            photonOuterR
        );
        photonGrad.addColorStop(0.0, `rgba(2, 3, 8, ${opacityEnvelope.toFixed(3)})`);
        photonGrad.addColorStop(
            0.36,
            `rgba(2, 3, 8, ${(0.98 * opacityEnvelope).toFixed(3)})`
        );
        photonGrad.addColorStop(
            0.48,
            RenderPipeline.hexToRgba('#f8fafc', 0.92 * opacityEnvelope)
        );
        photonGrad.addColorStop(
            0.68,
            RenderPipeline.hexToRgba('#7dd3fc', 0.48 * opacityEnvelope)
        );
        photonGrad.addColorStop(
            0.86,
            RenderPipeline.hexToRgba('#6366f1', 0.22 * opacityEnvelope)
        );
        photonGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = photonGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, photonOuterR, 0, TAU);
        ctx.fill();

        if (shadowR > 0.6) {
            ctx.fillStyle = `rgba(2, 3, 8, ${opacityEnvelope.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(cx, cy, shadowR * 0.9, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }

    /**
     * Отрисовывает Акт C (93.0–95.5 с): Чёрная дыра уже схлопнулась в крошечную
     * жемчужную микро-точку в центре экрана, которая замирает и растворяется
     * непосредственно перед вылетом из неё финальной визитки DUBNOV ALEXEY.
     */
    private renderZeroSilenceActC(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        _minSide: number,
        simTimeSec: number
    ): void {
        const uState = universeStore.getState();
        const actProg = clamp(uState.singularityActProgress, 0, 1);
        // Микро-точка плавно гаснет к концу 2.5 с, уступая место вылетающей из неё визитке
        const pointFade = 1.0 - smootherstep(0.65, 1.0, actProg);
        if (pointFade <= 0.01) return;

        const slowBreath = 1.0 + 0.08 * Math.sin(simTimeSec * TAU * 0.35);
        const dotR = Math.max(0.8, 2.6 * slowBreath * pointFade);
        const glowR = dotR * 6.5;

        const halo = ctx.createRadialGradient(cx, cy, 0.2, cx, cy, glowR);
        halo.addColorStop(0.0, RenderPipeline.hexToRgba('#f8fafc', 0.95 * pointFade));
        halo.addColorStop(0.35, RenderPipeline.hexToRgba('#7dd3fc', 0.42 * pointFade));
        halo.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, TAU);
        ctx.fill();

        ctx.fillStyle = RenderPipeline.hexToRgba('#f8fafc', pointFade);
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, TAU);
        ctx.fill();
    }

    // ============================================================================
    // РАЗДЕЛ 5. РЕНДЕРИНГ БАРАБАНОВ КВАНТОВОГО ОДОМЕТРА (АКТ D — LAYER 5)
    // ============================================================================

    /**
     * Отрисовывает 5 строк квантового одометра из cipherOdometerEngine:
     * ИСПРАВЛЕНО: Полностью исключён ржаво-рыжий цвет (#f59e0b) при переборе;
     * используется многослойная холодная палитра полутонов (жемчуг, ледяной циан,
     * серебристый сланец, графит) с глубокими объёмными тенями.
     */
    private renderCipherOdometerStage(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        state: Readonly<UniverseState>
    ): void {
        const assemblyProgress = state.githubCardAssemblyProgress;

        const cells: OdometerGlyphCellState[] = cipherOdometerEngine.evaluateCells(
            w,
            h,
            assemblyProgress,
            state.reducedMotion
        );

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const backdropR = Math.min(w, h) * 0.44;
        const backdropGrad = ctx.createRadialGradient(
            w * 0.5,
            h * 0.5,
            16,
            w * 0.5,
            h * 0.5,
            backdropR
        );
        const veilAlpha = Math.min(1.0, assemblyProgress * 1.35);
        backdropGrad.addColorStop(0.0, `rgba(3, 7, 18, ${(0.84 * veilAlpha).toFixed(3)})`);
        backdropGrad.addColorStop(0.65, `rgba(2, 5, 14, ${(0.56 * veilAlpha).toFixed(3)})`);
        backdropGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        ctx.fillStyle = backdropGrad;
        ctx.fillRect(0, 0, w, h);

        const ghostTonePool = ['#64748b', '#475569', '#38bdf8', '#94a3b8'];

        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            if (c.primaryChar === ' ') continue;

            ctx.save();
            ctx.translate(c.currentX, c.currentY);
            ctx.scale(1.0, c.verticalScale);

            ctx.font = `${c.fontWeight} ${c.fontSizePx.toFixed(1)}px "JetBrains Mono", "Fira Code", monospace`;
            const breathAlpha = c.glyphBreathAlpha ?? 0.92;

            // Для вращающихся барабанов рисуем многослойные верхний и нижний полутоновые следы колеса с тенью
            if (!c.isLocked) {
                const ghostOffset = c.fontSizePx * 0.72;
                ctx.shadowColor = 'rgba(2, 6, 23, 0.96)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetY = 3;

                ctx.globalAlpha = 0.28 * breathAlpha;
                ctx.fillStyle = ghostTonePool[(c.charIndex + c.lineIndex) % ghostTonePool.length];
                ctx.fillText(
                    c.upperChar,
                    0,
                    -ghostOffset - c.wheelPhaseFrac * c.fontSizePx * 0.48
                );

                ctx.globalAlpha = 0.22 * breathAlpha;
                ctx.fillStyle =
                    ghostTonePool[(c.charIndex + c.lineIndex + 2) % ghostTonePool.length];
                ctx.fillText(
                    c.lowerChar,
                    0,
                    ghostOffset - c.wheelPhaseFrac * c.fontSizePx * 0.48
                );
            }

            // Глубокая тень основного символа + многотоновая холодная подсветка без рыжего цвета
            ctx.shadowColor = c.shadowColor || 'rgba(2, 6, 23, 0.95)';
            ctx.shadowBlur = c.shadowBlur ?? 11;
            ctx.shadowOffsetY = c.isLocked ? 2 : 3;

            ctx.globalAlpha = c.isLocked ? 0.97 : breathAlpha;
            if (c.lockFlash > 0.26) {
                ctx.fillStyle = c.charIndex % 2 === 0 ? '#f8fafc' : '#bae6fd';
            } else if (c.lockFlash > 0.08) {
                ctx.fillStyle = c.charIndex % 3 === 0 ? '#7dd3fc' : '#cbd5e1';
            } else {
                ctx.fillStyle = c.colorHex;
            }

            ctx.fillText(
                c.primaryChar,
                0,
                c.isLocked ? 0 : -c.wheelPhaseFrac * c.fontSizePx * 0.44
            );

            ctx.restore();
        }

        ctx.restore();
    }

    // ============================================================================
    // РАЗДЕЛ 6. ГЛАВНЫЙ ЦИКЛ RAF, УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ И МОНТИРОВАНИЕ UI
    // ============================================================================

    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastFrameTimeMs = performance.now();
        this.rafId = requestAnimationFrame(this.loop);
    }

    public stop(): void {
        this.isRunning = false;
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = 0;
        }
    }

    private loop = (nowMs: number): void => {
        if (!this.isRunning) return;

        const rawDtMs = Math.max(1.0, nowMs - this.lastFrameTimeMs);
        this.lastFrameTimeMs = nowMs;
        const clampedDtSec = Math.min(0.05, rawDtMs / 1000.0);

        const state = universeStore.getState();

        if (state.seed !== this.lastSeed) {
            this.lastSeed = state.seed;
            this.initProceduralBackgroundFields(state.seed);
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
        // Масштабируем simDtSec один раз здесь и передаём timeScale = 1.0 в simulation.update
        const simDtSec = isActiveSim ? clampedDtSec * state.timeScale : 0.0;
        const nextSimSec = state.telemetry.simulationTimeSec + simDtSec;
        const nextPhaseElapsed = state.telemetry.phaseElapsedSec + simDtSec;

        const audioSnap = audioSync.updateRealtimeModulation(
            nextSimSec,
            state.currentPhase,
            state.singularityAct === 'ACT_C_ZERO_SILENCE'
        );

        if (isActiveSim && simDtSec > 0) {
            stressStore.stepPhysics(simDtSec);
            this.stepBackgroundFields(simDtSec, nextSimSec, state.seed);
            this.simulation.update(
                simDtSec,
                state.currentPhase,
                1.0,
                state.gravityMultiplier,
                nextSimSec
            );
        }

        this.renderFrame(nextSimSec, universeStore.getState(), audioSnap);

        const latestState = universeStore.getState();
        const particles = this.getSimParticles();
        const edges = this.getSimEdges();
        const pulses = this.getSimPulses();
        const caps = this.pipeline.getCapabilities();

        if (latestState.singularityAct === 'RESTART_COLLAPSE') {
            universeStore.updateTelemetry({
                frameTimeMs: Number(rawDtMs.toFixed(1)),
                simulationTimeSec: Number(nextSimSec.toFixed(3)),
                phaseElapsedSec: Number(nextPhaseElapsed.toFixed(3)),
                audioStatus: audioSnap.status,
                silenceRmsDb: audioSnap.rmsDb,
            });
            if (universeStore.getState().restartElapsedSec >= 1.65) {
                resourceLedger.disposeCycleResources();
                universeStore.completeRestartToVoid();
            }
        } else if (isActiveSim) {
            universeStore.updateTelemetry({
                frameTimeMs: Number(rawDtMs.toFixed(1)),
                activeParticles: particles.length,
                activeConnections: edges.length,
                activePulses: pulses.length,
                simulationTimeSec: Number(nextSimSec.toFixed(3)),
                phaseElapsedSec: Number(nextPhaseElapsed.toFixed(3)),
                engineBackend: caps.activeBackend,
                wasmStatus:
                    integrationRegistry.getModule('wasm-physics')?.status === 'ready'
                        ? 'WASM_SIMD_ACTIVE'
                        : 'TS_FALLBACK',
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

        this.rafId = requestAnimationFrame(this.loop);
    };
}

export let activeRenderer: UniverseRenderer | null = null;

export function getUniverseRenderer(): UniverseRenderer | null {
    return activeRenderer;
}

// ============================================================================
// РАЗДЕЛ 7. ИНВЕРСНЫЙ КВАНТОВЫЙ ПЕРЕБОР СОСЕДНИХ ЭЛЕМЕНТОВ В УГЛОВЫХ ПАНЕЛЯХ
// При наведении курсора на элемент в .brand-card, .phase-timeline-dock или
// .controls-dock сам элемент под курсором остаётся неподвижным и чётким,
// а соседние элементы в ряду плавно перебирают знаки в холодной гамме с тенями.
// ============================================================================

const CORNER_SCRAMBLE_GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ∑∆ΩΨΦΛΠΞΘ∇∂∫≈≠≡⊕⊗⊙◊◈';
const CORNER_COLD_TONES: ReadonlyArray<{ color: string; shadow: string }> = [
    {
        color: '#f8fafc',
        shadow: '0 2px 10px rgba(2, 6, 23, 0.96), 0 0 12px rgba(186, 230, 253, 0.55)',
    },
    {
        color: '#bae6fd',
        shadow: '0 2px 12px rgba(2, 6, 23, 0.96), 0 0 14px rgba(125, 211, 252, 0.48)',
    },
    {
        color: '#94a3b8',
        shadow: '0 3px 10px rgba(1, 3, 10, 0.98), 0 0 8px rgba(71, 85, 105, 0.52)',
    },
    {
        color: '#7dd3fc',
        shadow: '0 2px 12px rgba(2, 6, 23, 0.96), 0 0 14px rgba(56, 189, 248, 0.45)',
    },
    {
        color: '#cbd5e1',
        shadow: '0 3px 11px rgba(15, 23, 42, 0.95), 0 0 9px rgba(148, 163, 184, 0.4)',
    },
];

const activeScrambleTimers = new WeakMap<HTMLElement, number>();

function setCanonicalElementText(el: HTMLElement | null, nextText: string): void {
    if (!el) return;
    const prevCanonical = el.dataset.canonicalText;
    el.dataset.canonicalText = nextText;

    // Если элемент сейчас не в процессе квантового перебора (или его канонический текст сменился), обновляем сразу
    if (el.dataset.scrambling !== '1' || prevCanonical !== nextText) {
        el.textContent = nextText;
    }
}

function stopElementScramble(el: HTMLElement): void {
    const existingTimer = activeScrambleTimers.get(el);
    if (existingTimer !== undefined) {
        window.clearInterval(existingTimer);
        activeScrambleTimers.delete(el);
    }
    el.dataset.scrambling = '0';
    el.style.removeProperty('color');
    el.style.removeProperty('text-shadow');
    if (el.dataset.canonicalText) {
        el.textContent = el.dataset.canonicalText;
    }
}

function startNeighborElementScramble(el: HTMLElement, siblingIndex: number): void {
    stopElementScramble(el);

    const canonical = (el.dataset.canonicalText || el.textContent || '').trim();
    if (!canonical) return;
    el.dataset.canonicalText = canonical;
    el.dataset.scrambling = '1';

    let step = 0;
    const totalSteps = 10;

    const timerId = window.setInterval(() => {
        const latestCanonical = el.dataset.canonicalText || canonical;
        const progress = step / totalSteps;

        if (progress >= 1.0) {
            stopElementScramble(el);
            return;
        }

        const lockBoundary = Math.floor(progress * latestCanonical.length);
        let out = '';
        for (let i = 0; i < latestCanonical.length; i++) {
            const ch = latestCanonical[i];
            if (
                ch === ' ' ||
                ch === '.' ||
                ch === ':' ||
                ch === '/' ||
                ch === '(' ||
                ch === ')' ||
                ch === '-' ||
                i < lockBoundary
            ) {
                out += ch;
            } else if ((i + step + siblingIndex) % 3 === 0) {
                // Меняем только часть незафиксированных символов на каждом шаге,
                // чтобы мелкий шрифт плавно переливался, а не дёргался
                const gIdx =
                    (i * 7 + step * 3 + siblingIndex * 5) %
                    CORNER_SCRAMBLE_GLYPHS.length;
                out += CORNER_SCRAMBLE_GLYPHS[gIdx];
            } else {
                out += ch;
            }
        }

        const tone =
            CORNER_COLD_TONES[(step + siblingIndex) % CORNER_COLD_TONES.length];
        el.style.color = tone.color;
        el.style.textShadow = tone.shadow;
        el.textContent = out;

        step++;
    }, 88);

    activeScrambleTimers.set(el, timerId);
}

/**
 * Привязывает ко всем угловым панелям (.brand-card, #ui-phase-buttons, .controls-dock)
 * инверсный отклик: элемент под курсором мыши мгновенно фиксируется и стоит на месте,
 * а соседние элементы в его группе мягко перебираются.
 */
function bindCornerPanelsNeighborScramble(): void {
    if (typeof document === 'undefined') return;

    const groupsSelectors = [
        '.brand-card > .phase-codename, .brand-card > .phase-title, .brand-card > .phase-subtitle, .brand-card > .phase-philosophy',
        '#ui-phase-buttons > button.phase-pill',
        '.controls-dock > button.btn-cyber',
    ];

    groupsSelectors.forEach((selector) => {
        const items = Array.from(document.querySelectorAll<HTMLElement>(selector));
        items.forEach((el) => {
            if (!el.dataset.canonicalText) {
                el.dataset.canonicalText = (el.textContent || '').trim();
            }

            el.addEventListener('pointerenter', () => {
                // Выбранный под мышью элемент остаётся строго на месте и читается без искажений
                stopElementScramble(el);

                // Все соседние элементы в этой группе откликаются квантовым перебором
                items.forEach((sibling, sIdx) => {
                    if (sibling !== el) {
                        startNeighborElementScramble(sibling, sIdx);
                    }
                });
            });
        });
    });
}

/**
 * Синхронизирует DOM-элементы паспорта фазы, шкалы прогресса и кнопок управления
 * в index.astro с актуальным состоянием UniverseStore.
 */
function syncHudDomWithState(state: Readonly<UniverseState>): void {
    const codenameEl = document.getElementById('ui-phase-codename');
    const titleEl = document.getElementById('ui-phase-title');
    const subtitleEl = document.getElementById('ui-phase-subtitle');
    const philosophyEl = document.getElementById('ui-phase-philosophy');
    const progressEl = document.getElementById('ui-phase-progress');
    const overlayRoot = document.getElementById('hud-overlay-root');

    setCanonicalElementText(codenameEl, state.phaseMeta.codeName);
    setCanonicalElementText(titleEl, state.phaseMeta.titleRu);
    setCanonicalElementText(subtitleEl, state.phaseMeta.subtitleRu);
    setCanonicalElementText(philosophyEl, state.phaseMeta.philosophyRu);

    if (progressEl) {
        progressEl.style.width = `${(state.telemetry.phaseProgress * 100).toFixed(1)}%`;
    }

    if (overlayRoot) {
        overlayRoot.classList.toggle(
            'act-silence-hidden',
            state.singularityAct === 'ACT_C_ZERO_SILENCE'
        );
    }

    const phaseButtons = document.querySelectorAll<HTMLButtonElement>(
        '#ui-phase-buttons button[data-phase-id]'
    );
    phaseButtons.forEach((btn) => {
        const phaseId = btn.getAttribute('data-phase-id') as PhaseId | null;
        btn.classList.toggle('active', phaseId === state.currentPhase);
    });

    const btnPause = document.getElementById('btn-toggle-pause');
    if (btnPause) {
        setCanonicalElementText(btnPause, state.isPaused ? '▶ RESUME' : '⏸ PAUSE');
        btnPause.classList.toggle('active-toggle', state.isPaused);
    }

    const btnAuto = document.getElementById('btn-toggle-autocycle');
    if (btnAuto) {
        setCanonicalElementText(
            btnAuto,
            state.autoCyclePhases ? '🔄 AUTO: ON' : '🔄 AUTO: OFF'
        );
        btnAuto.classList.toggle('active-toggle', state.autoCyclePhases);
    }

    const btnAudio = document.getElementById('btn-toggle-audio');
    if (btnAudio) {
        const aStatus = state.telemetry.audioStatus;
        const audioLabel =
            !state.audioEnabled || aStatus === 'MUTED'
                ? '🔇 AUDIO: MUTED'
                : aStatus === 'PLAYING_MP3' || aStatus === 'PLAYING_SYNTH'
                    ? '🔊 AUDIO: ON'
                    : '🔊 AUDIO: WAIT';
        setCanonicalElementText(btnAudio, audioLabel);
        btnAudio.classList.toggle(
            'active-toggle',
            state.audioEnabled && aStatus !== 'MUTED'
        );
    }

    const btnMetrics = document.getElementById('btn-toggle-metrics');
    if (btnMetrics) {
        btnMetrics.classList.toggle('active-toggle', state.layers.layer2_metricsHud);
    }

    const btnTopology = document.getElementById('btn-toggle-topology');
    if (btnTopology) {
        btnTopology.classList.toggle('active-toggle', state.layers.layer3_topologyGraph);
    }

    const btnTerminal = document.getElementById('btn-toggle-terminal');
    if (btnTerminal) {
        btnTerminal.classList.toggle(
            'active-toggle',
            state.layers.layer4_architectTerminal
        );
    }

    const btnXRay = document.getElementById('btn-toggle-xray');
    if (btnXRay) {
        btnXRay.classList.toggle('active-toggle', state.layers.layer5_truthXRayMode);
    }
}

/**
 * Точка входа клиентской графической подсистемы: инициализирует холст #universe-canvas,
 * монтирует реактивные острова телеметрии Layer 2–5, привязывает кнопки управления,
 * активирует инверсный перебор соседних элементов в угловых панелях и запускает цикл симуляции.
 */
export function bootstrapUniverseV2(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (activeRenderer) return;

    let canvas = document.querySelector<HTMLCanvasElement>('#universe-canvas, canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'universe-canvas';
        document.body.prepend(canvas);
    }

    const renderer = new UniverseRenderer(canvas);
    activeRenderer = renderer;

    // 1. Монтируем штатные панели телеметрии (Layers 2, 3, 4) и финал (Layer 5)
    const unsubL2 = mountLayer2Metrics(document.getElementById('layer2-metrics-root'));
    const unsubL3 = mountLayer3Topology(document.getElementById('layer3-topology-root'));
    const unsubL4 = mountLayer4Terminal(document.getElementById('layer4-terminal-root'));
    const unsubL5 = mountLayer5CipherFinale(document.getElementById('layer5-finale-root'));

    resourceLedger.registerCycleDisposable(unsubL2);
    resourceLedger.registerCycleDisposable(unsubL3);
    resourceLedger.registerCycleDisposable(unsubL4);
    resourceLedger.registerCycleDisposable(unsubL5);

    // 2. Подписываем обновление верхнего паспорта фазы и нижнего дока кнопок на UniverseStore
    const unsubHud = universeStore.subscribe((nextState: Readonly<UniverseState>) => {
        syncHudDomWithState(nextState);
    });
    resourceLedger.registerCycleDisposable(unsubHud);
    syncHudDomWithState(universeStore.getState());

    // 3. Подключаем инверсный квантовый перебор соседей при наведении на угловые панели
    bindCornerPanelsNeighborScramble();

    // 4. Обработчики кликов по кнопкам переключения 5 фаз
    const phaseButtonsContainer = document.getElementById('ui-phase-buttons');
    if (phaseButtonsContainer) {
        phaseButtonsContainer.addEventListener('click', (e: MouseEvent) => {
            const target = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>(
                'button[data-phase-id]'
            );
            if (!target) return;
            const phaseId = target.getAttribute('data-phase-id') as PhaseId | null;
            if (phaseId && PHASE_ORDER.includes(phaseId)) {
                audioSync.startPlayback();
                universeStore.setPhase(phaseId);
            }
        });
    }

    // 5. Обработчики кликов по кнопкам управления нижней панели
    document.getElementById('btn-toggle-pause')?.addEventListener('click', () => {
        universeStore.togglePause();
    });
    document.getElementById('btn-toggle-autocycle')?.addEventListener('click', () => {
        universeStore.toggleAutoCycle();
    });
    document.getElementById('btn-toggle-audio')?.addEventListener('click', () => {
        audioSync.toggleMute();
    });
    document.getElementById('btn-toggle-metrics')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer2_metricsHud');
    });
    document.getElementById('btn-toggle-topology')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer3_topologyGraph');
    });
    document.getElementById('btn-toggle-terminal')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer4_architectTerminal');
    });
    document.getElementById('btn-toggle-xray')?.addEventListener('click', () => {
        universeStore.toggleLayer('layer5_truthXRayMode');
    });

    // 6. Слушатели окна, указателя мыши/касаний и клавиатуры с учётом в ResourceLedger
    window.addEventListener('resize', renderer.handleResize, { passive: true });
    resourceLedger.trackAllocation('listeners', 1);

    window.addEventListener(
        'pointermove',
        (e: PointerEvent): void => {
            renderer.setPointerState(e.clientX, e.clientY, undefined, true);
        },
        { passive: true }
    );
    resourceLedger.trackAllocation('listeners', 1);

    window.addEventListener(
        'pointerdown',
        (e: PointerEvent): void => {
            const isUiClick = Boolean(
                (e.target as HTMLElement | null)?.closest(
                    '[data-ui-panel], [data-github-card], button, a'
                )
            );
            audioSync.startPlayback();
            if (!isUiClick) {
                renderer.setPointerState(e.clientX, e.clientY, true, true);
            }
        },
        { passive: true }
    );
    resourceLedger.trackAllocation('listeners', 1);

    window.addEventListener(
        'pointerup',
        (e: PointerEvent): void => {
            renderer.setPointerState(e.clientX, e.clientY, false, true);
        },
        { passive: true }
    );
    resourceLedger.trackAllocation('listeners', 1);

    window.addEventListener(
        'pointerleave',
        (): void => {
            renderer.setPointerState(-9999, -9999, false, false);
        },
        { passive: true }
    );
    resourceLedger.trackAllocation('listeners', 1);

    document.addEventListener('visibilitychange', (): void => {
        universeStore.setTabHidden(document.hidden);
    });
    resourceLedger.trackAllocation('listeners', 1);

    window.addEventListener('keydown', (e: KeyboardEvent): void => {
        if (e.key === '1') {
            universeStore.setPhase(PHASE_ORDER[0]);
        } else if (e.key === '2') {
            if (e.shiftKey) universeStore.setPhase(PHASE_ORDER[1]);
            else universeStore.toggleLayer('layer2_metricsHud');
        } else if (e.key === '3') {
            if (e.shiftKey) universeStore.setPhase(PHASE_ORDER[2]);
            else universeStore.toggleLayer('layer3_topologyGraph');
        } else if (e.key === '4') {
            if (e.shiftKey) universeStore.setPhase(PHASE_ORDER[3]);
            else universeStore.toggleLayer('layer4_architectTerminal');
        } else if (e.key === '5') {
            if (e.shiftKey) universeStore.setPhase(PHASE_ORDER[4]);
            else universeStore.toggleLayer('layer5_truthXRayMode');
        } else if (e.key.toLowerCase() === 'p') {
            universeStore.togglePause();
        } else if (e.key.toLowerCase() === 'm') {
            audioSync.toggleMute();
        } else if (e.key.toLowerCase() === 'r' && e.shiftKey) {
            universeStore.triggerUniverseRestart();
        }
    });
    resourceLedger.trackAllocation('listeners', 1);

    renderer.start();
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapUniverseV2);
    } else {
        bootstrapUniverseV2();
    }
}

export default UniverseRenderer;