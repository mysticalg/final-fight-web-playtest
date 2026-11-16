// Original 001F2A energy tiles, 05B54A colour bands and 005586 timer tiles.
export function energyTiles(hp,max,merged){
 hp=Math.max(0,hp);max=Math.max(0,max);const out=[];if(max&&hp>=max)max=hp;
 if(max)for(let i=0;i<18&&i*8<max;i++){
  const filled=Math.max(0,Math.min(8,hp-i*8)),length=Math.min(8,max-i*8);
  out.push(length===8?(filled===8?0x4560:filled===0?0x4568:0x4577-filled):filled>=length?0x4568-length:filled===0?0x4570-length:merged[filled*8+length]);
 }
 if(max&&(max>=144||max%8===0))out.push(0x458d);return out;
}
export function hudCommands(hud,{player,enemy,lives=3,time=30,score=0}){
 const commands=[],tile=(code,attr,x,y)=>{if(code!==0x4420)commands.push({code,attr,x,y,half:((x+64)>>3)&1});};
 function name(record,y){if(!record)return;for(let i=0;i<4;i++)tile(record[i+1],record[0],8+(i>>1)*8,y+(i&1)*8);for(let i=0;i<10;i++)tile(record[i+6],record[5],24+i*8,y);}
 name(hud.heroes[player.characterIndex],8);
 const health=energyTiles(player.health,player.character.health,hud.mergedBar);health.forEach((code,i)=>tile(code,0x181,24+i*8,16));
 // Player name palettes define the yellow bar and portrait; the energy palette is 0181.
 tile(0x443d,0x18e,56,8);tile(0x4400+Math.max(0,lives-1)%10,0x18e,64,8);
 const digits=String(Math.max(0,Math.floor(score))).padStart(1,'0').slice(-7);for(let i=0;i<digits.length;i++)tile(0x4400+Number(digits[i]),0x180,120-(digits.length-1-i)*8,8);
 for(let i=0;i<4;i++){tile(0x476c+i,0x18e,176+i*8,8);tile(0x477c+i,0x18e,176+i*8,16);}
 for(const[i,n]of String(Math.max(0,Math.min(99,time))).padStart(2,'0').split('').entries())for(let j=0;j<4;j++)tile(hud.digits[+n][j],0x186,176+i*16+(j&1)*8,24+(j>>1)*8);
 if(enemy){name(typeof enemy.character.family==='string'?hud.bosses[enemy.character.family]:hud.enemies[enemy.variant],24);const palette=hud.barPalettes[Math.min(63,Math.max(0,enemy.health)>>3)];energyTiles(enemy.health,enemy.maxHealth??enemy.character.health,hud.mergedBar).forEach((code,i)=>tile(code,palette,24+i*8,32));}
 return commands;
}
export function drawHud(context,image,hud,state){for(const c of hudCommands(hud,state)){const source=hud.glyphs[`${c.code}:${c.attr}:${c.half}`];if(!source)throw new Error(`Missing HUD tile ${c.code}/${c.attr}`);context.drawImage(image,...source,8,8,c.x,c.y,8,8);}}

