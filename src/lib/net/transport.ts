// A small room interface over Trystero (WebRTC, matched through Firebase) or,
// with ?net=local, over a BroadcastChannel so two tabs can play without any
// server. Both give: selfId, onJoin/onLeave, channel(name) → { send, on }, leave().
import { databaseUrl, LOCAL_NET } from './config.ts';

export async function openRoom(roomId) {
    return LOCAL_NET ? localRoom(roomId) : trysteroRoom(roomId);
}

async function trysteroRoom(roomId) {
    const { joinRoom, selfId } = await import('@trystero-p2p/firebase');
    const room = joinRoom({ appId: databaseUrl(), relayConfig: { firebasePath: '__trystero__' } }, roomId);
    const wrapper = {
        selfId,
        onJoin: null,
        onLeave: null,
        channel(name) {
            const action = room.makeAction(name);
            return {
                send: (data, target) => action.send(data, target ? { target } : undefined).catch(() => {}),
                on: handler => { action.onMessage = (data, { peerId }) => handler(data, peerId); },
            };
        },
        leave: () => room.leave(),
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
