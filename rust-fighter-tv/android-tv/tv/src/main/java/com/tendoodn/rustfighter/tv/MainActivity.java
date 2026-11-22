package com.tendoodn.rustfighter.tv;

import android.app.Activity;
import android.graphics.Color;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;

import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.URL;
import java.util.Collections;
import java.util.Enumeration;

public final class MainActivity extends Activity {
    private static final int PORT = 3000;
    private static final String SERVICE_TYPE = "_rustfighter._tcp.";
    static { System.loadLibrary("fighter_native"); }
    private native void startNativeServer();

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView webView;
    private TextView status;
    private NsdManager nsd;
    private NsdManager.RegistrationListener registration;
    private volatile boolean isDestroyed = false;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(10, 13, 25));
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(10, 13, 25));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface public String ipAddress() { return getLanIpv4(); }
        }, "TvHost");
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                return !"127.0.0.1".equals(req.getUrl().getHost());
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (status != null) status.setVisibility(View.GONE);
            }
        });
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        status = new TextView(this);
        status.setGravity(Gravity.CENTER);
        status.setTextColor(Color.WHITE);
        status.setTextSize(21);
        status.setText("RUST FIGHTER TV\nĐANG KHỞI ĐỘNG MÁY CHỦ…");
        root.addView(status, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        registerLanService();
        try {
            startNativeServer();
            waitForRust(0);
        } catch (Throwable e) {
            status.setText("KHÔNG KHỞI ĐỘNG ĐƯỢC RUST\n" + e.getMessage());
        }
    }

    private void waitForRust(int attempt) {
        if (isDestroyed || attempt > 65) {
            if (!isDestroyed && status != null) status.setText("Không kết nối được máy chủ Rust trên TV.\nHãy đóng và mở lại ứng dụng.");
            return;
        }
        new Thread(() -> {
            boolean available = false;
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL("http://127.0.0.1:" + PORT + "/health").openConnection();
                conn.setConnectTimeout(600); conn.setReadTimeout(600);
                available = conn.getResponseCode() == 200;
            } catch (Exception ignored) { }
            finally { if (conn != null) conn.disconnect(); }
            boolean ok = available;
            handler.post(() -> {
                if (isDestroyed) return;
                if (ok) webView.loadUrl("http://127.0.0.1:" + PORT + "/");
                else handler.postDelayed(() -> waitForRust(attempt + 1), 350);
            });
        }, "RustTVHealthCheck").start();
    }

    private void registerLanService() {
        try {
            nsd = (NsdManager) getSystemService(NSD_SERVICE);
            NsdServiceInfo info = new NsdServiceInfo();
            info.setServiceName("Rust Fighter TV");
            info.setServiceType(SERVICE_TYPE);
            info.setPort(PORT);
            registration = new NsdManager.RegistrationListener() {
                @Override public void onRegistrationFailed(NsdServiceInfo i, int code) { }
                @Override public void onUnregistrationFailed(NsdServiceInfo i, int code) { }
                @Override public void onServiceRegistered(NsdServiceInfo i) { }
                @Override public void onServiceUnregistered(NsdServiceInfo i) { }
            };
            nsd.registerService(info, NsdManager.PROTOCOL_DNS_SD, registration);
        } catch (Exception ignored) { registration = null; }
    }

    public static String getLanIpv4() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback() || ni.isVirtual()) continue;
                String name = ni.getName();
                if (!(name.startsWith("wlan") || name.startsWith("eth") || name.startsWith("en"))) continue;
                Enumeration<InetAddress> addrs = ni.getInetAddresses();
                while (addrs.hasMoreElements()) {
                    InetAddress addr = addrs.nextElement();
                    if (addr instanceof Inet4Address && addr.isSiteLocalAddress()) return addr.getHostAddress();
                }
            }
        } catch (Exception ignored) { }
        return "0.0.0.0";
    }

    @Override protected void onDestroy() {
        isDestroyed = true;
        if (registration != null && nsd != null) {
            try { nsd.unregisterService(registration); } catch (Exception ignored) { }
        }
        if (webView != null) {
            webView.loadUrl("about:blank");
            webView.destroy();
        }
        super.onDestroy();
    }
}
