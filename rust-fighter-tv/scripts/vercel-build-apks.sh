#!/usr/bin/env bash
set -Eeuo pipefail
# Run this in a Vercel Linux Build (x86_64) or a comparable isolated Linux CI worker.
cd "$(dirname "${BASH_SOURCE[0]}")/.."
ROOT="$PWD"
# Vercel Sandbox images may omit the host C toolchain required by Cargo build scripts.
if ! command -v cc >/dev/null 2>&1; then
  if [ "$(id -u)" = "0" ]; then
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential pkg-config
  elif command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo -n apt-get update -qq
    sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends build-essential pkg-config
  else
    echo "Host C compiler (cc) unavailable. Install build-essential before running Android build." >&2
    exit 1
  fi
fi
TOOLS="$ROOT/.toolchains"
mkdir -p "$TOOLS" "$ROOT/dist"
export PATH="$TOOLS/bin:$PATH"
function fetch() {
  local url="$1" file="$2"
  curl --fail --location --retry 3 --connect-timeout 20 --max-time 1000 -o "$file" "$url"
}
function require_file() { test -s "$1" || { echo "Missing expected artifact: $1" >&2; exit 1; }; }
if [ ! -x "$TOOLS/jdk/bin/java" ]; then
  echo 'Installing OpenJDK 17 to workspace (no root required)'
  fetch 'https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse' "$TOOLS/openjdk17.tar.gz"
  mkdir -p "$TOOLS/jdk"
  tar -xzf "$TOOLS/openjdk17.tar.gz" -C "$TOOLS/jdk" --strip-components=1
fi
export JAVA_HOME="$TOOLS/jdk"
export PATH="$JAVA_HOME/bin:$PATH"
java -version

export ANDROID_HOME="$TOOLS/android-sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
SDK="$ANDROID_HOME/cmdline-tools/latest"
if [ ! -x "$SDK/bin/sdkmanager" ]; then
  echo 'Installing Google Android command-line tools'
  mkdir -p "$SDK" "$TOOLS/tmp-android"
  fetch 'https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip' "$TOOLS/commandlinetools.zip"
  unzip -q -o "$TOOLS/commandlinetools.zip" -d "$TOOLS/tmp-android"
  cp -R "$TOOLS/tmp-android/cmdline-tools/." "$SDK/"
fi
export PATH="$SDK/bin:$ANDROID_HOME/platform-tools:$PATH"
mkdir -p "$ANDROID_HOME/licenses"
# Google's published Android SDK license digests. Verify against developer.android.com before modifying.
printf '8933bad161af4178b1185d1a37fbf41ea5269c55\n' > "$ANDROID_HOME/licenses/android-sdk-license"
printf 'd56f5187479451eabf01fb78af6dfcb131a6481e\n' > "$ANDROID_HOME/licenses/android-sdk-preview-license"
(yes | "$SDK/bin/sdkmanager" --sdk_root="$ANDROID_HOME" --licenses) > "$TOOLS/sdk-licenses.log" 2>&1 || true
"$SDK/bin/sdkmanager" --sdk_root="$ANDROID_HOME" 'platforms;android-35' 'build-tools;35.0.0' 'ndk;27.2.12479018' 'platform-tools'
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"

if [ ! -x "$TOOLS/rust/.cargo/bin/cargo" ]; then
  echo 'Installing Rust into workspace'
  fetch 'https://sh.rustup.rs' "$TOOLS/rustup-init.sh"
  export CARGO_HOME="$TOOLS/rust/.cargo"
  export RUSTUP_HOME="$TOOLS/rust/.rustup"
  sh "$TOOLS/rustup-init.sh" -y --no-modify-path --profile minimal
else
  export CARGO_HOME="$TOOLS/rust/.cargo"
  export RUSTUP_HOME="$TOOLS/rust/.rustup"
fi
export PATH="$CARGO_HOME/bin:$PATH"
rustup target add aarch64-linux-android armv7-linux-androideabi
if ! command -v cargo-ndk >/dev/null 2>&1; then cargo install cargo-ndk --locked; fi
cargo test --locked 2>/dev/null || cargo test
cargo ndk -t arm64-v8a -t armeabi-v7a --platform 23 -o android-tv/tv/src/main/jniLibs build --release --lib
require_file 'android-tv/tv/src/main/jniLibs/arm64-v8a/libfighter_native.so'
require_file 'android-tv/tv/src/main/jniLibs/armeabi-v7a/libfighter_native.so'

GRADLE="$TOOLS/gradle-8.10.2/bin/gradle"
if [ ! -x "$GRADLE" ]; then
  echo 'Installing Gradle 8.10.2 into workspace'
  fetch 'https://services.gradle.org/distributions/gradle-8.10.2-bin.zip' "$TOOLS/gradle.zip"
  unzip -q -o "$TOOLS/gradle.zip" -d "$TOOLS"
fi
export GRADLE_USER_HOME="$TOOLS/.gradle"
"$GRADLE" --no-daemon --max-workers=2 -p android-tv :tv:assembleDebug :remote:assembleDebug
require_file 'android-tv/tv/build/outputs/apk/debug/tv-debug.apk'
require_file 'android-tv/remote/build/outputs/apk/debug/remote-debug.apk'
cp android-tv/tv/build/outputs/apk/debug/tv-debug.apk dist/Rust_Fighter_GoogleTV_v0.2.0.apk
cp android-tv/remote/build/outputs/apk/debug/remote-debug.apk dist/Rust_Fighter_Remote_Android_v0.2.0.apk
cd dist
sha256sum Rust_Fighter_*.apk > SHA256SUMS.txt
printf '%s\n' 'APK artifacts are debug-signed and have NOT been validated on actual devices.' > RELEASE_STATUS.txt
ls -lh Rust_Fighter_*.apk SHA256SUMS.txt
