import{Animation}from'./animation.js?v=683f011c56';
const word=value=>value<<16>>16;
export function containerDrop(data,prop,random,pressedInput=0){
  let item=prop.parameter??255;
  if((prop.owner??0)>=0&&(pressedInput&47))item=20+(random.next()&1);
  else if(item&128){if(item===255)return null;item=data.dropTables[item&15][random.next()&31];if(item&128)return null;}
  const y=word((prop.groundY>>16)-2+(prop.subtype===10?14:0));
  return{type:item<36?18:6,subtype:item<36?0:item-36,variant:item<36?item:0,parameter:item<36?0:1,x:prop.x&-65536,y:y*65536};
}

// Two original breakable-container handlers: 05176A and 05242A. Drops are
// emitted as declarative events; pickup/weapon actors have their own lifecycle.
export class Prop{
  constructor(data,{subtype=1,variant=0,direction=0,parameter=255,x,y}={}){
    this.data=data;this.subtype=subtype;this.variant=variant;this.appearance=subtype===1?direction:0;this.parameter=parameter;
    this.character=data.props[subtype];this.combat=this.character.combat;this.defenseIndex=0;this.health=0;
    this.x=x;this.y=this.groundY=y;this.facing=subtype===1?0:direction;this.direction=0;this.owner=0;
    this.hitStop=0;this.hitLatch=false;this.imageOffset=0;this.grabbable=false;this.isProp=true;this.mode='init';this.visible=true;this.drawn=false;
    this.animation=new Animation(data.animationEntries,this.character.actions.idle[this.appearance]);
  }
  get solid(){return this.mode==='intact';}
  sound(command){if(this.visible)this.onSound?.(command);}
  hit(damage,reaction,facing){this.health=word(this.health-damage);this.hitFrom=facing;this.hitStop=6;this.hitLatch=true;}
  integrate(){this.x=(this.x+this.vx*256)|0;this.vy=word(this.vy-0x48);this.y=(this.y+this.vy*256)|0;}
  decelerate(){const next=word(this.vx-this.drag);this.vx=(this.vx>=0)===(next>=0)?next:0;this.x=(this.x+this.vx*256)|0;}
  screen(world){return(((this.x>>16)-(world.cameraX??96)+48)&65535)<=480&&(((this.y>>16)-(world.cameraY??0)+128)&65535)<=384;}
  update(world){
    this.drawn=false;
    if(this.mode==='removed')return;
    if(this.mode==='removePending'){this.mode='removed';this.removed=true;this.visible=false;return;}
    if(this.mode==='init'){this.mode='intact';return;}
    if(this.mode==='intact'){
      if(this.health<0){this.mode='breakPending';this.direction=this.hitFrom;if(![4,8].includes(this.subtype))this.facing=this.direction;this.visible=this.screen(world);this.drawn=this.visible;if(this.subtype===1&&this.owner<0)this.sound(24);return;}
      if(this.subtype===1&&this.appearance===7){
        if(!this.hopStep){this.hopStep=1;this.hopTimer=68;}
        else if(this.hopStep===1){if(this.hopTimer){if(!--this.hopTimer){this.vx=-0x300;this.vy=0x300;}}else{this.integrate();if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.vx=-0x200;this.drag=-32;this.hopStep=2;}}}
        else if(this.hopStep===2){this.decelerate();if(!this.vx)this.hopStep=3;}
      }
      if(((world.frame+(world.actorPhase??0))&31)===0&&((((this.x>>16)-(world.cameraX??96)+128)&65535)>640||(((this.y>>16)-(world.cameraY??0)+128)&65535)>512))this.mode='removePending';
      this.visible=this.screen(world);this.drawn=this.visible;return;
    }
    if(this.mode==='breakPending'){
      this.mode='breaking';this.breakStep=[4,8].includes(this.subtype)?'stationary':'flight';this.breakTimer=this.subtype===5?70:50;
      this.vx=([1,6].includes(this.subtype)?0x400:0x600)*(this.direction?-1:1);this.vy=[1,6].includes(this.subtype)?0x300:0x800;this.collisionWait=0;
      this.animation.set(this.character.actions.broken);
      if([4,6,8].includes(this.subtype)){const phase=world.random.next()&3;world.spawnDebris?.(this,phase);if(this.owner<0)this.sound(this.subtype===8?22:23);else world.awardScore?.(this.subtype===8?21:this.subtype===4?7:18,this.owner);}
      else if(this.subtype===5){if(this.owner<0)this.sound(24);else world.awardScore?.(16,this.owner);}
      else if(!this.appearance&&this.owner>=0)world.awardScore?.(33,this.owner);
      if(this.subtype!==1||this.appearance<2){const drop=containerDrop(this.data,this,world.random,world.pressedInput??0);if(drop)world.dropItem?.(drop,this);}
    }else if(this.breakStep==='flight'){
      if(this.collisionWait)this.collisionWait--;
      else{
        this.integrate();
        if(world.collision?.resolveCenterAir(this)>0){this.vx=0;this.collisionWait=5;if(this.vy>=0)this.vy=0;}
        if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.breakStep='bounce';this.vx=0x100*(this.direction?-1:1);this.vy=0x400;}
      }
    }else if(this.breakStep==='bounce'){
      this.integrate();if(world.collision?.resolveCenterAir(this)>0){this.vx=0;if(this.subtype===1)this.drag=0;}
      if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.breakStep='slide';this.vx=0x100*(this.direction?-1:1);this.drag=this.subtype===1?16:16*(this.direction?-1:1);}
    }else if(this.breakStep==='slide'){
      this.decelerate();if(!this.vx||world.collision?.resolveCenterAir(this)>0)this.mode='removePending';
    }
    this.breakTimer--;
    const onscreen=this.screen(world);
    if(this.breakTimer<0||!onscreen){this.mode='removePending';this.visible=onscreen;return;}
    const flash=[1,0,0,1,0,0,1,0,1,0,1,0,1,0,1,0];this.visible=onscreen;this.drawn=this.breakTimer>=16||!!flash[this.breakTimer];
  }
}
