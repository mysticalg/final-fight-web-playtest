import{Enemy}from'./enemy.js?v=c93fb57635';import{HeavyBrain}from'./heavy-brain.js?v=c93fb57635';
import{throwHealth}from'./grabs.js?v=c93fb57635';
const word=n=>n<<16>>16;
export class HeavyEnemy extends Enemy{
 constructor(data,{variant=10,x,y,level=0,direction=0,parameter=0}={}){
  super(data,x,y,0,variant);this.level=level;this.parameter=parameter;this.direction=direction;this.brain=new HeavyBrain(this);this.mode='entry';this.entryStep=0;this.drawn=false;this.contactsReady=false;
  const stats=this.character.levels[level];this.health=this.maxHealth=stats.health;this.defenseIndex=stats.defenseIndex;this.combat={...this.combat,damage:stats.damage};this.slamKeepsHeight=true;
 }
 tick(){const old=this.animation.address;this.animation.tick();if(old!==this.animation.address)this.imageOffset=0;}
 slide(){const next=word(this.vx-this.drag);this.vx=(this.vx>=0)===(next>=0)?next:0;this.x=(this.x+this.vx*256)|0;return!this.vx;}
 action(name){super.action(name==='corpse'&&this.burning?'burning':name);}
 startReaction(){const held=this.mode.startsWith('held');this.pendingReaction=false;this.brain.release();this.deferredFatal=held&&[5,6].includes(this.reaction)&&this.health<0;this.mode=this.health<0&&!this.deferredFatal?'heavyDeath':'heavyHurtInit';this.damagePhase=0;this.burning=this.health<0&&this.reaction===8;if(this.health<0)this.sound(44);if(!held&&this.health>=0&&(this.y>>16)!==(this.groundY>>16)&&this.reaction!==8)this.reaction=3;}
 restore(){this.mode='neutral';this.burning=false;this.brain.seek();this.imageOffset=0;}
 releaseHeld(){this.mode=(this.y>>16)>(this.groundY>>16)?'heavyReleaseFall':'heavyReleased';this.releasePhase=0;this.action(this.mode==='heavyReleaseFall'?'releasedFall':'neutral');}
 updateReleased(world){
  if(this.mode==='heavyReleased'){
   if(!this.releasePhase){this.releasePhase=2;this.y=this.groundY;world.collision?.resolve(this);this.wait=this.character.releaseWait[world.random.next()&31];}
   else if(!--this.wait)this.restore();return;
  }
  if(!this.releasePhase){this.releasePhase=2;this.vx=this.vy=0;return;}
  if(this.releasePhase===2){this.integrate();if((this.y>>16)<=(this.groundY>>16)){this.releasePhase=4;this.y=this.groundY;world.collision?.resolve(this);}return;}
  if(this.releasePhase===4){this.releasePhase=6;this.wait=57;this.action('released');return;}
  if(!--this.wait)this.restore();
 }
 updateThrown(world,holder){
  if(this.mode==='thrownPending'){this.mode='heavyThrown';this.throwPhase=2;this.vx=this.facing?-0x400:0x400;this.vy=0x400;this.collisionWait=0;this.throwImpact=false;this.action('thrown');return true;}
  if(this.mode!=='heavyThrown')return false;
  const impact=()=>{if(!this.throwImpact){this.health=throwHealth(this.health,holder.characterIndex);this.throwImpact=true;this.deferredFatal=this.health<0;if(this.deferredFatal)this.sound(44);}};
  if(this.throwPhase===2){
   if(this.hitStop){this.hitStop--;return true;}
   if(this.collisionWait)this.collisionWait--;
   else{
    this.integrate();if(world.collision?.resolve(this)){this.sound(13);impact();this.collisionWait=6;this.vx=0;if(this.vy>=0)this.vy=0;}
    if((this.y>>16)<=(this.groundY>>16)){this.sound(13);this.action('fall');impact();this.throwPhase=4;this.y=this.groundY;this.vx=this.facing?-0x100:0x100;this.vy=0x400;}
   }
   this.tick();
  }else if(this.throwPhase===4){
   this.integrate();if(world.collision?.resolve(this))this.vx=0;
   if((this.y>>16)<=(this.groundY>>16)){this.throwPhase=6;this.y=this.groundY;this.vx=this.facing?-0x100:0x100;this.drag=this.facing?-16:16;}this.tick();
  }else if(this.throwPhase===6){
   this.tick();if(this.slide()||world.collision?.resolve(this)){if(this.health<0){this.mode='heavyDeathDown';this.damagePhase=0;}else{this.throwPhase=8;this.wait=57;this.action('down');}}
  }else if(!--this.wait)this.restore();else this.tick();
  return true;
 }
 updateDeath(world){
  const phase=this.damagePhase;
  if(phase===8){this.removed=this.defeated=true;this.visible=this.drawn=false;this.mode='removed';return;}
  if(!phase){if(this.hitStop&&--this.hitStop)return;this.damagePhase=2;this.collisionWait=0;this.vx=this.facing?0x400:-0x400;this.vy=0x300;this.y=(this.y+16*65536)|0;this.action('corpse');return;}
  if(phase===2){
   this.tick();if(this.collisionWait&&--this.collisionWait)return;
   this.integrate();if(world.collision?.resolve(this)){this.sound(13);this.collisionWait=5;this.vx=0;if(this.vy>=0)this.vy=0;}
   if((this.y>>16)<=(this.groundY>>16)){this.sound(13);this.damagePhase=4;this.y=this.groundY;this.vx=this.facing?0x100:-0x100;this.vy=0x400;this.action('fall');}return;
  }
  if(phase===4){
   this.integrate();if(world.collision?.resolve(this))this.vx=0;
   if((this.y>>16)<=(this.groundY>>16)){this.damagePhase=6;this.y=this.groundY;this.vx=this.facing?0x100:-0x100;this.drag=this.facing?16:-16;}this.tick();return;
  }
  if(this.slide()||world.collision?.resolve(this)){this.damagePhase=8;world.awardScore?.([23,24,6][this.character.sourceCharacterId],this.owner??0);}
 }
 updateHurt(world){
  if(this.mode==='heavyHurtInit'){this.mode='heavyHurt';this.damagePhase=0;this.facing=this.hitFrom^1;return;}
  const phase=this.damagePhase,reaction=this.reaction;
  if(reaction===4){this.restore();return;}
  if(reaction<=2){
   if(!phase){this.damagePhase=2;this.action(reaction===1?'hurt1':'hurt');}
   else if(phase===2){this.tick();if(!this.animation.flags)this.damagePhase=4;}
   else if(phase===4){if(!this.hitStop||!--this.hitStop)this.damagePhase=6;}
   else{this.tick();this.imageOffset=word(this.imageOffset+(this.character.hurtShake[this.animation.remaining]??0));if(this.animation.flags&128)this.restore();}
   return;
  }
  const slam=reaction===5,drop=reaction===6;
  if(!phase){
   if(!slam&&!drop){this.damagePhase=2;if(reaction===8)this.burning=true;this.action('corpse');return;}
   if(this.hitStop&&--this.hitStop)return;
   this.damagePhase=2;this.collisionWait=0;this.vx=(drop?0x200:0x280)*(this.facing?-1:1)*(drop?1:-1);this.vy=drop?0x300:0x380;return;
  }
  if(!slam&&!drop&&phase===2){
   if(this.hitStop&&--this.hitStop)return;
   this.damagePhase=4;this.collisionWait=0;this.vx=this.facing?0x200:-0x200;this.vy=0x380;this.y=(this.y+16*65536)|0;this.action('corpse');return;
  }
  const flight=slam||drop?2:4,bounce=slam?4:6,slide=drop?4:slam?6:8,wait=drop?6:slam?8:10;
  if(phase===flight){
   if(!slam&&!drop)this.tick();
   if(this.collisionWait){this.collisionWait--;if(slam||drop||this.collisionWait)return;}
   this.integrate();if(world.collision?.resolve(this)){this.sound(13);this.collisionWait=drop||slam?4:5;this.vx=0;if(this.vy>=0)this.vy=0;}
   if((this.y>>16)<=(this.groundY>>16)){
    this.sound(13);this.y=this.groundY;
    if(drop){this.damagePhase=slide;this.facing^=1;this.action('fall');this.vx=this.facing?0x100:-0x100;this.drag=this.facing?20:-20;}
    else{this.damagePhase=bounce;this.vx=this.facing?0x280:-0x280;this.vy=slam?0x300:0x280;if(!slam)this.action('fall');}
   }return;
  }
  if(!drop&&phase===bounce){
   this.integrate();if(world.collision?.resolve(this))this.vx=0;
   if((this.y>>16)<=(this.groundY>>16)){
    this.y=this.groundY;this.damagePhase=slide;
    if(slam){this.facing^=1;this.action('fall');this.vx=this.facing?-0x100:0x100;this.drag=this.facing?-20:20;}
    else{this.vx=this.facing?0x100:-0x100;this.drag=this.facing?20:-20;}
   }
   if(!slam)this.tick();return;
  }
  if(phase===slide){
   if(slam||drop)this.tick();
   if(this.slide()||world.collision?.resolve(this)){if(this.health<0&&(slam||drop)){this.mode='heavyDeathDown';this.damagePhase=0;}else{this.damagePhase=wait;this.wait=57;this.action('down');}}return;
  }
  if(!--this.wait)this.restore();else this.tick();
 }
 update(world,target){
  if(this.removed)return;
  if(this.mode==='heavyDeathDown'){
   if(!this.damagePhase){this.damagePhase=2;this.wait=40;this.y=this.groundY;this.action('fall');}
   else if(!--this.wait){this.mode='heavyDeath';this.damagePhase=8;world.awardScore?.([23,24,6][this.character.sourceCharacterId],this.owner??0);}this.drawn=this.mode!=='heavyDeathDown'||!!(world.frame&1);return;
  }
  if(this.mode==='heavyDeath'){this.updateDeath(world);if(!this.removed)this.drawn=this.damagePhase!==6||!!(world.frame&1);return;}
  if(this.mode==='heavyHurtInit'||this.mode==='heavyHurt'){this.updateHurt(world);return;}
  if(this.mode==='heavyReleased'||this.mode==='heavyReleaseFall'){this.updateReleased(world);return;}
  if(this.mode==='entry'){
   if(!this.entryStep){this.entryStep=2;this.entryPhase=0;if(this.parameter===8)this.y=this.groundY=(this.y-65536)|0;return;}
   if(this.parameter===0){this.mode='neutral';this.action('neutral');return;}
   if(this.parameter===6){this.mode='neutral';this.brain.state=4;this.brain.phase=4;this.brain.attackId=0;this.brain.script=[8];this.brain.scriptIndex=0;this.brain.face(target);this.action('neutral');return;}
   const rules=this.character.heavyAI,close=()=>Math.abs((target.x>>16)-(this.x>>16))<=128&&Math.abs((target.y>>16)-(this.y>>16))<=32;
   const finish=()=>{this.mode='neutral';this.action('neutral');};
   if(this.parameter===2||this.parameter===4){
    if(!this.entryPhase){this.entryPhase=2;this.wait=rules.entryWait[world.random.next()&31];this.action(this.parameter===2?'entryWait':'entryAir');return;}
    if(this.entryPhase===2){if(!--this.wait||close()){this.brain.face(target);this.entryPhase=4;if(this.parameter===4){this.wait=30;this.action('entryLand');}}return;}
    if(this.parameter===4&&this.entryPhase===4){if(!--this.wait)this.entryPhase=6;this.animation.tick();return;}
    finish();return;
   }
   if(this.parameter===8){
    if(!this.entryPhase){this.entryPhase=2;this.y=this.groundY=(this.y-65536)|0;this.wait=rules.entryDropWait[world.random.next()&31];this.action('entryAir');return;}
    if(this.entryPhase===2){this.y=this.groundY=(this.y-65536)|0;if((this.y>>16)<144||!--this.wait)this.entryPhase=4;return;}
    if(this.entryPhase===4){this.y=this.groundY=(this.y-65536)|0;this.animation.tick();if(this.animation.flags){this.entryPhase=6;this.entryFallSpeed=(56-(this.y>>16))*4;this.entryArc=0x400;}return;}
    if(this.entryPhase===6||this.entryPhase===8){
     this.y=(this.y+this.entryFallSpeed*256)|0;this.groundY=(this.groundY+this.entryFallSpeed*256)|0;
     if(this.entryPhase===6){this.y=(this.y+this.entryArc*256)|0;this.entryArc-=32;if(this.entryArc<0){this.entryArc=0;this.entryPhase=8;}}
     else{this.y=(this.y-this.entryArc*256)|0;this.entryArc=Math.min(0x600,this.entryArc+32);if((this.y>>16)<=(this.groundY>>16)){this.entryPhase=10;this.wait=10;this.action('entryAir');world.shake?.();}}return;
    }
    if(this.entryPhase===10){if(!--this.wait)this.entryPhase=12;return;}
    if(this.entryPhase===12){this.animation.tick();if(this.animation.flags)this.entryPhase=14;return;}
    finish();return;
   }
   throw Error('Heavy entry is not translated yet');
  }
  this.contactsReady=true;this.drawn=true;if(!this.stationary)this.brain.update(world,target);if(this.pendingReaction)this.startReaction();
 }
}
