<!-- НАЗНАЧЕНИЕ: Справочник исходников, памяти, состояний и вычислительных контрактов. -->
<!-- РАЗДЕЛЫ: Обзор; Фазы; Карта модулей; Runtime; Память; Финал; Модели; Представление; Диагностика; Проверки; Сборка; Лицензии. -->
# UNIVERSE — технический справочник

## 1. Назначение

UNIVERSE — интерактивная аудиовизуальная инсталляция с 108-секундным циклом и общей геометрией для космической оптики, NEXUS и X-RAY. Этот справочник описывает модули, форматы памяти, конечный автомат и численные контракты.

[Обзор и запуск](README.md) · [Архитектурный конвейер](docs/ARCHITECTURE.md) · [Математические модели](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)

## 2. ХРОНОМЕТРАЖ 108 СЕКУНД И ПОВЕДЕНИЕ В РЕЖИМАХ DESKTOP / MOBILE

Пять фаз сценария рассчитаны на **108.0 секунд активного времени сцены** (`17 + 22 + 25 + 15 + 29 = 108 с`). Пауза и скрытая вкладка останавливают часы; ограничение шага при зависании кадра и межцикловое схлопывание могут увеличить реальную длительность просмотра. Сцена объединяет астрофизические мотивы разных реальных объектов (`RS Puppis`, `M31 / NGC 3169`, `NGC 6543`) в единую научно-художественную композицию (*science-inspired art*).

Колонка «Цель в метаданных» содержит `targetParticleCount` фазы. Для непрерывного морфинга симуляция с первой фазы сохраняет единый ансамбль до **820 частиц на HIGH**; количество выбирается при создании/перезапуске с учётом профиля качества, при reduced motion ограничено 420. Переход между фазами не пересоздаёт ансамбль. Изменения DPR применяются в текущем цикле без сброса частиц.

| Фаза | Кодовое имя | Интервал (с) | Длительность | Цель в метаданных | Главный визуальный и математический процесс |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **`01_VOID`** | `MASTER_01 // RS_PUPPIS_ECHO` | `0.0 – 17.0` | `17.0 с` | `680` | Дышащая Точка Нуля, 7 деформируемых колец светового эха по мотивам цефеиды `RS Кормы` (по 120 угловых сегментов с FBM-модуляцией) и 8 криволинейных сигналов с шумовым поворотом. |
| **`02_GENESIS`** | `MASTER_02 // ANDROMEDA_SPIRAL` | `17.0 – 39.0` | `22.0 с` | `760` | Наклонный 3D-диск (`-0.17 рад`) с 4 логарифмическими рукавами, 2 барицентрами со световым мостом, 48 пылевыми облаками `M31` и синхронизацией Курамото `r(t)`. |
| **`03_EVOLUTION`** | `MASTER_03 // COGNITIVE_NEXUS` | `39.0 – 64.0` | `25.0 с` | `820` | C²-морфинг рукавов в два полушария Мозга вокруг 5 встречных кеплеровских колец. Синтез 3 классов рёбер (`MST`, `Gabriel`, `Murray`) и до 92 синаптических комет. |
| **`04_COLLAPSE`** | `MASTER_04 // BREACH_LENS_STORM` | `64.0 – 79.0` | `15.0 с` | `820` | 3 гравитационные аномалии на кольцах, авто-раскрытие (на `66.0–71.5 с`) или ручное управление мембраной `BREACH LENS`, микротрещины, сетка рентгена и слой `Z4`. |
| **`05_SINGULARITY`** | `MASTER_05 // CATS_EYE_TO_ODOMETER` | `79.0 – 108.0` | `29.0 с` | `820` | **Акт A (`79–87.5 с`):** корона по мотивам `NGC 6543` и Чёрная дыра -> **Акт B (`87.5–92.6 с`):** сжатие в Точку Нуля -> **Акт C (`92.6–93.05 с`):** импульс Нуля -> **Акт D (`93.05–108 с`):** визитка `DUBNOV ALEXEY`. |

### Различие компоновки Desktop (16:9) и Mobile (9:16)
* **На широких экранах (`window.innerWidth > 920px`):** правая колонка телеметрии (`LAYER_02`, `LAYER_03`, `LAYER_04`) открыта по умолчанию и занимает до `422px` у правого края. В диапазоне 921–1730px ширина ограничена `min(422px, 22vw)`, сохраняя отдельную центральную полосу для сцены и визитки.
* **На мобильных телефонах и при сужении окна (`window.innerWidth <= 920px`):**
    1. При старте страницы и при пересечении порога `<= 920px` во время `resize` (`syncViewportLayoutMode`) флаги `layer2_metricsHud`, `layer3_topologyGraph`, `layer4_architectTerminal` устанавливаются в `false` (`universeState.ts`), чтобы экран телефона был полностью свободен для космоса и финальной визитки.
    2. При нажатии на любую из кнопок `METRICS`, `TOPOLOGY` или `TERMINAL` метод `toggleLayer()` работает в **режиме аккордеона**: открывается только одна выбранная панель посередине экрана, а две другие автоматически закрываются, что полностью исключает наслоение панелей друг на друга.
    3. Высота вьюпорта задана через `100dvh` и `env(safe-area-inset-bottom)`, поэтому нижний док управления всегда виден над нижней панелью Safari/Chrome.

---

## 3. ПОЛНАЯ КАРТА ДЕРЕВА ФАЙЛОВ И СИМВОЛОВ РЕПОЗИТОРИЯ

    universe/
    ├── .github/workflows/deploy.yml           # Проверки Python/Rust/TypeScript/WASM, сборка и публикация Pages
    ├── backend/                               # [ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER] Научное и верификационное ядро Python 3
    │   ├── api/transport.py                   # build_health_and_parity_report(), generate_live_binary_step()
    │   ├── core/
    │   │   ├── prng.py                        # DeterministicPRNG, GOLDEN_SEED=104729, compute_state_digest_fnv1a()
    │   │   ├── graph_logic.py                 # compute_nexus_topology(), build_bezier_arc_length_lut(), _compute_authentic_invariants()
    │   │   ├── stress_solver.py               # evaluate_breach_lens_refraction() — C¹-колокол g(u)=(1-u²)²
    │   │   └── singularity.py                 # evaluate_black_hole_optics(), sample_endless_cipher_stream()
    │   ├── utils/binary_packer.py             # pack_scene_binary_frame(), unpack_and_validate_header() ('<IHHIIII', 24 байта)
    │   ├── test_backend_parity.py             # Модульные тесты для стандартного раннера `python -B -m unittest discover -v`
    │   └── main.py                            # UniverseTelemetryHTTPHandler, run_cli_verification() (--verify)
    ├── physics_engine/                        # [RUST/WASM PROVIDER + NATIVE TESTS] Kuramoto и контрольные REF64 орбиты
    │   ├── Cargo.toml                         # crate-type = ["cdylib"]
    │   └── src/
    │       ├── lib.rs                         # Raw C ABI v1, импорт состояния, метрики и native-тесты
    │       ├── memory.rs                      # SceneBufferHeader (#[repr(C)], 24 байта), SceneStateSoA (MAX_CAPACITY=1024)
    │       ├── gravity.rs                     # step_symplectic_verlet_and_kuramoto(), compute_reference_total_energy()
    │       ├── breach_math.rs                 # compute_refraction_offset_with_stress(), compute_refraction_offset()
    │       ├── ouroboros.rs                   # Optional ABI v1: до 3072 объёмных точек, нормали и материалы
    │       └── prng.rs                        # DeterministicPrng, verify_golden_vectors(), compute_quantized_state_digest()
    ├── frontend/                              # [РЕАЛИЗОВАНО В RUNTIME] Клиентское приложение Astro + TypeScript
    │   ├── astro.config.mjs                   # site: 'https://dubnovalexey.github.io', base: '/universe' (prod) / '/' (dev)
    │   ├── package.json                       # Скрипты: dev, typecheck, test (Vite SSR runner), build, preview
    │   ├── scripts/
    │   │   ├── build-wasm.mjs                 # Сборка реального модуля и проверка ABI
    │   │   ├── verify-wasm-runtime.mjs        # Проверки реального WASM
    │   │   ├── verify-graphics-runtime.mjs    # Реальные GPU-классы с controlled WebGPU mock: async, fallback, cache и cleanup
    │   │   ├── verify-pages-artifact.mjs      # Статическая проверка Pages-артефакта
    │   │   └── verify-repository.mjs          # Отслеживаемые исходники и npm entry scripts
    │   ├── public/
    │   │   ├── audio/cosmic_ambient.mp3       # Мастер-трек космического эмбиента (старт с 2.6 с)
    │   │   ├── audio/AUDIO_LICENSE.md         # Документация использования аудиопотока
    │   │   ├── fonts/LICENSE.txt             # Исходные лицензии OFL локальных шрифтов Noto
    │   │   ├── wasm/physics_engine.wasm       # Raw WASM ABI v1 без imports; default async, ?wasm=0 принуждает TS
    │   │   └── favicon.png                    # Растровая иконка вкладки
    │   └── src/
    │       ├── assets/fonts/                 # Локальные наборы Noto: общие Vite URL для CSS и preload
    │       ├── pages/index.astro              # Точка входа HTML (<title>Alexey Dubnov</title>), холст, баннер звука, док
    │       ├── styles/
    │       │   ├── universe.css              # Точка входа: упорядоченные импорты семи модулей 01–07
    │       │   ├── 01-tokens-and-fonts.css    # Локальные шрифты, палитра, reset и космическое полотно
    │       │   ├── 02-hud-and-3d-buttons.css  # HUD, доки, объёмные кнопки, тени и аудиобаннер
    │       │   ├── 03-glyph-reels.css         # Доступный канон и наборные символьные барабаны
    │       │   ├── 04-waterfall-cascades.css  # Каскады, телеметрия, таблицы и терминал
    │       │   ├── 05-finale-card.css         # Финальная визитка, квантовая строка и действия
    │       │   ├── 06-responsive.css         # Адаптивные диапазоны и уменьшение движения
    │       │   └── 07-explanations.css       # Пять терминов, центральный док, окно и формулы
    │       ├── core/
    │       │   ├── contracts.ts               # Канонические типы PhaseId, SingularityAct, WorldEntity, TelemetrySnapshot
    │       │   ├── explainerTopics.ts         # Неизменяемые 15 учебных тем, формулы и ссылки на исходники
    │       │   ├── explainerTranslations.ts   # Полный каталог EN/HE/ES, подписи формул и источников
    │       │   ├── locale.ts                 # RU/EN/HE/ES, словари UI/событий и подписки языка
    │       │   ├── visualSignals.ts           # Неизменяемый снимок фазы, аудио и stress на кадр
    │       │   ├── frameDiagnostics.ts        # Опциональные реальные интервалы RAF/CPU и диагностический DPR
    │       │   ├── glyphGrammar.ts            # Фазовые пулы code point, проверка глифов и fallback
    │       │   ├── glyphHover.ts              # Барабанные ячейки статических строк и действий финальной визитки
    │       │   ├── glyphFontAssets.json       # Файлы шрифтов, SHA-256, покрытие Unicode и источники лицензий
    │       │   ├── buttonSolid.ts             # Шесть CSS-граней, layout-размеры, доступный канон и обновление подписи
    │       │   ├── buttonMotion.ts            # Полные обороты вокруг собственной оси, выравнивание и плавный разгон
    │       │   ├── finaleComposition.ts       # Общая геометрия фотонного кольца и безопасного подъёма визитки
    │       │   ├── ouroborosModel.ts          # Детерминированный TS fallback геометрии и контракт восьми f32
    │       │   ├── ouroborosEpisode.ts        # Сборка при подъёме визитки и распыление в первой фазе
    │       │   ├── ouroborosFieldMorph.ts     # Передача экранных частиц в объёмную форму без изменения физики
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
    │       │   ├── wasmBridge.ts              # WasmPhysicsBridge (ABI v1, state adoption/mirrors, REF64 ΔE/E₀, непрерывный TS fallback)
    │       │   ├── simulationWorker.ts        # NexusGraphEngine (Прим MST, Габриэль, Мюррей, кластеризация, BFS-28)
    │       │   ├── pythonSocketClient.ts      # PythonSocketClient (подготовленный клиент и валидатор пакетов 'UNVS')
    │       │   └── cipherOdometerEngine.ts    # CipherOdometerEngine (CANONICAL_FINALE_LINES, 3D-барабаны одометра)
    │       ├── engine/
    │       │   ├── pipeline.ts                # RenderPipeline (High-DPI Canvas2D, probeWebGpuSupport, Blue-Noise 64x64)
    │       │   ├── renderer.ts                # Публичный фасад: CSS, именованные/default-экспорты и автозапуск
    │       │   ├── UniverseRenderer.ts        # Симуляция, основной RAF сцены и порядок Canvas-проходов в renderFrame()
    │       │   ├── bootstrap.ts               # Активный экземпляр, getUniverseRenderer(), createUniverseResizeHandler(), bootstrapUniverseV2()
    │       │   ├── backgroundFields.ts        # BackgroundFields: reset()/step(), облака, сигналы и сеть Z4
    │       │   ├── math/noise2d.ts            # clamp(), lerp(), hash2D(), valueNoise2D(), fbm2D()
    │       │   ├── hud/hudDomOrchestrator.ts   # Канонический текст, syncHudDomWithState(), bindHudDockLayout()
    │       │   ├── hud/localeController.ts     # mountLocaleControls(), сохранённые источники, выбранный front / EN back
    │       │   ├── hud/keyboardShortcuts.ts    # bindUniverseKeyboardShortcuts(): клавиши управления и освобождение обработчика
    │       │   ├── passes/
    │       │   │   ├── cosmosPass.ts          # Световое эхо, пылевые облака, сигналы и когнитивные полушария
    │       │   │   ├── nexusPass.ts           # Рёбра графа, импульсы и частицы разных эшелонов
    │       │   │   ├── breachPass.ts          # Мембрана BREACH, рефракция и глубинная сеть Z4
    │       │   │   ├── singularityPass.ts     # Корона, Точка Нуля и начальный Canvas-одометр
    │       │   │   └── nodeCallout.ts         # Общая отрисовка выносок узлов
    │       │   ├── ouroboros/
    │       │   │   ├── OuroborosEffect.ts     # Общий кадр, выбор WebGPU/Canvas, диагностика и освобождение
    │       │   │   ├── gpuRenderer.ts         # Компиляция, pixel self-test, depth/light passes и GPU lifecycle
    │       │   │   ├── canvasRenderer.ts      # Резервная проекция тех же точек, атлас света и орбитальные нити
    │       │   │   └── types.ts               # Контракт геометрии, кадра, viewport и GPU-диагностики
    │       │   └── webgpu/*.wgsl              # Исполняемый ouroboros.wgsl; illusion/truth/breach остаются спецификациями
    │       ├── layers/
    │       │   ├── Layer2_Metrics.tsx         # DOM/SVG-фабрика, общий Starfall каскадов 2–5 и LAYER_02
    │       │   ├── Layer3_Topology.tsx        # mountLayer3Topology() — инспектор графа NEXUS (LAYER_03, EST. BFS)
    │       │   ├── Layer4_Terminal.tsx        # mountLayer4Terminal() — полная таблица всех 8 модулей и логи (LAYER_04)
    │       │   ├── Layer5_CipherFinale.tsx    # FinaleCardDomAnimator, mountLayer5CipherFinale() — визитка и пять терминов
    │       │   ├── ExplanationDialog.ts      # mountExplanationDialog(): немодальная панель, клавиатура и фокус
    │       │   ├── explanationTrail.ts       # Пылевая сборка левой плоскости, временный Canvas 2D и RAF
    │       │   ├── explanationTextReveal.ts  # Сборка вводных абзацев в физическом LTR-порядке, включая иврит
    │       │   └── explanationButtonMotion.ts # Внутренние призмы: покачивание, отдельные тени и блики
    │       ├── utils/audioSync.ts             # AudioSyncEngine (Web Audio API, iOS audioSession, снятие слушателей с 1-го тапа)
    │       └── tests/
    │           ├── parityAndSeams.test.ts     # runUniverseVerificationSuite() — Регрессионные проверки ядра и DOM lifecycle
    │           ├── backgroundFields.test.ts   # Детерминированные поля, порядок PRNG, продвижение и повторный reset
    │           ├── keyboardShortcuts.test.ts  # Клавиатурный выбор фаз, управление слоями и освобождение обработчика
    │           ├── explanationDialog.test.ts # Каталог, термины, режимы панели, непрерывность сцены, фокус и очистка
    │           ├── waterfallLifecycle.test.ts # Общий кадр, кеш, одинаковые настройки каскадов2–5 и неподвижный текст
    │           ├── locale.test.ts             # Полнота четырёх языков, подписи формул/источников, грани и RTL
    │           ├── rendererLifecycle.test.ts  # Пауза и скрытие во время restart, нулевой шаг и страничная текстура
    │           ├── frameDiagnostics.test.ts   # Длинные кадры, скрытие без RAF и границы диагностического DPR
    │           ├── buttonMotion.test.ts       # Полные обороты, индивидуальные тени, взаимодействия и очистка
    │           ├── buttonSolid.test.ts        # Шесть граней, доступные подписи, размеры и восстановление DOM
    │           ├── finaleComposition.test.ts # Размещение визитки, зазор над ореолом и плавный подъём
    │           ├── visualSignals.test.ts     # Кадровый шаг, Unicode/кириллица, доступность и прокрутка
    │           ├── glyphFontBudget.test.ts   # Бюджет растровых проверок шрифтов и полное восстановление словарей
    │           ├── ouroborosModel.test.ts     # Детерминизм 3D-геометрии, материалы, нормали и границы
    │           ├── ouroborosEpisode.test.ts   # Время эпизода, размещение, пять фаз и reduced motion
    │           ├── ouroborosFieldMorph.test.ts # Передача экранных источников, интерполяция и защита буфера
    │           └── fixtures/nexusParity24.json # Общие входы и полный результат TS/Python, 40 рёбер
    ├── docs/
    │   ├── ARCHITECTURE.md                    # Краткий архитектурный обзор
    │   ├── DEMO_SCRIPT.md                     # Сценарий знакомства со сценой и инженерными слоями
    │   ├── ADR-001-POLYGLOT-RUNTIME.md         # Решение о ролях вычислительных модулей
    │   ├── VISUAL_AUDIO_DIRECTION.md          # Фазы, художественные мотивы, символы и звук
    │   └── study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md
    ├── package.json                           # Корневой манифест монорепозитория (workspaces: ["frontend"])
    ├── README.md                              # Двуязычная публичная витрина проекта (EN + RU)
    └── UNIVERSE_BIBLE.md                      # Справочник модулей, памяти и вычислительных контрактов

---

## 4. АРХИТЕКТУРА И ГРАНИЦЫ РЕАЛЬНОГО ИСПОЛНЕНИЯ (RUNTIME MAP)

| Подсистема | Файл и класс | Статус на GitHub Pages | Что именно делает в реальности |
| :--- | :--- | :---: | :--- |
| **Оболочка Astro** | `frontend/src/pages/index.astro` | `[РЕАЛИЗОВАНО В RUNTIME]` | Отдаёт статический HTML/CSS каркас с `base: '/universe'` в production и `'/'` в dev. |
| **Хранилище и часы** | `frontend/src/store/universeState.ts` (`UniverseStore`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Управляет временем сценария, 5 фазами, 4 подактами финала и `SceneBufferSoA`. Выбор фазы переводит часы к её началу, а restart обнуляет их. |
| **Рендерер Canvas 2D** | `frontend/src/engine/UniverseRenderer.ts`, `engine/passes/` | `[РЕАЛИЗОВАНО В RUNTIME]` | Активный графический движок (`Canvas2D-HighDPI`), рисующий все 5 фаз, дизеринг `Blue-Noise`, линзу `BREACH` и эшелон `Z4`; публичная точка подключения — `engine/renderer.ts`. |
| **Объёмный проход WebGPU** | `engine/ouroboros/`, `engine/webgpu/ouroboros.wgsl` | `[WEBGPU / CANVAS FALLBACK]` | Отдельный прозрачный холст рисует перспективные ядра с depth buffer и мягкий свет. `READY` появляется после компиляции, offscreen draw/readback и первой проверенной отправки. Ошибка устройства или инициализации выбирает Canvas. Основные пять фаз остаются Canvas 2D. |
| **Физический provider** | `frontend/src/bridge/wasmBridge.ts` (`WasmPhysicsBridge`) | `[RUST/WASM / TS FALLBACK]` | Default async raw ABI v1; после валидного шага — `WASM_ACTIVE`, при `?wasm=0` или отказе — TS. Kuramoto влияет на видимые цели; отдельные `REF64` орбиты дают энергию. CI собирает и проверяет реальный WASM до Astro. |
| **Графовый движок NEXUS** | `frontend/src/bridge/simulationWorker.ts` (`NexusGraphEngine`) | `[РЕЗЕРВ / FALLBACK]` | Вызывается синхронно из `01_void.ts` каждые `0.12 с` симуляционного времени. Статус в реестре — `FALLBACK`, метка в UI — `[ts/graph_engine]`. |
| **Нативные DOM/SVG слои** | `frontend/src/layers/Layer2..Layer5.tsx` | `[РЕАЛИЗОВАНО В RUNTIME]` | Собственная легковесная фабрика `React.createElement` (без пакета React). Монтирует DOM один раз и обновляет числа через `data-bind`; контуры и одометр используют общий кадр, а квантовая строка — ритм `18–26 Гц`. |
| **Путеводитель** | `core/explainerTopics.ts`, `core/explainerTranslations.ts`, `layers/ExplanationDialog.ts`, `layers/explanationTrail.ts`, `layers/explanationTextReveal.ts`, `layers/explanationButtonMotion.ts`, `styles/07-explanations.css` | `[РЕАЛИЗОВАНО В RUNTIME]` | 15 тем на RU/EN/HE/ES, немодальная панель, формулы, исходники, пылевая сборка плоскости, вводный текст, внутренние призмы и общий Starfall; сцена продолжает работу. |
| **Языки UI** | `core/locale.ts`, `engine/hud/localeController.ts` | `[РЕАЛИЗОВАНО В RUNTIME]` | Полный перевод интерфейса и терминала, исходный RU, выбранный язык спереди и EN сзади у всех вращающихся элементов. |
| **Звуковой движок** | `frontend/src/utils/audioSync.ts` (`AudioSyncEngine`) | `[РЕАЛИЗОВАНО В RUNTIME]` | Запрашивает воспроизведение при загрузке; при запрете автозапуска использует пользовательский жест. Спектральные огибающие имеют временно-независимое сглаживание. `audioSession.type = 'playback'` задаётся при наличии API, но поведение зависит от платформы. |
| **Ядро Python 3** | `backend/main.py`, `backend/core/*.py` | `[ОФЛАЙН-ИНСТРУМЕНТ / CI VERIFIER]` | Реализует локальный HTTP/Binary сервер (`/api/health`, `/api/topology`, `/api/frame.bin`), CLI-верификатор (`--verify`) и проверки `unittest`. На статическом GitHub Pages Python-сервер не запущен (`CLIENT_ONLY`), а `PythonSocketClient` служит подготовленным и протестированным валидатором бинарных пакетов `'UNVS'`. |
| **Крейт Rust** | `physics_engine/src/*.rs` | `[WASM PROVIDER / NATIVE TESTS]` | Raw ABI v1, Kuramoto, контрольный Velocity Verlet и `breach_math`; optional ABI объёмной геометрии Уробороса; native-тесты и интеграции реального WASM. |

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
* `vel: Float32Array(3072)` — вектор скорости `[vx, vy, vz]`.
* `depthZ: Float32Array(1024)` — координата глубины (`0.10 .. 1.60`), определяющая принадлежность к эшелонам `Z0..Z3`.
* `energy: Float32Array(1024)` — нормированная светимость / заряд узла (`0.0 .. 10.0`).
* `flags: Uint32Array(1024)` — упакованный номер кластера `(clusterId << 4)` и бит синаптической вспышки.

Финальные координаты публикуются в `pos`. Заголовок соответствует schema version 2; память provider использует raw ABI v1.

### 5.3. Полная 8-польная защита `NaN / Infinity Guard`
В методе `SceneBufferSoA.syncEntityFromParticle()` все **8 числовых параметров** (`x, y, z, vx, vy, vz, depthZ, energy`) проходят индивидуальную проверку `Number.isFinite(val)`. Каждое нечисловое значение заменяется безопасным конечным значением (`0` или `1.0` для `depthZ`) и увеличивает счётчик `this.nanGuardTriggeredCount` ровно на число обнаруженных повреждённых полей.

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
       • При первом показе: githubCardAssemblyProgress = clamp((el - 14.05) / 4.5, 0, 1).
         В следующих циклах и при повторном входе собранная карточка сохраняет прогресс 1.0.
       • Из центральной Точки Нуля разворачивается DOM-визитка DUBNOV ALEXEY (Layer5_CipherFinale.tsx),
         а частицы фона мягко расходятся в широкий космический ореол (ringFrac = 0.27..0.48).

    [el >= 29.0 с (108 с)] -> ПЕРЕХОД НА НОВЫЙ КРУГ (RESTART_COLLAPSE -> 01_VOID)
       • Если включён AUTO: ON и курсор мыши не наведён на визитку (!isFinaleCardHovered),
         космос за 1.45 с перезапускается в фазу 01_VOID (cycleCount += 1).
       • Так как finaleReachedOnce === true, визитка НЕ закрывается, а переходит в
         полупрозрачный фоновый режим (.ambient-loop, opacity: 0.60) и ярко проявляется
         до 0.98 при наведении мыши на любом этапе следующих циклов!

---

## 7. МАТЕМАТИЧЕСКИЕ МОДЕЛИ И АЛГОРИТМЫ (ПО ФАКТИЧЕСКОМУ КОДУ)

### 7.1. Детерминированный ГПСЧ `Mulberry32`, индексный `fmix32` и `FNV-1a State Digest`
* **Файлы:** `frontend/src/core/prng.ts`, `physics_engine/src/prng.rs`, `backend/core/prng.py`.
* **Потоковый генератор `nextU32()` (Mulberry32):**
    1. `state = (state + 0x6D2B79F5) >>> 0`
    2. `z = Math.imul(state ^ (state >>> 15), state | 1) >>> 0`
    3. `z = (z ^ (z + Math.imul(z ^ (z >>> 7), z | 61))) >>> 0`
    4. `return (z ^ (z >>> 14)) >>> 0`
* **Индексная хеш-функция `hashU32(seed, index)`:** применяет финализатор MurmurHash3 `fmix32` к `seed XOR imul(index, 0x9E3779B9)`. Сдвиги `16/13/16` и множители `0x85EBCA6B`, `0xC2B2AE35` задают 32-битное смешивание. Историческое имя `SplitMix32` в комментариях неточно; это не 64-битный Stafford Mix13. Один индекс даёт одно воспроизводимое значение без расходования состояния потока.
* **Эталонный вектор при `GOLDEN_SEED = 104729`:**
  `GOLDEN_U32_VECTORS = [325253669, 3481002091, 881690241, 2630884050]`.
* **Квантование и свертка `computeQuantizedStateDigest`:**
  Для каждой 4-й частицы (`stride = 4`) координаты и скорости умножаются на `10.0`, энергия — на `100.0`, округляются по единому правилу `quantizeHalfUp(v) = Math.floor(v + 0.5) | 0` и сворачиваются в 32-битный хеш `FNV-1a` (`offset_basis = 0x811C9DC5`, `prime = 0x01000193`).

### 7.2. Симплектический интегратор `Velocity Verlet`, истинный дрейф энергии и модель Курамото
* **Файлы:** `physics_engine/src/gravity.rs`, `frontend/src/bridge/wasmBridge.ts`.
* **Вариант связи по среднему углу по мотивам Курамото:** для всех активных частиц вычисляется $\psi = \text{atan2}(\sum \sin\theta_i, \sum \cos\theta_i)$, затем $\dot\theta_i=\omega_i+K\sin(\psi-\theta_i)$. Множитель $r$ в связи отсутствует; параметр порядка $r(t) = \frac{1}{N}\sqrt{(\sum \cos\theta_i)^2 + (\sum \sin\theta_i)^2} \in [0, 1]$ измеряется отдельно.
* **Видимый потребитель фаз:** provider выполняется до расчёта целей; фазы Курамото управляют дыханием частиц и тройной геометрией позднего GENESIS. Итоговые архетипы пяти фаз сохраняются. Это ограниченный физический вклад в художественную сцену, а не полная N-body модель.
* **Схема Velocity Verlet и дрейф $\Delta E / E_0$:** отдельные 64 контрольные орбиты `REF64` интегрируются в статическом потенциале Пламмера ($\varepsilon^2 = 64.0$, значит $\varepsilon=8.0$; $GM = 4900.0$). Положительный `safeDt <= 0.05` разбивается на `ceil(safeDt / 0.004)` равных подшагов; `dt <= 0` и count `0` не продвигают время. Начальная энергия $E_0$ фиксируется при инициализации, а дрейф $|E(t)-E_0|/|E_0|$ относится только к контрольному ансамблю. Точность энергии проверяется численно и не является обещанием вечного сохранения.
* **Общий ABI-контракт:** raw v1 без imports, `f64` для шага/накопленного времени/метрик, `f32[1024]` для фаз/частот, `f32[3072]` для позиций/скоростей (первые 64 орбиты). `step_verlet_nbody` возвращает статус `1`/`0`, не digest. При поздней загрузке WASM получает актуальные TS-массивы, baseline и время; reset/seed/count переинициализируют provider. После валидного native-шага TS-зеркала обновляются целиком; trap/ошибка результата возвращают TS к последнему принятому состоянию. Отказ `commit_uploaded_state` требует discard provider со стороны host.

### 7.3. Эвристическая модель графа `NEXUS` и паритет TS <-> Python (`simulationWorker.ts`, `backend/core/graph_logic.py`)
* Реализации TypeScript и Python используют общее правило `floor(value * scale + 0.5) / scale` для двух/трёх десятичных знаков; отрицательные ties идут к `+∞`. Fixture6 и общий `nexusParity24.json` содержат воспроизводимые эталонные данные: transport RNG потребляет по шесть значений на узел, затем точно сравниваются 40 рёбер, классы, контрольные точки, LUT, радиусы Мюррея, 24 степени и семь метрик. Эталонные входы и результаты находятся в общей JSON-fixture; область проверки задаётся этими входами.
* На полной рабочей сцене ($N > 260$) браузерный TS-движок включает прореживание `stride = 2`; реальный Worker ещё не подключён. Выигрыш производительности требует измерения.
* Диаметр `diameterHops` и средняя длина пути `avgPathLength` вычисляются обходом в ширину (`BFS`) с шагом выборки стартовых вершин `sampleStride = max(1, floor(N / 28))` (здесь $N$ — число активных узлов после прореживания; при $N < 56$ шаг равен 1 и обход полный, при $N \ge 56$ стартовые вершины выбираются с шагом не менее 2). Метка `BFS-28` обозначает делитель шага, а не жёсткий предел в 28 стартов. Выборка на 24 узлах не проверяет sampling, лимит 36 хабов и прореживание.

### 7.4. Оптическое преломление `BREACH LENS` (`stressState.ts`, `breach_math.rs`, `stress_solver.py`)
* На кольце вокруг деформированной границы линзы ($d = \text{dist} / (R \cdot \text{warp})$, полуширина $w = 0.24$, нормированное расстояние от кромки $u = |d - 1.0| / w$) действует компактно-поддерживаемый колокол 4-й степени:
  $$g(u) = (1 - u^2)^2 \quad \text{при } u < 1, \qquad g(u) = 0 \quad \text{при } u \ge 1$$
* На границе кольца ($u = 1$) функция $g(1) = 0$ и её первая производная $g'(1) = 0$ ($C^1$-гладкое сопряжение без оптического шва, $C^\infty$ внутри открытого интервала $u \in (0, 1)$). Все три реализации (TS, Python, Rust) содержат идентичную формулу `warp`. В `getTruthRevealFactorAt` передаётся текущее `simulationTimeSec`, поэтому внутренняя маска следует тому же движущемуся контуру; переход фиксированной точки через кромку покрыт регрессией.

* Существующий `evaluate_lens_refraction(px, py, lensX, lensY, radius, reveal)` возвращает скалярную длину смещения при stress `0.25` и time `0`. Он включён в обязательные build/host exports и типизирован в TS. Сравнение с длиной TS-вектора использует f32-нормализованные входы и численный допуск. Контракт скалярный: векторное преломление и dispersion в Canvas рассчитываются TypeScript.

---

## 8. РЕНДЕРИНГ, ЗВУК И КНИГА УЧЁТА РЕСУРСОВ (`ResourceLedger`)

### 8.1. Графический конвейер и дизеринг `Blue-Noise`
* `RenderPipeline` (`frontend/src/engine/pipeline.ts`) создаёт 2D-контекст с ограничением `dpr = min(maxDpr, window.devicePixelRatio)` из `QualityGovernor` (`2.0` для HIGH, `1.5` для MEDIUM, `1.25` для LOW) и генерирует тайл дизеринга `64×64` (`buildBlueNoiseDitherPattern`).
* `syncQualityProfile()` применяет изменившийся DPR на общем кадре без ожидания resize; неизменный профиль не изменяет размеры холста.
* `UniverseRenderer` из `frontend/src/engine/UniverseRenderer.ts` сохраняет основной RAF сцены и определяет порядок проходов в `renderFrame()`. `passes/cosmosPass.ts`, `nexusPass.ts`, `breachPass.ts`, `singularityPass.ts` и `nodeCallout.ts` выполняют отрисовку без собственных кадровых циклов.
* `BackgroundFields` (`engine/backgroundFields.ts`) хранит процедурное состояние и предоставляет `reset(seed)`/`step()`. Облака, сигналы и узлы создаются одним PRNG в порядке `48 → 8 → 136 → соседи и изгибы`, а проходы читают `clouds`, `signals` и `nodes`. Шумовые функции находятся в `engine/math/noise2d.ts`.
* `engine/renderer.ts` подключает CSS и сохраняет публичные экспорты с автозапуском; `engine/bootstrap.ts` владеет активным экземпляром и привязкой управления. DOM-функции HUD находятся в `engine/hud/hudDomOrchestrator.ts`.

### 8.2. Аудио-конвейер и мгновенное снятие слушателей (`frontend/src/utils/audioSync.ts`)
* Файл: `frontend/public/audio/cosmic_ambient.mp3` (`~16.46 МБ`).
* `SOUNDTRACK_CREDIT` хранит название Photosynthesis, исполнителя Carbon Based Lifeforms и альбом World of Sleepers. Общая тема путеводителя показывает их в закрытом по умолчанию блоке «О музыке» с переводимыми подписями полей; условия использования остаются в `AUDIO_LICENSE.md`.
* При старте вызывается `configureIosAudioSession()` (`navigator.audioSession.type = 'playback'`).
* На мобильных user agent (`iPhone`, `iPad`, `iPod`, `Android`, `Mobile`) MP3 воспроизводится через `<audio>` без `MediaElementAudioSourceNode` и `AnalyserNode`; модуляцию ведёт синхронная LFO-огибающая. Этот режим сохраняет звук при ограничениях мобильного аудиотракта. На остальных устройствах при доступности используется анализ звука.
* При старте `trySilentAutoplayWithoutWarning()` сразу запрашивает воспроизведение `<audio>` без создания `AudioContext`. Браузер может отклонить запрос по своей autoplay policy; тогда доступен запуск первым жестом пользователя. Наличие или отсутствие сообщения в консоли зависит от браузера.
* Как только промис `audioEl.play()` разрешается или срабатывает событие `'playing'`, немедленно вызывается `this.removeUnlockListenersFn?.()`, отключающая все глобальные слушатели разблокировки.

### 8.3. Книга учёта ресурсов `ResourceLedger` (`frontend/src/core/resourceLedger.ts`)
* Отслеживает 5 категорий ресурсов (`buffers`, `textures`, `audioNodes`, `listeners`, `workers`) и 2 диагностических счётчика (`underflowCount` при попытке освободить больше ресурсов, чем было выделено, и `disposerErrors` при исключениях внутри колбэков очистки).
* Метод `disposeCycleResources()` проверяет все 5 категорий и отсутствие `underflowCount` / `disposerErrors`.


### 8.4. Общие визуальные сигналы и символы

`styles/universe.css` сохраняет фиксированный порядок семи модулей `01–07`; `07-explanations.css` добавляет термины визитки, центральный док, окно и формулы с отдельной адаптацией. `CANONICAL_FINALE_LINES[3]` содержит `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER`: пять нативных кнопок открывают темы `prng`, `kuramoto`, `fbm`, `symplectic`, `plummer`. За ними в `[4]` идёт обычная текстовая строка `ASTRO · TYPESCRIPT/JAVASCRIPT · RUST/WASM · PYTHON · JSX/DOM · CANVAS2D · WEBGPU/WGSL · WEB AUDIO · HTML/CSS`. Строки статично переносятся по доступной ширине и сохраняют канонический порядок.

Кнопки `btn-explanation-overview` и `btn-language` находятся внизу по центру и используют общие объёмные тела. `bootstrap.ts` монтирует одну немодальную панель из `layers/ExplanationDialog.ts`. На desktop она расположена слева под brand-card, симметрично правой телеметрии. До `920px` путеводитель и коллекция инспекторов ограничены измеренными `--hud-top-inset` и `--hud-bottom-inset`, оставляя верхнюю плашку и нижний пульт доступными. Кнопки центрального дока сохраняют минимум `60px` до общего масштаба `0.75`. Каталог `core/explainerTopics.ts` и переводы `core/explainerTranslations.ts` содержат все 15 тем, технические абзацы и подписи формул/источников на RU/EN/HE/ES. MathML и пути репозитория сохраняются; текстовая формула остаётся доступна.

`core/locale.ts` ведёт язык, словари UI и терминальных событий. Исходный язык — RU, сохранённый выбор восстанавливается при загрузке. `mountLocaleControls()` из `engine/hud/localeController.ts` подключается после тел кнопок: цикл RU → EN → HE → ES меняет переднюю грань всех вращающихся элементов на выбранный язык, заднюю — на EN; при EN обе английские. Имена автора, технологий и математические обозначения сохраняются. Источники текстовых узлов/атрибутов кешируются; HUD сохраняет DOM и привязки. Подписка визитки завершает декоративные сеансы и заново строит её локализованное представление, обновляя канон и доступные подписи также на паузе. Смена языка не меняет симуляцию. `setHudText` переводит динамические подписи и события; поздняя JSX-сборка учитывает текущий язык. RTL для иврита сохраняет физическую компоновку. Верхняя плашка содержит три строки: кодовое имя, название фазы, подзаголовок. Кнопки фаз сохраняют числовой код и название на передней и задней гранях; длинные переводы допускают перенос.

Нативный `<dialog>` открывается через `show()` как немодальная панель. Сцена, фазы, музыка и другие кнопки продолжают работать; посетитель свободно переводит фокус между панелью и сценой. Клавиатурный guard действует только при фокусе внутри панели, где Esc закрывает её. Панель сохраняет управление паузой и прокруткой за посетителем. При снятии страницы освобождаются обработчики и окно. Внешний выбор модели обновляет содержание и повторяет пылевую сборку; внутренняя навигация меняет только содержание.

`layers/explanationTrail.ts` собирает неподвижную левую плоскость из `224` декоративных пылинок на временном Canvas 2D: `176` образуют периметр, `48` заполняют плоскость. `18` частиц начинают путь у нажатого элемента, остальные — в окружающем поле. Сборка занимает `3000 мс`; между `3000` и `4000 мс` нативная панель проявляется с quintic smootherstep, поворот Y затухает примерно от `−14°` к `0°`, масштаб меняется от `0.985` к `1`. Пыль затухает между `3300` и `4200 мс`, затем временный эффект освобождается. Кадр, холст, слушатели и CSS-параметры также освобождаются при закрытии, повторном открытии, resize, скрытии или dispose. Reduced motion пропускает эффект, внутренняя навигация сохраняет открытое состояние. Оформление остаётся в `07-explanations.css`; CSS-модулей семь.

Контуры и падающие символы используют каскад `5` системы Starfall из `layers/Layer2_Metrics.tsx` на общем кадре с настройками правых панелей: задержка `0.5 с`, интервалы `0.58–1.5 с`, исходная непрозрачность `0.86` и та же физика падения. `ExplanationDialog.ts` привязывает его при открытии и освобождает при закрытии. Отдельный счётчик сохраняет последовательности каскадов `2–4`. Слоты текста во всех панелях сохраняют `transform: none` и цвет; мягко меняется только музыкальное свечение. Левый SVG задаёт `viewBox="0 0 width height"` в физических CSS-пикселях. Чтение размера при открытии и `ResizeObserver` открытой панели передают геометрию в `resizeCascadeContour()`; значения кешируются для общего кадра. Закрытие отключает observer. Правые контуры сохраняют координаты `418×280`.

`layers/explanationTextReveal.ts` после внешнего открытия ждёт `4000 мс`, выполняет упорядоченную сборку за `1000 мс`, затем за `200 мс` плавно передаёт видимость от вписанного слоя нативному тексту через C²-огибающую. Задержка и сборка измеряются монотонными миллисекундами `performance.now()`, согласованно с пылью; ограниченный `frameDtSec` физики не растягивает их при низком FPS. Обрабатываются до `240` графем каждого абзаца, сверху вниз и физически слева направо, включая иврит; оставшийся хвост скрыт до нативной передачи видимости. Нативная мера сохраняет переносы, bidi и диакритику; доступный канон остаётся полным, декоративные глифы вписываются в неподвижные окна и поворачиваются вокруг Y. Сеанс на общем кадре освобождается при завершении, смене содержания, закрытии, resize, скрытии или смене шрифта. На паузе при открытии и в reduced motion канон виден сразу; пауза во время сборки восстанавливает полный текст. Панель занимает доступную левую ширину и высоту; прокрутка нужна только при избытке содержания.

`layers/explanationButtonMotion.ts` управляет `18` внутренними призмами на одной подписке общего кадра. Глубина равна `clamp(12px, height × 0.58, 26px)`, амплитуда покачивания ограничена `±10°`, наведение и фокус плавно выравнивают грань. Отдельные тени и медленные блики используют детерминированные индексные сдвиги и непрерывные активные часы; новые RAF и таймеры для кнопок не создаются. Передняя подпись показывает выбранный язык, задняя — EN. Два режима занимают по половине ширины и получают мягкий 20-секундный перелив с акцентом выбора. Под ними общий каскад обновляет волновой SVG-разделитель шириной `2/3` панели. Заголовок и подзаголовки разделов, включая источники, центрированы; подписи граней имеют запас `2px` для полного начертания. Внешний диалог имеет `overflow: hidden`; одна внутренняя `.explanation-panel` прокручивается с высотой `fieldHeight − 56px`, внешними полями `28px 30px` и padding `0 4px 4px`. Это даёт минимум `34px` по бокам текста и `28px` сверху и снизу области чтения. Контур и символы остаются снаружи scroller; header закреплён на `top: 0` внутри безопасной области, а до `920px` при высоте до `520px` прокручивается с текстом. Ширину сохраняет `scrollbar-gutter: stable`.

Правые панели используют пропорциональные зазоры `gx = width × 23.5 / 418 + 8px`, `gy = height × 16.3 / 280 + 6px`. Grid-строки `0.058214fr / 0.883572fr / 0.058214fr` и padding `6.7906px` сохраняют внешний размер. На ширине `921–1280px` веса METRICS / TOPOLOGY / TERMINAL равны `0.97 / 0.92 / 1.11`; метки переносятся, gap топологии равен `0.2rem`, журнал имеет минимум одну полную строку (`1lh`) и ellipsis. Все восемь модулей остаются в реестре. До `920px` средняя grid-строка использует `min-content`, панели имеют высоту по содержимому и слоты `flex: 0 0 auto`; несколько открытых панелей прокручиваются общей коллекцией.

Renderer публикует неизменяемый `VisualSignalSnapshot`: время, нормализованный `frameDtSec`, фаза, пауза/reduced motion, seed, аудио, Kuramoto и stress. Шаг ограничен `0..0.05 с`, при pause/hidden равен нулю. Водопад, символы и DOM-визитка используют общий кадр.

`glyphGrammar.ts` хранит фазовые семейства полных Unicode code point и фильтрует недоступные начертания. `glyphHover.ts` управляет прокруткой отдельных глифов в устойчивых ячейках статических строк и действий финальной визитки, восстановлением точного текста и доступностью. В угловых меню движутся цельные плашки с неизменными надписями. Числовая телеметрия сохраняет реальные значения.

Фильтр начертаний использует общий бюджет не более четырёх Canvas raster readback за кадр, включая эталоны отсутствующего знака. Непроверенные кандидаты обрабатываются в следующих общих кадрах; до подтверждения символов действует безопасный базовый пул. Готовые пулы кешируются, а загрузка шрифта обновляет их поколение.

`glyphFontAssets.json` описывает локальные наборы Noto из `src/assets/fonts/`: файлы, хеши, диапазоны Unicode и происхождение. Vite создаёт общие URL для CSS и предварительной загрузки; лицензии OFL публикуются из `public/fonts/LICENSE.txt`. Шрифты содержат выбранные египетские, рунические, числовые знаки майя, математические и декоративные символы; при недоступном начертании остаётся базовый fallback.

`buttonSolid.ts` монтирует внутри неподвижного элемента замкнутый CSS-кубоид из шести непрозрачных граней. Передняя грань имеет читаемый канон, задняя повторяет его или показывает отдельный `data-solid-back-label`; зеркального отражения нет. Задняя копия декоративна: она не дублирует идентификаторы, DOM-привязки и доступное имя. Скрытый измеритель в обычном потоке сохраняет размеры host, учитывая обе подписи. `ResizeObserver` следит за layout border box; обновление размеров учитывает только изменившиеся значения. Тело помечено `aria-hidden`, а доступный канон хранится отдельно или в native `aria-label`. `setSolidButtonLabel()` обновляет канон и измеритель, сохраняя геометрию тела и заданную заднюю подпись. Атрибут `data-button-solid="1"` обозначает смонтированную геометрию; информационные строки имеют вид `status` и сохраняют семантику текста и заголовков.

`buttonMotion.ts` использует общий кадр и четыре CSS-параметра вращения: компоненты фиксированной нормированной оси и накопленный угол. Вложенное тело совершает полные обороты вокруг собственного неподвижного центра; элементы имеют разные направления и скорости. Фаза и её прогресс, Курамото, stress и музыка плавно влияют на угловую скорость. Наведение или видимый клавиатурный фокус переводит выбранное тело к ближайшему углу, кратному полному обороту, с C²-выравниванием передней грани. Тела, не удерживаемые для чтения, продолжают вращаться. Освобождённый элемент плавно разгоняется от достигнутой позы; в шкале фаз действует приоритет текущей кнопки, описанный ниже.

Каждая кнопка имеет отдельную тень с тёмной серединой и холодным полутоном в `::before` неподвижного host. Шесть дополнительных CSS-параметров задают смещение, размытие, прозрачность и форму тени по текущей ориентации тела; обновление ограничено 12 Гц общего кадра. Размытие применяется только к тени и сохраняет шесть объёмных граней корпуса. При чтении тело и тень увеличиваются вместе; тень становится мягче. Верхняя мобильная плашка компактна и центрирована. На экранах до 600px нижние меню занимают почти полную ширину с полями; интервалы между рядами и нижний отступ оставляют место вращению и теням. Настольная компоновка сохраняется.

`finaleComposition.ts` согласует геометрию фотонного ореола Canvas и положение DOM-визитки в CSS-пикселях, учитывая дыхание карточки, HUD и свободную высоту экрана. `bindHudDockLayout()` из `engine/hud/hudDomOrchestrator.ts` измеряет верхнее меню и нижний док через `ResizeObserver` и публикует `--hud-top-inset` и `--hud-bottom-inset`; карточка резервирует его фактическую высоту при переносе увеличенных кнопок.

В строках визитки канонический текст generic `p/span` доступен в отдельном span, а декоративное представление имеет `aria-hidden`. Кнопки, ссылки и заголовки сохраняют доступное имя. Центральная квантовая строка из 25 ячеек использует отдельный диапазон `18–26 Гц`; цифровой водопад сохраняет собственное символьное представление.

Статичные строки собираются слева направо: закреплённый текст, фронт перебора, затем пустые окна. Начальный Canvas-показ использует горизонтальное направление; при наведении на DOM целый знак перелистывается вокруг Y (`0→90°`, затем `−90→0°`) без скользящего обрезания. Одновременно виден один слой, а равномерный scale вписывает ширину и высоту начертания с выносами и базовой линией. Каждый знак проходит два оборота, после чего раскрывается исходная наборная мера с точным tracking. Первоначальные Canvas и DOM сохраняют общий LTR-порядок, доступный текст остаётся каноническим; постоянная квантовая строка работает независимо.

Первичная DOM-сборка, наведение и постоянная 25-ячеечная строка вписывают полное начертание в отдельный ink-слой. Для первичной сборки размеры заданы каноническими ячейками; измерения изменённых знаков собираются до записи текста и стилей, сокращая повторные перерасчёты layout при раскрытии. Квантовая строка обновляет метрики также при смене шрифта и размеров. Canvas-одометр применяет вписывание к основным и ghost-знакам, включая выносы и границы viewport; кеш метрик ограничен и обновляется при смене поколения шрифтов.

В шкале фаз текущая кнопка удерживает читаемую переднюю грань и увеличивается вместе с тенью. Приоритет выделения: наведение → видимый клавиатурный фокус → текущая фаза. После ухода курсора и снятия фокуса выделяется актуальная фаза; остальные тела вращаются независимо.

Визитка появляется из Точки Нуля; полная сборка запускает её 12-секундный подъём на общих часах `finaleRiseElapsedSec`. Повторный вход в финал сохраняет начавшийся подъём и собранный текст. Позиция ограничена размерами карточки, HUD и viewport; пауза сохраняет положение, reduced motion использует статичное представление. На низком экране ограничение подъёма сохраняет видимость содержимого и действий, даже если полный зазор над ореолом недостижим.

Во время подъёма часть экранных источников задаёт начало траекторий дополнительного объёмного Уробороса. Исходное облако, частицы и NEXUS сохраняют прежнюю видимость и движение. Сборка занимает 5.5 активной секунды; в начале следующей первой фазы полная форма удерживается ещё 7.6 секунды для завершения оборота, затем распыляется за 7.2 секунды; свет пыли затухает между 15 и 16.8 секунды первой фазы. `ouroborosRelease` сохраняет фактическую степень сборки и время ориентации при автоматическом или ручном переходе `05→01`; вход в первую фазу из другой фазы не создаёт форму. Preview повторяет отдельную 30-секундную огибающую на общих часах.

На всех экранах карточка поднимается максимально высоко в пределах безопасной верхней области: до 8px на desktop с учётом дыхания, а до 920px — с учётом верхнего HUD, дополнительных 4px и минимальной границы 48px. Текущая масштабированная высота ограничивает подъём без обрезания информации. Только на телефоне до 600px последние шесть секунд 12-секундного подъёма уменьшают карточку до масштаба `0.82` с C²-огибающей; при ширине от 601px масштаб остаётся `1`. Пауза сохраняет текущий размер.

При ширине от 921px три действия визитки расположены в одном ряду; в диапазоне 921–1280px подписи могут переноситься внутри ссылок, сохраняя полный текст без горизонтального скролла. На desktop высотой до 800px компактные вертикальные интервалы сохраняют все информационные строки. В диапазоне 601–920px постоянные 25 квантовых ячеек помещаются в один ряд с прежним размером шрифта. Уменьшение всей карточки остаётся только телефонным.

Вращение продолжается и на протяжении 1.45-секундного `RESTART_COLLAPSE`: время ориентации равно сохранённому времени начала restart плюс `restartElapsedSec`. В VOID переносится достигнутое время, без скачка и остановки формы. Штатный автопроход даёт полной форме 14 активных секунд движения до начала рассеивания. Пауза и скрытая вкладка останавливают общие часы; раннее ручное переключение не блокируется ради оборота.

`ouroboros.rs` и `ouroborosModel.ts` заполняют отдельный буфер до 3072 записей по восемь `f32`: позиция, нормаль, размер, материал. Уплощённая вытянутая морда расширяется к черепу, затем плавно округляется в туловище. Две небольшие световые точки обозначают глаза; тонкий хвост входит в полость пасти, замыкая силуэт. Индексы `0/1`, `2/3` и `4/5` закрепляют глаза, противоположные губы и конец хвоста, `8/9` — шею, `10/11` — ширину черепа, `16/17` — его глубину без изменения ABI материалов. Последовательность R2 с отдельной выборкой головы и шеи даёт стабильное покрытие поверхности при разных уровнях качества. Форма вращается головой вперёд с мягким покачиванием трёх осей; локальный масштаб формы равен `0.232 * min(width, height)`. Host проверяет optional ABI версии 1 и геометрию до копирования. Морфинг читает экранные источники, не изменяя частицы физики и NEXUS. WebGPU и Canvas используют согласованные точки; способы освещения различаются. Эпизод не добавляет шестую фазу и сохраняет 108-секундный цикл.

Индексы `i % 16 === 6` образуют мягкое внутреннее течение: 192 точки при полном количестве, 568 остальных пылевых точек сохраняют внешний ореол. Внутреннее поле имеет разреженную середину, индивидуальные угловые скорости, небольшое радиальное дыхание и разную глубину. Оно разделяет покачивание X/Y, но не наследует полный оборот тела по Z. Музыкальная энергия влияет на амплитуду дыхания, а не на накопленную угловую фазу. Число точек, ABI и внешнее полевое облако сохраняются; штатный морфинг возвращает эти точки к экранным источникам. Пауза сохраняет позу, reduced motion использует фиксированное время общей модели.

Центр формы совпадает с центром поля и дрейфом камеры: `(width / 2 + driftX, height / 2 + driftY)`. Полуоси эллиптического сечения проходят через морду `(0.106, 0.066)` при `u=0` и череп `(0.156, 0.100)` при `u=0.05`, затем C²-переходом соединяются с телом `(tube, 1.06 * tube)` при `u=0.15`. Нормали рассчитываются по производным поверхности, а направленный свет и затухание по глубине отделяют ближнюю сторону тела от дальней. Объём не требует увеличения количества точек или нового прохода.

GPU-проход проверяет компиляцию WGSL, реальную offscreen-отрисовку с чтением пикселей и первую отправку перед публикацией `READY`. В начале пятой фазы он заранее запускается невидимым кадром с нулевой прозрачностью: компиляция и pixel self-test выполняются до появления визитки в ACT D, не меняя поле и часы эпизода. `OuroborosEffect` выбирает Canvas при отказе; `?gpu=0` принудительно задаёт этот путь, `?ouroboros=0` отключает эпизод. Буферы и depth texture освобождаются при отказе и снятии страницы; устаревшее завершение асинхронной инициализации не восстанавливает снятый проход. Основной `probeWebGpuSupport()` обновляет capabilities и не выдаёт себя за успешный draw.

Общий масштаб вращающихся HUD-тел задаётся `--hud-compact-scale: 0.75`; индивидуальные тени, остановка и увеличение при чтении сохраняются. Подпись `link-hud-github` имеет 18-секундный перелив нагретого металла: янтарный → коралловый → розовый → голубой → янтарный. Перелив использует существующий общий шаг; при pause/reduced motion цвет неподвижен. Другие кнопки сохраняют свою палитру.

---

## 9. МАТРИЦА РЕЕСТРА ИНТЕГРАЦИЙ (`IntegrationRegistry`)

Все **8 модулей** в `frontend/src/core/integrationRegistry.ts` инициализируются с нулевыми замерами (`0 ms`) и в полном составе отображаются в панели `LAYER_04 // TERMINAL & REGISTRY`:

| ID модуля | Язык | Основной файл | Стартовый статус | Когда обновляется |
| :--- | :--- | :--- | :---: | :--- |
| `ts-core` | `TypeScript` | `frontend/src/store/universeState.ts` | `READY` | На каждом шаге физики в режиме `TS_FALLBACK` (`wasmBridge.ts`). |
| `wasm-physics` | `Rust/WASM` | `physics_engine/src/gravity.rs` | `LOADING` → `READY` / `FALLBACK` | Default async raw ABI v1; первый валидный native-шаг даёт `WASM_ACTIVE` без утверждения SIMD. `?wasm=0` или ошибка выбирают TS fallback. |
| `webgpu-render` | `WGSL/WebGPU` | `frontend/src/engine/webgpu/ouroboros.wgsl` | `FALLBACK` → `LOADING` → `READY` / `FALLBACK` | `OuroborosEffect` запускает реальный depth/light проход после GPU self-test; замеры обновляются при успешных отправках. Canvas сохраняет основные фазы и резервное представление эпизода. |
| `canvas2d-render` | `Canvas2D` | `frontend/src/engine/UniverseRenderer.ts` | `READY` | На каждом кадре в `UniverseRenderer.renderFrame()`; рисунок формируют модули `engine/passes/`. |
| `pyodide-graph` | `Python` | `backend/core/graph_logic.py` | `FALLBACK` | Остаётся в `FALLBACK` при работе локального TS-движка графа. |
| `server-ws` | `Python` | `backend/api/transport.py` | `INACTIVE` | Офлайн HTTP/Binary инструмент и подготовленный `PythonSocketClient`; текущие HTTP и WebSocket протоколы не образуют рабочее браузерное подключение. |
| `web-audio` | `WebAudio` | `frontend/src/utils/audioSync.ts` | `LOADING` | Переходит в `READY` при старте `cosmic_ambient.mp3` (`updateRealtimeModulation`). |
| `worker-physics` | `TypeScript` | `frontend/src/bridge/simulationWorker.ts` | `FALLBACK` | Записывает время построения графа `NEXUS` (`buildDeterministicGraph`). |

---

## 10. Проверки

Полная команда из корня репозитория — `npm run verify:all`. Она проверяет отслеживаемые исходники и точки запуска, Python reference, native Rust, TypeScript, графический lifecycle с управляемым WebGPU mock, настоящий WASM-модуль и статический Pages-артефакт.

| Команда | Назначение |
|---|---|
| `npm run verify:repo` | Наличие исходников, fixtures, npm entry scripts и точных путей относительных импортов в индексе Git |
| `npm run verify:python` | Отчёт Python о численных и бинарных контрактах |
| `npm run test:python` | Python-регрессии |
| `npm run test:rust` | Нативные проверки Rust |
| `npm run typecheck` / `npm test` | Типы и регрессии TypeScript |
| `npm run verify:graphics` | Асинхронная готовность, отказы и освобождение настоящих GPU-классов с управляемым WebGPU mock |
| `npm run build:wasm` / `npm run verify:wasm` | Сборка, ABI, перенос состояния и численный стык WASM |
| `npm run build` / `npm run verify:pages-artifact` | Статическая сборка и ресурсы публикации |

Реальные WASM-проверки охватывают шаги разной длительности, рост памяти, active count, seed/reset, позднюю загрузку, trap/ABI/pointer fallback, влияние native-фазы на геометрию и скалярный оптический reference. DOM-проверки охватывают общий кадр, доступный канон, паузу и освобождение подписок.

Для начальной сборки, постоянной строки из 25 символов и hover-барабанов измерения выполняются до записей текста и стилей. Метрики окон кешируются по поколению шрифтов, размеру и viewport; кеш начертаний ограничен 4096 записями. Регрессии проверяют порядок чтений/записей и обновление после resize или загрузки шрифта без изменения символьных часов.

Начальные ячейки визитки создаются при скрытом монтировании. Четыре наборные строки и квантовая сетка подготавливают измерения до общего пакета DOM-записей, после которого применяется transform карточки. HUD сохраняет неизменившиеся текстовые узлы, а доступность визитки обновляется при изменении её состояния, а не на каждом кадре.

Проверки геометрии Уробороса охватывают детерминизм, нормали, материалы, стабильные индексы качества и передачу экранных источников с правильным знаком Y. `verify:graphics` отдельно проверяет реальный renderer/coordinator через mock: поздние асинхронные результаты, потерю устройства, повтор после неудавшейся отправки, кеш неизменного кадра, обновление изменившихся точек при фиксированных часах и освобождение атласа. Настоящая компиляция WGSL и пиксельный результат драйвера проверяются в браузере; Node harness не подтверждает их сам по себе.

Визуальное качество проверяется отдельно на разных viewport и способах ввода. Численные fixtures имеют явную область входов; их успешное прохождение не доказывает тождества всех возможных состояний.

Параметр `?profile=1` включает `FrameDiagnostics` на существующем RAF: основной холст публикует в `data-frame-profile` интервалы между кадрами, CPU-время, максимумы и счётчики свыше 100/500/1000 мс по фазе и акту. Профиль сохраняет реальный gap, а не ограниченный шаг физики; пауза, скрытие страницы и первое возобновление исключаются из зависаний активной сцены. В обычном просмотре запись выключена. Сравнение требует одинаковых устройства, viewport, seed и профиля качества; мобильная эмуляция не подтверждает поведение физического Safari/iOS.

Сочетание `?profile=1&dpr=3` задаёт диагностический входной DPR, сохраняя штатные ограничения разрешения профиля качества. Без профилирования `dpr` не переопределяет физический DPR. `visibilitychange` сразу разрывает измеряемую последовательность, поэтому скрытие без фонового RAF не превращается в ложный длинный gap после возвращения.

Поля `maxSetupMs`, `maxSimulationMs`, `maxUiMs`, `maxRenderMs` разделяют CPU кадра по участкам; `maxVisualSignalsMs` показывает максимумы подписчиков `hud-buttons`, `waterfall`, `finale-card` и активного `glyph-reels`. Синхронные store-подписчики входят во время вызывающего участка. Замеры подписчиков и их журнал создаются только при включённом профилировании.

## 11. Сборка и публикация

Нужны Node.js `>=22.23.4`, Python `3.11+`, Rust и target `wasm32-unknown-unknown`. Зависимости устанавливаются по lock-файлу через `npm ci`.

Сборка WASM использует явный `[profile.release]` в `physics_engine/Cargo.toml`: `opt-level = 3`, `lto = true`, `codegen-units = 1`, `panic = "abort"`. После сборки проверяются exports, ABI и численный паритет. Размер артефакта и время исполнения зависят от инструментария и измеряются отдельно.

```sh
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Адрес локального сервера выводится Astro. `npm run build` создаёт `frontend/dist` с production base `/universe`; `npm run preview` позволяет проверить собранный сайт. Workflow `.github/workflows/deploy.yml` выполняет проверки, собирает WASM и Astro, проверяет ресурсы и публикует Pages-артефакт.

## 12. Конфигурация и лицензии

Опциональная конфигурация описана в `.env.example`; локальные значения задаются в `.env`. Публичные клиентские параметры не предназначены для хранения секретов.

Код распространяется по [MIT](LICENSE). Условия использования саундтрека описаны отдельно в [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md); лицензия кода не заменяет права на аудиозапись.
