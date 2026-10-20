// ============================================================================
// ФАЙЛ: physics_engine/src/prng.rs
// НАЗНАЧЕНИЕ: Детерминированный PRNG и хеш State Digest (FNV-1a 32-bit, v2.3)
// АРХИТЕКТУРНЫЕ РАЗДЕЛЫ МОДУЛЯ (ДЛЯ ТЕХНИЧЕСКОГО ОБСЛУЖИВАНИЯ):
// 1. Генератор псевдослучайных чисел DeterministicPrng: побитово идентичная
//    с TypeScript (frontend/src/core/prng.ts) и Python (backend/core/prng.py)
//    последовательность случайных чисел u32.
// 2. Эталонные векторы GOLDEN_U32_VECTORS при GOLDEN_SEED = 104_729 и функция
//    проверки паритета verify_golden_vectors().
// 3. Вычисление 32-битного FNV-1a дайджеста квантованного состояния симуляции
//    с единым правилом округления (val + 0.5).floor() as i32.
// ============================================================================

#![allow(dead_code)]

pub const GOLDEN_SEED: u32 = 104_729;
pub const GOLDEN_U32_VECTORS: [u32; 4] = [
    325_253_669,
    3_481_002_091,
    881_690_241,
    2_630_884_050,
];

// ============================================================================
// РАЗДЕЛ 1. СТРУКТУРА ГЕНЕРАТОРА ПСЕВДОСЛУЧАЙНЫХ ЧИСЕЛ DETERMINISTIC PRNG
// ============================================================================

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

pub fn verify_golden_vectors() -> bool {
    let mut rng = DeterministicPrng::new(GOLDEN_SEED);
    for expected in GOLDEN_U32_VECTORS.iter() {
        if rng.next_u32() != *expected {
            return false;
        }
    }
    true
}

// ============================================================================
// РАЗДЕЛ 2. ВЫЧИСЛЕНИЕ КОНТРОЛЬНОЙ СУММЫ СОСТОЯНИЯ (FNV-1a 32-BIT STATE DIGEST)
// ============================================================================

const FNV_OFFSET_BASIS: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;

#[inline]
pub fn quantize_half_up(val: f32) -> i32 {
    (val + 0.5_f32).floor() as i32
}

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

    let limit = count.min(pos.len() / 3).min(vel.len() / 3).min(energy.len());
    let step = stride.max(1);

    let mut i = 0;
    while i < limit {
        let i3 = i * 3;
        let qx = quantize_half_up(pos[i3] * 10.0);
        let qy = quantize_half_up(pos[i3 + 1] * 10.0);
        let qvx = quantize_half_up(vel[i3] * 10.0);
        let qvy = quantize_half_up(vel[i3 + 1] * 10.0);
        let qe = quantize_half_up(energy[i] * 100.0);

        hash = (hash ^ ((qx & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qy & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qvx & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qvy & 0xffff) as u32)).wrapping_mul(FNV_PRIME);
        hash = (hash ^ ((qe & 0xff) as u32)).wrapping_mul(FNV_PRIME);

        i += step;
    }

    hash
}