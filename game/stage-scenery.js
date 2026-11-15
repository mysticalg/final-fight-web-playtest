// Background patch actors: activation, visibility, eight-frame polling and reset.
export class SceneryPatch {
  constructor(event,definitions){this.x=event.x;this.y=event.y;this.variant=event.variant;this.definition=definitions[this.variant];this.state=0;this.phase=0;}
  visible(world){
    const layer=this.definition.layer,camera=layer===3?world.parallax:world.camera;
    return ((this.x-camera.x+128)&65535)<=640&&((this.y-camera.y+128)&65535)<=512;
  }
  update(world,flags,paint){
    if(this.removed)return;
    const phase=(world.frame+world.actorPhase)&255;
    if(this.state===0){
      if(!this.phase){this.phase=2;flags[this.variant]=0;return;}
      if(!(phase&3)&&this.visible(world)){this.state=2;this.phase=0;return;}
      if(world.reset)flags[this.variant]=0;
      return;
    }
    if(this.state===2){
      if((phase&7)||!flags[this.variant])return;
      this.state=4;
      if(!this.visible(world)){this.state=0;return;}
      paint(this);
      return;
    }
    if(world.reset){this.state=0;return;}
    this.state=0;this.removed=true;
  }
}

export function patchTiles(patch,sample){
  const d=patch.definition,size=d.layer===3?32:16,x=patch.x&-size,y=(~patch.y)&-size,edits=[];
  for(let col=0;col<d.width;col++)for(let row=0;row<d.height;row++){
    const tx=x+col*size,ty=y+row*size,old=sample(d.layer,tx,ty),value=d.tiles[col*d.height+row];
    let code=old.code,attr=old.attr;
    if(value.code!==undefined)code=value.code;
    if(value.attr!==undefined)attr=d.kind==='priority'?(attr&0xfe7f)|value.attr:d.kind==='codeFlags'?(attr&0xff9f)|value.attr:value.attr;
    edits.push({layer:d.layer,x:tx,y:ty,code,attr});
  }
  return edits;
}
