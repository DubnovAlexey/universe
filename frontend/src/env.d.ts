// noinspection JSUnusedGlobalSymbols,SpellCheckingInspection
// ============================================================================
// ФАЙЛ: frontend/src/env.d.ts
// НАЗНАЧЕНИЕ: Глобальные декларации типов окружения, CSS/WGSL модулей и JSX (v2.0)
// ЗАДАЧИ ФАЙЛА:
// 1. Разрешить side-effect импорт таблиц стилей (*.css) и шейдеров (*.wgsl) без ошибок TS.
// 2. Описать переменные окружения ImportMetaEnv (BASE_URL, PUBLIC_WS_URL).
// 3. Согласовать тип JSX.Element со стандартным DOM Element для слоёв Layer2-Layer5.tsx.
// ============================================================================

declare module '*.css';
declare module '*.wgsl' {
    const content: string;
    export default content;
}
declare module '*.wasm' {
    const url: string;
    export default url;
}

interface ImportMetaEnv {
    readonly BASE_URL: string;
    readonly PUBLIC_WS_URL?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace JSX {
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
}

export {};