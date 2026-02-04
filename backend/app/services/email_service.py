"""
Email Service
Handles sending email notifications using SMTP
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

# Email configuration from environment variables
SMTP_HOST = os.getenv('SMTP_HOST', 'smtp.gmail.com')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER', '')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD', '')
SMTP_FROM_EMAIL = os.getenv('SMTP_FROM_EMAIL', SMTP_USER)
SMTP_FROM_NAME = os.getenv('SMTP_FROM_NAME', 'Jade Global Automation Hub')
SMTP_ENABLED = os.getenv('SMTP_ENABLED', 'false').lower() == 'true'


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None
) -> bool:
    """
    Send an email via SMTP
    
    Args:
        to_email: Recipient email address
        subject: Email subject
        html_body: HTML email body
        text_body: Plain text email body (fallback)
    
    Returns:
        True if successful, False otherwise
    """
    if not SMTP_ENABLED:
        logger.warning("SMTP is disabled. Email not sent.")
        return False
    
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("SMTP credentials not configured. Cannot send email.")
        return False
    
    try:
        # Create message
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        # Add text and HTML parts
        if text_body:
            part1 = MIMEText(text_body, 'plain')
            msg.attach(part1)
        
        part2 = MIMEText(html_body, 'html')
        msg.attach(part2)
        
        # Send email
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_notification_email(
    to_email: str,
    title: str,
    message: str,
    severity: str,
    event_type: str
) -> bool:
    """
    Send a notification email with formatted template
    
    Args:
        to_email: Recipient email address
        title: Notification title
        message: Notification message
        severity: Notification severity (info, warning, error, critical)
        event_type: Event type
    
    Returns:
        True if successful
    """
    # Determine color based on severity
    severity_colors = {
        'info': '#3B82F6',  # Blue
        'warning': '#F59E0B',  # Yellow
        'error': '#EF4444',  # Red
        'critical': '#DC2626'  # Dark red
    }
    color = severity_colors.get(severity, '#3B82F6')
    
    # Determine emoji based on event type
    event_emojis = {
        'job_success': '✅',
        'job_failure': '❌',
        'batch_complete': '📦',
        'server_failure': '🔴',
        'high_cpu': '⚠️',
        'user_change': '👤',
        'playbook_update': '📝',
        'system_alert': '🔔'
    }
    emoji = event_emojis.get(event_type, '🔔')
    
    # HTML email template
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                margin: 0;
                padding: 0;
                background-color: #f4f4f5;
            }}
            .container {{
                max-width: 600px;
                margin: 40px auto;
                background-color: #ffffff;
                border-radius: 8px;
                overflow: hidden;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            }}
            .header {{
                background: linear-gradient(135deg, #9333EA 0%, #7E22CE 100%);
                color: white;
                padding: 30px 20px;
                text-align: center;
            }}
            .header h1 {{
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }}
            .content {{
                padding: 30px 20px;
            }}
            .notification-badge {{
                display: inline-block;
                background-color: {color};
                color: white;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                margin-bottom: 20px;
            }}
            .notification-title {{
                font-size: 20px;
                font-weight: 600;
                color: #1f2937;
                margin: 0 0 15px 0;
            }}
            .notification-message {{
                font-size: 16px;
                color: #4b5563;
                line-height: 1.6;
                margin: 0 0 20px 0;
            }}
            .footer {{
                background-color: #f9fafb;
                padding: 20px;
                text-align: center;
                font-size: 14px;
                color: #6b7280;
                border-top: 1px solid #e5e7eb;
            }}
            .button {{
                display: inline-block;
                background: linear-gradient(135deg, #9333EA 0%, #7E22CE 100%);
                color: white;
                padding: 12px 24px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin-top: 10px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>{emoji} Jade Global Automation Hub</h1>
            </div>
            <div class="content">
                <span class="notification-badge">{severity.upper()}</span>
                <h2 class="notification-title">{title}</h2>
                <p class="notification-message">{message}</p>
                <a href="http://0.0.0.0:5173/notifications" class="button">View in Dashboard</a>
            </div>
            <div class="footer">
                <p>This is an automated notification from Jade Global Automation Hub.</p>
                <p>To manage your notification preferences, visit the <a href="http://0.0.0.0:5173/notifications/preferences">Settings page</a>.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text fallback
    text_body = f"""
{emoji} Jade Global Automation Hub

{severity.upper()}: {title}

{message}

View in Dashboard: http://0.0.0.0:5173/notifications

---
This is an automated notification from Jade Global Automation Hub.
To manage your notification preferences, visit: http://0.0.0.0:5173/notifications/preferences
    """
    
    subject = f"{emoji} {title} - Jade Global Automation Hub"
    
    return send_email(to_email, subject, html_body, text_body)


def send_test_email(to_email: str) -> bool:
    """
    Send a test email to verify SMTP configuration
    
    Args:
        to_email: Recipient email address
    
    Returns:
        True if successful
    """
    html_body = """
    <html>
    <body style="font-family: Arial, sans-serif;">
        <h2>✅ Email Configuration Test</h2>
        <p>This is a test email from Jade Global Automation Hub.</p>
        <p>If you received this, your email configuration is working correctly!</p>
    </body>
    </html>
    """
    
    text_body = """
    ✅ Email Configuration Test
    
    This is a test email from Jade Global Automation Hub.
    If you received this, your email configuration is working correctly!
    """
    
    return send_email(
        to_email=to_email,
        subject="Test Email - Jade Global Automation Hub",
        html_body=html_body,
        text_body=text_body
    )
