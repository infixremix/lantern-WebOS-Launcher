
function ev(t,c){var e=document.createEvent('Event');e.initEvent(t,true,true);e.keyCode=c;(document.activeElement||document).dispatchEvent(e);}
function key(c){ev('keydown',c);ev('keyup',c);}
function R(n,c){var a=[];while(n--)a.push(c);return a;}
function type(t,n){return function(){var i=document.querySelectorAll('#sheet input.b')[n||0];i.value=t;};}
function clickText(t){return function(){var b=document.querySelectorAll('#sheet .b'),i;for(i=0;i<b.length;i++){if(b[i].firstChild&&(b[i].firstChild.nodeValue===t||b[i].textContent===t)){b[i].__fn();return;}} window.__miss=(window.__miss||'')+'|'+t;};}
function tabTo(n){return function(){var t=document.getElementById('tabs').children[n];var e=document.createEvent('Event');e.initEvent('mouseover',true,true);t.dispatchEvent(e);};}
var W=1, WW=[W,W,W,W,W,W], REMOTE=[406,tabTo(7),W,W,W], REMOTE0=REMOTE;
var S={firstrun:[W,W], setupwalk:[W,W,clickText('Start'),W,clickText('Find it automatically'),W,W,W,clickText('Next'),W,clickText('Always dark'),W,clickText('Next'),W,clickText('Dusk ridge'),W,clickText('Next'),W,clickText('Apps in the dock'),W,clickText('Next'),W,clickText('Kodi'),W,clickText('Next'),W,clickText('Next'),W,W,W,clickText('Start the TV on Lantern'),W,W,W,W,clickText('Instant Home'),W,W,W,W,clickText('Next'),W,clickText('Finish'),W,W],
 setupfocus:[W,W,13,W,W,13,W,W,W,W],
 restorestart:REMOTE0.concat([clickText('Start the TV on Lantern'),W,W,W,W,W,tabTo(10),W,clickText('Restore TV defaults')]).concat(WW).concat(WW),
 starton:REMOTE0.concat([clickText('Start the TV on Lantern'),W,W,W,W,W]),
 setupshot:[W,W,clickText('Start'),W,clickText('Find it automatically'),W,W,W,W],
 setupend:[W,W,clickText('Start'),W,clickText('Find it automatically'),W,W,W].concat(R(7,clickText('Next'))).concat([W,W]),
 setupwall:[W,W,clickText('Start'),W,clickText('Skip for now'),W,clickText('Next'),W,clickText('Now choosing'),W,W],
 homeapp:REMOTE0.concat([clickText("Make Lantern the TV's Home app"),W,W,W,W,W]),
 homeback:REMOTE0.concat([clickText('Home opens'),W,W,W,W,W]),
 instant:REMOTE0.concat([clickText('Instant Home'),W,W,W,W,W]),
 home:[], up:[38], grid:[40,40,39], down:[40], downup:[40,38], downback:[40,40,39,461], alltile:[39,39,39,39,39,13], standby:[405], standbywake:[405,W,W,W,W,39], standbylong:[405,W,W,W,W,W], look:[406,W,W], wallpaper:[406,tabTo(2),W,W], standbytab:[406,tabTo(6),W,W],
 learnapp:REMOTE.concat([clickText('Remap a button…')]).concat(R(28,W)).concat([clickText('Open an app…'),W,clickText('Kodi'),W,W,W,clickText('Keep the change'),W,W]),
 learnshot:REMOTE.concat([clickText('Remap a button…')]).concat(R(28,W)),
 learnwait:REMOTE.concat([clickText('Remap a button…')]).concat(R(14,W)),
 learnundo:REMOTE.concat([clickText('Remap a button…')]).concat(R(28,W)).concat([clickText('Do nothing'),W,W,W,clickText('Put it back'),W,W,W]),
 learntimeout:REMOTE.concat([clickText('Remap a button…')]).concat(R(28,W)).concat([clickText('Start standby'),W,W]).concat(R(230,W)),
 learntrial:REMOTE.concat([clickText('Remap a button…')]).concat(R(28,W)).concat([clickText('Start standby'),W,W,W]),
 keep:REMOTE.concat([clickText('Keep Lantern in memory'),W,W,W,W]),
 boot:REMOTE.concat([clickText('A few seconds after the TV starts'),W,W,W,clickText('A few seconds after the TV starts'),W,W,W,clickText('Reopen Lantern when LG Home appears'),W,W,W]),
 input:REMOTE.concat([clickText("Show Lantern in the TV's input list"),W,W,W]),
 restore:REMOTE.concat([clickText('Keep Lantern in memory'),W,W,W,clickText('A few seconds after the TV starts'),W,W,W,clickText("Show Lantern in the TV's input list"),W,W,tabTo(10),W,clickText('Restore TV defaults')]).concat(WW).concat(WW),
 tune:[406,tabTo(8),W,W,W,W],
 preall:[406,tabTo(8),W,W,W,W,clickText('Switch off all of these except Home, Live TV and the inputs'),W,W,W,W,W],
 startoff:REMOTE0.concat([clickText('Start the TV on Lantern'),W,W,W,W,W,clickText('Start the TV on Lantern'),W,W,W,W,W]),
 tuneall:[406,tabTo(8),W,W,W,W,clickText('Close apps running in the background')].concat(R(8,W)).concat([clickText('Switch off'),W,W,W,clickText('Switch off'),W,W,W,clickText('Switch off'),W,W,W,clickText('Browser'),W,W,W,W]),
 tuneundo:[406,tabTo(8),W,W,W,W,clickText('Switch off'),W,W,W,clickText('Switch off'),W,W,W,clickText('Browser'),W,W,W,W,clickText('Undo every tune-up change')].concat(R(8,W)),
 tunerestore:[406,tabTo(8),W,W,W,W,clickText('Switch off'),W,W,W,clickText('Browser'),W,W,W,W,tabTo(10),W,clickText('Restore TV defaults')].concat(R(12,W)),
 widgets:[406,tabTo(3),W,W], dock:[406,tabTo(1),W,W], wall:[406,tabTo(2),W,W], system:[406,tabTo(9),W,W,W,W], remote:REMOTE,
 online:[406,tabTo(2),W,clickText('Use online photos'),W,W]};
var seq=S[SC]||[],i=0;
setTimeout(function step(){ if(i<seq.length){var k=seq[i++]; if(k===W){} else if(typeof k==='function')k(); else key(k); setTimeout(step,170);} else setTimeout(function(){var s=JSON.parse(localStorage.getItem('lantern.v2'));delete s.apps;document.title="DONE "+JSON.stringify({errs:window.__errs,appIds:JSON.parse(localStorage.getItem('lantern.v2')).apps.map(function(a){return a.id}),tiles:[].map.call(document.querySelectorAll('#rows .t .nm'),function(n){return n.textContent}),tune:s.tune,set:window.__set,pre:window.__pre.filter(function(x){return x.isEnabled===false}).map(function(x){return x.id}),run:window.__run,miss:window.__miss,launched:window.__launched,binds:s.binds,prev:s.prev,boot:s.boot,watch:s.watch,keep:s.keep,input:s.input,wcls:document.getElementById('widgets').className,wall:s.wall,wallNight:s.wallNight,calm:s.calm,setupDone:s.setupDone,city:s.city&&s.city.name,theme:s.theme,rewarm:s.rewarm,homeApp:s.homeApp,tvAuto:window.__auto,memTotal:s.memTotal,rowsDisplay:document.getElementById('rows').style.display,tvHome:window.__home,tvLast:window.__last,startApp:s.startApp,dockCount:s.dockCount,dock:[].map.call(document.querySelectorAll('#dock .t .nm'),function(n){return n.textContent}),dflt:window.__dfltWrite,idleBg:s.idleBg,bg:document.getElementById('wall').style.backgroundImage,kb:window.__kb.replace(/\s+/g,''),cls:document.body.className,mode:document.getElementById('overlay').className,h1:(document.querySelector('#sheet h1')||{}).textContent,big:[].map.call(document.querySelectorAll('#sheet p.big'),function(p){return p.textContent}),focus:(document.querySelector('.focus')||{}).textContent,luna:window.__luna.filter(function(l){return /eim/.test(l)}),sys:window.__cmds.filter(function(c){return /open\.sh|55-lantern/.test(c)}).slice(-1)[0],warm:(window.__cmds.filter(function(c){return /warm\.sh <</.test(c)}).slice(-1)[0]||'')});},1200); },2200);
