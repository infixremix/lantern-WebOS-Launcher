# Opening Lantern without the TV's loading cover

This note covers one problem seen on an LG 43LM6300PLA (webOS 4.10.2): pressing Home, or waking the TV, shows LG's own loading cover (`com.webos.app.cpcover` / `com.webos.app.splash`) for 4 to 5 seconds before Lantern appears, and LG Home sometimes appears as well.

**None of the changes below has been run on a TV yet.** They pass the automated tests and the shell scripts were exercised with a fake `luna-send`. The test plan at the end is what confirms them.

## What is known

- The cover is LG system UI. It is drawn before any of Lantern's own page loads, so nothing in `app.js`, `index.html` or a splash image can remove it.
- `"noSplashOnLaunch": true` and `"spinnerOnLaunch": false` are set in `appinfo.json`, and the cover still appeared on that TV. They are left in because they are harmless, but there is no point trying further splash changes.
- The cover only appears on a cold start. So the fix is to stop Lantern starting cold: keep it loaded and resume it.
- Another launcher project found that at standby the TV's app manager closes every app except those on its own keep-alive list, which is why a launcher starts cold after waking. `keepAlive` on a launch does not survive that. Lantern does not change that list.

## What Lantern does about it

1. **Instant Home** (Settings, Remote, or the setup steps) switches on three things:
   - at TV start, `55-lantern` waits 15 seconds and runs `warm.sh`, which launches Lantern with `"keepAlive":true,"preload":"full"`;
   - Lantern asks the TV to keep it in memory;
   - `rewarm.sh` runs `warm.sh` every 45 seconds, so a closed Lantern is loaded again in the background.
2. **No duplicates, no flash.** `warm.sh` does nothing if Lantern is already running. If this TV turns out to open Lantern in front when asked to load it quietly, `warm.sh` puts the previous app back, writes a `no-preload` flag and stops trying.
3. **One Home path.** Lantern reads the TV's Home app setting. If it is Lantern, the Input Hook Home mapping is hidden and any existing one can be removed with one button; "Reopen Lantern when LG Home appears" is hidden too. If you make Lantern the Home app from inside Lantern, its Input Hook Home mapping is removed first.
4. **Cheap resume.** Shown again, Lantern only updates the clock, wallpaper and focus. Loaded in the background, it starts no timers.

## Install

```sh
ares-install -d tv com.infixremix.lantern_1.0.4_all.ipk
# or, on the TV:
luna-send -i -f luna://com.webos.appInstallService/dev/install '{"id":"com.infixremix.lantern","ipkUrl":"/tmp/com.infixremix.lantern_1.0.4_all.ipk","subscribe":true}'
```

Then open Lantern, go to Settings, Remote, and switch on **Instant Home**. Restart the TV fully (unplug it, or switch Quick Start+ off and power-cycle) so the start-up script runs.

## Test plan

Run `tools/diagnose.sh` on the TV before and after (it changes nothing):

```sh
scp -O tools/diagnose.sh root@TV_IP:/tmp/
ssh root@TV_IP 'sh /tmp/diagnose.sh' > lantern-report.txt
```

| Test | Do | Pass if |
| --- | --- | --- |
| Cold boot | Full restart, wait 30 seconds on Live TV or an app, press Home | Lantern appears with no cover; `running` listed Lantern before Home was pressed |
| Home press | From Netflix or any app, press Home | Lantern appears at once; only Lantern is in front (`getForegroundAppInfo`); LG Home does not appear |
| After the TV closes it | Open two heavy apps, wait a minute, press Home | Lantern was loaded again (`running`) and opens without the cover |
| Standby wake | Standby for a minute, wake | Expected to still show the cover once, because the TV closes apps at standby |
| Double Home | With Lantern as the TV's Home app, check `keybinds.json` | No Home (773) entry pointing at Lantern |

Useful commands on the TV:

```sh
luna-send -n 1 luna://com.webos.applicationManager/getForegroundAppInfo '{}'
luna-send -n 1 luna://com.webos.applicationManager/running '{}'
ls /var/lib/webosbrew/lantern/          # a file named no-preload means background loading is not supported
```

If LG Home still overlays Lantern with the Home app set to Lantern, try the other path: give Home back to LG Home in Settings, Remote, and map the Home button through LG Input Hook instead. Do not use both.

## Roll back

In Lantern: Settings, Reset, **Restore TV defaults**. Or by hand over SSH:

```sh
for f in /tmp/lantern-home.pid /tmp/lantern-warm.pid; do p=$(cat $f 2>/dev/null); [ -n "$p" ] && { pkill -P $p; kill $p; }; rm -f $f; done
rm -f /var/lib/webosbrew/init.d/55-lantern
rm -rf /var/lib/webosbrew/lantern
# give Home back to LG Home, keeping the TV's other defaultApps entries: read them first
luna-send -n 1 luna://com.webos.settingsservice/getSystemSettings '{"category":"general","keys":["defaultApps"]}'
# then write the same object back with "home":"com.webos.app.home"
```

Nothing here touches a system partition: the scripts live under `/var/lib/webosbrew`, and the Home app is an ordinary TV setting.
