// Shared helpers (loaded before the page scripts)
var { useState, useEffect, useRef } = React;
var WS_URL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host;
var ICE = [{ urls: 'stun:stun.l.google.com:19302' }];

function fmt(s) { return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

// Counts seconds while `key` is truthy; restarts when it changes.
function useTimer(key) {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    if (!key) return;
    const t = setInterval(() => setS(x => x + 1), 1000);
    return () => clearInterval(t);
  }, [key]);
  return s;
}

// Live loudness (0..1) of an audio stream, used for the meters and the glowing ring.
function useLevel(stream) {
  const [lvl, setLvl] = useState(0);
  useEffect(() => {
    if (!stream) { setLvl(0); return; }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser(); an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let raf;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) { const d = (v - 128) / 128; sum += d * d; }
      setLvl(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { cancelAnimationFrame(raf); ctx.close(); };
  }, [stream]);
  return lvl;
}

function Meter({ level, bars = 32 }) {
  return (
    <div className="meter" aria-hidden="true">
      {Array.from({ length: bars }, (_, i) => (
        <i key={i} className={(i + 1) / bars <= level ? 'on' : ''}
           style={{ height: (30 + Math.abs(Math.sin(i * 1.7)) * 70) + '%' }} />
      ))}
    </div>
  );
}

function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <circle cx="16" cy="16" r="3" fill="currentColor" stroke="none" />
        <path d="M9.5 9.5a9 9 0 0 0 0 13M22.5 9.5a9 9 0 0 1 0 13" />
        <path d="M5 5a15 15 0 0 0 0 22M27 5a15 15 0 0 1 0 22" opacity=".45" />
      </svg>
      BeHeard
    </span>
  );
}

function MicIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>);
}
function HandIcon() {
  return (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.8 15a1.6 1.6 0 0 1 2.5-2L8 15" /></svg>);
}