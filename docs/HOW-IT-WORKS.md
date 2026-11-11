# How Lantern works

Lantern is a webOS web app: `app/index.html`, `app/style.css` and `app/app.js`. It keeps its settings in the app's own `localStorage`.

## Talking to the TV

Lantern calls the Luna bus through `PalmServiceBridge`. Anything that needs root goes through Homebrew Channel:

```
luna://org.webosbrew.hbchannel.service/exec   { "command": "<shell command>" }
```

If that service does not answer as root, the root features show a message and change nothing.

## App list and icons

1. `luna-send -n 1 luna://com.webos.applicationManager/listApps '{}'` as root.
2. If that fails, every `appinfo.json` under the three application folders is read.
3. Icons live in other apps' folders, which the web engine may refuse to load, so each app folder is symlinked into `<Lantern's folder>/apps/<app id>` and icons are loaded from there.

The list is cached, so the home screen draws at once and the list is checked again in the background.

## Home button and remapping

LG Input Hook reads `/home/root/.config/lginputhook/keybinds.json`, a map from a button's uinput code to an action. Lantern only adds or changes its own entries:

| Lantern choice | Entry written |
| --- | --- |
| Open an app | `{"action":"launch","id":"<app id>"}` |
| Open Lantern, with "Keep in memory" on | `{"action":"exec","command":"sh /var/lib/webosbrew/lantern/open.sh"}` |
| Start standby | `{"action":"launch","id":"com.infixremix.lantern","params":{"standby":true}}` |
| Do nothing | `{"action":"ignore"}` |

Before the first write the file is copied to `keybinds.json.lantern-bak`. If a button already had an entry, Lantern remembers it and puts it back when the button is released.

**Detecting a button.** Lantern notes the length of each `/tmp/lginput-hook-*.log`, then reads only the new lines. It accepts both formats the hook writes:

```
[INFO] lginput_uinput_send_button called: keyid=3, state=1 uinput_code=773
id => 773
```

`uinput_code` is used, never `keyid`. Lines with a `state` other than 1 (release, repeat) are skipped. Arrows, OK, Back, numbers, channels, power and volume are refused.

**Confirming.** After a change Lantern waits 30 seconds for "Keep the change". With no answer it restores the button. The countdown pauses while another app is in front.

## Light, dark, day and night

Lantern works out sunrise and sunset for the chosen place itself (the same formulas SunCalc uses), and uses the times from the weather forecast when it has them. With no place chosen, day runs from 07:00 to 19:00. Each time the clock ticks it checks whether day or night, or the dull-weather rule, has changed, and only then updates the look. Night switches the wallpaper to the night picture and, in Automatic, the appearance to dark.

Location lookup happens only when asked: `https://ipapi.co/json/`, then `https://ipwho.is/` if that fails.

## Home button: one path

Where the TV reports a Home app setting, Lantern can write itself into it:

```
luna://com.webos.settingsservice/setSystemSettings
{"category":"general","settings":{"defaultApps":{ ...existing entries..., "home":"com.infixremix.lantern"}}}
```

The whole `defaultApps` object is read first and written back with only `home` changed, and the previous value is kept so it can be restored. When Lantern becomes the Home app it removes its own Home entry from LG Input Hook, because both together make Home fire twice.

## Starting the TV on Lantern

The TV opens its last input when it starts. "Start the TV on Lantern" does two things in order: it adds Lantern to the input list (`eim/addDevice`), and only if that worked it sets `lastInputApp` (settings: general) to Lantern, keeping the old value. It takes a full TV restart to show. Switching it off puts the old input back, or Live TV if the old one is no longer installed. This is the route that worked on the LG 43LM6300PLA; other models may differ.

## Opening quickly

`/var/lib/webosbrew/lantern/open.sh` opens Lantern. With "Keep in memory" on it launches with `"keepAlive":true` and falls back to a plain launch if the TV refuses that.

`/var/lib/webosbrew/lantern/warm.sh` loads Lantern in the background:

1. If the `no-preload` flag exists, or Lantern is already running, it does nothing. So it never creates a second copy.
2. It notes which app is in front, then launches Lantern with `"keepAlive":true,"preload":"full"`.
3. Four seconds later it checks again. If Lantern has come to the front over another app, this TV does not load apps quietly: it writes the `no-preload` flag, reopens the app that was in front, and never tries again.

`rewarm.sh` runs `warm.sh` every 45 seconds, so if the TV closes Lantern to free memory it is loaded again.

`/var/lib/webosbrew/init.d/55-lantern` runs at boot (Homebrew Channel runs everything in that folder). After 15 seconds it does whichever of these are switched on: re-applies the preload choices from Tune-up; opens Lantern or runs `warm.sh`; starts `rewarm.sh`; starts `home-watch.sh`, which opens Lantern whenever LG Home comes to the front.

Lantern itself does only cheap work when it is shown again (clock, wallpaper, focus), and stops its timers and releases its wallpaper while hidden.

## TV input

`luna://com.webos.service.eim/addDevice` with Lantern's app ID, and `deleteDevice` to remove it. `appinfo.json` sets `"supportGIP": true`, which the TV requires for this.

## Tune-up

- **Close background apps:** `applicationManager/running`, then `closeByAppId` for apps in Lantern's app list other than Lantern itself.
- **Settings:** each key is read with `settingsservice/getSystemSettings`. Only keys the TV has, and that are currently `true` or `"on"`, are changed, to `false` or `"off"`. The original value is saved first.
- **Preloads:** `preloadmanager/getPreloadPolicy` lists them; `setPreloadPolicy` with `"isEnabled": false` switches one off. LG Home, Live TV, the HDMI inputs and Lantern are never changed. On a TV without that service the section says so.

## Restore TV defaults

In order: Lantern's key entries are removed or replaced by what was there before; Tune-up settings and preloads are put back; the start-up script and helper folder are deleted and the helpers stopped; the TV's Home app setting and start-up input are put back if Lantern changed them; Lantern is removed from the input list; `/tmp/lantern-*` is cleared.

## Performance choices

- Only `transform` and `opacity` are animated.
- One click listener and one hover listener serve every tile and button.
- While another app is in front, timers stop and the wallpaper picture is released.
- Pictures are loaded off screen and swapped in once they arrive.
- Only one full-size wallpaper is held at a time. The wallpaper chooser uses small copies of the bundled pictures (`walls/t-*.jpg`), because showing nine full pictures at once would take about 70 MB.
- Loaded in the background, Lantern holds no wallpaper and runs no timers until it is shown.
