// ============================================================================
// ФАЙЛ: frontend/src/tests/nodeCallout.test.ts
// НАЗНАЧЕНИЕ: Проверить размещение инженерных подписей у краёв и при высоком DPR.
// РАЗДЕЛЫ: 1. Безопасная геометрия; 2. Реальный контракт Canvas-прохода.
// ФУНКЦИИ: runNodeCalloutChecks.
// ============================================================================
import { getNodeCalloutLayout, renderBorderlessNodeCallout } from '../engine/passes/nodeCallout';
import type { QuantumParticle } from '../phases/01_void';

// НАЧАЛО ФУНКЦИИ runNodeCalloutChecks
export function runNodeCalloutChecks(check: (passed: boolean, description: string) => void): void {
    // НАЧАЛО РАЗДЕЛА 1. БЕЗОПАСНАЯ ГЕОМЕТРИЯ
    const right = getNodeCalloutLayout(390, 844, 382, 420, 195, 9, 3, 0);
    const left = getNodeCalloutLayout(390, 844, 1, 420, 195, 9, 3, 0);
    check(right.side === -1 && right.x >= 10 && right.x + right.maxWidth <= 380 &&
        left.side === 1 && left.x >= 10 && left.x + left.maxWidth <= 380,
        'Node callouts choose the free side and retain their full text inside both horizontal edges');
    const top = getNodeCalloutLayout(320, 568, 160, -20, 185, 9, 3, -2.2);
    const bottom = getNodeCalloutLayout(320, 568, 160, 580, 185, 9, 3, 2.2);
    const long = getNodeCalloutLayout(320, 568, 160, 280, 600, 9, 3, 0);
    check(top.y - 9 >= 10 && bottom.y + 3 <= 558 && long.maxWidth === 300 &&
        long.x === 10 && long.x + long.maxWidth === 310,
        'Callout ink and long-label fitting retain a ten-pixel gutter at every viewport edge');
    // КОНЕЦ РАЗДЕЛА 1

    // НАЧАЛО РАЗДЕЛА 2. КОНТРАКТ CANVAS И DPR
    const positions: number[][] = [];
    const particle = { id: 115, moduleTag: 'wgsl/breach.wgsl' } as QuantumParticle;
    let dpr = 1;
    let font = '';
    const context = {
        canvas: { width: 390, height: 844 }, globalAlpha: 1, textAlign: '', textBaseline: '',
        set font(value: string) { font = value; },
        get font() { return font; },
        measureText() { return { width: 195, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 }; },
        getTransform() { return { a: dpr, b: 0, c: 0, d: dpr }; },
        save() {}, restore() {}, beginPath() {}, moveTo() {}, quadraticCurveTo() {}, stroke() {},
        fillText(_text: string, x: number, y: number, width: number) { positions.push([x, y, width]); },
    } as unknown as CanvasRenderingContext2D;
    renderBorderlessNodeCallout(context, 382, 835, particle, 1, 0.8);
    dpr = 2;
    context.canvas.width = 780; context.canvas.height = 1688;
    renderBorderlessNodeCallout(context, 382, 835, particle, 1, 0.8);
    check(JSON.stringify(positions[0]) === JSON.stringify(positions[1]) && positions[1][0] + positions[1][2] <= 380 &&
        positions[1][1] + 3 <= 834 && font.includes('"Universe Glyphs"') && !font.includes('JetBrains'),
        'Canvas callout layout uses CSS dimensions at DPR1 and2 and the available project font stack');
    const draws = positions.length;
    renderBorderlessNodeCallout(context, 382, 835, particle, 1, 0.01);
    renderBorderlessNodeCallout(context, NaN, 835, particle, 1, 0.8);
    check(positions.length === draws,
        'Invisible or invalid callouts skip all text and leader drawing');
    // КОНЕЦ РАЗДЕЛА 2
}
// КОНЕЦ ФУНКЦИИ runNodeCalloutChecks
