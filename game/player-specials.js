// Simultaneous attack+jump escape: 00BDB0, 00B216 and 00B312.
export const escapePressed=(player,input,pressed)=>player.health>0&&(pressed&48)!==0&&(input&48)===48;
export function queueEscape(player) {
  player.comboCounter=0;player.comboWindow=0;player.attackActive=true;player.mode='escapePending';
}
export function updateSpecial(player) {
  if(!['escapePending','escape','escapeLanding'].includes(player.mode))return false;
  if(player.hitStop){player.hitStop--;return true;}
  if(player.mode==='escapePending') {
    if(player.previousInput&2){player.facing=1;player.direction=8;}
    if(player.previousInput&1){player.facing=0;player.direction=8;}
    player.escapeHit=false;player.action('escape');
    player.mode=player.characterIndex===2?'escapeLanding':'escape';
    if(player.characterIndex!==2){player.groundY=player.y;player.vy=player.characterIndex===0?0x600:0x700;player.vx=player.drag=0;}
    return true;
  }
  player.animation.tick();
  if(player.mode==='escape'){
    player.vy=(player.vy-0x55)<<16>>16;player.y=(player.y+player.vy*256)|0;
    if((player.y>>16)<=(player.groundY>>16)){player.y=player.groundY;player.mode='escapeLanding';player.action('landing');}
  } else if(player.animation.flags&128){
    player.mode='idlePending';player.attackActive=false;
    if(player.escapeHit)player.health=Math.max(0,player.health-8);
  }
  return true;
}
