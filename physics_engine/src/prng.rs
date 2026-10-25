// ============================================================================
// ФАЙЛ: physics_engine/src/prng.rs
// НАЗНАЧЕНИЕ: Детерминированные Mulberry32, SplitMix32 и FNV-1a State Digest.
// ОГЛАВЛЕНИЕ:
// 1. DeterministicPrng: new, next_u32, next_f64, next_range_f64 и hash_u32;
//    verify_golden_vectors и эталонные u32-векторы.
// 2. quantize_half_up, compute_quantized_state_digest: квантованный дайджест.
// ============================================================================

#![allow(dead_code)]

pub const GOLDEN_SEED: u32 = 104_729;
pub const GOLDEN_U32_VECTORS: [u32; 4] = [325_253_669, 3_481_002_091, 881_690_241, 2_630_884_050];

// ============================================================================
// --- НАЧАЛО РАЗДЕЛА 1: ДЕТЕРМИНИРОВАННЫЙ PRNG ---
// ============================================================================

#[derive(Clone, Copy, Debug)]
pub struct DeterministicPrng {
    state: u32,
}

impl DeterministicPrng {
    // --- НАЧАЛО ФУНКЦИИ new ---
    pub fn new(seed: u32) -> Self {
        let initial = if seed == 0 { 0x6d2b_79f5 } else { seed };
        Self { state: initial }
    }
    // --- КОНЕЦ ФУНКЦИИ new ---

    // --- НАЧАЛО ФУНКЦИИ next_u32 ---
    pub fn next_u32(&mut self) -> u32 {
        self.state = self.state.wrapping_add(0x6d2b_79f5);
        let mut z = self.state;
        z = (z ^ (z >> 15)).wrapping_mul(z | 1);
        z ^= z.wrapping_add((z ^ (z >> 7)).wrapping_mul(z | 61));
        z ^ (z >> 14)
    }
    // --- КОНЕЦ ФУНКЦИИ next_u32 ---

    /// Match JavaScript range arithmetic before writing into f32 arrays.
    // --- НАЧАЛО ФУНКЦИИ next_f64 ---
    pub fn next_f64(&mut self) -> f64 {
        self.next_u32() as f64 / 4_294_967_296.0
    }
    // --- КОНЕЦ ФУНКЦИИ next_f64 ---

    // --- НАЧАЛО ФУНКЦИИ next_range_f64 ---
    pub fn next_range_f64(&mut self, min_val: f64, max_val: f64) -> f64 {
        min_val + self.next_f64() * (max_val - min_val)
    }
    // --- КОНЕЦ ФУНКЦИИ next_range_f64 ---

    // --- НАЧАЛО ФУНКЦИИ hash_u32 ---
    pub fn hash_u32(seed: u32, index: u32) -> u32 {
        let mut h = seed ^ index.wrapping_mul(0x9e37_79b9);
        h = (h ^ (h >> 16)).wrapping_mul(0x85eb_ca6b);
        h = (h ^ (h >> 13)).wrapping_mul(0xc2b2_ae35);
        h ^ (h >> 16)
    }
    // --- КОНЕЦ ФУНКЦИИ hash_u32 ---
}

// --- НАЧАЛО ФУНКЦИИ verify_golden_vectors ---
pub fn verify_golden_vectors() -> bool {
    let mut rng = DeterministicPrng::new(GOLDEN_SEED);
    for expected in GOLDEN_U32_VECTORS.iter() {
        if rng.next_u32() != *expected {
            return false;
        }
    }
    true
}
// --- КОНЕЦ ФУНКЦИИ verify_golden_vectors ---

// ============================================================================
// --- КОНЕЦ РАЗДЕЛА 1: ДЕТЕРМИНИРОВАННЫЙ PRNG ---
// --- НАЧАЛО РАЗДЕЛА 2: STATE DIGEST ---
// ============================================================================

const FNV_OFFSET_BASIS: u32 = 0x811c_9dc5;
const FNV_PRIME: u32 = 0x0100_0193;

#[inline]
// --- НАЧАЛО ФУНКЦИИ quantize_half_up ---
pub fn quantize_half_up(val: f32) -> i32 {
    (val + 0.5_f32).floor() as i32
}
// --- КОНЕЦ ФУНКЦИИ quantize_half_up ---

// --- НАЧАЛО ФУНКЦИИ compute_quantized_state_digest ---
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

    let limit = count
        .min(pos.len() / 3)
        .min(vel.len() / 3)
        .min(energy.len());
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
// --- КОНЕЦ ФУНКЦИИ compute_quantized_state_digest ---
// --- КОНЕЦ РАЗДЕЛА 2: STATE DIGEST ---
