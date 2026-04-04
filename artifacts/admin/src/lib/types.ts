export type AdminRole = "super_admin" | "admin" | "editor" | "content" | "support";

export interface AdminUser {
  id: string;
  auth_id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  role: AdminRole;
  is_active: boolean;
  joined_at: string;
  last_active_at?: string;
}

export interface Profile {
  id: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  country?: string;
  referral_code?: string;
  joined_at: string;
  subscription_tier: "free" | "premium";
  subscription_expires_at?: string;
  is_active: boolean;
  role?: AdminRole;
  email?: string;
  is_blocked?: boolean;
  blocked_reason?: string;
  last_active_at?: string;
  login_provider?: string;
  total_xp?: number;
  level?: number;
  streak?: number;
  total_listening_hours?: number;
}

export interface Category {
  id: string;
  name: string;
  name_arabic?: string;
  slug: string;
  icon_url?: string;
  cover_url?: string;
  description?: string;
  order_index: number;
  is_active: boolean;
  guest_access: boolean;
  free_user_access: boolean;
  premium_required: boolean;
  show_in_home: boolean;
  is_featured: boolean;
  created_at: string;
}

export interface Series {
  id: string;
  title: string;
  cover_url?: string;
  banner_url?: string;
  category_id: string;
  category?: Category;
  language: string;
  description?: string;
  short_summary?: string;
  tags?: string[];
  is_premium: boolean;
  is_featured: boolean;
  pub_status: "draft" | "under_review" | "approved" | "scheduled" | "published" | "unpublished";
  scheduled_publish_at?: string;
  episode_count?: number;
  total_duration?: number;
  play_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface Episode {
  id: string;
  series_id: string;
  series?: Series;
  episode_number: number;
  title: string;
  short_summary?: string;
  description?: string;
  audio_url?: string;
  duration?: number;
  transcript?: string;
  episode_references?: string;
  key_lessons?: string;
  is_premium: boolean;
  pub_status: "draft" | "under_review" | "approved" | "scheduled" | "published" | "unpublished";
  scheduled_publish_at?: string;
  language: string;
  cover_override_url?: string;
  play_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface JourneyChapter {
  id: string;
  chapter_number: number;
  title: string;
  subtitle?: string;
  era_label?: string;
  description?: string;
  cover_url?: string;
  series_id?: string;
  series?: Series;
  is_published: boolean;
  show_coming_soon: boolean;
  estimated_release?: string;
  order_index: number;
  episode_count?: number;
  created_at: string;
}

export interface Reciter {
  id: string;
  name_english: string;
  name_arabic?: string;
  photo_url?: string;
  bio?: string;
  streaming_source_id?: string;
  download_source_id?: string;
  api_reciter_id?: string;
  streaming_bitrate?: number;
  download_bitrate?: number;
  supports_ayah_level: boolean;
  timing_source?: string;
  fallback_reciter_id?: string;
  is_active: boolean;
  is_default: boolean;
  order_index: number;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description?: string;
  type?: "string" | "boolean" | "number" | "json";
  updated_at: string;
  updated_by?: string;
}

export interface CouponCode {
  id: string;
  code: string;
  description?: string;
  coupon_type: "percentage" | "fixed" | "free_days" | "free_period" | "price_override" | "influencer";
  discount_value: number;
  applies_to_weekly: boolean;
  applies_to_monthly: boolean;
  max_total_uses?: number;
  max_uses_per_user: number;
  new_users_only: boolean;
  first_subscription_only: boolean;
  is_active: boolean;
  expires_at?: string;
  influencer_name?: string;
  redemption_count?: number;
  created_by?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  user?: Profile;
  plan_type: "weekly" | "monthly";
  status: "active" | "cancelled" | "expired";
  start_date: string;
  end_date?: string;
  price_paid?: number;
  currency?: string;
  is_manual: boolean;
  granted_by?: string;
  grant_reason?: string;
  created_at: string;
}

export interface FeedWidget {
  id: string;
  zone: string;
  widget_type: string;
  title?: string;
  content?: Record<string, unknown>;
  is_active: boolean;
  priority: number;
  target_user_type: "all" | "guest" | "free" | "premium";
  target_country?: string;
  target_language?: string;
  target_platform?: string;
  starts_at?: string;
  ends_at?: string;
  created_by?: string;
  created_at: string;
}

export interface PushNotification {
  id: string;
  title: string;
  body: string;
  deep_link?: string;
  target_type: "all" | "free" | "premium" | "specific";
  target_user_id?: string;
  sent_at?: string;
  sent_count?: number;
  created_by?: string;
  created_at: string;
}

export interface ContentReport {
  id: string;
  content_id: string;
  content_type: "episode" | "series";
  episode?: Episode;
  series?: Series;
  reporter_id: string;
  reporter?: Profile;
  reason: "incorrect_info" | "poor_audio" | "misleading" | "inappropriate" | "copyright" | "other";
  description?: string;
  status: "pending" | "reviewing" | "resolved" | "dismissed";
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  admin?: Profile;
  action: string;
  entity_type: string;
  entity_id?: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users_30d: number;
  premium_subscribers: number;
  total_episodes: number;
  total_series: number;
  content_hours: number;
  listening_hours_today: number;
  pending_reports: number;
  new_users_today: number;
  new_users_7d: number;
}

export interface UserXP {
  user_id: string;
  total_xp: number;
  level: number;
  updated_at: string;
}

export interface Streak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string;
}
