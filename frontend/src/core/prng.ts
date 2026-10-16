// noinspection SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/core/prng.ts
// НАЗНАЧЕНИЕ: Детерминированный генератор случайных чисел (Mulberry32 / SplitMix32)
//             и вычислитель контрольной суммы состояния State Digest (FNV-1a 32-bit)
// ЗАДАЧИ ФАЙЛА:
// 1. Обеспечить 100% воспроизводимую последовательность случайных чисел от seed (u32).
// 2. Предоставить проверку по эталонным golden-векторам для паритета TS <-> Rust <-> Python.
// 3. Вычислять 32-битный State Digest по квантованным координатам и скоростям сущностей,
//    доказывая, что ILLUSION, NEXUS и X-RAY читают один и тот же буфер состояния.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. ДЕТЕРМИНИРОВАННЫЙ ГЕНЕРАТОР ПСЕВДОСЛУЧАЙНЫХ ЧИСЕЛ (SPLITMIX32)
// Алгоритм использует 32-битную целочисленную арифметику Math.imul, что гарантирует
// побитовое совпадение с реализациями на Rust (u32::wrapping_mul) и Python (& 0xFFFFFFFF).
// ----------------------------------------------------------------------------
export class DeterministicPRNG {
    private state: number;

    constructor(seed: number) {
        this.state = seed >>> 0;
        if (this.state === 0) {
            this.state = 0x6d2b79f5;
        }
    }

    // Возвращает следующее беззнаковое 32-битное целое число (u32)
    public nextU32(): number {
        this.state = (this.state + 0x6d2b79f5) >>> 0;
        let z = this.state;
        z = Math.imul(z ^ (z >>> 15), z | 1) >>> 0;
        z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0;
        return (z ^ (z >>> 14)) >>> 0;
    }

    // Возвращает число с плавающей точкой в полуинтервале [0.0, 1.0)
    public nextFloat(): number {
        return this.nextU32() / 4294967296.0;
    }

    // Возвращает число в диапазоне [min, max)
    public nextRange(min: number, max: number): number {
        return min + this.nextFloat() * (max - min);
    }

    // Чистая детерминированная хеш-функция от пары (seed, index) без мутации состояния
    public static hashU32(seed: number, index: number): number {
        let h = ((seed >>> 0) ^ Math.imul(index >>> 0, 0x9e3779b9)) >>> 0;
        h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
        h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
        return (h ^ (h >>> 16)) >>> 0;
    }

    public static hashFloat(seed: number, index: number): number {
        return DeterministicPRNG.hashU32(seed, index) / 4294967296.0;
    }
}

// ----------------------------------------------------------------------------
// 2. ПРОВЕРКА GOLDEN-ВЕКТОРОВ PRNG (ДЛЯ ПАРИТЕТ-ТЕСТОВ MASTER 00B)
// Для стартового seed = 104729 первые 4 значения u32 строго детерминированы.
// ----------------------------------------------------------------------------
export const GOLDEN_SEED = 104729;
export const GOLDEN_U32_VECTORS: ReadonlyArray<number> = [
    2440595534,
    3339150257,
    2107725929,
    4067807368,
];

export function verifyGoldenPrngParity(): boolean {
    const rng = new DeterministicPRNG(GOLDEN_SEED);
    for (let i = 0; i < GOLDEN_U32_VECTORS.length; i++) {
        if (rng.nextU32() !== GOLDEN_U32_VECTORS[i]) {
            return false;
        }
    }
    return true;
}

// ----------------------------------------------------------------------------
// 3. ВЫЧИСЛЕНИЕ КОНТРОЛЬНОЙ СУММЫ СОСТОЯНИЯ (STATE DIGEST — FNV-1a 32-BIT)
// Квантует координаты и скорости с шагом 0.1px, чтобы исключить микро-расхождения
// округления float между платформами, и вычисляет быстрый 32-битный дайджест.
// ----------------------------------------------------------------------------
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function computeQuantizedStateDigest(
    tick: number,
    count: number,
    posBuffer: Float32Array,
    velBuffer: Float32Array,
    energyBuffer: Float32Array,
    stride = 4
): number {
    let hash = FNV_OFFSET_BASIS >>> 0;

    // Включаем номер тика и количество активных тел в начало дайджеста
    hash = Math.imul(hash ^ (tick >>> 0), FNV_PRIME) >>> 0;
    hash = Math.imul(hash ^ (count >>> 0), FNV_PRIME) >>> 0;

    const limit = Math.min(count, Math.floor(posBuffer.length / 3));
    const step = Math.max(1, stride);

    for (let i = 0; i < limit; i += step) {
        const i3 = i * 3;
        const qx = Math.round(posBuffer[i3] * 10) | 0;
        const qy = Math.round(posBuffer[i3 + 1] * 10) | 0;
        const qvx = Math.round(velBuffer[i3] * 10) | 0;
        const qvy = Math.round(velBuffer[i3 + 1] * 10) | 0;
        const qe = Math.round(energyBuffer[i] * 100) | 0;

        hash = Math.imul(hash ^ (qx & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qy & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qvx & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qvy & 0xffff), FNV_PRIME) >>> 0;
        hash = Math.imul(hash ^ (qe & 0xff), FNV_PRIME) >>> 0;
    }

    return hash >>> 0;
}

export function formatDigestHex(digest: number): string {
    return `0x${(digest >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
}