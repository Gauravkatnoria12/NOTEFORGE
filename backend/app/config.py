import os
from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    MONGODB_URI: str = Field(default="mongodb://localhost:27017/noteforge")
    SMTP_EMAIL: str = Field(default="")
    SMTP_APP_PASSWORD: str = Field(default="")
    SMTP_SENDER: str = Field(default="")
    SMTP_HOST: str = Field(default="smtp.gmail.com")
    SMTP_PORT: int = Field(default=465)
    SMTP_USE_TLS: bool = Field(default=True)
    SMTP_START_TLS: bool = Field(default=False)
    JWT_SECRET: str = Field(default="supersecretjwtkeynoteforgemin32charactersneededhere")
    GEMINI_API_KEY: str = Field(default="")
    FRONTEND_URL: str = Field(default="")
    COOKIE_SECURE: bool = Field(default=False)
    COOKIE_SAMESITE: str = Field(default="lax")

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env")
        env_file_encoding = "utf-8"
        extra = "ignore"

settings = Settings()
