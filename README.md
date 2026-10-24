# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.5)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Author Profile](https://img.shields.io/badge/GitHub-Alexey_Dubnov-6366f1?style=for-the-badge&logo=github)](https://github.com/DubnovAlexey)
[![Deterministic Core](https://img.shields.io/badge/Verification-16_TS_%7C_6_Python_%7C_13_Rust_%7C_5_WASM-f59e0b?style=for-the-badge)](#5-truth-policy--runtime-module-statuses)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

* **Live Interactive Presentation (GitHub Pages):** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Author's GitHub Profile:** [https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)
* **Source Code Repository:** [https://github.com/DubnovAlexey/universe](https://github.com/DubnovAlexey/universe)

---

# 🇬🇧 DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive science-inspired audiovisual installation ("From Zero to Zero", 108-second continuous cycle) and a polyglot architecture showcase created by **Alexey Dubnov (`DubnovAlexey`)** and hosted on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) share the final scene coordinates. The physics provider advances before artistic targets; those targets produce the particle geometry consumed by Canvas, graph quantization and the `SceneBufferSoA` publication. A sampled state digest is diagnostic rather than proof of complete optical equivalence.

- **For Viewers:** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and spatial ambient sound. In the finale (`05. SINGULARITY`), the "Cat's Eye" nebula corona and Black Hole collapse into a single point of light and seamlessly unfold into an interactive holographic developer manifesto card (`DUBNOV ALEXEY`) with direct links to the author's main GitHub profile and project repository. Across subsequent cycles, the manifesto card remains softly suspended in a translucent `.ambient-loop` state, illuminating on mouse hover at any moment.
- **For Professors & CTOs:** A transparent architecture combining **Astro, TypeScript, a custom zero-dependency JSX DOM/SVG factory, High-DPI Canvas 2D, Rust and Python reference/verification modules, WGSL shader specifications, and Web Audio API** around a shared Structure-of-Arrays (`SoA`) contract.

**Runtime in the current static build:** The visual cycle starts on page load. Audio playback is attempted immediately and continues after the browser allows it; autoplay policies may require the visitor's first gesture. Rust/WASM loads asynchronously by default through raw C ABI v1; `?wasm=0` forces TypeScript. Both providers advance the same Kuramoto phases, which affect particle breathing and the late-GENESIS triad, plus a separate conservative ensemble of 64 reference orbits used for energy telemetry. The artistic scene remains choreographed and is not a full N-body simulation. Python stays an offline/CI reference. WebGPU is capability-probed only; Canvas 2D remains the active renderer and NEXUS runs synchronously in TypeScript. The WASM artifact and its integration checks are verified locally; a complete browser presentation check remains open. Actual frame rate depends on the device and browser; `60–144 FPS` is a design target.

---

## 2. Architectural Rationale: Why These Technologies and This Execution Order

The architecture targets smooth desktop rendering and responsive mobile playback through `QualityGovernor` adaptive scaling; actual performance depends on the device and browser. Responsibilities are organized into a **7-stage pipeline**:

1. **Stage 1 — `Astro` (Zero-Overhead Static Shell & Instant Boot):**
   Compiles `frontend/src/pages/index.astro` to pure static HTML/CSS so the installation mounts on GitHub Pages in milliseconds without SPA hydration overhead.
2. **Stage 2 — `TypeScript` + `SceneBufferSoA` (Deterministic Orchestration & Binary Memory Contract):**
   Governs the monotonic `108-second` clock, `C²`-continuous Perlin `smootherstep` envelopes, the deterministic 32-bit `Mulberry32 / SplitMix32` PRNG (`GOLDEN_SEED = 104729`), `QualityGovernor`, and the `SceneBufferSoA` publication (a `24-byte` `'UNVS'` little-endian header and separate typed arrays) with 8-field `NaN/Infinity` sanitization and diagnostic `FNV-1a` hashing.
3. **Stage 3 — Rust/WASM Physics Provider + TypeScript Fallback (`gravity.rs` / `wasmBridge.ts`):**
   Both providers advance active-particle **Kuramoto** phases and a separate 64-orbit **Velocity Verlet** ensemble in a static Plummer potential (`GM = 4900`, `ε² = 64`). The energy ratio `ΔE / E₀ = |E(t) - E₀| / |E₀|` describes those reference orbits. Raw ABI v1 uses `f64` step/time/metrics and `f32` arrays; positive steps are capped at `50 ms` and partitioned into substeps of at most `4 ms`. Late WASM attachment uploads the latest TS state, baseline and accumulated time; successful native steps refresh TS mirrors for continuous fallback after a trap. CI builds and checks the WASM module before Astro.
4. **Stage 4 — `Python 3` & `NEXUS` Graph Topology Engine (`graph_logic.py` / `simulationWorker.ts`):**
   Synthesizes the three-tier connectome: **Class A Axon Trunks** (Prim's Euclidean Minimum Spanning Tree across cluster hubs), **Class B Associative Bridges** (windowed Gabriel Graph empty-sphere criterion), and **Class C Dendrites** (Murray's branching law $r \propto k^{-1/3}$), alongside triangle clustering and sampled BFS hop metrics (`BFS-28`).
5. **Stage 5 — Active `High-DPI Canvas 2D` Renderer + `WGSL` Specifications (`renderer.ts` / `pipeline.ts` / `*.wgsl`):**
   Executes all 5 phases, `64×64 Blue-Noise` dithering, `C¹`-continuous `BREACH LENS` boundary refraction, and the deep `Z4` sub-quantum underlay through Canvas 2D. WebGPU support is probed; **WGSL** files (`illusion.wgsl`, `truth.wgsl`, `breach.wgsl`) are reference specifications, not active render pipelines.
6. **Stage 6 — `Custom Zero-Dependency JSX DOM/SVG Engine` (`Layer2_Metrics.tsx` – `Layer5_CipherFinale.tsx`):**
   Uses a custom lightweight `React.createElement` DOM/SVG factory with mount-once `data-bind` node references (`<= 10 Hz` text updates + `60 FPS` living SVG wave contours, **Starfall** droplets, and the frameless **Odometer** manifesto card). On mobile screens (`<= 920px`), telemetry panels default to a collapsed state and operate in single-panel accordion mode so the cosmos remains unobstructed.
7. **Stage 7 — `Web Audio API` + Continuous Mastered Stream (`audioSync.ts`):**
   Attempts to start `/audio/cosmic_ambient.mp3` immediately (skipping the initial `2.6s` silent lead-in); if autoplay is blocked, the existing first-gesture control unlocks playback. Desktop spectral analysis uses time-based attack/release envelopes. Mobile playback uses HTML audio, while `audioSession.type = 'playback'` support is best-effort and browser-dependent.

---

## 3. The 5 Phases of the 108-Second Cycle

| Phase | Timeline | Visual & Dramatic Arc (`ILLUSION` / `NEXUS`) | Mathematical Model & Compute Core (`TRUTH / X-RAY`) |
| :--- | :---: | :--- | :--- |
| **01. VOID** *(Vacuity & Light Echo)* | `0 – 17s` | Pearl-cyan Zero Point breathing in deep obsidian vacuum (`#020308`) with 7 organically deforming light-echo rings inspired by Cepheid `RS Puppis` and curved `RK2 Curl-Noise` field signals. | Gravitational chirp law, angular FBM wave perturbation, `SceneBufferSoA` initialization, and circular velocity anticipation. |
| **02. GENESIS** *(Spiral Galaxy)* | `17 – 39s` | Tilted 3D 4-arm spiral galaxy, binary barycenters connected by a tidal light bridge, and 48 volumetric `M31` / `NGC 3169` spiral dust clouds with cyan rim light (`#7DD3FC`). | Provider **Kuramoto** phases affect breathing and the late-GENESIS triad; **Velocity Verlet** energy telemetry belongs to the separate 64-orbit reference ensemble. |
| **03. EVOLUTION** *(Evolution & Neuroverse)* | `39 – 64s` | Seamless `C²`-continuous morphogenesis of spiral arms into two sculpted cortical hemispheres around a 5-ring Keplerian skeleton. Neuron somas, dendrites, and synaptic pulse comets. | `NEXUS` graph topology: **Class A** Prim's MST trunks, **Class B** Gabriel bridges, **Class C** Murray dendrites, and 5-point Bezier `lengthLUT` routing. |
| **04. COLLAPSE** *(Optical Rift & Deep X-RAY)* | `64 – 79s` | Three gravitational anomalies deform neural pathways. Inertial `BREACH LENS` refracts stars, spawns microcracks, and exposes coordinate grid cells and the deep `Z4` sub-quantum layer. | `C¹`-continuous radial/tangential refraction bell `g(u) = (1 − u²)²` (`u < 1`), `Z4` sub-currents, and borderless floating node callouts. |
| **05. SINGULARITY** *(Cat's Eye & Finale Card)* | `79 – 108s` | **Act A (`79–87.5s`):** 7-shell `NGC 6543`-inspired corona & Black Hole $\rightarrow$ **Act B (`87.5–92.6s`):** spiral collapse into Zero Point $\rightarrow$ **Act C (`92.6–93.05s`):** `0.45s` Zero-Point flash $\rightarrow$ **Act D (`93.05–108s`):** **`DUBNOV ALEXEY`** manifesto card & frameless quantum odometer. | Analytical gravitational deflection `α ≈ 2·R_s/b`, complete convergence to Zero (`logicConvergence -> 0`), bounded `dt`-accumulated reel phase (`18–26 Hz`), and persistent `.ambient-loop` across restarts. |

---

## 4. Runtime Polyglot Architecture & Memory Contract

    [Stage 1: Astro Static Shell (index.astro)]
           │
           ▼
    [Stage 2: TypeScript Master Clock (0..108s) & UniverseStore]
           ├──► C² Perlin smootherstep Camera & Phase Envelopes
           ├──► QualityGovernor (EMA Frame Time + 3.5s Hysteresis)
           └──► Final Scene Publication (24-byte 'UNVS' Little-Endian Header + Separate Typed Arrays)
                      │  id | kind | pos(X,Y,Z) | prevPos | vel(X,Y,Z) | depthZ | energy | flags
                      │  + Real-Time 32-bit FNV-1a State Digest (e.g., 0x6AB09A72)
                      ├──────────────────────────────────────────────┐
                      ▼                                              ▼
    [Stage 3: Symplectic Physics & Kuramoto]        [Stage 4: NEXUS Cognitive Graph Engine]
    • Rust Crate (physics_engine/src/*.rs)          • TS Engine (simulationWorker.ts)
    • Deterministic TS Kernel (wasmBridge.ts)       • Python Reference (backend/core/graph_logic.py)
    • Velocity Verlet (REF64 Drift ΔE/E₀)           • Class A (Prim MST), Class B (Gabriel), Class C (Murray)
    • Kuramoto Coherence Order Parameter r(t)       • Triangle Clustering C & Sampled BFS-28 Diameter D
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
    • Layers 2–4: Living BREACH SVG Contours, All 8 Registry Modules & Starfall Droplets
    • Layer 5: Frameless Quantum Stream (18–26 Hz) & Persistent Translucent Finale Card

---

## 5. Truth Policy & Runtime Module Statuses

Every status badge in `LAYER_02`, `LAYER_03`, and `LAYER_04` initializes with `0 ms` and reflects actual execution:

| Module ID | Language / Layer | Default GitHub Pages Status | Actual Role in v2.5 |
| :--- | :--- | :---: | :--- |
| **`ts-core`** | `TypeScript` | `READY` (`ACTIVE`) | Master 108s timeline, `SceneBufferSoA`, `FNV-1a` digest, symplectic physics & `smootherstep` morphing. |
| **`canvas2d-render`** | `Canvas2D` | `READY` (`ACTIVE`) | Primary High-DPI optical renderer for all 5 phases, `Blue-Noise` dithering, `BREACH LENS`, and `Z4`. |
| **`web-audio`** | `WebAudio` | `READY` / `FALLBACK` (`ACTIVE`) | Streams `cosmic_ambient.mp3` after user gesture with single-pass spectral analysis and LFO fallback. |
| **`wasm-physics`** | `Rust/WASM` | `LOADING` → `READY` / `FALLBACK` | Asynchronous raw ABI v1 provider; a successful native step reports `WASM_ACTIVE`. Shared Kuramoto phases affect visible targets; REF64 orbits supply energy telemetry. `?wasm=0`, load/ABI failure or a trap selects the continuous TS fallback. No SIMD claim is made. |
| **`worker-physics`** | `TypeScript` | `FALLBACK` | Executes deterministic `NEXUS` graph synthesis (`MST + Gabriel + Murray`) synchronously in TS. |
| **`webgpu-render`** | `WGSL/WebGPU` | `FALLBACK` / `UNSUPPORTED` (`PROBE`) | Probes `navigator.gpu.requestAdapter()` only; Canvas 2D renders the scene and WGSL files are reference specifications. |
| **`pyodide-graph`** | `Python` | `FALLBACK` (`OFFLINE REF`) | Reference Python `NEXUS` topology engine (`backend/core/graph_logic.py`) verified in CI; it is not loaded into the static page. |
| **`server-ws`** | `Python` | `INACTIVE` (`OFFLINE TOOL`) | Local Python HTTP/Binary server (`backend/main.py`), CLI verifier (`--verify`), and prepared `PythonSocketClient` binary protocol validator. |

---

## 6. Quick Start & Automated Verification Commands (35 Unit Checks + 5 WASM Integration Checks)

    git clone https://github.com/DubnovAlexey/universe.git
    cd universe
    npm ci
    npm run build:wasm
    npm run dev
    python -B -m backend.main --verify
    python -B -m unittest discover -v
    cd physics_engine && cargo test && cd ..
    npm run typecheck
    npm test
    npm run verify:wasm
    npm run build
    npm run verify:pages-artifact

`npm run build:wasm` requires Rust with the `wasm32-unknown-unknown` target. `npm run verify:all` runs Python verification/tests, native Rust tests, TypeScript typecheck/tests, WASM build/integration checks and the static build/artifact checks. The five WASM checks cover 600 mixed steps against TS, memory growth/count, seed/reset and late adoption, trap/ABI/pointer fallback, and native-phase influence on visible coordinates and their graph/SoA publication. Browser review remains a separate check.

The complete verification command passed. Production smoke confirmed default native mode, the finale and persistent card on entering the second cycle, forced TS fallback, and a `507×684` native viewport with visible controls; no warnings/errors were recorded in those runs. Full device/audio/Safari coverage and a repeatable performance baseline remain open.

---
---

# 🇷🇺 ДОКУМЕНТАЦИЯ

## 1. О проекте и философской концепции

**UNIVERSE (Нейроверс)** — полноэкранная интерактивная научно-художественная аудиовизуальная инсталляция (непрерывный цикл 108 секунд) и демонстрация полиглотной архитектуры, созданная **Алексеем Дубновым (`DubnovAlexey`)** и развёрнутая на **GitHub Pages**.

**Философская ось проекта:** Космическая красота (`ILLUSION`), возникающая нейронная сеть мозга (`NEXUS`) и вычислительная логика (`X-RAY / TRUTH`) используют общие итоговые координаты сцены. Физический provider выполняется до расчёта художественных целей; итоговая геометрия частиц поступает в Canvas, квантование графа и публикацию `SceneBufferSoA`. Выборочный дайджест служит диагностикой и не доказывает полного тождества оптик.

- **Для зрителя:** визуальный цикл запускается при открытии страницы (на компьютере и телефоне); музыка запускается сразу, если браузер разрешает автозапуск, или после первого жеста пользователя, если браузер его блокирует. В 5-й фазе корона «Кошачьего глаза» (`NGC 6543`) и Чёрная дыра сжимаются в яркую микро-точку и **без паузы** раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой и кнопками перехода в профиль GitHub и репозиторий. После первого круга космос продолжает движение, а визитка остаётся на фоне (`.ambient-loop`) и доступна при наведении или клавиатурном фокусе.

**Техническая граница текущей статической сборки:** Rust/WASM асинхронно загружается по умолчанию через raw C ABI v1; `?wasm=0` принудительно выбирает TypeScript. Оба provider рассчитывают одинаковые фазы Курамото для дыхания частиц и геометрии позднего GENESIS, а также отдельные 64 консервативные контрольные орбиты для энергетической телеметрии. Художественная сцена не является полной N-body симуляцией. Python остаётся офлайн/CI reference, NEXUS работает синхронно в TS. WebGPU только проверяется на поддержку; Canvas 2D выполняет активную отрисовку. Реальный WASM и интеграционные сценарии проверены локально; полная браузерная демонстрация проверяется отдельно.
- **Для системного архитектора и CTO:** браузерная часть соединяет **Astro, TypeScript, Rust/WASM, Canvas 2D и Web Audio API**; Python даёт независимые эталоны и проверки, WGSL представлен спецификациями.

---

## 2. Семь ступеней архитектуры и адаптация для мобильных устройств (v2.5)

1. **Ступень 1 — `Astro` (`frontend/src/pages/index.astro`):** мгновенная доставка статического HTML/CSS каркаса на GitHub Pages.
2. **Ступень 2 — `TypeScript` + `SceneBufferSoA` (`sceneBuffer.ts`, `universeState.ts`):** монотонные часы `0..108 с`, полином Перлина `smootherstep`, детерминированный ГПСЧ `Mulberry32 / SplitMix32` (`GOLDEN_SEED = 104729`), 24-байтный заголовок `'UNVS'`, 8-польная защита `NaN/Infinity Guard` и 32-битный хеш `FNV-1a State Digest`.
3. **Ступень 3 — Rust/WASM и TypeScript fallback (`gravity.rs` / `wasmBridge.ts`):** общие фазы **Курамото** для активных частиц и отдельный ансамбль `REF64` в статическом потенциале Пламмера (`GM = 4900`, `ε² = 64`) с **Velocity Verlet** и дрейфом `ΔE / E₀`. ABI v1 использует `f64` для шага/времени/метрик и `f32` для массивов; шаг ограничен `50 мс` и разбит на подшаги не более `4 мс`. Позднее подключение WASM переносит актуальные фазы, частоты, орбиты, baseline и накопленное время TS; успешный Rust-шаг обновляет зеркала TS для fallback после trap. CI собирает и проверяет WASM до Astro.
4. **Ступень 4 — Графовый движок `NEXUS` (`graph_logic.py` / `simulationWorker.ts`):** синтез 3 классов связей (**Класс A: остов Прима MST**, **Класс B: мосты Габриэля**, **Класс C: дендриты Мюррея**), кластеризация по треугольникам и выборочная оценка диаметра через `BFS-28`.
5. **Ступень 5 — Активный рендерер `Canvas2D-HighDPI` и спецификации WGSL (`renderer.ts`, `pipeline.ts`, `*.wgsl`):** 5 эшелонов глубины (`Z0`–`Z4`), дизеринг `Blue-Noise 64×64`, пылевые каньоны `M31`, 7 оболочек короны `NGC 6543` и $C^1$-колокол преломления мембраны `BREACH LENS` $g(u)=(1-u^2)^2$. WebGPU только проверяется на поддержку; WGSL-файлы пока не используются для активной отрисовки.
6. **Ступень 6 — Нативная фабрика `Custom JSX DOM/SVG` и мобильный режим `9:16` (`Layer2..Layer5.tsx`, `universe.css`):**
   * На десктопах (`> 920px`) правая колонка «Цифрового водопада» (`LAYER_02`–`LAYER_04`) отображает все 8 модулей `IntegrationRegistry` вдоль правого края экрана.
   * На мобильных телефонах (`<= 920px`) технические панели по умолчанию свёрнуты, чтобы космос и финальная визитка были полностью открыты, а при нажатии на кнопки `METRICS`, `TOPOLOGY` или `TERMINAL` панели открываются по одной в режиме аккордеона без наслоений.
7. **Ступень 7 — `Web Audio API` (`audioSync.ts`):** движок сразу запрашивает воспроизведение `/audio/cosmic_ambient.mp3` (с отметки `2.6 с`); если браузер блокирует автозапуск, звук включается первым жестом пользователя. Огибающие спектра используют сглаживание с независимой от частоты кадров атакой и затуханием. Поддержка `navigator.audioSession.type = 'playback'` зависит от браузера и устройства.

---

## 3. Локальный запуск и проверки (35 модульных: 16 TS + 6 Python + 13 Rust; 5 интеграционных WASM)

    git clone https://github.com/DubnovAlexey/universe.git
    cd universe
    npm ci
    npm run build:wasm
    npm run dev
    python -B -m backend.main --verify
    python -B -m unittest discover -v
    cd physics_engine && cargo test && cd ..
    npm run typecheck
    npm test
    npm run verify:wasm
    npm run build
    npm run verify:pages-artifact

Для сборки WASM нужен Rust target `wasm32-unknown-unknown`. Полная команда `npm run verify:all` включает Python verifier и тесты, native Rust, TypeScript typecheck/инварианты, сборку и 5 интеграционных проверок WASM, Astro и Pages artifact. Интеграционные проверки охватывают 600 смешанных шагов TS/Rust, memory growth/count, seed/reset и позднее подключение, fallback при trap/неверном ABI/указателях и влияние Rust-фазы на видимые координаты, граф и SoA. Полный браузерный сценарий проверяется отдельно.

Полная команда проверки прошла. Выборочный production smoke подтвердил default native, финал и сохранённую визитку при входе во второй цикл, принудительный TS fallback и native на viewport `507×684` с видимым управлением; warning/error в просмотренных запусках не зарегистрированы. Полное покрытие устройств/звука/Safari и воспроизводимый performance baseline остаются открытыми.

---

## License

MIT License — Copyright (c) 2026 Alexey Dubnov (`DubnovAlexey`).
