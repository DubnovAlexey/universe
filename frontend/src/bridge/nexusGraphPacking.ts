// ============================================================================
// ФАЙЛ: frontend/src/bridge/nexusGraphPacking.ts
// НАЗНАЧЕНИЕ: Плоская упаковка графа NEXUS для передачи между потоками без копирования
//             (Transferable ArrayBuffer) и без сотен промежуточных объектов в главном потоке.
// РАЗДЕЛЫ: 1. Формат записи ребра; 2. Упаковка; 3. Чтение.
// ФУНКЦИИ: packComputedGraph, readPackedEdgeClass, readPackedEdgeLut.
// ============================================================================

import type { ComputedEdgeClass, ComputedGraphEdge } from './simulationWorker';

// НАЧАЛО РАЗДЕЛА 1. ФОРМАТ ЗАПИСИ РЕБРА
/**
 * 0 fromIndex, 1 toIndex, 2 класс, 3 x1, 4 y1, 5 x2, 6 y2, 7 ctrlX, 8 ctrlY,
 * 9 arcLength, 10–14 lengthLUT, 15 murrayRadiusPx. Идентификатор ребра строится
 * в главном потоке из стабильных id частиц и кэшируется.
 */
export const NEXUS_EDGE_STRIDE = 16;
const EDGE_CLASSES: readonly ComputedEdgeClass[] = ['AXON_TRUNK', 'BRIDGE', 'DENDRITE'];
export interface PackedNexusGraph {
    readonly edges: Float64Array;
    /** Пары [индекс частицы, степень] для всех активных узлов. */
    readonly degrees: Int32Array;
}
// КОНЕЦ РАЗДЕЛА 1

// НАЧАЛО РАЗДЕЛА 2. УПАКОВКА
// НАЧАЛО ФУНКЦИИ packComputedGraph
export function packComputedGraph(edges: readonly ComputedGraphEdge[], degreeByIndex: ReadonlyMap<number, number>): PackedNexusGraph {
    const packed = new Float64Array(edges.length * NEXUS_EDGE_STRIDE);
    edges.forEach((edge, index) => {
        const base = index * NEXUS_EDGE_STRIDE;
        packed[base] = edge.fromIndex;
        packed[base + 1] = edge.toIndex;
        packed[base + 2] = Math.max(0, EDGE_CLASSES.indexOf(edge.edgeClass));
        packed[base + 3] = edge.x1;
        packed[base + 4] = edge.y1;
        packed[base + 5] = edge.x2;
        packed[base + 6] = edge.y2;
        packed[base + 7] = edge.ctrlX;
        packed[base + 8] = edge.ctrlY;
        packed[base + 9] = edge.arcLength;
        for (let k = 0; k < 5; k++) packed[base + 10 + k] = edge.lengthLUT[k];
        packed[base + 15] = edge.murrayRadiusPx;
    });
    const degrees = new Int32Array(degreeByIndex.size * 2);
    let cursor = 0;
    degreeByIndex.forEach((degree, index) => { degrees[cursor++] = index; degrees[cursor++] = degree; });
    return { edges: packed, degrees };
}
// КОНЕЦ ФУНКЦИИ packComputedGraph
// КОНЕЦ РАЗДЕЛА 2

// НАЧАЛО РАЗДЕЛА 3. ЧТЕНИЕ
// НАЧАЛО ФУНКЦИИ readPackedEdgeClass
export function readPackedEdgeClass(code: number): ComputedEdgeClass {
    return EDGE_CLASSES[code] ?? 'DENDRITE';
}
// КОНЕЦ ФУНКЦИИ readPackedEdgeClass

// НАЧАЛО ФУНКЦИИ readPackedEdgeLut
export function readPackedEdgeLut(packed: Float64Array, base: number): [number, number, number, number, number] {
    return [packed[base + 10], packed[base + 11], packed[base + 12], packed[base + 13], packed[base + 14]];
}
// КОНЕЦ ФУНКЦИИ readPackedEdgeLut
// КОНЕЦ РАЗДЕЛА 3
