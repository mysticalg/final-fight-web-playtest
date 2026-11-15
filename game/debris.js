import{Animation}from'./animation.js?v=0854a9c44d';
// Small animated fragments and impact particles from the original 0554EE actor.
export class Debris {
 constructor(data,{x,y,groundY,variant=2}){
  this.data=data;this.x=x;this.y=y;this.groundY=groundY;this.variant=variant;this.facing=0;this.state=0;this.visible=false;
  this.animation=new Animation(data.animationEntries,data.debris.actions[variant]);
 }
 update(world){
  if(this.removed)return;
  if(this.state===4){this.removed=true;this.visible=false;return;}
  if(this.state===0){const[dx,dy]=this.data.debris.offsets[(world.random.next()&12)>>2];this.x=(this.x+dx*65536)|0;this.y=(this.y+dy*65536)|0;this.visible=true;this.state=2;return;}
  this.animation.tick();const flags=this.animation.flags;
  if(flags&128){this.state=4;this.visible=false;}else this.visible=!!flags;
 }
}
