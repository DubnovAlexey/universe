# noinspection SpellCheckingInspection
# ============================================================================
# ФАЙЛ: backend/main.py
# НАЗНАЧЕНИЕ: Главная точка входа Python-бэкенда UNIVERSE v2.0 (MASTER 00B / 03 / 05)
# ЗАДАЧИ ФАЙЛА:
# 1. Поддерживать режим самопроверки паритета из командной строки:
#    python -m backend.main --verify
# 2. Запускать HTTP/JSON сервер телеметрии на стандартной библиотеке Python
#    (или через FastAPI/Uvicorn, если они установлены в окружении).
# ============================================================================

from __future__ import annotations
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
import sys
from pathlib import Path

# Гарантируем, что корневая директория репозитория доступна в sys.path
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.api.transport import build_health_and_parity_report, generate_live_binary_step


class UniverseTelemetryHTTPHandler(BaseHTTPRequestHandler):
    """Автономный HTTP-обработчик телеметрии и бинарных кадров 'UNVS'."""

    def _send_cors_headers(self, content_type: str = "application/json; charset=utf-8") -> None:
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/api/frame.bin"):
            binary_frame = generate_live_binary_step(tick=1)
            self.send_response(200)
            self._send_cors_headers("application/octet-stream")
            self.send_header("Content-Length", str(len(binary_frame)))
            self.end_headers()
            self.wfile.write(binary_frame)
            return

        report = build_health_and_parity_report()
        payload = json.dumps(report, ensure_ascii=False, indent=2).encode("utf-8")
        self.send_response(200)
        self._send_cors_headers()
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format_str: str, *args: object) -> None:
        # Тихий логгинг без засорения консоли
        return


def run_cli_verification() -> int:
    """Запускает проверку побитового паритета PRNG, графа NEXUS и пакета 'UNVS'."""
    report = build_health_and_parity_report()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report.get("status") == "ok" else 1


def run_standalone_server(host: str = "127.0.0.1", port: int = 8000) -> None:
    server = HTTPServer((host, port), UniverseTelemetryHTTPHandler)
    print(f"[UNIVERSE Python Core] Listening on http://{host}:{port}/api/health")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()


if __name__ == "__main__":
    if "--verify" in sys.argv:
        sys.exit(run_cli_verification())

    env_port = int(os.environ.get("PORT", "8000"))
    run_standalone_server(port=env_port)