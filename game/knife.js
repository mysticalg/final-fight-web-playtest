import{Animation}from'./animation.js?v=4d9b688507';
import{resolveBoxes,boxesOverlap}from'./combat.js?v=4d9b688507';
const word=n=>n<<16>>16;
export class Knife{
 constructor(data,holder){
  this.data=data;this.character=data.knife;this.combat=this.character.combat;this.holder=this.owner=holder;
  this.x=holder.x;this.y=holder.y;this.groundY=holder.groundY;this.facing=holder.facing;this.mode='held';this.drawn=false;
  this.animation=new Animation(data.animationEntries,this.character.actions.idle);
 }
 action(name){this.animation.set(this.character.actions[name]);}
 targets(world,player){return player?[player]:[];}
 damage(){return this.character.damage[this.owner.character.sourceCharacterId][this.owner.level??0];}
 projectileHit(){}
 update(world,player){
  if(this.removed)return;
  if(this.mode==='spent'){this.removed=true;this.drawn=false;return;}
  if(this.mode==='held'){
   const h=this.holder;
   if(!h||h.removed||this.dropped){this.holder=null;this.mode='dropInit';return;}
   this.x=h.x;this.y=h.y;this.groundY=h.groundY;this.facing=h.facing;
   const pose=this.data.images[h.animation.image].weaponPose??0,row=this.character.attachments[pose&127];this.drawn=!!row;
   if(row){this.x=(this.x+(h.facing?-row[0]:row[0])*65536)|0;this.y=(this.y+row[1]*65536)|0;this.animation.set(row[2]);}else this.y+=64*65536;
   if(pose&128){this.holder=null;this.mode='flightInit';this.drawn=true;}
   return;
  }
  if(this.mode==='flightInit'){this.vx=this.character.projectileSpeed[this.owner.character.sourceCharacterId]*(this.facing?-1:1);this.action('flight');this.mode='flight';this.lastAttack=resolveBoxes(this,this.data.images[this.animation.image]).attack;return;}
  if(this.mode==='flight'){
   this.x=(this.x+this.vx*256)|0;
   const blocked=world.collision?.resolve(this)??0;
   if(blocked===4){this.mode='spent';return;}
   if(blocked>0){this.facing^=1;this.mode='dropInit';this.onSound?.(15);return;}
   if(world.frame&1)for(const target of this.targets(world,player))if(target.mode!=='dead'&&Math.abs(word((this.groundY>>16)-(target.groundY>>16)))<=9&&boxesOverlap(this.lastAttack,resolveBoxes(target,this.data.images[target.animation.image]).hurt)){
    target.hit(this.damage(),3,this.facing,{unblockable:true,guardContact:true});target.hitAttacker=this;this.projectileHit(world,target);this.onSound?.(16);this.mode='spent';return;
   }
   this.animation.tick();
   this.lastAttack=resolveBoxes(this,this.data.images[this.animation.image]).attack;
   if((world.frame&15)===0&&((this.x>>16)<world.cameraX-128||(this.x>>16)>world.cameraX+512))this.mode='spent';
   return;
  }
  if(this.mode==='dropInit'){this.vx=0;this.vy=0x380;this.mode='drop';this.action('idle');this.drawn=true;return;}
  if(this.mode==='drop'||this.mode==='bounce'){
   this.vy=word(this.vy-0x48);this.y=(this.y+this.vy*256)|0;this.x=(this.x+(this.vx??0)*256)|0;
   if((this.y>>16)<=(this.groundY>>16)){
    this.y=this.groundY;if(this.mode==='drop'){this.mode='bounce';this.vy=0x280;}else{this.mode='floor';this.wait=60;}
   }
  }else if(this.mode==='floor'&&!--this.wait)this.mode='spent';
 }
}
