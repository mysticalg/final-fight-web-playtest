// Converted original recordings only. All playback and scheduling is native JS.
export class GameAudio {
  constructor(data,{contextFactory=()=>new AudioContext(),fetcher=(...args)=>fetch(...args),onState=()=>{}}={}) {
    this.data=data;this.contextFactory=contextFactory;this.fetcher=fetcher;this.onState=onState;
    this.buffers=new Map();this.enabled=false;this.paused=false;this.hidden=false;this.voices=new Set();
  }
  async load() {
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      const records=[...Object.values(this.data.effects),...Object.values(this.data.music)];
      let cursor=0;
      await Promise.all(Array.from({length:Math.min(4,records.length)},async()=>{
        while(cursor<records.length){
          const {file}=records[cursor++];if(this.buffers.has(file))continue;
          const response=await this.fetcher(file);if(!response.ok)throw new Error('Audio asset could not load');
          const buffer=await this.context.decodeAudioData(await response.arrayBuffer());this.buffers.set(file,buffer);
        }
      }));
      this.ready=true;
    })();
    try{await this.loading;}catch(error){this.loading=null;throw error;}
  }
  async enable() {
    try {
      this.context??=this.contextFactory();
      // Resume during the user's gesture, before any asynchronous fetch.
      const resume=this.context.resume();this.enabled=true;this.onState('loading');
      await Promise.all([resume,this.load()]);
      if(!this.enabled)return;
      this.restart();await this.sync();this.onState('enabled');
    }catch(error){console.warn('Audio startup failed:',error.message);this.disable();this.onState('error');}
  }
  disable() {
    this.enabled=false;this.stopVoices();this.music?.stop();this.music=null;
    if(this.context)this.context.suspend().catch(()=>{});this.onState('disabled');
  }
  stopVoices() { for(const voice of this.voices)voice.stop();this.voices.clear(); }
  restart() {
    this.stopVoices();this.music?.stop();this.music=null;
    if(!this.enabled||!this.ready)return;
    const record=this.data.music.slum,buffer=this.buffers.get(record.file);
    const source=this.context.createBufferSource();source.buffer=buffer;
    source.loop=true;source.loopStart=record.loopStart;source.loopEnd=record.loopEnd;
    source.connect(this.context.destination);source.start();this.music=source;
  }
  play(commands) {
    if(!this.enabled||!this.ready||this.paused||this.hidden)return;
    for(const command of commands){
      const record=this.data.effects[command];if(!record)continue;
      const source=this.context.createBufferSource();source.buffer=this.buffers.get(record.file);
      source.connect(this.context.destination);source.onended=()=>this.voices.delete(source);
      this.voices.add(source);source.start();
    }
  }
  async sync() {
    if(!this.context)return;
    if(this.enabled&&!this.paused&&!this.hidden)await this.context.resume();else await this.context.suspend();
  }
  setPaused(paused) { this.paused=paused;this.sync().catch(()=>{}); }
  setHidden(hidden) { this.hidden=hidden;this.sync().catch(()=>{}); }
}
