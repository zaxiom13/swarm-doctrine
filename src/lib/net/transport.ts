// A small room interface over Trystero (WebRTC, matched through Firebase) or,
// with ?net=local, over a BroadcastChannel so two tabs can play without any
// server. Both give: selfId, onJoin/onLeave, channel(name) → { send, on }, leave().
import { databaseUrl, LOCAL_NET } from './config.ts';

export async function openRoom(roomId) {
    return LOCAL_NET ? localRoom(roomId) : trysteroRoom(roomId);
}

// A free public TURN relay, used only when two browsers cannot reach each other
// directly (mobile data, strict routers). If it is ever down, direct connections still work.
const TURN = [{
    urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turns:openrelay.metered.ca:443?transport=tcp'],
    username: 'openrelayproject',
    credential: 'openrelayproject',
}];
const OFFLINE_AFTER_MS = 8000;

async function trysteroRoom(roomId) {
    const [{ joinRoom, selfId }, { initializeApp, getApps }, db] = await Promise.all([
        import('@trystero-p2p/firebase'), import('firebase/app'), import('firebase/database'),
    ]);
    // One Firebase app shared with Trystero, so the lobby can also watch the connection itself.
    const app = getApps().find(a => a.name === 'swarm') ?? initializeApp({ databaseURL: databaseUrl() }, 'swarm');
    const database = db.getDatabase(app);
    const room = joinRoom({ appId: databaseUrl(), turnConfig: TURN, relayConfig: { firebaseApp: app, firebasePath: '__trystero__' } }, roomId);

    // Who is in the lobby according to Firebase, before any direct connection exists.
    const presenceList = db.ref(database, `__trystero__/presence-${roomId}`);
    const mine = db.child(presenceList, selfId);
    let health = 'connecting', connected = false;
    const setHealth = state => { if (health !== state) { health = state; wrapper.onHealth?.(state); } };
    // Only report "offline" if Firebase has stayed disconnected for a while, not on a brief blip.
    let healthTimer = setTimeout(() => { if (!connected && health !== 'denied') setHealth('offline'); }, OFFLINE_AFTER_MS);
    const unsubscribers = [
        db.onValue(db.ref(database, '.info/connected'), snap => {
            connected = snap.val() === true;
            clearTimeout(healthTimer);
            if (connected) { if (health !== 'denied') setHealth('online'); }
            else healthTimer = setTimeout(() => { if (!connected && health !== 'denied') setHealth('offline'); }, OFFLINE_AFTER_MS);
        }),
        db.onValue(presenceList, snap => {
            const list = new Map();
            snap.forEach(entry => { if (entry.key !== selfId) list.set(entry.key, String(entry.val()?.name ?? 'Pilot')); });
            wrapper.onPresence?.(list);
        }, () => setHealth('denied')),
    ];

    const wrapper = {
        selfId,
        onJoin: null,
        onLeave: null,
        onPresence: null,
        onHealth: null,
        get health() { return health; },
        channel(name) {
            const action = room.makeAction(name);
            return {
                send: (data, target) => action.send(data, target ? { target } : undefined).catch(() => {}),
                on: handler => { action.onMessage = (data, { peerId }) => handler(data, peerId); },
            };
        },
        /** Lists this player in Firebase's view of the lobby until they leave or disconnect. */
        announce(name) {
            db.onDisconnect(mine).remove();
            db.set(mine, { name, at: db.serverTimestamp() }).catch(() => setHealth('denied'));
        },
        leave: () => {
            clearTimeout(healthTimer);
            unsubscribers.forEach(stop => stop());
            db.remove(mine).catch(() => {});
            return room.leave();
        },
    };
    room.onPeerJoin = id => wrapper.onJoin?.(id);
    room.onPeerLeave = id => wrapper.onLeave?.(id);
    return wrapper;
}

/** Same-browser stand-in: every tab is a peer; join/leave come from heartbeats. */
function localRoom(roomId) {
    const selfId = Math.random().toString(36).slice(2, 10);
    const bus = new BroadcastChannel(`swarm-${roomId}`);
    const handlers = {}, seen = new Map();
    const wrapper = {
        selfId,
        onJoin: null,
        onLeave: null,
        channel(name) {
            return {
                send: (data, target) => bus.postMessage({ from: selfId, to: target ?? null, name, data }),
                on: handler => { handlers[name] = handler; },
            };
        },
        onPresence: null,
        onHealth: null,
        health: 'online',
        announce() {},
        leave: () => { bus.postMessage({ from: selfId, bye: true }); clearInterval(timer); bus.close(); },
    };
    const beat = () => bus.postMessage({ from: selfId, beat: true });
    const timer = setInterval(() => {
        beat();
        const now = Date.now();
        for (const [id, at] of seen) if (now - at > 3000) { seen.delete(id); wrapper.onLeave?.(id); }
    }, 1000);
    bus.onmessage = ({ data: message }) => {
        const { from } = message;
        if (message.bye) { if (seen.delete(from)) wrapper.onLeave?.(from); return; }
        if (!seen.has(from)) { seen.set(from, Date.now()); wrapper.onJoin?.(from); beat(); }
        seen.set(from, Date.now());
        if (message.name && (!message.to || message.to === selfId)) handlers[message.name]?.(message.data, from);
    };
    setTimeout(beat, 0);
    return wrapper;
}
