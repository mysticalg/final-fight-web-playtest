import{BredBrain}from'./bred-brain.js?v=a4b5092206';
import{advanceApproach,reachedPosition,faceTarget}from'./enemy-ai.js?v=a4b5092206';
import{AxlBrain}from'./axl-brain.js?v=a4b5092206';
import{KnifeBrain}from'./knife-brain.js?v=a4b5092206';
export function createEnemyBrain(actor){return actor.character.family===5?new KnifeBrain(actor):actor.character.family===2?new AxlBrain(actor):actor.character.family===1?new JBrain(actor):new BredBrain(actor);}

// J/Two.P single-target controller (02832C–028F2E). Their locomotion speed
// follows animation flags; they can abandon an attack and retreat when the
// target starts a strike. Dynamic-obstacle attacks remain separate work.
export class JBrain extends BredBrain{
  nextAttack(world){
    if(this.script&&this.scriptIndex<this.script.length){this.phase=this.script[this.scriptIndex++];this.attackStep=0;return;}
    if(this.script&&(world.random.next()&31)>=this.rules.repeatChance){
      this.script=null;this.actor.running=false;this.state='choosePosition';this.phase=0;this.actor.action('aggressiveRun');this.release(world);return;
    }
    this.script=this.rules.attackScripts[this.rules.attackWeights[world.random.next()&31]>>1];this.scriptIndex=0;
    this.phase=this.script[this.scriptIndex++];this.attackStep=0;
  }
  resumeAttack(){this.state='attack';this.phase=0;this.actor.action('run');this.evadeIntent=false;}
  move(world,target){
    const actor=this.actor,speed=this.rules.movement[actor.animation.flags];
    if(!speed)throw new Error(`Unrecovered J movement phase ${actor.animation.flags}`);
    [actor.speedX,actor.speedY]=speed;
    advanceApproach(actor,target,world.slots,{accelerate:false});
    const response=world.collision?.resolve(actor);
    if(['approach','run'].includes(this.state)&&this.blockedByObject(world,response))return true;
    if(response&&world.occupiedSlots?.[actor.positionSlot])this.walk();
  }
  run(){
    this.state='run';this.phase=0;
    if(this.reserved)this.actor.action('aggressiveRun');
    else if(!this.actor.running){this.actor.action('run');this.actor.running=true;}
  }
  attackReset(){this.state='attack';this.phase=0;this.actor.action('aggressiveRun');}
  shouldEvade(world,target){
    if((target.pressedInput&16)&&(target.attackActive||target.airAttackUsed||target.airDownUsed)){
      if((world.random.next()&31)<this.rules.evadeChance)this.evadeIntent=true;
    }
    return !!this.evadeIntent;
  }
  retreat(world){this.evadeIntent=false;this.actor.running=false;this.state='retreat';this.phase=0;this.actor.action('retreat');this.release(world);}
  update(world,target){
    if(this.state==='obstacle'){this.updateObstacle(world);return;}
    const actor=this.actor,periodic=((world.frame+(world.actorPhase??0))&7)===0;
    if(this.cooldown)this.cooldown--;
    if(this.state==='seek'){
      if(!target||target.mode==='dead')return this.walk();
      faceTarget(actor,target,true);this.cooldown=180;this.walk();return;
    }
    if(this.state==='choosePosition'){
      this.state='approach';this.phase=0;faceTarget(actor,target,true);this.choosePosition(world,target);return;
    }
    if(this.state==='runInit'){
      this.run();faceTarget(actor,target);actor.positionSlot=(target.x>>16)>(actor.x>>16)?3:7;return;
    }
    if(this.state==='approach'||this.state==='run'){
      if(this.targetInvalid(world,target)){this.walk();return;}
      if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;return;}
      if(reachedPosition(actor,target,world.slots)){this.decidePosition(world,target);return;}
      if(this.move(world,target))return;if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='waitPosition'){
      if(!this.phase){this.phase=2;this.wait=70;actor.action('neutral');}
      else if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;}
      else if(!reachedPosition(actor,target,world.slots)){if(actor.running)this.walk();else{this.state='choosePosition';this.phase=0;}}
      else if(!--this.wait)this.decidePosition(world,target);
      if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='retreat'){
      if(!this.phase){this.phase=2;faceTarget(actor,target,true);this.choosePosition(world,target);}
      else if(this.targetInvalid(world,target))this.walk();
      else if(reachedPosition(actor,target,world.slots)){this.state='retreatWait';this.phase=0;}
      else this.move(world,target);
      if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='retreatWait'){
      if(!this.phase){this.phase=2;this.wait=this.rules.retreatWait[world.random.next()&31];actor.action('neutral');}
      else if(this.inCloseRange(target)){this.reserve(world);this.state='attack';this.phase=0;}
      else if(!reachedPosition(actor,target,world.slots)){this.state='choosePosition';this.phase=0;}
      else if(!--this.wait)this.decidePosition(world,target);
      if(periodic)faceTarget(actor,target);return;
    }
    if(this.state==='attack'){
      if(actor.hitStop){actor.hitStop--;return;}
      if(!this.phase){
        if(this.targetInvalid(world,target)){this.walk();return;}
        if(this.shouldEvade(world,target)){this.retreat(world);return;}
        faceTarget(actor,target,true);
        if(target.airborne||target.evading){this.phase=target.airborne?2:4;this.attackStep=0;return;}
        if(this.inCloseRange(target))this.reserve(world);
        if(!this.canStartAttack(target)){this.state='choosePosition';this.phase=0;this.release(world);return;}
        this.nextAttack(world);return;
      }
      if(this.phase===2||this.phase===4){
        if(!this.attackStep){this.attackStep=2;this.wait=(this.phase===2?this.rules.shortWait:this.rules.longWait)[world.random.next()&31];}
        else if(!--this.wait){this.state='attack';this.phase=0;}
        if(periodic)faceTarget(actor,target);
      }else{
        const action={6:'kick',8:'kickFinish',10:'jab',12:'kickFinish'}[this.phase];
        if(!action)throw new Error(`Unrecovered J attack phase ${this.phase}`);
        if(!this.attackStep){this.attackStep=2;actor.action(action);}
        else{actor.animation.tick();if(actor.animation.flags&128)this.attackReset();}
      }
      if(this.shouldEvade(world,target))this.retreat(world);return;
    }
    throw new Error(`Unrecovered J controller state ${this.state}`);
  }
}
