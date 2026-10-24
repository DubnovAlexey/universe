# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/main.py
# НАЗНАЧЕНИЕ: HTTP-эндпоинты телеметрии, монотонные кадры UNVS и CLI-верификация.
# ОГЛАВЛЕНИЕ:
# 1. ИМПОРТЫ И КОНТРАКТЫ.
# 2. UniverseTelemetryHTTPHandler.
# 3. run_cli_verification.
# Функции: next_monotonic_tick, run_cli_verification, run_standalone_server, _send_cors_headers,
# _send_json, do_OPTIONS, do_GET, log_message.
# ============================================================================

# --- НАЧАЛО РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---
from __future__ import annotations
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse


REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.transport import (  # noqa: E402
    build_health_and_parity_report,
    generate_live_binary_step,
)

_SERVER_TICK_COUNTER: int = 0


# --- НАЧАЛО ФУНКЦИИ next_monotonic_tick ---
def next_monotonic_tick() -> int:
    """Возвращает строго возрастающий номер тика для каждого бинарного кадра."""
    global _SERVER_TICK_COUNTER
    _SERVER_TICK_COUNTER += 1
    return _SERVER_TICK_COUNTER
# --- КОНЕЦ ФУНКЦИИ next_monotonic_tick ---



# --- КОНЕЦ РАЗДЕЛА 1: ИМПОРТЫ И КОНТРАКТЫ ---

# --- НАЧАЛО РАЗДЕЛА 2: UniverseTelemetryHTTPHandler ---
# --- НАЧАЛО КЛАССА UniverseTelemetryHTTPHandler ---
class UniverseTelemetryHTTPHandler(BaseHTTPRequestHandler):
    """Автономный HTTP-обработчик телеметрии, топологии и бинарных кадров 'UNVS'."""

    # --- НАЧАЛО ФУНКЦИИ _send_cors_headers ---
    def _send_cors_headers(
            self, content_type: str = "application/json; charset=utf-8"
    ) -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
    # --- КОНЕЦ ФУНКЦИИ _send_cors_headers ---

    # --- НАЧАЛО ФУНКЦИИ _send_json ---
    def _send_json(self, status_code: int, data: dict[str, object]) -> None:
        payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(status_code)
        self._send_cors_headers()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)
    # --- КОНЕЦ ФУНКЦИИ _send_json ---

    # --- НАЧАЛО ФУНКЦИИ do_OPTIONS ---
    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()
    # --- КОНЕЦ ФУНКЦИИ do_OPTIONS ---

    # --- НАЧАЛО ФУНКЦИИ do_GET ---
    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path.rstrip("/") or "/"

        if route == "/api/frame.bin":
            query = parse_qs(parsed.query)
            requested_tick = query.get("tick", [None])[0]
            if requested_tick is not None and requested_tick.isdigit():
                tick_val = max(1, int(requested_tick))
            else:
                tick_val = next_monotonic_tick()

            binary_frame = generate_live_binary_step(tick=tick_val)
            self.send_response(200)
            self._send_cors_headers("application/octet-stream")
            self.send_header("Content-Length", str(len(binary_frame)))
            self.end_headers()
            self.wfile.write(binary_frame)
            return

        if route in ("/", "/api/health", "/api/verify-parity"):
            report = build_health_and_parity_report()
            self._send_json(200, report)
            return

        if route == "/api/topology":
            report = build_health_and_parity_report()
            self._send_json(
                200,
                {
                    "status": report.get("status"),
                    "goldenSeed": report.get("goldenSeed"),
                    "nexusTopology": report.get("nexusTopology"),
                },
            )
            return

        self._send_json(
            404,
            {
                "status": "not_found",
                "path": route,
                "availableEndpoints": [
                    "/api/health",
                    "/api/verify-parity",
                    "/api/topology",
                    "/api/frame.bin",
                ],
            },
        )
    # --- КОНЕЦ ФУНКЦИИ do_GET ---

    # --- НАЧАЛО ФУНКЦИИ log_message ---
    def log_message(self, format_str: str, *args: object) -> None:
        return
    # --- КОНЕЦ ФУНКЦИИ log_message ---
# --- КОНЕЦ КЛАССА UniverseTelemetryHTTPHandler ---



# --- КОНЕЦ РАЗДЕЛА 2: UniverseTelemetryHTTPHandler ---

# --- НАЧАЛО РАЗДЕЛА 3: run_cli_verification ---
# --- НАЧАЛО ФУНКЦИИ run_cli_verification ---
def run_cli_verification() -> int:
    """Запускает проверку побитового паритета PRNG, графа NEXUS, оптики и пакета 'UNVS'."""
    report = build_health_and_parity_report()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report.get("status") == "ok" else 1
# --- КОНЕЦ ФУНКЦИИ run_cli_verification ---


# --- НАЧАЛО ФУНКЦИИ run_standalone_server ---
def run_standalone_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = HTTPServer((host, port), UniverseTelemetryHTTPHandler)
    print(f"[UNIVERSE Python Core] Listening on http://{host}:{port}/api/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
# --- КОНЕЦ ФУНКЦИИ run_standalone_server ---


if __name__ == "__main__":
    if "--verify" in sys.argv:
        sys.exit(run_cli_verification())

    env_port = int(os.environ.get("PORT", "8000"))
    run_standalone_server(port=env_port)
# --- КОНЕЦ РАЗДЕЛА 3: run_cli_verification ---
