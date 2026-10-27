// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/engine/backgroundFields.ts
// НАЗНАЧЕНИЕ: Детерминированное состояние пылевых облаков, полевых сигналов и глубинной сети Z4.
// РАЗДЕЛЫ:
//   1. Контракты фоновых явлений.
//   2. Хранилища и стабильные представления массивов.
//   3. Генерация и продвижение фоновых полей.
// ФУНКЦИИ: clouds, signals, nodes, reset, spawnCurvedFieldSignal, step.
// ============================================================================
import { DeterministicPRNG } from '../core/prng';
import { TAU, valueNoise2D } from './math/noise2d';

// НАЧАЛО РАЗДЕЛА 1. КОНТРАКТЫ ФОНОВЫХ ЯВЛЕНИЙ
/**
 * Спиралевидное газопылевое облако или тёмный каньон поглощения света
 * по астрофизическому прообразу галактик Андромеда (M31) и NGC 3169.
 */
export interface SpiralDustCloud {
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
 * с направлением, изменяемым детерминированным скалярным шумом.
 */
export interface CurvedFieldSignal {
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
export interface SubQuantumNodeZ4 {
    xNorm: number;
    yNorm: number;
    vxNorm: number;
    vyNorm: number;
    phase: number;
    neighbors: number[];
    ctrlBends: number[];
}
// КОНЕЦ РАЗДЕЛА 1. КОНТРАКТЫ ФОНОВЫХ ЯВЛЕНИЙ

export class BackgroundFields {
    // НАЧАЛО РАЗДЕЛА 2. ХРАНИЛИЩА И СТАБИЛЬНЫЕ ПРЕДСТАВЛЕНИЯ
    // Создание экземпляра оставляет массивы пустыми; reset запускает генерацию.
    private readonly spiralClouds: SpiralDustCloud[] = [];
    private readonly fieldSignals: CurvedFieldSignal[] = [];
    private readonly subQuantumZ4: SubQuantumNodeZ4[] = [];

    // --- НАЧАЛО ФУНКЦИИ clouds ---
    public get clouds(): readonly SpiralDustCloud[] {
        return this.spiralClouds;
    }
    // --- КОНЕЦ ФУНКЦИИ clouds ---

    // --- НАЧАЛО ФУНКЦИИ signals ---
    public get signals(): readonly CurvedFieldSignal[] {
        return this.fieldSignals;
    }
    // --- КОНЕЦ ФУНКЦИИ signals ---

    // --- НАЧАЛО ФУНКЦИИ nodes ---
    public get nodes(): readonly SubQuantumNodeZ4[] {
        return this.subQuantumZ4;
    }
    // --- КОНЕЦ ФУНКЦИИ nodes ---
    // КОНЕЦ РАЗДЕЛА 2. ХРАНИЛИЩА И СТАБИЛЬНЫЕ ПРЕДСТАВЛЕНИЯ

    // НАЧАЛО РАЗДЕЛА 3. ГЕНЕРАЦИЯ И ПРОДВИЖЕНИЕ ФОНОВЫХ ПОЛЕЙ
    // --- НАЧАЛО ФУНКЦИИ reset ---
    /**
     * Инициализирует детерминированные спиральные облака пыли M31/NGC 3169,
     * редкие криволинейные квантовые сигналы и суб-квантовую сеть Z4 от текущего seed.
     */
    public reset(seed: number): void {
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
    // --- КОНЕЦ ФУНКЦИИ reset ---

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

    // --- НАЧАЛО ФУНКЦИИ step ---
    /**
     * Интегрирует движение фоновых сигналов с шумовым поворотом направления
     * и узлов глубинной суб-квантовой решётки Z4.
     */
    public step(dtSec: number, simTimeSec: number, seed: number): void {
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
    // --- КОНЕЦ ФУНКЦИИ step ---
    // КОНЕЦ РАЗДЕЛА 3. ГЕНЕРАЦИЯ И ПРОДВИЖЕНИЕ ФОНОВЫХ ПОЛЕЙ
}
