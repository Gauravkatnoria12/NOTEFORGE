from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.database import db
from app.utils.auth import get_current_user
import httpx
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

router = APIRouter(prefix="/api/notes", tags=["notes"])

class LinkPreviewSchema(BaseModel):
    url: str
    title: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    favicon: Optional[str] = None

class NoteSchema(BaseModel):
    title: str = ""
    content: str = ""
    emoji: str = "📝"
    color: Optional[str] = None
    font_family: str = "sans"
    is_starred: bool = False
    tags: List[str] = []

class NoteResponse(BaseModel):
    id: str
    title: str
    content: str
    emoji: str
    color: Optional[str] = None
    font_family: str
    is_starred: bool
    tags: List[str]
    link_previews: List[LinkPreviewSchema] = []
    created_at: datetime
    updated_at: datetime

def serialize_note(note) -> dict:
    return {
        "id": str(note["_id"]),
        "title": note.get("title", ""),
        "content": note.get("content", ""),
        "emoji": note.get("emoji", "📝"),
        "color": note.get("color"),
        "font_family": note.get("font_family", "sans"),
        "is_starred": note.get("is_starred", False),
        "tags": note.get("tags", []),
        "link_previews": note.get("link_previews", []),
        "created_at": note.get("created_at"),
        "updated_at": note.get("updated_at")
    }

@router.get("", response_model=List[NoteResponse])
async def get_notes(
    q: Optional[str] = None,
    tag: Optional[str] = None,
    user: dict = Depends(get_current_user)
):
    """Retrieve user notes with optional keyword search and tag filters."""
    query = {"user_id": user["_id"]}
    
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"content": {"$regex": q, "$options": "i"}}
        ]
        
    if tag:
        query["tags"] = tag

    notes = await db.db.notes.find(query).sort("updated_at", -1).to_list(100)
    return [serialize_note(n) for n in notes]

@router.post("", response_model=NoteResponse)
async def create_note(payload: NoteSchema, user: dict = Depends(get_current_user)):
    note_doc = {
        "user_id": user["_id"],
        "title": payload.title,
        "content": payload.content,
        "emoji": payload.emoji,
        "color": payload.color,
        "font_family": payload.font_family,
        "is_starred": payload.is_starred,
        "tags": payload.tags,
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    res = await db.db.notes.insert_one(note_doc)
    created_note = await db.db.notes.find_one({"_id": res.inserted_id})
    return serialize_note(created_note)

@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(note_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")
    note = await db.db.notes.find_one({"_id": ObjectId(note_id), "user_id": user["_id"]})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return serialize_note(note)

@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(note_id: str, payload: NoteSchema, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")
    
    update_data = {
        "title": payload.title,
        "content": payload.content,
        "emoji": payload.emoji,
        "color": payload.color,
        "font_family": payload.font_family,
        "is_starred": payload.is_starred,
        "tags": payload.tags,
        "updated_at": datetime.now(timezone.utc)
    }
    
    res = await db.db.notes.update_one(
        {"_id": ObjectId(note_id), "user_id": user["_id"]},
        {"$set": update_data}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
        
    updated_note = await db.db.notes.find_one({"_id": ObjectId(note_id)})
    return serialize_note(updated_note)

@router.delete("/{note_id}")
async def delete_note(note_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")
        
    res = await db.db.notes.delete_one({"_id": ObjectId(note_id), "user_id": user["_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Note not found")
        
    return {"message": "Note deleted successfully"}

class PreviewRequest(BaseModel):
    url: str

@router.post("/{note_id}/preview", response_model=LinkPreviewSchema)
async def get_or_create_link_preview(
    note_id: str,
    payload: PreviewRequest,
    user: dict = Depends(get_current_user)
):
    if not ObjectId.is_valid(note_id):
        raise HTTPException(status_code=400, detail="Invalid note ID")
        
    url = payload.url.strip()
    
    # 1. Fetch note and check if link is already cached
    note = await db.db.notes.find_one({"_id": ObjectId(note_id), "user_id": user["_id"]})
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
        
    previews = note.get("link_previews", [])
    for p in previews:
        if p.get("url") == url:
            return p
            
    # 2. Scrape page metadata
    title = None
    description = None
    image = None
    favicon = None
    
    try:
        async with httpx.AsyncClient(timeout=4.0, follow_redirects=True) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
            }
            resp = await client.get(url, headers=headers)
            if resp.status_code == 200:
                soup = BeautifulSoup(resp.text, "html.parser")
                
                # Title
                og_title = soup.find("meta", property="og:title")
                title = og_title["content"] if og_title and og_title.get("content") else (soup.title.string if soup.title else None)
                
                # Description
                og_desc = soup.find("meta", property="og:description")
                meta_desc = soup.find("meta", attrs={"name": "description"})
                description = og_desc["content"] if og_desc and og_desc.get("content") else (meta_desc["content"] if meta_desc and meta_desc.get("content") else None)
                
                # Image
                og_img = soup.find("meta", property="og:image")
                image = og_img["content"] if og_img and og_img.get("content") else None
                
                # Favicon
                icon_link = soup.find("link", rel=lambda x: x and "icon" in x.lower())
                if icon_link and icon_link.get("href"):
                    favicon = urljoin(url, icon_link["href"])
                else:
                    parsed_url = urlparse(url)
                    favicon = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"
    except Exception as e:
        print("Failed to fetch link preview:", e)
        parsed_url = urlparse(url)
        title = parsed_url.netloc

    if not title:
        parsed_url = urlparse(url)
        title = parsed_url.netloc

    preview_doc = {
        "url": url,
        "title": title,
        "description": description,
        "image": image,
        "favicon": favicon
    }

    # 3. Cache it in MongoDB
    await db.db.notes.update_one(
        {"_id": ObjectId(note_id)},
        {"$push": {"link_previews": preview_doc}}
    )
    
    return preview_doc
