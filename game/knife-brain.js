const word=n=>n<<16>>16;
function heading(dx,dy){
 dx=word(dx);dy=word(dy*2);const x=Math.abs(dx),y=Math.abs(dy);
 let a=x===0?64:y===0?0:x>=y?Math.floor(y*32/x):64-Math.floor(x*32/y);
 if(dx<0)a=128-a;if(dy<0)a=256-a;return(((64-a+4)&255)>>>3)&31;
}

// Hollywood/El Gado's independent positioning and unarmed attack controller.
// Original tables are data; each transition here is native JavaScript.
export class KnifeBrain{
 constructor(actor){this.actor=actor;this.rules=actor.character.knifeAI;this.state=0;this.phase=0;this.step=0;this.reserved=false;}
 release(){}
 seek(){this.state=this.phase=this.step=0;this.actor.action('neutral');}
 face(target,release=true){
  const slots=this.world.knifeSlots??=Array(4).fill(0),a=this.actor;
  if(release&&slots[a.facing])slots[a.facing]--;
  a.facing=(target.x>>16)>(a.x>>16)?0:1;slots[a.facing]=(slots[a.facing]+1)&255;
 }
 point(target){const a=this.actor;this.targetX=word((target.x>>16)+(a.facing?this.offset:-this.offset));this.targetY=target.groundY>>16;}
 choose(world,target){
  this.offset=this.rules.offsets[world.random.next()&15];this.face(target);this.point(target);
  this.actor.direction=heading(this.targetX-(this.actor.x>>16),this.targetY-(this.actor.y>>16));
 }
 reached(){const a=this.actor;return((word(this.targetX-(a.x>>16))+4)&65535)<=8&&((word(this.targetY-(a.y>>16))+4)&65535)<=7;}
 move(world,kind=this.motionBank??'patrol'){
  const a=this.actor,[x,y]=this.rules.velocity[kind][a.direction];a.x=(a.x+x*256)|0;a.y=(a.y+y*256)|0;a.groundY=a.y;
  const response=world.collision?.resolve(a)??0;a.animation.tick();return response;
 }
 turn(world,target){
  if(!(world.frame&1))return;
  const a=this.actor,d=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16));let difference=(d-a.direction)&31;
  const close=((word((target.x>>16)-(a.x>>16))+40)&65535)<=80&&((word((target.y>>16)-(a.y>>16))+20)&65535)<=40;
  if(!difference){if(!close)return;difference=(world.random.next()&64)?1:-1;}
  else difference=(difference<16?1:-1)*(close?-1:1);
  a.direction=(a.direction+difference)&31;
 }
 chooseAttack(world,target){
  this.face(target);const weights=this.actor.weapon?this.rules.armedWeights[(Math.max(0,Math.abs(word((target.x>>16)-(this.actor.x>>16)))-33)&224)>>>5]:this.rules.attackWeights;
  this.script=this.rules.scripts[weights[world.random.next()&31]];this.scriptIndex=1;
  this.state=2;this.phase=this.script[0];this.step=0;
 }
 considerAttack(world,target){
  const a=this.actor;this.world=world;
  if(target.mode!=='dead'&&!target.evading&&((word((target.x>>16)-(a.x>>16))+64)&65535)<=128&&((word((target.y>>16)-(a.y>>16))+9)&65535)<=18){
   this.chooseAttack(world,target);if(this.phase>=18)this.phase=this.script[this.scriptIndex++];return;
  }
  if(target.mode==='dead'||target.evading||((word((target.groundY>>16)-(a.y>>16))+4)&65535)>7){this.attackPending=false;return;}
  if(this.attackPending&&--this.attackCooldown)return;
  if(this.rules.attackBits[a.level??0]&(1<<(world.random.next()&15)))this.chooseAttack(world,target);
  else{this.attackPending=true;this.attackCooldown=30;}
 }
 finishAttack(world){
  this.phase=16;this.actor.action('neutral');
  this.wait=this.scriptIndex>=this.script.length?this.rules.restWait[world.random.next()&31]:this.rules.attackWait[world.random.next()&31];
 }
 updateAttack(world,target){
  const a=this.actor;
  if(a.hitStop){a.hitStop--;return;}
  if(this.phase===0){
   if(!this.step){
    this.step=2;this.wait=10;const weapons=world.knifeWeapons??=[];
    if(weapons.filter(w=>!w.removed).length<6){a.weapon=world.createKnife?.(a)??{holder:a};weapons.push(a.weapon);a.action('knifeThrow');}
    else{this.state=this.phase=0;}
   }else if(!--this.wait){this.state=this.phase=0;}
   return;
  }
  if(this.phase===12){
   if(!this.step){if(!a.weapon||(a.x>>16)<world.cameraX+16||(a.x>>16)>world.cameraX+368){this.state=this.phase=0;return;}this.step=2;this.wait=30;a.action('knifeThrow');}
   else if(this.step===2){if(!--this.wait){this.step=4;this.wait=20;world.throwKnife?.(a.weapon,a,target);}a.animation.tick();}
   else if(this.step===4){if(!--this.wait){a.weapon=null;this.step=6;this.wait=1;}a.animation.tick();}
   else if(!--this.wait)this.finishAttack(world);else a.animation.tick();
   return;
  }
  if(this.phase===14){
   if(!this.step){this.step=2;this.wait=this.rules.rushWait[world.random.next()&31];this.face(target);a.action('leapPrepare');}
   else if(this.step===2){if(!--this.wait){this.step=4;this.wait=8;this.vx=word(((target.x>>16)-(a.x>>16))*8);this.vy=0x880;a.action('leap');}}
   else if(this.step===4||this.step===6){
    this.vy=word(this.vy-0x58);a.y=(a.y+this.vy*256)|0;a.x=(a.x+this.vx*256)|0;
    if(this.step===4){a.animation.tick();if(!--this.wait)this.step=6;}
    else{
     if(world.collision?.resolve(a)>0)this.vx=0;
     if(a.y<=a.groundY){a.y=a.groundY;this.step=8;this.wait=20;a.action('leapPrepare');}else a.animation.tick();
    }
   }else if(!--this.wait)this.finishAttack(world);else a.animation.tick();
   return;
  }
  if(this.phase===16){
   if(!--this.wait){
    const next=this.script[this.scriptIndex++];
    if(next===undefined||((word((target.groundY>>16)-(a.y>>16))+4)&65535)>7){this.state=4;this.phase=0;}
    else{this.face(target,false);this.point(target);if(!this.reached()){this.state=4;this.phase=0;}else{this.phase=next;this.step=0;}}
   }
   return;
  }
  if(this.phase===18||this.phase===20){
   if(!this.step){this.step=2;this.offset=this.phase===18?64:104;this.face(target);this.point(target);a.direction=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16));}
   else{
    this.face(target,false);this.point(target);
    if(this.reached()){this.phase=this.script[this.scriptIndex++];this.step=0;}
    else{a.direction=heading(this.targetX-(a.x>>16),this.targetY-(a.y>>16));this.move(world);}
   }
   return;
  }
  if([2,4,8,10].includes(this.phase)){
   if(!this.step){this.step=2;this.wait=18;a.action({2:'jab',4:'strike',8:'kick',10:'head2'}[this.phase]);}
   else if(!--this.wait)this.finishAttack(world);else a.animation.tick();
   return;
  }
  if(this.phase===6){
   if(!this.step){this.step=2;this.wait=this.rules.rushWait[world.random.next()&31];this.face(target);a.action('rushPrepare');}
   else if(this.step===2){if(!--this.wait){this.step=4;this.wait=30;this.vx=a.facing?-0x700:0x700;this.drag=a.facing?0x38:-0x38;a.action('rushStart');}}
   else if(this.step===4){this.vx=word(this.vx+this.drag);a.x=(a.x+this.vx*256)|0;const blocked=world.collision?.resolve(a)??0;if(blocked||!--this.wait){this.step=6;this.wait=10;a.action('rushPrepare');}}
   else if(this.step===6){if(!--this.wait){this.step=8;this.wait=10;this.face(target);a.action('neutral');}}
   else if(!--this.wait)this.finishAttack(world);else a.animation.tick();return;
  }
  // Weapon acquisition/throw commands are admitted by the weapon controller.
  this.seek(world);
 }
 update(world,target){
  const a=this.actor;this.world=world;
  if(this.state===2){this.updateAttack(world,target);return;}
  if(this.state===4){
   if(!this.phase){
    this.phase=2;this.motionBank='dodge';this.attackPending=false;this.wait=this.rules.dodgeWait[world.random.next()&15];
    a.direction=this.rules[a.facing?'dodgeLeft':'dodgeRight'][world.random.next()&15];
    if(a.facing?a.direction>=16:a.direction<16){
     if((world.knifeSlots?.[a.facing]??0)<2)a.direction=(a.direction+16)&31;
     else{this.phase=4;this.step=0;this.wait=1;this.face(target);if(a.facing)this.offset=word(-this.offset);this.targetX=word((target.x>>16)+this.offset);this.targetY=target.groundY>>16;}
    }
    a.action('neutral');
   }else if(this.phase===2){
    if(!--this.wait){this.state=0;this.phase=0;}
    else{
     const[x,y]=this.rules.velocity.dodge[a.direction];a.x=(a.x+x*256)|0;a.y=(a.y+y*256)|0;a.groundY=a.y;
     const blocked=world.collision?.resolve(a)??0;
     if(blocked||(a.x>>16)<world.cameraX+32||(a.x>>16)>=world.cameraX+480){this.state=0;this.phase=0;}
     else a.animation.backward();
    }
   }else{
    if(!this.step){if(!--this.wait)this.step=2;}
    else{this.point(target);this.turn(world,target);this.move(world);if(this.reached()){this.state=0;this.phase=6;this.attackPending=false;}}
   }
   if((world.frame+(world.actorPhase??0))%4===0){this.face(target);this.point(target);}
   this.considerAttack(world,target);return;
  }
  if(!this.phase){this.phase=2;this.motionBank='patrol';this.wait=12;this.retarget=10;this.choose(world,target);a.action('neutral');}
  else if(this.phase===2){
   if(!--this.wait){
    if(!--this.retarget){this.retarget=10;this.choose(world,target);}
    this.wait=12;
    if(this.rules.pauseChance[world.random.next()&15]){this.wait=this.rules.pauseWait[world.random.next()&15];this.phase=4;}
   }
   if(this.phase===2){
    this.turn(world,target);const blocked=this.move(world);
    if(this.reached()){this.phase=6;this.attackPending=false;}
    if(blocked)this.choose(world,target);
   }
  }else if(this.phase===4){if(!--this.wait){this.phase=2;this.wait=12;this.retarget=10;this.choose(world,target);}}
  else if(this.phase===6){this.face(target,false);this.point(target);if(!this.reached()){this.phase=2;this.wait=12;this.retarget=10;this.choose(world,target);}}
  if((world.frame+(world.actorPhase??0))%4===0){this.face(target,false);this.point(target);}
  this.considerAttack(world,target);
 }
}
