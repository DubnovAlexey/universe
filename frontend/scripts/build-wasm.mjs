// ============================================================================
// ФАЙЛ: frontend/scripts/build-wasm.mjs
// НАЗНАЧЕНИЕ: Сборка и атомарная публикация самостоятельного Rust/WASM-модуля ABI v1.
// ФУНКЦИИ: buildRustArtifact — Cargo; validateRawWasm — бинарный контракт;
//          main — публикация; reportFailure — диагностическое завершение.
// ОГЛАВЛЕНИЕ РАЗДЕЛОВ:
//   1. Зависимости, пути и обязательные экспорты ABI.
//   2. Сборка Rust для wasm32-unknown-unknown.
//   3. Проверка WebAssembly и версии ABI.
//   4. Атомарная публикация и обработка ошибки запуска.
// ============================================================================

// ============================================================================
// НАЧАЛО РАЗДЕЛА 1. ЗАВИСИМОСТИ, ПУТИ И ОБЯЗАТЕЛЬНЫЕ ЭКСПОРТЫ ABI
// ============================================================================

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const engineDirectory = join(repositoryRoot, 'physics_engine');
const targetDirectory = join(engineDirectory, 'target');
const target = 'wasm32-unknown-unknown';
const manifestPath = join(engineDirectory, 'Cargo.toml');
const artifactPath = join(targetDirectory, target, 'release', 'physics_engine.wasm');
const destinationPath = join(repositoryRoot, 'frontend', 'public', 'wasm', 'physics_engine.wasm');
const targetInstallCommand = `rustup target add ${target}`;
const requiredFunctionExports = [
    'get_abi_version',
    'init_bodies',
    'get_active_count',
    'step_verlet_nbody',
    'get_positions_ptr',
    'get_velocities_ptr',
    'get_phases_ptr',
    'get_omegas_ptr',
    'get_integrated_time',
    'commit_uploaded_state',
    'get_energy_drift',
    'get_kuramoto_r',
    'evaluate_lens_refraction',
];
// КОНЕЦ РАЗДЕЛА 1

// ============================================================================
// НАЧАЛО РАЗДЕЛА 2. СБОРКА RUST ДЛЯ wasm32-unknown-unknown
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ buildRustArtifact ---
function buildRustArtifact() {
    console.log(`[build:wasm] Building physics_engine for ${target}.`);
    const result = spawnSync('cargo', [
        'build',
        '--manifest-path', manifestPath,
        '--target', target,
        '--release',
        '--locked',
    ], {
        cwd: repositoryRoot,
        env: { ...process.env, CARGO_TARGET_DIR: targetDirectory },
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
        windowsHide: true,
    });

    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);

    if (result.error) {
        if (result.error.code === 'ENOENT') {
            throw new Error(`cargo was not found. Install Rust with rustup, then run: ${targetInstallCommand}`);
        }
        throw new Error(`Could not run cargo: ${result.error.message}`);
    }
    if (result.status !== 0) {
        const diagnostics = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
        if (/E0463|target may not be installed|can't find crate for [`'](?:core|std)[`']/i.test(diagnostics)) {
            throw new Error(`The ${target} Rust target is unavailable. Run: ${targetInstallCommand}`);
        }
        throw new Error(`cargo build failed (${result.signal ? `signal ${result.signal}` : `exit ${result.status}`}). The published WASM file was not changed.`);
    }
}
// --- КОНЕЦ ФУНКЦИИ buildRustArtifact ---
// КОНЕЦ РАЗДЕЛА 2

// ============================================================================
// НАЧАЛО РАЗДЕЛА 3. ПРОВЕРКА WEBASSEMBLY И ВЕРСИИ ABI
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ validateRawWasm ---
async function validateRawWasm(bytes) {
    const signature = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];
    if (bytes.length < signature.length || !signature.every((value, index) => bytes[index] === value)) {
        throw new Error('The Rust artifact does not have a valid WebAssembly v1 binary header.');
    }

    const module = await WebAssembly.compile(bytes);
    const imports = WebAssembly.Module.imports(module);
    if (imports.length !== 0) {
        const names = imports.map(({ module: moduleName, name }) => `${moduleName}.${name}`).join(', ');
        throw new Error(`Raw WASM ABI v1 must have no imports or JavaScript glue. Found: ${names}`);
    }

    const exports = WebAssembly.Module.exports(module);
    const exportKinds = new Map(exports.map(({ name, kind }) => [name, kind]));
    if (exportKinds.get('memory') !== 'memory') {
        throw new Error('Raw WASM ABI v1 requires an exported memory.');
    }
    for (const name of requiredFunctionExports) {
        if (exportKinds.get(name) !== 'function') {
            throw new Error(`Raw WASM ABI v1 requires the function export: ${name}`);
        }
    }
    const glueExports = exports.filter(({ name }) => /^__w(?:bindgen|bg)/.test(name));
    if (glueExports.length > 0) {
        throw new Error(`The artifact contains wasm-bindgen glue exports: ${glueExports.map(({ name }) => name).join(', ')}`);
    }

    const instance = await WebAssembly.instantiate(module, {});
    const abiVersion = instance.exports.get_abi_version();
    if (abiVersion !== 1) {
        throw new Error(`Expected raw WASM ABI version 1, received ${String(abiVersion)}.`);
    }
}
// --- КОНЕЦ ФУНКЦИИ validateRawWasm ---
// КОНЕЦ РАЗДЕЛА 3

// ============================================================================
// НАЧАЛО РАЗДЕЛА 4. АТОМАРНАЯ ПУБЛИКАЦИЯ И ОБРАБОТКА ОШИБКИ ЗАПУСКА
// ============================================================================

// --- НАЧАЛО ФУНКЦИИ main ---
async function main() {
    buildRustArtifact();
    const bytes = await readFile(artifactPath);
    await validateRawWasm(bytes);

    await mkdir(dirname(destinationPath), { recursive: true });
    const temporaryPath = `${destinationPath}.${process.pid}.${randomUUID()}.tmp`;
    try {
        await writeFile(temporaryPath, bytes, { flag: 'wx' });
        await rename(temporaryPath, destinationPath);
    } finally {
        await rm(temporaryPath, { force: true });
    }
    console.log(`[build:wasm] Published validated ABI v1 (${bytes.length} bytes, no imports): ${destinationPath}`);
}
// --- КОНЕЦ ФУНКЦИИ main ---

// --- НАЧАЛО ФУНКЦИИ reportFailure ---
function reportFailure(error) {
    console.error(`[build:wasm] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
// --- КОНЕЦ ФУНКЦИИ reportFailure ---

main().catch(reportFailure);
// КОНЕЦ РАЗДЕЛА 4
