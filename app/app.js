/*
 * Lantern: a customisable home screen for webOS 4.x and later.
 * Plain ES5 on purpose (webOS 4.x runs Chromium 53). No framework, no build step.
 *
 * Root features go through Homebrew Channel's exec service. Everything Lantern
 * changes outside its own folder is undone by restoreTV():
 *   - /home/root/.config/lginputhook/keybinds.json   (only the entries Lantern added)
 *   - /var/lib/webosbrew/init.d/55-lantern           (start-up script)
 *   - /var/lib/webosbrew/lantern/                    (helper scripts)
 *   - the "Lantern" entry in the TV's input list
 *   - /tmp/lantern-*                                 (runtime files)
 *   - TV settings and preload choices changed by the Tune-up tab (originals are saved first)
 */
(function () {
  'use strict';

  var VERSION = '1.0.4';
  var HB = 'luna://org.webosbrew.hbchannel.service';
  var SAM = 'luna://com.webos.applicationManager';
  var EIM = 'luna://com.webos.service.eim';
  var SET = 'luna://com.webos.settingsservice';
  var PRE = 'luna://com.webos.service.preloadmanager';
  var STORE = 'lantern.v2';
  var KB = '/home/root/.config/lginputhook/keybinds.json';
  var INIT = '/var/lib/webosbrew/init.d/55-lantern';
  var HELP = '/var/lib/webosbrew/lantern';
  var PID = '/tmp/lantern-home.pid';
  var PID2 = '/tmp/lantern-warm.pid';
  var HOME_CODES = { 773: 1, 774: 1, 125: 1 };
  var HOME_CODE = '773';
  var LG_HOME = 'com.webos.app.home';
  // LG's own home screen and loading screens are never listed as apps: Lantern is the home screen
  var NOT_APPS = /^com\.webos\.app\.(home|fullhome|cpcover|splash)$/;
  // Linux input codes that are never remapped: Esc, digits, OK, arrows, power, volume, Back, channels
  var PROTECTED = { 1: 'Exit key', 28: 'OK', 352: 'OK', 103: 'Up', 105: 'Left', 106: 'Right', 108: 'Down',
                    114: 'Volume down', 115: 'Volume up', 116: 'Power', 158: 'Back', 412: 'Back', 402: 'Channel up', 403: 'Channel down',
                    2: '1', 3: '2', 4: '3', 5: '4', 6: '5', 7: '6', 8: '7', 9: '8', 10: '9', 11: '0' };
  var KEYNAMES = { 773: 'Home', 774: 'Home', 125: 'Home', 174: 'Exit', 113: 'Mute', 139: 'Settings', 358: 'Info', 365: 'Guide',
                   398: 'Red', 399: 'Green', 400: 'Yellow', 401: 'Blue', 1037: 'Netflix', 1043: 'LG Channels', 1086: 'Alexa', 1038: 'Dot' };

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, OK: 13, BACK: 461, ESC: 27,
              RED: 403, GREEN: 404, YELLOW: 405, BLUE: 406 };
  var INPUTS = [
    { id: 'com.webos.app.livetv', title: 'Live TV', src: 'tv://', type: 'service/webos-broadcast' },
    { id: 'com.webos.app.hdmi1', title: 'HDMI 1', src: 'ext://hdmi:1', type: 'service/webos-external' },
    { id: 'com.webos.app.hdmi2', title: 'HDMI 2', src: 'ext://hdmi:2', type: 'service/webos-external' },
    { id: 'com.webos.app.hdmi3', title: 'HDMI 3', src: 'ext://hdmi:3', type: 'service/webos-external' },
    { id: 'com.webos.app.hdmi4', title: 'HDMI 4', src: 'ext://hdmi:4', type: 'service/webos-external' }
  ];
  var ACCENTS = [['White', '#f5f5f7'], ['Blue', '#0a84ff'], ['Teal', '#64d2ff'], ['Green', '#30d158'],
                 ['Yellow', '#ffd60a'], ['Orange', '#ff9f0a'], ['Pink', '#ff375f'], ['Purple', '#bf5af2']];
  var TILE_COLOURS = ['#1c1c1e', '#0a84ff', '#30d158', '#ff9f0a', '#ff375f', '#bf5af2', '#5e5ce6', '#64d2ff', '#ac8e68', '#8e8e93'];
  // built-in backgrounds: six bundled pictures, then plain and gradient ones
  var PICTURES = ['Morning ridge', 'Day ridge', 'Haze', 'Night ridge', 'Dusk ridge', 'Pine mist', 'Ember', 'Tide', 'Graphite'];
  var DAY_PICTURES = ['Morning ridge', 'Day ridge', 'Haze'];
  var WALLS = [
    ['Morning ridge', 'url("walls/morning.jpg")'], ['Day ridge', 'url("walls/day.jpg")'], ['Haze', 'url("walls/haze.jpg")'],
    ['Night ridge', 'url("walls/night.jpg")'], ['Dusk ridge', 'url("walls/dusk.jpg")'], ['Pine mist', 'url("walls/pine.jpg")'],
    ['Ember', 'url("walls/ember.jpg")'], ['Tide', 'url("walls/tide.jpg")'], ['Graphite', 'url("walls/graphite.jpg")'],
    ['Black', 'linear-gradient(#000, #000)'],
    ['Midnight', 'radial-gradient(ellipse at 20% 10%, #2b3a67 0%, rgba(43,58,103,0) 55%), radial-gradient(ellipse at 85% 90%, #4a2545 0%, rgba(74,37,69,0) 55%), linear-gradient(160deg, #0b1026 0%, #05060d 100%)'],
    ['Aurora', 'radial-gradient(ellipse at 15% 85%, #0f9d8a 0%, rgba(15,157,138,0) 55%), radial-gradient(ellipse at 80% 15%, #5b3cc4 0%, rgba(91,60,196,0) 60%), linear-gradient(200deg, #0a1930 0%, #03101a 100%)'],
    ['Sunset', 'radial-gradient(ellipse at 50% 110%, #ffb347 0%, rgba(255,179,71,0) 55%), radial-gradient(ellipse at 10% 20%, #b3366b 0%, rgba(179,54,107,0) 60%), linear-gradient(180deg, #2a1445 0%, #6b2148 100%)'],
    ['Ocean', 'radial-gradient(ellipse at 75% 20%, #2aa7d8 0%, rgba(42,167,216,0) 60%), radial-gradient(ellipse at 20% 90%, #134e8a 0%, rgba(19,78,138,0) 60%), linear-gradient(180deg, #06223f 0%, #020b18 100%)'],
    ['Rose', 'radial-gradient(ellipse at 80% 25%, #e0779a 0%, rgba(224,119,154,0) 55%), radial-gradient(ellipse at 15% 80%, #7a4fc0 0%, rgba(122,79,192,0) 60%), linear-gradient(160deg, #2a1230 0%, #100714 100%)']
  ];
  var OLD_WALLS = ['Black', 'Graphite', 'Midnight', 'Aurora', 'Sunset', 'Ocean', 'Night ridge', 'Rose'];   // preset numbers saved by earlier builds
  var WEATHER = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers',
    85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var ZONES = [['London', 'Europe/London'], ['Paris', 'Europe/Paris'], ['New York', 'America/New_York'], ['Los Angeles', 'America/Los_Angeles'],
               ['Dubai', 'Asia/Dubai'], ['Mumbai', 'Asia/Kolkata'], ['Singapore', 'Asia/Singapore'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney']];
  var WIDGETS = { clock: 'Clock', weather: 'Weather', forecast: 'Three-day forecast', calendar: 'Calendar', world: 'World clock',
                  countdown: 'Countdown', note: 'Note', photo: 'Photo', tv: 'TV status' };
  // weather codes that count as dull: thick cloud, fog, rain, snow, storms
  var DULL = { 3: 1, 45: 1, 48: 1, 55: 1, 61: 1, 63: 1, 65: 1, 66: 1, 67: 1, 71: 1, 73: 1, 75: 1, 77: 1, 80: 1, 81: 1, 82: 1, 85: 1, 86: 1, 95: 1, 96: 1, 99: 1 };
  var TABS = ['Look', 'Dock', 'Wallpaper', 'Widgets', 'Apps', 'Clock', 'Standby', 'Remote', 'Tune-up', 'System', 'Reset'];
  // TV settings the Tune-up tab can switch off: [category, key]. Keys a TV does not have are skipped.
  var TUNE = [
    ['Ads and promotions', [['general', 'homePromotion'], ['general', 'sportsAlarm'], ['general', 'screenSaverAd'], ['general', 'aiNudge'], ['general', 'lifeAlarm'],
                            ['option', 'livePromotion'], ['option', 'webOSPromotionVideo'], ['option', 'promotionStreamer'], ['other', 'contentRecommendation']]],
    ['Tracking', [['general', 'adCookie'], ['option', 'livePlus'], ['option', 'watchedListCollection'], ['option', 'thirdPartyCookie'], ['option', 'hbbTvDeviceId'], ['option', 'dbgLogUpload']]],
    ['Effects and tips', [['general', 'homeEffect'], ['option', 'menuTransparency'], ['option', 'animationGuide'], ['option', 'baloonHelp'], ['option', 'helpOnSettings']]]
  ];

  // LOOK = everything "Reset Lantern's look" puts back
  var LOOK = { saveMem: 'auto', theme: 'auto', dullDark: false, nightWall: true, wallNight: 'Night ridge', idleNight: 'same',
               accent: 0, size: 'm', shape: 'square', names: 'focus', motion: true, showBar: true, showHints: true,
               calm: true, dockFill: 'recent', dockCount: 5, dockPos: 'bottom', dockAlign: 'center', dockSize: 'm', dockGlass: true, widgetAlign: 'left',
               wall: { kind: 'preset', preset: 'Morning ridge', src: '' }, wallEvery: 'day', dim: 0,
               sort: 'az', showInputs: true, preview: true,
               h24: true, showDate: true, showWeather: true, unitF: false,
               idle: 30, idleBg: 'wall', idleEvery: 300, idleClock: true, idleDate: true, idleWx: true, idleWidgets: false, idleDim: true };
  var BASE = { use: {}, last: {}, pins: [], hidden: [], names: {}, colors: {}, icons: {}, widgets: [], city: null,
               binds: {}, prev: {}, boot: 'off', watch: false, keep: false, rewarm: false, input: false, homeApp: { on: false, prev: '' }, startApp: { on: false, prev: '' }, iconReload: false, memTotal: 0, setupDone: false, tune: { orig: {}, preOff: [] }, apps: [], linked: false };
  var st = {};
  var cur = null, mode = null /* null | 'settings' | 'menu' | 'learn' */, tab = 0;
  var bridges = [], sys = null, tune = null, tvInfo = null, wx = null, tvStat = null, cityHits = [], wallHits = null, pickFor = null;
  var previewTimer = null, toastTimer = null, idleTimer = null, shiftTimer = null, okTimer = null, tickTimer = null, wxTimer = null;
  var slideTimer = null, slideAt = 0, night = false, dark = true, setupStep = 0, pendingSetup = false, wallFor = 'day', wallPreview = null;
  var wxAt = 0, wxSeq = 0, wxTries = 0, wxRetry = null, tvTries = 0, tvRetry = null;
  var WX_WAIT = [5, 10, 20, 40, 60, 120];      // seconds before each retry of a failed forecast request; after the last one it stops
  var menuTimer = null, setupMark = '', restartTimer = null;
  var iconOk = 0, iconFail = 0, pendingReload = false, ipNote = '';
  var quiet = false, okDown = false, okHeld = false, lastRefresh = 0, lastDay = -1, wallShown = '', selfLaunchAt = 0;
  var learn = null;

  function $(id) { return document.getElementById(id); }
  var $rows = $('rows'), $dock = $('dock'), $widgets = $('widgets'), $sheet = $('sheet'), $overlay = $('overlay'), $sink = $('keysink');
  var $preview = $('preview'), $toast = $('toast'), $html = document.documentElement;

  /* ---------- helpers ---------- */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text != null) { n.appendChild(document.createTextNode(text)); }
    return n;
  }
  function clear(n) { while (n.firstChild) { n.removeChild(n.firstChild); } }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }
  function trim(s) { return String(s == null ? '' : s).replace(/^\s+|\s+$/g, ''); }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(st)); } catch (e) {} }
  function defaults() { var o = copy(BASE), k; for (k in LOOK) { o[k] = copy(LOOK[k]); } return o; }
  function load() {
    var s = null, k, c;
    st = defaults();
    try { s = JSON.parse(localStorage.getItem(STORE) || localStorage.getItem('lantern.v1')); } catch (e) {}
    if (s && typeof s === 'object') { for (k in st) { if (s.hasOwnProperty(k) && s[k] !== undefined) { st[k] = s[k]; } } }
    if (!ACCENTS[st.accent]) { st.accent = 0; }
    if (!st.wall || !st.wall.kind) { st.wall = copy(LOOK.wall); }
    if (typeof st.wall.preset === 'number') { st.wall.preset = OLD_WALLS[st.wall.preset] || 'Black'; }
    if (s && typeof s === 'object') {            // settings saved by earlier builds
      if (s.drawer !== undefined && s.calm === undefined) { st.calm = !!s.drawer; }
      if (s.idleStyle === 'black') { st.idleBg = 'black'; } else if (s.idleStyle === 'wall') { st.idleClock = false; st.idleDate = false; st.idleWx = false; }
    }
    if (st.boot === true) { st.boot = 'open'; } else if (st.boot !== 'open' && st.boot !== 'ready') { st.boot = 'off'; }
    for (c in st.binds) { if (typeof st.binds[c] === 'string') { st.binds[c] = { t: 'app', id: st.binds[c] }; } }   // from earlier builds
    if (!(st.widgets instanceof Array)) { st.widgets = []; }
    st.apps = (st.apps || []).filter(function (a) { return a && !NOT_APPS.test(a.id); });      // also drop them from a saved list
    st.pins = (st.pins || []).filter(function (id) { return !NOT_APPS.test(id); });
    if (!st.homeApp || typeof st.homeApp !== 'object') { st.homeApp = { on: false, prev: '' }; }
    if (!st.startApp || typeof st.startApp !== 'object') { st.startApp = { on: false, prev: '' }; }
    if (!st.tune || !st.tune.orig || !(st.tune.preOff instanceof Array)) { st.tune = { orig: {}, preOff: [] }; }
  }
  function toast(msg, ms) {
    $toast.textContent = msg; $toast.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { $toast.className = ''; }, ms || 3500);
  }
  function selfId() { try { return window.PalmSystem.identifier.split(' ')[0]; } catch (e) { return 'com.infixremix.lantern'; } }
  function appRoot() { return decodeURIComponent(location.pathname).replace(/\/[^\/]*$/, ''); }
  function safeId(id) { return /^[\w.\-]+$/.test(id); }
  function has(list, v) { return list.indexOf(v) >= 0; }
  function title(a) { return st.names[a.id] || a.title; }
  function appById(id) {
    var i;
    for (i = 0; i < st.apps.length; i++) { if (st.apps[i].id === id) { return st.apps[i]; } }
    for (i = 0; i < INPUTS.length; i++) { if (INPUTS[i].id === id) { return INPUTS[i]; } }
    return null;
  }
  function labelFor(id) {
    if (id === selfId()) { return 'Lantern'; }
    if (id === LG_HOME) { return 'LG Home'; }
    var a = appById(id), short;
    if (a) { return title(a); }
    short = /^com\.webos\.app\.([\w\-]+)$/.exec(id);          // a system app that is not in the app list
    return short ? short[1].charAt(0).toUpperCase() + short[1].slice(1) : id;
  }
  function closest(n, cls) {
    while (n && n !== document.body) { if (n.className && (' ' + n.className + ' ').indexOf(' ' + cls + ' ') >= 0) { return n; } n = n.parentNode; }
    return null;
  }

  /* ---------- Luna bus ---------- */

  function luna(uri, params, cb) {
    var Bridge = window.PalmServiceBridge || window.WebOSServiceBridge, done = false;
    function finish(r) { if (!done) { done = true; if (cb) { cb(r); } } }
    if (!Bridge) { setTimeout(function () { finish({ returnValue: false, errorText: 'no service bridge' }); }, 0); return; }
    var b = new Bridge();
    bridges.push(b);
    b.onservicecallback = function (msg) {
      var r, i = bridges.indexOf(b);
      try { r = JSON.parse(msg); } catch (e) { r = { returnValue: false }; }
      if (i >= 0) { bridges.splice(i, 1); }
      finish(r);
    };
    try { b.call(uri, JSON.stringify(params || {})); } catch (e) { finish({ returnValue: false, errorText: String(e) }); }
    setTimeout(function () { finish({ returnValue: false, errorText: 'timed out' }); }, 15000);
  }
  // shell command as root through Homebrew Channel
  function exec(cmd, cb) {
    luna(HB + '/exec', { command: cmd }, function (r) {
      var bad = r.returnValue === false || r.error;
      if (cb) { cb(bad ? (r.errorText || r.error || 'failed') : null, r.stdoutString || ''); }
    });
  }

  /* ---------- apps ---------- */

  function tidy(a, folder) {
    if (!a || !a.id) { return null; }
    var f = String(a.folderPath || folder || '');
    var ic = String(a.largeIcon || a.icon || '');
    if (f && ic.indexOf(f + '/') === 0) { ic = ic.slice(f.length + 1); }
    else if (ic.charAt(0) === '/') { ic = ''; }
    return { id: String(a.id), title: String(a.title || a.id), folderPath: f, icon: ic,
             color: /^#[0-9a-f]{6}$/i.test(a.iconColor || '') ? a.iconColor : '', visible: a.visible !== false };
  }
  var SCAN = 'for d in /media/cryptofs/apps/usr/palm/applications /media/developer/apps/usr/palm/applications /usr/palm/applications; do ' +
             'for f in $d/*/appinfo.json; do [ -f "$f" ] && { echo "@@@$f"; cat "$f"; echo; }; done; done';

  function fetchApps(cb) {
    function done(list) {
      var me = selfId(), seen = {}, out = [], inputIds = INPUTS.map(function (i) { return i.id; });
      list.forEach(function (a) {
        if (!a || !a.visible || a.id === me || seen[a.id] || has(inputIds, a.id) || !safeId(a.id) || NOT_APPS.test(a.id)) { return; }
        seen[a.id] = 1; out.push({ id: a.id, title: a.title, folderPath: a.folderPath, icon: a.icon, color: a.color });
      });
      out.sort(function (x, y) { return x.title.toLowerCase() < y.title.toLowerCase() ? -1 : 1; });
      cb(out);
    }
    exec("luna-send -n 1 " + SAM + "/listApps '{}'", function (err, out) {
      var r = null;
      try { r = JSON.parse(out); } catch (e) {}
      if (r && r.apps && r.apps.length) { return done(r.apps.map(function (a) { return tidy(a); })); }
      exec(SCAN, function (err2, out2) {
        var list = [];
        out2.split(/^@@@/m).forEach(function (chunk) {
          var nl = chunk.indexOf('\n');
          if (nl < 0) { return; }
          try { list.push(tidy(JSON.parse(chunk.slice(nl + 1)), chunk.slice(0, nl).replace(/\/appinfo\.json\s*$/, ''))); } catch (e) {}
        });
        if (list.length) { return done(list); }
        luna(SAM + '/listApps', {}, function (r3) { done((r3.apps || []).map(function (a) { return tidy(a); })); });
      });
    });
  }
  // Icons live in other apps' folders, which WebAppMgr may refuse to load, so
  // as root we symlink each app folder into ours and load icons from there.
  function linkIcons(apps, cb) {
    var dir = appRoot() + '/apps', cmd = "mkdir -p '" + dir + "'";
    apps.forEach(function (a) {
      if (a.icon && /^[\w.\-\/]+$/.test(a.folderPath)) { cmd += "; ln -sfn '" + a.folderPath + "' '" + dir + '/' + a.id + "'"; }
    });
    exec(cmd, function (err) { cb(!err); });
  }
  function refreshApps() {
    lastRefresh = Date.now();
    fetchApps(function (list) {
      if (!list.length) { return; }
      var changed = JSON.stringify(list) !== JSON.stringify(st.apps), firstRun = !st.apps.length;
      st.apps = list;
      linkIcons(list, function (ok) {
        var first = ok && !st.linked;
        st.linked = ok; save();
        if (changed || first) { iconOk = 0; iconFail = 0; render(); if (firstRun && !mode) { focusFirst(); } }
        if (mode === 'setup') { drawSetup(true); }       // the dock step needs the list
        if (first) { setTimeout(checkIcons, 3000); }
      });
    });
  }
  // On a first install the TV can refuse the freshly linked icons until the page is loaded again.
  // If none of them arrived, reload once (after setup, if that is open).
  function checkIcons() {
    if (iconOk > 0) { if (st.iconReload) { st.iconReload = false; save(); } return; }
    if (!iconFail || st.iconReload || !window.PalmSystem) { return; }
    if (mode) { pendingReload = true; return; }
    st.iconReload = true; save();
    location.reload();
  }
  function launch(id) {
    if (!safeId(id)) { return; }
    st.use[id] = (st.use[id] || 0) + 1; st.last[id] = Date.now(); save();
    hidePreview();
    luna(SAM + '/launch', { id: id }, function (r) {
      if (r.returnValue !== false) { return; }
      exec("luna-send -n 1 " + SAM + "/launch '{\"id\":\"" + id + "\"}'", function (err) {
        if (err) { toast('Could not open that app.'); }
      });
    });
  }

  /* ---------- day and night ---------- */

  // Sunrise and sunset for a place and day, from the standard solar position formulas (as used by SunCalc).
  function sunCalc(lat, lon, date) {
    var rad = Math.PI / 180, dayMs = 86400000, J1970 = 2440588, J2000 = 2451545, J0 = 0.0009;
    var lw = rad * -lon, phi = rad * lat, d = date.valueOf() / dayMs - 0.5 + J1970 - J2000;
    var n = Math.round(d - J0 - lw / (2 * Math.PI));
    function transit(Ht) { return J0 + (Ht + lw) / (2 * Math.PI) + n; }
    function solar(ds) {
      var M = rad * (357.5291 + 0.98560028 * ds);
      var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
      var L = M + C + rad * 102.9372 + Math.PI;
      return { J: J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L), dec: Math.asin(Math.sin(L) * Math.sin(rad * 23.4397)) };
    }
    var noon = solar(transit(0));
    var w = Math.acos((Math.sin(rad * -0.833) - Math.sin(phi) * Math.sin(noon.dec)) / (Math.cos(phi) * Math.cos(noon.dec)));
    var set = solar(transit(w)).J;
    function toDate(j) { return new Date((j + 0.5 - J1970) * dayMs); }
    if (isNaN(w)) { return null; }                 // polar day or night
    return { rise: toDate(noon.J - (set - noon.J)), set: toDate(set) };
  }
  function sunTimes(now) {
    var t = null, r, s;
    if (wx && wx.rise && wx.set && wx.day === now.toDateString()) { return { rise: wx.rise, set: wx.set }; }   // from the forecast
    if (st.city) { t = sunCalc(st.city.lat, st.city.lon, new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)); }
    if (t) { return t; }
    r = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7); s = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19);
    return { rise: r, set: s };                    // no place chosen: 7 in the morning to 7 at night
  }
  // true when the look changed
  function updateNight() {
    var now = new Date(), t = sunTimes(now), n = now < t.rise || now >= t.set, d;
    if (!n && st.dullDark && wx && DULL[wx.code]) { n = true; }
    d = st.theme === 'dark' || (st.theme === 'auto' && n);
    if (n === night && d === dark) { return false; }
    night = n; dark = d;
    return true;
  }
  function curWall() {                 // the wallpaper for this time of day
    var n = wallPreview ? wallPreview === 'night' : night;      // while choosing, show the one being chosen
    return st.nightWall && n ? { kind: 'preset', preset: st.wallNight, src: '' } : st.wall;
  }

  /* ---------- look ---------- */

  function px(name, v) { $html.style.setProperty(name, v + 'px'); }
  // tw = space a tile takes in its row, cw x ch = the tile itself
  function tileDims(size, square, dock) {
    var cols, tw, cw;
    if (dock) {
      cw = square ? { s: 96, m: 120, l: 150 }[size] || 120 : { s: 190, m: 230, l: 270 }[size] || 230;
      tw = cw + 30;
      return { cols: Math.max(1, Math.floor(1560 / tw)), tw: tw, cw: cw, ch: square ? cw : Math.round(cw * 9 / 16) };
    }
    cols = square ? { s: 10, m: 8, l: 7 }[size] || 8 : { s: 7, m: 6, l: 5 }[size] || 6;
    tw = Math.floor(1768 / cols);
    cw = square ? { s: 128, m: 150, l: 176 }[size] || 150 : tw - 28;
    return { cols: cols, tw: tw, cw: cw, ch: square ? cw : Math.round(cw * 9 / 16) };
  }
  function menuOpen() { return st.calm && !mode && inRows(cur); }
  function applyLook() {
    var sq = st.shape === 'square', g = tileDims(st.size, sq), d = tileDims(st.dockSize, sq, true);
    updateNight();
    $html.style.setProperty('--accent', !dark && st.accent === 0 ? '#1c1c1e' : ACCENTS[st.accent][1]);
    px('--tw', g.tw); px('--cw', g.cw); px('--ch', g.ch);
    px('--dtw', d.tw); px('--dcw', d.cw); px('--dch', d.ch);
    px('--gp', Math.floor((1920 - g.cols * g.tw) / 2));
    // The apps menu is taken out of the page while it is closed. Left in place (only moved and made transparent)
    // it kept a full-screen graphics layer alive all the time, and this TV has under 1 MB of that memory to spare.
    clearTimeout(menuTimer);
    if (!st.calm) { $rows.style.display = ''; }
    else if (menuOpen()) { if ($rows.style.display !== 'block') { $rows.style.display = 'block'; void $rows.offsetWidth; } }
    else if ($rows.style.display === 'block') { menuTimer = setTimeout(function () { if (!menuOpen()) { $rows.style.display = 'none'; } }, 260); }
    else { $rows.style.display = 'none'; }
    document.body.className = [
      dark ? '' : 'light', st.names === 'always' ? 'names-always' : '', st.motion ? '' : 'no-motion', sq ? 'shape-square' : '',
      st.showBar ? '' : 'no-bar', st.showHints ? '' : 'no-hints',
      st.calm ? 'calm' : '', menuOpen() ? 'menu-open' : '',
      st.dockPos === 'bottom' ? 'dock-bottom' : '', st.dockAlign === 'center' ? 'dock-center' : '', st.dockGlass ? 'dock-glass' : '',
      st.widgetAlign === 'center' ? 'wd-center' : '',
      quiet ? 'quiet' + (st.idleBg === 'black' || (night && st.idleNight === 'black') ? ' q-black' : '') + (st.idleDim ? ' q-dim' : '') : ''
    ].join(' ');
    $('dim').style.opacity = quiet && st.idleDim ? '' : String(st.dim / 100);
    $('date').style.display = st.showDate ? '' : 'none';
    $('weather').style.display = st.showWeather ? '' : 'none';
    $('locktime').style.display = st.idleClock ? '' : 'none';
    $('lockdate').style.display = st.idleDate ? '' : 'none';
    $('lockwx').style.display = st.idleWx ? '' : 'none';
    if (!quiet || st.idleBg === 'wall' || st.idleBg === 'black') { showWall(); }
    return { grid: g.cols, dock: d.cols };
  }

  /* ---------- wallpaper ---------- */

  function onlineSeed() {
    var d = new Date(), day = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (st.wallEvery === 'hour') { return day + '-' + d.getHours(); }
    if (st.wallEvery === 'open') { return String(st.wall.seed || day); }
    return day;
  }
  function wallUrl() {
    var w = curWall();
    if (w.kind === 'online') { return 'https://picsum.photos/seed/lantern-' + encodeURIComponent(onlineSeed()) + '/' + photoSize(); }
    return w.kind !== 'preset' && w.src ? w.src : '';
  }
  // Pictures are loaded off screen first and only swapped in once they have
  // arrived, so a slow or failed download never leaves a blank background.
  function showWall() {
    var url = wallUrl(), want = (url || 'preset:' + curWall().preset) + (lowMem() ? ':s' : ''), img;
    if (document.hidden) { return; }                // nothing to show: do not hold a picture in memory
    if (want === wallShown) { return; }
    if (!url) { wallShown = want; $('wall').style.backgroundImage = sized(wallCss(curWall().preset)); return; }
    if (!wallShown) { $('wall').style.backgroundImage = wallCss('Black'); }
    img = new Image();
    img.onload = function () {
      if (wallUrl() !== url) { return; }
      wallShown = want;
      $('wall').style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
    };
    img.onerror = function () { if (wallUrl() === url && mode === 'settings') { toast('That picture could not be loaded.'); } };
    img.src = url;
  }
  // On a TV with little memory a 1280x720 picture is used instead of 1920x1080: under half the memory, in the app and on the graphics side.
  function lowMem() { return st.saveMem === 'on' || (st.saveMem === 'auto' && st.memTotal > 0 && st.memTotal < 1000); }
  function sized(css) { return lowMem() ? css.replace('url("walls/', 'url("walls/s-') : css; }
  function photoSize() { return lowMem() ? '1280/720' : '1920/1080'; }
  function readMemory() {
    exec("awk '/^MemTotal/{print $2}' /proc/meminfo", function (err, out) {
      var mb = Math.round(parseInt(out, 10) / 1024), was = lowMem();
      if (!mb || mb === st.memTotal) { return; }
      st.memTotal = mb; save();
      if (lowMem() !== was) { wallShown = ''; showWall(); }
    });
  }
  function wallCss(name) {
    var i;
    for (i = 0; i < WALLS.length; i++) { if (WALLS[i][0] === name) { return WALLS[i][1]; } }
    return WALLS[0][1];
  }
  // Standby pictures: load the next one off screen, then fade it in.
  function nextSlide() {
    var url, img;
    if (!quiet) { return; }
    if (st.idleBg === 'online') { url = 'https://picsum.photos/seed/lantern-s' + Date.now() + '/' + photoSize(); }
    else if (st.idleBg === 'pictures') {
      // daytime pictures by day, the darker ones at night
      var pool = PICTURES.filter(function (n) { return (DAY_PICTURES.indexOf(n) >= 0) !== night; });
      slideAt = (slideAt + 1) % pool.length; url = /"(.*)"/.exec(sized(wallCss(pool[slideAt])))[1];
    }
    else { return; }
    img = new Image();
    img.onload = function () {
      if (!quiet) { return; }
      $('wall').style.opacity = '0';
      setTimeout(function () {
        if (quiet) { $('wall').style.backgroundImage = 'url("' + url + '")'; wallShown = 'slide'; }
        $('wall').style.opacity = '';
      }, 650);
    };
    img.src = url;
  }
  function releaseWall() {            // while another app is in front, give the picture's memory back
    if (wallUrl() || /^url/.test(wallCss(curWall().preset))) { $('wall').style.backgroundImage = 'none'; wallShown = ''; }
  }

  /* ---------- home screen ---------- */

  function hashColour(id) {
    var h = 0, i;
    for (i = 0; i < id.length; i++) { h = (h * 31 + id.charCodeAt(i)) % 9973; }
    return TILE_COLOURS[1 + h % (TILE_COLOURS.length - 1)];
  }
  function tile(item, kind) {
    var t = el('div', 't' + (kind === 'in' ? ' in' : '') + (kind === 'top' || kind === 'all' ? ' d' : '') + (kind === 'all' ? ' all' : ''));
    var name = title(item), src;
    var card = el('div', 'card', kind === 'in' ? name : kind === 'all' ? null : name.charAt(0).toUpperCase());
    if (kind === 'all') { card.appendChild(el('div', 'dots')); }
    else if (kind !== 'in') {
      card.style.background = st.colors[item.id] || item.color || hashColour(item.id);
      src = st.icons[item.id] || (item.icon && st.linked ? 'apps/' + item.id + '/' + item.icon : '');
      if (src) {
        var img = new Image();
        img.onload = function () { iconOk++; clear(card); card.appendChild(img); };
        img.onerror = function () { iconFail++; };
        img.src = src;
      }
    }
    t.appendChild(card);
    t.appendChild(el('div', 'nm', name));
    t.__item = item; t.__kind = kind;
    return t;
  }
  var ALL_APPS = { id: '__all', title: 'All apps' };
  function isApp(n) { return !!n && !!n.__item && (n.__kind === 'top' || n.__kind === 'app'); }
  function section(host, heading, items, kind, cols, panel) {
    var i, r, into = host;
    if (!items.length) { return; }
    if (heading) { host.appendChild(el('h2', null, heading)); }
    if (panel) { into = el('div', 'dockp'); host.appendChild(into); }
    for (i = 0; i < items.length; i++) {
      if (i % cols === 0) { r = el('div', 'row'); into.appendChild(r); }
      r.appendChild(tile(items[i], items[i] === ALL_APPS ? 'all' : kind));
    }
  }
  function render() {
    var keep = cur && cur.__item ? cur.__item.id : null, keepKind = cur ? cur.__kind : null;
    var pos = mode ? { r: 0, c: 0 } : position(), cols = applyLook(), byId = {}, shown, top, all, i;
    st.apps.forEach(function (a) { byId[a.id] = a; });
    shown = st.apps.filter(function (a) { return !has(st.hidden, a.id); });
    top = st.pins.filter(function (id) { return byId[id] && !has(st.hidden, id); }).map(function (id) { return byId[id]; });
    if (st.dockFill !== 'none') {       // top the dock up with recent or most-used apps, then A to Z, up to the chosen number
      shown.filter(function (a) { return !has(st.pins, a.id); }).sort(function (x, y) {
        var rx = st.last[x.id] || 0, ry = st.last[y.id] || 0, ux = st.use[x.id] || 0, uy = st.use[y.id] || 0;
        if (st.dockFill === 'recent' && rx !== ry) { return ry - rx; }
        if (ux !== uy) { return uy - ux; }
        return title(x).toLowerCase() < title(y).toLowerCase() ? -1 : 1;
      }).forEach(function (a) { if (top.length < st.dockCount) { top.push(a); } });
    }
    shown = shown.slice();
    if (st.sort === 'used') { shown.sort(function (x, y) { return (st.use[y.id] || 0) - (st.use[x.id] || 0); }); }
    else if (st.sort === 'recent') { shown.sort(function (x, y) { return (st.last[y.id] || 0) - (st.last[x.id] || 0); }); }
    else { shown.sort(function (x, y) { return title(x).toLowerCase() < title(y).toLowerCase() ? -1 : 1; }); }

    if (!mode) { cur = null; }
    clear($dock); clear($rows);
    if (st.calm) { top = top.concat([ALL_APPS]); }     // the last dock tile opens the apps menu
    section($dock, null, top, 'top', cols.dock, true);
    if (st.showInputs) { section($rows, 'Inputs', INPUTS, 'in', cols.grid); }
    section($rows, 'All apps', shown, 'app', cols.grid);
    if (!st.apps.length) {
      $rows.appendChild(el('h2', null, 'No apps found yet. The app list is read through Homebrew Channel: check it is installed and shows "Root status: ok".'));
    }
    if (mode) { return; }
    all = document.querySelectorAll('#dock .t, #rows .t');
    for (i = 0; keep && i < all.length; i++) {
      if (all[i].__item && all[i].__item.id === keep && all[i].__kind === keepKind) { return focus(all[i]); }
    }
    focusAt(pos.r, pos.c);
  }

  /* ---------- widgets ---------- */

  function fmtTime(d, zone) {
    var h, m;
    if (zone) {
      try { return d.toLocaleTimeString('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hour12: !st.h24 }); }
      catch (e) { return '--:--'; }
    }
    h = d.getHours(); m = d.getMinutes();
    if (!st.h24) { h = h % 12 || 12; }
    return (st.h24 && h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
  }
  function widgetSummary(w) {
    if (w.type === 'world') { return (ZONES[w.zone || 0] || ZONES[0])[0]; }
    if (w.type === 'countdown') { return (w.label || 'Event') + (w.date ? ', ' + w.date : ', no date yet'); }
    if (w.type === 'note') { return w.text || 'Empty'; }
    if (w.type === 'photo') { return w.url ? w.url.replace(/^https?:\/\//, '') : 'No picture yet'; }
    return '';
  }
  function drawWidgets() {
    clear($widgets);
    st.widgets.forEach(function (w) {
      var box = el('div', 'w'), k = el('div', 'k'), v = el('div', 'v'), s = el('div', 's'), extra;
      box.appendChild(k); box.appendChild(v); box.appendChild(s);
      if (w.type === 'clock') {
        box.__upd = function (d) { k.textContent = DAYS[d.getDay()]; v.textContent = fmtTime(d); s.textContent = d.getDate() + ' ' + MONTHS[d.getMonth()]; };
      } else if (w.type === 'world') {
        box.__upd = function (d) {
          var z = ZONES[w.zone || 0] || ZONES[0];
          k.textContent = z[0]; v.textContent = fmtTime(d, z[1]); s.textContent = '';
        };
      } else if (w.type === 'weather') {
        box.__upd = function () {
          k.textContent = st.city ? st.city.name : 'Weather';
          v.textContent = wx ? wx.temp + '°' : '--';
          s.textContent = wx ? wx.text + (wx.hi != null ? '   ' + wx.hi + '° / ' + wx.lo + '°' : '') : (st.city ? 'Waiting for the forecast' : 'Choose a place in Settings, Clock');
        };
      } else if (w.type === 'forecast') {
        box.className = 'w wide'; box.removeChild(v); box.removeChild(s);
        extra = el('div', 'days'); box.appendChild(extra);
        box.__upd = function () {
          var i, c;
          k.textContent = st.city ? st.city.name : 'Forecast';
          clear(extra);
          for (i = 0; wx && wx.days && i < 3 && i < wx.days.length; i++) {
            c = el('div'); c.appendChild(el('b', null, wx.days[i].hi + '° / ' + wx.days[i].lo + '°'));
            c.appendChild(document.createTextNode(wx.days[i].name)); c.appendChild(el('br')); c.appendChild(document.createTextNode(wx.days[i].text));
            extra.appendChild(c);
          }
          if (!extra.firstChild) { extra.appendChild(el('div', null, st.city ? 'Waiting for the forecast' : 'Choose a place in Settings, Clock')); }
        };
      } else if (w.type === 'calendar') {
        box.removeChild(v); box.removeChild(s);
        extra = el('div', 'cal'); box.appendChild(extra);
        box.__day = -1;
        box.__upd = function (d) {
          var first, n, i, c;
          if (box.__day === d.getDate()) { return; }
          box.__day = d.getDate();
          k.textContent = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
          clear(extra);
          first = (new Date(d.getFullYear(), d.getMonth(), 1).getDay() + 6) % 7;      // Monday first
          n = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          for (i = 0; i < first; i++) { extra.appendChild(el('i', null, '')); }
          for (i = 1; i <= n; i++) { c = el('i', i === d.getDate() ? 'now' : null, String(i)); extra.appendChild(c); }
        };
      } else if (w.type === 'countdown') {
        box.__upd = function (d) {
          var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w.date || ''), days;
          k.textContent = w.label || 'Countdown';
          if (!m) { v.textContent = '--'; s.textContent = 'Set a date in Settings, Widgets'; return; }
          days = Math.round((new Date(+m[1], +m[2] - 1, +m[3]).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86400000);
          v.textContent = String(Math.abs(days));
          s.textContent = days === 0 ? 'Today' : (Math.abs(days) === 1 ? 'day ' : 'days ') + (days > 0 ? 'to go' : 'ago');
        };
      } else if (w.type === 'note') {
        box.removeChild(v); box.removeChild(s);
        extra = el('div', 'note'); box.appendChild(extra);
        box.__upd = function () { k.textContent = 'Note'; extra.textContent = w.text || 'Write your note in Settings, Widgets'; };
      } else if (w.type === 'photo') {
        box.className = 'w wide photo'; clear(box);
        if (w.url) { box.style.backgroundImage = 'url("' + String(w.url).replace(/"/g, '%22') + '")'; }
        else { box.className = 'w wide'; box.appendChild(el('div', 'k', 'Photo')); box.appendChild(el('div', 's', 'Add a picture address in Settings, Widgets')); }
      } else if (w.type === 'tv') {
        box.__upd = function () {
          k.textContent = 'TV memory';
          v.textContent = tvStat ? tvStat.free + ' MB' : '--';
          s.textContent = tvStat ? 'free of ' + tvStat.total + ' MB   on for ' + tvStat.up : 'Needs Homebrew Channel with root';
        };
      }
      $widgets.appendChild(box);
    });
    updateWidgets();
    if (hasWidget('tv')) { tvStatus(); }
  }
  function hasWidget(type) { return st.widgets.some(function (w) { return w.type === type; }); }
  function updateWidgets() {
    var d = new Date(), n = $widgets.children, i;
    for (i = 0; i < n.length; i++) { if (n[i].__upd) { n[i].__upd(d); } }
  }
  function tvStatus() {
    clearTimeout(tvRetry);
    exec("awk '/^MemTotal|^MemFree|^MemAvailable|^Buffers|^Cached/{print $1 $2}' /proc/meminfo; echo up:$(cut -d. -f1 /proc/uptime)", function (err, out) {
      var m = {}, free, up;
      out.split('\n').forEach(function (l) { var p = l.split(':'); if (p.length === 2) { m[p[0]] = parseInt(p[1], 10); } });
      if (!m.MemTotal) {            // right after the TV starts, Homebrew Channel may not be answering yet: ask again shortly
        if (hasWidget('tv') && tvTries < 6) { tvTries += 1; tvRetry = setTimeout(tvStatus, 5000 * tvTries); }
        return;
      }
      tvTries = 0;
      free = m.MemAvailable || (m.MemFree || 0) + (m.Buffers || 0) + (m.Cached || 0);
      up = m.up || 0;
      tvStat = { total: Math.round(m.MemTotal / 1024), free: Math.round(free / 1024),
                 up: up >= 86400 ? Math.floor(up / 86400) + ' d' : up >= 3600 ? Math.floor(up / 3600) + ' h' : Math.floor(up / 60) + ' min' };
      updateWidgets();
    });
  }

  /* ---------- focus / navigation ---------- */

  function inRows(n) { return !!n && $rows.contains(n); }
  function sel() { return mode ? '.b' : '.t'; }
  function grid() {
    var out = [], i, a;
    function add(host) { var all = host.querySelectorAll('.row'); for (i = 0; i < all.length; i++) { if (all[i].querySelector(sel())) { out.push(all[i]); } } }
    if (mode) { add($sheet); return out; }
    if (st.dockPos === 'bottom') { add($rows); a = out.length; add($dock); out.__dockAt = a; }
    else { add($dock); out.__dockAt = 0; add($rows); }
    return out;
  }
  function position() {
    var g = grid(), r, c, items;
    for (r = 0; r < g.length; r++) {
      items = g[r].querySelectorAll(sel());
      for (c = 0; c < items.length; c++) { if (items[c] === cur) { return { r: r, c: c }; } }
    }
    return { r: -1, c: 0 };
  }
  function focusAt(r, c) {
    var g = grid(), items;
    if (!g.length) { return; }
    r = Math.max(0, Math.min(g.length - 1, r));
    items = g[r].querySelectorAll(sel());
    focus(items[Math.max(0, Math.min(items.length - 1, c))]);
  }
  function focusFirst() {             // the dock if it has anything, otherwise the first row
    var d = $dock.querySelector('.t');
    if (d) { focus(d); } else { focusAt(0, 0); }
  }
  function unfocus() { if (cur) { cur.className = cur.className.replace(/ ?\bfocus\b/, ''); } cur = null; }
  function focus(n) {
    var wasRows;
    if (!n || n === cur) { return; }
    wasRows = inRows(cur);
    unfocus();
    cur = n;
    n.className += ' focus';
    if (n.tagName === 'INPUT') { n.focus(); }
    else { try { if (document.activeElement && document.activeElement.blur) { document.activeElement.blur(); } $sink.focus(); } catch (e) {} }
    if (n.scrollIntoViewIfNeeded) { n.scrollIntoViewIfNeeded(true); }
    if (!mode) {
      schedulePreview(n);
      if (st.calm && wasRows !== inRows(n)) { applyLook(); }
    }
    if (mode === 'settings' && n.__tab !== undefined && n.__tab !== tab) { tab = n.__tab; markTabs(); drawBody(); enterTab(); }
  }
  function hostRows(host) {
    var all = host.querySelectorAll('.row'), out = [], i;
    for (i = 0; i < all.length; i++) { if (all[i].querySelector('.t')) { out.push(all[i]); } }
    return out;
  }
  function focusIn(rowEl, c) { var items = rowEl.querySelectorAll('.t'); focus(items[Math.max(0, Math.min(items.length - 1, c))]); }
  function openApps() {                // the full apps menu of the calm home screen
    var r = hostRows($rows);
    if (r.length) { $rows.scrollTop = 0; focusIn(r[0], 0); }
  }
  function move(dx, dy) {
    var p = position(), g, rowsCount, d, r, i;
    if (p.r < 0) { return mode ? focusAt(0, 0) : focusFirst(); }
    // going up into the settings tabs returns to the open tab instead of switching to another one
    if (mode === 'settings' && dy < 0 && p.r === 1 && $('tabs')) { return focus($('tabs').children[tab]); }
    if (!mode && st.calm && dy) {
      // calm home: Down from the dock opens the apps menu, Up from its first row closes it
      d = hostRows($dock); r = hostRows($rows);
      i = d.indexOf(closest(cur, 'row'));
      if (i >= 0) {
        if (dy < 0) { return i > 0 ? focusIn(d[i - 1], p.c) : null; }
        return i < d.length - 1 ? focusIn(d[i + 1], p.c) : openApps();
      }
      i = r.indexOf(closest(cur, 'row'));
      if (dy < 0) { return i > 0 ? focusIn(r[i - 1], p.c) : focusFirst(); }
      return i < r.length - 1 ? focusIn(r[i + 1], p.c) : null;
    }
    if (!mode && st.dockPos === 'bottom' && dy) {
      g = grid(); rowsCount = g.__dockAt;
      if (p.r >= rowsCount && dy < 0) { return rowsCount ? focusAt(0, p.c) : null; }      // up from the dock: top of the app list
      if (p.r === 0 && dy < 0) { return; }
    }
    focusAt(p.r + dy, p.c + dx);
  }

  /* ---------- live input preview ---------- */

  function hidePreview() {
    clearTimeout(previewTimer);
    var v = $preview.querySelector('video');
    if (v) { try { v.pause(); } catch (e) {} $preview.removeChild(v); }
    $preview.className = '';
  }
  function schedulePreview(n) {
    hidePreview();
    if (!st.preview || n.__kind !== 'in') { return; }
    previewTimer = setTimeout(function () {
      if (cur !== n || mode || quiet) { return; }
      var v = document.createElement('video'), s = document.createElement('source');
      v.setAttribute('autoplay', '');
      s.setAttribute('type', n.__item.type); s.setAttribute('src', n.__item.src);
      v.appendChild(s);
      $preview.insertBefore(v, $preview.firstChild);
      $('pvlabel').textContent = title(n.__item);
      $preview.className = 'show';
    }, 1200);
  }

  /* ---------- standby ---------- */

  function sleep() {
    if (quiet || mode) { return; }
    if (inRows(cur) && st.calm) { focusFirst(); }
    quiet = true;
    hidePreview();
    applyLook();
    clearInterval(shiftTimer); clearInterval(slideTimer);
    shiftTimer = setInterval(function () {      // nudge the clock so nothing stays in one place
      var x = Math.round(Math.random() * 60 - 30), y = Math.round(Math.random() * 40 - 20);
      $('lock').style.webkitTransform = $('lock').style.transform = 'translate(' + x + 'px,' + y + 'px)';
    }, 60000);
    $widgets.className = 'fade';
    if (st.idleWidgets && st.widgets.length) {
      setTimeout(function () {
        if (!quiet) { return; }
        $widgets.className = 'standby';
        void $widgets.offsetWidth;                  // settle the new position before fading in
        $widgets.className = 'standby in';
      }, 500);
    }
    if (st.idleBg === 'pictures' || st.idleBg === 'online') {
      nextSlide();
      slideTimer = setInterval(nextSlide, Math.max(30, st.idleEvery) * 1000);
    }
  }
  function wake() {
    var was = quiet;
    if (quiet) {
      quiet = false;
      clearInterval(shiftTimer); clearInterval(slideTimer);
      $('lock').style.webkitTransform = $('lock').style.transform = '';
      $('wall').style.opacity = '';
      if (wallShown === 'slide') { wallShown = ''; }
      $widgets.className = 'fade now';              // back to their home position unseen, then fade in with everything else
      void $widgets.offsetWidth;
      $widgets.className = '';
      applyLook();
    }
    clearTimeout(idleTimer);
    if (st.idle > 0 && !document.hidden && !mode) { idleTimer = setTimeout(sleep, st.idle * 1000); }
    return was;
  }

  /* ---------- clock + weather ---------- */

  function tick() {
    var d = new Date(), t = fmtTime(d), day = DAYS[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS[d.getMonth()];
    $('clock').textContent = t; $('locktime').textContent = t;
    $('date').textContent = day; $('lockdate').textContent = day;
    updateWidgets();
    if (updateNight()) { applyLook(); }      // sunrise, sunset or the weather changed the look
    if (lastDay !== d.getHours() && st.wall.kind === 'online') { showWall(); }
    lastDay = d.getHours();
  }
  function getJSON(url, cb) {
    var x = new XMLHttpRequest();
    x.onreadystatechange = function () {
      if (x.readyState !== 4) { return; }
      var r = null;
      try { r = JSON.parse(x.responseText); } catch (e) {}
      cb(x.status === 200 ? r : null);
    };
    try { x.open('GET', url, true); x.timeout = 12000; x.send(); } catch (e) { cb(null); }
  }
  /* The forecast is held in memory only and is never saved. It is asked for when Lantern starts, every 30 minutes,
     when Lantern is shown again without a recent one, and when the TV reports its network came up.
     A request that fails (the network is often not up yet when the TV has just started) is retried after
     5, 10, 20, 40, 60 and 120 seconds, six retries in all, and then Lantern stops asking until one of those events. */
  function wxKey() { return st.city ? [st.city.lat, st.city.lon, st.unitF ? 'F' : 'C'].join(',') : ''; }
  function showWx() {
    $('weather').textContent = wx && st.city ? st.city.name + '  ' + wx.temp + '°  ' + wx.text + (wx.hi != null ? '   ' + wx.hi + '° / ' + wx.lo + '°' : '') : '';
    $('lockwx').textContent = wx && st.city ? wx.temp + '°  ' + wx.text + '   ' + st.city.name : '';
    updateWidgets();
  }
  function wxStale(minutes) { return !wx || Date.now() - wxAt > minutes * 60 * 1000; }
  function wxAgain() {
    clearTimeout(wxRetry);
    if (wxTries >= WX_WAIT.length) { return; }       // out of retries: wait for the next half hour, a return to Lantern or the network
    wxRetry = setTimeout(askWeather, WX_WAIT[wxTries] * 1000);
    wxTries += 1;
  }
  function weather() { wxTries = 0; askWeather(); }       // a fresh request, with a fresh set of retries
  function askWeather() {
    var need = st.city && (st.showWeather || hasWidget('weather') || hasWidget('forecast')), seq, key = wxKey();
    clearTimeout(wxRetry);
    if (!need && !(st.city && st.idleWx)) { $('weather').textContent = ''; $('lockwx').textContent = ''; if (!st.city) { wx = null; updateWidgets(); } return; }
    seq = ++wxSeq;               // an answer to an older request (another place, another unit) is ignored
    getJSON('https://api.open-meteo.com/v1/forecast?latitude=' + st.city.lat + '&longitude=' + st.city.lon +
            '&current_weather=true&daily=weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto' +
            (st.unitF ? '&temperature_unit=fahrenheit' : ''), function (r) {
      var w, d, i, date;
      if (seq !== wxSeq || key !== wxKey()) { return; }
      if (!r || !r.current_weather) { wxAgain(); return; }       // keep the last reading and try again soon
      w = r.current_weather; d = r.daily || {};
      wx = { temp: Math.round(w.temperature), code: w.weathercode, text: WEATHER[w.weathercode] || '', days: [] };
      if (d.sunrise && d.sunset && d.sunrise[0] && d.sunset[0]) {     // local times such as 2026-11-11T07:21
        wx.rise = new Date(d.sunrise[0].replace('T', ' ').replace(/-/g, '/')); wx.set = new Date(d.sunset[0].replace('T', ' ').replace(/-/g, '/'));
        wx.day = new Date().toDateString();
        if (isNaN(wx.rise.getTime()) || isNaN(wx.set.getTime())) { wx.rise = wx.set = null; }
      }
      for (i = 0; d.time && i < d.time.length && i < 4; i++) {
        date = new Date(d.time[i] + 'T12:00:00');
        wx.days.push({ name: i === 0 ? 'Today' : DAYS[date.getDay()].slice(0, 3), hi: Math.round(d.temperature_2m_max[i]),
                       lo: Math.round(d.temperature_2m_min[i]), text: WEATHER[(d.weathercode || [])[i]] || '' });
      }
      if (wx.days.length) { wx.hi = wx.days[0].hi; wx.lo = wx.days[0].lo; }
      wxAt = Date.now();
      showWx();
      if (updateNight()) { applyLook(); }
    });
  }
  // Rough location from the internet address. Only runs when the user asks for it.
  function locateByIp(cb) {
    getJSON('https://ipapi.co/json/', function (r) {
      if (r && r.city && r.latitude != null) { return cb({ name: r.city, lat: r.latitude, lon: r.longitude }); }
      getJSON('https://ipwho.is/', function (q) {
        cb(q && q.success !== false && q.city && q.latitude != null ? { name: q.city, lat: q.latitude, lon: q.longitude } : null);
      });
    });
  }
  function useIpLocation() {
    ipNote = 'Looking up your location…'; redraw(true);
    locateByIp(function (c) {
      if (!c) { ipNote = 'Could not find your location. Type your town instead.'; redraw(true); return; }
      st.city = c; cityHits = []; save(); weather();
      ipNote = 'Found ' + c.name + '. If that is wrong, type your town instead.';
      redraw(true);
    });
  }
  function startTimers() {
    stopTimers();
    tickTimer = setInterval(tick, 10000);
    wxTimer = setInterval(function () { weather(); if (hasWidget('tv')) { tvStatus(); } }, 30 * 60 * 1000);
  }
  function stopTimers() { clearInterval(tickTimer); clearInterval(wxTimer); clearTimeout(idleTimer); }

  /* ---------- root: system probe ---------- */

  function probe(cb) {
    var hook = '/media/developer/apps/usr/palm/applications/org.webosbrew.inputhook';
    var hbc = '/media/developer/apps/usr/palm/applications/org.webosbrew.hbchannel/appinfo.json';
    exec('echo @uid; id -u; echo @hook; ls -d ' + hook + ' 2>/dev/null; echo @init; ls /var/lib/webosbrew/init.d 2>/dev/null; ' +
         'echo @hb; grep -o \'"version"[^,]*\' ' + hbc + ' 2>/dev/null; ' +
         'echo @ip; ip -4 -o addr show 2>/dev/null | grep -v " lo " | awk \'{print $4}\'; ' +
         'echo @watch; kill -0 $(cat ' + PID + ' 2>/dev/null) 2>/dev/null && echo on; ' +
         'echo @os; grep -E \'"(webos_release|webos_manufacturing_version|core_os_release)"\' /var/run/nyx/os_info.json 2>/dev/null; ' +
         'echo @logs; ls /tmp/lginput-hook-*.log 2>/dev/null; ' +
         'echo @dflt; luna-send -n 1 ' + SET + '/getSystemSettings \'{"category":"general","keys":["defaultApps"]}\' 2>/dev/null; echo; ' +
         'echo @last; luna-send -n 1 ' + SET + '/getSystemSettings \'{"category":"general","keys":["lastInputApp"]}\' 2>/dev/null; echo; ' +
         'echo @auto; luna-send -n 1 ' + SET + '/getSystemSettings \'{"category":"general","keys":["homeAutoLaunch"]}\' 2>/dev/null; echo; ' +
         'echo @flag; [ -f ' + HELP + '/no-preload ] && echo nopreload; ' +
         'echo @warm; kill -0 $(cat ' + PID2 + ' 2>/dev/null) 2>/dev/null && echo on; ' +
         'echo @mem; awk \'/^MemTotal|^MemAvailable|^MemFree/{print $1 $2}\' /proc/meminfo; echo @end', function (err, out) {
      var part = {}, name = null, dflt = null, last = null, auto = null;
      out.split('\n').forEach(function (line) {
        var m = /^@(\w+)$/.exec(line);
        if (m) { name = m[1]; part[name] = []; } else if (name) { part[name].push(line); }
      });
      function text(k) { return trim((part[k] || []).join('\n')); }
      sys = { ok: !err && part.end !== undefined, root: text('uid') === '0', hook: /inputhook/.test(text('hook')),
              hookBoot: /inputhook/i.test(text('init')), hookLogs: text('logs') !== '', init: text('init'),
              hb: (/"version"\s*:\s*"([^"]+)"/.exec(text('hb')) || [])[1] || '',
              ip: text('ip').replace(/\n/g, ', '), watch: text('watch') === 'on', os: text('os'), mem: text('mem'),
              noPreload: text('flag') === 'nopreload', warm: text('warm') === 'on', defaultApps: null, homeApp: '', lastInput: '', autoHome: '' };
      try { auto = JSON.parse(text('auto')); } catch (e3) {}
      if (auto && auto.returnValue !== false && auto.settings && typeof auto.settings.homeAutoLaunch === 'string') { sys.autoHome = auto.settings.homeAutoLaunch; }
      try { dflt = JSON.parse(text('dflt')); } catch (e) {}
      try { last = JSON.parse(text('last')); } catch (e2) {}
      if (dflt && dflt.returnValue !== false && dflt.settings && dflt.settings.defaultApps && typeof dflt.settings.defaultApps === 'object') {
        sys.defaultApps = dflt.settings.defaultApps; sys.homeApp = String(sys.defaultApps.home || '');
      }
      if (last && last.settings && last.settings.lastInputApp) { sys.lastInput = String(last.settings.lastInputApp); }
      cb(sys);
    });
    if (!tvInfo) {
      luna('luna://com.webos.service.tv.systemproperty/getSystemInfo', { keys: ['modelName', 'firmwareVersion', 'sdkVersion'] }, function (r) {
        if (r.returnValue !== false) { tvInfo = r; redrawIf('System'); }
      });
    }
  }

  /* ---------- root: key binds (LG Input Hook's keybinds.json) ---------- */

  function readBinds(cb) {
    exec("cat '" + KB + "' 2>/dev/null; echo; echo @ok", function (err, out) {
      var i = out.lastIndexOf('@ok'), body, kb = null;
      if (i < 0) { return cb(null); }               // no root helper: do not touch anything
      body = trim(out.slice(0, i));
      if (!body) { return cb({}); }
      try { kb = JSON.parse(body); } catch (e) {}
      cb(kb && typeof kb === 'object' && !(kb instanceof Array) ? kb : null);
    });
  }
  function writeBinds(kb, cb) {
    var dir = KB.replace(/\/[^\/]*$/, '');
    exec("mkdir -p '" + dir + "'; [ -f '" + KB + "' ] && [ ! -f '" + KB + ".lantern-bak' ] && cp '" + KB + "' '" + KB + ".lantern-bak'; " +
         "cat > '" + KB + ".tmp' <<'LANTERN_EOF'\n" + JSON.stringify(kb, null, 2) + "\nLANTERN_EOF\nmv '" + KB + ".tmp' '" + KB + "'", cb);
  }
  var UNREADABLE = "Could not read LG Input Hook's key file, so nothing was changed.";
  // what Lantern writes into keybinds.json for one of its own binds
  function toKb(b) {
    var me = selfId();
    if (b.t === 'ignore') { return { action: 'ignore' }; }
    if (b.t === 'standby') { return { action: 'launch', id: me, params: { standby: true } }; }
    if (b.id === me && st.keep) { return { action: 'exec', command: 'sh ' + HELP + '/open.sh' }; }
    return { action: 'launch', id: b.id };
  }
  function describeBind(b) {
    if (b.t === 'ignore') { return 'does nothing'; }
    if (b.t === 'standby') { return 'starts Lantern\'s standby'; }
    return 'opens ' + labelFor(b.id);
  }
  // what a key currently does, from the file's point of view
  function describeKb(code, entry) {
    var guess = KEYNAMES[code] ? ' (usually the ' + KEYNAMES[code] + ' button)' : '';
    if (st.binds[code]) { return 'It ' + describeBind(st.binds[code]) + ', set by Lantern.'; }
    if (!entry || entry.action === 'pass') { return 'It does what the TV normally does' + guess + '.'; }
    if (entry.action === 'launch') { return 'It opens ' + labelFor(String(entry.id)) + ', set in LG Input Hook.'; }
    if (entry.action === 'exec') { return 'It runs a command set in LG Input Hook: ' + String(entry.command).slice(0, 70); }
    if (entry.action === 'replace') { return 'It acts as button ' + entry.keycode + ', set in LG Input Hook.'; }
    if (entry.action === 'ignore' || entry.action === 'disable') { return 'It is switched off in LG Input Hook.'; }
    return 'It has a custom action set in LG Input Hook.';
  }
  function setBind(code, b, cb) {
    code = String(code);
    if (PROTECTED[code] || !/^\d+$/.test(code) || (b.t === 'app' && !safeId(b.id))) { toast('That button cannot be remapped.'); return cb && cb(false); }
    readBinds(function (kb) {
      if (!kb) { toast(UNREADABLE); return cb && cb(false); }
      if (kb[code] && !st.binds[code]) { st.prev[code] = kb[code]; }
      kb[code] = toKb(b);
      writeBinds(kb, function (err) {
        if (err) { toast('Could not save the button.'); } else { st.binds[code] = b; save(); }
        if (cb) { cb(!err); }
      });
    });
  }
  function clearBinds(codes, cb) {
    if (!codes.length) { return cb && cb(true); }
    readBinds(function (kb) {
      if (!kb) { toast(UNREADABLE); return cb && cb(false); }
      codes.forEach(function (c) { if (st.prev[c]) { kb[c] = st.prev[c]; } else { delete kb[c]; } });
      writeBinds(kb, function (err) {
        if (!err) { codes.forEach(function (c) { delete st.binds[c]; delete st.prev[c]; }); save(); }
        if (cb) { cb(!err); }
      });
    });
  }
  // rewrite Lantern's own entries (their form depends on "keep in memory")
  function syncBinds(cb) {
    var codes = Object.keys(st.binds);
    if (!codes.length) { return cb && cb(true); }
    readBinds(function (kb) {
      if (!kb) { return cb && cb(false); }
      codes.forEach(function (c) { kb[c] = toKb(st.binds[c]); });
      writeBinds(kb, function (err) { if (cb) { cb(!err); } });
    });
  }

  /* ---------- root: start-up, keep in memory, LG Home helper, TV input ---------- */

  function applySystem(cb) {
    var id = selfId(), launchPlain = "luna-send -n 1 " + SAM + "/launch '{\"id\":\"" + id + "\"}' >/dev/null 2>&1";
    var need = st.keep || st.boot !== 'off' || st.watch || st.rewarm;
    var cmd = "for f in " + PID + " " + PID2 + "; do p=$(cat $f 2>/dev/null); [ -n \"$p\" ] && { pkill -P $p; kill $p; } 2>/dev/null; rm -f $f; done; ";
    if (!safeId(id)) { return cb && cb(false); }
    if (need) {
      // open.sh: open Lantern; with "keep in memory" ask the TV to keep it loaded, and fall back to a plain launch if that is refused
      cmd += "mkdir -p " + HELP + "; cat > " + HELP + "/open.sh <<'LANTERN_EOF'\n#!/bin/sh\n# Added by Lantern: opens Lantern.\n" +
        (st.keep
          ? "R=$(luna-send -n 1 " + SAM + "/launch '{\"id\":\"" + id + "\",\"keepAlive\":true}' 2>/dev/null)\n" +
            "case \"$R\" in *'\"returnValue\":true'*|*'\"returnValue\": true'*) ;; *) " + launchPlain + " ;; esac\n"
          : launchPlain + "\n") +
        "LANTERN_EOF\nchmod 755 " + HELP + "/open.sh; ";
    }
    if (st.boot === 'ready' || st.rewarm) {
      // warm.sh: load Lantern in the background so Home shows it at once. It does nothing if Lantern is already
      // running, and if this TV opens Lantern in front instead of loading it quietly it goes back to what was on
      // screen and leaves a flag so it never tries again.
      cmd += "cat > " + HELP + "/warm.sh <<'LANTERN_EOF'\n#!/bin/sh\n# Added by Lantern: load Lantern in the background.\n" +
        "ID=" + id + "\nSAM=" + SAM + "\nFLAG=" + HELP + "/no-preload\n" +
        "[ -f \"$FLAG\" ] && exit 0\n" +
        "luna-send -n 1 $SAM/running '{}' 2>/dev/null | grep -q \"\\\"$ID\\\"\" && exit 0\n" +
        "fg() { luna-send -n 1 $SAM/getForegroundAppInfo '{}' 2>/dev/null | sed -n 's/.*\"appId\" *: *\"\\([^\"]*\\)\".*/\\1/p'; }\n" +
        "B=$(fg)\n" +
        "luna-send -n 1 $SAM/launch \"{\\\"id\\\":\\\"$ID\\\",\\\"keepAlive\\\":true,\\\"preload\\\":\\\"full\\\"}\" >/dev/null 2>&1\n" +
        "sleep 4\nA=$(fg)\n" +
        "if [ \"$A\" = \"$ID\" ] && [ -n \"$B\" ] && [ \"$B\" != \"$ID\" ]; then\n" +
        "  touch \"$FLAG\"\n  luna-send -n 1 $SAM/launch \"{\\\"id\\\":\\\"$B\\\"}\" >/dev/null 2>&1\nfi\nLANTERN_EOF\n" +
        "chmod 755 " + HELP + "/warm.sh; ";
    }
    if (st.rewarm) {
      cmd += "cat > " + HELP + "/rewarm.sh <<'LANTERN_EOF'\n#!/bin/sh\n# Added by Lantern: if the TV closes Lantern, load it again in the background.\n" +
        "echo $$ > " + PID2 + "\nwhile true; do sleep 45; sh " + HELP + "/warm.sh; done\nLANTERN_EOF\n" +
        "chmod 755 " + HELP + "/rewarm.sh; (nohup sh " + HELP + "/rewarm.sh >/dev/null 2>&1 &); ";
    }
    if (st.watch) {
      cmd += "cat > " + HELP + "/home-watch.sh <<'LANTERN_EOF'\n" +
        "#!/bin/sh\n# Added by Lantern: reopen Lantern whenever LG Home comes to the front.\n" +
        "echo $$ > " + PID + "\n" +
        "luna-send -i " + SAM + "/getForegroundAppInfo '{\"subscribe\":true}' | while read -r l; do\n" +
        "  case \"$l\" in *" + LG_HOME + "\\\"*) sh " + HELP + "/open.sh ;; esac\n" +
        "done\nLANTERN_EOF\n" +
        "chmod 755 " + HELP + "/home-watch.sh; (nohup sh " + HELP + "/home-watch.sh >/dev/null 2>&1 &); ";
    }
    if (st.boot !== 'off' || st.watch || st.rewarm || st.tune.preOff.length) {
      cmd += "mkdir -p /var/lib/webosbrew/init.d; cat > " + INIT + " <<'LANTERN_EOF'\n" +
        "#!/bin/sh\n# Added by Lantern. Delete this file to undo.\n(\n  sleep 15\n" +
        st.tune.preOff.filter(safeId).map(function (a) { return "  " + preloadCmd(a, false) + "\n"; }).join('') +
        (st.boot === 'open' ? "  sh " + HELP + "/open.sh\n" : "") +
        (st.boot === 'ready' ? "  sh " + HELP + "/warm.sh\n" : "") +
        (st.rewarm ? "  sh " + HELP + "/rewarm.sh &\n" : "") +
        (st.watch ? "  sh " + HELP + "/home-watch.sh\n" : "") +
        ") >/dev/null 2>&1 &\nLANTERN_EOF\nchmod 755 " + INIT + "; ";
    } else { cmd += "rm -f " + INIT + "; "; }
    if (!need) { cmd += "rm -rf " + HELP + "; "; }
    exec(cmd + "true", function (err) {
      if (err) { toast('That needs Homebrew Channel with root.'); return cb && cb(false); }
      syncBinds(function (ok) { if (cb) { cb(ok); } });
    });
  }
  // The TV's own "Home app" setting (settings: general, defaultApps.home). One Home path at a time:
  // switching this on removes Lantern's Home-button mapping in LG Input Hook.
  function setHomeApp(id, cb) {
    var all = sys && sys.defaultApps ? copy(sys.defaultApps) : null, mine = id === selfId();
    if (!all || !safeId(id)) { toast('This TV did not report a Home app setting, so nothing was changed.'); return cb && cb(false); }
    function write() {
      if (mine && !st.homeApp.on) { st.homeApp = { on: true, prev: all.home && all.home !== id ? all.home : LG_HOME }; }
      all.home = id;
      exec("luna-send -n 1 " + SET + "/setSystemSettings '" + JSON.stringify({ category: 'general', settings: { defaultApps: all } }) + "'", function (err, out) {
        var ok = !err && /"returnValue"\s*:\s*true/.test(out);
        if (ok && !mine) { st.homeApp = { on: false, prev: '' }; }
        if (!ok && mine) { st.homeApp = { on: false, prev: '' }; }
        save();
        if (!ok) { toast('The TV refused that.'); }
        probe(function () { if (cb) { cb(ok); } });
      });
    }
    if (mine) { clearBinds(Object.keys(st.binds).filter(function (c) { return HOME_CODES[c]; }), write); } else { write(); }
  }
  function appExists(id) {
    return id === selfId() || /^com\.webos\.app\.(livetv|hdmi\d)$/.test(id) || st.apps.some(function (a) { return a.id === id; });
  }
  // The TV opens its "last input" when it starts. Lantern has to be in the input list for that to work,
  // so this adds it there first, and only then names it as the last input. The old value is kept.
  function setStartApp(on, cb) {
    var id = selfId(), back;
    function write(key, value, done) {
      var o = {}; o[key] = value;
      exec("luna-send -n 1 " + SET + "/setSystemSettings '" + JSON.stringify({ category: 'general', settings: o }) + "'", function (err, out) {
        done(!err && /"returnValue"\s*:\s*true/.test(out));
      });
    }
    function finish(ok) { probe(function () { if (cb) { cb(ok); } }); }
    if (!on) {
      back = st.startApp.prev && st.startApp.prev !== id && appExists(st.startApp.prev) ? st.startApp.prev : 'com.webos.app.livetv';
      return write('lastInputApp', back, function (ok) {
        var auto = st.startApp.auto;
        if (!ok) { toast('The TV refused that.'); return finish(false); }
        st.startApp = { on: false, prev: '' }; save();
        if (auto) { write('homeAutoLaunch', auto, function () { finish(true); }); } else { finish(true); }
      });
    }
    setInput(true, function (ok) {
      if (!ok) { toast('The TV would not add Lantern to its input list, so start-up was left alone.'); return finish(false); }
      var prev = sys && sys.lastInput && sys.lastInput !== id && appExists(sys.lastInput) ? sys.lastInput : 'com.webos.app.livetv';
      write('lastInputApp', id, function (ok2) {
        if (!ok2) { toast('The TV refused that.'); return finish(false); }
        var keptAuto = st.startApp.auto;
        st.startApp = { on: true, prev: prev }; if (keptAuto) { st.startApp.auto = keptAuto; } save();
        toast('Done. Restart the TV fully to see it start on Lantern.', 5000);
        // with "start on LG Home" on, the TV opens LG Home as well as its last input: switch it off, remembering it was on
        if (sys && sys.autoHome === 'on') {
          write('homeAutoLaunch', 'off', function (ok3) { if (ok3) { st.startApp.auto = 'on'; save(); } finish(true); });
        } else { finish(true); }
      });
    });
  }
  function instantHome(on) {           // one switch for: keep in memory, load at TV start, reload if closed
    st.keep = on; st.rewarm = on; st.boot = on ? 'ready' : (st.boot === 'ready' ? 'off' : st.boot); save();
    applySystem(function () { probe(function () { redraw(true); }); });
    if (on) { askKeepAlive(); }
  }
  function askKeepAlive() {            // this running copy: ask the TV to keep it loaded when another app opens
    if (st.keep) { selfLaunchAt = Date.now(); luna(SAM + '/launch', { id: selfId(), keepAlive: true }, null); }
  }
  function setInput(on, cb) {
    var id = selfId(), p = on ? { appId: id, pigImage: '', mvpdIcon: '', label: 'Lantern', description: 'Lantern home screen' } : { appId: id };
    var method = on ? '/addDevice' : '/deleteDevice';
    luna(EIM + method, p, function (r) {
      if (r.returnValue !== false) { st.input = on; save(); return cb && cb(true); }
      exec("luna-send -n 1 -a " + id + " " + EIM + method + " '" + JSON.stringify(p) + "'", function (err, out) {
        var ok = !err && /"returnValue"\s*:\s*true/.test(out);
        if (ok || !on) { st.input = on; save(); }
        if (cb) { cb(ok); }
      });
    });
  }

  /* ---------- root: tune-up (close background apps, preloads, ads/tracking settings) ---------- */

  function isOn(v) { return v === true || v === 'on'; }
  function preloadCmd(id, on) {
    return "luna-send -n 1 " + PRE + "/setPreloadPolicy '{\"application\":{\"id\":\"" + id + "\",\"isEnabled\":" + (on ? 'true' : 'false') + "}}' >/dev/null 2>&1";
  }
  function settingCmd(cat, key, value) {
    return "luna-send -n 1 " + SET + "/setSystemSettings '" + JSON.stringify({ category: cat, settings: (function () { var o = {}; o[key] = value; return o; })() }) + "' >/dev/null 2>&1";
  }
  function keepPreload(id) {           // never touched: Lantern, LG Home and the TV inputs
    return id === selfId() || id === LG_HOME || id === 'com.webos.app.fullhome' || INPUTS.some(function (i) { return i.id === id; });
  }
  function splitMarks(out) {
    var part = {}, name = null;
    out.split('\n').forEach(function (line) {
      var m = /^@(\w+)$/.exec(line);
      if (m) { name = m[1]; part[name] = []; } else if (name) { part[name].push(line); }
    });
    return part;
  }
  function tuneProbe(cb) {
    var cmd = "echo @mem; awk '/^MemTotal|^MemAvailable|^MemFree/{print $1 $2}' /proc/meminfo; " +
              "echo @run; luna-send -n 1 " + SAM + "/running '{}' 2>/dev/null; echo; ";
    TUNE.forEach(function (g) {
      g[1].forEach(function (k) {
        cmd += "echo @s_" + k[0] + "_" + k[1] + "; luna-send -n 1 " + SET + "/getSystemSettings '{\"category\":\"" + k[0] + "\",\"keys\":[\"" + k[1] + "\"]}' 2>/dev/null; echo; ";
      });
    });
    exec(cmd + "echo @end", function (err, out) {
      var part = splitMarks(out), t = { ok: !err && part.end !== undefined, set: {}, run: [], pre: tune ? tune.pre : undefined, mem: null }, m = {}, r;
      function json(k) { try { return JSON.parse(trim((part[k] || []).join('\n'))); } catch (e) { return null; } }
      (part.mem || []).forEach(function (l) { var q = l.split(':'); if (q.length === 2) { m[q[0]] = Math.round(parseInt(q[1], 10) / 1024); } });
      if (m.MemTotal) { t.mem = { total: m.MemTotal, free: m.MemAvailable || m.MemFree || 0 }; }
      r = json('run');
      ((r && r.running) || []).forEach(function (a) { if (a && a.id) { t.run.push(String(a.id)); } });
      TUNE.forEach(function (g) {
        g[1].forEach(function (k) {
          var v = json('s_' + k[0] + '_' + k[1]);
          if (v && v.returnValue !== false && v.settings && v.settings[k[1]] !== undefined) { t.set[k[0] + '/' + k[1]] = v.settings[k[1]]; }
        });
      });
      tune = t;
      cb(t);
    });
    // the preload list is asked for separately: on TVs without that service the call can hang, and must not hold up the rest
    exec("luna-send -n 1 " + PRE + "/getPreloadPolicy '{}' 2>/dev/null", function (err, out) {
      var r = null, list = [], seen = {};
      try { r = JSON.parse(trim(out)); } catch (e) {}
      (function walk(o) {
        var k;
        if (!o || typeof o !== 'object') { return; }
        if (o instanceof Array) { o.forEach(walk); return; }
        if (typeof o.id === 'string') {
          if (!seen[o.id] && safeId(o.id)) { seen[o.id] = 1; list.push({ id: o.id, on: o.isEnabled !== false, mode: String(o.preloadMode || '') }); }
          return;
        }
        for (k in o) { walk(o[k]); }
      })(r);
      if (tune) { tune.pre = r && r.returnValue !== false && list.length ? list : null; redrawIf('Tune-up'); }
    });
  }
  // apps the user can open, other than the one in front: closing them frees their memory
  function closable() {
    return tune ? tune.run.filter(function (id) { return id !== selfId() && st.apps.some(function (a) { return a.id === id; }); }) : [];
  }
  function closeBackground() {
    var ids = closable().filter(safeId), before = tune && tune.mem ? tune.mem.free : null;
    if (!ids.length) { toast('Nothing to close.'); return; }
    exec(ids.map(function (id) { return "luna-send -n 1 " + SAM + "/closeByAppId '{\"id\":\"" + id + "\"}' >/dev/null 2>&1"; }).join('; ') + "; sleep 2; true", function (err) {
      if (err) { toast('That needs Homebrew Channel with root.'); return; }
      tuneProbe(function (t) {
        var gained = before != null && t.mem ? t.mem.free - before : null;
        toast('Closed ' + ids.length + (ids.length === 1 ? ' app' : ' apps') + (gained != null && gained > 0 ? ', freeing about ' + gained + ' MB.' : '.'));
        redrawIf('Tune-up');
      });
    });
  }
  function tuneOff(group) {            // switch off every key in the group that is on, remembering what it was
    var cmds = [];
    group[1].forEach(function (k) {
      var name = k[0] + '/' + k[1], v = tune.set[name];
      if (!isOn(v)) { return; }
      if (st.tune.orig[name] === undefined) { st.tune.orig[name] = v; }
      cmds.push(settingCmd(k[0], k[1], v === true ? false : 'off'));
    });
    if (!cmds.length) { return; }
    save();
    exec(cmds.join('; ') + '; true', function (err) {
      if (err) { toast('That needs Homebrew Channel with root.'); }
      tuneProbe(function () { redrawIf('Tune-up'); });
    });
  }
  function tuneBack(group) {           // put one group back to what it was before Lantern
    var cmds = [];
    group[1].forEach(function (k) {
      var name = k[0] + '/' + k[1];
      if (st.tune.orig[name] !== undefined) { cmds.push(settingCmd(k[0], k[1], st.tune.orig[name])); delete st.tune.orig[name]; }
    });
    save();
    exec(cmds.join('; ') + '; true', function () { tuneProbe(function () { redrawIf('Tune-up'); }); });
  }
  function setPreload(id, on) {
    var i = st.tune.preOff.indexOf(id);
    if (!safeId(id) || keepPreload(id)) { return; }
    if (on && i >= 0) { st.tune.preOff.splice(i, 1); } else if (!on && i < 0) { st.tune.preOff.push(id); }
    save();
    exec(preloadCmd(id, on), function (err) {
      if (err) { toast('That needs Homebrew Channel with root.'); }
      applySystem(function () { tuneProbe(function () { redrawIf('Tune-up'); }); });   // the start-up script re-applies the choice after a restart
    });
  }
  function preloadAllOff() {           // every app the TV keeps loaded, except Home, Live TV, the inputs and Lantern
    var ids = (tune && tune.pre ? tune.pre : []).filter(function (a) { return a.on && !keepPreload(a.id) && safeId(a.id); }).map(function (a) { return a.id; });
    if (!ids.length) { toast('Nothing left to switch off.'); return; }
    ids.forEach(function (id) { if (!has(st.tune.preOff, id)) { st.tune.preOff.push(id); } });
    save();
    exec(ids.map(function (id) { return preloadCmd(id, false); }).join('; ') + '; true', function (err) {
      if (err) { toast('That needs Homebrew Channel with root.'); }
      applySystem(function () { tuneProbe(function () { redrawIf('Tune-up'); }); });
    });
  }
  function restoreTune(cb) {
    var cmds = [], name, p;
    for (name in st.tune.orig) { p = name.split('/'); cmds.push(settingCmd(p[0], p[1], st.tune.orig[name])); }
    st.tune.preOff.filter(safeId).forEach(function (id) { cmds.push(preloadCmd(id, true)); });
    if (!cmds.length) { return cb && cb(true); }
    exec(cmds.join('; ') + '; true', function (err) {
      if (!err) { st.tune = { orig: {}, preOff: [] }; save(); }
      if (cb) { cb(!err); }
    });
  }

  // Undo everything Lantern changed outside its own folder.
  function restoreTV(cb) {
    clearBinds(Object.keys(st.binds), function (bindsOk) {
     restoreTune(function (tuneOk) {
      st.boot = 'off'; st.watch = false; st.keep = false; st.rewarm = false; save();
      applySystem(function (sysOk) {
        sysOk = sysOk && tuneOk;
        exec("rm -f " + HELP + "/no-preload", null);
        (function (next) {             // give Home and start-up back if Lantern took them
          function start() { if (st.startApp.on) { setStartApp(false, next); } else { next(); } }
          if (st.homeApp.on) { probe(function () { setHomeApp(st.homeApp.prev || LG_HOME, start); }); } else { start(); }
        })(function () {
        setInput(false, function () {
          exec("rm -f /tmp/lantern-*", function () {
            toast(bindsOk && sysOk ? 'TV defaults restored: Home button, remapped buttons, start-up, the input list and tune-up changes are back to how they were.'
                                   : 'Some changes could not be undone. Check Homebrew Channel shows "Root status: ok".', 6000);
            if (cb) { cb(); }
          });
        });
        });
      });
     });
    });
  }

  /* ---------- overlay plumbing ---------- */

  function row(host) { var r = el('div', 'row'); (host || $sheet).appendChild(r); return r; }
  function btn(parent, text, value, cls, fn) {
    var b = el('div', 'b' + (cls ? ' ' + cls : ''), text);
    if (value != null && value !== '') { b.appendChild(el('small', null, value)); }
    b.__fn = fn;
    parent.appendChild(b);
    return b;
  }
  function field(parent, placeholder, go, value) {
    var i = el('input', 'b wide');
    i.setAttribute('type', 'text'); i.setAttribute('placeholder', placeholder);
    if (value) { i.value = value; }
    i.__go = function () { go(trim(i.value)); };
    parent.appendChild(i);
    return i;
  }
  function openOverlay(m, narrow) {
    wake(); clearTimeout(idleTimer);
    hidePreview(); unfocus();
    mode = m;
    $overlay.className = 'show';
    $sheet.className = narrow ? 'narrow' : '';
    clear($sheet);
    applyLook();
  }
  function closeOverlay() {
    stopLearn(); clearInterval(restartTimer); restartTimer = null;
    unfocus(); mode = null; pickFor = null; wallPreview = null;
    $overlay.className = '';
    clear($sheet);
    render();
    if (!cur) { focusFirst(); }
    wake();
  }

  /* ---------- per-app menu ---------- */

  function openMenu(item, keep) {
    var pos = keep ? position() : { r: 0, c: 0 }, id = item.id, pinned = has(st.pins, id), r, f;
    openOverlay('menu', true);
    $sheet.appendChild(el('h1', null, title(item)));
    btn(row(), 'Open', null, '', function () { closeOverlay(); launch(id); });
    btn(row(), pinned ? 'Remove from the dock' : 'Add to the dock', null, '', function () { togglePin(id); openMenu(item, true); });
    if (pinned) {
      r = row();
      btn(r, 'Move left', null, '', function () { shift(id, -1); openMenu(item, true); });
      btn(r, 'Move right', null, '', function () { shift(id, 1); openMenu(item, true); });
    }
    $sheet.appendChild(el('h2', null, 'Name'));
    r = row();
    f = field(r, item.title, function (v) { if (v) { st.names[id] = v; } else { delete st.names[id]; } save(); openMenu(item); }, st.names[id] || '');
    btn(r, 'Save', null, 'slim', f.__go);
    $sheet.appendChild(el('h2', null, 'Icon from a web address (leave empty for the app\'s own)'));
    r = row();
    f = field(r, 'https://… address of a picture', function (v) { if (v) { st.icons[id] = v; } else { delete st.icons[id]; } save(); openMenu(item); }, st.icons[id] || '');
    btn(r, 'Save', null, 'slim', f.__go);
    $sheet.appendChild(el('h2', null, 'Tile colour'));
    r = row();
    btn(r, 'Auto', null, 'auto' + (st.colors[id] ? '' : ' on'), function () { delete st.colors[id]; save(); openMenu(item, true); });
    TILE_COLOURS.forEach(function (c) {
      var b = btn(r, '', null, 'sw' + (st.colors[id] === c ? ' on' : ''), function () { st.colors[id] = c; save(); openMenu(item, true); });
      b.style.background = c;
    });
    $sheet.appendChild(el('h2', null, ''));
    r = row();
    btn(r, 'Hide this app', null, '', function () { hideApp(id); closeOverlay(); });
    btn(r, 'Done', null, '', closeOverlay);
    focusAt(Math.max(0, pos.r), pos.c);
  }
  function togglePin(id) {
    var i = st.pins.indexOf(id);
    if (i >= 0) { st.pins.splice(i, 1); } else { st.pins.push(id); }
    save();
  }
  function shift(id, d) {
    var i = st.pins.indexOf(id), j = i + d;
    if (i < 0 || j < 0 || j >= st.pins.length) { return; }
    st.pins.splice(i, 1); st.pins.splice(j, 0, id); save();
  }
  function hideApp(id) {
    var i = st.pins.indexOf(id);
    if (i >= 0) { st.pins.splice(i, 1); }
    if (!has(st.hidden, id)) { st.hidden.push(id); }
    save();
    toast('Hidden. Bring it back from Settings, Apps.');
  }

  /* ---------- remap a button: detect it, show what it does, change it, confirm ---------- */

  // Pull the button code out of LG Input Hook's log lines. Two formats are in use:
  //   "... keyid=3, state=1 uinput_code=773"   (the code is uinput_code, never keyid)
  //   "id => 773 ..."
  // Release and repeat lines (state other than 1) are skipped.
  function parseHookLog(text) {
    var out = [];
    String(text).split('\n').forEach(function (line) {
      var st1 = /state\s*=\s*(\d+)/.exec(line), m;
      if (st1 && st1[1] !== '1') { return; }
      m = /uinput_code\s*=\s*(\d+)/.exec(line) || /\bid\s*=>\s*(\d+)/.exec(line);
      if (m && out[out.length - 1] !== m[1]) { out.push(m[1]); }
    });
    return out;
  }
  function stopLearn() { if (learn) { clearTimeout(learn.timer); clearInterval(learn.count); learn = null; } }
  function startLearn() {
    openOverlay('learn', true);
    learn = { step: 'wait', base: {}, timer: null, count: null };
    drawLearn();
    // remember how long each hook log is now, so only new presses are read
    exec('for f in /tmp/lginput-hook-*.log; do [ -f "$f" ] && echo "$f $(wc -l < "$f")"; done; echo @ok', function (err, out) {
      if (!learn) { return; }
      out.split('\n').forEach(function (l) {
        var m = /^(\/tmp\/lginput-hook-[\w.\-]+\.log)\s+(\d+)$/.exec(trim(l));
        if (m) { learn.base[m[1]] = parseInt(m[2], 10); }
      });
      if (out.indexOf('@ok') < 0) { learn.step = 'noroot'; return drawLearn(); }
      if (!Object.keys(learn.base).length) { learn.step = 'nolog'; return drawLearn(); }
      pollLearn();
    });
  }
  function pollLearn() {
    if (!learn || learn.step !== 'wait') { return; }
    clearTimeout(learn.timer);
    learn.timer = setTimeout(function () {
      if (!learn || learn.step !== 'wait') { return; }
      if (document.hidden) { return; }               // resumes when Lantern is in front again
      var cmd = Object.keys(learn.base).map(function (f) { return "tail -n +" + (learn.base[f] + 1) + " '" + f + "' 2>/dev/null"; }).join('; ');
      exec(cmd + '; echo @ok', function (err, out) {
        var codes, i;
        if (!learn || learn.step !== 'wait') { return; }
        codes = parseHookLog(out);
        for (i = 0; i < codes.length; i++) {
          if (PROTECTED[codes[i]]) { learn.refused = PROTECTED[codes[i]]; continue; }
          return foundKey(codes[i]);
        }
        if (learn.refused && learn.refused !== learn.refusedShown) { learn.refusedShown = learn.refused; drawLearn(); }
        pollLearn();
      });
    }, 700);
  }
  function foundKey(code) {
    learn.code = code; learn.step = 'reading';
    readBinds(function (kb) {
      if (!learn) { return; }
      if (!kb) { toast(UNREADABLE); return openSettings(TABS.indexOf('Remote')); }
      learn.was = describeKb(code, kb[code]);
      learn.step = 'choose';
      drawLearn();
    });
  }
  function applyLearn(b) {
    var code = learn.code, hadBind = st.binds[code] ? copy(st.binds[code]) : null;
    setBind(code, b, function (ok) {
      if (!learn) { return; }
      if (!ok) { return openSettings(TABS.indexOf('Remote')); }
      learn.step = 'trial'; learn.left = 30; learn.undo = hadBind;
      drawLearn();
      learn.count = setInterval(function () {
        if (!learn || learn.step !== 'trial' || document.hidden) { return; }   // the countdown waits while another app is in front
        learn.left--;
        if (learn.left <= 0) { undoLearn('No answer, so the button was put back.'); }
        else { var n = $('lcount'); if (n) { n.textContent = String(learn.left); } }
      }, 1000);
    });
  }
  function undoLearn(msg) {
    var code = learn.code, prev = learn.undo;
    clearInterval(learn.count);
    function done() { toast(msg || 'The button was put back.'); openSettings(TABS.indexOf('Remote')); }
    if (prev) { setBind(code, prev, done); } else { clearBinds([code], done); }
  }
  function drawLearn() {
    var L = learn, r, name;
    clear($sheet); unfocus();
    if (L.step === 'wait') {
      $sheet.appendChild(el('h1', null, 'Press the button to change'));
      $sheet.appendChild(el('p', 'big', 'Press it once on the remote now.'));
      $sheet.appendChild(el('p', null, 'If the button opens another app, come back to Lantern afterwards: the press will have been caught. Arrows, OK, Back, numbers, channels, power and volume are never remapped.'));
      if (L.refused) { $sheet.appendChild(el('p', 'big', 'That was ' + L.refused + ', which stays as it is. Press a different button.')); }
      btn(row(), 'Cancel', null, '', function () { openSettings(TABS.indexOf('Remote')); });
    } else if (L.step === 'nolog' || L.step === 'noroot') {
      $sheet.appendChild(el('h1', null, 'Cannot listen for buttons yet'));
      $sheet.appendChild(el('p', 'big', L.step === 'noroot' ? 'Homebrew Channel did not answer as root.'
        : 'LG Input Hook is not running. Open the LG Input Hook app once, then try again.'));
      btn(row(), 'Back', null, '', function () { openSettings(TABS.indexOf('Remote')); });
    } else if (L.step === 'reading') {
      $sheet.appendChild(el('h1', null, 'Button ' + L.code));
      $sheet.appendChild(el('p', 'big', 'Checking what it does now…'));
    } else if (L.step === 'choose') {
      name = KEYNAMES[L.code] ? ' (' + KEYNAMES[L.code] + ')' : '';
      $sheet.appendChild(el('h1', null, 'Button ' + L.code + name));
      $sheet.appendChild(el('h2', null, 'Right now'));
      $sheet.appendChild(el('p', 'big', L.was));
      $sheet.appendChild(el('h2', null, 'Change it to'));
      r = row();
      btn(r, 'Open Lantern', null, '', function () { applyLearn({ t: 'app', id: selfId() }); });
      btn(r, 'Start standby', null, '', function () { applyLearn({ t: 'standby' }); });
      r = row();
      btn(r, 'Open LG Home', null, '', function () { applyLearn({ t: 'app', id: LG_HOME }); });
      btn(r, 'Open an app…', null, '', function () { pickApp(L.code); });
      r = row();
      btn(r, 'Do nothing', null, '', function () { applyLearn({ t: 'ignore' }); });
      if (st.binds[L.code]) {
        btn(r, 'Back to how it was before Lantern', null, '', function () {
          clearBinds([L.code], function () { toast('Button ' + L.code + ' is back to how it was.'); openSettings(TABS.indexOf('Remote')); });
        });
      }
      btn(row(), 'Cancel', null, '', function () { openSettings(TABS.indexOf('Remote')); });
    } else if (L.step === 'trial') {
      $sheet.appendChild(el('h1', null, 'Try button ' + L.code + ' now'));
      $sheet.appendChild(el('p', 'big', 'It now ' + describeBind(st.binds[L.code]) + '. Check it, and check the rest of the remote still works.'));
      r = el('p', 'big', 'Putting it back automatically in '); r.appendChild(el('span', null, String(L.left))).id = 'lcount';
      r.appendChild(document.createTextNode(' seconds unless you keep it.'));
      $sheet.appendChild(r);
      r = row();
      btn(r, 'Keep the change', null, '', function () { stopLearn(); toast('Saved.'); openSettings(TABS.indexOf('Remote')); });
      btn(r, 'Put it back', null, '', function () { undoLearn(); });
    }
    focusAt(0, 0);
  }
  function pickApp(code) {
    var i, r, list = INPUTS.concat(st.apps), fromLearn = !!learn;
    pickFor = code;
    if (!fromLearn) { openOverlay('menu'); } else { mode = 'menu'; $sheet.className = ''; clear($sheet); unfocus(); }
    $sheet.appendChild(el('h1', null, 'Button ' + code + ' opens…'));
    for (i = 0; i < list.length; i++) {
      if (i % 4 === 0) { r = row(); }
      (function (a) {
        btn(r, title(a), null, '', function () {
          pickFor = null;
          if (learn) { mode = 'learn'; $sheet.className = 'narrow'; applyLearn({ t: 'app', id: a.id }); }
          else { setBind(code, { t: 'app', id: a.id }, function () { openSettings(TABS.indexOf('Remote')); }); }
        });
      })(list[i]);
    }
    focusAt(0, 0);
  }

  /* ---------- first-run setup ---------- */

  var STEPS = ['Welcome', 'Where you are', 'Light and dark', 'Wallpaper', 'Home screen', 'Your dock', 'Standby', 'Home button and start-up', 'All set'];
  function openSetup(step) {
    stopLearn();
    openOverlay('setup');
    $sheet.className = 'setup';
    setupStep = step || 0; ipNote = ''; setupMark = sysMark();
    probe(function () { if (mode === 'setup') { drawSetup(true); } });
    drawSetup();
  }
  function setupGo(d) {
    setupStep = Math.max(0, Math.min(STEPS.length - 1, setupStep + d));
    wallFor = 'day'; cityHits = [];
    drawSetup();
  }
  // The TV-level switches (Home app, input, start-up, staying in memory) only take full effect after the TV restarts.
  function sysMark() { return JSON.stringify([st.homeApp.on, st.startApp.on, st.input, st.keep, st.rewarm, st.boot, st.watch]); }
  function restartTV() {
    clearInterval(restartTimer); restartTimer = null;
    toast('Restarting the TV…', 20000);
    exec("sync; luna-send -n 1 luna://com.webos.service.sleep/shutdown/machineReboot '{\"reason\":\"SwDownload\"}' >/dev/null 2>&1; sleep 5; reboot", function (err) {
      if (err) { toast('The TV would not restart from here. Unplug it for ten seconds, or hold the power button until it restarts.', 8000); }
    });
  }
  function openRestart() {
    var left = 15, line, r, go;
    openOverlay('restart', true);
    $sheet.appendChild(el('h1', null, 'Restart the TV'));
    $sheet.appendChild(el('p', 'big', 'You changed how the TV itself starts or opens Lantern. Those changes only take full effect after the TV restarts.'));
    line = el('p', null, ''); $sheet.appendChild(line);
    function tick() { line.textContent = 'Restarting in ' + left + ' second' + (left === 1 ? '' : 's') + '.'; }
    r = row();
    go = btn(r, 'Restart now', null, 'go', restartTV);
    btn(r, 'Later', null, '', function () { closeOverlay(); toast('Restart the TV yourself when you are ready: Settings, System, Restart the TV.', 6000); });
    tick(); focus(go);
    clearInterval(restartTimer);
    restartTimer = setInterval(function () { left -= 1; if (left <= 0) { restartTV(); } else { tick(); } }, 1000);
  }
  function finishSetup() {
    var changed = sysMark() !== setupMark && sys && sys.ok && sys.root;
    st.setupDone = true; save();
    if (changed) { if (pendingReload) { pendingReload = false; } openRestart(); return; }
    closeOverlay();
    if (pendingReload) { pendingReload = false; checkIcons(); }
  }
  function drawSetup(keep) {
    var pos = keep ? position() : null, name = STEPS[setupStep], last = setupStep === STEPS.length - 1;
    var r, f, i, dots, next, first, instant, rootOk = sys && sys.ok && sys.root;
    unfocus(); clear($sheet);
    function h(text) { $sheet.appendChild(el('h2', null, text)); }
    function p(text, big) { $sheet.appendChild(el('p', big ? 'big' : null, text)); }
    function rw() { return row(); }
    function pick(host, label, key, value, after) {
      btn(host, label, st[key] === value ? 'Chosen' : '', st[key] === value ? 'on' : '', function () { set(key, value); if (after) { after(); } });
    }
    wallPreview = name === 'Wallpaper' && st.nightWall ? wallFor : null;
    showWall();

    dots = el('div', 'steps');
    for (i = 0; i < STEPS.length; i++) { dots.appendChild(el('i', i < setupStep ? 'done' : i === setupStep ? 'now' : null)); }
    $sheet.appendChild(dots);
    $sheet.appendChild(el('h1', null, name === 'Welcome' ? 'Welcome to Lantern' : name));

    if (name === 'Welcome') {
      p('Lantern is a home screen for your TV: a clock, your favourite apps in a dock, and every app one press away.', true);
      p('The next few steps set it up. Each one can be skipped, and everything can be changed later in Settings (the Blue button).');
      p(!sys ? 'Checking the TV…' : rootOk ? 'Homebrew Channel is working with root access, so every feature is available.'
        : 'Homebrew Channel did not answer with root access. Lantern still works as a home screen, but it cannot list every app, remap buttons or tune the TV until Homebrew Channel shows "Root status: ok".');
    }
    if (name === 'Where you are') {
      p(st.city ? 'Using ' + st.city.name + ' for the weather and for sunrise and sunset.' : 'Your town sets the weather and the sunrise and sunset times.', true);
      r = rw();
      btn(r, st.city ? 'Look it up again automatically' : 'Find it automatically', null, '', useIpLocation);
      p(ipNote || 'Uses your internet address, which is sent to ipapi.co. It is accurate to about a town and can be wrong.');
      h(st.city ? 'Or type a different town' : 'Or type your town');
      r = rw();
      f = field(r, 'Town or city', function (q) {
        if (!q) { return; }
        getJSON('https://geocoding-api.open-meteo.com/v1/search?count=4&name=' + encodeURIComponent(q), function (res) {
          cityHits = (res && res.results) || [];
          ipNote = cityHits.length ? '' : 'No place found with that name (or no connection to the weather service).';
          redraw(true);
        });
      });
      btn(r, 'Search', null, 'slim', f.__go);
      cityHits.forEach(function (hit) {
        btn(rw(), [hit.name, hit.admin1, hit.country].filter(function (x) { return x; }).join(', '), null, '', function () {
          st.city = { name: hit.name, lat: hit.latitude, lon: hit.longitude }; cityHits = []; ipNote = ''; save(); weather(); drawSetup();
        });
      });
    }
    if (name === 'Light and dark') {
      p('Lantern can be light by day and dark at night, following sunrise and sunset where you are.', true);
      r = rw();
      pick(r, 'Automatic', 'theme', 'auto'); pick(r, 'Always dark', 'theme', 'dark'); pick(r, 'Always light', 'theme', 'light');
      if (st.theme === 'auto') {
        r = rw();
        onoff(r, 'Go dark in dull weather too (thick cloud, rain, fog, snow)', 'dullDark');
        p(sunLine());
      }
    }
    if (name === 'Wallpaper') {
      p(st.nightWall ? 'Choose a picture for the day and another for the night. The screen behind shows the one you are choosing.' : 'Choose the picture behind your home screen.', true);
      r = rw();
      onoff(r, 'Different wallpaper at night', 'nightWall', function () { wallFor = 'day'; redraw(true); });
      if (st.nightWall) { btn(r, 'Now choosing', wallFor === 'night' ? 'The night picture' : 'The day picture', '', function () { wallFor = wallFor === 'night' ? 'day' : 'night'; redraw(true); }); }
      wallPicker(rw);
      p('Online photos and your own pictures are under Settings, Wallpaper.');
    }
    if (name === 'Home screen') {
      p('How much should be on screen when you press Home?', true);
      r = rw();
      pick(r, 'Calm: clock and dock, with every app in a menu', 'calm', true, render);
      pick(r, 'Everything on screen', 'calm', false, render);
      h('The dock');
      r = rw();
      cycle(r, 'Fill the dock with', 'dockFill', ['recent', 'used', 'none'], ['Recently opened apps', 'Most used apps', 'Nothing: only apps I pin'], render);
      cycle(r, 'Apps in the dock', 'dockCount', [3, 4, 5, 6, 7, 8, 9], ['3', '4', '5', '6', '7', '8', '9'], render);
    }
    if (name === 'Your dock') {
      p('Pin the apps you always want in the dock. ' + (st.dockFill === 'none' ? 'Only these will be in it.' : 'The rest of the dock fills itself with ' + (st.dockFill === 'recent' ? 'apps you opened recently.' : 'the apps you use most.')), true);
      if (!st.apps.length) { p(lastRefresh ? 'Still reading the list of apps from the TV. It will appear here in a moment.' : 'No apps found yet. You can pin apps later with the Green button.'); }
      st.apps.forEach(function (a, n) {
        if (n % 4 === 0) { r = rw(); }
        btn(r, title(a), has(st.pins, a.id) ? 'Pinned' : '', has(st.pins, a.id) ? 'on' : '', function () { togglePin(a.id); render(); redraw(true); });
      });
    }
    if (name === 'Standby') {
      p('When you leave Lantern alone, the dock fades away and leaves the picture with the things you choose here.', true);
      r = rw();
      cycle(r, 'Start after', 'idle', [0, 10, 20, 30, 60, 120, 300], ['Never', '10 seconds', '20 seconds', '30 seconds', '1 minute', '2 minutes', '5 minutes']);
      if (st.idle > 0) {
        cycle(r, 'Background', 'idleBg', ['wall', 'pictures', 'online', 'black'], ['The home wallpaper', 'Built-in pictures in turn', 'Online photos in turn', 'Black']);
        h('Show on top');
        r = rw();
        onoff(r, 'Clock', 'idleClock'); onoff(r, 'Date', 'idleDate'); onoff(r, 'Weather', 'idleWx', weather);
        h('At night');
        r = rw();
        pick(r, 'Same as by day', 'idleNight', 'same'); pick(r, 'Black with a dim clock', 'idleNight', 'black');
      }
    }
    if (name === 'Home button and start-up') {
      if (!sys) { p('Checking the TV…', true); }
      else if (!rootOk) { p('These options need Homebrew Channel with root access, so they are skipped for now. They are in Settings, Remote, whenever you want them.', true); }
      else {
        h('Home button');
        if (sys.homeApp === selfId()) { p('The Home button opens Lantern: it is set as the TV\'s Home app.', true); }
        else if (sys.defaultApps) {
          r = rw();
          btn(r, 'Make the Home button open Lantern', 'Off', '', function () { setHomeApp(selfId(), function () { redraw(true); }); });
        } else if (sys.hook) {
          r = rw();
          btn(r, 'Home button opens', st.binds[HOME_CODE] ? 'Lantern' : 'LG Home', st.binds[HOME_CODE] ? 'on' : '', function () {
            if (st.binds[HOME_CODE]) { clearBinds([HOME_CODE], function () { redraw(true); }); } else { setBind(HOME_CODE, { t: 'app', id: selfId() }, function () { redraw(true); }); }
          });
        } else { p('To make the Home button open Lantern, install LG Input Hook from Homebrew Channel, open it once, then use Settings, Remote.'); }
        h('When the TV starts');
        r = rw();
        btn(r, 'Start the TV on Lantern', sys.lastInput === selfId() ? 'On' : 'Off', sys.lastInput === selfId() ? 'on' : '', function () { setStartApp(sys.lastInput !== selfId(), function () { redraw(true); }); });
        p('Adds Lantern to the TV\'s input list and makes it the one the TV starts on. Takes a full TV restart to show.');
        h('Opening quickly');
        instant = st.keep && st.rewarm && st.boot === 'ready';
        r = rw();
        btn(r, 'Instant Home', instant ? 'On' : 'Off', instant ? 'on' : '', function () { instantHome(!instant); });
        p(sys.noPreload ? 'This TV does not load apps in the background, so this only asks the TV to keep Lantern in memory.'
          : 'Keeps Lantern loaded in the background so the Home button shows it straight away instead of the TV\'s loading screen. Uses a little memory all the time.');
      }
    }
    if (name === 'All set') {
      p('Here is what you chose. Settings (the Blue button) changes any of it.', true);
      kv($sheet, 'Location', st.city ? st.city.name : 'Not set');
      kv($sheet, 'Appearance', { auto: 'Automatic', dark: 'Always dark', light: 'Always light' }[st.theme]);
      kv($sheet, 'Wallpaper', st.wall.kind === 'preset' ? st.wall.preset + (st.nightWall ? ' by day, ' + st.wallNight + ' at night' : '') : 'Your own picture');
      kv($sheet, 'Home screen', st.calm ? 'Calm, with apps in a menu' : 'Everything on screen');
      kv($sheet, 'Dock', st.pins.length + ' pinned' + (st.dockFill === 'none' ? '' : ', topped up to ' + st.dockCount + ' with ' + (st.dockFill === 'recent' ? 'recent apps' : 'most-used apps')));
      kv($sheet, 'Standby', st.idle ? 'After ' + (st.idle < 60 ? st.idle + ' seconds' : st.idle / 60 + (st.idle === 60 ? ' minute' : ' minutes')) : 'Off');
      h('On the remote');
      p((st.calm ? 'Down opens every app and input; Up or Back closes it. ' : '') + 'Green pins or unpins the selected app. Red, or holding OK, opens its options. Yellow starts standby.');
    }

    h('');
    r = rw();
    if (setupStep > 0) { btn(r, 'Back', null, 'slim', function () { setupGo(-1); }); }
    next = btn(r, last ? 'Finish' : setupStep === 0 ? 'Start' : name === 'Where you are' && !st.city ? 'Skip for now' : 'Next', null, 'go', function () { if (last) { finishSetup(); } else { setupGo(1); } });
    if (setupStep === 0) { btn(r, 'Skip setup', null, 'slim', finishSetup); }
    if (pos && pos.r >= 0) { return focusAt(pos.r, pos.c); }
    first = $sheet.querySelector('.row .b');                    // start on the step's first choice, or on Next if it has none
    focus(first && first !== r.firstChild ? first : next);
  }

  /* ---------- settings ---------- */

  function openSettings(t) {
    stopLearn();
    openOverlay('settings');
    if (t !== undefined && t >= 0) { tab = t; }
    var r = row(), i;
    r.id = 'tabs';
    TABS.forEach(function (name, idx) { btn(r, name, null, '', function () {}).__tab = idx; });
    i = el('div'); i.id = 'body'; $sheet.appendChild(i);
    markTabs();
    drawBody();
    focus(r.children[tab]);
    enterTab();
  }
  function enterTab() {
    var name = TABS[tab];
    if (name === 'Remote' || name === 'System') { probe(function () { redrawIf(name); }); }
    if (name === 'Tune-up') { tuneProbe(function () { redrawIf(name); }); }
  }
  function markTabs() {
    var bs = $('tabs').children, i;
    for (i = 0; i < bs.length; i++) {
      bs[i].className = bs[i].className.replace(/ ?\bon\b/, '') + (i === tab ? ' on' : '');
    }
  }
  function redraw(keep) { if (mode === 'setup') { drawSetup(keep); } else if (mode === 'settings') { drawBody(keep); } }
  function redrawIf(name) { if (mode === 'setup') { drawSetup(true); } else if (mode === 'settings' && TABS[tab] === name) { drawBody(true); } }
  function set(key, value) { st[key] = value; save(); applyLook(); redraw(true); }
  function cycle(host, label, key, values, labels, after) {
    var i = values.indexOf(st[key]);
    btn(host, label, labels[i < 0 ? 0 : i], '', function () { set(key, values[(i + 1) % values.length]); if (after) { after(); } });
  }
  function onoff(host, label, key, after) {
    btn(host, label, st[key] ? 'On' : 'Off', '', function () { set(key, !st[key]); if (after) { after(); } });
  }
  function kv(body, k, v) { var d = el('div', 'kv'); d.appendChild(el('span', null, k)); d.appendChild(el('span', null, v || 'Unknown')); body.appendChild(d); }
  function sysToggle(apply) { apply(); save(); applySystem(function () { probe(function () { redraw(true); }); }); }

  function drawBody(keep) {
    var body = $('body'), pos = keep ? position() : null, inBody = cur && body.contains(cur), name = TABS[tab], r, f;
    if (!body) { return; }
    if (inBody) { unfocus(); }
    clear(body);
    function h(text) { body.appendChild(el('h2', null, text)); }
    function p(text) { body.appendChild(el('p', null, text)); }
    function rw() { return row(body); }

    if (name === 'Look') {
      h('Accent colour');
      r = rw();
      ACCENTS.forEach(function (a, i) {
        var b = btn(r, '', null, 'sw' + (st.accent === i ? ' on' : ''), function () { set('accent', i); });
        b.style.background = a[1];
      });
      h('Light and dark');
      r = rw();
      cycle(r, 'Appearance', 'theme', ['auto', 'dark', 'light'], ['Automatic: light by day, dark at night', 'Always dark', 'Always light']);
      onoff(r, 'Go dark in dull weather too', 'dullDark');
      p(sunLine());
      h('Home screen');
      r = rw();
      cycle(r, 'Style', 'calm', [true, false], ['Calm: clock and dock, apps in a menu', 'Everything on screen'], render);
      h('Tiles');
      r = rw();
      cycle(r, 'Size', 'size', ['s', 'm', 'l'], ['Small', 'Medium', 'Large'], render);
      cycle(r, 'Shape', 'shape', ['square', 'wide'], ['App icons', 'Wide cards'], render);
      r = rw();
      cycle(r, 'App names', 'names', ['focus', 'always'], ['Selected app only', 'Always']);
      onoff(r, 'Motion', 'motion');
      h('Memory');
      r = rw();
      cycle(r, 'Smaller wallpaper to save memory', 'saveMem', ['auto', 'on', 'off'], ['Automatic: on for TVs under 1 GB', 'On', 'Off'], function () { wallShown = ''; showWall(); });
      p((st.memTotal ? 'This TV has ' + st.memTotal + ' MB of memory, so it is ' + (lowMem() ? 'on' : 'off') + '. ' : '') + 'Uses a 1280 x 720 copy of the wallpaper, which takes under half the memory of the full-size one and looks almost the same.');
      h('Screen');
      r = rw();
      onoff(r, 'Clock, date and weather', 'showBar');
      onoff(r, 'Button hints at the bottom', 'showHints');
      p('Hold OK on an app (or press Red) to rename it, give it your own icon, recolour its tile, move it along the dock or hide it.');
    }

    if (name === 'Dock') {
      r = rw();
      cycle(r, 'Position', 'dockPos', ['top', 'bottom'], ['Top', 'Bottom'], function () { render(); });
      cycle(r, 'Alignment', 'dockAlign', ['left', 'center'], ['Left', 'Centre']);
      r = rw();
      cycle(r, 'Icon size', 'dockSize', ['s', 'm', 'l'], ['Small', 'Medium', 'Large'], render);
      onoff(r, 'Glass panel behind the dock', 'dockGlass');
      r = rw();
      cycle(r, 'Fill the dock with', 'dockFill', ['recent', 'used', 'none'], ['Recently opened apps', 'Most used apps', 'Nothing: only apps I pin'], render);
      cycle(r, 'Apps in the dock', 'dockCount', [3, 4, 5, 6, 7, 8, 9], ['3', '4', '5', '6', '7', '8', '9'], render);
      r = rw();
      btn(r, 'Unpin every app', String(st.pins.length), '', function () { st.pins = []; save(); render(); drawBody(true); });
      p('Apps you pin with Green always come first. The dock is then topped up to the number above with the apps you opened most recently (or use most). Hold OK (or press Red) on a pinned app to move it left or right.');
      p('In the calm style, Down from the dock (or its last tile) opens the menu of all apps and inputs. Up from the top row, or Back, closes it.');
    }

    wallPreview = name === 'Wallpaper' && st.nightWall ? wallFor : null;
    showWall();
    if (name === 'Wallpaper') {
      r = rw();
      onoff(r, 'Different wallpaper at night', 'nightWall', function () { wallFor = 'day'; redraw(true); });
      if (st.nightWall) {
        btn(r, 'Choosing the picture for', wallFor === 'night' ? 'Night' : 'Day', '', function () { wallFor = wallFor === 'night' ? 'day' : 'night'; redraw(true); });
      }
      h(st.nightWall && wallFor === 'night' ? 'Night picture' : st.nightWall ? 'Day picture' : 'Built in');
      wallPicker(rw);
      if (st.nightWall) { p('Night starts at sunset for the place chosen under Clock. ' + sunLine()); }
      h('Online photos (used by day)');
      r = rw();
      btn(r, 'Use online photos', st.wall.kind === 'online' ? 'On' : 'Off', st.wall.kind === 'online' ? 'on' : '', function () {
        set('wall', st.wall.kind === 'online' ? copy(LOOK.wall) : { kind: 'online', preset: 'Black', src: '', seed: Date.now() });
      });
      cycle(r, 'New photo', 'wallEvery', ['day', 'hour', 'open'], ['Every day', 'Every hour', 'Only when I choose']);
      btn(r, 'Next photo', null, '', function () { st.wallEvery = 'open'; set('wall', { kind: 'online', preset: 'Black', src: '', seed: Date.now() }); });
      p('Photos come from Lorem Picsum (picsum.photos), a free photo service. Nothing about you is sent except the request for a picture.');
      h('Your own picture');
      r = rw();
      f = field(r, 'https://… address of a picture', function (v) { if (v) { set('wall', { kind: 'url', preset: 'Black', src: v }); } }, st.wall.kind === 'url' ? st.wall.src : '');
      btn(r, 'Use', null, 'slim', f.__go);
      r = rw();
      btn(r, 'Find pictures on USB and TV storage', null, '', findWalls);
      (wallHits || []).forEach(function (path) {
        btn(rw(), path.replace(/^.*\//, ''), path.replace(/\/[^\/]*$/, ''), '', function () { useWallFile(path); });
      });
      if (wallHits && !wallHits.length) { p('No JPEG or PNG pictures under 8 MB were found.'); }
      h('Brightness');
      r = rw();
      cycle(r, 'Darken the wallpaper', 'dim', [0, 20, 40, 60], ['Off', 'A little', 'More', 'A lot']);
    }

    if (name === 'Widgets') {
      h('On the home screen');
      if (!st.widgets.length) { p('No widgets yet. Add up to five from the list below.'); }
      st.widgets.forEach(function (w, i) {
        r = rw();
        btn(r, WIDGETS[w.type], widgetSummary(w), 'wide', function () {});
        btn(r, 'Left', null, 'slim', function () { moveWidget(i, -1); });
        btn(r, 'Right', null, 'slim', function () { moveWidget(i, 1); });
        btn(r, 'Remove', null, 'slim', function () { st.widgets.splice(i, 1); widgetsChanged(); });
        if (w.type === 'world') {
          r = rw();
          btn(r, 'City', (ZONES[w.zone || 0] || ZONES[0])[0], '', function () { w.zone = ((w.zone || 0) + 1) % ZONES.length; widgetsChanged(); });
        }
        if (w.type === 'countdown') {
          r = rw();
          var a = field(r, 'What it is, for example Holiday', function () {}, w.label || '');
          var b = field(r, 'Date as 2026-12-25', function () {}, w.date || '');
          btn(r, 'Save', null, 'slim', function () {
            if (b.value && !/^\d{4}-\d{1,2}-\d{1,2}$/.test(trim(b.value))) { toast('Write the date as year-month-day, for example 2026-12-25.'); return; }
            w.label = trim(a.value); w.date = trim(b.value); widgetsChanged();
          });
          a.__go = b.__go = function () {};
        }
        if (w.type === 'note') {
          r = rw();
          f = field(r, 'Your note', function (v) { w.text = v; widgetsChanged(); }, w.text || '');
          btn(r, 'Save', null, 'slim', f.__go);
        }
        if (w.type === 'photo') {
          r = rw();
          f = field(r, 'https://… address of a picture', function (v) { w.url = v; widgetsChanged(); }, w.url || '');
          btn(r, 'Save', null, 'slim', f.__go);
        }
      });
      h('Add a widget');
      Object.keys(WIDGETS).forEach(function (type, i) {
        if (i % 3 === 0) { r = rw(); }
        btn(r, WIDGETS[type], null, '', function () {
          if (st.widgets.length >= 5) { toast('Five widgets is the most that fit. Remove one first.'); return; }
          st.widgets.push({ type: type }); widgetsChanged();
        });
      });
      h('Layout');
      r = rw();
      cycle(r, 'Widget alignment', 'widgetAlign', ['left', 'center'], ['Left', 'Centre']);
      p('Weather widgets use the place chosen in Settings, Clock. TV status needs Homebrew Channel with root.');
    }

    if (name === 'Apps') {
      r = rw();
      cycle(r, 'Order of all apps', 'sort', ['az', 'used', 'recent'], ['A to Z', 'Most used first', 'Recently opened first']);
      r = rw();
      onoff(r, 'Show TV inputs', 'showInputs');
      onoff(r, 'Live preview of inputs', 'preview');
      r = rw();
      btn(r, 'Bring back hidden apps', String(st.hidden.length), '', function () { st.hidden = []; save(); drawBody(true); });
      btn(r, 'Forget what I use most', null, '', function () { st.use = {}; st.last = {}; save(); toast('Usage counts cleared.'); });
      r = rw();
      btn(r, 'Check for new apps now', String(st.apps.length), '', function () { refreshApps(); toast('Checking…'); });
    }

    if (name === 'Clock') {
      r = rw();
      cycle(r, 'Clock', 'h24', [true, false], ['24 hour', '12 hour'], tick);
      onoff(r, 'Show the date', 'showDate');
      r = rw();
      onoff(r, 'Show the weather in the top bar', 'showWeather', weather);
      btn(r, 'Temperature', st.unitF ? 'Fahrenheit' : 'Celsius', '', function () { set('unitF', !st.unitF); weather(); });
      h('Weather location' + (st.city ? ':  ' + st.city.name : ''));
      r = rw();
      f = field(r, 'Town or city', function (q) {
        if (!q) { return; }
        getJSON('https://geocoding-api.open-meteo.com/v1/search?count=4&name=' + encodeURIComponent(q), function (res) {
          cityHits = (res && res.results) || [];
          if (!cityHits.length) { toast('No place found (or no connection to the weather service).'); }
          redraw(true);
        });
      });
      btn(r, 'Search', null, 'slim', f.__go);
      cityHits.forEach(function (hit) {
        btn(rw(), [hit.name, hit.admin1, hit.country].filter(function (x) { return x; }).join(', '), null, '', function () {
          st.city = { name: hit.name, lat: hit.latitude, lon: hit.longitude }; cityHits = []; save(); weather(); drawBody(true);
        });
      });
      r = rw();
      btn(r, 'Find my location automatically', null, '', useIpLocation);
      if (ipNote) { p(ipNote); }
      p('Automatic lookup uses your internet address, which is sent to ipapi.co. It is accurate to about a town and can be wrong; typing your town is more reliable. Your location sets the weather and the sunrise and sunset times.');
    }

    if (name === 'Standby') {
      r = rw();
      cycle(r, 'Start after', 'idle', [0, 10, 20, 30, 60, 120, 300], ['Never', '10 seconds', '20 seconds', '30 seconds', '1 minute', '2 minutes', '5 minutes']);
      btn(r, 'Try it now', null, 'slim', function () { closeOverlay(); sleep(); });
      h('Background');
      r = rw();
      cycle(r, 'Show', 'idleBg', ['wall', 'pictures', 'online', 'black'], ['The home wallpaper', 'Built-in pictures in turn', 'Online photos in turn', 'Black']);
      cycle(r, 'Change picture every', 'idleEvery', [60, 300, 900, 3600], ['Minute', '5 minutes', '15 minutes', 'Hour']);
      r = rw();
      onoff(r, 'Darken the background', 'idleDim');
      cycle(r, 'At night', 'idleNight', ['same', 'black'], ['Same as by day', 'Black with a dim clock']);
      h('On top of it');
      r = rw();
      onoff(r, 'Clock', 'idleClock');
      onoff(r, 'Date', 'idleDate');
      r = rw();
      onoff(r, 'Weather', 'idleWx', weather);
      onoff(r, 'My widgets', 'idleWidgets');
      p('In standby the dock and apps fade away and leave the background with whatever you switch on here. Widgets are the ones chosen in the Widgets tab, shown along the bottom. Everything shifts slightly each minute. Any button brings the home screen back, and Yellow starts standby straight away.');
    }

    if (name === 'Remote') {
      if (!sys) { p('Checking the TV…'); }
      else if (!sys.ok || !sys.root) { p('These options need Homebrew Channel showing "Root status: ok".'); }
      else {
        h('Home button');
        if (sys.homeApp === selfId()) {
          p('The TV\'s own Home setting opens Lantern. Lantern\'s Home-button mapping in LG Input Hook stays off, so the two never both fire.');
          r = rw();
          btn(r, 'Home opens', 'Lantern (TV setting)', '', function () { setHomeApp(st.homeApp.prev || LG_HOME, function () { redraw(true); }); });
          if (st.binds[HOME_CODE]) {
            btn(r, 'Remove the extra Home-button mapping', null, '', function () {
              clearBinds(Object.keys(st.binds).filter(function (c) { return HOME_CODES[c]; }), function () { redraw(true); });
            });
          }
        } else {
          if (sys.defaultApps) {
            r = rw();
            btn(r, 'Make Lantern the TV\'s Home app', 'Off', '', function () { setHomeApp(selfId(), function () { redraw(true); }); });
          }
          if (!sys.hook) {
            p((sys.defaultApps ? 'Or install' : 'Install') + ' LG Input Hook from Homebrew Channel and open it once. Lantern uses it to remap buttons' + (sys.defaultApps ? '.' : ' and to catch the Home button.'));
          } else {
            r = rw();
            btn(r, 'Home button opens (through LG Input Hook)', st.binds[HOME_CODE] ? 'Lantern' : 'LG Home', '', function () {
              if (st.binds[HOME_CODE]) { clearBinds(Object.keys(st.binds).filter(function (c) { return HOME_CODES[c]; }), function () { redraw(true); }); }
              else { setBind(HOME_CODE, { t: 'app', id: selfId() }, function () { redraw(true); }); }
            });
            p('Use one of these two, not both.');
          }
        }
        if (sys.hook) {
          if (!sys.hookLogs) { p('LG Input Hook is installed but not running. Open the LG Input Hook app once so it can start.'); }
          h('Other buttons');
          Object.keys(st.binds).forEach(function (code) {
            if (HOME_CODES[code]) { return; }
            r = rw();
            btn(r, 'Button ' + code + (KEYNAMES[code] ? ' (' + KEYNAMES[code] + ')' : '') + ' ' + describeBind(st.binds[code]), null, 'wide', function () {});
            btn(r, 'Put it back', null, '', function () { clearBinds([code], function () { redraw(true); }); });
          });
          r = rw();
          btn(r, 'Remap a button…', null, '', startLearn);
          p('Lantern asks you to press the button, shows what it does now, lets you choose what it should do, then asks you to confirm it works before keeping the change.');
        }
        h('Opening quickly');
        r = rw();
        btn(r, 'Instant Home', st.keep && st.rewarm && st.boot === 'ready' ? 'On' : 'Off', '', function () { instantHome(!(st.keep && st.rewarm && st.boot === 'ready')); });
        p(sys.noPreload
          ? 'This TV opened Lantern in front when asked to load it in the background, so background loading has been switched off. Lantern will still be kept in memory where the TV allows.'
          : 'Loads Lantern in the background after the TV starts, asks the TV to keep it in memory, and loads it again if the TV closes it. Home then resumes Lantern, without the TV\'s loading screen. The TV closes most apps when it goes to standby, so the first open after waking can still show that screen.');
        r = rw();
        btn(r, 'Keep Lantern in memory', st.keep ? 'On' : 'Off', '', function () { sysToggle(function () { st.keep = !st.keep; }); askKeepAlive(); });
        btn(r, 'Load it again if the TV closes it', st.rewarm ? 'On' : 'Off', '', function () { sysToggle(function () { st.rewarm = !st.rewarm; }); });
        h('When the TV starts');
        if (sys.lastInput && sys.lastInput !== selfId() && !appExists(sys.lastInput)) {
          p('The TV is set to start on an app that is no longer installed (' + sys.lastInput + '). Switch the option below on, or the TV may start on a blank screen.');
        }
        r = rw();
        btn(r, 'Start the TV on Lantern', sys.lastInput === selfId() && sys.autoHome !== 'on' ? 'On' : sys.lastInput === selfId() ? 'On, but LG Home opens too' : 'Off', '', function () { setStartApp(sys.lastInput !== selfId() || sys.autoHome === 'on', function () { redraw(true); }); });
        p('The TV opens Lantern itself as it starts, the same way it would open HDMI 1. Lantern is added to the input list for this, and it takes a full TV restart to show.' + (sys.autoHome === 'on' ? ' The TV\'s own "start on LG Home" option is on, which opens LG Home as well; switching this on (again) turns that off.' : ''));
        r = rw();
        btn(r, 'A few seconds after the TV starts', { off: 'Do nothing', open: 'Open Lantern', ready: 'Load Lantern in the background' }[st.boot], '', function () {
          sysToggle(function () { st.boot = { off: 'open', open: 'ready', ready: 'off' }[st.boot]; });
        });
        if (sys.homeApp !== selfId()) {
          r = rw();
          btn(r, 'Reopen Lantern when LG Home appears', st.watch ? 'On' : 'Off', '', function () { sysToggle(function () { st.watch = !st.watch; }); });
        }
        h('TV input');
        r = rw();
        btn(r, 'Show Lantern in the TV\'s input list', st.input ? 'On' : 'Off', '', function () {
          var want = !st.input;
          if (!want && sys.lastInput === selfId()) { toast('Switch off "Start the TV on Lantern" first: the TV starts on this input.'); return; }
          setInput(want, function (ok) {
            toast(ok ? (want ? 'Added. It can take a TV restart to appear in the input list.' : 'Removed from the input list.') : 'The TV refused that.');
            redrawIf('Remote');
          });
        });
        p('As an input, Lantern sits next to HDMI 1 and Live TV. "Start the TV on Lantern" above switches this on for you.');
      }
    }

    if (name === 'Tune-up') {
      if (!tune) { p('Checking the TV…'); }
      else if (!tune.ok) { p('These options need Homebrew Channel showing "Root status: ok".'); }
      else {
        h('Memory' + (tune.mem ? ':  ' + tune.mem.free + ' MB free of ' + tune.mem.total + ' MB' : ''));
        r = rw();
        btn(r, 'Close apps running in the background', String(closable().length), '', closeBackground);
        btn(r, 'Refresh', null, 'slim', function () { tuneProbe(function () { redrawIf('Tune-up'); }); });
        TUNE.forEach(function (g) {
          var have = g[1].filter(function (k) { return tune.set[k[0] + '/' + k[1]] !== undefined; });
          var on = have.filter(function (k) { return isOn(tune.set[k[0] + '/' + k[1]]); });
          var mine = g[1].filter(function (k) { return st.tune.orig[k[0] + '/' + k[1]] !== undefined; });
          h(g[0]);
          r = rw();
          if (!have.length) { btn(r, 'This TV has none of these settings', null, '', function () {}); }
          else if (on.length) { btn(r, 'Switch off', on.length + ' of ' + have.length + ' are on', '', function () { tuneOff(g); }); }
          else { btn(r, 'Off', have.length + (have.length === 1 ? ' setting' : ' settings'), '', function () {}); }
          if (mine.length) { btn(r, 'Put back', null, 'slim', function () { tuneBack(g); }); }
        });
        h('Apps the TV keeps loaded');
        if (tune.pre === undefined) { p('Asking the TV…'); }
        else if (!tune.pre) { p('This TV did not give a preload list, so there is nothing to change here.'); }
        else {
          tune.pre.forEach(function (a, i) {
            if (i % 3 === 0) { r = rw(); }
            if (keepPreload(a.id)) { btn(r, a.id === 'com.webos.app.fullhome' ? 'LG Home (full screen)' : labelFor(a.id), 'Kept', '', function () { toast('Lantern leaves Home, Live TV and the inputs loaded so switching stays quick.'); }); }
            else { btn(r, labelFor(a.id), a.on ? 'Loaded' : 'Off', '', function () { setPreload(a.id, !a.on); }); }
          });
          r = rw();
          btn(r, 'Switch off all of these except Home, Live TV and the inputs', null, '', preloadAllOff);
          p('An app switched off here opens a little more slowly but stops using memory while you are not using it. On the TV Lantern was measured on, Netflix and YouTube held about 97 MB and 77 MB this way. Lantern re-applies your choices each time the TV starts. Switching one off stops it being loaded from the next start; "Close apps running in the background" above frees the memory now.');
        }
        h('');
        r = rw();
        btn(r, 'Undo every tune-up change', String(Object.keys(st.tune.orig).length + st.tune.preOff.length), '', function () {
          restoreTune(function (ok) { applySystem(function () { toast(ok ? 'Tune-up changes undone.' : 'Could not undo them.'); tuneProbe(function () { redrawIf('Tune-up'); }); }); });
        });
        p('Lantern saves each setting before changing it and only switches off settings this TV actually has. It does not stop system services, uninstall apps or change firmware files. Some TVs switch a setting back on by themselves; check here again after a restart.');
      }
    }

    if (name === 'System') {
      if (sys && sys.ok && sys.root) { r = rw(); btn(r, 'Restart the TV', null, '', openRestart); }
      kv(body, 'Lantern', VERSION);
      if (!sys) { p('Checking the TV…'); }
      else {
        kv(body, 'Root access', !sys.ok ? 'No answer from Homebrew Channel' : sys.root ? 'Yes (commands run as root)' : 'No (commands do not run as root)');
        kv(body, 'Homebrew Channel', sys.hb ? 'Version ' + sys.hb : 'Not found');
        kv(body, 'LG Input Hook', sys.hook ? 'Installed' + (sys.hookLogs ? ', running' : ', not running') + (sys.hookBoot ? ', starts with the TV' : '') : 'Not installed');
        kv(body, 'Lantern start-up script', /55-lantern/.test(sys.init) ? 'Installed' : 'Not installed');
        kv(body, 'LG Home helper', sys.watch ? 'Running' : 'Not running');
        kv(body, 'Keep in memory', st.keep ? 'On' : 'Off');
        kv(body, 'Shown as a TV input', st.input ? 'Yes' : 'No');
        kv(body, 'TV\'s Home app', sys.homeApp ? labelFor(sys.homeApp) + ' (' + sys.homeApp + ')' : 'Not reported by this TV');
        kv(body, 'TV starts on', sys.lastInput ? labelFor(sys.lastInput) + (appExists(sys.lastInput) ? '' : ' (not installed)') : 'Not reported by this TV');
        kv(body, 'TV also opens LG Home at start', sys.autoHome ? (sys.autoHome === 'on' ? 'Yes' : 'No') : 'Not reported by this TV');
        kv(body, 'Smaller wallpaper', lowMem() ? 'On' : 'Off');
        kv(body, 'Background loading', sys.noPreload ? 'Not supported on this TV' : sys.warm ? 'Running' : 'Off');
        kv(body, 'Buttons remapped by Lantern', String(Object.keys(st.binds).length));
        kv(body, 'Memory', (function () {
          var m = {}; sys.mem.split('\n').forEach(function (l) { var q = l.split(':'); if (q.length === 2) { m[q[0]] = Math.round(parseInt(q[1], 10) / 1024); } });
          return m.MemTotal ? (m.MemAvailable || m.MemFree) + ' MB free of ' + m.MemTotal + ' MB' : '';
        })());
        kv(body, 'IP address', sys.ip);
      }
      kv(body, 'Model', tvInfo && tvInfo.modelName);
      kv(body, 'webOS TV version', tvInfo && tvInfo.sdkVersion);
      kv(body, 'Firmware', tvInfo && tvInfo.firmwareVersion);
      if (sys && sys.os) { kv(body, 'OS release', sys.os.replace(/["{},]/g, '').replace(/\s*\n\s*/g, ';  ')); }
      kv(body, 'Browser engine', (/Chrom(?:e|ium)\/[\d.]+/.exec(navigator.userAgent) || [navigator.userAgent])[0]);
      kv(body, 'Apps found', String(st.apps.length));
      r = rw();
      btn(r, 'Refresh', null, '', function () { tvInfo = null; probe(function () { redrawIf('System'); }); });
      btn(r, 'Run the setup steps again', null, '', function () { openSetup(0); });
    }

    if (name === 'Reset') {
      h('The TV');
      r = rw();
      btn(r, 'Restore TV defaults', null, '', function () { restoreTV(function () { redrawIf('Reset'); }); });
      p('Gives the Home button back to LG Home, puts back every button Lantern remapped (other LG Input Hook settings are kept), undoes every Tune-up change, removes the start-up script and helper scripts, stops asking the TV to keep Lantern in memory, gives the TV\'s Home app and start-up settings back if Lantern took them, and takes Lantern out of the input list. Lantern stays installed as an ordinary app.');
      h('Lantern');
      r = rw();
      btn(r, 'Reset Lantern\'s look', null, '', function () {
        var k; for (k in LOOK) { st[k] = copy(LOOK[k]); }
        save(); applyLook(); weather(); tick(); toast('Look reset.'); drawBody(true);
      });
      btn(r, 'Reset everything', null, '', function () {
        restoreTV(function () {
          var apps = st.apps, linked = st.linked;
          st = defaults(); st.apps = apps; st.linked = linked; st.setupDone = true;
          save(); applyLook(); drawWidgets(); weather(); tick(); redrawIf('Reset');
        });
      });
      p('"Reset everything" also restores the TV defaults and forgets your dock, widgets, hidden apps, names, icons, colours and weather location.');
    }

    if (pos && inBody) { focusAt(Math.max(1, pos.r), pos.c); }
  }
  function sunLine() {
    var t = sunTimes(new Date());
    return (st.city ? 'In ' + st.city.name + ' today the sun rises at ' : 'No place is chosen yet, so day runs from ') + fmtTime(t.rise) +
           (st.city ? ' and sets at ' : ' to ') + fmtTime(t.set) + '. Right now it counts as ' + (night ? 'night' : 'day') + '.';
  }
  function wallPicker(rw) {            // the built-in backgrounds as pictures; picks for day or night
    var r, forNight = st.nightWall && wallFor === 'night';
    WALLS.forEach(function (w, i) {
      var b, on = forNight ? st.wallNight === w[0] : st.wall.kind === 'preset' && st.wall.preset === w[0];
      if (i % 5 === 0) { r = rw(); }
      b = btn(r, '', null, 'pic' + (on ? ' on' : ''), function () {
        if (forNight) { set('wallNight', w[0]); } else { set('wall', { kind: 'preset', preset: w[0], src: '' }); }
      });
      b.style.backgroundImage = w[1].replace('url("walls/', 'url("walls/t-');     // small copies: nine full pictures would take about 70 MB to show
      b.appendChild(el('span', null, w[0]));
    });
  }
  function widgetsChanged() { save(); drawWidgets(); weather(); drawBody(true); }
  function moveWidget(i, d) {
    var j = i + d, w;
    if (j < 0 || j >= st.widgets.length) { return; }
    w = st.widgets.splice(i, 1)[0]; st.widgets.splice(j, 0, w); widgetsChanged();
  }
  function findWalls() {
    exec("find /tmp/usb /media/internal /media/developer -maxdepth 5 -type f \\( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \\) -size -8192k 2>/dev/null | grep -v '/usr/palm/' | head -n 18", function (err, out) {
      wallHits = out.split('\n').filter(function (l) { return l && l.indexOf("'") < 0; });
      if (err && !wallHits.length) { toast('That needs Homebrew Channel with root.'); wallHits = null; }
      redrawIf('Wallpaper');
    });
  }
  function useWallFile(path) {
    var ext = (/\.(jpe?g|png)$/i.exec(path) || ['', 'jpg'])[1].toLowerCase(), name = 'w' + Date.now() + '.' + ext, dir = appRoot() + '/wall';
    exec("mkdir -p '" + dir + "'; rm -f '" + dir + "'/w*; ln -sfn '" + path + "' '" + dir + '/' + name + "'", function (err) {
      if (err) { toast('Could not use that picture.'); return; }
      set('wall', { kind: 'file', preset: 'Black', src: 'wall/' + name });
    });
  }

  /* ---------- keys ---------- */

  function activate(n) { if (n && n.__fn) { n.__fn(); } }
  function onKey(code) {
    var typing = cur && cur.tagName === 'INPUT', at, len;
    if (!mode && wake()) { return true; }            // the first press only leaves standby
    if (mode === 'learn' && learn && (learn.step === 'wait' || learn.step === 'reading')) {
      if (code === KEY.BACK || code === KEY.ESC) { openSettings(TABS.indexOf('Remote')); return true; }
      if (code === KEY.OK && learn.step === 'wait' && !okHeld) { activate(cur); }
      return true;                                   // swallow everything else while listening
    }
    if (code === KEY.UP) { move(0, -1); return true; }
    if (code === KEY.DOWN) { move(0, 1); return true; }
    if (mode) {
      if (code === KEY.OK) {
        if (okHeld) { return true; }                 // still holding from the long press that opened this
        if (typing) { cur.__go(); } else { activate(cur); }
        return true;
      }
      if (mode === 'setup' && code === KEY.BLUE) { return true; }
      if (code === KEY.BACK || code === KEY.ESC || code === KEY.BLUE) {
        if (mode === 'setup') { if (typing) { move(1, 0); } else if (setupStep > 0) { setupGo(-1); } }
        else if (mode === 'learn' && learn && learn.step === 'trial') { undoLearn(); }
        else if (mode === 'learn' || pickFor) { openSettings(TABS.indexOf('Remote')); }
        else { closeOverlay(); }
        return true;
      }
      if (typing) {                                  // arrows leave the text field only from its ends
        at = cur.selectionStart; len = cur.value.length;
        if (code === KEY.RIGHT && at >= len) { move(1, 0); return true; }
        if (code === KEY.LEFT && at === 0 && cur.selectionEnd === 0) { move(-1, 0); return true; }
        return false;
      }
    } else {
      if (code === KEY.OK) {
        if (!okDown && cur && cur.__item) {
          okDown = true;
          okTimer = setTimeout(function () {
            if (okDown && isApp(cur)) { okHeld = true; okDown = false; openMenu(cur.__item); }
          }, 650);
        }
        return true;
      }
      if (code === KEY.RED) { if (isApp(cur)) { openMenu(cur.__item); } return true; }
      if (code === KEY.GREEN) {
        if (isApp(cur)) {
          togglePin(cur.__item.id);
          toast(title(cur.__item) + (has(st.pins, cur.__item.id) ? ' added to the dock' : ' removed from the dock'));
          render();
          if (!cur) { focusFirst(); }
        }
        return true;
      }
      if (code === KEY.YELLOW) { sleep(); return true; }
      if (code === KEY.BLUE) { openSettings(); return true; }
      if (code === KEY.BACK || code === KEY.ESC) {     // this is home: Back only returns to the dock
        if (inRows(cur) && $dock.querySelector('.t')) { focus($dock.querySelector('.t')); }
        return true;
      }
    }
    if (code === KEY.LEFT) { move(-1, 0); return true; }
    if (code === KEY.RIGHT) { move(1, 0); return true; }
    return false;
  }
  function onKeyUp(code) {
    if (code !== KEY.OK) { return; }
    clearTimeout(okTimer);
    if (okHeld) { okHeld = false; return; }
    if (okDown && !mode && cur && cur.__item) { okDown = false; if (cur.__kind === 'all') { openApps(); } else { launch(cur.__item.id); } }
    okDown = false;
  }

  /* ---------- lifecycle ---------- */

  function launchParams(e) {
    var p = e && e.detail;
    if (!p) { try { p = JSON.parse(window.PalmSystem.launchParams || '{}'); } catch (err) { p = {}; } }
    return p || {};
  }
  function comeToFront(params) {       // shown again: cheap work only, no rebuild
    if (mode && mode !== 'learn' && mode !== 'setup') { closeOverlay(); }
    wake(); tick(); showWall(); startTimers();
    if (pendingSetup && !mode) { pendingSetup = false; openSetup(0); }
    if (!mode) { focusFirst(); if (!cur) { render(); } }
    if (Date.now() - lastRefresh > 10 * 60 * 1000) { refreshApps(); weather(); }
    else if (wxStale(30)) { weather(); }       // nothing yet, or an old reading: ask now, not at the next half hour
    if (hasWidget('tv')) { tvTries = 0; tvStatus(); }
    if (learn && learn.step === 'wait') { pollLearn(); }
    if (params && params.standby) { sleep(); }
  }

  load();
  try { localStorage.removeItem('lantern.wx'); } catch (e0) {}      // a forecast saved by an unreleased build
  applyLook();
  drawWidgets();
  showWx();
  tick();
  render();                      // instant, from the cached app list
  focusFirst();
  startTimers();
  wake();
  setTimeout(function () {       // slower checks wait until the screen is up
    refreshApps(); weather(); askKeepAlive(); readMemory();
    if (launchParams().standby) { sleep(); }
    if (!st.setupDone) { if (document.hidden) { pendingSetup = true; } else { openSetup(0); } }
  }, 1500);
  if (document.hidden) { stopTimers(); }       // loaded in the background: stay quiet until shown

  document.addEventListener('keydown', function (e) { if (onKey(e.keyCode)) { e.preventDefault(); } }, true);
  document.addEventListener('keyup', function (e) { onKeyUp(e.keyCode); }, true);
  document.addEventListener('mousemove', function () { if (!mode) { wake(); } });
  // one listener for every tile and button, instead of two per element
  document.addEventListener('mouseover', function (e) {
    var n = closest(e.target, mode ? 'b' : 't');
    if (n && (mode ? $sheet.contains(n) : !!n.__item)) { focus(n); }
  });
  document.addEventListener('click', function (e) {
    var n;
    if (mode) {
      if (e.target === $overlay) { if (mode === 'learn' && learn && learn.step === 'trial') { undoLearn(); } else if (mode !== 'setup') { closeOverlay(); } return; }
      n = closest(e.target, 'b');
      if (n && n.tagName === 'INPUT') { focus(n); } else if (n) { focus(n); activate(n); }
      return;
    }
    if (wake()) { return; }
    if (e.target.id === 'lgset' || (e.target.parentNode && e.target.parentNode.id === 'lgset')) { openSettings(); return; }
    if (e.target.id === 'lgall' || (e.target.parentNode && e.target.parentNode.id === 'lgall')) { openApps(); return; }
    n = closest(e.target, 't');
    if (n && n.__kind === 'all') { openApps(); } else if (n && n.__item) { launch(n.__item.id); }
  });
  document.addEventListener('webOSRelaunch', function (e) {
    if (Date.now() - selfLaunchAt < 4000) { selfLaunchAt = 0; return; }   // our own keep-in-memory request, not the user
    comeToFront(launchParams(e));
  });
  window.addEventListener('online', function () { if (wxStale(10)) { weather(); } });       // the TV reports its network came up
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hidePreview(); stopTimers(); releaseWall(); if (quiet) { wake(); clearTimeout(idleTimer); } }
    else { comeToFront(); }
  });
})();
