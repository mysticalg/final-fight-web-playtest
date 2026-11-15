const word=n=>n<<16>>16;
function heading(dx,dy,targetX,actorX){
 const left=(targetX&65535)<(actorX&65535);let x=dx&65535;if(left)x=(-x)&65535;dy=word(dy*2);const y=Math.abs(dy);let a=x===0?64:y===0?0:x>=y?Math.floor(y*32/x):64-Math.floor(x*32/y);
 if(left)a=128-a;if(dy<0)a=256-a;return((64-a+4)&255)>>>3;
}
export class HeavyBrain{
 constructor(actor){this.actor=actor;this.rules=actor.character.heavyAI;this.state=2;this.phase=0;this.step=0;this.side=0;this.reserved=false;this.targetX=this.targetY=0;this.attackCooldown=0;this.closeAttack=false;this.reorient=true;}
 face(target){this.actor.facing=(target.x>>16)>(this.actor.x>>16)?0:1;}
 release(world=this.world){if(this.reserved){const slots=world.heavySlots??=Array(4).fill(0);slots[this.side]=(slots[this.side]-1)&255;this.reserved=false;}}
 choosePoint(world,target){
  const a=this.actor,slots=world.heavySlots??=Array(4).fill(0);this.side=(a.x>>16)>=(target.x>>16)?1:0;
  if(slots[this.side]){this.side^=1;if(slots[this.side])this.side^=1;}
  this.targetY=word((target.groundY>>16)-(target.floorOffset??0));
  const blocked=()=>!!world.collision?.objectProbe(this.targetX,this.targetY).response;
  let found=false;
  for(let attempt=0;attempt<2;attempt++){
   this.offset=(0x4a92&(1<<(world.random.next()&15)))?144:64;
   for(let choice=0;choice<2;choice++){
    this.targetX=word((target.x>>16)+(this.side?this.offset:-this.offset));if(!blocked()){found=true;break;}if(!choice)this.offset=this.offset===64?144:64;
   }
   if(found)break;if(!attempt)this.side^=1;
  }
  if(!found){this.targetX=target.x>>16;if(blocked()){this.targetX=a.x>>16;this.targetY=a.groundY>>16;}}
  this.reserved=true;slots[this.side]=(slots[this.side]+1)&255;
 }
 reached(){const a=this.actor;return((word(this.targetX-(a.x>>16))+9)&65535)<=18&&((word(this.targetY-(a.y>>16))+9)&65535)<=18;}
 near(target,range,depth){const a=this.actor;return !target.evading&&target.mode!=='dead'&&((word((target.x>>16)-(a.x>>16))+range)&65535)<=range*2&&((word((target.y>>16)-(a.y>>16))+depth)&65535)<=depth*2;}
 animateWalk(){const a=this.actor;if((a.direction>>4)^a.facing)a.animation.backward();else a.animation.tick();}
 move(world,target,avoid=true){
  const a=this.actor;
  if(world.frame&1){const d=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16),this.targetX,a.x>>16);let difference=(d-a.direction)&31;
   if(avoid&&this.near(target,40,20)){if(!difference)difference=(world.random.next()&64)?1:-1;else difference=difference<16?-1:1;}
   else if(avoid&&this.reorient){this.reorient=false;a.direction=d;difference=0;}
   else if(difference)difference=difference<16?1:-1;
   a.direction=(a.direction+difference)&31;
  }
  const[vx,vy]=this.rules.velocity[a.direction];a.x=(a.x+vx*256)|0;a.y=(a.y+vy*256)|0;a.groundY=a.y;world.collision?.resolve(a);
 }
 considerAttack(world,target){
  if(this.near(target,64,9)){this.closeAttack=true;this.release(world);this.state=4;this.phase=this.step=0;this.attackCooldown=0;return;}
  if(this.near(target,80,9)){this.release(world);this.state=4;this.phase=this.step=0;this.attackCooldown=0;return;}
  if(target.evading||target.mode==='dead'||Math.abs(word((target.x>>16)-(this.actor.x>>16)))>=160){this.attackCooldown=0;return;}
  if(!this.attackCooldown){this.attackCooldown=30;return;}
  if(--this.attackCooldown)return;
  if(this.rules.attackBits[this.actor.level]&(1<<(world.random.next()&15))){this.release(world);this.state=4;this.phase=this.step=0;}else this.attackCooldown=30;
 }
 seek(){this.state=2;this.phase=this.step=0;this.actor.action('neutral');}
 terrain(world,target){
  const a=this.actor;if(a.collisionType===3)this.terrainWait=(this.terrainWait??0)+this.rules.terrainProgress[(world.random.next()&30)>>1];else this.terrainWait=0;
  if(this.terrainWait<180)return;
  this.terrainWait=0;this.release(world);this.face(target);this.state=4;this.phase=4;this.step=0;this.script=[10];this.scriptIndex=0;a.action('neutral');
 }
 approach(world,target){
  const a=this.actor;
  if(!this.phase){this.phase=2;this.retargetWait=180;this.pointWait=20;this.pauseCooldown=40;this.pause=0;this.reorient=true;a.y=a.groundY;this.attackCooldown=0;this.terrainWait=0;this.choosePoint(world,target);}
  else{
   if(!--this.retargetWait)this.retargetWait=8;
   if(!this.pause&&!--this.pointWait){this.pointWait=20;this.release(world);this.choosePoint(world,target);}
  }
  if(!((world.frame+(world.actorPhase??0))&7))this.face(target);
  this.considerAttack(world,target);
  if(this.pause){this.pause--;this.reorient=true;return;}
  if(this.reached()){this.reorient=true;return;}
  if(!--this.pauseCooldown){this.pauseCooldown=40;if(0x2444&(1<<(world.random.next()&15)))this.pause=this.rules.pauseWait[world.random.next()&15];this.reorient=true;return;}
  this.animateWalk();this.move(world,target);this.terrain(world,target);
 }
 chargeTick(){const animation=this.actor.animation;animation.remaining=(animation.remaining-1)&255;if(!animation.remaining){animation.set(animation.entries[animation.address].next);animation.remaining=this.rules.chargeTicks[this.speed];}}
 chargeMove(world){const a=this.actor,[vx,vy]=this.rules.chargeVelocity[this.speed][a.direction];this.chargeTick();a.x=(a.x+vx*256)|0;a.y=(a.y+vy*256)|0;a.groundY=a.y;world.collision?.resolve(a);}
 finishAction(world,charge=false){
  if(this.scriptIndex>=this.script.length){this.step=0;this.phase=4;return;}
  this.step=charge?12:this.step+2;this.wait=this.rules.betweenWait[world.random.next()&31];
 }
 charge(world,target){
  const a=this.actor;
  if(!this.step){
   this.step=2;this.targetX=target.x>>16;this.targetY=target.groundY>>16;const d=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16),this.targetX,a.x>>16);a.direction=this.rules.chargeHeading[d];a.facing=d>>4;this.chargeTurn=(a.direction&15)===8;
   this.speed=this.rules.chargeSpeed[world.random.next()&15];this.chargeTimer=192;this.chargeStopped=false;a.action('charge');a.sound(41);
  }else if(this.step===2){
   if(a.animation.flags){this.step=4;a.animation.remaining=this.rules.chargeTicks[this.speed];this.chargeTick();a.sound(38);}else a.animation.tick();
  }else if(this.step===4){
   if(!((world.frame+(world.actorPhase??0))&3)){
    if(this.chargeTurn){this.targetX=target.x>>16;this.targetY=target.groundY>>16;const d=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16),this.targetX,a.x>>16);if(d!==a.direction){a.direction=(a.direction+(d<a.direction?-2:2))&31;this.chargeTurn=false;}}
    const passed=a.facing?word((target.x>>16)+12)>=(a.x>>16):word((target.x>>16)-12)<=(a.x>>16);
    if(passed){this.chargeStopped=true;this.step=6;this.wait=15;return;}
   }
   const oldX=a.x>>16;this.chargeMove(world);
   if((a.x>>16)===oldX&&a.collisionType===3){this.breakObject(a.collisionObject);a.animation.tick();}
  }else if(this.step===6){if(!--this.wait){this.step=8;this.wait=15;this.speed=0;}this.chargeMove(world);}
  else if(this.step===8){if(!--this.wait){this.step=10;a.action('neutral');}else this.chargeMove(world);}
  else if(this.step===10)this.finishAction(world,true);
  else if(!--this.wait){this.step=0;this.phase=4;}
  if(!this.chargeStopped&&!--this.chargeTimer){this.chargeStopped=true;this.step=6;this.wait=15;}
 }
 breakObject(object){if(object&&!object.removed&&object.health>=0){object.owner=-1;object.health=-1;object.hitFrom=this.actor.facing;object.hitStop=this.actor.hitStop=6;}}
 attack(world,target){
  const a=this.actor;if(a.hitStop&&--a.hitStop)return;
  if(this.phase===0){this.phase=2;this.attackId=this.rules.attackWeights[world.random.next()&31];this.script=this.rules.scripts[this.attackId];this.scriptIndex=0;return;}
  if(this.phase===2){
   if(this.closeAttack||this.attackId>6){this.closeAttack=false;this.phase=4;this.step=0;return;}
   if(!this.step){this.step=2;this.offset=(target.x>>16)<(a.x>>16)?60:-60;this.targetX=word((target.x>>16)+this.offset);this.targetY=target.groundY>>16;this.face(target);return;}
   if(!((world.frame+(world.actorPhase??0))&7)){this.face(target);this.targetX=word((target.x>>16)+this.offset);this.targetY=target.groundY>>16;}
   if(this.reached()){this.step=0;this.phase=4;return;}this.animateWalk();this.move(world,target,false);this.terrain(world,target);return;
  }
  if(this.phase===4){if(this.attackId!==7&&target.evading){this.seek();return;}if(this.scriptIndex>=this.script.length){this.phase=8;return;}this.attackAction=this.script[this.scriptIndex++];this.phase=6;return;}
  if(this.phase===8){if(!this.step){this.step=2;this.wait=this.rules.restWait[world.random.next()&31];a.action('neutral');}else if(!--this.wait)this.seek();return;}
  if(this.attackAction===8){this.charge(world,target);return;}
  if(this.attackAction===10){
   if(!this.step){this.step=2;a.action('headbutt');return;}
   if(this.step===2){a.animation.tick();if(a.animation.flags){this.step=4;this.breakObject(a.collisionObject);}return;}
   if(this.step===4){a.animation.tick();if(a.animation.flags&128){this.step=6;a.action('neutral');}return;}
   if(this.step===6){this.finishAction(world);return;}
   if(!--this.wait){this.targetX=word((target.x>>16)+this.offset);this.targetY=a.groundY>>16;if(this.reached()){this.step=0;this.phase=4;}else this.seek();}return;
  }
  if(!this.step){this.step=2;a.action(['headbutt','strike','kick','swipe'][this.attackAction>>1]??'headbutt');return;}
  if(this.step===2){if(a.animation.flags&128){this.step=4;a.action('neutral');}else a.animation.tick();return;}
  if(this.step===4){this.finishAction(world);return;}
  if(!--this.wait){this.targetX=word((target.x>>16)+this.offset);this.targetY=a.groundY>>16;if(this.reached()){this.step=0;this.phase=4;}else this.seek();}
 }
 update(world,target){this.world=world;if(this.state===2)this.approach(world,target);else this.attack(world,target);}
}
