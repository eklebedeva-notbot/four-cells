import test from 'node:test';
import assert from 'node:assert/strict';
import {Game,Bag,SHAPES,HEIGHT,HIDDEN,readRecord,saveRecord} from './game.js';
const create=()=>{const g=new Game(()=>.5);g.start();return g;};
const fixture=(g,active,rotation,x,y)=>Object.assign(g,{active,rotation,x,y,gravity:0,lockTime:0,resets:0});
const advance=(g,ms)=>{while(ms>0){const n=Math.min(ms,50);g.advance(n);ms-=n;}};
const occupied=g=>g.board.flat().reduce((a,b)=>a+b,0);

test('Every rotation has four distinct connected cells',()=>{
  for(const rotations of SHAPES)for(const cells of rotations){
    assert.equal(cells.length,4);assert.equal(new Set(cells.map(c=>c.join(','))).size,4);
    const reached=[cells[0]];
    for(let n=0;n<4;n++)for(const c of cells)if(!reached.includes(c)&&reached.some(a=>Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1])===1))reached.push(c);
    assert.equal(reached.length,4);
  }
});
test('Seven-bag distribution',()=>{const b=new Bag();for(let n=0;n<100;n++)assert.equal(new Set(Array.from({length:7},()=>b.take())).size,7);});
test('Gravity and paused time',()=>{const g=create(),y=g.y;advance(g,400);g.pause();advance(g,10000);g.hardDrop();g.softDrop();g.move(-1);g.rotate();assert.equal(g.y,y);assert.equal(occupied(g),0);g.resume();advance(g,440);assert.equal(g.y,y);advance(g,10);assert.equal(g.y,y+1);});
test('All shapes and rotations stop at walls',()=>{for(let k=0;k<7;k++)for(let r=0;r<4;r++){const g=create();fixture(g,k,r,3,8);for(let n=0;n<20;n++)g.move(-1);assert.ok(g.fits(k,r,g.x,g.y));assert.equal(g.move(-1),false);for(let n=0;n<20;n++)g.move(1);assert.ok(g.fits(k,r,g.x,g.y));assert.equal(g.move(1),false);}});
test('T and I wall kicks',()=>{const g=create();fixture(g,2,1,-1,8);assert.ok(g.rotate());assert.equal(g.x,0);fixture(g,0,1,7,8);assert.ok(g.rotate());assert.equal(g.x,6);});
test('A blocked rotation does not move',()=>{const g=create();fixture(g,2,0,3,10);for(let y=6;y<16;y++)g.board[y].fill(1);for(const [x,y]of g.cells)g.board[g.y+y][g.x+x]=0;assert.equal(g.rotate(),false);assert.deepEqual([g.x,g.y,g.rotation],[3,10,0]);});
test('Hard drop locks exactly four cells and awards distance',()=>{const g=create();fixture(g,1,0,3,4);g.hardDrop();assert.equal(occupied(g),4);assert.equal(g.score,36);assert.equal(g.placed,1);});
for(let n=1;n<=4;n++)test(`Clear ${n} adjacent lines`,()=>{
  const g=create();for(let y=HEIGHT-n;y<HEIGHT;y++)for(let x=0;x<10;x++)if(x!==5)g.board[y][x]=1;
  g.board[10][0]=1;fixture(g,0,1,3,20);g.hardDrop();assert.equal(g.lines,n);assert.equal(g.score,[0,100,300,500,800][n]);assert.equal(occupied(g),5-n);assert.equal(g.board[10+n][0],1);
});
test('Clear nonadjacent rows',()=>{const g=create();for(const y of [21,23])for(let x=0;x<10;x++)if(x!==5)g.board[y][x]=1;g.board[22][0]=1;fixture(g,0,1,3,20);g.hardDrop();assert.equal(g.lines,2);assert.equal(occupied(g),3);assert.equal(g.board[23][0],1);});
test('Level and score transition',()=>{const g=create();for(let n=0;n<5;n++){for(const row of g.board)row.fill(0);for(let y=22;y<24;y++)for(let x=0;x<10;x++)if(x!==4&&x!==5)g.board[y][x]=1;fixture(g,1,0,3,22);g.hardDrop();}assert.equal(g.lines,10);assert.equal(g.level,2);assert.equal(g.score,1500);assert.ok(g.interval<850);});
test('500ms lock delay',()=>{const g=create();fixture(g,1,0,3,22);advance(g,490);assert.equal(g.placed,0);advance(g,10);assert.equal(g.placed,1);});
test('Lock resets are finite',()=>{const g=create();fixture(g,1,0,3,22);for(let n=0;n<15;n++){advance(g,400);g.move(n%2?-1:1);assert.equal(g.placed,0);}advance(g,400);g.move(-1);advance(g,100);assert.equal(g.placed,1);});
test('Blocked spawn, top-out, and restart',()=>{let g=create();g.board[5][4]=1;fixture(g,1,0,0,22);g.hardDrop();assert.equal(g.phase,'over');g.start();assert.equal(occupied(g),0);assert.equal(g.score,0);assert.equal(g.phase,'playing');g=create();fixture(g,1,0,3,2);g.board[HIDDEN][4]=1;g.hardDrop();assert.equal(g.phase,'over');});
test('Random actions preserve cell conservation and no overlaps',()=>{let seed=712;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);for(let n=0;n<50;n++){const g=new Game(random);g.start();for(let i=0;i<1500&&g.phase==='playing';i++){switch(Math.floor(random()*6)){case 0:g.move(-1);break;case 1:g.move(1);break;case 2:g.rotate();break;case 3:g.softDrop();break;case 4:g.hardDrop();break;default:g.advance(100);}if(g.phase==='playing')assert.ok(g.fits(g.active,g.rotation,g.x,g.y));assert.equal(occupied(g),g.placed*4-g.lines*10);}}});
test('Local record, reload, and corrupt/unavailable storage',()=>{const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};assert.equal(readRecord(storage),0);assert.ok(saveRecord(storage,123));assert.equal(readRecord(storage),123);saveRecord(storage,12);assert.equal(readRecord(storage),123);for(const x of ['bad','-1','Infinity','9007199254740992']){values.set('four-cells-record',x);assert.equal(readRecord(storage),0);}assert.equal(readRecord(null),0);assert.equal(saveRecord(null,3),false);});
