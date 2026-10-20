# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.3)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Polyglot Stack](https://img.shields.io/badge/Stack-Astro_%7C_TS_%7C_React_19_%7C_WebGPU_%7C_Rust_WASM_%7C_Python-6366f1?style=for-the-badge)](#2-architectural-rationale-why-these-technologies-and-this-exact-execution-order)
[![Deterministic Core](https://img.shields.io/badge/Engine-Fixed_Timestep_%26_State_Digest-f59e0b?style=for-the-badge)](#6-truth-policy--execution-modes)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

---

# 🇬🇧 ENGLISH DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive audiovisual installation ("From Zero to Zero", ~108-second continuous cycle) and an interactive **Runtime Polyglot** architectural presentation created by **Alexey Dubnov** and hosted directly on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) are not separate animations — they are **three optical readings of a single authoritative simulation state (`SceneBuffer`)**.

* **For Viewers, Art Directors & Technical Recruiters:** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and spatial ambient sound — captivating from the very first second.
* **For Senior Engineers, Systems Architects & CTOs:** A deeply engineered polyglot system where **Astro, TypeScript, Rust (WebAssembly), WebGPU (WGSL), Python (Pyodide / FastAPI), React 19, and Web Audio API** operate in a strictly ordered, zero-bottleneck pipeline over a shared Structure-of-Arrays (`SoA`) memory contract. Every metric in the right-hand telemetry waterfall is measured in real time and tagged with its exact computing module (`[rust/gravity.rs]`, `[rust/breach_math.rs]`, `[python/graph_logic.py]`, `[wgsl/illusion.wgsl]`, `[wgsl/breach.wgsl]`, `[ts/sceneBuffer.ts]`).

---

## 2. Architectural Rationale: Why These Technologies and This Exact Execution Order

A central goal of **UNIVERSE** is to prove that a browser-based installation can achieve native-class visual fidelity and mathematical depth at `60–144 FPS` without frame drops or garbage collection (`GC`) stalls. No single language or framework can optimally handle static delivery, deterministic N-body physics, scientific graph theory, GPU ray-deflection shaders, and accessible reactive UI simultaneously.

Therefore, the project is built as a **strictly ordered polyglot conveyor**, where each technology performs only the task for which it is mathematically and architecturally optimal:

1. **Stage 1 — `Astro` (Zero-Overhead Static Shell & Instant Boot):**
   * *Why chosen:* Traditional SPA bundlers ship megabytes of hydration JavaScript before rendering the first pixel. **Astro** compiles the outer shell to pure, zero-overhead static HTML/CSS and mounts interactive islands immediately, ensuring the installation starts on GitHub Pages in milliseconds.
2. **Stage 2 — `TypeScript` + `SceneBuffer SoA` (Deterministic Orchestration & Memory Contract):**
   * *Why chosen:* TypeScript governs the monotonic `108-second` clock, the fixed-timestep accumulator (`dt = 1/120 s`), the deterministic `SplitMix32` PRNG, and the flat binary `SceneBuffer` (`Float32Array` / `Uint16Array` over `ArrayBuffer`).
   * *Why in this order:* Placing the flat `SoA` binary buffer at the center of the TypeScript orchestrator eliminates JSON serialization and object allocations, allowing all downstream engines (`Rust`, `Python`, `WebGPU`) to read and write contiguous memory blocks directly.
3. **Stage 3 — `Rust → WebAssembly` (Symplectic N-Body Physics & Kuramoto Kernel):**
   * *Why chosen:* Continuous gravitational integration (`Velocity Verlet` *Kick-Drift-Kick*), total Hamiltonian energy drift tracking (`ΔE / E₀`), Kuramoto phase coupling across hundreds of oscillators, and 32-bit `FNV-1a` state hashing require predictable, unboxed SIMD-friendly arithmetic without JIT deoptimizations or GC pauses. Rust compiled to WebAssembly guarantees native numerical stability.
4. **Stage 4 — `Python 3` via `Pyodide / FastAPI` (Scientific Graph Topology `NEXUS`):**
   * *Why chosen:* Python is the universal language of scientific computing and network topology. In Phase 03 (`EVOLUTION`), the `graph_logic.py` engine constructs the three-tier biological connectome: **Class A Axon Trunks** (Euclidean Minimum Spanning Tree), **Class B Associative Bridges** (Gabriel Graph empty-sphere criterion), and **Class C Dendrites** (Murray's biophysical cube law $r_p^3 = \sum r_c^3$). Running this asynchronously off the main thread updates structural topology without ever blocking a single render frame.
5. **Stage 5 — `WebGPU (WGSL)` + `High-DPI Canvas 2D` (Hardware-Accelerated Optical Rendering):**
   * *Why chosen:* Volumetric 6-octave domain-warped FBM dust canyons (`M31` / `NGC 3169`), relativistic `NGC 6543` corona shells, Einstein gravitational lensing, and `C²`-continuous `BREACH LENS` refraction with Jacobian caustics demand massive per-pixel parallelism on the GPU via **WGSL shaders**, paired with an automatic **High-DPI Canvas 2D** fallback so the installation runs reliably on every device.
6. **Stage 6 — `React 19` (Throttled Living Telemetry Waterfall & Odometer Overlay):**
   * *Why chosen:* Rendering complex engineering tables and interactive DOM controls inside a raw canvas compromises accessibility and text crispness, whereas running React at `120 Hz` would bottleneck the CPU. By decoupling **React 19** via throttled state snapshots (`<= 10 Hz` data updates combined with hardware-accelerated `60–144 FPS` CSS/SVG animations), we achieve razor-sharp typography, the **Digital Waterfall & Starfall** telemetry column, and the interactive **Odometer** manifesto card with zero impact on simulation FPS.
7. **Stage 7 — `Web Audio API` + Mastered Ambient Stream (Spatial Acoustic Synchronization):**
   * *Why chosen:* Synchronizes the mastered `/audio/cosmic_ambient.mp3` soundtrack (starting immediately past its initial silent lead-in) with real-time `AnalyserNode` FFT spectral extraction (`Low / Mid / High` bands and `RMS dBFS`), feeding acoustic energy back into the visual breathing envelopes.

---

## 3. Organic Visual Language & Living Interface Architecture (v2.3)

Every visual layer, wave, background structure, and telemetry element in **UNIVERSE v2.3** behaves as a living extension of the cosmic simulation:

1. **Organically Deforming Light-Echo Rings (Act 01 — `VOID`):**
   Concentric light-echo waves inspired by the `RS Puppis` Cepheid variable star do not expand as rigid geometric circles. As each ring propagates from the center toward the edges, it breathes and deforms across all segments, interacting with surrounding energy structures — surging forward as a wave crest in high-energy zones, bending around neural hubs, or fading into deep vacuum shadow.
2. **Phase-Adaptive Field Backgrounds (Complete Elimination of Rigid Diagonal Bars):**
   Artificial straight background struts are eliminated across all phases and replaced by deep, phase-specific organic phenomena that interact with the scene:
   * **Act 01 (`VOID`):** Translucent vacuum field veils and rare, delicate quantum signals running across the field from edge to edge.
   * **Act 02 (`GENESIS`):** Multi-layered logarithmic spiral dust clouds and light-absorbing gas canyons modeled after Hubble observations of the Andromeda Galaxy (`M31`) and `NGC 3169`.
   * **Acts 03–05 (`EVOLUTION`, `COLLAPSE`, `SINGULARITY`):** Breathing cortical field gradients, curl-noise filaments, and migrating synaptic wave fronts.
3. **Deep Sub-Quantum Universe Underlay (`BREACH LENS` & `Z4` Echelon):**
   Pressing or hovering with the mouse opens the inertial `BREACH LENS` with its unstable, living circular boundary and internal coordinate grid cells. Beneath these grid cells, a deeper sub-quantum echelon (`Z4`) opens up — exposing the "reverse side of the Universe" with subtle internal neural movements, deep lattice currents, and hidden impulses. Node callouts (`ID#...`) float in space without rigid rectangular boxes.
4. **Full-Height "Digital Waterfall & Starfall" Telemetry (`Layers 2–4`):**
   * **Full Vertical Span & Enlarged Readability:** The right-side telemetry panel extends from the top to the bottom of the right viewport edge with enlarged, high-clarity typography so every numerical value and status is easily readable.
   * **Living `BREACH`-Style Contours:** All straight lines and rectangular corners are removed. The telemetry column is framed by the same unstable, organically fluctuating wave contour equation that governs the interactive `BREACH LENS` circle around the mouse cursor.
   * **Breathing Metrics & Starfall / Droplet Decay:** Numbers, signs, and telemetry rows gently breathe and flow downward in a slow **Digital Waterfall**. Periodically, individual digits at the lower boundaries detach and drift downward like falling stars in the night sky or slow droplets (`drip-by-drip` at natural, non-uniform intervals), while new real-time values immediately scroll and ignite in their original positions.
5. **Monochrome Nebula Odometer & Heartbeat Finale (`Act 05 — Layer 5`):**
   * **Locked Manifesto & Single Infinite Quantum Row:** Once the odometer reels settle, the authorship header (`DUBNOV ALEXEY // UNIVERSE — NEURO-COSMIC INSTALLATION`) and polyglot architecture lines lock cleanly in place, while only the single central quantum symbol row continues its infinite permutation.
   * **Interactive Hover Re-Spin:** Hovering the mouse cursor over any locked text row triggers a brief quantum re-spin of its characters before locking cleanly back into place.
   * **Smoky Monochrome Palette & Chaotic Breathing Speed:** Jarring multi-colored glyphs are replaced with an atmospheric gray-black-white-bluish palette with deep translucent shadows. The central row's scroll velocity fluctuates chaotically (accelerating, decelerating, and breathing), and the entire manifesto card gently pulses like a beating heart in sync with the ongoing music.

---

## 4. The 5 Phases of the 108-Second Cycle

| Phase | Timeline | Visual & Dramatic Arc (`ILLUSION` / `NEXUS`) | Mathematical Model & Compute Core (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Vacuity & Light Echo)* | `0 – 17s` | Pearl-cyan Zero Point breathing in deep obsidian vacuum (`#020308`) with organically deforming `RS Puppis` light-echo rings across depth echelons (`Z0`–`Z4`) and rare edge-to-edge quantum signals. | Binary inspiral gravitational chirp law `T_n = T_0 · (1 − n/N)^α`, angular wave perturbation `R_k(θ,t)`, instant-start audio envelope, and `BirthRecord[]` initialization with circular velocity `v_t ≈ sqrt(G·M(r)/r)`. |
| **02. GENESIS** *(N-Body Spiral Galaxy)* | `17 – 39s` | Tilted 3D spiral galaxy across the 16:9 viewport, binary barycenters connected by a tidal light bridge, volumetric `M31` / `NGC 3169` spiral dust clouds, and cold cyan rim lighting (`#7DD3FC`). | 3-Tier **Velocity Verlet** symplectic integrator in `Rust/WASM` (`gravity.rs`) tracking real energy drift `ΔE/E₀`, 6-octave domain-warped FBM, `RK2 curl-noise` streamlines, and **Kuramoto phase synchronization** `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Evolution & Neuroverse)* | `39 – 64s` | Seamless `C²`-continuous morphogenesis of spiral arms into two sculpted cortical hemispheres around a 5-ring Keplerian skeleton. Tri-layered neuron somas, branching dendrites, and synaptic pulse cascades. | Graph topology generated by `Python / Worker` (`graph_logic.py`): **Class A Axon Trunks** via Euclidean MST (`95` edges), **Class B Bridges** via Gabriel graph (`465` edges), **Class C Dendrites** via Murray's law `r_p³ = Σ r_c³` (`187` edges), and pulse routing along arc-length LUTs. |
| **04. COLLAPSE** *(Optical Rift & Deep X-RAY)* | `64 – 79s` | Gravitational anomalies deform the neural pathways. Inertial `BREACH LENS` refracts stars, spawns microcracks, and exposes the coordinate grid cells and the deep `Z4` sub-quantum neural underlay. | `C²`-continuous radial/tangential refraction field `δ(p) = (A·e_r + B·e_θ)·u·g(u)` (`breach.wgsl` / `breach_math.rs`), Jacobian caustic amplification, `Z4` Voronoi-Delaunay sub-currents, and borderless breathing callouts. |
| **05. SINGULARITY** *(Cat's Eye & Odometer)* | `79 – 108s` | Multi-shell `NGC 6543` ("Cat's Eye") corona around a relativistic Black Hole with Doppler beaming → collapse into Zero → breathing monochrome **Odometer** manifesto card (`LOGIC → ∞`). | Einstein deflection `α ≈ 4GM/(c²b)`, verified `stateDigest(ILLUSION) == stateDigest(X-RAY) == stateDigest(NEXUS)`, Ornstein-Uhlenbeck chaotic reel velocity, hover re-spin, and clean `ResourceLedger` reset. |

---

## 5. Runtime Polyglot Architecture & Memory Contract

### Data Flow Pipeline (English Diagram)

    [Stage 1: Astro Static Shell] ──> [Stage 2: TypeScript Clock (0..108s) & Fixed Timestep (dt = 1/120s)]
                                                                   │
                                                                   ▼
                                      [UniverseStore + QualityGovernor + IntegrationRegistry]
                                                                   │
                                                                   ▼
                        ┌──────────────────────────────────────────────────────────────────────┐
                        │  Authoritative SceneBufferSoA (Flat Binary 'UNVS' Memory Contract)   │
                        │  id | kind | pos(X,Y,Z) | vel(X,Y,Z) | phase | energy | edges (A/B/C)│
                        │  + Real-Time 32-bit FNV-1a State Digest (e.g., 0x18a7a6f7)           │
                        └──────────┬───────────────────────────────┬───────────────────────────┘
                                   │                               │
            ┌──────────────────────┘                               └──────────────────────┐
            ▼                                                                             ▼
    [Stage 3: Rust -> WebAssembly]                                        [Stage 4: Python 3 Graph Engine]
    physics_engine/src/{gravity,breach_math,memory}.rs                    backend/core/{graph_logic,singularity}.py
    • Symplectic Velocity Verlet (Kick-Drift-Kick)                        • Class A: Euclidean MST Axon Trunks
    • Hamiltonian Energy Drift Tracking (ΔE / E₀)                         • Class B: Gabriel Graph Synaptic Bridges
    • Kuramoto Phase Synchronization r(t) ∈ [0, 1]                        • Class C: Murray's Law Dendrites (r_p³ = Σ r_c³)
            │                                                                             │
            └──────────────────────────────────────┬──────────────────────────────────────┘
                                                   ▼
                        [Stage 5: WebGPU (WGSL Shaders) / High-DPI Canvas 2D Pipeline]
                        illusion.wgsl | truth.wgsl | breach.wgsl | renderer.ts
                        • Deformable RS Puppis Rings, M31 Spiral Dust, NGC 6543 Corona
                        • BREACH LENS Refraction & Deep Z4 Sub-Quantum Neural Underlay
                                                   │
                                                   ▼
                        [Stage 6 & 7: React 19 Living Overlays + Web Audio MP3 Sync]
                        • Layers 2–4: Full-Height Digital Waterfall & Starfall Telemetry
                        • Layer 5: Monochrome Shadow Odometer & Heartbeat Manifesto Card

### Binary Memory Contract (`SceneBufferSoA` Structure-of-Arrays)

| Byte Offset | Field Name | Data Type | Elements | Module Owner & Engineering Purpose |
| :--- | :--- | :--- | :---: | :--- |
| `0x0000` | `magic` | `Uint32` | `1` | Constant `0x53564E55` (`"UNVS"` in little-endian ASCII). |
| `0x0004` | `schemaVersion` | `Uint16` | `1` | Binary protocol schema version (`0x0203` for v2.3). |
| `0x0008` | `tickIndex` | `Uint32` | `1` | Monotonic physics tick counter (`120 Hz` fixed timestep). |
| `0x000C` | `stateDigest` | `Uint32` | `1` | `FNV-1a` 32-bit hash across quantized coordinates and velocities. |
| `0x0010` | `kuramotoR` | `Float32` | `1` | Global phase coherence order parameter `r(t) ∈ [0, 1]`. |
| `0x0014` | `energyDrift` | `Float32` | `1` | Relative Hamiltonian drift `ΔE / E₀` from `Velocity Verlet`. |
| `0x0020` | `posX, posY, depthZ` | `Float32Array` | `3 × N` | `[rust/gravity.rs]` 3D world positions across depth echelons `Z0`–`Z4`. |
| `...` | `velX, velY, velZ` | `Float32Array` | `3 × N` | `[rust/gravity.rs]` Symplectic momentum vectors. |
| `...` | `oscPhase, naturalFreq` | `Float32Array` | `2 × N` | `[rust/gravity.rs]` Kuramoto oscillator phase `θ_i(t)` and frequency `ω_i`. |
| `...` | `edgeIndices & classId` | `Uint16Array` | `3 × E` | `[python/graph_logic.py]` Class A (MST), Class B (Gabriel), Class C (Murray). |

---

## 6. Truth Policy & Execution Modes

**UNIVERSE** enforces **Zero Fake Telemetry**. Every status badge in `LAYER_02`, `LAYER_03`, and `LAYER_04` reflects actual runtime execution:

| Execution Mode | Active Compute Path | Authentic Telemetry Status Badges |
| :--- | :--- | :--- |
| **A. Live GitHub Pages Showcase (Default)** | Runs 100% autonomously in the visitor's browser without external servers: physics via `Rust/WASM` (or verified `TS_FALLBACK`), `NEXUS` graph via local worker. | `WASM_SIMD_ACTIVE` (or `TS_FALLBACK • CLIENT_ONLY`), `WebGPU` (or `Canvas2D-HighDPI`), `PLAYING_MP3` |
| **B. In-Browser Python (`Pyodide`)** | Lazy-loads the Python runtime inside a dedicated Worker after the first rendered frame to execute `graph_logic.py` directly on the client. | `PYODIDE_LOCAL` (or `FALLBACK` on memory-constrained mobile devices) |
| **C. Local Full-Stack Engineer Mode (Optional)** | Connects via binary WebSocket to a local `FastAPI` backend (`backend/main.py`) after a verified `UNVS` handshake. | `WS_CONNECTED`, `[python/graph_logic.py]`, `[rust/gravity.rs]` |

---

## 7. Experiencing the Presentation & Optional Local Reproduction

### Viewing the Live Installation (For Visitors, Recruiters & Art Directors)
The primary form of **UNIVERSE** is the live interactive web presentation hosted on **GitHub Pages**:
* **Launch URL:** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Interactive Controls:**
   * **Left Mouse Button / Touch Hold / `Space`:** Open the `BREACH LENS` at the pointer position, refract surrounding starlight along the unstable rim, open the coordinate grid cells, and reveal the deep `Z4` sub-quantum neural layer underneath.
   * **Mouse Hover on Act 05 Manifesto Rows:** Trigger a localized quantum character re-spin on the static authorship and technology lines before they settle back into place.
   * **Bottom Control Dock / Keys `1`–`5`:** Switch phases (`01.VOID` through `05.SINGULARITY`) or toggle `PAUSE`, `AUTO`, `AUDIO`, `METRICS`, `TOPOLOGY`, `TERMINAL`, and `X-RAY`.

### Optional Local Build (For Engineers Inspecting the Source Code)
If you wish to clone and inspect the polyglot architecture on your own workstation:
1. Install workspace dependencies: `git clone https://github.com/DubnovAlexey/universe.git && cd universe && npm install`
2. Run the frontend development server (`http://localhost:4321`): `npm run dev:frontend`
3. *(Optional)* Rebuild the `Rust → WebAssembly` physics crate: `npm run build:wasm`
4. *(Optional)* Start the `Python FastAPI` WebSocket backend: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`

---
---

# 🇷🇺 РУССКАЯ ДОКУМЕНТАЦИЯ

## 1. О проекте и философской концепции

**UNIVERSE (Нейроверс)** — полноэкранная интерактивная кинематографическая аудиовизуальная инсталляция («Из Нуля в Ноль», непрерывный цикл ≈ 108 секунд) и живая архитектурная презентация **Runtime Polyglot**, созданная **Алексеем Дубновым (Alexey Dubnov)** и развёрнутая на GitHub Pages.

**Философская ось проекта:** Космическая красота (`ILLUSION`), возникающая нейронная сеть мозга (`NEXUS`) и вычислительная логика (`X-RAY / TRUTH`) — это не три разные анимации, а **три оптических прочтения одного и того же буфера состояния симуляции (`SceneBuffer`)**.

* **Для зрителя, арт-директора и HR:** самодостаточный генеративный научно-фантастический фильм, который запускается автоматически с первой секунды (с мгновенным стартом космической музыкальной темы без провалов в тишину) и удерживает внимание драматургией света, глубокими бархатными тенями, 5 планами параллакса (`Z0`–`Z4`), отсутствием чужеродных прямых линий и живым дыханием каждого элемента.
* **Для Senior-разработчика, системного архитектора и CTO:** прозрачная многоязыковая система, в которой **Astro, TypeScript, Rust (WebAssembly), WebGPU (WGSL), Python (Pyodide / FastAPI), React 19 и Web Audio API** выстроены в строго упорядоченный конвейер вокруг единого бинарного контракта памяти (`Structure of Arrays`). Каждое число в режиме рентгена (`X-RAY`) и в правом цифровом водопаде измеряется в реальном времени и имеет точную подпись вычислившего его модуля (`[rust/gravity.rs]`, `[rust/breach_math.rs]`, `[python/graph_logic.py]`, `[wgsl/illusion.wgsl]`, `[wgsl/breach.wgsl]`, `[ts/sceneBuffer.ts]`).

---

## 2. Обоснование полиглот-архитектуры: почему выбраны именно эти технологии и порядок их взаимодействия

Главная инженерная задача **UNIVERSE** — добиться того, чтобы сложная физическая и астрофизическая симуляция работала прямо в браузере на частоте `60–144 FPS` с максимальной визуальной глубиной, без микрофризов и без пауз сборщика мусора (`Garbage Collector`). Ни один отдельно взятый язык не способен одинаково эффективно решать задачи мгновенной доставки статики, симплектической гравитации N-тел, научной теории графов, пиксельных шейдеров преломления света и реактивного интерфейса.

Поэтому в проекте применена **строго выверенная последовательность взаимодействия технологий**, где каждый инструмент отвечает ровно за ту область, в которой он даёт максимальную производительность:

1. **Ступень 1 — `Astro` (Мгновенная доставка и нулевой оверхед оболочки):**
   * *Почему выбран:* Классические SPA-фреймворки заставляют браузер загружать и парсить тяжёлые бандлы до появления первого кадра. **Astro** формирует сверхлёгкий статический каркас и мгновенно инициализирует холст симуляции, обеспечивая моментальный старт презентации на GitHub Pages.
2. **Ступень 2 — `TypeScript` + `SceneBufferSoA` (Детерминированный оркестратор и контракт памяти):**
   * *Почему выбран:* TypeScript управляет монотонными часами цикла (`0..108 с`), аккумулятором фиксированного шага физики (`dt = 1/120 с`), детерминированным генератором `SplitMix32`, регулятором качества `QualityGovernor` и плоским бинарным буфером `SceneBufferSoA` (`Float32Array` / `Uint16Array` поверх единого `ArrayBuffer`).
   * *Почему стоит на этом месте:* Размещение плоского бинарного буфера `SoA` в центре оркестратора полностью исключает затраты на `JSON.stringify/parse` и создание временных объектов в памяти — все вычислительные ядра работают с непрерывными массивами чисел.
3. **Ступень 3 — `Rust → WebAssembly` (Симплектическое ядро физики и синхронизации Курамото):**
   * *Почему выбран:* Расчёт гравитации N-тел методом `Velocity Verlet` (*Kick-Drift-Kick*), контроль относительного дрейфа полной энергии гамильтониана (`ΔE / E₀`), фазовая синхронизация осцилляторов Курамото и расчёт 32-битного хеша состояния `FNV-1a` требуют предсказуемой векторной (`SIMD`) арифметики без деоптимизаций JIT-компилятора. Rust в связке с WASM обеспечивает нативную скорость и строгую детерминированность.
4. **Ступень 4 — `Python 3` через `Pyodide / FastAPI` (Научная топология когнитивного графа `NEXUS`):**
   * *Почему выбран:* Python — эталонный язык научных расчётов и теории графов. В фазе `03. EVOLUTION` модуль `graph_logic.py` строит трёхуровневую биологически достоверную сеть мозга: **Класс A (Магистральные аксоны)** через евклидово минимальное остовное дерево (`MST`), **Класс B (Синаптические мосты)** по критерию пустой сферы графа Габриэля и **Класс C (Дендриты)** по биофизическому закону Мюррея ($r_p^3 = \sum r_c^3$). Выполнение этого расчёта асинхронно не блокирует основной поток рендеринга ни на одну миллисекунду.
5. **Ступень 5 — `WebGPU (WGSL)` + `High-DPI Canvas 2D` (Аппаратный оптический конвейер):**
   * *Почему выбран:* Многооктавный `Domain-Warped FBM` шум пылевых рукавов галактик (`M31` / `NGC 3169`), многослойная корона «Кошачьего глаза» (`NGC 6543`), релятивистское гравитационное линзирование и гладкое преломление мембраны `BREACH LENS` с каустикой якобиана требуют массового параллелизма видеокарты на языке шейдеров **WGSL**, а бесшовный резервный контур на **High-DPI Canvas 2D** гарантирует работу инсталляции на любом устройстве.
6. **Ступень 6 — `React 19` (Живые оверлеи телеметрии и квантовый одометр без нагрузки на FPS):**
   * *Почему выбран:* Отрисовка сложных таблиц и интерактивных кнопок внутри Canvas ухудшает чёткость шрифтов, но обновление DOM на частоте `120 Гц` перегрузило бы процессор. В нашей архитектуре **React 19** получает срезы телеметрии с контролируемой частотой (`<= 10 Гц`), а плавное движение **Цифрового водопада**, **Звездопада цифр** и барабанов **Одометра** выполняется аппаратно-ускоренными трансформациями. Это даёт идеальную резкость текста при сохранении максимального FPS сцены.
7. **Ступень 7 — `Web Audio API` + Мастеринговый аудиопоток (Акустическая синхронизация):**
   * *Почему выбран:* Обеспечивает мгновенный запуск музыкальной темы `/audio/cosmic_ambient.mp3` (с автоматическим пропуском начальной тихой паузы) и в реальном времени извлекает через `AnalyserNode` амплитудно-частотные огибающие (`Low / Mid / High` и `RMS dBFS`), которые управляют тонким «дыханием» космоса и финальной визитки.

---

## 3. Органическая визуальная среда и живой интерфейс (Архитектура v2.3)

В версии **v2.3** полностью исключена механистическая чужеродность интерфейса: в проекте нет мёртвых геометрических рамок, случайных прямых палок на фоне или статичных таблиц — каждый элемент вписан в единую живую среду:

1. **Живые деформирующиеся кольца светового эха (Акт 01 — `VOID`):**
   Концентрические волны вокруг центральной точки (прообраз — световое эхо переменной звезды-цефеиды `RS Кормы / RS Puppis`) не расходятся стерильно-правильными «кругами по воде». Каждое кольцо дышит и нестабильно изменяется во всех своих частях, взаимодействуя с окружающими энергетическими структурами: где-то фронт волны вырывается вперёд, где-то изгибается волной или уходит в глубокое пропадание.
2. **Полный отказ от прямых фоновых «палок» в пользу полевых и спиральных структур:**
   Прямолинейные диагональные полосы на фоне полностью заменены на глубокие фазозависимые явления, взаимодействующие с остальными частями инсталляции:
   * **в фазе `01. VOID`** — полупрозрачные полевые структуры и редкие пробегающие от края до края тонкие квантовые сигналы;
   * **в фазе `02. GENESIS`** — многослойные спиралевидные рукава межзвёздной пыли и газовые завихрения по прообразу галактик `Андромеда (M31)` и `NGC 3169`;
   * **в фазах `03. EVOLUTION` — `05. SINGULARITY`** — дышащие полевые градиенты, вихревые волокна и мигрирующие нейронные импульсы.
3. **«Обратная сторона Вселенной» под клеточками линзы `BREACH LENS` (Эшелон `Z4`):**
   При наведении и нажатии кнопки мыши раскрывается круглая оптическая мембрана с нестабильным живым контуром и координатными клеточками. В эти моменты под клеточками открывается более глубокая структура (`Z4`) — «изнанка Вселенной» с внутренними нейросетевыми передвижениями, суб-квантовыми импульсами и глубинными токами. Выноски узлов (`ID#...`) парят в пространстве без прямоугольных рамок.
4. **Правая панель телеметрии: во всю высоту, контур линзы, «Водопад» и «Звездопад» (`Layers 2–4`):**
   * **Во всю правую сторону и крупнее:** Панель с данными растянута сверху донизу вдоль правой границы экрана, а шрифт цифр и показателей укрупнён для отличной читаемости.
   * **Живой контур как у мышки при нажатии:** Все прямые линии и прямоугольные углы таблиц убраны. Границы правой панели оформлены такими же нестабильными, плавно двигающимися и дышащими волновыми линиями, как окружность `BREACH LENS` вокруг курсора мыши при нажатии.
   * **Эффект «Водопада» и «Звездопада / Капель»:** Все знаки, цифры и значения внутри правой панели дышат в едином стиле с композицией, медленно стекая сверху вниз и постоянно обновляясь. Время от времени отдельные нижние цифры плавно отделяются и падают вниз — как падающие звёзды на небе или капли (`кап-кап` с разной естественной частотой), — а на их месте тут же прокручиваются и зажигаются новые значения, сохраняя полную читаемость всех данных.
5. **Монохромная бегущая строка с тенями и «биение сердца» финальной визитки (`Акт 05 — Layer 5`):**
   * **Статика основных строк и одна бегущая строка:** В финале строки с авторством (`DUBNOV ALEXEY`) и архитектурным стеком после остановки перебора стоят ровно и чётко (сохраняя эффект повторной короткой прокрутки при наведении мыши), а бесконечно вращается только одна центральная строка квантовых символов.
   * **Серо-чёрно-бело-голубоватая гамма и хаотичное дыхание:** Пестрые яркие цвета заменены на благородную серо-чёрно-белую и голубоватую палитру с полутонами и мягкими тенями. Скорость прокрутки центральной строки меняется хаотично (то быстрее, то медленнее), каждый знак внутри неё дышит, а сама финальная визитка после остановки перебора продолжает плавно пульсировать в такт музыке, как бьющееся сердце или спокойное дыхание.

---

## 4. Пять фаз единого 108-секундного цикла

| Фаза цикла | Тайминг | Визуальная драматургия (`ILLUSION` / `NEXUS`) | Математическая модель и вычислительное ядро (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Пустота и световое эхо)* | `0 – 17 с` | Жемчужно-голубое ядро дышит в обсидиановом вакууме (`#020308`), распуская нестабильные, живо дышащие кольца светового эха `RS Кормы` и редкие квантовые сигналы от края до края. | Закон гравитационного чирпа `T_n = T_0 · (1 − n/N)^α`, угловая деформация колец `R_k(θ,t)`, мгновенный старт аудиопотока и генерация `BirthRecord[]` с круговой скоростью `v_t ≈ sqrt(G·M(r)/r)`. |
| **02. GENESIS** *(Галактика N-тел)* | `17 – 39 с` | Наклонный 3D-диск спиральной галактики во весь экран 16:9, спиралевидные пылевые облака `M31` / `NGC 3169`, два центра масс со световым мостом и холодный контровой свет `rim light` (`#7DD3FC`). | Трёхъярусный симплектический интегратор **Velocity Verlet** в `Rust/WASM` (`gravity.rs`) с контролем дрейфа энергии `ΔE/E₀`, 6 октав FBM с `domain warping`, волокна `RK2 curl-noise` и синхронизация **Курамото** `r(t) ∈ [0,1]`. |
| **03. EVOLUTION** *(Эволюция и Нейроверс)* | `39 – 64 с` | Бесшовная `C²`-деформация рукавов галактики в два когнитивных полушария Головного Мозга вокруг каркаса из 5 кеплеровских колец. Сомы нейронов, дендриты и каскады синаптических импульсов. | Построение графа в `Python / Worker` (`graph_logic.py`): **Класс A (Магистрали)** по остову MST (`95`), **Класс B (Мосты)** по графу Габриэля (`465`), **Класс C (Дендриты)** по закону Мюррея `r_p³ = Σ r_c³` (`187`), движение по `lengthLUT`. |
| **04. COLLAPSE** *(Преломление и Шторм)* | `64 – 79 с` | Гравитационные аномалии упруго изгибают нейронные тракты. Инерционная линза `BREACH LENS` преломляет звёзды, открывает клеточки рентгена и глубинный суб-квантовый слой `Z4` («обратную сторону Вселенной»). | `C²`-непрерывное поле преломления `δ(p) = (A·e_r + B·e_θ)·u·g(u)` (`breach.wgsl` / `breach_math.rs`), каустика якобиана, суб-нейронные токи `Z4` и воздушные выноски узлов без прямоугольных рамок. |
| **05. SINGULARITY** *(Сингулярность и Одометр)* | `79 – 108 с` | Многослойная корона «Кошачьего глаза» (`NGC 6543`) вокруг Чёрной дыры → схлопывание в Ноль → дышащая визитка с монохромно-теневой строкой одометра (`LOGIC → ∞`). | Отклонение лучей Эйнштейна `α ≈ 4GM/(c²b)`, сверка `stateDigest`, стохастический процесс Орнштейна — Уленбека для скорости одометра, ре-спин по наведению мыши и чистый сброс `ResourceLedger`. |

---

## 5. Архитектурная схема конвейера и бинарный контракт памяти

### Схема потоков данных (Русская версия)

    [Ступень 1: Статический каркас Astro] ──> [Ступень 2: Часы TypeScript (0..108 с) и шаг физики (dt = 1/120 с)]
                                                                        │
                                                                        ▼
                                         [UniverseStore + QualityGovernor + Реестр интеграции]
                                                                        │
                                                                        ▼
                        ┌───────────────────────────────────────────────────────────────────────────┐
                        │  Единый буфер состояния SceneBufferSoA (Бинарный контракт памяти 'UNVS')  │
                        │  id | kind | pos(X,Y,Z) | vel(X,Y,Z) | phase | energy | рёбра графа A/B/C │
                        │  + 32-битный хеш целостности FNV-1a State Digest (напр., 0x18a7a6f7)      │
                        └──────────┬────────────────────────────────────┬───────────────────────────┘
                                   │                                    │
            ┌──────────────────────┘                                    └──────────────────────┐
            ▼                                                                                  ▼
    [Ступень 3: Rust -> WebAssembly]                                    [Ступень 4: Графовое ядро Python 3]
    physics_engine/src/{gravity,breach_math,memory}.rs                  backend/core/{graph_logic,singularity}.py
    • Симплектический интегратор Velocity Verlet                        • Класс A: Магистрали (Евклидов остов MST)
    • Контроль дрейфа энергии гамильтониана (ΔE / E₀)                   • Класс B: Мосты (Критерий графа Габриэля)
    • Фазовая синхронизация Курамото r(t) ∈ [0, 1]                      • Класс C: Дендриты (Закон Мюррея r_p³ = Σ r_c³)
            │                                                                                  │
            └─────────────────────────────────────────┬────────────────────────────────────────┘
                                                      ▼
                        [Ступень 5: Оптический конвейер WebGPU (WGSL) / High-DPI Canvas 2D]
                        illusion.wgsl | truth.wgsl | breach.wgsl | renderer.ts
                        • Живые кольца RS Puppis, пылевые рукава M31, корона NGC 6543
                        • Преломление линзы BREACH LENS и глубинная изнанка Вселенной (слой Z4)
                                                      │
                                                      ▼
                        [Ступени 6 и 7: Живые оверлеи React 19 + Синхронизация звука Web Audio]
                        • Слои 2–4: Правый «Цифровой водопад» во всю высоту и «Звездопад» цифр
                        • Слой 5: Монохромный одометр с тенями и дышащая финальная карточка

### Бинарный контракт памяти (`SceneBufferSoA` — Structure of Arrays)

| Смещение | Поле буфера | Тип данных | Размерность | Модуль-владелец и инженерное назначение |
| :--- | :--- | :--- | :---: | :--- |
| `0x0000` | `magic` | `Uint32` | `1` | Константа `0x53564E55` (сигнатура `"UNVS"` в формате little-endian). |
| `0x0004` | `schemaVersion` | `Uint16` | `1` | Версия бинарного протокола памяти (`0x0203` для v2.3). |
| `0x0008` | `tickIndex` | `Uint32` | `1` | Монотонный счётчик физического шага (`120 Гц`). |
| `0x000C` | `stateDigest` | `Uint32` | `1` | 32-битный хеш `FNV-1a` по квантованным координатам и скоростям. |
| `0x0010` | `kuramotoR` | `Float32` | `1` | Глобальный параметр порядка фазовой когерентности Курамото `r(t) ∈ [0, 1]`. |
| `0x0014` | `energyDrift` | `Float32` | `1` | Относительный дрейф энергии гамильтониана `ΔE / E₀` в `Velocity Verlet`. |
| `0x0020` | `posX, posY, depthZ` | `Float32Array` | `3 × N` | `[rust/gravity.rs]` Пространственные координаты узлов на эшелонах `Z0`–`Z4`. |
| `...` | `velX, velY, velZ` | `Float32Array` | `3 × N` | `[rust/gravity.rs]` Симплектические векторы импульса и скорости. |
| `...` | `oscPhase, naturalFreq` | `Float32Array` | `2 × N` | `[rust/gravity.rs]` Фаза осциллятора `θ_i(t)` и собственная частота `ω_i`. |
| `...` | `edgeIndices & classId` | `Uint16Array` | `3 × E` | `[python/graph_logic.py]` Рёбра Класса A (MST), Класса B (Габриэль), Класса C (Мюррей). |

---

## 6. Честная матрица режимов исполнения (Truth Policy)

Интерфейс никогда не имитирует поддельные метрики. Все статусы в правой панели (`LAYER_02` — `LAYER_04`) отражают реальное состояние среды исполнения:

| Режим работы | Активный вычислительный контур | Подлинные статусы в правой панели телеметрии |
| :--- | :--- | :--- |
| **A. Онлайн-презентация GitHub Pages (Основной)** | Полностью автономная работа в браузере посетителя без внешних серверов: физика в `Rust/WASM` (или эталонном `TS_FALLBACK`), граф `NEXUS` — в локальном потоке. | `WASM_SIMD_ACTIVE` (или `TS_FALLBACK • CLIENT_ONLY`), `WebGPU` (или `Canvas2D-HighDPI`), `PLAYING_MP3` |
| **B. Python в браузере (`Pyodide`)** | Фоновая инициализация интерпретатора Python в Web Worker после первого кадра для выполнения `graph_logic.py` непосредственно на клиенте. | `PYODIDE_LOCAL` (или `FALLBACK` на устройствах с ограниченной памятью) |
| **C. Локальный серверный режим (`FastAPI`)** | Подключение по бинарному WebSocket к локальному серверу `FastAPI` (`backend/main.py`) после подтверждённого рукопожатия `UNVS`. | `WS_CONNECTED`, `[python/graph_logic.py]`, `[rust/gravity.rs]` |

---

## 7. Просмотр онлайн-презентации и опциональный локальный запуск

### Просмотр живой инсталляции (для зрителей, рекрутеров и арт-директоров)
Основной формат проекта **UNIVERSE** — интерактивная веб-экспозиция, работающая прямо в браузере на **GitHub Pages** без установки дополнительного ПО:
* **Прямая ссылка на инсталляцию:** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Интерактивное взаимодействие:**
   * **Зажатие левой кнопки мыши / касание экрана / клавиша `Space`:** раскрывает оптическую линзу `BREACH LENS`, преломляет свет звёзд на нестабильной кромке, открывает координатные клеточки рентгена и глубинный суб-квантовый слой `Z4` («изнанку Вселенной»).
   * **Наведение курсора на строки финальной визитки (Акт 05):** запускает короткую квантовую прокрутку символов в строке с последующим точным возвратом на место.
   * **Нижняя панель управления / клавиши `1`–`5`:** прямое переключение между 5 фазами (`01.VOID` — `05.SINGULARITY`) и управление режимами `PAUSE`, `AUTO`, `AUDIO`, `METRICS`, `TOPOLOGY`, `TERMINAL`, `X-RAY`.

### Опциональное развёртывание исходного кода (для разработчиков и инженеров)
Если вы знакомитесь с репозиторием как инженер и хотите запустить сборку локально на своей рабочей станции:
1. Клонировать репозиторий и установить зависимости: `git clone https://github.com/DubnovAlexey/universe.git && cd universe && npm install`
2. Запустить локальный сервер разработки (`http://localhost:4321`): `npm run dev:frontend`
3. *(Опционально)* Пересобрать модуль `Rust → WebAssembly`: `npm run build:wasm`
4. *(Опционально)* Запустить локальный сервер `Python FastAPI` на порту `8000`: `cd backend && pip install -r requirements.txt && uvicorn main:app --reload --port 8000`

---

## License

MIT License — Copyright (c) Dubnov Alexey.