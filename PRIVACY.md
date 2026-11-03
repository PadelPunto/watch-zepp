# 🔒 Privacy Policy – Padel Punto

Last updated: 2026-11-01

Padel Punto is a padel score counter for Amazfit watches with Zepp OS. It is free, open source
and made by one hobby developer. **Padel Punto does not collect or share any data.** The only
thing it ever sends is the score to your own tablet, if you pair one (see below).

## What the app uses

| Permission | What for | Where it goes |
|---|---|---|
| Heart rate (`data:user.hd.heart_rate`) | Shows your current heart rate at the top of the match screen. Can be switched off in the options (“Heart rate in match”). | Shown on the watch only. Not saved, not sent. |
| Device info (`data:os.device.info`) | Shows the watch model and screen size on the hidden diagnosis page (for bug reports). | Shown on the watch only. Not saved, not sent. |
| Alarms (`device:os.alarm`) | The court timer: a reminder before your court booking ends, even with the app closed. | Set on the watch only. |
| Bluetooth (no permission needed on Zepp OS) | Only if you pair a tablet with the Padel Punto Panel app: sends the score of the running match to it. | Straight to your paired tablet nearby, nothing else. See below. |

## Tablet scoreboard (Padel Punto Panel)

You can pair the watch with a tablet running the free app Padel Punto Panel, which shows the score
big at the court. Nothing is sent unless you pair a tablet yourself.

- **Pairing:** you start it on the tablet, and the watch and the tablet show the same check
  number. The watch remembers the tablet's code, the tablet remembers a random key of the watch
  and its model name (e.g. “Bip 6”). You can forget the pairing on both.
- **During a match** the watch sends the score directly to the paired tablet over Bluetooth
  Low Energy: points, games, sets, serving team, team names (if you entered any), the match
  rules, the match duration and the watch's key. It sends no heart rate, no location and nothing
  about you.
- **Where it goes:** only to the paired tablet within Bluetooth range. Neither the watch nor the
  tablet app sends it to the internet, a phone, a server or anyone else. The tablet shows it and
  keeps only the pairing and the chosen design, not the matches.

## What the app saves on your watch

The app keeps a few small files in its own storage on the watch: the running match (so it waits
for you after a restart), the last finished matches (history), your options, the court time you
set with its reminder, a short error log for the diagnosis page and, if you paired a tablet, its
code and the watch's key. Team names you enter are part of these files.

These files never leave the watch (the score of a running match goes to a paired tablet, see
above). Padel Punto has no internet access, no phone-side part, no
account, no analytics, no ads and no third-party SDKs. Uninstalling the app deletes the files.

## Children

The app collects no personal data from anyone, including children.

## Changes

If this policy changes, the new version is published here, with a new date at the top. The full
history is in the [GitHub repository](https://github.com/PadelPunto/watch-zepp/commits/main/PRIVACY.md).

## Contact

Questions? Open an issue at <https://github.com/PadelPunto/watch-zepp/issues>.
