from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

UPLOAD_DIR = BASE_DIR / "data" / "uploads"
WEB_DUCKDB_PATH = BASE_DIR / "data" / "web_analyst.duckdb"
NOVAMART_DUCKDB_PATH = BASE_DIR / "data" / "practice" / "novamart_practice.duckdb"
CHART_OUTPUT_DIR = BASE_DIR / "outputs" / "web_charts"
CONNECTIONS_CONFIG_PATH = BASE_DIR / "data" / "connections.json"
ENV_FILE_PATH = BASE_DIR / ".env"
MAX_UPLOAD_SIZE_MB = 100

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
CHART_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
