function drawQR(el, text, size) {
  if (!el) return;
  el.innerHTML = '';
  try { new QRCode(el, { text, width: size, height: size, colorDark: '#141B2D', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M }); } catch (e) {}
}

function Admin() {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState('');
  const [roster, setRoster] = useState({ live: null, users: [] });
  const [streams, setStreams] = useState({});
  const [url, setUrl] = useState(location.origin + '/');
  const [proj, setProj] = useState(false);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [sinks, setSinks] = useState([]);
  const [sink, setSink] = useState('');
  const ws = useRef(null), pcs = useRef({}), els = useRef({}), vr = useRef({ vol: 1, muted: false, sink: '' });
  const qr = useRef(null), qrBig = useRef(null);

  const liveUser = roster.users.find(u => u.id === roster.live);
  const liveStream = liveUser ? streams[liveUser.id] : null;
  const level = useLevel(liveStream);
  const secs = useTimer(roster.live);
  const queue = roster.users.filter(u => u.hand).sort((a, b) => a.hand - b.hand);
  const room = roster.users.filter(u => !u.hand && u.id !== roster.live);

  const send = m => ws.current && ws.current.readyState === 1 && ws.current.send(JSON.stringify(m));

  useEffect(() => {
    vr.current = { vol, muted, sink };
    Object.values(els.current).forEach(el => {
      el.volume = vol; el.muted = muted;
      if (sink && el.setSinkId) el.setSinkId(sink).catch(() => {});
    });
  }, [vol, muted, sink]);

  useEffect(() => { if (authed) drawQR(qr.current, url, 196); }, [authed, url]);
  useEffect(() => { if (proj) drawQR(qrBig.current, url, 320); }, [proj, url]);
  useEffect(() => {
    if (!authed || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then(d => setSinks(d.filter(x => x.kind === 'audiooutput'))).catch(() => {});
  }, [authed]);

  function drop(id) {
    if (pcs.current[id]) pcs.current[id].close();
    delete pcs.current[id];
    if (els.current[id]) els.current[id].remove();
    delete els.current[id];
    setStreams(s => { const n = { ...s }; delete n[id]; return n; });
  }

  // A phone is streaming its mic: answer the call and play the sound through this laptop's speakers.
  async function onOffer(m) {
    drop(m.from);
    const p = new RTCPeerConnection({ iceServers: ICE });
    pcs.current[m.from] = p;
    p.ontrack = ev => {
      const stream = ev.streams[0];
      const el = document.createElement('audio');
      el.autoplay = true; el.srcObject = stream;
      el.volume = vr.current.vol; el.muted = vr.current.muted;
      if (vr.current.sink && el.setSinkId) el.setSinkId(vr.current.sink).catch(() => {});
      document.body.appendChild(el); els.current[m.from] = el;
      el.play().catch(() => {});
      setStreams(s => ({ ...s, [m.from]: stream }));
    };
    p.onicecandidate = ev => ev.candidate && send({ type: 'ice', to: m.from, candidate: ev.candidate });
    await p.setRemoteDescription(m.sdp);
    await p.setLocalDescription(await p.createAnswer());
    send({ type: 'answer', to: m.from, sdp: p.localDescription });
  }

  function login(e) {
    e.preventDefault();
    // This click also unlocks audio playback in the browser.
    try { new (window.AudioContext || window.webkitAudioContext)().resume(); } catch (x) {}
    const s = new WebSocket(WS_URL); ws.current = s;
    s.onopen = () => s.send(JSON.stringify({ type: 'admin', pin }));
    s.onclose = () => { setAuthed(false); setErr('Connection lost. Enter the PIN to reconnect.'); };
    s.onmessage = async ev => {
      const m = JSON.parse(ev.data);
      if (m.type === 'denied') setErr('Wrong PIN. Try again.');
      if (m.type === 'admin-ok') { setAuthed(true); setErr(''); }
      if (m.type === 'roster') {
        setRoster(m);
        Object.keys(pcs.current).forEach(id => { if (Number(id) !== m.live) drop(id); });
      }
      if (m.type === 'offer') await onOffer(m);
      if (m.type === 'ice' && pcs.current[m.from]) { try { await pcs.current[m.from].addIceCandidate(m.candidate); } catch (x) {} }
      if (m.type === 'done') drop(m.from);
    };
  }

  if (!authed) {
    return (
      <main className="login">
        <Logo />
        <h1>Host console</h1>
        <p className="lead">Open this on the laptop that is connected to the hall speakers.</p>
        <form onSubmit={login}>
          <label>Host PIN
            <input type="password" value={pin} onChange={e => setPin(e.target.value)} autoFocus inputMode="numeric" />
          </label>
          <button className="btn" style={{ width: '100%', padding: '1rem' }}>Open console</button>
        </form>
        {err && <p className="note err">{err}</p>}
      </main>
    );
  }

  const connecting = liveUser && !liveStream;
  return (
    <div>
      <header className="bar">
        <Logo />
        <div className="tools">
          <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>Speaker volume
            <input type="range" min="0" max="1" step="0.05" value={vol} onChange={e => setVol(Number(e.target.value))} style={{ margin: 0 }} />
          </label>
          {sinks.length > 1 && <select value={sink} onChange={e => setSink(e.target.value)} aria-label="Speaker output">
            <option value="">Default output</option>
            {sinks.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || 'Output ' + (i + 1)}</option>)}
          </select>}
          <button className={'btn sm ' + (muted ? 'danger' : 'ghost')} onClick={() => setMuted(!muted)}>{muted ? 'Speakers muted' : 'Mute speakers'}</button>
        </div>
      </header>

      <div className="layout">
        <div className="col">
          <section className={'panel stage ' + (liveUser ? 'live' : '')}>
            <span className="tag">{liveUser ? (connecting ? 'Connecting' : 'On air') : 'Stage is quiet'}</span>
            <h1>{liveUser ? liveUser.name : 'Nobody is speaking'}</h1>
            <Meter level={level} />
            <div className="row">
              <span className="timer">{liveUser ? fmt(secs) : ''}</span>
              {liveUser && <button className="btn danger sm" onClick={() => send({ type: 'revoke', to: liveUser.id })}>Take mic back</button>}
              <button className="btn ghost sm" onClick={() => send({ type: 'endall' })}>End all and clear queue</button>
            </div>
          </section>

          <section className="panel">
            <h3>Hands up <span>{queue.length} waiting</span></h3>
            {queue.length === 0 ? <p className="empty">No hands raised yet.</p> :
              <ul className="list">{queue.map((u, i) =>
                <li key={u.id}><span className="no">{i + 1}</span><span className="nm">{u.name}</span>
                  <button className="btn sm" onClick={() => send({ type: 'grant', to: u.id })}>Give mic</button></li>)}
              </ul>}
          </section>

          <section className="panel">
            <h3>In the room <span>{roster.users.length} connected</span></h3>
            {room.length === 0 ? <p className="empty">Nobody else is here. Show the QR code to the audience.</p> :
              <ul className="list">{room.map(u =>
                <li key={u.id}><span className="nm">{u.name}</span>
                  <button className="btn ghost sm" onClick={() => send({ type: 'grant', to: u.id })}>Give mic</button></li>)}
              </ul>}
          </section>
        </div>

        <div className="col">
          <aside className="panel">
            <h3>Join the room</h3>
            <div className="qr" ref={qr}></div>
            <label>Public link for the QR code
              <input type="url" value={url} onChange={e => setUrl(e.target.value)} />
            </label>
            {!url.startsWith('https://') && <p className="note warn" style={{ marginBottom: '.9rem' }}>Phones only allow the microphone on HTTPS pages. Run <b>npx ngrok http 3000</b>, then paste the https link it gives you here.</p>}
            <button className="btn sm" onClick={() => setProj(true)}>Show on projector</button>
          </aside>
        </div>
      </div>

      {proj && <div className="proj">
        <h1>Scan to speak from your seat</h1>
        <div className="qr" ref={qrBig}></div>
        <p>{url}</p>
        <button className="btn ghost sm" style={{ color: '#fff' }} onClick={() => setProj(false)}>Close</button>
      </div>}
    </div>
  );
}
ReactDOM.createRoot(document.getElementById('root')).render(<Admin />);