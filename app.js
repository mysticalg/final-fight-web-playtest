import {Encounter} from './game/encounter.js?v=47e20c535b';
import {Presentation} from './game/presentation.js?v=47e20c535b';
import {readGamepad} from './game/gamepad.js?v=47e20c535b';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d', {alpha:false});
const status = document.querySelector('#status');
const character = document.querySelector('#character');
const keys = new Set(), touch = new Set();
const bindings = {ArrowRight:1, ArrowLeft:2, ArrowDown:4, ArrowUp:8, KeyZ:16, KeyX:32, KeyC:48};
let paused = false, encounter, player, enemy, data, presentation;
let gamepadState = null, gamepadInput = 0, pulseInput = 0;
const controllerStatus = document.querySelector('#controller-status');
const stateLabels={leaping:'jumping',escapePending:'special',escape:'special',escapeLanding:'recovering',grabInit:'grabbing',grabHoldPending:'holding',grabHold:'holding',grabCarryPending:'carrying',grabCarry:'carrying',grabKneePending:'knee strike',grabKnee:'knee strike',grabThrowPending:'throwing',grabThrow:'throwing',grabThrowRelease:'throwing',grabJumpPending:'jumping',grabJumpStart:'jumping',grabJumpAir:'jumping',grabJumpLand:'landing',grabPileRelease:'piledriver',postPile:'recovering',postPileAir:'recovering',postThrow:'recovering',heldPending:'grabbed',held:'grabbed',thrownPending:'thrown',thrown:'thrown',thrownBounce:'falling',thrownSlide:'falling',slamInit:'falling',slamFlight:'falling',slamSlide:'falling',releasedPending:'recovering',releasedWait:'recovering',releasedFallPending:'falling',releasedFall:'falling',releasedFloorWait:'recovering',idle:'ready',walkPending:'walking',walk:'walking',stopping:'ready',idlePending:'ready',punchPending:'punching',punch:'punching',jumpPending:'jumping',jumpStart:'jumping',airborne:'jumping',landingPending:'landing',landing:'landing',hurtPending:'hit',hurt:'hit',knockdownInit:'knocked down',knockdown:'knocked down',hurtBounce:'knocked down',hurtSlide:'knocked down',recoverPending:'getting up',recoverInit:'getting up',recoverWait:'knocked down',recover:'getting up',dead:'defeated',seek:'looking',choosePosition:'repositioning',approach:'approaching',runInit:'closing in',run:'closing in',attack:'attacking',waitPosition:'waiting',fallInit:'falling',fall:'falling',bounce:'falling',slide:'falling',defeated:'defeated',stationary:'stationary'};

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
  encounter = new Encounter(data,character.selectedIndex,{stationary:document.querySelector('#encounter-mode').value==='stationary',enemyVariant:document.querySelector('#enemy').selectedIndex});
  player=encounter.player;enemy=encounter.enemy;
  canvas.setAttribute('aria-label',`Native Final Fight encounter. Arrow keys move, Z punches, X jumps. ${enemy.character.name} ${encounter.stationary?'is a stationary target':'approaches and attacks'}.`);
  clearInput(); canvas.focus();
  if(presentation)draw();
}
character.addEventListener('change', reset);
document.querySelector('#enemy').addEventListener('change',reset);
document.querySelector('#encounter-mode').addEventListener('change',reset);
document.querySelector('#reset').addEventListener('click', reset);
function togglePause() {
  paused = !paused; clearInput(); document.querySelector('#pause').textContent = paused ? 'Resume' : 'Pause'; canvas.focus();
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
    if (action === 'pause') togglePause();
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
  encounter.step(input());
  pulseInput = 0;
}
function draw() {
  presentation.draw(context,player,enemy);
  status.textContent = `${player.character.name} · HP ${Math.max(0,player.health)}/${player.character.health} · ${paused?'paused':stateLabels[player.mode]} · build ${data.version}`;
  const enemyState=enemy.mode==='neutral'?(enemy.brain?.phase===18&&enemy.brain?.attackStep===4?'leaping':enemy.brain?.state??'stationary'):enemy.mode;
  document.querySelector('#combat-status').textContent = `${enemy.character.name} · ${stateLabels[enemyState]} · HP ${Math.max(0,enemy.health)}/${enemy.character.health} · ${encounter.hits} landed · ${encounter.receivedHits} received`;
}
try {
  const metadata = await fetch('./assets/game.json?v=47e20c535b');
  if (!metadata.ok) throw new Error('Game assets could not load. Reload the page to try again.');
  data = await metadata.json();
  presentation = await Presentation.load(data);
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
