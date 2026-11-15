import {Animation} from './animation.js?v=1bb9bc2b0d';
import {receiveHit,updateReaction} from './player-reaction.js?v=1bb9bc2b0d';

// Positions are 16.16; original velocity tables hold signed 8.8 values.
// Free movement, jump/landing and first standing punch. Damage reactions and
// contact use separate modules; grabs, combos and weapons remain open.
export class Player {
  constructor(data, character = 0) {
    this.data = data;
    this.character = data.characters[character];
    this.x = data.stage.spawn.x;
    this.y = this.groundY = data.stage.spawn.y;
    this.facing = 0;
    this.direction = 8;
    this.walkIndex = 0;
    this.distance = 0;
    this.previousInput = 0;
    this.mode = 'idle';
    this.hitStop = 0;
    this.combat = this.character.combat;
    this.health=this.character.health;
    this.defenseIndex=this.character.defenseIndex;
    this.invulnerable=0;
    this.imageOffset=0;
    this.animation = new Animation(data.animationEntries, this.character.actions.idle);
  }
  action(name) { this.animation.set(this.character.actions[name]); this.imageOffset=0; }
  hit(damage,reaction,facing) { receiveHit(this,damage,reaction,facing); }
  startReaction() { this.pendingReaction=false;this.mode='hurtPending'; }
  chooseDirection(input) {
    this.direction = this.data.directionTable[input & 15];
    const facing = this.data.facingTable[this.direction];
    if (facing < 128) this.facing = facing;
  }
  walk() {
    // 00C08C–00C0B6, 00BFF2–00C022.
    const dx = this.character.walkX[this.direction] * 256;
    const dy = this.character.walkY[this.direction] * 256;
    this.x = (this.x + dx) | 0;
    this.y = (this.y + dy) | 0;
    this.groundY = this.y;
    this.distance += dx ? Math.abs(dx) : 2 * Math.abs(dy);
    // 00C024–00C07E: cadence follows distance, including strict comparison.
    if (this.distance > this.character.stride) {
      this.distance -= this.character.stride;
      this.walkIndex = (this.walkIndex + 1) % 12;
      this.animation.tick();
    }
  }
  integrateJump() {
    // 003070–003098: acceleration precedes position integration.
    this.vy = (this.vy - 0x48) << 16 >> 16;
    this.vx = (this.vx - this.drag) << 16 >> 16;
    this.y = (this.y + this.vy * 256) | 0;
    this.x = (this.x + this.vx * 256) | 0;
  }
  update(input) {
    this.updateState(input);
    // 00A838 detects damage after the current state handler has run.
    if(this.pendingReaction)this.startReaction();
    // 00A79A: timer maintenance follows the state handler.
    if(this.invulnerable)this.invulnerable--;
  }
  updateState(input) {
    const previous = this.previousInput;
    const pressed = input & ~previous;
    this.previousInput = input;
    if(updateReaction(this,input,pressed,previous))return;
    // 00B3A4: standing attacks consume hit-stop without advancing animation.
    if (this.hitStop && ['punch','punchPending'].includes(this.mode)) { this.hitStop--; return; }
    if (this.mode === 'punchPending') {
      this.mode = 'punch'; this.action('punch'); return;
    }
    if (this.mode === 'punch') {
      if (this.animation.flags & 128) this.mode = 'idlePending';
      else this.animation.tick();
      return;
    }
    if (this.mode === 'idlePending') {
      this.mode = 'idle'; this.action('idle'); this.animation.tick(); return;
    }
    if (this.mode === 'jumpStart') {
      // 00ABB4–00AC2E: hold pose until flagged or a new directional input.
      this.animation.tick();
      if ((this.animation.flags & 128) || (pressed & 0x1b)) {
        const horizontal = input & 3;
        this.vx = horizontal ? this.character.jumpSpeed : 0;
        this.drag = horizontal ? this.character.jumpDrag : 0;
        if (this.facing) { this.vx = -this.vx; this.drag = -this.drag; }
        const backwards = horizontal && ((!this.facing && (input & 2)) || (this.facing && (input & 1)));
        if (backwards) { this.vx = -this.vx; this.action('jumpBackward'); }
        else this.action(horizontal ? 'jumpForward' : 'jump');
        this.mode = 'airborne';
      }
      return;
    }
    if (this.mode === 'airborne') {
      this.integrateJump();
      if ((this.y >> 16) <= (this.groundY >> 16)) {
        this.y = this.groundY;
        this.mode = 'landingPending';
      } else this.animation.tick();
      return;
    }
    if (this.mode === 'landingPending') {
      this.mode = 'landing'; this.action('landing'); return;
    }
    if (this.mode === 'landing') {
      // State 12 maps through 00A762 to 00B352, not the recovery at 00AA5E.
      // 00B370–00B394: horizontal movement or terminal flags end the pose.
      this.animation.tick();
      if (input & 3) this.chooseDirection(input);
      if (((input & 3) && this.direction !== 8) || (this.animation.flags & 128)) this.mode = 'idlePending';
      return;
    }
    this.chooseDirection(input);
    if (pressed & 0x20) {
      // 00AB84–00ABB0.
      this.mode = 'jumpStart'; this.groundY = this.y;
      this.vy = 0x600; this.vx = this.drag = 0;
      this.action('jumpStart'); return;
    }
    if (pressed & 0x10) {
      // Idle advances its pose before BBFA queues the standing attack.
      if(this.mode==='idle')this.animation.tick();
      this.mode = 'punchPending'; return;
    }
    if (this.direction !== 8) {
      if (this.mode !== 'walk') {
        this.mode = 'walk';
        this.animation.set(this.character.walk[this.walkIndex]);
      }
      this.walk();
    } else if (this.mode === 'walk') {
      // 00AB3A–00AB70: six updates before returning to idle.
      this.mode = 'stopping'; this.stopFrames = 6;
    } else if (this.mode === 'stopping') {
      if (--this.stopFrames === 0) { this.mode = 'idle'; this.action('idle'); }
    } else this.animation.tick();
  }
}
