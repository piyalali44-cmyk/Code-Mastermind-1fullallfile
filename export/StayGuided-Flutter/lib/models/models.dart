// ─── Actual DB column names (verified from SQL schema) ───────────────────────
// profiles:   display_name, subscription_tier, joined_at, total_listening_hours
// series:     title, cover_url, category_id, is_premium, is_featured, pub_status, play_count, episode_count
// episodes:   duration (not duration_secs), cover_override_url (not image_url), pub_status
// reciters:   name_english (not name), name_arabic
// user_xp:    total_xp, level
// user_streaks: current_streak, longest_streak, last_activity_date
// listening_progress: content_type, content_id, position_ms, duration_ms, completed
// bookmarks:  content_type, content_id, title, series_name, cover_color
// ─────────────────────────────────────────────────────────────────────────────

class Series {
  final String id;
  final String title;
  final String description;
  final String? coverUrl;
  final String? categoryId;
  final int episodeCount;
  final int playCount;
  final bool isPremium;
  final bool isFeatured;
  final String pubStatus;
  final String language;

  const Series({
    required this.id,
    required this.title,
    required this.description,
    this.coverUrl,
    this.categoryId,
    this.episodeCount = 0,
    this.playCount = 0,
    this.isPremium = false,
    this.isFeatured = false,
    this.pubStatus = 'published',
    this.language = 'en',
  });

  factory Series.fromJson(Map<String, dynamic> json) {
    return Series(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? json['short_summary']?.toString() ?? '',
      coverUrl: json['cover_url']?.toString(),
      categoryId: json['category_id']?.toString(),
      episodeCount: json['episode_count'] as int? ?? 0,
      playCount: json['play_count'] as int? ?? 0,
      isPremium: json['is_premium'] as bool? ?? false,
      isFeatured: json['is_featured'] as bool? ?? false,
      pubStatus: json['pub_status']?.toString() ?? 'published',
      language: json['language']?.toString() ?? 'en',
    );
  }
}

class Episode {
  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String? audioUrl;
  final String? coverUrl;
  // DB column is 'duration' (seconds as INTEGER)
  final int durationSecs;
  final int episodeNumber;
  final bool isPremium;
  final int playCount;

  const Episode({
    required this.id,
    required this.seriesId,
    required this.title,
    required this.description,
    this.audioUrl,
    this.coverUrl,
    this.durationSecs = 0,
    this.episodeNumber = 1,
    this.isPremium = false,
    this.playCount = 0,
  });

  factory Episode.fromJson(Map<String, dynamic> json) {
    return Episode(
      id: json['id']?.toString() ?? '',
      seriesId: json['series_id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? json['short_summary']?.toString() ?? '',
      audioUrl: json['audio_url']?.toString(),
      // DB column is 'cover_override_url' — there is no 'image_url' column in episodes
      coverUrl: json['cover_override_url']?.toString(),
      // DB column is 'duration' (INTEGER seconds), NOT 'duration_secs'
      durationSecs: json['duration'] as int? ?? 0,
      episodeNumber: json['episode_number'] as int? ?? 1,
      isPremium: json['is_premium'] as bool? ?? false,
      playCount: json['play_count'] as int? ?? 0,
    );
  }

  String get formattedDuration {
    final minutes = durationSecs ~/ 60;
    final seconds = durationSecs % 60;
    if (minutes >= 60) {
      final hours = minutes ~/ 60;
      final mins = minutes % 60;
      return '${hours}h ${mins}m';
    }
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }
}

class Reciter {
  final String id;
  // DB column is 'name_english' (NOT 'name')
  final String name;
  final String? nameArabic;
  final String? bio;
  final String? photoUrl;
  final bool isActive;

  const Reciter({
    required this.id,
    required this.name,
    this.nameArabic,
    this.bio,
    this.photoUrl,
    this.isActive = true,
  });

  factory Reciter.fromJson(Map<String, dynamic> json) {
    return Reciter(
      id: json['id']?.toString() ?? '',
      // DB column is 'name_english', NOT 'name'
      name: json['name_english']?.toString() ?? '',
      nameArabic: json['name_arabic']?.toString(),
      bio: json['bio']?.toString(),
      photoUrl: json['photo_url']?.toString(),
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class Category {
  final String id;
  final String name;
  final String? nameArabic;
  final String slug;
  final String? iconUrl;
  final String? coverUrl;
  final bool isActive;

  const Category({
    required this.id,
    required this.name,
    this.nameArabic,
    required this.slug,
    this.iconUrl,
    this.coverUrl,
    this.isActive = true,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      nameArabic: json['name_arabic']?.toString(),
      slug: json['slug']?.toString() ?? '',
      iconUrl: json['icon_url']?.toString(),
      coverUrl: json['cover_url']?.toString(),
      isActive: json['is_active'] as bool? ?? true,
    );
  }
}

class UserProfile {
  final String id;
  final String email;
  // DB column is 'display_name' (NOT 'full_name')
  final String? displayName;
  final String? avatarUrl;
  final String role;
  // DB column is 'subscription_tier' (NOT 'access_tier')
  final String subscriptionTier;
  // XP is in 'user_xp' table (total_xp), NOT in profiles
  final int xp;
  final int level;
  // Streak is in 'user_streaks' table (current_streak), NOT in profiles
  final int streak;
  // DB column is 'total_listening_hours' (NUMERIC, hours), NOT 'total_listen_secs'
  final double totalListeningHours;
  final bool isBlocked;

  const UserProfile({
    required this.id,
    required this.email,
    this.displayName,
    this.avatarUrl,
    this.role = 'user',
    this.subscriptionTier = 'free',
    this.xp = 0,
    this.level = 1,
    this.streak = 0,
    this.totalListeningHours = 0.0,
    this.isBlocked = false,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    // XP may come from joined user_xp table
    final xpData = json['user_xp'] as Map?;
    final streakData = json['user_streaks'] as Map?;

    return UserProfile(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      // DB: display_name
      displayName: json['display_name']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      role: json['role']?.toString() ?? 'user',
      // DB: subscription_tier
      subscriptionTier: json['subscription_tier']?.toString() ?? 'free',
      // From user_xp table
      xp: xpData?['total_xp'] as int? ?? json['total_xp'] as int? ?? 0,
      level: xpData?['level'] as int? ?? json['level'] as int? ?? 1,
      // From user_streaks table
      streak: streakData?['current_streak'] as int? ?? json['current_streak'] as int? ?? 0,
      // DB: total_listening_hours (NUMERIC — hours, not seconds)
      totalListeningHours: (json['total_listening_hours'] as num?)?.toDouble() ?? 0.0,
      isBlocked: json['is_blocked'] as bool? ?? false,
    );
  }

  bool get isPremium => subscriptionTier == 'premium';

  String get displayNameOrEmail =>
      displayName?.isNotEmpty == true ? displayName! : email.split('@').first;

  String get formattedListeningTime {
    final h = totalListeningHours.floor();
    final m = ((totalListeningHours - h) * 60).round();
    if (h > 0) return '${h}h ${m}m';
    return '${m}m';
  }
}

class ListeningProgress {
  final String contentId;
  final String contentType;
  // DB column: position_ms (milliseconds)
  final int positionMs;
  // DB column: duration_ms (milliseconds)
  final int durationMs;
  final bool completed;

  const ListeningProgress({
    required this.contentId,
    required this.contentType,
    required this.positionMs,
    required this.durationMs,
    this.completed = false,
  });

  double get percentage =>
      durationMs > 0 ? (positionMs / durationMs).clamp(0.0, 1.0) : 0.0;

  int get positionSecs => positionMs ~/ 1000;
  int get durationSecs => durationMs ~/ 1000;
}

class SavedSeries {
  final String id;
  final String title;
  final String? coverUrl;
  final String? seriesName;

  const SavedSeries({
    required this.id,
    required this.title,
    this.coverUrl,
    this.seriesName,
  });
}
