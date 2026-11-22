# Rust Fighter TV — TV APK + Android Remote

**Phiên bản mã nguồn 0.2.0; chưa xuất APK trong môi trường hiện tại.**

- **TV app:** `android-tv/tv/` — chạy Rust server JNI trực tiếp trên Google TV, tự hiện mã ghép nối P1.
- **Remote app:** `android-tv/remote/` — Android phone, tìm TV qua Wi-Fi hoặc nhập IP, cho P1 chọn chế độ và điều khiển nhân vật.
- **Rust game backend:** `src/lib.rs`, `src/main.rs` — phòng chơi, ghép mã, CPU, 3 hiệp đổi bên.
- **HTML5 frontends:** `public/` — màn hình TV và điện thoại.
- **Bản build APK tự động:** `.github/workflows/android-apk.yml`.
- **Hướng dẫn build + kiểm thử:** [BUILD_APK.md](BUILD_APK.md).

Các ảnh nhân vật là hình được tạo mới theo kiểu arcade, không phải tài sản Street Fighter được cấp phép.
