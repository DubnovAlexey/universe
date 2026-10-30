// ============================================================================
// ФАЙЛ: frontend/src/tests/qualityGovernor.test.ts
// НАЗНАЧЕНИЕ: Проверить гистерезис качества и честный p95 при задержках/ошибочных данных.
// РАЗДЕЛЫ: 1. Автоматический бюджет; 2. Скользящая статистика; 3. Явный выбор качества.
// ФУНКЦИИ: runQualityGovernorChecks.
// ============================================================================
import { QualityGovernor } from '../core/qualityGovernor';

// НАЧАЛО ФУНКЦИИ runQualityGovernorChecks
export function runQualityGovernorChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 1. АВТОМАТИЧЕСКИЙ БЮДЖЕТ
    const adaptive = new QualityGovernor('');
    for (let i = 0; i < 45; i++) adaptive.feedFrameTime(50, i * 50);
    const beforeCooldown = adaptive.getProfile().tier;
    const firstDrop = adaptive.feedFrameTime(50, 3500);
    const earlyDrop = adaptive.feedFrameTime(50, 6999);
    const secondDrop = adaptive.feedFrameTime(50, 7000);
    check(beforeCooldown === 'HIGH' && firstDrop === 'MEDIUM' && earlyDrop === 'MEDIUM' && secondDrop === 'LOW',
        'Sustained slow frames lower quality one tier at a time with the existing 3.5-second cooldown');

    for (let i = 1; i <= 60; i++) adaptive.feedFrameTime(8, 7000 + i * 50);
    const beforeRecovery = adaptive.getProfile().tier;
    const firstRecovery = adaptive.feedFrameTime(8, 10500);
    const earlyRecovery = adaptive.feedFrameTime(8, 13999);
    const secondRecovery = adaptive.feedFrameTime(8, 14000);
    check(beforeRecovery === 'LOW' && firstRecovery === 'MEDIUM' && earlyRecovery === 'MEDIUM' && secondRecovery === 'HIGH',
        'Stable headroom restores one tier per cooldown instead of oscillating on a short fast burst');

    const guarded = new QualityGovernor('');
    guarded.feedFrameTime(16, 100);
    for (const value of [Number.NaN, Infinity, -Infinity, -5]) guarded.feedFrameTime(value, 200);
    for (const time of [Number.NaN, Infinity, -1, 50]) guarded.feedFrameTime(2000, time);
    const afterInvalid = guarded.getFrameP95Ms();
    for (let i = 0; i < 50; i++) guarded.feedFrameTime(50, 4000 + i * 100);
    check(afterInvalid === 16 && guarded.getProfile().tier === 'LOW' && guarded.getFrameP95Ms() === 50,
        'Invalid durations and nonmonotonic timestamps cannot poison later EMA, p95 or cooldown decisions');
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. СКОЛЬЗЯЩАЯ СТАТИСТИКА
    const actual = new QualityGovernor('');
    for (let i = 0; i < 45; i++) actual.feedFrameTime(i < 3 ? 1450 : 16, i * 16);
    const longP95 = actual.getFrameP95Ms();
    for (let i = 45; i < 48; i++) actual.feedFrameTime(16, i * 16);
    check(longP95 === 1450 && actual.getFrameP95Ms() === 16,
        'UI p95 retains actual long intervals above 100ms and expires them when they leave the last 45 frames');

    const ordered = new QualityGovernor('');
    const expected: number[] = [];
    let agrees = ordered.getFrameP95Ms() === 16.7;
    for (let i = 0; i < 200; i++) {
        const value = (i * 37) % 79 + (i % 13 === 0 ? 1500 : 0) + 0.23;
        ordered.feedFrameTime(value, i * 20);
        expected.push(Math.max(1, value));
        if (expected.length > 45) expected.shift();
        const sorted = [...expected].sort((a, b) => a - b);
        const p95 = Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! * 10) / 10;
        agrees &&= ordered.getFrameP95Ms() === p95;
    }
    check(agrees, 'The allocation-free ordered window matches exact p95 through duplicates, eviction and ring wraparound');
    // КОНЕЦ РАЗДЕЛА 2

    // НАЧАЛО РАЗДЕЛА 3. ЯВНЫЙ ВЫБОР КАЧЕСТВА
    const locked = new QualityGovernor('?quality=low');
    for (let i = 0; i < 100; i++) locked.feedFrameTime(4, i * 1000);
    const urlLock = locked.getProfile().tier;
    locked.setTierManual('HIGH');
    for (let i = 100; i < 200; i++) locked.feedFrameTime(80, i * 1000);
    check(urlLock === 'LOW' && locked.getProfile().tier === 'HIGH' && locked.getProfile().maxDpr === 2 &&
        locked.getFrameP95Ms() === 80,
        'Explicit quality remains locked while real frame statistics continue; HIGH keeps the actual DPR cap of two');
    // КОНЕЦ РАЗДЕЛА 3
}
// КОНЕЦ ФУНКЦИИ runQualityGovernorChecks
