export const WIDTH = 10, HEIGHT = 24, HIDDEN = 4;
export const NAMES = ['I','O','T','S','Z','J','L'];
const initial = [
  [[0,1],[1,1],[2,1],[3,1]], [[1,0],[2,0],[1,1],[2,1]],
  [[1,0],[0,1],[1,1],[2,1]], [[1,0],[2,0],[0,1],[1,1]],
  [[0,0],[1,0],[1,1],[2,1]], [[0,0],[0,1],[1,1],[2,1]],
  [[2,0],[0,1],[1,1],[2,1]]
];
export const SHAPES = initial.map((cells, kind) => {
  const rotations = [cells];
  for (let r=1; r<4; r++) rotations.push(kind===1 ? cells.map(c=>[...c]) : rotations[r-1].map(([x,y])=>[(kind===0?3:2)-y,x]));
  return rotations;
});
const KICKS = [
  [[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], [[0,0],[1,0],[1,1],[0,-2],[1,-2]],
  [[0,0],[1,0],[1,-1],[0,2],[1,2]], [[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]
];
const I_KICKS = [
  [[0,0],[-2,0],[1,0],[-2,1],[1,-2]], [[0,0],[-1,0],[2,0],[-1,-2],[2,1]],
  [[0,0],[2,0],[-1,0],[2,-1],[-1,2]], [[0,0],[1,0],[-2,0],[1,2],[-2,-1]]
];
export class Bag {
  constructor(random=Math.random) { this.random=random; this.queue=[]; }
  take() {
    if (!this.queue.length) {
      this.queue=[0,1,2,3,4,5,6];
      for (let i=6;i>0;i--) { const j=Math.floor(this.random()*(i+1)); [this.queue[i],this.queue[j]]=[this.queue[j],this.queue[i]]; }
    }
    return this.queue.pop();
  }
}
export class Game {
  constructor(random=Math.random) {
    this.random=random; this.phase='ready'; this.board=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(0));
    this.score=0; this.lines=0; this.placed=0; this.active=2; this.next=2; this.rotation=0; this.x=3; this.y=HIDDEN;
    this.gravity=0; this.lockTime=0; this.resets=0;
  }
  get level() { return 1+Math.floor(this.lines/10); }
  get interval() { return Math.max(80,850*Math.pow(.83,this.level-1)); }
  get cells() { return SHAPES[this.active][this.rotation]; }
  get grounded() { return !this.fits(this.active,this.rotation,this.x,this.y+1); }
  start() {
    this.board=Array.from({length:HEIGHT},()=>Array(WIDTH).fill(0));
    this.score=0; this.lines=0; this.placed=0; this.lastClear=0;
    this.bag=new Bag(this.random); this.next=this.bag.take(); this.phase='playing'; this.spawn();
  }
  spawn() {
    this.active=this.next; this.next=this.bag.take(); this.rotation=0; this.x=3; this.y=HIDDEN;
    this.gravity=0; this.lockTime=0; this.resets=0;
    if (!this.fits(this.active,this.rotation,this.x,this.y)) this.phase='over';
  }
  fits(kind,rotation,x,y) {
    return SHAPES[kind][rotation].every(([dx,dy])=>x+dx>=0&&x+dx<WIDTH&&y+dy>=0&&y+dy<HEIGHT&&!this.board[y+dy][x+dx]);
  }
  pause() { if(this.phase==='playing') this.phase='paused'; }
  resume() { if(this.phase==='paused') this.phase='playing'; }
  adjust(wasGrounded) { if(wasGrounded&&this.resets<15) { this.lockTime=0; this.resets++; } }
  move(direction) {
    if(this.phase!=='playing'||Math.abs(direction)!==1||!this.fits(this.active,this.rotation,this.x+direction,this.y)) return false;
    const grounded=this.grounded; this.x+=direction; this.adjust(grounded); return true;
  }
  rotate() {
    if(this.phase!=='playing'||this.active===1) return false;
    const next=(this.rotation+1)%4, grounded=this.grounded;
    for(const [dx,dy] of (this.active===0?I_KICKS:KICKS)[this.rotation]) {
      if(!this.fits(this.active,next,this.x+dx,this.y+dy)) continue;
      this.x+=dx; this.y+=dy; this.rotation=next; this.adjust(grounded); return true;
    }
    return false;
  }
  softDrop() {
    if(this.phase!=='playing'||this.grounded) return false;
    this.y++; this.score++; this.gravity=0; this.lockTime=0; return true;
  }
  hardDrop() {
    if(this.phase!=='playing') return;
    while(!this.grounded) { this.y++; this.score+=2; }
    this.lock();
  }
  advance(ms) {
    if(this.phase!=='playing'||!Number.isFinite(ms)||ms<=0) return;
    let left=Math.min(ms,250);
    while(left>0&&this.phase==='playing') {
      const step=Math.min(left,10); left-=step;
      if(this.grounded) { this.lockTime+=step; if(this.lockTime>=500) this.lock(); }
      else { this.gravity+=step; if(this.gravity>=this.interval) { this.gravity-=this.interval; this.y++; this.lockTime=0; } }
    }
  }
  lock() {
    for(const [dx,dy] of this.cells) this.board[this.y+dy][this.x+dx]=1;
    this.placed++;
    const level=this.level, remaining=this.board.filter(row=>!row.every(Boolean));
    this.lastClear=HEIGHT-remaining.length;
    while(remaining.length<HEIGHT) remaining.unshift(Array(WIDTH).fill(0));
    this.board=remaining;
    this.score+=[0,100,300,500,800][this.lastClear]*level;
    this.lines+=this.lastClear;
    if(this.board.slice(0,HIDDEN).some(row=>row.some(Boolean))) { this.phase='over'; return; }
    this.spawn();
  }
}

export function readRecord(storage) {
  try { const n=Number(storage.getItem('four-cells-record')); return Number.isSafeInteger(n)&&n>=0?n:0; } catch { return 0; }
}
export function saveRecord(storage,score) {
  try { storage.setItem('four-cells-record',String(Math.max(readRecord(storage),score))); return true; } catch { return false; }
}
