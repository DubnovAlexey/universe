# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.5)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Polyglot Stack](https://img.shields.io/badge/Stack-Astro_%7C_TS_%7C_Custom_JSX_DOM_%7C_Canvas2D_WGSL_%7C_Rust_WASM_%7C_Python-6366f1?style=for-the-badge)](#2-architectural-rationale-why-these-technologies-and-this-exact-execution-order)
[![Deterministic Core](https://img.shields.io/badge/Engine-Deterministic_PRNG_%26_State_Digest-f59e0b?style=for-the-badge)](#6-truth-policy--execution-modes)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

---

# 🇬🇧 ENGLISH DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive audiovisual installation ("From Zero to Zero", 108-second continuous cycle) and an interactive **Runtime Polyglot** architectural showcase created by **Alexey Dubnov (`DubnovAlexey`)** and hosted on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) are not separate animations — they are **three optical readings of a single deterministic simulation state (`SceneBufferSoA`)**.

* **For Viewers, Art Directors & Technical Recruiters:** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and continuous spatial ambient sound — culminating in a zero-point gravitational collapse and an interactive holographic developer manifesto card that remains softly suspended in space across subsequent cycles.
* **For Senior Engineers, Systems Architects & CTOs:** A transparent polyglot architecture where **Astro, TypeScript, Custom Zero-Dependency JSX DOM/SVG, High-DPI Canvas 2D + WGSL Shaders, Rust/WebAssembly, Python 3, and Web Audio API** operate over a shared Structure-of-Arrays (`SoA`) memory contract. Every metric in the right-hand telemetry waterfall is measured at runtime and tagged with its computing module.

---

## 2. Architectural Rationale: Why These Technologies and This Exact Execution Order

1. **Stage 1 — `Astro` (Zero-Overhead Static Shell & Instant Boot):**
   Compiles the outer shell to pure static HTML/CSS (`frontend/src/pages/index.astro`), mounting the simulation canvas immediately on GitHub Pages without SPA bundle bloat.
2. **Stage 2 — `TypeScript` + `SceneBufferSoA` (Deterministic Orchestrator & Memory Contract):**
   Governs the monotonic `108-second` phase clock, `C²`-continuous Perlin `smootherstep` envelopes, the deterministic 32-bit `Mulberry32 / SplitMix32` PRNG (`seed = 104729`), `QualityGovernor`, and the flat binary `SceneBufferSoA` (`24-byte` `'UNVS'` little-endian header + typed arrays) with `NaN/Infinity` sanitization and `FNV-1a` state hashing.
3. **Stage 3 — `Rust → WebAssembly` & Symplectic TypeScript Kernel (`gravity.rs` / `wasmBridge.ts`):**
   Validates `/wasm/physics_engine.wasm` (binary magic `\0asm` and C-ABI exports) and executes symplectic **Velocity Verlet** (*Kick-Drift-Kick*) orbital integration and **Kuramoto** phase synchronization $r(t) \in [0, 1]$ with seamless deterministic fallback in TypeScript.
4. **Stage 4 — `NEXUS` Graph Topology Engine (`graph_logic.py` / `simulationWorker.ts`):**
   Constructs the three-tier connectome: **Class A Axon Trunks** (Prim's Minimum Spanning Tree across cluster hubs), **Class B Associative Bridges** (windowed Gabriel Graph empty-sphere criterion), and **Class C Dendrites** (Murray's biophysical branching law), alongside triangle-based clustering and BFS hop metrics.
5. **Stage 5 — `High-DPI Canvas 2D` + `WGSL Shader Specifications` (`renderer.ts` / `pipeline.ts`):**
   Renders all 5 phases with `Blue-Noise` 64×64 dithering, `C¹`-continuous `BREACH LENS` boundary refraction, and the deep `Z4` sub-quantum underlay, while probing hardware `WebGPU` adapter support alongside canonical `WGSL` shaders (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`).
6. **Stage 6 — `Custom Zero-Dependency JSX DOM/SVG Engine` (`Layer2_Metrics.tsx` – `Layer5_CipherFinale.tsx`):**
   Uses a custom lightweight `React.createElement` DOM/SVG factory with mount-once incremental bindings (`data-bind`), updating numerical text nodes at `<= 10 Hz` while driving `60 FPS` living wave contours, **Starfall** droplets, and the frameless **Cipher Odometer** finale card without external framework overhead.
7. **Stage 7 — `Web Audio API` (`audioSync.ts`):**
   Streams `/audio/cosmic_ambient.mp3` through `MediaElementAudioSourceNode -> GainNode -> AnalyserNode`, computing a single cached spectral snapshot (`Sub-Bass`, `Low`, `Mid`, `High`, `RMS dBFS`, `Heartbeat`) per frame so music plays continuously across phase transitions, pause, and cycle restarts.

---

## 3. The 5 Phases of the 108-Second Cycle (v2.5)

| Phase | Timeline | Visual & Dramatic Arc (`ILLUSION` / `NEXUS`) | Mathematical Model & Compute Core (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Vacuity & Light Echo)* | `0 – 17s` | Pearl-cyan Zero Point breathing in deep obsidian vacuum (`#020308`) with organically deforming `RS Puppis` light-echo rings and curved `RK2 Curl-Noise` field signals. | Gravitational chirp law, angular FBM wave modulation, `SceneBufferSoA` initialization, and circular velocity anticipation. |
| **02. GENESIS** *(N-Body Spiral Galaxy)* | `17 – 39s` | Tilted 3D 4-arm logarithmic spiral galaxy, binary barycenters connected by a tidal light bridge, and volumetric `M31` / `NGC 3169` dust canyons with cyan rim light (`#7DD3FC`). | Symplectic **Velocity Verlet** orbital integration tracking energy drift `ΔE/E₀` and **Kuramoto** oscillator synchronization `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Evolution & Neuroverse)* | `39 – 64s` | `C²`-continuous morphogenesis of spiral arms into two cortical hemispheres around 5 counter-rotating Keplerian rings. Neuron somas, dendrites, and synaptic pulse comets. | **Class A** MST trunks, **Class B** Gabriel bridges, **Class C** Murray dendrites, and arc-length LUT pulse routing. |
| **04. COLLAPSE** *(Optical Rift & Deep X-RAY)* | `64 – 79s` | Gravitational anomalies deform the neural pathways. Inertial `BREACH LENS` refracts stars, spawns microcracks, and exposes the coordinate grid and deep `Z4` sub-quantum layer. | Compact quartic bell refraction `g(u) = (1 − u²)²`, `Z4` sub-neural currents, and borderless floating node callouts. |
| **05. SINGULARITY** *(Cat's Eye & Finale Card)* | `79 – 108s` | **Act A (`79–87.5s`):** `NGC 6543` 7-shell corona & Black Hole $\rightarrow$ **Act B (`87.5–92.6s`):** spiral collapse into Zero Point $\rightarrow$ **Act C (`92.6–93.05s`):** 0.45s Zero-Point flash $\rightarrow$ **Act D (`93.05–108s`):** emergence of the **DUBNOV ALEXEY** manifesto card with a frameless floating quantum stream (`18–26 Hz`). | Complete radius convergence to Zero Point (`logicConvergence -> 0`), bounded dt-accumulated odometer phase, and persistent translucent `.ambient-loop` mode across subsequent cycles. |

---

## 4. Truth Policy & Execution Modes

| Execution Mode | Active Compute Path | Authentic Telemetry Status Badges |
| :--- | :--- | :--- |
| **A. GitHub Pages Showcase (Default)** | Autonomous browser execution: `Canvas2D-HighDPI` rendering, `TS_FALLBACK` (or `WASM_SIMD_ACTIVE` when `.wasm` is compiled), local TS `NEXUS` graph engine, continuous MP3 Web Audio stream. | `TS_FALLBACK • CLIENT_ONLY`, `Canvas2D-HighDPI`, `PLAYING_MP3` (or `AWAITING_GESTURE`) |
| **B. Local Python Verification & Server** | Standalone Python 3 HTTP/Binary server (`backend/main.py`) verifying Golden PRNG vectors, `'UNVS'` binary framing, `NEXUS` graph metrics, and `BREACH` refraction. | `status: "ok"`, `/api/health`, `/api/topology`, `/api/frame.bin` |

---

## 5. Quick Start, Verification & Deployment

```bash
# 1. Clone repository & install dependencies
git clone [https://github.com/DubnovAlexey/universe.git](https://github.com/DubnovAlexey/universe.git)
cd universe
npm --prefix frontend install

# 2. Start local development server (http://localhost:4321/)
npm run dev

# 3. Run Python mathematical & binary protocol parity verification
python -B -m backend.main --verify

# 4. Run TypeScript strict typecheck & automated regression test suite (9/9 invariants)
npm run typecheck
npm test

# 5. Build production bundle for GitHub Pages (base: '/universe')
npm run build