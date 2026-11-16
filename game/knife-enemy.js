import{Enemy}from'./enemy.js?v=4d9b688507';
import{KnifeBrain}from'./knife-brain.js?v=4d9b688507';
import{throwHealth}from'./grabs.js?v=4d9b688507';
const word=n=>n<<16>>16;
export class KnifeEnemy extends Enemy{
 constructor(data,{variant=8,x,y,level=0,direction=0,parameter=0}={}){
  super(data,x,y,direction,variant);this.level=level;this.parameter=parameter;this.direction=direction;
  const stats=this.character.levels[level];this.health=stats.health;this.defenseIndex=stats.defenseIndex;this.combat={...this.combat,damage:stats.damage};this.maxHealth=this.health;
  this.brain=new KnifeBrain(this);this.mode='entry';this.entryStep=0;this.drawn=false;this.contactsReady=false;this.slamKeepsHeight=true;
 }
 startReaction(){
  this.pendingReaction=false;this.mode=this.health<0?'knifeDeath':'knifeHurtInit';this.damagePhase=0;
  if(this.weapon){this.weapon.hitFrom=this.hitFrom;this.weapon.dropped=true;this.weapon=null;}
 }
 restore(){this.mode='neutral';if(this.brain)this.brain.seek();else this.action('neutral');this.imageOffset=0;}
 releaseHeld(){this.mode='knifeReleased';this.releasePhase=((this.y>>16)&255)<=((this.groundY>>>24)&255)?4:0;this.wait=30;}
 updateReleased(){
  if(!this.releasePhase){this.releasePhase=2;this.fallSpeed=0;this.action('neutral');}
  else if(this.releasePhase===2){this.fallSpeed=word(this.fallSpeed-200);this.y=(this.y+this.fallSpeed*256)|0;if(this.y<=this.groundY){this.groundY=this.y;this.releasePhase=4;this.wait=30;this.action('neutral');}}
  else if(!--this.wait)this.restore();
 }
 updateThrown(world,holder){
  if(this.mode==='thrownPending'){
   this.mode='knifeThrown';this.throwPhase=2;this.vx=this.facing?-0x400:0x400;this.vy=0x400;this.impact=false;this.collisionWait=0;this.action('thrown');return true;
  }
  if(this.mode!=='knifeThrown')return false;
  const impact=()=>{if(!this.impact){this.health=throwHealth(this.health,holder.characterIndex);this.impact=true;}};
  if(this.throwPhase===2){
   if(this.hitStop){this.hitStop--;return true;}
   if(this.collisionWait)this.collisionWait--;
   else{
    this.integrate();if(world.collision?.resolve(this)>0&&!this.impact){impact();this.vx=0;this.collisionWait=4;if(this.vy>=0)this.vy=0;}
    if((this.y>>16)<=(this.groundY>>16)){this.action('down');impact();this.throwPhase=4;this.y=this.groundY;this.vx=this.facing?-0x100:0x100;this.vy=0x400;this.sound(13);}
   }
   this.animation.tick();
  }else if(this.throwPhase===4){
   this.integrate();if(world.collision?.resolve(this)>0)this.vx=0;
   if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.throwPhase=6;this.vx=this.facing?-0x100:0x100;this.drag=this.facing?-16:16;}
   this.animation.tick();
  }else if(this.throwPhase===6){
   this.animation.tick();if(this.slide()||world.collision?.resolve(this)>0){
    if(this.health<0){this.mode='knifeDeath';this.damagePhase=8;world.awardScore?.(this.character.sourceCharacterId?29:6,this.owner??0);}
    else{this.throwPhase=8;this.wait=20;if(this.brain){this.brain.world=world;this.brain.face(holder);}this.action('recover');}
   }
  }else if(!--this.wait)this.restore();else this.animation.tick();
  return true;
 }
 slide(){const v=word(this.vx-this.drag);this.vx=(this.vx>=0)===(v>=0)?v:0;this.x=(this.x+this.vx*256)|0;return!this.vx;}
 updateHurt(world,target){
  if(this.mode==='knifeHurtInit'){this.facing=this.hitFrom^1;if(![5,6,8].includes(this.reaction)&&(this.y>>16)!==(this.groundY>>16))this.reaction=3;this.damagePhase=0;this.mode='knifeHurt';return;}
  const phase=this.damagePhase;
  if(this.reaction===4){this.restore();return;}
  if(this.reaction<=2){
   if(!phase){this.damagePhase=2;this.action(this.reaction===1?'hurt1':'hurt');}
   else if(phase===2){this.animation.tick();if(!this.animation.flags)this.damagePhase=4;}
   else if(phase===4){if(!this.hitStop||!--this.hitStop)this.damagePhase=6;}
   else{
    this.animation.tick();this.imageOffset=word(this.imageOffset+(this.character.hurtShake[this.animation.remaining]??0));
    if(this.animation.flags&128)this.restore();
   }
   return;
  }
  const slam=this.reaction===5||this.reaction===6;
  if(!phase){
   if(slam){if(this.hitStop&&--this.hitStop)return;this.y=this.groundY;this.vx=this.reaction===5?0x280:0x200;this.vy=this.reaction===5?0x380:0x300;this.facing=this.hitFrom^1;if(this.reaction===5?!this.facing:this.facing)this.vx=-this.vx;this.damagePhase=4;this.collisionWait=0;this.sound(13);}
   else{this.damagePhase=2;this.action('fall');}
  }else if(phase===2){
   if(this.hitStop&&--this.hitStop)return;
   this.damagePhase=4;this.vx=this.facing?0x200:-0x200;this.vy=0x380;this.y+=16*65536;this.collisionWait=0;this.action('fall');
  }else if(phase===4||phase===6){
   if(!slam&&phase===4)this.animation.tick();
   if(this.collisionWait)this.collisionWait--;
   else{
    this.integrate();
    if(world.collision?.resolve(this)>0){this.vx=0;if(this.vy>=0)this.vy=0;if(phase===4)this.collisionWait=slam?4:5;}
    if((this.y>>16)<=(this.groundY>>16)){
     this.y=this.groundY;
     if(slam&&this.reaction===6){this.damagePhase=8;this.facing^=1;this.action('down');this.vx=this.facing?0x100:-0x100;this.drag=this.facing?20:-20;}
     else if(phase===4){this.damagePhase=6;this.vx=this.facing?0x280:-0x280;this.vy=slam?0x300:0x280;this.sound(13);if(!slam)this.action('down');}
     else{this.damagePhase=8;if(slam){this.facing^=1;this.action('down');this.vx=this.facing?-0x100:0x100;this.drag=this.facing?-20:20;}else{this.vx=this.facing?0x100:-0x100;this.drag=this.facing?20:-20;}}
    }
   }
   if(!slam&&phase===6)this.animation.tick();
  }else if(phase===8){
   if(slam)this.animation.tick();const stopped=this.slide()||world.collision?.resolve(this)>0;
   if(stopped){this.damagePhase=10;this.wait=slam?57:20;if(this.brain){this.brain.world=world;this.brain.face(target);}this.action('recover');}
  }else if(!--this.wait)this.restore();else this.animation.tick();
 }
 updateDeath(world){
  const phase=this.damagePhase;
  if(!phase){
   if(!this.deathScored){this.deathScored=true;world.awardScore?.(this.character.sourceCharacterId?29:6,this.owner??0);}
   if(this.hitStop&&--this.hitStop)return;
   this.damagePhase=2;this.vx=this.facing?0x400:-0x400;this.vy=0x300;this.y+=16*65536;this.action('fall');this.collisionWait=0;
  }else if(phase===2||phase===4){
   if(phase===2)this.animation.tick();
   if(this.collisionWait)this.collisionWait--;
   else{
    this.integrate();if(world.collision?.resolve(this)>0){this.vx=0;if(this.vy>=0)this.vy=0;if(phase===2)this.collisionWait=5;}
    if((this.y>>16)<=(this.groundY>>16)){
     this.y=this.groundY;
     if(phase===2){this.damagePhase=4;this.vx=this.facing?0x100:-0x100;this.vy=0x400;this.sound(13);this.action('down');}
     else{this.damagePhase=6;this.vx=this.facing?0x100:-0x100;this.drag=this.facing?16:-16;}
    }
   }
   if(phase===4)this.animation.tick();
  }else if(phase===6){
   const stopped=this.slide()||world.collision?.resolve(this)>0;
   if(stopped)this.damagePhase=8;
  }else if(phase===8){this.mode='removed';this.removed=this.defeated=true;this.drawn=false;}
  else{this.mode='removed';this.removed=this.defeated=true;this.drawn=false;}
 }
 updateState(world,target){
  if(this.mode.startsWith('knifeHurt')){this.drawn=true;this.updateHurt(world,target);return;}
  if(this.mode==='knifeDeath'){this.facing=this.hitFrom^1;this.updateDeath(world);return;}
  if(this.mode==='knifeReleased'){this.updateReleased();return;}
  if(this.mode!=='entry'){this.drawn=true;this.contactsReady=true;return super.updateState(world,target);}
  if(!this.entryStep){this.entryStep=1;if(this.parameter){this.y+=288*65536;this.fallSpeed=0;}else this.mode='neutral';return;}
  this.drawn=true;this.contactsReady=false;
  if(this.entryStep===1){this.entryStep=2;this.fallSpeed=-512;this.action('leapStart');}
  else if(this.entryStep===2){this.animation.tick();this.fallSpeed=word(this.fallSpeed-56);this.y=(this.y+this.fallSpeed*256)|0;if((this.y>>16)<(this.groundY>>16)){this.y=this.groundY;this.entryStep=3;this.wait=20;this.action('recover');}}
  else if(!--this.wait){this.mode='neutral';this.brain.seek(world);}
 }
}
