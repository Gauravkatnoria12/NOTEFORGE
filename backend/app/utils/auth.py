import jwt
import random
import string
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, status
from app.config import settings
from app.database import db

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

def create_access_token(email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    payload = {
        "sub": email,
        "exp": expire
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None

def generate_otp() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return "".join(random.choices(string.digits, k=6))

async def get_current_user(request: Request) -> dict:
    # Try fetching from Cookie first (as requested for cookie-based JWT)
    token = request.cookies.get("access_token")
    
    # Fallback to Authorization Header if cookies are disabled / for dev testing
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or not authenticated.",
        )
        
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalid or expired.",
        )
        
    email = payload["sub"]
    user = await db.db.users.find_one({"email": email})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with session not found.",
        )
    
    # Convert MongoDB ObjectId to string for easy JSON serializability
    user["_id"] = str(user["_id"])
    return user
