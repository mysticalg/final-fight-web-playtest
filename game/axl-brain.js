import{BredBrain}from'./bred-brain.js?v=e8d37198c6';
import{advanceApproach,reachedPosition,faceTarget}from'./enemy-ai.js?v=e8d37198c6';

// Family 2 shares positioning and attack scripts with the thugs. Its six
// locomotion poses are retained for hurt animations, and it can block hits.
export class AxlBrain extends BredBrain{
  seek(){const a=this.actor;a.desiredSpeedX=0x23300;a.desiredSpeedY=0x11900;this.state='seek';this.phase=0;a.running=false;a.action('neutral');}
  walk(){const a=this.actor;a.desiredSpeedX=0x23300;a.desiredSpeedY=0x11900;this.state='choosePosition';this.phase=0;a.running=false;a.action('neutral');}
  run(){const a=this.actor;if(!a.running){a.desiredSpeedX=0x1e600;a.desiredSpeedY=0xf300;a.running=true;a.action('run');}this.state='run';this.phase=0;}
  resumeAttack(){this.state='attack';this.phase=0;this.actor.running=true;this.actor.action('run');}
  rollGuard(world){const a=this.actor;a.guardContact=false;a.guardReady=this.rules.guardRoll[world.random.next()&31]<this.rules.guardChance;}
  update(world,target){
    const a=this.actor;
    if(this.state==='guard'){
      if(!this.phase){a.speedX=a.speedY=0;a.hitStop=0;this.phase=2;this.guardTick=0;a.action('guard');a.sound(17);}
      else{
        const dx=this.rules.guardDisplacement[this.guardTick++];
        if(dx===255){if(this.reserved){this.resumeAttack();this.rollGuard(world);}else this.seek();}
        else{a.x=(a.x+dx*65536*(a.facing?1:-1))|0;world.collision?.resolve(a);}
      }
      return;
    }
    if(this.state==='approach'||this.state==='run'){
      if(this.cooldown)this.cooldown--;
      const invalid=this.targetInvalid(world,target);
      if(invalid<0){this.walk();return;}if(invalid>0){this.seek();return;}
      if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;return;}
      if(reachedPosition(a,target,world.slots)){this.decidePosition(world,target);return;}
      advanceApproach(a,target,world.slots);a.pose=a.animation.flags;
      if(this.blockedByObject(world,world.collision?.resolve(a)))return;
      if(((world.frame+(world.actorPhase??0))&7)===0)faceTarget(a,target);return;
    }
    const waiting=this.state==='waitPosition'&&!this.phase;
    super.update(world,target);
    if(waiting){a.running=false;a.action('neutral');}
  }
}



