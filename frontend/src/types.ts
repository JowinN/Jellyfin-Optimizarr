export interface AudioTrack {
  stream_index: number;
  audio_index: number;
  codec: string;
  channels: number;
  channel_layout: string;
  sample_rate: number;
  bitrate?: number;
  language: string;
  title: string;
  is_default: boolean;
  is_forced: boolean;
  is_commentary: boolean;
}

export interface SubtitleTrack {
  stream_index: number;
  sub_index: number;
  codec: string;
  language: string;
  title: string;
  is_default: boolean;
  is_forced: boolean;
  is_bitmap: boolean;
}

export interface MediaItem {
  id: number;
  path: string;
  filename: string;
  library: 'movies' | 'tv' | 'anime';
  media_type: 'movie' | 'episode' | 'unknown';
  title?: string;
  series_name?: string;
  season_number?: number;
  episode_number?: number;
  jellyfin_item_id?: string;
  size_bytes: number;
  duration_seconds: number;
  container_format: string;
  video_codec: string;
  resolution: string;
  width: number;
  height: number;
  fps: number;
  bitrate_kbps: number;
  bit_depth: number;
  is_hdr: boolean;
  hdr_format: string;
  audio_tracks_count: number;
  audio_codecs: string;
  audio_languages: string;
  subtitle_tracks_count: number;
  subtitle_languages: string;
  mb_per_minute: number;
  efficiency_score: number;
  estimated_savings_bytes: number;
  is_candidate_for_optimization: boolean;
  optimization_status: 'unoptimized' | 'queued' | 'processing' | 'optimized' | 'skipped' | 'failed';
  last_optimized_at?: string;
  applied_profile_name?: string;
  last_scanned_at?: string;
  streams_detail?: {
    video?: any;
    audio?: AudioTrack[];
    subtitles?: SubtitleTrack[];
    chapters_count?: number;
  };
}

export interface EncodingProfile {
  id: number;
  name: string;
  description?: string;
  is_preset: boolean;
  video_codec: string;
  rate_control_mode: string;
  crf: number;
  target_bitrate_kbps: number;
  encoder_preset: string;
  pixel_format: string;
  resolution_mode: string;
  max_width: number;
  max_height: number;
  deinterlace: boolean;
  denoise: string;
  audio_policy: string;
  preferred_audio_codec: string;
  audio_bitrate_kbps: number;
  stereo_downmix_compatibility: boolean;
  allow_silent_output: boolean;
  subtitle_policy: string;
  preserve_hdr: boolean;
  hdr_to_sdr_tonemap: boolean;
  hwaccel_type: string;
  preferred_node_id?: string;
  target_mb_per_minute: number;
  min_storage_saving_percent: number;
  scale_down_percent: number;
  created_at: string;
}

export interface EncodingJob {
  id: number;
  media_item_id: number;
  profile_id: number;
  status: 'pending' | 'running' | 'paused' | 'validating' | 'replacing' | 'completed' | 'failed' | 'cancelled';
  stage: string;
  priority: number;
  is_dry_run: boolean;
  progress_percent: number;
  current_fps: number;
  current_speed: number;
  eta_seconds: number;
  out_time_seconds: number;
  encoder_used: string;
  source_path: string;
  temp_output_path?: string;
  backup_path?: string;
  replacement_mode: string;
  source_size_bytes: number;
  output_size_bytes: number;
  savings_bytes: number;
  savings_percent: number;
  assigned_node_id?: string;
  assigned_node_name?: string;
  error_message?: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ClusterNode {
  node_id: string;
  name: string;
  os_info: string;
  cpu_model: string;
  cpu_cores: number;
  gpu_model?: string;
  status: 'online' | 'offline';
  is_primary: boolean;
  last_seen?: string;
  supported_encoders: string[];
  current_job_id?: number;
}

export interface RollbackRecord {
  id: number;
  job_id?: number;
  media_item_id: number;
  original_path: string;
  backup_path: string;
  optimized_path: string;
  original_size_bytes: number;
  optimized_size_bytes: number;
  status: 'available' | 'restored' | 'purged';
  created_at: string;
  restored_at?: string;
}

export interface AnalyticsOverview {
  total_files: number;
  total_library_bytes: number;
  total_optimized_count: number;
  pending_optimization_count: number;
  failed_count: number;
  realized_savings_bytes: number;
  backup_usage_bytes: number;
  net_savings_bytes: number;
  estimated_pending_savings_bytes: number;
  average_compression_ratio: number;
  total_encoding_seconds: number;
  bytes_saved_per_hour: number;
  libraries: {
    library: string;
    total_files: number;
    optimized_files: number;
    total_source_bytes: number;
    total_current_bytes: number;
    total_saved_bytes: number;
    savings_percent: number;
  }[];
  codec_distribution: {
    codec: string;
    count: number;
    total_size_bytes: number;
  }[];
}

export interface ServerSettings {
  jellyfin_url: string;
  jellyfin_api_key_set: boolean;
  server_connected: boolean;
  server_name?: string;
  server_version?: string;
  movies_dir: string;
  tv_dir: string;
  anime_dir: string;
  work_dir: string;
  backup_dir: string;
  min_free_space_gb: number;
  max_temp_storage_gb: number;
  max_concurrent_encodes: number;
  ffmpeg_threads: number;
  default_replacement_mode: string;
  backup_retention_days: number;
  hwaccel_mode: string;
  hwaccel_available: boolean;
  detected_gpu_driver: string;
  hwaccel_fallback_cpu: boolean;
  ntfy_enabled: boolean;
  ntfy_topic?: string;
  telegram_enabled: boolean;
  smtp_enabled: boolean;
}

export interface DryRunPlan {
  media_item_id: number;
  source_path: string;
  source_size_bytes: number;
  estimated_output_size_bytes: number;
  estimated_savings_bytes: number;
  estimated_savings_percent: number;
  selected_profile_name: string;
  hardware_accel: string;
  proposed_ffmpeg_args: string[];
  required_work_space_bytes: number;
  potential_risks: string[];
}

export interface AutomationRule {
  id: number;
  name: string;
  scope_type: 'all' | 'library' | 'series';
  target_library?: string;
  target_series_name?: string;
  profile_id: number;
  profile_name?: string;
  video_codec?: string;
  assigned_node_id?: string;
  assigned_node_name?: string;
  replacement_mode: 'safe_backup' | 'in_place';
  priority: number;
  is_active: boolean;
  auto_encode_new: boolean;
  auto_encode_existing: boolean;
  last_run_at?: string;
  matched_count: number;
  queued_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleCreate {
  name: string;
  scope_type: 'all' | 'library' | 'series';
  target_library?: string;
  target_series_name?: string;
  profile_id: number;
  assigned_node_id?: string;
  assigned_node_name?: string;
  replacement_mode: 'safe_backup' | 'in_place';
  priority: number;
  is_active: boolean;
  auto_encode_new: boolean;
  auto_encode_existing: boolean;
}

export interface AutomationRuleUpdate {
  name?: string;
  scope_type?: 'all' | 'library' | 'series';
  target_library?: string;
  target_series_name?: string;
  profile_id?: number;
  assigned_node_id?: string;
  assigned_node_name?: string;
  replacement_mode?: 'safe_backup' | 'in_place';
  priority?: number;
  is_active?: boolean;
  auto_encode_new?: boolean;
  auto_encode_existing?: boolean;
}

export interface AutomationSeries {
  series_name: string;
  total_episodes: number;
  unoptimized_episodes: number;
  library: string;
}

export interface AutomationLibrary {
  library: string;
  total_items: number;
  unoptimized_items: number;
}

export interface AutomationEvaluateResult {
  rule_id?: number;
  rule_name?: string;
  queued_jobs: number;
  matched_items: number;
  message: string;
}

