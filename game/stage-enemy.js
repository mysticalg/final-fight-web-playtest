import{Enemy}from'./enemy.js?v=4d9b688507';
import{createEnemyBrain}from'./j-brain.js?v=4d9b688507';
import{faceTarget}from'./enemy-ai.js?v=4d9b688507';
const word=n=>n<<16>>16;

// Original family 0/1 initialization and ordinary parameter 0–3 entry waits.
// Other parameter-specific climbs, barrels and scripted entrances are separate.
export class StageEnemy extends Enemy{
  constructor(data,{variant=0,parameter=0,direction=0,level=0,x,y}={}){
    super(data,x,y,parameter===7?0:direction,variant);this.parameter=parameter;this.spawnDirection=direction;this.direction=direction;this.mode='entry';this.entryStep='init';this.drawn=false;
    this.level=level;const stats=this.character.levels?.[level];
    if(stats){this.health=stats.health;this.defenseIndex=stats.defenseIndex;this.combat={...this.combat,damage:stats.damage};}this.maxHealth=this.health;
    this.brain=createEnemyBrain(this);
    if(this.character.aiLevels)this.brain.rules={...this.brain.rules,...Object.fromEntries(Object.entries(this.character.aiLevels).map(([k,v])=>[k,v[level]]))};
    if(!this.character.entry.supportedParameters.includes(parameter))throw new Error(`Stage enemy entry parameter ${parameter} is not translated`);
  }
  finishEntry(world,target){this.mode='neutral';this.brain.seek(world);faceTarget(this,target,true);}
  action(name){
    const root=this.character.poseActions?.[name]?.[this.pose??0];
    if(root!==undefined){this.animation.set(root);this.imageOffset=0;}else super.action(name);
  }
  hit(damage,reaction,facing,{unblockable=false,guardContact=false}={}){
    if(this.character.family!==2)return super.hit(damage,reaction,facing);
    if(!guardContact){this.guardReady=false;return super.hit(damage,reaction,facing);}
    this.guardContact=true;this.hitFrom=facing;this.hitStop=6;this.hitLatch=true;
    if(unblockable||reaction===7)this.guardReady=false;
    if(!this.guardReady)super.hit(damage,reaction,facing);
  }
  update(world,target){
    this.updateState(world,target);
    if(this.character.family===2&&this.guardContact){
      if(this.guardReady){this.hitStop=0;if(this.brain.state!=='guard'){this.facing=this.hitFrom^1;this.mode='neutral';this.brain.state='guard';this.brain.phase=0;}this.pendingReaction=false;}
      else if(this.pendingReaction)this.startReaction();
      if(this.brain.state==='guard'){this.guardContact=false;this.guardReady=true;}else this.brain.rollGuard(world);
    }else if(this.pendingReaction)this.startReaction();
  }
  updateState(world,target){
    this.contactsReady=!(this.mode==='entry'&&['init','windowWait'].includes(this.entryStep));
    if(this.mode!=='entry'){this.drawn=true;return super.updateState(world,target);}
    if(this.entryStep==='init'){
      this.blockedTimer=this.character.entry.blockedWait[world.random.next()&15];this.entryStep=this.parameter===7?'windowWait':'pose';
      if(this.character.family===2)this.brain.rollGuard(world);
      if(this.parameter===7){this.entryTimer=this.character.entry.window.waits[this.spawnDirection];this.facing=this.direction=0;}
      this.drawn=false;return;
    }
    if(this.entryStep==='windowWait'){
      if(!--this.entryTimer)this.entryStep='windowPose';this.drawn=false;return;
    }else if(this.entryStep==='windowPose'){
      this.action('entry7');this.entryStep='windowRise';this.windowTicks=3;this.entryTimer=15;this.y=(this.y+16*65536)|0;this.groundY=(this.groundY+16*65536)|0;
    }else if(this.entryStep==='windowRise'){
      this.animation.tick();
      if(!--this.windowTicks){this.windowTicks=3;if(--this.entryTimer<0)this.finishEntry(world,target);else{const dy=this.character.entry.window.offsets[this.entryTimer]*65536;this.y=(this.y+dy)|0;this.groundY=(this.groundY+dy)|0;}}
    }else if(this.entryStep==='pose'){
      if(this.character.actions[`entry${this.parameter}`]!==undefined)this.action(`entry${this.parameter}`);
      if(!this.parameter)this.finishEntry(world,target);
      else{this.entryTimer=this.character.entry.waits[(world.random.next()&62)>>1];this.entryStep='wait';}
    }else if(this.entryStep==='wait'){
      const close=(((word((target.x>>16)-(this.x>>16))+96)&65535)<=192)&&(((word((target.groundY>>16)-(this.groundY>>16))+128)&65535)<=256);
      if(!--this.entryTimer||(((world.frame+(world.actorPhase??0))&7)===0&&close)){
        this.entryTimer=10;this.entryStep='delay';this.animation.tick();
      }else if(world.spawnDisabled){this.health=-1;this.reaction=3;this.pendingReaction=true;}
    }else if(this.entryStep==='delay'){
      if(!--this.entryTimer)this.finishEntry(world,target);
      else if(world.spawnDisabled){this.health=-1;this.reaction=3;this.pendingReaction=true;}
    }
    this.visible=(((this.x>>16)-(world.cameraX??96)+48)&65535)<=480&&(((this.y>>16)-(world.cameraY??0)+128)&65535)<=384;this.drawn=this.visible;
  }
}
