import {Encounter}from'./encounter.js?v=8e52b06854';
import {Enemy}from'./enemy.js?v=8e52b06854';
import {BredBrain}from'./bred-brain.js?v=8e52b06854';
import {GrabPair}from'./grabs.js?v=8e52b06854';
import {contact,incomingContact,canGrab,canComboThrow}from'./combat.js?v=8e52b06854';
import{CollisionGrid}from'./collision.js?v=8e52b06854';

// Original actor order and deferred contact application (8C80 / 3348 / 6F2E).
// This bounded crowd fixture is separate from stage-driven spawn/progression.
export class MultiEncounter extends Encounter {
  constructor(data,character=0,{bounds=true,spawns=null,collision=true}={}){
    super(data,character,{bounds});
    if(collision&&data.collision)this.world.collision=new CollisionGrid(data.collision,data.stage.cameraX);
    spawns??=[{variant:0,dx:72,dy:0},{variant:1,dx:104,dy:12},{variant:2,dx:136,dy:0}];
    this.enemies=spawns.map(({variant=0,dx=0,dy=0,health})=>{
      const e=new Enemy(data,this.player.x+dx*65536,this.player.y+dy*65536,0,variant);
      if(health!==undefined)e.health=health;e.brain=new BredBrain(e);e.onSound=command=>this.sounds.push(command);return e;
    });
    this.enemy=this.enemies[0];
    this.player.comboThrow=()=>{
      if(this.grab?.holding||this.grab?.held)return false;
      const victim=this.enemies.find(e=>canComboThrow(data,this.player,e));if(!victim)return false;
      this.grab=new GrabPair(data,data.grabs,this.player,victim,this.world.random,{comboThrow:true});return true;
    };
  }
  step(input){
    this.sounds.length=0;
    const p=this.player,world=this.world;
    if(this.grab?.holding){
      this.grab.updateHolder(input);
      if(p.pendingReaction){p.startReaction();this.grab.cancelHolder();}
      if(p.invulnerable)p.invulnerable--;
    }else p.update(input);
    if(this.grab?.holding&&p.mode==='hurtPending')this.grab.cancelHolder();
    p.grabSuppressed=!!p.grabCooldown;if(p.grabCooldown)p.grabCooldown--;
    p.airborne=(p.y>>16)!==(p.groundY>>16);
    p.evading=['knockdownInit','knockdown','hurtBounce','hurtSlide','recoverPending','recover'].includes(p.mode);
    // The player's latch is inspected before this frame's enemy updates.
    if(p.hitLatch&&(!p.hitAttacker||p.hitAttacker.removed||!this.data.images[p.hitAttacker.animation.image].attackIndex))p.hitLatch=false;
    const queueEnabled=!p.hitLatch&&p.mode!=='dead',candidates=[];
    for(const[index,e]of this.enemies.entries()){
      world.actorPhase=this.enemies.length-1-index;
      const previousHealth=e.health;
      const paired=this.grab?.victim===e;
      if(!paired||(!this.grab.updateHeld()&&!this.grab.updateThrown(world)))e.update(world,p);
      if(e.health<previousHealth)this.hits++;
      if(!this.data.images[p.animation.image].attackIndex)e.hitLatch=false;
      // 3348 skips both queues while this enemy remembers a player attack.
      if(queueEnabled&&!e.hitLatch&&!['corpse','removePending','removed'].includes(e.mode))candidates.push(e);
    }
    for(const e of candidates){
      if(!this.grab?.holding&&!this.grab?.held&&canGrab(this.data,p,e))this.grab=new GrabPair(this.data,this.data.grabs,p,e,world.random);
      else if(contact(this.data,p,e,{queued:true}))this.hits++;
    }
    for(const e of candidates)if(incomingContact(this.data,e,p,{queued:true}))this.receivedHits++;
    if(this.bounds){
      const camera=this.data.stage.cameraX;p.x=Math.max((camera+24)*65536,Math.min((camera+360)*65536,p.x));
      if(['idle','walkPending','walk','stopping','jumpPending','punchPending','punch','landing','idlePending'].includes(p.mode)){p.y=Math.max(16*65536,Math.min(96*65536,p.y));p.groundY=p.y;}
    }
    world.frame++;
  }
}
