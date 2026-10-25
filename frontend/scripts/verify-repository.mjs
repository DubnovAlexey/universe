// ============================================================================
// ФАЙЛ: frontend/scripts/verify-repository.mjs
// НАЗНАЧЕНИЕ: Проверка наличия исходников и npm entry points в индексе Git.
// ФУНКЦИИ: Чтение индекса, разбор node-команд и диагностика неполного checkout.
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, пути и чтение списков Git.
//   2. Разбор команд npm и определение файлов запуска Node.js.
//   3. Проверка package scripts и неотслеживаемых исходников/fixtures.
//   4. Запуск проверки и диагностика ошибки.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ЗАВИСИМОСТИ, ПУТИ И ЧТЕНИЕ СПИСКОВ GIT
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceDirectories = [
    'frontend/src/', 'frontend/scripts/', 'backend/', 'physics_engine/src/', '.github/',
    'shared/', 'tests/fixtures/', 'fixtures/', 'frontend/public/fonts/',
];

// НАЧАЛО ФУНКЦИИ readGitPaths
function readGitPaths(...args) {
    const result = spawnSync('git', ['-C', repositoryRoot, 'ls-files', '-z', ...args], {
        cwd: repositoryRoot,
        encoding: 'utf8',
        windowsHide: true,
        maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error) throw new Error(`Could not run Git: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`Could not read the Git index: ${result.stderr.trim()}`);
    return new Set(result.stdout.split('\0').filter(Boolean));
}
// КОНЕЦ ФУНКЦИИ readGitPaths
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. РАЗБОР КОМАНД NPM И ФАЙЛОВ ЗАПУСКА NODE.JS

// НАЧАЛО ФУНКЦИИ tokenizeCommand
function tokenizeCommand(command) {
    const tokens = [];
    let token = '';
    let quote = null;
    let started = false;
    for (let index = 0; index < command.length; index++) {
        const character = command[index];
        if (quote) {
            if (character === quote) quote = null;
            else if (character === '\\' && command[index + 1] === quote) token += command[++index];
            else token += character;
        } else if (character === '"' || character === "'") {
            quote = character;
            started = true;
        } else if (/\s/.test(character) || /[;&|]/.test(character)) {
            if (started) tokens.push(token);
            token = '';
            started = false;
            if (/[;&|]/.test(character)) {
                tokens.push(character);
                if (command[index + 1] === character) index++;
            }
        } else {
            token += character;
            started = true;
        }
    }
    if (quote) throw new Error('Unclosed quote in an npm script.');
    if (started) tokens.push(token);
    return tokens;
}
// КОНЕЦ ФУНКЦИИ tokenizeCommand

// НАЧАЛО ФУНКЦИИ findNodeEntries
function findNodeEntries(command) {
    const tokens = tokenizeCommand(command);
    const entries = [];
    const optionsWithValues = new Set([
        '-r', '--require', '--import', '--loader', '--experimental-loader',
        '-C', '--conditions', '--input-type', '--title', '--icu-data-dir',
    ]);
    let commandStart = true;
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index];
        if (/^[;&|]$/.test(token)) {
            commandStart = true;
            continue;
        }
        if (!commandStart) continue;
        if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(token)) continue;
        commandStart = false;
        if (!/(?:^|[/\\])node(?:\.exe)?$/i.test(token)) continue;
        for (index++; index < tokens.length && !/^[;&|]$/.test(tokens[index]); index++) {
            const argument = tokens[index];
            // Inline evaluation, printing and npm-style --run do not name a file.
            if (/^(?:--(?:eval|print|run)(?:=|$)|-[ep])/.test(argument)) break;
            if (argument === '-') break;
            if (argument === '--') {
                const entry = tokens[index + 1];
                if (entry && !/^[;&|]$/.test(entry)) entries.push(entry);
                break;
            }
            if (optionsWithValues.has(argument)) {
                index++;
                continue;
            }
            if (argument.startsWith('-')) continue;
            entries.push(argument);
            break;
        }
        // Resume at the next shell command without interpreting JavaScript as paths.
        while (index < tokens.length && !/^[;&|]$/.test(tokens[index])) index++;
        if (index < tokens.length) commandStart = true;
    }
    return entries;
}
// КОНЕЦ ФУНКЦИИ findNodeEntries
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ПРОВЕРКА PACKAGE SCRIPTS И НЕОТСЛЕЖИВАЕМЫХ ИСХОДНИКОВ

// НАЧАЛО ФУНКЦИИ verifyRepository
function verifyRepository() {
    const indexedPaths = readGitPaths('--cached');
    const untrackedPaths = readGitPaths('--others', '--exclude-standard');
    const packagePaths = [...new Set(['package.json', ...indexedPaths, ...untrackedPaths])]
        .filter((file) => file === 'package.json' || file.endsWith('/package.json'))
        .sort();
    const issues = [];
    let checkedEntries = 0;
    for (const packagePath of packagePaths) {
        const absolutePackagePath = path.join(repositoryRoot, packagePath);
        const manifest = JSON.parse(readFileSync(absolutePackagePath, 'utf8'));
        for (const [scriptName, command] of Object.entries(manifest.scripts ?? {})) {
            for (const entry of findNodeEntries(command)) {
                checkedEntries++;
                const absoluteEntryPath = path.resolve(path.dirname(absolutePackagePath), entry);
                const relativeEntryPath = path.relative(repositoryRoot, absoluteEntryPath).split(path.sep).join('/');
                const label = `${packagePath} (${scriptName}) -> ${relativeEntryPath}`;
                if (relativeEntryPath.startsWith('../') || path.isAbsolute(relativeEntryPath)) {
                    issues.push(`Node entry point is outside this repository: ${label}`);
                    continue;
                }
                let isFile = false;
                try {
                    isFile = statSync(absoluteEntryPath).isFile();
                } catch (error) {
                    if (!['ENOENT', 'ENOTDIR'].includes(error.code)) throw error;
                }
                if (!isFile) issues.push(`Missing Node entry point file: ${label}`);
                if (!indexedPaths.has(relativeEntryPath)) {
                    issues.push(`Node entry point is not tracked in the Git index: ${label}`);
                }
            }
        }
    }
    const untrackedSources = [...untrackedPaths].filter((file) =>
        sourceDirectories.some((directory) => file.startsWith(directory)) ||
        /(?:^|\/)fixtures?\//.test(file)
    ).sort();
    for (const file of untrackedSources) issues.push(`Untracked source or shared test fixture: ${file}`);
    if (issues.length > 0) {
        throw new Error([
            'Repository source completeness check failed:',
            ...issues.map((issue) => `  - ${issue}`),
            'Add the intended source files to Git before committing; CI can only use files included in the commit.',
        ].join('\n'));
    }
    console.log(`[verify:repo] Passed: ${packagePaths.length} package manifests, ${checkedEntries} Node entry points tracked in the Git index, no untracked source files or shared fixtures.`);
}
// КОНЕЦ ФУНКЦИИ verifyRepository
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ЗАПУСК ПРОВЕРКИ И ДИАГНОСТИКА ОШИБКИ
try {
    verifyRepository();
} catch (error) {
    console.error(`[verify:repo] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
// КОНЕЦ РАЗДЕЛА 4
