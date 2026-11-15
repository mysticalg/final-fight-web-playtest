import {Animation} from './animation.js?v=946ac5f4a3';
const word = value => value << 16 >> 16;

// Actor with an optional recovered Bred controller. Leaving brain unset selects
// the stationary research target; reaction states translate original handlers.
export class Enemy {
  constructor(data, x, y, facing=1,variant=0) {
    this.variant=variant;this.data=data; this.character=data.enemies[variant]; this.combat=this.character.combat;
    this.x=x; this.y=this.groundY=y; this.facing=facing;
    this.health=this.character.health; this.defenseIndex=this.character.defenseIndex;
    this.mode='neutral'; this.hitStop=0; this.hitLatch=false; this.imageOffset=0;
    this.animation=new Animation(data.animationEntries,this.character.actions.neutral);
  }
  action(name) { this.animation.set(this.character.actions[name]); this.imageOffset=0; }
  sound(command) { if(command!==null&&command!==undefined)this.onSound?.(command); }
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
    if(this.mode==='releasedFallPending'){
      this.speedX=this.speedY=0;this.vx=this.vy=0;this.mode='releasedFall';this.action('neutral');return;
    }
    if(this.mode==='releasedFall'){
      this.integrate();if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.mode='releasedFloorWait';this.releaseTimer=20;}return;
    }
    if(this.mode==='releasedFloorWait'){
      if(!--this.releaseTimer){this.mode='neutral';if(this.brain)this.brain.seek(world);else this.action('neutral');}return;
    }
    if(this.mode==='releasedPending'){
      this.speedX=this.speedY=0;this.releaseTimer=this.data.grabs.releaseWait[world.random.next()&31];this.mode='releasedWait';this.action('neutral');
      if((world.frame&7)===0)this.facing=(target.x>>16)<(this.x>>16)?1:0;return;
    }
    if(this.mode==='releasedWait'){
      if(!--this.releaseTimer){this.mode='neutral';if(this.brain){this.brain.state='seek';this.brain.phase=0;}}
      if((world.frame&7)===0)this.facing=(target.x>>16)<(this.x>>16)?1:0;return;
    }
    if(this.mode==='hurtPending') {
      // 0272E8 / 027334 / 02734A / 0273D2: first punches use types zero/one.
      this.facing=this.hitFrom^1; this.direction=this.hitFrom;
      const reaction=(this.y>>16)!==(this.groundY>>16)&&this.reaction!==8?3:this.reaction;
      if(reaction===5||reaction===6){
        if(reaction===6)this.direction^=1;
        this.mode='slamInit';this.action('grabFall');return;
      }
      if(this.health<0||reaction===3||reaction===7) {
        this.y=(this.y+52*65536)|0; this.mode='fallInit'; this.action('fall');
      } else { this.mode='hurt'; this.action(reaction===1||reaction===2?'hurt1':'hurt'); }
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
    if(this.mode==='slamInit') {
      this.vy=this.reaction===5?0x380:0x300;this.vx=0x200*(this.direction?-1:1);this.mode='slamFlight';return;
    }
    if(this.mode==='slamFlight') {
      this.integrate();
      if((this.y>>16)<=(this.groundY>>16)){
        this.y=this.groundY;this.facing^=1;this.action('down');this.mode='slamSlide';
        this.vx=0x100*(this.direction?-1:1);this.drag=20*(this.direction?-1:1);
      }return;
    }
    if(this.mode==='slamSlide') {
      this.animation.tick();const next=word(this.vx-this.drag);this.vx=(this.vx>=0)===(next>=0)?next:0;this.x=(this.x+this.vx*256)|0;
      if(!this.vx){this.mode=this.health<0?'defeated':'recoverInit';if(this.health>=0&&this.brain)this.brain.release(world);}return;
    }
    if(this.mode==='fallInit') {
      this.vy=this.health<0?0x300:0x380;
      this.vx=(this.health<0?0x400:0x200)*(this.direction?-1:1); this.mode='fall'; return;
    }
    if(this.mode==='fall'||this.mode==='bounce') {
      this.integrate();
      if((this.y>>16)<=(this.groundY>>16)) {
        this.y=this.groundY;
        if(this.mode==='fall') {
          this.mode='bounce'; this.action('down'); this.vy=this.health<0?0x400:0x280;
          this.vx=(this.health<0?0x100:0x280)*(this.direction?-1:1); return;
        } else { this.mode='slide'; this.vx=this.direction?-0x100:0x100; this.drag=(this.health<0?16:20)*(this.direction?-1:1); }
      }
      this.animation.tick(); return;
    }
    if(this.mode==='slide') {
      // 02794C / 003122: decelerate to zero without crossing its sign.
      if(this.health<0)this.animation.tick();
      const next=word(this.vx-this.drag);
      this.vx=(this.vx>=0)===(next>=0)?next:0;
      this.x=(this.x+this.vx*256)|0;
      if(!this.vx){
        if(this.health<0)this.mode='defeated';
        else {this.mode='recoverInit';if(this.brain)this.brain.release(world);}
      } else if(this.health>=0)this.animation.tick();
      return;
    }
    if(this.mode==='recoverInit') {
      this.speedX=this.speedY=0;this.groundY=this.y;
      this.recoveryTimer=this.character.recoveryWait[world.random.next()&31];this.mode='recoverWait';return;
    }
    if(this.mode==='recoverWait') {
      if(--this.recoveryTimer===0){this.mode='recover';this.action('recover');}return;
    }
    if(this.mode==='recover') {
      this.animation.tick();
      if(this.animation.flags&128){this.mode='neutral';if(this.brain)this.brain.seek(world);else this.action('neutral');}
    }
  }
}
