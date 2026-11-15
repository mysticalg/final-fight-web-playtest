import {Animation} from './animation.js?v=1bb9bc2b0d';
const word = value => value << 16 >> 16;

// Actor with an optional recovered Bred controller. Leaving brain unset selects
// the stationary research target; reaction states translate original handlers.
export class Enemy {
  constructor(data, x, y, facing=1) {
    this.data=data; this.character=data.enemies[0]; this.combat=this.character.combat;
    this.x=x; this.y=this.groundY=y; this.facing=facing;
    this.health=this.character.health; this.defenseIndex=this.character.defenseIndex;
    this.mode='neutral'; this.hitStop=0; this.hitLatch=false; this.imageOffset=0;
    this.animation=new Animation(data.animationEntries,this.character.actions.neutral);
  }
  action(name) { this.animation.set(this.character.actions[name]); this.imageOffset=0; }
  hit(damage,reaction,facing) {
    this.health=word(this.health-damage); this.reaction=reaction; this.hitFrom=facing;
    this.hitStop=6; this.hitLatch=true; this.pendingReaction=true;
  }
  startReaction() { this.pendingReaction=false;this.mode='hurtPending'; }
  integrate() {
    // 00309A: X velocity is constant; apply gravity before Y displacement.
    this.x=(this.x+this.vx*256)|0; this.vy=word(this.vy-0x48);
    this.y=(this.y+this.vy*256)|0;
  }
  update(world,target) {
    this.updateState(world,target);
    // 022BC0 observes health changes after the actor's current handler.
    if(this.pendingReaction)this.startReaction();
  }
  updateState(world,target) {
    if(this.mode==='neutral'){if(this.brain)this.brain.update(world,target);return;}
    if(this.mode==='defeated')return;
    if(this.mode==='hurtPending') {
      // 0272E8 / 027334 / 02734A / 0273D2: first punches use types zero/one.
      this.facing=this.hitFrom^1; this.direction=this.hitFrom;
      if(this.health<0) {
        this.y=(this.y+52*65536)|0; this.mode='fallInit'; this.action('fall');
      } else { this.mode='hurt'; this.action(this.reaction===1?'hurt1':'hurt'); }
      return;
    }
    if(this.mode==='hurt') {
      // 0273E4: animation continues during enemy hit-stop; shake waits.
      if(this.hitStop) { this.hitStop--; this.animation.tick(); return; }
      const oldEntry=this.animation.address;
      this.animation.tick();
      if(this.animation.address!==oldEntry)this.imageOffset=0;
      this.imageOffset=word(this.imageOffset+(this.character.hurtShake[this.animation.remaining]??0));
      if(this.animation.flags&128) {
        this.mode='neutral';
        if(this.brain?.reserved){this.brain.state='attack';this.brain.phase=0;this.running=true;this.action('run');}
        else if(this.brain)this.brain.seek(world);
        else this.action('neutral');
      }
      return;
    }
    // 027808: fatal knockback shares original fall/bounce/slide states.
    if(this.hitStop) { this.hitStop--; return; }
    if(this.mode==='fallInit') {
      this.vy=0x300; this.vx=this.direction?-0x400:0x400; this.mode='fall'; return;
    }
    if(this.mode==='fall'||this.mode==='bounce') {
      this.integrate();
      if((this.y>>16)<=(this.groundY>>16)) {
        this.y=this.groundY;
        if(this.mode==='fall') {
          this.mode='bounce'; this.action('down'); this.vy=0x400; this.vx=this.direction?-0x100:0x100; return;
        } else { this.mode='slide'; this.vx=this.direction?-0x100:0x100; this.drag=this.direction?-16:16; }
      }
      this.animation.tick(); return;
    }
    if(this.mode==='slide') {
      // 02794C / 003122: decelerate to zero without crossing its sign.
      this.animation.tick();
      const next=word(this.vx-this.drag);
      this.vx=(this.vx>=0)===(next>=0)?next:0;
      this.x=(this.x+this.vx*256)|0;
      if(!this.vx)this.mode='defeated';
    }
  }
}
