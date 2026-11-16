import{CollisionGrid}from'./collision.js?v=65c11d1bb4';
import{StageMap}from'./stage-map.js?v=65c11d1bb4';

// The video ring map is a cache of these complete stage attributes. Native
// gameplay reads the complete map directly as the camera scrolls.
export class StageCollision extends CollisionGrid{
  constructor(data,layout,blocks,cameraX=0,options={}){
    super(data,cameraX,options);this.map=new StageMap(layout.layers.find(layer=>layer.layer===2),blocks);this.edits=[];
    if(options.stageRules!==false){this.elevator=options.section===1?layout.elevatorCollision:null;this.yOffset=options.bonus?(layout.bonusCollisionYOffset??0):0;}
  }
  paint(edit){this.edits.push(edit);}
  lookup(x,y){
    if(this.elevator){x&=65535;y&=65535;if(y>256)return 2;if(x<3328)return 5;if(x>=3712)return 3;return this.elevator[(x&256)+((x&240)>>4)+(~y&240)];}
    y=(y+(this.yOffset??0))<<16>>16;
    for(let i=this.edits.length-1;i>=0;i--){const e=this.edits[i];if(x>=e.x&&x<e.x+e.width&&y>=e.y&&y<e.y+e.height)return e.kind;}
    return this.map.collision(x,y);
  }
}
