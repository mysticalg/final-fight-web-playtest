const word=value=>value<<16>>16;
// 003BEC: shared original 16-bit generator, not Math.random().
export class GameRandom {
  constructor(seed=0) { this.seed=seed&65535; }
  next() {
    const prior=this.seed||0x2472;
    this.seed=(prior>>>1)|((((prior>>>1)^(prior>>>9))&1)<<15);
    return this.seed&255;
  }
}

// 027CEC: arrival uses different inclusive ranges from movement's dead zones.
export function reachedPosition(actor,target,slots) {
  const [dx,dy]=slots[actor.positionSlot];
  return ((word((target.x>>16)+dx-(actor.x>>16))+8)&65535)<=16
    && ((word((target.groundY>>16)-(target.floorOffset??0)+dy-(actor.y>>16))+4)&65535)<=16;
}

export function accelerateApproach(actor) {
  // 027DC8: initial quarter speed, then quantized acceleration toward the cap.
  if(!actor.speedX) {
    actor.speedX=actor.desiredSpeedX>>>2;
    actor.speedY=actor.desiredSpeedY>>>2;
    return;
  }
  for(const [speed,desired,increment] of [['speedX','desiredSpeedX',0xc00],['speedY','desiredSpeedY',0x600]]) {
    const cap=(actor[desired]&0xfffff000)>>>0,current=(actor[speed]&0xfffff000)>>>0;
    if(cap!==current)actor[speed]=(actor[speed]+(cap>current?increment:-increment))|0;
  }
}

// 027D32: full 16.16 displacement, including direction/facing animation choice.
export function advanceApproach(actor,target,slots) {
  accelerateApproach(actor);
  const [dx,dy]=slots[actor.positionSlot];
  let movedX=false,movedY=false;
  let delta=word((target.x>>16)+dx-(actor.x>>16)+8);
  if((delta&65535)>=16) {
    movedX=true;actor.direction=delta<0?1:0;
    actor.x=(actor.x+(delta<0?-actor.speedX:actor.speedX))|0;
  }
  delta=word((target.groundY>>16)-(target.floorOffset??0)+dy-(actor.y>>16)+4);
  if((delta&65535)>=8) {
    movedY=true;actor.y=(actor.y+(delta<0?-actor.speedY:actor.speedY))|0;
    actor.groundY=actor.y;
  }
  actor.movedX=movedX;
  if(movedX||movedY) {
    if(actor.facing===actor.direction)actor.animation.tick();
    else actor.animation.backward();
  }
  return movedX||movedY;
}

// 027C72: periodic facing update leaves a strict twenty-pixel inner region.
export function faceTarget(actor,target,immediate=false) {
  const delta=word((target.x>>16)-(actor.x>>16)+(immediate?0:10));
  if(immediate||(delta&65535)>=20)actor.facing=delta<0?1:0;
}
