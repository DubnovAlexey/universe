<!--suppress MarkdownUnresolvedFileReference -->

# 🌌 UNIVERSE / НЕЙРОВЕРС

[![Live demo](https://img.shields.io/badge/Live_demo-GitHub_Pages-38bdf8?style=for-the-badge)](https://dubnovalexey.github.io/universe/)
[![Build](https://github.com/DubnovAlexey/universe/actions/workflows/deploy.yml/badge.svg)](https://github.com/DubnovAlexey/universe/actions/workflows/deploy.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-10b981)](LICENSE)

[Русский](#russian) · [English](#english) · [עברית](#hebrew) · [Español](#spanish) · [Français](#french)

<a name="russian"></a>

## Русский

**UNIVERSE** — интерактивная аудиовизуальная инсталляция Алексея Дубнова. За 108 секунд световая точка превращается в галактику, нейронную структуру и чёрную дыру, затем раскрывается в визитку автора. Сцену сопровождает пространственный эмбиент; курсор открывает оптическую линзу и инженерные слои.

### Посмотреть

Откройте [живую демонстрацию](https://dubnovalexey.github.io/universe/). Если браузер блокирует автозапуск звука, нажмите на сцену или кнопку AUDIO. Визуальный цикл запускается независимо от звука.

| Управление | Действие |
|---|---|
| Кнопки `01`–`05` или `Shift+1`–`Shift+5` | Выбор фазы |
| Нажатие и движение указателя по сцене | Линза BREACH |
| `P` / PAUSE | Пауза и продолжение |
| `M` / AUDIO | Включение и выключение звука |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | Инженерные слои |
| `2`–`5` | Переключение инженерных слоёв с клавиатуры |
| Стрелки / `Space` / `Esc` на свободной сцене | Перемещение / удержание / закрытие линзы BREACH |
| `Shift+R` | Перезапуск цикла |
| `КАК ЭТО УСТРОЕНО` / `HOW IT WORKS` внизу по центру | Общий путеводитель по сцене |
| `ЯЗЫК: RU` / `LANGUAGE: RU` | Переключение RU → EN → HE → ES |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` в визитке | Объяснение выбранной модели |

На узких экранах технические панели подстраиваются под содержание; несколько открытых панелей используют общую прокрутку. После сборки визитка плавно поднимается, освобождая центр для Уробороса из части окружающих частиц. Полевое облако продолжает жить вокруг него; внутри кольца медленно течёт разреженная пыль. В начале следующего цикла форма рассеивается обратно в поле; визитка и её ссылки остаются доступными.

### Технологии

- **Astro и TypeScript** — статическая оболочка, состояние сцены и управление циклом.
- **Canvas 2D и собственная DOM/SVG-фабрика** — изображение, интерфейс и телеметрия.
- **Rust/WASM** — фазы Курамото, контрольная орбитальная модель и объёмная геометрия с резервной реализацией TypeScript.
- **WebGPU/WGSL** — глубина и свет частиц Уробороса; при недоступности GPU эпизод рисует Canvas 2D.
- **Web Audio API** — воспроизведение и музыкальные огибающие.
- **Python** — независимые математические эталоны и проверки.

### Как это устроено

Пять кнопок `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` стоят перед строкой технологий визитки. Они и центральная кнопка открывают 15 тем с уровнями «Просто» и «Технически». Пыль всего облака мягким вихрем слетается к окну и за `3,6 с` собирается в его рамку и поверхность; к четвёртой секунде окно проявляется и впитывает пыль, а при закрытии рассыпается обратно в облако. Затем вводный текст собирается слева направо за `1000 мс` с плавной передачей нативному тексту за `200 мс`. На телефоне панель размещается между верхним HUD и нижним пультом. Внутренняя область чтения прокручивается с безопасными полями у стенок, заголовок занимает всю ширину; два режима делят ширину поровну. Внутренние объёмные кнопки мягко покачиваются и переливаются. Контуры и падающие символы используют те же настройки, что правые панели; текст сохраняет положение с мягким свечением. Пауза сразу открывает полный вводный текст. Сцена, музыка и остальные кнопки продолжают работать. Закрытие — кнопкой или `Esc` при фокусе внутри панели.

Кнопка языка переводит весь видимый интерфейс, визитку, 15 тем, подписи формул, источников и сообщения терминала на русский, английский, иврит или испанский. У всех вращающихся элементов передняя грань показывает выбранный язык, задняя — английский; в режиме EN обе английские. Имена и технические обозначения сохраняются. Иврит использует RTL-текст при прежнем расположении элементов управления.

Песчинки окна отрываются от всех частиц видимого облака и закручиваются вихрем в форме самой панели, поэтому витки не уходят за край экрана даже у окна, прижатого к краю. `30%` пыли садится точно на волнистую SVG-рамку панели, снятую при открытии, — пыльная рамка совпадает с настоящей и растворяется в ней. Полёт и посадка C²-гладкие, всё рисуется в том же Canvas пакетами без второго холста; после проявления окна проход ничего не рисует.

**Проекты-планеты (ветка `site`).** После первого просмотра, вместе с визиткой, в сцене появляется 21 проект портфолио — планеты среди частиц. В фазах 01–04 они летают у краёв экрана и не закрывают рисунок, к финалу стягиваются кольцом вокруг Уробороса. В покое планета приглушена в тон сцены; при наведении с неё «спадает пелена»: она растёт, проступают её цвет, фавикон проекта и название по кругу. Нажатие открывает живой сайт проекта на весь экран вместе со ссылкой на его код; на это время сцена стоит и молчит, а после закрытия продолжает с того же места. Подробности — UNIVERSE_BIBLE §8.5.

Подписи вращающихся объёмных кнопок остаются резкими благодаря суперсэмплингу. Chrome растрирует 3D-слои с перспективой в масштабе экрана, поэтому каждое тело строится вдвое крупнее и уменьшается тем же `scale`. Текстура получает двойной запас детализации, и буквы не мылятся ни в покое, ни при увеличении, ни в повороте. Подробности — в [UNIVERSE_BIBLE.md](UNIVERSE_BIBLE.md), раздел 8.4.

- **SCRAMBLER / PRNG** создаёт воспроизводимые исходные числа из зерна; индексный хеш задаёт свойства частицы по её номеру.
- **KURAMOTO** связывает внутренние ритмы частиц через средний угол; параметр `r` измеряет согласованность фаз.
- **fBm** складывает плавные неровности разных масштабов, оживляя пыль, эхо и кромку линзы.
- **VERLET** рассчитывает отдельные 64 контрольные орбиты маленькими подшагами; REF64 показывает отклонение их энергии.
- **PLUMMER** задаёт гладкое центральное притяжение контрольных орбит, убирая бесконечное ускорение точечной модели.

Уравнения, параметры реализации и границы применимости собраны в [математическом руководстве](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

### Локальный запуск

Нужны Node.js `>=22.23.4`, Python `3.11+` и Rust с target `wasm32-unknown-unknown`.

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Откройте адрес, выведенный Astro в терминале. Для production-сборки выполните `npm run build`, затем `npm run preview`.

### Проверки и документация

`npm run verify:all` проверяет исходники, Python/Rust/TypeScript, жизненный цикл графики, реальный WASM и статический артефакт GitHub Pages. На GitHub те же проверки запускаются автоматически: перед публикацией `main` (`deploy.yml`) и в каждом pull request и в ветке сайта `site` без публикации (`ci.yml`).

- [Архитектура и конвейер данных](docs/ARCHITECTURE.md)
- [Технический справочник и карта модулей](UNIVERSE_BIBLE.md)
- [Архитектурное решение: вычислительные модули](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Математические модели](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Визуальная и музыкальная режиссура](docs/VISUAL_AUDIO_DIRECTION.md)
- [Сценарий демонстрации](docs/DEMO_SCRIPT.md)

### Автор и лицензия

<details>
<summary>О музыке</summary>

Последовательный плейлист повторяется независимо от 108-секундного цикла сцены:

1. **Photosynthesis** — **Carbon Based Lifeforms**, *World of Sleepers* (`cosmic_ambient.mp3`).
2. **Down On Me** — **Melokind**, *Voices*.
3. `2_5415626372078905996.mp3` — название и исполнитель не подтверждены.
4. **Cosmophobia** — **Zero Cult**.

Сведения доступны в раскрываемом блоке путеводителя. Первому треку сохранён старт с 2,6 с; остальные начинаются с начала. Ошибка одного файла переключает следующий; если не загрузился весь круг, плеер ждёт повторной команды AUDIO.

</details>

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). Код распространяется по [лицензии MIT](LICENSE). Шрифтовые поднаборы Noto — по [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). Условия использования саундтрека указаны в [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).

---

<a name="english"></a>

## English

**UNIVERSE** is an interactive audiovisual installation by Alexey Dubnov. In 108 seconds a point of light becomes a galaxy, a neural structure and a black hole, then opens into the author's business card. Spatial ambient music accompanies the scene; the cursor opens an optical lens and engineering layers.

### Watch

Open the [live demo](https://dubnovalexey.github.io/universe/). If the browser blocks sound autoplay, click the scene or the AUDIO button. The visual cycle starts regardless of sound.

| Control | Action |
|---|---|
| Buttons `01`–`05` or `Shift+1`–`Shift+5` | Choose a phase |
| Press and move the pointer over the scene | BREACH lens |
| `P` / PAUSE | Pause and resume |
| `M` / AUDIO | Sound on and off |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | Engineering layers |
| `2`–`5` | Switch engineering layers from the keyboard |
| Arrows / `Space` / `Esc` on the free scene | Move / hold / close the BREACH lens |
| `Shift+R` | Restart the cycle |
| `КАК ЭТО УСТРОЕНО` / `HOW IT WORKS` at the bottom centre | General guide to the scene |
| `ЯЗЫК: RU` / `LANGUAGE: RU` | Switch RU → EN → HE → ES |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` on the card | Explanation of the chosen model |

On narrow screens the technical panels adapt to their content; several open panels share one scroll. After it assembles, the card rises smoothly and frees the centre for the Ouroboros, made from part of the surrounding particles. The particle cloud keeps living around it; sparse dust flows slowly inside the ring. At the start of the next cycle the shape scatters back into the field; the card and its links stay available.

### Technologies

- **Astro and TypeScript** — the static shell, the scene state and cycle control.
- **Canvas 2D and our own DOM/SVG factory** — the image, the interface and the telemetry.
- **Rust/WASM** — Kuramoto phases, the reference orbital model and the volumetric geometry, with a TypeScript fallback.
- **WebGPU/WGSL** — depth and light of the Ouroboros particles; without a GPU the episode is drawn with Canvas 2D.
- **Web Audio API** — playback and musical envelopes.
- **Python** — independent mathematical references and checks.

### How it works

The five buttons `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` stand before the card's technology line. Together with the centre button they open 15 topics, each at a "Simple" and a "Technical" level. The dust of the whole cloud flies to the window in a soft whirl and in `3.6 s` gathers into its frame and surface; by the fourth second the window appears and absorbs the dust, and on closing it scatters back into the cloud. Then the intro text assembles from left to right in `1000 ms`, handing over smoothly to native text in `200 ms`. On a phone the panel sits between the top HUD and the bottom console. The inner reading area scrolls with safe margins at the walls, the heading takes the full width, and the two modes split the width evenly. The inner volumetric buttons sway gently and shimmer. Outlines and falling symbols use the same settings as the right-hand panels; the text keeps its place with a soft glow. Pause immediately opens the full intro text. The scene, the music and the other buttons keep working. Close it with the button or with `Esc` while focus is inside the panel.

The language button translates the whole visible interface, the card, the 15 topics, the captions of formulas and sources and the terminal messages into Russian, English, Hebrew or Spanish. On every rotating element the front face shows the chosen language and the back face shows English; in EN mode both faces are English. Names and technical notation are kept. Hebrew uses right-to-left text while the controls stay where they are.

The window's grains break away from all the particles of the visible cloud and swirl in a whirl shaped like the panel itself, so the turns never leave the screen, even for a window pressed against an edge. `30%` of the dust settles exactly on the panel's wavy SVG frame, captured when it opens, so the dust frame matches the real one and dissolves into it. Flight and landing are C²-smooth, and everything is drawn in batches on the same Canvas without a second one; once the window has appeared, the pass draws nothing.

**Project planets (`site` branch).** After the first viewing, together with the business card, 21 portfolio projects join the scene as planets among the particles. In phases 01–04 they fly near the screen edges without covering the picture, and towards the finale they gather in a ring around the Ouroboros. At rest a planet is muted to the scene's tone; hovering lifts the veil: it grows and reveals its colour, the project favicon and its name around it. A click opens the live project site full screen together with a link to its source code; meanwhile the scene stands still and silent, and after closing it continues from the same place. Details: UNIVERSE_BIBLE §8.5.

The captions on the rotating volumetric buttons stay sharp thanks to supersampling. Chrome rasterises 3D layers with perspective at screen scale, so every body is built twice as large and shrunk by the same `scale`. The texture gets twice the detail, and the letters stay crisp at rest, when enlarged and while turning. Details are in [UNIVERSE_BIBLE.md](UNIVERSE_BIBLE.md), section 8.4.

- **SCRAMBLER / PRNG** creates reproducible starting numbers from a seed; an index hash sets a particle's properties by its number.
- **KURAMOTO** couples the particles' inner rhythms through a mean angle; the parameter `r` measures how well the phases agree.
- **fBm** adds up smooth irregularities of different scales, bringing the dust, the echo and the lens edge to life.
- **VERLET** computes 64 separate reference orbits in small substeps; REF64 shows the drift of their energy.
- **PLUMMER** sets a smooth central attraction for the reference orbits, removing the infinite acceleration of a point model.

The equations, implementation parameters and limits of applicability are collected in the [mathematical guide](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

### Run locally

You need Node.js `>=22.23.4`, Python `3.11+` and Rust with the `wasm32-unknown-unknown` target.

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Open the address Astro prints in the terminal. For a production build run `npm run build`, then `npm run preview`.

### Checks and documentation

`npm run verify:all` checks the sources, Python/Rust/TypeScript, the graphics lifecycle, the real WASM and the static GitHub Pages artifact. On GitHub the same checks run automatically: before publishing `main` (`deploy.yml`), and in every pull request and in the `site` branch without publishing (`ci.yml`).

- [Architecture and data pipeline](docs/ARCHITECTURE.md)
- [Technical reference and module map](UNIVERSE_BIBLE.md)
- [Architecture decision: computing modules](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Mathematical models](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Visual and musical direction](docs/VISUAL_AUDIO_DIRECTION.md)
- [Demo script](docs/DEMO_SCRIPT.md)

### Author and licence

<details>
<summary>About the music</summary>

The sequential playlist repeats independently of the scene's 108-second cycle:

1. **Photosynthesis** — **Carbon Based Lifeforms**, *World of Sleepers* (`cosmic_ambient.mp3`).
2. **Down On Me** — **Melokind**, *Voices*.
3. `2_5415626372078905996.mp3` — title and artist not confirmed.
4. **Cosmophobia** — **Zero Cult**.

The details are also in the guide's expandable block. The first track keeps its start at 2.6 s; the others start from the beginning. If one file fails, the player moves to the next; if the whole round failed to load, the player waits for another AUDIO command.

</details>

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). The code is released under the [MIT licence](LICENSE). The Noto font subsets are under the [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). The terms of use of the soundtrack are in [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).

---

<a name="hebrew"></a>

<div dir="rtl">

## עברית

**UNIVERSE** הוא מיצב אורקולי אינטראקטיבי של אלכסיי דובנוב. ב-108 שניות נקודת אור הופכת לגלקסיה, למבנה עצבי ולחור שחור, ואז נפתחת לכרטיס הביקור של היוצר. מוזיקת אמביינט מרחבית מלווה את הסצנה; הסמן פותח עדשה אופטית ושכבות הנדסיות.

### צפייה

פתחו את [ההדגמה החיה](https://dubnovalexey.github.io/universe/). אם הדפדפן חוסם השמעה אוטומטית של צליל, לחצו על הסצנה או על כפתור AUDIO. המחזור החזותי מתחיל בלי קשר לצליל.

| שליטה | פעולה |
|---|---|
| כפתורים `01`–`05` או `Shift+1`–`Shift+5` | בחירת שלב |
| לחיצה ותזוזת המצביע על הסצנה | עדשת BREACH |
| `P` / PAUSE | השהיה והמשך |
| `M` / AUDIO | הפעלה וכיבוי של הצליל |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | שכבות הנדסיות |
| `2`–`5` | החלפת שכבות הנדסיות מהמקלדת |
| חיצים / `Space` / `Esc` על סצנה פנויה | הזזה / החזקה / סגירה של עדשת BREACH |
| `Shift+R` | הפעלה מחדש של המחזור |
| `КАК ЭТО УСТРОЕНО` / `HOW IT WORKS` בתחתית, במרכז | מדריך כללי לסצנה |
| `ЯЗЫК: RU` / `LANGUAGE: RU` | מעבר RU → EN → HE → ES |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` בכרטיס הביקור | הסבר על המודל שנבחר |

במסכים צרים הלוחות הטכניים מתאימים את עצמם לתוכן; כמה לוחות פתוחים חולקים גלילה אחת. אחרי ההרכבה כרטיס הביקור עולה בעדינות ומפנה את המרכז לאורובורוס, העשוי מחלק מהחלקיקים שמסביב. ענן החלקיקים ממשיך לחיות סביבו; בתוך הטבעת זורם לאט אבק דליל. בתחילת המחזור הבא הצורה מתפזרת בחזרה לשדה; כרטיס הביקור והקישורים שבו נשארים זמינים.

### טכנולוגיות

- **Astro ו-TypeScript** — מעטפת סטטית, מצב הסצנה וניהול המחזור.
- **Canvas 2D ומפעל DOM/SVG משלנו** — התמונה, הממשק והטלמטריה.
- **Rust/WASM** — שלבי קורמוטו, מודל המסלולים הבקרתי והגאומטריה הנפחית, עם מימוש גיבוי ב-TypeScript.
- **WebGPU/WGSL** — עומק ואור של חלקיקי האורובורוס; אם אין GPU, הקטע מצויר ב-Canvas 2D.
- **Web Audio API** — השמעה ומעטפות מוזיקליות.
- **Python** — אמות מידה מתמטיות ובדיקות עצמאיות.

### איך זה בנוי

חמשת הכפתורים `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` עומדים לפני שורת הטכנולוגיות בכרטיס הביקור. הם והכפתור המרכזי פותחים 15 נושאים, כל אחד ברמה "פשוט" וברמה "טכני". האבק של כל הענן עף אל החלון במערבולת רכה ותוך `3.6 שניות` מתאסף למסגרת ולמשטח שלו; עד השנייה הרביעית החלון מתגלה וסופג את האבק, ובסגירה הוא מתפזר בחזרה לענן. אחר כך טקסט הפתיחה מתאסף משמאל לימין תוך `1000 מ"ש` ועובר בעדינות לטקסט רגיל תוך `200 מ"ש`. בטלפון הלוח ממוקם בין ה-HUD העליון ללוח הבקרה התחתון. אזור הקריאה הפנימי נגלל עם שוליים בטוחים ליד הדפנות, הכותרת תופסת את כל הרוחב, ושני המצבים מתחלקים ברוחב שווה. הכפתורים הנפחיים הפנימיים מתנדנדים בעדינות ומנצנצים. קווי המתאר והסמלים הנופלים משתמשים באותן הגדרות כמו הלוחות הימניים; הטקסט שומר על מקומו בזוהר רך. השהיה פותחת מיד את טקסט הפתיחה המלא. הסצנה, המוזיקה ושאר הכפתורים ממשיכים לעבוד. הסגירה — בכפתור או ב-`Esc` כשהמיקוד בתוך הלוח.

כפתור השפה מתרגם את כל הממשק הגלוי, את כרטיס הביקור, את 15 הנושאים, את כיתובי הנוסחאות והמקורות ואת הודעות הטרמינל לרוסית, לאנגלית, לעברית או לספרדית. בכל רכיב מסתובב הפאה הקדמית מציגה את השפה שנבחרה והאחורית — אנגלית; במצב EN שתיהן באנגלית. שמות וסימונים טכניים נשמרים. העברית מוצגת מימין לשמאל, ופקדי השליטה נשארים במקומם.

גרגרי החלון ניתקים מכל החלקיקים של הענן הגלוי ומסתחררים במערבולת בצורת הלוח עצמו, ולכן הסיבובים לא יוצאים מגבולות המסך גם בחלון הצמוד לקצה. `30%` מהאבק נוחת בדיוק על מסגרת ה-SVG הגלית של הלוח, שנלכדת בזמן הפתיחה, — מסגרת האבק חופפת לאמיתית ומתמוססת בתוכה. המעוף והנחיתה חלקים ברמת C², והכול מצויר באותו Canvas במנות, בלי משטח ציור שני; אחרי שהחלון מתגלה, המעבר אינו מצייר דבר.

**פרויקטים-כוכבי לכת (ענף `site`).** אחרי הצפייה הראשונה, יחד עם כרטיס הביקור, מופיעים בסצנה 21 פרויקטים מתיק העבודות — כוכבי לכת בין החלקיקים. בשלבים 01–04 הם עפים ליד קצות המסך ולא מסתירים את התמונה, ולקראת הסיום מתכנסים לטבעת סביב האורובורוס. במנוחה כוכב הלכת מעומעם בגוון הסצנה; במעבר עכבר "המעטה נופל": הוא גדל, ומתגלים צבעו, סמל הפרויקט ושמו במעגל. לחיצה פותחת את האתר החי של הפרויקט במסך מלא יחד עם קישור לקוד שלו; בזמן הזה הסצנה עומדת ושותקת, ואחרי הסגירה ממשיכה מאותה נקודה. פרטים — UNIVERSE_BIBLE §8.5.

הכיתובים על הכפתורים הנפחיים המסתובבים נשארים חדים בזכות דגימת-על (supersampling). Chrome מרסטר שכבות תלת-ממד עם פרספקטיבה בקנה המידה של המסך, ולכן כל גוף נבנה בגודל כפול ומוקטן באותו `scale`. המרקם מקבל רזרבת פירוט כפולה, והאותיות לא מיטשטשות — לא במנוחה, לא בהגדלה ולא בסיבוב. פרטים — ב-[UNIVERSE_BIBLE.md](UNIVERSE_BIBLE.md), סעיף 8.4.

- **SCRAMBLER / PRNG** יוצר מספרי פתיחה ניתנים לשחזור מתוך זרע; גיבוב לפי אינדקס קובע את תכונות החלקיק לפי מספרו.
- **KURAMOTO** מקשר את המקצבים הפנימיים של החלקיקים דרך זווית ממוצעת; הפרמטר `r` מודד את התאמת השלבים.
- **fBm** מחבר אי-סדירויות חלקות בקני מידה שונים ומחייה את האבק, את ההד ואת שפת העדשה.
- **VERLET** מחשב 64 מסלולי בקרה נפרדים בצעדי-משנה קטנים; REF64 מראה את סטיית האנרגיה שלהם.
- **PLUMMER** קובע משיכה מרכזית חלקה למסלולי הבקרה ומבטל את התאוצה האינסופית של מודל נקודתי.

המשוואות, פרמטרי המימוש וגבולות התחולה מרוכזים ב[מדריך המתמטי](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

### הרצה מקומית

נדרשים Node.js `>=22.23.4`, Python `3.11+` ו-Rust עם היעד `wasm32-unknown-unknown`.

<div dir="ltr">

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

</div>

פתחו את הכתובת ש-Astro מדפיס בטרמינל. לבניית production הריצו `npm run build`, ואז `npm run preview`.

### בדיקות ותיעוד

`npm run verify:all` בודק את קוד המקור, את Python/Rust/TypeScript, את מחזור החיים של הגרפיקה, את ה-WASM האמיתי ואת התוצר הסטטי של GitHub Pages. ב-GitHub אותן בדיקות רצות אוטומטית: לפני פרסום `main` (`deploy.yml`), ובכל pull request ובענף האתר `site` בלי פרסום (`ci.yml`).

- [ארכיטקטורה וצינור נתונים](docs/ARCHITECTURE.md)
- [מדריך טכני ומפת מודולים](UNIVERSE_BIBLE.md)
- [החלטה ארכיטקטונית: מודולי חישוב](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [מודלים מתמטיים](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [בימוי חזותי ומוזיקלי](docs/VISUAL_AUDIO_DIRECTION.md)
- [תסריט הדגמה](docs/DEMO_SCRIPT.md)

### יוצר ורישיון

<details>
<summary>על המוזיקה</summary>

רשימת ההשמעה הרציפה חוזרת בלי קשר למחזור הסצנה בן 108 השניות:

1. **Photosynthesis** — **Carbon Based Lifeforms**, *World of Sleepers* (`cosmic_ambient.mp3`).
2. **Down On Me** — **Melokind**, *Voices*.
3. `2_5415626372078905996.mp3` — השם והמבצע לא אומתו.
4. **Cosmophobia** — **Zero Cult**.

הפרטים זמינים גם בבלוק הנפתח של המדריך. הרצועה הראשונה נשמרת עם התחלה מ-2.6 שניות; האחרות מתחילות מההתחלה. שגיאה בקובץ אחד מעבירה לבא; אם כל הסבב לא נטען, הנגן מחכה לפקודת AUDIO חוזרת.

</details>

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). הקוד מופץ תחת [רישיון MIT](LICENSE). תת-הערכות של גופני Noto — תחת [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). תנאי השימוש בפסקול מפורטים ב-[AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).

</div>

---

<a name="spanish"></a>

## Español

**UNIVERSE** es una instalación audiovisual interactiva de Alexey Dubnov. En 108 segundos un punto de luz se convierte en una galaxia, una estructura neuronal y un agujero negro, y después se abre en la tarjeta de visita del autor. Una música ambiental espacial acompaña la escena; el cursor abre una lente óptica y capas de ingeniería.

### Ver

Abra la [demo en vivo](https://dubnovalexey.github.io/universe/). Si el navegador bloquea la reproducción automática de sonido, pulse la escena o el botón AUDIO. El ciclo visual arranca con o sin sonido.

| Control | Acción |
|---|---|
| Botones `01`–`05` o `Shift+1`–`Shift+5` | Elegir la fase |
| Pulsar y mover el puntero sobre la escena | Lente BREACH |
| `P` / PAUSE | Pausa y continuación |
| `M` / AUDIO | Activar y desactivar el sonido |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | Capas de ingeniería |
| `2`–`5` | Cambiar las capas de ingeniería desde el teclado |
| Flechas / `Space` / `Esc` sobre la escena libre | Mover / sostener / cerrar la lente BREACH |
| `Shift+R` | Reiniciar el ciclo |
| `КАК ЭТО УСТРОЕНО` / `HOW IT WORKS` abajo en el centro | Guía general de la escena |
| `ЯЗЫК: RU` / `LANGUAGE: RU` | Cambiar RU → EN → HE → ES |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` en la tarjeta | Explicación del modelo elegido |

En pantallas estrechas los paneles técnicos se ajustan a su contenido; varios paneles abiertos comparten un mismo desplazamiento. Una vez montada, la tarjeta sube con suavidad y deja el centro libre para el Uróboros, formado con parte de las partículas de alrededor. La nube de partículas sigue viva a su alrededor; dentro del anillo fluye despacio un polvo disperso. Al empezar el ciclo siguiente la forma se disuelve de nuevo en el campo; la tarjeta y sus enlaces siguen disponibles.

### Tecnologías

- **Astro y TypeScript**: la envoltura estática, el estado de la escena y el control del ciclo.
- **Canvas 2D y una fábrica DOM/SVG propia**: la imagen, la interfaz y la telemetría.
- **Rust/WASM**: las fases de Kuramoto, el modelo orbital de control y la geometría volumétrica, con una implementación de reserva en TypeScript.
- **WebGPU/WGSL**: profundidad y luz de las partículas del Uróboros; sin GPU, el episodio se dibuja con Canvas 2D.
- **Web Audio API**: reproducción y envolventes musicales.
- **Python**: referencias matemáticas y comprobaciones independientes.

### Cómo funciona

Los cinco botones `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` están delante de la línea de tecnologías de la tarjeta. Junto con el botón central abren 15 temas, cada uno en nivel «Sencillo» y «Técnico». El polvo de toda la nube vuela hacia la ventana en un remolino suave y en `3,6 s` se reúne en su marco y su superficie; hacia el cuarto segundo la ventana aparece y absorbe el polvo, y al cerrarse se deshace de nuevo en la nube. Después, el texto de introducción se compone de izquierda a derecha en `1000 ms` y pasa con suavidad al texto nativo en `200 ms`. En el móvil el panel se coloca entre el HUD superior y la consola inferior. La zona de lectura interior se desplaza con márgenes seguros junto a las paredes, el título ocupa todo el ancho y los dos modos se reparten el ancho a partes iguales. Los botones volumétricos interiores se balancean suavemente y cambian de brillo. Los contornos y los símbolos que caen usan los mismos ajustes que los paneles de la derecha; el texto mantiene su posición con un brillo suave. La pausa abre al instante el texto de introducción completo. La escena, la música y los demás botones siguen funcionando. Se cierra con el botón o con `Esc` cuando el foco está dentro del panel.

El botón de idioma traduce toda la interfaz visible, la tarjeta, los 15 temas, los rótulos de fórmulas y fuentes y los mensajes del terminal al ruso, inglés, hebreo o español. En todos los elementos giratorios la cara delantera muestra el idioma elegido y la trasera el inglés; en modo EN ambas están en inglés. Los nombres y la notación técnica se conservan. El hebreo usa texto de derecha a izquierda, mientras los controles se quedan en su sitio.

Los granos de la ventana se desprenden de todas las partículas de la nube visible y giran en un remolino con la forma del propio panel, así que las vueltas no salen de la pantalla ni siquiera con una ventana pegada al borde. El `30%` del polvo se posa exactamente sobre el marco SVG ondulado del panel, capturado al abrirse: el marco de polvo coincide con el real y se disuelve en él. El vuelo y el aterrizaje son suaves de clase C², y todo se dibuja por lotes en el mismo Canvas, sin un segundo lienzo; cuando la ventana ya ha aparecido, el paso no dibuja nada.

**Proyectos-planeta (rama `site`).** Tras el primer visionado, junto con la tarjeta, aparecen en la escena 21 proyectos del portafolio como planetas entre las partículas. En las fases 01–04 vuelan cerca de los bordes de la pantalla sin tapar la imagen, y hacia el final se reúnen en un anillo alrededor del Uróboros. En reposo el planeta queda atenuado en el tono de la escena; al pasar el ratón «cae el velo»: crece y aparecen su color, el favicon del proyecto y su nombre en círculo. Un clic abre el sitio vivo del proyecto a pantalla completa junto con un enlace a su código; mientras tanto la escena se queda quieta y en silencio, y al cerrarlo continúa desde el mismo punto. Detalles: UNIVERSE_BIBLE §8.5.

Los rótulos de los botones volumétricos giratorios se mantienen nítidos gracias al supermuestreo. Chrome rasteriza las capas 3D con perspectiva a escala de pantalla, así que cada cuerpo se construye al doble de tamaño y se reduce con el mismo `scale`. La textura recibe el doble de detalle, y las letras no se emborronan ni en reposo, ni al ampliarse, ni al girar. Detalles en [UNIVERSE_BIBLE.md](UNIVERSE_BIBLE.md), sección 8.4.

- **SCRAMBLER / PRNG** crea números iniciales reproducibles a partir de una semilla; un hash por índice fija las propiedades de una partícula según su número.
- **KURAMOTO** acopla los ritmos internos de las partículas mediante un ángulo medio; el parámetro `r` mide la concordancia de las fases.
- **fBm** suma irregularidades suaves de distintas escalas y da vida al polvo, al eco y al borde de la lente.
- **VERLET** calcula 64 órbitas de control separadas con pequeños subpasos; REF64 muestra la desviación de su energía.
- **PLUMMER** fija una atracción central suave para las órbitas de control y elimina la aceleración infinita de un modelo puntual.

Las ecuaciones, los parámetros de implementación y los límites de aplicación están reunidos en la [guía matemática](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

### Ejecución local

Hacen falta Node.js `>=22.23.4`, Python `3.11+` y Rust con el target `wasm32-unknown-unknown`.

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Abra la dirección que Astro muestra en el terminal. Para una compilación de producción ejecute `npm run build` y después `npm run preview`.

### Comprobaciones y documentación

`npm run verify:all` comprueba el código fuente, Python/Rust/TypeScript, el ciclo de vida de los gráficos, el WASM real y el artefacto estático de GitHub Pages. En GitHub las mismas comprobaciones se ejecutan solas: antes de publicar `main` (`deploy.yml`), y en cada pull request y en la rama del sitio `site` sin publicar (`ci.yml`).

- [Arquitectura y canal de datos](docs/ARCHITECTURE.md)
- [Referencia técnica y mapa de módulos](UNIVERSE_BIBLE.md)
- [Decisión de arquitectura: módulos de cálculo](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Modelos matemáticos](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Dirección visual y musical](docs/VISUAL_AUDIO_DIRECTION.md)
- [Guion de la demostración](docs/DEMO_SCRIPT.md)

### Autor y licencia

<details>
<summary>Sobre la música</summary>

La lista de reproducción secuencial se repite con independencia del ciclo de 108 segundos de la escena:

1. **Photosynthesis** — **Carbon Based Lifeforms**, *World of Sleepers* (`cosmic_ambient.mp3`).
2. **Down On Me** — **Melokind**, *Voices*.
3. `2_5415626372078905996.mp3` — título e intérprete sin confirmar.
4. **Cosmophobia** — **Zero Cult**.

Los datos también están en el bloque desplegable de la guía. La primera pista conserva su inicio en el segundo 2,6; las demás empiezan desde el principio. Si un archivo falla, el reproductor pasa al siguiente; si no se ha cargado ninguna de la ronda, espera una nueva orden AUDIO.

</details>

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). El código se distribuye bajo la [licencia MIT](LICENSE). Los subconjuntos de fuentes Noto, bajo la [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). Las condiciones de uso de la banda sonora están en [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).

---

<a name="french"></a>

## Français

**UNIVERSE** est une installation audiovisuelle interactive d'Alexey Dubnov. En 108 secondes, un point de lumière devient une galaxie, une structure neuronale et un trou noir, puis s'ouvre sur la carte de visite de l'auteur. Une musique ambient spatiale accompagne la scène ; le curseur ouvre une lentille optique et des couches d'ingénierie.

### Regarder

Ouvrez la [démo en ligne](https://dubnovalexey.github.io/universe/). Si le navigateur bloque la lecture automatique du son, cliquez sur la scène ou sur le bouton AUDIO. Le cycle visuel démarre indépendamment du son.

| Commande | Action |
|---|---|
| Boutons `01`–`05` ou `Shift+1`–`Shift+5` | Choisir la phase |
| Appuyer et déplacer le pointeur sur la scène | Lentille BREACH |
| `P` / PAUSE | Pause et reprise |
| `M` / AUDIO | Activer et couper le son |
| METRICS, TOPOLOGY, TERMINAL, X-RAY | Couches d'ingénierie |
| `2`–`5` | Changer de couche d'ingénierie au clavier |
| Flèches / `Space` / `Esc` sur la scène libre | Déplacer / maintenir / fermer la lentille BREACH |
| `Shift+R` | Relancer le cycle |
| `КАК ЭТО УСТРОЕНО` / `HOW IT WORKS` en bas au centre | Guide général de la scène |
| `ЯЗЫК: RU` / `LANGUAGE: RU` | Passer RU → EN → HE → ES |
| `SCRAMBLER`, `KURAMOTO`, `fBm`, `VERLET`, `PLUMMER` sur la carte | Explication du modèle choisi |

Sur les écrans étroits, les panneaux techniques s'adaptent à leur contenu ; plusieurs panneaux ouverts partagent un même défilement. Une fois assemblée, la carte monte en douceur et libère le centre pour l'Ouroboros, formé d'une partie des particules environnantes. Le nuage de particules continue de vivre autour ; à l'intérieur de l'anneau coule lentement une poussière clairsemée. Au début du cycle suivant, la forme se disperse de nouveau dans le champ ; la carte et ses liens restent accessibles.

### Technologies

- **Astro et TypeScript** — l'enveloppe statique, l'état de la scène et la conduite du cycle.
- **Canvas 2D et notre propre fabrique DOM/SVG** — l'image, l'interface et la télémétrie.
- **Rust/WASM** — les phases de Kuramoto, le modèle orbital de contrôle et la géométrie volumique, avec une implémentation de secours en TypeScript.
- **WebGPU/WGSL** — profondeur et lumière des particules de l'Ouroboros ; sans GPU, l'épisode est dessiné en Canvas 2D.
- **Web Audio API** — lecture et enveloppes musicales.
- **Python** — références mathématiques et vérifications indépendantes.

### Comment c'est fait

Les cinq boutons `SCRAMBLER · KURAMOTO · fBm · VERLET · PLUMMER` se trouvent devant la ligne des technologies de la carte. Avec le bouton central, ils ouvrent 15 sujets, chacun au niveau « Simple » et « Technique ». La poussière de tout le nuage vole vers la fenêtre en un tourbillon doux et, en `3,6 s`, se rassemble en son cadre et sa surface ; vers la quatrième seconde, la fenêtre apparaît et absorbe la poussière, et à la fermeture elle se disperse de nouveau dans le nuage. Ensuite, le texte d'introduction se compose de gauche à droite en `1000 ms` et passe en douceur au texte natif en `200 ms`. Sur téléphone, le panneau se place entre le HUD du haut et la console du bas. La zone de lecture intérieure défile avec des marges de sécurité le long des parois, le titre occupe toute la largeur et les deux modes se partagent la largeur à parts égales. Les boutons volumiques intérieurs se balancent doucement et chatoient. Les contours et les symboles qui tombent utilisent les mêmes réglages que les panneaux de droite ; le texte garde sa place avec une douce lueur. La pause ouvre aussitôt le texte d'introduction complet. La scène, la musique et les autres boutons continuent de fonctionner. On ferme avec le bouton ou avec `Esc` quand le focus est dans le panneau.

Le bouton de langue traduit toute l'interface visible, la carte, les 15 sujets, les légendes des formules et des sources et les messages du terminal en russe, anglais, hébreu ou espagnol. Sur chaque élément tournant, la face avant montre la langue choisie et la face arrière l'anglais ; en mode EN, les deux faces sont en anglais. Les noms et la notation technique sont conservés. L'hébreu s'affiche de droite à gauche, tandis que les commandes restent à leur place.

Les grains de la fenêtre se détachent de toutes les particules du nuage visible et tourbillonnent selon la forme du panneau lui-même : les spirales ne sortent donc pas de l'écran, même pour une fenêtre collée au bord. `30%` de la poussière se pose exactement sur le cadre SVG ondulé du panneau, relevé à l'ouverture : le cadre de poussière coïncide avec le vrai et s'y fond. Le vol et l'atterrissage sont lisses au sens C², et tout est dessiné par lots dans le même Canvas, sans second canevas ; une fois la fenêtre apparue, la passe ne dessine plus rien.

**Projets-planètes (branche `site`).** Après le premier visionnage, en même temps que la carte, 21 projets du portfolio entrent dans la scène comme des planètes parmi les particules. Pendant les phases 01 à 04, ils volent près des bords de l'écran sans cacher l'image, et vers le final ils se rassemblent en anneau autour de l'Ouroboros. Au repos, une planète est atténuée au ton de la scène ; au survol, « le voile tombe » : elle grandit et laisse apparaître sa couleur, le favicon du projet et son nom en cercle. Un clic ouvre le site vivant du projet en plein écran avec un lien vers son code ; pendant ce temps, la scène reste immobile et silencieuse, et après la fermeture elle reprend au même endroit. Détails : UNIVERSE_BIBLE §8.5.

Les légendes des boutons volumiques tournants restent nettes grâce au suréchantillonnage. Chrome rastérise les couches 3D avec perspective à l'échelle de l'écran : chaque corps est donc construit deux fois plus grand puis réduit par le même `scale`. La texture reçoit deux fois plus de détail, et les lettres ne bavent ni au repos, ni à l'agrandissement, ni en rotation. Détails dans [UNIVERSE_BIBLE.md](UNIVERSE_BIBLE.md), section 8.4.

- **SCRAMBLER / PRNG** crée des nombres de départ reproductibles à partir d'une graine ; un hachage par indice fixe les propriétés d'une particule selon son numéro.
- **KURAMOTO** couple les rythmes internes des particules par un angle moyen ; le paramètre `r` mesure l'accord des phases.
- **fBm** additionne des irrégularités douces de différentes échelles et anime la poussière, l'écho et le bord de la lentille.
- **VERLET** calcule 64 orbites de contrôle séparées par petits sous-pas ; REF64 montre la dérive de leur énergie.
- **PLUMMER** fixe une attraction centrale douce pour les orbites de contrôle et supprime l'accélération infinie d'un modèle ponctuel.

Les équations, les paramètres d'implémentation et les limites d'application sont réunis dans le [guide mathématique](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md).

### Lancer en local

Il faut Node.js `>=22.23.4`, Python `3.11+` et Rust avec la cible `wasm32-unknown-unknown`.

```sh
git clone https://github.com/DubnovAlexey/universe.git
cd universe
npm ci
rustup target add wasm32-unknown-unknown
npm run build:wasm
npm run dev
```

Ouvrez l'adresse qu'Astro affiche dans le terminal. Pour une version de production, lancez `npm run build`, puis `npm run preview`.

### Vérifications et documentation

`npm run verify:all` vérifie les sources, Python/Rust/TypeScript, le cycle de vie du graphisme, le vrai WASM et l'artefact statique de GitHub Pages. Sur GitHub, les mêmes vérifications tournent automatiquement : avant la publication de `main` (`deploy.yml`), et dans chaque pull request et dans la branche du site `site` sans publication (`ci.yml`).

- [Architecture et chaîne de données](docs/ARCHITECTURE.md)
- [Référence technique et carte des modules](UNIVERSE_BIBLE.md)
- [Décision d'architecture : modules de calcul](docs/ADR-001-POLYGLOT-RUNTIME.md)
- [Modèles mathématiques](docs/study_materials/MATHEMATICAL_AND_ASTROPHYSICAL_MODELS.md)
- [Direction visuelle et musicale](docs/VISUAL_AUDIO_DIRECTION.md)
- [Scénario de démonstration](docs/DEMO_SCRIPT.md)

### Auteur et licence

<details>
<summary>À propos de la musique</summary>

La liste de lecture séquentielle se répète indépendamment du cycle de 108 secondes de la scène :

1. **Photosynthesis** — **Carbon Based Lifeforms**, *World of Sleepers* (`cosmic_ambient.mp3`).
2. **Down On Me** — **Melokind**, *Voices*.
3. `2_5415626372078905996.mp3` — titre et interprète non confirmés.
4. **Cosmophobia** — **Zero Cult**.

Ces informations figurent aussi dans le bloc dépliant du guide. Le premier morceau garde son départ à 2,6 s ; les autres commencent au début. Si un fichier échoue, le lecteur passe au suivant ; si aucun morceau du tour ne s'est chargé, il attend une nouvelle commande AUDIO.

</details>

[Alexey Dubnov / DubnovAlexey](https://github.com/DubnovAlexey). Le code est distribué sous [licence MIT](LICENSE). Les sous-ensembles de polices Noto, sous [SIL OFL 1.1](frontend/public/fonts/LICENSE.txt). Les conditions d'utilisation de la bande-son figurent dans [AUDIO_LICENSE.md](frontend/public/audio/AUDIO_LICENSE.md).
