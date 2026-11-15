// Invisible five-column collision strips from 062966 / 01FA16.
export class StageBoundary{
  constructor({x,y,variant=0}){this.x=x;this.y=y;this.variant=variant;this.state=0;}
  update(camera,paint){
    if(this.removed)return;
    if(this.state===4){this.removed=true;this.state=0;return;}
    if(this.state===0){this.state=2;return;}
    if(this.state!==2)return;
    if(this.variant&&((camera.maxX-32)&65535)>=(camera.x&65535))return;
    const row=(~this.y>>4)&63,col=(this.x>>4)&63,start=(row&15)+(col<<4)+((row&48)<<6);
    paint({x:this.x&-16,y:this.y&-256,width:80,height:256,kind:this.variant?3:5,indices:Array.from({length:80},(_,i)=>start+i)});
    this.state=4;
  }
}
