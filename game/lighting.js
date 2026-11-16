// Original 01A1CA bar-room flicker program. Each phase changes authored palette rows.
export class RoomLighting{
 constructor(data){this.rules=data.lighting;this.state=0;this.phase=0;}
 update(){
  if(!this.state){this.state=2;this.timer=20;this.program=2;this.colour=0;this.direction=0;this.phase=0;return;}
  if(!--this.timer){[this.timer,this.colour]=this.rules.program[this.program++];if(this.program===18)this.program=0;}
  this.phase=this.rules.phases[(this.direction+this.colour)>>1]>>1;this.direction^=2;
 }
}
