import os
from typing import Optional, Dict, Any, List
import httpx
from app.config import settings
from app.core.logging import logger

class JellyfinClient:
    """Async API Client for interacting with the existing Jellyfin server over Docker network."""

    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = (base_url or settings.JELLYFIN_URL).rstrip("/")
        self.api_key = api_key or settings.JELLYFIN_API_KEY
        self.timeout = 15.0

    def _headers(self) -> Dict[str, str]:
        headers = {
            "Accept": "application/json",
            "X-Emby-Client": "Jellyfin Media Optimizer",
            "X-Emby-Device-Name": "Optimizer Service",
            "X-Emby-Device-Id": "jellyfin-media-optimizer-01",
            "X-Emby-Client-Version": settings.APP_VERSION,
        }
        if self.api_key:
            headers["Authorization"] = f'MediaBrowser Client="Jellyfin Media Optimizer", Device="Optimizer Service", DeviceId="jellyfin-media-optimizer-01", Version="{settings.APP_VERSION}", Token="{self.api_key}"'
            headers["X-Emby-Token"] = self.api_key
        return headers

    async def test_connection(self, url: Optional[str] = None, api_key: Optional[str] = None) -> Dict[str, Any]:
        """Tests connectivity and authentication with Jellyfin."""
        target_url = (url or self.base_url).rstrip("/")
        target_key = api_key if api_key is not None else self.api_key

        headers = {
            "Accept": "application/json",
            "X-Emby-Client": "Jellyfin Media Optimizer",
            "X-Emby-Device-Name": "Optimizer Service",
            "X-Emby-Device-Id": "jellyfin-media-optimizer-01",
            "X-Emby-Client-Version": settings.APP_VERSION,
        }
        if target_key:
            headers["Authorization"] = f'MediaBrowser Client="Jellyfin Media Optimizer", Device="Optimizer Service", DeviceId="jellyfin-media-optimizer-01", Version="{settings.APP_VERSION}", Token="{target_key}"'
            headers["X-Emby-Token"] = target_key

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{target_url}/System/Info", headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "success": True,
                        "server_name": data.get("ServerName", "Jellyfin Server"),
                        "server_version": data.get("Version", "Unknown"),
                        "operating_system": data.get("OperatingSystem", "Linux"),
                        "error_message": None,
                    }
                elif resp.status_code in (401, 403):
                    return {
                        "success": False,
                        "server_name": None,
                        "server_version": None,
                        "error_message": "Authentication failed: Invalid Jellyfin API Key.",
                    }
                else:
                    return {
                        "success": False,
                        "server_name": None,
                        "server_version": None,
                        "error_message": f"Server returned HTTP status {resp.status_code}: {resp.text[:200]}",
                    }
        except httpx.ConnectError:
            return {
                "success": False,
                "server_name": None,
                "server_version": None,
                "error_message": f"Could not connect to Jellyfin at '{target_url}'. Verify the hostname and Docker network.",
            }
        except httpx.TimeoutException:
            return {
                "success": False,
                "server_name": None,
                "server_version": None,
                "error_message": f"Connection to Jellyfin at '{target_url}' timed out.",
            }
        except Exception as e:
            return {
                "success": False,
                "server_name": None,
                "server_version": None,
                "error_message": f"Connection error: {str(e)}",
            }

    async def get_libraries(self) -> List[Dict[str, Any]]:
        """Retrieves media libraries (virtual folders) configured in Jellyfin."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(f"{self.base_url}/Library/VirtualFolders", headers=self._headers())
                if resp.status_code == 200:
                    data = resp.json()
                    libraries = []
                    for item in data:
                        locations = item.get("Locations", [])
                        libraries.append({
                            "id": item.get("ItemId", item.get("Name", "")),
                            "name": item.get("Name", "Unnamed"),
                            "collection_type": item.get("CollectionType", "unknown"),
                            "locations": locations,
                            "path": locations[0] if locations else None,
                        })
                    return libraries
                else:
                    logger.warning(f"Failed to fetch Jellyfin libraries: HTTP {resp.status_code}")
                    return []
        except Exception as e:
            logger.error(f"Error fetching Jellyfin libraries: {e}")
            return []

    async def refresh_item(self, item_id: str) -> bool:
        """Triggers metadata and file refresh for a specific Jellyfin item after replacement."""
        if not item_id:
            return False
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                url = f"{self.base_url}/Items/{item_id}/Refresh"
                params = {
                    "MetadataRefreshMode": "Default",
                    "ImageRefreshMode": "Default",
                    "ReplaceAllMetadata": "false",
                    "ReplaceAllImages": "false",
                }
                resp = await client.post(url, headers=self._headers(), params=params)
                if resp.status_code in (200, 204):
                    logger.info(f"Triggered Jellyfin item refresh for ID: {item_id}")
                    return True
                else:
                    logger.warning(f"Jellyfin item refresh returned status {resp.status_code} for {item_id}")
                    return False
        except Exception as e:
            logger.error(f"Error triggering Jellyfin item refresh for {item_id}: {e}")
            return False

    async def refresh_library(self) -> bool:
        """Triggers a general library scan in Jellyfin."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(f"{self.base_url}/Library/Refresh", headers=self._headers())
                return resp.status_code in (200, 204)
        except Exception as e:
            logger.error(f"Error triggering Jellyfin library refresh: {e}")
            return False

jellyfin_client = JellyfinClient()
