const word=value=>value<<16>>16;
// Response precedence for the two sides of a grounded actor (007CFE).
const widePriority=[0,1,1,0,1,0,0,0,0,0,1,1,1,1,0,0,0,0,0,1,1,1,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0];
// Original 16px tile responses (007FA8–0082A8). Curves are recovered data,
// not executable instructions. X/Y arguments are signed integer world words.
export function tileResponse(kind,x,y,curves){
  let dx=0,dy=0,response=0;const lx=x&15,ly=y&15;
  if(kind===2){dy=-ly-1;response=1;}
  else if(kind===3||kind===6){dx=-lx-1;response=1;}
  else if(kind===4){dy=16-ly;response=1;}
  else if(kind===5||kind===9){dx=16-lx;response=1;}
  else if(kind===25){dx=-lx-1;response=2;}
  else if(kind===28){dx=16-lx;response=2;}
  else if(kind===32){dy=-ly-1;response=2;}
  else if(curves[kind]){
    const{values,positive,high}=curves[kind],height=values[ly];
    if(height>=0){
      const push=positive?16-height-lx:height-lx-1;
      if(positive?push>0:push<0){dx=push;response=high?2:1;}
    }
  }else if(kind>38)throw new Error(`Unrecovered collision tile ${kind}`);
  return{kind,dx,dy,response};
}

export function gridIndex(x,y){const row=(~y>>4)&63,col=(x>>4)&63;return(row&15)+(col<<4)+((row&48)<<6);}
export class CollisionGrid{
  constructor(data,cameraX=0){this.data=data;this.cameraX=cameraX;}
  lookup(x,y){return this.data.tiles[gridIndex(x,y)];}
  probe(x,y){
    x=word(x);y=word(y);
    // 008436: retain the original word arithmetic and 16px correction.
    const relative=(x-this.cameraX+96)&65535;
    if(relative>=576){
      const left=word(relative)<0;
      return{kind:left?5:3,dx:left?((-word(relative))&15)+1:-((relative-576)&15)-1,dy:0,response:4};
    }
    return tileResponse(this.lookup(x,y),x,y,this.data.curves);
  }
  resolve(actor,offset=0){
    const first=this.probe(word((actor.x>>16)+offset),actor.groundY>>16);
    actor.collisionType=first.response;actor.collisionTile=first.kind;
    if(!first.response)return first.response;
    const oldX=actor.x>>16;actor.x=(actor.x+first.dx*65536)|0;
    let crossed=((oldX^(actor.x>>16))&16)!==0;
    if(!crossed){
      const oldY=actor.groundY>>16;
      actor.y=(actor.y+first.dy*65536)|0;actor.groundY=(actor.groundY+first.dy*65536)|0;
      crossed=((oldY^(actor.groundY>>16))&16)!==0;
    }
    if(crossed){
      const next=this.probe(word((actor.x>>16)+offset),actor.groundY>>16);
      if(next.response){
        actor.collisionType=next.response;actor.collisionTile=next.kind;
        actor.x=(actor.x+next.dx*65536)|0;actor.y=(actor.y+next.dy*65536)|0;actor.groundY=(actor.groundY+next.dy*65536)|0;
      }
    }
    return actor.collisionType;
  }
  resolveWide(actor,width=16){
    const offset=actor.facing?-width:width;
    this.resolve(actor,offset);
    const firstType=actor.collisionType,firstTile=actor.collisionTile;
    this.resolve(actor,-offset);
    if(widePriority[((actor.collisionType+1)<<3)+(firstType+1)]){
      actor.collisionType=firstType;actor.collisionTile=firstTile;
    }
    return actor.collisionType;
  }
}
