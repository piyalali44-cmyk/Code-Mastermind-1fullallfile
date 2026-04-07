import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/models.dart';
import '../services/supabase_service.dart';
import '../services/audio_player_service.dart';

final supabaseServiceProvider = Provider<SupabaseService>((_) => SupabaseService());
final audioServiceProvider = ChangeNotifierProvider<AudioPlayerService>(
  (_) => AudioPlayerService()..init(),
);

// Auth state
final authStateProvider = StreamProvider<User?>((ref) {
  return Supabase.instance.client.auth.onAuthStateChange.map((e) => e.session?.user);
});

final currentUserProfileProvider = FutureProvider<UserProfile?>((ref) async {
  final user = Supabase.instance.client.auth.currentUser;
  if (user == null) return null;
  return SupabaseService().getProfile(user.id);
});

// Content providers
final featuredSeriesProvider = FutureProvider<List<Series>>((ref) async {
  return SupabaseService().getFeaturedSeries();
});

final popularSeriesProvider = FutureProvider<List<Series>>((ref) async {
  return SupabaseService().getPopularSeries(limit: 10);
});

final newSeriesProvider = FutureProvider<List<Series>>((ref) async {
  return SupabaseService().getNewSeries(limit: 10);
});

final categoriesProvider = FutureProvider<List<Category>>((ref) async {
  return SupabaseService().getCategories();
});

final recitersProvider = FutureProvider<List<Reciter>>((ref) async {
  return SupabaseService().getReciters();
});

final savedSeriesProvider = FutureProvider<List<Series>>((ref) async {
  return SupabaseService().getSavedSeries();
});

final recentlyPlayedProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  return SupabaseService().getRecentlyPlayed();
});

final episodesProvider = FutureProvider.family<List<Episode>, String>((ref, seriesId) async {
  return SupabaseService().getEpisodes(seriesId);
});

final seriesDetailProvider = FutureProvider.family<Series?, String>((ref, id) async {
  return SupabaseService().getSeriesById(id);
});

final searchResultsProvider = FutureProvider.family<List<Series>, String>((ref, query) async {
  if (query.isEmpty) return [];
  return SupabaseService().searchSeries(query);
});
