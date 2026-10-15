import os
import re
import logging
from logging.handlers import RotatingFileHandler
from app.config import settings

class SensitiveDataRedactor(logging.Formatter):
    """Redacts API keys, tokens, and passwords from log outputs."""
    PATTERNS = [
        (re.compile(r"(api[-_]?key[=:\s]+)(['\"]?[a-zA-Z0-9_\-]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(token[=:\s]+)(['\"]?[a-zA-Z0-9_\.\-]{8,}['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(password[=:\s]+)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
        (re.compile(r"(secret[=:\s]+)(['\"]?[^\s,'\"]+['\"]?)", re.IGNORECASE), r"\1[REDACTED]"),
    ]

    def format(self, record: logging.LogRecord) -> str:
        original = super().format(record)
        for pattern, replacement in self.PATTERNS:
            original = pattern.sub(replacement, original)
        return original

def setup_logging():
    log_dir = os.path.join(settings.CONFIG_DIR, "logs")
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "optimizer.log")

    logger = logging.getLogger("optimizer")
    logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # Avoid duplicate handlers on reload
    if logger.handlers:
        return logger

    # Console Handler
    console_handler = logging.StreamHandler()
    console_formatter = SensitiveDataRedactor(
        "%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)

    # Rotating File Handler (10MB per file, max 5 backups)
    file_handler = RotatingFileHandler(log_file, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8")
    file_formatter = SensitiveDataRedactor(
        "%(asctime)s [%(levelname)s] [%(filename)s:%(lineno)d] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_formatter)
    logger.addHandler(file_handler)

    return logger

logger = setup_logging()
