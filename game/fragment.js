import{Animation}from'./animation.js?v=65c11d1bb4';
const word=n=>n<<16>>16;
// Original 056388: authored material, scatter, drag, gravity and flash timelines.
export class Fragment{
 constructor(data,{x,y,groundY,variant,index,phase,direction=0}){Object.assign(this,{data,x,y,groundY,variant,index,phase,direction});this.state=0;this.step=0;this.facing=0;this.visible=false;this.animation={address:0,image:0,remaining:0};}
 update(world){
  if(this.removed)return;
  if(this.state===6){this.removed=true;this.visible=false;return;}
  if(this.state===4){this.state=6;this.step=0;return;}
  if(!this.state&&this.step){
   this.state=2;
   let offset;
   if(this.variant<4){const i=(world.random.next()&28)>>2;offset=this.data.particles.offsets[0][i+((this.vx??0)<0?8:0)];}
   else offset=this.data.particles.offsets[this.variant===4?1:this.variant===5?2:this.variant===6?3:4][this.index];
   this.x=((this.x&-65536)+offset[0]*65536)|0;this.y=((this.y&-65536)+offset[1]*65536)|0;
   const material=this.data.particles.materials[this.variant][(this.variant===7?0:this.phase*8)+this.index];this.animation=new Animation(this.data.animationEntries,this.data.particles.actions[material]);return;
  }
  if(!this.state){
   if(((world.frame+(world.actorPhase??0))&1)===0){this.step=2;const[vx,vy,drag,gravity,timer,facing]=this.data.particles.motion[this.variant][this.index];this.vx=vx;this.vy=vy;this.drag=drag;this.gravity=gravity;this.timer=timer;this.facing=facing;if(this.direction){this.vx=-this.vx;this.drag=-this.drag;}}
   if(this.variant===4)this.facing=0;return;
  }
  if(--this.timer<0){this.state=4;return;}
  const screen=()=>(((this.x>>16)-(world.cameraX??0)+48)&65535)<=480&&(((this.y>>16)-(world.cameraY??0)+128)&65535)<=384;
  if(this.timer>=16&&!screen()){this.state=4;this.visible=false;return;}
  this.vy=word(this.vy-this.gravity);this.vx=word(this.vx-this.drag);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;
  if(this.facing)this.animation.backward();else this.animation.tick();
  this.visible=this.timer<16?!![1,0,0,1,0,0,1,0,1,0,1,1,1,1,1,1][this.timer]:screen();
 }
}
export function fragmentBurst(data,owner,phase,world,allocate){
 if(!data.particles)return;
 const[count,dy,variant]=data.particles.bursts[owner.subtype];
 if(phase===null||phase===undefined)phase=world.random.next()&3;
 for(let index=count-1;index>=0;index--)allocate(new Fragment(data,{x:owner.x&-65536,y:((owner.y>>16)+dy)*65536,groundY:owner.groundY&-65536,variant,index,phase,direction:owner.hitFrom??0}));
}

