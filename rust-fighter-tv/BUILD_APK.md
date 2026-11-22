# Rust Fighter TV 2026 — 2 APK Android

**Trạng thái:** source candidate; CHƯA biên dịch APK trong phiên tạo này vì môi trường không có Android SDK, Gradle, NDK và Rust. Kiểm tra web UI giả lập WebSocket đã PASS; chưa kiểm thử TV/điện thoại thật. Không dùng nhầm ZIP mã nguồn này làm APK.

## Thiết kế chạy thực tế

- `tv`: ứng dụng Google TV độc lập. Khi mở, thư viện Rust `libfighter_native.so` tự chạy server WebSocket/HTTP trên TV (port TCP **3000**). TV tự hiện mã ghép nối P1. Không cần PC, server ngoài, internet hay cloud trong lúc chơi.
- `remote`: APK cho điện thoại Android, tìm TV tự động qua Android NSD/mDNS (`_rustfighter._tcp`), kiểm tra `/health`, rồi mở giao diện tay cầm từ **chính TV** qua WebView. Nếu mạng chặn tìm TV, nhập IP TV (hiển thị trong TV) thủ công.
- Cần TV và điện thoại cùng LAN/Wi-Fi và mạng không chặn giao tiếp client-to-client. Android System WebView phải hoạt động trên TV/điện thoại.

## Luồng chính

1. Mở APK TV: hiện một mã 6 số của P1.
2. Mở APK Remote trên điện thoại 1: tự tìm TV hoặc nhập IP, nhập mã 6 số. Mã P1 trên TV được ẩn sau khi kết nối.
3. **Điện thoại 1 (chủ phòng) chọn** đấu với máy hoặc đấu 2 người. TV không chọn chế độ; điện thoại 2 không có quyền thay đổi.
4. Chọn 1 người: chỉ cần P1, CPU tự sẵn sàng. Chọn 2 người: TV hiển thị thêm mã P2 6 số riêng, điện thoại 2 kết nối và mã P2 cũng tự ẩn.
5. Mỗi điện thoại chọn và xác nhận 1 trong 10 nhân vật. Giao diện TV chia đôi. Sau khi tất cả sẵn sàng, đếm 3-2-1.
6. Ba hiệp mỗi hiệp tối đa 75 giây, tự đổi trái/phải giữa hiệp, tính thắng theo điểm hiệp; có đấu lại.
7. Tay cầm di chuyển trái/phải, nhảy, đấm, đá, đỡ và tuyệt chiêu đủ năng lượng; hỗ trợ đa điểm chạm.

## Biên dịch tự động với GitHub Actions

Chép **nội dung thư mục ZIP này** vào gốc một repo GitHub riêng và push (nếu giữ nhánh riêng, vẫn có thể dùng nhánh đó). Workflow `.github/workflows/android-apk.yml` sẽ:

1. Cài SDK API 35 và NDK 27.2, Gradle 8.10.2, Rust stable và `cargo-ndk`.
2. Chạy `cargo test`.
3. Cross-compile Rust `.so` cho arm64-v8a và armeabi-v7a.
4. Build hai APK Android được ký bằng **khóa debug** của GitHub runner.
5. Đăng **artifact** tên `rust-fighter-tv-and-remote-apks` gồm hai tệp:
   - `Rust_Fighter_GoogleTV_v0.2.0.apk` — cài Google TV.
   - `Rust_Fighter_Remote_Android_v0.2.0.apk` — cài Android phone.

**Quan trọng:** CI cần được chạy thành công và artifact thực tồn tại mới được phép tuyên bố hai APK đã được build. Khóa debug do runner tạo có thể khác giữa các lần build, vì vậy không đảm bảo cài đè APK bản cũ. Muốn phát hành ổn định phải ký release bằng keystore cố định được bảo quản riêng.

## Biên dịch trên máy phát triển

Cần Android Studio + Android SDK Platform 35, NDK 27.2.12479018, JDK 17, Rust stable và Cargo NDK, Gradle 8.10.2 (có thể qua Android Studio). Linux/macOS:

```bash
rustup target add aarch64-linux-android armv7-linux-androideabi
cargo install cargo-ndk --locked
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/27.2.12479018"
cargo ndk -t arm64-v8a -t armeabi-v7a --platform 23 -o android-tv/tv/src/main/jniLibs build --release --lib
cd android-tv
gradle :tv:assembleDebug :remote:assembleDebug
```

Đầu ra sau build thành công:
- `android-tv/tv/build/outputs/apk/debug/tv-debug.apk`
- `android-tv/remote/build/outputs/apk/debug/remote-debug.apk`

Có thể mở thư mục `android-tv/` bằng Android Studio để Gradle đồng bộ dự án. **Bắt buộc** build Rust native `.so` trước khi build APK TV; chỉ Gradle không tự tạo `.so`.

## Kiểm thử phải thực hiện trên thiết bị thật

- Cài hai APK: Google TV arm64 hoặc armv7 và Android phone, đồng Wi-Fi; kiểm tra TV không đòi PC.
- Xác nhận TV tự hiện mã P1; Remote Android tự tìm TV; nhập mã; P1 có quyền chọn chế độ.
- Chọn 2 người, kết nối điện thoại 2; P2 không thể đổi mode; hai mã lần lượt tự ẩn.
- P1 và P2 chọn và xác nhận 10 nhân vật khác nhau, 3-2-1, hai điện thoại nhận đúng tay cầm, multi-touch.
- Kiểm tra hiệp 1, 2, 3 đổi bên trái/phải và tổng kết, đấu lại.
- Thử điện thoại ngắt Wi-Fi, kết nối lại; thử router bật AP isolation; Wi-Fi/Ethernet hỗn hợp.

## Hạn chế

- Đồ họa 10 nhân vật là minh họa được tạo mới dựa trên ngoại hình nhân vật Street Fighter. Không bao gồm sprite/animation thương mại chính thức. Đây là fan prototype, chưa có quyền phát hành thương mại các nhân vật thuộc Capcom.
- Chưa kiểm chứng hiệu suất TV thực, thời gian khởi động server NDK, WebView TV, đa chạm và mDNS trên TV thật.
- Chưa có âm thanh, đòn combo hay đầy đủ sprite animation chính thức.
- Mã phòng hiện gồm 6 chữ số ngẫu nhiên cho LAN. Không thiết kế để phơi port 3000 ra internet.
