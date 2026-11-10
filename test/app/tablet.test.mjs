// The tablet app (Padel Punto Panel) works out game, set and match ball itself from the messages
// of the watch. This plays whole matches on the simulated watch under every kind of rules and
// checks what the tablet would show against the scoring of the watch (utils/score.js).
// Needs the tablet app next to this repository (../Panel, repo app-android); skipped without it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import vm from 'node:vm'
import { w, startMatch, tapTeam } from './helpers.mjs'
import { newMatch, addPoint, pointLabels } from '../../utils/score.js'

const PANEL_JS = new URL('../../../Panel/app/src/main/assets/designs/panel.js', import.meta.url)
const skip = existsSync(PANEL_JS) ? false : 'the tablet app is not next to this repository'

// designs/panel.js as the tablet loads it, without a page (as test/load.mjs of the tablet app).
function tablet() {
  const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  const ctx = vm.createContext({
    location: { search: '?lang=de', pathname: '/designs/arena.html' },
    navigator: { language: 'de' },
    sessionStorage: store,
    localStorage: store,
    setInterval: () => 0,
    setTimeout: () => 0,
    clearTimeout: () => {},
    addEventListener: () => {},
    document: { createElement: () => ({}), head: { appendChild: () => {} } },
  })
  ctx.window = ctx
  vm.runInContext(readFileSync(PANEL_JS, 'utf8'), ctx)
  return ctx
}

// The same numbers in every run, so a failure can be found again.
function random(seed) {
  let x = seed
  return () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648
}

const RULES = [
  { mode: 'adv', bestOf: 3, games: 6, decider: 'set' },
  { mode: 'golden', bestOf: 3, games: 6, decider: 'mtb' },
  { mode: 'star', bestOf: 3, games: 6, decider: 'noTb' },
  { mode: 'adv', bestOf: 3, games: 4, decider: 'mtb7' },
  { mode: 'golden', bestOf: 1, games: 6, decider: 'set' },
  { mode: 'star', bestOf: 1, games: 4, decider: 'set' },
  { mode: 'adv', bestOf: 3, games: 4, decider: 'noTb' },
  { mode: 'golden', bestOf: 3, games: 4, decider: 'set' },
]
const WORD = { match: 'Matchball', set: 'Satzball', game: 'Spielball' }

RULES.forEach((rules, n) => {
  const name = `${rules.mode}, best of ${rules.bestOf}, ${rules.games} games, ${rules.decider}`
  test(`tablet: game, set and match ball as the scoring of the watch says (${name})`, { skip }, () => {
    const page = tablet()
    let balls = 0
    const rnd = random(4711 + n)
    w.files.set('cfg.json', JSON.stringify(rules))
    w.files.set('panel.json', JSON.stringify({ code: '4711', key: 'abcd1234' }))
    w.launch()
    startMatch()
    w.zos.ble.advertise('PPP-4711')
    for (let t = 0; t < 600; t += 50) w.tick(50)
    let s = newMatch({ ...rules, sides: 'fip', firstServer: 0 }, 0)
    // even teams make long sets, tiebreaks and deciding sets; a lead makes short ones
    const lead = 0.5 + (n % 3) * 0.08
    for (let i = 0; i < 600 && s.winner === null; i++) {
      const team = rnd() < lead ? 0 : 1
      s = addPoint(s, team).state
      tapTeam(team)
      w.tick(300)
      const m = JSON.parse(w.zos.ble.writes.at(-1))
      const where = `${JSON.stringify(rules)} point ${i + 1}: ${JSON.stringify(m)}`
      assert.deepEqual(
        m.r,
        { m: rules.mode, b: rules.bestOf, gs: rules.games, d: rules.decider },
        'the rules of this test',
      )
      if (s.winner !== null) {
        assert.deepEqual(m.p, ['', ''], where)
        const hint = page.toState(m).hint
        assert.deepEqual([hint[0], hint[1]], ['Sieg', s.winner], where)
        break
      }
      assert.deepEqual(m.p, pointLabels(s), `the message is the one of this point – ${where}`)
      // what the next point would win for each team, by the rules of the watch
      const next = [0, 1].map((x) => {
        const events = addPoint(s, x).events
        return WORD[['match', 'set', 'game'].find((e) => events.includes(e))] || null
      })
      const got = page.ballWord(m)
      const hinted = m.h && m.h.k !== 'tb' && m.h.k !== 'mtb'
      if (next[0] && next[1]) {
        // both can win it with the next point: only at a golden or star point, which has its own hint
        assert.ok(hinted, where)
        continue
      }
      if (hinted) continue
      const want = next[0] ? [next[0], 0] : next[1] ? [next[1], 1] : null
      assert.deepEqual(got && [got[0], got[1]], want, where)
      if (want) balls++
    }
    assert.notEqual(s.winner, null, 'the match ends')
    assert.ok(balls >= 5, `${balls} balls checked`)
  })
})
