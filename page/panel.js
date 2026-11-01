// Tablet (Padel Punto Panel): opened from the ball of the start-screen logo. Without a paired
// tablet it explains the pairing and offers "Koppeln"; while searching "Abbrechen"; with a paired
// tablet it shows the code (as on the tablet) with "Neu koppeln" and "Vergessen".
// Opened and left with replace() like the options (button, swipe right or back key).
import * as hmUI from '@zos/ui'
import { replace } from '@zos/router'
import { px } from '@zos/utils'
import { C, text, button, fullScreen, header, onLeave } from '../utils/theme'
import { tr } from '../utils/i18n'
import { safePage } from '../utils/errors'
import { toast } from '../utils/toast'
import { loadPanel, forgetPanel, pair, panelName } from '../utils/panel'

function home() {
  replace({ url: 'page/start' })
}

function bigButton(y, x, w, label, primary, onClick, color) {
  return button({
    x: px(x),
    y: px(y),
    w: px(w),
    h: px(60),
    radius: px(30),
    text: label,
    text_size: px(26),
    color: color || (primary ? 0x000000 : 0xffffff),
    normal_color: primary ? C.ball : C.pill,
    press_color: primary ? C.ballPress : C.tile,
    click_func: onClick,
  })
}

Page(
  safePage('panel', {
    build() {
      fullScreen()
      this.stopClock = header(tr('panel'))
      this.offLeave = onLeave(() => home())
      const { code } = loadPanel()
      const center = { x: px(24), w: px(342), align_h: hmUI.align.CENTER_H }

      if (code) {
        text({ ...center, y: px(104), h: px(30), text: tr('panelPairedWith'), text_size: px(24), color: C.muted })
        text({ ...center, y: px(138), h: px(70), text: panelName(code), text_size: px(56), color: C.ball })
      } else {
        this.info = text({
          ...center,
          y: px(100),
          h: px(130),
          text: tr('panelHow'),
          text_size: px(26),
          color: 0xffffff,
          text_style: hmUI.text_style.WRAP,
        })
      }

      // Searching swaps the pair button for "Abbrechen" and the text for the search state.
      const pairLabel = code ? tr('panelRepair') : tr('panelPair')
      this.pairBtn = bigButton(code ? 236 : 250, 12, 366, pairLabel, !code, () => this.start())
      this.cancelBtn = bigButton(code ? 236 : 250, 12, 366, tr('cancel'), false, () => this.cancel())
      this.cancelBtn.setProperty(hmUI.prop.VISIBLE, false)
      this.searchW = text({
        ...center,
        y: px(code ? 206 : 100),
        h: px(code ? 28 : 130),
        text: tr('panelSearch'),
        text_size: px(code ? 22 : 26),
        color: C.ball,
        text_style: hmUI.text_style.WRAP,
      })
      this.searchW.setProperty(hmUI.prop.VISIBLE, false)

      if (code) {
        bigButton(316, 12, 179, tr('panelForget'), false, () => this.forget(), C.danger)
        bigButton(316, 199, 179, tr('back'), false, () => home())
      } else bigButton(326, 12, 366, tr('back'), false, () => home())
    },

    start() {
      this.searching(true)
      this.stopPair = pair((result) => {
        this.stopPair = null
        if (result.ok) toast(tr('panelDone', { code: panelName(result.code) }))
        else toast(result.why === 'none' ? tr('panelNone') : tr('panelFailed'))
        // Built anew, so the page shows the new state (paired or not).
        replace({ url: 'page/panel' })
      })
    },

    cancel() {
      if (this.stopPair) this.stopPair()
      this.stopPair = null
      this.searching(false)
    },

    searching(on) {
      this.pairBtn.setProperty(hmUI.prop.VISIBLE, !on)
      this.cancelBtn.setProperty(hmUI.prop.VISIBLE, on)
      this.searchW.setProperty(hmUI.prop.VISIBLE, on)
      if (this.info) this.info.setProperty(hmUI.prop.VISIBLE, !on)
    },

    forget() {
      forgetPanel()
      toast(tr('panelForgot'))
      replace({ url: 'page/panel' })
    },

    onDestroy() {
      if (this.stopPair) this.stopPair()
      if (this.offLeave) this.offLeave()
      if (this.stopClock) this.stopClock()
    },
  }),
)
