import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME
// tap. say it. say it louder. silence = cowardice.
// ═══════════════════════════════════════════════════════════════

const TAUNTS = [
  "you won't.",
  "say it. we dare you.",
  "your neighbors can't hear you. probably.",
  "press the button, coward.",
  "it's just a word. say it.",
  "everyone's done it. your turn.",
  "go on. we're waiting.",
  "the microphone is ready. are you?",
  "you've been staring for a while.",
  "the button isn't going to press itself.",
  "still thinking about it?",
  "we believe in you. kind of.",
];

const WARNINGS = [
  "someone heard that.",
  "the dog is staring at you.",
  "your neighbors are awake now.",
  "HR has entered the chat.",
  "your mom almost called.",
  "that was louder than you think.",
  "the walls are NOT soundproof.",
  "your bluetooth speaker is on.",
  "dignity.exe has stopped responding.",
  "estimated 12 people heard you.",
  "your landlord is drafting an email.",
  "a child nearby just learned a new word.",
  "the uber driver turned around.",
  "you've been on speaker this whole time.",
  "your therapist raised their rate.",
  "estimated 47 listeners.",
  "someone is recording this.",
  "your voice cracked. everyone noticed.",
  "this is now a podcast.",
  "estimated 200+ listeners.",
  "even the wifi is embarrassed.",
  "local news has been tipped off.",
  "you just became a meme.",
  "estimated 1,400 people. all coworkers.",
  "your search history just got worse.",
  "estimated 10,000+ listeners.",
  "the internet will never forget this.",
  "you are free.",
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

const BOARD = [
  { name: "kyle_from_ohio", score: 84700, peak: "-2.1 dB", rank: "GOD-TIER" },
  { name: "HR_nightmare", score: 52300, peak: "-5.8 dB", rank: "legend" },
  { name: "screamer_9000", score: 41200, peak: "-8.4 dB", rank: "menace" },
  { name: "no_indoor_voice", score: 33100, peak: "-12 dB", rank: "screamer" },
  { name: "neighbors_hate_me", score: 28400, peak: "-16 dB", rank: "broadcaster" },
];

const NUM_BARS = 40;
const SILENCE_THRESHOLD = -48;
const SILENCE_DURATION = 2500;
const MIN_DB = -60;
const MAX_DB = 0;

export default function PenisGame() {
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
  const [showBoard, setShowBoard] = useState(false);
  const [flash, setFlash] = useState(false);
  const [wordScale, setWordScale] = useState(1);
  const [wordShake, setWordShake] = useState(0);
  const [onAir, setOnAir] = useState(false);
  const [listeners, setListeners] = useState(0);
  const [bars, setBars] = useState(new Array(NUM_BARS).fill(0));
  const [silenceCountdown, setSilenceCountdown] = useState(0);
  const [micReady, setMicReady] = useState(false);
  const [micDenied, setMicDenied] = useState(false);
  const [tauntIdx, setTauntIdx] = useState(0);
  const [tauntFade, setTauntFade] = useState(true);
  const [idleBounce, setIdleBounce] = useState(0);

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
  const silenceStartRef = useRef(null);
  const lastFlashRef = useRef(0);
  const pcmBufRef = useRef(null);
  const freqBufRef = useRef(null);

  // ─── IDLE ANIMATIONS ───
  useEffect(() => {
    if (gameState !== "idle") return;
    let t = 0;
    const iv = setInterval(() => {
      t += 0.05;
      setIdleBounce(Math.sin(t * 1.2) * 4);
    }, 33);
    return () => clearInterval(iv);
  }, [gameState]);

  // Rotating taunts
  useEffect(() => {
    if (gameState !== "idle") return;
    const iv = setInterval(() => {
      setTauntFade(false);
      setTimeout(() => {
        setTauntIdx(i => (i + 1) % TAUNTS.length);
        setTauntFade(true);
      }, 300);
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
      an.fftSize = 2048;
      an.smoothingTimeConstant = 0.3;
      src.connect(an);
      analyserRef.current = an;
      audioCtxRef.current = ctx;
      streamRef.current = stream;
      pcmBufRef.current = new Float32Array(an.fftSize);
      freqBufRef.current = new Uint8Array(an.frequencyBinCount);
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
    setDbLevel(db);
    setRmsNorm(norm);
    if (db > peakDbRef.current) { peakDbRef.current = db; setPeakDb(db); }
    setBars(computeBars());

    const phase = getPhase(peakDbRef.current);

    if (db > SILENCE_THRESHOLD) {
      scoreRef.current += (1 + norm * 4) * (1 + phase * 0.3) * 0.35;
      setScore(Math.floor(scoreRef.current));
    }

    setWordScale(prev => prev + ((1 + norm * 0.8) - prev) * 0.15);
    setWordShake(norm > 0.12 ? norm * 7 + phase * 2 : 0);
    setShake(norm > 0.25 ? norm * 6 + phase * 1.5 : 0);
    setListeners(Math.floor(elapsed ** 2 * 0.3 + norm * 200 + phase * 50));
    if (elapsed > 0.5 && db > SILENCE_THRESHOLD) setOnAir(true);

    // Silence detection
    if (db <= SILENCE_THRESHOLD) {
      if (!silenceStartRef.current) silenceStartRef.current = now;
      const silent = now - silenceStartRef.current;
      if (elapsed > 1.5) {
        setSilenceCountdown(Math.max(0, 1 - silent / SILENCE_DURATION));
        if (silent >= SILENCE_DURATION) { endGame(); return; }
      }
    } else { silenceStartRef.current = null; setSilenceCountdown(0); }

    // Warnings
    const wInt = Math.max(1.2, 4 - phase * 0.4);
    if (now - lastWarnRef.current > wInt * 1000 && warnIdxRef.current < WARNINGS.length) {
      const w = WARNINGS[warnIdxRef.current++];
      lastWarnRef.current = now;
      const id = now + Math.random();
      setWarnings(prev => [...prev.slice(-4), { text: w, id }]);
      setTimeout(() => setWarnings(prev => prev.filter(x => x.id !== id)), 3500 + phase * 500);
    }

    if ([5, 10, 20, 30, 45].some(t => elapsed >= t && elapsed < t + 0.2) && now - lastFlashRef.current > 1000) {
      lastFlashRef.current = now;
      setFlash(true);
      setTimeout(() => setFlash(false), 80);
    }

    frameRef.current = requestAnimationFrame(loop);
  }, [computeRmsDb, computeBars]);

  const startGame = useCallback(async () => {
    if (gameStateRef.current === "listening") return;
    if (!micReady) { const ok = await initMic(); if (!ok) return; }
    if (audioCtxRef.current?.state === "suspended") await audioCtxRef.current.resume();

    gameStateRef.current = "listening";
    setGameState("listening");
    startTimeRef.current = Date.now();
    scoreRef.current = 0;
    peakDbRef.current = -60;
    warnIdxRef.current = 0;
    lastWarnRef.current = Date.now();
    lastFlashRef.current = 0;
    silenceStartRef.current = null;
    setDuration(0); setDbLevel(-60); setPeakDb(-60); setRmsNorm(0); setScore(0);
    setWarnings([]); setOnAir(false); setShowBoard(false); setResult(null);
    setWordScale(1); setListeners(0); setBars(new Array(NUM_BARS).fill(0)); setSilenceCountdown(0);
    frameRef.current = requestAnimationFrame(loop);
  }, [micReady, initMic, loop]);

  const endGame = useCallback(() => {
    gameStateRef.current = "result";
    setGameState("result");
    setOnAir(false); setShake(0); setWordScale(1); setWordShake(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    const fs = Math.floor(scoreRef.current);
    const fp = peakDbRef.current;
    const fd = (Date.now() - startTimeRef.current) / 1000;
    setBest(b => Math.max(b, fs));
    setSessions(s => s + 1);
    setResult({ duration: fd, score: fs, peakDb: fp, rank: getRank(fp), listeners });
  }, [listeners]);

  useEffect(() => () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); }, []);

  const phase = getPhase(peakDb);
  const rank = getRank(peakDb);
  const isLive = gameState === "listening";
  const isResult = gameState === "result";
  const isIdle = gameState === "idle";

  const accent = "#e02020";
  const hotAccent = phase <= 2 ? "#e02020" : phase <= 4 ? "#ee3030" : "#ff2222";
  const glow = `${hotAccent}${phase <= 2 ? "15" : phase <= 4 ? "28" : "44"}`;

  const sx = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
  const sy = shake > 0.5 ? (Math.random() - 0.5) * shake : 0;
  const dbDisp = Math.max(0, 60 + dbLevel).toFixed(0);
  const peakDisp = Math.max(0, 60 + peakDb).toFixed(0);

  return (
    <div style={{
      minHeight: "100vh",
      background: flash ? "#ff111108" : "#08090c",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative",
      userSelect: "none",
      transition: flash ? "none" : "background 0.5s",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600&family=JetBrains+Mono:wght@200;300;400;500&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: `inset 0 0 ${100 + phase * 25}px rgba(0,0,0,0.55)` }} />

      {/* Ambient glow when live */}
      {isLive && rmsNorm > 0.05 && <div style={{
        position: "fixed", top: "35%", left: "50%",
        width: 250 + rmsNorm * 350, height: 250 + rmsNorm * 350,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        pointerEvents: "none", zIndex: 1,
      }} />}

      {/* ═══ CONTAINER ═══ */}
      <div style={{
        transform: `translate(${sx}px, ${sy}px)`,
        transition: shake > 0 ? "none" : "transform 0.2s",
        display: "flex", flexDirection: "column",
        alignItems: "center", position: "relative", zIndex: 10,
        width: "100%", maxWidth: 440, padding: "0 24px",
      }}>

        {/* LIVE badge */}
        {onAir && <div style={{
          position: "absolute", top: -40, right: 20,
          display: "flex", alignItems: "center", gap: 6, animation: "fadeIn 0.3s",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2222",
            boxShadow: "0 0 6px #ff2222, 0 0 14px #ff222244", animation: "blink 1s infinite" }} />
          <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 500, letterSpacing: 3, color: "#ff2222" }}>LIVE</span>
        </div>}

        {/* ═══════════════════════════════ */}
        {/* ═══ THE WORD ═══════════════════ */}
        {/* ═══════════════════════════════ */}
        <div style={{
          textAlign: "center",
          marginBottom: isLive ? 8 : 4,
          transform: isLive
            ? `scale(${wordScale}) translate(${wordShake > 0 ? (Math.random()-.5)*wordShake : 0}px, ${wordShake > 0 ? (Math.random()-.5)*wordShake*0.3 : 0}px)`
            : isIdle
            ? `translateY(${idleBounce}px)`
            : "none",
          transition: isLive && wordShake > 0 ? "none" : "transform 0.3s ease-out",
        }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: isLive ? Math.min(130, 76 + rmsNorm * 55) : 84,
            fontWeight: 300,
            fontStyle: "italic",
            letterSpacing: isLive ? 3 + rmsNorm * 16 + phase * 2 : 5,
            color: "#f0ece8",
            lineHeight: 0.85,
            margin: 0,
            textShadow: isLive && rmsNorm > 0.08
              ? `0 0 ${15 + rmsNorm * 40}px ${glow}, 0 4px 20px rgba(0,0,0,0.3)`
              : isIdle
              ? "0 4px 30px rgba(0,0,0,0.3)"
              : "none",
            transition: isLive ? "font-size 0.06s, letter-spacing 0.06s" : "all 0.5s",
          }}>
            penis
          </h1>
        </div>

        {/* ═══ SUBTITLE / TAUNT ═══ */}
        {isIdle && (
          <div style={{
            textAlign: "center",
            height: 20,
            marginBottom: 28,
          }}>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 15,
              fontWeight: 400, fontStyle: "italic",
              color: "#666",
              opacity: tauntFade ? 1 : 0,
              transform: tauntFade ? "translateY(0)" : "translateY(-4px)",
              transition: "opacity 0.3s, transform 0.3s",
            }}>
              {TAUNTS[tauntIdx]}
            </div>
          </div>
        )}

        {/* Live subtitle */}
        {isLive && (
          <div style={{
            fontFamily: "'Cormorant Garamond'", fontSize: 14,
            fontWeight: 400, fontStyle: "italic",
            color: "#555", textAlign: "center",
            marginBottom: 10, minHeight: 18,
          }}>
            {phase <= 0 ? "we're listening..."
              : phase <= 1 ? "louder."
              : phase <= 3 ? "LOUDER."
              : phase <= 5 ? "WE CAN STILL HEAR YOUR SHAME."
              : "TRANSCENDENT."}
          </div>
        )}

        {/* ═══ FREQ BARS ═══ */}
        {isLive && (
          <div style={{
            display: "flex", alignItems: "flex-end", justifyContent: "center",
            gap: 1.5, height: 52, width: "100%",
            marginBottom: 12, animation: "fadeIn 0.15s",
          }}>
            {bars.map((v, i) => (
              <div key={i} style={{
                width: Math.max(1.5, (320 / NUM_BARS) - 1.5),
                height: Math.max(1, v * 52),
                borderRadius: 1,
                background: v > 0.7 ? "#ff2222" : v > 0.4 ? hotAccent : `${hotAccent}66`,
                boxShadow: v > 0.6 ? `0 0 3px ${hotAccent}44` : "none",
                transition: "height 0.04s",
              }} />
            ))}
          </div>
        )}

        {/* ═══════════════════════════════ */}
        {/* ═══ THE BUTTON ════════════════ */}
        {/* ═══════════════════════════════ */}
        {!isResult && (
          <div style={{
            position: "relative",
            marginBottom: isLive ? 12 : 20,
          }}>
            {/* Idle: soft breathing glow ring */}
            {isIdle && <div style={{
              position: "absolute", inset: -16, borderRadius: "50%",
              background: "transparent",
              boxShadow: `0 0 40px ${accent}10, 0 0 80px ${accent}06`,
              animation: "breathe 3s ease-in-out infinite",
            }} />}

            {/* Idle: pulsing ring */}
            {isIdle && <div style={{
              position: "absolute", inset: -8, borderRadius: "50%",
              border: `1.5px solid ${accent}18`,
              animation: "pulseRing 2.5s ease-in-out infinite",
            }} />}

            {/* Live: volume-reactive ring */}
            {isLive && rmsNorm > 0.05 && <div style={{
              position: "absolute", inset: -10, borderRadius: "50%",
              border: `1.5px solid ${hotAccent}${Math.min(60, Math.floor(rmsNorm * 80)).toString(16).padStart(2, '0')}`,
              boxShadow: `0 0 ${14 + rmsNorm * 30}px ${glow}`,
            }} />}

            {/* Silence countdown ring */}
            {isLive && silenceCountdown > 0 && silenceCountdown < 1 && (
              <svg width="180" height="180" style={{ position: "absolute", inset: -10, transform: "rotate(-90deg)" }}>
                <circle cx="90" cy="90" r="84" fill="none"
                  stroke={`${hotAccent}44`} strokeWidth="2"
                  strokeDasharray={`${silenceCountdown * 528} 528`}
                  strokeLinecap="round" />
              </svg>
            )}

            {/* Button housing */}
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
              <button
                onClick={isLive ? endGame : startGame}
                style={{
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
                }}
              >
                {/* Glare */}
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
                      fontWeight: 200, color: "#fff",
                      letterSpacing: 2, lineHeight: 1,
                      textShadow: `0 0 ${8 + rmsNorm * 12}px rgba(255,255,255,${0.1 + rmsNorm * 0.15})`,
                    }}>{duration.toFixed(1)}</div>
                    <div style={{
                      fontFamily: "'JetBrains Mono'", fontSize: 7,
                      fontWeight: 300, letterSpacing: 3,
                      color: "rgba(255,255,255,0.35)", marginTop: 3,
                    }}>SEC</div>
                    {silenceCountdown > 0 && silenceCountdown < 1 && (
                      <div style={{
                        fontFamily: "'JetBrains Mono'", fontSize: 6,
                        fontWeight: 400, letterSpacing: 2,
                        color: "#ff6666", marginTop: 4,
                        animation: "blink 0.5s infinite",
                      }}>SILENCE = COWARDICE</div>
                    )}
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

        {/* ═══ LIVE DATA ═══ */}
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

        {/* ═══ RANK ═══ */}
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

        {/* ═══ IDLE FOOTER ═══ */}
        {isIdle && (
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s" }}>
            {micDenied && (
              <div style={{ fontFamily: "'DM Sans'", fontSize: 11, color: "#ef4444", marginBottom: 10 }}>
                microphone required to play
              </div>
            )}
            {sessions > 0 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 16, fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 200, color: "#3a3a44", marginBottom: 10 }}>
                <span>BEST <span style={{ color: accent }}>{best.toLocaleString()}</span></span>
                <span>SESSIONS <span style={{ color: "#555" }}>{sessions}</span></span>
              </div>
            )}
            <button onClick={() => setShowBoard(true)} style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 13,
              fontWeight: 400, fontStyle: "italic",
              color: "#333", background: "none",
              border: "none", cursor: "pointer",
              padding: "4px 0",
            }}>hall of shame →</button>
          </div>
        )}

        {/* ═══ RESULT ═══ */}
        {isResult && result && (
          <div style={{ textAlign: "center", width: "100%", animation: "fadeIn 0.4s" }}>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 15,
              fontWeight: 400, fontStyle: "italic",
              color: "#555", marginBottom: 16,
            }}>courage ran out.</div>

            <div style={{ fontSize: 36, marginBottom: 6 }}>{result.rank.em}</div>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 34,
              fontWeight: 300, fontStyle: "italic",
              color: "#f0ece8", letterSpacing: 2, marginBottom: 4,
            }}>{result.rank.title}</div>
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 14,
              fontWeight: 400, fontStyle: "italic",
              color: "#555", marginBottom: 24,
            }}>{result.rank.sub}</div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              gap: 1, background: "#1a1a22",
              borderRadius: 6, overflow: "hidden", marginBottom: 20,
            }}>
              {[
                { l: "DURATION", v: `${result.duration.toFixed(1)}s` },
                { l: "PEAK VOL", v: `${Math.max(0, 60 + result.peakDb).toFixed(0)} dB` },
                { l: "SCORE", v: result.score.toLocaleString() },
              ].map((s, i) => (
                <div key={i} style={{ padding: "12px 8px", background: "#0b0b10" }}>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 6, fontWeight: 300, letterSpacing: 3, color: "#33333c", marginBottom: 3 }}>{s.l}</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 16, fontWeight: 200, color: "#e8e4e0" }}>{s.v}</div>
                </div>
              ))}
            </div>

            {sessions > 0 && (
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 200, letterSpacing: 2, color: "#33333c", marginBottom: 20 }}>
                BEST <span style={{ color: accent }}>{best.toLocaleString()}</span> · {sessions} SESSION{sessions !== 1 ? "S" : ""} OF SHAME
              </div>
            )}

            <button onClick={startGame} style={{
              fontFamily: "'Cormorant Garamond'", fontSize: 18,
              fontWeight: 400, fontStyle: "italic",
              color: "#f0ece8", background: accent,
              border: "none", padding: "10px 32px",
              borderRadius: 6, cursor: "pointer",
              boxShadow: `0 4px 20px ${accent}44`,
              letterSpacing: 1,
            }}>say it again</button>

            <div style={{ marginTop: 14 }}>
              <button onClick={() => setShowBoard(true)} style={{
                fontFamily: "'Cormorant Garamond'", fontSize: 13,
                fontWeight: 400, fontStyle: "italic",
                color: "#333", background: "none",
                border: "none", cursor: "pointer",
              }}>hall of shame →</button>
            </div>
          </div>
        )}
      </div>

      {/* ═══ WARNINGS ═══ */}
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

      {/* ═══ HALL OF SHAME ═══ */}
      {showBoard && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(4,4,6,0.94)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 80, animation: "fadeIn 0.3s",
        }} onClick={() => setShowBoard(false)}>
          <div onClick={e => e.stopPropagation()} style={{ maxWidth: 400, width: "90%", padding: "32px 24px" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ fontFamily: "'Cormorant Garamond'", fontSize: 28, fontWeight: 300, fontStyle: "italic", color: "#e8e4e0", marginBottom: 4 }}>Hall of Shame</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, fontWeight: 200, letterSpacing: 3, color: "#333" }}>LOUDEST SCREAMERS</div>
            </div>
            {BOARD.map((e, i) => (
              <div key={i} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "10px 0",
                borderBottom: "1px solid #1a1a22",
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 500, color: i < 3 ? accent : "#333", width: 20 }}>{i + 1}</span>
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: i < 3 ? "#e8e4e0" : "#666" }}>{e.name}</div>
                    <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, color: "#333", marginTop: 1 }}>{e.rank} · {e.peak}</div>
                  </div>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 500, color: i < 3 ? accent : "#555" }}>{e.score.toLocaleString()}</span>
              </div>
            ))}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", marginTop: 8, borderTop: `1px solid ${accent}22` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 13, color: accent, width: 20 }}>—</span>
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 11, color: accent }}>you</div>
                  <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 7, color: `${accent}66` }}>{sessions} session{sessions !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, fontWeight: 500, color: accent }}>{best > 0 ? best.toLocaleString() : "—"}</span>
            </div>
            <div style={{ textAlign: "center", marginTop: 20, fontFamily: "'Cormorant Garamond'", fontSize: 13, fontWeight: 300, fontStyle: "italic", color: "#333", cursor: "pointer" }} onClick={() => setShowBoard(false)}>close</div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: "fixed", bottom: 12,
        fontFamily: "'JetBrains Mono'", fontSize: 7,
        fontWeight: 200, letterSpacing: 3, color: "#18181e",
        zIndex: 20,
      }}>
        {isLive ? phase >= 4 ? "YOUR DIGNITY LEFT THE BUILDING" : "RECORDING" : "AN EXERCISE IN SHAMELESSNESS"}
      </div>

      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.06); }
        }
        @keyframes pulseRing {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.04); }
        }
        @keyframes buttonBreathe {
          0%, 100% { transform: scale(1); box-shadow: 0 6px 24px rgba(180,20,20,0.25), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.08); }
          50% { transform: scale(1.03); box-shadow: 0 8px 32px rgba(180,20,20,0.35), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.1); }
        }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes warnSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ringPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
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
