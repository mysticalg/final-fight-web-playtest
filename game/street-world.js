import{MultiEncounter}from'./multi-encounter.js?v=b63cce8c3d';
import{StageEnemy}from'./stage-enemy.js?v=b63cce8c3d';
import{Prop}from'./prop.js?v=b63cce8c3d';
import{Pickup,collectPickup}from'./pickup.js?v=b63cce8c3d';
import{StageCollision}from'./stage-collision.js?v=b63cce8c3d';
import{StageBoundary}from'./stage-boundaries.js?v=b63cce8c3d';
import{StageSpawns}from'./stage-spawns.js?v=b63cce8c3d';
import{ActorPool,EnemyLimits}from'./stage-pools.js?v=b63cce8c3d';
import{advanceCamera,advanceParallax}from'./stage-camera.js?v=b63cce8c3d';
import{updatePositionSlots}from'./position-slots.js?v=b63cce8c3d';
import{contact,incomingContact,canGrab}from'./combat.js?v=b63cce8c3d';
import{GrabPair}from'./grabs.js?v=b63cce8c3d';
import{Player}from'./player.js?v=b63cce8c3d';
import{Damnd}from'./damnd.js?v=b63cce8c3d';
import{KnifeEnemy}from'./knife-enemy.js?v=b63cce8c3d';
import{Knife}from'./knife.js?v=b63cce8c3d';
import{Weapon,collectWeapon}from'./weapon.js?v=b63cce8c3d';
import{StageWaves}from'./stage-waves.js?v=b63cce8c3d';

// Continuous Slum gameplay. Original spawn schedules feed the same actor pools
// as the player walks between areas; cutscene effects remain separate work.
export class StreetWorld extends MultiEncounter{
  constructor(data,scene,character=0){
    super(data,character,{spawns:[],bounds:false});this.scene=scene;this.stageIndex=0;this.sectionIndex=0;
    const layout=scene.layouts.stages[0],section=layout.sections[0];
    this.camera={...section.camera2,x:section.camera2.x*65536,y:section.camera2.y*65536};
    this.parallax={...section.camera3,x:section.camera3.x*65536,y:section.camera3.y*65536};
    this.enemyPool=new ActorPool(13);this.propPool=new ActorPool(16);this.pickupPool=new ActorPool(10);this.limits=new EnemyLimits(scene.limits);
    this.bosses=[];this.scoreEvents=[];this.collected=0;this.effectEvents=[];this.windowWaves=[];this.spawns=new StageSpawns(scene.schedules.alternate[0][0]);
    this.difficultyTicks=0;this.lives=3;this.gameOver=false;this.pendingWeapons=[];
    const world=this.world;world.cameraX=this.camera.x>>16;world.cameraY=this.camera.y>>16;world.occupiedSlots=Array(8).fill(0);
    this.weaponPool=new ActorPool(6);world.knifeWeapons=[];world.createKnife=owner=>{
      if(!this.weaponPool.free.length)return null;
      const knife=data.weapons?new Weapon(data,{holder:owner}):new Knife(data,owner);knife.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(knife);return knife;
    };
    world.weaponTargets=()=>this.enemies;world.weaponHit=()=>this.hits++;
    world.throwKnife=()=>this.sounds.push(14);world.resumeWave=()=>this.waves?.resume();this.createWaves();
    world.collision=new StageCollision(data.collision,layout,scene.layouts.blocks,world.cameraX);this.player.collision=world.collision;
    world.awardScore=(index,owner)=>this.scoreEvents.push({index,owner});
    world.dropItem=(event,owner)=>{
      if(event.type!==18){
        if(data.weapons?.[event.subtype]&&this.weaponPool.free.length){const weapon=new Weapon(data,event);weapon.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(weapon);world.knifeWeapons.push(weapon);}
        else this.pendingWeapons.push(event);return;
      }
      const item=new Pickup(data,event);item.onSound=command=>this.sounds.push(command);this.pickupPool.allocate(item);
    };
    world.spawnDebris=(owner,phase)=>this.effectEvents.push({owner,phase});
    world.stopSpawns=()=>world.spawnDisabled=true;world.stageCleared=()=>this.stageCleared=true;
    this.player.tryPickup=()=>{const item=collectPickup(this.player,this.pickupPool.slots.filter(Boolean),world.awardScore);if(item){this.collected++;return item;}return collectWeapon(this.player,world.knifeWeapons);};
    this.player.weaponTargetInRange=()=>{
      const p=this.player,start=(p.x>>16)-(p.facing?160:0);
      return[...this.enemies,...this.props].some(e=>!e.removed&&(((e.x>>16)-start)&65535)<=160&&((p.groundY-e.groundY)>>16)>=-16&&((p.groundY-e.groundY)>>16)<=13);
    };
    this.boundaries=(section.boundaries??[]).map(b=>new StageBoundary(b));
    // The controlled comparison starts after camera initialization.
    for(let i=0;i<3;i++)for(const b of this.boundaries)b.update({x:world.cameraX,maxX:this.camera.maxX},e=>world.collision.paint(e));
    for(const event of scene.schedules.initial[0][0].events)this.spawn({...event,x:event.x*65536,y:event.y*65536});
    this.refreshActors();
  }
  get props(){return this.propPool.slots.filter(Boolean);}
  get items(){return this.pickupPool.slots.filter(Boolean);}
  get actors(){return[...this.enemies,...this.props,...this.items,...(this.world.knifeWeapons??[]).filter(w=>!w.removed)];}
  createWaves(){
    const schedule=this.scene.waves?.alternate[this.stageIndex]?.[this.sectionIndex];this.waves=null;
    if(!schedule||schedule.nodes.some(n=>n.actors?.some(a=>a.type===2&&!this.data.enemies.some(e=>(e.family??0)===a.subtype&&e.sourceCharacterId===a.variant))))return;
    this.waves=new StageWaves(schedule,{spawn:(definition,materialize)=>{
      if(definition.type===2&&!definition.flags&&!this.limits.accept(definition.subtype,this.world.difficulty))return null;
      const pool=definition.type===2?this.enemyPool:definition.type===10?this.propPool:null;
      if(pool&&!pool.free.length)return null;
      const actor=materialize();return this.spawn({...actor,x:actor.x*65536,y:actor.y*65536});
    }});
  }
  refreshActors(){this.enemies=[...this.enemyPool.slots.filter(Boolean),...this.bosses];this.enemy=this.enemies.find(e=>!e.defeated);this.world.collision.obstacles=this.props;}
  enterSection(sectionIndex){
    const scene=this.scene,layout=scene.layouts.stages[this.stageIndex],section=layout.sections[sectionIndex],w=this.world;
    this.sectionIndex=sectionIndex;this.camera={...section.camera2,x:section.camera2.x*65536,y:section.camera2.y*65536};
    this.parallax={...section.camera3,x:section.camera3.x*65536,y:section.camera3.y*65536};
    this.enemyPool=new ActorPool(13);this.propPool=new ActorPool(16);this.pickupPool=new ActorPool(10);this.limits=new EnemyLimits(scene.limits);
    this.bosses=[];this.stageCleared=false;this.windowWaves=[];this.spawns=new StageSpawns(scene.schedules.alternate[this.stageIndex][sectionIndex]);this.grab=null;this.cleared=false;
    const heldWeapon=this.player.weapon;this.weaponPool=new ActorPool(6);w.knifeWeapons=[];w.knifeSlots=Array(4).fill(0);this.createWaves();
    w.activeAttackers=0;w.cameraX=section.camera2.x;w.cameraY=section.camera2.y;w.occupiedSlots=Array(8).fill(0);
    w.collision=new StageCollision(this.data.collision,layout,scene.layouts.blocks,w.cameraX,{section:sectionIndex});
    this.boundaries=(section.boundaries??[]).map(b=>new StageBoundary(b));
    for(let i=0;i<3;i++)for(const b of this.boundaries)b.update({x:w.cameraX,maxX:this.camera.maxX},e=>w.collision.paint(e));
    const previous=this.player,p=new Player(this.data,previous.characterIndex);this.player=p;
    p.health=previous.health;p.onSound=previous.onSound;p.comboThrow=previous.comboThrow;p.tryPickup=previous.tryPickup;p.weaponTargetInRange=previous.weaponTargetInRange;p.worldRandom=w.random;p.collision=w.collision;
    if(heldWeapon){p.weapon=heldWeapon;heldWeapon.holder=heldWeapon.owner=p;this.weaponPool.allocate(heldWeapon);w.knifeWeapons.push(heldWeapon);}
    p.x=(w.cameraX+8)*65536;p.y=p.groundY=51*65536;p.facing=0;p.invulnerable=60;
    for(const event of scene.schedules.initial[this.stageIndex][sectionIndex].events)this.spawn({...event,x:event.x*65536,y:event.y*65536});
    this.refreshActors();
  }
  respawn(){
    const previous=this.player,p=new Player(this.data,previous.characterIndex);this.player=p;
    p.onSound=previous.onSound;p.comboThrow=previous.comboThrow;p.tryPickup=previous.tryPickup;p.weaponTargetInRange=previous.weaponTargetInRange;p.worldRandom=this.world.random;p.collision=this.world.collision;
    p.x=(this.world.cameraX+64)*65536;p.groundY=(this.world.cameraY+48)*65536;p.y=p.groundY+256*65536;
    p.vx=p.drag=0;p.vy=-0x600;p.gravity=0x48;p.invulnerable=180;p.mode='respawnFall';p.action('respawn');this.grab=null;this.deathTimer=null;
  }
  continueGame(){if(!this.gameOver)return;this.lives=3;this.gameOver=this.world.gameOver=false;this.respawn();}
  spawn(event){
    if(event.type===2){
      const variant=this.data.enemies.findIndex(e=>(e.family??0)===event.subtype&&e.sourceCharacterId===event.variant);
      if(variant<0)throw new Error('Street enemy family remains untranslated');
      if(!this.enemyPool.free.length)return null;
      const actor=new(event.subtype===5?KnifeEnemy:StageEnemy)(this.data,{...event,variant});actor.onSound=command=>this.sounds.push(command);this.enemyPool.allocate(actor);return actor;
    }else if(event.type===4&&event.subtype===0){
      const boss=new Damnd(this.data,event);boss.onSound=command=>this.sounds.push(command);this.bosses.push(boss);return boss;
    }else if(event.type===10){
      if(!this.propPool.free.length)return null;
      const prop=new Prop(this.data,event);prop.onSound=command=>this.sounds.push(command);this.propPool.allocate(prop);return prop;
    }else if(event.type===6&&this.data.weapons?.[event.subtype]&&this.weaponPool.free.length){
      const weapon=new Weapon(this.data,event);weapon.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(weapon);this.world.knifeWeapons.push(weapon);return weapon;
    }else if(event.type===8&&event.subtype===15){
      this.windowWaves.push({timer:38,variant:event.variant});
    }
  }
  step(input){
    if(this.gameOver){this.sounds.length=0;return;}
    if(this.sectionIndex<2&&this.cleared&&(input&1)&&(this.player.x>>16)>=this.camera.maxX+208)this.enterSection(this.sectionIndex+1);
    this.sounds.length=0;this.refreshActors();const p=this.player,w=this.world;w.pressedInput=input&~p.previousInput;
    if(this.grab?.holding){this.grab.updateHolder(input);if(p.pendingReaction){p.startReaction();this.grab.cancelHolder();}if(p.invulnerable)p.invulnerable--;}
    else p.update(input);
    if(this.grab?.holding&&p.mode==='hurtPending')this.grab.cancelHolder();
    p.grabSuppressed=!!p.grabCooldown;if(p.grabCooldown)p.grabCooldown--;
    p.airborne=(p.y>>16)!==(p.groundY>>16);p.evading=['knockdownInit','knockdown','hurtBounce','hurtSlide','recoverPending','recover'].includes(p.mode);
    if(p.hitLatch&&(!p.hitAttacker||p.hitAttacker.removed||!this.data.images[p.hitAttacker.animation.image].attackIndex))p.hitLatch=false;
    const enabled=!p.hitLatch&&p.mode!=='dead',candidates=[],objects=[];
    for(const e of this.enemies){
      w.actorPhase=e instanceof Damnd?0:12-e.slot;const paired=this.grab?.victim===e;
      if(!paired||(!this.grab.updateHeld()&&!this.grab.updateThrown(w)))e.update(w,p);
      if(!this.data.images[p.animation.image].attackIndex)e.hitLatch=false;
      if(enabled&&e.contactsReady!==false&&!e.hitLatch&&!['dying','corpse','removePending','removed'].includes(e.mode))candidates.push(e);
      if(e.removed){this.limits.release(e.character.family??0);this.enemyPool.release(e.slot);}
    }
    for(const item of this.items){w.actorPhase=9-item.slot;item.update(w);if(item.removed)this.pickupPool.release(item.slot);}
    for(const knife of w.knifeWeapons){knife.update(w,p);if(knife.removed)this.weaponPool.release(knife.slot);}
    w.knifeWeapons=w.knifeWeapons.filter(knife=>!knife.removed);
    for(const object of this.props){
      w.actorPhase=15-object.slot;const ready=object.mode==='intact';object.update(w);
      if(ready&&object.mode==='intact')objects.push(object);
      if(object.removed)this.propPool.release(object.slot);
    }
    for(const wave of this.windowWaves){
      if(wave.timer&&!--wave.timer){
        for(let variant=0;variant<3;variant++)if(this.limits.accept(0,w.difficulty))this.spawn({type:2,subtype:0,variant,parameter:7,direction:variant,level:variant===2?w.difficulty:0,x:(wave.variant?976:576)*65536,y:63*65536});
      }
    }
    for(const e of candidates){
      if(!this.grab?.holding&&!this.grab?.held&&canGrab(this.data,p,e))this.grab=new GrabPair(this.data,this.data.grabs,p,e,w.random);
      else if(contact(this.data,p,e,{queued:true}))this.hits++;
    }
    for(const object of objects)if(contact(this.data,p,object,{queued:true}))this.hits++;
    for(const e of candidates)if(incomingContact(this.data,e,p,{queued:true}))this.receivedHits++;
    for(const event of this.spawns.advance({cameraX:w.cameraX,cameraY:w.cameraY,difficulty:w.difficulty,random:w.random,canSpawn:event=>event.type!==2||event.flags||this.limits.accept(event.subtype,w.difficulty)}))this.spawn({...event,x:event.x*65536,y:event.y*65536});
    this.waves?.update(w);
    this.refreshActors();
    if(this.limits.counts[0]||this.limits.counts[1])updatePositionSlots(w,p);
    if(!this.waves?.cameraLocked)advanceCamera(this.camera,p);else this.camera.deltaX=this.camera.deltaY=0;
    advanceParallax(this.parallax,this.camera);
    w.cameraX=this.camera.x>>16;w.cameraY=this.camera.y>>16;w.collision.cameraX=w.cameraX;
    for(const b of this.boundaries)b.update({x:w.cameraX,maxX:this.camera.maxX},e=>w.collision.paint(e));
    if(++this.difficultyTicks===600){this.difficultyTicks=0;w.difficulty=Math.min(24,w.difficulty+1);}
    w.frame++;
    this.cleared=(this.bosses.length||w.cameraX===this.camera.maxX)&&this.spawns.complete&&(!this.waves||this.waves.complete)&&this.windowWaves.every(wave=>!wave.timer)&&!this.enemyPool.slots.some(Boolean)&&this.bosses.every(b=>b.defeated);
    if(p.mode==='dead'){
      if(this.deathTimer===undefined||this.deathTimer===null)this.deathTimer=60;
      else if(!--this.deathTimer){if(--this.lives>0){w.difficulty=Math.max(4,w.difficulty-2);this.difficultyTicks=0;this.respawn();}else this.gameOver=w.gameOver=true;}
    }
  }
  get view(){return{key:`${this.stageIndex}:${this.sectionIndex}`,cameraX:this.world.cameraX,cameraY:this.world.cameraY,projection:{2:{x:this.camera.x>>16,y:-(this.camera.y>>16)-240},3:{x:this.parallax.x>>16,y:-(this.parallax.y>>16)-240}}};}
}
