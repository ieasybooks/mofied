#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
repo_root="$PWD"
cd apps/mobile/android
./gradlew :expo-video:testDebugUnitTest --tests expo.modules.video.managers.AudioFocusLifecycleTest \
  :react-native-async-storage_async-storage:testDebugUnitTest --tests com.reactnativecommunity.asyncstorage.AsyncStorageLifecycleTest \
  --no-daemon --max-workers=2 \
  -I "$repo_root/tests/native/android/lifecycle.gradle" \
  -PmofiedNativeTests="$repo_root/tests/native/android"
