// Source: 00328A–003346, 0078F4–007944, 00799A–0079C4.
const word = value => (value << 16) >> 16;
export function resolveBoxes(actor,image) {
  const table=actor.combat;
  let attack=null,hurt=null;
  if(image.attackIndex && (!(image.attackIndex&128) || (actor.y>>16)===(actor.groundY>>16))) {
    const box=table.attacks[image.attackIndex&127];
    if(box)attack={...box,x:word((actor.x>>16)+(actor.facing?-box.x:box.x)),y:word((actor.y>>16)+box.y)};
  }
  if(!actor.invulnerable && image.hurtIndex) {
    const box=table.hurts[image.hurtIndex];
    if(box)hurt={...box,x:word((actor.x>>16)+(actor.facing?-box.x:box.x)),y:word((actor.y>>16)+box.y)};
  }
  return {attack,hurt};
}
export function boxesOverlap(attack,hurt) {
  if(!attack||!hurt)return false;
  const rx=(attack.rx+hurt.rx)&65535,ry=(attack.ry+hurt.ry)&65535;
  // The original compares the wrapped word sums as unsigned, inclusively.
  return ((hurt.x-attack.x+rx)&65535)<=((rx*2)&65535)
    && ((hurt.y-attack.y+ry)&65535)<=((ry*2)&65535);
}
export function attackDamage(combat,attack,defenseIndex=0) {
  const base=combat.damage[attack.damageIndex];
  if(base===undefined)throw new Error('Unrecovered damage selector');
  return defenseIndex ? combat.defense[base]?.[defenseIndex] : base;
}
export function contact(data,player,enemy,{queued=false}={}) {
  const image=data.images[player.animation.image];
  if(!queued&&!image.attackIndex)enemy.hitLatch=false;
  if(image.attackIndex&128)return false;
  if(!queued&&!['punch','airborne','wallAir','wallClingPending','escapePending','escape','escapeLanding'].includes(player.mode))return false;
  if((!queued&&enemy.hitLatch)||enemy.health<0)return false;
  // 0033EE / 008D32: ordinary player attack queue, including asymmetric depth.
  const dx=((enemy.x>>16)-(player.x>>16)+128)&65535;
  const depth=word((enemy.groundY>>16)-(player.groundY>>16));
  const special=player.mode.startsWith('escape');
  if(dx>256||depth < (special?-24:-12)||depth > (special?24:9))return false;
  const attack=resolveBoxes(player,image).attack;
  const hurt=resolveBoxes(enemy,data.images[enemy.animation.image]).hurt;
  if(!boxesOverlap(attack,hurt))return false;
  // 007330: latch, damage, orientation and six-frame attacker/victim hit-stop.
  const hitFrom=special?(((player.x>>16)&65535)>((enemy.x>>16)&65535)?1:0):player.facing;
  enemy.hit(attackDamage(player.combat,attack,enemy.defenseIndex),attack.reaction,hitFrom);
  player.sound?.(attack.sound);
  player.hitStop=6;
  player.comboWindow=45;
  if(special)player.escapeHit=true;
  return true;
}
export function canGrab(data,player,enemy) {
  const image=data.images[player.animation.image];
  if(!(image.attackIndex&128)||player.grabSuppressed||player.mode==='dead'||enemy.health<0||enemy.pendingReaction)return false;
  if((player.y>>16)!==(player.groundY>>16)||(enemy.y>>16)!==(enemy.groundY>>16))return false;
  const dx=((enemy.x>>16)-(player.x>>16)+128)&65535,depth=word((enemy.groundY>>16)-(player.groundY>>16));
  const special=player.mode.startsWith('escape');
  if(dx>256||depth < (special?-24:-12)||depth > (special?24:9))return false;
  return boxesOverlap(resolveBoxes(player,image).attack,resolveBoxes(enemy,data.images[enemy.animation.image]).hurt);
}
export function canComboThrow(data,player,enemy) {
  if(enemy.health<0||(enemy.y>>16)!==(enemy.groundY>>16)||['heldPending','held','thrownPending','thrown','thrownBounce','thrownSlide'].includes(enemy.mode))return false;
  if(!resolveBoxes(enemy,data.images[enemy.animation.image]).hurt)return false;
  const depth=word((enemy.groundY>>16)-(player.groundY>>16));
  if(depth < -12||depth > 9)return false;
  const dx=((player.x>>16)-(enemy.x>>16))&65535;
  return player.facing?dx<128:dx>0xff80;
}
export function incomingContact(data,enemy,player,{queued=false}={}) {
  const image=data.images[enemy.animation.image];
  if(!queued&&!image.attackIndex)player.hitLatch=false;
  if((!queued&&player.hitLatch)||player.mode==='dead')return false;
  const dx=((enemy.x>>16)-(player.x>>16)+128)&65535;
  const depth=word((enemy.groundY>>16)-(player.groundY>>16));
  if(dx>256||depth < -12||depth > 9)return false;
  const attack=resolveBoxes(enemy,image).attack;
  const hurt=resolveBoxes(player,data.images[player.animation.image]).hurt;
  if(!boxesOverlap(attack,hurt))return false;
  // 007526 / 007592 uses 0079C6 (base damage, without defense adjustment).
  player.hit(attackDamage(enemy.combat,attack),attack.reaction,enemy.facing);
  player.hitAttacker=enemy;
  enemy.sound?.(attack.sound);
  enemy.hitStop=6;
  return true;
}
