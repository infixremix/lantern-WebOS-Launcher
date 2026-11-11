#!/bin/sh
# Lantern diagnostics. Read-only: it changes nothing on the TV.
# Copy to the TV and run as root:   sh /tmp/diagnose.sh > /tmp/lantern-report.txt
ID=${1:-com.infixremix.lantern}
APP=/media/developer/apps/usr/palm/applications/$ID
SAM=luna://com.webos.applicationManager
SET=luna://com.webos.settingsservice
say() { echo; echo "== $1"; }
q() { luna-send -n 1 "$1" "$2" 2>&1; echo; }

say "TV"
grep -E '"(webos_release|webos_manufacturing_version|core_os_release)"' /var/run/nyx/os_info.json 2>/dev/null
grep -E '"(product_id|device_name)"' /var/run/nyx/device_info.json 2>/dev/null
awk '/^MemTotal|^MemAvailable|^MemFree/{print $1, $2, $3}' /proc/meminfo

say "Lantern launch flags in appinfo.json"
grep -E '"(id|version|noSplashOnLaunch|spinnerOnLaunch|supportGIP)"' "$APP/appinfo.json" 2>/dev/null || echo "appinfo.json not found at $APP"

say "Which app Home opens, and where the TV starts"
q $SET/getSystemSettings '{"category":"general","keys":["defaultApps"]}'
q $SET/getSystemSettings '{"category":"general","keys":["lastInputApp"]}'
q $SET/getSystemSettings '{"category":"general","keys":["homeAutoLaunch"]}'

say "Apps the TV keeps loaded through standby"
q luna://com.webos.service.config/getConfigs '{"configNames":["com.webos.applicationManager.keepAliveApps"]}'

say "Running now / in front now"
q $SAM/running '{}'
q $SAM/getForegroundAppInfo '{}'

say "Lantern's files outside its own folder"
ls -la /var/lib/webosbrew/init.d/ 2>/dev/null
ls -la /var/lib/webosbrew/lantern/ 2>/dev/null
[ -f /var/lib/webosbrew/lantern/no-preload ] && echo "no-preload flag is set: this TV opened Lantern in front when asked to load it in the background"
for f in /tmp/lantern-home.pid /tmp/lantern-warm.pid; do [ -f "$f" ] && echo "$f: $(cat $f) $(kill -0 $(cat $f) 2>/dev/null && echo running || echo stopped)"; done

say "LG Input Hook key file (a Home entry here plus Lantern as the TV's Home app means two Home paths)"
cat /home/root/.config/lginputhook/keybinds.json 2>/dev/null || echo "none"

say "Last launches in the system log (cover, splash, Home, Lantern)"
for L in /var/log/messages /tmp/var/log/messages; do
  [ -f "$L" ] && grep -E "cpcover|app\.splash|NL_HOME_SHOWN|NL_APP_LAUNCH_BEGIN|NL_APP_LAUNCH_END|$ID" "$L" | tail -n 60
done
