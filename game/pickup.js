import{Animation}from'./animation.js?v=21ea355a4c';
const word=n=>n<<16>>16;
const integerY=(actor,value)=>{actor.y=((value<<16)|(actor.y&65535))|0;};

export function collectPickup(player,items,awardScore){
  if(player.floorOffset)return null;
  for(const item of items){
    if(item.mode!=='active')continue;
    const dx=word((player.x>>16)-(item.x>>16)),dy=word((player.groundY>>16)-(item.groundY>>16));
    if(Math.abs(dx)>22||Math.abs(dy)>11||(((item.y>>16)-(item.groundY>>16))&65535)>24)continue;
    item.mode='collected';item.collectStep=0;
    const{heal,score}=item.definition;
    if(heal&&(player.health&65535)<144){player.health=Math.min(144,word(player.health+heal));player.previousHealth=player.health;}
    else if(score!==null)awardScore?.(score,player.playerIndex??0);
    return item;
  }
  return null;
}

export class Pickup{
  constructor(data,{variant=0,direction=0,x,y,owner=null}={}){
    this.data=data;this.variant=variant;this.direction=direction;this.definition=data.pickups[variant];this.owner=owner;
    this.x=x;this.y=this.groundY=y;this.vx=0;this.facing=0;this.floorOffset=0;
    this.mode='init';this.visible=true;this.drawn=false;this.paletteOverride=0;
    this.animation=new Animation(data.animationEntries,this.definition.animation);
  }
  integrate(){this.vy=word(this.vy-this.gravity);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;}
  edge(world){const x=this.x>>16,left=(world.cameraX??96)+30;if(x<left)this.vx=0x200;else if(x>left+324)this.vx=-0x200;}
  screen(world){return(((this.x>>16)-(world.cameraX??96)+48)&65535)<=480&&(((this.y>>16)-(world.cameraY??0)+128)&65535)<=384;}
  update(world){
    this.drawn=false;
    if(this.mode==='removed')return;
    if(this.mode==='removePending'){this.mode='removed';this.removed=true;this.visible=false;return;}
    if(this.mode==='init'){
      this.mode='active';this.paletteOverride=7;this.blinkOn=1;this.blinkOff=0;
      this.motion=this.variant===35?8:[0,6,12][this.direction];return;
    }
    if(this.mode==='collected'){
      if(!this.collectStep){this.paletteOverride=0;this.collectStep=1;this.collectTimer=9;}
      else if(!--this.collectTimer)this.mode='removePending';
    }else{
      if(this.blinkOn){if(!--this.blinkOn){this.blinkOff=this.variant>=35?50:5;this.paletteOverride=0;}}
      else if(!--this.blinkOff){this.blinkOn=this.variant>=35?5:1;this.paletteOverride=7;}
      if(this.motion===0){this.motion=2;this.collisionWait=0;this.vy=0x380;this.gravity=0x48;}
      else if(this.motion===2||this.motion===4){
        if(!this.collisionWait||!--this.collisionWait){
          this.integrate();
          if(world.collision?.resolve(this)){this.collisionWait=5;this.vx=0;if(this.vy>=0)this.vy=0;}
          if((this.y>>>16)<=(this.groundY>>>16)){
            const rising=this.motion===2;this.motion+=2;integerY(this,this.groundY>>16);
            if(rising){this.vy=0x280;this.gravity=0x48;}else this.edge(world);
          }else this.edge(world);
        }
      }else if(this.motion===8){
        // Owner-linked special item is initialized by its parent effect.
        if(!this.owner)throw new Error('Special pickup requires its original owner');
        this.motion=10;this.groundY=(this.owner.groundY-65536)|0;
        integerY(this,(this.groundY>>16)+90);this.x=(this.x+14*65536)|0;
        this.travelDirection=this.owner.facing?15:17;
      }else if(this.motion===10){
        const[vx,vy]=this.data.pickupTravel[this.travelDirection];this.x=(this.x+vx*256)|0;this.y=(this.y+vy*256)|0;
        if((this.y>>>16)<(this.groundY>>>16)){integerY(this,this.groundY>>16);this.motion=6;}
      }else if(this.motion===12){
        if(!this.fallStep){
          this.fallStep=2;integerY(this,(world.cameraY??0)+272);this.vx=this.vy=0;this.gravity=0x38;
          world.spawnPickupShadow?.(this);
        }else{
          this.integrate();
          if((this.y>>>16)<(this.groundY>>>16)){
            this.y=this.groundY;
            if(this.fallStep===2){this.fallStep=4;this.vy=0x300;this.gravity=0x38;if(this.visible)this.onSound?.(24);}
            else{this.motion=6;this.fallStep=0;}
          }
        }
      }
      if(((world.frame+(world.actorPhase??0))&3)===0&&((((this.x>>16)-(world.cameraX??96)+128)&65535)>640||(((this.y>>16)-(world.cameraY??0)+128)&65535)>512))this.mode='removePending';
    }
    this.visible=this.screen(world);this.drawn=true;
  }
}
