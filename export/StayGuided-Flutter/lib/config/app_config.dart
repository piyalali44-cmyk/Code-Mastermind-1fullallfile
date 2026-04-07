import 'package:flutter/material.dart';

class AppConfig {
  // ── Supabase ─────────────────────────────────────────────────────────────
  // Pass values at build time via --dart-define, e.g.:
  //   flutter run --dart-define=SUPABASE_URL=https://... --dart-define=SUPABASE_ANON_KEY=ey...
  static const String supabaseUrl = String.fromEnvironment(
    'SUPABASE_URL',
    defaultValue: 'https://tkruzfskhtcazjxdracm.supabase.co',
  );
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
    defaultValue: '',
  );

  // ── App Info ──────────────────────────────────────────────────────────────
  static const String appName = 'StayGuided Me';
  static const String appVersion = '1.0.0';

  // ── Theme Colors ──────────────────────────────────────────────────────────
  static const Color bgPrimary = Color(0xFF080F1C);
  static const Color bgSecondary = Color(0xFF101825);
  static const Color bgCard = Color(0xFF1A2535);
  static const Color bgElevated = Color(0xFF243045);
  static const Color gold = Color(0xFFD4A030);
  static const Color goldLight = Color(0xFFE8B94A);
  static const Color textPrimary = Color(0xFFF0F4FF);
  static const Color textSecondary = Color(0xFF8899BB);
  static const Color textMuted = Color(0xFF4A5A7A);
  static const Color success = Color(0xFF10B981);
  static const Color error = Color(0xFFEF4444);
}
