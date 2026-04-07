# StayGuided Me — Flutter App

Islamic audio platform. Supabase directly connect করে, কোনো custom server লাগে না।

## Requirements

- Flutter 3.19+ (stable channel)
- Dart 3.3+
- Android Studio / VS Code
- Java 17+

## Build Steps

### 1. Flutter install করুন
```bash
# flutter.dev/docs/get-started/install থেকে download করুন
flutter doctor  # সব ✓ হওয়া দরকার
```

### 2. Dependencies install করুন
```bash
cd export/StayGuided-Flutter
flutter pub get
```

### 3. Debug APK build করুন (test করতে)
```bash
flutter build apk --debug
# APK: build/app/outputs/flutter-apk/app-debug.apk
```

### 4. Release APK build করুন (production)
```bash
flutter build apk --release
# APK: build/app/outputs/flutter-apk/app-release.apk
```

### 5. AAB (Play Store এর জন্য)
```bash
flutter build appbundle --release
# AAB: build/app/outputs/bundle/release/app-release.aab
```

## Project Structure

```
lib/
├── config/
│   └── app_config.dart       # Supabase keys + theme colors
├── models/
│   └── models.dart           # Series, Episode, Reciter, UserProfile
├── services/
│   ├── supabase_service.dart # সব DB operations (auth + data)
│   └── audio_player_service.dart # Audio playback (background)
├── providers/
│   └── app_providers.dart    # Riverpod state management
├── screens/
│   ├── splash_screen.dart    # Launch screen
│   ├── login_screen.dart     # Email login
│   ├── register_screen.dart  # New account
│   ├── main_shell.dart       # Bottom navigation shell
│   ├── home_screen.dart      # Featured + Popular + New
│   ├── search_screen.dart    # Search + Browse Categories
│   ├── library_screen.dart   # Saved + Continue Listening
│   ├── profile_screen.dart   # XP, Streak, Settings
│   ├── series_detail_screen.dart # Episodes list
│   └── player_screen.dart    # Full-screen audio player
├── widgets/
│   ├── series_card.dart      # Reusable series card
│   ├── mini_player.dart      # Bottom mini player bar
│   └── section_header.dart   # Section title widget
├── router.dart               # GoRouter navigation
└── main.dart                 # App entry point
```

## Features

- Email login / register (Supabase Auth)
- Home: Featured carousel, Popular series, New Releases
- Search: Full-text search + browse by category
- Library: Saved series + Continue Listening (progress)
- Profile: XP points, streak counter, listening stats
- Audio player: Background playback, lock screen controls
- Skip 15s back / 30s forward
- Playback speed: 0.5x – 2x
- Progress auto-saved to Supabase

## Supabase Configuration

App directly connects to: `https://tkruzfskhtcazjxdracm.supabase.co`

Keys are in `lib/config/app_config.dart` — change করার দরকার নেই।

### Required Supabase Tables

Admin panel থেকে `admin_panel_setup.sql` run করুন:
- `profiles` — user profiles
- `series` — audio series
- `episodes` — individual episodes
- `reciters` — content creators
- `categories` — content categories
- `listening_progress` — user progress
- `saved_series` — bookmarked series

## Troubleshooting

**Build fail: "JAVA_HOME not set"**
```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
```

**flutter pub get fail**
```bash
flutter clean
flutter pub get
```

**Audio not working on Android**
AndroidManifest.xml এ FOREGROUND_SERVICE permission দেওয়া আছে। Android 13+ এ first time permission চাইবে।
