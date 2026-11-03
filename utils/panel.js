// Padel Punto Panel: the tablet next to the court that shows the score big (Android app, protocol
// in PROTOCOL.md of github.com/PadelPunto/protocol). Zepp OS apps can only scan and connect (BLE
// master), so the watch always starts the connection, but pairing starts on the tablet: "Uhr
// koppeln" opens a pairing window, and the tablet then advertises as "PPP-4711+" instead of
// "PPP-4711". The watch takes the first tablet it sees in that state, connects, writes a pair
// message with its own key and remembers the code. The tablet keeps the key and from then on only
// takes that watch.
import * as ble from '@zos/ble'
import { getDeviceInfo } from '@zos/device'
import { read, write, remove } from './files'
import { safe } from './errors'

export const SERVICE = 'e5f2a000-6b3c-4c2a-9f1e-7061646c7074'
export const SCORE = 'e5f2a001-6b3c-4c2a-9f1e-7061646c7074'
const PROFILE = 'padelpunto'
export const SCAN_MS = 15000
export const CONNECT_MS = 10000
// "PPP-" and four digits; a "+" at the end means the pairing window is open.
const PAIRING = /^PPP-(\d{4})\+$/

// { code: '4711' or null, key: this watch's key or null }. The key is made at the first pairing
// and kept when the tablet is forgotten, so the watch stays the same watch for the tablet.
export function loadPanel() {
  const saved = read('panel', {})
  const ok = saved && typeof saved === 'object'
  const code = ok && typeof saved.code === 'string' && /^\d{4}$/.test(saved.code) ? saved.code : null
  const key = ok && typeof saved.key === 'string' && /^[0-9a-z]{8}$/.test(saved.key) ? saved.key : null
  return { code, key }
}

export function forgetPanel() {
  const { key } = loadPanel()
  if (key) write('panel', { code: null, key })
  else remove('panel')
}

export const panelName = (code) => 'PPP-' + code

function newKey() {
  let k = ''
  while (k.length < 8) k += Math.floor(Math.random() * 36).toString(36)
  return k
}

// UTF-8, as the tablet reads it (a watch name may hold more than ASCII).
export function utf8(text) {
  const out = []
  for (const ch of text) {
    let c = ch.codePointAt(0)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return new Uint8Array(out).buffer
}

function watchName() {
  try {
    return String(getDeviceInfo().deviceName || '')
  } catch (e) {
    return ''
  }
}

// One pairing at a time; its state lives here because the BLE callbacks are global.
let run = null

// A new two-digit number for each pairing (10–99). The watch sends it along and shows it; the
// tablet shows the number it got and pairs only when "Passt" is tapped there, so a strange watch
// pairing at the same moment is noticed.
export function newCheck() {
  return 10 + Math.floor(Math.random() * 90)
}

// Looks for a tablet in its pairing window, connects and pairs. onDone gets { ok: true, code, n } or
// { ok: false, why: 'none' } (nothing found within SCAN_MS) / { ok: false, why: 'failed' }.
// Returns a function that cancels the pairing (onDone is not called then).
export function pair(onDone) {
  stop()
  const me = { onDone, dev: null, code: null, connectId: null, profile: null, timer: null }
  run = me
  const finish = (result) => {
    if (run !== me) return
    if (result.ok) {
      const key = loadPanel().key || me.key
      write('panel', { code: me.code, key })
    }
    stop()
    onDone(result)
  }
  me.finish = finish

  // mstStartScan takes only the callback (more arguments made the Bip 6 restart), and it is
  // called for every advertisement, so it does as little as possible until the tablet is found.
  const ok = ble.mstStartScan(
    safe('panelScan', (result) => {
      if (run !== me || me.dev) return
      const m = PAIRING.exec((result && result.dev_name) || '')
      if (!m) return
      me.dev = result.dev_addr
      me.code = m[1]
      ble.mstStopScan()
      clearTimeout(me.timer)
      me.timer = setTimeout(() => finish({ ok: false, why: 'failed' }), CONNECT_MS)
      setTimeout(() => connect(me), 100)
    }),
  )
  if (!ok) {
    finish({ ok: false, why: 'failed' })
    return () => {}
  }
  me.timer = setTimeout(() => finish({ ok: false, why: 'none' }), SCAN_MS)
  return () => {
    if (run === me) stop()
  }
}

function connect(me) {
  if (run !== me) return
  ble.mstConnect(
    me.dev,
    safe('panelConnect', (r) => {
      if (run !== me) return
      if (r.connected === 0) {
        me.connectId = r.connect_id
        buildProfile(me)
      } else me.finish({ ok: false, why: 'failed' })
    }),
  )
}

// Profile layout as in silver-zepp/zeppos-easy-ble and the BLE test (the typings leave out uuid,
// size, len2 and desc); permission 32 allows everything. The callbacks get one object each.
function buildProfile(me) {
  ble.mstOnPrepare(
    safe('panelPrepare', (r) => {
      if (run !== me) return
      if (r.status !== 0) return me.finish({ ok: false, why: 'failed' })
      me.profile = r.profile
      me.key = loadPanel().key || newKey()
      me.n = newCheck()
      const msg = JSON.stringify({ v: 1, e: 'pair', k: me.key, dn: watchName(), n: me.n })
      const data = utf8(msg)
      ble.mstWriteCharacteristic(me.profile, SCORE, data, data.byteLength)
    }),
  )
  ble.mstOnCharaWriteComplete(
    safe('panelWrite', (r) => {
      if (run !== me) return
      me.finish(r.status === 0 ? { ok: true, code: me.code, n: me.n } : { ok: false, why: 'failed' })
    }),
  )
  setTimeout(() => {
    if (run !== me) return
    const ok = ble.mstBuildProfile({
      pair: false,
      id: me.connectId,
      profile: PROFILE,
      dev: me.dev,
      len: 1,
      list: [
        {
          uuid: true,
          size: 1,
          len: 1,
          list: [
            {
              uuid: SERVICE,
              permission: 0,
              len1: 1,
              len2: 1,
              list: [{ uuid: SCORE, permission: 32, desc: 0, len: 0 }],
            },
          ],
        },
      ],
    })
    if (!ok) me.finish({ ok: false, why: 'failed' })
  }, 50)
}

// Stops scanning, closes the connection and drops the callbacks.
function stop() {
  const me = run
  run = null
  if (!me) return
  clearTimeout(me.timer)
  try {
    ble.mstStopScan()
    if (me.profile !== null) ble.mstDestroyProfileInstance(me.profile)
    if (me.connectId !== null) ble.mstDisconnect(me.connectId)
    ble.mstOffAllCb()
  } catch (e) {
    // nothing left to clean up
  }
}

// ---- during a match: connection to the paired tablet and the score messages ----

// Wait before the next search after a failed or lost connection (the last value repeats), so a
// tablet that is switched off doesn't keep the watch scanning all the time.
export const RETRY_MS = [2000, 5000, 10000, 15000]
// A write the watch never confirms doesn't block the next message for longer than this.
const WRITE_MS = 3000
// Ending or leaving a match waits at most this long for its last message to be written.
export const END_MS = 1500

let link = null

// Keeps the match connected to the paired tablet: searches for "PPP-<code>" (with or without
// "+"), connects, and sends sync() at once; after a loss it searches again. onState gets 'search'
// or 'on'. Returns { send(text), stop() }, or null without a paired tablet. Counting never waits
// for any of this; only the latest message is kept, as every message carries the whole score.
export function panelLink({ onState, sync }) {
  const { code, key } = loadPanel()
  if (!code || !key) return null
  stopLink()
  const me = {
    names: ['PPP-' + code, 'PPP-' + code + '+'],
    onState,
    sync,
    dev: null,
    gen: 0,
    connectId: null,
    profile: null,
    ready: false,
    writing: false,
    latest: null,
    timer: null,
    writeTimer: null,
    tries: 0,
    state: null,
  }
  link = me
  linkState(me, 'search')
  linkScan(me)
  return {
    send: (text) => linkSend(me, text),
    // The last message when the match is ended or left: written if connected, then the link
    // stops and done() runs (at once without a connection, after END_MS at the latest).
    end: (text, done) => linkEnd(me, text, done),
    stop: () => {
      if (link === me) stopLink()
    },
  }
}

function linkState(me, state) {
  if (me.state === state) return
  me.state = state
  me.onState(state)
}

function linkScan(me) {
  if (link !== me) return
  me.dev = null
  const ok = ble.mstStartScan(
    safe('linkScan', (result) => {
      if (link !== me || me.dev || !me.names.includes((result && result.dev_name) || '')) return
      me.dev = result.dev_addr
      ble.mstStopScan()
      clearTimeout(me.timer)
      me.timer = setTimeout(() => linkRetry(me), CONNECT_MS)
      setTimeout(() => linkConnect(me), 100)
    }),
  )
  if (!ok) return linkRetry(me)
  me.timer = setTimeout(() => {
    if (link !== me || me.dev) return
    ble.mstStopScan()
    linkRetry(me)
  }, SCAN_MS)
}

// Closes what is open and searches again a little later.
function linkRetry(me) {
  if (link !== me) return
  linkClose(me)
  linkState(me, 'search')
  const wait = RETRY_MS[Math.min(me.tries, RETRY_MS.length - 1)]
  me.tries++
  me.timer = setTimeout(() => linkScan(me), wait)
}

function linkClose(me) {
  clearTimeout(me.timer)
  clearTimeout(me.writeTimer)
  me.gen++
  me.ready = false
  me.writing = false
  try {
    ble.mstStopScan()
    if (me.profile !== null) ble.mstDestroyProfileInstance(me.profile)
    if (me.connectId !== null) ble.mstDisconnect(me.connectId)
    ble.mstOffAllCb()
  } catch (e) {
    // nothing left to clean up
  }
  me.profile = null
  me.connectId = null
}

function linkConnect(me) {
  if (link !== me) return
  const gen = ++me.gen
  ble.mstConnect(
    me.dev,
    safe('linkConnect', (r) => {
      if (link !== me || gen !== me.gen) return
      if (r.connected === 0) {
        me.connectId = r.connect_id
        linkProfile(me, gen)
      } else linkRetry(me) // 1: failed, 2: lost
    }),
  )
}

function linkProfile(me, gen) {
  ble.mstOnPrepare(
    safe('linkPrepare', (r) => {
      if (link !== me || gen !== me.gen) return
      if (r.status !== 0) return linkRetry(me)
      clearTimeout(me.timer)
      me.profile = r.profile
      me.ready = true
      me.tries = 0
      linkState(me, 'on')
      me.latest = null
      linkWrite(me, me.sync())
    }),
  )
  ble.mstOnCharaWriteComplete(
    safe('linkWrite', () => {
      if (link !== me || gen !== me.gen) return
      linkWritten(me)
    }),
  )
  setTimeout(() => {
    if (link !== me || gen !== me.gen) return
    const ok = ble.mstBuildProfile({
      pair: false,
      id: me.connectId,
      profile: PROFILE,
      dev: me.dev,
      len: 1,
      list: [
        {
          uuid: true,
          size: 1,
          len: 1,
          list: [
            {
              uuid: SERVICE,
              permission: 0,
              len1: 1,
              len2: 1,
              list: [{ uuid: SCORE, permission: 32, desc: 0, len: 0 }],
            },
          ],
        },
      ],
    })
    if (!ok) linkRetry(me)
  }, 50)
}

function linkSend(me, text) {
  me.latest = text
  if (me.ready && !me.writing) linkWrite(me, null)
}

// Writes text (or the latest waiting message); the next one goes once this one is confirmed.
function linkWrite(me, text) {
  const msg = text !== null ? text : me.latest
  if (msg === null) return
  me.latest = null
  me.writing = true
  const data = utf8(msg)
  ble.mstWriteCharacteristic(me.profile, SCORE, data, data.byteLength)
  clearTimeout(me.writeTimer)
  me.writeTimer = setTimeout(() => linkWritten(me), WRITE_MS)
}

function linkWritten(me) {
  clearTimeout(me.writeTimer)
  me.writing = false
  if (me.ready && me.latest !== null) linkWrite(me, null)
  else if (me.ended) me.ended()
}

function linkEnd(me, text, done) {
  let called = false
  let timer = null
  const finish = () => {
    if (called) return
    called = true
    clearTimeout(timer)
    if (link === me) stopLink()
    done()
  }
  if (link !== me || !me.ready) return finish()
  me.ended = finish
  timer = setTimeout(finish, END_MS)
  linkSend(me, text)
}

function stopLink() {
  const me = link
  if (!me) return
  linkClose(me)
  link = null
}

// The event a message names: the most important of what addPoint reported, else 'undo' or 'sync'.
export function panelEvent(events) {
  return (
    ['match', 'set', 'game', 'switch', 'point', 'undo', 'end', 'leave', 'sync'].find((x) => events.includes(x)) ||
    'sync'
  )
}

// The score message (PROTOCOL.md), the whole score: e the event (panelEvent), w the winner of the
// game, set or match in e (-1 for a draw) or null, labels/server/hint as on the watch screen
// (hint: { k, n } or null), now for the match duration, sw: a change of ends comes with this
// change (also when e names the won game or set, which comes first).
export function scoreMessage(s, { e, w, key, now, labels, server, hint, sw = false }) {
  const sets = s.sets.map((set) => {
    if (set.mtb) return { t: set.tb, m: 1 }
    return set.tb ? { g: set.g, t: set.tb } : { g: set.g }
  })
  return JSON.stringify({
    v: 1,
    id: Math.floor(s.startedAt / 1000),
    e,
    w: w === undefined ? null : w,
    n: s.cfg.names || ['', ''],
    c: s.cfg.colors || [0, 1],
    p: s.winner === null ? labels : ['', ''],
    g: s.games,
    s: sets,
    sv: server,
    h: hint,
    t: Math.max(0, Math.round(((s.endedAt || now) - s.startedAt) / 1000)),
    r: { m: s.cfg.mode, b: s.cfg.bestOf, gs: s.cfg.games, d: s.cfg.decider },
    k: key,
    ...(sw ? { sw: 1 } : {}),
  })
}
