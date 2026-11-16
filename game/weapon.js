import{Knife}from'./knife.js?v=65c11d1bb4';
import{Animation}from'./animation.js?v=65c11d1bb4';
const word=n=>n<<16>>16;
const integer=(value,next)=>((next<<16)|(value&65535))|0;
export class Weapon extends Knife{
 constructor(data,{subtype=0,holder=null,x,y,direction=0,parameter=0}={}){
  super(data,holder??{x,y,groundY:y,facing:direction});
  this.subtype=subtype;this.character=data.weapons[subtype];this.combat=this.character.combat;this.owner=this.holder=holder;
  this.animation=new Animation(data.animationEntries,this.character.actions.idle);
  this.parameter=parameter;this.mode=holder?'held':'initialize';this.drawn=false;this.pickable=false;
  this.paletteOverride=holder?0:7;this.flashWait=5;this.flashPhase=0;
 }
 targets(world,player){return this.owner?.characterIndex!==undefined?(world.weaponTargets?.()??[]).filter(e=>!e.removed&&e.health>=0&&e.contactsReady!==false):super.targets(world,player);}
 damage(){return this.owner?.characterIndex!==undefined?30:super.damage();}
 projectileHit(world){if(this.owner?.characterIndex!==undefined){world.awardScore?.(17,this.owner.playerIndex??0);world.weaponHit?.();}}
 flash(){
  if(!--this.flashWait){this.flashPhase^=1;this.flashWait=this.flashPhase?50:5;this.paletteOverride=this.flashPhase?0:7;}
 }
 pickup(player){
  if(player.weapon&&player.weapon!==this){player.weapon.holder=null;player.weapon.mode='floorInit';}
  this.owner=this.holder=player;player.weapon=this;this.mode='held';this.pickable=false;this.dropped=false;this.paletteOverride=0;
 }
 updateHeld(world){
  const h=this.holder;if(!h){this.mode='tossInit';return;}
  this.x=h.x;this.y=h.y;this.groundY=h.groundY;this.facing=h.facing;
  const pose=this.data.images[h.animation.image].weaponPose??0;
  const rows=h.characterIndex!==undefined?this.character.attachments[h.characterIndex]:this.data.knife.attachments,row=rows[pose&127];
  this.drawn=!!row;
  if(row){this.x=(this.x+(h.facing?-row[0]:row[0])*65536)|0;this.y=(this.y+row[1]*65536)|0;this.animation.set(row[2]);}else this.y+=64*65536;
  if(this.forcedLaunch||pose&128){this.holder=null;this.mode='flightInit';this.drawn=true;}
  else if(this.dropped||h.removed){this.hitFrom??=h.hitFrom??0;this.holder=null;this.mode='tossInit';}
 }
 startToss(world){
  if(!this.subtype){
   this.facing=(this.hitFrom??0)^1;
   if((this.x>>16)<world.cameraX+114)this.facing=0;
   else if((this.x>>16)>world.cameraX+270)this.facing=1;
  }
  this.vx=this.subtype?0x180:0x300;this.drag=2;this.vy=this.subtype?0x380:0x480;this.gravity=this.subtype?0x58:0x48;
  if(this.facing){this.vx=-this.vx;this.drag=-this.drag;}
  this.mode='toss';this.pickable=false;this.action('drop');this.drawn=true;
 }
 update(world,player){
  if(this.removed)return;
  if(this.mode==='held'){this.updateHeld(world);return;}
  if(['flightInit','flight','spent'].includes(this.mode)){super.update(world,player);return;}
  if(this.mode==='initialize'){this.mode=this.parameter===1?'verticalInit':'floorInit';return;}
  if(this.mode==='floorInit'){this.mode='floor';this.pickable=true;this.y=this.groundY;this.action('idle');this.drawn=true;}
  else if(this.mode==='floor'){}
  else if(this.mode==='verticalInit'){
   this.mode='vertical';this.vx=0;this.vy=0x380;this.gravity=0x48;this.collisionWait=0;this.pickable=true;this.action('idle');this.drawn=true;
  }else if(this.mode==='vertical'||this.mode==='verticalBounce'){
   if(this.collisionWait&&--this.collisionWait){this.flash();return;}
   this.vy=word(this.vy-this.gravity);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;
   if(world.collision?.resolve(this)>0){this.collisionWait=5;this.vx=0;if(this.vy>=0)this.vy=0;}
   if((this.y>>16)<=(this.groundY>>16)){
    this.y=integer(this.y,this.groundY>>16);
    if(this.mode==='vertical'){this.mode='verticalBounce';this.vy=0x280;}else this.mode='floorInit';
   }else if((this.x>>16)<world.cameraX+30)this.vx=0x200;else if((this.x>>16)>world.cameraX+354)this.vx=-0x200;
  }else if(this.mode==='tossInit'||this.mode==='dropInit'){this.startToss(world);return;}
  else if(this.mode==='toss'||this.mode==='tossBounce'){
   this.vy=word(this.vy-this.gravity);this.vx=word(this.vx-this.drag);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;
   if(world.collision?.resolve(this)>0&&this.vy>=0)this.vy=0;
   if((this.y>>16)<(this.groundY>>16)+(this.subtype?10:0)){
    this.y=this.groundY;
    if(this.mode==='toss'){
     const mayExpire=this.subtype||this.owner?.characterIndex!==undefined;
     if(mayExpire&&this.character.expiry[world.random.next()&15]){this.mode='expireInit';this.pickable=false;return;}
     this.mode='tossBounce';this.pickable=true;this.vx=0x100;this.drag=2;this.vy=0x300;this.gravity=0x58;
     if(this.facing){this.vx=-this.vx;this.drag=-this.drag;}if(this.subtype)this.y+=10*65536;
    }else{this.mode='floorInit';return;}
   }
   this.animation.tick();return;
  }else if(this.mode==='expireInit'){this.mode='expire';this.paletteOverride=0;this.wait=60;this.action('idle');return;}
  else if(this.mode==='expire'){if(!--this.wait)this.mode='spent';return;}
  this.flash();
 }
}
export function collectWeapon(player,weapons){
 if(player.floorOffset)return null;
 const weapon=[...weapons].sort((a,b)=>(a.slot??0)-(b.slot??0)).find(w=>!w.removed&&!w.holder&&w.pickable&&Math.abs(word((player.x>>16)-(w.x>>16)))<=22&&Math.abs(word((player.groundY>>16)-(w.groundY>>16)))<=11);
 if(weapon)weapon.pickup(player);return weapon??null;
}
