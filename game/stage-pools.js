// The source allocates from the end of each free-record stack and returns
// released records to its head. Slot order also determines actor phase/order.
export class ActorPool{
  constructor(capacity){this.slots=Array(capacity).fill(null);this.free=Array.from({length:capacity},(_,i)=>i);}
  allocate(actor={}){const slot=this.free.pop();if(slot===undefined)return null;this.slots[slot]=actor;actor.slot=slot;return slot;}
  release(slot){if(!this.slots[slot])return;this.slots[slot]=null;this.free.push(slot);}
}
export class EnemyLimits{
  constructor(tables){this.tables=tables;this.counts=Array(5).fill(0);}
  accept(family,difficulty){
    if(family>=7)return true;
    const index=family<3?0:family-2,limit=family<3?this.tables.shared[difficulty]:this.tables.families[family-3][difficulty];
    if(this.counts[index]>=limit)return false;
    this.counts[index]=(this.counts[index]+1)&255;return true;
  }
  release(family){if(family<7){const index=family<3?0:family-2;this.counts[index]=(this.counts[index]-1)&255;}}
}
