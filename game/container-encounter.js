import{Player}from'./player.js?v=b63cce8c3d';
import{Prop}from'./prop.js?v=b63cce8c3d';
import{Pickup,collectPickup}from'./pickup.js?v=b63cce8c3d';
import{CollisionGrid}from'./collision.js?v=b63cce8c3d';
import{GameRandom}from'./enemy-ai.js?v=b63cce8c3d';
import{contact}from'./combat.js?v=b63cce8c3d';

// Bounded object practice while stage entry and scripted waves are recovered.
export class ContainerEncounter{
  constructor(data,character=0){
    this.data=data;this.player=new Player(data,character);this.sounds=[];this.hits=this.receivedHits=this.collected=0;this.scoreEvents=[];
    this.props=[new Prop(data,{subtype:1,x:300*65536,y:44*65536,parameter:0}),new Prop(data,{subtype:5,x:402*65536,y:44*65536,parameter:20})];
    this.items=[];this.world={frame:0,cameraX:data.stage.cameraX,cameraY:data.stage.cameraY,random:new GameRandom(0),pressedInput:0};
    this.world.collision=new CollisionGrid(data.collision,data.stage.cameraX,{obstacles:this.props});
    this.world.awardScore=(index,owner)=>this.scoreEvents.push({index,owner});
    this.world.dropItem=event=>{if(event.type!==18)throw new Error('Weapon drops require the stage weapon pool');this.items.push(new Pickup(data,event));};
    this.player.collision=this.world.collision;this.player.worldRandom=this.world.random;this.player.onSound=command=>this.sounds.push(command);
    this.player.tryPickup=()=>{const item=collectPickup(this.player,this.items,this.world.awardScore);if(item)this.collected++;return item;};
    for(const prop of this.props)prop.onSound=command=>this.sounds.push(command);
  }
  get actors(){return[...this.props,...this.items];}
  step(input){
    this.sounds.length=0;const p=this.player,w=this.world;w.pressedInput=input&~p.previousInput;p.update(input);
    for(const prop of this.props){prop.update(w);if(prop.solid&&contact(this.data,p,prop))this.hits++;}
    for(const item of this.items)item.update(w);
    p.x=Math.max((w.cameraX+24)*65536,Math.min((w.cameraX+360)*65536,p.x));w.frame++;
  }
}
