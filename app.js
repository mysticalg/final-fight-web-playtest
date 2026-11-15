import {Player} from './game/player.js?v=4ff6cbb6d1';
import {Presentation} from './game/presentation.js?v=4ff6cbb6d1';
import {readGamepad} from './game/gamepad.js?v=4ff6cbb6d1';
import {Enemy} from './game/enemy.js?v=4ff6cbb6d1';
import {contact} from './game/combat.js?v=4ff6cbb6d1';

const canvas = document.querySelector('#game');
const context = canvas.getContext('2d', {alpha:false});
const status = document.querySelector('#status');
const character = document.querySelector('#character');
const keys = new Set(), touch = new Set();
const bindings = {ArrowRight:1, ArrowLeft:2, ArrowDown:4, ArrowUp:8, KeyZ:16, KeyX:32};
let paused = false, player, enemy, data, presentation, hits=0;
let gamepadState = null, gamepadInput = 0, pulseInput = 0;
const controllerStatus = document.querySelector('#controller-status');

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
  player = new Player(data, character.selectedIndex);
  enemy = new Enemy(data,player.x+64*65536,player.y); hits=0;
  clearInput(); canvas.focus();
}
character.addEventListener('change', reset);
document.querySelector('#reset').addEventListener('click', reset);
function togglePause() {
  paused = !paused; clearInput(); document.querySelector('#pause').textContent = paused ? 'Resume' : 'Pause'; canvas.focus();
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
  player.update(input());
  enemy.update();
  if(contact(data,player,enemy))hits++;
  pulseInput = 0;
  // Research slice viewport. Source screen clamp: 008DD4–008E1A.
  player.x = Math.max((data.stage.cameraX + 24) * 65536, Math.min((data.stage.cameraX + 360) * 65536, player.x));
  // Temporary movement-test floor bounds; stage collision map is unrecovered.
  if (!['airborne','jumpStart'].includes(player.mode)) {
    player.y = Math.max(16 * 65536, Math.min(96 * 65536, player.y));
    player.groundY = player.y;
  }
}
function draw() {
  presentation.draw(context,player,enemy);
  status.textContent = paused ? 'Paused' : `${player.character.name} · ${player.mode} · build ${data.version}`;
  document.querySelector('#combat-status').textContent = `${enemy.character.name} · ${enemy.mode} · HP ${Math.max(0,enemy.health)}/${enemy.character.health} · ${hits} landed punch${hits===1?'':'es'}`;
}
try {
  const metadata = await fetch('./assets/game.json?v=4ff6cbb6d1');
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
