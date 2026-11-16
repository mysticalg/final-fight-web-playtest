import{KnifeEnemy}from'./knife-enemy.js?v=4d9b688507';
class RunnerBrain{
 constructor(actor){this.actor=actor;this.rules=actor.character.knifeAI;this.seek();}
 seek(){this.state='run';this.timer=180;this.thrown=false;this.actor.action('neutral');}
 release(){}
 face(target){this.actor.facing=target.x<this.actor.x?1:0;}
 update(world,target){
  const a=this.actor;if(a.hitStop){a.hitStop--;return;}
  if(this.state==='throw'){
   a.animation.tick();
   
   if(a.animation.flags&128){this.state='run';a.action('neutral');}
  }else{
   if(!this.thrown&&Math.abs(target.x-a.x)<180*65536){this.face(target);this.state='throw';this.thrown=true;const knife=world.createKnife?.(a);if(knife){a.weapon=knife;world.knifeWeapons.push(knife);}a.action('knifeThrow');world.throwKnife?.();return;}
   a.x=(a.x+(a.facing?-1:1)*0x40000)|0;a.animation.tick();
   if(--this.timer<=0||this.thrown&&Math.abs((a.x>>16)-world.cameraX-192)>272){a.removed=true;a.visible=false;}
  }
 }
}
export class KnifeRunner extends KnifeEnemy{
 constructor(data,event){super(data,event);this.paletteOverride=12;this.mode='neutral';this.drawn=true;this.contactsReady=true;this.brain=new RunnerBrain(this);this.facing=event.direction===24?0:1;}
}
