# v0.2.1 pairing and portrait regression fix
- Native Remote displays TV six-digit code at top. Scrollable portrait layout with keyboard resize.
- Wi-Fi NSD supports multiple IPv4 addresses, retains manual private-IP fallback and holds multicast lock.
- Remote checks TV /health and /remote.html, then opens remote.html?code=******&auto=1 to pair directly without second code entry.
- TV prominently displays its current LAN IP and refreshes when network changes.
- Rust flushes invalid-code WebSocket response before closing.
- Incremented APK versionCode 2; both TV and Remote must be installed at matching versions.
- Test automatic NSD, manual IP, one-player and two-player, and keyboard accessibility on real devices before declaring ready.
- Requires reachable LAN; VPN/guest Wi-Fi isolation can prevent pairing.