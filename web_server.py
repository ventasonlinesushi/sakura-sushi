# -*- coding: utf-8 -*-
"""Servidor local seguro para el POS.

Publica solo los recursos web necesarios. Nunca permite acceder a receptor,
archivos de configuracion, bases de datos, scripts de instalacion ni listados
de carpetas.
"""

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit


ROOT = Path(__file__).resolve().parent
ALLOWED_DIRS = {"admin", "js", "img"}
ALLOWED_ROOT_FILES = {
    "index.html", "style.css", "logo.png", "manifest.json", "sw.js",
    "sakura-card.png", "mandala-card.png", "qr-local.png",
    "qr-local-rosa.png", ".nojekyll",
}
ALLOWED_EXTENSIONS = {
    ".html", ".css", ".js", ".json", ".png", ".jpg", ".jpeg",
    ".webp", ".svg", ".ico", ".woff", ".woff2", ".ttf",
}


class SafePosHandler(SimpleHTTPRequestHandler):
    server_version = "RestaurantPOS/1.0"

    def _relative_path(self):
        raw = unquote(urlsplit(self.path).path).replace("\\", "/")
        parts = [part for part in raw.split("/") if part]
        if any(part in (".", "..") or part.startswith(".") for part in parts):
            return None
        if not parts:
            return Path("index.html")
        if raw.endswith("/"):
            parts.append("index.html")
        return Path(*parts)

    def _allowed(self, relative):
        if relative is None:
            return False
        parts = relative.parts
        if len(parts) == 1:
            return parts[0].lower() in ALLOWED_ROOT_FILES
        if parts[0].lower() not in ALLOWED_DIRS:
            return False
        return relative.suffix.lower() in ALLOWED_EXTENSIONS

    def translate_path(self, path):
        relative = self._relative_path()
        if not self._allowed(relative):
            return str(ROOT / "__blocked__")
        candidate = (ROOT / relative).resolve()
        try:
            candidate.relative_to(ROOT)
        except ValueError:
            return str(ROOT / "__blocked__")
        return str(candidate)

    def list_directory(self, path):
        self.send_error(403, "Listado de carpetas deshabilitado")
        return None

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "same-origin")
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("WEB:", fmt % args)


def main():
    parser = argparse.ArgumentParser(description="Servidor seguro del POS")
    parser.add_argument("--port", type=int, required=True)
    parser.add_argument("--host", default="0.0.0.0")
    args = parser.parse_args()
    os.chdir(ROOT)
    server = ThreadingHTTPServer((args.host, args.port), SafePosHandler)
    print(f"POS disponible en http://{args.host}:{args.port}/admin/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
