// ============================================================================
// ФАЙЛ: physics_engine/src/prng.rs
// НАЗНАЧЕНИЕ: Детерминированный PRNG (SplitMix32) и хеш State Digest (FNV-1a)
// ЗАДАЧИ ФАЙЛА:
// 1. Генерировать побитово идентичную с TypeScript (frontend/src/core/prng.ts)
//    и Python (backend/core/prng.py) последовательность случайных чисел u32.
// 2. Проверять совпадение первых 4 значений с эталонными GOLDEN_U32_VECTORS.
// 3. Вычислять 32-битный FNV-1a дайджест квантованного состояния симуляции.
// ============================================================================

#![allow(dead_code)]

pub const GOLDEN_SEED: u32 = 104_729;
pub const GOLDEN_U32_VECTORS: [u32; 4] = [
    2_440_595_534,
    3_339_150_257,
    2_107_725_929,
    4_067_807_368,
];

// ----------------------------------------------------------------------------
// 1. СТРУКТУРА ГЕНЕРАТОРА ПСЕВДОСЛУЧАЙНЫХ ЧИСЕЛ SPLITMIX32
// ----------------------------------------------------------------------------
#[derive(Clone, Copy, Debug)]
pub struct DeterministicPrng {
    state: u32,
}

impl DeterministicPrng {
    pub fn new(seed: u32) -> Self {
        let initial = if seed == 0 { 0x6d2b_79f5 } else { seed };
        Self { state: initial }
    }

    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut z = self.state;
        z = (z ^ (z >> 15)).wrapping_mul(z | 1);
        z ^= z.wrapping_add((z ^ (z >> 7)).wrapping_mul(z | 61));
        z ^ (z >> 14)
    }

    pub fn next_f32(&mut self) -> f32 {
        (self.next_u32() as f64 / 4_294_967_296.0) as f32
    }

    pub fn next_range(&mut self, min_val: f32, max_val: f32) -> f32 {
        min_val + self.next_f32() * (max_val - min_val)
    }

    pub fn hash_u32(seed: u32, index: u32) -> u32 {
        let mut h = seed ^ index.wrapping_mul(0x9e37_79b9);
        h = (h ^ (h >> 16)).wrapping_mul(0x85eb_ca6b);
        h = (h ^ (h >> 13)).wrapping_mul(0xc2b2_ae35);
        h ^ (h >> 16)
    }
}

// Проверка паритета с эталонными векторами TypeScript
pub fn verify_golden_vectors() -> bool {
    let mut rng = DeterministicPrng::new(GOLDEN_SEED);
    for expected in GOLDEN_U32_VECTORS.iter() {
        if rng.next_u32() != *expected {
            return false;
        }
    }
    true
}

// ----------------------------------------------------------------------------
// 2. ВЫЧИСЛЕНИЕ КОНТРОЛЬНОЙ СУММЫ СОСТОЯНИЯ (FNV-1a 32-BIT STATE DIGEST)
// ----------------------------------------------------------------------------
const FNV_OFFSET_BASIS: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;

pub fn compute_quantized_state_digest(
    tick: u32,
    count: usize,
    pos: &[f32],
    vel: &[f32],
    energy: &[f32],
    stride: usize,
) -> u32 {
    let mut hash = FNV_OFFSET_BASIS;
    hash = (hash ^ tick).wrapping_mul(FNV_PRIME);
    hash = (hash ^ (count as u32)).wrapping_mul(FNV_PRIME);

    let limit = count.min(pos.len() / 3);
    let step = stride.max(1);

    let mut i = 0;
    while i < limit {
        let i3 = i * 3;
        let qx = (pos[i3] * 10.0).round() as i32;
        let qy = (pos[i3 + 1] * 10.0).round() as i32;
        let qvx = (vel[i3] * 10.0).round() as i32;
        let qvy = (vel[i3 + 1] * 10.0).round() as i32;
        let qe = (energy[i] * 100.0).round() as i32;

        hash = (hash ^ ((qx & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qy & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qvx & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qvy & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qe & 0xff) as u32)).wrapping_mul(FNV_PRIME);

        i += step;
    }

    hash
}