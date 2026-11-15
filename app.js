import {StreetWorld} from './game/street-world.js?v=0854a9c44d';
import {Presentation} from './game/presentation.js?v=0854a9c44d';
import {readGamepad} from './game/gamepad.js?v=0854a9c44d';
import {GameAudio} from './game/audio.js?v=0854a9c44d';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d', {alpha:false});
const status = document.querySelector('#status');
const character = document.querySelector('#character');
const keys = new Set(), touch = new Set();
const bindings = {ArrowRight:1, ArrowLeft:2, ArrowDown:4, ArrowUp:8, KeyZ:16, KeyX:32, KeyC:48};
let paused = false, encounter, player, enemy, data, presentation, audio;
const audioButton=document.querySelector('#audio');
audioButton.addEventListener('click',()=>{if(audio?.enabled)audio.disable();else audio?.enable();});
document.addEventListener('visibilitychange',()=>audio?.setHidden(document.hidden));
let gamepadState = null, gamepadInput = 0, pulseInput = 0;
const controllerStatus = document.querySelector('#controller-status');
const stateLabels={leaping:'jumping',escapePending:'special',escape:'special',escapeLanding:'recovering',grabInit:'grabbing',grabHoldPending:'holding',grabHold:'holding',grabCarryPending:'carrying',grabCarry:'carrying',grabKneePending:'knee strike',grabKnee:'knee strike',grabThrowPending:'throwing',grabThrow:'throwing',grabThrowRelease:'throwing',grabJumpPending:'jumping',grabJumpStart:'jumping',grabJumpAir:'jumping',grabJumpLand:'landing',grabPileRelease:'piledriver',postPile:'recovering',postPileAir:'recovering',postThrow:'recovering',heldPending:'grabbed',held:'grabbed',thrownPending:'thrown',thrown:'thrown',thrownBounce:'falling',thrownSlide:'falling',slamInit:'falling',slamFlight:'falling',slamSlide:'falling',releasedPending:'recovering',releasedWait:'recovering',releasedFallPending:'falling',releasedFall:'falling',releasedFloorWait:'recovering',idle:'ready',walkPending:'walking',walk:'walking',stopping:'ready',idlePending:'ready',punchPending:'punching',punch:'punching',jumpPending:'jumping',jumpStart:'jumping',airborne:'jumping',landingPending:'landing',landing:'landing',hurtPending:'hit',hurt:'hit',knockdownInit:'knocked down',knockdown:'knocked down',hurtBounce:'knocked down',hurtSlide:'knocked down',recoverPending:'getting up',recoverInit:'getting up',recoverWait:'knocked down',recover:'getting up',dead:'defeated',seek:'looking',choosePosition:'repositioning',approach:'approaching',runInit:'closing in',run:'closing in',attack:'attacking',waitPosition:'waiting',fallInit:'falling',fall:'falling',bounce:'falling',slide:'falling',defeated:'defeated',corpse:'defeated',removePending:'defeated',removed:'cleared',stationary:'stationary'};

Object.assign(stateLabels,{freefallPending:'falling',freefall:'falling',wallClingPending:'wall jump',wallCling:'wall cling',wallAir:'wall jump'});

Object.assign(stateLabels,{freefallPending:'falling',freefall:'falling',wallClingPending:'wall jump',wallCling:'wall cling',wallAir:'wall jump'});

function clearInput() { keys.clear(); touch.clear(); pulseInput = 0; document.querySelectorAll('.held').forEach(button => button.classList.remove('held')); }
window.addEventListener('blur', clearInput);
canvas.addEventListener('blur', clearInput);
document.addEventListener('visibilitychange', () => { if (document.hidden) clearInput(); });
canvas.addEventListener('keydown', event => { if (bindings[event.code]) { keys.add(event.code); pulseInput |= bindings[event.code]; event.preventDefault(); } });
canvas.addEventListener('keyup', event => { keys.delete(event.code); if (bindings[event.code]) event.preventDefault(); });
for (const button of document.querySelectorAll('[data-input]')) {
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touch.add(button); pulseInput |= Number(button.dataset.input); button.classList.add('held'); canvas.focus(); });
  button.addEventListener('click', event => { if (event.detail === 0) { canvas.focus(); pulseInput |= Number(button.dataset.input); } });
  for (const name of ['pointerup','pointercancel','lostpointercapture']) button.addEventListener(name, () => { touch.delete(button); button.classList.remove('held'); });
}
function reset() {
  if (!data) return;
  paused=false;document.querySelector('#pause').textContent='Pause';audio?.setPaused(false);
  encounter = new StreetWorld(data,data.scenes,character.selectedIndex);
  player=encounter.player;enemy=encounter.enemy;
  audio?.restart();
  canvas.setAttribute('aria-label','Final Fight. Arrow keys move, Z punches, X jumps. Fight through the Slum and head right.');
  clearInput(); canvas.focus();
  if(presentation)draw();
}
character.addEventListener('change', reset);


document.querySelector('#reset').addEventListener('click', reset);
document.querySelector('#continue').addEventListener('click',()=>{encounter?.continueGame();player=encounter.player;canvas.focus();});
function togglePause() {
  paused = !paused; clearInput(); document.querySelector('#pause').textContent = paused ? 'Resume' : 'Pause'; canvas.focus();
  audio?.setPaused(paused);
  if(presentation)draw();
}
document.querySelector('#pause').addEventListener('click', togglePause);
function pollController() {
  const available = navigator.getGamepads ? [...navigator.getGamepads()] : [];
  const pad = available.find(item => item?.connected && item.mapping === 'standard') ?? available.find(item => item?.connected);
  const sample = readGamepad(pad,gamepadState);
  gamepadState = sample.state;
  const focused = !document.hidden && document.hasFocus();
  gamepadInput = focused ? sample.input : 0;
  controllerStatus.textContent = sample.connected ? (sample.standard ? 'Controller connected · standard mapping' : 'Controller connected · nonstandard mapping; check buttons') : 'No controller detected · connect one and press a button';
  if (!focused) { gamepadState = null; return; }
  for (const action of sample.actions) {
    if (action === 'pause') {if(encounter.gameOver){encounter.continueGame();player=encounter.player;}else togglePause();}
    if (action === 'reset') reset();
    if (action === 'nextCharacter' || action === 'previousCharacter') {
      const direction = action === 'nextCharacter' ? 1 : -1;
      character.selectedIndex = (character.selectedIndex + direction + data.characters.length) % data.characters.length;
      reset();
    }
  }
}
window.addEventListener('gamepaddisconnected', () => { gamepadInput = 0; gamepadState = null; });
function input() {
  let value = 0;
  for (const key of keys) value |= bindings[key];
  for (const button of touch) value |= Number(button.dataset.input);
  return value | gamepadInput | pulseInput;
}
function step() {
  if (paused) return;
  encounter.step(input());player=encounter.player;enemy=encounter.enemy;
  audio?.play(encounter.sounds);
  pulseInput = 0;
}
function draw() {
  presentation.draw(context,player,encounter.actors,encounter.view);
  status.textContent = `${player.character.name} · HP ${Math.max(0,player.health)}/${player.character.health} · ${encounter.lives} lives${player.weapon?' · '+player.weapon.character.name:''}${paused?' · paused':''}`;
  document.querySelector('#combat-status').textContent=encounter.gameOver?'GAME OVER':encounter.sectionIndex===2&&encounter.cleared?'SLUM CLEAR':`SLUM · ${['STREET','ROOM','ROOFTOP'][encounter.sectionIndex]}${encounter.cleared?' · GO →':''}${enemy?' · '+enemy.character.name+' '+Math.max(0,enemy.health)+'/'+(enemy.maxHealth??enemy.character.health):''}`;
  document.querySelector('#continue').hidden=!encounter.gameOver;

}
try {
  const metadata = await fetch('./assets/game.json?v=0854a9c44d');
  if (!metadata.ok) throw new Error('Game assets could not load. Reload the page to try again.');
  data = await metadata.json();
  audio=new GameAudio(data.audio,{onState:state=>{
    audioButton.disabled=state==='loading';
    audioButton.textContent=({loading:'Loading audio…',enabled:'Mute audio',disabled:'Enable audio',error:'Retry audio'})[state];
    document.querySelector('#audio-status').textContent=({loading:'Loading original music and effects…',enabled:'Original Slum music and recovered combat effects enabled.',disabled:'Audio off.',error:'Audio could not start. Select Retry audio to try again.'})[state];
  }});
  audio.setHidden(document.hidden);audioButton.disabled=false;
  presentation = await Presentation.load(data);
  await presentation.loadStage('0:1');
  await presentation.loadStage('0:2');
  reset(); draw();
  let previous = performance.now(), accumulator = 0;
  // CPS-1 cadence is approximately 59.64 Hz, not display refresh dependent.
  const frameTime = 1000 / (8000000 / (512 * 262));
  function animate(now) {
    pollController();
    accumulator += Math.min(now - previous, 100); previous = now;
    while (accumulator >= frameTime) { step(); accumulator -= frameTime; }
    draw(); requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
} catch (error) { status.textContent = error.message; }
