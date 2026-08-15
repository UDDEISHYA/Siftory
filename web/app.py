import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from web.routers import datasets, schema, query, charts, pipeline, connections, notion_export, models, analyzer

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(app: FastAPI):
    from web.services.profiling_service import warm_cache
    warm_cache()
    # Pre-load connection metadata from connections.json
    from web.services.connection_service import list_connections
    try:
        conns = list_connections()
        if conns:
            logging.info("Loaded %d saved connections", len(conns))
    except Exception:
        pass
    yield


app = FastAPI(title="Siftory", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router)
app.include_router(schema.router)
app.include_router(query.router)
app.include_router(charts.router)
app.include_router(pipeline.router)
app.include_router(connections.router)
app.include_router(notion_export.router)
app.include_router(models.router)
app.include_router(analyzer.router)

# Serve React build (production) or old static files (fallback)
react_dist = Path(__file__).parent / "frontend" / "dist"
static_dir = Path(__file__).parent / "static"

if react_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(react_dist / "assets")), name="react-assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        file_path = react_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(react_dist / "index.html"))
else:
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
