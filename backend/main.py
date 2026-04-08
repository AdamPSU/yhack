import logging

import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import K2_API_KEY, K2_BASE_URL, K2_MODEL
from routers.extract import router as extract_router
from routers.simulate import router, sio

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("openai").setLevel(logging.WARNING)

logger = logging.getLogger("policysim")

# ── App ──────────────────────────────────────────────────────────────
app = FastAPI(title="PolicySim", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(extract_router)

# Mount Socket.IO as ASGI sub-application
sio_asgi = socketio.ASGIApp(sio, other_asgi_app=app)
app = sio_asgi  # type: ignore[assignment]

logger.info("PolicySim ready — model=%s base_url=%s", K2_MODEL, K2_BASE_URL)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
