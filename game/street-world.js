import{MultiEncounter}from'./multi-encounter.js?v=999b8c9aee';
import{StageEnemy}from'./stage-enemy.js?v=999b8c9aee';
import{Prop}from'./prop.js?v=999b8c9aee';
import{Pickup,collectPickup}from'./pickup.js?v=999b8c9aee';
import{StageCollision}from'./stage-collision.js?v=999b8c9aee';
import{StageBoundary}from'./stage-boundaries.js?v=999b8c9aee';
import{StageSpawns}from'./stage-spawns.js?v=999b8c9aee';
import{ActorPool,EnemyLimits}from'./stage-pools.js?v=999b8c9aee';
import{advanceCamera,advanceParallax}from'./stage-camera.js?v=999b8c9aee';
import{updatePositionSlots}from'./position-slots.js?v=999b8c9aee';
import{contact,incomingContact,canGrab}from'./combat.js?v=999b8c9aee';
import{GrabPair}from'./grabs.js?v=999b8c9aee';
import{Player}from'./player.js?v=999b8c9aee';
import{Damnd}from'./damnd.js?v=999b8c9aee';
import{KnifeEnemy}from'./knife-enemy.js?v=999b8c9aee';
import{Knife}from'./knife.js?v=999b8c9aee';
import{Weapon,collectWeapon}from'./weapon.js?v=999b8c9aee';
import{StageWaves}from'./stage-waves.js?v=999b8c9aee';
import{StageMap}from'./stage-map.js?v=999b8c9aee';
import{SceneryPatch,patchTiles}from'./stage-scenery.js?v=999b8c9aee';
import{SectionTransition}from'./section-transition.js?v=999b8c9aee';
import{Debris}from'./debris.js?v=999b8c9aee';
import{Fragment,fragmentBurst}from'./fragment.js?v=999b8c9aee';
import{StreetEntrance,EntranceSpawn}from'./street-entrance.js?v=999b8c9aee';
import{HeavyEnemy}from'./heavy-enemy.js?v=999b8c9aee';
import{SubwayEnemy}from'./subway-enemy.js?v=999b8c9aee';
import{KnifeRunner}from'./knife-runner.js?v=999b8c9aee';
import{ImpactDust}from'./impact-dust.js?v=999b8c9aee';
import{RoomLighting}from'./lighting.js?v=999b8c9aee';
import{OpeningCast}from'./opening-cast.js?v=999b8c9aee';

// Continuous Slum and Subway gameplay. Original spawn schedules feed shared
// actor pools, with native opening actors and section progression.
export class StreetWorld extends MultiEncounter{
  constructor(data,scene,character=0){
    super(data,character,{spawns:[],bounds:false});this.scene=scene;this.stageIndex=0;this.sectionIndex=0;this.sectionTicks=0;
    const layout=scene.layouts.stages[0],section=layout.sections[0];
    this.camera={...section.camera2,x:section.camera2.x*65536,y:section.camera2.y*65536};
    this.parallax={...section.camera3,x:section.camera3.x*65536,y:section.camera3.y*65536};
    this.enemyPool=new ActorPool(13);this.propPool=new ActorPool(16);this.pickupPool=new ActorPool(10);this.limits=new EnemyLimits(scene.limits);
    this.bosses=[];this.scoreEvents=[];this.score=0;this.collected=0;this.effectEvents=[];this.entranceWaves=[];this.spawns=new StageSpawns(scene.schedules.alternate[0][0]);
    this.initScenery();
    this.levelClearTimer=0;this.difficultyTicks=0;this.lives=3;this.gameOver=false;this.pendingWeapons=[];
    const world=this.world;world.cameraX=this.camera.x>>16;world.cameraY=this.camera.y>>16;world.occupiedSlots=Array(8).fill(0);world.heavySlots=Array(4).fill(0);
    this.weaponPool=new ActorPool(6);world.knifeWeapons=[];world.createKnife=owner=>{
      if(!this.weaponPool.free.length)return null;
      const knife=data.weapons?new Weapon(data,{holder:owner}):new Knife(data,owner);knife.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(knife);return knife;
    };
    world.weaponTargets=()=>this.enemies;world.weaponHit=()=>this.hits++;
    world.playSound=command=>this.sounds.push(command);world.throwKnife=()=>this.sounds.push(14);world.resumeWave=()=>this.waves?.resume();this.createWaves();
    world.collision=new StageCollision(data.collision,layout,scene.layouts.blocks,world.cameraX);this.player.collision=world.collision;
    world.awardScore=(index,owner)=>{this.scoreEvents.push({index,owner});if(owner===0)this.score=Math.min(9999999,this.score+(data.hud?.scoreValues[index]??0));};
    world.dropItem=(event,owner)=>{
      if(event.type!==18){
        if(data.weapons?.[event.subtype]&&this.weaponPool.free.length){const weapon=new Weapon(data,event);weapon.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(weapon);world.knifeWeapons.push(weapon);}
        else this.pendingWeapons.push(event);return;
      }
      const item=new Pickup(data,event);item.onSound=command=>this.sounds.push(command);this.pickupPool.allocate(item);
    };
    world.spawnDebris=(owner,phase)=>{this.effectEvents.push({owner,phase});fragmentBurst(data,owner,phase,world,e=>this.fragmentPool.allocate(e));};
    world.spawnImpact=(attack,hurt,variant,facing,target)=>{if(!data.debris||!this.debrisPool.free.length)return;const x=attack.x+(((hurt.x-attack.x)<<16>>16)>>1),y=attack.y+(((hurt.y-attack.y)<<16>>16)>>1);if(target!==this.player&&!target.isProp)this.hudEnemy=target;const effect=new Debris(data,{x:x*65536,y:y*65536,groundY:target.groundY,variant});effect.facing=facing;this.debrisPool.allocate(effect);};
    this.player.onImpact=world.spawnImpact;this.player.onContactScore=attack=>{const index=data.hud?.contactScores[this.player.characterIndex]?.[attack.damageIndex>>5];if(index!==undefined)world.awardScore(index,0);};
    world.damndEntrance=owner=>{this.sceneryFlags[2]=1;this.sounds.push(23);for(const[x,y,direction]of[[2960,152,1],[2976,152,0],[2936,120,1],[3000,120,0]]){const phase=world.random.next()&3;for(let i=5;i>=0;i--)if(this.fragmentPool.free.length)this.fragmentPool.allocate(new Fragment(data,{x:x*65536,y:y*65536,groundY:y*65536,variant:0,index:i,phase,direction}));}this.effectEvents.push({owner,phase:'damndDoor'});};
    world.stopSpawns=()=>{world.spawnDisabled=true;if(this.waves){this.waves.complete=true;this.waves.cameraLocked=false;}};world.stageCleared=()=>this.stageCleared=true;
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
  initScenery(){
    this.effectPool=new ActorPool(30);this.sceneryFlags=Array(18).fill(0);this.tileEdits=new Map();
    this.roomLighting=this.stageIndex===0&&this.sectionIndex===1&&this.data.lighting?new RoomLighting(this.data):null;
    this.debrisPool=new ActorPool(30);this.fragmentPool=new ActorPool(30);
    this.sceneryMaps=new Map(this.scene.layouts.stages[this.stageIndex].layers.map(l=>[l.layer,new StageMap(l,this.scene.layouts.blocks)]));
  }
  breakDoor(owner,kind){
    this.effectEvents.push({owner,phase:'doorBreak'});if(this.data.dust&&this.debrisPool.free.length)this.debrisPool.allocate(new ImpactDust(this.data,owner));
    for(let group=0;group<2;group++){
      const phase=this.world.random.next()&3;
      for(let i=kind==='roomExit'?5:6;i>=0;i--)if(this.fragmentPool.free.length)this.fragmentPool.allocate(new Fragment(this.data,{index:i,phase,direction:owner.facing,x:kind==='roomExit'?2182*65536:owner.x&-65536,y:kind==='roomExit'?(group?144:88)*65536:((owner.y>>16)+32)*65536,groundY:kind==='roomExit'?(group?144:88)*65536:owner.groundY,variant:kind==='roomExit'?0:2}));
    }
  }
  updateScenery(){
    this.roomLighting?.update();
    const paint=patch=>{
      for(const edit of patchTiles(patch,(layer,x,y)=>this.tileEdits.get(`${layer}:${x}:${y}`)??this.sceneryMaps.get(layer).sample(x,y)))this.tileEdits.set(`${edit.layer}:${edit.x}:${edit.y}`,edit);
    };
    for(let slot=0;slot<this.effectPool.slots.length;slot++){
      const effect=this.effectPool.slots[slot];if(!effect)continue;
      if(effect instanceof SceneryPatch){
      effect.update({frame:this.world.frame,actorPhase:29-effect.slot,camera:{x:this.world.cameraX,y:this.world.cameraY},parallax:{x:this.parallax.x>>16,y:this.parallax.y>>16}},this.sceneryFlags,patch=>{
        paint(patch);
      });
      }else if(effect instanceof OpeningCast)effect.update(this.world,this.openingLeader);
      else if(effect instanceof StreetEntrance)effect.update(this.world,paint,variant=>this.effectPool.allocate(new EntranceSpawn(variant)));
      else if(effect instanceof EntranceSpawn)effect.update(variant=>{
        for(let character=0;character<3;character++)if(this.limits.accept(0,this.world.difficulty)){
          const actor=this.spawn({type:2,subtype:0,variant:character,parameter:7,direction:character,level:character===2?this.world.difficulty:0,x:(variant?976:576)*65536,y:63*65536});
          if(!actor)break;
        }
      });
      if(effect.removed)this.effectPool.release(effect.slot);
    }
  }
  get actors(){return[...this.enemies,...this.props,...this.items,...(this.world.knifeWeapons??[]).filter(w=>!w.removed),...this.debrisPool.slots.filter(Boolean),...this.fragmentPool.slots.filter(Boolean),...this.effectPool.slots.filter(e=>e instanceof OpeningCast&&!e.removed)];}
  createWaves(){
    this.waveCleared=false;
    const schedule=this.scene.waves?.alternate[this.stageIndex]?.[this.sectionIndex];this.waves=null;
    if(!schedule||!schedule.nodes.some(n=>n.kind==='wave')||schedule.nodes.some(n=>n.actors?.some(a=>a.type===2&&!this.data.enemies.some(e=>(e.family??0)===a.subtype&&e.sourceCharacterId===a.variant))))return;
    this.waves=new StageWaves(schedule,{onSignal:kind=>{if(kind===4||kind===8)this.waveCleared=true;},spawn:(definition,materialize)=>{
      if(definition.type===2&&!definition.flags&&!this.limits.accept(definition.subtype,this.world.difficulty))return null;
      const pool=definition.type===2?this.enemyPool:definition.type===10?this.propPool:null;
      if(pool&&!pool.free.length)return null;
      const actor=materialize();return this.spawn({...actor,x:actor.x*65536,y:actor.y*65536});
    }});
  }
  refreshActors(){this.enemies=[...this.enemyPool.slots.filter(Boolean),...this.bosses];this.enemy=this.enemies.find(e=>!e.defeated);this.world.collision.obstacles=this.props;}
  startAt(stageIndex=0,sectionIndex=0){
    if(!Number.isInteger(stageIndex)||!Number.isInteger(sectionIndex)||stageIndex<0||stageIndex>1||!this.scene.layouts.stages[stageIndex]?.sections[sectionIndex])throw new RangeError('Level is not playable');
    if(stageIndex||sectionIndex){this.stageIndex=stageIndex;this.enterSection(sectionIndex);}
  }
  enterSection(sectionIndex){
    const scene=this.scene,layout=scene.layouts.stages[this.stageIndex],section=layout.sections[sectionIndex],w=this.world;
    this.sectionIndex=sectionIndex;this.sectionTicks=0;this.hudEnemy=null;this.camera={...section.camera2,x:section.camera2.x*65536,y:section.camera2.y*65536};
    this.initScenery();
    this.parallax={...section.camera3,x:section.camera3.x*65536,y:section.camera3.y*65536};
    this.enemyPool=new ActorPool(13);this.propPool=new ActorPool(16);this.pickupPool=new ActorPool(10);this.limits=new EnemyLimits(scene.limits);
    this.bosses=[];this.stageCleared=false;this.entranceWaves=[];this.spawns=new StageSpawns(scene.schedules.alternate[this.stageIndex][sectionIndex]);this.grab=null;this.cleared=false;
    w.spawnDisabled=false;const heldWeapon=this.player.weapon;this.weaponPool=new ActorPool(6);w.knifeWeapons=[];w.knifeSlots=Array(4).fill(0);this.createWaves();
    w.stage=this.stageIndex;w.section=sectionIndex;w.activeAttackers=0;w.cameraX=section.camera2.x;w.cameraY=section.camera2.y;w.occupiedSlots=Array(8).fill(0);w.heavySlots=Array(4).fill(0);
    w.collision=new StageCollision(this.data.collision,layout,scene.layouts.blocks,w.cameraX,{section:sectionIndex});
    this.boundaries=(section.boundaries??[]).map(b=>new StageBoundary(b));
    for(let i=0;i<3;i++)for(const b of this.boundaries)b.update({x:w.cameraX,maxX:this.camera.maxX},e=>w.collision.paint(e));
    const previous=this.player,p=new Player(this.data,previous.characterIndex);this.player=p;
    p.health=previous.health;p.onContactScore=previous.onContactScore;p.onImpact=previous.onImpact;p.onSound=previous.onSound;p.comboThrow=previous.comboThrow;p.tryPickup=previous.tryPickup;p.weaponTargetInRange=previous.weaponTargetInRange;p.worldRandom=w.random;p.collision=w.collision;
    if(heldWeapon){p.weapon=heldWeapon;heldWeapon.holder=heldWeapon.owner=p;this.weaponPool.allocate(heldWeapon);w.knifeWeapons.push(heldWeapon);}
    p.x=(w.cameraX+8)*65536;p.y=p.groundY=51*65536;p.facing=0;p.invulnerable=60;
    this.transition=this.stageIndex===0&&this.data.characters[p.characterIndex].sectionMotion?new SectionTransition(sectionIndex===1?'roomEntry':'roofEntry'):null;if(this.stageIndex!==0){p.x=(w.cameraX+64)*65536;p.y=p.groundY=44*65536;}
    for(const event of scene.schedules.initial[this.stageIndex][sectionIndex].events)this.spawn({...event,x:event.x*65536,y:event.y*65536});
    this.refreshActors();
  }
  respawn(){
    const previous=this.player,p=new Player(this.data,previous.characterIndex);this.player=p;
    p.onContactScore=previous.onContactScore;p.onImpact=previous.onImpact;p.onSound=previous.onSound;p.comboThrow=previous.comboThrow;p.tryPickup=previous.tryPickup;p.weaponTargetInRange=previous.weaponTargetInRange;p.worldRandom=this.world.random;p.collision=this.world.collision;
    p.x=(this.world.cameraX+64)*65536;p.groundY=(this.world.cameraY+48)*65536;p.y=p.groundY+256*65536;
    p.vx=p.drag=0;p.vy=-0x600;p.gravity=0x48;p.invulnerable=180;p.mode='respawnFall';p.action('respawn');this.grab=null;this.deathTimer=null;
  }
  continueGame(){if(!this.gameOver)return;this.lives=3;this.gameOver=this.world.gameOver=false;this.respawn();}
  spawn(event){
    if(event.type===2){
      const variant=this.data.enemies.findIndex(e=>(e.family??0)===event.subtype&&e.sourceCharacterId===event.variant);
      if(variant<0)throw new Error('Street enemy family remains untranslated');
      if(!this.enemyPool.free.length)return null;
      const actor=new(event.subtype===8?KnifeRunner:[3,6].includes(event.subtype)?SubwayEnemy:event.subtype===5?KnifeEnemy:event.subtype===4?HeavyEnemy:StageEnemy)(this.data,{...event,variant});actor.onSound=command=>this.sounds.push(command);this.enemyPool.allocate(actor);return actor;
    }else if(event.type===4&&event.subtype===0){
      const boss=new Damnd(this.data,event);boss.onSound=command=>this.sounds.push(command);this.bosses.push(boss);return boss;
    }else if(event.type===4&&event.subtype===1){
      const boss=new SubwayEnemy(this.data,{...event,boss:true});boss.onSound=command=>this.sounds.push(command);this.bosses.push(boss);return boss;
    }else if(event.type===10){
      if(!this.propPool.free.length)return null;
      const prop=new Prop(this.data,event);prop.onSound=command=>this.sounds.push(command);this.propPool.allocate(prop);return prop;
    }else if(event.type===6&&this.data.weapons?.[event.subtype]&&this.weaponPool.free.length){
      const weapon=new Weapon(this.data,event);weapon.onSound=command=>this.sounds.push(command);this.weaponPool.allocate(weapon);this.world.knifeWeapons.push(weapon);return weapon;
    }else if(event.type===8){
      const position={...event,x:event.x>>16,y:event.y>>16};
      const effect=[23,33].includes(event.subtype)&&this.data.opening?new OpeningCast(this.data,event):event.subtype===1&&this.scene.patches?new SceneryPatch(position,this.scene.patches):event.subtype===15&&this.scene.entranceFrames?new StreetEntrance(position,this.scene.entranceFrames):{...event};
      this.effectPool.allocate(effect);if(effect instanceof OpeningCast&&!effect.jessica&&!effect.variant)this.openingLeader=effect;
      if(effect instanceof StreetEntrance)this.entranceWaves.push(effect);
    }
  }
  step(input){
    if(this.gameOver){this.sounds.length=0;return;}
    if(this.stageIndex===0&&this.sectionIndex===0&&this.world.frame<120){this.sounds.length=0;for(const prop of this.props)prop.update(this.world);this.updateScenery();this.world.frame++;this.refreshActors();return;}
    if(this.stageIndex===0&&this.sectionIndex<2&&!this.transition&&this.cleared&&(this.waveCleared||((input&1)&&(this.player.x>>16)>=this.camera.maxX+208))&&(this.player.y>>16)===(this.player.groundY>>16)){
      if(this.player.character.sectionMotion){this.transition=new SectionTransition('exitApproach');this.player.attackActive=false;}
      else this.enterSection(this.sectionIndex+1);
    }
    if(this.stageIndex===0&&this.sectionIndex===2&&this.cleared){if(++this.levelClearTimer>=180){this.stageIndex=1;this.enterSection(0);this.levelClearTimer=0;} }else if(this.stageIndex===1&&this.cleared&&this.sectionIndex<3){if(this.waves)this.waves.cameraLocked=false;input=1;if(++this.levelClearTimer>=100&&this.world.cameraX===this.camera.maxX){this.enterSection(this.sectionIndex+1);this.levelClearTimer=0;}}else this.levelClearTimer=0;
    this.sounds.length=0;this.refreshActors();const p=this.player,w=this.world;w.pressedInput=input&~p.previousInput;
    const transition=this.transition;
    if(transition)transition.update(p,{flags:this.sceneryFlags,camera:{x:w.cameraX,y:w.cameraY},entryOffset:this.scene.entryOffsets[this.sectionIndex],exitTarget:this.scene.exitTargets[this.sectionIndex],section:this.sectionIndex,unlockCamera:()=>{if(this.waves)this.waves.cameraLocked=false;},cameraReady:()=>w.cameraX===this.camera.maxX,awardScore:index=>w.awardScore(index,0),breakDoor:(owner,kind)=>this.breakDoor(owner,kind)});
    else if(this.grab?.holding){this.grab.updateHolder(input);if(p.pendingReaction){p.startReaction();this.grab.cancelHolder();}if(p.invulnerable)p.invulnerable--;}
    else p.update(input);
    if(this.grab?.holding&&p.mode==='hurtPending')this.grab.cancelHolder();
    p.grabSuppressed=!!p.grabCooldown;if(p.grabCooldown)p.grabCooldown--;
    p.airborne=(p.y>>16)!==(p.groundY>>16);p.evading=['knockdownInit','knockdown','hurtBounce','hurtSlide','recoverPending','recover'].includes(p.mode);
    if(p.hitLatch&&(!p.hitAttacker||p.hitAttacker.removed||!this.data.images[p.hitAttacker.animation.image].attackIndex))p.hitLatch=false;
    const enabled=!transition&&!p.hitLatch&&p.mode!=='dead',candidates=[],objects=[];
    for(const e of this.enemies){
      w.actorPhase=this.bosses.includes(e)?0:12-e.slot;const pair=e.grabPair;
      if(!pair||(!pair.updateHeld()&&!pair.updateThrown(w)))e.update(w,p);
      if(!this.data.images[p.animation.image].attackIndex)e.hitLatch=false;
      if(enabled&&e.contactsReady!==false&&!e.hitLatch&&!['dying','corpse','removePending','removed'].includes(e.mode))candidates.push(e);
      if(e.removed&&!this.bosses.includes(e)){this.limits.release(e.character.family??0);this.enemyPool.release(e.slot);}
    }
    for(const item of this.items){w.actorPhase=9-item.slot;item.update(w);if(item.removed)this.pickupPool.release(item.slot);}
    for(const knife of w.knifeWeapons){knife.update(w,p);if(knife.removed)this.weaponPool.release(knife.slot);}
    w.knifeWeapons=w.knifeWeapons.filter(knife=>!knife.removed);
    for(const object of this.props){
      w.actorPhase=15-object.slot;const ready=object.mode==='intact';object.update(w);
      if(ready&&object.mode==='intact')objects.push(object);
      if(object.removed)this.propPool.release(object.slot);
    }
    for(const e of candidates){
      if(!this.grab?.holding&&!this.grab?.held&&canGrab(this.data,p,e))this.grab=new GrabPair(this.data,this.data.grabs,p,e,w.random);
      else if(contact(this.data,p,e,{queued:true}))this.hits++;
    }
    for(const object of objects)if(contact(this.data,p,object,{queued:true}))this.hits++;
    for(const e of candidates)if(incomingContact(this.data,e,p,{queued:true}))this.receivedHits++;
    for(const event of this.spawns.advance({cameraX:w.cameraX,cameraY:w.cameraY,stage:this.stageIndex,section:this.sectionIndex,spawnDisabled:w.spawnDisabled,difficulty:w.difficulty,random:w.random,canSpawn:event=>event.type!==2||event.flags||this.limits.accept(event.subtype,w.difficulty)}))this.spawn({...event,x:event.x*65536,y:event.y*65536});
    this.waves?.update(w);
    this.updateScenery();
    for(const effect of this.debrisPool.slots.filter(Boolean)){effect.update(w);if(effect.removed)this.debrisPool.release(effect.slot);}
    for(const effect of this.fragmentPool.slots.filter(Boolean)){w.actorPhase=29-effect.slot;effect.update(w);if(effect.removed)this.fragmentPool.release(effect.slot);}
    this.refreshActors();
    if(this.limits.counts[0]||this.limits.counts[1])updatePositionSlots(w,p);
    const cameraActive=!transition||(!['roomEntry','roofEntry'].includes(transition.kind)&&(transition.kind!=='exitApproach'||transition.state>=6));
    if(cameraActive&&!this.waves?.cameraLocked)advanceCamera(this.camera,p);else this.camera.deltaX=this.camera.deltaY=0;
    advanceParallax(this.parallax,this.camera);
    w.cameraX=this.camera.x>>16;w.cameraY=this.camera.y>>16;w.collision.cameraX=w.cameraX;
    for(const b of this.boundaries)b.update({x:w.cameraX,maxX:this.camera.maxX},e=>w.collision.paint(e));
    if(++this.difficultyTicks===600){this.difficultyTicks=0;w.difficulty=Math.min(24,w.difficulty+1);}
    w.frame++;this.sectionTicks++;
    if(transition?.complete){this.transition=null;if(['streetExit','roomExit'].includes(transition.kind)){this.enterSection(this.sectionIndex+1);return;}}
    this.cleared=(this.waveCleared||this.bosses.length||w.cameraX===this.camera.maxX)&&this.spawns.complete&&(!this.waves||this.waves.complete)&&this.entranceWaves.every(wave=>wave.complete)&&!this.effectPool.slots.some(e=>e instanceof EntranceSpawn&&!e.state)&&!this.enemyPool.slots.some(Boolean)&&this.bosses.every(b=>b.defeated);
    if(p.mode==='dead'){
      if(this.deathTimer===undefined||this.deathTimer===null)this.deathTimer=60;
      else if(!--this.deathTimer){if(--this.lives>0){w.difficulty=Math.max(4,w.difficulty-2);this.difficultyTicks=0;this.respawn();}else this.gameOver=w.gameOver=true;}
    }
  }
  get musicKey(){return this.stageIndex===0?(this.sectionIndex===1?'underground':this.sectionIndex===0&&this.world.frame<352?'opening':'slum'):(this.sectionIndex<2?'subway':'sodom');}
  get view(){return{lightPhase:this.roomLighting?.phase,hud:{score:this.score,enemy:this.hudEnemy&&!this.hudEnemy.removed?this.hudEnemy:null,lives:this.lives,time:Math.max(0,(this.data.hud?.sectionTimes[this.stageIndex]?.[this.sectionIndex]??30)-Math.floor(this.sectionTicks/480))},openingMap:this.stageIndex===0&&this.sectionIndex===0&&this.world.frame<120,key:`${this.stageIndex}:${this.sectionIndex}`,cameraX:this.world.cameraX,cameraY:this.world.cameraY,tileEdits:this.tileEdits,projection:{2:{x:this.camera.x>>16,y:-(this.camera.y>>16)-240},3:{x:this.parallax.x>>16,y:-(this.parallax.y>>16)-240}}};}
}
