#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
sdk_root="${ANDROID_HOME:-${ANDROID_SDK_ROOT:?Set ANDROID_HOME or ANDROID_SDK_ROOT}}"
build_tools="$sdk_root/build-tools/37.0.0"
android_jar="$sdk_root/platforms/android-37.0/android.jar"
probe_dir="artifacts/android-focus-probe"
mkdir -p "$probe_dir/classes" "$probe_dir/dex"
javac --release 17 -classpath "$android_jar" -d "$probe_dir/classes" tests/native/focus/FocusReceiver.java
"$build_tools/d8" --lib "$android_jar" --min-api 26 --output "$probe_dir/dex" "$probe_dir/classes/com/mofied/qa/focus/FocusReceiver.class"
"$build_tools/aapt2" link -I "$android_jar" --manifest tests/native/focus/AndroidManifest.xml -o "$probe_dir/unsigned.apk"
(cd "$probe_dir/dex" && zip -q ../unsigned.apk classes.dex)
"$build_tools/zipalign" -f 4 "$probe_dir/unsigned.apk" "$probe_dir/aligned.apk"
# Use the generated Expo development key; this helper is never shipped.
"$build_tools/apksigner" sign --ks apps/mobile/android/app/debug.keystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out "$probe_dir/probe.apk" "$probe_dir/aligned.apk"
echo "$probe_dir/probe.apk"
