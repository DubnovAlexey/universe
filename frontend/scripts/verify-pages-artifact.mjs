import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const frontendDirectory = path.resolve(scriptDirectory, '..');
const distDirectory = path.join(frontendDirectory, 'dist');
const basePath = '/universe';
const htmlPath = path.join(distDirectory, 'index.html');

async function requireFile(relativePath, description) {
    const absolutePath = path.join(distDirectory, relativePath);
    try {
        await access(absolutePath);
    } catch {
        throw new Error(`${description} is missing: ${absolutePath}`);
    }
}

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

await requireFile('favicon.png', 'GitHub Pages favicon');
await requireFile('audio/cosmic_ambient.mp3', 'Continuous ambient soundtrack');

console.log(
    `Pages artifact smoke check passed: ${requiredHooks.length} UI hooks, ${bundledAssetRefs.length} Astro bundles, favicon and soundtrack.`
);
