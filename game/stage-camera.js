const word=value=>value<<16>>16;
const integer=value=>value>>16;
const setInteger=(value,next)=>((next<<16)|(value&65535))|0;
const unsigned=value=>value&65535;

// Native single-player camera rules, 061F2C–0624B4. Positions retain the
// original 16.16 words; follow distances and bounds use integer word arithmetic.
export function advanceCamera(camera,player,{verticalSpeed=0}={}){
  camera.deltaX=camera.deltaY=0;
  const oldX=integer(camera.x),mode=camera.modeX;
  let step=null;
  if((mode===0||mode===6||mode===2)&&player?.active!==false&&player){
    const px=integer(player.x);
    if(mode===2||px>=0){
      const relative=unsigned(px-oldX);
      if(relative>=208)step=Math.min(unsigned(relative-208),4);
      else if(mode===2&&relative<176)step=Math.max(word(relative-176),-4);
    }
  }else if(mode===4){
    const velocity=word(camera.speedX??0)*256;
    camera.x=(camera.x+velocity)|0;
    step=velocity>>16;
    camera.directionX=velocity<0?12:4;
    const boundary=velocity<0?camera.minX:camera.maxX;
    if(velocity<0?integer(camera.x)<=boundary:integer(camera.x)>=boundary){camera.x=setInteger(camera.x,boundary);step=word(boundary-oldX);}
    camera.deltaX=step;
  }
  if(step!==null&&mode!==4){
    const next=word(oldX+step),left=step<0;
    const bounded=left?Math.max(next,camera.minX):Math.min(next,camera.maxX);
    camera.x=setInteger(camera.x,bounded);camera.deltaX=word(bounded-oldX);camera.directionX=left?12:4;
  }
  if(camera.modeY===2||camera.modeY===4){
    const field=camera.modeY===2?'offsetY':'y',old=integer(camera[field]??0);
    const velocity=camera.modeY===2?verticalSpeed|0:word(camera.speedY??0)*256;
    const next=integer(((camera[field]??0)+velocity)|0),negative=velocity<0;
    const bounded=negative?Math.max(next,camera.minY):Math.min(next,camera.maxY);
    camera[field]=setInteger(camera[field]??0,bounded);
    camera.deltaY=bounded===next?(velocity>>16):word(bounded-old);
    // Equality also takes the source clamp branch, changing the delta to the
    // actual integer displacement even for fractional velocities.
    if(bounded===(negative?camera.minY:camera.maxY))camera.deltaY=word(bounded-old);
    camera.directionY=negative?8:0;
  }
  return camera;
}

function scaleDelta(delta,rate){
  rate=word(rate);
  if(rate===-32768)return null;
  const value=word(delta)<<16,count=Math.abs(rate)&63;
  if(rate<0)return count>=32?0:value<<count;
  return count>=32?(value<0?-1:0):value>>count;
}
export function advanceParallax(camera,foreground){
  for(const[axis,modeField,rateField,deltaField,directionField]of[
    ['x','modeX','rateX','deltaX','directionX'],['y','modeY','rateY','deltaY','directionY']]){
    const mode=camera[modeField],rate=word(camera[rateField]??0);
    if(mode===0||mode===6||(mode===4&&axis==='x')){const delta=scaleDelta(foreground[deltaField]??0,rate);if(delta===null)continue;camera[axis]=(camera[axis]+delta)|0;camera[directionField]=foreground[directionField]??0;}
    else if(mode===2){camera[axis]=(camera[axis]+rate*256)|0;camera[directionField]=rate<0?(axis==='x'?12:8):(axis==='x'?4:0);}
  }
  return camera;
}
