// A regional lobby: everyone in the same region room sees everyone else,
// can challenge an idle player and, once accepted, plays a duel over the
// same peer-to-peer connection. Matchmaking data only passes through Firebase
// while two browsers are introduced; game traffic goes directly between them.
import { openRoom } from './transport.js';
import { PROTOCOL } from './config.js';

const INVITE_SECONDS = 20;
const clean = name => String(name ?? '').replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 16) || 'Pilot';

export class Lobby {
    constructor(handlers) {
        this.handlers = handlers;   // onChange, onInvite, onAnswer, onCancel, onStart, onInput, onState, onFx, onEnd, onBye, onPeerLeave
        this.room = null;
        this.region = null;
        this.name = 'Pilot';
        this.busy = false;
        this.peers = new Map();
        this.outgoing = null;       // { peerId, timer }
        this.incoming = null;       // { peerId, timer }
        this.status = 'offline';
    }

    get selfId() { return this.room?.selfId; }

    async join(region, name) {
        this.name = clean(name);
        if (this.room && this.region === region) { this.announce(); return; }
        this.leave();
        this.region = region;
        this.status = 'connecting';
        this.changed();
        const room = await openRoom(`swarm-doctrine-${region}`);
        if (this.region !== region) { room.leave(); return; }
        this.room = room;
        const channels = this.channels = Object.fromEntries(['hello', 'invite', 'answer', 'cancel', 'start', 'input', 'state', 'fx', 'end', 'bye'].map(name => [name, room.channel(name)]));
        room.onJoin = id => { this.announce(id); };
        room.onLeave = id => {
            this.peers.delete(id);
            if (this.outgoing?.peerId === id) this.clearOutgoing();
            if (this.incoming?.peerId === id) { this.clearIncoming(); this.handlers.onCancel?.(); }
            this.handlers.onPeerLeave?.(id);
            this.changed();
        };
        channels.hello.on((data, id) => {
            if (data?.v !== PROTOCOL) { this.peers.delete(id); this.changed(); return; }
            this.peers.set(id, { id, name: clean(data.name), busy: Boolean(data.busy) });
            this.changed();
        });
        channels.invite.on((data, id) => {
            const peer = this.peers.get(id);
            if (!peer || this.busy || this.incoming || this.outgoing) { channels.answer.send({ accept: false, reason: 'busy' }, id); return; }
            this.incoming = { peerId: id, timer: setTimeout(() => this.answer(false), INVITE_SECONDS * 1000) };
            this.handlers.onInvite?.(peer);
        });
        channels.cancel.on((data, id) => { if (this.incoming?.peerId === id) { this.clearIncoming(); this.handlers.onCancel?.(); } });
        channels.answer.on((data, id) => {
            if (this.outgoing?.peerId !== id) return;
            this.clearOutgoing();
            const peer = this.peers.get(id) ?? { id, name: 'Pilot' };
            if (!data?.accept) { this.handlers.onAnswer?.(peer, false, data?.reason); return; }
            // The challenger hosts: it picks the map and runs the simulation.
            const seed = Math.floor(Math.random() * 0x100000000) >>> 0;
            channels.start.send({ seed, v: PROTOCOL }, id);
            this.handlers.onStart?.({ role: 'host', peer, seed });
        });
        channels.start.on((data, id) => {
            const peer = this.peers.get(id) ?? { id, name: 'Pilot' };
            if (!Number.isFinite(data?.seed)) return;
            this.handlers.onStart?.({ role: 'guest', peer, seed: data.seed >>> 0 });
        });
        for (const name of ['input', 'state', 'fx', 'end', 'bye']) {
            const key = `on${name[0].toUpperCase()}${name.slice(1)}`;
            channels[name].on((data, id) => this.handlers[key]?.(data, id));
        }
        this.status = 'online';
        this.announce();
        this.changed();
    }

    leave() {
        this.clearOutgoing();
        this.clearIncoming();
        this.room?.leave();
        this.room = null;
        this.peers.clear();
        this.status = 'offline';
        this.region = null;
    }

    announce(target) { this.channels?.hello.send({ name: this.name, busy: this.busy, v: PROTOCOL }, target); }
    setName(name) { this.name = clean(name); this.announce(); }
    setBusy(busy) { this.busy = busy; this.announce(); this.changed(); }

    invite(peerId) {
        if (this.outgoing || this.busy || !this.peers.has(peerId)) return;
        this.outgoing = { peerId, timer: setTimeout(() => { this.cancelInvite(); this.handlers.onAnswer?.(this.peers.get(peerId), false, 'timeout'); }, INVITE_SECONDS * 1000) };
        this.channels.invite.send({}, peerId);
        this.changed();
    }

    cancelInvite() {
        if (!this.outgoing) return;
        this.channels.cancel.send({}, this.outgoing.peerId);
        this.clearOutgoing();
    }

    answer(accept) {
        if (!this.incoming) return;
        const { peerId } = this.incoming;
        this.clearIncoming();
        this.channels.answer.send({ accept, reason: accept ? null : 'declined' }, peerId);
        if (!accept) this.handlers.onCancel?.();
    }

    send(name, data, peerId) { this.channels?.[name].send(data, peerId); }

    clearOutgoing() { clearTimeout(this.outgoing?.timer); this.outgoing = null; this.changed(); }
    clearIncoming() { clearTimeout(this.incoming?.timer); this.incoming = null; }
    changed() { this.handlers.onChange?.(this); }
}
