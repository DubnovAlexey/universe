// ============================================================================
// ФАЙЛ: frontend/src/tests/localeResolution.test.ts
// НАЗНАЧЕНИЕ: Проверить приоритет языка ссылки, сохранённого выбора и браузера.
// РАЗДЕЛЫ: 1. Приоритеты; 2. Региональные теги и некорректные значения.
// ФУНКЦИИ: runLocaleResolutionChecks.
// ============================================================================
import { resolveInitialLocale } from '../core/locale';

// НАЧАЛО ФУНКЦИИ runLocaleResolutionChecks
export function runLocaleResolutionChecks(check: (passed: boolean, description: string) => void): void {
    check(resolveInitialLocale('?lang=he', 'es', ['ru-RU']) === 'he' &&
        resolveInitialLocale('?lang=unknown', 'es', ['ru-RU']) === 'es' &&
        resolveInitialLocale('', null, ['de-DE', 'es-MX']) === 'es',
        'Shared language links override saved choices, which override the first supported browser language');
    check(resolveInitialLocale('?lang=EN-us', null, []) === 'en' &&
        resolveInitialLocale('', null, ['iw-IL']) === 'he' &&
        resolveInitialLocale('', null, ['ru_RU']) === 'ru',
        'Locale resolution accepts regional tags, case and the legacy Hebrew iw code');
    check(resolveInitialLocale('?lang=english', 'enough', ['unknown', 'enough']) === 'en' &&
        resolveInitialLocale('?lang=%00he', null, ['pt-BR']) === 'en',
        'Unsupported or malformed tags use English rather than accepting arbitrary two-letter prefixes');
}
// КОНЕЦ ФУНКЦИИ runLocaleResolutionChecks
