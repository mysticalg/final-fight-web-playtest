import{Animation}from'./animation.js?v=4d9b688507';
// Original opening actors (01F51E and 01E7AC), separate from combat enemies.
export class OpeningCast{
 constructor(data,event){
  this.data=data;this.variant=event.variant;this.jessica=event.subtype===23;this.x=event.x;this.y=this.groundY=event.y;this.facing=1;this.state=-2;this.visible=!this.jessica;this.grabbable=false;
  this.animation=new Animation(data.animationEntries,data.opening.actions[this.jessica?'jessica':'idle'][this.jessica?0:this.variant]);
 }
 action(name){this.animation.set(this.data.opening.actions[name][this.variant]);}
 update(world,leader){
  if(this.removed)return;
  if(this.state===10){this.state=12;return;}if(this.state===12){this.removed=true;this.visible=false;return;}
  if(this.jessica){
   if(this.removeNext){this.removed=true;this.visible=false;return;}
   if(leader?.state>=10){this.removeNext=true;if(this.started)this.animation.tick();return;}
   if(!leader||leader.removed){this.removed=true;this.visible=false;return;}
   this.facing=leader.facing^1;this.x=leader.x&-65536;this.y=leader.y&-65536;this.groundY=((leader.groundY>>16)-1)*65536;
   const pose=this.data.images[leader.animation.image].weaponPose??0;
   if(pose){const[dx,dy]=this.data.opening.attachments[pose];this.x+=dx*65536*(this.facing?1:-1);this.y+=dy*65536;}
   this.visible=!!pose&&(((this.x>>16)-(world.cameraX??96)+48)&65535)<=480;
   if(this.started)this.animation.tick();else if(this.startX!==undefined&&this.startX!==(leader.x>>16))this.started=true;
   this.startX??=leader.x>>16;return;
  }
  if(this.state===-2){this.state=0;return;}
  if(!this.state){this.state=2;this.timer=[130,64,332][this.variant];return;}
  if(this.state===2){
   if(!--this.timer){
    this.state=4;
    if(!this.variant){this.timer=120;this.action('laugh');world.playSound?.(40);}
    else if(this.variant===1)this.action('gesture');
    else this.walkStart(128);
   }return;
  }
  if(this.state===4){
   this.animation.tick();
   if(!this.variant){if(!--this.timer){this.timer=40;this.state=6;this.action('laugh');world.playSound?.(40);}}
   else if(this.animation.flags&128){this.state=6;this.timer=284;this.action('idle');}
   return;
  }
  if(this.state===6){
   if(!--this.timer)this.walkStart(this.variant?128:160);
   else if(!this.variant)this.animation.tick();return;
  }
  const[vx,vy]=this.data.opening.velocity[this.variant];this.x=(this.x+vx*256)|0;this.y=(this.y+vy*256)|0;
  if(this.variant)this.animation.tick();else this.animation.backward();
  if((this.x>>16)>=this.target)this.state=10;
 }
 walkStart(distance){this.state=8;this.target=(this.x>>16)+distance;this.facing=this.variant?0:1;this.action('walk');}
}
