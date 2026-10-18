# 📐 Mathematical and Astrophysical Models of UNIVERSE (v2.3)
# 📐 Математические и астрофизические модели проекта UNIVERSE (v2.3)

* **Sections 1–7 (English):** Complete English Mathematical & Astrophysical Specification
* **Разделы 1–7 (Русский):** Полное русскоязычное математическое и астрофизическое руководство

---

# 🇬🇧 ENGLISH SPECIFICATION

## 1. Deterministic PRNG (`SplitMix32`) & State Integrity Invariant (`FNV-1a`)

### 1.1. Cross-Language Deterministic `SplitMix32` Generator
To guarantee identical particle trajectories, spiral dust formations, and graph topologies across the `TypeScript` orchestrator, the `Rust/WASM` physics engine, and the `Python` topology solver, platform-dependent `Math.random()` calls are strictly prohibited. All stochastic processes are seeded from a single canonical integer $S_0 = 104729$ (`GOLDEN_SEED`) using the 32-bit bijective **SplitMix32** scrambler over the ring $\mathbb{Z}_{2^{32}}$:

$$S_{k+1} = (S_k + \text{0x9E3779B9}) \bmod 2^{32}$$

$$z_1 = \left( S_{k+1} \oplus (S_{k+1} \gg 16) \right) \cdot \text{0x85EBCA6B} \bmod 2^{32}$$

$$z_2 = \left( z_1 \oplus (z_1 \gg 13) \right) \cdot \text{0xC2B2AE35} \bmod 2^{32}$$

$$U_k = \frac{z_2 \oplus (z_2 \gg 16)}{2^{32}} \in [0, 1)$$

Standard normal variates $\mathcal{N}(0, 1)$ required for Gaussian velocity dispersions and spiral arm thickness are derived via the exact Box-Muller transform:

$$Z_0 = \sqrt{-2 \ln(\max(U_1, 10^{-12}))} \cos(2\pi U_2), \quad Z_1 = \sqrt{-2 \ln(\max(U_1, 10^{-12}))} \sin(2\pi U_2)$$

### 1.2. Real-Time `FNV-1a` State Digest (`memory.rs` / `sceneBuffer.ts`)
At every fixed physics step ($\Delta t = \frac{1}{120}\text{ s}$), spatial coordinates and velocity components of all $N$ active nodes are quantized to signed 32-bit integers $q(x) = \lfloor x \cdot 10^4 \rfloor$ and folded into a 32-bit Fowler-Noll-Vo (`FNV-1a`) hash displayed live in the telemetry waterfall (`DIGEST: 0x18a7a6f7`):

$$H_0 = \text{0x811C9DC5}, \quad P_{\text{FNV}} = \text{0x01000193}$$

$$H_{m+1} = \left( (H_m \oplus b_m) \cdot P_{\text{FNV}} \right) \bmod 2^{32}$$

This enforces the fundamental optical equivalence invariant across all three visual modes:

$$\text{StateDigest}(\text{ILLUSION}) \equiv \text{StateDigest}(\text{NEXUS}) \equiv \text{StateDigest}(\text{X-RAY})$$

---

## 2. Astrophysical Prototypes & Field Equations (Phases 01, 02, and 05)

### 2.1. Phase 01 (`VOID`): `RS Puppis` Cepheid Light Echo & Non-Euclidean Breathing Rings
During `01. VOID` (`0–17 s`), the central core models the supergiant Cepheid variable star **`RS Puppis`**, whose periodic luminosity pulses illuminate surrounding interstellar dust shells.

1. **Gravitational Chirp Emission Law:**
   The time intervals between successive wave emissions contract according to the relativistic binary inspiral power law:
   $$T_n = T_0 \left( 1 - \frac{n}{N_{\text{waves}}} \right)^\alpha, \quad \alpha = 1.65$$
2. **Organically Deforming & Breathing Wave Ring Equation:**
   In natural astrophysical media, expanding light echoes never remain rigid geometric circles. Each $k$-th ring undergoes continuous angular radius modulation $R_k(\theta, t)$ driven by low-order elastic breathing modes, multi-octave simplex turbulence $\Psi_{\text{FBM}}$, and local phase Coupling with surrounding energy structures $\vec{p}_j$:
   $$R_k(\theta, t) = r_k(t) \cdot \left[ 1 + \sum_{m=2}^{5} a_m \sin\left(m\theta + \omega_m t + \phi_{k,m}\right) + \beta_{\text{env}} \Psi_{\text{FBM}}\left(\cos\theta, \sin\theta, 0.4 t + k\right) \right] + \sum_{j \in \mathcal{C}} \frac{\gamma_j E_j}{1 + \left(\frac{\|\vec{x}_k(\theta, t) - \vec{p}_j\|}{\sigma_j}\right)^2}$$
   where $r_k(t) = v_{\text{echo}}(t - t_{0,k})$ is the mean expansion radius.
3. **Azimuthal Brightness Modulation (Wave Crests & Deep Vacuum Dropouts):**
   Along the circumference $\theta \in [0, 2\pi)$ of each ring, optical surface brightness fluctuates dynamically as it intersects dense energy filaments or drops into deep vacuum shadows:
   $$I_k(\theta, t) = I_0 \exp\left(-\frac{r_k(t)}{L_{\text{att}}}\right) \cdot \left( 0.52 + 0.48 \sin^2\left(\frac{3\theta}{2} - 1.25 t + \Psi_{\text{FBM}}(\theta, t)\right) \right)$$

---

### 2.2. Phase 02 (`GENESIS`): Logarithmic Spirals, `M31` / `NGC 3169` Dust Clouds & `RK2 Curl-Noise`
During `02. GENESIS` (`17–39 s`), matter organizes into a tilted 4-arm spiral galaxy with a tidal bridge connecting two rotating barycenters.

1. **Logarithmic Spiral Arm Distribution & Softened Keplerian Rotation:**
   The azimuthal angle of particle $i$ assigned to spiral arm $k \in \{0, 1, 2, 3\}$ follows:
   $$\theta_i(r_i) = \frac{1}{b_{\text{pitch}}} \ln\left(\frac{r_i}{r_{\text{core}}}\right) + \frac{\pi k}{2} + \delta\theta_i, \quad b_{\text{pitch}} \approx 0.28$$
   Using a Plummer-softened cumulative mass profile $M(r) = M_{\text{core}} + M_{\text{disk}} \frac{r^2}{r^2 + r_s^2}$, initial tangential orbital velocity is assigned as:
   $$v_t(r) = \sqrt{\frac{G M(r)}{\sqrt{r^2 + \epsilon_0^2}}}$$
2. **6-Octave Domain-Warped FBM for Spiral Dust Clouds (Replacing Rigid Background Bars):**
   To eliminate artificial straight background lines and synthesize authentic spiral dust lanes and turbulent clouds modeled after **`M31` (Andromeda)** and **`NGC 3169`**, the shader evaluates a 6-octave Fractional Brownian Motion field with iterated domain warping in spiral-polar coordinates:
   $$f(\vec{x}) = \sum_{n=0}^{5} w^n \cdot \text{noise}\left( \Lambda^n \mathbf{R}_{\theta(r)} \vec{x} \right), \quad w = 0.52, \quad \Lambda = 2.03$$
   $$\vec{q}(\vec{x}) = \begin{pmatrix} f(\vec{x} + \vec{c}_1) \\ f(\vec{x} + \vec{c}_2) \end{pmatrix}, \quad \vec{r}(\vec{x}) = \begin{pmatrix} f(\vec{x} + 3.8\vec{q} + \vec{c}_3 + 0.12 t) \\ f(\vec{x} + 3.8\vec{q} + \vec{c}_4 - 0.09 t) \end{pmatrix}$$
   $$\rho_{\text{dust}}(\vec{x}, t) = f\left(\vec{x} + 4.2 \vec{r}(\vec{x})\right)$$
   Background starlight is attenuated through the dust column via the Beer-Lambert radiative transfer law $I_{\text{out}} = I_{\text{in}} \exp(-\kappa_{\lambda} \rho_{\text{dust}}(\vec{x}, t))$.
3. **Divergence-Free Field Filaments & Edge-to-Edge Signals (`RK2 Curl-Noise`):**
   Both interstellar gas streamlines and rare edge-to-edge quantum field signals follow a divergence-free velocity field ($\nabla \cdot \vec{u}_{\text{curl}} \equiv 0$) derived from the 2D curl of a scalar potential $\psi(x, y, t)$:
   $$\vec{u}_{\text{curl}}(x, y, t) = \nabla \times \psi(x, y, t) = \left( \frac{\partial \psi}{\partial y}, \; -\frac{\partial \psi}{\partial x} \right)$$
   Streamline trajectories are integrated via the second-order Runge-Kutta midpoint scheme (`RK2`):
   $$\vec{x}_{s + 1/2} = \vec{x}_s + \frac{\Delta s}{2} \vec{u}_{\text{curl}}(\vec{x}_s, t), \quad \vec{x}_{s+1} = \vec{x}_s + \Delta s \, \vec{u}_{\text{curl}}(\vec{x}_{s + 1/2}, t)$$

---

### 2.3. Phase 05 (`SINGULARITY`): `NGC 6543` ("Cat's Eye") Corona & Relativistic Black Hole Optics
During `05. SINGULARITY` (`79–108 s`), the system forms a multi-shell planetary nebula corona modeled after **`NGC 6543` ("Cat's Eye" Nebula)** surrounding a relativistic Schwarzschild-Kerr Black Hole shadow.

1. **Multi-Shell Harmonic Geometry of `NGC 6543`:**
   Each of the $L = 7$ concentric ejected gas shells of the central Wolf-Rayet progenitor star is parameterized in polar coordinates $(\rho, \varphi)$ by coupled harmonic lobes:
   $$R_{\text{shell}, l}(\varphi, t) = R_{0, l} \left[ 1 + c_{1,l} \cos\left(k_l \varphi + \Omega_l t\right) + c_{2,l} \cos\left(2 k_l \varphi - 0.5\Omega_l t\right) \right]$$
2. **Einstein-Schwarzschild Gravitational Lensing:**
   Light rays passing at impact parameter $b = \|\vec{x} - \vec{x}_{\text{BH}}\|$ near a Black Hole with Schwarzschild radius $R_s = \frac{2GM}{c^2}$ undergo second-order post-Newtonian deflection:
   $$\alpha(b) = \frac{4GM}{c^2 b} + \frac{15 \pi G^2 M^2}{4 c^4 b^2} \quad \Longrightarrow \quad \vec{u}_{\text{lensed}} = \vec{u} - \frac{R_{\text{E}}^2}{\|\vec{u}\|^2 + \epsilon_{\text{BH}}^2} \vec{u}$$
   Inside the critical photon sphere impact parameter $b < R_{\text{shadow}} = \frac{3\sqrt{3}}{2} R_s \approx 2.6 R_s$, rays are captured into the central event-horizon shadow.
3. **Relativistic Doppler Beaming:**
   Accretion disk plasma orbiting at relativistic velocity $\vec{\beta} = \vec{v}/c$ with Lorentz factor $\gamma = (1 - \beta^2)^{-1/2}$ exhibits asymmetric intensity amplification according to Liouville's invariant $I_\nu / \nu^3 = \text{const}$:
   $$D(\varphi) = \frac{1}{\gamma \left(1 - \beta \cos\theta_{\text{inc}} \sin\varphi\right)}, \quad I_{\text{obs}}(\varphi) = D(\varphi)^{3 + \alpha_{\text{spec}}} I_{\text{emit}}$$

---

## 3. Symplectic `Velocity Verlet` Integrator & Kuramoto Synchronization (`gravity.rs`)

### 3.1. 3-Tier Symplectic `Velocity Verlet` (*Kick-Drift-Kick*)
In `physics_engine/src/gravity.rs`, particle trajectories are integrated using the time-reversible symplectic **Velocity Verlet** scheme, preserving phase-space volume under Liouville's theorem and bounding relative Hamiltonian energy drift to $|\Delta E / E_0| < 10^{-4}$ (reported live in `LAYER_02 // ΔE/E0`):

$$\vec{a}_i(t) = -G \sum_{j \in \mathcal{M}} M_j \frac{\vec{x}_i(t) - \vec{X}_j(t)}{\left( \|\vec{x}_i(t) - \vec{X}_j(t)\|^2 + \epsilon^2 \right)^{3/2}} - \nabla U_{\text{morph}}(\vec{x}_i, t) - \gamma_{\text{damp}}(t) \vec{v}_i(t)$$

For each fixed timestep $\Delta t = \frac{1}{120}\text{ s}$:
1. **First Half-Step Velocity Kick:**
   $$\vec{v}_i\left(t + \frac{\Delta t}{2}\right) = \vec{v}_i(t) + \frac{\Delta t}{2} \vec{a}_i(t)$$
2. **Full-Step Position Drift:**
   $$\vec{x}_i(t + \Delta t) = \vec{x}_i(t) + \Delta t \, \vec{v}_i\left(t + \frac{\Delta t}{2}\right)$$
3. **Force Re-Evaluation & Second Half-Step Velocity Kick:**
   $$\vec{v}_i(t + \Delta t) = \vec{v}_i\left(t + \frac{\Delta t}{2}\right) + \frac{\Delta t}{2} \vec{a}_i(t + \Delta t)$$

Total mechanical energy $E(t)$ and relative drift are evaluated continuously:

$$E(t) = \sum_{i=1}^N \frac{1}{2} m_i \|\vec{v}_i(t)\|^2 - \sum_{i=1}^N \sum_{j \in \mathcal{M}} \frac{G m_i M_j}{\sqrt{\|\vec{x}_i(t) - \vec{X}_j(t)\|^2 + \epsilon^2}}, \quad \text{Drift}(t) = \frac{|E(t) - E(t_0)|}{|E(t_0)|}$$

### 3.2. Kuramoto Coupled Oscillator Synchronization (`KURAMOTO R(T)`)
Each star-neuron $i$ carries a natural frequency $\omega_i \sim \mathcal{N}(\omega_0, \sigma_\omega^2)$ and phase $\theta_i(t) \in [0, 2\pi)$ governed by the spatially weighted Kuramoto model with Gaussian interaction kernel $W_{ij} = \exp\left(-\|\vec{x}_i - \vec{x}_j\|^2 / 2\ell^2\right)$:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K(t)}{Z_i} \sum_{j \in \mathcal{N}(i)} W_{ij} \sin\left(\theta_j(t) - \theta_i(t)\right)$$

The global macroscopic order parameter $r(t) \in [0, 1]$ displayed in `LAYER_02 // KURAMOTO R(T)` quantifies collective phase coherence:

$$r(t) e^{i \psi(t)} = \frac{1}{N} \sum_{k=1}^{N} e^{i \theta_k(t)} \quad \Longrightarrow \quad r(t) = \sqrt{ \left(\frac{1}{N}\sum_{k=1}^N \cos\theta_k(t)\right)^2 + \left(\frac{1}{N}\sum_{k=1}^N \sin\theta_k(t)\right)^2 }$$

---

## 4. `NEXUS` Cognitive Graph Topology: MST, Gabriel Graph & Murray's Law (`graph_logic.py`)

In `03. EVOLUTION` (`39–61 s`), spiral arms deform into two bilateral cortical hemispheres, and `backend/core/graph_logic.py` constructs a three-tier biologically grounded connectome (reported live in `LAYER_03 // NEXUS GRAPH TOPOLOGY`):

1. **Class A — Primary Axon Trunks (`Euclidean Minimum Spanning Tree`):**
   High-centrality hub somas are connected via a Euclidean Minimum Spanning Tree (`MST`), minimizing total metabolic wiring length while guaranteeing global graph connectivity:
   $$E_{\text{Class A}} = \arg\min_{T \subset V \times V} \sum_{(u, v) \in T} \|\vec{x}_u - \vec{x}_v\|_2$$
2. **Class B — Associative Synaptic Bridges (`Gabriel Graph` Criterion):**
   Long-range associative bridges between cortical clusters satisfy the **Gabriel Graph** empty-diametral-sphere condition — an edge $(u, v)$ belongs to $E_{\text{Class B}}$ if and only if no other vertex $w \in V \setminus \{u, v\}$ lies within the open ball whose diameter is the segment $[u, v]$:
   $$(u, v) \in E_{\text{Class B}} \iff \forall w \in V \setminus \{u, v\}: \quad \left\| \vec{x}_w - \frac{\vec{x}_u + \vec{x}_v}{2} \right\|^2 > \frac{\|\vec{x}_u - \vec{x}_v\|^2}{4}$$
3. **Class C — Terminal Dendritic Arbors (`Murray's Biophysical Cube Law`):**
   Peripheral dendritic branches obey **Murray's Law**, which minimizes the combined energetic cost of laminar signal propagation and metabolic volume maintenance across bifurcations:
   $$r_{\text{parent}}^3 = \sum_{m=1}^{k} r_{\text{child}, m}^3 \quad \Longrightarrow \quad r(u) = r_{\text{terminal}} \left( \text{SubtreeLeafCount}(u) \right)^{1/3}$$
4. **Arc-Length Reparameterization (`lengthLUT`) & Graph Telemetry:**
   Curved axons are modeled as Catmull-Rom cubic splines $\vec{\gamma}(u)$, $u \in [0, 1]$, reparameterized by natural arc length $s(u) = \int_0^u \|\vec{\gamma}'(\tau)\| d\tau$ so synaptic pulse comets (`PULSES IN FLIGHT`) travel at constant physical speed $v_{\text{pulse}}$. Live topology metrics in `LAYER_03` compute average degree $\langle k \rangle = \frac{2|E|}{|V|}$, Watts-Strogatz clustering coefficient $C$, and shortest-path hop diameter $D$.

---

## 5. `BREACH LENS` Membrane Optics, Deep `Z4` Underlay & Fluctuating Telemetry Contours

### 5.1. $C^2$-Continuous Refraction & Caustic Amplification (`breach.wgsl` / `breach_math.rs`)
When pointer input activates the `BREACH LENS` at center $\vec{p}_0(t)$ with radius $R_L$, optical distortion is governed by a compactly supported quartic bell window over normalized radius $u = \min\left(1, \frac{\|\vec{p} - \vec{p}_0\|}{R_L}\right)$:

$$g(u) = \left(1 - u^2\right)^2, \quad g(1) = 0, \quad g'(1) = 0, \quad g''(0) = -4$$

The displacement vector combines radial magnification ($A_{\text{rad}}$) and tangential frame-dragging twist ($B_{\text{tan}}$):

$$\vec{\delta}(\vec{p}) = \left( A_{\text{rad}} \hat{e}_r + B_{\text{tan}} \hat{e}_\theta \right) u \, g(u), \quad I_{\text{caustic}}(\vec{p}) = \frac{I_0(\vec{p})}{\max\left(0.15, \; |\det \mathbf{J}_{\vec{\delta}}(\vec{p})|\right)}$$

### 5.2. Sub-Quantum "Reverse Side of the Universe" (`Z4` Deep Underlay)
Within the active lens aperture ($u < 1$), where the primary coordinate grid cells appear, the aperture mask $M_{\text{breach}}(u) = g(u)$ peels back the surface cosmos to reveal depth echelon `Z4` — a dual Voronoi-Delaunay sub-quantum lattice carrying deep neural currents driven by the cursor potential gradient:

$$\vec{J}_{\text{sub}}(\vec{x}, t) = -\sigma_{\text{sub}} \nabla \Phi_{\text{Z4}}(\vec{x}, t) \cdot M_{\text{breach}}\left(\frac{\|\vec{x} - \vec{p}_0(t)\|}{R_L}\right)$$

### 5.3. Unified `BREACH`-Style Living Contours for the Right Telemetry Panel (`Layers 2–4`)
Both the circular `BREACH LENS` rim around the mouse cursor and the full-height right-hand telemetry column share the same non-stationary wave-membrane boundary operator. For the right telemetry column spanning $y \in [y_{\text{top}}, y_{\text{bottom}}]$, rigid straight borders are replaced by parametric wave boundaries:

$$X_{\text{border}}(y, t) = x_0 + \sin^\gamma\left(\pi \frac{y - y_{\text{top}}}{y_{\text{bottom}} - y_{\text{top}}}\right) \left[ A_1 \sin(\kappa_1 y - \omega_1 t) + A_2 \sin\left(\kappa_2 y + \omega_2 t + \sin(\kappa_3 y - \omega_3 t)\right) + A_3 \Psi_{\text{simplex}}(0.015 y, 0.8 t) \right]$$

---

## 6. Stochastic Kinematics of the Digital Waterfall, Starfall & Odometer Breathing

### 6.1. Breathing Telemetry & Poisson Starfall / Droplet Decay (`Layers 2–4`)
1. **Breathing Typography & Thermal Shimmer:**
   Every numerical glyph and label $m$ in the right telemetry waterfall undergoes continuous micro-oscillation in scale $S_m(t)$, opacity, and vertical drift:
   $$S_m(t) = 1.0 + 0.022 \sin\left(\Omega_{\text{breath}} t + \phi_m\right), \quad \delta y_{\text{flow}}(t) = \left( v_{\text{waterfall}} t + y_{m,0} \right) \bmod H_{\text{row}}$$
2. **Inhomogeneous Poisson Starfall / Droplet Detachment:**
   At variable rate $\lambda(t) \in [0.8, 2.2]\text{ s}^{-1}$ (producing a natural `drip-by-drip` or falling-star rhythm), characters at the lower boundary spawn a falling clone at $t_{\text{drop}}$ while the in-place table metric immediately refreshes to preserve 100% readability:
   $$y_{\text{star}}(\tau) = y_0 + v_{0,y} \tau + \frac{1}{2} g_{\text{eff}} \tau^2, \quad x_{\text{star}}(\tau) = x_0 + A_{\text{flutter}} \sin(\omega_f \tau) \cdot \tau$$
   $$\alpha_{\text{star}}(\tau) = \alpha_0 \left(1 - \frac{\tau}{\tau_{\text{life}}}\right)^2 \exp\left(-1.8 \frac{\tau}{\tau_{\text{life}}}\right), \quad \tau = t - t_{\text{drop}} \in [0, \tau_{\text{life}}]$$

### 6.2. Ornstein-Uhlenbeck Chaotic Odometer Reel & Card Heartbeat (`Layer 5`)
1. **Chaotic Non-Stationary Reel Velocity:**
   The single continuously spinning central quantum row in Act 05 modulates its angular scroll velocity $V_{\text{reel}}(t)$ via a mean-reverting Ornstein-Uhlenbeck stochastic differential equation with breathing drift $\mu_V(t)$:
   $$d V_{\text{reel}}(t) = \theta_{\text{OU}} \left( \mu_V(t) - V_{\text{reel}}(t) \right) dt + \sigma_{\text{OU}} \, dW_t, \quad \mu_V(t) = V_0 \left[ 1 + 0.65 \sin(0.9 t) \cos(2.3 t) \right]$$
2. **Biphasic Card Heartbeat Envelope:**
   After the top and bottom manifesto rows lock into place, the entire manifesto card breathes in sync with the ambient music via a systolic-diastolic cardiac envelope:
   $$B_{\text{card}}(t) = 1.0 + A_{\text{heart}} \left[ \exp\left(-\frac{(\phi(t) - 0.18)^2}{2 \cdot 0.04^2}\right) + 0.6 \exp\left(-\frac{(\phi(t) - 0.34)^2}{2 \cdot 0.06^2}\right) \right], \quad \phi(t) = (f_{\text{bpm}} t) \bmod 1$$

---

## 7. Smooth $C^2$ Camera & Phase Morphogenesis Interpolation

To eliminate abrupt visual jumps during line expansion in Act 01 and camera zooming across Acts 02 and 03, all phase transition weights $w(t)$ use Perlin's quintic $C^2$-continuous polynomial (`smootherstep`) with zero first and second derivatives at phase boundaries:

$$S_5(u) = 6 u^5 - 15 u^4 + 10 u^3, \quad S_5'(0) = S_5'(1) = 0, \quad S_5''(0) = S_5''(1) = 0, \quad u = \text{clamp}\left(\frac{t - t_{\text{start}}}{t_{\text{end}} - t_{\text{start}}}, 0, 1\right)$$

---
---

# 🇷🇺 РУССКОЕ МАТЕМАТИЧЕСКОЕ И АСТРОФИЗИЧЕСКОЕ РУКОВОДСТВО

## 1. Детерминированный ГПСЧ `SplitMix32` и инвариант целостности `FNV-1a` (`State Digest`)

### 1.1. Алгоритм `SplitMix32`
Для гарантии побитовой воспроизводимости траекторий частиц, пылевых спиралей и топологии графа между основным потоком `TypeScript`, модулем `Rust/WASM` и солвером `Python` запрещено использование платформенно-зависимого `Math.random()`. Вся стохастика инициализируется единым зерном $S_0 = 104729$ (`GOLDEN_SEED`) через 32-битный биективный скремблер **SplitMix32** в кольце вычетов $\mathbb{Z}_{2^{32}}$:

$$S_{k+1} = (S_k + \text{0x9E3779B9}) \bmod 2^{32}$$

$$z_1 = \left( S_{k+1} \oplus (S_{k+1} \gg 16) \right) \cdot \text{0x85EBCA6B} \bmod 2^{32}$$

$$z_2 = \left( z_1 \oplus (z_1 \gg 13) \right) \cdot \text{0xC2B2AE35} \bmod 2^{32}$$

$$U_k = \frac{z_2 \oplus (z_2 \gg 16)}{2^{32}} \in [0, 1)$$

Нормально распределённые величины $\mathcal{N}(0, 1)$ для разброса звёзд в рукавах галактики и собственных частот осцилляторов генерируются через точное преобразование Бокса — Мюллера:

$$Z_0 = \sqrt{-2 \ln(\max(U_1, 10^{-12}))} \cos(2\pi U_2), \quad Z_1 = \sqrt{-2 \ln(\max(U_1, 10^{-12}))} \sin(2\pi U_2)$$

### 1.2. Свертка состояния `FNV-1a` (`State Digest`)
На каждом фиксированном шаге интегрирования ($\Delta t = \frac{1}{120}\text{ с}$) пространственные координаты и скорости $N$ активных узлов квантуются до целых знаковых чисел $q(x) = \lfloor x \cdot 10^4 \rfloor$ и сворачиваются в 32-битный хеш Фаулера — Нолла — Во (`FNV-1a`), выводимый в правой панели телеметрии (`DIGEST: 0x18a7a6f7`):

$$H_0 = \text{0x811C9DC5}, \quad P_{\text{FNV}} = \text{0x01000193}$$

$$H_{m+1} = \left( (H_m \oplus b_m) \cdot P_{\text{FNV}} \right) \bmod 2^{32}$$

Это гарантирует соблюдение фундаментального инварианта оптического единства трёх миров:

$$\text{StateDigest}(\text{ILLUSION}) \equiv \text{StateDigest}(\text{NEXUS}) \equiv \text{StateDigest}(\text{X-RAY})$$

---

## 2. Астрофизические прообразы и уравнения поля (Фазы 01, 02 и 05)

### 2.1. Фаза 01 (`VOID`): Световое эхо цефеиды `RS Puppis` и живая деформация волновых колец
В фазе `01. ПУСТОТА И СВЕТОВОЕ ЭХО (VOID)` (`0–17 с`) центральный источник моделирует сверхгигантскую переменную звезду-цефеиду **RS Кормы (`RS Puppis`)**, чьи вспышки распространяются сквозь отражательную пылевую туманность.

1. **Гравитационный чирп-закон периода пульсаций:**
   Интервалы между испусканием фронтов волн сжимаются по степенному закону сближения релятивистской двойной системы:
   $$T_n = T_0 \left( 1 - \frac{n}{N_{\text{waves}}} \right)^\alpha, \quad \alpha = 1.65$$
2. **Уравнение нестабильного («дышащего») волнового кольца:**
   В естественной неоднородной среде космоса не бывает геометрически идеальных «кругов по воде». Каждое $k$-е кольцо при движении от центра к краям дышит, деформируется во всех своих частях и взаимодействует с окружающими энергетическими структурами $\vec{p}_j$. Радиус фронта волны в направлении полярного угла $\theta \in [0, 2\pi)$ во времени $t$ задаётся уравнением:
   $$R_k(\theta, t) = r_k(t) \cdot \left[ 1 + \sum_{m=2}^{5} a_m \sin\left(m\theta + \omega_m t + \phi_{k,m}\right) + \beta_{\text{env}} \Psi_{\text{FBM}}\left(\cos\theta, \sin\theta, 0.4 t + k\right) \right] + \sum_{j \in \mathcal{C}} \frac{\gamma_j E_j}{1 + \left(\frac{\|\vec{x}_k(\theta, t) - \vec{p}_j\|}{\sigma_j}\right)^2}$$
   где:
   * $r_k(t) = v_{\text{echo}} (t - t_{0,k})$ — базовый радиус распространения светового эха;
   * $\sum_{m=2}^5 a_m \sin(\dots)$ — низкочастотные моды упругого «дыхания» кольца (эллиптическая и лепестковая нестабильность);
   * $\Psi_{\text{FBM}}$ — трёхмерный фрактальный симплекс-шум среды;
   * последнее слагаемое описывает локальный изгиб и ускорение/замедление волны при прохождении через энергетические структуры $\vec{p}_j$ с энергией $E_j$.
3. **Неоднородная модуляция яркости вдоль дуги кольца (эффект волны и глубокого пропадания):**
   $$I_k(\theta, t) = I_0 \exp\left(-\frac{r_k(t)}{L_{\text{att}}}\right) \cdot \left( 0.52 + 0.48 \sin^2\left(\frac{3\theta}{2} - 1.25 t + \Psi_{\text{FBM}}(\theta, t)\right) \right)$$
   Благодаря этому отдельные участки каждого кольца ярко вспыхивают на гребне плотности пыли, а соседние дуги плавно уходят в глубокое затухание.

---

### 2.2. Фаза 02 (`GENESIS`): Логарифмические спирали, пылевые облака `M31` / `NGC 3169` и `RK2 Curl-Noise`
В фазе `02. ГЕНЕЗИС (GENESIS)` (`17–39 с`) формируется наклонный галактический диск с четырьмя спиральными рукавами и приливным мостом между двумя барицентрами.

1. **Начальное распределение в логарифмических рукавах и кеплеровская скорость:**
   Полярный угол частицы $i$ в рукаве $k \in \{0, 1, 2, 3\}$ и начальная круговая скорость со смягчённым потенциалом Пламмера $M(r) = M_{\text{core}} + M_{\text{disk}} \frac{r^2}{r^2 + r_s^2}$ определяются законами:
   $$\theta_i(r_i) = \frac{1}{b_{\text{pitch}}} \ln\left(\frac{r_i}{r_{\text{core}}}\right) + \frac{\pi k}{2} + \delta\theta_i, \quad v_t(r) = \sqrt{\frac{G M(r)}{\sqrt{r^2 + \epsilon_0^2}}}$$
2. **Многооктавный `Domain-Warped FBM` для спиральных пылевых облаков (взамен прямых фоновых «палок»):**
   Для полной замены чужеродных прямолинейных полос на фоне реалистичными спиралевидными облаками межзвёздной пыли и каньонами поглощения света (по прообразу галактик **`Андромеда M31`** и **`NGC 3169`**) вычисляется 6-октавный фрактальный броуновский шум с двукратным искривлением пространства (*domain warping*):
   $$f(\vec{x}) = \sum_{n=0}^{5} w^n \cdot \text{noise}\left( \Lambda^n \mathbf{R}_{\theta(r)} \vec{x} \right), \quad w = 0.52, \quad \Lambda = 2.03$$
   $$\vec{q}(\vec{x}) = \begin{pmatrix} f(\vec{x} + \vec{c}_1) \\ f(\vec{x} + \vec{c}_2) \end{pmatrix}, \quad \vec{r}(\vec{x}) = \begin{pmatrix} f(\vec{x} + 3.8\vec{q} + \vec{c}_3 + 0.12 t) \\ f(\vec{x} + 3.8\vec{q} + \vec{c}_4 - 0.09 t) \end{pmatrix}$$
   $$\rho_{\text{dust}}(\vec{x}, t) = f\left(\vec{x} + 4.2 \vec{r}(\vec{x})\right)$$
   Оптическая толща пылевого рукава ослабляет фоновое свечение по закону Бугера — Ламберта — Бера: $I_{\text{out}} = I_{\text{in}} \exp(-\kappa_{\lambda} \rho_{\text{dust}}(\vec{x}, t))$.
3. **Бездивергентные полевые волокна и редкие пробегающие сигналы (`RK2 Curl-Noise`):**
   Поле скоростей межзвёздного газа и редких пробегающих от края до края полевых сигналов задаётся ротором скалярного потенциала $\psi$, что гарантирует несжимаемость потока ($\nabla \cdot \vec{u}_{\text{curl}} \equiv 0$):
   $$\vec{u}_{\text{curl}}(x, y, t) = \nabla \times \psi(x, y, t) = \left( \frac{\partial \psi}{\partial y}, \; -\frac{\partial \psi}{\partial x} \right)$$
   Линии тока интегрируются методом Рунге — Кутты 2-го порядка (`RK2`):
   $$\vec{x}_{s + 1/2} = \vec{x}_s + \frac{\Delta s}{2} \vec{u}_{\text{curl}}(\vec{x}_s, t), \quad \vec{x}_{s+1} = \vec{x}_s + \Delta s \, \vec{u}_{\text{curl}}(\vec{x}_{s + 1/2}, t)$$

---

### 2.3. Фаза 05 (`SINGULARITY`): Корона «Кошачьего глаза» (`NGC 6543`) и релятивистская оптика Чёрной дыры
В фазе `05. СИНГУЛЯРНОСТЬ И ОДОМЕТР (LOGIC → ∞)` (`79–108 с`) вокруг горизонта событий разворачивается многолепестковая газовая корона по образцу планетарной туманности **`NGC 6543` («Кошачий глаз»)** и релятивистский аккреционный диск.

1. **Параметрическая геометрия лепестковых оболочек `NGC 6543`:**
   Каждая из $L = 7$ вложенных сброшенных оболочек звезды Вольфа — Райе описывается в полярных координатах $(\rho, \varphi)$ суперпозицией гармоник:
   $$R_{\text{shell}, l}(\varphi, t) = R_{0, l} \left[ 1 + c_{1,l} \cos\left(k_l \varphi + \Omega_l t\right) + c_{2,l} \cos\left(2 k_l \varphi - 0.5\Omega_l t\right) \right]$$
2. **Гравитационное линзирование Эйнштейна — Шварцшильда:**
   Луч света, проходящий на прицельном расстоянии $b = \|\vec{x} - \vec{x}_{\text{BH}}\|$ от сингулярности с радиусом Шварцшильда $R_s = \frac{2GM}{c^2}$, испытывает угловое отклонение:
   $$\alpha(b) = \frac{4GM}{c^2 b} + \frac{15 \pi G^2 M^2}{4 c^4 b^2} \quad \Longrightarrow \quad \vec{u}_{\text{lensed}} = \vec{u} - \frac{R_{\text{E}}^2}{\|\vec{u}\|^2 + \epsilon_{\text{BH}}^2} \vec{u}$$
   При $b < R_{\text{shadow}} = \frac{3\sqrt{3}}{2} R_s \approx 2.6 R_s$ формируется фотонная сфера и абсолютно чёрная тень горизонта событий.
3. **Релятивистское допплеровское усиление (`Doppler Beaming`):**
   Плазма аккреционного диска, вращающаяся с релятивистской скоростью $\vec{\beta} = \vec{v}/c$ ($\gamma = (1 - \beta^2)^{-1/2}$), усиливает яркость на набегающем крыле диска согласно инварианту Лиувилля $I_\nu / \nu^3 = \text{const}$:
   $$D(\varphi) = \frac{1}{\gamma \left(1 - \beta \cos\theta_{\text{inc}} \sin\varphi\right)}, \quad I_{\text{obs}}(\varphi) = D(\varphi)^{3 + \alpha_{\text{spec}}} I_{\text{emit}}$$

---

## 3. Трёхъярусный симплектический интегратор `Velocity Verlet` и синхронизация Курамото (`gravity.rs`)

### 3.1. Симплектическая схема `Velocity Verlet` (*Kick-Drift-Kick*)
В модуле `physics_engine/src/gravity.rs` уравнения движения решаются симплектическим методом Верле в скоростной форме, сохраняющим фазовый объём по теореме Лиувилля и удерживающим вековой дрейф гамильтониана $\left|\Delta E / E_0\right| < 10^{-4}$ (значение в реальном времени выводится в `LAYER_02 // ΔE/E0`):

$$\vec{a}_i(t) = -G \sum_{j \in \mathcal{M}} M_j \frac{\vec{x}_i(t) - \vec{X}_j(t)}{\left( \|\vec{x}_i(t) - \vec{X}_j(t)\|^2 + \epsilon^2 \right)^{3/2}} - \nabla U_{\text{morph}}(\vec{x}_i, t) - \gamma_{\text{damp}}(t) \vec{v}_i(t)$$

Цикл шага интегрирования $\Delta t = \frac{1}{120}\text{ с}$:
1. **Полушаг скорости (First Kick):**
   $$\vec{v}_i\left(t + \frac{\Delta t}{2}\right) = \vec{v}_i(t) + \frac{\Delta t}{2} \vec{a}_i(t)$$
2. **Полный шаг координаты (Drift):**
   $$\vec{x}_i(t + \Delta t) = \vec{x}_i(t) + \Delta t \, \vec{v}_i\left(t + \frac{\Delta t}{2}\right)$$
3. **Пересчёт поля ускорений и завершающий полушаг скорости (Second Kick):**
   $$\vec{v}_i(t + \Delta t) = \vec{v}_i\left(t + \frac{\Delta t}{2}\right) + \frac{\Delta t}{2} \vec{a}_i(t + \Delta t)$$

Относительный энергетический дрейф контролируется на каждом кадре:

$$E(t) = \sum_{i=1}^N \frac{1}{2} m_i \|\vec{v}_i(t)\|^2 - \sum_{i=1}^N \sum_{j \in \mathcal{M}} \frac{G m_i M_j}{\sqrt{\|\vec{x}_i(t) - \vec{X}_j(t)\|^2 + \epsilon^2}}, \quad \text{Drift}(t) = \frac{|E(t) - E(t_0)|}{|E(t_0)|}$$

### 3.2. Модель фазовой синхронизации Курамото (`KURAMOTO R(T)`)
Каждая звезда-нейрон $i$ обладает собственной частотой пульсации $\omega_i \sim \mathcal{N}(\omega_0, \sigma_\omega^2)$ и фазой $\theta_i(t) \in [0, 2\pi)$. Эволюция фаз подчиняется нелинейной системе связанных осцилляторов Курамото с гауссовым ядром связности $W_{ij} = \exp\left(-\|\vec{x}_i - \vec{x}_j\|^2 / 2\ell^2\right)$:

$$\frac{d\theta_i}{dt} = \omega_i + \frac{K(t)}{Z_i} \sum_{j \in \mathcal{N}(i)} W_{ij} \sin\left(\theta_j(t) - \theta_i(t)\right)$$

Макроскопический параметр порядка Курамото $r(t) \in [0, 1]$, отображаемый в `LAYER_02 // KURAMOTO R(T)`, измеряет степень когерентности ансамбля:

$$r(t) e^{i \psi(t)} = \frac{1}{N} \sum_{k=1}^{N} e^{i \theta_k(t)} \quad \Longrightarrow \quad r(t) = \sqrt{ \left(\frac{1}{N}\sum_{k=1}^N \cos\theta_k(t)\right)^2 + \left(\frac{1}{N}\sum_{k=1}^N \sin\theta_k(t)\right)^2 }$$

---

## 4. Топология когнитивного графа `NEXUS`: MST, граф Габриэля и закон Мюррея (`graph_logic.py`)

В фазе `03. ЭВОЛЮЦИЯ И НЕЙРОВЕРС (EVOLUTION)` (`39–61 с`) спиральные рукава галактики переходят в два кортикальных полушария Головного Мозга, а модуль `backend/core/graph_logic.py` строит трёхуровневую биологически достоверную сосудисто-нейронную сеть (статистика в реальном времени выводится в `LAYER_03 // NEXUS GRAPH TOPOLOGY`):

1. **Класс A — Магистральные аксонные тракты (`CLASS A / MST TRUNKS`):**
   Среди опорных узлов с максимальной центральностью строится **Евклидово минимальное остовное дерево (MST)**, минимизирующее суммарную метаболическую длину проводящих путей при сохранении полной связности графа:
   $$E_{\text{Class A}} = \arg\min_{T \subset V \times V} \sum_{(u, v) \in T} \|\vec{x}_u - \vec{x}_v\|_2$$
2. **Класс B — Синаптические мосты Габриэля (`CLASS B / GABRIEL BRIDGES`):**
   Между локальными кластерами добавляются хордовые связи по критерию **графа Габриэля**: ребро $(u, v)$ включается в $E_{\text{Class B}}$ тогда и только тогда, когда открытый шар с диаметром $[u, v]$ не содержит ни одной другой вершины $w \in V \setminus \{u, v\}$:
   $$(u, v) \in E_{\text{Class B}} \iff \forall w \in V \setminus \{u, v\}: \quad \left\| \vec{x}_w - \frac{\vec{x}_u + \vec{x}_v}{2} \right\|^2 > \frac{\|\vec{x}_u - \vec{x}_v\|^2}{4}$$
3. **Класс C — Дендритная периферия по биофизическому закону Мюррея (`CLASS C / MURRAY DENDRITES`):**
   Толщина (радиус сечения $r$) ветвящихся дендритов и аксонов подчиняется **закону Мюррея** (минимизация суммы затрат энергии на проведение импульса и поддержание объёма ткани):
   $$r_{\text{parent}}^3 = \sum_{m=1}^{k} r_{\text{child}, m}^3 \quad \Longrightarrow \quad r(u) = r_{\text{terminal}} \left( \text{SubtreeLeafCount}(u) \right)^{1/3}$$
4. **Параметризация кривых по длине дуги (`Arc-Length LUT`) и топологические метрики:**
   Каждое ребро изгибается в кубический сплайн Эрмита — Катмулла — Рома $\vec{\gamma}(u)$, $u \in [0, 1]$, параметризованный натуральной длиной дуги $s(u) = \int_0^u \|\vec{\gamma}'(\tau)\| d\tau$, чтобы кометы синаптических импульсов (`PULSES IN FLIGHT`) двигались с постоянной физической скоростью $v_{\text{pulse}}$. Одновременно в `LAYER_03` выводятся средняя степень вершины $\langle k \rangle = \frac{2|E|}{|V|}$, коэффициент кластеризации Уоттса — Строгаца $C$ и диаметр графа $D$.

---

## 5. Оптика мембраны `BREACH LENS`, глубинный слой `Z4` и живой контур правых панелей

### 5.1. $C^2$-гладкое поле преломления и каустика `BREACH LENS` (`breach.wgsl`, `breach_math.rs`)
При наведении или удержании кнопки мыши в точке $\vec{p}_0(t)$ раскрывается оптическая линза радиуса $R_L$. Для отсутствия разрывов производных на границе линзы используется компактно-поддерживаемое колоколообразное окно 4-й степени по нормированному расстоянию $u = \min\left(1, \frac{\|\vec{p} - \vec{p}_0\|}{R_L}\right)$:

$$g(u) = \left(1 - u^2\right)^2, \quad g(1) = 0, \quad g'(1) = 0, \quad g''(0) = -4$$

Векторное поле смещения лучей сочетает радиальное растяжение ($A_{\text{rad}}$) и тангенциальное вихревое кручение ($B_{\text{tan}}$), а каустическое усиление яркости на кромке обратно пропорционально якобиану отображения:

$$\vec{\delta}(\vec{p}) = \left( A_{\text{rad}} \hat{e}_r + B_{\text{tan}} \hat{e}_\theta \right) u \, g(u), \quad I_{\text{caustic}}(\vec{p}) = \frac{I_0(\vec{p})}{\max\left(0.15, \; |\det \mathbf{J}_{\vec{\delta}}(\vec{p})|\right)}$$

### 5.2. Суб-квантовая «Обратная сторона Вселенной» (Эшелон глубины `Z4`)
Внутри апертуры линзы ($u < 1$), когда появляются координатные клеточки рентгена, маска $M_{\text{breach}}(u) = g(u)$ открывает глубинный эшелон `Z4`, в котором рендерится двойственная сеть Делоне — Вороного и суб-нейронные микротоки, управляемые градиентом потенциала курсора:

$$\vec{J}_{\text{sub}}(\vec{x}, t) = -\sigma_{\text{sub}} \nabla \Phi_{\text{Z4}}(\vec{x}, t) \cdot M_{\text{breach}}\left(\frac{\|\vec{x} - \vec{p}_0(t)\|}{R_L}\right)$$

Это создаёт эффект заглядывания за изнанку Вселенной, пульсирующую глубже за клеточками.

### 5.3. Перенос математики волнового контура `BREACH LENS` на правую панель телеметрии (`Layers 2–4`)
Чтобы полностью избавиться от прямых линий и прямоугольных углов в правой панели телеметрии и вписать её в единый стиль с кругом мыши при нажатии, границы вертикальной колонки $y \in [y_{\text{top}}, y_{\text{bottom}}]$ задаются тем же волновым оператором мембранного возмущения:

$$X_{\text{border}}(y, t) = x_0 + \sin^\gamma\left(\pi \frac{y - y_{\text{top}}}{y_{\text{bottom}} - y_{\text{top}}}\right) \left[ A_1 \sin(\kappa_1 y - \omega_1 t) + A_2 \sin\left(\kappa_2 y + \omega_2 t + \sin(\kappa_3 y - \omega_3 t)\right) + A_3 \Psi_{\text{simplex}}(0.015 y, 0.8 t) \right]$$

---

## 6. Стохастическая кинематика «Цифрового водопада / Звездопада» и дыхания Одометра

### 6.1. Дыхание цифр, Цифровой водопад и Пуассоновский Звездопад капель (`Layers 2–4`)
1. **Дыхание значений и медленное течение сверху вниз:**
   Каждая цифра и метрика $m$ в правой колонке непрерывно дышит по масштабу $S_m(t)$ и медленно смещается в потоке водопада:
   $$S_m(t) = 1.0 + 0.022 \sin\left(\Omega_{\text{breath}} t + \phi_m\right), \quad \delta y_{\text{flow}}(t) = \left( v_{\text{waterfall}} t + y_{m,0} \right) \bmod H_{\text{row}}$$
2. **Пуассоновский процесс отрыва падающих цифр («Звездопад / Капли»):**
   С переменной частотой $\lambda(t) \in [0.8, 2.2]\text{ с}^{-1}$ (эффект падающих звёзд или медленных капель `кап-кап`) отдельные нижние цифры отрываются в момент $t_{\text{drop}}$ и падают вниз с плавным затуханием, в то время как на их штатном месте в строке мгновенно прокручивается и зажигается актуальное значение (сохраняя 100% читаемость таблицы):
   $$y_{\text{star}}(\tau) = y_0 + v_{0,y} \tau + \frac{1}{2} g_{\text{eff}} \tau^2, \quad x_{\text{star}}(\tau) = x_0 + A_{\text{flutter}} \sin(\omega_f \tau) \cdot \tau$$
   $$\alpha_{\text{star}}(\tau) = \alpha_0 \left(1 - \frac{\tau}{\tau_{\text{life}}}\right)^2 \exp\left(-1.8 \frac{\tau}{\tau_{\text{life}}}\right), \quad \tau = t - t_{\text{drop}} \in [0, \tau_{\text{life}}]$$

### 6.2. Хаотическое дыхание монохромной бегущей строки и «Биение сердца» визитки (`Акт 05 — Layer 5`)
1. **Нестационарная скорость прокрутки (Процесс Орнштейна — Уленбека):**
   Чтобы центральная бегущая строка квантовых символов в финале двигалась не монотонно, а живо и хаотично — то ускоряясь, то замедляясь, — мгновенная скорость барабанов $V_{\text{reel}}(t)$ моделируется стохастическим дифференциальным уравнением с дышащим дрейфом $\mu_V(t)$:
   $$d V_{\text{reel}}(t) = \theta_{\text{OU}} \left( \mu_V(t) - V_{\text{reel}}(t) \right) dt + \sigma_{\text{OU}} \, dW_t, \quad \mu_V(t) = V_0 \left[ 1 + 0.65 \sin(0.9 t) \cos(2.3 t) \right]$$
2. **Кардио-дыхание финальной карточки (`Heartbeat Envelope`):**
   После фиксации верхних и нижних строк манифеста (`DUBNOV ALEXEY // UNIVERSE`) вся финальная визитка пульсирует в такт звучащей музыке по двухфазной кардио-кривой (систола — диастола):
   $$B_{\text{card}}(t) = 1.0 + A_{\text{heart}} \left[ \exp\left(-\frac{(\phi(t) - 0.18)^2}{2 \cdot 0.04^2}\right) + 0.6 \exp\left(-\frac{(\phi(t) - 0.34)^2}{2 \cdot 0.06^2}\right) \right], \quad \phi(t) = (f_{\text{bpm}} t) \bmod 1$$

---

## 7. Гладкая $C^2$-интерполяция камеры и переходов между фазами

Для полного устранения рывков линий в 1-м акте и скачков масштаба камеры во 2-м и 3-м актах все фазовые переходы и огибающие зума рассчитываются через полином Перлина 5-й степени (`smootherstep`), у которого и первая, и вторая производные на стыках фаз строго равны нулю:

$$S_5(u) = 6 u^5 - 15 u^4 + 10 u^3, \quad S_5'(0) = S_5'(1) = 0, \quad S_5''(0) = S_5''(1) = 0, \quad u = \text{clamp}\left(\frac{t - t_{\text{start}}}{t_{\text{end}} - t_{\text{start}}}, 0, 1\right)$$