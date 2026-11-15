// Displays converted PNG assets. No ROM data or CPU runtime is loaded.
export class Presentation {
  constructor(data, background, sprites) { this.data = data; this.background = background; this.sprites = sprites; }
  static async load(data) {
    const image = path => new Promise((resolve,reject) => {
      const result = new Image();
      result.onload = () => resolve(result);
      result.onerror = () => reject(new Error(`Could not load game graphic: ${path}`));
      result.src = path;
    });
    const background = await image(data.background);
    const entries=Object.entries(data.sprites),sprites=new Map();
    let next=0;
    // Bound requests as the recovered animation library grows.
    await Promise.all(Array.from({length:Math.min(4,entries.length)},async()=>{
      while(next<entries.length){const [key,sprite]=entries[next++];sprites.set(key,await image(sprite.file));}
    }));
    return new Presentation(data,background,sprites);
  }
  draw(context,player,enemy) {
    context.imageSmoothingEnabled = false;
    context.drawImage(this.background,0,0);
    const actors=enemy?[player,enemy].sort((a,b)=>b.groundY-a.groundY):[player];
    for(const actor of actors)this.actor(context,actor);
  }
  actor(context,player) {
    const key = `${player.animation.image}-${player.facing}`;
    const sprite = this.data.sprites[key];
    if (!sprite) throw new Error(`Animation graphic is unavailable: ${key}`);
    const image=this.data.images[player.animation.image];
    const flip=player.facing&&(image.mode===4||image.mode===12);
    const shake=(player.imageOffset??0)*(flip?-1:1);
    context.drawImage(this.sprites.get(key),(player.x>>16)-this.data.stage.cameraX+sprite.x+shake,240-(player.y>>16)+this.data.stage.cameraY+sprite.y);
  }
}
