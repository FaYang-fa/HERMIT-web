"""HERMIT paired multi-omics visualization server."""

import gzip
import json
import os
from pathlib import Path

from flask import Flask, Response, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "web_data"
DATA_FILE = DATA_DIR / "umap_data.json"

app = Flask(__name__)
_raw_data = b""
_gzip_data = b""
_stats = {}


def load_data() -> None:
    """Load and validate the paired-only visualization payload."""
    global _raw_data, _gzip_data, _stats
    if not DATA_FILE.exists():
        raise FileNotFoundError(f"Visualization data not found: {DATA_FILE}")
    _raw_data = DATA_FILE.read_bytes()
    payload = json.loads(_raw_data)
    if payload.get("meta", {}).get("project") != "HERMIT":
        raise ValueError("The visualization payload is not labeled as HERMIT data.")
    required_modalities = {"RNA", "5hmC", "5mC"}
    if set(payload.get("meta", {}).get("modalities", [])) != required_modalities:
        raise ValueError("The payload must contain paired RNA, 5hmC, and 5mC data.")
    _stats = payload.get("stats", {})
    _gzip_data = gzip.compress(_raw_data, compresslevel=6)
    print(
        "Loaded HERMIT paired data: "
        f"{_stats.get('unique_cells', 0):,} cells, "
        f"{_stats.get('total_points', 0):,} modality points"
    )


@app.after_request
def add_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/umap-data")
def umap_data():
    use_gzip = "gzip" in request.headers.get("Accept-Encoding", "").lower()
    body = _gzip_data if use_gzip else _raw_data
    headers = {
        "Cache-Control": "public, max-age=3600",
        "Content-Type": "application/json; charset=utf-8",
        "Vary": "Accept-Encoding",
    }
    if use_gzip:
        headers["Content-Encoding"] = "gzip"
    return Response(body, headers=headers)


@app.get("/api/stats")
def stats():
    return jsonify(_stats)


@app.get("/health")
def health():
    return jsonify({"status": "ok", "data_loaded": bool(_raw_data)})


@app.errorhandler(404)
def not_found(_error):
    return render_template("404.html"), 404


load_data()

if __name__ == "__main__":
    from waitress import serve

    port = int(os.getenv("PORT", "7860"))
    serve(app, host="0.0.0.0", port=port, threads=8)
