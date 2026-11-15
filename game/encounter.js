import {Player} from './player.js?v=1bb9bc2b0d';
import {Enemy} from './enemy.js?v=1bb9bc2b0d';
import {BredBrain} from './bred-brain.js?v=1bb9bc2b0d';
import {GameRandom} from './enemy-ai.js?v=1bb9bc2b0d';
import {contact,incomingContact} from './combat.js?v=1bb9bc2b0d';

// Bounded single-enemy encounter. Stage entry, collision maps and spawn waves
// remain separate recovery work; the stationary combat test is still available.
export class Encounter {
  constructor(data,character=0,{stationary=false,bounds=true}={}) {
    this.data=data;this.player=new Player(data,character);
    this.enemy=new Enemy(data,this.player.x+(stationary?64:104)*65536,this.player.y,stationary?1:0);
    this.stationary=stationary;this.bounds=bounds;this.hits=0;this.receivedHits=0;
    this.world={frame:0,random:new GameRandom(0),activeAttackers:0,difficulty:4,slots:data.enemyPositionSlots};
    if(!stationary)this.enemy.brain=new BredBrain(this.enemy);
  }
  step(input) {
    const player=this.player,enemy=this.enemy;
    player.update(input);
    // 008C80 publishes player state flags used by enemy attack selection.
    player.airborne=(player.y>>16)!==(player.groundY>>16);
    player.evading=['walk','stopping','knockdownInit','knockdown','hurtBounce','hurtSlide','recoverPending','recover'].includes(player.mode);
    enemy.update(this.world,player);
    // Original contact queues apply player attacks before enemy attacks. Damage
    // becomes a reaction after the next state handler (A838 / 22BC0).
    if(contact(this.data,player,enemy))this.hits++;
    if(!this.stationary&&incomingContact(this.data,enemy,player))this.receivedHits++;
    if(this.bounds) {
      const camera=this.data.stage.cameraX;
      player.x=Math.max((camera+24)*65536,Math.min((camera+360)*65536,player.x));
      // Temporary floor bounds apply to grounded control states only.
      if(['idle','walk','stopping','punchPending','punch','landing','idlePending'].includes(player.mode)) {
        player.y=Math.max(16*65536,Math.min(96*65536,player.y));player.groundY=player.y;
      }
    }
    this.world.frame++;
  }
}
