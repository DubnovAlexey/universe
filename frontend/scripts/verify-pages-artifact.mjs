// ============================================================================
// ФАЙЛ: frontend/scripts/verify-pages-artifact.mjs
// НАЗНАЧЕНИЕ: Проверка путей, точек входа и обязательных ресурсов Pages-артефакта.
// ФУНКЦИИ: requireFile проверяет наличие ресурса в каталоге публикации.
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, пути и проверка наличия файла requireFile.
//   2. Проверка HTML-точек входа и путей к Astro-ресурсам.
//   3. Проверка favicon, аудиотрека и самостоятельного Rust/WASM ABI v1.
// ============================================================================

// ============================================================================
// РАЗДЕЛ 1. ЗАВИСИМОСТИ, ПУТИ И ПРОВЕРКА НАЛИЧИЯ ФАЙЛА
// ============================================================================

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(frontendDirectory, 'dist');
const basePath = '/universe';
const htmlPath = path.join(distDirectory, 'index.html');

// --- НАЧАЛО ФУНКЦИИ requireFile ---
async function requireFile(relativePath, description) {
    const absolutePath = path.join(distDirectory, relativePath);
    try {
        await access(absolutePath);
    } catch {
        throw new Error(`${description} is missing: ${absolutePath}`);
    }
}
// --- КОНЕЦ ФУНКЦИИ requireFile ---

// ============================================================================
// РАЗДЕЛ 2. ПРОВЕРКА HTML-ТОЧЕК ВХОДА И ПУТЕЙ К ASTRO-РЕСУРСАМ
// ============================================================================

const html = await readFile(htmlPath, 'utf8');
const requiredHooks = [
    ['universe-canvas', 'main canvas'],
    ['ui-audio-unlock-banner', 'audio fallback control'],
    ['layer5-finale-root', 'finale-card mount point'],
    ['btn-toggle-audio', 'audio toggle'],
    ['btn-toggle-pause', 'pause control'],
    ['ui-phase-buttons', 'phase navigation'],
];

for (const [id, description] of requiredHooks) {
    if (!html.includes(`id="${id}"`)) {
        throw new Error(`Production entry is missing ${description} (#${id}).`);
    }
}

if (!html.includes(`${basePath}/favicon.png`)) {
    throw new Error(`Production entry does not reference the ${basePath} favicon path.`);
}

const bundledAssetRefs = [...html.matchAll(/(?:src|href)="([^"]*\/_astro\/[^\"]+)"/g)]
    .map((match) => match[1]);
if (bundledAssetRefs.length === 0) {
    throw new Error('Production entry contains no Astro bundle references.');
}

for (const assetRef of bundledAssetRefs) {
    const pathname = new URL(assetRef, 'https://pages.invalid').pathname;
    if (!pathname.startsWith(`${basePath}/`)) {
        throw new Error(`Astro asset is not rooted under ${basePath}: ${assetRef}`);
    }
    const relativePath = decodeURIComponent(pathname.slice(basePath.length + 1));
    if (relativePath.startsWith('..')) {
        throw new Error(`Unsafe artifact path in entry: ${assetRef}`);
    }
    await requireFile(relativePath, 'Referenced Astro asset');
}

// ============================================================================
// РАЗДЕЛ 3. ПРОВЕРКА FAVICON, АУДИОТРЕКА И RUST/WASM ABI V1
// ============================================================================

await requireFile('favicon.png', 'GitHub Pages favicon');
await requireFile('audio/cosmic_ambient.mp3', 'Continuous ambient soundtrack');
await requireFile('wasm/physics_engine.wasm', 'Rust physics WebAssembly module');

const wasmBytes = await readFile(path.join(distDirectory, 'wasm', 'physics_engine.wasm'));
if (!WebAssembly.validate(wasmBytes)) {
    throw new Error('Published Rust physics artifact must be a nonempty valid WebAssembly module.');
}
const wasmModule = await WebAssembly.compile(wasmBytes);
if (WebAssembly.Module.imports(wasmModule).length !== 0) {
    throw new Error('Published Rust physics artifact must run without JavaScript imports or glue.');
}
const wasmInstance = await WebAssembly.instantiate(wasmModule, {});
if (
    typeof wasmInstance.exports.get_abi_version !== 'function' ||
    wasmInstance.exports.get_abi_version() !== 1
) {
    throw new Error('Published Rust physics artifact must expose raw ABI version 1.');
}

console.log(
    `Pages artifact smoke check passed: ${requiredHooks.length} UI hooks, ${bundledAssetRefs.length} Astro bundles, favicon, soundtrack and valid Rust/WASM ABI v1.`
);
