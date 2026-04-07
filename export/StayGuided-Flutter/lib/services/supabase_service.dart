import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';

class SupabaseService {
  static final SupabaseService _instance = SupabaseService._internal();
  factory SupabaseService() => _instance;
  SupabaseService._internal();

  SupabaseClient get _client => Supabase.instance.client;
  User? get currentUser => _client.auth.currentUser;
  bool get isLoggedIn => currentUser != null;

  // ── Auth ────────────────────────────────────────────────────────────────

  Future<AuthResponse> signIn(String email, String password) async {
    return await _client.auth.signInWithPassword(email: email, password: password);
  }

  Future<AuthResponse> signUp(String email, String password, String fullName) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      data: {'full_name': fullName},
    );
    if (response.user != null) {
      await _ensureProfile(response.user!, fullName, email);
    }
    return response;
  }

  Future<void> signOut() async {
    await _client.auth.signOut();
  }

  Future<void> resetPassword(String email) async {
    await _client.auth.resetPasswordForEmail(email);
  }

  Future<void> _ensureProfile(User user, String fullName, String email) async {
    await _client.from('profiles').upsert({
      'id': user.id,
      'email': email,
      'full_name': fullName,
      'role': 'user',
      'access_tier': 'free',
      'xp': 0,
      'streak_days': 0,
    });
  }

  // ── Profile ─────────────────────────────────────────────────────────────

  Future<UserProfile?> getProfile(String userId) async {
    final data = await _client
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();
    if (data == null) return null;
    return UserProfile.fromJson(data);
  }

  Future<void> updateProfile(String userId, Map<String, dynamic> updates) async {
    await _client.from('profiles').update(updates).eq('id', userId);
  }

  // ── Series ──────────────────────────────────────────────────────────────

  Future<List<Series>> getSeries({
    int limit = 20,
    int offset = 0,
    String? categoryId,
    bool featuredOnly = false,
    String orderBy = 'created_at',
    bool ascending = false,
  }) async {
    var query = _client
        .from('series')
        .select('*, reciters(name)')
        .eq('pub_status', 'published');

    if (categoryId != null) query = query.eq('category_id', categoryId);
    if (featuredOnly) query = query.eq('is_featured', true);

    final data = await query
        .order(orderBy, ascending: ascending)
        .range(offset, offset + limit - 1);

    return data
        .map((e) => Series.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<List<Series>> getFeaturedSeries() async {
    return getSeries(featuredOnly: true, limit: 5);
  }

  Future<List<Series>> getPopularSeries({int limit = 10}) async {
    return getSeries(limit: limit, orderBy: 'play_count', ascending: false);
  }

  Future<List<Series>> getNewSeries({int limit = 10}) async {
    return getSeries(limit: limit, orderBy: 'created_at', ascending: false);
  }

  Future<Series?> getSeriesById(String id) async {
    final data = await _client
        .from('series')
        .select('*, reciters(name, photo_url, bio)')
        .eq('id', id)
        .maybeSingle();
    if (data == null) return null;
    return Series.fromJson(data);
  }

  Future<List<Series>> searchSeries(String query) async {
    final data = await _client
        .from('series')
        .select('*, reciters(name)')
        .eq('pub_status', 'published')
        .ilike('title', '%$query%')
        .limit(20);
    return data.map((e) => Series.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── Episodes ─────────────────────────────────────────────────────────────

  Future<List<Episode>> getEpisodes(String seriesId) async {
    final data = await _client
        .from('episodes')
        .select()
        .eq('series_id', seriesId)
        .eq('pub_status', 'published')
        .order('episode_number', ascending: true);
    return data.map((e) => Episode.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<Episode?> getEpisodeById(String id) async {
    final data = await _client
        .from('episodes')
        .select()
        .eq('id', id)
        .maybeSingle();
    if (data == null) return null;
    return Episode.fromJson(data);
  }

  // ── Reciters ─────────────────────────────────────────────────────────────

  Future<List<Reciter>> getReciters() async {
    final data = await _client
        .from('reciters')
        .select()
        .order('name', ascending: true);
    return data.map((e) => Reciter.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── Categories ────────────────────────────────────────────────────────────

  Future<List<Category>> getCategories() async {
    final data = await _client
        .from('categories')
        .select()
        .order('name', ascending: true);
    return data.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  // ── Listening Progress ─────────────────────────────────────────────────────

  Future<void> saveProgress(String episodeId, int progressSecs, int durationSecs) async {
    final userId = currentUser?.id;
    if (userId == null) return;

    await _client.from('listening_progress').upsert({
      'user_id': userId,
      'episode_id': episodeId,
      'progress_secs': progressSecs,
      'duration_secs': durationSecs,
      'completed': progressSecs >= durationSecs * 0.9,
      'updated_at': DateTime.now().toIso8601String(),
    });
  }

  Future<Map<String, ListeningProgress>> getAllProgress() async {
    final userId = currentUser?.id;
    if (userId == null) return {};

    final data = await _client
        .from('listening_progress')
        .select()
        .eq('user_id', userId);

    final Map<String, ListeningProgress> result = {};
    for (final row in data) {
      final ep = row as Map<String, dynamic>;
      result[ep['episode_id'].toString()] = ListeningProgress(
        episodeId: ep['episode_id'].toString(),
        progressSecs: ep['progress_secs'] as int? ?? 0,
        durationSecs: ep['duration_secs'] as int? ?? 0,
        completed: ep['completed'] as bool? ?? false,
      );
    }
    return result;
  }

  Future<List<Map<String, dynamic>>> getRecentlyPlayed({int limit = 5}) async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    final data = await _client
        .from('listening_progress')
        .select('*, episodes(*, series(title, cover_url))')
        .eq('user_id', userId)
        .order('updated_at', ascending: false)
        .limit(limit);

    return List<Map<String, dynamic>>.from(data);
  }

  // ── Play Count ─────────────────────────────────────────────────────────────

  Future<void> incrementPlayCount(String seriesId) async {
    await _client.rpc('increment_play_count', params: {'series_id': seriesId});
  }

  // ── XP & Streak ────────────────────────────────────────────────────────────

  Future<void> dailyLoginXP() async {
    final userId = currentUser?.id;
    if (userId == null) return;

    final today = DateTime.now().toIso8601String().split('T').first;
    final existing = await _client
        .from('xp_events')
        .select('id')
        .eq('user_id', userId)
        .eq('event_type', 'daily_login')
        .gte('created_at', '${today}T00:00:00')
        .maybeSingle();

    if (existing == null) {
      await _client.from('xp_events').insert({
        'user_id': userId,
        'event_type': 'daily_login',
        'xp_amount': 10,
      });
      await _client.rpc('increment_user_xp', params: {
        'p_user_id': userId,
        'p_xp': 10,
      });
    }
  }

  // ── Saved / Library ─────────────────────────────────────────────────────────

  Future<void> saveSeries(String seriesId) async {
    final userId = currentUser?.id;
    if (userId == null) return;
    await _client.from('saved_series').upsert({
      'user_id': userId,
      'series_id': seriesId,
    });
  }

  Future<void> unsaveSeries(String seriesId) async {
    final userId = currentUser?.id;
    if (userId == null) return;
    await _client
        .from('saved_series')
        .delete()
        .eq('user_id', userId)
        .eq('series_id', seriesId);
  }

  Future<List<Series>> getSavedSeries() async {
    final userId = currentUser?.id;
    if (userId == null) return [];

    final data = await _client
        .from('saved_series')
        .select('series(*, reciters(name))')
        .eq('user_id', userId)
        .order('created_at', ascending: false);

    return data
        .map((e) => Series.fromJson((e as Map<String, dynamic>)['series'] as Map<String, dynamic>))
        .toList();
  }

  Future<bool> isSeriesSaved(String seriesId) async {
    final userId = currentUser?.id;
    if (userId == null) return false;
    final data = await _client
        .from('saved_series')
        .select('id')
        .eq('user_id', userId)
        .eq('series_id', seriesId)
        .maybeSingle();
    return data != null;
  }
}
