const word=n=>n<<16>>16;

// Separate timed encounter controller (005AAC–005F86). Declarative wave
// records select actors and delays; no original executable instructions run.
export class StageWaves{
  constructor(schedule,{spawn,isActive=actor=>actor.active!==false&&!actor.removed,onSignal=()=>{}}={}){
    this.schedule=schedule;this.spawn=spawn;this.isActive=isActive;this.onSignal=onSignal;
    this.mode=schedule.mode;this.cursor=0;this.state='initialize';this.paused=false;this.complete=false;this.cameraLocked=false;
    this.tracked=[];this.retry=[];this.lastWave=null;
  }
  resume(){
    if(!this.paused&&this.lastWave!==null)this.cursor=this.lastWave+2;
    this.paused=false;this.state='waiting';this.step=0;
  }
  begin(wave,index){
    this.wave=wave;this.lastWave=index;this.timeout=wave.timeout;this.required=wave.required;
    if(wave.cameraLock)this.cameraLocked=true;
    this.tracked=[];this.retry=[];this.actorIndex=0;this.actorPhase='load';this.state='active';this.step=0;
  }
  attempt(definition,world){
    if(definition.twoPlayersOnly&&!world.twoPlayers){if(definition.tracked)this.required=(this.required-1)&65535;return;}
    const position=n=>(n&32768)?word(n-32768+(world.random.next()&31)-15):word(n);
    // Admission/allocation precedes coordinate RNG. The callback can defer
    // admission without consuming the original shared random sequence.
    const result=this.spawn(definition,()=>({...definition,x:position(definition.x),y:position(definition.y),level:definition.level&128?world.difficulty:definition.level}));
    if(result==='skip'){if(definition.tracked)this.required=(this.required-1)&65535;}
    else if(!result){if(definition.tracked&&this.retry.length<10)this.retry.push(definition);}
    else if(definition.tracked&&this.required&&this.tracked.length<10)this.tracked.push(result);
  }
  update(world){
    if(this.complete)return;
    if(this.state==='initialize'){this.state='waiting';return;}
    if(this.state==='waiting'){
      if(this.paused)return;
      for(let guard=0;guard<256;guard++){
        const node=this.schedule.nodes[this.cursor];
        // 7FFF is an unreachable camera threshold, not a completion signal.
        if(!node||node.kind==='stop')return;
        if(node.kind==='mode'){this.mode=node.mode;this.cursor++;continue;}
        if(node.kind==='jump'){this.cursor=node.target;continue;}
        if(node.kind==='pause'){this.paused=true;this.cursor++;return;}
        const camera=this.mode===2||this.mode===6?world.cameraX:world.stage===3?world.verticalProgress:world.cameraY;
        if(node.trigger!==null&&(this.mode===0||this.mode===2?node.trigger>word(camera??0):node.trigger<word(camera??0)))return;
        this.begin(node,this.cursor);return;
      }
      throw new Error('Timed-wave graph loops without a wait');
    }
    if(this.state==='active'){
      if(this.actorPhase==='load'){
        const actor=this.wave.actors[this.actorIndex];
        if(!actor)this.actorPhase='finished';
        else{this.actorWait=actor.delay;this.actorPhase='wait';}
      }else if(this.actorPhase==='wait'){
        this.actorWait=(this.actorWait-1)&65535;
        if(!this.actorWait){this.attempt(this.wave.actors[this.actorIndex++],world);this.actorPhase='load';}
      }
      if((world.frame&15)===0&&this.retry.length)this.attempt(this.retry.pop(),world);
      const allCleared=(world.frame&7)===0&&this.tracked.length>0&&this.tracked.filter(actor=>!this.isActive(actor)).length===this.required;
      if(!allCleared){this.timeout=(this.timeout-1)&65535;if(this.timeout)return;}
      this.state='completion';this.step=0;this.cursor=this.lastWave+1;return;
    }
    const kind=this.wave.completion;
    if(kind===2){this.begin(this.schedule.nodes[this.cursor],this.cursor);return;}
    if(kind===4||kind===8){this.complete=true;this.onSignal(kind);return;}
    if(kind===6){this.cameraLocked=false;this.state='waiting';this.onSignal(kind);return;}
    if(!this.step){this.step=2;this.timeout=30;if(kind===0&&this.wave.arrow)this.onSignal('go');}
    else if(!--this.timeout){if(kind===0)this.cameraLocked=false;this.state='waiting';this.step=0;}
  }
}
