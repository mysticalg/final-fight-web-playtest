import{drawStageArt}from'./stage-art.js?v=3eb60d19d2';
// Displays converted PNG assets. No ROM data or CPU runtime is loaded.
export class Presentation {
  constructor(data, background, sprites) { this.data = data; this.background = background; this.sprites = sprites; }
  static async load(data) {
    const attempt = path => new Promise((resolve,reject) => {
      const result = new Image();
      result.onload = () => resolve(result);
      result.onerror = () => reject(new Error(`Could not load game graphic: ${path}`));
      result.src = path;
    });
    const image=async path=>{
      for(let retry=0;;retry++){
        try{return await attempt(retry?`${path}${path.includes('?')?'&':'?'}retry=${retry}`:path);}
        catch(error){if(retry===2)throw error;}
      }
    };
    const entries=Object.entries(data.sprites),loaded=new Map();
    const opening=data.scenes?.art['0:0']?.file;
    const paths=[...new Set([data.background,...entries.map(([,sprite])=>sprite.file),...(opening?[opening]:[])])];
    let next=0;
    // Bound requests as the recovered animation library grows.
    await Promise.all(Array.from({length:Math.min(4,paths.length)},async()=>{
      while(next<paths.length){const path=paths[next++];loaded.set(path,await image(path));}
    }));
    const sprites=new Map(entries.map(([key,sprite])=>[key,loaded.get(sprite.file)]));
    const presentation=new Presentation(data,loaded.get(data.background),sprites);presentation.scenery=loaded;presentation.loadImage=image;return presentation;
  }
  async loadStage(key){const file=this.data.scenes.art[key].file;if(!this.scenery.has(file))this.scenery.set(file,await this.loadImage(file));}
  draw(context,player,enemy,view) {
    context.imageSmoothingEnabled = false;
    const art=view&&this.data.scenes?.art[view.key??'0:0'];
    if(art)drawStageArt(context,this.scenery.get(art.file),art,view.projection);else context.drawImage(this.background,0,0);
    const actors=[player,...(Array.isArray(enemy)?enemy:enemy?[enemy]:[])].sort((a,b)=>b.groundY-a.groundY);
    for(const actor of actors)this.actor(context,actor,view);
  }
  actor(context,player,camera=this.data.stage) {
    camera??=this.data.stage;
    if(player.removed||player.visible===false||player.drawn===false)return;
    const key = `${player.animation.image}-${player.facing}${player.paletteOverride?'-p'+player.paletteOverride:''}`;
    const sprite = this.data.sprites[key];
    if (!sprite) throw new Error(`Animation graphic is unavailable: ${key}`);
    const image=this.data.images[player.animation.image];
    const flip=player.facing&&(image.mode===4||image.mode===12||image.mode===16);
    const shake=(player.imageOffset??0)*(flip?-1:1);
    const x=(player.x>>16)-camera.cameraX+sprite.x+shake,y=240-(player.y>>16)+camera.cameraY+sprite.y;
    if(sprite.atlasX!==undefined)context.drawImage(this.sprites.get(key),sprite.atlasX,sprite.atlasY,sprite.width,sprite.height,x,y,sprite.width,sprite.height);
    else context.drawImage(this.sprites.get(key),x,y);
  }
}
