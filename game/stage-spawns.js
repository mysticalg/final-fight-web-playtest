const word=value=>value<<16>>16;
// Explicit spawn schedules from 00605C–006238. Stage completion, camera locks
// and actor-family initialization belong to the stage/world controllers.
export class StageSpawns{
  constructor(schedule){this.schedule=schedule;this.mode=schedule.mode;this.cursor=0;this.complete=false;}
  advance({cameraX=0,cameraY=0,verticalProgress=cameraY,stage=0,section=0,verticalOffset=0,difficulty=0,twoPlayers=false,spawnDisabled=false,random,canSpawn=()=>true}={}){
    const spawned=[];if(this.complete)return spawned;
    while(this.cursor<this.schedule.events.length){
      const event=this.schedule.events[this.cursor];
      if(event.mode!==undefined){this.mode=event.mode;this.cursor++;continue;}
      if(this.mode!==null){
        const camera=this.mode===2||this.mode===6?cameraX:stage===3?verticalProgress:cameraY;
        if(this.mode===0||this.mode===2?event.trigger>word(camera):event.trigger<word(camera))return spawned;
      }
      this.cursor++;
      if(event.type===0||event.type===14||(event.twoPlayersOnly&&!twoPlayers)||(event.type===2&&spawnDisabled)||!canSpawn(event))continue;
      const position=value=>(value&32768)?word((value-32768)+(random.next()&31)-15):word(value);
      const x=position(event.x),y=word(position(event.y)-(stage===3&&section===1?verticalOffset:0));
      spawned.push({...event,x,y,level:event.level&128?difficulty:event.level});
    }
    this.complete=true;return spawned;
  }
}
