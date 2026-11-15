const word=value=>value<<16>>16;
export function receiveHit(player,damage,reaction,facing) {
  player.health=word(player.health-damage);player.reaction=reaction;player.hitFrom=facing;
  player.hitStop=6;player.hitLatch=true;player.pendingReaction=true;
}

// Player reaction handlers AC9E, ADA0, AE02, B0AA and recovery AA5E.
// Wall collision, simultaneous attack+jump escape, and lives/respawn remain open.
export function updateReaction(player,input,pressed,previous=0) {
  if(player.mode==='dead')return true;
  if(player.mode==='hurtPending') {
    if((player.y>>16)!==(player.groundY>>16))player.reaction=3;
    if(player.health<0||player.reaction===3) {
      player.mode='knockdownInit';player.action('fall');
    } else if(player.reaction===0||player.reaction===1||player.reaction===2) {
      player.mode='hurt';player.action(player.reaction!==0?'hurt1':'hurt');
    } else throw new Error(`Player reaction ${player.reaction} is not recovered`);
    return true;
  }
  if(player.mode==='hurt') {
    // The player's animation freezes during hit-stop, unlike Bred's hurt pose.
    if(player.hitStop){player.hitStop--;return true;}
    const oldEntry=player.animation.address;player.animation.tick();
    if(oldEntry!==player.animation.address)player.imageOffset=0;
    player.imageOffset=word(player.imageOffset+(player.character.hurtShake[player.animation.remaining]??0));
    if(player.animation.flags&128)player.mode='idlePending';
    return true;
  }
  if(player.mode==='knockdownInit') {
    player.facing=player.hitFrom^1;player.direction=player.hitFrom;
    player.y=(player.y+20*65536)|0;
    player.vx=(player.health<0?0x300:0x200)*(player.direction?-1:1);
    player.vy=player.health<0?0x600:0x380;player.drag=0;
    player.mode='knockdown';return true;
  }
  if(player.mode==='knockdown'||player.mode==='hurtBounce') {
    player.integrateJump();
    if((player.y>>16)<=(player.groundY>>16)) {
      player.y=player.groundY;
      if(player.mode==='knockdown') {
        player.action('down');player.mode='hurtBounce';player.vx=0x100*(player.direction?-1:1);
        player.vy=player.health<0?0x400:0x280;
      } else {
        player.mode='hurtSlide';player.vx=0x100*(player.direction?-1:1);
        player.drag=(player.health<0?16:20)*(player.direction?-1:1);
      }
    }
    player.animation.tick();return true;
  }
  if(player.mode==='hurtSlide') {
    const next=word(player.vx-player.drag);
    player.vx=(player.vx>=0)===(next>=0)?next:0;
    player.x=(player.x+player.vx*256)|0;
    if(!player.vx)player.mode=player.health<0?'dead':'recoverPending';
    player.animation.tick();return true;
  }
  if(player.mode==='recoverPending') {
    player.mode='recover';player.action('recover');return true;
  }
  if(player.mode==='recover') {
    if((!(previous&15)&&(input&15))||(pressed&0x30))player.animation.remaining=1;
    player.animation.tick();
    if(player.animation.flags&128)player.mode='idlePending';
    return true;
  }
  return false;
}
