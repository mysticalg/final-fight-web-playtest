import {Player} from './player.js?v=effc370320';
import {Enemy} from './enemy.js?v=effc370320';
import {BredBrain} from './bred-brain.js?v=effc370320';
import {GameRandom} from './enemy-ai.js?v=effc370320';
import {contact,incomingContact,canGrab,canComboThrow} from './combat.js?v=effc370320';
import {GrabPair} from './grabs.js?v=effc370320';

// Bounded single-enemy encounter. Stage entry, collision maps and spawn waves
// remain separate recovery work; the stationary combat test is still available.
export class Encounter {
  constructor(data,character=0,{stationary=false,bounds=true,enemyVariant=0}={}) {
    this.data=data;this.player=new Player(data,character);
    this.enemy=new Enemy(data,this.player.x+(stationary?64:104)*65536,this.player.y,stationary?1:0,enemyVariant);
    this.stationary=stationary;this.bounds=bounds;this.hits=0;this.receivedHits=0;
    this.sounds=[];this.player.onSound=this.enemy.onSound=command=>this.sounds.push(command);
    this.world={frame:0,random:new GameRandom(0),activeAttackers:0,difficulty:4,slots:data.enemyPositionSlots};
    this.player.worldRandom=this.world.random;
    this.player.comboThrow=()=>{
      if(this.grab?.held||this.grab?.holding||!canComboThrow(this.data,this.player,this.enemy))return false;
      this.grab=new GrabPair(this.data,this.data.grabs,this.player,this.enemy,this.world.random,{comboThrow:true});return true;
    };
    if(!stationary)this.enemy.brain=new BredBrain(this.enemy);
  }
  step(input) {
    this.sounds.length=0;
    const player=this.player,enemy=this.enemy;
    const previousHealth=enemy.health;
    if(this.grab?.holding){
      this.grab.updateHolder(input);
      if(player.pendingReaction){player.startReaction();this.grab.cancelHolder();}
      if(player.invulnerable)player.invulnerable--;
    }
    else player.update(input);
    if(this.grab?.holding&&player.mode==='hurtPending')this.grab.cancelHolder();
    player.grabSuppressed=!!player.grabCooldown;
    if(player.grabCooldown)player.grabCooldown--;
    // 008C80 publishes player state flags used by enemy attack selection.
    player.airborne=(player.y>>16)!==(player.groundY>>16);
    player.evading=['knockdownInit','knockdown','hurtBounce','hurtSlide','recoverPending','recover'].includes(player.mode);
    if(!this.grab?.updateHeld()&&!this.grab?.updateThrown(this.world))enemy.update(this.world,player);
    if(enemy.health<previousHealth)this.hits++;
    // Original contact queues apply player attacks before enemy attacks. Damage
    // becomes a reaction after the next state handler (A838 / 22BC0).
    if(!this.grab?.holding&&!this.grab?.held){
      if(canGrab(this.data,player,enemy))this.grab=new GrabPair(this.data,this.data.grabs,player,enemy,this.world.random);
      else if(contact(this.data,player,enemy))this.hits++;
      if(!this.stationary&&incomingContact(this.data,enemy,player))this.receivedHits++;
    }
    if(this.bounds) {
      const camera=this.data.stage.cameraX;
      player.x=Math.max((camera+24)*65536,Math.min((camera+360)*65536,player.x));
      // Temporary floor bounds apply to grounded control states only.
      if(['idle','walkPending','walk','stopping','jumpPending','punchPending','punch','landing','idlePending'].includes(player.mode)) {
        player.y=Math.max(16*65536,Math.min(96*65536,player.y));player.groundY=player.y;
      }
    }
    this.world.frame++;
  }
}
