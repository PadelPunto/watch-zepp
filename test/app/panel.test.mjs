// Tablet (Padel Punto Panel): the ball of the logo, pairing with a tablet in its pairing window,
// forgetting it. Bluetooth is the master mock in test/mock/zos.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { T, w, saved, startMatch, points, openTraining } from './helpers.mjs'
import { SCAN_MS, RETRY_MS } from '../../utils/panel.js'

const ball = () => w.visible().find((b) => b.type === 'BUTTON' && /ball_panel/.test(b.props.normal_src || ''))
function openPanel() {
  ball().props.click_func()
  w.flush()
  assert.equal(w.url, 'page/panel')
}
// Connect, profile and write each answer a moment later; time runs in small steps, so timers set
// on the way run too.
function settle(ms = 600) {
  for (let t = 0; t < ms; t += 50) w.tick(50)
}
function pairWith(name, label = T.panelPair) {
  w.press(label)
  w.zos.ble.advertise(name)
  settle()
}

test('panel: the ball shows the board, opens the tablet page with an explanation and "Koppeln"', () => {
  w.launch()
  assert.equal(ball().props.normal_src, 'img/ball_panel.png')
  assert.equal(ball().props.press_src, 'img/ball_panel_press.png')
  openPanel()
  assert.ok(w.has(T.panel))
  assert.ok(w.has(T.panelHow))
  assert.ok(w.has(T.panelPair))
  assert.equal(w.zos.ble.scanning, false, 'no scan before "Koppeln"')
  w.press(T.back)
  assert.equal(w.url, 'page/start')
})

test('panel: pairs with the tablet in its pairing window, sends the pair message, shows the code', () => {
  w.launch()
  openPanel()
  w.press(T.panelPair)
  assert.ok(w.zos.ble.scanning)
  assert.ok(w.has(T.panelSearch))
  assert.ok(w.has(T.cancel))
  assert.equal(w.has(T.panelPair), false)
  w.zos.ble.advertise('Galaxy Tab A7')
  w.zos.ble.advertise('PPP-2093') // a tablet without an open pairing window
  settle()
  assert.equal(w.zos.ble.writes.length, 0, 'only a tablet with "+" is taken')
  w.zos.ble.advertise('PPP-4711+')
  settle()
  assert.equal(w.zos.ble.scanning, false)
  assert.equal(w.zos.ble.writes.length, 1)
  const msg = JSON.parse(w.zos.ble.writes[0])
  assert.equal(msg.v, 1)
  assert.equal(msg.e, 'pair')
  assert.match(msg.k, /^[0-9a-z]{8}$/)
  assert.equal(msg.dn, w.zos.device.deviceName)
  assert.equal(w.zos.ble.connections, 0, 'connection closed after pairing')
  assert.deepEqual(saved('panel'), { code: '4711', key: msg.k })
  assert.ok(w.zos.toasts.includes(T.panelDone.replace('{code}', 'PPP-4711')))
  assert.equal(w.url, 'page/panel')
  assert.ok(w.has('PPP-4711'))
  assert.ok(w.has(T.panelRepair))
  assert.ok(w.has(T.panelForget))
  w.press(T.back)
  assert.equal(ball().props.normal_src, 'img/ball_panel_on.png')
  assert.ok(w.has('4711'), 'code below the ball')
})

test('panel: no tablet in its pairing window, a failed connection or write: a message, nothing saved', () => {
  w.launch()
  openPanel()
  w.press(T.panelPair)
  w.tick(SCAN_MS + 100)
  assert.ok(w.zos.toasts.includes(T.panelNone))
  assert.equal(w.zos.ble.scanning, false)
  assert.equal(w.files.has('panel.json'), false)
  assert.ok(w.has(T.panelPair))

  for (const fail of ['connect', 'write', 'scan']) {
    w.zos.toasts.length = 0
    w.zos.ble.fail = fail
    pairWith('PPP-4711+')
    assert.ok(w.zos.toasts.includes(T.panelFailed), fail)
    assert.equal(w.files.has('panel.json'), false, fail)
    assert.equal(w.zos.ble.connections, 0, fail)
  }
})

test('panel: "Abbrechen", swipe and back key stop the search', () => {
  w.launch()
  openPanel()
  w.press(T.panelPair)
  w.press(T.cancel)
  assert.equal(w.zos.ble.scanning, false)
  assert.ok(w.has(T.panelPair))
  assert.ok(w.has(T.panelHow))
  w.zos.ble.advertise('PPP-4711+')
  w.tick(SCAN_MS + 100)
  assert.deepEqual(w.zos.toasts, [], 'nothing comes back after cancelling')

  w.press(T.panelPair)
  w.swipe('right')
  assert.equal(w.url, 'page/start')
  assert.equal(w.zos.ble.scanning, false)
  openPanel()
  w.press(T.panelPair)
  w.key('back')
  assert.equal(w.url, 'page/start')
  assert.equal(w.zos.ble.scanning, false)
})

test('panel: forget keeps the watch key, pairing again sends the same key', () => {
  w.launch()
  openPanel()
  pairWith('PPP-4711+')
  const key = saved('panel').key
  w.press(T.panelForget)
  assert.ok(w.zos.toasts.includes(T.panelForgot))
  assert.deepEqual(saved('panel'), { code: null, key })
  assert.ok(w.has(T.panelPair))
  pairWith('PPP-2093+')
  assert.equal(JSON.parse(w.zos.ble.writes.at(-1)).k, key)
  assert.deepEqual(saved('panel'), { code: '2093', key })
  // "Neu koppeln" with a paired tablet replaces it
  pairWith('PPP-5555+', T.panelRepair)
  assert.deepEqual(saved('panel'), { code: '5555', key })
})

test('panel: with an open match the small logo gets the small ball; a damaged file means not paired', () => {
  w.launch()
  startMatch()
  points(0, 1)
  w.closeApp()
  w.files.set('panel.json', '{"code":"47","key":"x"}')
  w.launch()
  if (w.url === 'page/match') w.press(T.end).press(T.leave)
  assert.ok(w.has(T.resume), 'open match')
  assert.equal(ball().props.normal_src, 'img/ball_panel_s.png')
  w.closeApp()
  w.files.set('panel.json', JSON.stringify({ code: '4711', key: 'abcd1234' }))
  w.launch()
  if (w.url === 'page/match') w.press(T.end).press(T.leave)
  assert.equal(ball().props.normal_src, 'img/ball_panel_on_s.png')
})

// ---- during a match ----

const KEY = 'abcd1234'
const link = () => w.visible().find((x) => x.type === 'IMG' && /panel_link/.test(x.props.src || ''))
const sent = () => JSON.parse(w.zos.ble.writes.at(-1))
function pairedMatch() {
  w.files.set('panel.json', JSON.stringify({ code: '4711', key: KEY }))
  w.launch()
  startMatch()
}
function connect() {
  w.zos.ble.advertise('PPP-4711')
  settle()
}

test('match: connects to the paired tablet, sends the score on connect and after every point', () => {
  pairedMatch()
  assert.ok(w.zos.ble.scanning, 'searching from the start of the match')
  assert.equal(link().props.src, 'img/panel_link_off.png', 'gray while searching')
  w.zos.ble.advertise('PPP-1234') // another tablet
  settle()
  assert.equal(w.zos.ble.writes.length, 0)
  connect()
  assert.equal(link().props.src, 'img/panel_link_on.png', 'lime when connected')
  let m = sent()
  assert.equal(m.e, 'sync')
  assert.equal(m.v, 1)
  assert.equal(m.k, KEY)
  assert.deepEqual(m.p, ['0', '0'])
  assert.deepEqual(m.g, [0, 0])
  assert.deepEqual(m.s, [])
  assert.equal(m.sv, 0)
  assert.equal(m.h, null)
  assert.deepEqual(m.r, { m: 'adv', b: 3, gs: 6, d: 'set' })
  assert.deepEqual(m.n, ['', ''])

  points(0, 1)
  m = sent()
  assert.equal(m.e, 'point')
  assert.equal(m.w, null)
  assert.deepEqual(m.p, ['15', '0'])
  points(0, 3)
  m = sent()
  assert.equal(m.e, 'game')
  assert.equal(m.w, 0)
  assert.deepEqual(m.g, [1, 0])
  assert.deepEqual(m.p, ['0', '0'])
  w.press(T.undo)
  m = sent()
  assert.equal(m.e, 'undo')
  assert.deepEqual(m.p, ['40', '0'])
  assert.deepEqual(m.g, [0, 0])
})

test('match: deuce hint as a key; a set as {g}; the match winner', () => {
  pairedMatch()
  connect()
  points(0, 3)
  points(1, 3)
  assert.deepEqual(sent().h, { k: 'deuce' })
  assert.deepEqual(sent().p, ['40', '40'])
  points(0, 2) // game
  for (let i = 0; i < 5; i++) points(0, 4)
  let m = sent()
  assert.equal(m.e, 'set')
  assert.equal(m.w, 0)
  assert.deepEqual(m.s, [{ g: [6, 0] }])
  for (let i = 0; i < 6; i++) {
    if (w.page.inst.bannerOn) w.tapAt(195, 222).tick(400)
    points(0, 4)
  }
  m = sent()
  assert.equal(m.e, 'match')
  assert.equal(m.w, 0)
  assert.deepEqual(m.s, [{ g: [6, 0] }, { g: [6, 0] }])
  assert.ok(m.t >= 0)
  assert.ok(
    w.zos.ble.writes.every((x) => x.length < 400),
    'messages stay short',
  )
})

test('match: a lost connection is searched again, then synced; counting goes on meanwhile', () => {
  pairedMatch()
  connect()
  w.zos.ble.drop()
  assert.equal(link().props.src, 'img/panel_link_off.png')
  const before = w.zos.ble.writes.length
  points(1, 2)
  assert.equal(w.zos.ble.writes.length, before, 'nothing written without a connection')
  settle(RETRY_MS[0] + 100)
  assert.ok(w.zos.ble.scanning, 'searching again')
  connect()
  assert.equal(link().props.src, 'img/panel_link_on.png')
  const m = sent()
  assert.equal(m.e, 'sync')
  assert.deepEqual(m.p, ['0', '30'], 'the score from meanwhile')
})

test('match: tablet not found keeps searching with pauses; leaving the match stops it', () => {
  pairedMatch()
  w.tick(SCAN_MS)
  assert.equal(w.zos.ble.scanning, false, 'pause after a search')
  settle(RETRY_MS[0] + 100)
  assert.ok(w.zos.ble.scanning, 'next search')
  points(0, 1)
  w.press(T.end).press(T.leave)
  assert.equal(w.url, 'page/start')
  assert.equal(w.zos.ble.scanning, false)
  settle(20000)
  assert.equal(w.zos.ble.scanning, false, 'no search after leaving')
})

test('match: no paired tablet or a training: no search and no board in the top bar', () => {
  w.launch()
  startMatch()
  assert.equal(w.zos.ble.scanning, false)
  assert.equal(link(), undefined)
  w.press(T.end)
  w.closeApp()
  w.files.set('panel.json', JSON.stringify({ code: '4711', key: KEY }))
  w.launch()
  openTraining().press(T.go).tapAt(195, 300)
  assert.equal(w.url, 'page/match')
  assert.equal(w.zos.ble.scanning, false)
  assert.equal(link(), undefined)
})
