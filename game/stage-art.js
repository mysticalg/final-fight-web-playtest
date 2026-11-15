// Draw only visible 256px chunks; atlas size depends on unique scenery blocks,
// rather than the full world dimensions (including tall Industrial/Bay maps).
export function stageDrawCommands(art,projection,width=384,height=224,edits,foreground=false){
  const commands=[];
  for(const number of art.order){
    if(foreground&&number!==art.foregroundLayer)continue;
    const layer=art.layers.find(l=>l.layer===number),p=projection[number];
    for(let row=Math.floor(p.y/256);row<=Math.floor((p.y+height-1)/256);row++){
      for(let col=Math.floor(p.x/256);col<=Math.floor((p.x+width-1)/256);col++){
        const block=layer.chunks[(row&(layer.rows-1))*layer.columns+(col&(layer.columns-1))],sprite=(foreground?art.foregroundImages:art.images)?.[`${number}:${block}`];
        if(!sprite)continue;
        const changed=edits&&[...edits.values()].some(e=>e.layer===number&&(e.x>>8)===col&&(e.y>>8)===row);
        if(!changed){commands.push({sx:sprite.x,sy:sprite.y,x:col*256-p.x,y:row*256-p.y});continue;}
        const size=layer.size;
        for(let y=0;y<256;y+=size)for(let x=0;x<256;x+=size){
          const wx=col*256+x,wy=row*256+y,e=edits.get(`${number}:${wx}:${wy}`),tile=e&&art.tileImages[`${number}:${e.code}:${e.attr}`];
          if(e&&!tile)throw Error('Scenery patch tile is unavailable');
          commands.push({sx:tile?(foreground?tile.foregroundX:tile.x):sprite.x+x,sy:tile?tile.y:sprite.y+y,x:wx-p.x,y:wy-p.y,size});
        }
      }
    }
  }
  return commands;
}
export function drawStageArt(context,image,art,projection,edits){
  context.fillStyle='#000';context.fillRect(0,0,384,224);context.imageSmoothingEnabled=false;
  for(const c of stageDrawCommands(art,projection,384,224,edits)){const size=c.size??256;context.drawImage(image,c.sx,c.sy,size,size,c.x,c.y,size,size);}
}
export function drawStageForeground(context,image,art,projection,edits){
  for(const c of stageDrawCommands(art,projection,384,224,edits,true)){const size=c.size??256;context.drawImage(image,c.sx,c.sy,size,size,c.x,c.y,size,size);}
}
