# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/core/graph_logic.py
# НАЗНАЧЕНИЕ: Эталонная топология NEXUS: MST, Gabriel, Murray и метрики BFS.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. build_bezier_arc_length_lut.
# 3. _compute_authentic_invariants.
# 4. compute_nexus_topology.
# Функции: build_bezier_arc_length_lut, _make_curve_edge, _compute_authentic_invariants,
# compute_nexus_topology.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
from collections import deque
from dataclasses import dataclass
import math
import time
from typing import Sequence


# --- НАЧАЛО КЛАССА GraphNodeDTO ---
@dataclass(frozen=True)
class GraphNodeDTO:
    index: int
    node_id: int
    x: float
    y: float
    cluster_id: int
    energy: float
# --- КОНЕЦ КЛАССА GraphNodeDTO ---


# --- НАЧАЛО КЛАССА ComputedEdgeDTO ---
@dataclass(frozen=True)
class ComputedEdgeDTO:
    edge_id: str
    from_index: int
    to_index: int
    edge_class: str  # 'AXON_TRUNK' | 'BRIDGE' | 'DENDRITE'
    x1: float
    y1: float
    x2: float
    y2: float
    ctrl_x: float
    ctrl_y: float
    arc_length: float
    length_lut: tuple[float, float, float, float, float]
    murray_radius_px: float
# --- КОНЕЦ КЛАССА ComputedEdgeDTO ---


# --- НАЧАЛО КЛАССА GraphTopologyMetricsDTO ---
@dataclass(frozen=True)
class GraphTopologyMetricsDTO:
    trunk_count: int
    bridge_count: int
    dendrite_count: int
    avg_degree: float
    clustering_coeff: float
    diameter_hops: int
    avg_path_length: float
    compute_time_ms: float
    compute_source: str
# --- КОНЕЦ КЛАССА GraphTopologyMetricsDTO ---


# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: build_bezier_arc_length_lut ---
# --- НАЧАЛО ФУНКЦИИ build_bezier_arc_length_lut ---
def build_bezier_arc_length_lut(
        x0: float,
        y0: float,
        cx: float,
        cy: float,
        x2: float,
        y2: float,
) -> tuple[float, tuple[float, float, float, float, float]]:
    """Строит 5-точечную таблицу накопленной длины дуги квадратичной кривой Безье."""
    lut: list[float] = [0.0]
    prev_x = x0
    prev_y = y0
    total_len = 0.0

    for step in range(1, 5):
        t = step * 0.25
        inv = 1.0 - t
        px = inv * inv * x0 + 2.0 * inv * t * cx + t * t * x2
        py = inv * inv * y0 + 2.0 * inv * t * cy + t * t * y2
        total_len += math.hypot(px - prev_x, py - prev_y)
        lut.append(round(total_len, 2))
        prev_x = px
        prev_y = py

    safe_total = max(1.0, round(total_len, 2))
    return safe_total, (lut[0], lut[1], lut[2], lut[3], lut[4])
# --- КОНЕЦ ФУНКЦИИ build_bezier_arc_length_lut ---


# --- НАЧАЛО ФУНКЦИИ _make_curve_edge ---
def _make_curve_edge(
        a: GraphNodeDTO,
        b: GraphNodeDTO,
        edge_class: str,
        bend_sign: int,
        bend_scale: float,
        sim_time_sec: float,
        murray_radius_px: float,
) -> ComputedEdgeDTO:
    mid_x = (a.x + b.x) * 0.5
    mid_y = (a.y + b.y) * 0.5
    dx = b.x - a.x
    dy = b.y - a.y
    ctrl_offset = math.sin(sim_time_sec * 0.65 + (a.node_id + b.node_id) * 0.1) * 0.5 + 0.5
    factor = bend_scale * bend_sign * (0.65 + ctrl_offset * 0.35)
    ctrl_x = mid_x - dy * factor
    ctrl_y = mid_y + dx * factor

    arc_length, lut = build_bezier_arc_length_lut(a.x, a.y, ctrl_x, ctrl_y, b.x, b.y)
    min_id = min(a.node_id, b.node_id)
    max_id = max(a.node_id, b.node_id)

    return ComputedEdgeDTO(
        edge_id=f"{min_id}_{max_id}",
        from_index=a.index,
        to_index=b.index,
        edge_class=edge_class,
        x1=round(a.x, 2),
        y1=round(a.y, 2),
        x2=round(b.x, 2),
        y2=round(b.y, 2),
        ctrl_x=round(ctrl_x, 2),
        ctrl_y=round(ctrl_y, 2),
        arc_length=arc_length,
        length_lut=lut,
        murray_radius_px=murray_radius_px,
    )
# --- КОНЕЦ ФУНКЦИИ _make_curve_edge ---


# --- КОНЕЦ РАЗДЕЛА 2: build_bezier_arc_length_lut ---

# --- НАЧАЛО РАЗДЕЛА 3: _compute_authentic_invariants ---
# --- НАЧАЛО ФУНКЦИИ _compute_authentic_invariants ---
def _compute_authentic_invariants(
        nodes: Sequence[GraphNodeDTO],
        edges: Sequence[ComputedEdgeDTO],
) -> tuple[float, int, float]:
    n_total = len(nodes)
    if n_total < 3 or not edges:
        return 0.0, 0, 0.0

    adj: dict[int, set[int]] = {node.index: set() for node in nodes}
    for edge in edges:
        adj.setdefault(edge.from_index, set()).add(edge.to_index)
        adj.setdefault(edge.to_index, set()).add(edge.from_index)

    sum_local_c = 0.0
    eligible_nodes = 0
    for neighbors in adj.values():
        k = len(neighbors)
        if k < 2:
            continue
        eligible_nodes += 1
        nb_list = list(neighbors)
        closed_triangles = 0
        for i in range(k):
            nb_i_set = adj.get(nb_list[i], set())
            for j in range(i + 1, k):
                if nb_list[j] in nb_i_set:
                    closed_triangles += 1
        sum_local_c += (2.0 * closed_triangles) / (k * (k - 1))

    clustering_coeff = round(sum_local_c / eligible_nodes, 3) if eligible_nodes > 0 else 0.0

    sample_stride = max(1, n_total // 28)
    max_hops = 0
    total_path_dist = 0
    reachable_pairs = 0

    for idx in range(0, n_total, sample_stride):
        start_node = nodes[idx].index
        dist_map: dict[int, int] = {start_node: 0}
        queue: deque[int] = deque([start_node])

        while queue:
            curr = queue.popleft()
            d = dist_map[curr]
            if d > max_hops:
                max_hops = d

            for nb in adj.get(curr, ()):
                if nb not in dist_map:
                    dist_map[nb] = d + 1
                    total_path_dist += d + 1
                    reachable_pairs += 1
                    queue.append(nb)

    avg_path_length = round(total_path_dist / reachable_pairs, 2) if reachable_pairs > 0 else 0.0
    return clustering_coeff, max_hops, avg_path_length
# --- КОНЕЦ ФУНКЦИИ _compute_authentic_invariants ---


# --- КОНЕЦ РАЗДЕЛА 3: _compute_authentic_invariants ---

# --- НАЧАЛО РАЗДЕЛА 4: compute_nexus_topology ---
# --- НАЧАЛО ФУНКЦИИ compute_nexus_topology ---
def compute_nexus_topology(
        nodes: Sequence[GraphNodeDTO],
        max_connect_dist: float = 210.0,
        seed: int = 104729,
        sim_time_sec: float = 0.0,
        source_tag: str = "[python/server]",
) -> tuple[list[ComputedEdgeDTO], dict[int, int], GraphTopologyMetricsDTO]:
    t0 = time.perf_counter()
    edges: list[ComputedEdgeDTO] = []
    degree_by_index: dict[int, int] = {n.index: 0 for n in nodes}
    added_keys: set[str] = set()

    if len(nodes) < 3:
        empty_metrics = GraphTopologyMetricsDTO(
            trunk_count=0,
            bridge_count=0,
            dendrite_count=0,
            avg_degree=0.0,
            clustering_coeff=0.0,
            diameter_hops=0,
            avg_path_length=0.0,
            compute_time_ms=0.0,
            compute_source=source_tag,
        )
        return edges, degree_by_index, empty_metrics

    # 1. КЛАСС A (AXON_TRUNK): Остовное дерево Прима с сохранением порядка вставки (как в JS Set)
    hub_nodes = list(nodes[: min(36, len(nodes))])
    in_tree_set: set[int] = {0}
    in_tree_order: list[int] = [0]

    while len(in_tree_order) < len(hub_nodes):
        best_u = -1
        best_v = -1
        best_dist = max_connect_dist * 1.65

        for u_idx in in_tree_order:
            u = hub_nodes[u_idx]
            for v_idx, v in enumerate(hub_nodes):
                if v_idx in in_tree_set:
                    continue
                d = math.hypot(v.x - u.x, v.y - u.y)
                if d < best_dist:
                    best_dist = d
                    best_u = u_idx
                    best_v = v_idx

        if best_u == -1 or best_v == -1:
            break

        in_tree_set.add(best_v)
        in_tree_order.append(best_v)
        node_a = hub_nodes[best_u]
        node_b = hub_nodes[best_v]
        key = f"{min(node_a.node_id, node_b.node_id)}_{max(node_a.node_id, node_b.node_id)}"
        added_keys.add(key)

        bend_sign = 1 if (node_a.node_id + node_b.node_id + seed) % 2 == 0 else -1
        edges.append(
            _make_curve_edge(node_a, node_b, "AXON_TRUNK", bend_sign, 0.14, sim_time_sec, 1.95)
        )
        degree_by_index[node_a.index] = degree_by_index.get(node_a.index, 0) + 1
        degree_by_index[node_b.index] = degree_by_index.get(node_b.index, 0) + 1

    # 2. КЛАСС B (BRIDGE — критерий Габриэля) и КЛАСС C (DENDRITE — закон Мюррея)
    max_dist_sq = max_connect_dist * max_connect_dist
    n_total = len(nodes)

    for i in range(n_total):
        a = nodes[i]
        local_conn = degree_by_index.get(a.index, 0)
        if local_conn >= 4:
            continue

        for j in range(i + 1, n_total):
            if local_conn >= 4:
                break
            b = nodes[j]
            if degree_by_index.get(b.index, 0) >= 4:
                continue

            dx = b.x - a.x
            dy = b.y - a.y
            d_sq = dx * dx + dy * dy
            if d_sq > max_dist_sq or d_sq < 64.0:
                continue

            key = f"{min(a.node_id, b.node_id)}_{max(a.node_id, b.node_id)}"
            if key in added_keys:
                continue

            mid_x = (a.x + b.x) * 0.5
            mid_y = (a.y + b.y) * 0.5
            rad_sq = d_sq * 0.25
            is_gabriel = True

            k_start = max(0, i - 10)
            k_end = min(n_total, i + 11)
            for k in range(k_start, k_end):
                if k == i or k == j:
                    continue
                c = nodes[k]
                cd_sq = (c.x - mid_x) ** 2 + (c.y - mid_y) ** 2
                if cd_sq < rad_sq * 0.85:
                    is_gabriel = False
                    break

            if not is_gabriel and d_sq > max_dist_sq * 0.32:
                continue

            edge_class = "BRIDGE" if (a.cluster_id != b.cluster_id and is_gabriel) else "DENDRITE"
            branch_order = max(1, local_conn + 1)
            murray_r = (
                1.35
                if edge_class == "BRIDGE"
                else round(1.65 * (branch_order ** (-1.0 / 3.0)), 2)
            )
            bend_sign = 1 if (a.node_id + b.node_id) % 2 == 0 else -1

            edges.append(
                _make_curve_edge(a, b, edge_class, bend_sign, 0.16, sim_time_sec, murray_r)
            )
            added_keys.add(key)

            local_conn += 1
            degree_by_index[a.index] = local_conn
            degree_by_index[b.index] = degree_by_index.get(b.index, 0) + 1

    trunks = sum(1 for e in edges if e.edge_class == "AXON_TRUNK")
    bridges = sum(1 for e in edges if e.edge_class == "BRIDGE")
    dendrites = len(edges) - trunks - bridges

    avg_deg = (len(edges) * 2.0) / max(1, n_total)
    clustering_coeff, diameter_hops, avg_path_length = _compute_authentic_invariants(nodes, edges)
    dur_ms = (time.perf_counter() - t0) * 1000.0

    metrics = GraphTopologyMetricsDTO(
        trunk_count=trunks,
        bridge_count=bridges,
        dendrite_count=dendrites,
        avg_degree=round(avg_deg, 2),
        clustering_coeff=clustering_coeff,
        diameter_hops=diameter_hops,
        avg_path_length=avg_path_length,
        compute_time_ms=round(dur_ms, 2),
        compute_source=source_tag,
    )

    return edges, degree_by_index, metrics
# --- КОНЕЦ ФУНКЦИИ compute_nexus_topology ---
# --- КОНЕЦ РАЗДЕЛА 4: compute_nexus_topology ---
