// Standard browser Gamepad mapping. Produces the original CPS input bits.
export const GAMEPAD_DEAD_ZONE = 0.35;
const pressed = (pad,index) => Boolean(pad.buttons?.[index]?.pressed || pad.buttons?.[index]?.value > 0.5);

export function readGamepad(pad,previous = null) {
  if (!pad || pad.connected === false) return {input:0,actions:[],state:null,connected:false};
  const identity = `${pad.index}:${pad.id}`;
  const buttons = Array.from({length:Math.max(16,pad.buttons?.length ?? 0)},(_,index) => pressed(pad,index));
  const heldBefore = previous?.identity === identity ? previous.buttons : buttons;
  const actions = [];
  for (const [index,action] of [[4,'previousCharacter'],[5,'nextCharacter'],[8,'reset'],[9,'pause']]) {
    if (buttons[index] && !heldBefore[index]) actions.push(action);
  }
  let input = 0;
  if ((pad.axes?.[0] ?? 0) > GAMEPAD_DEAD_ZONE || buttons[15]) input |= 1;
  if ((pad.axes?.[0] ?? 0) < -GAMEPAD_DEAD_ZONE || buttons[14]) input |= 2;
  if ((pad.axes?.[1] ?? 0) > GAMEPAD_DEAD_ZONE || buttons[13]) input |= 4;
  if ((pad.axes?.[1] ?? 0) < -GAMEPAD_DEAD_ZONE || buttons[12]) input |= 8;
  if (buttons[0]) input |= 16;
  if (buttons[1]) input |= 32;
  return {input,actions,state:{identity,buttons},connected:true,standard:pad.mapping === 'standard'};
}
