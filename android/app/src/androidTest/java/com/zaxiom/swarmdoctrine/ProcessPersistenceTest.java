package com.zaxiom.swarmdoctrine;

import static org.junit.Assert.*;
import static com.zaxiom.swarmdoctrine.InstalledRecoveryTest.*;

import android.content.pm.ActivityInfo;
import android.os.Process;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Two separate instrumentation invocations; installed-smoke.sh force-stops the
 * ordinary app process, upgrades versionCode 1 to 2 with adb install -r, then
 * restores without clearing app data. */
@RunWith(AndroidJUnit4.class)
public class ProcessPersistenceTest {
    private static void settingsPresented(ActivityScenario<MainActivity> scenario, String name) throws Exception {
        assertEquals("top capture starts at scroll origin", "true", js(scenario,
            "document.querySelector('#settings-screen').scrollTop<=1"));
        settingsPresented(scenario, name, "#settings-title");
    }

    private static void settingsPresented(ActivityScenario<MainActivity> scenario, String name, String target) throws Exception {
        // Controls exist while their Screen is hidden. Their saved values alone
        // do not establish that Svelte made the Settings screen visible.
        waitFor("visible, settled Settings viewport", () -> "true".equals(js(scenario,
            "(()=>{const s=document.querySelector('#settings-screen'),h=document.querySelector('" + target + "');"
            + "const r=s.getBoundingClientRect(),t=h.getBoundingClientRect();return game.ui.screen==='settings-screen'"
            + "&&!s.classList.contains('hidden')&&getComputedStyle(s).display!=='none'"
            + "&&Math.abs(r.width-innerWidth)<1&&Math.abs(r.height-innerHeight)<1"
            + "&&t.width>0&&t.x>=0&&t.right<=innerWidth&&t.y>=0&&t.bottom<=innerHeight"
            + "&&document.fonts.status==='loaded'&&!s.getAnimations({subtree:true}).some(a=>a.playState==='running')})()")));
        Log.i("SwarmSmoke", "PRESENT " + name + " css=" + js(scenario,
            "JSON.stringify({viewport:[innerWidth,innerHeight,devicePixelRatio],scroll:document.querySelector('#settings-screen').scrollTop,screen:document.querySelector('#settings-screen').getBoundingClientRect().toJSON(),target:document.querySelector('" + target + "').getBoundingClientRect().toJSON(),focus:document.hasFocus()})"));
        committedWindowScreenshot(scenario, name);
    }

    private static boolean visible(ActivityScenario<MainActivity> scenario, String selector) {
        return "true".equals(js(scenario,
            "(()=>{const e=document.querySelector('" + selector + "'),s=document.querySelector('#settings-screen');"
            + "const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);"
            + "return !s.classList.contains('hidden')&&r.width>0&&r.height>0"
            + "&&r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight&&(hit===e||e.contains(hit))})()"));
    }

    private static void settled(ActivityScenario<MainActivity> scenario, String selector) {
        String[] previous = {null};
        long[] since = {0};
        waitFor("stationary menu viewport and target " + selector, () -> {
            String sample = js(scenario, "JSON.stringify({scroll:document.querySelector('#settings-screen').scrollTop,"
                + "rect:document.querySelector('" + selector + "').getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight]})");
            long now = SystemClock.uptimeMillis();
            if (!sample.equals(previous[0])) { previous[0] = sample; since[0] = now; return false; }
            return now - since[0] >= 250;
        });
    }

    private static String soundState(ActivityScenario<MainActivity> scenario) {
        return js(scenario, "(()=>{const s=document.querySelector('#settings-screen'),e=document.querySelector('#setting-sound'),"
            + "r=e.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);"
            + "return JSON.stringify({scroll:s.scrollTop,rect:r.toJSON(),viewport:[innerWidth,innerHeight],"
            + "hit:{tag:h?.tagName,id:h?.id,class:h?.className},ownsHit:h===e||e.contains(h),"
            + "checked:e.checked,runtime:game.audio.enabled,stored:JSON.parse(localStorage.getItem('swarm-doctrine-settings-v3')).sound})})()");
    }

    private static void scrollToTop(ActivityScenario<MainActivity> scenario) {
        int gestures = 0;
        settled(scenario, "#settings-title");
        while (!"true".equals(js(scenario, "document.querySelector('#settings-screen').scrollTop<=1")) && gestures < 12) {
            swipeMenu(scenario, false);
            settled(scenario, "#settings-title");
            gestures++;
        }
        assertEquals("native drags reach actual Settings scroll origin", "true", js(scenario,
            "document.querySelector('#settings-screen').scrollTop<=1"));
        Log.i("SwarmSmoke", "TOUCH Settings top gestures=" + gestures + " scroll="
            + js(scenario, "document.querySelector('#settings-screen').scrollTop"));
    }

    private static void scrollTo(ActivityScenario<MainActivity> scenario, String selector, boolean downPage) {
        int gestures = 0;
        settled(scenario, selector);
        while (!visible(scenario, selector) && gestures < 12) {
            swipeMenu(scenario, downPage);
            settled(scenario, selector);
            gestures++;
        }
        assertTrue("native scrolling reaches " + selector, visible(scenario, selector));
        Log.i("SwarmSmoke", "TOUCH reached " + selector + " gestures=" + gestures
            + " scroll=" + js(scenario, "document.querySelector('#settings-screen').scrollTop"));
    }

    private static void touchSettings(ActivityScenario<MainActivity> scenario, String orientation, boolean sound) throws Exception {
        // The sticky title remains visible even when the root is scrolled.
        scrollToTop(scenario);
        settingsPresented(scenario, "persisted-settings-" + orientation);
        scrollTo(scenario, "#btn-reset-progress", true);
        assertEquals("native drag really scrolled the Settings root", "true", js(scenario,
            "document.querySelector('#settings-screen').scrollTop>0"));
        assertTrue("both bottom actions fit", visible(scenario, "#btn-reset-settings"));
        settingsPresented(scenario, "settings-bottom-" + orientation, "#btn-reset-progress");
        // Never activate destructive Reset/Clear actions. Use a reversible
        // audio preference to test native touches after scrolling instead.
        scrollTo(scenario, "#setting-sound", false);
        assertEquals("fixture starts with the opposite sound choice", Boolean.toString(!sound),
            js(scenario, "document.querySelector('#setting-sound').checked"));
        Log.i("SwarmSmoke", "INPUT Sound " + orientation + " before=" + soundState(scenario));
        try {
            tapCss(scenario, "(()=>{const e=document.querySelector('#setting-sound'),r=e.getBoundingClientRect(),"
                + "h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);"
                + "if(h!==e&&!e.contains(h))throw Error('Sound tap is occluded');"
                + "return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()");
            waitFor("native sound touch updates UI/runtime/storage", () -> "true".equals(js(scenario,
                "document.querySelector('#setting-sound').checked===" + sound + "&&game.audio.enabled===" + sound
                + "&&JSON.parse(localStorage.getItem('swarm-doctrine-settings-v3')).sound===" + sound)));
        } catch (Exception | AssertionError failure) {
            screenshot(scenario, "settings-touch-" + orientation + "-failure");
            throw failure;
        } finally {
            Log.i("SwarmSmoke", "INPUT Sound " + orientation + " after=" + soundState(scenario));
        }
        scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
        waitFor("Back returns from scrolled Settings to Home", () -> "true".equals(js(scenario,
            "game.ui.screen==='main-menu'&&game.gameState==='menu'")));
        waitFor("Home Settings control visible and settled", () -> "true".equals(js(scenario,
            "(()=>{const s=document.querySelector('#main-menu'),b=[...s.querySelectorAll('button')].find(b=>b.textContent.trim()==='Settings');"
            + "const r=b.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);"
            + "return !s.classList.contains('hidden')&&r.width>0&&r.x>=0&&r.right<=innerWidth"
            + "&&r.y>=0&&r.bottom<=innerHeight&&(h===b||b.contains(h))&&!s.getAnimations({subtree:true}).some(a=>a.playState==='running')})()")));
        tapCss(scenario, "(()=>{const b=[...document.querySelectorAll('#main-menu button')].find(b=>b.textContent.trim()==='Settings');"
            + "const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()");
        waitFor("Settings reopens with native choice", () -> "true".equals(js(scenario,
            "game.ui.screen==='settings-screen'&&document.querySelector('#setting-sound').checked===" + sound)));
        assertEquals("native scrolling/touches did not reset saved progress", "true", js(scenario,
            "game.loadCheckpoint()?.seed===767676&&Number(localStorage.getItem('swarm-best-levels'))===2468"));
        Log.i("SwarmSmoke", "PASS native Settings scroll/bottom-actions/sound-touch/Back/reopen " + orientation);
    }

    @Test public void saveBeforeProcessStop() {
        disableNetwork("before persistence save");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            assertOffline("persistence save mounted");
            // Use the game's real save paths. These are deterministic fixtures,
            // not a claim that this test earned a score or completed four sectors.
            assertEquals("true", js(scenario,
                "game.ui.applySetting('sound',false);game.ui.applySetting('music',false);"
                + "game.ui.applySetting('difficulty','hard');game.ui.applySetting('boidCount',180);"
                + "game.showTeamSelect('levels');game.selectTeam('dragon');"
                + "Object.assign(game,{level:4,mapSeed:767676,levelEnemies:'passive'});"
                + "game.saveCheckpoint();game.ui.saveRecord(2468);"
                + "game.loadCheckpoint()?.seed===767676"));
            // Exercise the normal background/save contract before stopping the
            // whole process. This does not test a kill during an unfinished write.
            scenario.moveToState(Lifecycle.State.CREATED);
            Log.i("SwarmSmoke", "PASS persistence seed saved; instrumentationPid=" + Process.myPid());
        }
    }

    @Test public void restoreAfterProcessStop() throws Exception {
        disableNetwork("before process relaunch");
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            ready(scenario);
            assertOffline("process relaunch mounted");
            Log.i("SwarmSmoke", "RELAUNCH instrumentationPid=" + Process.myPid()
                + " WebView=" + WebView.getCurrentWebViewPackage().versionName);
            assertEquals("fresh process starts safely at Home", "true", js(scenario,
                "game.ui.screen==='main-menu'&&game.gameState==='menu'"
                + "&&location.origin==='https://appassets.androidplatform.net'"
                + "&&!navigator.serviceWorker?.controller"));
            assertEquals("checkpoint and record survived process stop", "true", js(scenario,
                "game.loadCheckpoint()?.seed===767676&&game.loadCheckpoint()?.level===4"
                + "&&game.loadCheckpoint()?.team==='dragon'&&game.loadCheckpoint()?.enemies==='passive'"
                + "&&game.ui.continueLabel!==null&&Number(localStorage.getItem('swarm-best-levels'))===2468"
                + "&&game.ui.records.includes('Levels')"));
            assertEquals("loaded preferences affect runtime, not just stored bytes", "true", js(scenario,
                "!game.audio.enabled&&!game.audio.musicEnabled"));
            js(scenario, "game.ui.showScreen('settings-screen');true");
            waitFor("saved preferences rendered", () -> "true".equals(js(scenario,
                "!document.querySelector('#setting-sound').checked"
                + "&&!document.querySelector('#setting-music').checked"
                + "&&document.querySelector('#setting-difficulty').value==='hard'"
                + "&&document.querySelector('#setting-boidCount').value==='180'")));
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT));
            waitFor("portrait settings", () -> "true".equals(js(scenario, "innerHeight>innerWidth")));
            touchSettings(scenario, "portrait", true);
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape settings", () -> "true".equals(js(scenario, "innerWidth>innerHeight")));
            touchSettings(scenario, "landscape", false);
            assertEquals("Continue preserves checkpoint fields after rotation", "true", js(scenario,
                "game.resumeExpedition()&&game.gameMode==='levels'&&game.level===4"
                + "&&game.mapSeed===767676&&game.levelEnemies==='passive'&&game.playerTeam==='dragon'"));
            assertOffline("Continue after process relaunch");
            Log.i("SwarmSmoke", "PASS process-update/relaunch/Home/checkpoint/record/runtime-settings/portrait-landscape/Continue");
        }
    }
}
