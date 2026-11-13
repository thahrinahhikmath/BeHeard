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
function Audience() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem("bh-name") || "";
    } catch (e) {
      return "";
    }
  });
  const [joined, setJoined] = useState(false);
  const [online, setOnline] = useState(false);
  const [st, setSt] = useState({ pos: 0, live: false, host: false });
  const [stream, setStream] = useState(null);
  const [msg, setMsg] = useState("");
  const ws = useRef(null), pc = useRef(null), mic = useRef(null), nm = useRef("");
  const level = useLevel(stream);
  const secs = useTimer(st.live);
  const send = (m) => ws.current && ws.current.readyState === 1 && ws.current.send(JSON.stringify(m));
  function stopMic() {
    if (mic.current) mic.current.getTracks().forEach((t) => t.stop());
    mic.current = null;
    setStream(null);
    if (pc.current) pc.current.close();
    pc.current = null;
  }
  async function goLive() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      mic.current = s;
      setStream(s);
      const p = new RTCPeerConnection({ iceServers: ICE });
      pc.current = p;
      s.getTracks().forEach((t) => p.addTrack(t, s));
      p.onicecandidate = (e) => e.candidate && send({ type: "ice", candidate: e.candidate });
      await p.setLocalDescription(await p.createOffer());
      send({ type: "offer", sdp: p.localDescription });
    } catch (err) {
      setMsg("Microphone blocked. Allow mic access for this site in your browser, then raise your hand again.");
      send({ type: "done" });
    }
  }
  function connect() {
    const s = new WebSocket(WS_URL);
    ws.current = s;
    s.onopen = () => {
      setOnline(true);
      s.send(JSON.stringify({ type: "join", name: nm.current }));
    };
    s.onclose = () => {
      setOnline(false);
      stopMic();
      setSt((x) => ({ ...x, live: false, pos: 0 }));
      setTimeout(() => {
        if (ws.current === s) connect();
      }, 2e3);
    };
    s.onmessage = async (e) => {
      const m = JSON.parse(e.data);
      if (m.type === "state") {
        setSt(m);
        if (!m.live && mic.current) stopMic();
      }
      if (m.type === "grant") {
        setMsg("");
        await goLive();
      }
      if (m.type === "revoke") {
        if (mic.current) setMsg("Your turn is over. Thanks for speaking.");
        stopMic();
      }
      if (m.type === "answer" && pc.current) await pc.current.setRemoteDescription(m.sdp);
      if (m.type === "ice" && pc.current) {
        try {
          await pc.current.addIceCandidate(m.candidate);
        } catch (e2) {
        }
      }
    };
  }
  function join(e) {
    e.preventDefault();
    const n = name.trim() || "Guest";
    nm.current = n;
    try {
      localStorage.setItem("bh-name", n);
    } catch (e2) {
    }
    setJoined(true);
    connect();
  }
  if (!joined) {
    return /* @__PURE__ */ React.createElement("main", { className: "join-screen" }, /* @__PURE__ */ React.createElement(Logo, null), /* @__PURE__ */ React.createElement("h1", null, "Speak from your seat"), /* @__PURE__ */ React.createElement("p", { className: "lead" }, "Join the room and your phone becomes a microphone. When the host picks you, everyone in the hall hears you."), /* @__PURE__ */ React.createElement("form", { onSubmit: join }, /* @__PURE__ */ React.createElement("label", null, "Your name", /* @__PURE__ */ React.createElement("input", { type: "text", value: name, onChange: (e) => setName(e.target.value), placeholder: "e.g. Priya", maxLength: "30", autoComplete: "given-name" })), /* @__PURE__ */ React.createElement("button", { className: "btn", style: { width: "100%", padding: "1rem" } }, "Join the room")), !window.isSecureContext && /* @__PURE__ */ React.createElement("p", { className: "note warn" }, "This page is not on HTTPS, so the browser will block your microphone. Ask the host for the secure link."));
  }
  const live = st.live, waiting = st.pos > 0;
  return /* @__PURE__ */ React.createElement("main", null, /* @__PURE__ */ React.createElement("div", { className: "top" }, /* @__PURE__ */ React.createElement(Logo, null), /* @__PURE__ */ React.createElement("span", { className: "pill " + (!online ? "off" : st.host ? "ok" : "") }, !online ? "Reconnecting" : st.host ? "Connected" : "Waiting for host")), /* @__PURE__ */ React.createElement("section", { className: "center" }, /* @__PURE__ */ React.createElement("div", { className: "disc " + (live ? "live" : waiting ? "wait" : ""), style: { "--lvl": level } }, live ? /* @__PURE__ */ React.createElement(MicIcon, null) : /* @__PURE__ */ React.createElement(HandIcon, null)), /* @__PURE__ */ React.createElement("h2", null, live ? "You are on air" : waiting ? `You are number ${st.pos} in line` : "Want to speak?"), live ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("span", { className: "timer" }, fmt(secs)), /* @__PURE__ */ React.createElement("p", null, "Hold the phone close and speak clearly. The host can end your turn at any time."), /* @__PURE__ */ React.createElement(Meter, { level, bars: 24 })) : /* @__PURE__ */ React.createElement("p", null, waiting ? "Keep this page open. Your microphone turns on when the host picks you." : "Raise your hand and the host will see your name in the queue."), msg && /* @__PURE__ */ React.createElement("p", { className: "note " + (msg.startsWith("Microphone") ? "err" : "") }, msg)), /* @__PURE__ */ React.createElement("div", { className: "foot" }, live && /* @__PURE__ */ React.createElement("button", { className: "btn danger", onClick: () => {
    send({ type: "done" });
    stopMic();
    setMsg("Mic off. Thanks for speaking.");
  } }, "Finish speaking"), !live && waiting && /* @__PURE__ */ React.createElement("button", { className: "btn ghost", onClick: () => send({ type: "lower" }) }, "Lower hand"), !live && !waiting && /* @__PURE__ */ React.createElement("button", { className: "btn", disabled: !online || !st.host, onClick: () => {
    setMsg("");
    send({ type: "hand" });
  } }, "Raise hand"), !live && !waiting && online && !st.host && /* @__PURE__ */ React.createElement("p", { className: "empty", style: { textAlign: "center" } }, "The host has not opened the console yet.")));
}
ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Audience, null));
