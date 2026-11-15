// Standing progression: BBFA / BE08. Contact opens the original 45-frame
// continuation window; BA3A freezes that window while an attack is active.
export function queueStanding(player) {
  player.comboCounter=player.comboWindow?(player.comboCounter+2)&65535:0;
  player.comboWindow=0;
  if(player.comboCounter>2*(player.character.combo.length-1))player.comboCounter=0;
  player.punchStage=player.comboCounter>>1;
  player.attackActive=true;player.mode='punchPending';
}
export function standingUpdate(player,input,pressed) {
  if(player.mode==='punchPending') {
    // BF58 gives right input precedence when both horizontal bits are held.
    if(input&2){player.facing=1;player.direction=8;}
    if(input&1){player.facing=0;player.direction=8;}
    player.mode='punch';player.animation.set(player.character.combo[player.punchStage??0]);player.imageOffset=0;
    return;
  }
  const flags=player.animation.flags;
  if(flags&128) {
    player.attackActive=false;player.mode='idlePending';
    if(pressed&32)player.mode='jumpPending';
    if(pressed&16)queueStanding(player);
    return;
  }
  if(flags&&(pressed&16))queueStanding(player);
  player.animation.tick();
}

// BB52: one ordinary and one downward attack per jump. A backward-moving
// ordinary kick is rejected; downward attacks have a separate backward root.
export function airAttack(player,input,pressed) {
  if(!(pressed&16))return;
  if(input&4) {
    if(player.airDownUsed)return;
    player.airDownUsed=true;
    const backwards=player.vx&&((player.vx<0)!==!!player.facing);
    player.action(backwards?'airDownBackward':'airDown');return;
  }
  if(player.vx&&((player.vx<0)!==!!player.facing))return;
  if(player.airAttackUsed)return;
  player.airAttackUsed=true;player.action(player.vx?'airForward':'airStanding');
}
