// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/prng.ts
// НАЗНАЧЕНИЕ: Детерминированный генератор псевдослучайных чисел (Mulberry32 / SplitMix32)
//             и вычислитель контрольной суммы состояния State Digest (FNV-1a 32-bit)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Детерминированный ГПСЧ DeterministicPRNG: 32-битная целочисленная арифметика
//    через Math.imul и беззнаковые сдвиги (>>> 0) для побитового совпадения
//    между TypeScript, Rust (u32::wrapping_mul) и Python (& 0xFFFFFFFF).
// 2. Эталонные векторы паритета GOLDEN_U32_VECTORS: верификация первых 4 значений
//    генератора при стартовом зерне GOLDEN_SEED = 104729 для CI-тестов.
// 3. Контрольная сумма состояния State Digest (FNV-1a 32-bit): квантование
//    координат и скоростей через единый оператор Math.floor(v + 0.5), исключающий
//    платформенные различия округления полуцелых чисел между JS, Python и Rust.
// ============================================================================

// ============================================================================
// РАЗДЕЛ 1. ДЕТЕРМИНИРОВАННЫЙ ГЕНЕРАТОР ПСЕВДОСЛУЧАЙНЫХ ЧИСЕЛ (32-BIT)
// ============================================================================

export class DeterministicPRNG {
    private state: number;

    // --- НАЧАЛО ФУНКЦИИ constructor (DeterministicPRNG) ---
    constructor(seed: number) {
        this.state = seed >>> 0;
        if (this.state === 0) {
            this.state = 0x6d2b79f5;
        }
    }
    // --- КОНЕЦ ФУНКЦИИ constructor (DeterministicPRNG) ---

    /**
     * Генерирует следующее беззнаковое 32-битное целое число (uint32).
     */
    // --- НАЧАЛО ФУНКЦИИ nextU32 (DeterministicPRNG) ---
    public nextU32(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let z = this.state;
        z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
        z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0;
        return (z ^ (z >>> 14)) >>> 0;
    }
    // --- КОНЕЦ ФУНКЦИИ nextU32 (DeterministicPRNG) ---

    /**
     * Генерирует число с плавающей точкой двойной точности в полуинтервале [0.0, 1.0).
     */
    // --- НАЧАЛО ФУНКЦИИ nextFloat (DeterministicPRNG) ---
    public nextFloat(): number {
        return this.nextU32() / 4294967296.0;
    }
    // --- КОНЕЦ ФУНКЦИИ nextFloat (DeterministicPRNG) ---

    /**
     * Генерирует число с плавающей точкой в заданном диапазоне [min, max).
     */
    // --- НАЧАЛО ФУНКЦИИ nextRange (DeterministicPRNG) ---
    public nextRange(min: number, max: number): number {
        return min + this.nextFloat() * (max - min);
    }
    // --- КОНЕЦ ФУНКЦИИ nextRange (DeterministicPRNG) ---

    /**
     * Чистая биективная хеш-функция SplitMix32 от пары (seed, index) без мутации состояния.
     */
    // --- НАЧАЛО ФУНКЦИИ hashU32 (DeterministicPRNG) ---
    public static hashU32(seed: number, index: number): number {
        let h = ((seed >>> 0) ^ Math.imul(index >>> 0, 0x9e3779b9)) >>> 0;
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        return (h ^ (h >>> 16)) >>> 0;
    }
    // --- КОНЕЦ ФУНКЦИИ hashU32 (DeterministicPRNG) ---

    /**
     * Чистая детерминированная хеш-функция, возвращающая число в полуинтервале [0.0, 1.0).
     */
    // --- НАЧАЛО ФУНКЦИИ hashFloat (DeterministicPRNG) ---
    public static hashFloat(seed: number, index: number): number {
        return DeterministicPRNG.hashU32(seed, index) / 4294967296.0;
    }
    // --- КОНЕЦ ФУНКЦИИ hashFloat (DeterministicPRNG) ---
}

// ============================================================================
// РАЗДЕЛ 2. ЭТАЛОННЫЕ GOLDEN-ВЕКТОРЫ ПАРИТЕТА (TS <-> RUST <-> PYTHON)
// Для GOLDEN_SEED = 104729 первые 4 значения nextU32() строго равны векторам ниже.
// ============================================================================

export const GOLDEN_SEED = 104729;

export const GOLDEN_U32_VECTORS: ReadonlyArray<number> = [
    325253669,
    3481002091,
    881690241,
    2630884050,
];

// --- НАЧАЛО ФУНКЦИИ verifyGoldenPrngParity ---
export function verifyGoldenPrngParity(): boolean {
    const rng = new DeterministicPRNG(GOLDEN_SEED);
    for (let i = 0; i < GOLDEN_U32_VECTORS.length; i++) {
        if (rng.nextU32() !== GOLDEN_U32_VECTORS[i]) {
            return false;
        }
    }
    return true;
}
// --- КОНЕЦ ФУНКЦИИ verifyGoldenPrngParity ---

// ============================================================================
// РАЗДЕЛ 3. ВЫЧИСЛЕНИЕ КОНТРОЛЬНОЙ СУММЫ СОСТОЯНИЯ (STATE DIGEST — FNV-1a 32-BIT)
// Используется единое правило квантования Math.floor(x + 0.5) для полного
// побитового совпадения с Python и Rust на любых положительных и отрицательных числах.
// ============================================================================

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

// --- НАЧАЛО ФУНКЦИИ quantizeHalfUp ---
export function quantizeHalfUp(val: number): number {
    return Math.floor(val + 0.5) | 0;
}
// --- КОНЕЦ ФУНКЦИИ quantizeHalfUp ---

// --- НАЧАЛО ФУНКЦИИ computeQuantizedStateDigest ---
export function computeQuantizedStateDigest(
    tick: number,
    count: number,
    posBuffer: Float32Array,
    velBuffer: Float32Array,
    energyBuffer: Float32Array,
    stride = 4
): number {
    let hash = FNV_OFFSET_BASIS >>> 0;

    hash = Math.imul(hash ^ (tick >>> 0), FNV_PRIME) >>> 0;
    hash = Math.imul(hash ^ (count >>> 0), FNV_PRIME) >>> 0;

    const limit = Math.min(count, Math.floor(posBuffer.length / 3));
    const step = Math.max(1, stride);

    for (let i = 0; i < limit; i += step) {
        const i3 = i * 3;
        const qx = quantizeHalfUp(posBuffer[i3] * 10.0);
        const qy = quantizeHalfUp(posBuffer[i3 + 1] * 10.0);
        const qvx = quantizeHalfUp(velBuffer[i3] * 10.0);
        const qvy = quantizeHalfUp(velBuffer[i3 + 1] * 10.0);
        const qe = quantizeHalfUp(energyBuffer[i] * 100.0);

        hash = Math.imul(hash ^ (qx & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qy & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qvx & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qvy & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qe & 0xff), FNV_PRIME) >>> 0;
    }

    return hash >>> 0;
}
// --- КОНЕЦ ФУНКЦИИ computeQuantizedStateDigest ---

// --- НАЧАЛО ФУНКЦИИ formatDigestHex ---
export function formatDigestHex(digest: number): string {
    return `0x${(digest >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}
// --- КОНЕЦ ФУНКЦИИ formatDigestHex ---
