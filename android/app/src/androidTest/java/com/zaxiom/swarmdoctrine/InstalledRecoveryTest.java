package com.zaxiom.swarmdoctrine;

import static org.junit.Assert.*;

import android.content.pm.ActivityInfo;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.graphics.Rect;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelFileDescriptor;
import android.os.SystemClock;
import android.provider.Settings;
import android.provider.MediaStore;
import android.util.Log;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.PixelCopy;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.json.JSONArray;

/** Runs the packaged app and its real WebView renderer on an installed debug APK. */
@RunWith(AndroidJUnit4.class)
public class InstalledRecoveryTest {
    private static final AtomicInteger JS_SEQUENCE = new AtomicInteger();

    private static FrameLayout frame(MainActivity activity) {
        return (FrameLayout) ((FrameLayout) activity.findViewById(android.R.id.content)).getChildAt(0);
    }

    private static WebView web(ActivityScenario<MainActivity> scenario) {
        AtomicReference<WebView> value = new AtomicReference<>();
        scenario.onActivity(a -> {
            if (frame(a).getChildAt(0) instanceof WebView) value.set((WebView) frame(a).getChildAt(0));
        });
        return value.get();
    }

    static String js(ActivityScenario<MainActivity> scenario, String script) {
        return js(scenario, script, true);
    }

    private static String js(ActivityScenario<MainActivity> scenario, String script, boolean required) {
        int sequence = JS_SEQUENCE.incrementAndGet();
        AtomicReference<String> value = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        if (required) Log.i("SwarmSmoke", "JS " + sequence + " dispatch");
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            if (required) Log.i("SwarmSmoke", "JS " + sequence + " evaluate");
            view.evaluateJavascript(script, result -> {
                if (required) Log.i("SwarmSmoke", "JS " + sequence + " callback");
                value.set(result);
                done.countDown();
            });
        });
        try {
            // Cold software-rendered CI can stall callbacks while Android starts
            // its bundled services; this is a functional test, not a latency SLA.
            boolean completed = done.await(required ? 30 : 5, TimeUnit.SECONDS);
            if (required) assertTrue("JavaScript callback timed out", completed);
            if (!completed) return null;
        }
        catch (InterruptedException e) { Thread.currentThread().interrupt(); throw new AssertionError(e); }
        return value.get();
    }

    static void waitFor(String label, BooleanSupplier condition) {
        long deadline = SystemClock.uptimeMillis() + 60000;
        while (!condition.getAsBoolean() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
        assertTrue(label, condition.getAsBoolean());
    }

    static void ready(ActivityScenario<MainActivity> scenario) {
        waitFor("packaged game mounted", () -> {
            WebView current = web(scenario);
            if (current == null) return false;
            scenario.onActivity(a -> Log.i("SwarmSmoke", "loading=" + current.getProgress() + " url=" + current.getUrl()));
            return "true".equals(js(scenario, "!!window.game", false));
        });
    }

    static String shell(String command) {
        try (InputStream input = new ParcelFileDescriptor.AutoCloseInputStream(
                InstrumentationRegistry.getInstrumentation().getUiAutomation().executeShellCommand(command));
                ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        } catch (Exception failure) { throw new AssertionError("test shell command failed", failure); }
    }

    static void assertOffline(String phase) {
        assertTrue("no active default network at " + phase,
            shell("dumpsys connectivity").contains("Active default network: none"));
        Log.i("SwarmSmoke", "OFFLINE no active default network: " + phase);
    }

    private static void phase(String name) {
        Log.i("SwarmSmoke", "PHASE " + name);
    }

    static void disableNetwork(String phase) {
        // Airplane mode permits Wi-Fi. AGP/provider initialization can also
        // change connectivity after the script's earlier snapshot. Check at
        // the actual launch point with shell authority, not app permissions.
        shell("svc wifi disable");
        shell("svc data disable");
        waitFor("offline launch fixture", () -> shell("dumpsys connectivity").contains("Active default network: none"));
        assertOffline(phase);
    }

    static void screenshot(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        // JS layout readiness can precede the Android compositor's displayed
        // frame. Do not label a retained landscape/game frame as portrait/recovery.
        CountDownLatch visual = new CountDownLatch(1);
        scenario.onActivity(a -> {
            if (frame(a).getChildAt(0) instanceof WebView) {
                ((WebView) frame(a).getChildAt(0)).postVisualStateCallback(1, new WebView.VisualStateCallback() {
                    @Override public void onComplete(long requestId) { visual.countDown(); }
                });
            } else {
                frame(a).postOnAnimation(() -> frame(a).postOnAnimation(visual::countDown));
            }
        });
        boolean rendered = visual.await(10, TimeUnit.SECONDS);
        Log.i("SwarmSmoke", "SNAPSHOT " + name + " visualState=" + rendered);
        if (!name.contains("failure")) assertTrue("screenshot visual state: " + name, rendered);
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        // Permit the ready frame to be presented; this is not a latency SLA.
        SystemClock.sleep(250);
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        saveBitmap(bitmap, name);
    }

    /** Preserve raw app-window and full-display captures separately. A submitted
     * window frame is not itself proof that the display compositor presented it. */
    static void committedWindowScreenshot(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        touchWindowReady(scenario);
        CountDownLatch committed = new CountDownLatch(1);
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            view.postVisualStateCallback(2, new WebView.VisualStateCallback() {
                @Override public void onComplete(long requestId) {
                    if (Build.VERSION.SDK_INT >= 29 && view.isHardwareAccelerated()) {
                        view.getViewTreeObserver().registerFrameCommitCallback(committed::countDown);
                    } else {
                        // API 26-28 have no frame-commit callback. Record the
                        // weaker next-draw path rather than imply equivalence.
                        AtomicBoolean once = new AtomicBoolean();
                        ViewTreeObserver.OnDrawListener listener = new ViewTreeObserver.OnDrawListener() {
                            @Override public void onDraw() {
                                if (!once.compareAndSet(false, true)) return;
                                view.post(() -> {
                                    if (view.getViewTreeObserver().isAlive())
                                        view.getViewTreeObserver().removeOnDrawListener(this);
                                    committed.countDown();
                                });
                            }
                        };
                        view.getViewTreeObserver().addOnDrawListener(listener);
                    }
                    Log.i("SwarmSmoke", "PRESENT " + name + " hardware=" + view.isHardwareAccelerated()
                        + " frameCommit=" + (Build.VERSION.SDK_INT >= 29 && view.isHardwareAccelerated()));
                    view.invalidate();
                }
            });
        });
        assertTrue("next native frame after WebView visual callback: " + name,
            committed.await(15, TimeUnit.SECONDS));
        CountDownLatch copied = new CountDownLatch(1);
        AtomicInteger result = new AtomicInteger(-1);
        AtomicReference<Bitmap> capture = new AtomicReference<>();
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            int[] xy = new int[2];
            view.getLocationInWindow(xy);
            Rect bounds = new Rect(xy[0], xy[1], xy[0] + view.getWidth(), xy[1] + view.getHeight());
            Bitmap bitmap = Bitmap.createBitmap(view.getWidth(), view.getHeight(), Bitmap.Config.ARGB_8888);
            capture.set(bitmap);
            Log.i("SwarmSmoke", "PRESENT " + name + " windowBounds=" + bounds
                + " focused=" + a.hasWindowFocus() + " attached=" + view.isAttachedToWindow());
            PixelCopy.request(a.getWindow(), bounds, bitmap, code -> {
                result.set(code); copied.countDown();
            }, new Handler(Looper.getMainLooper()));
        });
        assertTrue("PixelCopy callback: " + name, copied.await(10, TimeUnit.SECONDS));
        assertEquals("PixelCopy app-window result: " + name, PixelCopy.SUCCESS, result.get());
        saveBitmap(capture.get(), name + "-app-window");
        // Keep the original native display evidence, including system bars.
        // Do not replace it with an offscreen draw or retry until it looks right.
        screenshot(scenario, name);
    }

    private static void saveBitmap(Bitmap bitmap, String name) throws Exception {
        if (Build.VERSION.SDK_INT >= 29) {
            // AGP uninstalls the tested APK and deletes its external-files tree.
            // Owned MediaStore images survive that cleanup without storage permission.
            var resolver = InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, name + ".png");
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SwarmSmoke");
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            assertNotNull(uri);
            try (OutputStream output = resolver.openOutputStream(uri)) {
                assertNotNull(output);
                assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output));
            } finally { bitmap.recycle(); }
            return;
        }
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "smoke");
        assertTrue(directory.exists() || directory.mkdirs());
        try (FileOutputStream output = new FileOutputStream(new File(directory, name + ".png"))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output));
        } finally { bitmap.recycle(); }
    }

    private static long pointer(ActivityScenario<MainActivity> scenario, int action, long down) {
        touchWindowReady(scenario);
        int[] position = new int[2];
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            view.getLocationOnScreen(position);
            position[0] += 20;
            position[1] += view.getHeight() / 2;
        });
        long now = SystemClock.uptimeMillis();
        MotionEvent event = MotionEvent.obtain(down == 0 ? now : down, now, action, position[0], position[1], 0);
        try { InstrumentationRegistry.getInstrumentation().sendPointerSync(event); }
        finally { event.recycle(); }
        return down == 0 ? now : down;
    }

    /** Real Android touch injection, with CSS-to-native viewport scaling after rotation. */
    static void tapCss(ActivityScenario<MainActivity> scenario, String point) throws Exception {
        touchWindowReady(scenario);
        JSONArray css = new JSONArray(js(scenario, point));
        int[] position = new int[2];
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            view.getLocationOnScreen(position);
            position[0] += Math.round((float) (css.optDouble(0) * view.getWidth() / css.optDouble(2)));
            position[1] += Math.round((float) (css.optDouble(1) * view.getHeight() / css.optDouble(3)));
        });
        Log.i("SwarmSmoke", "TOUCH native css=" + css + " screen=[" + position[0] + "," + position[1] + "]");
        // Queue DOWN without waiting for the app to become idle, then wait for
        // the already-queued UP. Synchronous DOWN injection (including `input
        // tap`) can block on a loaded software renderer long enough for Chromium
        // to fire its long-press selection timer before UP is injected.
        long downTime = SystemClock.uptimeMillis();
        MotionEvent down = MotionEvent.obtain(downTime, downTime,
            MotionEvent.ACTION_DOWN, position[0], position[1], 0);
        MotionEvent up = MotionEvent.obtain(downTime, downTime + 50,
            MotionEvent.ACTION_UP, position[0], position[1], 0);
        down.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        up.setSource(InputDevice.SOURCE_TOUCHSCREEN);
        try {
            assertTrue("queue native tap DOWN",
                InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(down, false));
            assertTrue("deliver native tap UP",
                InstrumentationRegistry.getInstrumentation().getUiAutomation().injectInputEvent(up, true));
        } finally {
            down.recycle();
            up.recycle();
        }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
    }

    /** Real vertical drag in the menu gutter, away from sliders. Re-read usable
     * WebView bounds after every rotation; finish slowly to avoid a fling. */
    static void swipeMenu(ActivityScenario<MainActivity> scenario, boolean downPage) {
        touchWindowReady(scenario);
        int[] bounds = new int[4];
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            view.getLocationOnScreen(bounds);
            bounds[2] = view.getWidth();
            bounds[3] = view.getHeight();
        });
        float x = bounds[0] + bounds[2] * 0.06f;
        float start = bounds[1] + bounds[3] * (downPage ? 0.8f : 0.2f);
        float end = bounds[1] + bounds[3] * (downPage ? 0.2f : 0.8f);
        long down = SystemClock.uptimeMillis();
        for (int i = 0; i <= 21; i++) {
            int action = i == 0 ? MotionEvent.ACTION_DOWN : i == 21 ? MotionEvent.ACTION_UP : MotionEvent.ACTION_MOVE;
            float y = start + (end - start) * Math.min(i, 20) / 20f;
            MotionEvent event = MotionEvent.obtain(down, SystemClock.uptimeMillis(), action, x, y, 0);
            try { InstrumentationRegistry.getInstrumentation().sendPointerSync(event); }
            finally { event.recycle(); }
            SystemClock.sleep(i == 20 ? 100 : 30);
        }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync();
        SystemClock.sleep(200);
    }

    private static void armFreeze(ActivityScenario<MainActivity> scenario) throws Exception {
        // A ready-charge fixture avoids waiting for lockout; production rules are unchanged.
        js(scenario, "game.sim.time=Math.max(game.sim.time,game.rules.freezeLockout+1);game.player.freezeCooldown=0;true");
        waitFor("Freeze control visible", () -> "true".equals(js(scenario, "!document.querySelector('#slot-freeze').classList.contains('hidden')")));
        tapCss(scenario, "(()=>{const r=document.querySelector('#slot-freeze').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()");
        waitFor("native Freeze button arms", () -> "true".equals(js(scenario, "game.input.freezeAiming&&!game.player.rallying")));
    }

    private static void hudFits(ActivityScenario<MainActivity> scenario) {
        assertEquals("HUD controls within usable WebView", "true", js(scenario,
            "[...document.querySelectorAll('#game-screen button')].filter(b=>b.getClientRects().length&&!b.classList.contains('hidden')).every(b=>{const r=b.getBoundingClientRect();return r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1})"));
    }

    /** Exercise the first-run menu path through Android input, not JavaScript
     * navigation. Long pages may scroll vertically, but no control may spill
     * sideways out of the usable WebView at the larger-font fixture. */
    private static void menuPathFits(ActivityScenario<MainActivity> scenario, String orientation) throws Exception {
        String[] screens = { "main-menu", "mode-screen", "team-select-screen" };
        String[] points = {
            "(()=>{const b=document.querySelector('#btn-play'),r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()",
            "(()=>{const b=[...document.querySelectorAll('#mode-screen .card')].find(b=>b.textContent.includes('Levels')),r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()"
        };
        for (int i = 0; i < screens.length; i++) {
            String screen = screens[i];
            waitFor(screen + " visible and settled in " + orientation, () -> "true".equals(js(scenario,
                "(()=>{const s=document.querySelector('#" + screen + "');return game.ui.screen==='" + screen
                    + "'&&document.fonts.status==='loaded'&&!s.getAnimations({subtree:true}).some(a=>a.playState==='running')})()")));
            String geometry = js(scenario,
                "(()=>{const s=document.querySelector('#" + screen + "'),controls=[...s.querySelectorAll('button,input,select,a')].filter(e=>e.getClientRects().length&&!e.classList.contains('hidden'));"
                    + "const clipped=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-1||r.right>innerWidth+1}).map(e=>e.id||e.textContent.trim().slice(0,32));"
                    + "return JSON.stringify({screen:'" + screen + "',viewport:[innerWidth,innerHeight],scroll:[s.scrollWidth,s.scrollHeight],client:[s.clientWidth,s.clientHeight],controls:controls.length,clipped})})()");
            Log.i("SwarmSmoke", "MENU " + orientation + " " + geometry);
            assertEquals(screen + " has no horizontally clipped controls in " + orientation, "true", js(scenario,
                "(()=>{const s=document.querySelector('#" + screen + "');return s.scrollWidth<=s.clientWidth+1&&[...s.querySelectorAll('button,input,select,a')].filter(e=>e.getClientRects().length&&!e.classList.contains('hidden')).every(e=>{const r=e.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1})})()"));
            // A VisualStateCallback can run before SurfaceFlinger's displayed
            // frame advances. Use the same committed-frame + PixelCopy path as
            // the Settings evidence so sequential menu captures cannot retain
            // the previous screen while the DOM assertions already pass.
            committedWindowScreenshot(scenario, "menu-" + orientation + "-" + screen);
            if (i < points.length) tapCss(scenario, points[i]);
        }
        scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
        waitFor("Back returns Team to Modes in " + orientation,
            () -> "\"mode-screen\"".equals(js(scenario, "game.ui.screen")));
        scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
        waitFor("Back returns Modes to Home in " + orientation,
            () -> "\"main-menu\"".equals(js(scenario, "game.ui.screen")));
        Log.i("SwarmSmoke", "PASS native Home/Modes/Levels/Team/Back menu path " + orientation);
    }

    /** Prove the installed WebView occupies the complete safe window exactly:
     * no system-bar/cutout overlap and no second inset that wastes play space. */
    private static void systemBarsFit(ActivityScenario<MainActivity> scenario, String orientation) {
        scenario.onActivity(a -> {
            FrameLayout root = frame(a);
            WebView view = (WebView) root.getChildAt(0);
            View decor = a.getWindow().getDecorView();
            WindowInsets windowInsets = decor.getRootWindowInsets();
            assertNotNull("window insets available in " + orientation, windowInsets);
            int left;
            int top;
            int right;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                Insets safe = windowInsets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                left = safe.left;
                top = safe.top;
                right = safe.right;
                bottom = safe.bottom;
            } else {
                left = windowInsets.getSystemWindowInsetLeft();
                top = windowInsets.getSystemWindowInsetTop();
                right = windowInsets.getSystemWindowInsetRight();
                bottom = windowInsets.getSystemWindowInsetBottom();
            }
            assertTrue("system-bar fixture has a nonzero safe inset in " + orientation,
                left + top + right + bottom > 0);
            int[] position = new int[2];
            view.getLocationInWindow(position);
            Log.i("SwarmSmoke", "SAFE " + orientation
                + " decor=" + decor.getWidth() + "x" + decor.getHeight()
                + " insets=[" + left + "," + top + "," + right + "," + bottom + "]"
                + " framePadding=[" + root.getPaddingLeft() + "," + root.getPaddingTop()
                + "," + root.getPaddingRight() + "," + root.getPaddingBottom() + "]"
                + " web=[" + position[0] + "," + position[1] + ","
                + (position[0] + view.getWidth()) + "," + (position[1] + view.getHeight()) + "]");
            assertEquals("WebView starts after the left safe inset in " + orientation, left, position[0]);
            assertEquals("WebView starts after the top safe inset in " + orientation, top, position[1]);
            assertEquals("WebView ends before the right safe inset in " + orientation,
                decor.getWidth() - right, position[0] + view.getWidth());
            assertEquals("WebView ends before the bottom safe inset in " + orientation,
                decor.getHeight() - bottom, position[1] + view.getHeight());
        });
    }

    private static void touchWindowReady(ActivityScenario<MainActivity> scenario) {
        // RESUMED/JavaScript readiness need not mean the Android window has
        // focus yet. Keep Instrumentation's app-UID restriction; never route
        // a touch into another window while background/resume settles.
        waitFor("foreground app window owns native touch", () -> {
            AtomicReference<Boolean> focused = new AtomicReference<>(false);
            scenario.onActivity(a -> {
                if (!(frame(a).getChildAt(0) instanceof WebView)) return;
                WebView view = (WebView) frame(a).getChildAt(0);
                focused.set(a.hasWindowFocus() && view.hasWindowFocus() && view.isShown()
                    && view.getWidth() > 0 && view.getHeight() > 0);
            });
            return focused.get();
        });
    }

    @Test public void offlineRotationBackgroundCrashAndContinue() throws Exception {
        int airplane = Settings.Global.getInt(InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0);
        assertEquals("enable airplane mode before first launch", 1, airplane);
        Log.i("SwarmSmoke", "API=" + Build.VERSION.SDK_INT + " model=" + Build.MODEL + " airplane=" + airplane);
        Log.i("SwarmSmoke", "fontScale=" + InstrumentationRegistry.getInstrumentation().getTargetContext().getResources().getConfiguration().fontScale);
        assertEquals("larger-font fixture enabled", 1.3f,
            InstrumentationRegistry.getInstrumentation().getTargetContext().getResources().getConfiguration().fontScale, 0.01f);
        disableNetwork("before first launch");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Log.i("SwarmSmoke", "WebView=" + WebView.getCurrentWebViewPackage().packageName + " " + WebView.getCurrentWebViewPackage().versionName);
            try { ready(scenario); }
            catch (AssertionError failure) { screenshot(scenario, "startup-failure"); throw failure; }
            try {
            assertOffline("first game mounted");
            phase("origin checks start");
            assertEquals("\"https://appassets.androidplatform.net\"", js(scenario, "location.origin"));
            assertEquals("false", js(scenario, "!!(navigator.serviceWorker&&navigator.serviceWorker.controller)"));
            phase("origin checks complete");
            menuPathFits(scenario, "portrait");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape menu viewport", () -> "true".equals(js(scenario, "innerWidth>innerHeight")));
            menuPathFits(scenario, "landscape");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("portrait menu viewport", () -> "true".equals(js(scenario, "innerHeight>innerWidth")));
            phase("new-player menu paths complete");
            // Zen has no game-over: a slow CI callback must not let a live
            // Conquest match end between input-policy assertions.
            js(scenario, "game.showTeamSelect('zen');game.selectTeam('dragon');Object.assign(game,{level:3,mapSeed:424242,levelEnemies:'passive'});game.saveCheckpoint();true");
            phase("checkpoint fixture complete");
            WebView initial = web(scenario);
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            waitFor("native Back pauses", () -> "\"paused\"".equals(js(scenario, "game.gameState")));
            js(scenario, "game.ui.pauseSettings();true");
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            assertEquals("true", js(scenario, "game.ui.screen==='game-screen'&&game.gameState==='paused'"));
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            waitFor("native Back resumes", () -> "\"playing\"".equals(js(scenario, "game.gameState")));
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED);
            assertEquals("\"paused\"", js(scenario, "game.gameState"));
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            waitFor("resumed match", () -> "\"playing\"".equals(js(scenario, "game.gameState")));
            phase("Back and lifecycle complete");
            long down = pointer(scenario, MotionEvent.ACTION_DOWN, 0);
            waitFor("native edge touch rallies", () -> "true".equals(js(scenario, "game.player.rallying")));
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape viewport", () -> "true".equals(js(scenario, "innerWidth>innerHeight")));
            assertSame("rotation retains WebView", initial, web(scenario));
            waitFor("rotation clears held input", () -> "true".equals(js(scenario, "!game.player.rallying&&game.input.pointerId===null")));
            pointer(scenario, MotionEvent.ACTION_UP, down);
            assertEquals("true", js(scenario, "game.sim.boids.every(b=>Number.isFinite(b.pos.x)&&Number.isFinite(b.pos.y))"));
            hudFits(scenario);
            systemBarsFit(scenario, "landscape");
            phase("Rally rotation complete");
            screenshot(scenario, "landscape");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("portrait viewport", () -> "true".equals(js(scenario, "innerHeight>innerWidth")));
            hudFits(scenario);
            systemBarsFit(scenario, "portrait");
            screenshot(scenario, "portrait");
            phase("orientation captures complete");
            armFreeze(scenario);
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            waitFor("Back cancels Freeze without pausing", () -> "true".equals(js(scenario, "!game.input.freezeAiming&&game.gameState==='playing'")));
            armFreeze(scenario);
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape clears Freeze aim", () -> "true".equals(js(scenario, "innerWidth>innerHeight&&!game.input.freezeAiming&&game.player.freezeCooldown===0")));
            armFreeze(scenario);
            // Pin a test-only rival at a live player ship while native input
            // crosses the JS/Android boundary. A zero initial velocity alone is
            // not stationary: normal flocking resumes on the next simulation
            // tick and can leave the computed point before a slow renderer
            // receives the tap. Capture the real emitted event; the live field
            // expires and is unsuitable as a durable assertion.
            tapCss(scenario, "(()=>{const sim=game.sim,anchor=sim.boids.find(x=>x.team===game.playerTeam);"
                + "const wasDormant=sim.dormant;sim.dormant=true;const b=sim.addBoid(anchor.pos.x,anchor.pos.y,game.teamOrder()[1]);b.vel.set(0,0);"
                + "b.conversionCooldown=game.rules.conversionCooldownTicks*60;const original=sim.emit;"
                + "window.__nativeFreeze={events:[],pointers:[],fixture:b.id,wasDormant,restore:()=>{sim.emit=original;sim.dormant=wasDormant}};"
                + "game.sim.emit=function(e){if((e.type==='freeze'||e.type==='freeze-miss')&&e.team===game.playerTeam)"
                + "window.__nativeFreeze.events.push({...e,time:this.time,fixtureTeam:b.team,fixturePresent:this.boids.includes(b),fixtureX:b.pos.x,fixtureY:b.pos.y,cooldown:game.player.freezeCooldown,field:!!game.player.freezeField});return original.call(this,e)};"
                + "game.canvas.addEventListener('pointerdown',e=>window.__nativeFreeze.pointers.push({x:e.clientX,y:e.clientY,time:sim.time,aim:game.input.freezeAiming,fixtureTeam:b.team,fixturePresent:sim.boids.includes(b)}),{once:true,capture:true});"
                + "const r=game.renderer,c=game.canvas.getBoundingClientRect();return [c.x+(b.pos.x*r.viewScale+r.offsetX)*c.width/game.canvas.width,c.y+(b.pos.y*r.viewScale+r.offsetY)*c.height/game.canvas.height,innerWidth,innerHeight]})()");
            try {
                waitFor("native arena tap emits successful Freeze", () -> "true".equals(js(scenario,
                    "window.__nativeFreeze.events.some(e=>e.type==='freeze'&&e.victims>0&&e.cooldown>0&&e.field)&&!game.input.freezeAiming")));
            } finally {
                Log.i("SwarmSmoke", "FREEZE native cast=" + js(scenario, "JSON.stringify(window.__nativeFreeze)"));
                js(scenario, "window.__nativeFreeze.restore();true");
            }
            phase("Freeze input complete");
            long backgroundDown = pointer(scenario, MotionEvent.ACTION_DOWN, 0);
            waitFor("Rally before background", () -> "true".equals(js(scenario, "game.player.rallying")));
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED);
            assertEquals("true", js(scenario, "game.gameState==='paused'&&!game.player.rallying&&game.input.pointerId===null&&!game.input.freezeAiming"));
            assertEquals("paused foreground keeps Web Audio suspended", "\"suspended\"",
                js(scenario, "game.audio.ctx&&game.audio.ctx.state"));
            pointer(scenario, MotionEvent.ACTION_UP, backgroundDown);
            scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
            waitFor("explicit resume after held touch", () -> "true".equals(js(scenario,
                "game.gameState==='playing'&&game.audio.ctx&&game.audio.ctx.state==='running'")));
            phase("background held input complete");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("portrait before recovery", () -> "true".equals(js(scenario, "innerHeight>innerWidth")));
            // A real renderer termination, deliberately restricted to this debug test.
            scenario.onActivity(a -> ((WebView) frame(a).getChildAt(0)).loadUrl("chrome://crash"));
            waitFor("native recovery screen", () -> web(scenario) == null);
            screenshot(scenario, "renderer-recovery");
            phase("renderer crash screen complete");
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED);
            disableNetwork("before renderer retry");
            scenario.onActivity(a -> {
                ScrollView recovery = (ScrollView) frame(a).getChildAt(0);
                ((Button) ((LinearLayout) recovery.getChildAt(0)).getChildAt(1)).performClick();
            });
            ready(scenario);
            assertOffline("renderer retry mounted");
            assertNotSame(initial, web(scenario));
            assertEquals("true", js(scenario, "game.ui.screen==='main-menu'&&game.loadCheckpoint()&&game.loadCheckpoint().seed===424242&&game.ui.continueLabel!==null"));
            assertEquals("true", js(scenario, "game.resumeExpedition()&&game.level===3&&game.mapSeed===424242&&game.levelEnemies==='passive'"));
            phase("renderer retry and Continue complete");
            scenario.recreate();
            ready(scenario);
            assertEquals("true", js(scenario, "game.ui.screen==='main-menu'&&game.loadCheckpoint()&&game.loadCheckpoint().seed===424242"));
            Log.i("SwarmSmoke", "PASS offline/new-player-menus/Back/background-held-Rally/touch/rotation/Freeze-button-aim-cast/Freeze-cancellation/HUD-bounds/font-scale/renderer-crash/Continue/Activity-recreation");
            } catch (AssertionError | RuntimeException failure) {
                screenshot(scenario, "test-failure");
                throw failure;
            }
        }
    }
}
