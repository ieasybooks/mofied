#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
video_root=$(bun -e 'console.log(require("node:fs").realpathSync("apps/mobile/node_modules/expo-video"))')
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT
swiftc -sanitize=thread "$video_root/ios/AudioInterruptionState.swift" tests/native/interruption-cache.swift -o "$test_dir/interruption-cache"
"$test_dir/interruption-cache"
