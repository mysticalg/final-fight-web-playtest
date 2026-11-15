export function queueWeapon(player){
 const weapon=player.weapon;if(!weapon)return false;
 const stab=weapon.subtype!==0||(player.characterIndex===1&&player.weaponTargetInRange?.());
 player.mode=stab?'weaponStrikePending':'weaponThrowPending';player.attackActive=true;return true;
}
export function updateWeapon(player){
 if(!player.mode.startsWith('weapon'))return false;
 if(player.mode.startsWith('weaponStrike')&&player.hitStop){player.hitStop--;return true;}
 if(player.mode==='weaponThrowPending'){
  player.mode='weaponThrow';player.weaponPhase=2;player.action('weaponThrow');player.sound(14);return true;
 }
 if(player.mode==='weaponStrikePending'){
  player.mode='weaponStrike';player.action(`weapon${player.weapon.subtype}`);player.sound(14);return true;
 }
 if(player.mode==='weaponStrike'&&!player.weapon){player.mode='idlePending';player.attackActive=false;return true;}
 player.animation.tick();
 if(player.mode==='weaponThrow'&&player.weaponPhase===2&&player.animation.flags){
  player.weaponPhase=4;if(player.weapon)player.weapon.forcedLaunch=true;player.weapon=null;
 }else if(player.animation.flags&128){player.mode='idlePending';player.attackActive=false;}
 return true;
}
export function dropWeapon(player){
 const weapon=player.weapon;if(!weapon)return;
 weapon.hitFrom=player.hitFrom;weapon.dropped=true;player.weapon=null;
}
