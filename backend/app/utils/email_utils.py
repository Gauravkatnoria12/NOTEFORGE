import aiosmtplib
import httpx
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.config import settings

async def send_otp_email(email_to: str, otp: str) -> bool:
    """Send verification OTP email using Resend API (HTTPS) or SMTP."""
    
    # Print code for easy local development / sandbox environment troubleshooting
    print(f"\n[DEV SECURITY LOG] OTP generated for {email_to}: {otp}\n")
    
    subject = f"NoteForge - {otp} is your verification code"
    html_content = f"""
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #ffffff; color: #111111; padding: 40px; margin: 0;">
        <div style="max-width: 480px; margin: 0 auto; border: 1px solid #e1e1e1; border-radius: 8px; padding: 32px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);">
          <div style="font-weight: 700; font-size: 20px; letter-spacing: -0.5px; margin-bottom: 24px;">NoteForge</div>
          <p style="font-size: 14px; line-height: 1.6; color: #37352f; margin-bottom: 24px;">
            To log in to NoteForge, enter the following temporary verification code in your browser:
          </p>
          <div style="font-size: 32px; font-weight: 700; letter-spacing: 4px; color: #000000; background-color: #f7f7f5; padding: 16px; border-radius: 6px; text-align: center; margin: 24px 0; border: 1px solid #e1e1e1;">
            {otp}
          </div>
          <p style="font-size: 12px; line-height: 1.6; color: #73726c; margin-top: 24px;">
            This code expires in 5 minutes. If you did not request this code, you can safely ignore this email.
          </p>
        </div>
      </body>
    </html>
    """

    # 1. Try Brevo API (HTTPS port 443) if API Key is configured.
    # Brevo allows sending to any recipient address right away on the free tier after verifying sender identity!
    if settings.BREVO_API_KEY:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "accept": "application/json",
            "api-key": settings.BREVO_API_KEY,
            "content-type": "application/json"
        }
        from_email = settings.SMTP_EMAIL if (settings.SMTP_EMAIL and "@" in settings.SMTP_EMAIL) else "info@noteforge.com"
        payload = {
            "sender": {"name": "NoteForge", "email": from_email},
            "to": [{"email": email_to}],
            "subject": subject,
            "htmlContent": html_content
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if res.status_code in [200, 201, 202, 204]:
                    print(f"OTP email sent successfully to {email_to} via Brevo API")
                    return True
                else:
                    print(f"Failed to send email via Brevo API: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Exception sending email via Brevo API: {str(e)}")
            # Fall through to try Resend / SMTP if Brevo fails

    # 2. Try Resend API (HTTPS port 443) if API Key is configured.
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {settings.RESEND_API_KEY}",
            "Content-Type": "application/json"
        }
        # Use user SMTP email address as the 'from' sender if set, else fallback to Resend onboarding address
        from_email = settings.SMTP_EMAIL if (settings.SMTP_EMAIL and "@" in settings.SMTP_EMAIL) else "NoteForge <onboarding@resend.dev>"
        payload = {
            "from": from_email,
            "to": [email_to],
            "subject": subject,
            "html": html_content
        }
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(url, json=payload, headers=headers, timeout=10.0)
                if res.status_code in [200, 201]:
                    print(f"OTP email sent successfully to {email_to} via Resend API")
                    return True
                else:
                    print(f"Failed to send email via Resend API: {res.status_code} - {res.text}")
        except Exception as e:
            print(f"Exception sending email via Resend API: {str(e)}")
            # Fall through to try SMTP if Resend fails

    # 3. SMTP Fallback
    if not settings.SMTP_EMAIL or not settings.SMTP_APP_PASSWORD or "@" not in settings.SMTP_EMAIL:
        print("WARNING: SMTP credentials not set or invalid. Skipping live email sending.")
        return True # Return true so UI doesn't crash in mock development mode
        
    message = MIMEMultipart()
    message["From"] = settings.SMTP_EMAIL
    message["To"] = email_to
    message["Subject"] = subject
    message.attach(MIMEText(html_content, "html"))
    
    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_EMAIL,
            password=settings.SMTP_APP_PASSWORD,
            use_tls=settings.SMTP_USE_TLS,
            start_tls=settings.SMTP_START_TLS
        )
        print(f"OTP email sent successfully to {email_to} via SMTP")
        return True
    except Exception as e:
        print(f"Failed to send email to {email_to} over SMTP: {str(e)}")
        print(f"DEBUG FALLBACK: Allowing local login using the console-printed OTP.")
        return True
