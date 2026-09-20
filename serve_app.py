from __future__ import annotations

import os
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT_CANDIDATES = range(8127, 8137)


def create_server() -> tuple[ThreadingHTTPServer, int]:
    os.chdir(ROOT)
    last_error: OSError | None = None
    for port in PORT_CANDIDATES:
        try:
            return ThreadingHTTPServer((HOST, port), SimpleHTTPRequestHandler), port
        except OSError as error:
            last_error = error
    raise RuntimeError("Tidak ada port lokal kosong pada rentang 8127–8136.") from last_error


if __name__ == "__main__":
    server, port = create_server()
    url = f"http://{HOST}:{port}/"
    print(f"Pump CFD Studio aktif di {url}")
    print("Tutup jendela ini atau tekan Ctrl+C untuk menghentikan server.")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer dihentikan.")
    finally:
        server.server_close()
