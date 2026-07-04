from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import db
from app.routes import auth, notes, todos, ai
from app.config import settings

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize MongoDB connection
    await db.connect()
    yield
    # Shutdown: Close MongoDB connection
    await db.disconnect()

app = FastAPI(
    title="NoteForge API",
    description="Minimalist Notion-like backend for notes & checklists",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration to support credential cookies from the front-end dev server
origins = [
    "http://localhost:5173",  # Vite default
    "http://127.0.0.1:5173",
    "http://localhost:3000",  # React default
    "http://127.0.0.1:3000"
]

if settings.FRONTEND_URL:
    for url in settings.FRONTEND_URL.split(","):
        stripped = url.strip().rstrip("/")
        if stripped and stripped not in origins:
            origins.append(stripped)

# Regex to support all Vercel subdomains and local hosts seamlessly
origin_regex = r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app"

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(todos.router)
app.include_router(ai.router)

# Mount frontend static files in production if dist exists
import os
from fastapi.staticfiles import StaticFiles

current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(backend_dir)

# Check fallback directories for frontend build
frontend_dist = os.path.join(root_dir, "frontend", "dist")
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.join(backend_dir, "frontend_dist")
if not os.path.exists(frontend_dist):
    frontend_dist = os.path.join(root_dir, "frontend_dist")

if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="static")
    print(f"Mounted frontend static files from: {frontend_dist}")
else:
    @app.get("/")
    async def root():
        return {
            "status": "online",
            "app": "NoteForge API",
            "documentation": "/docs"
        }
