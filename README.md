# 🌌 UNIVERSE // НЕЙРОВЕРС — Interactive Polyglot Audiovisual Installation (v2.5)

[![Live Demo](https://img.shields.io/badge/GitHub_Pages-Launch_Experience-38bdf8?style=for-the-badge&logo=github)](https://dubnovalexey.github.io/universe/)
[![Author Profile](https://img.shields.io/badge/GitHub-Alexey_Dubnov-6366f1?style=for-the-badge&logo=github)](https://github.com/DubnovAlexey)
[![Deterministic Core](https://img.shields.io/badge/Verification-39_TS_%7C_9_Python_%7C_13_Rust_%7C_6_WASM-f59e0b?style=for-the-badge)](#5-truth-policy--runtime-module-statuses)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981?style=for-the-badge)](#license)

* **Live Interactive Presentation (GitHub Pages):** [https://dubnovalexey.github.io/universe/](https://dubnovalexey.github.io/universe/)
* **Author's GitHub Profile:** [https://github.com/DubnovAlexey](https://github.com/DubnovAlexey)
* **Source Code Repository:** [https://github.com/DubnovAlexey/universe](https://github.com/DubnovAlexey/universe)

---

# 🇬🇧 DOCUMENTATION

## 1. Overview & Philosophical Concept

**UNIVERSE (Neuroverse)** is a full-screen, real-time interactive science-inspired audiovisual installation ("From Zero to Zero", 108-second continuous cycle) and a polyglot architecture showcase created by **Alexey Dubnov (`DubnovAlexey`)** and hosted on GitHub Pages.

**Core Philosophical Axis:** Cosmic beauty (`ILLUSION`), emergent neural topology (`NEXUS`), and computational logic (`X-RAY / TRUTH`) share the final scene coordinates. The physics provider advances before artistic targets; those targets produce the particle geometry consumed by Canvas, graph quantization and the `SceneBufferSoA` publication. A sampled state digest is diagnostic rather than proof of complete optical equivalence.

- **For Viewers:** A self-starting generative sci-fi film driven by light, deep velvet shadows, multi-echelon parallax (`Z0`–`Z4`), living non-Euclidean wave rings, spiral dust clouds, and spatial ambient sound. In the finale (`05. SINGULARITY`), the "Cat's Eye" nebula corona and Black Hole collapse into a single point of light and seamlessly unfold into an interactive holographic developer manifesto card (`DUBNOV ALEXEY`) with direct links to the author's main GitHub profile and project repository. After the first complete cycle, the card rises over 12 seconds of active scene time and remains in a translucent `.ambient-loop` state (opacity `0.60`), with deep text shadows and a soft tonal gradient without an outer box-shadow. Hover or keyboard focus reveals it. Pause freezes the rise; reduced motion uses a static position.
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
                      │  id | kind | pos(X,Y,Z) | vel(X,Y,Z) | depthZ | energy | flags
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

V1 is implemented in source: one immutable phase/audio/stress snapshot per existing frame, including a clamped `frameDtSec` that is zero while paused or hidden feeds Canvas, waterfall and DOM consumers. Unicode letters/numbers, including Cyrillic, participate in hover; protected Egyptian signs, punctuation and emoji remain canonical. Code-point glyph pools include mathematics and historical symbols, with a browser font filter and ASCII fallback. Corner groups, the phase scale, controls and finale static lines use three `160–180 ms` roll steps followed by a readable `280–320 ms` canonical dwell; leave/blur, pause and reduced motion restore exact text and stable accessible names. Generic paragraph/span content keeps an accessible canonical span while the visual span is `aria-hidden`; buttons/links/headings keep canonical accessible labels. Hover elapsed time uses `frameDtSec`, so phase/restart jumps do not change its timing. Waterfall and finale DOM animation subscribe to the same published frame; their own RAF loops are removed. The autonomous odometer retains `18–26 Hz`. The shared NEXUS fixture covers all 40 edges of the transport 24-node graph alongside fixture6; neither fixture exercises sampled BFS.

## 6. Quick Start & Automated Verification Commands (61 Unit Checks + 6 WASM Integration Checks)

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

The current build uses Astro `7.4.2` and requires Node.js `>=22.23.4`; use `npm ci` with the committed lockfile. The published `b60c995` passed [CI #45 build and deploy](https://github.com/DubnovAlexey/universe/actions/runs/40129807958) with workflow Node `^22.23.4` and current official Actions majors. The fresh dependency audit reports zero vulnerabilities; final 25 October results are recorded below. `npm run build:wasm` requires Rust with the `wasm32-unknown-unknown` target. `npm run verify:repo` checks that npm entry scripts and source/fixtures are tracked before CI. `npm run verify:all` starts with this guard, then runs Python verification/tests, native Rust tests, TypeScript typecheck/tests, WASM build/integration checks and the static build/artifact checks. The six WASM checks cover 600 mixed steps against TS, memory growth/count, seed/reset and late adoption, trap/ABI/pointer fallback, native-phase influence on visible coordinates and their graph/SoA publication, and the existing six-argument BREACH scalar magnitude reference at fixed stress `0.25` and time `0`. The last check uses 10,752 f32-normalized samples (tolerance `2e-4 px`); Canvas vector optics remain TypeScript and ABI v1 is unchanged. Browser review remains a separate check. [QA coverage and open checks](docs/QA_STATUS.md) record the current boundary.

The final production-mode `npm run verify:all` passed under Node `22.23.4`: 61 unit checks (39 TS, 9 Python, 13 Rust), 6 real-WASM integrations, typecheck, Astro build and Pages artifact. Fresh `npm audit` reports zero vulnerabilities; strict unused-TypeScript and Rust formatting checks also passed. Selective desktop/mobile smoke confirmed the raised card and visible actions without clipping, paused transform stability, keyboard focus, stable accessible Cyrillic text, supplementary glyphs, all five manually selected phases, BREACH open/close events and forced TS fallback. The narrow `320×568` layout keeps every action visible; the card can partly cover the center where content height limits the rise. This is separate from continuous 108-second viewing, audio audibility, Safari/iOS, OS reduced motion and repeatable performance measurements. [QA status](docs/QA_STATUS.md) records the tested viewports and the published CI #45 boundary.

---
---

# 🇷🇺 ДОКУМЕНТАЦИЯ

## 1. О проекте и философской концепции

**UNIVERSE (Нейроверс)** — полноэкранная интерактивная научно-художественная аудиовизуальная инсталляция (непрерывный цикл 108 секунд) и демонстрация полиглотной архитектуры, созданная **Алексеем Дубновым (`DubnovAlexey`)** и развёрнутая на **GitHub Pages**.

**Философская ось проекта:** Космическая красота (`ILLUSION`), возникающая нейронная сеть мозга (`NEXUS`) и вычислительная логика (`X-RAY / TRUTH`) используют общие итоговые координаты сцены. Физический provider выполняется до расчёта художественных целей; итоговая геометрия частиц поступает в Canvas, квантование графа и публикацию `SceneBufferSoA`. Выборочный дайджест служит диагностикой и не доказывает полного тождества оптик.

- **Для зрителя:** визуальный цикл запускается при открытии страницы (на компьютере и телефоне); музыка запускается сразу, если браузер разрешает автозапуск, или после первого жеста пользователя, если браузер его блокирует. В 5-й фазе корона «Кошачьего глаза» (`NGC 6543`) и Чёрная дыра сжимаются в яркую микро-точку и **без паузы** раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой и кнопками перехода в профиль GitHub и репозиторий. После первого полного круга визитка за 12 секунд активного времени плавно поднимается и остаётся на фоне (`.ambient-loop`, opacity `0.60`) с глубокими тенями текста и мягкой тональной подложкой; она доступна при наведении или клавиатурном фокусе. Пауза замораживает подъём, reduced motion задаёт статичное положение.

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

V1 реализован в исходниках: один неизменяемый снимок фазы, аудио и stress на существующий кадр, включая ограниченный `frameDtSec`, равный нулю при pause/hidden объединяет Canvas, водопад и DOM. Кириллица и другие Unicode Letters/Numbers участвуют в hover; египетские знаки, пунктуация, emoji и символы грамматики защищены. Пулы полных code point включают математику и исторические символы; браузер проверяет наличие глифа в доступном шрифте и использует ASCII fallback. Hover угловых групп, фазовой шкалы, управления и статических строк визитки выполняет три шага roll по `160–180 мс`, затем удерживает точный текст `280–320 мс`; уход курсора/blur, пауза и reduced motion восстанавливают текст и стабильные доступные имена. Generic p/span сохраняют отдельный доступный канонический span, а видимый декоративный span помечен `aria-hidden`; кнопки/ссылки/заголовки сохраняют стабильные accessible names. Hover считает elapsed по `frameDtSec`, поэтому смена фазы/restart не сбивает roll/dwell. Водопад и DOM-визитка подписаны на общий кадр, собственные RAF удалены. Автономный одометр сохраняет `18–26 Гц`. Паритет NEXUS проверяется fixture6 и общей transport-выборкой на 24 узлах/40 рёбрах; выборочный BFS ими не покрывается.

## 3. Локальный запуск и проверки (61 модульная: 39 TS + 9 Python + 13 Rust; 6 интеграционных WASM)

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

Текущая сборка использует Astro `7.4.2` и Node.js `>=22.23.4`; зависимости устанавливаются через `npm ci` по lock-файлу. Опубликованный `b60c995` прошёл [CI #45 build и deploy](https://github.com/DubnovAlexey/universe/actions/runs/40129807958) с workflow Node `^22.23.4` и актуальными официальными Actions. Свежий аудит зависимостей сообщает 0 уязвимостей; итог 25 октября указан ниже. Для сборки WASM нужен Rust target `wasm32-unknown-unknown`. `npm run verify:repo` проверяет отслеживаемые npm entry scripts и исходники/fixtures перед CI. Полная команда `npm run verify:all` начинает с этого guard, затем включает Python verifier и тесты, native Rust, TypeScript typecheck/инварианты, сборку и 6 интеграционных проверок WASM, Astro и Pages artifact. Интеграционные проверки охватывают 600 смешанных шагов TS/Rust, memory growth/count, seed/reset и позднее подключение, fallback при trap/неверном ABI/указателях, влияние Rust-фазы на видимые координаты/граф/SoA и скалярный BREACH reference: 10 752 f32-нормализованных образца при stress `0.25`, time `0`, допуск `2e-4 px`. Существующий шестипараметрический ABI v1 не менялся; векторная Canvas-оптика остаётся TS. Полный браузерный сценарий проверяется отдельно; [покрытие QA и открытые проверки](docs/QA_STATUS.md) сведены в отдельном документе.

Финальный production-mode `npm run verify:all` прошёл под Node `22.23.4`: 61 модульная проверка (39 TS, 9 Python, 13 Rust), 6 интеграций реального WASM, typecheck, Astro build и Pages artifact. Свежий `npm audit` — 0 уязвимостей; отдельные проверки unused TypeScript и форматирования Rust также прошли. Выборочный desktop/mobile smoke подтвердил приподнятую карточку и доступные действия без обрезки, стабильный transform на паузе, клавиатурный фокус, доступный кириллический канон, supplementary глифы, ручной выбор всех пяти фаз, события открытия/закрытия BREACH и принудительный TS fallback. На узком `320×568` все действия видны; при ограниченной высоте карточка может частично перекрывать центр. Непрерывные 108 секунд, слышимость звука, Safari/iOS, системный reduced motion и воспроизводимый performance baseline остаются отдельной приёмкой. [Статус QA](docs/QA_STATUS.md) указывает проверенные viewport и границу опубликованного CI #45.

---

## License

MIT License — Copyright (c) 2026 Alexey Dubnov (`DubnovAlexey`).
