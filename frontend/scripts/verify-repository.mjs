// ============================================================================
// ФАЙЛ: frontend/scripts/verify-repository.mjs
// НАЗНАЧЕНИЕ: Проверка исходников, локальных импортов и npm entry points в Git.
// ФУНКЦИИ: readGitPaths, tokenizeCommand, findNodeEntries, tokenizeSource,
// findRelativeImports, resolveIndexedImport, isRepositoryFile, verifyRepository, runSelfTests.
// ОГЛАВЛЕНИЕ ФУНКЦИЙ И РАЗДЕЛОВ:
//   1. Зависимости, пути и чтение списков Git.
//   2. Разбор команд npm и определение файлов запуска Node.js.
//   3. Литеральные относительные импорты и точные пути Git.
//   4. Проверка package scripts, импортов и неотслеживаемых исходников/fixtures.
//   5. Самопроверки и запуск проверки репозитория.
// ============================================================================

// НАЧАЛО РАЗДЕЛА 1. ЗАВИСИМОСТИ, ПУТИ И ЧТЕНИЕ СПИСКОВ GIT
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

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

// НАЧАЛО РАЗДЕЛА 3. ЛОКАЛЬНЫЕ ИМПОРТЫ И ТОЧНЫЕ ПУТИ GIT
// НАЧАЛО ФУНКЦИИ tokenizeSource
/** Пропускает комментарии, шаблоны и regex; содержимое строк не становится кодом. */
function tokenizeSource(source) {
    const tokens = [];
    for (let i = 0; i < source.length;) {
        const c = source[i], next = source[i + 1];
        if (/\s/.test(c)) { i++; continue; }
        if (c === '/' && next === '/') { while (i < source.length && source[i] !== '\n') i++; continue; }
        if (c === '/' && next === '*') { const end = source.indexOf('*/', i + 2); i = end < 0 ? source.length : end + 2; continue; }
        if (c === '"' || c === "'" || c === '`') {
            const start = i++, quote = c;
            let value = '';
            while (i < source.length && source[i] !== quote) {
                if (source[i] === '\\') { i++; if (i < source.length) value += source[i++]; }
                else value += source[i++];
            }
            i++;
            tokens.push({ kind: quote === '`' ? 'template' : 'string', value, start });
            continue;
        }
        const previous = tokens.at(-1);
        const regexPosition = !previous || (previous.kind === 'punct' && '=(:,[!&|?;{'.includes(previous.value)) ||
            (previous.kind === 'word' && ['return', 'throw', 'case', 'yield'].includes(previous.value)) ||
            (previous.value === '>' && tokens.at(-2)?.value === '=');
        if (c === '/' && regexPosition) {
            i++;
            let inClass = false;
            while (i < source.length) {
                if (source[i] === '\\') { i += 2; continue; }
                if (source[i] === '[') inClass = true;
                if (source[i] === ']') inClass = false;
                if (source[i++] === '/' && !inClass) break;
            }
            while (/[A-Za-z]/.test(source[i] ?? '')) i++;
            tokens.push({ kind: 'punct', value: '<regex>', start: i });
            continue;
        }
        if (/[A-Za-z_$]/.test(c)) {
            const start = i++;
            while (/[\w$]/.test(source[i] ?? '')) i++;
            tokens.push({ kind: 'word', value: source.slice(start, i), start });
        } else tokens.push({ kind: 'punct', value: source[i], start: i++ });
    }
    return tokens;
}
// КОНЕЦ ФУНКЦИИ tokenizeSource

// НАЧАЛО ФУНКЦИИ findRelativeImports
/** Только литеральные ES-импорты: шаблоны, glob и bare package specifiers не исполняются. */
export function findRelativeImports(source) {
    const tokens = tokenizeSource(source), found = [];
    const add = (token) => {
        if (token?.kind === 'string' && /^\.\.?\//.test(token.value)) {
            found.push({ specifier: token.value, line: source.slice(0, token.start).split('\n').length });
        }
    };
    for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token.kind !== 'word' || !['import', 'export'].includes(token.value) || tokens[i - 1]?.value === '.') continue;
        if (token.value === 'import') {
            if (tokens[i + 1]?.kind === 'string') { add(tokens[i + 1]); continue; }
            if (tokens[i + 1]?.value === '(') { add(tokens[i + 2]); continue; }
            if (tokens[i + 1]?.value === '.') continue;
        } else if (!['{', '*'].includes(tokens[i + 1]?.value) &&
            !(tokens[i + 1]?.value === 'type' && tokens[i + 2]?.value === '{')) continue;
        for (let j = i + 1; j < tokens.length && tokens[j].value !== ';'; j++) {
            if (j > i + 1 && tokens[j].kind === 'word' && ['import', 'export'].includes(tokens[j].value)) break;
            if (tokens[j].kind === 'word' && tokens[j].value === 'from' && tokens[j + 1]?.kind === 'string') { add(tokens[j + 1]); break; }
        }
    }
    return found;
}
// КОНЕЦ ФУНКЦИИ findRelativeImports

// НАЧАЛО ФУНКЦИИ resolveIndexedImport
export function resolveIndexedImport(importer, specifier, indexedPaths, isFile) {
    const clean = specifier.split(/[?#]/, 1)[0];
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(importer), clean));
    if (base.startsWith('../') || path.posix.isAbsolute(base)) return 'Import escapes repository';
    const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs', '.json', '.d.ts'];
    const asset = /\.(?:css|wgsl|json|astro|ttf|woff2?|svg|png|jpe?g|webp|gif|mp3|wav|wasm)$/i.test(base);
    const candidates = asset ? [base] : [base, ...extensions.map(ext => base + ext),
        ...extensions.map(ext => base + '/index' + ext)];
    if (/\.js$/.test(base)) candidates.push(...['.ts', '.tsx', '.d.ts'].map(ext => base.slice(0, -3) + ext));
    const tracked = candidates.find(candidate => indexedPaths.has(candidate));
    if (tracked) return isFile(tracked) ? null : `Missing imported file: ${tracked}`;
    const lowerPaths = new Map([...indexedPaths].map(file => [file.toLowerCase(), file]));
    const differentCase = candidates.map(candidate => lowerPaths.get(candidate.toLowerCase())).find(Boolean);
    if (differentCase) return `Import path casing differs from Git: ${differentCase}`;
    const local = candidates.find(isFile);
    return local ? `Imported file is not tracked in Git: ${local}` : `Unresolved relative import: ${specifier}`;
}
// КОНЕЦ ФУНКЦИИ resolveIndexedImport

// НАЧАЛО ФУНКЦИИ isRepositoryFile
function isRepositoryFile(file) {
    try { return statSync(path.join(repositoryRoot, file)).isFile(); }
    catch (error) { if (['ENOENT', 'ENOTDIR'].includes(error.code)) return false; throw error; }
}
// КОНЕЦ ФУНКЦИИ isRepositoryFile
// КОНЕЦ РАЗДЕЛА 3

// НАЧАЛО РАЗДЕЛА 4. ПРОВЕРКА PACKAGE SCRIPTS, ИМПОРТОВ И НЕОТСЛЕЖИВАЕМЫХ ИСХОДНИКОВ

// НАЧАЛО ФУНКЦИИ verifyRepository
function verifyRepository() {
    const indexedPaths = readGitPaths('--cached');
    const untrackedPaths = readGitPaths('--others', '--exclude-standard');
    const packagePaths = [...new Set(['package.json', ...indexedPaths, ...untrackedPaths])]
        .filter((file) => file === 'package.json' || file.endsWith('/package.json'))
        .sort();
    const issues = [];
    let checkedEntries = 0;
    let checkedImports = 0;
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
    for (const file of indexedPaths) {
        if (!/\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) || !isRepositoryFile(file)) continue;
        for (const { specifier, line } of findRelativeImports(readFileSync(path.join(repositoryRoot, file), 'utf8'))) {
            checkedImports++;
            const issue = resolveIndexedImport(file, specifier, indexedPaths, isRepositoryFile);
            if (issue) issues.push(`${file}:${line} -> ${specifier}: ${issue}`);
        }
    }
    if (issues.length > 0) {
        throw new Error([
            'Repository source completeness check failed:',
            ...issues.map((issue) => `  - ${issue}`),
            'Add the intended source files to Git before committing; CI can only use files included in the commit.',
        ].join('\n'));
    }
    console.log(`[verify:repo] Passed: ${packagePaths.length} package manifests, ${checkedEntries} Node entry points and ${checkedImports} relative imports tracked in Git, no untracked source files or shared fixtures.`);
}
// КОНЕЦ ФУНКЦИИ verifyRepository
// КОНЕЦ РАЗДЕЛА 4

// НАЧАЛО РАЗДЕЛА 5. САМОПРОВЕРКИ И ЗАПУСК ПРОВЕРКИ РЕПОЗИТОРИЯ
// НАЧАЛО ФУНКЦИИ runSelfTests
function runSelfTests() {
    const source = [
        '// import "./comment";', '/* export * from "./comment2"; */',
        'const text = "import(\'./string\')";', 'const template = `import "./template";`;',
        String.raw`const pattern = /import "\.\/regex"/;`, 'import type {', ' A, B', '} from "./types";',
        'import "./theme.css";', 'export type { C } from "../shared/contracts";',
        'export * from "./public";', 'const lazy = import("./lazy");',
        'import shader from "./shape.wgsl?raw";', 'import data from "./fixture.json";',
        'import { tool } from "node:fs";', 'const files = import.meta.glob("./*.ttf");',
    ].join('\n');
    assert.deepEqual(findRelativeImports(source).map(entry => entry.specifier),
        ['./types', './theme.css', '../shared/contracts', './public', './lazy', './shape.wgsl?raw', './fixture.json']);
    const indexed = new Set(['src/types.ts', 'src/theme.css', 'src/public/index.ts', 'src/shape.wgsl', 'src/fixture.json', 'src/Case.ts']);
    const disk = new Set([...indexed, 'src/local.ts']);
    const resolve = specifier => resolveIndexedImport('src/main.ts', specifier, indexed, file => disk.has(file));
    assert.equal(resolve('./types'), null); assert.equal(resolve('./public'), null);
    assert.equal(resolve('./shape.wgsl?raw'), null); assert.equal(resolve('./fixture.json'), null);
    assert.match(resolve('./local'), /not tracked/); assert.match(resolve('./missing'), /Unresolved/);
    assert.match(resolve('./case'), /casing/); assert.match(resolve('../../outside'), /escapes/);
    disk.delete('src/types.ts'); assert.match(resolve('./types'), /Missing imported file/);
    // Все три отсутствующих модуля диагностируются, даже если локальные файлы существуют.
    const missing = ['core/frameDiagnostics.ts', 'tests/frameDiagnostics.test.ts', 'tests/glyphFontBudget.test.ts'];
    for (const file of missing) assert.match(resolveIndexedImport('frontend/src/main.ts', './' + file.slice(0, -3), new Set(),
        candidate => candidate === 'frontend/src/' + file), /not tracked/);
    console.log('[verify:repo] Import guard self-tests passed (syntax, index, casing, assets and missing modules).');
}
// КОНЕЦ ФУНКЦИИ runSelfTests
try {
    if (process.argv.includes('--self-test')) runSelfTests();
    else { runSelfTests(); verifyRepository(); }
} catch (error) {
    console.error(`[verify:repo] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
}
// КОНЕЦ РАЗДЕЛА 5
