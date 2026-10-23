# 📐 Mathematical and Astrophysical Models of UNIVERSE (v2.5)
# 📐 Математические и астрофизические модели проекта UNIVERSE (v2.5)

* **Sections 1–7 (English):** Complete English Mathematical & Astrophysical Specification (v2.5)
* **Разделы 1–7 (Русский):** Полное русскоязычное математическое и астрофизическое руководство (v2.5)

> **Scope & Science-Inspired Art Note:** **UNIVERSE** combines authentic mathematical algorithms implemented directly in code (Mulberry32/SplitMix32 PRNG, FNV-1a quantized state digest, symplectic Velocity Verlet integration, Kuramoto phase coupling, Prim's MST / Gabriel / Murray graph topology, and $C^1$ quartic bell refraction) with science-inspired artistic interpretations of distinct astrophysical objects (**`RS Puppis`** Cepheid light echoes in Phase 01, **`M31 / NGC 3169`** spiral dust lanes in Phase 02, and **`NGC 6543`** "Cat's Eye" planetary nebula shells around a Black Hole in Phase 05).

---

# 🇬🇧 ENGLISH SPECIFICATION

## 1. Deterministic PRNG (`Mulberry32` + `SplitMix32`) & State Digest (`FNV-1a`)

### 1.1. Cross-Language Stream Generator (`Mulberry32`) & Static Hasher (`SplitMix32`)
Implemented identically in `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs`, and `backend/core/prng.py` using 32-bit unsigned arithmetic (`Math.imul` / `wrapping_mul` / `& 0xFFFFFFFF`) seeded from $S_0 = 104729$ (`GOLDEN_SEED`):

1. **Sequential Stream Generator `nextU32()` (Mulberry32):**
   $$S_{k+1} = (S_k + \text{0x6D2B79F5}) \bmod 2^{32}$$
   $$z_1 = \left( S_{k+1} \oplus (S_{k+1} \gg 15) \right) \cdot (S_{k+1} \mid 1) \bmod 2^{32}$$
   $$z_2 = \left( z_1 \oplus \left( z_1 + \left( (z_1 \oplus (z_1 \gg 7)) \cdot (z_1 \mid 61) \right) \right) \right) \bmod 2^{32}$$
   $$\text{nextU32}() = z_2 \oplus (z_2 \gg 14), \quad U_k = \frac{\text{nextU32}()}{2^{32}} \in [0, 1)$$
   At `GOLDEN_SEED = 104729`, the first four `uint32` outputs across TypeScript, Rust, and Python are strictly:
   $$\text{GOLDEN\_U32\_VECTORS} = [325253669, \; 3481002091, \; 881690241, \; 2630884050]$$

2. **Stateless Indexed Hash `hashU32(seed, index)` (SplitMix32):**
   $$h_0 = \text{seed} \oplus (\text{index} \cdot \text{0x9E3779B9} \bmod 2^{32})$$
   $$h_1 = (h_0 \oplus (h_0 \gg 16)) \cdot \text{0x85EBCA6B} \bmod 2^{32}, \quad h_2 = (h_1 \oplus (h_1 \gg 13)) \cdot \text{0xC2B2AE35} \bmod 2^{32}$$
   $$\text{hashU32} = h_2 \oplus (h_2 \gg 16)$$

### 1.2. Real-Time Quantized `FNV-1a` State Digest (`sceneBuffer.ts` / `prng.ts`)
On every simulation frame, after updating `SceneBufferSoA`, coordinates $(x_i, y_i)$, velocities $(v_{x,i}, v_{y,i})$, and energy $E_i$ of every 4th active entity (`stride = 4`) are quantized via the half-up floor rule:

$$q(v) = \lfloor v + 0.5 \rfloor, \quad q_x = q(10 x_i) \ \& \ \text{0xFFFF}, \quad q_{vx} = q(10 v_{x,i}) \ \& \ \text{0xFFFF}, \quad q_E = q(100 E_i) \ \& \ \text{0xFF}$$

These values are folded with `tick` and `activeCount` into a 32-bit Fowler-Noll-Vo (`FNV-1a`) hash (`H_0 = 0x811C9DC5`, `P = 0x01000193`), enforcing optical equivalence across all three views:

$$\text{StateDigest}(\text{ILLUSION}) \equiv \text{StateDigest}(\text{NEXUS}) \equiv \text{StateDigest}(\text{X-RAY})$$

---

## 2. Astrophysical Prototypes & Field Equations (Phases 01, 02, and 05)

### 2.1. Phase 01 (`01_VOID`, `0–17s`): `RS Puppis`-Inspired Light Echo & Deforming Wave Rings
Implemented in `frontend/src/phases/01_void.ts` (`computeVoidChirpTarget`) and `frontend/src/engine/renderer.ts` (`renderBreathingLightEchoRings`).
1. **Chirp & Circular Velocity Anticipation:**
   As the phase progresses ($t \in [0, 17]\text{ s}$), radial ripples transition smoothly via `smootherstep` into rotational anticipation around the central core with angular velocity $\omega_{\text{circ}}(r) \propto \sqrt{M(r) / \max(45, r)}$.
2. **Non-Euclidean Deforming Wave Rings:**
   Seven concentric light-echo rings expand across 24 arcs and 120 angular segments. Each ring's local radius $R_k(\theta, t)$ is perturbed by low-order harmonics ($\sin 2\theta, \cos 3\theta, \sin 5\theta$), 2D Fractional Brownian Motion (`fbm2D`), and local attraction toward nearby high-energy particle clusters.

### 2.2. Phase 02 (`02_GENESIS`, `17–39s`): Logarithmic Spiral Arms & `M31` Dust Canyons
Implemented in `frontend/src/phases/02_genesis.ts` (`computeGenesisTarget`), `renderer.ts` (`renderSpiralDustAndCanyons`), and `illusion.wgsl`.
1. **Continuous 4-Arm Logarithmic Spiral:**
   Using stateless `DeterministicPRNG.hashFloat(id + 104729, 31)`, particles populate 4 continuous logarithmic arms ($b_{\text{pitch}} = 0.325$, disk tilt $-0.17\text{ rad}$), while every 8th particle forms a tidal bridge between two rotating barycenters.
2. **Spiral Dust Clouds & Dark Canyons:**
   On Canvas 2D (`renderer.ts`), 48 procedural dust clouds and dark absorption canyons follow the tilted spiral arms; in the canonical WGSL specification (`illusion.wgsl`), a 5-octave anisotropic FBM with 2-pass domain warping and ridged canyon subtraction models light absorption and `#7DD3FC` rim lighting.

### 2.3. Phase 05 (`05_SINGULARITY`, `79–108s`): `NGC 6543`-Inspired Corona & Analytical Black Hole Optics
Implemented in `frontend/src/phases/05_singularity.ts`, `renderer.ts` (`renderSingularityAccretionAndCorona`), and `backend/core/singularity.py`.
1. **7-Shell Corona & Spiral Collapse to Zero:**
   In Act A (`79.0–87.5s`), 7 concentric harmonic gas shells inspired by the "Cat's Eye" planetary nebula (`NGC 6543`) unfold from the central Zero Point around a tilted accretion disk and twin polar jets. In Act B (`87.5–92.6s`), the radial envelope contracts strictly to zero:
   $$\text{radiusEnvelope}(p_{\text{ActB}}) = \left(1 - S_5(0.05, \; 0.98, \; p_{\text{ActB}})\right)^{1.85} \longrightarrow 0$$
2. **Analytical Gravitational Deflection & Doppler Beaming Approximation:**
   In `backend/core/singularity.py` and `breach.wgsl`, light deflection near Schwarzschild radius $R_s$ is modeled by the analytical first-order Einstein relation $\alpha(b) = \min(2.0, \; 2 R_s / b)$, a Gaussian photon ring around $b \approx 1.48 R_s$, and relativistic Doppler beaming $D^{2.2}$ amplifying the approaching wing of the disk.

---

## 3. Symplectic `Velocity Verlet` Integrator & Kuramoto Synchronization (`gravity.rs` / `wasmBridge.ts`)

### 3.1. Symplectic `Velocity Verlet` (*Kick-Drift-Kick*) & True Energy Drift $\Delta E / E_0$
In both `physics_engine/src/gravity.rs` and `frontend/src/bridge/wasmBridge.ts`, orbital dynamics are integrated in a Plummer-softened gravitational potential ($\varepsilon^2 = 64.0, GM = 4900.0$) with bounded timestep $\Delta t$:
$$\vec{a}(\vec{r}) = -\frac{GM \, \vec{r}}{\left(\|\vec{r}\|^2 + \varepsilon^2\right)^{3/2}}$$
$$\vec{r}_{n+1} = \vec{r}_n + \vec{v}_n \Delta t + \frac{1}{2}\vec{a}(\vec{r}_n)\Delta t^2, \qquad \vec{v}_{n+1} = \vec{v}_n + \frac{1}{2}\left(\vec{a}(\vec{r}_n) + \vec{a}(\vec{r}_{n+1})\right)\Delta t$$

Total mechanical energy $E(t) = \sum \left(\frac{1}{2}\|\vec{v}_i\|^2 - \frac{GM}{\sqrt{\|\vec{r}_i\|^2 + \varepsilon^2}}\right)$ is compared directly against the initial baseline $E_0 = E(0)$ without artificial clamping:

$$\frac{\Delta E}{E_0}(t) = \frac{|E(t) - E_0|}{|E_0|} \quad \left(\frac{\Delta E}{E_0} = 0.0 \text{ at } \Delta t = 0\right)$$

### 3.2. Kuramoto Coupled Oscillator Synchronization (`KURAMOTO r(t)`)
Each oscillator phase $\theta_i(t)$ evolves toward the mean field angle $\psi(t) = \text{atan2}(\sum \sin\theta_j, \sum \cos\theta_j)$:
$$\frac{d\theta_i}{dt} = \omega_i + K(t) \sin\left(\psi(t) - \theta_i(t)\right), \qquad r(t) = \frac{1}{N}\left|\sum_{j=1}^N e^{i\theta_j(t)}\right| \in [0, 1]$$

---

## 4. `NEXUS` Graph Topology: Prim's MST, Gabriel Criterion & Murray's Law (`simulationWorker.ts` / `graph_logic.py`)

In Phase 03 (`39–64s`), `NexusGraphEngine` (`frontend/src/bridge/simulationWorker.ts`) and its Python counterpart (`backend/core/graph_logic.py`) synthesize three edge classes:
1. **Class A (`AXON_TRUNK`):** Greedy Prim's Minimum Spanning Tree across the first $\min(36, N)$ cluster hub nodes (`murrayRadiusPx = 1.95 px`).
2. **Class B (`BRIDGE`):** Inter-cluster edges (`a.clusterId !== b.clusterId`) satisfying the windowed Gabriel empty-ball test (`cdSq >= 0.85 * radiusSq` across neighbors $k \in [i-10, i+10]$).
3. **Class C (`DENDRITE`):** Intra-cluster branches with radius tapering according to Murray's cube law: $r = \text{round2}(1.65 \cdot k_{\text{branch}}^{-1/3})$.
4. **Arc-Length LUT & Sampled BFS Telemetry:** Every quadratic Bezier edge precomputes a 5-point cumulative arc-length table (`buildBezierArcLengthLUT`) so synaptic pulses move at uniform speed. Clustering coefficient $C$ is computed from closed triangles, while graph diameter and average path length are evaluated via Breadth-First Search (`BFS`) from up to 28 evenly spaced source vertices (`sampleStride = max(1, floor(N / 28))` — exact for $N \le 28$, and a fast lower-bound estimate for $N > 28$).

---

## 5. $C^1$-Continuous `BREACH LENS` Refraction, Deep `Z4` Underlay & Living Contours

### 5.1. $C^1$-Continuous Boundary Bell Refraction (`stressState.ts` / `breach_math.rs` / `stress_solver.py`)
Around the deformed lens radius $R_{\text{local}}(\theta, t) = R_L \cdot \text{warp}(\theta, t)$ with normalized radial distance $d = \|\vec{p} - \vec{p}_0\| / R_{\text{local}}$ and ring half-width $w = 0.24$, normalized rim distance is $u = |d - 1.0| / w$. Optical displacement uses the compactly supported quartic bell:

$$g(u) = \begin{cases} (1 - u^2)^2, & u < 1 \\ 0, & u \ge 1 \end{cases}$$

At the ring boundary $u = 1$, $g(1) = 0$ and $g'(1) = 0$, providing a **$C^1$-continuous seam** across $u = 1$ (and $C^\infty$ smoothness inside $u \in (0, 1)$).

---

## 6. Deterministic Bounded Quantum Odometer & Card Heartbeat (`Layer5_CipherFinale.tsx` / `cipherOdometerEngine.ts`)

1. **Bounded Delta-Time Phase Integration (`18.0–26.0 Hz`):**
   To guarantee that the frameless quantum symbol row in Act D (`93.05–108.0s`) spins briskly (`~8–11` character changes per symbol per second), never reverses direction, freezes cleanly when paused, and never accelerates with page uptime, phase is integrated monotonically from frame delta $\Delta t$:
   $$f_{\text{rate}}(t) = \text{clamp}\left(21.5 + 3.2\sin(0.85 t) + 1.8\cos(1.75 t) + 2.5 H_{\text{audio}}, \; 18.0, \; 26.0\right)\text{ Hz}$$
   $$\Phi(t + \Delta t) = \Phi(t) + \Delta t \cdot f_{\text{rate}}(t)$$

---

## 7. Smooth $C^2$ Camera & Phase Morphogenesis Interpolation (`smootherstep`)

All phase transitions and camera envelopes use Perlin's quintic $C^2$-continuous polynomial (`smootherstep`) with zero first and second derivatives at $u \in \{0, 1\}$:

$$S_5(u) = 6 u^5 - 15 u^4 + 10 u^3, \quad S_5'(0) = S_5'(1) = 0, \quad S_5''(0) = S_5''(1) = 0$$

---
---

# 🇷🇺 РУССКОЕ МАТЕМАТИЧЕСКОЕ И АСТРОФИЗИЧЕСКОЕ РУКОВОДСТВО (v2.5)

## 1. Детерминированный ГПСЧ (`Mulberry32` + `SplitMix32`) и хеш состояния `FNV-1a`

### 1.1. Потоковый генератор `Mulberry32` и индексный хеш `SplitMix32`
Реализованы побитово идентично в `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs` и `backend/core/prng.py` на стартовом зерне $S_0 = 104729$ (`GOLDEN_SEED`):
1. **Метод `nextU32()` (алгоритм Mulberry32 с константой `0x6D2B79F5`):**
   Выдаёт на всех трёх языках эталонную четвёрку `GOLDEN_U32_VECTORS = [325253669, 3481002091, 881690241, 2630884050]`.
2. **Чистая функция `hashU32(seed, index)` (биективный скремблер SplitMix32 с константами `0x9E3779B9`, `0x85EBCA6B`, `0xC2B2AE35`):**
   Позволяет получать детерминированные параметры любой частицы по её индексу без мутации глобального состояния генератора.

### 1.2. Квантованный 32-битный дайджест `FNV-1a` (`computeQuantizedStateDigest`)
Для каждой 4-й активной частицы (`stride = 4`) координаты и скорости умножаются на `10.0`, энергия — на `100.0`, округляются по правилу `quantizeHalfUp(v) = floor(v + 0.5)` и сворачиваются с `tick` и `count` в 32-битный хеш `FNV-1a` (`0x811C9DC5`, `0x01000193`).

---

## 2. Астрофизические прообразы (Science-Inspired Art) и уравнения фаз 01, 02 и 05

Сцена объединяет художественные мотивы трёх различных астрономических объектов в единый 108-секундный цикл:
1. **Фаза 01 (`01_VOID`, `0–17 с`):** 7 дышащих колец светового эха по мотивам переменной звезды-цефеиды **`RS Кормы (RS Puppis)`**, радиус которых на каждом из 120 сегментов модулируется гармониками и 2D FBM-турбулентностью.
2. **Фаза 02 (`02_GENESIS`, `17–39 с`):** 4 непрерывных логарифмических рукава ($b_{\text{pitch}} = 0.325$, наклон диска $-0.17\text{ рад}$), приливной световой мост между двумя барицентрами и 48 спиральных пылевых облаков и тёмных каньонов поглощения света по мотивам галактик **`M31 (Андромеда)`** и **`NGC 3169`**.
3. **Фаза 05 (`05_SINGULARITY`, `79–108 с`):** 7 лепестковых газовых оболочек по мотивам планетарной туманности **`NGC 6543 («Кошачий глаз»)`** вокруг аккреционного диска Чёрной дыры. В Акте B (`87.5–92.6 с`) все оболочки и диск по спирали сжимаются строго в центральную Точку Нуля ($\text{radiusEnvelope} \to 0$), а после короткого `0.45 с` импульса в Акте C (`92.6–93.05 с`) разворачиваются в визитку **`DUBNOV ALEXEY`** (Акт D, `93.05–108.0 с`).

---

## 3. Симплектический интегратор `Velocity Verlet`, истинный дрейф $\Delta E / E_0$ и модель Курамото

1. **Истинный относительный дрейф механической энергии (`wasmBridge.ts` / `gravity.rs`):**
   Интегрирование орбит выполняется симплектической схемой **Velocity Verlet** (*Kick-Drift-Kick*) в потенциале Пламмера ($\varepsilon^2 = 64.0, GM = 4900.0$). В панель `LAYER_02` передаётся истинное отношение $\Delta E / E_0 = |E(t) - E_0| / |E_0|$ без искусственных зажимов (при $\Delta t = 0$ дрейф строго равен `0.0`).
2. **Параметр синхронизации Курамото `r(t)`:**
   Измеряет макроскопическую фазовую когерентность ансамбля осцилляторов $r(t) \in [0, 1]$.

---

## 4. Графовый движок `NEXUS` и семантика выборочного `BFS-28` (`simulationWorker.ts` / `graph_logic.py`)

1. **Три класса связей:** **Класс A (`AXON_TRUNK`)** — остовное дерево Прима по первым $\min(36, N)$ хабам; **Класс B (`BRIDGE`)** — межкластерные мосты по локальному критерию пустой сферы Габриэля в окне `i ± 10`; **Класс C (`DENDRITE`)** — локальные ветвления с радиусом по закону Мюррея $r = \text{round2}(1.65 \cdot k_{\text{branch}}^{-1/3})$.
2. **Паритет и выборочный BFS:** при $N \le 260$ (включая эталонный 24-узловой граф) TypeScript и Python дают 100%-но идентичный граф. Для рабочей сцены ($N > 260$) диаметр и средний путь оцениваются быстрым обходом в ширину (`BFS`) из 28 стартовых вершин (`EST. DIAMETER / PATH (BFS)`).

---

## 5. $C^1$-гладкое преломление мембраны `BREACH LENS` и парящий одометр (`18–26 Гц`)

1. **$C^1$-сопряжение на границе кольца рефракции:** колокол $g(u) = (1 - u^2)^2$ при $u < 1$ и $g(u) = 0$ при $u \ge 1$ имеет $g(1) = 0$ и $g'(1) = 0$, что обеспечивает гладкую $C^1$-сшивку на кромке кольца без визуального шва.
2. **Детерминированный интегратор фазы квантовой строки:** в `Layer5_CipherFinale.tsx` фаза центрального барабана интегрируется через приращение времени кадра $\Phi(t + \Delta t) = \Phi(t) + \Delta t \cdot f_{\text{rate}}(t)$ в полосе `[18.0 .. 26.0] Гц`, обеспечивая быструю прокрутку в воздухе без рамок и без зависимости от времени работы вкладки.