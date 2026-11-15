import {escapePressed,queueEscape} from './player-specials.js?v=0854a9c44d';
// Shared grab helpers: 004180, 00D87A, 003F40, 00D972 and 00D99E.
const word=value=>value<<16>>16;
const offsetWord=(position,offset)=>((word((position>>16)+offset)<<16)|(position&65535))|0;
export function attachHeld(holder,victim,rows) {
  const pose=holder.attachment;
  if(!pose)return 1;
  const row=rows[pose&127];
  if(!row)throw new Error('Unrecovered held-enemy attachment');
  victim.x=offsetWord(holder.x,holder.facing?-row[0]:row[0]);
  victim.y=offsetWord(holder.y,row[1]);victim.groundY=holder.groundY;
  victim.facing=holder.facing^1^(row[2]?1:0);victim.attachment=row[3];
  return pose&128?255:0;
}
export function grabAttackChoice(rules,facing,input,pressed) {
  if(!(pressed&16))return 'hold';
  return ['hold','knee','forward','backward'][rules.input[(input&15)+(facing?16:0)]>>1];
}
export function throwHealth(health,character,kind='impact') {
  // Comparisons are unsigned word subtraction. Negative health remains on the
  // subtraction branch, retaining the source's behavior for already dead actors.
  const [threshold,span,damage]=kind==='pile'?[30,110,70]:kind==='haggar'?[24,76,50]:character===0?[15,45,30]:[18,62,40];
  const after=(health-threshold)&65535;
  if(after===0||after>=(65536-threshold))return -1;
  if(after<=span)return word(health)>>1;
  return word(health-damage);
}

// Guy/Cody holder state machine (00CCD4). Actor attachment remains a separate
// step because the original updates the holder before the held enemy.
export class GrabPair {
  constructor(data,rules,holder,victim,random,{comboThrow=false}={}) {
    this.data=data;this.rules=rules;this.holder=holder;this.victim=victim;this.random=random;
    victim.grabPair=this;
    this.character=rules.characters[holder.characterIndex];
    this.attachmentRows=this.character.attachmentsByFamily?.[victim.character.family??0]??this.character.attachments;
    this.enemyPoses=victim.character.heldPoses??this.character.enemyVariants?.[victim.variant]??this.character.enemyPoses;
    this.victimMode=victim.mode;this.victimQueued=true;
    this.holding=true;this.held=true;holder.mode='grabInit';victim.mode='heldPending';
    this.queued=true;holder.attachment=0;this.timer=0;
    this.comboThrow=comboThrow;
    if(comboThrow){if(holder.characterIndex!==2)holder.facing^=1;this.pose('throw');victim.hitStop=0;}
  }
  pose(name) {
    this.holder.animation.set(this.character.actions[name]);this.holder.imageOffset=0;
    this.holder.attachment=this.data.images[this.holder.animation.image].attachment;
  }
  tick() {
    this.holder.animation.tick();
    this.holder.attachment=this.data.images[this.holder.animation.image].attachment;
  }
  release(mode='idlePending') {
    this.holding=false;this.holder.mode=mode;
  }
  attack(input,pressed) {
    const choice=grabAttackChoice(this.haggar?{input:this.rules.haggarInput}:this.rules,this.holder.facing,input,pressed);
    if(choice==='knee'){this.holder.mode='grabKneePending';this.holder.comboCounter=(this.holder.comboCounter+2)&65535;}
    if(choice==='forward'||choice==='backward'){this.holder.mode='grabThrowPending';this.forward=choice==='forward';}
  }
  updateHolder(input) {
    const oldMode=this.holder.mode,pressed=input&~this.holder.previousInput;
    this.holder.pressedInput=pressed;
    this.haggar=this.holder.characterIndex===2;
    if(this.queued){this.queued=false;this.holder.hitStop=0;}
    this.updateHolderState(input);
    if(this.haggar&&this.timer&&!--this.timer)this.holder.grabCooldown=this.rules.cooldown[this.random.next()&31];
    if(['grabInit','grabHoldPending','grabHold','grabCarryPending','grabCarry'].includes(oldMode)&&escapePressed(this.holder,input,pressed)){
      this.holding=false;queueEscape(this.holder);
    }
  }
  updateHolderState(input) {
    const p=this.holder,pressed=input&~p.previousInput;p.previousInput=input;
    if(p.mode==='grabInit') {
      p.comboCounter=0;p.comboWindow=0;p.attackActive=false;
      if(this.comboThrow){this.comboThrow=false;this.forward=true;p.mode='grabThrowPending';}
      else {this.timer=this.rules.holdWait[this.random.next()&31];p.mode='grabHoldPending';}
    }
    if(this.haggar&&this.updateHaggar(input,pressed))return;
    if(p.mode==='grabHoldPending'||p.mode==='grabHold') {
      if(p.hitStop)p.hitStop--;
      else if(!this.timer)this.release();
      else if(p.mode==='grabHoldPending'){p.mode='grabHold';this.pose('hold');this.attack(input,pressed);}
      else {
        this.tick();this.attack(input,pressed);
        if(!this.held)this.release();
        else if(pressed&32)this.release('jumpPending');
      }
      if(this.timer&&!--this.timer)p.grabCooldown=this.rules.cooldown[this.random.next()&31];
      return;
    }
    if(p.mode==='grabKneePending'||p.mode==='grabKnee') {
      if(p.hitStop){p.hitStop--;return;}
      if(p.mode==='grabKneePending') {
        p.mode='grabKnee';this.pose('knee');
        if(!this.held)return;
        const index=(p.comboCounter&6)>>1;p.comboCounter&=6;
        const v=this.victim;v.health=word(v.health-this.character.damage[index]);
        v.reaction=this.character.reactions[index];v.hitFrom=p.facing;
        p.hitStop=v.hitStop=5;v.pendingReaction=true;
      } else {this.tick();if(p.animation.flags&128)p.mode=this.haggar?'grabCarryPending':'grabHoldPending';}
      return;
    }
    if(p.mode==='grabThrowPending') {
      if(this.haggar&&p.hitStop){p.hitStop--;return;}
      if(!this.forward)p.facing^=1;
      p.mode='grabThrow';this.pose('throw');return;
    }
    if(p.mode==='grabThrow') {
      if(this.haggar&&p.hitStop){p.hitStop--;return;}
      this.tick();if(p.animation.flags){
        p.mode='grabThrowRelease';
        if(this.haggar&&this.held){const v=this.victim;v.health=throwHealth(v.health,2,'haggar');v.reaction=6;v.hitFrom=p.facing;v.pendingReaction=true;p.hitStop=v.hitStop=5;}
      }return;
    }
    if(p.mode==='grabThrowRelease'){
      if(this.haggar){if(p.hitStop){p.hitStop--;return;}p.invulnerable=Math.max(p.invulnerable,30);p.grabCooldown=this.rules.haggarCooldown[this.random.next()&31];}
      else this.tick();p.attachment=0;this.release('postThrow');
    }
  }
  updateHaggar(input,pressed) {
    const p=this.holder;
    const validate=()=>{if(!this.held)this.release();};
    const jump=()=>{if(pressed&32)p.mode='grabJumpPending';};
    if(p.mode==='grabHoldPending'){if(!this.timer)this.release();else{p.mode='grabHold';this.pose('hold');jump();}return true;}
    if(p.mode==='grabHold'){
      if(!this.timer)this.release();else{this.tick();if(p.animation.flags&128){p.mode='grabCarryPending';p.walkIndex=0;}jump();validate();}return true;
    }
    if(p.mode==='grabCarryPending'||p.mode==='grabCarry'){
      if(!this.timer){this.release();return true;}
      if(p.mode==='grabCarryPending'){p.mode='grabCarry';p.animation.set(this.character.carry[p.walkIndex]);}
      else {
        p.direction=this.data.directionTable[input&15];
        if(p.direction!==8){const dx=p.character.walkX[p.direction]*256,dy=p.character.walkY[p.direction]*256;p.x=(p.x+dx)|0;p.y=(p.y+dy)|0;p.groundY=p.y;p.distance+=dx?Math.abs(dx):2*Math.abs(dy);}
        if(p.distance>p.character.stride){
          p.distance-=p.character.stride;const face=this.data.facingTable[p.direction],back=face<128&&face!==p.facing;
          p.walkIndex=(p.walkIndex+(back?11:1))%12;
          if(back)p.animation.backward();else p.animation.tick();
        }
      }
      p.attachment=this.data.images[p.animation.image].attachment;jump();this.attack(input,pressed);validate();return true;
    }
    if(!['grabJumpPending','grabJumpStart','grabJumpAir','grabJumpLand','grabPileRelease'].includes(p.mode))return false;
    if(p.hitStop){p.hitStop--;return true;}
    const pile=()=>{if(!this.pileUsed&&this.jumpWindow){this.jumpWindow--;if(pressed&16){this.pileUsed=255;this.pose('pile');}}};
    if(p.mode==='grabJumpPending'){
      p.mode='grabJumpStart';p.groundY=p.y;p.vy=0x600;p.vx=p.drag=0;this.pileUsed=0;this.pose('carryJump');return true;
    }
    if(p.mode==='grabJumpStart'){
      if(!(pressed&31)){this.tick();if(!(p.animation.flags&128))return true;}
      p.mode='grabJumpAir';this.jumpWindow=18;this.pose('carryAir');pile();
      if(input&3){p.vx=p.facing?-0x200:0x200;p.drag=p.facing?-2:2;if((!p.facing&&(input&2))||(p.facing&&(input&1))){p.vx=-p.vx;p.drag=-p.drag;}}return true;
    }
    if(p.mode==='grabJumpAir'){
      p.vy=word(p.vy-0x40);p.vx=word(p.vx-p.drag);p.x=(p.x+p.vx*256)|0;p.y=(p.y+p.vy*256)|0;
      if((p.y>>16)<=(p.groundY>>16)){
        p.y=p.groundY;this.jumpWindow=6;p.mode='grabJumpLand';
        if(!this.pileUsed)this.pose('carryJump');
        else if(this.held){const v=this.victim;v.health=throwHealth(v.health,2,'pile');v.reaction=5;v.hitFrom=p.facing;v.pendingReaction=true;p.mode='grabPileRelease';}
      } else {
        pile();if(this.pileUsed&128){this.tick();if(p.attachment===8){p.y=(p.y+40*65536)|0;this.pileUsed=1;}}
      }return true;
    }
    if(p.mode==='grabJumpLand'){this.tick();if(--this.jumpWindow<0)p.mode='grabCarryPending';return true;}
    p.attachment=0;this.release('postPile');return true;
  }
  updateHeld() {
    const v=this.victim;
    if(!this.held)return false;
    if(v.character.family===2)v.guardReady=false;
    if(this.victimQueued){
      this.victimQueued=false;
      if(this.cancelBeforeVictim){this.held=false;v.mode=this.victimMode;return false;}
      v.hitStop=0;
    }
    const status=attachHeld(this.holder,v,this.attachmentRows);
    if(status===0) {
      v.mode='held';v.animation.set(this.enemyPoses[v.attachment&127]);v.imageOffset=0;
      if(!this.holding){this.held=false;v.mode=(v.y>>16)>(v.groundY>>16)?'releasedFallPending':'releasedPending';}
    } else if(status===255){this.held=false;v.mode='thrownPending';v.direction=v.facing;}
    else {this.held=false;v.mode=(v.y>>16)>(v.groundY>>16)?'releasedFallPending':'releasedPending';}
    if(v.pendingReaction) {
      v.pendingReaction=false;
if(v.health<0||v.reaction>=3){this.held=false;if((v.reaction===5||v.reaction===6)&&!v.slamKeepsHeight)v.y=v.groundY;v.startReaction();}
    }
    if(v.releaseHeld&&['releasedPending','releasedFallPending'].includes(v.mode))v.releaseHeld();
    return true;
  }
  cancelHolder() {this.holding=false;this.cancelBeforeVictim=this.victimQueued;}
  updateThrown(world) {
    const v=this.victim;
    if(v.updateThrown)return v.updateThrown(world,this.holder);
    if(v.mode==='thrownPending') {
      v.mode='thrown';v.vy=0x400;v.vx=0x400*(v.direction?-1:1);
      v.animation.set(v.character.actions.thrown??this.rules.enemyThrown);v.imageOffset=0;return true;
    }
    if(v.mode==='thrown') {
      if(v.hitStop){v.hitStop--;return true;}
      v.integrate();
      if((v.y>>16)<=(v.groundY>>16)) {
        v.health=throwHealth(v.health,this.holder.characterIndex);
        v.action('down');v.mode='thrownBounce';v.y=v.groundY;v.vy=0x400;v.vx=0x100*(v.direction?-1:1);
      }
      v.animation.tick();return true;
    }
    if(v.mode==='thrownBounce') {
      v.integrate();
      if((v.y>>16)<=(v.groundY>>16)) {
        v.y=v.groundY;v.mode='thrownSlide';v.vx=0x100*(v.direction?-1:1);v.drag=16*(v.direction?-1:1);
      }
      v.animation.tick();return true;
    }
    if(v.mode==='thrownSlide') {
      v.animation.tick();const next=word(v.vx-v.drag);v.vx=(v.vx>=0)===(next>=0)?next:0;v.x=(v.x+v.vx*256)|0;
      if(!v.vx)v.mode=v.health<0?'defeated':'recoverInit';
      return true;
    }
    return false;
  }
}
