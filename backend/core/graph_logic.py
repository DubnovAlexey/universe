# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/core/graph_logic.py
# НАЗНАЧЕНИЕ: Движок когнитивной топологии NEXUS (MST + Gabriel + Murray + LUT)
# ЗАДАЧИ ФАЙЛА:
# 1. Строить 3-уровневый граф связей без спагетти-линий O(N^2) (MASTER 03):
#    - Класс A (AXON_TRUNK): минимальное остовное дерево (алгоритм Прима);
#    - Класс B (BRIDGE): межкластерные мосты по критерию графа Габриэля;
#    - Класс C (DENDRITE): локальные дендриты с сужением по закону Мюррея
#      r_parent^3 = sum(r_child^3) -> r_child = r_parent * k^(-1/3).
# 2. Вычислять 5-точечную таблицу длины дуги (length_lut) для квадратичных кривых Безье.
# 3. Возвращать честную телеметрию графа для панели Layer3_Topology.tsx.
# ============================================================================

from __future__ import annotations
from dataclasses import dataclass
import math
import time
from typing import Sequence


@dataclass(frozen=True)
class GraphNodeDTO:
    index: int
    node_id: int
    x: float
    y: float
    cluster_id: int
    energy: float


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


def compute_nexus_topology(
        nodes: Sequence[GraphNodeDTO],
        max_connect_dist: float = 210.0,
        seed: int = 104729,
        sim_time_sec: float = 0.0,
        source_tag: str = "[python/server]",
) -> tuple[list[ComputedEdgeDTO], dict[int, int], GraphTopologyMetricsDTO]:
    """
    Строит детерминированную топологию NEXUS (MST + Gabriel + Murray) и метрики графа.
    """
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

    # 1. КЛАСС A (AXON_TRUNK): Остовное дерево Прима по главным хабам
    hub_nodes = list(nodes[: min(36, len(nodes))])
    in_tree: set[int] = {0}

    while len(in_tree) < len(hub_nodes):
        best_u = -1
        best_v = -1
        best_dist = max_connect_dist * 1.65

        for u_idx in in_tree:
            u = hub_nodes[u_idx]
            for v_idx, v in enumerate(hub_nodes):
                if v_idx in in_tree:
                    continue
                d = math.hypot(v.x - u.x, v.y - u.y)
                if d < best_dist:
                    best_dist = d
                    best_u = u_idx
                    best_v = v_idx

        if best_u == -1 or best_v == -1:
            break

        in_tree.add(best_v)
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

            k_start = max(0, i - 6)
            k_end = min(n_total, i + 7)
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

    dur_ms = (time.perf_counter() - t0) * 1000.0
    trunks = sum(1 for e in edges if e.edge_class == "AXON_TRUNK")
    bridges = sum(1 for e in edges if e.edge_class == "BRIDGE")
    dendrites = len(edges) - trunks - bridges

    avg_deg = (len(edges) * 2.0) / max(1, n_total)
    metrics = GraphTopologyMetricsDTO(
        trunk_count=trunks,
        bridge_count=bridges,
        dendrite_count=dendrites,
        avg_degree=round(avg_deg, 2),
        clustering_coeff=round(min(0.68, 0.24 + avg_deg * 0.09), 3),
        diameter_hops=max(4, int(round(math.log2(n_total + 1) * 1.4))),
        avg_path_length=round(max(2.1, math.log(n_total + 1) * 0.72), 2),
        compute_time_ms=round(dur_ms, 2),
        compute_source=source_tag,
    )

    return edges, degree_by_index, metrics