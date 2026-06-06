const {JSDOM}=require("jsdom");const fs=require("fs");const path=require("path");const SRC=path.join(process.cwd(),"src");
const dom=new JSDOM(fs.readFileSync(path.join(SRC,"index.html"),"utf8"),{runScripts:"outside-only",pretendToBeVisual:true,url:"https://x/"});
const {window}=dom;global.window=window;global.document=window.document;
window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
const ap=()=>({setValueAtTime(){},setTargetAtTime(){},exponentialRampToValueAtTime(){},linearRampToValueAtTime(){},value:0});
const anode=()=>({connect(){return anode()},start(){},stop(){},gain:ap(),frequency:ap(),Q:ap(),type:"",buffer:null,getChannelData:()=>new Float32Array(1)});
window.AudioContext=window.webkitAudioContext=function(){return{createOscillator:anode,createGain:anode,createBuffer:anode,createBufferSource:anode,createBiquadFilter:anode,destination:anode(),currentTime:0,resume(){},state:"running",sampleRate:44100}};
window.localStorage=(()=>{let s={};return{getItem:k=>k in s?s[k]:null,setItem:(k,v)=>s[k]=String(v),removeItem:k=>delete s[k],clear:()=>s={}}})();
window.sessionStorage=window.localStorage;window.navigator.vibrate=()=>{};window.requestAnimationFrame=()=>1;window.cancelAnimationFrame=()=>{};window.performance={now:()=>Date.now()};
window.HTMLCanvasElement.prototype.getContext=()=>({scale(){},clearRect(){},fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},arc(){},closePath(){},save(){},restore(){},translate(){},rotate(){},fillText(){},createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}})});
// capture turn-timer setTimeout: track callbacks with ~25s delay
let timers=[]; const realSetTimeout=null;
window.setTimeout=(fn,ms)=>{timers.push({fn,ms});return timers.length};window.clearTimeout=(id)=>{ if(id&&timers[id-1])timers[id-1]=null; };
function flush(maxMs){ // run all timers with ms<=maxMs once
  for(let i=0;i<timers.length;i++){ const t=timers[i]; if(t&&t.ms<=maxMs){ timers[i]=null; try{t.fn()}catch(e){} } }
}
const T=fs.readFileSync("test-ui.js","utf8");const m=T.match(/const FILES = \[([\s\S]*?)\];/)[1];const FILES=m.split(",").map(s=>s.trim().replace(/^.|.$/g,"")).filter(Boolean);
for(const f of FILES){try{new window.Function(fs.readFileSync(path.join(SRC,f),"utf8")).call(window)}catch(e){}}
window.GameFeel.isBusy=()=>false;
const $=id=>window.document.getElementById(id);const cls=(el,c)=>el&&el.classList.contains(c);
window.SceneRouter.go("table",{players:6});$("btn-start").click();
// advance until hero action-area visible
let g=window.__debugHoldem._game(); let safety=0;
while(!(($("action-area")&&!cls($("action-area"),"hidden"))) && safety++<400){ flush(3000); // run sub-25s timers (bot turns ~<2.5s)
  // also need to act for hero if it's hero turn? we want to STOP at hero turn
}
const heroTurn=$("action-area")&&!cls($("action-area"),"hidden");
const heroBefore=g.players[0].folded;
// open table menu modal during hero turn
$("btn-table-menu").click();
const modalOpen=!cls($("table-modal"),"hidden");
// now simulate 25s passing: run timers with ms<=26000 (the turn timer is 25000)
flush(26000);
const heroAfter=g.players[0].folded;
const autoFolded = !heroBefore && heroAfter;
console.log(JSON.stringify({heroTurnReached:heroTurn, modalOpenedDuringTurn:modalOpen, heroFoldedBefore:heroBefore, heroFoldedAfter:heroAfter, BUG_autoFoldedWhileModalOpen:autoFolded}));
