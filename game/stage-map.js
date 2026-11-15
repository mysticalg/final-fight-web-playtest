// Native rectangular chunk maps from 062D50–062EB8. Coordinates are CPS tile
// plane pixels; collision callers use planeY=~worldGroundY.
export class StageMap{
  constructor(layer,blocks){this.layer=layer;this.blocks=blocks;}
  sample(x,planeY){
    const l=this.layer;
    const chunk=l.chunks[((planeY>>8)&(l.rows-1))*l.columns+((x>>8)&(l.columns-1))];
    const block=this.blocks[`${l.layer}:${chunk}`],side=256/l.size;
    const index=Math.floor((planeY&255)/l.size)*side+Math.floor((x&255)/l.size);
    return{code:block.codes[index],attr:block.attributes[index]};
  }
  collision(x,groundY){return(this.sample(x,~groundY).attr>>>10)&63;}
}
