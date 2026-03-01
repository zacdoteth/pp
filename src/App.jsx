import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME — play.fun edition
// say it loud. get points. go viral.
// ═══════════════════════════════════════════════════════════════

const TAUNTS = [
  "you won't.", "say it. we dare you.",
  "your neighbors can't hear you. probably.",
  "press the button, coward.", "it's just a word. say it.",
  "everyone's done it. your turn.", "go on. we're waiting.",
  "the microphone is ready. are you?",
  "you've been staring for a while.",
  "the button isn't going to press itself.",
  "still thinking about it?", "we believe in you. kind of.",
];

const WARNINGS = [
  "someone heard that.", "the dog is staring at you.",
  "your neighbors are awake now.", "HR has entered the chat.",
  "your mom almost called.", "that was louder than you think.",
  "the walls are NOT soundproof.", "your bluetooth speaker is on.",
  "dignity.exe has stopped responding.", "estimated 12 people heard you.",
  "your landlord is drafting an email.",
  "a child nearby just learned a new word.",
  "the uber driver turned around.",
  "you've been on speaker this whole time.",
  "your therapist raised their rate.", "estimated 47 listeners.",
  "someone is recording this.",
  "your voice cracked. everyone noticed.",
  "this is now a podcast.", "estimated 200+ listeners.",
  "even the wifi is embarrassed.", "local news has been tipped off.",
  "you just became a meme.",
  "estimated 1,400 people. all coworkers.",
  "your search history just got worse.",
  "estimated 10,000+ listeners.",
  "the internet will never forget this.", "you are free.",
];

const RANKS = [
  { min: -Infinity, title: "coward", sub: "you didn't even try", em: "🫣" },
  { minDb: -45, title: "whisperer", sub: "that barely counts", em: "🤫" },
  { minDb: -35, title: "mumbler", sub: "louder. we dare you.", em: "😶" },
  { minDb: -28, title: "sayer", sub: "the room heard that", em: "😳" },
  { minDb: -22, title: "announcer", sub: "the building heard that", em: "😤" },
  { minDb: -18, title: "broadcaster", sub: "the whole block knows", em: "📢" },
  { minDb: -14, title: "screamer", sub: "this can't be undone", em: "🗣️" },
  { minDb: -10, title: "menace", sub: "danger to society", em: "💀" },
  { minDb: -6, title: "legend", sub: "the internet heard", em: "👑" },
  { minDb: -3, title: "GOD-TIER", sub: "peak human courage", em: "✦" },
];

const getRank = (db) => { let r = RANKS[0]; for (const s of RANKS) if (s.minDb !== undefined && db >= s.minDb) r = s; return r; };
const getPhase = (db) => { if (db < -45) return 0; if (db < -35) return 1; if (db < -28) return 2; if (db < -22) return 3; if (db < -14) return 4; if (db < -8) return 5; return 6; };

const NUM_BARS = 40;
const GAME_DURATION = 6.9;
const MIN_DB = -60;
const MAX_DB = 0;
const CHART_POINTS = 120;

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=JetBrains+Mono:wght@200;300;400;500&family=DM+Sans:wght@300;400;500&display=swap";

// ═══════════════════════════════════════════════════════════════
// PLAY.FUN SDK — hook into the platform
// ═══════════════════════════════════════════════════════════════
let sdk = null;
let sdkReady = false;

function initSDK() {
  if (sdk) return;
  try {
    if (typeof OpenGameSDK !== "undefined") {
      sdk = new OpenGameSDK({ ui: { usePointsWidget: true, theme: "dark" }, logLevel: 1 });
      const meta = document.querySelector('meta[name="x-ogp-key"]');
      const gameId = meta?.content;
      if (gameId && gameId !== "YOUR_CREATOR_ID") {
        sdk.init({ gameId }).then(() => { sdkReady = true; }).catch(() => {});
      }
    }
  } catch {}
}

function addPoints(amount) {
  try { if (sdk && sdkReady) sdk.addPoints(amount); } catch {}
}

function savePoints(score) {
  try { if (sdk && sdkReady) sdk.savePoints(score); } catch {}
}

// ═══════════════════════════════════════════════════════════════
// APP SHELL — Home → Game → Result. That's it.
// ═══════════════════════════════════════════════════════════════
export default function App() {
  const [screen, setScreen] = useState("home");
  const [result, setResult] = useState(null);

  useEffect(() => { initSDK(); }, []);

  const onGameEnd = (res) => {
    savePoints(res.score);
    setResult(res);
    setScreen("result");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08090c" }}>
      <link href={FONT_LINK} rel="stylesheet" />

      {screen === "home" && (
        <HomeScreen onPlay={() => setScreen("game")} />
      )}

      {screen === "game" && (
        <PenisGame onGameEnd={onGameEnd} autoStart />
      )}

      {screen === "result" && result && (
        <ResultScreen result={result}
          onAgain={() => setScreen("game")}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN — the Nintendo treatment
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ onPlay }) {
  const [tauntIdx, setTauntIdx] = useState(0);
  const [tauntFade, setTauntFade] = useState(true);
  const [idleBounce, setIdleBounce] = useState(0);
  const [entered, setEntered] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setEntered(true)); }, []);

  useEffect(() => {
    let t = 0;
    const iv = setInterval(() => { t += 0.05; setIdleBounce(Math.sin(t * 1.2) * 3); }, 33);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setTauntFade(false);
      setTimeout(() => { setTauntIdx(i => (i + 1) % TAUNTS.length); setTauntFade(true); }, 300);
    }, 3200);
    return () => clearInterval(iv);
  }, []);

  const accent = "#e02020";

  return (
    <div style={{
      minHeight: "100vh", background: "#08090c",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", userSelect: "none",
    }}>
      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      {/* Vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "inset 0 0 120px rgba(0,0,0,0.6)" }} />

      {/* Warm ambient glow behind button */}
      <div style={{
        position: "fixed", top: "42%", left: "50%",
        width: 400, height: 400,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        background: "radial-gradient(circle, #e0202010 0%, #e020200a 30%, transparent 65%)",
        pointerEvents: "none", zIndex: 1,
        animation: "breathe 4s ease-in-out infinite",
      }} />

      {/* ═══ CENTER CONTENT ═══ */}
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", position: "relative", zIndex: 10,
        width: "100%", maxWidth: 440, padding: "0 24px",
        transform: `translateY(${idleBounce}px)`,
        transition: "transform 0.3s ease-out",
      }}>
        {/* Title — staggered entrance */}
        <div style={{
          textAlign: "center", marginBottom: 16,
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0) scale(1)" : "translateY(20px) scale(0.95)",
          transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
        }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 56,
            fontWeight: 300, fontStyle: "italic",
            letterSpacing: 5,
            color: "#f0ece8",
            lineHeight: 1, margin: 0,
            textShadow: "0 2px 40px rgba(224,32,32,0.15), 0 4px 20px rgba(0,0,0,0.3)",
          }}>the penis game</h1>
        </div>

        {/* HOW TO PLAY — clear, readable, structured */}
        <div style={{
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s, transform 0.7s cubic-bezier(0.16, 1, 0.3, 1) 0.15s",
          textAlign: "center", marginBottom: 28, maxWidth: 320,
        }}>
          {/* Three clear steps */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 0 }}>
            {[
              { icon: "🎙", text: "press the button" },
              { icon: "🗣", text: <>scream <span style={{ color: "#e8e4e0", fontWeight: 500 }}>penis</span> as loud as you can</> },
              { icon: "⏱", text: <>you have <span style={{ color: "#ffcc33", fontWeight: 500, fontFamily: "'JetBrains Mono'", fontSize: 12 }}>6.9</span> seconds</> },
            ].map((step, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 14px", borderRadius: 8,
                background: "#0e101808",
                opacity: entered ? 1 : 0,
                transform: entered ? "translateY(0)" : "translateY(10px)",
                transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${0.3 + i * 0.1}s`,
              }}>
                <span style={{ fontSize: 16, width: 24, textAlign: "center", flexShrink: 0 }}>{step.icon}</span>
                <span style={{
                  fontFamily: "'DM Sans'", fontSize: 14,
                  fontWeight: 400, color: "#999", lineHeight: 1.3,
                  textAlign: "left",
                }}>{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Taunt */}
        <div style={{
          textAlign: "center", height: 20, marginBottom: 32,
          opacity: entered ? 1 : 0,
          transition: "opacity 0.6s ease 0.6s",
        }}>
          <div style={{
            fontFamily: "'Cormorant Garamond'", fontSize: 15,
            fontWeight: 400, fontStyle: "italic", color: "#555",
            opacity: tauntFade ? 1 : 0,
            transform: tauntFade ? "translateY(0)" : "translateY(-4px)",
            transition: "opacity 0.3s, transform 0.3s",
          }}>{TAUNTS[tauntIdx]}</div>
        </div>

        {/* ═══ THE BUTTON — big, juicy, Nintendo tactile ═══ */}
        <div style={{
          position: "relative", marginBottom: 24,
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
          transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.25s, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s",
        }}>
          {/* Outermost glow ring */}
          <div style={{
            position: "absolute", inset: -24, borderRadius: "50%",
            background: "transparent",
            boxShadow: `0 0 60px ${accent}0c, 0 0 120px ${accent}06`,
            animation: "breathe 3s ease-in-out infinite",
          }} />
          {/* Pulse ring */}
          <div style={{
            position: "absolute", inset: -12, borderRadius: "50%",
            border: `1.5px solid ${accent}15`,
            animation: "pulseRing 2.5s ease-in-out infinite",
          }} />
          {/* Second pulse ring (offset timing) */}
          <div style={{
            position: "absolute", inset: -20, borderRadius: "50%",
            border: `1px solid ${accent}0a`,
            animation: "pulseRing 3s ease-in-out infinite 0.8s",
          }} />
          {/* Button housing */}
          <div style={{
            width: 176, height: 176, borderRadius: "50%",
            background: "linear-gradient(145deg, #1e1e28, #111116)",
            border: "1px solid #222230",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 12px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
          }}>
            <button onClick={onPlay} style={{
              width: 148, height: 148, borderRadius: "50%",
              border: "none", cursor: "pointer", outline: "none",
              WebkitTapHighlightColor: "transparent",
              background: "radial-gradient(circle at 38% 32%, #dd2828 0%, #b81818 35%, #8a1010 70%, #6a0c0c 100%)",
              boxShadow: "0 8px 28px rgba(200,20,20,0.3), 0 2px 8px rgba(0,0,0,0.4), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 6px 14px rgba(255,130,130,0.1)",
              animation: "buttonBreathe 3s ease-in-out infinite",
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              {/* Specular highlight — that Nintendo gloss */}
              <div style={{
                position: "absolute", top: "6%", left: "14%",
                width: "44%", height: "24%", borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)",
                pointerEvents: "none",
              }} />
              {/* Secondary highlight — bottom rim light */}
              <div style={{
                position: "absolute", bottom: "8%", left: "30%",
                width: "40%", height: "8%", borderRadius: "50%",
                background: "radial-gradient(ellipse, rgba(255,180,180,0.06) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{ marginBottom: 7, filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))" }}>
                <rect x="9" y="2" width="6" height="12" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
              <span style={{
                fontFamily: "'DM Sans'", fontSize: 13,
                fontWeight: 600, letterSpacing: 3,
                color: "rgba(255,255,255,0.8)",
                textShadow: "0 1px 4px rgba(0,0,0,0.3)",
              }}>SAY IT</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM TAGLINE ═══ */}
      <div style={{
        position: "fixed", bottom: 16, left: 0, right: 0,
        textAlign: "center", zIndex: 20,
        opacity: entered ? 1 : 0,
        transition: "opacity 1s ease 1s",
      }}>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 7,
          fontWeight: 200, letterSpacing: 3, color: "#222230",
        }}>AN EXERCISE IN SHAMELESSNESS</div>
      </div>

      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
        @keyframes pulseRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
        @keyframes buttonBreathe { 0%, 100% { transform: scale(1); box-shadow: 0 8px 28px rgba(200,20,20,0.3), 0 2px 8px rgba(0,0,0,0.4), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 6px 14px rgba(255,130,130,0.1); } 50% { transform: scale(1.04); box-shadow: 0 10px 36px rgba(200,20,20,0.4), 0 2px 8px rgba(0,0,0,0.4), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 6px 14px rgba(255,130,130,0.12); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.93) !important; transition: transform 0.06s !important; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME — the core. preserved. + audio recording + chart + speech
// ═══════════════════════════════════════════════════════════════
function PenisGame({ onGameEnd, autoStart }) {
  const [gameState, setGameState] = useState("idle");
  const [duration, setDuration] = useState(0);
  const [dbLevel, setDbLevel] = useState(-60);
  const [peakDb, setPeakDb] = useState(-60);
  const [rmsNorm, setRmsNorm] = useState(0);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [sessions, setSessions] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [shake, setShake] = useState(0);
  const [result, setResult] = useState(null);
  const [flash, setFlash] = useState(false);
  const [wordScale, setWordScale] = useState(1);
  const [wordShake, setWordShake] = useState(0);
  const [onAir, setOnAir] = useState(false);
  const [listeners, setListeners] = useState(0);
  const [bars, setBars] = useState(new Array(NUM_BARS).fill(0));
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [micReady, setMicReady] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [tauntIdx, setTauntIdx] = useState(0);
  const [tauntFade, setTauntFade] = useState(true);
  const [idleBounce, setIdleBounce] = useState(0);
  const [chartData, setChartData] = useState([]);
  const [wordDetected, setWordDetected] = useState(false);
  const [countdown, setCountdown] = useState(null); // 3, 2, 1, "GO"

  const gameStateRef = useRef("idle");
  const startTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const peakDbRef = useRef(-60);
  const warnIdxRef = useRef(0);
  const lastWarnRef = useRef(0);
  const frameRef = useRef(null);
  const analyserRef = useRef(null);
  const audioCtxRef = useRef(null);
  const streamRef = useRef(null);
  const lastFlashRef = useRef(0);
  const pcmBufRef = useRef(null);
  const freqBufRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const chartRef = useRef([]);
  const speechRef = useRef(null);
  const wordBonusRef = useRef(false);
  const lastPointsPush = useRef(0);

  // ─── IDLE ANIMATIONS ───
  useEffect(() => {
    if (gameState !== "idle") return;
    let t = 0;
    const iv = setInterval(() => { t += 0.05; setIdleBounce(Math.sin(t * 1.2) * 4); }, 33);
    return () => clearInterval(iv);
  }, [gameState]);

  useEffect(() => {
    if (gameState !== "idle") return;
    const iv = setInterval(() => {
      setTauntFade(false);
      setTimeout(() => { setTauntIdx(i => (i + 1) % TAUNTS.length); setTauntFade(true); }, 300);
    }, 3200);
    return () => clearInterval(iv);
  }, [gameState]);

  // ─── MIC ───
  const initMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048; an.smoothingTimeConstant = 0.3;
      src.connect(an);
      analyserRef.current = an; audioCtxRef.current = ctx; streamRef.current = stream;
      pcmBufRef.current = new Float32Array(an.fftSize);
      freqBufRef.current = new Uint8Array(an.frequencyBinCount);
      try {
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorderRef.current = rec;
      } catch {}
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const sr = new SR(); sr.continuous = true; sr.interimResults = true;
          sr.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const t = e.results[i][0].transcript.toLowerCase();
              if (/penis|peanut|peen|keen/.test(t) && !wordBonusRef.current) {
                wordBonusRef.current = true; setWordDetected(true);
                scoreRef.current += (e.results[i][0].confidence || 0.5) * 100;
              }
            }
          };
          speechRef.current = sr;
        }
      } catch {}
      setMicReady(true);
      return true;
    } catch { setMicDenied(true); return false; }
  }, []);

  const computeRmsDb = useCallback(() => {
    if (!analyserRef.current || !pcmBufRef.current) return -60;
    analyserRef.current.getFloatTimeDomainData(pcmBufRef.current);
    let s = 0;
    for (let i = 0; i < pcmBufRef.current.length; i++) s += pcmBufRef.current[i] ** 2;
    const rms = Math.sqrt(s / pcmBufRef.current.length);
    if (rms < 0.00001) return -60;
    return Math.max(MIN_DB, Math.min(MAX_DB, 20 * Math.log10(rms)));
  }, []);

  const computeBars = useCallback(() => {
    if (!analyserRef.current || !freqBufRef.current) return new Array(NUM_BARS).fill(0);
    analyserRef.current.getByteFrequencyData(freqBufRef.current);
    const r = [], total = freqBufRef.current.length;
    for (let i = 0; i < NUM_BARS; i++) {
      const s0 = Math.floor(Math.pow(i / NUM_BARS, 1.5) * total);
      const s1 = Math.max(s0 + 1, Math.floor(Math.pow((i + 1) / NUM_BARS, 1.5) * total));
      let sum = 0;
      for (let j = s0; j < s1 && j < total; j++) sum += freqBufRef.current[j];
      r.push(sum / ((s1 - s0) * 255));
    }
    return r;
  }, []);

  // ─── GAME LOOP ───
  const loop = useCallback(() => {
    if (gameStateRef.current !== "listening") return;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    setDuration(elapsed);

    const db = computeRmsDb();
    const norm = Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)));
    setDbLevel(db); setRmsNorm(norm);
    if (db > peakDbRef.current) { peakDbRef.current = db; setPeakDb(db); }
    setBars(computeBars());

    chartRef.current.push(norm);
    setChartData(chartRef.current.slice(-CHART_POINTS));

    const phase = getPhase(peakDbRef.current);

    scoreRef.current += (1 + norm * 4) * (1 + phase * 0.3) * 0.35;
    setScore(Math.floor(scoreRef.current));

    // Push points to play.fun every ~500ms
    if (now - lastPointsPush.current > 500) {
      lastPointsPush.current = now;
      addPoints(Math.floor(scoreRef.current));
    }

    setWordScale(prev => prev + ((1 + norm * 0.8) - prev) * 0.15);
    setWordShake(norm > 0.12 ? norm * 7 + phase * 2 : 0);
    setShake(norm > 0.25 ? norm * 6 + phase * 1.5 : 0);
    setListeners(Math.floor(elapsed ** 2 * 0.3 + norm * 200 + phase * 50));
    if (elapsed > 0.3 && norm > 0.03) setOnAir(true);

    const remaining = Math.max(0, GAME_DURATION - elapsed);
    setTimeLeft(remaining);
    if (remaining <= 0) { endGame(); return; }

    const wInt = Math.max(1.2, 4 - phase * 0.4);
    if (now - lastWarnRef.current > wInt * 1000 && warnIdxRef.current < WARNINGS.length) {
      const w = WARNINGS[warnIdxRef.current++]; lastWarnRef.current = now;
      const id = now + Math.random();
      setWarnings(prev => [...prev.slice(-4), { text: w, id }]);
      setTimeout(() => setWarnings(prev => prev.filter(x => x.id !== id)), 3500 + phase * 500);
    }

    if ([5, 10, 20, 30, 45].some(t => elapsed >= t && elapsed < t + 0.2) && now - lastFlashRef.current > 1000) {
      lastFlashRef.current = now; setFlash(true); setTimeout(() => setFlash(false), 80);
    }

    frameRef.current = requestAnimationFrame(loop);
  }, [computeRmsDb, computeBars]);

  const launchGame = useCallback(() => {
    gameStateRef.current = "listening"; setGameState("listening");
    setCountdown(null);
    startTimeRef.current = Date.now();
    scoreRef.current = 0; peakDbRef.current = -60;
    warnIdxRef.current = 0; lastWarnRef.current = Date.now();
    lastFlashRef.current = 0; lastPointsPush.current = 0;
    wordBonusRef.current = false; chunksRef.current = []; chartRef.current = [];
    setDuration(0); setDbLevel(-60); setPeakDb(-60); setRmsNorm(0); setScore(0);
    setWarnings([]); setOnAir(false); setResult(null);
    setWordScale(1); setListeners(0); setBars(new Array(NUM_BARS).fill(0));
    setTimeLeft(GAME_DURATION); setWordDetected(false); setChartData([]);
    if (recorderRef.current) try {
      recorderRef.current.start(500);
      setTimeout(() => { if (recorderRef.current?.state === "recording") try { recorderRef.current.stop(); } catch {} }, 8000);
    } catch {}
    try { speechRef.current?.start(); } catch {}
    frameRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const startGame = useCallback(async () => {
    if (gameStateRef.current === "listening" || gameStateRef.current === "countdown") return;
    if (!micReady) { const ok = await initMic(); if (!ok) return; }
    // Don't block on resume — it hangs without a user gesture (e.g. autoStart from useEffect)
    if (audioCtxRef.current?.state === "suspended") {
      try { await Promise.race([audioCtxRef.current.resume(), new Promise(r => setTimeout(r, 300))]); } catch {}
    }

    // ─── COUNTDOWN ───
    gameStateRef.current = "countdown"; setGameState("countdown");
    setCountdown(3);
    await new Promise(r => setTimeout(r, 700));
    setCountdown(2);
    await new Promise(r => setTimeout(r, 700));
    setCountdown(1);
    await new Promise(r => setTimeout(r, 700));
    setCountdown("SAY IT");
    await new Promise(r => setTimeout(r, 500));

    if (gameStateRef.current !== "countdown") return; // user navigated away
    launchGame();
  }, [micReady, initMic, launchGame]);

  // ─── AUTO-START on mount ───
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current && gameState === "idle") {
      autoStarted.current = true;
      startGame();
    }
  }, [autoStart, gameState, startGame]);

  const endGame = useCallback(() => {
    gameStateRef.current = "result"; setGameState("result");
    setOnAir(false); setShake(0); setWordScale(1); setWordShake(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    try { speechRef.current?.stop(); } catch {}
    const fs = Math.floor(scoreRef.current);
    const fp = peakDbRef.current;
    const fd = (Date.now() - startTimeRef.current) / 1000;
    const chartSnapshot = [...chartRef.current];
    setBest(b => Math.max(b, fs)); setSessions(s => s + 1);
    const resultData = { duration: fd, score: fs, peakDb: fp, rank: getRank(fp), listeners, wordDetected: wordBonusRef.current, chartData: chartSnapshot };
    setResult(resultData);
    const finalize = (blob) => onGameEnd({ ...resultData, audioBlob: blob });
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = () => {
        finalize(chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "audio/webm" }) : null);
      };
      try { recorderRef.current.stop(); } catch { finalize(null); }
    } else {
      finalize(chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "audio/webm" }) : null);
    }
  }, [listeners, onGameEnd]);

  useEffect(() => () => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    try { speechRef.current?.stop(); } catch {};
  }, []);

  const phase = getPhase(peakDb);
  const rank = getRank(peakDb);
  const isLive = gameState === "listening";
  const isResult = gameState === "result";
  const isIdle = gameState === "idle";
  const isCountdown = gameState === "countdown";

  const accent = "#e02020";
  const hotAccent = phase <= 2 ? "#e02020" : phase <= 4 ? "#ee3030" : "#ff2222";
  const glow = `${hotAccent}${phase <= 2 ? "15" : phase <= 4 ? "28" : "44"}`;

  const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
  const dbDisp = Math.max(0, 60 + dbLevel).toFixed(0);
  const peakDisp = Math.max(0, 60 + peakDb).toFixed(0);

  const cW = 300, cH = 50;
  const chartPath = chartData.length > 1 ? chartData.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (CHART_POINTS - 1) * cW).toFixed(1)},${(cH - v * cH).toFixed(1)}`).join(" ") : "";
  const chartFill = chartPath ? chartPath + ` L${((chartData.length - 1) / (CHART_POINTS - 1) * cW).toFixed(1)},${cH} L0,${cH} Z` : "";

  return (
    <div style={{
      minHeight: "100vh", background: flash ? "#ff111108" : "#08090c",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", userSelect: "none",
      transition: flash ? "none" : "background 0.5s",
    }}>
      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: `inset 0 0 ${100 + phase * 25}px rgba(0,0,0,0.55)` }} />

      {isLive && rmsNorm > 0.05 && <div style={{
        position: "fixed", top: "35%", left: "50%",
        width: 250 + rmsNorm * 350, height: 250 + rmsNorm * 350,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        pointerEvents: "none", zIndex: 1,
      }} />}

      <div style={{
        position: "fixed", top: 16, left: 0, right: 0, textAlign: "center", zIndex: 20,
      }}>
        <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 300, letterSpacing: 3, color: "#e0202066" }}>THE PENIS GAME</span>
      </div>

      {/* ═══ COUNTDOWN OVERLAY ═══ */}
      {isCountdown && countdown !== null && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 50,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "#08090c",
        }}>
          <div key={countdown} style={{
            animation: "countPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
            textAlign: "center",
          }}>
            {typeof countdown === "number" ? (
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: 140, fontWeight: 200,
                color: countdown === 1 ? "#e02020" : "#f0ece8",
                lineHeight: 1, letterSpacing: -4,
                textShadow: countdown === 1
                  ? "0 0 60px #e0202044, 0 0 120px #e0202022"
                  : "0 4px 30px rgba(0,0,0,0.3)",
              }}>{countdown}</div>
            ) : (
              <div style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 64, fontWeight: 300, fontStyle: "italic",
                color: "#e02020", letterSpacing: 6,
                textShadow: "0 0 40px #e0202044, 0 0 80px #e0202022",
              }}>{countdown}</div>
            )}
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 16,
              fontWeight: 300, fontStyle: "italic",
              color: "#333", marginTop: 16,
              opacity: countdown === 3 ? 1 : 0,
              transition: "opacity 0.3s",
            }}>get ready to scream</div>
          </div>
        </div>
      )}

      <div style={{
        transform: `translate(${sx}px, ${sy}px)`,
        transition: shake > 0 ? "none" : "transform 0.2s",
        display: "flex", flexDirection: "column",
        alignItems: "center", position: "relative", zIndex: 10,
        width: "100%", maxWidth: 440, padding: "0 24px",
        opacity: isCountdown ? 0 : 1,
      }}>

        {onAir && <div style={{
          position: "absolute", top: -40, right: 20,
          display: "flex", alignItems: "center", gap: 6, animation: "fadeIn 0.3s",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2222",
            boxShadow: "0 0 6px #ff2222, 0 0 14px #ff222244", animation: "blink 1s infinite" }} />
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 500, letterSpacing: 3, color: "#ff2222" }}>LIVE</span>
        </div>}

        <div style={{
          textAlign: "center", marginBottom: isLive ? 8 : 4,
          transform: isLive
            ? `scale(${wordScale}) translate(${wordShake > 0 ? (Math.random()-.5)*wordShake : 0}px, ${wordShake > 0 ? (Math.random()-.5)*wordShake*0.3 : 0}px)`
            : isIdle ? `translateY(${idleBounce}px)` : "none",
          transition: isLive && wordShake > 0 ? "none" : "transform 0.3s ease-out",
        }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: isLive ? Math.min(130, 76 + rmsNorm * 55) : 84,
            fontWeight: 300, fontStyle: "italic",
            letterSpacing: isLive ? 3 + rmsNorm * 16 + phase * 2 : 5,
            color: "#f0ece8",
            lineHeight: 0.85, margin: 0,
            textShadow: isLive && rmsNorm > 0.08
              ? `0 0 ${15 + rmsNorm * 40}px ${glow}, 0 4px 20px rgba(0,0,0,0.3)`
              : isIdle ? "0 4px 30px rgba(0,0,0,0.3)" : "none",
            transition: isLive ? "font-size 0.06s, letter-spacing 0.06s" : "all 0.5s",
          }}>penis</h1>
        </div>

        {isIdle && (
          <div style={{ textAlign: "center", height: 20, marginBottom: 28 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 15,
              fontWeight: 400, fontStyle: "italic", color: "#666",
              opacity: tauntFade ? 1 : 0,
              transform: tauntFade ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.3s, transform 0.3s",
            }}>{TAUNTS[tauntIdx]}</div>
          </div>
        )}

        {isLive && (
          <div style={{
            fontFamily: "'Cormorant Garamond'", fontSize: 14,
            fontWeight: 400, fontStyle: "italic",
            color: "#555", textAlign: "center", marginBottom: 10, minHeight: 18,
          }}>
            {phase <= 0 ? "we're listening..."
              : phase <= 1 ? "louder."
              : phase <= 3 ? "LOUDER."
              : phase <= 5 ? "WE CAN STILL HEAR YOUR SHAME."
              : "TRANSCENDENT."}
          </div>
        )}

        {isLive && wordDetected && (
          <div style={{
            fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 500,
            color: "#22cc66", letterSpacing: 2, marginBottom: 8,
            padding: "2px 8px", background: "#22cc6612", borderRadius: 3,
            animation: "popIn 0.3s ease-out",
          }}>WORD DETECTED ✓</div>
        )}

        {isLive && (
          <div style={{
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            gap: 1.5, height: 52, width: "100%",
            marginBottom: 12, animation: "fadeIn 0.15s",
          }}>
            {bars.map((v, i) => (
              <div key={i} style={{
                width: Math.max(1.5, (320 / NUM_BARS) - 1.5),
                height: Math.max(1, v * 52), borderRadius: 1,
                background: v > 0.7 ? "#ff2222" : v > 0.4 ? hotAccent : `${hotAccent}66`,
                boxShadow: v > 0.6 ? `0 0 3px ${hotAccent}44` : "none",
                transition: "height 0.04s",
              }} />
            ))}
          </div>
        )}

        {!isResult && !isCountdown && (
          <div style={{ position: "relative", marginBottom: isLive ? 12 : 20 }}>
            {isIdle && <div style={{
              position: "absolute", inset: -16, borderRadius: "50%",
              background: "transparent",
              boxShadow: `0 0 40px ${accent}10, 0 0 80px ${accent}06`,
              animation: "breathe 3s ease-in-out infinite",
            }} />}
            {isIdle && <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `1.5px solid ${accent}18`,
              animation: "pulseRing 2.5s ease-in-out infinite",
            }} />}
            {isLive && rmsNorm > 0.05 && <div style={{
              position: "absolute", inset: -10, borderRadius: "50%",
              border: `1.5px solid ${hotAccent}${Math.min(60, Math.floor(rmsNorm * 80)).toString(16).padStart(2, '0')}`,
              boxShadow: `0 0 ${14 + rmsNorm * 30}px ${glow}`,
            }} />}
            {isLive && (
              <svg width="180" height="180" style={{ position: "absolute", inset: -10, transform: "rotate(-90deg)" }}>
                <circle cx="90" cy="90" r="84" fill="none"
                  stroke="#1a1c28" strokeWidth="2" />
                <circle cx="90" cy="90" r="84" fill="none"
                  stroke={timeLeft < 2 ? "#ff4444" : hotAccent + "66"}
                  strokeWidth="2"
                  strokeDasharray={`${(timeLeft / GAME_DURATION) * 528} 528`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 0.1s linear" }} />
              </svg>
            )}
            <div style={{
              width: 160, height: 160, borderRadius: "50%",
              background: "linear-gradient(145deg, #1c1c24, #111116)",
              border: `1px solid ${isLive && rmsNorm > 0.1 ? hotAccent + "25" : "#1e1e26"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: isLive
                ? `0 0 ${25 + rmsNorm * 25}px ${glow}, 0 8px 30px rgba(0,0,0,0.5)`
                : "0 8px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.02)",
              transition: "box-shadow 0.2s",
            }}>
              <button onClick={isLive ? endGame : startGame} style={{
                width: 136, height: 136, borderRadius: "50%",
                border: "none", cursor: "pointer", outline: "none",
                WebkitTapHighlightColor: "transparent",
                background: isLive
                  ? `radial-gradient(circle at 40% 34%, ${rmsNorm > 0.5 ? '#ee2020' : '#cc2424'} 0%, #a01818 40%, #801010 100%)`
                  : "radial-gradient(circle at 40% 34%, #cc2020 0%, #9a1515 40%, #701010 100%)",
                boxShadow: isLive
                  ? `inset 0 4px 16px rgba(0,0,0,0.5), 0 0 ${rmsNorm * 16}px ${hotAccent}18`
                  : "0 6px 24px rgba(180,20,20,0.25), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.08)",
                animation: isIdle ? "buttonBreathe 3s ease-in-out infinite" : "none",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                position: "relative", overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", top: "10%", left: "18%",
                  width: "38%", height: "20%", borderRadius: "50%",
                  background: "radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)",
                  pointerEvents: "none",
                }} />
                {isLive ? (
                  <>
                    <div style={{
                      fontFamily: "'JetBrains Mono'", fontSize: 34,
                      fontWeight: 200, color: timeLeft < 2 ? "#ff4444" : "#fff",
                      letterSpacing: 2, lineHeight: 1,
                      textShadow: `0 0 ${8 + rmsNorm * 12}px rgba(255,255,255,${0.1 + rmsNorm * 0.15})`,
                      transition: "color 0.3s",
                    }}>{timeLeft.toFixed(1)}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono'", fontSize: 7,
                      fontWeight: 300, letterSpacing: 3,
                      color: "rgba(255,255,255,0.35)", marginTop: 3,
                    }}>{timeLeft < 2 ? "GO GO GO" : "SEC LEFT"}</div>
                  </>
                ) : (
                  <>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{ marginBottom: 6 }}>
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span style={{
                      fontFamily: "'DM Sans'", fontSize: 12,
                      fontWeight: 500, letterSpacing: 2,
                      color: "rgba(255,255,255,0.7)",
                    }}>SAY IT</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {isLive && (
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
            gap: 1, width: "100%",
            background: "#111116", borderRadius: 6,
            overflow: "hidden", border: "1px solid #1a1a22",
            marginBottom: 8, animation: "fadeIn 0.25s",
          }}>
            {[
              { l: "VOLUME", v: dbDisp, u: "dB", c: rmsNorm > 0.7 ? "#ff2222" : hotAccent },
              { l: "PEAK", v: peakDisp, u: "dB", c: "#e8e4e0" },
              { l: "SCORE", v: score.toLocaleString(), u: "PTS", c: "#e8e4e0" },
              { l: "LISTENERS", v: listeners > 0 ? listeners.toLocaleString() : "—", u: "EST", c: phase >= 3 ? "#ff8844" : "#555" },
            ].map((d, i) => (
              <div key={i} style={{ padding: "7px 4px", background: "#0b0b10", textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 5.5, fontWeight: 300, letterSpacing: 2, color: "#33333c", marginBottom: 2 }}>{d.l}</div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 14, fontWeight: 200, color: d.c, letterSpacing: 1 }}>{d.v}</div>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 5, fontWeight: 300, letterSpacing: 2, color: "#222230", marginTop: 1 }}>{d.u}</div>
              </div>
            ))}
          </div>
        )}

        {isLive && chartData.length > 3 && (
          <div style={{ width: "100%", marginBottom: 8, animation: "fadeIn 0.3s" }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, fontWeight: 400, color: "#222230", letterSpacing: 2, marginBottom: 3 }}>$PENIS</div>
            <svg width="100%" viewBox={`0 0 ${cW} ${cH}`} preserveAspectRatio="none" style={{ display: "block" }}>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={hotAccent} stopOpacity="0.25" /><stop offset="100%" stopColor={hotAccent} stopOpacity="0" /></linearGradient></defs>
              {chartFill && <path d={chartFill} fill="url(#cg)" />}
              {chartPath && <path d={chartPath} fill="none" stroke={hotAccent} strokeWidth="1.5" />}
              {chartData.length > 0 && <circle cx={(chartData.length - 1) / (CHART_POINTS - 1) * cW} cy={cH - chartData[chartData.length - 1] * cH} r="2.5" fill={hotAccent} style={{ filter: `drop-shadow(0 0 4px ${hotAccent})` }} />}
            </svg>
          </div>
        )}

        {isLive && peakDb > -50 && (
          <div style={{ textAlign: "center", marginBottom: 6, animation: "fadeIn 0.3s" }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 6, fontWeight: 300, letterSpacing: 4, color: "#28282e" }}>SHAME LEVEL</div>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 18,
              fontWeight: 600, fontStyle: "italic",
              color: hotAccent, letterSpacing: 2, marginTop: 2,
            }}>{rank.em} {rank.title}</div>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, fontWeight: 200, letterSpacing: 2, color: "#3a3a42", marginTop: 2 }}>{rank.sub}</div>
          </div>
        )}

        {isIdle && (
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s" }}>
            {micDenied && <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: "#ef4444", marginBottom: 10 }}>microphone required to play</div>}
            {sessions > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 16, fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 200, color: "#3a3a44", marginBottom: 10 }}>
                <span>BEST <span style={{ color: accent }}>{best.toLocaleString()}</span></span>
                <span>SESSIONS <span style={{ color: "#555" }}>{sessions}</span></span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{
        position: "fixed", bottom: 30, left: 0, right: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 5, zIndex: 30, pointerEvents: "none",
      }}>
        {warnings.map(w => (
          <div key={w.id} style={{
            fontFamily: "'Cormorant Garamond'", fontSize: 13,
            fontWeight: 300, fontStyle: "italic",
            color: `${hotAccent}77`, letterSpacing: 0.5,
            animation: "warnSlide 0.25s ease-out",
          }}>{w.text}</div>
        ))}
      </div>

      <div style={{
        position: "fixed", bottom: 12,
        fontFamily: "'JetBrains Mono'", fontSize: 7,
        fontWeight: 200, letterSpacing: 3, color: "#18181e", zIndex: 20,
      }}>
        {isLive ? phase >= 4 ? "YOUR DIGNITY LEFT THE BUILDING" : "RECORDING" : "AN EXERCISE IN SHAMELESSNESS"}
      </div>

      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
        @keyframes pulseRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
        @keyframes buttonBreathe { 0%, 100% { transform: scale(1); box-shadow: 0 6px 24px rgba(180,20,20,0.25), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.08); } 50% { transform: scale(1.03); box-shadow: 0 8px 32px rgba(180,20,20,0.35), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.1); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes warnSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ringPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes countPop { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.96) !important; }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SHARE CARD — canvas-rendered PnL-style image
// ═══════════════════════════════════════════════════════════════
function scaleChart(raw) {
  if (!raw || raw.length < 2) return raw || [];
  let mn = Infinity, mx = -Infinity;
  for (const v of raw) { if (v < mn) mn = v; if (v > mx) mx = v; }
  const range = mx - mn;
  if (range < 0.01) return raw.map(() => 0.5);
  return raw.map(v => (v - mn) / range);
}

async function generateShareCard(result) {
  await document.fonts.ready;
  const W = 1200, H = 630;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // ─── BACKGROUND ───
  ctx.fillStyle = "#06080e";
  ctx.fillRect(0, 0, W, H);

  // Noise grain
  ctx.globalAlpha = 0.015;
  for (let i = 0; i < 8000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H * 0.45, 650);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.5)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Red ambient glow
  const rg = ctx.createRadialGradient(W / 2, 310, 0, W / 2, 310, 500);
  rg.addColorStop(0, "rgba(224,32,32,0.06)");
  rg.addColorStop(1, "rgba(224,32,32,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // ─── TITLE ───
  ctx.font = 'italic 300 48px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#f0ece8";
  ctx.fillText("the penis game", W / 2, 58);

  // ─── RANK ───
  ctx.font = "44px serif";
  ctx.fillText(result.rank.em, W / 2, 118);

  ctx.font = 'italic 600 38px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#f0ece8";
  ctx.fillText(result.rank.title, W / 2, 166);

  ctx.font = 'italic 400 16px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#555";
  ctx.fillText(result.rank.sub, W / 2, 194);

  // ─── CHART ───
  const cd = scaleChart(result.chartData);
  if (cd.length > 1) {
    const cx = 60, cy = 220, cw = W - 120, ch = 160;

    // Grid
    ctx.strokeStyle = "#0e1018";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const gy = cy + (ch / 4) * i;
      ctx.beginPath(); ctx.moveTo(cx, gy); ctx.lineTo(cx + cw, gy); ctx.stroke();
    }

    // Fill
    ctx.beginPath();
    cd.forEach((v, i) => {
      const x = cx + (i / (cd.length - 1)) * cw;
      const y = cy + ch - v * ch * 0.9 - ch * 0.05;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.lineTo(cx + cw, cy + ch);
    ctx.lineTo(cx, cy + ch);
    ctx.closePath();
    const grd = ctx.createLinearGradient(0, cy, 0, cy + ch);
    grd.addColorStop(0, "rgba(224,32,32,0.28)");
    grd.addColorStop(0.5, "rgba(224,32,32,0.08)");
    grd.addColorStop(1, "rgba(224,32,32,0)");
    ctx.fillStyle = grd;
    ctx.fill();

    // Line
    ctx.beginPath();
    cd.forEach((v, i) => {
      const x = cx + (i / (cd.length - 1)) * cw;
      const y = cy + ch - v * ch * 0.9 - ch * 0.05;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#e02020";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();

    // Glow line
    ctx.strokeStyle = "rgba(224,32,32,0.25)";
    ctx.lineWidth = 8;
    ctx.stroke();

    // End dot
    const lastV = cd[cd.length - 1];
    const lx = cx + cw, ly = cy + ch - lastV * ch * 0.9 - ch * 0.05;
    const dg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 16);
    dg.addColorStop(0, "rgba(224,32,32,0.5)");
    dg.addColorStop(1, "rgba(224,32,32,0)");
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(lx, ly, 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#ff4444"; ctx.fill();
    ctx.beginPath(); ctx.arc(lx, ly, 2, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill();

    // $PENIS label
    ctx.textAlign = "left";
    ctx.font = '400 11px "JetBrains Mono", monospace';
    ctx.fillStyle = "#333";
    ctx.fillText("$PENIS", cx, cy - 8);
    ctx.textAlign = "center";
  }

  // ─── STATS BAR ───
  const sy = 420;
  ctx.fillStyle = "#0a0c12";
  ctx.beginPath();
  ctx.roundRect(100, sy - 12, W - 200, 72, 8);
  ctx.fill();
  ctx.strokeStyle = "#14161f";
  ctx.lineWidth = 1;
  ctx.stroke();

  const stats = [
    { l: "DURATION", v: `${result.duration.toFixed(1)}s`, x: 280 },
    { l: "PEAK VOL", v: `${Math.max(0, 60 + result.peakDb).toFixed(0)} dB`, x: 500 },
    { l: "SCORE", v: result.score.toLocaleString(), x: 720 },
    { l: "RANK", v: result.rank.title.toUpperCase(), x: 920 },
  ];
  stats.forEach((s, i) => {
    ctx.font = '300 9px "JetBrains Mono", monospace';
    ctx.fillStyle = "#33333c";
    ctx.fillText(s.l, s.x, sy + 8);
    ctx.font = '300 26px "JetBrains Mono", monospace';
    ctx.fillStyle = i === 3 ? "#ffcc33" : "#e8e4e0";
    ctx.fillText(s.v, s.x, sy + 42);
    if (i < stats.length - 1) {
      ctx.strokeStyle = "#14161f";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const sx2 = s.x + (stats[i + 1].x - s.x) / 2;
      ctx.moveTo(sx2, sy - 2); ctx.lineTo(sx2, sy + 58);
      ctx.stroke();
    }
  });

  // ─── BOTTOM ───
  ctx.strokeStyle = "#14161f";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(100, 520); ctx.lineTo(W - 100, 520); ctx.stroke();

  // Score callout
  ctx.font = '400 14px "JetBrains Mono", monospace';
  ctx.fillStyle = "#ffcc33";
  ctx.fillText(`${result.score.toLocaleString()} pts`, W / 2, 550);

  // Branding
  ctx.font = 'italic 300 18px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#28282e";
  ctx.fillText("the penis game", W / 2, 585);

  ctx.font = '300 10px "JetBrains Mono", monospace';
  ctx.fillStyle = "#1e1e28";
  ctx.fillText("AN EXERCISE IN SHAMELESSNESS", W / 2, 610);

  return new Promise(resolve => c.toBlob(resolve, "image/png"));
}

// ═══════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════
function ResultScreen({ result, onAgain, onHome }) {
  // Audio
  const audioUrlRef = useRef(null);
  const audioEl = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioDur, setAudioDur] = useState(result.duration || GAME_DURATION);
  const progressIv = useRef(null);

  // Share card
  const cardBlobRef = useRef(null);
  const [cardUrl, setCardUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const [cardHover, setCardHover] = useState(false);

  // Audio — handles webm Infinity duration bug
  useEffect(() => {
    if (!result.audioBlob) return;
    const url = URL.createObjectURL(result.audioBlob);
    audioUrlRef.current = url;
    const a = new Audio();
    a.preload = "auto";
    const tryDur = () => { if (isFinite(a.duration) && a.duration > 0) setAudioDur(a.duration); };
    a.onloadedmetadata = tryDur;
    a.ondurationchange = tryDur;
    a.oncanplaythrough = tryDur;
    a.onended = () => { setPlaying(false); setProgress(0); clearInterval(progressIv.current); };
    a.src = url;
    audioEl.current = a;
    return () => { a.pause(); URL.revokeObjectURL(url); clearInterval(progressIv.current); };
  }, [result.audioBlob]);

  // Generate share card
  useEffect(() => {
    generateShareCard(result).then(blob => {
      if (blob) {
        cardBlobRef.current = blob;
        setCardUrl(URL.createObjectURL(blob));
      }
    });
  }, [result]);

  const togglePlay = () => {
    const a = audioEl.current;
    if (!a) return;
    if (playing) {
      a.pause(); setPlaying(false);
      clearInterval(progressIv.current);
    } else {
      a.play(); setPlaying(true);
      progressIv.current = setInterval(() => {
        const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : audioDur;
        setProgress(a.currentTime / dur);
      }, 50);
    }
  };

  const seekTo = (e) => {
    const a = audioEl.current;
    if (!a) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : audioDur;
    a.currentTime = pct * dur;
    setProgress(pct);
  };

  const downloadAudio = () => {
    if (!result.audioBlob) return;
    const url = URL.createObjectURL(result.audioBlob);
    const a = document.createElement("a");
    a.href = url; a.download = `penis-scream-${result.score}.webm`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyCard = async () => {
    if (!cardBlobRef.current) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": cardBlobRef.current })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { downloadCard(); }
  };

  const downloadCard = () => {
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl; a.download = `penis-game-${result.score}.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  const fmtTime = (s) => isNaN(s) || !isFinite(s) ? "0:00" : `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  const shareText = `I just screamed "penis" and got ranked ${result.rank.em} ${result.rank.title}\n\nScore: ${result.score.toLocaleString()}\nPeak: ${(60 + result.peakDb).toFixed(0)} dB\n\nthe penis game.`;

  // Chart SVG — auto-scaled
  const chartData = scaleChart(result.chartData || []);
  const cW = 300, cH = 50;
  const chartPath = chartData.length > 1 ? chartData.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (chartData.length - 1) * cW).toFixed(1)},${(cH - v * cH * 0.9 - cH * 0.05).toFixed(1)}`).join(" ") : "";
  const chartFill = chartPath ? chartPath + ` L${cW},${cH} L0,${cH} Z` : "";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "32px 24px 40px",
      background: "#08090c", position: "relative", overflow: "hidden",
    }}>
      {/* Grain + vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "inset 0 0 100px rgba(0,0,0,0.55)" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 380, animation: "fadeIn 0.4s" }}>
        {/* Header */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Cormorant Garamond'", fontSize: 14, fontWeight: 400, fontStyle: "italic", color: "#444", marginBottom: 20 }}>courage ran out.</div>
          <div style={{ fontSize: 52, marginBottom: 8, lineHeight: 1 }}>{result.rank.em}</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 300, fontStyle: "italic", color: "#f0ece8", letterSpacing: 2, marginBottom: 4 }}>{result.rank.title}</div>
          <div style={{ fontFamily: "'Cormorant Garamond'", fontSize: 14, fontWeight: 400, fontStyle: "italic", color: "#444", marginBottom: 20 }}>{result.rank.sub}</div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, background: "#1a1a22", borderRadius: 8, overflow: "hidden", marginBottom: 14, textAlign: "center" }}>
          {[
            { l: "DURATION", v: `${result.duration.toFixed(1)}s` },
            { l: "PEAK VOL", v: `${Math.max(0, 60 + result.peakDb).toFixed(0)} dB` },
            { l: "SCORE", v: result.score.toLocaleString() },
          ].map((s, i) => (
            <div key={i} style={{ padding: "14px 8px", background: "#0b0b10" }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 6, fontWeight: 300, letterSpacing: 3, color: "#28282e", marginBottom: 4 }}>{s.l}</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 18, fontWeight: 200, color: "#e8e4e0" }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* $PENIS chart */}
        {chartData.length > 3 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, fontWeight: 400, color: "#222230", letterSpacing: 2, marginBottom: 3 }}>$PENIS</div>
            <svg width="100%" viewBox={`0 0 ${cW} ${cH}`} preserveAspectRatio="none" style={{ display: "block" }}>
              <defs>
                <linearGradient id="rcg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e02020" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#e02020" stopOpacity="0" />
                </linearGradient>
              </defs>
              {chartFill && <path d={chartFill} fill="url(#rcg)" />}
              {chartPath && <path d={chartPath} fill="none" stroke="#e02020" strokeWidth="1.5" />}
              {chartData.length > 0 && (
                <circle cx={cW} cy={cH - chartData[chartData.length - 1] * cH * 0.9 - cH * 0.05} r="2.5" fill="#e02020"
                  style={{ filter: "drop-shadow(0 0 4px #e02020)" }} />
              )}
            </svg>
          </div>
        )}

        {/* Audio player */}
        {result.audioBlob && (
          <div style={{
            background: "#0e1018", border: "1px solid #14161f",
            borderRadius: 10, padding: "14px 16px", marginBottom: 14,
          }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, letterSpacing: 3, color: "#28282e", marginBottom: 10 }}>YOUR SCREAM</div>
            <div onClick={seekTo} style={{
              width: "100%", height: 32, borderRadius: 4,
              background: "#0a0c14", cursor: "pointer", position: "relative",
              overflow: "hidden", marginBottom: 10,
            }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0,
                width: `${progress * 100}%`,
                background: "linear-gradient(90deg, #e02020, #ff4444)",
                borderRadius: 4,
                transition: playing ? "width 0.05s linear" : "width 0.15s ease-out",
              }} />
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "0 2px" }}>
                {Array.from({ length: 40 }, (_, i) => {
                  const h = 4 + Math.sin(i * 0.7 + 2) * 6 + Math.sin(i * 1.3) * 5 + Math.random() * 2;
                  const filled = i / 40 < progress;
                  return <div key={i} style={{
                    width: 3, height: Math.max(3, h), borderRadius: 1,
                    background: filled ? "rgba(255,255,255,0.4)" : "rgba(255,255,255,0.06)",
                    transition: "background 0.1s",
                  }} />;
                })}
              </div>
              <div style={{
                position: "absolute", top: 0, bottom: 0,
                left: `${progress * 100}%`, width: 2,
                background: "#fff", borderRadius: 1,
                boxShadow: "0 0 6px rgba(255,255,255,0.3)",
                transition: playing ? "left 0.05s linear" : "left 0.15s ease-out",
              }} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={togglePlay} style={{
                width: 36, height: 36, borderRadius: "50%",
                background: playing ? "#e02020" : "#1a1c28",
                border: `1px solid ${playing ? "#e02020" : "#22242e"}`,
                color: "#f0ece8", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, flexShrink: 0,
                boxShadow: playing ? "0 0 12px #e0202033" : "none",
              }}>
                {playing ? "⏸" : "▶"}
              </button>
              <div style={{ flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#555" }}>
                <span style={{ color: "#e8e4e0" }}>{fmtTime(progress * audioDur)}</span>
                <span> / {fmtTime(audioDur)}</span>
              </div>
              <button onClick={downloadAudio} style={{
                width: 32, height: 32, borderRadius: 6,
                background: "#1a1c28", border: "1px solid #22242e",
                color: "#666", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }} title="Download audio">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v10M7 12l5 5 5-5M5 19h14" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Share card */}
        {cardUrl && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, letterSpacing: 3, color: "#28282e", marginBottom: 8 }}>YOUR CARD</div>
            <div
              onClick={copyCard}
              onMouseEnter={() => setCardHover(true)}
              onMouseLeave={() => setCardHover(false)}
              style={{ position: "relative", cursor: "pointer", borderRadius: 8, overflow: "hidden", border: `1px solid ${copied ? "#22cc6625" : cardHover ? "#e0202030" : "#14161f"}`, transition: "border-color 0.2s" }}
            >
              <img src={cardUrl} alt="Share card" style={{ width: "100%", display: "block" }} />
              <div style={{
                position: "absolute", inset: 0,
                background: copied ? "rgba(34,204,102,0.12)" : "rgba(0,0,0,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                opacity: cardHover || copied ? 1 : 0,
                transition: "opacity 0.15s",
                pointerEvents: "none",
              }}>
                <span style={{
                  fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 400,
                  letterSpacing: 2, color: copied ? "#22cc66" : "#fff",
                  background: copied ? "#22cc6620" : "#ffffff15",
                  padding: "6px 16px", borderRadius: 6,
                  backdropFilter: "blur(4px)",
                }}>{copied ? "COPIED!" : "CLICK TO COPY"}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={copyCard} style={{
                flex: 1, padding: "10px 0", borderRadius: 6,
                background: copied ? "#22cc6612" : "#e0202010",
                border: `1px solid ${copied ? "#22cc6625" : "#e0202020"}`,
                color: copied ? "#22cc66" : "#e02020",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 1,
              }}>
                {copied ? "COPIED" : "COPY IMAGE"}
              </button>
              <button onClick={downloadCard} style={{
                flex: 1, padding: "10px 0", borderRadius: 6,
                background: "#0e1018", border: "1px solid #14161f",
                color: "#555", cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 1,
              }}>
                SAVE
              </button>
              <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" style={{
                flex: 1, padding: "10px 0", borderRadius: 6,
                background: "#0a0a0a", border: "1px solid #222",
                color: "#e7e9ea", cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 1,
                textDecoration: "none", textAlign: "center",
                display: "block",
              }}>
                SHARE
              </a>
            </div>
          </div>
        )}

        <button onClick={onAgain} style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400,
          fontStyle: "italic", color: "#f0ece8", background: "#e02020",
          border: "none", padding: "11px 36px", borderRadius: 8, cursor: "pointer",
          boxShadow: "0 4px 20px #e0202044", letterSpacing: 1, marginBottom: 10,
          width: "100%",
        }}>say it again</button>
        <div style={{ textAlign: "center" }}>
          <button onClick={onHome} style={{ fontFamily: "'Cormorant Garamond'", fontSize: 13, fontStyle: "italic", color: "#333", background: "none", border: "none", cursor: "pointer", marginTop: 4 }}>home</button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.96) !important; }
        a { text-decoration: none; }
      `}</style>
    </div>
  );
}
