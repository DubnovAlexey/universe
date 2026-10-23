# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.5)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Polyglot Stack](https://img.shields.io/badge/Stack-Astro_%7C_TS_%7C_Custom_JSX_DOM_%7C_Canvas2D_WGSL_%7C_Rust_WASM_%7C_Python-6366f1?style=for-the-badge)](#2-architectural-rationale-why-these-technologies-and-this-exact-execution-order)
[![Deterministic Core](https://img.shields.io/badge/Engine-Deterministic_PRNG_%26_State_Digest-f59e0b?style=for-the-badge)](#6-truth-policy--execution-modes)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

---

# 🇬🇧 ENGLISH DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive audiovisual installation ("From Zero to Zero", ~108-second continuous cycle) and an interactive **Runtime Polyglot** architectural presentation created by **Alexey Dubnov (`DubnovAlexey`)** and hosted directly on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) are not separate animations — they are **three optical readings of a single authoritative simulation state (`SceneBufferSoA`)**.

* **For Viewers, Art Directors & Technical Recruiters (HR):** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and spatial ambient sound — captivating from the very first second. In the finale (`05. SINGULARITY`), the "Cat's Eye" nebula corona and Black Hole collapse into a single point of light and seamlessly unfold into an interactive holographic developer manifesto card (`DUBNOV ALEXEY`) with direct links to the author's main GitHub profile and project repository. As the cosmos continues to cycle in the background, the manifesto card remains softly suspended in a translucent `.ambient-loop` state, illuminating on mouse hover at any moment.
* **For Senior Engineers, Systems Architects, Professors & CTOs:** A deeply engineered polyglot system where **Astro, TypeScript, a Custom Zero-Dependency JSX DOM/SVG Engine, High-DPI Canvas 2D + WGSL Shaders, Rust (WebAssembly), Python 3, and Web Audio API** operate in a strictly ordered, zero-bottleneck pipeline over a shared Structure-of-Arrays (`SoA`) memory contract. Every metric in the right-hand telemetry waterfall is measured in real time and tagged with its exact computing module (`[ts/renderer.ts]`, `[rust/gravity.rs]`, `[ts/graph_engine]`, `[python/graph_logic.py]`, `[web-audio]`).

---

## 2. Architectural Rationale: Why These Technologies and This Exact Execution Order

A central goal of **UNIVERSE** is to prove that a browser-based installation can achieve native-class visual fidelity and mathematical depth at `60–144 FPS` without frame drops or garbage collection (`GC`) stalls. No single language or framework can optimally handle instant static delivery, deterministic N-body physics, scientific graph theory, GPU/Canvas ray-deflection fields, and accessible reactive UI simultaneously.

Therefore, the project is built as a **strictly ordered 7-stage polyglot conveyor**, where each technology performs only the task for which it is mathematically and architecturally optimal:

1. **Stage 1 — `Astro` (Zero-Overhead Static Shell & Instant Boot):**
   * *Why chosen:* Traditional SPA bundlers ship megabytes of hydration JavaScript before rendering the first pixel. **Astro** compiles the outer shell (`frontend/src/pages/index.astro`) to pure, zero-overhead static HTML/CSS and mounts the interactive canvas immediately, ensuring the installation starts on GitHub Pages in milliseconds.
2. **Stage 2 — `TypeScript` + `SceneBufferSoA` (Deterministic Orchestration & Binary Memory Contract):**
   * *Why chosen:* TypeScript governs the monotonic `108-second` clock, the `C²`-continuous Perlin `smootherstep` transition curves, the deterministic 32-bit `Mulberry32 / SplitMix32` PRNG (`GOLDEN_SEED = 104729`), `QualityGovernor`, and the flat binary `SceneBufferSoA` (`Float32Array` / `Uint32Array` over a `24-byte` `'UNVS'` little-endian header).
   * *Why in this order:* Placing the flat `SoA` binary buffer at the center of the TypeScript orchestrator eliminates JSON serialization and object allocations in the hot loop, allowing downstream physics, graph, and rendering engines to read and write contiguous memory blocks directly with `NaN/Infinity` sanitization and `FNV-1a` state hashing.
3. **Stage 3 — `Rust → WebAssembly` + Deterministic TypeScript Symplectic Kernel (`gravity.rs` / `wasmBridge.ts`):**
   * *Why chosen:* Continuous gravitational integration (`Velocity Verlet` *Kick-Drift-Kick*), total Hamiltonian energy drift tracking (`ΔE / E₀`), **Kuramoto** phase coupling across hundreds of oscillators, and 32-bit `FNV-1a` state hashing require predictable, unboxed arithmetic without JIT deoptimizations or GC pauses. `WasmPhysicsBridge` strictly validates `/wasm/physics_engine.wasm` (checking binary byte length, `\0asm` magic signature, and C-ABI memory pointers) and provides a 100% deterministic TypeScript symplectic fallback (`TS_FALLBACK`) so the simulation runs with identical precision in every browser.
4. **Stage 4 — `Python 3` & `NEXUS` Graph Topology Engine (`graph_logic.py` / `simulationWorker.ts`):**
   * *Why chosen:* Python is the universal language of scientific computing and network topology. In Phase 03 (`EVOLUTION`), the `NEXUS` graph engine constructs the three-tier biological connectome: **Class A Axon Trunks** (Prim's Euclidean Minimum Spanning Tree across cluster hubs), **Class B Associative Bridges** (Gabriel Graph empty-sphere criterion), and **Class C Dendrites** (Murray's biophysical cube law $r_p^3 = \sum r_c^3$), alongside triangle-based clustering coefficients and BFS shortest-path hop metrics.
5. **Stage 5 — `High-DPI Canvas 2D` + `WebGPU (WGSL)` Shader Specifications (`renderer.ts` / `pipeline.ts` / `*.wgsl`):**
   * *Why chosen:* Volumetric spiral dust canyons (`M31` / `NGC 3169`), relativistic `NGC 6543` corona shells, Einstein gravitational lensing, `64×64 Blue-Noise` dithering, and `C¹`-continuous `BREACH LENS` boundary refraction with deep `Z4` sub-quantum currents are rendered through a precision **High-DPI Canvas 2D** pipeline (`Canvas2D-HighDPI`), paired with hardware `WebGPU` adapter probing and canonical **WGSL** shaders (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`).
6. **Stage 6 — `Custom Zero-Dependency JSX DOM/SVG Engine` (`Layer2_Metrics.tsx` – `Layer5_CipherFinale.tsx`):**
   * *Why chosen:* Rendering complex engineering tables and interactive DOM controls inside a raw canvas compromises accessibility and text crispness, whereas heavy virtual-DOM runtimes introduce bundle and reconciliation overhead. By implementing a custom, zero-dependency `React.createElement` DOM/SVG factory with mount-once `data-bind` references (`<= 10 Hz` text updates combined with `60 FPS` direct SVG/CSS wave contours, **Starfall** droplets, and the frameless **Odometer** manifesto card), we achieve razor-sharp typography with zero impact on simulation FPS.
7. **Stage 7 — `Web Audio API` + Continuous Mastered Stream (`audioSync.ts`):**
   * *Why chosen:* Synchronizes the mastered `/audio/cosmic_ambient.mp3` soundtrack (automatically skipping its initial `2.6s` silent lead-in) with real-time `AnalyserNode` FFT spectral extraction (`Sub-Bass 20–90 Hz`, `Low`, `Mid`, `High` bands, `RMS dBFS`, and `Heartbeat`), computing a single cached snapshot per frame and feeding acoustic energy into the visual breathing envelopes without interrupting playback across phase transitions or restarts.

---

## 3. Organic Visual Language & Living Interface Architecture (v2.5)

Every visual layer, wave, background structure, and telemetry element in **UNIVERSE v2.5** behaves as a living extension of the cosmic simulation:

1. **Organically Deforming Light-Echo Rings (Act 01 — `VOID`):**
   Concentric light-echo waves inspired by the `RS Puppis` Cepheid variable star do not expand as rigid geometric circles. As each ring propagates from the center toward the edges across 120 angular segments, it breathes and deforms via multi-octave FBM turbulence and local attraction toward surrounding energy structures.
2. **Phase-Adaptive Field Backgrounds (Complete Elimination of Rigid Diagonal Bars):**
   Artificial straight background struts are eliminated across all phases and replaced by deep, phase-specific organic phenomena:
   * **Act 01 (`VOID`):** Translucent vacuum field veils and rare, delicate curved quantum signals running across the field (`RK2 Curl-Noise`).
   * **Act 02 (`GENESIS`):** 48 multi-layered logarithmic spiral dust clouds and light-absorbing gas canyons (`#020308`) with cold cyan rim lighting (`#7DD3FC`) modeled after Hubble observations of the Andromeda Galaxy (`M31`) and `NGC 3169`.
   * **Acts 03–05 (`EVOLUTION`, `COLLAPSE`, `SINGULARITY`):** 5 counter-rotating Keplerian rings, sculpted bilateral cortical hemispheres, and migrating synaptic pulse comets.
3. **Deep Sub-Quantum Universe Underlay (`BREACH LENS` & `Z4` Echelon):**
   Pressing or holding the mouse button (or `Space`) opens the inertial `BREACH LENS` (`ζ ≈ 0.92`) with its living circular boundary, deterministic microcracks, and internal coordinate grid cells. Beneath these grid cells, a deeper sub-quantum echelon (`Z4`) opens up — exposing the "reverse side of the Universe" with subtle internal neural movements and deep lattice currents. Node callouts (`ID#... [module]`) float in space without rectangular boxes.
4. **Full-Height "Digital Waterfall & Starfall" Telemetry (`Layers 2–4`):**
   * **Full Vertical Span & Enlarged Readability:** The right-side telemetry panel extends from the top to the bottom of the right viewport edge with high-clarity typography.
   * **Living `BREACH`-Style Contours:** All straight lines and rectangular corners are removed. The telemetry column is framed by the same organically fluctuating wave contour equation that governs the interactive `BREACH LENS` circle around the mouse cursor.
   * **Breathing Metrics & Starfall / Droplet Decay:** Numbers, signs, and telemetry rows gently breathe in sync with the music's sub-bass. Periodically, individual digits detach and drift downward like falling stars (`drip-by-drip` at natural intervals), while live values immediately refresh in place.
5. **Frameless Quantum Odometer & Persistent Translucent Finale Card (`Act 05 — Layer 5`):**
   * **Zero-Point Collapse & Instant Emergence:** In `05. SINGULARITY`, the 7-shell `NGC 6543` corona, Black Hole shadow, and `LOGIC` convergence ring spiral strictly into the central Zero Point (`radius -> 0 px`), followed by a `0.45s` Zero-Point flash and immediate unfolding of the **`DUBNOV ALEXEY`** manifesto card without dead pauses.
   * **Frameless Floating Quantum Row (`18–26 Hz`):** Once the odometer settles, the authorship header (`DUBNOV ALEXEY`) and polyglot architecture lines lock cleanly in place, while the central quantum symbol row spins rapidly in mid-air (`~8–11` character permutations per second) without any rectangular border, pill, or box.
   * **Interactive Hover Re-Spin & Persistent `.ambient-loop` Mode:** Hovering the mouse cursor over any locked text row or action button triggers a smooth quantum re-spin. When the 108-second cycle restarts (`01. VOID`), the manifesto card does not vanish — it transitions into a translucent background state (`.ambient-loop`, `opacity: 0.46`) over the evolving cosmos and smoothly brightens to `0.98` whenever hovered.

---

## 4. The 5 Phases of the 108-Second Cycle

| Phase | Timeline | Visual & Dramatic Arc (`ILLUSION` / `NEXUS`) | Mathematical Model & Compute Core (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Vacuity & Light Echo)* | `0 – 17s` | Pearl-cyan Zero Point breathing in deep obsidian vacuum (`#020308`) with 7 organically deforming `RS Puppis` light-echo rings across depth echelons (`Z0`–`Z3`) and curved field signals. | Binary inspiral gravitational chirp law `T_n = T_0 · (1 − n/N)^1.65`, angular wave perturbation `R_k(θ,t)`, instant-start audio envelope, and circular velocity anticipation `v_t ≈ sqrt(G·M(r)/r)`. |
| **02. GENESIS** *(N-Body Spiral Galaxy)* | `17 – 39s` | Tilted 3D 4-arm spiral galaxy across the 16:9 viewport, binary barycenters connected by a tidal light bridge, volumetric `M31` / `NGC 3169` spiral dust clouds, and cyan rim light (`#7DD3FC`). | Symplectic **Velocity Verlet** (*Kick-Drift-Kick*) integrator (`gravity.rs` / `wasmBridge.ts`) tracking Hamiltonian energy drift `ΔE/E₀`, domain-warped FBM, and **Kuramoto** synchronization `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Evolution & Neuroverse)* | `39 – 64s` | Seamless `C²`-continuous morphogenesis of spiral arms into two sculpted cortical hemispheres around a 5-ring Keplerian skeleton. Tri-layered neuron somas, branching dendrites, and synaptic pulse comets. | Graph topology generated by `NEXUS` (`graph_logic.py` / `simulationWorker.ts`): **Class A Axon Trunks** (Prim's MST), **Class B Bridges** (Gabriel graph), **Class C Dendrites** (Murray's law `r_p³ = Σ r_c³`), and `lengthLUT` routing. |
| **04. COLLAPSE** *(Optical Rift & Deep X-RAY)* | `64 – 79s` | Three gravitational anomalies deform neural pathways. Inertial `BREACH LENS` refracts stars, spawns microcracks, and exposes coordinate grid cells and the deep `Z4` sub-quantum neural underlay. | `C¹`-continuous radial/tangential refraction bell `g(u) = (1 − u²)²` (`breach.wgsl` / `breach_math.rs` / `stressState.ts`), `Z4` sub-currents, and borderless floating node callouts. |
| **05. SINGULARITY** *(Cat's Eye & Finale Card)* | `79 – 108s` | **Act A (`79–87.5s`):** 7-shell `NGC 6543` corona & Black Hole $\rightarrow$ **Act B (`87.5–92.6s`):** spiral collapse into Zero Point $\rightarrow$ **Act C (`92.6–93.05s`):** `0.45s` Zero-Point flash $\rightarrow$ **Act D (`93.05–108s`):** **`DUBNOV ALEXEY`** manifesto card & frameless quantum odometer. | Einstein deflection `α ≈ 4GM/(c²b)`, complete convergence to Zero (`logicConvergence -> 0`), bounded `dt`-accumulated reel velocity (`18–26 Hz`), persistent `.ambient-loop` card, and clean `ResourceLedger` reset. |

---

## 5. Runtime Polyglot Architecture & Memory Contract

### Data Flow & Signal Pipeline (English Diagram)

    [Stage 1: Astro Static Shell (index.astro)]
           │
           ▼
    [Stage 2: TypeScript Master Clock (0..108s) & UniverseStore]
           ├──► C² Perlin smootherstep Camera & Phase Envelopes
           ├──► QualityGovernor (EMA Frame Time + 3.5s Hysteresis)
           └──► Authoritative SceneBufferSoA (24-byte 'UNVS' Little-Endian Header + Typed Arrays)
                      │  id | kind | pos(X,Y,Z) | prevPos | vel(X,Y,Z) | depthZ | energy | flags
                      │  + Real-Time 32-bit FNV-1a State Digest (e.g., 0x6AB09A72)
                      ├──────────────────────────────────────────────┐
                      ▼                                              ▼
    [Stage 3: Symplectic Physics & Kuramoto]        [Stage 4: NEXUS Cognitive Graph Engine]
    • Rust/WASM Crate (physics_engine/src/*.rs)     • TS Engine (simulationWorker.ts)
    • Deterministic TS Kernel (wasmBridge.ts)       • Python Reference (backend/core/graph_logic.py)
    • Velocity Verlet (Kick-Drift-Kick, ΔE/E₀)      • Class A (Prim MST), Class B (Gabriel), Class C (Murray)
    • Kuramoto Coherence Order Parameter r(t)       • Triangle Clustering C & BFS Hop Diameter D
                      │                                              │
                      └──────────────────────┬───────────────────────┘
                                             ▼
    [Stage 5: High-DPI Canvas 2D Pipeline (renderer.ts / pipeline.ts) + WGSL Specs (*.wgsl)]
    • Z0 Bokeh | Z1 Somas & Pulses | Z2 M31 Dust Canyons | Z3 X-Ray Grid | Z4 Sub-Quantum Lattice
    • BREACH LENS C¹ Quartic Bell Refraction g(u) = (1 - u²)² & 64x64 Blue-Noise Dithering
                                             │
                                             ▼
    [Stage 6 & 7: Custom JSX DOM/SVG Overlays (Layers 2–5) + Single-Pass Web Audio Analyser]
    • Master Audio Snapshot (cosmic_ambient.mp3 -> GainNode -> AnalyserNode -> cachedSnapshot)
    • Layers 2–4: Living BREACH SVG Contours, Breathing Metrics & Starfall Droplets
    • Layer 5: Frameless Quantum Stream (18–26 Hz) & Persistent Translucent Finale Card

### Binary Memory Contract (`SceneBufferSoA` Structure-of-Arrays)

| Byte Offset / Array | Field Name | Data Type | Elements / Size | Module Owner & Engineering Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `Header +0x00` | `magic` | `Uint32` | `4 bytes` | Constant `0x53564E55` (`"UNVS"` in little-endian ASCII). |
| `Header +0x04` | `schemaVersion` | `Uint16` | `2 bytes` | Binary protocol schema version (`2`). |
| `Header +0x06` | `flags` | `Uint16` | `2 bytes` | Active subsystem and buffer status bitmask. |
| `Header +0x08` | `tick` | `Uint32` | `4 bytes` | Monotonic simulation step counter. |
| `Header +0x0C` | `count` | `Uint32` | `4 bytes` | Active entity count (`N <= 1024`). |
| `Header +0x10` | `seed` | `Uint32` | `4 bytes` | Deterministic universe seed (`GOLDEN_SEED = 104729`). |
| `Header +0x14` | `digest` | `Uint32` | `4 bytes` | `FNV-1a` 32-bit hash across quantized coordinates, velocities, and energies. |
| `SoA Array 1` | `pos / prevPos / interpPos` | `Float32Array` | `3 × 1024` | `[ts/sceneBuffer.ts]` 3D world positions across depth echelons `Z0`–`Z3` with `NaN/Infinity` guard. |
| `SoA Array 2` | `vel` | `Float32Array` | `3 × 1024` | `[rust/gravity.rs]` Velocity vectors `(vx, vy, vz)`. |
| `SoA Array 3` | `depthZ / energy / flags` | `Float32 / Uint32` | `3 × 1024` | Depth echelon, synaptic charge, and hemisphere/cluster bitmasks. |

---

## 6. Truth Policy & Execution Modes

**UNIVERSE** enforces **Zero Fake Telemetry**. Every status badge in `LAYER_02`, `LAYER_03`, and `LAYER_04` initializes with `0 ms` and reflects actual runtime measurements:

| Execution Mode | Active Compute Path | Authentic Telemetry Status Badges |
| :--- | :--- | :--- |
| **A. Live GitHub Pages Showcase (Default)** | Runs 100% autonomously in the visitor's browser without external servers: rendering via `Canvas2D-HighDPI`, physics via `Rust/WASM` (or verified `TS_FALLBACK`), `NEXUS` graph via local TS engine, continuous MP3 Web Audio stream. | `TS_FALLBACK • CLIENT_ONLY` (or `WASM_SIMD_ACTIVE`), `Canvas2D-HighDPI`, `PLAYING_MP3` |
| **B. Local Python Verification & Server Mode** | Standalone Python 3 HTTP/Binary server (`backend/main.py`) verifying Golden PRNG vectors, `'UNVS'` binary framing, `NEXUS` graph topology, and `BREACH LENS` refraction. | `status: "ok"`, `/api/health`, `/api/topology`, `/api/frame.bin` |

---

## 7. Experiencing the Presentation & Optional Local Reproduction

### Viewing the Live Installation (For Visitors, Recruiters & Art Directors)
The primary form of **UNIVERSE** is the live interactive web presentation hosted on **GitHub Pages**:
* **Launch URL:** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Author's GitHub Profile:** [https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)
* **Interactive Controls:**
   * **Left Mouse Button / Touch Hold / `Space`:** Open the `BREACH LENS` at the pointer position, refract surrounding starlight along the unstable rim, open the coordinate grid cells, and reveal the deep `Z4` sub-quantum neural layer underneath.
   * **Mouse Hover on Act 05 Manifesto Rows & Corner Panels:** Hovering over any row of the manifesto card triggers a quantum character re-spin; hovering over any item in the corner HUD panels locks the hovered item in place while gently scrambling its neighbors.
   * **Bottom Control Dock / Keys `1`–`5`:** Switch phases (`01.VOID` through `05.SINGULARITY`) or toggle `PAUSE` (`P`), `AUTO`, `AUDIO` (`M`), `METRICS` (`2`), `TOPOLOGY` (`3`), `TERMINAL` (`4`), `X-RAY` (`5`), and direct transition to `↗ GITHUB`.

### Optional Local Build & Automated Verification (For Engineers Inspecting the Repository)
If you clone the repository to inspect or test the polyglot architecture on your workstation, run these commands in your terminal:

    git clone [https://github.com/DubnovAlexey/universe.git](https://github.com/DubnovAlexey/universe.git)
    cd universe
    npm --prefix frontend install
    npm run dev
    python -B -m backend.main --verify
    npm run typecheck
    npm test
    npm run build

---
---

# 🇷🇺 РУССКАЯ ДОКУМЕНТАЦИЯ

## 1. О проекте и философской концепции

**UNIVERSE (Нейроверс)** — полноэкранная интерактивная кинематографическая аудиовизуальная инсталляция («Из Нуля в Ноль», непрерывный цикл 108 секунд) и живая архитектурная презентация **Runtime Polyglot**, созданная **Алексеем Дубновым (`DubnovAlexey`)** и развёрнутая на **GitHub Pages**.

**Философская ось проекта:** Космическая красота (`ILLUSION`), возникающая нейронная сеть мозга (`NEXUS`) и вычислительная логика (`X-RAY / TRUTH`) — это не три разные анимации, а **три оптических прочтения одного и того же детерминированного буфера состояния симуляции (`SceneBufferSoA`)**.

* **Для зрителя, арт-директора и HR-специалиста:** самодостаточный генеративный научно-фантастический фильм, который запускается автоматически с первой секунды при переходе по ссылке и удерживает внимание драматургией света, глубокими бархатными тенями, 5 планами параллакса (`Z0`–`Z4`), отсутствием чужеродных прямых линий и живым дыханием каждого элемента. В 5-й фазе корона «Кошачьего глаза» (`NGC 6543`) и Чёрная дыра сжимаются в яркую микро-точку и **без паузы** раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой и кнопками прямого перехода на главную страницу профиля GitHub (`[https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)`) и в папку проекта (`[https://github.com/DubnovAlexey/universe](https://github.com/DubnovAlexey/universe)`). После завершения первого круга космос продолжает двигаться по циклу, а визитка остаётся полупрозрачно парить на фоне (`.ambient-loop`), плавно проявляясь на 100% при наведении мыши в любой момент.
* **Для Senior-разработчика, преподавателя, системного архитектора и CTO:** прозрачная многоязыковая система, в которой **Astro, TypeScript, собственная легковесная фабрика JSX DOM/SVG, High-DPI Canvas 2D + шейдерные спецификации WGSL, Rust (WebAssembly), Python 3 и Web Audio API** выстроены в строго упорядоченный конвейер вокруг единого бинарного контракта памяти (`Structure of Arrays`). Каждое число в режиме рентгена (`X-RAY`) и в правом цифровом водопаде измеряется в реальном времени и имеет точную подпись вычислившего его модуля (`[ts/renderer.ts]`, `[rust/gravity.rs]`, `[ts/graph_engine]`, `[python/graph_logic.py]`, `[web-audio]`).

---

## 2. Обоснование полиглот-архитектуры: почему выбраны именно эти технологии и порядок их взаимодействия

Главная инженерная задача **UNIVERSE** — добиться того, чтобы сложная физическая и астрофизическая симуляция работала прямо в браузере на частоте `60–144 FPS` с максимальной визуальной глубиной, без микрофризов и без пауз сборщика мусора (`Garbage Collector`). Ни один отдельно взятый язык не способен одинаково эффективно решать задачи мгновенной доставки статики, симплектической гравитации N-тел, научной теории графов, оптики преломления света и доступного реактивного интерфейса.

Поэтому в проекте применена **строго выверенная 7-ступенчатая последовательность взаимодействия технологий**, где каждый инструмент отвечает ровно за ту область, в которой он даёт максимальную производительность:

1. **Ступень 1 — `Astro` (Мгновенная доставка и нулевой оверхед оболочки):**
   * *Почему выбран:* Классические SPA-фреймворки заставляют браузер загружать и парсить тяжёлые бандлы до появления первого кадра. **Astro** формирует сверхлёгкий статический каркас (`frontend/src/pages/index.astro`) и мгновенно инициализирует холст симуляции, обеспечивая моментальный старт презентации на GitHub Pages.
2. **Ступень 2 — `TypeScript` + `SceneBufferSoA` (Детерминированный оркестратор и контракт памяти):**
   * *Почему выбран:* TypeScript управляет монотонными часами цикла (`0..108 с`), `C²`-гладкими полиномами Перлина `smootherstep`, детерминированным 32-битным генератором `Mulberry32 / SplitMix32` (`GOLDEN_SEED = 104729`), регулятором качества `QualityGovernor` и плоским бинарным буфером `SceneBufferSoA` (`Float32Array` / `Uint32Array` с 24-байтным заголовком `'UNVS'` в формате `Little-Endian`).
   * *Почему стоит на этом месте:* Размещение плоского бинарного буфера `SoA` в центре оркестратора полностью исключает затраты на `JSON.stringify/parse` и создание временных объектов в горячем цикле кадра — все вычислительные ядра работают с непрерывными массивами чисел, защищёнными от `NaN / Infinity` и сверяемыми 32-битным хешем `FNV-1a State Digest`.
3. **Ступень 3 — `Rust → WebAssembly` + Симплектическое ядро TypeScript (`gravity.rs` / `wasmBridge.ts`):**
   * *Почему выбран:* Интегрирование орбит методом **Velocity Verlet** (*Kick-Drift-Kick*), контроль относительного дрейфа полной механической энергии (`ΔE / E₀`), фазовая синхронизация осцилляторов **Курамото** $r(t) \in [0, 1]$ и расчёт 32-битного хеша состояния требуют предсказуемой арифметики без пауз GC. Мост `WasmPhysicsBridge` проверяет бинарную сигнатуру `\0asm` и экспорты `/wasm/physics_engine.wasm`, обеспечивая работу как с нативным модулем WASM, так и с 100% детерминированным симплектическим ядром в TypeScript (`TS_FALLBACK`).
4. **Ступень 4 — `Python 3` и графовое ядро `NEXUS` (`graph_logic.py` / `simulationWorker.ts`):**
   * *Почему выбран:* Python — эталонный язык научных расчётов и теории графов. В фазе `03. EVOLUTION` графовый движок строит трёхуровневую биологически достоверную сеть мозга: **Класс A (Магистральные аксоны)** через остовное дерево Прима (`MST`), **Класс B (Синаптические мосты)** по критерию пустой сферы графа Габриэля и **Класс C (Дендриты)** по биофизическому закону Мюррея ($r_p^3 = \sum r_c^3$), а также рассчитывает коэффициент кластеризации по замкнутым треугольникам и диаметр графа методом обхода в ширину (`BFS`).
5. **Ступень 5 — `High-DPI Canvas 2D` + Шейдерные спецификации `WGSL` (`renderer.ts` / `pipeline.ts` / `*.wgsl`):**
   * *Почему выбран:* Многооктавный шум пылевых рукавов галактик (`M31` / `NGC 3169`), 7-оболочечная корона «Кошачьего глаза» (`NGC 6543`), релятивистское гравитационное линзирование, `64×64 Blue-Noise` дизеринг и гладкое преломление мембраны `BREACH LENS` с глубинным эшелоном `Z4` отрисовываются через высокоточный конвейер **High-DPI Canvas 2D** (`Canvas2D-HighDPI`), сопровождаемый проверкой аппаратного адаптера `WebGPU` и тремя каноническими шейдерами **WGSL** (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`).
6. **Ступень 6 — `Собственная легковесная фабрика JSX DOM/SVG` (`Layer2_Metrics.tsx` – `Layer5_CipherFinale.tsx`):**
   * *Почему выбрана:* Отрисовка сложных таблиц и интерактивных кнопок внутри Canvas ухудшает чёткость шрифтов, а тяжёлые фреймворки виртуального DOM создают лишнюю нагрузку. Мы реализовали собственную автономную фабрику `React.createElement` для HTML и SVG с однократным монтированием (`mount-once`) и точечными привязками `data-bind`: числовые срезы телеметрии обновляются с частотой `<= 10 Гц`, а движение **Цифрового водопада**, **Звездопада цифр** и парящей строки **Одометра** работает на `60 FPS` напрямую через атрибуты DOM/SVG.
7. **Ступень 7 — `Web Audio API` + Мастеринговый аудиопоток (`audioSync.ts`):**
   * *Почему выбран:* Обеспечивает мгновенный запуск музыкальной темы `/audio/cosmic_ambient.mp3` (с автоматическим пропуском начальной тихой паузы на `2.6 с`) и один раз за кадр извлекает через `AnalyserNode` амплитудно-частотные огибающие (`Sub-Bass`, `Low`, `Mid`, `High`, `RMS dBFS`, `Heartbeat`), которые раздаются из кеша всем слоям и управляют дыханием космоса и финальной визитки без прерывания музыки.

---

## 3. Органическая визуальная среда и живой интерфейс (Архитектура v2.5)

В версии **v2.5** полностью исключена механистическая чужеродность интерфейса: в проекте нет мёртвых геометрических рамок, случайных прямых палок на фоне или статичных таблиц — каждый элемент вписан в единую живую среду:

1. **Живые деформирующиеся кольца светового эха (Акт 01 — `VOID`):**
   Концентрические волны вокруг центральной точки (прообраз — световое эхо переменной звезды-цефеиды `RS Кормы / RS Puppis`) не расходятся стерильно-правильными «кругами по воде». Каждое кольцо дышит и нестабильно изменяется по всем 120 сегментам, взаимодействуя с окружающими энергетическими структурами.
2. **Фазозависимые полевые и спиральные структуры:**
   * **в фазе `01. VOID`** — глубокие полевые структуры вакуума и редкие пробегающие от края до края криволинейные квантовые сигналы (`RK2 Curl-Noise`);
   * **в фазе `02. GENESIS`** — 48 многослойных спиралевидных облаков межзвёздной пыли и тёмных каньонов поглощения света по прообразу галактик `Андромеда (M31)` и `NGC 3169`;
   * **в фазах `03. EVOLUTION` — `05. SINGULARITY`** — 5 встречных кеплеровских колец, два рельефных полушария Мозга и мигрирующие кометы синаптических импульсов.
3. **«Обратная сторона Вселенной» под клеточками линзы `BREACH LENS` (Эшелон `Z4`):**
   При наведении и нажатии кнопки мыши раскрывается круглая оптическая мембрана с нестабильным живым контуром и координатными клеточками. Под клеточками открывается более глубокая структура (`Z4`) — «изнанка Вселенной» с внутренними нейросетевыми передвижениями и глубинными токами. Выноски узлов (`ID#... [модуль]`) парят в пространстве без прямоугольных рамок.
4. **Правая панель телеметрии: во всю высоту, контур линзы, «Водопад» и «Звездопад» (`Layers 2–4`):**
   * **Во всю правую сторону и крупнее:** Панель с данными растянута сверху донизу вдоль правой границы экрана, а шрифт цифр и показателей укрупнён для отличной читаемости.
   * **Живой контур как у мышки при нажатии:** Все прямые линии и прямоугольные углы таблиц убраны. Границы правой панели оформлены такими же нестабильными, плавно двигающимися и дышащими волновыми линиями, как окружность `BREACH LENS` вокруг курсора мыши.
   * **Эффект «Водопада» и «Звездопада / Капель»:** Все знаки и значения внутри правой панели мягко дышат в такт басу музыки. Время от времени отдельные символы отделяются и падают вниз, как падающие звёзды или капли (`кап-кап` с естественной частотой), а на их месте тут же зажигаются новые значения.
5. **Бесшовная голографическая визитка и парящая в воздухе без рамок квантовая строка (`Акт 05 — Layer 5`):**
   * **Сжатие в Точку Нуля и мгновенное возрождение:** В 5-й фазе корона «Кошачьего глаза» (`NGC 6543`), тень Чёрной дыры и кольцо конвергенции сжимаются по спирали строго в центральную точку (`radius -> 0 px`), дают короткий `0.45 с` импульс и сразу же раскрываются в визитку **`DUBNOV ALEXEY`** без зависаний.
   * **Парящая квантовая строка без рамок (`18–26 Гц`):** Вокруг центральной бегущей строки полностью убраны любые рамки, плашки и фоновые прямоугольники — символы свободно висят в воздухе в едином стиле с остальными строками и перебираются в быстром живом ритме (`~8–11` смен на символ в секунду).
   * **Постоянный полупрозрачный режим на следующих кругах (`.ambient-loop`):** После завершения первого 108-секундного прохода космос плавно переходит в `01. VOID` и идёт по кругу под музыку, а визитка остаётся полупрозрачно парить на фоне (`opacity: 0.46`) и плавно загорается до `0.98` при наведении курсора мыши.

---

## 4. Пять фаз единого 108-секундного цикла

| Фаза цикла | Тайминг | Визуальная драматургия (`ILLUSION` / `NEXUS`) | Математическая модель и вычислительное ядро (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Пустота и световое эхо)* | `0 – 17 с` | Жемчужно-голубое ядро дышит в обсидиановом вакууме (`#020308`), распуская 7 нестабильных, живо дышащих колец светового эха `RS Кормы` и криволинейные квантовые сигналы от края до края. | Закон гравитационного чирпа `T_n = T_0 · (1 − n/N)^1.65`, угловая FBM-деформация колец `R_k(θ,t)`, мгновенный старт аудиопотока и круговая скорость `v_t ≈ sqrt(G·M(r)/r)`. |
| **02. GENESIS** *(Галактика N-тел)* | `17 – 39 с` | Наклонный 3D-диск 4-рукавной спиральной галактики во весь экран 16:9, спиралевидные пылевые облака `M31` / `NGC 3169`, два центра масс со световым мостом и контровой свет `rim light` (`#7DD3FC`). | Симплектический интегратор **Velocity Verlet** (`gravity.rs` / `wasmBridge.ts`) с контролем дрейфа энергии `ΔE/E₀`, FBM с `domain warping`, волокна `RK2 curl-noise` и синхронизация **Курамото** `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Эволюция и Нейроверс)* | `39 – 64 с` | Бесшовная `C²`-деформация рукавов галактики в два когнитивных полушария Головного Мозга вокруг каркаса из 5 кеплеровских колец. Сомы нейронов, дендриты и каскады синаптических импульсов. | Построение графа `NEXUS` (`graph_logic.py` / `simulationWorker.ts`): **Класс A (Магистрали Прима MST)**, **Класс B (Мосты Габриэля)**, **Класс C (Дендриты Мюррея `r_p³ = Σ r_c³`)**, движение по `lengthLUT`. |
| **04. COLLAPSE** *(Преломление и Шторм)* | `64 – 79 с` | Три гравитационные аномалии упруго изгибают нейронные тракты. Инерционная линза `BREACH LENS` преломляет звёзды, открывает клеточки рентгена и глубинный суб-квантовый слой `Z4`. | `C¹`-непрерывный колокол преломления `g(u) = (1 − u²)²` (`breach.wgsl` / `breach_math.rs` / `stressState.ts`), суб-нейронные токи `Z4` и воздушные выноски узлов без прямоугольных рамок. |
| **05. SINGULARITY** *(Сингулярность и Визитка)* | `79 – 108 с` | **Акт A (`79–87.5 с`):** 7 оболочек короны `NGC 6543` и Чёрная дыра $\rightarrow$ **Акт B (`87.5–92.6 с`):** спиральное сжатие в Точку Нуля $\rightarrow$ **Акт C (`92.6–93.05 с`):** `0.45 с` импульс Точки Нуля $\rightarrow$ **Акт D (`93.05–108 с`):** визитка **`DUBNOV ALEXEY`** и парящий одометр. | Отклонение лучей Эйнштейна `α ≈ 4GM/(c²b)`, полное схождение в Точку Нуля (`logicConvergence -> 0`), накопление фазы одометра через `dtSec` (`18–26 Гц`), постоянный режим `.ambient-loop` и сброс `ResourceLedger`. |

---

## 5. Архитектурная схема конвейера и бинарный контракт памяти

### Схема потоков данных и сигналов (Русская версия)

    [Ступень 1: Статический каркас Astro (index.astro)]
           │
           ▼
    [Ступень 2: Часы TypeScript (0..108 с) и Хранилище UniverseStore]
           ├──► C²-интерполяция камеры и фаз по полиному Перлина smootherstep
           ├──► Регулятор качества QualityGovernor (EMA времени кадра + гистерезис 3.5 с)
           └──► Единый буфер состояния SceneBufferSoA (24-байтный заголовок 'UNVS' Little-Endian)
                      │  id | kind | pos(X,Y,Z) | prevPos | vel(X,Y,Z) | depthZ | energy | flags
                      │  + 32-битный хеш целостности FNV-1a State Digest (напр., 0x6AB09A72)
                      ├──────────────────────────────────────────────┐
                      ▼                                              ▼
    [Ступень 3: Симплектическая физика и Курамото]  [Ступень 4: Графовое ядро NEXUS]
    • Крейт Rust/WASM (physics_engine/src/*.rs)     • TS-движок (simulationWorker.ts)
    • Детерминированное ядро TS (wasmBridge.ts)     • Эталон Python 3 (backend/core/graph_logic.py)
    • Интегратор Velocity Verlet (дрейф ΔE / E₀)    • Класс A (MST Прима), Класс B (Габриэль), Класс C (Мюррей)
    • Параметр синхронизации Курамото r(t) ∈ [0, 1] • Кластеризация по треугольникам C и диаметр BFS D
                      │                                              │
                      └──────────────────────┬───────────────────────┘
                                             ▼
    [Ступень 5: Оптический конвейер High-DPI Canvas 2D (renderer.ts / pipeline.ts) + WGSL (*.wgsl)]
    • Эшелоны Z0 Боке | Z1 Сомы и Импульсы | Z2 Каньоны M31 | Z3 Сетка X-Ray | Z4 Сеть изнанки
    • Мембрана BREACH LENS с C¹-рефракцией g(u) = (1 - u²)² и дизерингом Blue-Noise 64x64
                                             │
                                             ▼
    [Ступени 6 и 7: Живые оверлеи Custom JSX DOM/SVG (Layers 2–5) + Web Audio Analyser]
    • Единый снимок спектра на кадр (cosmic_ambient.mp3 -> GainNode -> AnalyserNode -> cachedSnapshot)
    • Слои 2–4: Правый «Цифровой водопад» во всю высоту, живые контуры BREACH и «Звездопад» цифр
    • Слой 5: Парящая в воздухе без рамок квантовая строка (18–26 Гц) и постоянная визитка

### Бинарный контракт памяти (`SceneBufferSoA` — Structure of Arrays)

| Смещение / Массив | Поле буфера | Тип данных | Размерность | Модуль-владелец и инженерное назначение |
| :--- | :--- | :--- | :---: | :--- |
| `Заголовок +0x00` | `magic` | `Uint32` | `4 байта` | Константа `0x53564E55` (сигнатура `"UNVS"` в формате little-endian). |
| `Заголовок +0x04` | `schemaVersion` | `Uint16` | `2 байта` | Версия бинарного протокола памяти (`2`). |
| `Заголовок +0x06` | `flags` | `Uint16` | `2 байта` | Битовая маска активных подсистем и состояния буфера. |
| `Заголовок +0x08` | `tick` | `Uint32` | `4 байта` | Монотонный счётчик физического шага. |
| `Заголовок +0x0C` | `count` | `Uint32` | `4 байта` | Число активных сущностей (`N <= 1024`). |
| `Заголовок +0x10` | `seed` | `Uint32` | `4 байта` | Детерминированное зерно Вселенной (`GOLDEN_SEED = 104729`). |
| `Заголовок +0x14` | `digest` | `Uint32` | `4 байта` | 32-битный хеш `FNV-1a` по квантованным координатам, скоростям и энергии. |
| `Массив SoA 1` | `pos / prevPos / interpPos` | `Float32Array` | `3 × 1024` | `[ts/sceneBuffer.ts]` Мировые координаты `(x, y, z)` на эшелонах `Z0`–`Z3` с защитой от `NaN / Infinity`. |
| `Массив SoA 2` | `vel` | `Float32Array` | `3 × 1024` | `[rust/gravity.rs]` Векторы скорости `(vx, vy, vz)`. |
| `Массив SoA 3` | `depthZ / energy / flags` | `Float32 / Uint32` | `3 × 1024` | Глубина эшелона, синаптический заряд и битовые маски кластеров. |

---

## 6. Честная матрица режимов исполнения (Truth Policy)

Интерфейс никогда не имитирует поддельные метрики (`Zero Fake Telemetry`). Все статусы в правой панели (`LAYER_02` — `LAYER_04`) инициализируются нулями (`0 ms`) и отражают реальное состояние среды исполнения:

| Режим работы | Активный вычислительный контур | Подлинные статусы в правой панели телеметрии |
| :--- | :--- | :--- |
| **A. Онлайн-презентация GitHub Pages (Основной)** | Полностью автономная работа в браузере посетителя без внешних серверов: рендеринг через `Canvas2D-HighDPI`, физика в `Rust/WASM` (или эталонном `TS_FALLBACK`), граф `NEXUS` — в локальном TS-движке, непрерывный поток `Web Audio MP3`. | `TS_FALLBACK • CLIENT_ONLY` (или `WASM_SIMD_ACTIVE`), `Canvas2D-HighDPI`, `PLAYING_MP3` |
| **B. Локальный серверный и верификационный режим Python** | Автономный HTTP/Binary сервер `Python 3` (`backend/main.py`), проверяющий эталонные векторы PRNG, бинарные пакеты `'UNVS'`, топологию `NEXUS` и рефракцию `BREACH LENS`. | `status: "ok"`, `/api/health`, `/api/topology`, `/api/frame.bin` |

---

## 7. Просмотр онлайн-презентации и опциональный локальный запуск

### Просмотр живой инсталляции (для зрителей, рекрутеров и арт-директоров)
Основной формат проекта **UNIVERSE** — интерактивная веб-экспозиция, работающая прямо в браузере на **GitHub Pages** без установки дополнительного ПО:
* **Прямая ссылка на инсталляцию:** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Главная страница профиля автора на GitHub:** [https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)
* **Интерактивное взаимодействие:**
   * **Зажатие левой кнопки мыши / касание экрана / клавиша `Space`:** раскрывает оптическую линзу `BREACH LENS`, преломляет свет звёзд на нестабильной кромке, открывает координатные клеточки рентгена и глубинный суб-квантовый слой `Z4` («изнанку Вселенной»).
   * **Наведение курсора на строки финальной визитки и угловые панели:** наведение на любую строку визитки запускает квантовую прокрутку символов; наведение на любой элемент угловых панелей фиксирует элемент под курсором и мягко перебирает соседние элементы группы.
   * **Нижняя панель управления / клавиши `1`–`5`:** прямое переключение между 5 фазами (`01.VOID` — `05.SINGULARITY`), управление режимами `PAUSE` (`P`), `AUTO`, `AUDIO` (`M`), `METRICS` (`2`), `TOPOLOGY` (`3`), `TERMINAL` (`4`), `X-RAY` (`5`) и кнопка быстрого перехода в профиль `↗ GITHUB`.

### Опциональный локальный запуск и проверка автотестов (для разработчиков и инженеров)
Если вы знакомитесь с репозиторием как инженер и хотите запустить сборку или прогнать набор из 11 автоматических проверок локально на своей рабочей станции, выполните в терминале:

    git clone [https://github.com/DubnovAlexey/universe.git](https://github.com/DubnovAlexey/universe.git)
    cd universe
    npm --prefix frontend install
    npm run dev
    python -B -m backend.main --verify
    npm run typecheck
    npm test
    npm run build

---

## License

MIT License — Copyright (c) 2026 Alexey Dubnov (`DubnovAlexey`).