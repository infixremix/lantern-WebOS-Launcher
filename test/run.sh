#!/bin/sh
# Runs Lantern in headless Chrome against a fake TV (test/fake-tv.js) while a
# scripted remote (test/remote-script.js) presses buttons, then prints the result.
#   sh test/run.sh                 run every check
#   sh test/run.sh home,bottom     run one scenario and print its raw result
#   sh test/run.sh tune shot       save a screenshot to /tmp/lantern-test/<scenario>.png
CHROME=${CHROME:-google-chrome}
HERE=$(cd "$(dirname "$0")/.." && pwd)
T=/tmp/lantern-test
rm -rf "$T" && mkdir -p "$T" && cp -r "$HERE/app/." "$T/" && cp "$HERE/test/fake-tv.js" "$HERE/test/remote-script.js" "$T/"
sed -i 's#<script src="app.js"></script>#<script src="fake-tv.js"></script><script src="app.js"></script><script src="remote-script.js"></script>#' "$T/index.html"
echo '*{-webkit-transition:none !important;transition:none !important}' >> "$T/style.css"
FLAGS="--headless=new --no-sandbox --disable-gpu --allow-file-access-from-files"
result() { $CHROME $FLAGS --user-data-dir="$T/p-$(echo "$1" | tr ',' '_')" --virtual-time-budget="${2:-26000}" --dump-dom "file://$T/index.html#$1" 2>/dev/null | grep -o '<title>.*</title>' | sed 's/&quot;/"/g;s/&amp;/\&/g;s/&gt;/>/g;s/&lt;/</g;s/<title>DONE //;s/<\/title>//'; }
if [ -n "$1" ] && [ "$2" = shot ]; then
  $CHROME $FLAGS --user-data-dir="$T/s" --window-size=1920,1080 --virtual-time-budget=26000 --screenshot="$T/$(echo "$1" | tr ',' '_').png" "file://$T/index.html#$1" >/dev/null 2>&1; echo "saved $T/$(echo "$1" | tr ',' '_').png"; exit
fi
if [ -n "$1" ]; then result "$1"; exit; fi
fail=0
node -e "var s=require('fs').readFileSync('$HERE/app/app.js','utf8');eval(s.slice(s.indexOf('  function sunCalc('),s.indexOf('  function sunTimes(')));var t=sunCalc(51.45,-2.59,new Date(Date.UTC(2026,10,11,12)));var r=t.rise.toISOString().slice(11,16),e=t.set.toISOString().slice(11,16);if(r<'07:15'||r>'07:27'||e<'16:22'||e>'16:34'||sunCalc(69.65,18.96,new Date(Date.UTC(2026,11,21,12)))!==null){console.log('FAIL  sunrise maths',r,e);process.exit(1)}console.log('ok    sunrise maths ('+r+' / '+e+' UTC, Bristol 11 Nov)')" || fail=1
check() { # scenario, budget, python expression over d
  out=$(result "$1" "$2")
  if printf '%s' "$out" | python3 -c "
import sys, json
d = json.loads(sys.stdin.read())
assert not d.get('errs'), d.get('errs')
assert not d.get('miss'), d.get('miss')
assert $3
" 2>/tmp/lantern-test/err; then echo "ok    $1"; else echo "FAIL  $1"; cat /tmp/lantern-test/err | tail -2; fail=1; fi
}
KB0='{"1086":{"action":"launch","id":"com.other.app"}}'
check home 12000 "d['focus'].endswith('YouTube') and 'calm' in d['cls'] and 'menu-open' not in d['cls'] and 'walls/s-' in d['bg'] and d['memTotal'] == 658 and d['rowsDisplay'] == 'none'"
check home,bigmem 12000 "'walls/' in d['bg'] and 'walls/s-' not in d['bg']"
check home,classic 12000 "d['rowsDisplay'] == ''"
check home,nolghome 12000 "len(d['appIds']) == 20 and not [i for i in d['appIds'] if i in ('com.webos.app.home', 'com.webos.app.fullhome')] and 'Home' not in d['tiles']"
check down 12000 "'menu-open' in d['cls'] and d['focus'].startswith('Live TV') and d['rowsDisplay'] == 'block'"
check downup 12000 "'menu-open' not in d['cls'] and d['focus'].endswith('YouTube') and d['rowsDisplay'] == 'none'"
check downback 12000 "'menu-open' not in d['cls'] and d['focus'].endswith('YouTube')"
check alltile 12000 "'menu-open' in d['cls'] and d['focus'].startswith('Live TV')"
check standby 12000 "'quiet' in d['cls'] and 'q-dim' in d['cls']"
check standbywake 12000 "'quiet' not in d['cls'] and d['focus'].endswith('YouTube')"
check standbylong,standbyfull 14000 "'quiet' in d['cls'] and d['wcls'] == 'standby in' and 'walls/' in d['bg']"
check standbylong 14000 "'quiet' in d['cls'] and d['wcls'] == 'fade'"
check standbywake,standbyfull 14000 "'quiet' not in d['cls'] and d['wcls'] == ''"
check home,classic 12000 "'calm' not in d['cls'] and d['focus'].endswith('YouTube')"
check grid,classic 12000 "d['focus'] and not d['focus'].endswith('YouTube')"
check home,old31 12000 "d['calm'] is True and d['wall']['preset'] == 'Midnight' and d['idleBg'] == 'black'"
check firstrun,fresh 12000 "d['mode'] == 'show' and d['h1'] == 'Welcome to Lantern' and d['setupDone'] is False"
check setupwalk,fresh 40000 "d['setupDone'] is True and d['city'] == 'Bristol' and d['theme'] == 'dark' and d['wall']['preset'] == 'Dusk ridge' and d['dockCount'] == 6 and 'Kodi' in d['dock'][0] and d['binds'] == {} and d['keep'] and d['rewarm'] and d['boot'] == 'ready' and d['tvLast'] == 'com.infixremix.lantern' and d['input'] and d['mode'] == 'show' and d['h1'] == 'Restart the TV' and d['focus'].startswith('Restart now') and 'warm.sh' in d['sys'] and not d['reboot']"
check setuprestart,fresh 42000 "d['reboot'] and d['setupDone'] is True"
check setuplater,fresh 42000 "d['mode'] == '' and not d['reboot'] and d['setupDone'] is True"
check setupplain,fresh 30000 "d['mode'] == '' and d['setupDone'] is True and not d['reboot']"
check setupfocus,fresh 14000 "d['h1'] == 'Where you are' and d['city'] == 'Bristol' and d['focus'].startswith('Look it up again')"
check home,nopins 12000 "[n for n in d['dock']] == ['Plex', 'Kodi', 'Disney+', 'Apple TV', 'BBC iPlayer', 'All apps']"
check starton 24000 "d['tvLast'] == 'com.infixremix.lantern' and d['startApp'] == {'on': True, 'prev': 'com.webos.app.livetv'} and d['input'] and 'addDevice' in d['luna'][0]"
check starton,autoon 24000 "d['tvLast'] == 'com.infixremix.lantern' and d['tvAuto'] == 'off' and d['startApp']['auto'] == 'on'"
check startoff,autoon 30000 "d['tvLast'] == 'com.webos.app.livetv' and d['tvAuto'] == 'on' and d['startApp'] == {'on': False, 'prev': ''}"
check preall 26000 "sorted(d['tune']['preOff']) == ['com.fake.app1', 'com.webos.app.browser'] and sorted(d['pre']) == ['com.fake.app1', 'com.webos.app.browser'] and 'setPreloadPolicy' in d['sys']"
check starton,lastgone 24000 "d['tvLast'] == 'com.infixremix.lantern' and d['startApp']['prev'] == 'com.webos.app.livetv'"
check home,light 12000 "'light' in d['cls']"
check home,dark 12000 "'light' not in d['cls']"
check homeapp,homebound 24000 "d['tvHome'] == 'com.infixremix.lantern' and d['homeApp'] == {'on': True, 'prev': 'com.webos.app.home'} and not d.get('binds') and '773' not in d['kb'] and 'idleApp' in d['dflt']"
check homeback,homeset 24000 "d['tvHome'] == 'com.webos.app.home'"
check instant 24000 "d['keep'] and d['rewarm'] and d['boot'] == 'ready' and 'no-preload' in d['warm'] and 'preload' in d['warm'] and 'rewarm.sh &' in d['sys']"
check learnapp 22000 "d['binds'] == {'1037': {'t': 'app', 'id': 'com.fake.app17'}} and '\"1037\":{\"action\":\"launch\",\"id\":\"com.fake.app17\"}' in d['kb'] and '1086' in d['kb']"
check learnapp,fmt2 22000 "list(d['binds']) == ['1043']"
check learnundo,press1086 22000 "not d.get('binds') and d['kb'] == '$KB0'"
check learntimeout 70000 "not d.get('binds') and d['kb'] == '$KB0'"
check learnwait,nolog 12000 "d['h1'] == 'Cannot listen for buttons yet'"
check keep,homebound 20000 "d['keep'] and '\"773\":{\"action\":\"exec\",\"command\":\"sh/var/lib/webosbrew/lantern/open.sh\"}' in d['kb']"
check boot 20000 "d['boot'] == 'ready' and d['watch'] and 'sh /var/lib/webosbrew/lantern/warm.sh' in d['sys'] and 'home-watch.sh' in d['sys']"
check input 12000 "d['input'] and 'addDevice' in d['luna'][0]"
check tuneall 26000 "d['tune']['preOff'] == ['com.webos.app.browser'] and d['set']['option/livePlus'] == 'off' and d['set']['general/homePromotion'] is False and d['run'] == ['com.infixremix.lantern', 'com.webos.app.voice']"
check tuneundo 26000 "d['tune'] == {'orig': {}, 'preOff': []} and d['set']['option/livePlus'] == 'on' and not d['pre']"
check restorestart 30000 "d['tvLast'] == 'com.webos.app.livetv' and d['startApp'] == {'on': False, 'prev': ''} and not d['input']"
check restore,homebound 26000 "not d.get('binds') and d['kb'] == '$KB0' and not d['keep'] and d['boot'] == 'off' and not d['input'] and 'rm -f /var/lib/webosbrew/init.d/55-lantern' in d['sys']"
check tunerestore 26000 "d['tune'] == {'orig': {}, 'preOff': []} and d['set']['option/livePlus'] == 'on'"
exit $fail
