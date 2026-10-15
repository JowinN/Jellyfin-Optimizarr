import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any
import httpx
from app.config import settings
from app.core.logging import logger
from app.core.events import event_broadcaster

class NotificationService:
    """Dispatches alerts across ntfy, Telegram, SMTP, and Web UI SSE channels."""

    async def send_alert(
        self,
        title: str,
        message: str,
        event_type: str = "general",
        priority: str = "default",  # low, default, high, urgent
    ):
        # 1. Broadcast to Web UI via SSE
        try:
            await event_broadcaster.broadcast("notification", {
                "title": title,
                "message": message,
                "event_type": event_type,
                "priority": priority,
            })
        except Exception as e:
            logger.warning(f"Failed to broadcast UI notification: {e}")

        # 2. ntfy Notification
        if settings.NTFY_ENABLED and settings.NTFY_TOPIC:
            await self._send_ntfy(title, message, priority)

        # 3. Telegram Notification
        if settings.TELEGRAM_ENABLED and settings.TELEGRAM_BOT_TOKEN and settings.TELEGRAM_CHAT_ID:
            await self._send_telegram(title, message)

        # 4. SMTP Email
        if settings.SMTP_ENABLED and settings.SMTP_HOST and settings.SMTP_TO:
            self._send_email(title, message)

    async def _send_ntfy(self, title: str, message: str, priority: str):
        try:
            url = f"{settings.NTFY_URL.rstrip('/')}/{settings.NTFY_TOPIC}"
            headers = {"Title": title, "Priority": priority}
            if settings.NTFY_TOKEN:
                headers["Authorization"] = f"Bearer {settings.NTFY_TOKEN}"

            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(url, data=message.encode("utf-8"), headers=headers)
        except Exception as e:
            logger.error(f"Error dispatching ntfy notification: {e}")

    async def _send_telegram(self, title: str, message: str):
        try:
            url = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                "chat_id": settings.TELEGRAM_CHAT_ID,
                "text": f"*{title}*\n\n{message}",
                "parse_mode": "Markdown",
            }
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(url, json=payload)
        except Exception as e:
            logger.error(f"Error dispatching Telegram notification: {e}")

    def _send_email(self, title: str, message: str):
        try:
            msg = MIMEMultipart()
            msg["From"] = settings.SMTP_FROM or "optimizer@local"
            msg["To"] = settings.SMTP_TO
            msg["Subject"] = f"[{settings.APP_NAME}] {title}"
            msg.attach(MIMEText(message, "plain"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_USE_TLS:
                    server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        except Exception as e:
            logger.error(f"Error dispatching SMTP email: {e}")

notification_service = NotificationService()
