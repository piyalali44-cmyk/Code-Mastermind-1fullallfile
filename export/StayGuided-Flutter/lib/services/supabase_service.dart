import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';

// ─── Column-name reference (verified against actual SQL schema) ───────────────
// profiles:          id, display_name, email, avatar_url, bio, role,
//                    subscription_tier, is_blocked, total_listening_hours,
//                    joined_at, last_active_at, is_active
// series:            id, title, cover_url, category_id, description,
//                    is_premium, is_featured, pub_status, play_count, episode_count
//                    ⚠ NO reciter_id column in series
// episodes:          id, series_id, title, description, audio_url,
//                    duration (secs, INTEGER), cover_override_url,
//                    episode_number, is_premium, pub_status, play_count
// reciters:          id, name_english, name_arabic, photo_url, bio, is_active
// categories:        id, name, name_arabic, slug, icon_url, cover_url, is_active
// user_xp:           user_id, total_xp, level
// user_streaks:      user_id, current_streak, longest_streak, last_activity_date
// listening_progress: user_id, content_type, content_id,
//                     position_ms, duration_ms, completed, updated_at
//                     (PK: user_id + content_type + content_id)
// bookmarks:         id, user_id, content_type, content_id,
//                    title, series_name, cover_color, created_at
//                    ⚠ NOT 'saved_series' — use bookmarks table
// daily_xp_log:      id, user_id, xp_amount, reason, earned_at
//                    ⚠ NOT 'xp_events'
// ─────────────────────────────────────────────────────────────────────────────

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get _client => Supabase.instance.client;
  User? get currentUser => _client.auth.currentUser;
  bool get isLoggedIn => currentUser != null;

  // ── Auth ─────────────────────────────────────────────────────────────────

  Future<AuthResponse> signIn(String email, String password) async {
    return await _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<AuthResponse> signUp(String email, String password, String displayName) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: {'display_name': displayName},
    );
    if (response.user != null) {
      await _ensureProfile(response.user!, displayName, email);
    }
    return response;
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  Future<void> _ensureProfile(User user, String displayName, String email) async {
    try {
      // profiles columns: display_name, email, subscription_tier, role
      // ⚠ No 'full_name', 'access_tier', 'xp', or 'streak_days' columns!
      await _client.from('profiles').upsert({
        'id': user.id,
        'email': email,
        'display_name': displayName,  // correct column name
        'role': 'user',
        'subscription_tier': 'free', // correct column name
        'is_active': true,
      });
      // Create XP row
      await _client.from('user_xp').upsert({
        'user_id': user.id,
        'total_xp': 0,
        'level': 1,
      });
      // Create streak row
      await _client.from('user_streaks').upsert({
        'user_id': user.id,
        'current_streak': 0,
        'longest_streak': 0,
      });
    } catch (e) {
      debugPrint('Profile creation error: $e');
    }
  }

  // ── Profile ──────────────────────────────────────────────────────────────

  Future<UserProfile?> getProfile(String userId) async {
    try {
      // Join user_xp and user_streaks to get XP + streak in one call
      final data = await _client
          .from('profiles')
          .select('*, user_xp(total_xp, level), user_streaks(current_streak)')
          .eq('id', userId)
          .maybeSingle();
      if (data == null) return null;
      return UserProfile.fromJson(data);
    } catch (e) {
      debugPrint('getProfile error: $e');
      return null;
    }
  }

  Future<void> updateProfile(String userId, Map<String, dynamic> updates) async {
    // Ensure only valid profiles columns are passed
    await _client.from('profiles').update(updates).eq('id', userId);
  }

  // ── Series ───────────────────────────────────────────────────────────────
  // ⚠ series table has NO reciter_id FK — cannot join reciters here

  Future<List<Series>> getSeries({
    int limit = 20,
    int offset = 0,
    String? categoryId,
    bool featuredOnly = false,
    String orderBy = 'created_at',
    bool ascending = false,
  }) async {
    try {
      var query = _client
          .from('series')
          .select('id, title, cover_url, description, short_summary, category_id, '
                  'is_premium, is_featured, pub_status, play_count, episode_count, language')
          .eq('pub_status', 'published');

      if (categoryId != null) query = query.eq('category_id', categoryId);
      if (featuredOnly) query = query.eq('is_featured', true);

      final data = await query
          .order(orderBy, ascending: ascending)
          .range(offset, offset + limit - 1);

      return (data as List)
          .map((e) => Series.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getSeries error: $e');
      return [];
    }
  }

  Future<List<Series>> getFeaturedSeries() => getSeries(featuredOnly: true, limit: 5);
  Future<List<Series>> getPopularSeries({int limit = 10}) =>
      getSeries(limit: limit, orderBy: 'play_count', ascending: false);
  Future<List<Series>> getNewSeries({int limit = 10}) =>
      getSeries(limit: limit, orderBy: 'created_at', ascending: false);

  Future<Series?> getSeriesById(String id) async {
    try {
      final data = await _client
          .from('series')
          .select('id, title, cover_url, banner_url, description, short_summary, '
                  'category_id, is_premium, is_featured, pub_status, play_count, '
                  'episode_count, language, tags')
          .eq('id', id)
          .maybeSingle();
      if (data == null) return null;
      return Series.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      debugPrint('getSeriesById error: $e');
      return null;
    }
  }

  Future<List<Series>> searchSeries(String query) async {
    try {
      final data = await _client
          .from('series')
          .select('id, title, cover_url, description, short_summary, category_id, '
                  'is_premium, is_featured, pub_status, play_count, episode_count')
          .eq('pub_status', 'published')
          .ilike('title', '%$query%')
          .limit(20);
      return (data as List)
          .map((e) => Series.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('searchSeries error: $e');
      return [];
    }
  }

  // ── Episodes ─────────────────────────────────────────────────────────────

  Future<List<Episode>> getEpisodes(String seriesId) async {
    try {
      final data = await _client
          .from('episodes')
          .select('id, series_id, title, description, short_summary, audio_url, '
                  'duration, cover_override_url, episode_number, is_premium, '
                  'pub_status, play_count')
          .eq('series_id', seriesId)
          .eq('pub_status', 'published')
          .order('episode_number', ascending: true);
      return (data as List)
          .map((e) => Episode.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getEpisodes error: $e');
      return [];
    }
  }

  Future<Episode?> getEpisodeById(String id) async {
    try {
      final data = await _client
          .from('episodes')
          .select('id, series_id, title, description, audio_url, duration, '
                  'cover_override_url, episode_number, is_premium, pub_status')
          .eq('id', id)
          .maybeSingle();
      if (data == null) return null;
      return Episode.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  // ── Reciters ──────────────────────────────────────────────────────────────

  Future<List<Reciter>> getReciters() async {
    try {
      final data = await _client
          .from('reciters')
          .select('id, name_english, name_arabic, photo_url, bio, is_active')
          .eq('is_active', true)
          .order('name_english', ascending: true);
      return (data as List)
          .map((e) => Reciter.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getReciters error: $e');
      return [];
    }
  }

  // ── Categories ────────────────────────────────────────────────────────────

  Future<List<Category>> getCategories() async {
    try {
      final data = await _client
          .from('categories')
          .select('id, name, name_arabic, slug, icon_url, cover_url, is_active')
          .eq('is_active', true)
          .order('order_index', ascending: true);
      return (data as List)
          .map((e) => Category.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getCategories error: $e');
      return [];
    }
  }

  Future<List<Series>> getSeriesByCategory(String categoryId, {int limit = 20}) async {
    return getSeries(categoryId: categoryId, limit: limit);
  }

  // ── Listening Progress ────────────────────────────────────────────────────
  // listening_progress columns: user_id, content_type, content_id,
  //                              position_ms, duration_ms, completed, updated_at

  Future<void> saveProgress(String episodeId, int positionMs, int durationMs) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    try {
      await _client.from('listening_progress').upsert({
        'user_id': userId,
        'content_type': 'episode',  // required field with CHECK constraint
        'content_id': episodeId,
        'position_ms': positionMs,   // correct column: position_ms
        'duration_ms': durationMs,   // correct column: duration_ms
        'completed': durationMs > 0 && positionMs >= durationMs * 0.9,
        'updated_at': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      debugPrint('saveProgress error: $e');
    }
  }

  Future<Map<String, ListeningProgress>> getAllProgress() async {
    final userId = currentUser?.id;
    if (userId == null) return {};

    try {
      final data = await _client
          .from('listening_progress')
          .select('content_id, content_type, position_ms, duration_ms, completed')
          .eq('user_id', userId)
          .eq('content_type', 'episode');

      final Map<String, ListeningProgress> result = {};
      for (final row in data as List) {
        final r = row as Map<String, dynamic>;
        result[r['content_id'].toString()] = ListeningProgress(
          contentId: r['content_id'].toString(),
          contentType: r['content_type']?.toString() ?? 'episode',
          positionMs: r['position_ms'] as int? ?? 0,
          durationMs: r['duration_ms'] as int? ?? 0,
          completed: r['completed'] as bool? ?? false,
        );
      }
      return result;
    } catch (e) {
      debugPrint('getAllProgress error: $e');
      return {};
    }
  }

  Future<ListeningProgress?> getEpisodeProgress(String episodeId) async {
    final userId = currentUser?.id;
    if (userId == null) return null;

    try {
      final data = await _client
          .from('listening_progress')
          .select('content_id, content_type, position_ms, duration_ms, completed')
          .eq('user_id', userId)
          .eq('content_type', 'episode')
          .eq('content_id', episodeId)
          .maybeSingle();
      if (data == null) return null;
      final r = data as Map<String, dynamic>;
      return ListeningProgress(
        contentId: r['content_id'].toString(),
        contentType: 'episode',
        positionMs: r['position_ms'] as int? ?? 0,
        durationMs: r['duration_ms'] as int? ?? 0,
        completed: r['completed'] as bool? ?? false,
      );
    } catch (e) {
      return null;
    }
  }

  /// Returns recently played episodes from listening_history table
  Future<List<Map<String, dynamic>>> getRecentlyPlayed({int limit = 10}) async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    try {
      // listening_history columns: content_type, content_id, series_id, title,
      //                            series_name, duration_ms, listened_at
      final data = await _client
          .from('listening_history')
          .select('content_type, content_id, series_id, title, series_name, '
                  'duration_ms, listened_at')
          .eq('user_id', userId)
          .eq('content_type', 'episode')
          .order('listened_at', ascending: false)
          .limit(limit);

      return List<Map<String, dynamic>>.from(data as List);
    } catch (e) {
      debugPrint('getRecentlyPlayed error: $e');
      return [];
    }
  }

  // ── Bookmarks (Save Series) ───────────────────────────────────────────────
  // ⚠ There is NO 'saved_series' table. Use 'bookmarks' table instead.
  // bookmarks columns: id, user_id, content_type, content_id, title,
  //                    series_name, cover_color, created_at
  //                    UNIQUE(user_id, content_type, content_id)

  Future<void> saveSeries(String seriesId, String seriesTitle) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    try {
      await _client.from('bookmarks').upsert({
        'user_id': userId,
        'content_type': 'series',
        'content_id': seriesId,
        'title': seriesTitle,
      });
    } catch (e) {
      debugPrint('saveSeries error: $e');
    }
  }

  Future<void> unsaveSeries(String seriesId) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    try {
      await _client
          .from('bookmarks')
          .delete()
          .eq('user_id', userId)
          .eq('content_type', 'series')
          .eq('content_id', seriesId);
    } catch (e) {
      debugPrint('unsaveSeries error: $e');
    }
  }

  Future<List<Series>> getSavedSeries() async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    try {
      // Get saved series IDs from bookmarks
      final bookmarkData = await _client
          .from('bookmarks')
          .select('content_id')
          .eq('user_id', userId)
          .eq('content_type', 'series')
          .order('created_at', ascending: false);

      if ((bookmarkData as List).isEmpty) return [];

      final ids = bookmarkData.map((b) => b['content_id'].toString()).toList();

      // Fetch full series data
      final seriesData = await _client
          .from('series')
          .select('id, title, cover_url, description, short_summary, category_id, '
                  'is_premium, is_featured, pub_status, play_count, episode_count')
          .inFilter('id', ids);

      return (seriesData as List)
          .map((e) => Series.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      debugPrint('getSavedSeries error: $e');
      return [];
    }
  }

  Future<bool> isSeriesSaved(String seriesId) async {
    final userId = currentUser?.id;
    if (userId == null) return false;

    try {
      final data = await _client
          .from('bookmarks')
          .select('id')
          .eq('user_id', userId)
          .eq('content_type', 'series')
          .eq('content_id', seriesId)
          .maybeSingle();
      return data != null;
    } catch (e) {
      return false;
    }
  }

  // ── Play Count ────────────────────────────────────────────────────────────

  Future<void> incrementPlayCount(String seriesId) async {
    try {
      // Direct increment — no rpc function needed
      await _client.rpc('increment_play_count', params: {'series_id_param': seriesId});
    } catch (_) {
      // Silently fail — play count is optional
    }
  }

  // ── XP (daily_xp_log table) ───────────────────────────────────────────────
  // ⚠ Table is 'daily_xp_log' (NOT 'xp_events')
  // Columns: id, user_id, xp_amount, reason, earned_at

  Future<void> awardDailyLoginXP() async {
    final userId = currentUser?.id;
    if (userId == null) return;

    try {
      final today = DateTime.now().toIso8601String().split('T').first;

      // Check if already awarded today
      final existing = await _client
          .from('daily_xp_log')
          .select('id')
          .eq('user_id', userId)
          .eq('reason', 'daily_login')
          .gte('earned_at', '${today}T00:00:00')
          .maybeSingle();

      if (existing == null) {
        // Award 10 XP for daily login
        await _client.from('daily_xp_log').insert({
          'user_id': userId,
          'xp_amount': 10,
          'reason': 'daily_login',
        });

        // Update user_xp table
        await _client.from('user_xp').upsert({
          'user_id': userId,
          'total_xp': 10,
          'updated_at': DateTime.now().toIso8601String(),
        });
      }
    } catch (e) {
      debugPrint('awardDailyLoginXP error: $e');
    }
  }

  // ── User Stats ────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> getUserStats(String userId) async {
    try {
      final results = await Future.wait([
        _client.from('user_xp').select('total_xp, level').eq('user_id', userId).maybeSingle(),
        _client.from('user_streaks').select('current_streak, longest_streak').eq('user_id', userId).maybeSingle(),
      ]);
      final xp = results[0] as Map?;
      final streak = results[1] as Map?;
      return {
        'total_xp': xp?['total_xp'] ?? 0,
        'level': xp?['level'] ?? 1,
        'current_streak': streak?['current_streak'] ?? 0,
        'longest_streak': streak?['longest_streak'] ?? 0,
      };
    } catch (e) {
      return {'total_xp': 0, 'level': 1, 'current_streak': 0, 'longest_streak': 0};
    }
  }
}
