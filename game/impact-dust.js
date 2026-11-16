import{Animation}from'./animation.js?v=4d9b688507';
// Original 05569A impact plume: authored offsets and six recovered poses.
export class ImpactDust{
 constructor(data,owner){this.data=data;this.x=owner.x+(owner.facing?-16:48)*65536;this.y=owner.y;this.groundY=owner.groundY;this.startX=this.x;this.startY=this.y;this.facing=owner.facing;this.variant=owner.burning?1:0;this.cursor=-1;this.animation=new Animation(data.animationEntries,data.dust.poses[this.variant][0]);this.visible=true;}
 update(){
  if(this.removed)return;if(this.ending){this.removed=true;return;}
  if(this.cursor<0){this.cursor=0;return;}
  const row=this.data.dust.motion[this.cursor++];
  if(!row){this.visible=false;this.removed=true;return;}
  this.x=this.startX+row[0]*65536*(this.facing?1:-1);this.y=this.startY+row[1]*65536;this.visible=row[2]>0;if(row[2]<0){this.ending=true;return;}
  if(row[2])this.animation.set(this.data.dust.poses[this.variant][row[2]]);
 }
}
