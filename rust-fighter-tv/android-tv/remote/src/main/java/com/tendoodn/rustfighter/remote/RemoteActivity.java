package com.tendoodn.rustfighter.remote;

import android.app.Activity;
import android.graphics.Color;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.net.HttpURLConnection;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.URL;

public final class RemoteActivity extends Activity {
    private static final String SERVICE_TYPE = "_rustfighter._tcp.";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private LinearLayout discoveryView;
    private TextView status;
    private EditText manualAddress;
    private WebView web;
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discoverListener;
    private boolean destroyed = false;
    private boolean connecting = false;
    private String serverHost;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(13, 17, 30));
        setContentView(root);
        makeDiscoveryUi();
        try { nsd = (NsdManager) getSystemService(NSD_SERVICE); } catch (Exception ignored) { }
        startDiscovery();
    }

    private TextView text(String content, int size, int color) {
        TextView t = new TextView(this);
        t.setText(content); t.setTextColor(color); t.setTextSize(size);
        t.setGravity(Gravity.CENTER); t.setPadding(12, 10, 12, 10);
        return t;
    }

    private void makeDiscoveryUi() {
        discoveryView = new LinearLayout(this);
        discoveryView.setOrientation(LinearLayout.VERTICAL);
        discoveryView.setGravity(Gravity.CENTER);
        discoveryView.setPadding(26, 32, 26, 32);
        discoveryView.addView(text("RUST FIGHTER", 32, Color.WHITE));
        discoveryView.addView(text("ĐIỀU KHIỂN ĐIỆN THOẠI", 15, 0xFFFFBF95));
        status = text("ĐANG TÌM GOOGLE TV TRÊN WI-FI…", 16, 0xFFCCD5E4);
        discoveryView.addView(status);
        discoveryView.addView(text("Bật game trên Google TV, để TV và điện thoại cùng Wi-Fi. Ứng dụng sẽ tự tìm TV; nếu không tìm thấy, nhập địa chỉ IP hiển thị trên TV.", 13, 0xFFAAB7CD));
        manualAddress = new EditText(this);
        manualAddress.setSingleLine(true);
        manualAddress.setTextColor(Color.WHITE);
        manualAddress.setHintTextColor(0xFF8D97B3);
        manualAddress.setHint("Ví dụ: 192.168.1.25");
        manualAddress.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        discoveryView.addView(manualAddress, new LinearLayout.LayoutParams(-1, 72));
        Button manual = new Button(this);
        manual.setText("KẾT NỐI VỚI IP TV");
        manual.setOnClickListener(v -> connectTo(manualAddress.getText().toString().trim()));
        discoveryView.addView(manual, new LinearLayout.LayoutParams(-1, -2));
        Button retry = new Button(this);
        retry.setText("TÌM LẠI TV");
        retry.setOnClickListener(v -> {connecting = false;stopDiscovery();startDiscovery();});
        discoveryView.addView(retry, new LinearLayout.LayoutParams(-1, -2));
        FrameLayout.LayoutParams layout = new FrameLayout.LayoutParams(-1, -1);
        root.addView(discoveryView, layout);
    }

    private void startDiscovery() {
        if (nsd == null || destroyed || discoverListener != null) {
            if (nsd == null) status.setText("Không có dịch vụ tìm TV. Hãy nhập IP TV.");
            return;
        }
        status.setText("ĐANG TÌM GOOGLE TV TRÊN WI-FI…");
        discoverListener = new NsdManager.DiscoveryListener() {
            @Override public void onStartDiscoveryFailed(String serviceType, int errorCode) {
                runOnUiThread(() -> status.setText("Không tự tìm được TV. Hãy nhập IP TV."));
                stopDiscovery();
            }
            @Override public void onStopDiscoveryFailed(String serviceType, int errorCode) { }
            @Override public void onDiscoveryStarted(String serviceType) { }
            @Override public void onDiscoveryStopped(String serviceType) { }
            @Override public void onServiceLost(NsdServiceInfo service) { }
            @Override public void onServiceFound(NsdServiceInfo service) {
                if (!SERVICE_TYPE.equals(service.getServiceType()) || connecting) return;
                try {
                    nsd.resolveService(service, new NsdManager.ResolveListener() {
                        @Override public void onResolveFailed(NsdServiceInfo s, int code) { }
                        @Override public void onServiceResolved(NsdServiceInfo s) {
                            InetAddress host = s.getHost();
                            if (host instanceof Inet4Address && s.getPort() == 3000) {
                                runOnUiThread(() -> connectTo(host.getHostAddress()));
                            }
                        }
                    });
                } catch (Exception ignored) { }
            }
        };
        try { nsd.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, discoverListener); }
        catch (Exception e) {discoverListener = null;status.setText("Lỗi tìm TV. Hãy nhập IP TV.");}
    }

    private void stopDiscovery() {
        NsdManager.DiscoveryListener listener = discoverListener;
        discoverListener = null;
        if (nsd != null && listener != null) {
            try { nsd.stopServiceDiscovery(listener); } catch (Exception ignored) { }
        }
    }

    // Deliberately restrict local-network URLs to private IPv4 addresses.
    private String validateIp(String raw) {
        String host = raw.replace("http://", "").replace("https://", "").trim().replaceAll(":3000/?$", "");
        if (!host.matches("(?:[0-9]{1,3}\\.){3}[0-9]{1,3}")) return null;
        String[] parts = host.split("\\.");
        int[] ip = new int[4];
        try { for (int i=0;i<4;i++) {ip[i] = Integer.parseInt(parts[i]);if (ip[i]>255) return null;} }
        catch (Exception e) {return null;}
        boolean privateIp = ip[0]==10 || ip[0]==192&&ip[1]==168 || ip[0]==172&&ip[1]>=16&&ip[1]<=31;
        return privateIp ? host : null;
    }

    private void connectTo(String rawAddress) {
        String host = validateIp(rawAddress);
        if (host == null) { status.setText("Địa chỉ phải là IP mạng nội bộ của TV (ví dụ 192.168.1.25)."); return; }
        if (destroyed || connecting || serverHost != null) return;
        connecting = true;
        status.setText("ĐANG KẾT NỐI TV: " + host);
        new Thread(() -> {
            boolean success = false;
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL("http://" + host + ":3000/health").openConnection();
                conn.setConnectTimeout(1800); conn.setReadTimeout(1800);
                success = conn.getResponseCode()==200;
            } catch (Exception ignored) { }
            finally {if (conn!=null) conn.disconnect();}
            boolean ok = success;
            handler.post(() -> {
                if (destroyed) return;
                connecting = false;
                if (ok) openRemote(host);
                else status.setText("TV " + host + " chưa mở game hoặc khác Wi-Fi. Thử tìm lại / nhập IP.");
            });
        }, "RemoteHealthCheck").start();
    }

    private void openRemote(String host) {
        serverHost = host;
        stopDiscovery();
        discoveryView.setVisibility(View.GONE);
        if (web == null) {
            web = new WebView(this);
            web.setBackgroundColor(Color.rgb(10, 13, 25));
            web.getSettings().setJavaScriptEnabled(true);
            web.getSettings().setDomStorageEnabled(true);
            web.getSettings().setSupportZoom(false);
            web.setWebChromeClient(new WebChromeClient());
            web.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                    return !("http".equals(req.getUrl().getScheme()) && serverHost.equals(req.getUrl().getHost()));
                }
                @Override public void onReceivedError(WebView view, WebResourceRequest req, android.webkit.WebResourceError error) {
                    if (req.isForMainFrame()) runOnUiThread(() -> {
                        status.setText("TV ngắt kết nối, hãy tìm lại TV.");
                        showDiscovery();
                    });
                }
            });
            root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        }
        web.setVisibility(View.VISIBLE);
        web.loadUrl("http://"+host+":3000/remote.html");
    }

    private void showDiscovery() {
        serverHost=null;
        if (web!=null) {web.loadUrl("about:blank");web.setVisibility(View.GONE);}
        discoveryView.setVisibility(View.VISIBLE);
        stopDiscovery();
        startDiscovery();
    }

    @Override public void onBackPressed() {
        if (web!=null && web.getVisibility()==View.VISIBLE) showDiscovery();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        destroyed=true;
        stopDiscovery();
        if (web!=null) {web.loadUrl("about:blank");web.destroy();}
        super.onDestroy();
    }
}
