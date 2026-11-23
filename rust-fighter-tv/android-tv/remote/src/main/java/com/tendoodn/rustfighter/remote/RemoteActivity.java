package com.tendoodn.rustfighter.remote;

import android.app.Activity;
import android.graphics.Color;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.text.InputFilter;
import android.widget.ScrollView;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.view.WindowManager;
import java.util.List;
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
    private ScrollView discoveryView;
    private TextView status;
    private EditText manualAddress;
    private EditText pairingCode;
    private String discoveredHost, requestedCode;
    private WifiManager.MulticastLock multicastLock;
    private WebView web;
    private NsdManager nsd;
    private NsdManager.DiscoveryListener discoverListener;
    private boolean destroyed = false;
    private boolean connecting = false;
    private String serverHost;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(13, 17, 30));
        setContentView(root);
        makeDiscoveryUi();
        try {
            nsd = (NsdManager) getSystemService(NSD_SERVICE);
            WifiManager wifi = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
            if (wifi != null) {
                multicastLock = wifi.createMulticastLock("RustFighterDiscovery");
                multicastLock.setReferenceCounted(false);
                multicastLock.acquire();
            }
        } catch (Exception ignored) { }
        startDiscovery();
    }

    private TextView text(String content, int size, int color) {
        TextView t = new TextView(this);
        t.setText(content); t.setTextColor(color); t.setTextSize(size);
        t.setGravity(Gravity.CENTER); t.setPadding(12, 10, 12, 10);
        return t;
    }

    private int dp(float n) { return (int)(n * getResources().getDisplayMetrics().density + .5f); }

    private void makeDiscoveryUi() {
        discoveryView = new ScrollView(this);
        discoveryView.setFillViewport(true);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setGravity(Gravity.CENTER_HORIZONTAL);
        column.setPadding(dp(20), dp(12), dp(20), dp(24));
        discoveryView.addView(column, new ScrollView.LayoutParams(-1, -2));
        column.addView(text("RUST FIGHTER", 26, Color.WHITE));
        column.addView(text("KẾT NỐI ĐIỆN THOẠI VỚI GOOGLE TV", 13, 0xFFFFBF95));
        column.addView(text("NHẬP MÃ 6 SỐ HIỆN TRÊN TV", 17, Color.WHITE));
        pairingCode = new EditText(this);
        pairingCode.setSingleLine(true);
        pairingCode.setTextColor(Color.WHITE);
        pairingCode.setHintTextColor(0xFF8D97B3);
        pairingCode.setHint("123456");
        pairingCode.setTextSize(26);
        pairingCode.setGravity(Gravity.CENTER);
        pairingCode.setInputType(InputType.TYPE_CLASS_NUMBER);
        pairingCode.setFilters(new InputFilter[]{new InputFilter.LengthFilter(6)});
        column.addView(pairingCode, new LinearLayout.LayoutParams(-1, dp(54)));
        status = text("ĐANG TÌM TV TRÊN WI-FI…", 13, 0xFFB3D6EF);
        column.addView(status);
        Button connect = new Button(this);
        connect.setText("KẾT NỐI VỚI TV");
        connect.setOnClickListener(v -> {
            String code = pairingCode.getText().toString().trim();
            if (!code.matches("[0-9]{6}")) {
                status.setText("Vui lòng nhập đủ 6 số trên TV.");
                pairingCode.requestFocus();
                return;
            }
            requestedCode = code;
            String address = manualAddress.getText().toString().trim();
            if (address.isEmpty()) address = discoveredHost;
            if (address == null || address.isEmpty()) {
                status.setText("Chưa tìm thấy TV. Nhập IP TV ở ô bên dưới.");
                return;
            }
            connectTo(address);
        });
        column.addView(connect, new LinearLayout.LayoutParams(-1, dp(56)));
        column.addView(text("KHÔNG TỰ TÌM ĐƯỢC? NHẬP ĐỊA CHỈ IP TRÊN TV", 12, 0xFFAAB7CD));
        manualAddress = new EditText(this);
        manualAddress.setSingleLine(true);
        manualAddress.setTextColor(Color.WHITE);
        manualAddress.setHintTextColor(0xFF8D97B3);
        manualAddress.setHint("Ví dụ: 192.168.1.25");
        manualAddress.setTextSize(17);
        manualAddress.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        column.addView(manualAddress, new LinearLayout.LayoutParams(-1, dp(52)));
        Button retry = new Button(this);
        retry.setText("TÌM LẠI TV");
        retry.setOnClickListener(v -> { connecting=false; discoveredHost=null; stopDiscovery(); startDiscovery(); });
        column.addView(retry, new LinearLayout.LayoutParams(-1, dp(50)));
        column.addView(text("Cùng Wi-Fi/LAN, không dùng mạng khách hay VPN. Nếu không tìm thấy TV, nhập IP thủ công.", 12, 0xFF91A1B8));
        root.addView(discoveryView, new FrameLayout.LayoutParams(-1, -1));
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
                if (!service.getServiceType().contains("_rustfighter._tcp")) return;
                try {
                    nsd.resolveService(service, new NsdManager.ResolveListener() {
                        @Override public void onResolveFailed(NsdServiceInfo s, int code) { }
                        @Override public void onServiceResolved(NsdServiceInfo s) {
                            if (s.getPort() != 3000) return;
                            String address = null;
                            if (Build.VERSION.SDK_INT >= 34) {
                                List<InetAddress> list = s.getHostAddresses();
                                if (list != null) for (InetAddress item : list) {
                                    if (item instanceof Inet4Address) { address = item.getHostAddress(); break; }
                                }
                            }
                            if (address == null && s.getHost() instanceof Inet4Address) address = s.getHost().getHostAddress();
                            final String host = address;
                            if (host != null) runOnUiThread(() -> {
                                discoveredHost = host;
                                if (serverHost == null && !connecting) status.setText("ĐÃ TÌM THẤY TV: " + host + " · NHẬP MÃ 6 SỐ");
                            });
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
        if (requestedCode == null || !requestedCode.matches("[0-9]{6}")) {status.setText("Nhập mã 6 số trên TV.");return;}
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
                conn.disconnect(); conn=null;
                if (success) {
                    conn=(HttpURLConnection)new URL("http://" + host + ":3000/remote.html").openConnection();
                    conn.setConnectTimeout(3500); conn.setReadTimeout(3500);
                    success=conn.getResponseCode()==200;
                }
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
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
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
        web.loadUrl("http://"+host+":3000/remote.html?code="+requestedCode+"&auto=1");
    }

    private void showDiscovery() {
        serverHost=null;
        getWindow().getDecorView().setSystemUiVisibility(0);
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
        if (multicastLock!=null && multicastLock.isHeld()) try {multicastLock.release();} catch (Exception ignored) { }
        if (web!=null) {web.loadUrl("about:blank");web.destroy();}
        super.onDestroy();
    }
}
