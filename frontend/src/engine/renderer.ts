// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Главный графический и физический конвейер рендеринга UNIVERSE v2.5
//             и клиентский оркестратор интерактивных слоёв (MASTER 00–05)
// ============================================================================
// ПОДРОБНОЕ ОГЛАВЛЕНИЕ АРХИТЕКТУРНЫХ РАЗДЕЛОВ МОДУЛЯ (ДЛЯ ОБСЛУЖИВАНИЯ):
//
// РАЗДЕЛ 1. МАТЕМАТИЧЕСКИЕ УТИЛИТЫ, ШУМОВЫЕ ПОЛЯ И СТРУКТУРЫ ФОНОВЫХ ЯВЛЕНИЙ
//   - Подраздел 1.1. Базовые функции интерполяции и ограничения (clamp, lerp).
//   - Подраздел 1.2. Детерминированный 2D-шум и фрактальное броуновское движение
//                    (hash2D, valueNoise2D, fbm2D).
//   - Подраздел 1.3. Интерфейсы спиральных облаков M31 (SpiralDustCloud),
//                    криволинейных полевых сигналов (CurvedFieldSignal) и
//                    глубинной суб-квантовой сети Z4 (SubQuantumNodeZ4).
//
// РАЗДЕЛ 2. КЛАСС ГЛАВНОГО РЕНДЕРЕРА (UniverseRenderer) — ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ
//   - Подраздел 2.1. Поля класса и конструктор UniverseRenderer.
//   - Подраздел 2.2. Генерация процедурных фоновых полей (initProceduralBackgroundFields,
//                    spawnCurvedFieldSignal).
//   - Подраздел 2.3. Безопасный доступ к данным симуляции, обработка resize и
//                    указателя мыши (getSimParticles, getSimEdges, getSimPulses,
//                    handleResize, setPointerState, stepBackgroundFields).
//
// РАЗДЕЛ 3. ПОЛЕВОЙ И АСТРОФИЗИЧЕСКИЙ РЕНДЕРИНГ ФАЗ 01–05
//   - Подраздел 3.1. Главный диспетчер кадра (renderFrame).
//   - Подраздел 3.2. Рендеринг дышащих колец светового эха цефеиды RS Кормы
//                    в фазе 01_VOID (renderBreathingLightEchoRings).
//   - Подраздел 3.3. Рендеринг спиральных рукавов пыли и каньонов поглощения
//                    M31 / NGC 3169 в фазе 02_GENESIS (renderSpiralDustAndCanyons).
//   - Подраздел 3.4. Рендеринг криволинейных полевых сигналов RK2 Curl-Noise
//                    (renderCurvedFieldSignals).
//   - Подраздел 3.5. Рендеринг 5 кеплеровских колец и когнитивных полушарий Мозга
//                    в фазах 03_EVOLUTION и 04_COLLAPSE (renderCorticalHemispheresAndKeplerRings).
//   - Подраздел 3.6. Рендеринг кривых Безье графа NEXUS (классы A/B/C) и комет
//                    синаптических импульсов (renderTopologyEdgesAndPulses).
//   - Подраздел 3.7. Рендеринг многоэшелонных частиц, сом нейронов и боке Z0..Z3
//                    (renderMultiEchelonParticles).
//
// РАЗДЕЛ 4. ОРГАНИЧЕСКАЯ ОПТИКА МЕМБРАНЫ BREACH LENS И СИНГУЛЯРНОСТЬ ФАЗЫ 05
//   - Подраздел 4.1. Рендеринг апертуры BREACH LENS, геодезической сетки X-RAY,
//                    микротрещин и суб-нейронных токов Z4 со сжатием в точку в Акте B
//                    (renderBreachLensAndSubQuantumZ4).
//   - Подраздел 4.2. Рендеринг бесконтурных парящих выносок узлов
//                    (renderBorderlessNodeCallout).
//   - Подраздел 4.3. Рендеринг 7-оболочечной короны «Кошачьего глаза» NGC 6543,
//                    Чёрной дыры и её полного сжатия в Точку Нуля
//                    (renderSingularityCoronaAndBlackHole).
//   - Подраздел 4.4. Рендеринг импульса центральной микро-точки перед вылетом визитки
//                    (renderZeroSilenceActC).
//
// РАЗДЕЛ 5. РЕНДЕРИНГ БАРАБАНОВ КВАНТОВОГО ОДОМЕТРА НА ХОЛСТЕ (АКТ D — LAYER 5)
//   - Подраздел 5.1. Отрисовка разлёта символов из центральной точки и бесшовная
//                    передача эстафеты видимой DOM-визитке (renderCipherOdometerStage).
//
// РАЗДЕЛ 6. ЗАЩИЩЁННЫЙ ГЛАВНЫЙ ЦИКЛ RAF И УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
//   - Подраздел 6.1. Методы запуска и остановки рендерера (start, stop).
//   - Подраздел 6.2. Защищённый цикл кадра loop (try / catch / finally) с единой
//                    точкой продвижения часов и защитой от остановки RAF.
//
// РАЗДЕЛ 7. ИНВЕРСНЫЙ КВАНТОВЫЙ ПЕРЕБОР УГЛОВЫХ ПАНЕЛЕЙ И ОРКЕСТРАТОР DOM
//   - Подраздел 7.1. Функции управления каноническим текстом и плавным перебором
//                    соседних элементов (setCanonicalElementText, stopElementScramble,
//                    startNeighborElementScramble, bindCornerPanelsNeighborScramble).
//   - Подраздел 7.2. Синхронизация элементов HUD с состоянием хранилища (syncHudDomWithState).
//   - Подраздел 7.3. Главная функция клиентской инициализации (bootstrapUniverseV2).
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
import { publishVisualSignals } from '../core/visualSignals';
import { calmGlyphHover } from '../core/glyphHover';
import { GLYPH_FONT_STACK } from '../core/glyphGrammar';
import { DeterministicPRNG } from '../core/prng';
import { mountLayer2Metrics } from '../layers/Layer2_Metrics';
import { mountLayer3Topology } from '../layers/Layer3_Topology';
import { mountLayer4Terminal } from '../layers/Layer4_Terminal';
import { mountLayer5CipherFinale } from '../layers/Layer5_CipherFinale';

// ============================================================================
// РАЗДЕЛ 1. МАТЕМАТИЧЕСКИЕ УТИЛИТЫ, ШУМОВЫЕ ПОЛЯ И СТРУКТУРЫ ФОНОВЫХ ЯВЛЕНИЙ
// ============================================================================

const TAU = Math.PI * 2;

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 1.1. БАЗОВЫЕ ФУНКЦИИ ИНТЕРПОЛЯЦИИ И ОГРАНИЧЕНИЯ
// ----------------------------------------------------------------------------

// --- НАЧАЛО ФУНКЦИИ clamp ---
/**
 * Ограничивает числовое значение v заданным диапазоном [min, max].
 */
function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}
// --- КОНЕЦ ФУНКЦИИ clamp ---

// --- НАЧАЛО ФУНКЦИИ lerp ---
/**
 * Выполняет линейную интерполяцию между значениями a и b по коэффициенту t.
 */
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}
// --- КОНЕЦ ФУНКЦИИ lerp ---

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 1.2. ДЕТЕРМИНИРОВАННЫЙ 2D-ШУМ И ФРАКТАЛЬНОЕ БРОУНОВСКОЕ ДВИЖЕНИЕ
// ----------------------------------------------------------------------------

// --- НАЧАЛО ФУНКЦИИ hash2D ---
/**
 * Детерминированный целочисленный 2D-хеш для генерации решётки градиентного шума.
 * Возвращает значение в полуинтервале [0.0, 1.0).
 */
function hash2D(ix: number, iy: number): number {
    let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) >>> 0;
    n = (n ^ (n >>> 13)) >>> 0;
    n = Math.imul(n, 1274126177) >>> 0;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
}
// --- КОНЕЦ ФУНКЦИИ hash2D ---

// --- НАЧАЛО ФУНКЦИИ valueNoise2D ---
/**
 * Вычисляет сглаженный двумерный шум (Value Noise) в точке (x, y)
 * с кубической интерполяцией Эрмита. Возвращает значение в диапазоне [-1.0, 1.0].
 */
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
// --- КОНЕЦ ФУНКЦИИ valueNoise2D ---

// --- НАЧАЛО ФУНКЦИИ fbm2D ---
/**
 * Вычисляет многооктавный фрактальный броуновский шум (FBM) для органической
 * деформации колец светового эха RS Puppis, пылевых облаков M31 и контура линзы.
 */
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
// --- КОНЕЦ ФУНКЦИИ fbm2D ---

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 1.3. ИНТЕРФЕЙСЫ ФОНОВЫХ ЯВЛЕНИЙ (M31, CURL-СИГНАЛЫ, ЭШЕЛОН Z4)
// ----------------------------------------------------------------------------

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
 * вдоль бездивергентных линий тока RK2 Curl-Noise.
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
// РАЗДЕЛ 2. КЛАСС ГЛАВНОГО РЕНДЕРЕРА (UniverseRenderer) — ИНИЦИАЛИЗАЦИЯ И СОСТОЯНИЕ
// ============================================================================

export class UniverseRenderer {
    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.1. ПОЛЯ КЛАССА И КОНСТРУКТОР UniverseRenderer
    // ------------------------------------------------------------------------
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
    private lastCycleCount = 1;
    private consecutiveFrameErrors = 0;

    // --- НАЧАЛО ФУНКЦИИ constructor (UniverseRenderer) ---
    constructor(canvas: HTMLCanvasElement) {
        this.pipeline = new RenderPipeline(canvas);
        const caps = this.pipeline.getCapabilities();
        this.width = caps.viewportWidth;
        this.height = caps.viewportHeight;

        this.simulation = new VoidPhaseSimulation(this.width, this.height);

        const initialState = universeStore.getState();
        this.lastSeed = initialState.seed;
        this.lastCycleCount = initialState.cycleCount;
        this.lastTrackedPhase = initialState.currentPhase;
        this.lastTrackedAct = initialState.singularityAct;

        this.initProceduralBackgroundFields(initialState.seed);
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (UniverseRenderer) ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.2. ГЕНЕРАЦИЯ ПРОЦЕДУРНЫХ ФОНОВЫХ ПОЛЕЙ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ initProceduralBackgroundFields ---
    /**
     * Инициализирует детерминированные спиральные облака пыли M31/NGC 3169,
     * редкие криволинейные квантовые сигналы и суб-квантовую сеть Z4 от текущего seed.
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
    // --- КОНЕЦ ФУНКЦИИ initProceduralBackgroundFields ---

    // --- НАЧАЛО ФУНКЦИИ spawnCurvedFieldSignal ---
    /**
     * Создаёт одиночный криволинейный полевой сигнал на одной из 4 границ экрана.
     */
    private spawnCurvedFieldSignal(rng: DeterministicPRNG): CurvedFieldSignal {
        const side = rng.nextU32() % 4;
        let xNorm: number;
        let yNorm: number;
        let angle: number;

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
    // --- КОНЕЦ ФУНКЦИИ spawnCurvedFieldSignal ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 2.3. ДОСТУП К ДАННЫМ СИМУЛЯЦИИ, ОБРАБОТКА RESIZE И УКАЗАТЕЛЯ МЫШИ
    // ------------------------------------------------------------------------

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

    // --- НАЧАЛО ФУНКЦИИ stepBackgroundFields ---
    /**
     * Интегрирует движение фоновых криволинейных сигналов RK2 Curl-Noise
     * и узлов глубинной суб-квантовой решётки Z4.
     */
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
    // --- КОНЕЦ ФУНКЦИИ stepBackgroundFields ---

    // ============================================================================
    // РАЗДЕЛ 3. ПОЛЕВОЙ И АСТРОФИЗИЧЕСКИЙ РЕНДЕРИНГ ФАЗ 01–05
    // ============================================================================

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.1. ГЛАВНЫЙ ДИСПЕТЧЕР КАДРА (renderFrame)
    // ------------------------------------------------------------------------

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

        // Короткий 0.45-секундный импульс максимального сжатия в Точке Нуля (Акт C)
        // непосредственно перед вылетом из неё визитки DUBNOV ALEXEY
        if (phase === '05_SINGULARITY' && act === 'ACT_C_ZERO_SILENCE') {
            ctx.save();
            ctx.globalAlpha = 0.36;
            this.renderSpiralDustAndCanyons(
                ctx,
                cx,
                cy,
                minSide * zoom,
                simTimeSec,
                phase,
                audioSnap
            );
            this.renderCurvedFieldSignals(ctx, cx, cy, w, h, simTimeSec);
            ctx.restore();

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
            ? Math.max(0.32, 1.0 - state.githubCardAssemblyProgress * 0.58)
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

        // 10. Квантовый одометр на холсте (разлёт символов из Точки Нуля в Акте D)
        if (isOdometerStage) {
            this.renderCipherOdometerStage(ctx, w, h, state);
        }

        ctx.restore();
        integrationRegistry.recordModuleStep(
            'canvas2d-render',
            performance.now() - renderStartMs
        );
    }
    // --- КОНЕЦ ФУНКЦИИ renderFrame ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.2. РЕНДЕРИНГ ДЫШАЩИХ КОЛЕЦ СВЕТОВОГО ЭХА ЦЕФЕИДЫ RS КОРМЫ (01_VOID)
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderBreathingLightEchoRings ---
    /**
     * Отрисовывает нестабильные, живо дышащие концентрические кольца светового эха
     * переменной звезды RS Puppis с угловой модуляцией FBM и притяжением к сгусткам энергии.
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
    // --- КОНЕЦ ФУНКЦИИ renderBreathingLightEchoRings ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.3. РЕНДЕРИНГ СПИРАЛЬНЫХ ОБЛАКОВ ПЫЛИ И КАНЬОНОВ M31 / NGC 3169
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderSpiralDustAndCanyons ---
    /**
     * Отрисовывает многослойные спиралевидные газопылевые облака, тёмные каньоны поглощения
     * света (#020308) и контровой свет Rim Light (#7DD3FC) с модуляцией от баса музыки.
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
    // --- КОНЕЦ ФУНКЦИИ renderSpiralDustAndCanyons ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.4. РЕНДЕРИНГ КРИВОЛИНЕЙНЫХ ПОЛЕВЫХ СИГНАЛОВ RK2 CURL-NOISE
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderCurvedFieldSignals ---
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
    // --- КОНЕЦ ФУНКЦИИ renderCurvedFieldSignals ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.5. РЕНДЕРИНГ 5 КЕПЛЕРОВСКИХ КОЛЕЦ И ПОЛУШАРИЙ МОЗГА (03 / 04)
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderCorticalHemispheresAndKeplerRings ---
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
            const lobeGrad = ctx.createRadialGradient(
                lobeX,
                cy,
                lobeR * 0.08,
                lobeX,
                cy,
                lobeR
            );
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
    // --- КОНЕЦ ФУНКЦИИ renderCorticalHemispheresAndKeplerRings ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.6. РЕНДЕРИНГ КРИВЫХ ГРАФА NEXUS И КОМЕТ СИНАПТИЧЕСКИХ ИМПУЛЬСОВ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderTopologyEdgesAndPulses ---
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
                        : 0.42;

        ctx.save();

        for (let i = 0; i < edges.length; i++) {
            const e = edges[i];
            if (e.arcLength < 8.0) continue;

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
    // --- КОНЕЦ ФУНКЦИИ renderTopologyEdgesAndPulses ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 3.7. РЕНДЕРИНГ ЧАСТИЦ, СОМ НЕЙРОНОВ И БОКЕ ПО ЭШЕЛОНАМ Z0..Z3
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderMultiEchelonParticles ---
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
                0.08,
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
                    RenderPipeline.hexToRgba(
                        haloColor,
                        alpha * (isExcitedSoma ? 0.62 : 0.36)
                    )
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
    // --- КОНЕЦ ФУНКЦИИ renderMultiEchelonParticles ---

    // ============================================================================
    // РАЗДЕЛ 4. ОРГАНИЧЕСКАЯ ОПТИКА МЕМБРАНЫ BREACH LENS И СИНГУЛЯРНОСТЬ ФАЗЫ 05
    // ============================================================================

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 4.1. РЕНДЕРИНГ АПЕРТУРЫ BREACH LENS, СЕТКИ X-RAY И СЕТИ Z4
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderBreachLensAndSubQuantumZ4 ---
    /**
     * Отрисовывает мембрану BREACH LENS, криволинейные геодезические клеточки рентгена,
     * микротрещины и глубинный суб-квантовый слой Z4 («обратную сторону Вселенной»).
     * ИСПРАВЛЕНО: В Акте B (ACT_B_LOGIC) радиус схождения оптики сжимается строго в 0 px
     * вместе с Чёрной дырой, поэтому на экране никогда не застревает гигантский статичный круг.
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
        const userFullXRay = state.layers.layer5_truthXRayMode;
        const isLogicActB =
            state.currentPhase === '05_SINGULARITY' &&
            state.singularityAct === 'ACT_B_LOGIC';

        // В Акте D (во время показа визитки) линза рентгена отключена, если пользователь
        // явно не включил кнопку X-RAY и не зажимает кнопку мыши
        if (
            state.currentPhase === '05_SINGULARITY' &&
            (state.singularityAct === 'ACT_D_GITHUB_CARD' ||
                state.singularityAct === 'RESTART_COLLAPSE') &&
            !userFullXRay &&
            !sState.isBreaching
        ) {
            return;
        }

        let activeRadius = sState.currentBreachRadius;
        let revealStrength = Math.max(
            sState.revealIntensity,
            sState.isPointerInside ? 0.42 : 0.0
        );

        if (userFullXRay) {
            activeRadius = Math.min(w, h) * 0.44;
            revealStrength = 0.88;
        } else if (isLogicActB) {
            // Плавное сжатие радиуса оптического кольца из 42% экрана строго в 0 px (Точку Нуля)
            const collapseT = smootherstep(0.05, 0.98, state.singularityActProgress);
            const shrinkEnv = Math.pow(1.0 - collapseT, 1.85);
            activeRadius = Math.max(
                sState.currentBreachRadius,
                Math.min(w, h) * 0.42 * shrinkEnv
            );
            revealStrength = Math.max(
                revealStrength,
                Math.sin(collapseT * Math.PI) * 0.78
            );
        }

        if (activeRadius < 5.0 || revealStrength < 0.02) {
            return;
        }

        const useCenterLock = (userFullXRay || isLogicActB) && !sState.isPointerInside;
        const lx = useCenterLock ? cx : sState.lensX;
        const ly = useCenterLock ? cy : sState.lensY;

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
                const deformedR =
                    userFullXRay || isLogicActB
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
                    ctx.strokeStyle = RenderPipeline.hexToRgba(
                        '#38bdf8',
                        localMask * 0.48
                    );
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
    // --- КОНЕЦ ФУНКЦИИ renderBreachLensAndSubQuantumZ4 ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 4.2. РЕНДЕРИНГ БЕСКОНТУРНЫХ ВЫНОСОК УЗЛОВ (renderBorderlessNodeCallout)
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderBorderlessNodeCallout ---
    /**
     * Отрисовывает парящую инженерную выноску узла (ID + ссылка на модуль) без прямоугольной рамки.
     */
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
            `ID#${String(pt.id).padStart(3, '0')} [ref:${pt.moduleTag}]`,
            labelX,
            labelY
        );

        ctx.restore();
    }
    // --- КОНЕЦ ФУНКЦИИ renderBorderlessNodeCallout ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 4.3. РЕНДЕРИНГ КОРОНЫ «КОШАЧЬЕГО ГЛАЗА» NGC 6543 И ЧЁРНОЙ ДЫРЫ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderSingularityCoronaAndBlackHole ---
    /**
     * Отрисовывает 7-оболочечную корону туманности «Кошачьего глаза» (NGC 6543),
     * допплеровский аккреционный диск и тень горизонта событий Чёрной дыры в фазе 05_SINGULARITY.
     * В Акте A вырастает из Точки Нуля, а в Акте B непрерывно сжимается в яркую микро-точку.
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
        if (act === 'ACT_D_GITHUB_CARD') {
            return;
        }

        ctx.save();

        let volumeEnvelope = 1.0;
        let opacityEnvelope = 1.0;

        if (act === 'ACT_A_ACCRETION' || act === 'NONE' || act === 'INACTIVE') {
            const birthCurve = smootherstep(0.0, 0.44, actProgress);
            volumeEnvelope = 0.015 + 0.985 * birthCurve;
            opacityEnvelope = smootherstep(0.0, 0.24, actProgress);
        } else if (act === 'ACT_B_LOGIC') {
            const smoothCollapse = smootherstep(0.05, 0.98, actProgress);
            volumeEnvelope = Math.max(0.008, Math.pow(1.0 - smoothCollapse, 1.95));
            opacityEnvelope = 1.0 - smootherstep(0.82, 1.0, smoothCollapse) * 0.4;
        } else if (act === 'RESTART_COLLAPSE') {
            volumeEnvelope = Math.max(0.0, 0.16 * (1.0 - actProgress));
            opacityEnvelope = Math.max(0.0, 1.0 - actProgress);
        }

        if (opacityEnvelope <= 0.005 || volumeEnvelope <= 0.002) {
            ctx.restore();
            return;
        }

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
                0.34
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

        const fullShadowR = scale * 0.068;
        const shadowR = fullShadowR * volumeEnvelope;
        const photonOuterR = Math.max(2.4, shadowR * 2.45);

        const photonGrad = ctx.createRadialGradient(
            cx - shadowR * 0.16,
            cy,
            Math.max(0.2, shadowR * 0.65),
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
            RenderPipeline.hexToRgba('#f8fafc', 0.94 * opacityEnvelope)
        );
        photonGrad.addColorStop(
            0.68,
            RenderPipeline.hexToRgba('#7dd3fc', 0.52 * opacityEnvelope)
        );
        photonGrad.addColorStop(
            0.86,
            RenderPipeline.hexToRgba('#6366f1', 0.24 * opacityEnvelope)
        );
        photonGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = photonGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, photonOuterR, 0, TAU);
        ctx.fill();

        if (shadowR > 1.2) {
            ctx.fillStyle = `rgba(2, 3, 8, ${opacityEnvelope.toFixed(3)})`;
            ctx.beginPath();
            ctx.arc(cx, cy, shadowR * 0.9, 0, TAU);
            ctx.fill();
        } else {
            // В финале сжатия (когда shadowR <= 1.2 px) загорается яркая жемчужная Точка Нуля
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.arc(cx, cy, 2.6, 0, TAU);
            ctx.fill();
        }

        ctx.restore();
    }
    // --- КОНЕЦ ФУНКЦИИ renderSingularityCoronaAndBlackHole ---

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 4.4. РЕНДЕРИНГ ИМПУЛЬСА ЦЕНТРАЛЬНОЙ МИКРО-ТОЧКИ В АКТЕ C
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderZeroSilenceActC ---
    /**
     * Отрисовывает короткий 0.45-секундный импульс Точки Нуля (Акт C):
     * Чёрная дыра сжалась в яркую жемчужную точку, которая сразу же начинает
     * раскрывать волну рождения визитки DUBNOV ALEXEY без паузы.
     */
    private renderZeroSilenceActC(
        ctx: CanvasRenderingContext2D,
        cx: number,
        cy: number,
        minSide: number,
        _simTimeSec: number
    ): void {
        const uState = universeStore.getState();
        const actProg = clamp(uState.singularityActProgress, 0, 1);

        const pulseArc = Math.sin(actProg * Math.PI);
        const dotR = 2.4 + 3.2 * pulseArc;
        const glowR = dotR * (7.0 + 6.0 * actProg);

        // Сходящееся и тут же расходящееся тонкое кольцо импульса возрождения
        const horizonR = minSide * (0.015 + 0.045 * actProg);
        ctx.strokeStyle = RenderPipeline.hexToRgba('#7dd3fc', 0.36 * (1.0 - actProg * 0.5));
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, Math.max(2.0, horizonR), 0, TAU);
        ctx.stroke();

        const halo = ctx.createRadialGradient(cx, cy, 0.2, cx, cy, glowR);
        halo.addColorStop(0.0, RenderPipeline.hexToRgba('#f8fafc', 0.98));
        halo.addColorStop(0.35, RenderPipeline.hexToRgba('#7dd3fc', 0.54));
        halo.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');

        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(cx, cy, glowR, 0, TAU);
        ctx.fill();

        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.arc(cx, cy, dotR, 0, TAU);
        ctx.fill();
    }
    // --- КОНЕЦ ФУНКЦИИ renderZeroSilenceActC ---

    // ============================================================================
    // РАЗДЕЛ 5. РЕНДЕРИНГ БАРАБАНОВ КВАНТОВОГО ОДОМЕТРА НА ХОЛСТЕ (АКТ D — LAYER 5)
    // ============================================================================

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 5.1. РАЗЛЁТ СИМВОЛОВ ИЗ ТОЧКИ И СИНХРОНИЗАЦИЯ С DOM-ВИЗИТКОЙ
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ renderCipherOdometerStage ---
    /**
     * Отрисовывает атмосферную подложку и 3D-разлёт символов квантового одометра
     * из центральной Точки Нуля (cipherOdometerEngine).
     * По мере фиксации видимой семантической DOM-карточки (Layer5_CipherFinale.tsx)
     * плавно убирает дублирующие символы на Canvas, чтобы текст визитки оставался
     * идеально чётким и никогда не двоился.
     */
    private renderCipherOdometerStage(
        ctx: CanvasRenderingContext2D,
        w: number,
        h: number,
        state: Readonly<UniverseState>
    ): void {
        const assemblyProgress = state.githubCardAssemblyProgress;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        const backdropR = Math.min(w, h) * 0.46;
        const backdropGrad = ctx.createRadialGradient(
            w * 0.5,
            h * 0.5,
            16,
            w * 0.5,
            h * 0.5,
            backdropR
        );
        const veilAlpha = Math.min(1.0, assemblyProgress * 1.35);
        backdropGrad.addColorStop(0.0, `rgba(3, 7, 18, ${(0.76 * veilAlpha).toFixed(3)})`);
        backdropGrad.addColorStop(0.65, `rgba(2, 5, 14, ${(0.48 * veilAlpha).toFixed(3)})`);
        backdropGrad.addColorStop(1.0, 'rgba(2, 3, 8, 0.0)');
        ctx.fillStyle = backdropGrad;
        ctx.fillRect(0, 0, w, h);

        // Когда видимая DOM-визитка развернулась (assemblyProgress >= 0.74),
        // текст отображается чистым DOM-слоем Layer5_CipherFinale.tsx без дублирования на Canvas
        const canvasParticlesFade = 1.0 - smootherstep(0.32, 0.74, assemblyProgress);
        if (canvasParticlesFade <= 0.01) {
            ctx.restore();
            return;
        }

        const cells: OdometerGlyphCellState[] = cipherOdometerEngine.evaluateCells(
            w,
            h,
            assemblyProgress,
            state.reducedMotion
        );

        const ghostTonePool = ['#64748b', '#475569', '#38bdf8', '#94a3b8'];

        for (let i = 0; i < cells.length; i++) {
            const c = cells[i];
            if (c.primaryChar === ' ') continue;

            ctx.save();
            ctx.translate(c.currentX, c.currentY);
            ctx.scale(1.0, c.verticalScale);

            ctx.font = `${c.fontWeight} ${c.fontSizePx.toFixed(1)}px ${GLYPH_FONT_STACK}`;
            const breathAlpha = (c.glyphBreathAlpha ?? 0.92) * canvasParticlesFade;

            if (!c.isLocked) {
                const ghostOffset = c.fontSizePx * 0.72;
                ctx.shadowColor = 'rgba(2, 6, 23, 0.96)';
                ctx.shadowBlur = 12;
                ctx.shadowOffsetY = 3;

                ctx.globalAlpha = 0.28 * breathAlpha;
                ctx.fillStyle =
                    ghostTonePool[(c.charIndex + c.lineIndex) % ghostTonePool.length];
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

            ctx.shadowColor = c.shadowColor || 'rgba(2, 6, 23, 0.95)';
            ctx.shadowBlur = c.shadowBlur ?? 11;
            ctx.shadowOffsetY = c.isLocked ? 2 : 3;

            ctx.globalAlpha = (c.isLocked ? 0.97 : 1.0) * breathAlpha;
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
    // --- КОНЕЦ ФУНКЦИИ renderCipherOdometerStage ---

    // ============================================================================
    // РАЗДЕЛ 6. ЗАЩИЩЁННЫЙ ГЛАВНЫЙ ЦИКЛ RAF И УПРАВЛЕНИЕ ЖИЗНЕННЫМ ЦИКЛОМ
    // ============================================================================

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 6.1. МЕТОДЫ ЗАПУСКА И ОСТАНОВКИ РЕНДЕРЕРА (start, stop)
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ start ---
    /**
     * Запускает главный цикл requestAnimationFrame рендерера.
     */
    public start(): void {
        if (this.isRunning) return;
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

    // ------------------------------------------------------------------------
    // ПОДРАЗДЕЛ 6.2. ЗАЩИЩЁННЫЙ ЦИКЛ КАДРА loop (TRY / CATCH / FINALLY)
    // ------------------------------------------------------------------------

    // --- НАЧАЛО ФУНКЦИИ loop ---
    /**
     * Главный цикл кадра requestAnimationFrame.
     * Обёрнут в защитный блок try / catch / finally, гарантирующий, что даже при
     * возникновении нештатного исключения планировщик requestAnimationFrame продолжит
     * работу и сцена никогда не зависнет на мёртвом кадре.
     */
    private loop = (nowMs: number): void => {
        if (!this.isRunning) return;

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
            const nextSimSec = state.telemetry.simulationTimeSec + simDtSec;
            const nextPhaseElapsed = state.telemetry.phaseElapsedSec + simDtSec;

            // Музыка звучит непрерывно на протяжении всего цикла без принудительного глушения
            const audioSnap = audioSync.updateRealtimeModulation(
                nextSimSec,
                state.currentPhase,
                false
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

            const latestState = universeStore.getState();
            const particles = this.getSimParticles();
            const edges = this.getSimEdges();
            const pulses = this.getSimPulses();
            const caps = this.pipeline.getCapabilities();

            // Сначала продвигаем часы фазы и подакта сингулярности,
            // чтобы renderFrame всегда рисовал актуальный подакт текущего кадра
            if (latestState.singularityAct === 'RESTART_COLLAPSE') {
                universeStore.updateTelemetry({
                    frameTimeMs: Number(rawDtMs.toFixed(1)),
                    simulationTimeSec: Number(nextSimSec.toFixed(3)),
                    phaseElapsedSec: Number(nextPhaseElapsed.toFixed(3)),
                    audioStatus: audioSnap.status,
                    silenceRmsDb: audioSnap.rmsDb,
                });
            } else if (isActiveSim) {
                universeStore.updateTelemetry({
                    frameTimeMs: Number(rawDtMs.toFixed(1)),
                    activeParticles: particles.length,
                    activeConnections: edges.length,
                    activePulses: pulses.length,
                    simulationTimeSec: Number(nextSimSec.toFixed(3)),
                    phaseElapsedSec: Number(nextPhaseElapsed.toFixed(3)),
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

            publishVisualSignals(universeStore.getState(), audioSnap, stressStore.getState());
            this.renderFrame(nextSimSec, universeStore.getState(), audioSnap);
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
            if (this.isRunning) {
                this.rafId = requestAnimationFrame(this.loop);
            }
        }
    };
    // --- КОНЕЦ ФУНКЦИИ loop ---
}

export let activeRenderer: UniverseRenderer | null = null;

// --- НАЧАЛО ФУНКЦИИ getUniverseRenderer ---
/**
 * Возвращает активный экземпляр рендерера Вселенной.
 */
export function getUniverseRenderer(): UniverseRenderer | null {
    return activeRenderer;
}
// --- КОНЕЦ ФУНКЦИИ getUniverseRenderer ---

// ============================================================================
// РАЗДЕЛ 7. ИНВЕРСНЫЙ КВАНТОВЫЙ ПЕРЕБОР УГЛОВЫХ ПАНЕЛЕЙ И ОРКЕСТРАТОР DOM
// ============================================================================

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 7.1. УПРАВЛЕНИЕ КАНОНИЧЕСКИМ ТЕКСТОМ И ПЕРЕБОРОМ СОСЕДНИХ ЭЛЕМЕНТОВ
// ----------------------------------------------------------------------------

// --- НАЧАЛО ФУНКЦИИ setCanonicalElementText ---
/**
 * Передаёт канонический текст общему контроллеру с сохранением доступного имени.
 */
function setCanonicalElementText(el: HTMLElement | null, nextText: string): void {
    calmGlyphHover.setCanonical(el, nextText);
}
// --- КОНЕЦ ФУНКЦИИ setCanonicalElementText ---

// --- НАЧАЛО ФУНКЦИИ stopElementScramble ---
/**
 * Мгновенно останавливает квантовый перебор на элементе и возвращает его точный текст.
 */
function stopElementScramble(el: HTMLElement): void {
    calmGlyphHover.stop(el);
}
// --- КОНЕЦ ФУНКЦИИ stopElementScramble ---

// --- НАЧАЛО ФУНКЦИИ startNeighborElementScramble ---
/**
 * Включает спокойный фазовый перебор соседа на общем такте визуальных сигналов.
 */
function startNeighborElementScramble(el: HTMLElement, siblingIndex: number): void {
    const canonical = el.dataset.canonicalText ?? el.textContent ?? '';
    calmGlyphHover.start(el, canonical, siblingIndex);
}
// --- КОНЕЦ ФУНКЦИИ startNeighborElementScramble ---

// --- НАЧАЛО ФУНКЦИИ bindCornerPanelsNeighborScramble ---
/**
 * Привязывает ко всем угловым панелям (.brand-card, #ui-phase-buttons, .controls-dock)
 * инверсный отклик: элемент под курсором мыши мгновенно фиксируется и стоит на месте,
 * а соседние элементы в его группе мягко перебираются.
 */
function bindCornerPanelsNeighborScramble(): void {
    if (typeof document === 'undefined') return;

    const groups = [
        { root: '.brand-card', items: '.phase-codename, .phase-title, .phase-subtitle, .phase-philosophy' },
        { root: '#ui-phase-buttons', items: 'button.phase-pill' },
        { root: '.controls-dock', items: 'button.btn-cyber, a.btn-cyber' },
    ];

    groups.forEach(({ root: rootSelector, items: itemSelector }) => {
        const group = document.querySelector<HTMLElement>(rootSelector);
        if (!group) return;

        const items = Array.from(group.querySelectorAll<HTMLElement>(itemSelector));
        const listeners = new AbortController();
        const stopGroup = (): void => items.forEach(stopElementScramble);
        let listenerCount = 0;

        items.forEach((el) => {
            setCanonicalElementText(el, el.dataset.canonicalText ?? el.textContent ?? '');
            const activateNeighbors = (): void => {
                stopElementScramble(el);
                items.forEach((sibling, sIdx) => {
                    if (sibling !== el) startNeighborElementScramble(sibling, sIdx);
                });
            };
            el.addEventListener('pointerenter', activateNeighbors, { signal: listeners.signal });
            el.addEventListener('focusin', activateNeighbors, { signal: listeners.signal });
            listenerCount += 2;
        });

        group.addEventListener('pointerleave', stopGroup, { signal: listeners.signal });
        group.addEventListener('focusout', (event: FocusEvent) => {
            if (!(event.relatedTarget instanceof Node) || !group.contains(event.relatedTarget)) {
                stopGroup();
            }
        }, { signal: listeners.signal });
        listenerCount += 2;

        resourceLedger.trackPageLifetimeAllocation('listeners', listenerCount);
        resourceLedger.registerPageDisposable(() => {
            listeners.abort();
            stopGroup();
            resourceLedger.trackRelease('listeners', listenerCount);
        });
    });
}
// --- КОНЕЦ ФУНКЦИИ bindCornerPanelsNeighborScramble ---

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 7.2. СИНХРОНИЗАЦИЯ ЭЛЕМЕНТОВ HUD С СОСТОЯНИЕМ ХРАНИЛИЩА
// ----------------------------------------------------------------------------

// --- НАЧАЛО ФУНКЦИИ syncHudDomWithState ---
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
    const unlockBanner = document.getElementById('ui-audio-unlock-banner');
    if (unlockBanner) {
        const isWaitingGesture =
            state.audioEnabled && state.telemetry.audioStatus === 'AWAITING_GESTURE';
        unlockBanner.classList.toggle('hidden', !isWaitingGesture);
    }
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
// --- КОНЕЦ ФУНКЦИИ syncHudDomWithState ---

// ----------------------------------------------------------------------------
// ПОДРАЗДЕЛ 7.3. ГЛАВНАЯ ФУНКЦИЯ КЛИЕНТСКОЙ ИНИЦИАЛИЗАЦИИ (bootstrapUniverseV2)
// ----------------------------------------------------------------------------

// --- НАЧАЛО ФУНКЦИИ bootstrapUniverseV2 ---
/**
 * Точка входа клиентской графической подсистемы: инициализирует холст #universe-canvas,
 * монтирует реактивные острова телеметрии Layer 2–5, привязывает кнопки управления,
 * активирует инверсный перебор соседних элементов в угловых панелях и запускает цикл симуляции.
 * Подписки UI регистрируются как страничные (registerPageDisposable), чтобы оставаться
 * активными после любого числа перезапусков Restart Universe.
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

    // 2. Подписываем обновление верхнего паспорта фазы и нижнего дока кнопок на UniverseStore
    const unsubHud = universeStore.subscribe((nextState: Readonly<UniverseState>) => {
        syncHudDomWithState(nextState);
    });
    syncHudDomWithState(universeStore.getState());

    const ledgerWithPage = resourceLedger as unknown as {
        registerPageDisposable?: (fn: () => void) => void;
    };
    if (ledgerWithPage.registerPageDisposable) {
        ledgerWithPage.registerPageDisposable(unsubL2);
        ledgerWithPage.registerPageDisposable(unsubL3);
        ledgerWithPage.registerPageDisposable(unsubL4);
        ledgerWithPage.registerPageDisposable(unsubL5);
        ledgerWithPage.registerPageDisposable(unsubHud);
    }

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
    document.getElementById('ui-audio-unlock-banner')?.addEventListener('click', () => {
        audioSync.startPlayback(true);
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

    // --- НАЧАЛО ФУНКЦИИ handleVisibilityChange (bootstrapUniverseV2) ---
    const handleVisibilityChange = (): void => {
        // Браузер может приостановить RAF до публикации скрытого кадра.
        if (document.hidden) calmGlyphHover.stopAll();
        universeStore.setTabHidden(document.hidden);
    };
    // --- КОНЕЦ ФУНКЦИИ handleVisibilityChange (bootstrapUniverseV2) ---
    document.addEventListener('visibilitychange', handleVisibilityChange);
    resourceLedger.trackPageLifetimeAllocation('listeners', 1);
    resourceLedger.registerPageDisposable(() => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        calmGlyphHover.stopAll();
        resourceLedger.trackRelease('listeners', 1);
    });

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
// --- КОНЕЦ ФУНКЦИИ bootstrapUniverseV2 ---

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapUniverseV2);
    } else {
        bootstrapUniverseV2();
    }
}

export default UniverseRenderer;
