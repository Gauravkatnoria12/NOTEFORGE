import google.generativeai as genai
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List
import json
import asyncio
from app.config import settings
from app.utils.auth import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"])

class AIContentRequest(BaseModel):
    content: str

class AITodoRequest(BaseModel):
    todo_text: str

# Config Gemini client if key is present
if settings.GEMINI_API_KEY:
    genai.configure(api_key=settings.GEMINI_API_KEY)

@router.post("/fix-grammar")
async def fix_grammar(payload: AIContentRequest, user: dict = Depends(get_current_user)):
    """Fix spelling, grammar, and punctuation mistakes in the content."""
    if not payload.content.strip():
        return {"improved_content": ""}
        
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        return {
            "improved_content": f"[Mock Fix Grammar]: {payload.content}\n\n(Note: Set GEMINI_API_KEY to enable live AI grammar check)"
        }
        
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "You are an expert editor. Fix any grammatical mistakes, typos, spelling errors, "
            "and punctuation issues in the following text. Preserve the original paragraph structure, "
            "tone, and markdown formatting. Return strictly the corrected text and absolutely nothing else. "
            "Do not add any conversational text, notes, or wrap the output in quotes:\n\n"
            f"{payload.content}"
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return {"improved_content": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@router.post("/generate-title")
async def generate_title(payload: AIContentRequest, user: dict = Depends(get_current_user)):
    """Generate a clean, punchy title based on the note contents."""
    if not payload.content.strip():
        return {"title": "Untitled Note"}
        
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        # Extract first 3 words as a fallback mock
        words = payload.content.split()[:3]
        fallback_title = " ".join(words) if words else "Untitled Page"
        return {"title": f"[Mock] {fallback_title}"}
        
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "Based on the following note content, generate a short, punchy, minimalist title. "
            "The title should be between 2 to 5 words long. Return ONLY the title text itself without "
            "any quotation marks, markdown formatting, or prefixes. Do not explain anything:\n\n"
            f"{payload.content}"
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return {"title": response.text.strip().strip('"').strip("'")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@router.post("/improve-content")
async def improve_content(payload: AIContentRequest, user: dict = Depends(get_current_user)):
    """Improve the phrasing, style, and vocabulary of the note content."""
    if not payload.content.strip():
        return {"improved_content": ""}
        
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        return {
            "improved_content": f"{payload.content}\n\n[Improved: Make sure to set your GEMINI_API_KEY to see live phrasing enhancements!]"
        }
        
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "You are a professional creative writer. Improve the style, vocabulary, clarity, "
            "and eloquence of the following note content. Preserve the original message, list elements, "
            "and markdown formatting. Return strictly the polished text and nothing else. "
            "Do not add any greetings, comments, or explanations:\n\n"
            f"{payload.content}"
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        return {"improved_content": response.text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")

@router.post("/todo-subtasks")
async def todo_subtasks(payload: AITodoRequest, user: dict = Depends(get_current_user)):
    """Generate a list of 3-5 logical subtasks to accomplish a given todo item."""
    if not payload.todo_text.strip():
        return {"subtasks": []}
        
    if not settings.GEMINI_API_KEY or settings.GEMINI_API_KEY == "your_gemini_api_key_here":
        return {
            "subtasks": [
                f"Verify requirements for '{payload.todo_text}'",
                "Draft initial task checklist",
                "Review progress and test output"
            ]
        }
        
    try:
        model = genai.GenerativeModel("gemini-2.5-flash")
        prompt = (
            "You are a productivity expert. Break down the following task into 3 to 5 logical, concrete, "
            "and actionable subtask steps. Return the subtask list strictly as a JSON array of strings, "
            "for example:\n"
            '["Step one", "Step two", "Step three"]\n\n'
            "Do not wrap the response in markdown code blocks or backticks. Return only valid JSON. Do not include any filler text:\n\n"
            f"Task: {payload.todo_text}"
        )
        response = await asyncio.to_thread(model.generate_content, prompt)
        
        text = response.text.strip()
        # Sanitize JSON string if markdown wraps it
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()
        
        try:
            subtasks = json.loads(text)
            if isinstance(subtasks, list):
                return {"subtasks": [str(s).strip() for s in subtasks if s]}
        except json.JSONDecodeError:
            # Fallback line splitter
            lines = text.split("\n")
            subtasks = []
            for line in lines:
                cleaned = line.strip().lstrip("-*1234567890.[]() ")
                if cleaned:
                    subtasks.append(cleaned)
            return {"subtasks": subtasks}
            
        return {"subtasks": []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {str(e)}")
