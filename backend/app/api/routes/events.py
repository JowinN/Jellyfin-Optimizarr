import asyncio
import json
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.core.events import event_broadcaster
from app.core.logging import logger

router = APIRouter(prefix="/events", tags=["Events"])

@router.get("")
async def sse_event_stream():
    """Server-Sent Events endpoint streaming real-time job progress, queue updates, and scan status."""
    async def event_generator():
        queue = await event_broadcaster.subscribe()
        try:
            # Send initial keep-alive ping
            yield "event: ping\ndata: {}\n\n"
            while True:
                try:
                    # Timeout after 20 seconds to send keep-alive ping
                    message = await asyncio.wait_for(queue.get(), timeout=20.0)
                    event_type = message.get("event", "message")
                    data_json = json.dumps(message.get("data", {}))
                    yield f"event: {event_type}\ndata: {data_json}\n\n"
                except asyncio.TimeoutError:
                    yield "event: ping\ndata: {}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_broadcaster.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
