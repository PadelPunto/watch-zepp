# Development

Needs Node.js and the Zeus CLI (`npm install -g @zeppos/zeus-cli`).

```bash
npm install
npm test          # all tests (see below)
npm run format    # format the code with Prettier
npm run check     # check formatting + run tests
zeus dev          # run in the simulator
zeus build        # build a .zab into dist/
npm run build     # check + zeus build, keeps .gitignore (zeus may reset it); for the Zepp App Store
npm run build -- --slim       # the same without intermediate products, to pass the file on
npm run release-check         # all automatic checks before a release (tools/release_check.mjs)
npm run release-check -- --zab   # the same, then builds and checks dist/PadelPunto-<version>.zab
```

The tests run without a watch or simulator:

- **Rules:** 28,800 random matches compared against a separate reference model.
- **Whole app** on a simulated watch (`test/mock/watch.mjs`), plus 18,000 random taps and swipes (`test/monkey.test.mjs`).
- **Every screen size:** the app tests run on a Bip 6 (390×450), again on a Bip Max (432×514, `test/app.bipmax.test.mjs`) and on an Active 2 (Square) (`test/app.active2.test.mjs`, the Bip 6 screen with its own model name). Watches are listed in `DEVICES` in `test/mock/zos.mjs`; tests tap at points of the 390 px design, scaled like `px()`.
- **Performance limits:** wake-ups per minute, redraws and file writes per point, widgets per page and leaks (`test/perf.test.mjs`).
- **Storage** and **texts:** every language has the same keys.

Tools:

```bash
python3 tools/logo.py assets/default.s    # redraw logo, app icon and the spinning racket
~/.cache/padelpunto/tts/bin/python tools/voice.py <voices-dir> assets/default.s   # regenerate the score-call words (setup at the top of the file; licenses in CREDITS.md)
```

