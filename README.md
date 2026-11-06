# AutoTax Android

Ứng dụng Android mở https://tracuuhoadon.top/ bằng Android Custom Tabs, dùng phiên đăng nhập và tính năng tải/chọn tệp của trình duyệt. Cần Internet và trình duyệt hỗ trợ Custom Tabs (ví dụ Chrome). Nếu không có, mở trình duyệt mặc định.

Mã nguồn Android tại app/. Build bằng JDK 17, Gradle 8.9 và Android SDK 35: `gradle assembleDebug lintDebug`.

GitHub Actions build APK thử nghiệm và lưu tại Releases cùng thư mục apk/. Đây là APK debug để cài thử, chưa phải bản ký phát hành Play Store. Khóa debug được giữ trong cache CI để các lần build thông thường có thể cập nhật, nhưng cache có thể hết hạn. Cần khóa ký phát hành riêng trước khi phân phối lâu dài.

Bản web hiện tại được dùng trực tiếp, không đóng gói tiện ích Chrome. Cần kiểm tra đăng nhập, tra cứu và xuất tệp trên điện thoại thật.
