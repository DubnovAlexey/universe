// ============================================================================
// ФАЙЛ: frontend/src/engine/renderer.ts
// НАЗНАЧЕНИЕ: Совместимая точка входа рендеринга, стили и клиентский автозапуск.
// РАЗДЕЛЫ: 1. Стили и публичные экспорты; 2. Автозапуск после готовности DOM.
// ============================================================================

import '../styles/universe.css';
import { UniverseRenderer } from './UniverseRenderer';
import { bootstrapUniverseV2 } from './bootstrap';

export { UniverseRenderer };
export { activeRenderer, getUniverseRenderer, bootstrapUniverseV2 } from './bootstrap';
export default UniverseRenderer;

// --- НАЧАЛО РАЗДЕЛА 2. КЛИЕНТСКИЙ АВТОЗАПУСК ---
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapUniverseV2);
    } else {
        bootstrapUniverseV2();
    }
}
// --- КОНЕЦ РАЗДЕЛА 2. КЛИЕНТСКИЙ АВТОЗАПУСК ---
