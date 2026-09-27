// Online play settings. The only secret-free thing Trystero needs is the
// Realtime Database URL of a Firebase project on the free Spark plan. Spark
// has no billing account, so going over its limits stops matchmaking; it can
// never cost money. Leave it empty to hide online play.
export const FIREBASE_DATABASE_URL = '';

/** One shared lobby per region. Players only see and challenge people in theirs. */
export const REGIONS = [
    { id: 'eu', name: 'Europe' },
    { id: 'am', name: 'Americas' },
    { id: 'ap', name: 'Asia-Pacific' },
    { id: 'af', name: 'Africa & Middle East' },
];

/** Bumped when messages change shape, so old and new builds do not pair up. */
export const PROTOCOL = 1;

/** The arena every online match uses, so both screens show the same world. */
export const ONLINE_ARENA = { width: 1280, height: 720 };

/** The database URL, overridable with ?db=… for trying a project before committing it. */
export function databaseUrl() {
    const override = new URLSearchParams(globalThis.location?.search ?? '').get('db');
    return override && /^https:\/\/[\w.-]+\.(firebaseio\.com|firebasedatabase\.app)\/?$/.test(override) ? override : FIREBASE_DATABASE_URL;
}

/** ?net=local swaps Firebase for a same-browser channel, for testing with two tabs. */
export const LOCAL_NET = new URLSearchParams(globalThis.location?.search ?? '').get('net') === 'local';

export function onlineAvailable() { return LOCAL_NET || Boolean(databaseUrl()); }

/** A best guess at the player's region from their time zone. */
export function guessRegion() {
    const zone = globalThis.Intl?.DateTimeFormat().resolvedOptions().timeZone ?? '';
    if (/^(America|US|Canada|Brazil|Chile|Mexico)\//.test(zone)) return 'am';
    if (/^(Asia|Australia|Pacific|Indian)\//.test(zone)) return /Dubai|Riyadh|Qatar|Tehran|Baghdad|Kuwait|Jerusalem|Tel_Aviv|Beirut|Amman|Muscat|Bahrain/.test(zone) ? 'af' : 'ap';
    if (/^Africa\//.test(zone)) return 'af';
    return 'eu';
}
