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
            screenshot(scenario, "persisted-settings-portrait");
            scenario.onActivity(a -> a.setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE));
            waitFor("landscape settings", () -> "true".equals(js(scenario, "innerWidth>innerHeight")));
            screenshot(scenario, "persisted-settings-landscape");
            assertEquals("Continue preserves checkpoint fields after rotation", "true", js(scenario,
                "game.resumeExpedition()&&game.gameMode==='levels'&&game.level===4"
                + "&&game.mapSeed===767676&&game.levelEnemies==='passive'&&game.playerTeam==='dragon'"));
            assertOffline("Continue after process relaunch");
            Log.i("SwarmSmoke", "PASS process-relaunch/Home/checkpoint/record/runtime-settings/portrait-landscape/Continue");
        }
    }
}
