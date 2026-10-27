/// <reference types="vite/client" />
// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/env.d.ts
// НАЗНАЧЕНИЕ: Клиентские типы Vite, глобальные декларации CSS/WGSL/WASM и JSX.
// ЗАДАЧИ ФАЙЛА:
// 1. Разрешить side-effect импорт таблиц стилей (*.css) и шейдеров (*.wgsl) без ошибки TS2882.
// 2. Подключить import.meta.glob и базовое окружение Vite, добавить PUBLIC_WS_URL.
// 3. Согласовать тип JSX.Element со стандартным DOM Element для слоёв Layer2-Layer5.tsx.
// ВАЖНО: Файл не должен содержать top-level export {}, чтобы оставаться глобальным!
// ============================================================================
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, константы и контракты данных.
//   2. Декларации ресурсов CSS/WGSL/WASM и переменных окружения ImportMeta.
//   3. Типы JSX.Element, HTMLAttributes и IntrinsicElements.
// ============================================================================


declare module '*.css';

declare module '*.wgsl' {
    const content: string;
    export default content;
}

declare module '*.wgsl?raw' {
    const content: string;
    export default content;
}

declare module '*.wasm' {
    const url: string;
    export default url;
}

// РАЗДЕЛ 2. ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ IMPORTMETA
interface ImportMetaEnv {
    readonly PUBLIC_WS_URL?: string;
}

// eslint-disable-next-line @typescript-eslint/no-namespace
// РАЗДЕЛ 3. ДЕКЛАРАЦИИ JSX
declare namespace JSX {
    type Element = globalThis.Element;

    interface HTMLAttributes {
        id?: string;
        className?: string;
        title?: string;
        href?: string;
        target?: string;
        rel?: string;
        type?: string;
        disabled?: boolean;
        role?: string;
        tabIndex?: number;
        'aria-label'?: string;
        'aria-live'?: 'off' | 'polite' | 'assertive';
        'aria-atomic'?: 'true' | 'false' | boolean;
        'data-ui-panel'?: string;
        'data-github-card'?: string;
        'data-target-label'?: string;
        onClick?: (event: MouseEvent) => void;
        onMouseEnter?: (event: MouseEvent) => void;
        onKeyDown?: (event: KeyboardEvent) => void;
        children?: unknown;
        [attr: string]: unknown;
    }

    interface IntrinsicElements {
        div: HTMLAttributes;
        span: HTMLAttributes;
        small: HTMLAttributes;
        strong: HTMLAttributes;
        p: HTMLAttributes;
        a: HTMLAttributes;
        button: HTMLAttributes;
        aside: HTMLAttributes;
        section: HTMLAttributes;
        header: HTMLAttributes;
        footer: HTMLAttributes;
        h1: HTMLAttributes;
        h2: HTMLAttributes;
        h3: HTMLAttributes;
        ul: HTMLAttributes;
        li: HTMLAttributes;
        pre: HTMLAttributes;
        code: HTMLAttributes;
        [elemName: string]: HTMLAttributes;
    }
}
