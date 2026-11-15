const word=value=>value<<16>>16;
// Rectangular dynamic surfaces from 0084E4, used by 008580 and 008880.
const shapes={1:[28,4,4,60],3:[32,8,8,74],4:[40,8,8,80],5:[20,5,5,40],6:[28,8,8,56],7:[22,4,4,48],8:[40,8,8,104]};
export function obstacleResponse(obstacle,x,y,{raised=false}={}){
  const shape=shapes[obstacle.subtype];if(!shape)return null;
  const[rx,ry,offset,height]=shape,variant=obstacle.variant??0;
  let dx=word((obstacle.x>>16)-x+rx),dy;
  if(raised){
    if((dx&65535)<=rx*2)dx=0;
    else if(dx<0){if(!(variant&4))return null;}
    else{if(!(variant&8))return null;dx=word(dx-rx*2);}
    dy=word((obstacle.y>>16)+height-offset-y+ry);
    if((dy&65535)<=ry*2)dy=0;
    else if(dy<0){if(!(variant&1))return null;}
    else{if(!(variant&2))return null;dy=word(dy-ry*2);}
    return{kind:dx||dy?32:20,response:dx||dy?3:0,dx,dy,height,object:obstacle};
  }
  if((dx&65535)>rx*2)return null;
  dy=word((obstacle.y>>16)-offset-y+ry);
  if((dy&65535)>ry*2)return null;
  dy=(variant&2)||(!(variant&1)&&dy<ry)?dy+1:dy-ry*2-1;
  dx=(variant&8)||(!(variant&4)&&dx<rx)?dx+1:dx-rx*2-1;
  const useY=dy<0?Math.abs(dx)>=-dy:Math.abs(dx)>dy;
  return{kind:25,response:3,dx:useY?0:dx,dy:useY?dy:0,height,object:obstacle};
}
