import asyncio
import json
from typing import Set, Dict, Any
from app.core.logging import logger

class EventBroadcaster:
    """Pub/sub event bus for Server-Sent Events (SSE) streaming to connected frontend clients."""

    def __init__(self):
        self._subscribers: Set[asyncio.Queue] = set()

    async def subscribe(self) -> asyncio.Queue:
        queue = asyncio.Queue(maxsize=100)
        self._subscribers.add(queue)
        logger.debug(f"New SSE client subscribed. Total active listeners: {len(self._subscribers)}")
        return queue

    def unsubscribe(self, queue: asyncio.Queue):
        if queue in self._subscribers:
            self._subscribers.remove(queue)
            logger.debug(f"SSE client disconnected. Total active listeners: {len(self._subscribers)}")

    async def broadcast(self, event_type: str, data: Dict[str, Any]):
        message = {
            "event": event_type,
            "data": data
        }
        for queue in list(self._subscribers):
            try:
                if queue.full():
                    try:
                        queue.get_nowait()
                    except asyncio.QueueEmpty:
                        pass
                await queue.put(message)
            except Exception as e:
                logger.warning(f"Failed to deliver SSE event to a client: {e}")

event_broadcaster = EventBroadcaster()
