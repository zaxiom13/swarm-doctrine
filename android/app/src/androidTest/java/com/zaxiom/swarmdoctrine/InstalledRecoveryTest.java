package com.zaxiom.swarmdoctrine;

import static org.junit.Assert.*;

import android.content.pm.ActivityInfo;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.MotionEvent;
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
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.BooleanSupplier;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Runs the packaged app and its real WebView renderer on an installed debug APK. */
@RunWith(AndroidJUnit4.class)
public class InstalledRecoveryTest {
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

    private static String js(ActivityScenario<MainActivity> scenario, String script) {
        return js(scenario, script, true);
    }

    private static String js(ActivityScenario<MainActivity> scenario, String script, boolean required) {
        AtomicReference<String> value = new AtomicReference<>();
        CountDownLatch done = new CountDownLatch(1);
        scenario.onActivity(a -> {
            WebView view = (WebView) frame(a).getChildAt(0);
            view.evaluateJavascript(script, result -> { value.set(result); done.countDown(); });
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

    private static void waitFor(String label, BooleanSupplier condition) {
        long deadline = SystemClock.uptimeMillis() + 60000;
        while (!condition.getAsBoolean() && SystemClock.uptimeMillis() < deadline) SystemClock.sleep(100);
        assertTrue(label, condition.getAsBoolean());
    }

    private static void ready(ActivityScenario<MainActivity> scenario) {
        waitFor("packaged game mounted", () -> {
            WebView current = web(scenario);
            if (current == null) return false;
            scenario.onActivity(a -> Log.i("SwarmSmoke", "loading=" + current.getProgress() + " url=" + current.getUrl()));
            return "true".equals(js(scenario, "!!window.game", false));
        });
    }

    private static void screenshot(String name) throws Exception {
        Bitmap bitmap = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        assertNotNull(bitmap);
        File directory = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "smoke");
        assertTrue(directory.exists() || directory.mkdirs());
        try (FileOutputStream output = new FileOutputStream(new File(directory, name + ".png"))) {
            assertTrue(bitmap.compress(Bitmap.CompressFormat.PNG, 100, output));
        } finally { bitmap.recycle(); }
    }

    private static long pointer(ActivityScenario<MainActivity> scenario, int action, long down) {
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

    @Test public void offlineRotationBackgroundCrashAndContinue() throws Exception {
        int airplane = Settings.Global.getInt(InstrumentationRegistry.getInstrumentation().getTargetContext().getContentResolver(), Settings.Global.AIRPLANE_MODE_ON, 0);
        assertEquals("enable airplane mode before first launch", 1, airplane);
        Log.i("SwarmSmoke", "API=" + Build.VERSION.SDK_INT + " model=" + Build.MODEL + " airplane=" + airplane);
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            Log.i("SwarmSmoke", "WebView=" + WebView.getCurrentWebViewPackage().packageName + " " + WebView.getCurrentWebViewPackage().versionName);
            try { ready(scenario); }
            catch (AssertionError failure) { screenshot("startup-failure"); throw failure; }
            try {
            assertEquals("\"https://appassets.androidplatform.net\"", js(scenario, "location.origin"));
            assertEquals("false", js(scenario, "!!navigator.serviceWorker?.controller"));
            js(scenario, "game.showTeamSelect('conquest');game.selectTeam('dragon');Object.assign(game,{level:3,mapSeed:424242,levelEnemies:'passive'});game.saveCheckpoint();true");
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
            long down = pointer(scenario, MotionEvent.ACTION_DOWN, 0);
            waitFor("native edge touch rallies", () -> "true".equals(js(scenario, "game.player.rallying")));
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape viewport", () -> "true".equals(js(scenario, "innerWidth>innerHeight")));
            assertSame("rotation retains WebView", initial, web(scenario));
            waitFor("rotation clears held input", () -> "true".equals(js(scenario, "!game.player.rallying&&game.input.pointerId===null")));
            pointer(scenario, MotionEvent.ACTION_UP, down);
            assertEquals("true", js(scenario, "game.sim.boids.every(b=>Number.isFinite(b.pos.x)&&Number.isFinite(b.pos.y))"));
            screenshot("landscape");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("portrait viewport", () -> "true".equals(js(scenario, "innerHeight>innerWidth")));
            screenshot("portrait");
            // A real renderer termination, deliberately restricted to this debug test.
            scenario.onActivity(a -> ((WebView) frame(a).getChildAt(0)).loadUrl("chrome://crash"));
            waitFor("native recovery screen", () -> web(scenario) == null);
            screenshot("renderer-recovery");
            scenario.moveToState(Lifecycle.State.CREATED).moveToState(Lifecycle.State.RESUMED);
            scenario.onActivity(a -> {
                ScrollView recovery = (ScrollView) frame(a).getChildAt(0);
                ((Button) ((LinearLayout) recovery.getChildAt(0)).getChildAt(1)).performClick();
            });
            ready(scenario);
            assertNotSame(initial, web(scenario));
            assertEquals("true", js(scenario, "game.ui.screen==='main-menu'&&game.loadCheckpoint()?.seed===424242&&game.ui.continueLabel!==null"));
            assertEquals("true", js(scenario, "game.resumeExpedition()&&game.level===3&&game.mapSeed===424242&&game.levelEnemies==='passive'"));
            scenario.recreate();
            ready(scenario);
            assertEquals("true", js(scenario, "game.ui.screen==='main-menu'&&game.loadCheckpoint()?.seed===424242"));
            Log.i("SwarmSmoke", "PASS offline/Back/background/touch/rotation/renderer-crash/Continue/Activity-recreation");
            } catch (AssertionError failure) {
                screenshot("test-failure");
                throw failure;
            }
        }
    }
}
