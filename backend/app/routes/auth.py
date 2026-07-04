from fastapi import APIRouter, HTTPException, Response, status, Depends
from pydantic import BaseModel, EmailStr
from datetime import datetime, timezone, timedelta
from app.database import db
from app.utils.auth import generate_otp, create_access_token, get_current_user
from app.utils.email_utils import send_otp_email
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

class OTPRequest(BaseModel):
    email: EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    otp: str

@router.post("/otp")
async def request_otp(payload: OTPRequest):
    email = payload.email.lower()
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    # Save or update verification state in MongoDB
    await db.db.otps.update_one(
        {"email": email},
        {"$set": {"otp": otp, "expires_at": expires_at}},
        upsert=True
    )
    
    # Deliver OTP via SMTP
    sent = await send_otp_email(email, otp)
    if not sent:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to send verification email. Please try again."
        )
        
    return {"message": "Verification code sent."}

@router.post("/login")
async def login(payload: LoginRequest, response: Response):
    email = payload.email.lower()
    otp_record = await db.db.otps.find_one({"email": email})
    
    if not otp_record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code requested for this email."
        )
        
    # Standardize timezone-aware comparison
    expires_at = otp_record["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
        
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired."
        )
        
    if otp_record["otp"] != payload.otp:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code."
        )
        
    # Delete OTP after successful use to prevent replay attacks
    await db.db.otps.delete_one({"email": email})
    
    # Fetch or register new user
    user = await db.db.users.find_one({"email": email})
    if not user:
        new_user = {
            "email": email,
            "created_at": datetime.now(timezone.utc)
        }
        res = await db.db.users.insert_one(new_user)
        user = await db.db.users.find_one({"_id": res.inserted_id})
        
    # Create persistent session token
    token = create_access_token(email)
    
    # Save cookie securely
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        max_age=30 * 24 * 60 * 60,  # 30 days persistent session
        samesite=settings.COOKIE_SAMESITE,
        secure=settings.COOKIE_SECURE,
        path="/"
    )
    
    return {
        "status": "success",
        "user": {
            "id": str(user["_id"]),
            "email": user["email"]
        }
    }

@router.post("/logout")
async def logout(response: Response):
    # Overwrite cookie with empty value and immediate expiration
    response.delete_cookie(
        key="access_token",
        path="/",
        httponly=True,
        samesite="lax"
    )
    return {"message": "Logged out successfully."}

@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "id": user["_id"],
        "email": user["email"]
    }
