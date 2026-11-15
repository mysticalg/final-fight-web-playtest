// Native translation of 003AE2–003B3A. Exported records retain ROM addresses.
export class Animation {
  constructor(entries, address) { this.entries = entries; this.set(address); }
  set(address) {
    for (let guard = 0; guard < 8; guard++) {
      const entry = this.entries[address];
      if (!entry) throw new Error(`Animation entry not recovered: ${address.toString(16)}`);
      if (entry.loop !== undefined) { address = entry.loop; continue; }
      this.address = address;
      this.remaining = entry.ticks;
      this.image = entry.image;
      this.flags = entry.flags;
      return;
    }
    throw new Error('Animation contains a loop without a frame');
  }
  tick() {
    this.remaining = (this.remaining - 1) & 255;
    if (this.remaining === 0) this.set(this.entries[this.address].next);
  }
}
