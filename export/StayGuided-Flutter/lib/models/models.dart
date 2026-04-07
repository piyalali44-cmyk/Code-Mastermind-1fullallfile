class Series {
  final String id;
  final String title;
  final String description;
  final String? coverUrl;
  final String? reciterId;
  final String? reciterName;
  final String? categoryId;
  final int episodeCount;
  final int playCount;
  final bool isPremium;
  final bool isFeatured;
  final String pubStatus;

  const Series({
    required this.id,
    required this.title,
    required this.description,
    this.coverUrl,
    this.reciterId,
    this.reciterName,
    this.categoryId,
    this.episodeCount = 0,
    this.playCount = 0,
    this.isPremium = false,
    this.isFeatured = false,
    this.pubStatus = 'published',
  });

  factory Series.fromJson(Map<String, dynamic> json) {
    return Series(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString() ?? '',
      coverUrl: json['cover_url']?.toString(),
      reciterId: json['reciter_id']?.toString(),
      reciterName: json['reciter_name']?.toString() ??
          (json['reciters'] as Map?)?['name']?.toString(),
      categoryId: json['category_id']?.toString(),
      episodeCount: json['episode_count'] as int? ?? 0,
      playCount: json['play_count'] as int? ?? 0,
      isPremium: json['is_premium'] as bool? ?? false,
      isFeatured: json['is_featured'] as bool? ?? false,
      pubStatus: json['pub_status']?.toString() ?? 'published',
    );
  }
}

class Episode {
  final String id;
  final String seriesId;
  final String title;
  final String description;
  final String? audioUrl;
  final String? imageUrl;
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
    this.imageUrl,
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
      description: json['description']?.toString() ?? '',
      audioUrl: json['audio_url']?.toString(),
      imageUrl: json['image_url']?.toString() ?? json['cover_override_url']?.toString(),
      durationSecs: json['duration_secs'] as int? ?? 0,
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
    return '${minutes}:${seconds.toString().padLeft(2, '0')}';
  }
}

class Reciter {
  final String id;
  final String name;
  final String? bio;
  final String? photoUrl;
  final int seriesCount;

  const Reciter({
    required this.id,
    required this.name,
    this.bio,
    this.photoUrl,
    this.seriesCount = 0,
  });

  factory Reciter.fromJson(Map<String, dynamic> json) {
    return Reciter(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      bio: json['bio']?.toString(),
      photoUrl: json['photo_url']?.toString(),
      seriesCount: json['series_count'] as int? ?? 0,
    );
  }
}

class Category {
  final String id;
  final String name;
  final String? iconUrl;
  final String? color;

  const Category({
    required this.id,
    required this.name,
    this.iconUrl,
    this.color,
  });

  factory Category.fromJson(Map<String, dynamic> json) {
    return Category(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      iconUrl: json['icon_url']?.toString(),
      color: json['color']?.toString(),
    );
  }
}

class UserProfile {
  final String id;
  final String email;
  final String? fullName;
  final String? avatarUrl;
  final String role;
  final String accessTier;
  final int xp;
  final int streak;
  final int totalListenSecs;

  const UserProfile({
    required this.id,
    required this.email,
    this.fullName,
    this.avatarUrl,
    this.role = 'user',
    this.accessTier = 'free',
    this.xp = 0,
    this.streak = 0,
    this.totalListenSecs = 0,
  });

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      fullName: json['full_name']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      role: json['role']?.toString() ?? 'user',
      accessTier: json['access_tier']?.toString() ?? 'free',
      xp: json['xp'] as int? ?? 0,
      streak: json['streak_days'] as int? ?? 0,
      totalListenSecs: json['total_listen_secs'] as int? ?? 0,
    );
  }

  bool get isPremium => accessTier == 'premium' || accessTier == 'lifetime';

  String get displayName => fullName?.isNotEmpty == true ? fullName! : email.split('@').first;
}

class ListeningProgress {
  final String episodeId;
  final int progressSecs;
  final int durationSecs;
  final bool completed;

  const ListeningProgress({
    required this.episodeId,
    required this.progressSecs,
    required this.durationSecs,
    this.completed = false,
  });

  double get percentage =>
      durationSecs > 0 ? (progressSecs / durationSecs).clamp(0.0, 1.0) : 0.0;
}
