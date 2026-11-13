function Audience() {
  const [name, setName] = useState(() => { try { return localStorage.getItem('bh-name') || ''; } catch (e) { return ''; } });
  const [joined, setJoined] = useState(false);
  const [online, setOnline] = useState(false);
  const [st, setSt] = useState({ pos: 0, live: false, host: false });
  const [stream, setStream] = useState(null);
  const [msg, setMsg] = useState('');
  const ws = useRef(null), pc = useRef(null), mic = useRef(null), nm = useRef('');
  const level = useLevel(stream);
  const secs = useTimer(st.live);
  const send = m => ws.current && ws.current.readyState === 1 && ws.current.send(JSON.stringify(m));

  function stopMic() {
    if (mic.current) mic.current.getTracks().forEach(t => t.stop());
    mic.current = null; setStream(null);
    if (pc.current) pc.current.close();
    pc.current = null;
  }

  // The host picked us: open the phone's microphone and stream it to the host laptop.
  async function goLive() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mic.current = s; setStream(s);
      const p = new RTCPeerConnection({ iceServers: ICE }); pc.current = p;
      s.getTracks().forEach(t => p.addTrack(t, s));
      p.onicecandidate = e => e.candidate && send({ type: 'ice', candidate: e.candidate });
      await p.setLocalDescription(await p.createOffer());
      send({ type: 'offer', sdp: p.localDescription });
    } catch (err) {
      setMsg('Microphone blocked. Allow mic access for this site in your browser, then raise your hand again.');
      send({ type: 'done' });
    }
  }

  function connect() {
    const s = new WebSocket(WS_URL); ws.current = s;
    s.onopen = () => { setOnline(true); s.send(JSON.stringify({ type: 'join', name: nm.current })); };
    s.onclose = () => {
      setOnline(false); stopMic(); setSt(x => ({ ...x, live: false, pos: 0 }));
      setTimeout(() => { if (ws.current === s) connect(); }, 2000);
    };
    s.onmessage = async e => {
      const m = JSON.parse(e.data);
      if (m.type === 'state') { setSt(m); if (!m.live && mic.current) stopMic(); }
      if (m.type === 'grant') { setMsg(''); await goLive(); }
      if (m.type === 'revoke') { if (mic.current) setMsg('Your turn is over. Thanks for speaking.'); stopMic(); }
      if (m.type === 'answer' && pc.current) await pc.current.setRemoteDescription(m.sdp);
      if (m.type === 'ice' && pc.current) { try { await pc.current.addIceCandidate(m.candidate); } catch (e) {} }
    };
  }

  function join(e) {
    e.preventDefault();
    const n = name.trim() || 'Guest';
    nm.current = n;
    try { localStorage.setItem('bh-name', n); } catch (e) {}
    setJoined(true); connect();
  }

  if (!joined) {
    return (
      <main className="join-screen">
        <Logo />
        <h1>Speak from your seat</h1>
        <p className="lead">Join the room and your phone becomes a microphone. When the host picks you, everyone in the hall hears you.</p>
        <form onSubmit={join}>
          <label>Your name
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Priya" maxLength="30" autoComplete="given-name" />
          </label>
          <button className="btn" style={{ width: '100%', padding: '1rem' }}>Join the room</button>
        </form>
        {!window.isSecureContext &&
          <p className="note warn">This page is not on HTTPS, so the browser will block your microphone. Ask the host for the secure link.</p>}
      </main>
    );
  }

  const live = st.live, waiting = st.pos > 0;
  return (
    <main>
      <div className="top">
        <Logo />
        <span className={'pill ' + (!online ? 'off' : st.host ? 'ok' : '')}>
          {!online ? 'Reconnecting' : st.host ? 'Connected' : 'Waiting for host'}
        </span>
      </div>

      <section className="center">
        <div className={'disc ' + (live ? 'live' : waiting ? 'wait' : '')} style={{ '--lvl': level }}>
          {live ? <MicIcon /> : <HandIcon />}
        </div>
        <h2>{live ? 'You are on air' : waiting ? `You are number ${st.pos} in line` : 'Want to speak?'}</h2>
        {live ? <>
          <span className="timer">{fmt(secs)}</span>
          <p>Hold the phone close and speak clearly. The host can end your turn at any time.</p>
          <Meter level={level} bars={24} />
        </> : <p>{waiting
          ? 'Keep this page open. Your microphone turns on when the host picks you.'
          : 'Raise your hand and the host will see your name in the queue.'}</p>}
        {msg && <p className={'note ' + (msg.startsWith('Microphone') ? 'err' : '')}>{msg}</p>}
      </section>

      <div className="foot">
        {live && <button className="btn danger" onClick={() => { send({ type: 'done' }); stopMic(); setMsg('Mic off. Thanks for speaking.'); }}>Finish speaking</button>}
        {!live && waiting && <button className="btn ghost" onClick={() => send({ type: 'lower' })}>Lower hand</button>}
        {!live && !waiting && <button className="btn" disabled={!online || !st.host} onClick={() => { setMsg(''); send({ type: 'hand' }); }}>Raise hand</button>}
        {!live && !waiting && online && !st.host && <p className="empty" style={{ textAlign: 'center' }}>The host has not opened the console yet.</p>}
      </div>
    </main>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Audience />);