from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.database import db
from app.routes import auth, notes, todos, ai

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(notes.router)
app.include_router(todos.router)
app.include_router(ai.router)

@app.get("/")
async def root():
    return {
        "status": "online",
        "app": "NoteForge API",
        "documentation": "/docs"
    }
