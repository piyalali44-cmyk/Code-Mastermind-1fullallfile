import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:just_audio_background/just_audio_background.dart';
import '../models/models.dart';
import 'supabase_service.dart';

class AudioPlayerService extends ChangeNotifier {
  static final AudioPlayerService _instance = AudioPlayerService._internal();
  factory AudioPlayerService() => _instance;
  AudioPlayerService._internal();

  final AudioPlayer _player = AudioPlayer();
  final SupabaseService _db = SupabaseService();

  Episode? _currentEpisode;
  Series? _currentSeries;
  bool _isLoading = false;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;
  bool _isPlaying = false;
  double _speed = 1.0;

  Episode? get currentEpisode => _currentEpisode;
  Series? get currentSeries => _currentSeries;
  bool get isLoading => _isLoading;
  Duration get position => _position;
  Duration get duration => _duration;
  bool get isPlaying => _isPlaying;
  bool get hasAudio => _currentEpisode != null;
  double get speed => _speed;

  double get progress =>
      _duration.inMilliseconds > 0
          ? (_position.inMilliseconds / _duration.inMilliseconds).clamp(0.0, 1.0)
          : 0.0;

  void init() {
    _player.positionStream.listen((pos) {
      _position = pos;
      notifyListeners();
      // Save progress every 10 seconds
      if (pos.inSeconds % 10 == 0 && _currentEpisode != null) {
        _db.saveProgress(
          _currentEpisode!.id,
          pos.inSeconds,
          _duration.inSeconds,
        );
      }
    });

    _player.durationStream.listen((dur) {
      _duration = dur ?? Duration.zero;
      notifyListeners();
    });

    _player.playingStream.listen((playing) {
      _isPlaying = playing;
      notifyListeners();
    });
  }

  Future<void> play(Episode episode, Series series) async {
    if (_currentEpisode?.id == episode.id && _isPlaying) return;

    _isLoading = true;
    notifyListeners();

    try {
      _currentEpisode = episode;
      _currentSeries = series;

      final audioSource = AudioSource.uri(
        Uri.parse(episode.audioUrl ?? ''),
        tag: MediaItem(
          id: episode.id,
          album: series.title,
          title: episode.title,
          artUri: series.coverUrl != null ? Uri.parse(series.coverUrl!) : null,
        ),
      );

      await _player.setAudioSource(audioSource);
      await _player.play();
      _db.incrementPlayCount(series.id);
    } catch (e) {
      debugPrint('Audio error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> togglePlay() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
  }

  Future<void> pause() => _player.pause();
  Future<void> resume() => _player.play();

  Future<void> seekTo(Duration position) async {
    await _player.seek(position);
  }

  Future<void> skipForward() async {
    final newPos = _position + const Duration(seconds: 30);
    await _player.seek(newPos < _duration ? newPos : _duration);
  }

  Future<void> skipBackward() async {
    final newPos = _position - const Duration(seconds: 15);
    await _player.seek(newPos > Duration.zero ? newPos : Duration.zero);
  }

  Future<void> setSpeed(double speed) async {
    _speed = speed;
    await _player.setSpeed(speed);
    notifyListeners();
  }

  Future<void> stop() async {
    await _player.stop();
    _currentEpisode = null;
    _currentSeries = null;
    notifyListeners();
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }
}
