// Procedural ambient soundscape generator for Edinburgh Golden Hour
// Creates realistic city hum, Scottish evening breeze, and gentle traffic rumble using Web Audio API

class CitySoundscape {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private masterGain: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private volume = 0.35;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public start() {
    if (this.isPlaying) return;
    this.initContext();
    if (!this.ctx) return;

    this.isPlaying = true;
    const now = this.ctx.currentTime;

    // Master Gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.001, now);
    this.masterGain.gain.exponentialRampToValueAtTime(this.volume, now + 1.8);
    this.masterGain.connect(this.ctx.destination);

    // 1. Distant Traffic Rumble (Brown noise approximation + low pass filter)
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const trafficFilter = this.ctx.createBiquadFilter();
    trafficFilter.type = 'lowpass';
    trafficFilter.frequency.setValueAtTime(140, now);

    const trafficGain = this.ctx.createGain();
    trafficGain.gain.setValueAtTime(0.45, now);

    whiteNoise.connect(trafficFilter);
    trafficFilter.connect(trafficGain);
    trafficGain.connect(this.masterGain);
    whiteNoise.start();
    this.nodes.push(whiteNoise, trafficFilter, trafficGain);

    // 2. Evening Breeze (Modulated Pink Noise)
    const breezeBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const breezeData = breezeBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      breezeData[i] = (b0 + b1 + b2) * 0.12;
    }

    const breezeSource = this.ctx.createBufferSource();
    breezeSource.buffer = breezeBuffer;
    breezeSource.loop = true;

    const breezeFilter = this.ctx.createBiquadFilter();
    breezeFilter.type = 'bandpass';
    breezeFilter.frequency.setValueAtTime(380, now);
    breezeFilter.Q.setValueAtTime(1.2, now);

    // Subtle LFO for wind gust breathing
    const breezeLfo = this.ctx.createOscillator();
    breezeLfo.frequency.setValueAtTime(0.18, now); // Slow 5.5s cycle
    const breezeLfoGain = this.ctx.createGain();
    breezeLfoGain.gain.setValueAtTime(120, now);
    breezeLfo.connect(breezeLfoGain);
    breezeLfoGain.connect(breezeFilter.frequency);
    breezeLfo.start();

    const breezeGain = this.ctx.createGain();
    breezeGain.gain.setValueAtTime(0.25, now);

    breezeSource.connect(breezeFilter);
    breezeFilter.connect(breezeGain);
    breezeGain.connect(this.masterGain);
    breezeSource.start();
    this.nodes.push(breezeSource, breezeFilter, breezeLfo, breezeLfoGain, breezeGain);

    // 3. Low Sub-harmonic city pulse (48Hz gentle hum)
    const humOsc = this.ctx.createOscillator();
    humOsc.type = 'sine';
    humOsc.frequency.setValueAtTime(52, now);

    const humGain = this.ctx.createGain();
    humGain.gain.setValueAtTime(0.08, now);

    humOsc.connect(humGain);
    humGain.connect(this.masterGain);
    humOsc.start();
    this.nodes.push(humOsc, humGain);
  }

  public stop() {
    if (!this.isPlaying || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
    this.masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    setTimeout(() => {
      this.nodes.forEach((n) => {
        try {
          if ('stop' in n) (n as any).stop();
          n.disconnect();
        } catch {
          // ignore
        }
      });
      this.nodes = [];
      this.isPlaying = false;
    }, 900);
  }

  public chimeClock() {
    this.initContext();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const bellGain = this.ctx.createGain();
    bellGain.gain.setValueAtTime(0.3 * this.volume, now);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    bellGain.connect(this.ctx.destination);

    // Fundamental and chime overtones
    [432, 864, 1296].forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.connect(bellGain);
      osc.start(now);
      osc.stop(now + 3.2);
    });
  }

  public setVolume(val: number) {
    this.volume = Math.max(0, Math.min(1, val));
    if (this.masterGain && this.ctx && this.isPlaying) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  public getIsPlaying() {
    return this.isPlaying;
  }
}

export const cityAudio = new CitySoundscape();
