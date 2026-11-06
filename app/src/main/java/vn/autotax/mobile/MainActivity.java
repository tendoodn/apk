package vn.autotax.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.browser.customtabs.CustomTabsIntent;

public class MainActivity extends Activity {
    private static final Uri SITE = Uri.parse("https://tracuuhoadon.top/");

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(padding, padding * 3, padding, padding);
        TextView title = new TextView(this);
        title.setText("AutoTax\nQuản lý và tra cứu hóa đơn điện tử");
        title.setTextSize(24);
        layout.addView(title);
        TextView description = new TextView(this);
        description.setText("Kết nối Internet để sử dụng. Đăng nhập, chọn tệp và tải kết quả được xử lý bằng trình duyệt trên điện thoại.");
        layout.addView(description);
        Button open = new Button(this);
        open.setText("Mở AutoTax");
        open.setOnClickListener(view -> openSite());
        layout.addView(open);
        setContentView(layout);
        if (state == null) openSite();
    }

    private void openSite() {
        try {
            new CustomTabsIntent.Builder()
                    .setShowTitle(true)
                    .setUrlBarHidingEnabled(true)
                    .build()
                    .launchUrl(this, SITE);
        } catch (ActivityNotFoundException missingBrowser) {
            new android.app.AlertDialog.Builder(this)
                    .setTitle("Cần trình duyệt")
                    .setMessage("Hãy cài Chrome hoặc trình duyệt hỗ trợ HTTPS rồi mở lại AutoTax.")
                    .setPositiveButton("Đóng", null)
                    .show();
        }
    }
}
