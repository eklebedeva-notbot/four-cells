import {Game,SHAPES,NAMES,WIDTH,HEIGHT,HIDDEN,readRecord,saveRecord} from './game.js';
const $=id=>document.getElementById(id), game=new Game();
const board=$('board'), next=$('next'), overlay=$('overlay'), confirm=$('confirm'), help=$('instructions');
let storage; try { storage=window.localStorage; } catch { storage=null; }
let best=readRecord(storage), savedBest=best, lastTime=performance.now(), lastPhase='ready', dirty=true;
const held=new Map(), keys=new Set(), pointers=new Map();
const modalOpen=()=>confirm.open||help.open;
const clearInput=()=>{held.clear();keys.clear();pointers.clear();document.querySelectorAll('.pressed').forEach(b=>b.classList.remove('pressed'));};
function persist() {
  best=Math.max(best,game.score);
  if(best>savedBest) { if(saveRecord(storage,best)) savedBest=best; else $('record').title='Не удалось сохранить рекорд на устройстве'; }
}
function pause() { game.pause();clearInput();persist();dirty=true; }
function start() { persist();clearInput();game.start();lastTime=performance.now();dirty=true; }
function toggle() {
  if(modalOpen()) return;
  if(game.phase==='playing') pause();
  else if(game.phase==='paused') { clearInput();game.resume();lastTime=performance.now();dirty=true; }
  else start();
}
function action(name) {
  if(modalOpen()||game.phase!=='playing') return;
  if(name==='left')game.move(-1); else if(name==='right')game.move(1);
  else if(name==='rotate')game.rotate(); else if(name==='down')game.softDrop(); else if(name==='drop')game.hardDrop();
  dirty=true;
}
function press(name) {
  if(held.has(name)||modalOpen()||game.phase!=='playing') return;
  if(name==='left')held.delete('right');if(name==='right')held.delete('left');
  action(name);
  if(['left','right','down'].includes(name))held.set(name,{elapsed:0,next:name==='down'?35:160});
}
function release(name) { held.delete(name); }
for(const button of document.querySelectorAll('[data-action]')) {
  const name=button.dataset.action;
  button.addEventListener('pointerdown',e=>{
    if(e.button!==0||modalOpen())return;
    e.preventDefault();button.setPointerCapture(e.pointerId);pointers.set(e.pointerId,name);button.classList.add('pressed');press(name);
  });
  const end=e=>{if(pointers.get(e.pointerId)===name){pointers.delete(e.pointerId);release(name);}button.classList.remove('pressed');};
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);button.addEventListener('lostpointercapture',end);
  button.addEventListener('click',e=>{if(e.detail===0)action(name);});
  button.addEventListener('contextmenu',e=>e.preventDefault());
}
const mapping={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'rotate',ArrowDown:'down',Space:'drop'};
window.addEventListener('keydown',e=>{
  if(modalOpen()||e.ctrlKey||e.metaKey||e.altKey)return;
  if((e.code==='Enter'||e.code==='Space')&&e.target.closest('button'))return;
  if(mapping[e.code]) {e.preventDefault();if(keys.has(e.code))return;keys.add(e.code);press(mapping[e.code]);}
  else if((e.code==='Escape'||e.code==='Enter')&&!e.repeat){e.preventDefault();toggle();}
});
window.addEventListener('keyup',e=>{keys.delete(e.code);if(mapping[e.code])release(mapping[e.code]);});
window.addEventListener('blur',pause);
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else lastTime=performance.now();});
window.addEventListener('pagehide',()=>{pause();persist();});
window.addEventListener('pageshow',()=>{lastTime=performance.now();dirty=true;});
$('pause').addEventListener('click',toggle);
$('overlay-action').addEventListener('click',toggle);
$('new-game').addEventListener('click',()=>{
  if(modalOpen())return;
  if(game.phase==='ready'||game.phase==='over'){start();return;}
  pause();confirm.returnValue='cancel';confirm.showModal();
});
confirm.addEventListener('close',()=>{clearInput();if(confirm.returnValue==='restart')start();else dirty=true;});
function showHelp(){pause();if(!modalOpen())help.showModal();}
$('help').addEventListener('click',showHelp);$('install-help').addEventListener('click',showHelp);
$('close-help').addEventListener('click',()=>help.close());
help.addEventListener('close',()=>{clearInput();dirty=true;});

function canvasContext(canvas) {
  const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,3);
  const w=Math.max(1,Math.round(rect.width*dpr)),h=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const ctx=canvas.getContext('2d');ctx.setTransform(w/rect.width,0,0,h/rect.height,0,0);return{ctx,width:rect.width,height:rect.height};
}
function block(ctx,x,y,cell,active,cellHeight=cell) {
  const padX=Math.max(1,cell*.075),padY=Math.max(1,cellHeight*.075);ctx.fillStyle=active?'#e8e8e8':'#a3a3a3';
  ctx.fillRect(x+padX,y+padY,cell-padX*2,cellHeight-padY*2);ctx.fillStyle=active?'#fff':'#c2c2c2';
  ctx.fillRect(x+padX,y+padY,cell-padX*2,1);
}
function render() {
  const {ctx,width,height}=canvasContext(board),cell=width/WIDTH,rows=HEIGHT-HIDDEN,cellHeight=height/rows;
  ctx.fillStyle='#1a1a1a';ctx.fillRect(0,0,width,height);ctx.strokeStyle='#292929';ctx.lineWidth=.6;
  for(let x=1;x<WIDTH;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,height);ctx.stroke();}
  for(let y=1;y<rows;y++){ctx.beginPath();ctx.moveTo(0,y*cellHeight);ctx.lineTo(width,y*cellHeight);ctx.stroke();}
  for(let y=HIDDEN;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(game.board[y][x])block(ctx,x*cell,(y-HIDDEN)*cellHeight,cell,false,cellHeight);
  if(game.phase==='playing'||game.phase==='paused')for(const [dx,dy]of game.cells)if(game.y+dy>=HIDDEN)block(ctx,(game.x+dx)*cell,(game.y+dy-HIDDEN)*cellHeight,cell,true,cellHeight);
  const p=canvasContext(next);p.ctx.clearRect(0,0,p.width,p.height);
  if(game.phase!=='ready') {
    const cells=SHAPES[game.next][0],minX=Math.min(...cells.map(c=>c[0])),minY=Math.min(...cells.map(c=>c[1]));
    const pc=Math.min(p.width/4,p.height/3);
    for(const [x,y]of cells)block(p.ctx,(x-minX)*pc,(y-minY)*pc,pc,true);
    next.setAttribute('aria-label','Следующая фигура: '+NAMES[game.next]);
  }
  best=Math.max(best,game.score);
  for(const [id,value]of Object.entries({score:game.score,record:best,lines:game.lines,level:game.level})) {
    const text=value.toLocaleString('ru-RU');if($(id).textContent!==text)$(id).textContent=text;
  }
  overlay.hidden=game.phase==='playing';
  if(!overlay.hidden) {
    const labels={ready:['Четыре\nклетки','Собирай полные линии','Начать игру'],paused:['Пауза','Можно выдохнуть','Продолжить'],over:['Игра\nокончена','Счёт: '+game.score.toLocaleString('ru-RU'),'Ещё раз']}[game.phase];
    $('overlay-title').innerText=labels[0];$('overlay-text').textContent=labels[1];$('overlay-action').textContent=labels[2];
  }
  $('pause').disabled=game.phase==='ready'||game.phase==='over';
  $('pause').textContent=game.phase==='paused'?'Продолжить':'Пауза';$('pause').setAttribute('aria-label',$('pause').textContent);
  for(const b of document.querySelectorAll('[data-action]'))b.disabled=game.phase!=='playing';
  board.setAttribute('aria-label',`Игровое поле. ${game.phase==='playing'?'Игра':game.phase==='paused'?'Пауза':game.phase==='over'?'Игра окончена':'Готово к игре'}. Счёт ${game.score}, линий ${game.lines}.`);
  document.body.dataset.phase=game.phase;dirty=false;
}
new ResizeObserver(()=>{dirty=true;}).observe(board.parentElement);
function frame(now) {
  const delta=Math.min(100,Math.max(0,now-lastTime));lastTime=now;
  if(game.phase==='playing'&&!modalOpen()){
    for(const [name,state]of held){state.elapsed+=delta;while(state.elapsed>=state.next){action(name);state.next+=name==='down'?35:48;}}
    const x=game.x,y=game.y,r=game.rotation,placed=game.placed;game.advance(delta);
    if(x!==game.x||y!==game.y||r!==game.rotation||placed!==game.placed)dirty=true;
  }
  if(lastPhase!==game.phase){if(game.phase==='over'){clearInput();persist();}lastPhase=game.phase;dirty=true;}
  if(dirty)render();requestAnimationFrame(frame);
}
render();requestAnimationFrame(frame);

async function prepareOffline() {
  const status=$('offline-status');
  if(!('serviceWorker'in navigator)||!window.isSecureContext){status.textContent='Офлайн-режим требует HTTPS';return;}
  try {
    const base=new URL('./',location.href);
    let registration=await navigator.serviceWorker.getRegistration(base.href);
    if(!registration||registration.scope!==base.href)registration=await navigator.serviceWorker.register(new URL('sw.js',base),{scope:base.href});
    await navigator.serviceWorker.ready;
    if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>reject(new Error('No controlling worker')),10000);
      navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timeout);resolve();},{once:true});
    });
    const ready=await new Promise(resolve=>{
      const channel=new MessageChannel(),timeout=setTimeout(()=>resolve(false),5000);
      channel.port1.onmessage=e=>{clearTimeout(timeout);channel.port1.close();resolve(e.data?.ready===true);};
      navigator.serviceWorker.controller.postMessage({type:'CHECK_OFFLINE'},[channel.port2]);
    });
    status.textContent=ready?'Готово без интернета':'Открой с интернетом для сохранения';
    status.dataset.ready=String(ready);
    if(ready&&navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  }catch{status.textContent='Не сохранено офлайн — попробуй с интернетом';status.dataset.ready='false';}
}
prepareOffline();
