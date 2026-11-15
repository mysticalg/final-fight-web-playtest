// Original four-stage street door tile replacement followed by its enemy-spawn actor.
export class StreetEntrance {
 constructor(event,frames){Object.assign(this,event);this.frames=frames;this.state=0;this.phase=0;this.frameIndex=0;this.complete=false;}
 update(world,paint,spawn){
  if(this.removed)return;
  if(this.state===0){this.state=2;return;}
  if(this.state===4){this.removed=true;return;}
  if(!this.phase){this.phase=2;this.timer=7;this.count=5;return;}
  if(--this.timer)return;
  this.timer=7;
  if(!--this.count){this.state=4;this.complete=true;spawn(this.variant);return;}
  if(((this.x-world.cameraX+128)&65535)<=640&&((this.y-world.cameraY+128)&65535)<=512)paint({x:this.x,y:this.y,definition:this.frames[this.frameIndex]});
  this.frameIndex++;
 }
}
export class EntranceSpawn {
 constructor(variant){this.variant=variant;this.state=0;}
 update(spawn){
  if(this.state){this.removed=true;return;}
  this.state=2;spawn(this.variant);
 }
}
