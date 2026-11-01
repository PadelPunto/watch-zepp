// Start screen: time, logo between the court clock and the training cone, then "Weiter" for an
// open match, "Neues Spiel", "Optionen" and "Verlauf". Info is reached from the options.
import * as hmUI from '@zos/ui'
import { replace, push } from '@zos/router'
import { px } from '@zos/utils'
import { hasStarted } from '../utils/score'
import { loadMatch, archiveMatch, matchStatus } from '../utils/store'
import { C, text, button, restyle, clock, fullScreen, confirmTwice } from '../utils/theme'
import { tr, APP_NAME } from '../utils/i18n'
import { safePage } from '../utils/errors'
import { toast } from '../utils/toast'
import { loadCourt } from '../utils/court'
import { hourText } from '../utils/time'
import { loadPanel } from '../utils/panel'

// The logo's ball as the tablet button: [normal, pressed], without / with a paired tablet, for the
// big logo and the small one (open match). Written out, so the asset test finds every path.
const BALL_IMG = {
  off: ['img/ball_panel.png', 'img/ball_panel_press.png'],
  on: ['img/ball_panel_on.png', 'img/ball_panel_on_press.png'],
  offSmall: ['img/ball_panel_s.png', 'img/ball_panel_s_press.png'],
  onSmall: ['img/ball_panel_on_s.png', 'img/ball_panel_on_s_press.png'],
}

function bigProps(y, w, x, label, primary, onClick) {
  return {
    x: px(x),
    y: px(y),
    w: px(w),
    h: px(60),
    radius: px(30),
    text: label,
    text_size: px(28),
    color: primary ? 0x000000 : 0xffffff,
    normal_color: primary ? C.ball : C.pill,
    press_color: primary ? C.ballPress : C.tile,
    click_func: onClick,
  }
}

Page(
  safePage('start', {
    // The match page returns here via replace(), so build() always sees the current saved match.
    build() {
      fullScreen()

      // A finished match that was left without pressing "Ende" goes to the log now. If the log
      // can't be written, it stays saved and the next start or "Neues Spiel" tries again.
      const status = matchStatus()
      if (status === 'won') {
        const saved = loadMatch()
        if (saved && saved.winner !== null) archiveMatch(saved)
      }
      this.open = status === 'open'
      // Replacing an open match needs a second tap; the old one goes to the log as abandoned.
      this.newConfirm = confirmTwice(
        (on) => this.paintNew(on ? tr('endOld') : tr('newGame')),
        () => this.newGame(),
        () => this.open,
      )

      this.stopClock = clock({
        x: px(12),
        y: px(6),
        w: px(366),
        h: px(30),
        color: C.muted,
        align_h: hmUI.align.CENTER_H,
      })

      // Logo, name and buttons spread over the screen. With an open match a smaller logo
      // (tools/logo.py) makes room for "Weiter" and the buttons move a little closer.
      const L = this.open
        ? { top: 42, size: 110, src: 'img/logo_small.png', gap: 12, step: 70 }
        : { top: 48, size: 150, src: 'img/logo.png', gap: 20, step: 72 }
      hmUI.createWidget(hmUI.widget.IMG, {
        x: px((390 - L.size) / 2),
        y: px(L.top),
        w: px(L.size),
        h: px(L.size),
        src: L.src,
      })
      // The ball of the logo opens the tablet page (Padel Punto Panel). Its images (tools/panel_ball.py)
      // sit exactly over the ball and are larger than it, so the tap area is bigger. With a paired
      // tablet the board in the ball is filled, a ring goes round it and the code shows below.
      const panel = loadPanel()
      const B = this.open ? { x: 202, y: 38, size: 52, codeY: 85 } : { x: 205, y: 43, size: 70, codeY: 106 }
      const ballImg = BALL_IMG[(panel.code ? 'on' : 'off') + (this.open ? 'Small' : '')]
      button({
        x: px(B.x),
        y: px(B.y),
        w: px(B.size),
        h: px(B.size),
        normal_src: ballImg[0],
        press_src: ballImg[1],
        click_func: () => replace({ url: 'page/panel' }),
      })
      if (panel.code) {
        text({
          x: px(B.x - 10),
          y: px(B.codeY),
          w: px(B.size + 20),
          h: px(22),
          text: panel.code,
          text_size: px(this.open ? 16 : 18),
          color: C.ball,
          align_h: hmUI.align.CENTER_H,
        })
      }
      // Court time on the left of the logo (mirroring the cone); a set end time shows below it.
      const btnY = L.top + (L.size - 56) / 2
      button({
        x: px(34),
        y: px(btnY),
        w: px(56),
        h: px(56),
        normal_src: 'img/clock.png',
        press_src: 'img/clock_press.png',
        click_func: () => replace({ url: 'page/court' }),
      })
      const court = loadCourt()
      if (court.end !== null) {
        const d = new Date(court.end)
        text({
          x: px(14),
          y: px(btnY + 58),
          w: px(96),
          h: px(26),
          text: hourText(d.getHours(), d.getMinutes()),
          text_size: px(20),
          color: C.ball,
          align_h: hmUI.align.CENTER_H,
        })
      }
      // Training sits right of the logo, clear of the rounded screen corners.
      button({
        x: px(300),
        y: px(btnY),
        w: px(56),
        h: px(56),
        normal_src: 'img/cone.png',
        press_src: 'img/cone_press.png',
        click_func: () => replace({ url: 'page/training' }),
      })
      const nameY = L.top + L.size + 8
      text({
        x: px(12),
        y: px(nameY),
        w: px(366),
        h: px(44),
        text: APP_NAME,
        text_size: px(40),
        color: C.ball,
        align_h: hmUI.align.CENTER_H,
      })

      let y = nameY + 44 + L.gap
      if (this.open) {
        button(bigProps(y, 366, 12, tr('resume'), true, () => replace({ url: 'page/match' })))
        y += L.step
      }
      this.newY = y
      this.newBtn = button(bigProps(y, 366, 12, tr('newGame'), !this.open, () => this.newConfirm.tap()))
      y += L.step
      button(bigProps(y, 179, 12, tr('options'), false, () => replace({ url: 'page/options' })))
      button(bigProps(y, 179, 199, tr('history'), false, () => push({ url: 'page/history' })))
    },

    // The new match is created on the serve page once the first server is chosen. An old match
    // that can't be moved to the log (storage full) is kept instead of being overwritten.
    newGame() {
      const saved = loadMatch()
      if (saved && hasStarted(saved) && !archiveMatch(saved)) {
        toast(tr('saveFailed'))
        return
      }
      replace({ url: 'page/serve' })
    },

    // MORE replaces the button's props, so it gets all of them.
    paintNew(label) {
      restyle(
        this.newBtn,
        bigProps(this.newY, 366, 12, label, false, () => this.newConfirm.tap()),
      )
    },

    onDestroy() {
      if (this.newConfirm) this.newConfirm.stop()
      if (this.stopClock) this.stopClock()
    },
  }),
)
