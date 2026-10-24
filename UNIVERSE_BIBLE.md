# UNIVERSE / НЕЙРОВЕРС — ГЕНЕРАЛЬНАЯ ИНЖЕНЕРНАЯ КОНСТИТУЦИЯ И ТЕХНИЧЕСКАЯ ПАМЯТЬ ПРОЕКТА (v2.5)

## 0. МЕТАДАННЫЕ И СТАТУС ДОКУМЕНТА

* **Дата ревизии:** 24 октября 2026 года
* **Версия архитектуры:** `v2.5.0`
* **Автор и архитектор:** Алексей Дубнов (`Alexey Dubnov` / `DubnovAlexey`)
* **Репозиторий исходного кода:** `https://github.com/DubnovAlexey/universe`
* **Публичная презентация (GitHub Pages):** `https://dubnovalexey.github.io/universe/`
* **Профиль автора на GitHub:** `https://github.com/DubnovAlexey`
* **Назначение документа:** Внутренняя техническая энциклопедия проекта, позволяющая автору в любой момент быстро восстановить в памяти устройство каждого файла, математический аппарат, байтовую раскладку буфера памяти, логику конечного автомата 108-секундного цикла, причины архитектурных решений и процедуры тестирования.
* **Статусы компонентов в этом документе:**
    * `[РЕАЛИЗОВАНО В RUNTIME]` — код активно исполняется в браузере посетителя на GitHub Pages;
    * `[ПРОВЕРЕНО АВТОТЕСТОМ]` — инвариант автоматически проверяется при каждом запуске тестов (`npm test`, `unittest`, `cargo test`) и в GitHub Actions;
    * `[РЕЗЕРВ / FALLBACK]` — детерминированный резервный путь, активный по умолчанию при отсутствии внешнего бинарника или сервера;
    * `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` — проверка возможностей браузера без переключения основного рендерера;
    * `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` — серверный или компилируемый модуль, проверяемый в CI и локальном терминале.

---

## 1. МИССИЯ ПРОЕКТА, ФИЛОСОФСКАЯ ОСЬ И АУДИТОРИИ

**UNIVERSE (Нейроверс)** — интерактивная научно-художественная аудиовизуальная инсталляция «Из Нуля в Ноль» длительностью **108 секунд**, работающая как живая входная витрина портфолио и репозитория автора на GitHub Pages.

### 1.1. Для зрителя
1. **Мгновенный запуск без ожидания:** открытие ссылки `https://dubnovalexey.github.io/universe/` сразу запускает фазу `01. VOID` (рождение светового эха из Точки Нуля).
2. **Непрерывная музыка без отложенной загрузки:** аудиоэлемент и трек подготавливаются при старте, а воспроизведение сразу запрашивается у браузера. Если политика автозапуска блокирует звук, существующая кнопка и первый пользовательский жест запускают его с отметки `2.6 с`. После запуска трек не прерывается сменой фаз и циклов; доступность автозапуска зависит от браузера и устройства.
3. **Кульминация и выход визитки (79–108 с):** в 5-й фазе корона туманности «Кошачий глаз» (`NGC 6543`) и Чёрная дыра по спирали сжимаются строго в центральную Точку Нуля (`radius -> 0 px`), дают короткий `0.45 с` импульс и без паузы раскрываются в голографическую визитку **`DUBNOV ALEXEY`** с парящей в воздухе без рамок квантовой строкой (`18–26 Гц`).
4. **Прямой переход в GitHub и постоянный режим `.ambient-loop`:** на визитке (и в правом нижнем углу экрана) расположены прямые кнопки перехода в профиль `https://github.com/DubnovAlexey` и репозиторий `https://github.com/DubnovAlexey/universe`. После завершения первого 108-секундного круга космос уходит на новый виток (`01_VOID`), а визитка не исчезает — она остаётся полупрозрачно парить в центре экрана (`opacity: 0.46`) и плавно проявляется до `0.98` при наведении мыши.
5. **Чистое превью ссылки в мессенджерах:** в `frontend/src/pages/index.astro` установлен лаконичный `<title>Alexey Dubnov</title>` без мета-описаний, чтобы при пересылке ссылки в WhatsApp/Telegram отображались только имя автора и URL.

### 1.2. Для системного архитектора, преподавателя и CTO
Доказать на работающем коде принцип **Оптического Единства (Optical Equivalence)**:
* Художественный космос (`ILLUSION`), нейронный граф (`NEXUS`) и инженерный рентген (`X-RAY / TRUTH`) — это не три отдельные анимации, а три синхронных представления одного типизированного буфера состояния `SceneBufferSoA`.
* На каждом шаге физики координаты, скорости и энергии частиц сворачиваются в 32-битный хеш `FNV-1a State Digest`, выводимый в реальном времени в панелях `LAYER_02` и `LAYER_04`:
  `StateDigest(ILLUSION) == StateDigest(NEXUS) == StateDigest(X-RAY)`.

---

## 2. ХРОНОМЕТРАЖ 108 СЕКУНД И ПОВЕДЕНИЕ В РЕЖИМАХ DESKTOP / MOBILE

Общая длительность полного цикла составляет ровно **108.0 секунд** (`17 + 22 + 25 + 15 + 29 = 108 с`). Сцена объединяет астрофизические мотивы разных реальных объектов (`RS Puppis`, `M31 / NGC 3169`, `NGC 6543`) в единую научно-художественную композицию (*science-inspired art*).

| Фаза | Кодовое имя | Интервал (с) | Длительность | Число частиц | Главный визуальный и математический процесс |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`01_VOID`** | `MASTER_01 // RS_PUPPIS_ECHO` | `0.0 – 17.0` | `17.0 с` | `680` | Дышащая Точка Нуля, 7 деформируемых колец светового эха по мотивам цефеиды `RS Кормы` (по 120 угловых сегментов с FBM-модуляцией) и 8 криволинейных сигналов `RK2 Curl-Noise`. |
| **`02_GENESIS`** | `MASTER_02 // ANDROMEDA_SPIRAL` | `17.0 – 39.0` | `22.0 с` | `760` | Наклонный 3D-диск (`-0.17 рад`) с 4 логарифмическими рукавами, 2 барицентрами со световым мостом, 48 пылевыми облаками `M31` и синхронизацией Курамото `r(t)`. |
| **`03_EVOLUTION`** | `MASTER_03 // COGNITIVE_NEXUS` | `39.0 – 64.0` | `25.0 с` | `820` | C²-морфинг рукавов в два полушария Мозга вокруг 5 встречных кеплеровских колец. Синтез 3 классов рёбер (`MST`, `Gabriel`, `Murray`) и до 92 синаптических комет. |
| **`04_COLLAPSE`** | `MASTER_04 // BREACH_LENS_STORM` | `64.0 – 79.0` | `15.0 с` | `820` | 3 гравитационные аномалии на кольцах, авто-раскрытие (на `66.0–71.5 с`) или ручное управление мембраной `BREACH LENS`, микротрещины, сетка рентгена и слой `Z4`. |
| **`05_SINGULARITY`** | `MASTER_05 // CATS_EYE_TO_ODOMETER` | `79.0 – 108.0` | `29.0 с` | `820` | **Акт A (`79–87.5 с`):** корона по мотивам `NGC 6543` и Чёрная дыра -> **Акт B (`87.5–92.6 с`):** сжатие в Точку Нуля -> **Акт C (`92.6–93.05 с`):** импульс Нуля -> **Акт D (`93.05–108 с`):** визитка `DUBNOV ALEXEY`. |

### Различие компоновки Desktop (16:9) и Mobile (9:16)
* **На широких экранах (`window.innerWidth > 920px`):** правая колонка телеметрии (`LAYER_02`, `LAYER_03`, `LAYER_04`) открыта по умолчанию и занимает `422px` у правого края, не перекрывая центральную сцену.
* **На мобильных телефонах и при сужении окна (`window.innerWidth <= 920px`):**
    1. При старте страницы и при пересечении порога `<= 920px` во время `resize` (`syncViewportLayoutMode`) флаги `layer2_metricsHud`, `layer3_topologyGraph`, `layer4_architectTerminal` устанавливаются в `false` (`universeState.ts`), чтобы экран телефона был полностью свободен для космоса и финальной визитки.
    2. При нажатии на любую из кнопок `METRICS`, `TOPOLOGY` или `TERMINAL` метод `toggleLayer()` работает в **режиме аккордеона**: открывается только одна выбранная панель посередине экрана, а две другие автоматически закрываются, что полностью исключает наслоение панелей друг на друга.
    3. Высота вьюпорта задана через `100dvh` и `env(safe-area-inset-bottom)`, поэтому нижний док управления всегда виден над нижней панелью Safari/Chrome.

---

## 3. ПОЛНАЯ КАРТА ДЕРЕВА ФАЙЛОВ И СИМВОЛОВ РЕПОЗИТОРИЯ

    universe/
    ├── .github/workflows/deploy.yml           # CI/CD: Python --verify & unittest -> Rust cargo test -> npm ci -> TS typecheck & 14 tests -> Astro Build -> Pages Deploy
    ├── backend/                               # [ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER] Научное и верификационное ядро Python 3
    │   ├── api/transport.py                   # build_health_and_parity_report(), generate_live_binary_step()
    │   ├── core/
    │   │   ├── prng.py                        # DeterministicPRNG, GOLDEN_SEED=104729, compute_state_digest_fnv1a()
    │   │   ├── graph_logic.py                 # compute_nexus_topology(), build_bezier_arc_length_lut(), _compute_authentic_invariants()
    │   │   ├── stress_solver.py               # evaluate_breach_lens_refraction() — C¹-колокол g(u)=(1-u²)²
    │   │   └── singularity.py                 # evaluate_black_hole_optics(), sample_endless_cipher_stream()
    │   ├── utils/binary_packer.py             # pack_scene_binary_frame(), unpack_and_validate_header() ('<IHHIIII', 24 байта)
    │   ├── test_backend_parity.py             # 6 модульных тестов для стандартного раннера `python -B -m unittest discover -v`
    │   └── main.py                            # UniverseTelemetryHTTPHandler, run_cli_verification() (--verify)
    ├── physics_engine/                        # [ОФЛАЙН-ИНСТРУМЕНТ / WASM CRATE] Симплектическое ядро на Rust
    │   ├── Cargo.toml                         # crate-type = ["cdylib"]
    │   └── src/
    │       ├── lib.rs                         # C-ABI экспорты + 5 модульных тестов #[cfg(test)] mod tests (`cargo test`)
    │       ├── memory.rs                      # SceneBufferHeader (#[repr(C)], 24 байта), SceneStateSoA (MAX_CAPACITY=1024)
    │       ├── gravity.rs                     # step_symplectic_verlet_and_kuramoto(), compute_scene_total_energy()
    │       ├── breach_math.rs                 # compute_refraction_offset_with_stress(), compute_refraction_offset()
    │       └── prng.rs                        # DeterministicPrng, verify_golden_vectors(), compute_quantized_state_digest()
    ├── frontend/                              # [РЕАЛИЗОВАНО В RUNTIME] Клиентское приложение Astro + TypeScript
    │   ├── astro.config.mjs                   # site: 'https://dubnovalexey.github.io', base: '/universe' (prod) / '/' (dev)
    │   ├── package.json                       # Скрипты: dev, typecheck, test (Vite SSR runner), build, preview
    │   ├── public/
    │   │   ├── audio/cosmic_ambient.mp3       # Мастер-трек космического эмбиента (старт с 2.6 с)
    │   │   ├── audio/AUDIO_LICENSE.md         # Документация использования аудиопотока
    │   │   ├── wasm/physics_engine.wasm       # Слот бинарного модуля WASM (при 0 байт активируется TS_FALLBACK)
    │   │   └── favicon.svg                    # Векторная иконка вкладки
    │   └── src/
    │       ├── pages/index.astro              # Точка входа HTML (<title>Alexey Dubnov</title>), холст, баннер звука, док
    │       ├── styles/universe.css            # Цветовая конституция, вёрстка HUD, бесшовная визитка и адаптив 9:16
    │       ├── core/
    │       │   ├── contracts.ts               # Канонические типы PhaseId, SingularityAct, WorldEntity, TelemetrySnapshot
    │       │   ├── prng.ts                    # DeterministicPRNG, GOLDEN_U32_VECTORS, computeQuantizedStateDigest()
    │       │   ├── sceneBuffer.ts             # SceneBufferSoA (24-байтный заголовок 'UNVS' + 8-польный NaN-guard)
    │       │   ├── integrationRegistry.ts     # IntegrationRegistryManager (8 модулей, p50/p95 перцентили шага)
    │       │   ├── qualityGovernor.ts         # QualityGovernor (EMA времени кадра, профили HIGH/MEDIUM/LOW, гистерезис 3.5 с)
    │       │   └── resourceLedger.ts          # ResourceLedgerManager (5 категорий + underflowCount + disposerErrors)
    │       ├── store/
    │       │   ├── universeState.ts           # UniverseStore, smootherstep(), syncViewportLayoutMode(), 5 фаз, 4 подакта
    │       │   └── stressState.ts             # StressStateController (пружина линзы ζ=0.92, C¹-рефракция, микротрещины)
    │       ├── phases/
    │       │   ├── 01_void.ts                 # VoidPhaseSimulation (C²-морфинг по снимку morphOrigin, граф NEXUS, импульсы)
    │       │   ├── 02_genesis.ts              # computeGenesisTarget() (4 логарифмических рукава, мост, Курамото)
    │       │   ├── 03_evolution.ts            # computeEvolutionBrainTarget() (5 кеплеровских колец + 2 полушария)
    │       │   ├── 04_collapse.ts             # computeCollapseStormTarget() (3 гравитационные аномалии env1..env3)
    │       │   └── 05_singularity.ts          # computeSingularityTarget() (аккреция -> сжатие в Ноль -> ореол визитки)
    │       ├── bridge/
    │       │   ├── wasmBridge.ts              # WasmPhysicsBridge (истинный дрейф ΔE/E₀, валидация \0asm, TS_FALLBACK)
    │       │   ├── simulationWorker.ts        # NexusGraphEngine (Прим MST, Габриэль, Мюррей, кластеризация, BFS-28)
    │       │   ├── pythonSocketClient.ts      # PythonSocketClient (подготовленный клиент и валидатор пакетов 'UNVS')
    │       │   └── cipherOdometerEngine.ts    # CipherOdometerEngine (CANONICAL_FINALE_LINES, 3D-барабаны одометра)
    │       ├── engine/
    │       │   ├── pipeline.ts                # RenderPipeline (High-DPI Canvas2D, probeWebGpuSupport, Blue-Noise 64x64)
    │       │   ├── renderer.ts                # UniverseRenderer (отрисовка всех 5 фаз, Z4, цикл RAF, bootstrapUniverseV2)
    │       │   └── webgpu/*.wgsl              # Шейдерные спецификации WGSL (illusion.wgsl, truth.wgsl, breach.wgsl)
    │       ├── layers/
    │       │   ├── Layer2_Metrics.tsx         # Нативная фабрика React.createElement, динамический тег физики, LAYER_02
    │       │   ├── Layer3_Topology.tsx        # mountLayer3Topology() — инспектор графа NEXUS (LAYER_03, EST. BFS)
    │       │   ├── Layer4_Terminal.tsx        # mountLayer4Terminal() — полная таблица всех 8 модулей и логи (LAYER_04)
    │       │   └── Layer5_CipherFinale.tsx    # FinaleCardDomAnimator, mountLayer5CipherFinale() — визитка DUBNOV ALEXEY
    │       ├── utils/audioSync.ts             # AudioSyncEngine (Web Audio API, iOS audioSession, снятие слушателей с 1-го тапа)
    │       └── tests/parityAndSeams.test.ts   # runUniverseVerificationSuite() — 16 инвариантов
    ├── docs/
    │   ├── ARCHITECTURE.md                    # Краткий архитектурный обзор
    │   ├── DEMO_SCRIPT.md                     # Сценарий демонстрации и команды запуска 25 автотестов
    │   └── study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md
    ├── package.json                           # Корневой манифест монорепозитория (workspaces: ["frontend"])
    ├── README.md                              # Двуязычная публичная витрина проекта (EN + RU)
    └── UNIVERSE_BIBLE.md                      # Настоящая внутренняя техническая конституция проекта

---

## 4. АРХИТЕКТУРА И ГРАНИЦЫ РЕАЛЬНОГО ИСПОЛНЕНИЯ (RUNTIME MAP)

| Подсистема | Файл и класс | Статус на GitHub Pages | Что именно делает в реальности |
| :--- | :--- | :---: | :--- |
| **Оболочка Astro** | `frontend/src/pages/index.astro` | `[РЕАЛИЗОВАНО В RUNTIME]` | Отдаёт статический HTML/CSS каркас с `base: '/universe'` в production и `'/'` в dev. |
| **Хранилище и часы** | `frontend/src/store/universeState.ts` (`UniverseStore`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Управляет монотонным временем `0..108 с`, 5 фазами, 4 подактами финала и `SceneBufferSoA`. |
| **Рендерер Canvas 2D** | `frontend/src/engine/renderer.ts` (`UniverseRenderer`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Активный графический движок (`Canvas2D-HighDPI`), рисующий все 5 фаз, дизеринг `Blue-Noise`, линзу `BREACH` и эшелон `Z4`. |
| **Проверка WebGPU** | `frontend/src/engine/pipeline.ts` (`probeWebGpuSupport`) | `[ПРОВЕРКА ПОДДЕРЖКИ / PROBE]` | Вызывает `navigator.gpu.requestAdapter()` и выставляет статус `fallback` / `unsupported`. Файлы `*.wgsl` — спецификации; активный рендер остаётся Canvas 2D. |
| **Симплектическая физика** | `frontend/src/bridge/wasmBridge.ts` (`WasmPhysicsBridge`) | `[TS FALLBACK / WASM НЕ ОПУБЛИКОВАН]` | В браузере исполняются интегратор `Velocity Verlet` и модель Курамото в TypeScript. Путь `/wasm/physics_engine.wasm` сейчас содержит пустой placeholder; `?wasm=1` поэтому возвращает `TS_FALLBACK`. Rust-крейт проверяется отдельно через `cargo test`; CI пока не создаёт браузерный WASM-модуль. |
| **Графовый движок NEXUS** | `frontend/src/bridge/simulationWorker.ts` (`NexusGraphEngine`) | `[РЕЗЕРВ / FALLBACK]` | Вызывается синхронно из `01_void.ts` каждые `0.12 с` симуляционного времени. Статус в реестре — `FALLBACK`, метка в UI — `[ts/graph_engine]`. |
| **Нативные DOM/SVG слои** | `frontend/src/layers/Layer2..Layer5.tsx` | `[РЕАЛИЗОВАНО В RUNTIME]` | Собственная легковесная фабрика `React.createElement` (без пакета React). Монтирует DOM один раз и обновляет числа через `data-bind`, а контуры и одометр — на `60 FPS`. |
| **Звуковой движок** | `frontend/src/utils/audioSync.ts` (`AudioSyncEngine`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Запрашивает воспроизведение при загрузке; при запрете автозапуска использует пользовательский жест. Спектральные огибающие имеют временно-независимое сглаживание. `audioSession.type = 'playback'` задаётся при наличии API, но поведение зависит от платформы. |
| **Ядро Python 3** | `backend/main.py`, `backend/core/*.py` | `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` | Реализует локальный HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`), CLI-верификатор (`--verify`) и 6 модульных тестов `unittest`. На статическом GitHub Pages Python-сервер не запущен (`CLIENT_ONLY`), а `PythonSocketClient` служит подготовленным и протестированным валидатором бинарных пакетов `'UNVS'`. |
| **Крейт Rust** | `physics_engine/src/*.rs` | `[ОФЛАЙН-ИНСТРУМЕНТ / WASM CRATE]` | Содержит реализацию `SceneStateSoA`, `Velocity Verlet`, `Kuramoto` и `breach_math`, проверяемую 5 модульными тестами `cargo test` в GitHub Actions. |

---

## 5. ИСТОЧНИКИ ИСТИНЫ И БИНАРНЫЙ КОНТРАКТ ДАННЫХ (`SceneBufferSoA`)

### 5.1. Раскладка 24-байтного заголовка `SceneBufferHeader` (`Little-Endian`)
Заголовок хранится в `ArrayBuffer(24)` и управляется через `DataView` с явным флагом `littleEndian = true` (`frontend/src/core/sceneBuffer.ts`). В Python (`backend/utils/binary_packer.py`) ему соответствует формат `struct.pack('<IHHIIII', ...)`, а в Rust (`physics_engine/src/memory.rs`) — структура `#[repr(C)] pub struct SceneBufferHeader`:

| Смещение (байты) | Имя поля | Тип (TS / Rust / Python) | Размер | Значение по умолчанию и назначение |
| :---: | :--- | :--- | :---: | :--- |
| `0 .. 3` | `magic` | `Uint32` / `u32` / `I` | `4 байта` | Константа `0x53564E55` (ASCII `'UNVS'` в порядке байт Little-Endian). |
| `4 .. 5` | `schemaVersion` | `Uint16` / `u16` / `H` | `2 байта` | Версия схемы бинарного протокола (`2`). |
| `6 .. 7` | `flags` | `Uint16` / `u16` / `H` | `2 байта` | Флаги состояния буфера (`0` при сбросе, `1` при активном тике). |
| `8 .. 11` | `tick` | `Uint32` / `u32` / `I` | `4 байта` | Монотонно возрастающий номер физического шага (`0, 1, 2, ...`). |
| `12 .. 15` | `count` | `Uint32` / `u32` / `I` | `4 байта` | Число активных сущностей в кадре (`0 <= count <= 1024`). |
| `16 .. 19` | `seed` | `Uint32` / `u32` / `I` | `4 байта` | Зерно детерминированного генератора (`GOLDEN_SEED = 104729`). |
| `20 .. 23` | `digest` | `Uint32` / `u32` / `I` | `4 байта` | 32-битная контрольная сумма состояния `FNV-1a State Digest`. |

### 5.2. Выровненные типизированные массивы сущностей (`capacity = 1024`)
* `id: Uint32Array(1024)` — уникальный идентификатор частицы `0 .. N-1`.
* `kind: Uint8Array(1024)` — код семантического типа (`EntityKindCode`: `0 = STAR`, `1 = NODE`, `2 = SOMA`, `3 = FILAMENT_POINT`, `4 = DUST`, `5 = CENTER`, `6 = GLYPH`).
* `pos: Float32Array(3072)` — текущие координаты `[x, y, z]` каждой сущности (`i3 = index * 3`).
* `prevPos: Float32Array(3072)` — координаты предыдущего шага (снимок перед обновлением).
* `interpPos: Float32Array(3072)` — буфер линейной интерполяции между `prevPos` и `pos`.
* `vel: Float32Array(3072)` — вектор скорости `[vx, vy, vz]`.
* `depthZ: Float32Array(1024)` — координата глубины (`0.10 .. 1.60`), определяющая принадлежность к эшелонам `Z0..Z3`.
* `energy: Float32Array(1024)` — нормированная светимость / заряд узла (`0.0 .. 10.0`).
* `flags: Uint32Array(1024)` — упакованный номер кластера `(clusterId << 4)` и бит синаптической вспышки.

### 5.3. Полная 8-польная защита `NaN / Infinity Guard`
В методе `SceneBufferSoA.syncEntityFromParticle()` все **8 числовых параметров** (`x, y, z, vx, vy, vz, depthZ, energy`) проходят индивидуальную проверку `Number.isFinite(val)`. Каждое нечисловое значение заменяется безопасным конечным значением (`0` или `1.0` для `depthZ`) и увеличивает счётчик `this.nanGuardTriggeredCount` ровно на число обнаруженных повреждённых полей (`[ПРОВЕРЕНО АВТОТЕСТОМ #4]`).

---

## 6. КОНЕЧНЫЙ АВТОМАТ 5-Й ФАЗЫ (`05_SINGULARITY`)

Вся 5-я фаза длится `29.0 секунд` (`79.0 – 108.0 с` глобального времени, `el = phaseElapsedSec` от `0.0` до `29.0 с`):

    [el: 0.0 .. 8.5 с]  ---> ACT_A_ACCRETION
       • unfoldFromZero = 0.02 + 0.98 * smootherstep(0.0, 0.44, actProgress)
       • Из Точки Нуля вырастают 7 оболочек короны NGC 6543, аккреционный диск и 2 джета.
       • logicConvergence = 0.

    [el: 8.5 .. 13.6 с] ---> ACT_B_LOGIC (Длительность 5.1 с)
       • actBProg = smootherstep(8.5, 13.6, el)
       • radiusEnvelope = (1.0 - smootherstep(0.05, 0.98, actBProg))^1.85 ---> строго в 0 px!
       • Все 7 оболочек короны, диск и частицы по спирали сжимаются в центральную Точку Нуля.
       • logicConvergence = sin(actBProg * PI) * 0.65 ---> к el = 13.6 с возвращается строго в 0!

    [el: 13.6 .. 14.05 с] -> ACT_C_ZERO_SILENCE (Длительность 0.45 с)
       • Короткий световой импульс максимального сжатия в центральной микро-точке (r = 2.4..5.6 px).
       • logicConvergence = 0. Музыка продолжает играть непрерывно.

    [el: 14.05 .. 29.0 с] -> ACT_D_GITHUB_CARD (Длительность 14.95 с)
       • Взводится флаг finaleReachedOnce = true.
       • githubCardAssemblyProgress = clamp((el - 14.05) / 4.5, 0, 1).
       • Из центральной Точки Нуля разворачивается DOM-визитка DUBNOV ALEXEY (Layer5_CipherFinale.tsx),
         а частицы фона мягко расходятся в широкий космический ореол (ringFrac = 0.27..0.48).

    [el >= 29.0 с (108 с)] -> ПЕРЕХОД НА НОВЫЙ КРУГ (RESTART_COLLAPSE -> 01_VOID)
       • Если включён AUTO: ON и курсор мыши не наведён на визитку (!isFinaleCardHovered),
         космос за 1.45 с перезапускается в фазу 01_VOID (cycleCount += 1).
       • Так как finaleReachedOnce === true, визитка НЕ закрывается, а переходит в
         полупрозрачный фоновый режим (.ambient-loop, opacity: 0.46) и ярко проявляется
         до 0.98 при наведении мыши на любом этапе следующих циклов!

---

## 7. МАТЕМАТИЧЕСКИЕ МОДЕЛИ И АЛГОРИТМЫ (ПО ФАКТИЧЕСКОМУ КОДУ)

### 7.1. Детерминированный ГПСЧ `Mulberry32 / SplitMix32` и `FNV-1a State Digest`
* **Файлы:** `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs`, `backend/core/prng.py`.
* **Потоковый генератор `nextU32()` (Mulberry32):**
    1. `state = (state + 0x6D2B79F5) >>> 0`
    2. `z = Math.imul(state ^ (state >>> 15), state | 1) >>> 0`
    3. `z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0`
    4. `return (z ^ (z >>> 14)) >>> 0`
* **Индексная хеш-функция `hashU32(seed, index)` (SplitMix32):** использует константы `0x9E3779B9`, `0x85EBCA6B`, `0xC2B2AE35`.
* **Эталонный вектор при `GOLDEN_SEED = 104729` (`[ПРОВЕРЕНО АВТОТЕСТОМ #1]`):**
  `GOLDEN_U32_VECTORS = [325253669, 3481002091, 881690241, 2630884050]`.
* **Квантование и свертка `computeQuantizedStateDigest`:**
  Для каждой 4-й частицы (`stride = 4`) координаты и скорости умножаются на `10.0`, энергия — на `100.0`, округляются по единому правилу `quantizeHalfUp(v) = Math.floor(v + 0.5) | 0` и сворачиваются в 32-битный хеш `FNV-1a` (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`).

### 7.2. Симплектический интегратор `Velocity Verlet`, истинный дрейф энергии и модель Курамото
* **Файлы:** `physics_engine/src/gravity.rs`, `frontend/src/bridge/wasmBridge.ts`.
* **Модель Курамото:** для всех активных частиц вычисляется средний фазовый угол $\psi = \text{atan2}(\sum \sin\theta_i, \sum \cos\theta_i)$ и параметр порядка $r(t) = \frac{1}{N}\sqrt{(\sum \cos\theta_i)^2 + (\sum \sin\theta_i)^2} \in [0, 1]$.
* **Схема Velocity Verlet и истинный дрейф $\Delta E / E_0$:** интегрирует ансамбль орбит в гравитационном потенциале Пламмера ($\varepsilon^2 = 64.0$, $GM = 4900.0$) с адаптивным подшагом `subDt = min(0.008, safeDt * 0.5)`. Начальная энергия $E_0$ фиксируется при инициализации ансамбля, а на каждом шаге вычисляется истинный относительный дрейф полной механической энергии $\Delta E / E_0 = |E(t) - E_0| / |E_0|$ без искусственных констант и зажимов (`[ПРОВЕРЕНО АВТОТЕСТОМ #5]`).

### 7.3. Эвристическая модель графа `NEXUS` и паритет TS <-> Python (`simulationWorker.ts`, `backend/core/graph_logic.py`)
* На малых и средних ансамблях ($N \le 260$, включая эталонный 24-узловой граф) реализации в TypeScript и Python используют идентичное округление `round2` и дают 100%-ное совпадение всех рёбер и метрик (`[ПРОВЕРЕНО АВТОТЕСТОМ #6]`).
* На полной рабочей сцене ($N > 260$) в браузере включается прореживание `stride = 2` для сохранения кадрового бюджета `60+ FPS`.
* Диаметр `diameterHops` и средняя длина пути `avgPathLength` вычисляются обходом в ширину (`BFS`) с шагом выборки стартовых вершин `sampleStride = max(1, floor(N / 28))` (при $N \le 28$ обход является полным, а при $N > 28$ даёт быструю выборочную оценку снизу, подписанную в `LAYER_03` как `EST. DIAMETER / PATH (BFS)`).

### 7.4. Оптическое преломление `BREACH LENS` (`stressState.ts`, `breach_math.rs`, `stress_solver.py`)
* На кольце вокруг деформированной границы линзы ($d = \text{dist} / (R \cdot \text{warp})$, полуширина $w = 0.24$, нормированное расстояние от кромки $u = |d - 1.0| / w$) действует компактно-поддерживаемый колокол 4-й степени:
  $$g(u) = (1 - u^2)^2 \quad \text{при } u < 1, \qquad g(u) = 0 \quad \text{при } u \ge 1$$
* На границе кольца ($u = 1$) функция $g(1) = 0$ и её первая производная $g'(1) = 0$ ($C^1$-гладкое сопряжение без оптического шва, $C^\infty$ внутри открытого интервала $u \in (0, 1)$). Все три реализации (TS, Python, Rust) содержат идентичную формулу `warp`.

---

## 8. РЕНДЕРИНГ, ЗВУК И КНИГА УЧЁТА РЕСУРСОВ (`ResourceLedger`)

### 8.1. Графический конвейер и дизеринг `Blue-Noise`
* `RenderPipeline` (`frontend/src/engine/pipeline.ts`) создаёт 2D-контекст с ограничением `dpr = min(maxDpr, window.devicePixelRatio)` из `QualityGovernor` (`2.0` для HIGH, `1.5` для MEDIUM, `1.25` для LOW) и генерирует тайл дизеринга `64×64` (`buildBlueNoiseDitherPattern`).

### 8.2. Аудио-конвейер и мгновенное снятие слушателей (`frontend/src/utils/audioSync.ts`)
* Файл: `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 МБ`).
* При старте вызывается `configureIosAudioSession()` (`navigator.audioSession.type = 'playback'`).
* При старте `trySilentAutoplayWithoutWarning()` сразу запрашивает воспроизведение `<audio>` без создания `AudioContext`. Браузер может отклонить запрос по своей autoplay policy; тогда доступен запуск первым жестом пользователя. Наличие или отсутствие сообщения в консоли зависит от браузера.
* Как только промис `audioEl.play()` разрешается или срабатывает событие `'playing'`, немедленно вызывается `this.removeUnlockListenersFn?.()`, отключающая все глобальные слушатели разблокировки.

### 8.3. Книга учёта ресурсов `ResourceLedger` (`frontend/src/core/resourceLedger.ts`)
* Отслеживает 5 категорий ресурсов (`buffers`, `textures`, `audioNodes`, `listeners`, `workers`) и 2 диагностических счётчика (`underflowCount` при попытке освободить больше ресурсов, чем было выделено, и `disposerErrors` при исключениях внутри колбэков очистки).
* Метод `disposeCycleResources()` проверяет все 5 категорий и отсутствие `underflowCount` / `disposerErrors` (`[ПРОВЕРЕНО АВТОТЕСТОМ #16]`).

---

## 9. МАТРИЦА РЕЕСТРА ИНТЕГРАЦИЙ (`IntegrationRegistry`)

Все **8 модулей** в `frontend/src/core/integrationRegistry.ts` инициализируются с нулевыми замерами (`0 ms`) и в полном составе отображаются в панели `LAYER_04 // TERMINAL & REGISTRY`:

| ID модуля | Язык | Файл-владелец | Стартовый статус | Когда обновляется |
| :--- | :--- | :--- | :---: | :--- |
| `ts-core` | `TypeScript` | `frontend/src/store/universeState.ts` | `READY` | На каждом шаге физики в режиме `TS_FALLBACK` (`wasmBridge.ts`). |
| `wasm-physics` | `Rust/WASM` | `physics_engine/src/gravity.rs` | `FALLBACK` | В текущей публикации бинарный файл пустой; `?wasm=1` не активирует Rust. `READY` возможен только после сборки и публикации валидного WASM-модуля с нужным ABI. |
| `webgpu-render` | `WGSL/WebGPU` | `frontend/src/engine/webgpu/illusion.wgsl` | `FALLBACK` | Вызывает только `probeWebGpuSupport()`; WGSL-спецификации не запускаются, текущий рендер выполняется через Canvas 2D. |
| `canvas2d-render` | `Canvas2D` | `frontend/src/engine/renderer.ts` | `READY` | На каждом кадре в `UniverseRenderer.renderFrame()`. |
| `pyodide-graph` | `Python` | `backend/core/graph_logic.py` | `FALLBACK` | Остаётся в `FALLBACK` при работе локального TS-движка графа. |
| `server-ws` | `Python` | `backend/api/transport.py` | `INACTIVE` | Подготовленный клиент `PythonSocketClient`; переходит в `READY` при подключении внешнего сервера с `PUBLIC_WS_URL`. |
| `web-audio` | `WebAudio` | `frontend/src/utils/audioSync.ts` | `LOADING` | Переходит в `READY` при старте `cosmic_ambient.mp3` (`updateRealtimeModulation`). |
| `worker-physics` | `TypeScript` | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Записывает время построения графа `NEXUS` (`buildDeterministicGraph`). |

---

## 10. СИСТЕМА ПРОВЕРОК И АВТОТЕСТОВ (27 ИНВАРИАНТОВ В 3 ЯЗЫКАХ + ПРОВЕРКА АРТЕФАКТА PAGES)

| Команда | Что реально проверяет | Результат |
| :--- | :--- | :---: |
| `python -B -m backend.main --verify` | CLI-проверка 5 математических инвариантов Python-ядра: `GOLDEN_U32_VECTORS`, 24-байтный заголовок `'UNVS'`, граф `NEXUS`, кольцо рефракции `BREACH LENS` (`px=232`) и оптика Чёрной дыры. | `status: "ok"` (Exit Code `0`) |
| `python -B -m unittest discover -v` | Запускает **6 модульных тестов** из `backend/test_backend_parity.py`: PRNG, FNV-1a дайджест, санитизация `NaN` и отбраковка обрезанных пакетов в `binary_packer.py`, граф `NEXUS` на 24 узлах, граничные условия `BREACH LENS` и генератор кадров `generate_live_binary_step`. | `Ran 6 tests — OK` (Exit Code `0`) |
| `cargo test` (в `physics_engine/`) | Запускает **5 модульных тестов** Rust-ядра из `physics_engine/src/lib.rs`: паритет `GOLDEN_U32_VECTORS`, детерминизм `SceneStateSoA`, истинный нулевой/ненулевой дрейф энергии `Velocity Verlet`, границы рефракции `BREACH LENS` и C-ABI указатели памяти. | `5 passed; 0 failed` (Exit Code `0`) |
| `npm --prefix frontend run typecheck` | Запускает строгий компилятор `tsc --noEmit` по всем `.ts` и `.tsx` модулям фронтенда. | `0 errors` (Exit Code `0`) |
| `npm --prefix frontend test` | Запускает через Vite SSR функцию `runUniverseVerificationSuite()` из `frontend/src/tests/parityAndSeams.test.ts` (**16 инвариантов**, включая временно-независимую атаку/релиз аудиоогибающей). | `Summary: 16/16 PASSED` (Exit Code `0`) |
| `npm --prefix frontend run build` + `npm --prefix frontend run verify:pages-artifact` | Проверяет production HTML, обязательные UI-точки входа, адреса Astro-бандлов под `/universe/`, наличие фавикона и аудиотрека в Pages-артефакте. Это статическая проверка собранного артефакта, не полноценный браузерный E2E-тест. | `Pages artifact smoke check passed` |

---

## 11. СБОРКА, ЛОКАЛЬНАЯ РАЗРАБОТКА И ДЕПЛОЙ НА GITHUB PAGES

### Команды для работы из корня репозитория (`C:\Projects\Full_Stack\universe`):
1. Чистая установка зависимостей по lock-файлу: `npm ci`
2. Локальный сервер разработки (`http://localhost:4321/`): `npm run dev`
3. Полная локальная проверка перед коммитом: `npm run verify:all`
4. Продакшен-сборка в папку `frontend/dist` (`base: '/universe'`): `npm run build`

---

## 12. БЕЗОПАСНОСТЬ, ЛИЦЕНЗИИ И ВНЕШНИЕ РЕСУРСЫ

* В репозитории нет секретных ключей или паролей; файл `.env` добавлен в `.gitignore`, а `.env.example` содержит только закомментированный шаблон опционального адреса `PUBLIC_WS_URL`.
* Весь исходный код репозитория распространяется под открытой лицензией **MIT** (`LICENSE`).
* Аудиофайл `frontend/public/audio/cosmic_ambient.mp3` включён для некоммерческого демонстрационного показа портфолио на GitHub Pages (`frontend/public/audio/AUDIO_LICENSE.md`). Лицензия MIT на программный код не заменяет музыкальную лицензию аудиозаписи; перед любым сторонним или коммерческим переиспользованием трека необходимо отдельно подтвердить права на аудиофайл.

---

## 13. ЖУРНАЛ ОБНОВЛЕНИЙ ДОКУМЕНТАЦИИ

* **24.10.2026 (`v2.5.0` — Deep QA Release):**
    * Устранён искусственный зажим энергетического дрейфа в `wasmBridge.ts` и `gravity.rs`: теперь выводится истинный относительный дрейф $\Delta E / E_0$ с динамической подписью модуля (`[ts/wasmBridge.ts]` / `[rust/gravity.rs]`).
    * Счётчик `nanGuardTriggeredCount` в `SceneBufferSoA` расширен на все 8 числовых полей.
    * В `ResourceLedger` добавлены `underflowCount`, `disposerErrors` и проверка всех 5 категорий ресурсов.
    * В `Layer4_Terminal.tsx` выведены все 8 модулей `IntegrationRegistry`.
    * Добавлены 6 модульных тестов Python (`backend/test_backend_parity.py`), 5 модульных тестов Rust (`physics_engine/src/lib.rs`) и 16 инвариантов TypeScript (`parityAndSeams.test.ts`) — всего **27 проверок**; production-сборка дополнительно проходит smoke-проверку Pages-артефакта.
