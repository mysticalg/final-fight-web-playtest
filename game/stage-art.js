// Draw only visible 256px chunks; atlas size depends on unique scenery blocks,
// rather than the full world dimensions (including tall Industrial/Bay maps).
export function stageDrawCommands(art,projection,width=384,height=224){
  const commands=[];
  for(const number of art.order){
    const layer=art.layers.find(l=>l.layer===number),p=projection[number];
    for(let row=Math.floor(p.y/256);row<=Math.floor((p.y+height-1)/256);row++){
      for(let col=Math.floor(p.x/256);col<=Math.floor((p.x+width-1)/256);col++){
        const block=layer.chunks[(row&(layer.rows-1))*layer.columns+(col&(layer.columns-1))],sprite=art.images[`${number}:${block}`];
        commands.push({sx:sprite.x,sy:sprite.y,x:col*256-p.x,y:row*256-p.y});
      }
    }
  }
  return commands;
}
export function drawStageArt(context,image,art,projection){
  context.fillStyle='#000';context.fillRect(0,0,384,224);context.imageSmoothingEnabled=false;
  for(const c of stageDrawCommands(art,projection))context.drawImage(image,c.sx,c.sy,256,256,c.x,c.y,256,256);
}
