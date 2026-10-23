# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.5)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Author Profile](https://img.shields.io/badge/GitHub-Alexey_Dubnov-6366f1?style=for-the-badge&logo=github)](https://github.com/DubnovAlexey)
[![Deterministic Core](https://img.shields.io/badge/Verification-11%2F11_Invariants_%26_Python_Parity-f59e0b?style=for-the-badge)](#6-truth-policy--execution-modes)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

* **Live Interactive Presentation (GitHub Pages):** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Author's GitHub Profile:** [https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)
* **Source Code Repository:** [https://github.com/DubnovAlexey/universe](https://github.com/DubnovAlexey/universe)

---

# 🇬🇧 ENGLISH DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive audiovisual installation ("From Zero to Zero", 108-second continuous cycle) and a **Runtime Polyglot** architectural showcase created by **Alexey Dubnov (`DubnovAlexey`)** and hosted on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) are not separate animations — they are **three optical readings of a single deterministic simulation state (`SceneBufferSoA`)**.

* **For Viewers, Art Directors & Technical Recruiters (HR):** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and spatial ambient sound. In the finale (`05. SINGULARITY`), the "Cat's Eye" nebula corona and Black Hole collapse into a single point of light and seamlessly unfold into an interactive holographic developer manifesto card (`DUBNOV ALEXEY`) with direct links to the author's main GitHub profile and project repository. Across subsequent cycles, the manifesto card remains softly suspended in a translucent `.ambient-loop` state, illuminating on mouse hover at any moment.
* **For Senior Engineers, Systems Architects, Professors & CTOs:** A transparent polyglot system combining **Astro, TypeScript, a Custom Zero-Dependency JSX DOM/SVG Engine, High-DPI Canvas 2D + WGSL Shader Specifications, Rust (WebAssembly crate), Python 3 verification/topology modules, and Web Audio API** over a shared Structure-of-Arrays (`SoA`) memory contract. Every metric in the right-hand telemetry waterfall is measured at runtime and tagged with its computing module.

---

## 2. Architectural Rationale: Why These Technologies and This Execution Order

The architecture is designed to target smooth `60–144 FPS` desktop rendering and responsive mobile playback (`QualityGovernor` adaptive scaling) by organizing responsibilities into a **7-stage pipeline**:

1. **Stage 1 — `Astro` (Zero-Overhead Static Shell & Instant Boot):**
   Compiles `frontend/src/pages/index.astro` to pure static HTML/CSS so the installation mounts on GitHub Pages in milliseconds without SPA hydration overhead.
2. **Stage 2 — `TypeScript` + `SceneBufferSoA` (Deterministic Orchestration & Binary Memory Contract):**
   Governs the monotonic `108-second` clock, `C²`-continuous Perlin `smootherstep` envelopes, the deterministic 32-bit `Mulberry32 / SplitMix32` PRNG (`GOLDEN_SEED = 104729`), `QualityGovernor`, and the flat binary `SceneBufferSoA` (`24-byte` `'UNVS'` little-endian header + typed arrays) with `NaN/Infinity` sanitization and `FNV-1a` state hashing.
3. **Stage 3 — `Rust → WebAssembly` Crate + Deterministic TypeScript Symplectic Kernel (`gravity.rs` / `wasmBridge.ts`):**
   Implements symplectic **Velocity Verlet** (*Kick-Drift-Kick*) orbital integration, Hamiltonian energy drift tracking (`ΔE / E₀`), and **Kuramoto** phase synchronization $r(t) \in [0, 1]$ in both the Rust crate (`physics_engine/src/gravity.rs`) and the deterministic TypeScript kernel (`wasmBridge.ts`), guaranteeing identical numerical behavior on static hosting (`TS_FALLBACK`) and when loading a compiled `.wasm` binary (`?wasm=1`).
4. **Stage 4 — `Python 3` & `NEXUS` Graph Topology Engine (`graph_logic.py` / `simulationWorker.ts`):**
   Synthesizes the three-tier connectome: **Class A Axon Trunks** (Prim's Euclidean Minimum Spanning Tree across cluster hubs), **Class B Associative Bridges** (windowed Gabriel Graph empty-sphere criterion), and **Class C Dendrites** (Murray's branching law $r \propto k^{-1/3}$), alongside triangle clustering and sampled BFS hop metrics.
5. **Stage 5 — `High-DPI Canvas 2D` + `WGSL` Shader Specifications (`renderer.ts` / `pipeline.ts` / `*.wgsl`):**
   Executes all 5 phases, `64×64 Blue-Noise` dithering, `C¹`-continuous `BREACH LENS` boundary refraction, and the deep `Z4` sub-quantum underlay through the active `Canvas2D-HighDPI` renderer, paired with hardware `WebGPU` adapter probing and canonical **WGSL** shaders (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`).
6. **Stage 6 — `Custom Zero-Dependency JSX DOM/SVG Engine` (`Layer2_Metrics.tsx` – `Layer5_CipherFinale.tsx`):**
   Uses a custom lightweight `React.createElement` DOM/SVG factory with mount-once `data-bind` node references (`<= 10 Hz` text updates + `60 FPS` living SVG wave contours, **Starfall** droplets, and the frameless **Odometer** manifesto card). On mobile screens (`<= 920px`), telemetry panels default to a collapsed state and operate in single-panel accordion mode so the cosmos remains unobstructed.
7. **Stage 7 — `Web Audio API` + Continuous Mastered Stream (`audioSync.ts`):**
   Streams `/audio/cosmic_ambient.mp3` (skipping the initial `2.6s` silent lead-in) with single-pass per-frame `AnalyserNode` spectral extraction on desktop and direct `audioSession.type = 'playback'` HTML5 audio unlock on iOS/Android mobile devices.

---

## 3. The 5 Phases of the 108-Second Cycle

| Phase | Timeline | Visual & Dramatic Arc (`ILLUSION` / `NEXUS`) | Mathematical Model & Compute Core (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Vacuity & Light Echo)* | `0 – 17s` | Pearl-cyan Zero Point breathing in deep obsidian vacuum (`#020308`) with 7 organically deforming `RS Puppis` light-echo rings and curved `RK2 Curl-Noise` field signals. | Gravitational chirp law, angular FBM wave perturbation, `SceneBufferSoA` initialization, and circular velocity anticipation. |
| **02. GENESIS** *(N-Body Spiral Galaxy)* | `17 – 39s` | Tilted 3D 4-arm spiral galaxy, binary barycenters connected by a tidal light bridge, and 48 volumetric `M31` / `NGC 3169` spiral dust clouds with cyan rim light (`#7DD3FC`). | Symplectic **Velocity Verlet** (*Kick-Drift-Kick*) integrator tracking Hamiltonian energy drift `ΔE/E₀` and **Kuramoto** phase synchronization `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Evolution & Neuroverse)* | `39 – 64s` | Seamless `C²`-continuous morphogenesis of spiral arms into two sculpted cortical hemispheres around a 5-ring Keplerian skeleton. Neuron somas, dendrites, and synaptic pulse comets. | `NEXUS` graph topology: **Class A** Prim's MST trunks, **Class B** Gabriel bridges, **Class C** Murray dendrites, and 5-point Bezier `lengthLUT` routing. |
| **04. COLLAPSE** *(Optical Rift & Deep X-RAY)* | `64 – 79s` | Three gravitational anomalies deform neural pathways. Inertial `BREACH LENS` refracts stars, spawns microcracks, and exposes coordinate grid cells and the deep `Z4` sub-quantum layer. | `C¹`-continuous radial/tangential refraction bell `g(u) = (1 − u²)²` (`u < 1`), `Z4` sub-currents, and borderless floating node callouts. |
| **05. SINGULARITY** *(Cat's Eye & Finale Card)* | `79 – 108s` | **Act A (`79–87.5s`):** 7-shell `NGC 6543` corona & Black Hole $\rightarrow$ **Act B (`87.5–92.6s`):** spiral collapse into Zero Point $\rightarrow$ **Act C (`92.6–93.05s`):** `0.45s` Zero-Point flash $\rightarrow$ **Act D (`93.05–108s`):** **`DUBNOV ALEXEY`** manifesto card & frameless quantum odometer. | Einstein deflection `α ≈ 4GM/(c²b)`, complete convergence to Zero (`logicConvergence -> 0`), bounded `dt`-accumulated reel phase (`18–26 Hz`), and persistent `.ambient-loop` across restarts. |

---

## 4. Runtime Polyglot Architecture & Memory Contract

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
    • Rust Crate (physics_engine/src/*.rs)          • TS Engine (simulationWorker.ts)
    • Deterministic TS Kernel (wasmBridge.ts)       • Python Reference (backend/core/graph_logic.py)
    • Velocity Verlet (Kick-Drift-Kick, ΔE/E₀)      • Class A (Prim MST), Class B (Gabriel), Class C (Murray)
    • Kuramoto Coherence Order Parameter r(t)       • Triangle Clustering C & Sampled BFS Diameter D
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

---

## 5. Truth Policy & Runtime Module Statuses

Every status badge in `LAYER_02`, `LAYER_03`, and `LAYER_04` initializes with `0 ms` and reflects actual execution:

| Module ID | Language / Layer | Default GitHub Pages Status | Actual Role in v2.5 |
| :--- | :--- | :---: | :--- |
| **`ts-core`** | `TypeScript` | `READY` (`ACTIVE`) | Master 108s timeline, `SceneBufferSoA`, `FNV-1a` digest, symplectic physics & `smootherstep` morphing. |
| **`canvas2d-render`** | `Canvas2D` | `READY` (`ACTIVE`) | Primary High-DPI optical renderer for all 5 phases, `Blue-Noise` dithering, `BREACH LENS`, and `Z4`. |
| **`web-audio`** | `WebAudio` | `READY` / `FALLBACK` (`ACTIVE`) | Streams `cosmic_ambient.mp3` after user gesture with single-pass spectral analysis and LFO fallback. |
| **`wasm-physics`** | `Rust/WASM` | `FALLBACK` | Runs deterministic TS Velocity Verlet & Kuramoto by default; loads `/wasm/physics_engine.wasm` when `?wasm=1` is provided and binary magic `\0asm` is valid. |
| **`worker-physics`** | `TypeScript` | `FALLBACK` | Executes deterministic `NEXUS` graph synthesis (`MST + Gabriel + Murray`) synchronously in TS. |
| **`webgpu-render`** | `WGSL/WebGPU` | `FALLBACK` / `UNSUPPORTED` (`PROBE`) | Probes `navigator.gpu.requestAdapter()`; WGSL shaders included as canonical specifications. |
| **`pyodide-graph`** | `Python` | `FALLBACK` (`OFFLINE REF`) | Reference Python `NEXUS` topology engine (`backend/core/graph_logic.py`) verified in CI. |
| **`server-ws`** | `Python` | `INACTIVE` (`OFFLINE TOOL`) | Local Python HTTP/Binary server (`backend/main.py`) & CLI parity verifier (`--verify`). |

---

## 6. Quick Start & Automated Verification Commands

    git clone https://github.com/DubnovAlexey/universe.git
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

**UNIVERSE (Нейроверс)** — полноэкранная интерактивная кинематографическая аудиовизуальная инсталляция («Из Нуля в Ноль», непрерывный цикл 108 секунд) и архитектурная презентация **Runtime Polyglot**, созданная **Алексеем Дубновым (`DubnovAlexey`)** и развёрнутая на **GitHub Pages**.

**Философская ось проекта:** Космическая красота (`ILLUSION`), возникающая нейронная сеть мозга (`NEXUS`) и вычислительная логика (`X-RAY / TRUTH`) — это **три оптических прочтения одного и того же детерминированного буфера состояния симуляции (`SceneBufferSoA`)**.

* **Для зрителя:** самодостаточный генеративный научно-фантастический фильм, который запускается автоматически с первой секунды при переходе по ссылке (как на компьютере в формате `16:9`, так и на мобильном телефоне в вертикальном формате `9:16`). В 5-й фазе корона «Кошачьего глаза» (`NGC 6543`) и Чёрная дыра сжимаются в яркую микро-точку и **без паузы** раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой и кнопками прямого перехода на главную страницу профиля GitHub (`https://github.com/DubnovAlexey`) и в репозиторий проекта (`https://github.com/DubnovAlexey/universe`). После завершения первого круга космос продолжает двигаться по циклу, а визитка остаётся полупрозрачно парить на фоне (`.ambient-loop`), плавно проявляясь на 100% при наведении курсора мыши.
* **Для системного архитектора и CTO:** прозрачная многоязыковая система, объединяющая **Astro, TypeScript, собственную легковесную фабрику JSX DOM/SVG без внешних зависимостей, High-DPI Canvas 2D + шейдерные спецификации WGSL, крейт Rust (WebAssembly), верификационное ядро Python 3 и Web Audio API** вокруг единого бинарного контракта памяти (`Structure of Arrays`).

---

## 2. Семь ступеней архитектуры и адаптация для мобильных устройств (v2.5)

1. **Ступень 1 — `Astro` (`frontend/src/pages/index.astro`):** мгновенная доставка статического HTML/CSS каркаса на GitHub Pages.
2. **Ступень 2 — `TypeScript` + `SceneBufferSoA` (`sceneBuffer.ts`, `universeState.ts`):** монотонные часы `0..108 с`, полином Перлина `smootherstep`, детерминированный ГПСЧ `Mulberry32 / SplitMix32` (`GOLDEN_SEED = 104729`), 24-байтный заголовок `'UNVS'`, защита `NaN/Infinity Guard` и 32-битный хеш `FNV-1a State Digest`.
3. **Ступень 3 — Симплектическая физика и синхронизация Курамото (`gravity.rs` / `wasmBridge.ts`):** схема **Velocity Verlet** (*Kick-Drift-Kick*), контроль относительного дрейфа энергии `ΔE / E₀` и параметр порядка **Курамото** $r(t) \in [0, 1]$ в Rust-крейте и детерминированном ядре TypeScript (`TS_FALLBACK`).
4. **Ступень 4 — Графовый движок `NEXUS` (`graph_logic.py` / `simulationWorker.ts`):** синтез 3 классов связей (**Класс A: остов Прима MST**, **Класс B: мосты Габриэля**, **Класс C: дендриты Мюррея**), кластеризация по треугольникам и оценка диаметра через `BFS`.
5. **Ступень 5 — Оптический конвейер `Canvas2D-HighDPI` + `WGSL` (`renderer.ts`, `pipeline.ts`, `*.wgsl`):** 5 эшелонов глубины (`Z0`–`Z4`), дизеринг `Blue-Noise 64×64`, пылевые каньоны `M31`, 7 оболочек короны `NGC 6543` и $C^1$-колокол преломления мембраны `BREACH LENS` $g(u)=(1-u^2)^2$.
6. **Ступень 6 — Нативная фабрика `Custom JSX DOM/SVG` и мобильный режим `9:16` (`Layer2..Layer5.tsx`, `universe.css`):**
   * На десктопах (`> 920px`) правая колонка «Цифрового водопада» (`LAYER_02`–`LAYER_04`) отображается вдоль правого края экрана.
   * На мобильных телефонах (`<= 920px`) технические панели по умолчанию свёрнуты, чтобы космос и финальная визитка были полностью открыты, а при нажатии на кнопки `METRICS`, `TOPOLOGY` или `TERMINAL` панели открываются по одной в режиме аккордеона без наслоений.
7. **Ступень 7 — `Web Audio API` с поддержкой iOS Safari / Android (`audioSync.ts`):** непрерывное воспроизведение `/audio/cosmic_ambient.mp3` (с отметки `2.6 с`), единый снимок спектра на кадр и поддержка `navigator.audioSession.type = 'playback'` для работы звука на iPhone даже в беззвучном режиме.

---

## 3. Локальный запуск и команды верификации (11/11 автотестов)

    git clone https://github.com/DubnovAlexey/universe.git
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