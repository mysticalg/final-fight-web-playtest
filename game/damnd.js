import{Animation}from'./animation.js?v=65c11d1bb4';
import{throwHealth}from'./grabs.js?v=65c11d1bb4';
const word=n=>n<<16>>16;
function angle(dx,dy){
  dx=word(dx);dy=word(dy*2);const x=Math.abs(dx),y=Math.abs(dy);
  let a=x===0?64:y===0?0:x>=y?Math.floor(y*32/x):64-Math.floor(x*32/y);
  if(dx<0)a=128-a;if(dy<0)a=256-a;return(64-a)&255;
}

// Native Damnd arrival, combat, retreats, reinforcements and death.
export class Damnd{
  constructor(data,{x=2968*65536,y=63*65536}={}){
    this.data=data;this.character=data.bosses[0];this.combat=this.character.combat;this.variant=8;this.slamKeepsHeight=true;
    this.x=x;this.y=y;this.groundY=0;this.facing=0;this.health=0;
    this.mode='arrival';this.arrival='waitCamera';this.drawn=false;this.hitStop=0;this.direction=0;this.tier=0;
    this.animation=new Animation(data.animationEntries,this.character.actions.idle);
  }
  action(name){this.animation.set(this.character.actions[name]);this.imageOffset=0;if(name==='motion4')this.invulnerable=62;if(name==='laugh')this.sound(40);}
  get contactsReady(){return this.mode!=='arrival'&&!this.defeated;}
  face(target){this.facing=(target.x>>16)>(this.x>>16)?0:1;}
  inRange(target,wide=false){return target.mode!=='dead'&&!target.evading&&Math.abs(word((target.x>>16)-(this.x>>16)))<=(wide?88:72)&&Math.abs(word((target.y>>16)-(this.y>>16)))<=(wide?24:9);}
  validPoint(x,y){return(x&65535)>=2740&&(x&65535)<3060&&(y&65535)>=16&&word(y)<64;}
  clamp(air=false){
    let blocked=false;
    if((this.groundY>>16)<16){this.groundY=16*65536;if(!air)this.y=this.groundY;blocked=true;}
    if((this.groundY>>16)>=64){this.groundY=63*65536;if(!air)this.y=this.groundY;blocked=true;}
    if((this.x>>16)<2740){this.x=2740*65536+(this.x&65535);blocked=true;}
    if((this.x>>16)>=3060){this.x=3059*65536+(this.x&65535);blocked=true;}
    return blocked;
  }
  move32(){
    if((this.direction>>>4)===this.facing)this.animation.tick();else this.animation.backward();
    if(this.animation.flags&128)return false;
    const[vx,vy]=this.character.walk32[this.animation.flags>>>2][this.direction];
    this.x=(this.x+vx*256)|0;this.y=(this.y+vy*256)|0;this.groundY=this.y;
    return this.clamp();
  }
  resetDance(){this.mode='dance';this.phase=this.step=0;this.skipApproach=false;this.attackIntent=false;}
  updateAttack(world,target){
    if(this.hitStop&&--this.hitStop)return;
    const b=this.character;
    if(this.phase===0){
      this.phase=2;this.attackTimer=b.attackDuration[(world.random.next()&62)>>1];this.attackIntent=true;
      this.attackScript=b.attackScripts[b.attackWeights[this.tier][world.random.next()&31]];this.scriptIndex=0;
    }else if(this.phase===2){
      if(this.skipApproach){this.phase=4;}
      else if(!this.step){
        this.step=2;this.targetOffset=(target.x>>16)<(this.x>>16)?64:-64;
        this.targetX=word((target.x>>16)+this.targetOffset);this.targetY=target.groundY>>16;
        if(!this.validPoint(this.targetX,this.targetY)){this.targetOffset=-this.targetOffset;this.targetX=word((target.x>>16)+this.targetOffset);if(!this.validPoint(this.targetX,this.targetY)){this.resetDance();return;}}
        this.face(target);this.action('walk');
      }else{
        if((world.frame&7)===0){
          this.face(target);this.targetX=word((target.x>>16)+this.targetOffset);this.targetY=target.groundY>>16;
          if(!this.validPoint(this.targetX,this.targetY)){this.targetOffset=-this.targetOffset;this.targetX=word((target.x>>16)+this.targetOffset);}
        }
        if(this.inRange(target)&&Math.abs(word(this.targetX-(this.x>>16)))<=9&&Math.abs(word(this.targetY-(this.y>>16)))<=9){this.phase=4;this.step=0;}
        else{
          if(world.frame&1){const desired=((angle(this.targetX-(this.x>>16),this.targetY-(this.groundY>>16))+4)>>>3)&31,difference=(desired-this.direction)&31;if(difference)this.direction=(this.direction+(difference<16?1:-1))&31;}
          this.move32();
        }
      }
    }else if(this.phase===4){
      const next=this.attackScript[this.scriptIndex++];
      if(next===undefined){this.phase=8;this.step=0;}else{this.attackPhase=next;this.phase=6;this.step=0;this.face(target);}
    }else if(this.phase===6){
      if(this.attackPhase===8){
        if(!this.step){this.step=2;this.groundY=this.y;this.vy=0x780;this.gravity=0x66;this.drag=this.facing?-5:5;this.vx=this.facing?-0x1aa:0x1aa;this.action('leap');}
        else if(this.step===2){this.animation.tick();if(!this.animation.flags){this.step=4;this.airborne=true;}}
        else if(this.step===4){
          this.vy=word(this.vy-this.gravity);this.vx=word(this.vx-this.drag);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;
          if(this.clamp(true))this.vx=this.drag=0;
          if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.step=6;this.airborne=false;this.face(target);this.action('walk');}else this.animation.tick();
        }else this.afterAttack(world,target,6);
      }else{
        if(!this.step){this.step=2;this.action(['jab','strike','kick2','uppercut'][this.attackPhase>>>1]);}
        else if(this.step===2){if(this.animation.flags&128){this.step=4;this.face(target);this.action('walk');}else this.animation.tick();}
        else this.afterAttack(world,target,4);
      }
    }else if(this.phase===8){
      if(!this.step){this.step=2;this.wait=b.restWait[world.random.next()&31];this.action('walk');}
      else if(!--this.wait){if(b.continueAttack[this.tier][world.difficulty??4]&(1<<(world.random.next()&31)))this.phase=this.step=0;else this.resetDance();}
    }
    if(this.attackTimer)this.attackTimer--;
    if(!this.attackTimer&&!this.airborne)this.resetDance();
  }
  afterAttack(world,target,base){
    if(this.step===base){
      if(this.scriptIndex>=this.attackScript.length){this.phase=4;this.step=0;}
      else{this.step+=2;this.wait=this.character.attackWait[world.random.next()&31];}
    }else if(!--this.wait){
      this.targetX=word((target.x>>16)+this.targetOffset);this.targetY=this.groundY>>16;
      if(!this.validPoint(this.targetX,this.targetY)||Math.abs(word(this.targetX-(this.x>>16)))>9||Math.abs(word(this.targetY-(this.y>>16)))>9)this.resetDance();
      else{this.phase=4;this.step=0;}
    }
  }
  chooseDirection(world,change=false){
    this.clamp();
    const column=(((this.x>>16)-2740)&448)>>>6,row=(((this.groundY>>16)-16)&240)>>>4;
    const choices=this.character.directions[this.character.regionDirections[column+row*5]];
    if(change){for(let i=0;i<5;i++){const next=(this.direction+this.character.directionChanges[world.random.next()&31])&255;if(choices.includes(next)){this.direction=next;return;}}}
    this.direction=choices[world.random.next()&15];
  }
  move16(){
    if((this.direction>>>3)===this.facing)this.animation.tick();else this.animation.backward();
    if(this.animation.flags&128)return false;
    const[vx,vy]=this.character.walk16[this.animation.flags>>>2][this.direction];this.x=(this.x+vx*256)|0;this.y=(this.y+vy*256)|0;this.groundY=this.y;return this.clamp();
  }
  jumpMove(){const[vx,vy]=this.character.jump16[this.motion===0?'low':'high'][this.direction];this.x=(this.x+vx*256)|0;this.y=(this.y+vy*256)|0;this.groundY=(this.groundY+vy*256)|0;}
  afterMotion(world,target,base){
    if(this.step===base){this.face(target);if(this.motionIndex>=this.motionScript.length){this.step=0;this.phase=4;this.chooseDirection(world,true);}else{this.step+=2;this.wait=this.character.attackWait[world.random.next()&31];}}
    else if(!--this.wait){this.phase=4;this.step=0;this.chooseDirection(world,true);}
  }
  updateDance(world,target){
    const b=this.character;
    if(this.phase===0){this.phase=2;this.action('walk');this.chooseDirection(world);}
    else if(this.phase===2){this.phase=4;this.motionScript=b.motionScripts[b.motionWeights[world.random.next()&31]];this.motionIndex=0;}
    else if(this.phase===4){const next=this.motionScript[this.motionIndex++];if(next===undefined)this.phase=8;else{this.motion=next;this.phase=6;}this.step=0;}
    else if(this.phase===6){
      if(this.motion<4){
        if(!this.step){this.step=2;this.airborne=true;this.action(this.motion===0?'rise':'hang');}
        else if(this.step===2){this.animation.tick();if(!this.animation.flags){this.step=4;this.gravity=this.motion===0?0x340:0x5c0;}}
        else if(this.step===4){this.jumpMove();this.y=(this.y+this.gravity*256)|0;this.gravity-=0x50;if(this.gravity<0){this.gravity=0;this.step=6;}this.clamp(true);this.animation.tick();}
        else if(this.step===6){this.jumpMove();this.y=(this.y-this.gravity*256)|0;this.gravity=Math.min(0x600,this.gravity+0x50);this.clamp(true);if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.step=8;this.airborne=false;this.action(this.motion===0?'walk':'kick');}else this.animation.tick();}
        else if(this.motion===2&&this.step===8){this.animation.tick();if(this.animation.flags){this.step=10;this.action('walk');}}
        else this.afterMotion(world,target,this.motion===0?8:10);
      }else{
        if(!this.step){this.step=2;this.wait=this.motion===4?60:120;}
        else if(this.step===2){if(!--this.wait)this.step=4;else{if((world.frame&15)===0)this.face(target);if(this.move16())this.step=4;}}
        else this.afterMotion(world,target,4);
      }
    }else if(this.phase===8){
      if(!this.step){this.step=2;this.wait=b.restWait[world.random.next()&31];}
      else if(!--this.wait){this.phase=10;this.step=0;this.danceTimer=b.danceDuration[this.tier][(world.random.next()&62)>>>1];}
    }else if(this.phase===10){
      if(!this.step){this.step=2;this.wait=1;}
      else if(this.step===2){if(!--this.wait){this.step=4;world.random.next();this.wait=120;this.action('laugh');}}
      else if(!--this.wait){this.step=0;this.action('walk');}else this.animation.tick();
      if((world.frame&15)===0)this.face(target);
      if(!--this.danceTimer){this.mode='attack';this.phase=this.step=0;}
    }
    if(!this.airborne&&this.inRange(target,true)){this.skipApproach=this.inRange(target);this.mode='attack';this.phase=this.step=0;}
  }
  sound(command){this.onSound?.(command);}
  hit(damage,reaction,facing){this.health=word(this.health-damage);this.reaction=reaction;this.hitFrom=facing;this.hitStop=6;this.hitLatch=true;this.pendingReaction=true;}
  startReaction(){this.pendingReaction=false;this.mode=this.health<0?'dying':'hurt';this.phase=this.step=0;}
  releaseHeld(){this.invulnerable=50;this.mode=this.mode==='releasedFallPending'?'releasedFall':'releasedWait';this.phase=this.step=0;this.action(this.mode==='releasedFall'?'knockdown':'walk');}
  updateRelease(world,target){
    if(this.mode==='releasedWait'){
      if(!this.phase){if(this.health<=200&&!this.retreatTier){this.finishHurt(world,target);return;}this.phase=2;this.wait=this.character.releaseWait[world.random.next()&31];}
      else if(!--this.wait){this.resetDance();this.action('walk');}
      if((world.frame&7)===0)this.face(target);
    }else{
      if(!this.phase){this.phase=2;this.vx=this.vy=0;}
      else if(this.phase===2){this.integrate();if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.phase=4;if(this.health<=200&&!this.retreatTier)this.finishHurt(world,target);}}
      else if(this.phase===4){this.phase=6;this.wait=57;this.action('motion3');}
      else if(!--this.wait){this.resetDance();this.action('walk');}
    }
  }
  integrate(){this.vy=word(this.vy-0x48);this.y=(this.y+this.vy*256)|0;this.x=(this.x+this.vx*256)|0;}
  slide(){const next=word(this.vx-this.drag);this.vx=(this.vx>=0)===(next>=0)?next:0;this.x=(this.x+this.vx*256)|0;}
  finishHurt(world,target){
    if(!this.retreatTier&&this.health<=200){this.retreatTier=1;this.retreatPending=true;}
    else if(this.retreatTier===1&&this.health<=100){this.retreatTier=2;this.retreatPending=true;this.tier=1;}
    if(this.retreatActive||this.retreatPending){this.mode='retreat';this.phase=this.step=0;this.retreatActive=true;this.retreatPending=false;this.action('walk');return;}
    if(this.attackIntent){
      this.targetX=word((target.x>>16)+(this.targetOffset??0));this.targetY=this.groundY>>16;
      if(this.validPoint(this.targetX,this.targetY)&&Math.abs(word(this.targetX-(this.x>>16)))<=9){this.mode='attack';this.phase=4;this.step=0;return;}
    }
    this.resetDance();this.action('walk');
  }
  updateHurt(world,target){
    if(!this.phase){this.phase=2;this.facing=this.hitFrom^1;this.airborne=false;this.skipApproach=false;return;}
    if(this.phase===4){this.finishHurt(world,target);return;}
    const r=this.reaction;
    if(r===0||r===1||r===2){
      if(!this.step){this.step=2;this.action(r===1?'hurt1':'hurt');}
      else if(this.step===2){this.animation.tick();if(!this.animation.flags)this.step=4;}
      else if(this.step===4){if(this.hitStop)this.hitStop--;if(!this.hitStop)this.step=6;}
      else{const before=this.animation.address;this.animation.tick();if(before!==this.animation.address)this.imageOffset=0;this.imageOffset=word(this.imageOffset+(this.character.hurtShake[this.animation.remaining]??0));if(this.animation.flags&128){this.phase=4;this.step=0;this.action('walk');}}
      return;
    }
    if(r===4){this.phase=4;this.step=0;this.action('walk');return;}
    if(r===5||r===6){
      if(!this.step){
        if(this.hitStop&&--this.hitStop)return;
        this.step=2;this.collisionWait=0;this.facing=this.hitFrom^1;
        this.vx=(r===5?0x280:0x200)*(r===5?(this.facing?1:-1):(this.facing?-1:1));this.vy=r===5?0x380:0x300;
      }else if(this.step===2){
        if(this.collisionWait){this.collisionWait--;return;}
        this.integrate();if(this.clamp(true)){this.sound(13);this.vx=0;this.collisionWait=4;if(this.vy>=0)this.vy=0;}
        if((this.y>>16)<=(this.groundY>>16)){
          this.sound(13);this.y=this.groundY;this.step=4;this.facing^=1;this.action('hurtFall');
          const sign=r===5?(this.facing?-1:1):(this.facing?1:-1);this.vx=0x100*sign;this.drag=20*sign;
        }
      }else if(this.step===4){this.animation.tick();this.slide();const blocked=this.clamp();this.groundY=this.y;if(!this.vx||blocked){this.step=6;this.action('motion4');}}
      else{this.animation.tick();if(this.animation.flags){this.phase=4;this.step=0;}}
      return;
    }
    if(r===3||r===7||r===8){
      if(!this.step){this.step=2;this.action('recover');}
      else if(this.step===2){if(this.hitStop)this.hitStop--;if(!this.hitStop){this.step=4;this.collisionWait=0;this.vx=this.facing?0x200:-0x200;this.vy=0x380;this.y=(this.y+16*65536)|0;this.action('recover');}}
      else if(this.step===4){
        this.animation.tick();if(this.collisionWait&&--this.collisionWait)return;
        this.integrate();if(this.clamp(true)){this.sound(13);this.collisionWait=5;this.vx=0;if(this.vy>=0)this.vy=0;}
        if((this.y>>16)<=(this.groundY>>16)){this.sound(13);this.step=6;this.y=this.groundY;this.vx=this.facing?0x280:-0x280;this.vy=0x280;this.action('hurtFall');}
      }else if(this.step===6){
        this.integrate();if(this.clamp(true))this.vx=0;
        if((this.y>>16)<=(this.groundY>>16)){this.step=8;this.y=this.groundY;this.vx=this.facing?0x100:-0x100;this.drag=this.facing?20:-20;}
        this.animation.tick();
      }else if(this.step===8){this.slide();const blocked=this.clamp();this.groundY=this.y;if(!this.vx||blocked){this.step=10;this.action('motion4');}}
      else{if(this.animation.flags){this.phase=4;this.step=0;}this.animation.tick();}
      return;
    }
    throw new Error(`Damnd hurt reaction ${r} remains in reconstruction`);
  }
  retreatMove(){this.x=(this.x+this.vx*256)|0;this.y=(this.y+this.vy*256)|0;this.groundY=(this.groundY+this.vy*256)|0;}
  updateRetreat(world,target){
    if(this.phase===0||this.phase===8){
      const returning=this.phase===8;
      if(!this.step){
        this.step=2;this.face(target);this.airborne=true;
        const tx=returning?target.x>>16:3168,ty=returning?target.groundY>>16:48;
        this.landY=ty;this.vx=word((tx-(this.x>>16))*4);this.vy=word((ty-(this.y>>16))*4);this.gravity=0x400;this.action(returning?'down':'fall');
      }else if(this.step===2){this.retreatMove();this.y=(this.y+this.gravity*256)|0;this.gravity-=0x20;if(this.gravity<0){this.gravity=0;this.step=4;}this.animation.tick();}
      else{
        if(returning&&this.hitStop&&--this.hitStop)return;
        this.retreatMove();this.y=(this.y-this.gravity*256)|0;this.gravity=Math.min(0x600,this.gravity+0x20);
        if((this.y>>16)<=this.landY){
          if(returning){this.resetDance();this.y=this.groundY;this.retreatActive=false;this.airborne=false;this.invulnerable=40;this.action('walk');this.clamp();this.groundY=this.y;this.animation.tick();}
          else{this.phase=2;this.step=0;this.y=(48*65536)+(this.y&65535);this.groundY=(40*65536)+(this.groundY&65535);this.wait=30;this.action('motion1');this.face(target);}
        }else this.animation.tick();
      }
    }else if(this.phase===2){if(!--this.wait){this.phase=4;this.action('motion2');}}
    else if(this.phase===4){
      this.animation.tick();if(this.animation.flags===2)this.sound(39);
      if(this.animation.flags===1){this.phase=6;this.action('motion1');world.resumeWave?.();this.retreatTimer=300;this.goaded=false;}
    }else if(this.phase===6){
      if(!this.step){if(!this.goaded&&(target.evading||target.mode==='dead')){this.step=2;this.wait=120;this.sound(40);}}
      else if(!--this.wait){this.step=0;this.action('motion1');}else this.animation.tick();
      if(!--this.retreatTimer){this.phase=8;this.step=0;}
    }
  }
  updateDying(world){
    if(this.phase===0){
      if(!this.step){if(this.hitStop&&--this.hitStop)return;this.step=2;this.collisionWait=0;this.vx=this.facing?0x400:-0x400;this.vy=0x300;this.y=(this.y+16*65536)|0;this.action('recover');}
      else if(this.step===2){
        this.animation.tick();if(this.collisionWait&&--this.collisionWait)return;
        this.integrate();if(this.clamp(true)){this.sound(13);this.collisionWait=5;this.vx=0;if(this.vy>=0)this.vy=0;}
        if((this.y>>16)<=(this.groundY>>16)){this.sound(13);this.step=4;this.y=this.groundY;this.vx=this.facing?0x100:-0x100;this.vy=0x400;this.action('hurtFall');}
      }else if(this.step===4){this.integrate();if(this.clamp(true))this.vx=0;if((this.y>>16)<=(this.groundY>>16)){this.step=6;this.y=this.groundY;this.vx=this.facing?0x100:-0x100;this.drag=this.facing?16:-16;}this.animation.tick();}
      else{this.slide();const blocked=this.clamp();this.groundY=this.y;if(!this.vx||blocked){this.phase=2;this.step=0;}}
    }else if(this.phase===2){
      if(!this.step){this.step=2;world.stopSpawns?.();this.wait=40;this.action('hurtFall');}
      else if(!--this.wait){this.phase=4;this.step=0;this.action('jumpStart');}
    }else{
      this.animation.tick();if(!this.step&&this.animation.flags){this.step=2;this.defeated=true;world.stageCleared?.();}
    }
  }
  updateThrown(world,holder){
    if(this.mode==='thrownPending'){
      this.mode='thrown';this.phase=2;this.collisionWait=0;this.throwDamaged=false;this.vx=this.facing?-0x400:0x400;this.vy=0x400;this.action('corpse');return true;
    }
    if(this.mode!=='thrown')return false;
    const damage=()=>{if(!this.throwDamaged){this.throwDamaged=true;this.health=throwHealth(this.health,holder.characterIndex);}};
    if(this.phase===2){
      if(this.hitStop){this.hitStop--;return true;}
      if(this.collisionWait)this.collisionWait--;
      else{
        this.integrate();if(this.clamp(true)){this.sound(13);if(!this.throwDamaged){damage();this.vx=0;this.collisionWait=4;if(this.vy>=0)this.vy=0;}}
        if((this.y>>16)<=(this.groundY>>16)){this.sound(13);this.action('hurtFall');damage();this.phase=4;this.y=this.groundY;this.vx=this.facing?-0x100:0x100;this.vy=0x400;}
      }
      this.animation.tick();
    }else if(this.phase===4){
      this.integrate();if(this.clamp(true))this.vx=0;
      if((this.y>>16)<=(this.groundY>>16)){this.y=this.groundY;this.phase=6;this.vx=this.facing?-0x100:0x100;this.drag=this.facing?-16:16;}this.animation.tick();
    }else if(this.phase===6){
      this.animation.tick();this.slide();const blocked=this.clamp();this.groundY=this.y;
      if(!this.vx||blocked){if(this.health<0){this.mode='dying';this.phase=2;this.step=0;}else{this.phase=8;this.face(holder);this.action('motion4');}}
    }else{this.animation.tick();if(this.animation.flags)this.finishHurt(world,holder);}
    return true;
  }
  update(world,target){
    const normal=this.mode!=='arrival';
    this.updateState(world,target);
    if(this.pendingReaction){this.pendingReaction=false;if((this.y>>16)!==(this.groundY>>16)&&this.reaction!==8)this.reaction=3;this.mode=this.health<0?'dying':'hurt';this.phase=this.step=0;}
    if(normal&&this.invulnerable)this.invulnerable--;
    const stats=this.character.levels[world.difficulty??4];this.defenseIndex=stats.defenseIndex;this.combat={...this.combat,damage:stats.damage};
  }
  updateState(world,target){
    if(this.mode==='releasedWait'||this.mode==='releasedFall')return this.updateRelease(world,target);
    if(this.mode==='dying')return this.updateDying(world);
    if(this.mode==='retreat')return this.updateRetreat(world,target);
    if(this.mode==='hurt')return this.updateHurt(world,target);
    if(this.mode==='attack')return this.updateAttack(world,target);
    if(this.mode==='dance')return this.updateDance(world,target);
    if(this.arrival==='waitCamera'){
      if((world.cameraX&65535)>=2720)this.arrival='initialize';return;
    }
    if(this.arrival==='initialize'){
      this.groundY=this.y;this.facing=1;this.health=this.maxHealth=300;this.invulnerable=40;
      // Signal the background door patch and four original impact bursts.
      if(world.damndEntrance)world.damndEntrance(this);else for(let i=0;i<4;i++)world.random.next();
      this.action('jab');this.arrival='pose';this.drawn=true;return;
    }
    if(this.arrival==='pose'){
      this.animation.tick();if(this.animation.flags)this.arrival='ready';return;
    }
    this.mode='attack';this.phase=0;this.step=0;this.action('walk');
  }
}
