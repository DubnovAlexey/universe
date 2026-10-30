// ============================================================================
// ФАЙЛ: frontend/src/tests/locale.test.ts
// НАЗНАЧЕНИЕ: Проверить полноту четырёх языков без изменения формул и идентификаторов.
// РАЗДЕЛЫ: 1. Каталог; 2. Подписи и журнал; 3. Подписки; 4. Unicode и геометрия.
// ФУНКЦИИ: topicText, normalizedEquation, runLocaleChecks.
// ============================================================================
import {
    LOCALES, getLocale, setLocale, subscribeLocale, translateUi, hasUiTranslation, translateLog, type Locale,
} from '../core/locale';
import { EXPLAINER_TOPICS, getExplainerTopic, getExplainerTopics, type ExplainerTopic } from '../core/explainerTopics';
import { CANONICAL_FINALE_LINES, getFinaleLines } from '../bridge/cipherOdometerEngine';
import { formatOrderedGlyphText, getOrderedGlyphState, splitGlyphText } from '../core/glyphGrammar';
import { fitGlyphInk } from '../core/glyphHover';
import { getExplanationPhysicalOrder, getExplanationRevealTurns, getExplanationNativeOpacity } from '../layers/explanationTextReveal';
import { getLocalizedControlLabels, rememberLocaleAttributes, translateHudText } from '../engine/hud/localeController';
import { getExplanationButtonAngle, advanceExplanationButtonAngle, getExplanationModeInk, getExplanationFacetLight } from '../layers/explanationButtonMotion';

function topicText(topic: ExplainerTopic): readonly string[] {
    return [topic.label, topic.title, topic.summary, topic.experience, topic.intuition, ...topic.technical,
        ...topic.formulas.flatMap(formula => [formula.label, formula.text]), ...topic.sources.map(source => source.label)];
}

function normalizedEquation(text: string): string { return text.replaceAll('поле', '_field').replaceAll('форма', '_form'); }

export function runLocaleChecks(check: (passed: boolean, description: string) => void): void {
    const initialLocale = getLocale();
    let release: (() => void) | undefined;
    try {
        // НАЧАЛО РАЗДЕЛА 1. ШЕСТЬДЕСЯТ ПОЛНЫХ УЧЕБНЫХ ТЕМ
        const ids = EXPLAINER_TOPICS.map(topic => topic.id);
        check(LOCALES.join(',') === 'ru,en,he,es' && ids.length === 15 && new Set(ids).size === 15 &&
            LOCALES.every(locale => {
                const topics = getExplainerTopics(locale);
                return topics.length === ids.length && topics.every((topic, index) => topic.id === ids[index] &&
                    getExplainerTopic(topic.id, locale) === topic && topicText(topic).every(text => text.trim().length > 0) &&
                    topic.technical.length > 0 && topic.sources.length > 0);
            }),
        'All 15 topics are complete and individually addressable in Russian, English, Hebrew and Spanish');
        check((['en', 'he', 'es'] as const).every(locale => getExplainerTopics(locale).every(topic =>
            topicText(topic).every(text => !/\p{Script=Cyrillic}/u.test(text)) &&
            topic.title !== getExplainerTopic(topic.id, 'ru')!.title &&
            topic.sources.every((source, index) => source.label !== getExplainerTopic(topic.id, 'ru')!.sources[index].label) &&
            topic.formulas.every((formula, index) => formula.label !== getExplainerTopic(topic.id, 'ru')!.formulas[index].label))),
        'Every non-Russian topic translates prose, formula captions and source captions without leaking Cyrillic fallback text');
        check(LOCALES.every(locale => getExplainerTopics(locale).every(topic => {
            const base = getExplainerTopic(topic.id, 'ru')!;
            return topic.sources.length === base.sources.length && topic.sources.every((source, index) => source.path === base.sources[index].path) &&
                topic.formulas.length === base.formulas.length && topic.formulas.every((formula, index) =>
                    normalizedEquation(formula.text) === normalizedEquation(base.formulas[index].text) &&
                    formula.mathml === base.formulas[index].mathml &&
                    (!formula.mathml || formula.mathml.includes('xmlns="http://www.w3.org/1998/Math/MathML"')));
        })),
        'Changing language preserves source link destinations, mathematical structure and the exact MathML namespace and markup');
        check(LOCALES.every(locale => ['astro', 'typescript', 'jsx-dom', 'canvas-wgsl', 'rust-wasm', 'python', 'ouroboros'].every(id =>
            getExplainerTopic(id, locale)!.label === getExplainerTopic(id, 'ru')!.label)) &&
            LOCALES.every(locale => [0, 2, 3, 4].every(index => getFinaleLines(locale)[index] === CANONICAL_FINALE_LINES[index])) &&
            new Set(LOCALES.map(locale => getFinaleLines(locale)[1])).size === 4,
        'Technology names, author, symbols, mathematical model labels and the stack remain international while the finale subtitle changes language');
        // КОНЕЦ РАЗДЕЛА 1

        // НАЧАЛО РАЗДЕЛА 2. UI И ДИНАМИЧЕСКИЕ СООБЩЕНИЯ
        const requiredUi = ['HOW IT WORKS', 'LANGUAGE', 'О музыке', 'Композиция', 'Исполнитель', 'Альбом', 'Закрыть ×', 'Просто', 'Технически', 'Темы объяснения',
            '⏸ PAUSE', '▶ RESUME', '🔊 AUDIO: ON', '🔇 AUDIO: MUTED', '📊 METRICS', '🕸 TOPOLOGY', '⌨ TERMINAL',
            'Что видно в сцене', 'Формулы и обозначения', 'Посмотреть исходный код'];
        check(requiredUi.every(source => hasUiTranslation(source) && LOCALES.every(locale => {
            const text = translateUi(source, locale);
            return text.trim().length > 0 && (locale === 'ru' || !/\p{Script=Cyrillic}/u.test(text));
        })) && translateUi('HOW IT WORKS', 'ru') === 'КАК ЭТО УСТРОЕНО' &&
            translateUi('HOW IT WORKS', 'en') === 'HOW IT WORKS' &&
            translateUi('HOW IT WORKS', 'he') === 'איך זה עובד' && translateUi('HOW IT WORKS', 'es') === 'CÓMO FUNCIONA',
        'Launcher, language selector, playback controls and explanation UI all have explicit translations in the four selected languages');
        const launcherFronts = ['КАК ЭТО УСТРОЕНО', 'HOW IT WORKS', 'איך זה עובד', 'CÓMO FUNCIONA'];
        const languageFronts = ['ЯЗЫК: RU', 'LANGUAGE: EN', 'שפה: HE', 'IDIOMA: ES'];
        check(LOCALES.every((locale, index) => {
            const launcher = getLocalizedControlLabels('HOW IT WORKS', locale);
            const selector = getLocalizedControlLabels('LANGUAGE', locale, true);
            const technical = getLocalizedControlLabels('RUST/WASM', locale);
            return launcher.front === launcherFronts[index] && launcher.back === 'HOW IT WORKS' &&
                selector.front === languageFronts[index] && selector.back === `LANGUAGE: ${locale.toUpperCase()}` &&
                technical.front === 'RUST/WASM' && technical.back === 'RUST/WASM';
        }),
        'The actual control mapping puts the selected language on the front and English on the back, keeps the selected language code and preserves technical names');
        const unknown = 'UNKNOWN ABI_FIELD [rust/module.rs]';
        check(!hasUiTranslation(unknown) && LOCALES.every(locale => translateUi(unknown, locale) === unknown) &&
            translateUi('  Закрыть × \n', 'en') === '  Close × \n' &&
            translateUi('Пояснение: KURAMOTO', 'en') === 'Explain: KURAMOTO',
        'Unknown UI keys preserve their exact source, translated text keeps surrounding whitespace and dynamic explanation names retain their model');
        const log = '[12:34:56] [TIME:TICK] Симуляция приостановлена пользователем. [ts/universeState.ts]';
        check(translateLog(log, 'ru') === log && (['en', 'he', 'es'] as const).every(locale => {
            const translated = translateLog(log, locale);
            return translated.startsWith('[12:34:56] [TIME:TICK] ') && translated.endsWith(' [ts/universeState.ts]') &&
                !/\p{Script=Cyrillic}/u.test(translated) && translated !== log;
        }),
        'Dynamic terminal messages translate their prose while retaining timestamps, event tags and source paths');
        const attributes = new Map([['title', 'HOW IT WORKS'], ['aria-label', 'Закрыть ×'], ['aria-description', 'Rust/WASM']]);
        const element = {
            getAttribute: (name: string): string | null => attributes.get(name) ?? null,
            setAttribute: (name: string, value: string): void => { attributes.set(name, value); },
        } as unknown as Element;
        check(LOCALES.every(locale => {
            rememberLocaleAttributes(element, locale);
            return attributes.get('title') === translateUi('HOW IT WORKS', locale) &&
                attributes.get('aria-label') === translateUi('Закрыть ×', locale) && attributes.get('aria-description') === 'Rust/WASM';
        }) && translateHudText(log, 'en') === translateLog(log, 'en'),
        'The real HUD attribute controller reuses original title and accessible-label sources across language switches while preserving technical names');
        // КОНЕЦ РАЗДЕЛА 2

        // НАЧАЛО РАЗДЕЛА 3. ОДНО УВЕДОМЛЕНИЕ НА РЕАЛЬНОЕ ИЗМЕНЕНИЕ
        setLocale('ru');
        const changes: Locale[] = [];
        release = subscribeLocale(locale => changes.push(locale));
        setLocale('en'); setLocale('en'); setLocale('__invalid__' as Locale);
        const ignoredInvalid = getLocale() === 'en' && changes.join(',') === 'en';
        const followsSelection = getExplainerTopics() === getExplainerTopics('en') &&
            getExplainerTopic('overview') === getExplainerTopic('overview', 'en') && translateUi('Закрыть ×') === 'Close ×';
        setLocale('he'); setLocale('es'); release(); release(); setLocale('ru');
        check(ignoredInvalid && followsSelection && changes.join(',') === 'en,he,es' && getLocale() === 'ru',
            'One locale subscriber receives each real selection once; repeated and invalid selections do nothing, active lookups follow the choice and disposal releases the subscription');
        // КОНЕЦ РАЗДЕЛА 3

        const handoff = Array.from({ length: 101 }, (_, index) => getExplanationNativeOpacity(1000 + index * 2));
        check(getExplanationNativeOpacity(0) === 0 && getExplanationNativeOpacity(Number.NaN) === 0 &&
            handoff[0] === 0 && handoff[100] === 1 &&
            handoff.every((alpha, index) => alpha >= 0 && alpha <= 1 && (!index || alpha >= handoff[index - 1])) &&
            getExplanationNativeOpacity(1000.01) < 1e-9 && 1 - getExplanationNativeOpacity(1199.99) < 1e-9,
        'Completed fitted glyphs hand off continuously to native text with stationary opacity endpoints and no abrupt final resize');

        let smallMotion = true;
        for (let index = 0; index < 18; index++) {
            let previous = getExplanationButtonAngle(0, index);
            for (let frame = 1; frame <= 1200; frame++) {
                const next = getExplanationButtonAngle(frame / 60, index);
                smallMotion &&= Number.isFinite(next) && Math.abs(next) <= 10 && Math.abs(next - previous) < 0.21;
                previous = next;
            }
        }
        let settled = 10;
        let gentleFocus = true;
        for (let frame = 0; frame < 60; frame++) {
            const next = advanceExplanationButtonAngle(settled, 0, 0, true, 1 / 60);
            gentleFocus &&= next >= 0 && next <= settled && settled - next < 1.6;
            settled = next;
        }
        check(smallMotion && gentleFocus && settled === 0 &&
            advanceExplanationButtonAngle(3, 1000, 2, false, 0) === 3 &&
            Math.abs(advanceExplanationButtonAngle(0, Number.NaN, 0, false, 1 / 60)) < 0.5,
        'All 18 explanation prisms keep bounded slow motion; focus eases to flat, stopped time preserves the pose and invalid time stays finite');
        const colors = Array.from({ length: 1201 }, (_, index) =>
            getExplanationModeInk(index / 60).match(/\d+/g)!.map(Number));
        check(getExplanationModeInk(0) === getExplanationModeInk(20) &&
            getExplanationModeInk(Number.NaN) === getExplanationModeInk(0) &&
            colors.every((channels, index) => channels.length === 3 && channels.every((channel, component) =>
                channel >= 166 && channel <= 255 && (!index || Math.abs(channel - colors[index - 1][component]) <= 1))),
        'The opaque lava caption closes its 20-second loop without color flashes, dark frames or a discontinuous boundary');
        let facetContinuous = true;
        for (let index = 0; index < 18; index++) {
            let previous = getExplanationFacetLight(0, index);
            for (let frame = 1; frame <= 1800; frame++) {
                const light = getExplanationFacetLight(frame / 60, index);
                facetContinuous &&= light.xPercent >= 20 && light.xPercent <= 80 &&
                    light.yPercent >= 20 && light.yPercent <= 80 && light.angleDeg >= 102 && light.angleDeg <= 138 &&
                    light.opacity >= 0.045 && light.opacity <= 0.095 &&
                    Math.abs(light.xPercent - previous.xPercent) < 0.5 &&
                    Math.abs(light.yPercent - previous.yPercent) < 0.5 &&
                    Math.abs(light.angleDeg - previous.angleDeg) < 0.5 &&
                    Math.abs(light.opacity - previous.opacity) < 0.002;
                previous = light;
            }
        }
        check(facetContinuous,
        'Facet glints remain low in opacity and move continuously for each prism, including across the caption color-cycle boundary');

        // НАЧАЛО РАЗДЕЛА 4. ЕВРЕЙСКИЕ ГРАФЕМЫ И НЕИЗМЕННЫЙ ПОРЯДОК БАРАБАНОВ
        const hebrew = 'שָׁלוֹם עוֹלָם';
        const cells = splitGlyphText(hebrew);
        const order = (): string => Array.from({ length: 21 }, (_, frame) => cells.map((_cell, index) =>
            getOrderedGlyphState(index, cells.length, frame / 20)).map(state => `${state.state}:${state.progress}`).join('|')).join('\n');
        setLocale('en'); const latinOrder = order();
        setLocale('he'); const hebrewOrder = order();
        check(cells.length === 9 && cells.includes('שָׁ') && cells.every(cell => !/^\p{M}/u.test(cell)) &&
            cells.join('').normalize('NFC') === hebrew.normalize('NFC') && latinOrder === hebrewOrder &&
            formatOrderedGlyphText(hebrew, 1, 23, ['∇', 'Ω']) === hebrew,
        'Hebrew vowel marks remain attached to whole graphemes and selecting Hebrew preserves the ordered reel progression and exact final spelling');
        const physicalOrder = getExplanationPhysicalOrder([
            { left: 90, top: 10 }, { left: 60, top: 11 }, { left: 30, top: 10 },
            { left: 35, top: 40 }, { left: 15, top: 41 }, { left: 110, top: 40 },
        ]);
        const turns = [0, 0.25, 0.5, 0.75, 1].map(getExplanationRevealTurns);
        check(physicalOrder.join(',') === '2,1,0,4,3,5' && turns[0].outgoing === 0 && turns[4].incoming === 0 &&
            turns.every((turn, index) => turn.outgoing >= 0 && turn.outgoing <= 90 && turn.incoming >= -90 && turn.incoming <= 0 &&
                (!index || (turn.outgoing >= turns[index - 1].outgoing && turn.incoming >= turns[index - 1].incoming))),
        'Hebrew and mixed bidi paragraphs reveal top-to-bottom and physically left-to-right while both glyph faces retain the original signed Y-turn direction');
        const metrics = { width: 17, actualBoundingBoxLeft: 3, actualBoundingBoxRight: 16,
            actualBoundingBoxAscent: 22, actualBoundingBoxDescent: 8 };
        check([8, 13, 18].every(width => {
            const fit = fitGlyphInk(metrics, width, 24, 18);
            const left = fit.left + fit.inkLeft * fit.scale, right = fit.left + fit.inkRight * fit.scale;
            const top = fit.top + (fit.baseline - fit.inkAscent) * fit.scale;
            const bottom = fit.top + (fit.baseline + fit.inkDescent) * fit.scale;
            return fit.scale > 0 && fit.scale <= 1 && left >= 0 && right <= width && top >= 0 && bottom <= 24;
        }),
        'Ink fitting contains Hebrew-style negative bearings and tall vowel marks inside narrow phone and desktop glyph slots');
        // КОНЕЦ РАЗДЕЛА 4
    } finally {
        release?.();
        setLocale(initialLocale);
    }
}
