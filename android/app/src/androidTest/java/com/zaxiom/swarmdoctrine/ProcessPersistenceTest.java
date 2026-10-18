package com.zaxiom.swarmdoctrine;

import static org.junit.Assert.*;
import static com.zaxiom.swarmdoctrine.InstalledRecoveryTest.*;

import android.content.pm.ActivityInfo;
import android.os.Process;
import android.util.Log;
import android.webkit.WebView;
import androidx.lifecycle.Lifecycle;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;

/** Two separate instrumentation invocations; installed-smoke.sh force-stops the
 * ordinary app process between them without clearing data or reinstalling. */
@RunWith(AndroidJUnit4.class)
public class ProcessPersistenceTest {
    private static void settingsPresented(ActivityScenario<MainActivity> scenario, String name) throws Exception {
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
            + "const r=e.getBoundingClientRect();return !s.classList.contains('hidden')&&r.width>0&&r.height>0"
            + "&&r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight})()"));
    }

    private static void scrollTo(ActivityScenario<MainActivity> scenario, String selector, boolean downPage) {
        int gestures = 0;
        while (!visible(scenario, selector) && gestures < 12) {
            swipeMenu(scenario, downPage);
            gestures++;
        }
        assertTrue("native scrolling reaches " + selector, visible(scenario, selector));
        Log.i("SwarmSmoke", "TOUCH reached " + selector + " gestures=" + gestures
            + " scroll=" + js(scenario, "document.querySelector('#settings-screen').scrollTop"));
    }

    private static void touchSettings(ActivityScenario<MainActivity> scenario, String orientation, boolean sound) throws Exception {
        scrollTo(scenario, "#settings-title", false);
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
        tapCss(scenario, "(()=>{const r=document.querySelector('#setting-sound').getBoundingClientRect();"
            + "return [r.x+r.width/2,r.y+r.height/2,innerWidth,innerHeight]})()");
        waitFor("native sound touch updates UI/runtime/storage", () -> "true".equals(js(scenario,
            "document.querySelector('#setting-sound').checked===" + sound + "&&game.audio.enabled===" + sound
            + "&&JSON.parse(localStorage.getItem('swarm-doctrine-settings-v3')).sound===" + sound)));
        scenario.onActivity(a -> a.getOnBackPressedDispatcher().onBackPressed());
        waitFor("Back returns from scrolled Settings to Home", () -> "true".equals(js(scenario,
            "game.ui.screen==='main-menu'&&game.gameState==='menu'")));
        waitFor("Home Settings control visible and settled", () -> "true".equals(js(scenario,
            "(()=>{const s=document.querySelector('#main-menu'),b=[...s.querySelectorAll('button')].find(b=>b.textContent.trim()==='Settings');"
            + "const r=b.getBoundingClientRect();return !s.classList.contains('hidden')&&r.width>0&&r.x>=0&&r.right<=innerWidth"
            + "&&r.y>=0&&r.bottom<=innerHeight&&!s.getAnimations({subtree:true}).some(a=>a.playState==='running')})()")));
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
            Log.i("SwarmSmoke", "PASS process-relaunch/Home/checkpoint/record/runtime-settings/portrait-landscape/Continue");
        }
    }
}
