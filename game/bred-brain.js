import {advanceApproach,reachedPosition,faceTarget} from './enemy-ai.js?v=999b8c9aee';
const word=value=>value<<16>>16;

// Bred family zero, one-player/no-wall encounter controller. Source: 021FC4,
// 02249E–022694, 022754–0228C6, 022C24–022D8E and shared 027A1E–0280F4.
export class BredBrain {
  constructor(actor) {
    this.actor=actor;this.rules=actor.character.ai;this.state='seek';this.phase=0;
    this.reserved=false;this.script=null;this.scriptIndex=0;this.cooldown=0;
    actor.positionSlot=0;actor.speedX=actor.speedY=0;actor.direction=0;
    actor.desiredSpeedX=0x20000;actor.desiredSpeedY=0x10000;
  }
  release(world) {
    if(this.reserved){world.activeAttackers--;this.reserved=false;this.script=null;this.scriptIndex=0;}
  }
  reserve(world) {
    if(!this.reserved){this.reserved=true;world.activeAttackers++;this.script=null;this.scriptIndex=0;}
  }
  seek(world) {
    const actor=this.actor;actor.desiredSpeedX=0x20000;actor.desiredSpeedY=0x10000;
    this.state='seek';this.phase=0;actor.running=false;actor.action('neutral');
  }
  walk() {
    const actor=this.actor;actor.desiredSpeedX=0x20000;actor.desiredSpeedY=0x10000;
    this.state='choosePosition';this.phase=0;actor.running=false;actor.action('neutral');
  }
  run() {
    const actor=this.actor;
    this.state='run';this.phase=0;
    if(!actor.running){actor.desiredSpeedX=0x19900;actor.desiredSpeedY=0xcc00;actor.running=true;actor.action('run');}
  }
  blockedByObject(world,response){
    const actor=this.actor;
    if(response!==3||!actor.collisionObject||actor.facing!==actor.direction)return false;
    actor.blockedTimer=((actor.blockedTimer??0)-1)&255;
    if(actor.blockedTimer)return false;
    const table=actor.character.entry?.blockedWait??this.rules.blockedWait;
    actor.blockedTimer=table[world.random.next()&15];this.state='obstacle';this.phase=0;return true;
  }
  updateObstacle(world){
    const actor=this.actor,object=actor.collisionObject;
    if(actor.hitStop){actor.hitStop--;return;}
    if(!this.phase){
      if(object)actor.facing=(actor.x>>16)<(object.x>>16)?0:1;
      this.phase=2;actor.action(actor.character.family?'jab':'strike');return;
    }
    actor.animation.tick();
    if(this.phase===2){
      if(!actor.data.images[actor.animation.image].attackIndex)return;
      this.phase=4;
      if(object&&!object.removed&&object.health>=0){object.health=-1;object.owner=-1;object.hitFrom=actor.facing;object.hitStop=actor.hitStop=6;}
    }else if(actor.animation.flags&128){
      this.state='seek';this.phase=0;actor.action('neutral');
      actor.running=false;
      if(actor.character.family!==1){actor.desiredSpeedX=actor.character.family===2?0x23300:0x20000;actor.desiredSpeedY=actor.character.family===2?0x11900:0x10000;}
    }
  }
  choosePosition(world,target) {
    const actor=this.actor,occupied=world.occupiedSlots??Array(8).fill(0);
    const right=(target.x>>16)>(actor.x>>16);
    const useRight=right?!!(occupied[0]&&occupied[1]&&occupied[2]):!(occupied[4]&&occupied[5]&&occupied[6]);
    actor.positionSlot=(useRight?this.rules.rightSlots:this.rules.leftSlots)[(world.random.next()&30)>>1];
  }
  targetInvalid(world,target) {
    if(world.gameOver)return -1;
    // 027BF0's cooldown/phase gate matters for two-player retargeting. This
    // encounter has one target; only disappearance/death rejects that target.
    return !target||target.mode==='dead'?1:0;
  }
  inCloseRange(target) {
    const actor=this.actor;
    return ((word((actor.x>>16)-(target.x>>16))+48)&65535)<=96
      &&((word((actor.y>>16)-(target.y>>16))+9)&65535)<=18;
  }
  canStartAttack(target) {
    const actor=this.actor,dy=word((actor.y>>16)-(target.y>>16));
    const dx=Math.abs(word((actor.x>>16)-(target.x>>16)));
    return (dy>=-4&&dy<=4&&dx>=56&&dx<=72)||this.inCloseRange(target);
  }
  decidePosition(world,target) {
    const actor=this.actor;
    if(this.reserved){this.state='attack';this.phase=0;return;}
    if((world.random.next()&15)<=this.rules.attackChance && world.activeAttackers<this.rules.attackerLimit[world.difficulty??4]) {
      this.reserve(world);
      this.state='runInit';this.phase=0;return;
    }
    const slot=this.rules.reposition[actor.positionSlot][world.random.next()&15];
    if(slot&128){this.state='waitPosition';this.phase=0;}
    else {actor.positionSlot=slot;this.run();}
  }
  nextAttack(world) {
    if(this.script&&this.scriptIndex<this.script.length) {
      this.phase=this.script[this.scriptIndex++];this.attackStep=0;return;
    }
    if(this.script&&(world.random.next()&31)>=this.rules.repeatChance) {
      this.script=null;this.walk();this.release(world);return;
    }
    const index=this.rules.attackWeights[world.random.next()&31]>>1;
    this.script=this.rules.attackScripts[index];this.scriptIndex=0;
    this.phase=this.script[this.scriptIndex++];this.attackStep=0;
  }
  update(world,target) {
    if(this.state==='obstacle'){this.updateObstacle(world);return;}
    const actor=this.actor;
    if(this.cooldown)this.cooldown--;
    const periodic=((world.frame+(world.actorPhase??0))&7)===0;
    if(this.state==='seek') {
      if(!target||target.mode==='dead')return this.walk();
      faceTarget(actor,target,true);this.cooldown=180;this.walk();return;
    }
    if(this.state==='choosePosition') {
      this.state='approach';faceTarget(actor,target,true);this.choosePosition(world,target);return;
    }
    if(this.state==='runInit') {
      this.run();faceTarget(actor,target);
      actor.positionSlot=(target.x>>16)>(actor.x>>16)?3:7;return;
    }
    if(this.state==='approach'||this.state==='run') {
      const invalid=this.targetInvalid(world,target);
      if(invalid<0){this.walk();return;}
      if(invalid>0){this.seek(world);return;}
      if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;return;}
      if(reachedPosition(actor,target,world.slots)){this.decidePosition(world,target);return;}
      advanceApproach(actor,target,world.slots);
      if(this.blockedByObject(world,world.collision?.resolve(actor)))return;
      if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='waitPosition') {
      if(!this.phase){actor.speedX=actor.speedY=0;this.phase=2;this.wait=70;}
      else if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;}
      else if(!reachedPosition(actor,target,world.slots)){
        if(actor.running)this.walk();else{this.state='choosePosition';this.phase=0;}
      }
      else if(--this.wait===0)this.decidePosition(world,target);
      if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='attack') {
      if(actor.hitStop){actor.hitStop--;return;}
      if(this.phase===0) {
        if(this.targetInvalid(world,target)){this.walk();return;}
        faceTarget(actor,target,true);
        // 027A1E: airborne targets cause a short wait; movement/recovery a long one.
        if(target.airborne||target.evading){this.phase=target.airborne?2:4;this.attackStep=0;return;}
        if(this.inCloseRange(target))this.reserve(world);
        if(!this.canStartAttack(target)){this.state='choosePosition';this.phase=0;this.release(world);return;}
        this.nextAttack(world);return;
      }
      if(this.phase===2||this.phase===4) {
        if(!this.attackStep) {
          actor.speedX=actor.speedY=0;this.attackStep=2;
          this.wait=(this.phase===2?this.rules.shortWait:this.rules.longWait)[world.random.next()&31];return;
        }
        if(--this.wait===0)this.phase=0;
        if(periodic)faceTarget(actor,target);return;
      }
      if(this.phase===18){
        if(!this.attackStep){this.attackStep=2;actor.action('leapStart');return;}
        actor.animation.tick();
        if(this.attackStep===2){
          if(actor.animation.flags){this.attackStep=4;actor.groundY=actor.y;actor.direction=actor.facing;actor.vy=0x780;actor.vx=0x280*(actor.facing?-1:1);actor.drag=5*(actor.facing?-1:1);}
        } else if(this.attackStep===4){
          actor.vy=word(actor.vy-0x66);actor.vx=word(actor.vx-actor.drag);actor.x=(actor.x+actor.vx*256)|0;actor.y=(actor.y+actor.vy*256)|0;
          if(world.collision?.resolve(actor)>0)actor.vx=actor.drag=0;
          if((actor.y>>16)<=(actor.groundY>>16)){actor.y=actor.groundY;this.attackStep=6;actor.action('leapLand');}
        } else if(actor.animation.flags&128){this.phase=0;actor.running=true;actor.action('run');}
        return;
      }
      const action={6:'jab',8:'kick',10:'strike',12:'strikeFinish',14:'swing',16:'uppercut'}[this.phase];
      if(!action)throw new Error(`Bred attack phase ${this.phase} is not recovered`);
      if(!this.attackStep){this.attackStep=2;actor.action(action);return;}
      actor.animation.tick();
      if(actor.animation.flags&128) {
        this.phase=0;actor.running=true;actor.action('run');
      }
    }
  }
}
