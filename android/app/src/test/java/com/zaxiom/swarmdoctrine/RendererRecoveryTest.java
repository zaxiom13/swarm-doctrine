package com.zaxiom.swarmdoctrine;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;

import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import androidx.webkit.WebViewClientCompat;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

/** Callback/lifecycle tests use a shadow WebView, not an installed renderer. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = {26, 35})
public class RendererRecoveryTest {
    private static RenderProcessGoneDetail gone(boolean crashed) {
        return new RenderProcessGoneDetail() {
            @Override public boolean didCrash() { return crashed; }
            @Override public int rendererPriorityAtExit() { return WebView.RENDERER_PRIORITY_BOUND; }
        };
    }

    private static FrameLayout frame(MainActivity activity) {
        FrameLayout content = activity.findViewById(android.R.id.content);
        return (FrameLayout) content.getChildAt(0);
    }

    @Test public void inheritedCallbackLeavesTerminationUnhandled() {
        // This is the pre-fix client's behavior for either renderer exit reason.
        assertFalse(new WebViewClientCompat().onRenderProcessGone(null, gone(true)));
        assertFalse(new WebViewClientCompat().onRenderProcessGone(null, gone(false)));
    }

    private void recover(boolean crashed, boolean background) {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            FrameLayout root = frame(activity);
            WebView old = (WebView) root.getChildAt(0);
            if (background) controller.pause();
            assertTrue(old.getWebViewClient().onRenderProcessGone(old, gone(crashed)));
            assertNull(old.getParent());
            assertTrue(shadowOf(old).wasDestroyCalled());
            assertFalse(activity.isFinishing());
            assertEquals(1, root.getChildCount());
            assertTrue(root.getChildAt(0) instanceof ScrollView);
            // No renderer is restarted automatically, including in the background.
            if (background) controller.resume();
            else controller.pause().resume();
            LinearLayout panel = (LinearLayout) ((ScrollView) root.getChildAt(0)).getChildAt(0);
            ((Button) panel.getChildAt(1)).performClick();
            WebView replacement = (WebView) root.getChildAt(0);
            assertNotSame(old, replacement);
            assertEquals("https://appassets.androidplatform.net/game/index.html", shadowOf(replacement).getLastLoadedUrl());
            assertTrue(replacement.getSettings().getJavaScriptEnabled());
            assertTrue(replacement.getSettings().getDomStorageEnabled());
            assertFalse(replacement.getSettings().getAllowFileAccess());
            assertFalse(replacement.getSettings().getAllowContentAccess());
            assertEquals(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW, replacement.getSettings().getMixedContentMode());
            controller.pause().resume();
        }
    }

    @Test public void crashRequiresExplicitFreshHome() { recover(true, false); }
    @Test public void memoryKillInBackgroundWaitsForPlayer() { recover(false, true); }

    @Test public void backAndDestroyAreSafeWithoutRenderer() {
        try (ActivityController<MainActivity> controller = Robolectric.buildActivity(MainActivity.class).setup()) {
            MainActivity activity = controller.get();
            WebView old = (WebView) frame(activity).getChildAt(0);
            assertTrue(old.getWebViewClient().onRenderProcessGone(old, gone(false)));
            activity.getOnBackPressedDispatcher().onBackPressed();
            assertTrue(activity.isFinishing());
            controller.pause().stop();
        }
    }
}
