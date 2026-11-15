const word=n=>n<<16>>16;
// 02800A updates one surrounding position each frame, rather than clearing the
// eight samples. These flags describe scenery/objects, not other NPC occupancy.
export function updatePositionSlots(world,player){
  const index=world.frame&7,[dx,dy]=world.slots[index];
  const x=word((player.x>>16)+dx),y=word((player.groundY>>16)-(player.floorOffset??0)+dy);
  const sx=word(x-world.cameraX),sy=word(y-(world.cameraY??0));
  const response=sx<0||sx>384||sy<0||sy>256?4:world.collision.objectProbe(x,y).response;
  world.occupiedSlots??=Array(8).fill(0);world.occupiedSlots[index]=response&255;
}
