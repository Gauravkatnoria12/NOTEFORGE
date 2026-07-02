from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
from bson import ObjectId
from app.database import db
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/todos", tags=["todos"])

class SubtaskSchema(BaseModel):
    text: str
    completed: bool = False

class TodoSchema(BaseModel):
    text: str
    completed: bool = False
    note_id: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: List[SubtaskSchema] = []

class TodoResponse(BaseModel):
    id: str
    text: str
    completed: bool
    note_id: Optional[str] = None
    due_date: Optional[str] = None
    due_time: Optional[str] = None
    subtasks: List[SubtaskSchema]
    created_at: datetime
    updated_at: datetime

def serialize_todo(todo) -> dict:
    # Ensure nested subtasks list is properly mapped as dictionaries
    subtasks = todo.get("subtasks", [])
    serialized_subtasks = [
        {"text": s.get("text", ""), "completed": s.get("completed", False)}
        for s in subtasks
    ]
    return {
        "id": str(todo["_id"]),
        "text": todo.get("text", ""),
        "completed": todo.get("completed", False),
        "note_id": todo.get("note_id"),
        "due_date": todo.get("due_date"),
        "due_time": todo.get("due_time"),
        "subtasks": serialized_subtasks,
        "created_at": todo.get("created_at"),
        "updated_at": todo.get("updated_at")
    }

@router.get("", response_model=List[TodoResponse])
async def get_todos(user: dict = Depends(get_current_user)):
    todos = await db.db.todos.find({"user_id": user["_id"]}).sort("created_at", -1).to_list(100)
    return [serialize_todo(t) for t in todos]

@router.post("", response_model=TodoResponse)
async def create_todo(payload: TodoSchema, user: dict = Depends(get_current_user)):
    todo_doc = {
        "user_id": user["_id"],
        "text": payload.text,
        "completed": payload.completed,
        "note_id": payload.note_id,
        "due_date": payload.due_date,
        "due_time": payload.due_time,
        "subtasks": [s.model_dump() for s in payload.subtasks],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    res = await db.db.todos.insert_one(todo_doc)
    created_todo = await db.db.todos.find_one({"_id": res.inserted_id})
    return serialize_todo(created_todo)

@router.put("/{todo_id}", response_model=TodoResponse)
async def update_todo(todo_id: str, payload: TodoSchema, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(todo_id):
        raise HTTPException(status_code=400, detail="Invalid todo ID")
        
    update_data = {
        "text": payload.text,
        "completed": payload.completed,
        "note_id": payload.note_id,
        "due_date": payload.due_date,
        "due_time": payload.due_time,
        "subtasks": [s.model_dump() for s in payload.subtasks],
        "updated_at": datetime.now(timezone.utc)
    }
    
    res = await db.db.todos.update_one(
        {"_id": ObjectId(todo_id), "user_id": user["_id"]},
        {"$set": update_data}
    )
    
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Todo item not found")
        
    updated_todo = await db.db.todos.find_one({"_id": ObjectId(todo_id)})
    return serialize_todo(updated_todo)

@router.delete("/{todo_id}")
async def delete_todo(todo_id: str, user: dict = Depends(get_current_user)):
    if not ObjectId.is_valid(todo_id):
        raise HTTPException(status_code=400, detail="Invalid todo ID")
        
    res = await db.db.todos.delete_one({"_id": ObjectId(todo_id), "user_id": user["_id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Todo item not found")
        
    return {"message": "Todo item deleted successfully"}
