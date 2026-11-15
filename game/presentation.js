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
    const sprites = new Map(await Promise.all(Object.entries(data.sprites).map(async ([key,sprite]) => [key, await image(sprite.file)])));
    return new Presentation(data,background,sprites);
  }
  draw(context,player) {
    context.imageSmoothingEnabled = false;
    context.drawImage(this.background,0,0);
    const key = `${player.animation.image}-${player.facing}`;
    const sprite = this.data.sprites[key];
    if (!sprite) throw new Error(`Animation graphic is unavailable: ${key}`);
    context.drawImage(this.sprites.get(key),(player.x>>16)-this.data.stage.cameraX+sprite.x,240-(player.y>>16)+this.data.stage.cameraY+sprite.y);
  }
}
