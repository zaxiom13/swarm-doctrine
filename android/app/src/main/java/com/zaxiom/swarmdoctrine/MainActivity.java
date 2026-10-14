package com.zaxiom.swarmdoctrine;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.view.WindowInsets;
import android.widget.FrameLayout;
import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewClientCompat;

/** An offline packaged game, served under HTTPS without a JavaScript/native bridge. */
public final class MainActivity extends ComponentActivity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/game/index.html";
    private WebView web;

    private static boolean isGame(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getHost())
            && uri.getPort() == -1 && "/game/index.html".equals(uri.getPath());
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(0xff0b0624);
        FrameLayout frame = new FrameLayout(this);
        frame.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(frame);
        // Keep native bars/cutouts outside the WebView; the CSS viewport is usable space.
        frame.setOnApplyWindowInsetsListener((view, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        frame.requestApplyInsets();
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setMediaPlaybackRequiresUserGesture(true);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/game/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClientCompat() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return loader.shouldInterceptRequest(request.getUrl());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (isGame(request.getUrl())) return false;
                if (request.isForMainFrame() && request.hasGesture()
                    && "https".equals(request.getUrl().getScheme()) && !HOST.equals(request.getUrl().getHost())) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, request.getUrl())); }
                    catch (ActivityNotFoundException ignored) { /* No external browser installed. */ }
                }
                return true;
            }
        });
        // Supports the game's existing confirmation dialog; no permission grants or bridges.
        web.setWebChromeClient(new WebChromeClient());
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                if (!isGame(Uri.parse(web.getUrl() == null ? "" : web.getUrl()))) { finish(); return; }
                web.evaluateJavascript("window.game?.ui.handleBack()??false",
                    handled -> { if (!"true".equals(handled)) finish(); });
            }
        });
        // A recreated process starts safely at Home; persistent records/Levels survive in DOM storage.
        // WebView.saveState only saves navigation, not the live JS simulation.
        web.loadUrl(HOME);
    }

    private void runInGame(String script) {
        if (web != null && isGame(Uri.parse(web.getUrl() == null ? "" : web.getUrl())))
            web.evaluateJavascript(script, null);
    }
    @Override protected void onPause() {
        runInGame("window.game?.resetHeldInput();window.game?.pause();window.game?.audio.suspend();");
        web.onPause();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null) {
            web.onResume();
            // Offline matches stay paused until Resume is tapped.
            runInGame("if(window.game?.gameState!=='paused')window.game?.audio.resume();");
        }
    }
    @Override protected void onDestroy() {
        if (web != null) { web.stopLoading(); web.destroy(); web = null; }
        super.onDestroy();
    }
}
