import{Enemy}from'./enemy.js?v=999b8c9aee';

// Native campaign controllers for the newly connected fighters. Animation,
// combat boxes and palettes are recovered data; decision timing is provisional.
class SubwayBrain{
 constructor(actor){this.actor=actor;this.seek();}
 release(){}
 seek(){this.state='approach';this.timer=0;this.cooldown=24;this.actor.action('neutral');}
 resumeAttack(){this.seek();}
 start(name,duration){this.state=name;this.timer=duration;this.actor.action(name);}
 update(world,target){
  const a=this.actor;if(a.hitStop){a.hitStop--;return;}
  const family=a.character.family,dx=(target.x-a.x)/65536,dy=(target.groundY-a.groundY)/65536;
  if(this.state!=='approach'){
   a.animation.tick();
   if(this.state==='charge'){
    a.x=(a.x+(a.facing?-1:1)*0x50000)|0;world.collision?.resolve(a);
   }else if(this.state==='leap'||this.state==='flip'){
    a.x=(a.x+(a.facing?-1:1)*0x28000)|0;a.vy-=0x48;a.y=(a.y+a.vy*256)|0;
    world.collision?.resolveCenterAir(a);
    if(a.y<=a.groundY){a.y=a.groundY;this.timer=1;}
   }
   if(!--this.timer||(a.animation.flags&128)){a.y=a.groundY;this.seek();this.cooldown=24+(world.random.next()&31);}return;
  }
  a.facing=dx<0?1:0;
  if(this.cooldown)this.cooldown--;
  const range=family==='sodom'?76:family===3?52:52;
  if(Math.abs(dx)<=range&&Math.abs(dy)<=9&&!this.cooldown&&target.mode!=='dead'){
   const roll=world.random.next()&7;
   if(family==='sodom')this.start(roll<4?'jab':'slash',28);
   else if(family===6){
    const action=roll<4?'jab':roll<6?'kick':'leap';this.start(action,action==='leap'?50:40);if(action==='leap')a.vy=0x500;
   }else this.start(roll<4?'jab':'strike',28);
   return;
  }
  if(family==='sodom'&&!this.cooldown&&Math.abs(dx)>120&&Math.abs(dy)<16){this.start('charge',36);return;}
  const sx=family===6?0x18000:family==='sodom'?0x14000:0xc000,sy=family===6?0x9000:0x6000;
  if(Math.abs(dx)>range-12)a.x=(a.x+Math.sign(dx)*Math.min(Math.abs(dx)*65536,sx))|0;
  if(Math.abs(dy)>3)a.y=a.groundY=(a.groundY+Math.sign(dy)*Math.min(Math.abs(dy)*65536,sy))|0;
  world.collision?.resolve(a);a.animation.tick();
 }
}

export class SubwayEnemy extends Enemy{
 constructor(data,{variant=13,x,y,direction=0,parameter=0,level=0,boss=false}={}){
  super(boss?{...data,enemies:[data.bosses.find(c=>c.family==='sodom')]}:data,x,y,direction,boss?0:variant);this.data=data;this.parameter=parameter;this.level=level;this.paletteOverride=this.character.paletteOverride??0;
  const stats=this.character.levels?.[level];if(stats){this.health=stats.health;this.defenseIndex=stats.defenseIndex;this.combat={...this.combat,damage:stats.damage};}
  this.maxHealth=this.health;this.brain=new SubwayBrain(this);this.boss=boss;this.contactsReady=true;
  if(parameter){this.mode='subwayEntry';this.entryTimer=parameter===2?45:20;this.action('entry');}
 }
 update(world,target){
  if(this.mode==='subwayEntry'){
   this.animation.tick();if(!--this.entryTimer){this.mode='neutral';this.brain.seek();}
   if(this.pendingReaction)this.startReaction();return;
  }
  if(this.stationary&&this.mode==='neutral'){if(this.pendingReaction)this.startReaction();return;}
  super.update(world,target);
  if(this.removed&&this.boss&&!this.defeated){this.defeated=true;world.stageCleared?.();}
 }
}
