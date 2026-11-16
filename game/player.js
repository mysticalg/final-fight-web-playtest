import {Animation} from './animation.js?v=999b8c9aee';
import {receiveHit,updateReaction} from './player-reaction.js?v=999b8c9aee';
import {queueStanding,standingUpdate,airAttack} from './player-attacks.js?v=999b8c9aee';
import {escapePressed,queueEscape,updateSpecial} from './player-specials.js?v=999b8c9aee';
import{updateWeapon,dropWeapon}from'./player-weapons.js?v=999b8c9aee';

// Positions are 16.16; original velocity tables hold signed 8.8 values.
// Movement, jump/landing and standing attacks. Contact, grabs and damage
// reactions use separate modules; weapons remain incomplete.
export class Player {
  constructor(data, character = 0) {
    this.data = data;
    this.characterIndex=character;
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
    this.comboCounter=0;this.comboWindow=0;this.attackActive=false;
    this.animation = new Animation(data.animationEntries, this.character.actions.idle);
  }
  action(name) { this.animation.set(this.character.actions[name]); this.imageOffset=0; }
  sound(command) { if(command!==null&&command!==undefined)this.onSound?.(command); }
  groundCollision() {
    if(this.collision?.resolveWide(this,16)<0){this.mode='freefallPending';this.attackActive=false;return true;}
    return false;
  }
  airCollision(pressed) {
    if(pressed&32)this.rememberedJump=true;
    const response=this.collision?.resolveAir(this,16,this.collisionHeight??64);
    if(response>0&&this.characterIndex===0&&this.stageIndex!==6&&this.rememberedJump&&this.vx&&((this.vx<0)===!!this.facing))this.mode='wallClingPending';
  }
  hit(damage,reaction,facing) { receiveHit(this,damage,reaction,facing); }
  startReaction() { dropWeapon(this);this.pendingReaction=false;this.mode='hurtPending';this.comboCounter=0;this.comboWindow=0;this.attackActive=false; }
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
    this.vy = (this.vy - (this.gravity??0x48)) << 16 >> 16;
    this.vx = (this.vx - this.drag) << 16 >> 16;
    this.y = (this.y + this.vy * 256) | 0;
    this.x = (this.x + this.vx * 256) | 0;
  }
  update(input) {
    const specialAllowed=['idle','idlePending','walkPending','walk','stopping','landing','postThrow','hurt'].includes(this.mode)||(this.mode==='punch'&&!this.hitStop&&(this.animation.flags&128));
    const pressed=input&~this.previousInput;
    this.pressedInput=pressed;
    this.suppressComboThrow=specialAllowed&&escapePressed(this,input,pressed);
    this.updateState(input);
    if(this.suppressComboThrow)queueEscape(this);
    // 00A838 detects damage after the current state handler has run.
    if(this.pendingReaction)this.startReaction();
    if(!this.attackActive&&this.comboWindow)this.comboWindow--;
    // 00A79A: timer maintenance follows the state handler.
    if(this.invulnerable)this.invulnerable--;
    if(this.grabCooldown)this.grabCooldown--;
  }
  updateState(input) {
    const previous = this.previousInput;
    const pressed = input & ~previous;
    this.previousInput = input;
    if(updateSpecial(this))return;
    if(updateReaction(this,input,pressed,previous))return;
    if(updateWeapon(this))return;
    if(this.mode==='respawnFall'){
      this.integrateJump();this.collision?.resolveAir(this,16);
      if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.mode='landingPending';}
      this.animation.tick();return;
    }
    if(this.mode==='pickup'){
      this.animation.tick();if(this.animation.flags&128){this.mode='idlePending';this.invulnerable=Math.max(this.invulnerable,10);}return;
    }
    if(this.mode==='postPile') {
      this.invulnerable=Math.max(this.invulnerable,34);this.grabCooldown=this.data.grabs.haggarCooldown[this.worldRandom.next()&31];
      this.mode='postPileAir';this.groundY=this.y;this.vy=0x300;this.vx=this.facing?0x300:-0x300;this.drag=this.facing?5:-5;this.action('postPile');return;
    }
    if(this.mode==='postPileAir') {
      this.integrateJump();if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.mode='landingPending';}else this.animation.tick();return;
    }
    if(this.mode==='postThrow') {
      this.animation.tick();if(this.animation.flags&128)this.mode='idlePending';
      if(this.groundCollision())return;
      if(pressed&32)this.mode='jumpPending';if(pressed&16)queueStanding(this,input);return;
    }
    // 00B3A4: standing attacks consume hit-stop without advancing animation.
    if (this.hitStop && ['punch','punchPending','airborne','wallAir'].includes(this.mode)) { this.hitStop--; return; }
    if (['punchPending','punch'].includes(this.mode)) {
      standingUpdate(this,input,pressed);
      this.groundCollision();
      return;
    }
    if(this.mode==='jumpPending') {
      this.mode='jumpStart';this.groundY=this.y;this.airAttackUsed=this.airDownUsed=false;
      this.vy=0x600;this.vx=this.drag=0;this.gravity=0x48;this.rememberedJump=false;this.action('jumpStart');return;
    }
    if (this.mode === 'jumpStart') {
      // 00ABB4–00AC2E: hold pose until flagged or a new directional input.
      this.animation.tick();
      if ((this.animation.flags & 128) || (pressed & 0x1b)) {
        const horizontal = input & 3;
        this.vx = horizontal ? this.character.jumpSpeed : 0;
        this.drag = horizontal ? this.character.jumpDrag : 0;
        if (this.facing) { this.vx = -this.vx|0; this.drag = -this.drag|0; }
        const backwards = horizontal && ((!this.facing && (input & 2)) || (this.facing && (input & 1)));
        if (backwards) { this.vx = -this.vx; this.action('jumpBackward'); }
        else this.action(horizontal ? 'jumpForward' : 'jump');
        this.mode = 'airborne';
        if(!backwards)airAttack(this,input,pressed);
      }
      return;
    }
    if (this.mode === 'airborne') {
      this.integrateJump();
      this.airCollision(pressed);
      if ((this.y >> 16) <= (this.groundY >> 16)) {
        this.y = this.groundY;
        this.mode = 'landingPending';
      } else { airAttack(this,input,pressed);this.animation.tick(); }
      return;
    }
    if(this.mode==='freefallPending'){
      this.mode='freefall';this.vy=this.vx=this.drag=0;this.gravity=0x48;this.action('freefall');return;
    }
    if(this.mode==='freefall'){
      this.integrateJump();if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.mode='landingPending';}this.animation.tick();return;
    }
    if(this.mode==='wallClingPending'){
      this.mode='wallCling';this.airAttackUsed=this.airDownUsed=false;this.wallTimer=9;this.action('wallCling');
    }
    if(this.mode==='wallCling'){
      if(!(input&32)||(input&4)){this.mode='freefallPending';return;}
      airAttack(this,input,pressed,{wall:true});
      if(!this.airAttackUsed&&!this.airDownUsed){this.animation.tick();if(--this.wallTimer)return;this.action('jumpForward');}
      this.mode='wallAir';this.rememberedJump=false;this.facing^=1;
      const strong=!!(input&(this.facing?2:1)),sign=this.facing?-1:1;
      this.vx=(strong?0x680:0x480)*sign;this.drag=(strong?0x10:0)*sign;this.vy=strong?0x380:0x300;this.gravity=strong?0x58:0x38;return;
    }
    if(this.mode==='wallAir'){
      this.integrateJump();this.airCollision(pressed);
      if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.mode='landingPending';}
      else{airAttack(this,input,pressed,{wall:true});this.animation.tick();}return;
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
      if(this.groundCollision())return;
      if(pressed&32)this.mode='jumpPending';
      if(pressed&16)queueStanding(this,input);
      return;
    }
    // A91E / AACE / AB16: direction changes queue walking; displacement starts
    // on the following update. Movement runs before common jump/attack checks.
    if(this.mode==='idlePending'){this.mode='idle';this.action('idle');}
    if(this.mode==='walkPending'){
      this.mode='walk';this.animation.set(this.character.walk[this.walkIndex]);
    }
    if(this.mode==='walk'){
      this.chooseDirection(input);
      if(this.direction!==8)this.walk();else{this.mode='stopping';this.stopFrames=6;}
    } else if(this.mode==='stopping'){
      if(--this.stopFrames===0){this.mode='idle';this.action('idle');}
      this.chooseDirection(input);if(this.direction!==8)this.mode='walkPending';
    } else {
      this.animation.tick();this.chooseDirection(input);if(this.direction!==8)this.mode='walkPending';
    }
    if(this.groundCollision())return;
    if(pressed&32)this.mode='jumpPending';
    if(pressed&16)queueStanding(this,input);
  }
}
