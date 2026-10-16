import sqlite3

con = sqlite3.connect('/app/data/optimizer.db')
cur = con.cursor()
exists = cur.execute("SELECT id FROM encoding_profiles WHERE name LIKE 'GPU Target Size%'").fetchone()
if not exists:
    cur.execute('''
        INSERT INTO encoding_profiles (
            name, description, is_preset, video_codec, rate_control_mode,
            crf, target_bitrate_kbps, max_bitrate_kbps, bufsize_kbps,
            encoder_preset, pixel_format, resolution_mode, max_width, max_height,
            deinterlace, denoise, audio_policy, preferred_audio_codec, audio_bitrate_kbps,
            stereo_downmix_compatibility, allow_silent_output, subtitle_policy,
            preserve_hdr, hdr_to_sdr_tonemap, hwaccel_type, target_mb_per_minute,
            min_storage_saving_percent, scale_down_percent, preferred_node_id,
            created_at, updated_at
        ) VALUES (
            'GPU Target Size (8.5 MB/min • 720p H.264 NVENC + Opus)',
            'Blazing fast GPU hardware target: 8.5 MB/min (~1 GB for 2-hour movie, ~204 MB for 24-min episode). Encodes at 80-100+ fps on NVIDIA GPU (NVENC), downscales to 720p with Opus audio.',
            1, 'h264', 'target_bitrate',
            24.0, 0, 0, 0,
            'p4', 'yuv420p', '720p', 0, 0,
            0, 'none', 'transcode_all', 'opus', 96,
            0, 0, 'copy_all',
            0, 1, 'cuda', 8.5,
            20.0, 0, 'windows-node',
            datetime('now'), datetime('now')
        )
    ''')
    con.commit()
    print("GPU Target Size profile inserted successfully! ID:", cur.lastrowid)
else:
    print("GPU Target Size profile already exists: ID", exists[0])

rows = cur.execute("SELECT id, name, video_codec, target_mb_per_minute, hwaccel_type, preferred_node_id FROM encoding_profiles").fetchall()
for r in rows:
    print(r)
