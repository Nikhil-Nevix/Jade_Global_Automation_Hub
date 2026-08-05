"""Email service — SMTP notification sender (ported from InfraAnsible VM).

Synchronous (smtplib), so it is safe to call from Celery workers directly and
from async code via ``asyncio.to_thread``. Configuration comes from settings
(SMTP_* keys); when SMTP_ENABLED is false it is a no-op that returns False.
"""
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("infraansible")

_SEVERITY_COLORS = {"info": "#3B82F6", "warning": "#F59E0B", "error": "#EF4444", "critical": "#DC2626"}
_EVENT_EMOJIS = {
    "job_success": "✅", "job_failure": "❌", "batch_complete": "📦",
    "server_failure": "🔴", "high_cpu": "⚠️", "user_change": "👤",
    "playbook_update": "📝", "system_alert": "🔔",
}


def send_email(to_email: str, subject: str, html_body: str, text_body: Optional[str] = None) -> bool:
    if not settings.SMTP_ENABLED:
        logger.debug("SMTP disabled; email not sent.")
        return False
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error("SMTP credentials not configured; cannot send email.")
        return False
    from_email = settings.SMTP_FROM_EMAIL or settings.SMTP_USER
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.SMTP_FROM_NAME} <{from_email}>"
        msg["To"] = to_email
        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email sent to {to_email}")
        return True
    except Exception as e:  # noqa: BLE001
        logger.error(f"Failed to send email to {to_email}: {e}")
        return False


def send_notification_email(to_email: str, title: str, message: str, severity: str, event_type: str) -> bool:
    color = _SEVERITY_COLORS.get(severity, "#3B82F6")
    emoji = _EVENT_EMOJIS.get(event_type, "🔔")
    html_body = f"""
    <!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="font-family:Arial,sans-serif;background:#f4f4f5;margin:0;padding:0;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.1);">
        <div style="background:linear-gradient(135deg,#9333EA,#7E22CE);color:#fff;padding:30px 20px;text-align:center;">
          <h1 style="margin:0;font-size:24px;">{emoji} {settings.SMTP_FROM_NAME}</h1>
        </div>
        <div style="padding:30px 20px;">
          <span style="display:inline-block;background:{color};color:#fff;padding:6px 12px;border-radius:6px;font-size:12px;font-weight:600;text-transform:uppercase;margin-bottom:20px;">{severity.upper()}</span>
          <h2 style="font-size:20px;color:#1f2937;margin:0 0 15px;">{title}</h2>
          <p style="font-size:16px;color:#4b5563;margin:0 0 20px;">{message}</p>
        </div>
        <div style="background:#f9fafb;padding:20px;text-align:center;font-size:14px;color:#6b7280;border-top:1px solid #e5e7eb;">
          <p>This is an automated notification from {settings.SMTP_FROM_NAME}.</p>
        </div>
      </div>
    </body></html>
    """
    text_body = f"{emoji} {settings.SMTP_FROM_NAME}\n\n{severity.upper()}: {title}\n\n{message}\n"
    subject = f"{emoji} {title} - {settings.SMTP_FROM_NAME}"
    return send_email(to_email, subject, html_body, text_body)


def send_test_email(to_email: str) -> bool:
    html_body = (
        "<html><body style=\"font-family:Arial,sans-serif;\">"
        "<h2>✅ Email Configuration Test</h2>"
        f"<p>This is a test email from {settings.SMTP_FROM_NAME}.</p>"
        "<p>If you received this, your email configuration is working correctly!</p>"
        "</body></html>"
    )
    text_body = f"Email Configuration Test\n\nThis is a test email from {settings.SMTP_FROM_NAME}."
    return send_email(to_email, f"Test Email - {settings.SMTP_FROM_NAME}", html_body, text_body)
