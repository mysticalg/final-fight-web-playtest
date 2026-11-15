import{obstacleResponse}from'./obstacle-collision.js?v=3eb60d19d2';
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
// 0082BC–008432: collision while standing on a static raised surface.
export function raisedTileResponse(kind,x,y){
  let dx=0,dy=0,response=-1;const lx=x&15,ly=y&15;
  if(kind===3){dx=-lx-1;response=1;}
  else if(kind===5){dx=16-lx;response=1;}
  else if(kind===20)response=0;
  else if(kind===21||kind===22)response=1;
  else if(kind===23||kind===24){
    const height=kind===23?(ly<8?-1:30-2*ly):(ly<8?14-2*ly:0);
    if(height>=0){const push=16-height-lx;if(push>0){dx=push;response=0;}}
  }else if(kind===31){if(ly){dy=16-ly;response=1;}else response=0;}
  else if(kind===32){dy=-ly-1;response=1;}
  else if(kind>38)throw new Error(`Unrecovered raised collision tile ${kind}`);
  return{kind,dx,dy,response};
}
export class CollisionGrid{
  constructor(data,cameraX=0,{obstacles=[]}={}){this.data=data;this.cameraX=cameraX;this.obstacles=obstacles;}
  lookup(x,y){return this.data.tiles[gridIndex(x,y)];}
  objectProbe(x,y,actor){
    for(const object of this.obstacles){
      if(!object.solid)continue;
      const result=obstacleResponse(object,x,y);
      if(result){if(actor)actor.collisionObject=object;return result;}
    }
    if(actor)actor.collisionObject=null;
    return tileResponse(this.lookup(x,y),x,y,this.data.curves);
  }
  raisedProbe(x,y,actor){
    if(actor.collisionObject){
      for(const object of new Set([actor.collisionObject,...this.obstacles])){
        if(!object.solid)continue;
        const result=obstacleResponse(object,x,y,{raised:true});
        if(result){if(result.kind===20)actor.floorOffset=result.height;return result;}
      }
      return{kind:255,response:-1,dx:0,dy:0};
    }
    return raisedTileResponse(this.lookup(x,y),x,y);
  }
  probe(x,y,actor){
    x=word(x);y=word(y);
    // 008436: retain the original word arithmetic and 16px correction.
    const relative=(x-this.cameraX+96)&65535;
    if(relative>=576){
      const left=word(relative)<0;
      return{kind:left?5:3,dx:left?((-word(relative))&15)+1:-((relative-576)&15)-1,dy:0,response:4};
    }
    return this.objectProbe(x,y,actor);
  }
  resolve(actor,offset=0){
    const response=this.resolveWith(actor,offset,(x,y)=>actor.floorOffset?this.raisedProbe(x,y,actor):this.probe(x,y,actor));
    if(response<0&&!offset){actor.groundY=(actor.groundY-(actor.floorOffset??0)*65536)|0;actor.floorOffset=0;}
    return response;
  }
  resolveWith(actor,offset,probe,secondProbe=probe){
    const first=probe(word((actor.x>>16)+offset),actor.groundY>>16);
    actor.collisionType=first.response;actor.collisionTile=first.kind;
    if(first.response<=0)return first.response;
    if(first.response===3){actor.x=(actor.x+first.dx*65536)|0;actor.y=(actor.y+first.dy*65536)|0;actor.groundY=(actor.groundY+first.dy*65536)|0;return first.response;}
    const oldX=actor.x>>16;actor.x=(actor.x+first.dx*65536)|0;
    let crossed=((oldX^(actor.x>>16))&16)!==0;
    if(!crossed){
      const oldY=actor.groundY>>16;
      actor.y=(actor.y+first.dy*65536)|0;actor.groundY=(actor.groundY+first.dy*65536)|0;
      crossed=((oldY^(actor.groundY>>16))&16)!==0;
    }
    if(crossed){
      const next=secondProbe(word((actor.x>>16)+offset),actor.groundY>>16);
      if(next.response!==0){
        actor.collisionType=next.response;actor.collisionTile=next.kind;
        actor.x=(actor.x+next.dx*65536)|0;actor.y=(actor.y+next.dy*65536)|0;actor.groundY=(actor.groundY+next.dy*65536)|0;
      }
    }
    return actor.collisionType;
  }
  resolveWide(actor,width=16){
    const offset=actor.facing?-width:width;
    this.resolve(actor,offset);
    const firstType=actor.collisionType,firstTile=actor.collisionTile,firstObject=actor.collisionObject;
    this.resolve(actor,-offset);
    if(widePriority[((actor.collisionType+1)<<3)+(firstType+1)]){
      actor.collisionType=firstType;actor.collisionTile=firstTile;actor.collisionObject=firstObject;
    }
    if(actor.collisionType<0){actor.groundY=(actor.groundY-(actor.floorOffset??0)*65536)|0;actor.floorOffset=0;}
    return actor.collisionType;
  }
  resolveCenterAir(actor,height=64){return this.resolveAir(actor,0,height,{center:true});}
  resolveAir(actor,width=16,height=64,{center=false}={}){
    const offset=actor.vx<0?-width:width,raised=!!actor.floorOffset;
    const probe=(x,y)=>{
      const elevated=!!actor.floorOffset;
      const result=elevated?this.raisedProbe(x,y,actor):this.objectProbe(x,y,actor);
      if(result.response>=2){
        const surfaceHeight=elevated?height:result.height??height;
        if(((y+surfaceHeight)&65535)<=((actor.y>>16)&65535)){
          actor.floorOffset=surfaceHeight;actor.groundY=(actor.groundY+surfaceHeight*65536)|0;result.response=0;
        }else result.response=1;
      }
      return result;
    };
    // 007F02 calls the raised-object helper for its support side effects,
    // then unconditionally uses the static raised response for correction.
    const secondProbe=(x,y)=>{
      if(!actor.floorOffset)return probe(x,y);
      this.raisedProbe(x,y,actor);
      return raisedTileResponse(this.lookup(x,y),x,y);
    };
    const first=this.resolveWith(actor,offset,probe,secondProbe);
    if(center){if(first<0){actor.groundY=(actor.groundY-(actor.floorOffset??0)*65536)|0;actor.floorOffset=0;}return actor.collisionType;}
    if(raised&&first<=0){const second=this.resolveWith(actor,-offset,probe,secondProbe);if((first&second)<0){actor.groundY=(actor.groundY-(actor.floorOffset??0)*65536)|0;actor.floorOffset=0;}}
    else if(!raised&&first<0){actor.groundY=(actor.groundY-(actor.floorOffset??0)*65536)|0;actor.floorOffset=0;}
    return actor.collisionType;
  }
}
