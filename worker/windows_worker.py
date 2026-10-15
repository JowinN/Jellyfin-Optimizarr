#!/usr/bin/env python3
"""
Jellyfin Media Optimizer - Distributed Windows Worker Node
Offloads video transcoding from the home server to this high-performance desktop workstation.
"""

import os
import sys
import time
import json
import socket
import platform
import argparse
import subprocess
import threading
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

DEFAULT_SERVER_URL = "http://192.168.1.7:8097"
NODE_ID = "windows-node"
NODE_NAME = "Windows PC (i5-4th Gen + Quadro K620)"

class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    RESET = '\033[0m'

def log(msg: str, color: str = Colors.RESET):
    timestamp = datetime.now().strftime("%H:%M:%S")
    safe_msg = msg.encode('ascii', errors='replace').decode('ascii') if sys.platform == 'win32' and sys.stdout.encoding != 'utf-8' else msg
    print(f"{Colors.DIM}[{timestamp}]{Colors.RESET} {color}{safe_msg}{Colors.RESET}", flush=True)

def safe_remove(path: str, retries: int = 10, delay: float = 0.25):
    """Safely removes a file, retrying briefly if Windows kernel is releasing file handles."""
    if not path or not os.path.exists(path):
        return
    for _ in range(retries):
        try:
            os.remove(path)
            return
        except OSError:
            time.sleep(delay)

class JobCancelledException(Exception):
    """Raised when server signals that an encoding job has been cancelled."""
    pass

class WindowsTranscodeWorker:
    def __init__(self, server_url: str, node_id: str = NODE_ID, node_name: str = NODE_NAME, prefer_gpu: bool = True):
        self.server_url = server_url.rstrip("/")
        self.node_id = node_id
        self.node_name = node_name
        self.prefer_gpu = prefer_gpu
        self.is_running = True
        self.current_job_id = None
        self.active_process = None
        self._flag_job_cancelled = False
        self.temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "temp")
        os.makedirs(self.temp_dir, exist_ok=True)

        self.ffmpeg_path = self._find_ffmpeg()
        self.cpu_info = self._get_cpu_info()
        self.gpu_info = self._get_gpu_info()
        self.supported_encoders = self._detect_encoders()

    def _find_ffmpeg(self) -> str:
        # Check dedicated worker bin first (tested & verified for Quadro K620 NVENC API 11.1)
        worker_dir = os.path.dirname(os.path.abspath(__file__))
        local_bin = os.path.join(worker_dir, "bin", "ffmpeg.exe")
        if os.path.exists(local_bin):
            return local_bin

        # Check system PATH
        try:
            res = subprocess.run(["where.exe", "ffmpeg"], capture_output=True, text=True)
            if res.returncode == 0:
                p = res.stdout.strip().splitlines()[0]
                if os.path.exists(p):
                    return p
        except Exception:
            pass

        return "ffmpeg"

    def _get_cpu_info(self) -> str:
        try:
            import winreg
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
            cpu_name, _ = winreg.QueryValueEx(key, "ProcessorNameString")
            return cpu_name.strip()
        except Exception:
            return f"{platform.processor()} ({os.cpu_count()} cores)"

    def _get_gpu_info(self) -> str:
        try:
            cmd = 'powershell -Command "Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name"'
            res = subprocess.run(cmd, shell=True, capture_output=True, text=True)
            if res.returncode == 0:
                lines = [line.strip() for line in res.stdout.splitlines() if line.strip() and "Remote" not in line]
                if lines:
                    return ", ".join(lines)
        except Exception:
            pass
        return "NVIDIA Quadro K620"

    def _detect_encoders(self) -> list:
        encoders = ["libx264", "libx265"]
        try:
            res = subprocess.run([self.ffmpeg_path, "-encoders"], capture_output=True, text=True)
            out = res.stdout
            for enc in ["av1_nvenc", "hevc_nvenc", "h264_nvenc"]:
                if enc in out:
                    # Live hardware verification test
                    test_cmd = [
                        self.ffmpeg_path, "-hide_banner", "-f", "lavfi",
                        "-i", "testsrc=duration=1:size=320x240:rate=30",
                        "-c:v", enc, "-f", "null", "-"
                    ]
                    t_res = subprocess.run(test_cmd, capture_output=True, text=True)
                    if t_res.returncode == 0:
                        encoders.append(enc)
            for enc in ["h264_mf", "hevc_mf", "h264_qsv"]:
                if enc in out:
                    encoders.append(enc)
        except Exception:
            pass
        return encoders

    def register_node(self) -> bool:
        """Registers this worker machine with the server API."""
        url = f"{self.server_url}/api/nodes/register"
        payload = {
            "node_id": self.node_id,
            "name": self.node_name,
            "os_info": f"Windows ({platform.platform()})",
            "cpu_model": self.cpu_info,
            "cpu_cores": os.cpu_count() or 4,
            "gpu_model": self.gpu_info,
            "supported_encoders": self.supported_encoders,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                res = json.loads(resp.read().decode())
                log(f"Successfully connected and registered with Optimizer Cluster: {res.get('message', 'OK')}", Colors.GREEN)
                return True
        except Exception as e:
            log(f"Failed to register node with server ({self.server_url}): {e}", Colors.RED)
            return False

    def _terminate_active_process(self):
        """Forcefully kills the active FFmpeg process and its entire process tree immediately on Windows."""
        proc = self.active_process
        if proc:
            try:
                pid = proc.pid
                log(f"Forcefully terminating worker transcode process tree (PID: {pid})...", Colors.YELLOW)
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(pid)], capture_output=True, timeout=5)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass

    def send_heartbeat(self):
        """Sends periodic heartbeat to maintain 'online' status on dashboard and detect job cancellation."""
        url = f"{self.server_url}/api/nodes/heartbeat"
        payload = {
            "node_id": self.node_id,
            "current_job_id": self.current_job_id,
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode())
                cancel_id = res.get("cancel_job_id")
                if cancel_id and self.current_job_id and int(cancel_id) == int(self.current_job_id):
                    log(f"Heartbeat received cancellation request from server for Job #{self.current_job_id}!", Colors.YELLOW)
                    self._flag_job_cancelled = True
                    self._terminate_active_process()
        except Exception:
            pass

    def _heartbeat_loop(self):
        while self.is_running:
            self.send_heartbeat()
            for _ in range(5):
                if not self.is_running:
                    break
                time.sleep(1)

    def is_job_cancelled(self, job_id: int) -> bool:
        """Polls server directly to determine if job_id was cancelled or removed."""
        if self._flag_job_cancelled:
            return True
        url = f"{self.server_url}/api/nodes/jobs/{job_id}/status"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=3) as resp:
                res = json.loads(resp.read().decode())
                if res.get("should_cancel") is True:
                    return True
        except urllib.error.HTTPError as he:
            if he.code in (404, 409, 410):
                return True
        except Exception:
            pass
        return False

    def poll_for_job(self) -> dict:
        """Asks the server if there is a pending job for this node."""
        q = urllib.parse.urlencode({"node_id": self.node_id, "node_name": self.node_name})
        url = f"{self.server_url}/api/nodes/poll?{q}"
        try:
            req = urllib.request.Request(url)
            with urllib.request.urlopen(req, timeout=10) as resp:
                return json.loads(resp.read().decode())
        except Exception as e:
            return {"has_job": False, "error": str(e)}

    def download_source_file(self, job_id: int, filename: str, total_bytes: int) -> str:
        """Downloads source media file from the server into local scratch directory."""
        url = f"{self.server_url}/api/nodes/jobs/{job_id}/source"
        dest_path = os.path.join(self.temp_dir, f"source_{job_id}_{filename}")

        if os.path.exists(dest_path) and total_bytes > 0 and os.path.getsize(dest_path) == total_bytes:
            log(f"Reusing already downloaded source file: '{filename}' ({total_bytes / (1024*1024):.1f} MB)", Colors.GREEN)
            return dest_path

        log(f"Downloading source file: '{filename}' ({total_bytes / (1024*1024):.1f} MB)...", Colors.CYAN)
        req = urllib.request.Request(url)
        start_t = time.time()
        downloaded = 0
        last_check_t = time.time()

        try:
            with urllib.request.urlopen(req, timeout=60) as resp, open(dest_path, "wb") as out_f:
                while True:
                    if self._flag_job_cancelled:
                        raise JobCancelledException(f"Job #{job_id} cancelled during download.")

                    chunk = resp.read(2 * 1024 * 1024)  # 2MB chunks
                    if not chunk:
                        break
                    out_f.write(chunk)
                    downloaded += len(chunk)

                    now = time.time()
                    if now - last_check_t >= 2.0:
                        last_check_t = now
                        if self.is_job_cancelled(job_id):
                            self._flag_job_cancelled = True
                            raise JobCancelledException(f"Job #{job_id} cancelled by server during download.")

                    if total_bytes > 0:
                        pct = (downloaded / total_bytes) * 100
                        elapsed = time.time() - start_t
                        speed_mb = (downloaded / (1024 * 1024)) / max(0.1, elapsed)
                        sys.stdout.write(f"\r  Transferring: {pct:.1f}% ({speed_mb:.1f} MB/s) ...")
                        sys.stdout.flush()
        except Exception:
            safe_remove(dest_path)
            raise

        print()
        elapsed = time.time() - start_t
        avg_speed = (downloaded / (1024 * 1024)) / max(0.1, elapsed)
        log(f"Download complete: {downloaded / (1024*1024):.1f} MB in {elapsed:.1f}s ({avg_speed:.1f} MB/s)", Colors.GREEN)
        return dest_path

    def report_progress(self, job_id: int, pct: float, fps: float, speed: float, eta_sec: int, out_time: float) -> bool:
        """Reports progress to server. Returns True if server instructs to cancel the job."""
        if self._flag_job_cancelled:
            return True
        url = f"{self.server_url}/api/nodes/jobs/{job_id}/progress"
        payload = {
            "progress_percent": round(pct, 2),
            "current_fps": round(fps, 1),
            "current_speed": round(speed, 2),
            "eta_seconds": int(eta_sec),
            "out_time_seconds": round(out_time, 2),
        }
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=3) as resp:
                res = json.loads(resp.read().decode())
                if res.get("should_cancel") is True or res.get("status") in ("cancelled", "failed"):
                    return True
        except urllib.error.HTTPError as he:
            if he.code in (404, 409, 410):
                return True
        except Exception:
            pass
        return False

    def report_failure(self, job_id: int, error_message: str):
        if self._flag_job_cancelled:
            return
        url = f"{self.server_url}/api/nodes/jobs/{job_id}/fail"
        payload = urllib.parse.urlencode({"error_message": error_message}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                pass
        except Exception:
            pass

    def upload_output_file(self, job_id: int, output_file: str) -> bool:
        """Uploads completed encoded file to server using native curl.exe for maximum throughput."""
        if self._flag_job_cancelled or self.is_job_cancelled(job_id):
            log(f"Job #{job_id} was cancelled; skipping upload.", Colors.YELLOW)
            return False

        url = f"{self.server_url}/api/nodes/jobs/{job_id}/upload"
        size_mb = os.path.getsize(output_file) / (1024 * 1024)
        log(f"Uploading optimized file to server ({size_mb:.1f} MB)...", Colors.CYAN)

        cmd = [
            "curl.exe",
            "-s",
            "-S",
            "-X", "POST",
            "-F", f"file=@{output_file}",
            url,
        ]
        start_t = time.time()
        res = subprocess.run(cmd, capture_output=True, text=True)
        elapsed = time.time() - start_t
        upload_speed = size_mb / max(0.1, elapsed)

        if res.returncode == 0 and "success" in res.stdout:
            log(f"Upload complete ({size_mb:.1f} MB in {elapsed:.1f}s @ {upload_speed:.1f} MB/s). Server validated and atomic replacement applied!", Colors.GREEN)
            return True
        else:
            log(f"Upload error: {res.stderr or res.stdout}", Colors.RED)
            return False

    def build_ffmpeg_args(self, input_file: str, output_file: str, job_data: dict) -> list:
        profile = job_data.get("profile", {})
        media = job_data.get("media", {})
        codec = profile.get("video_codec", "libx265").lower()
        profile_name = profile.get("name", "").lower()
        crf = profile.get("crf", 24)
        hwaccel_type = (profile.get("hwaccel_type") or "auto").lower()

        # Scale down percentage & Target MB/min calculations
        target_mb_min = float(profile.get("target_mb_per_minute", 0.0) or 0.0)
        scale_down = profile.get("scale_down_percent", 0) or 0
        source_size = job_data.get("source_size_bytes", 0)
        duration_sec = media.get("duration_seconds", 0)
        target_bitrate = profile.get("target_bitrate_kbps", 0) or 0
        audio_kbps = profile.get("audio_bitrate_kbps", 96) or 96

        if target_mb_min > 0:
            total_target_kbps = int((target_mb_min * 1024 * 1024 * 8) / 60000)
            target_bitrate = max(100, total_target_kbps - audio_kbps)
            log(f"Target MB/min active: {target_mb_min} MB/min (Target: {total_target_kbps} kbps total, Video: {target_bitrate} kbps, Audio: {audio_kbps} kbps)", Colors.GREEN)
        elif scale_down > 0 and source_size > 0 and duration_sec > 0:
            reduction_ratio = min(0.95, max(0.05, scale_down / 100.0))
            target_size_bytes = source_size * (1.0 - reduction_ratio)
            total_target_kbps = int((target_size_bytes * 8) / (duration_sec * 1000))
            target_bitrate = max(100, total_target_kbps - audio_kbps)
            log(f"Scale-down target active: {scale_down}% (Target size: {target_size_bytes / (1024*1024):.1f} MB, Video Bitrate: {target_bitrate} kbps)", Colors.GREEN)

        has_nvenc = any(e in self.supported_encoders for e in ["h264_nvenc", "hevc_nvenc", "av1_nvenc"])
        has_mf = "h264_mf" in self.supported_encoders

        # Determine whether to use GPU
        use_gpu = False
        if hwaccel_type == "cpu_only":
            use_gpu = False
        elif self.prefer_gpu or hwaccel_type in ("cuda", "nvenc", "auto"):
            use_gpu = has_nvenc or has_mf or ("h264_qsv" in self.supported_encoders)
        elif any(k in codec or k in profile_name for k in ["gpu", "nvenc", "cuda", "fast"]):
            use_gpu = True

        cmd = [self.ffmpeg_path, "-y"]
        source_codec = media.get("video_codec", "").lower()
        if source_codec in ["h264", "avc"] and has_nvenc:
            cmd.extend(["-hwaccel", "auto"])

        cmd.extend(["-i", input_file])

        # Video Mapping & Encoding
        cmd.extend(["-map", "0:v:0"])

        # Resolution scaling filter (never upscale, downscale 4K/1080p if requested)
        res_mode = (profile.get("resolution_mode") or "original").lower()
        vf_filters = []
        if res_mode == "720p":
            vf_filters.append("scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2")
        elif res_mode == "1080p":
            vf_filters.append("scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2")
        elif res_mode == "480p":
            vf_filters.append("scale='min(854,iw)':'min(480,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2")

        if vf_filters:
            cmd.extend(["-vf", ",".join(vf_filters)])

        # Determine best available hardware or software encoder
        chosen_encoder = None
        if use_gpu and has_nvenc:
            if codec == "av1":
                # Strict AV1: only use GPU if GPU has dedicated AV1 encoder
                if "av1_nvenc" in self.supported_encoders:
                    chosen_encoder = "av1_nvenc"
            elif codec == "youtube":
                # YouTube preset: prefer GPU AV1, then HEVC, then H.264
                if "av1_nvenc" in self.supported_encoders:
                    chosen_encoder = "av1_nvenc"
                elif "hevc_nvenc" in self.supported_encoders:
                    chosen_encoder = "hevc_nvenc"
                elif "h264_nvenc" in self.supported_encoders:
                    chosen_encoder = "h264_nvenc"
            elif codec in ("hevc", "h265", "x265"):
                if "hevc_nvenc" in self.supported_encoders:
                    chosen_encoder = "hevc_nvenc"
                elif "h264_nvenc" in self.supported_encoders:
                    chosen_encoder = "h264_nvenc"
            else:
                if "h264_nvenc" in self.supported_encoders:
                    chosen_encoder = "h264_nvenc"

        if chosen_encoder:
            bitrate_val = target_bitrate or 4500
            desc = "AV1/GPU Target Size" if codec in ("youtube", "av1") else "GPU Acceleration"
            log(f"Utilizing NVIDIA GPU ({chosen_encoder}) for {desc} @ target {bitrate_val}k!", Colors.GREEN)
            cmd.extend([
                "-c:v", chosen_encoder,
                "-preset", "p4",
                "-rc", "vbr",
                "-cq", str(int(crf) if crf else 22),
                "-b:v", f"{bitrate_val}k",
                "-maxrate", f"{int(bitrate_val * 1.15)}k",
                "-bufsize", f"{int(bitrate_val * 2)}k",
                "-pix_fmt", "yuv420p",
            ])
        elif use_gpu and has_mf:
            bitrate_val = target_bitrate or 4000
            log(f"Utilizing Media Foundation GPU acceleration (h264_mf) @ {bitrate_val}k!", Colors.GREEN)
            cmd.extend([
                "-c:v", "h264_mf",
                "-b:v", f"{bitrate_val}k",
                "-pix_fmt", "yuv420p",
            ])
        elif "av1" in codec or "youtube" in codec:
            log("Utilizing AV1 compression (SVT-AV1 high efficiency).", Colors.GREEN)
            if "libsvtav1" in self.supported_encoders:
                cmd.extend(["-c:v", "libsvtav1", "-preset", "6"])
            elif "libaom-av1" in self.supported_encoders:
                cmd.extend(["-c:v", "libaom-av1"])
            else:
                cmd.extend(["-c:v", "libx265", "-preset", "faster"])
            if target_bitrate > 0:
                cmd.extend([
                    "-b:v", f"{target_bitrate}k",
                    "-maxrate", f"{int(target_bitrate * 1.15)}k",
                    "-bufsize", f"{int(target_bitrate * 2)}k",
                ])
            else:
                cmd.extend(["-crf", str(int(crf + 4) if crf else 28)])
            cmd.extend(["-pix_fmt", "yuv420p10le" if media.get("bit_depth", 8) == 10 else "yuv420p"])
        elif "hevc" in codec or "x265" in codec:
            log("Utilizing CPU Intel Core i5 (libx265) AVX2 high-efficiency compression.", Colors.YELLOW)
            cmd.extend([
                "-c:v", "libx265",
                "-preset", "faster",
                "-tag:v", "hvc1",
            ])
            if target_bitrate > 0:
                cmd.extend([
                    "-b:v", f"{target_bitrate}k",
                    "-maxrate", f"{int(target_bitrate * 1.15)}k",
                    "-bufsize", f"{int(target_bitrate * 2)}k",
                ])
            else:
                cmd.extend(["-crf", str(crf)])
            if media.get("bit_depth", 8) == 10:
                cmd.extend(["-pix_fmt", "yuv420p10le"])
            else:
                cmd.extend(["-pix_fmt", "yuv420p"])
        else:
            cmd.extend(["-c:v", "libx264"])
            if target_bitrate > 0:
                cmd.extend([
                    "-b:v", f"{target_bitrate}k",
                    "-maxrate", f"{int(target_bitrate * 1.15)}k",
                    "-bufsize", f"{int(target_bitrate * 2)}k",
                ])
            else:
                cmd.extend(["-crf", str(min(22, int(crf) if crf else 22))])
            cmd.extend(["-preset", "veryfast", "-pix_fmt", "yuv420p"])

        # Audio Configuration
        # YouTube & AV1 presets strictly use Opus high-efficiency audio
        if codec in ("youtube", "av1") or profile.get("preferred_audio_codec") == "opus":
            log(f"Transcoding audio to Opus @ {audio_kbps}k (high efficiency standard).", Colors.GREEN)
            cmd.extend(["-map", "0:a?", "-c:a", "libopus", "-b:a", f"{audio_kbps}k"])
        else:
            # Audio Preservation: map all audio tracks, retain untouched lossless/surround
            cmd.extend(["-map", "0:a?", "-c:a", "copy"])

        # Subtitle Preservation: map all subtitle tracks untouched
        cmd.extend(["-map", "0:s?", "-c:s", "copy"])

        # Metadata & Chapters Preservation
        cmd.extend(["-map_metadata", "0", "-map_chapters", "0"])

        # Progress reporting output pipe
        cmd.extend(["-progress", "pipe:1", "-nostats", output_file])

        return cmd

    def run_transcode(self, job_data: dict):
        job = job_data.get("job")
        if not job:
            return

        job_id = job["id"]
        filename = job["filename"]
        source_size = job.get("source_size_bytes", 0)
        duration_sec = job.get("media", {}).get("duration_seconds", 0)

        self.current_job_id = job_id
        self._flag_job_cancelled = False
        log(f"{Colors.BOLD}=== Starting Job #{job_id}: {filename} ==={Colors.RESET}", Colors.CYAN)

        source_local = None
        output_local = None

        try:
            # Check if job was cancelled while waiting
            if self.is_job_cancelled(job_id):
                raise JobCancelledException(f"Job #{job_id} was cancelled before starting.")

            # 1. Download source from server
            source_local = self.download_source_file(job_id, filename, source_size)

            # Check again after download
            if self._flag_job_cancelled or self.is_job_cancelled(job_id):
                raise JobCancelledException(f"Job #{job_id} was cancelled after download.")

            # 2. Output destination path
            base, ext = os.path.splitext(filename)
            output_local = os.path.join(self.temp_dir, f"encoded_{job_id}_{base}.mkv")

            # 3. Build FFmpeg command
            cmd = self.build_ffmpeg_args(source_local, output_local, job)
            log(f"Executing local FFmpeg transcode...", Colors.CYAN)
            log(f"Command: {' '.join(cmd[:12])} ...", Colors.DIM)

            # 4. Run FFmpeg and stream progress
            self.active_process = subprocess.Popen(
                cmd,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                bufsize=1,
            )

            start_t = time.time()
            last_report_t = 0
            cur_fps = 0.0
            cur_speed = 0.0
            out_time_sec = 0.0

            while True:
                if self._flag_job_cancelled:
                    self._terminate_active_process()
                    raise JobCancelledException(f"Job #{job_id} was cancelled by user.")

                line = self.active_process.stdout.readline()
                if not line and self.active_process.poll() is not None:
                    break
                line = line.strip()
                if "=" in line:
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip()

                    if key == "fps":
                        try:
                            cur_fps = float(val)
                        except ValueError:
                            pass
                    elif key == "speed":
                        try:
                            cur_speed = float(val.replace("x", ""))
                        except ValueError:
                            pass
                    elif key == "out_time_us":
                        try:
                            out_time_sec = float(val) / 1000000.0
                        except ValueError:
                            pass
                    elif key == "progress" and val in ["continue", "end"]:
                        pct = (out_time_sec / duration_sec) * 100.0 if duration_sec > 0 else 0.0
                        pct = min(99.9, max(0.0, pct))
                        remaining_sec = max(0, int((duration_sec - out_time_sec) / max(0.1, cur_speed))) if cur_speed > 0 else 0

                        # Update console
                        mins = remaining_sec // 60
                        secs = remaining_sec % 60
                        sys.stdout.write(f"\r  Encoding: {pct:.1f}% | {cur_fps:.1f} fps | {cur_speed:.2f}x speed | ETA: {mins:02d}m {secs:02d}s ... ")
                        sys.stdout.flush()

                        # Report to server periodically and check cancellation
                        now = time.time()
                        if now - last_report_t >= 1.5:
                            last_report_t = now
                            should_cancel = self.report_progress(job_id, pct, cur_fps, cur_speed, remaining_sec, out_time_sec)
                            if should_cancel or self._flag_job_cancelled:
                                log(f"\n[Server signaled cancellation for Job #{job_id}!] Aborting transcode...", Colors.YELLOW)
                                self._flag_job_cancelled = True
                                self._terminate_active_process()
                                raise JobCancelledException(f"Job #{job_id} was cancelled by user.")

            if self._flag_job_cancelled:
                self._terminate_active_process()
                raise JobCancelledException(f"Job #{job_id} was cancelled by user.")

            self.active_process.wait()
            ret_code = self.active_process.returncode
            print()

            if self._flag_job_cancelled:
                raise JobCancelledException(f"Job #{job_id} was cancelled by user.")

            if ret_code != 0:
                stderr_err = ""
                if self.active_process.stderr:
                    try:
                        stderr_err = self.active_process.stderr.read()
                    except Exception:
                        pass
                raise RuntimeError(f"FFmpeg failed with exit code {ret_code}: {stderr_err[:300]}")

            if not os.path.exists(output_local) or os.path.getsize(output_local) < 1024:
                raise RuntimeError("Encoded output file was not created or is empty.")

            out_size = os.path.getsize(output_local)
            saved_mb = (source_size - out_size) / (1024 * 1024)
            pct_saved = ((source_size - out_size) / source_size) * 100 if source_size > 0 else 0
            log(f"Local transcode complete! Output size: {out_size / (1024*1024):.1f} MB (Saved {saved_mb:.1f} MB / {pct_saved:.1f}%)", Colors.GREEN)

            # 5. Upload completed file to server for 6-point verification & atomic replacement
            upload_ok = self.upload_output_file(job_id, output_local)
            if not upload_ok:
                if self._flag_job_cancelled:
                    raise JobCancelledException(f"Job #{job_id} was cancelled during upload.")
                raise RuntimeError("Failed to upload completed file to server.")

            log(f"{Colors.BOLD}=== Job #{job_id} Finished Successfully! ==={Colors.RESET}\n", Colors.GREEN)

        except JobCancelledException as ce:
            log(f"\n[Job #{job_id} Cancelled] {ce}", Colors.YELLOW)
            if output_local and os.path.exists(output_local):
                try:
                    os.remove(output_local)
                except OSError:
                    pass
        except Exception as e:
            if not self._flag_job_cancelled:
                log(f"Error executing Job #{job_id}: {e}", Colors.RED)
                self.report_failure(job_id, str(e))
            else:
                log(f"\n[Job #{job_id} Cancelled] Transcode stopped.", Colors.YELLOW)
        finally:
            self._flag_job_cancelled = False
            self.current_job_id = None
            self.active_process = None
            # Clean up local temporary files with safe handle release retry
            for p in [source_local, output_local]:
                if p:
                    safe_remove(p)

    def start(self):
        log(f"{Colors.BOLD}=================================================================={Colors.RESET}", Colors.BLUE)
        log(f"{Colors.BOLD}   Jellyfin Media Optimizer - Distributed Windows Worker Node     {Colors.RESET}", Colors.BLUE)
        log(f"{Colors.BOLD}=================================================================={Colors.RESET}", Colors.BLUE)
        log(f"Server Target : {self.server_url}", Colors.CYAN)
        log(f"Node Name     : {self.node_name}", Colors.CYAN)
        log(f"CPU Model     : {self.cpu_info}", Colors.CYAN)
        log(f"GPU Model     : {self.gpu_info}", Colors.CYAN)
        log(f"FFmpeg Path   : {self.ffmpeg_path}", Colors.CYAN)
        log(f"Encoders      : {', '.join(self.supported_encoders)}", Colors.CYAN)
        accel_desc = "NVIDIA Quadro K620 GPU (h264_nvenc - Hardware Accelerated)" if ("h264_nvenc" in self.supported_encoders and self.prefer_gpu) else "CPU Intel Core i5 (libx265 / AVX2)"
        log(f"Mode          : {accel_desc}", Colors.GREEN if "h264_nvenc" in self.supported_encoders else Colors.YELLOW)
        log(f"Work Temp Dir : {self.temp_dir}", Colors.CYAN)
        print()

        # Initial registration
        if not self.register_node():
            log(f"Retrying connection to server in 5 seconds...", Colors.YELLOW)
            time.sleep(5)
            self.register_node()

        # Start background heartbeat thread
        hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        hb_thread.start()

        log("Worker online! Polling server for optimization queue jobs...", Colors.GREEN)

        while self.is_running:
            try:
                poll_res = self.poll_for_job()
                if poll_res.get("has_job"):
                    self.run_transcode(poll_res)
                else:
                    time.sleep(3)
            except KeyboardInterrupt:
                log("Received shutdown signal. Stopping worker...", Colors.YELLOW)
                self.is_running = False
                if self.active_process:
                    self.active_process.terminate()
                break
            except Exception as e:
                log(f"Poll error: {e}", Colors.RED)
                time.sleep(5)

_single_instance_socket = None

def check_single_instance(port: int = 58421) -> bool:
    """Ensures only one worker instance runs on this machine at a time using a dedicated loopback socket."""
    global _single_instance_socket
    try:
        _single_instance_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        _single_instance_socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        _single_instance_socket.bind(("127.0.0.1", port))
        _single_instance_socket.listen(1)
        return True
    except socket.error:
        return False

if __name__ == "__main__":
    if not check_single_instance():
        log("Another instance of Jellyfin Optimizer Worker is already active on this system. Exiting to avoid collision.", Colors.YELLOW)
        sys.exit(0)

    parser = argparse.ArgumentParser(description="Jellyfin Media Optimizer Windows Worker Node")
    parser.add_argument("--server", default=DEFAULT_SERVER_URL, help=f"Optimizer server URL (default: {DEFAULT_SERVER_URL})")
    parser.add_argument("--node-id", default=NODE_ID, help=f"Unique node identifier (default: {NODE_ID})")
    parser.add_argument("--node-name", default=NODE_NAME, help=f"Display name (default: {NODE_NAME})")
    parser.add_argument("--prefer-gpu", action="store_true", default=True, help="Prefer NVIDIA Quadro K620 GPU acceleration (default: True)")
    parser.add_argument("--cpu-only", action="store_true", default=False, help="Force CPU-only encoding for all jobs")
    args = parser.parse_args()

    prefer_gpu = not args.cpu_only

    worker = WindowsTranscodeWorker(
        server_url=args.server,
        node_id=args.node_id,
        node_name=args.node_name,
        prefer_gpu=prefer_gpu,
    )
    worker.start()
