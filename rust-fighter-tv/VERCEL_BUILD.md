# Rust Fighter TV + Remote — Vercel Build

This is a **source package**, not two compiled APKs. It contains a Vercel custom build
pipeline for cross-compiling the Rust server and assembling two Android debug APKs.

## Vercel setup

1. Push this folder as the **root of a separate Git repository**; keep AutoTax main unchanged.
2. Link that repository to the new `rust-fighter-tv-apk-build` project in Vercel team HDDV.
3. Framework preset: Other; Build command: `bash scripts/vercel-build-apks.sh`;
   Output directory: `dist`; Install command: `echo ready`.
4. Deploy preview. Confirm build logs show both APKs and their SHA-256 hashes.
5. The resulting deployment serves `/Rust_Fighter_GoogleTV_v0.2.0.apk` and
   `/Rust_Fighter_Remote_Android_v0.2.0.apk` if the build succeeded.

## Important limitations

- Vercel limits deployment builds to 45 minutes. This bootstrap downloads Java,
  Android SDK/NDK, Rust and Gradle; a cold build may time out or exhaust resources.
- A self-contained build is only known to work AFTER Vercel outputs actual APK files.
- Debug signing is for QA only and does not ensure upgrade compatibility between builds.
- The TV APK hosts the LAN game server; the Phone APK connects on same LAN.
- Do not call a Vercel READY status proof of gameplay QA. Test on physical TV and phones.
- Android APK compilation is better suited to Android-specific CI, but Vercel custom
  builds are attempted here at the user's explicit request.

## Local alternative

Run `bash scripts/vercel-build-apks.sh` on an x86_64 Linux host with network access,
then inspect `dist/` for both APKs.
