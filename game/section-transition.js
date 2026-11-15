// Slum doorway actor motion, including the original pauses and animation steps.
export class SectionTransition {
  constructor(kind){this.kind=kind;this.state=0;this.timer=0;}
  walk(p){const motion=p.character.sectionMotion;p.x=(p.x+motion.vx*256)|0;p.y=(p.y+motion.vy*256)|0;p.animation.tick();}
  update(p,context){
    if(this.complete)return;
    const x=()=>p.x>>16;
    if(this.kind==='exitApproach'){
      if(this.state===0){
        p.action('idle');p.attackActive=false;this.timer=80;this.state=2;
        if(p.weapon){const w=p.weapon;w.hitFrom=p.facing^1;w.dropped=true;p.weapon=null;context.awardScore?.([16,7,18][w.subtype]);}return;
      }
      if(this.state===2){if(!--this.timer)this.state=4;return;}
      if(this.state===4){p.facing=0;this.state=6;return;}
      if(this.state===6){p.action('sectionWalk');this.state=8;return;}
      p.animation.tick();const motion=p.character.sectionMotion,[tx,ty]=context.exitTarget;
      const dx=tx-x()+3,dy=ty-(p.y>>16)+3;
      if((dx&65535)>=6){p.facing=dx<0?1:0;p.x=(p.x+motion.vx*256*(dx<0?-1:1))|0;}
      if((dy&65535)>=6){p.y=(p.y+motion.approachY*256*(dy<0?-1:1))|0;p.groundY=p.y;}
      if(Math.abs(x()-tx)<=3&&Math.abs((p.groundY>>16)-ty)<=3){this.kind=context.section===0?'streetExit':'roomExit';this.state=0;}
      return;
    }
    if(this.kind==='streetExit'){
      if(this.state===0){context.flags[3]=1;p.facing=0;p.direction=8;this.target=x()+80;this.state=2;return;}
      if(this.state===2){this.walk(p);if(x()>=this.target){this.target=x()+80;this.state=4;p.action('sectionExit');}return;}
      p.animation.tick();const[dx,dy]=p.character.sectionMotion.exitSteps[p.animation.flags];p.x=(p.x+dx*65536)|0;p.y=(p.y-dy*65536)|0;
      if(x()>=this.target){this.state=0;this.complete=true;}return;
    }
    if(this.kind==='roomEntry'){
      if(this.state===0){
        const[dx,dy]=context.entryOffset;p.x=(context.camera.x+dx)*65536;p.y=p.groundY=(context.camera.y+dy)*65536;
        p.direction=8;p.facing=0;this.state=2;this.timer=60;p.action('punch');return;
      }
      if(this.state===2){
        if(this.timer){if(!--this.timer){p.x=(p.x+32*65536)|0;context.flags[0]=1;context.breakDoor?.(p);p.sound(23);}return;}
        p.animation.tick();if(p.animation.flags){this.timer=16;this.state=4;}return;
      }
      if(this.state===4){
        if(this.timer){this.timer--;return;}p.animation.tick();
        if(p.animation.flags&128){this.target=x()+144;this.state=6;p.action('sectionWalk');}return;
      }
      p.animation.tick();const motion=p.character.sectionMotion;p.x=(p.x+motion.vx*256)|0;p.y=(p.y+motion.vy*256)|0;
      if(x()>=this.target){context.flags[4]=1;this.state=0;this.complete=true;p.mode='idlePending';}
      return;
    }
    if(this.kind==='roomExit'){
      if(this.state===0){context.flags[5]=1;p.facing=0;p.direction=8;p.action('sectionDoorStrike');this.state=2;return;}
      if(this.state===2){p.animation.tick();if(p.animation.flags){context.flags[1]=1;this.timer=16;this.state=4;context.breakDoor?.(p,'roomExit');p.sound(23);}return;}
      if(this.timer){if(!--this.timer){p.facing=0;p.direction=8;this.target=x()+96;p.action('sectionWalk');}return;}
      this.walk(p);if(x()>=this.target){this.complete=true;this.state=0;}return;
    }
    if(this.kind==='roofEntry'){
      if(this.state===0){const[dx,dy]=context.entryOffset;p.x=(context.camera.x+dx)*65536;p.y=(context.camera.y+dy)*65536;p.groundY=0;p.facing=0;p.direction=8;this.timer=8;this.target=x()+64;p.action('sectionExit');this.state=2;return;}
      if(this.state===2){if(!--this.timer)this.state=4;return;}
      if(this.state===4){p.animation.tick();const[dx,dy]=p.character.sectionMotion.entrySteps[p.animation.flags];p.x=(p.x+dx*65536)|0;p.y=(p.y+dy*65536)|0;
        if(x()>=this.target){this.state=6;this.target=x()+112;p.groundY=p.y;}return;
      }
      p.animation.tick();const motion=p.character.sectionMotion;p.x=(p.x+motion.vx*256)|0;p.y=(p.y+motion.vy*256)|0;
      if(x()>=this.target){context.flags[6]=1;this.complete=true;this.state=0;p.mode='idlePending';}
    }
  }
}
