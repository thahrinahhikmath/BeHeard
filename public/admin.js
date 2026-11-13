var { useState, useEffect, useRef } = React;
var WS_URL = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;
var ICE = [{ urls: "stun:stun.l.google.com:19302" }];
function fmt(s) {
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
function useTimer(key) {
  const [s, setS] = useState(0);
  useEffect(() => {
    setS(0);
    if (!key) return;
    const t = setInterval(() => setS((x) => x + 1), 1e3);
    return () => clearInterval(t);
  }, [key]);
  return s;
}
function useLevel(stream) {
  const [lvl, setLvl] = useState(0);
  useEffect(() => {
    if (!stream) {
      setLvl(0);
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const an = ctx.createAnalyser();
    an.fftSize = 256;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    let raf;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) {
        const d = (v - 128) / 128;
        sum += d * d;
      }
      setLvl(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      ctx.close();
    };
  }, [stream]);
  return lvl;
}
function Meter({ level, bars = 32 }) {
  return /* @__PURE__ */ React.createElement("div", { className: "meter", "aria-hidden": "true" }, Array.from({ length: bars }, (_, i) => /* @__PURE__ */ React.createElement(
    "i",
    {
      key: i,
      className: (i + 1) / bars <= level ? "on" : "",
      style: { height: 30 + Math.abs(Math.sin(i * 1.7)) * 70 + "%" }
    }
  )));
}
function Logo() {
  return /* @__PURE__ */ React.createElement("span", { className: "logo" }, /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 32 32", fill: "none", stroke: "currentColor", strokeWidth: "2.6", strokeLinecap: "round" }, /* @__PURE__ */ React.createElement("circle", { cx: "16", cy: "16", r: "3", fill: "currentColor", stroke: "none" }), /* @__PURE__ */ React.createElement("path", { d: "M9.5 9.5a9 9 0 0 0 0 13M22.5 9.5a9 9 0 0 1 0 13" }), /* @__PURE__ */ React.createElement("path", { d: "M5 5a15 15 0 0 0 0 22M27 5a15 15 0 0 1 0 22", opacity: ".45" })), "BeHeard");
}
function MicIcon() {
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "9", y: "2.5", width: "6", height: "12", rx: "3" }), /* @__PURE__ */ React.createElement("path", { d: "M5 11a7 7 0 0 0 14 0M12 18v3.5" }));
}
function HandIcon() {
  return /* @__PURE__ */ React.createElement("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("path", { d: "M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V14M17 9.5a1.5 1.5 0 0 1 3 0V15a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L3.8 15a1.6 1.6 0 0 1 2.5-2L8 15" }));
}
function drawQR(el, text, size) {
  if (!el) return;
  el.innerHTML = "";
  try {
    new QRCode(el, { text, width: size, height: size, colorDark: "#141B2D", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M });
  } catch (e) {
  }
}
function Admin() {
  const [pin, setPin] = useState("");
  const [authed, setAuthed] = useState(false);
  const [err, setErr] = useState("");
  const [roster, setRoster] = useState({ live: null, users: [] });
  const [streams, setStreams] = useState({});
  const [url, setUrl] = useState(location.origin + "/");
  const [proj, setProj] = useState(false);
  const [vol, setVol] = useState(1);
  const [muted, setMuted] = useState(false);
  const [sinks, setSinks] = useState([]);
  const [sink, setSink] = useState("");
  const ws = useRef(null), pcs = useRef({}), els = useRef({}), vr = useRef({ vol: 1, muted: false, sink: "" });
  const qr = useRef(null), qrBig = useRef(null);
  const liveUser = roster.users.find((u) => u.id === roster.live);
  const liveStream = liveUser ? streams[liveUser.id] : null;
  const level = useLevel(liveStream);
  const secs = useTimer(roster.live);
  const queue = roster.users.filter((u) => u.hand).sort((a, b) => a.hand - b.hand);
  const room = roster.users.filter((u) => !u.hand && u.id !== roster.live);
  const send = (m) => ws.current && ws.current.readyState === 1 && ws.current.send(JSON.stringify(m));
  useEffect(() => {
    vr.current = { vol, muted, sink };
    Object.values(els.current).forEach((el) => {
      el.volume = vol;
      el.muted = muted;
      if (sink && el.setSinkId) el.setSinkId(sink).catch(() => {
      });
    });
  }, [vol, muted, sink]);
  useEffect(() => {
    if (authed) drawQR(qr.current, url, 196);
  }, [authed, url]);
  useEffect(() => {
    if (proj) drawQR(qrBig.current, url, 320);
  }, [proj, url]);
  useEffect(() => {
    if (!authed || !navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
    navigator.mediaDevices.enumerateDevices().then((d) => setSinks(d.filter((x) => x.kind === "audiooutput"))).catch(() => {
    });
  }, [authed]);
  function drop(id) {
    if (pcs.current[id]) pcs.current[id].close();
    delete pcs.current[id];
    if (els.current[id]) els.current[id].remove();
    delete els.current[id];
    setStreams((s) => {
      const n = { ...s };
      delete n[id];
      return n;
    });
  }
  async function onOffer(m) {
    drop(m.from);
    const p = new RTCPeerConnection({ iceServers: ICE });
    pcs.current[m.from] = p;
    p.ontrack = (ev) => {
      const stream = ev.streams[0];
      const el = document.createElement("audio");
      el.autoplay = true;
      el.srcObject = stream;
      el.volume = vr.current.vol;
      el.muted = vr.current.muted;
      if (vr.current.sink && el.setSinkId) el.setSinkId(vr.current.sink).catch(() => {
      });
      document.body.appendChild(el);
      els.current[m.from] = el;
      el.play().catch(() => {
      });
      setStreams((s) => ({ ...s, [m.from]: stream }));
    };
    p.onicecandidate = (ev) => ev.candidate && send({ type: "ice", to: m.from, candidate: ev.candidate });
    await p.setRemoteDescription(m.sdp);
    await p.setLocalDescription(await p.createAnswer());
    send({ type: "answer", to: m.from, sdp: p.localDescription });
  }
  function login(e) {
    e.preventDefault();
    try {
      new (window.AudioContext || window.webkitAudioContext)().resume();
    } catch (x) {
    }
    const s = new WebSocket(WS_URL);
    ws.current = s;
    s.onopen = () => s.send(JSON.stringify({ type: "admin", pin }));
    s.onclose = () => {
      setAuthed(false);
      setErr("Connection lost. Enter the PIN to reconnect.");
    };
    s.onmessage = async (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === "denied") setErr("Wrong PIN. Try again.");
      if (m.type === "admin-ok") {
        setAuthed(true);
        setErr("");
      }
      if (m.type === "roster") {
        setRoster(m);
        Object.keys(pcs.current).forEach((id) => {
          if (Number(id) !== m.live) drop(id);
        });
      }
      if (m.type === "offer") await onOffer(m);
      if (m.type === "ice" && pcs.current[m.from]) {
        try {
          await pcs.current[m.from].addIceCandidate(m.candidate);
        } catch (x) {
        }
      }
      if (m.type === "done") drop(m.from);
    };
  }
  if (!authed) {
    return /* @__PURE__ */ React.createElement("main", { className: "login" }, /* @__PURE__ */ React.createElement(Logo, null), /* @__PURE__ */ React.createElement("h1", null, "Host console"), /* @__PURE__ */ React.createElement("p", { className: "lead" }, "Open this on the laptop that is connected to the hall speakers."), /* @__PURE__ */ React.createElement("form", { onSubmit: login }, /* @__PURE__ */ React.createElement("label", null, "Host PIN", /* @__PURE__ */ React.createElement("input", { type: "password", value: pin, onChange: (e) => setPin(e.target.value), autoFocus: true, inputMode: "numeric" })), /* @__PURE__ */ React.createElement("button", { className: "btn", style: { width: "100%", padding: "1rem" } }, "Open console")), err && /* @__PURE__ */ React.createElement("p", { className: "note err" }, err));
  }
  const connecting = liveUser && !liveStream;
  return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("header", { className: "bar" }, /* @__PURE__ */ React.createElement(Logo, null), /* @__PURE__ */ React.createElement("div", { className: "tools" }, /* @__PURE__ */ React.createElement("label", { style: { margin: 0, display: "flex", alignItems: "center", gap: ".5rem" } }, "Speaker volume", /* @__PURE__ */ React.createElement("input", { type: "range", min: "0", max: "1", step: "0.05", value: vol, onChange: (e) => setVol(Number(e.target.value)), style: { margin: 0 } })), sinks.length > 1 && /* @__PURE__ */ React.createElement("select", { value: sink, onChange: (e) => setSink(e.target.value), "aria-label": "Speaker output" }, /* @__PURE__ */ React.createElement("option", { value: "" }, "Default output"), sinks.map((d, i) => /* @__PURE__ */ React.createElement("option", { key: d.deviceId, value: d.deviceId }, d.label || "Output " + (i + 1)))), /* @__PURE__ */ React.createElement("button", { className: "btn sm " + (muted ? "danger" : "ghost"), onClick: () => setMuted(!muted) }, muted ? "Speakers muted" : "Mute speakers"))), /* @__PURE__ */ React.createElement("div", { className: "layout" }, /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("section", { className: "panel stage " + (liveUser ? "live" : "") }, /* @__PURE__ */ React.createElement("span", { className: "tag" }, liveUser ? connecting ? "Connecting" : "On air" : "Stage is quiet"), /* @__PURE__ */ React.createElement("h1", null, liveUser ? liveUser.name : "Nobody is speaking"), /* @__PURE__ */ React.createElement(Meter, { level }), /* @__PURE__ */ React.createElement("div", { className: "row" }, /* @__PURE__ */ React.createElement("span", { className: "timer" }, liveUser ? fmt(secs) : ""), liveUser && /* @__PURE__ */ React.createElement("button", { className: "btn danger sm", onClick: () => send({ type: "revoke", to: liveUser.id }) }, "Take mic back"), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => send({ type: "endall" }) }, "End all and clear queue"))), /* @__PURE__ */ React.createElement("section", { className: "panel" }, /* @__PURE__ */ React.createElement("h3", null, "Hands up ", /* @__PURE__ */ React.createElement("span", null, queue.length, " waiting")), queue.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "empty" }, "No hands raised yet.") : /* @__PURE__ */ React.createElement("ul", { className: "list" }, queue.map((u, i) => /* @__PURE__ */ React.createElement("li", { key: u.id }, /* @__PURE__ */ React.createElement("span", { className: "no" }, i + 1), /* @__PURE__ */ React.createElement("span", { className: "nm" }, u.name), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => send({ type: "grant", to: u.id }) }, "Give mic"))))), /* @__PURE__ */ React.createElement("section", { className: "panel" }, /* @__PURE__ */ React.createElement("h3", null, "In the room ", /* @__PURE__ */ React.createElement("span", null, roster.users.length, " connected")), room.length === 0 ? /* @__PURE__ */ React.createElement("p", { className: "empty" }, "Nobody else is here. Show the QR code to the audience.") : /* @__PURE__ */ React.createElement("ul", { className: "list" }, room.map((u) => /* @__PURE__ */ React.createElement("li", { key: u.id }, /* @__PURE__ */ React.createElement("span", { className: "nm" }, u.name), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", onClick: () => send({ type: "grant", to: u.id }) }, "Give mic")))))), /* @__PURE__ */ React.createElement("div", { className: "col" }, /* @__PURE__ */ React.createElement("aside", { className: "panel" }, /* @__PURE__ */ React.createElement("h3", null, "Join the room"), /* @__PURE__ */ React.createElement("div", { className: "qr", ref: qr }), /* @__PURE__ */ React.createElement("label", null, "Public link for the QR code", /* @__PURE__ */ React.createElement("input", { type: "url", value: url, onChange: (e) => setUrl(e.target.value) })), !url.startsWith("https://") && /* @__PURE__ */ React.createElement("p", { className: "note warn", style: { marginBottom: ".9rem" } }, "Phones only allow the microphone on HTTPS pages. Run ", /* @__PURE__ */ React.createElement("b", null, "npx ngrok http 3000"), ", then paste the https link it gives you here."), /* @__PURE__ */ React.createElement("button", { className: "btn sm", onClick: () => setProj(true) }, "Show on projector")))), proj && /* @__PURE__ */ React.createElement("div", { className: "proj" }, /* @__PURE__ */ React.createElement("h1", null, "Scan to speak from your seat"), /* @__PURE__ */ React.createElement("div", { className: "qr", ref: qrBig }), /* @__PURE__ */ React.createElement("p", null, url), /* @__PURE__ */ React.createElement("button", { className: "btn ghost sm", style: { color: "#fff" }, onClick: () => setProj(false) }, "Close")));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Admin, null));
