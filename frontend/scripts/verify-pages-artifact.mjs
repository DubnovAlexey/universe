// ============================================================================
// ФАЙЛ: frontend/scripts/verify-pages-artifact.mjs
// НАЗНАЧЕНИЕ: Проверка путей, точек входа и обязательных ресурсов Pages-артефакта.
// ФУНКЦИИ: requireFile проверяет наличие ресурса в каталоге публикации.
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, пути и проверка наличия файла requireFile.
//   2. Проверка HTML-точек входа и путей к Astro-ресурсам.
//   3. Проверка favicon, аудиотрека и самостоятельного Rust/WASM ABI v1.
//   4. Проверка локальных шрифтов, предварительной загрузки и контрольных сумм.
// ============================================================================

// ============================================================================
// РАЗДЕЛ 1. ЗАВИСИМОСТИ, ПУТИ И ПРОВЕРКА НАЛИЧИЯ ФАЙЛА
// ============================================================================

import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

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
    return absolutePath;
}
// --- КОНЕЦ ФУНКЦИИ requireFile ---

// ============================================================================
// РАЗДЕЛ 2. ПРОВЕРКА HTML-ТОЧЕК ВХОДА И ПУТЕЙ К ASTRO-РЕСУРСАМ
// ============================================================================

const html = await readFile(htmlPath, 'utf8');
const requiredHooks = [
    ['universe-canvas', 'main canvas'],
    ['ouroboros-canvas', 'volumetric overlay canvas'],
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

const bundledAssetRefs = [...html.matchAll(/(?:src|href)="([^"]*\/_astro\/[^"]+)"/g)]
    .map((match) => match[1])
    .filter((ref) => /\.(?:m?js|css)$/.test(new URL(ref, 'https://pages.invalid').pathname));
if (
    !bundledAssetRefs.some((ref) => /\.m?js$/.test(new URL(ref, 'https://pages.invalid').pathname)) ||
    !bundledAssetRefs.some((ref) => new URL(ref, 'https://pages.invalid').pathname.endsWith('.css'))
) {
    throw new Error('Production entry must reference both Astro JavaScript and CSS bundles.');
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
for (const exportName of ['get_ouroboros_abi_version', 'get_ouroboros_capacity', 'get_ouroboros_points_ptr', 'sample_ouroboros']) {
    if (typeof wasmInstance.exports[exportName] !== 'function') {
        throw new Error(`Published Rust geometry artifact is missing: ${exportName}`);
    }
}
if (wasmInstance.exports.get_ouroboros_abi_version() !== 1 || wasmInstance.exports.get_ouroboros_capacity() !== 3072 ||
    wasmInstance.exports.sample_ouroboros(104729, 8, 0, 1, 0.5) !== 8) {
    throw new Error('Published Ouroboros geometry must implement ABI v1 and produce a valid sample.');
}
const geometryPointer = wasmInstance.exports.get_ouroboros_points_ptr();
if (!(wasmInstance.exports.memory instanceof WebAssembly.Memory) || !Number.isInteger(geometryPointer) ||
    geometryPointer < 0 || geometryPointer % 4 !== 0 ||
    geometryPointer + 8 * 32 > wasmInstance.exports.memory.buffer.byteLength ||
    !new Float32Array(wasmInstance.exports.memory.buffer, geometryPointer, 8 * 8).every(Number.isFinite)) {
    throw new Error('Published Ouroboros geometry points outside valid memory or contains non-finite values.');
}
if (
    typeof wasmInstance.exports.get_abi_version !== 'function' ||
    wasmInstance.exports.get_abi_version() !== 1
) {
    throw new Error('Published Rust physics artifact must expose raw ABI version 1.');
}
if (typeof wasmInstance.exports.evaluate_lens_refraction !== 'function') {
    throw new Error('Published Rust physics artifact is missing the lens-refraction export.');
}
const outsideLensMagnitude = wasmInstance.exports.evaluate_lens_refraction(500, 500, 0, 0, 100, 1);
if (!Number.isFinite(outsideLensMagnitude) || outsideLensMagnitude !== 0) {
    throw new Error('Published lens-refraction export must return zero outside the lens.');
}

// ============================================================================
// РАЗДЕЛ 4. ЛОКАЛЬНЫЕ НАЧЕРТАНИЯ ИСТОРИЧЕСКИХ И МАТЕМАТИЧЕСКИХ СИМВОЛОВ
// ============================================================================
const glyphFonts = JSON.parse(await readFile(path.join(frontendDirectory, 'src/core/glyphFontAssets.json'), 'utf8'));
if (glyphFonts.sourceDirectory !== 'src/assets') throw new Error('Glyph fonts must be Vite source assets.');
await requireFile(glyphFonts.license, 'Glyph font license');
const styleContents = await Promise.all(bundledAssetRefs.filter((ref) => ref.endsWith('.css')).map(async (ref) => {
    const relative = new URL(ref, 'https://pages.invalid').pathname.slice(basePath.length + 1);
    return readFile(path.join(distDirectory, relative), 'utf8');
}));
const fontPreloads = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /\brel="preload"/.test(tag) && /\bas="font"/.test(tag))
    .map((tag) => tag.match(/\bhref="([^"]+)"/)?.[1])
    .filter(Boolean);
for (const font of glyphFonts.fonts) {
    if (!/^fonts\/[a-z0-9.-]+\.ttf$/.test(font.file)) throw new Error(`Unsafe font path: ${font.file}`);
    const sourcePath = path.join(frontendDirectory, glyphFonts.sourceDirectory, font.file);
    const sourceBytes = await readFile(sourcePath);
    const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
    if (sourceBytes.length !== font.bytes || sourceHash !== font.sha256 || sourceBytes.readUInt32BE(0) !== 0x00010000) {
        throw new Error(`Source glyph font differs from its manifest: ${font.file}`);
    }
    const sourceStem = path.basename(font.file, '.ttf');
    const matchingPreloads = fontPreloads.filter((ref) => {
        const basename = path.posix.basename(new URL(ref, 'https://pages.invalid').pathname);
        return basename.startsWith(`${sourceStem}.`) && basename.endsWith('.ttf');
    });
    if (matchingPreloads.length !== 1) throw new Error(`Expected one emitted font preload: ${font.file}`);
    const fontUrl = matchingPreloads[0];
    if (!fontUrl.startsWith(`${basePath}/_astro/`)) throw new Error(`Font preload is outside Astro assets: ${fontUrl}`);
    const relativePath = decodeURIComponent(new URL(fontUrl, 'https://pages.invalid').pathname.slice(basePath.length + 1));
    const emittedPath = await requireFile(relativePath, 'Emitted glyph font');
    const emittedBytes = await readFile(emittedPath);
    const emittedHash = createHash('sha256').update(emittedBytes).digest('hex');
    if (emittedBytes.length !== font.bytes || emittedHash !== font.sha256 || !emittedBytes.equals(sourceBytes)) {
        throw new Error(`Emitted glyph font differs from its source and manifest: ${font.file}`);
    }
    if (!styleContents.some((css) => css.includes(fontUrl))) {
        throw new Error(`Font preload and CSS do not share the same emitted URL: ${font.file}`);
    }
}

console.log(
    `Pages artifact smoke check passed: ${requiredHooks.length} UI hooks, ${bundledAssetRefs.length} Astro bundles, ${glyphFonts.fonts.length} licensed glyph subsets, favicon, soundtrack and valid Rust/WASM ABI v1.`
);
