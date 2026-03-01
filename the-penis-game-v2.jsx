import { useState, useEffect, useRef, useCallback } from "react";

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME — Hardware Edition
// A beautifully rendered recording device.
// One button. You know what to do.
// ═══════════════════════════════════════════════════════════════

const WARNINGS = [
  "NEIGHBORS ALERTED",
  "HR HAS BEEN NOTIFIED",
  "DIGNITY.EXE CRASHED",
  "LEASE VIOLATION #47",
  "YOUR MOM JUST TEXTED",
  "ALEXA HEARD THAT",
  "RING DOORBELL: MOTION",
  "NOISE COMPLAINT FILED",
  "THERAPIST RESCHEDULED",
  "DOG IS CONCERNED",
  "LANDLORD INCOMING",
  "PERMANENT RECORD UPDATED",
  "GOOGLE HOME: '...WOW'",
  "NEXTDOOR POST DRAFTING",
  "UBER DRIVER CONCERNED",
  "ZOOM: YOU'RE NOT MUTED",
];

const SHAME_RANKS = [
  { min: 0, label: "SILENT", sub: "coward." },
  { min: 1, label: "WHISPER", sub: "barely counts" },
  { min: 80, label: "MUMBLE", sub: "your secret is safe" },
  { min: 250, label: "INDOOR VOICE", sub: "polite but weak" },
  { min: 600, label: "NORMAL", sub: "you actually said it" },
  { min: 1200, label: "COMMITTED", sub: "no going back" },
  { min: 2500, label: "UNHINGED", sub: "windows are shaking" },
  { min: 5000, label: "MENACE", sub: "to society" },
  { min: 10000, label: "LEGEND", sub: "they heard you in space" },
  { min: 20000, label: "GOD TIER", sub: "embarrassment transcended" },
];

const getRank = (score) => {
  let rank = SHAME_RANKS[0];
  for (const r of SHAME_RANKS) {
    if (score >= r.min) rank = r;
  }
  return rank;
};

const FAKE_BOARD = [
  { name: "kyle_from_ohio", score: 48210, dur: "4.2s", heard: 142 },
  { name: "HR_nightmare", score: 31004, dur: "3.1s", heard: 89 },
  { name: "3am_screamer", score: 27881, dur: "2.8s", heard: 67 },
  { name: "open_office_vic", score: 19220, dur: "2.4s", heard: 41 },
  { name: "lease_breaker", score: 12003, dur: "1.9s", heard: 23 },
];

export default function ThePenisGame() {
  const [state, setState] = useState("off"); // off, ready, live, cooldown
  const [buttonDown, setButtonDown] = useState(false);
  const [volume, setVolume] = useState(0);
  const [peakVolume, setPeakVolume] = useState(0);
  const [needleAngle, setNeedleAngle] = useState(-45);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [detected, setDetected] = useState(false);
  const [duration, setDuration] = useState(0);
  const [warning, setWarning] = useState(null);
  const [warningCount, setWarningCount] = useState(0);
  const [showBoard, setShowBoard] = useState(false);
  const [streak, setStreak] = useState(0);
  const [totalGames, setTotalGames] = useState(0);
  const [listeners, setListeners] = useState(0);
  const [onAir, setOnAir] = useState(false);
  const [recBlink, setRecBlink] = useState(false);
  const [devicePowered, setDevicePowered] = useState(false);
  const [vuFlicker, setVuFlicker] = useState(false);
  const [screenText, setScreenText] = useState("--:--");
  const [shakeX, setShakeX] = useState(0);
  const [shakeY, setShakeY] = useState(0);
  const [bgFlash, setBgFlash] = useState(false);

  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef = useRef(null);
  const recognitionRef = useRef(null);
  const animRef = useRef(null);
  const scoreRef = useRef(0);
  const volumeRef = useRef(0);
  const isLiveRef = useRef(false);
  const startTimeRef = useRef(null);
  const warningIntervalRef = useRef(null);
  const stateRef = useRef("off");

  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { scoreRef.current = score; }, [score]);

  // REC blink
  useEffect(() => {
    if (state === "live") {
      const i = setInterval(() => setRecBlink(b => !b), 500);
      return () => clearInterval(i);
    } else {
      setRecBlink(false);
    }
  }, [state]);

  // Screen time display
  useEffect(() => {
    if (state === "live") {
      const i = setInterval(() => {
        if (startTimeRef.current) {
          const d = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
          setScreenText(`${d}s`);
          setDuration(parseFloat(d));
        }
      }, 100);
      return () => clearInterval(i);
    }
  }, [state]);

  // ─── AUDIO SETUP ───
  const initAudio = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;
      setDevicePowered(true);
      setState("ready");
      setScreenText("READY");

      // Start speech recognition
      initSpeech();
      // Start volume monitor
      startVolumeLoop();
    } catch (e) {
      setScreenText("NO MIC");
    }
  }, []);

  const startVolumeLoop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      const vol = Math.min(100, (rms / 100) * 100);
      volumeRef.current = vol;
      setVolume(vol);

      // VU needle: -45deg (silent) to +45deg (loud)
      const targetAngle = -45 + (vol / 100) * 90;
      setNeedleAngle(prev => prev + (targetAngle - prev) * 0.3);

      if (vol > peakVolume && isLiveRef.current) setPeakVolume(vol);

      // Score during live
      if (isLiveRef.current && stateRef.current === "live") {
        const volFactor = Math.pow(vol / 100, 1.6);
        const pts = Math.floor(volFactor * 10);
        if (pts > 0) setScore(s => s + pts);

        // Shake
        if (vol > 30) {
          const intensity = (vol / 100) * 6;
          setShakeX((Math.random() - 0.5) * intensity);
          setShakeY((Math.random() - 0.5) * intensity);
        } else {
          setShakeX(0);
          setShakeY(0);
        }

        // BG flash on peaks
        if (vol > 75) {
          setBgFlash(true);
          setTimeout(() => setBgFlash(false), 60);
        }
      } else {
        setShakeX(x => x * 0.8);
        setShakeY(y => y * 0.8);
      }

      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
  }, [peakVolume]);

  const initSpeech = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognitionRef.current = recognition;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript.toLowerCase();
        const conf = event.results[i][0].confidence;
        if (t.includes("penis") || t.includes("peanis") || t.includes("peen") || t.includes("penus")) {
          if (!isLiveRef.current) {
            // Word detected while button held!
            setDetected(true);
            setScore(s => s + Math.floor(conf * 80));
          }
          if (isLiveRef.current) {
            setScore(s => s + Math.floor(conf * 40));
            setDetected(true);
          }
        }
      }
    };

    recognition.onend = () => {
      if (stateRef.current === "ready" || stateRef.current === "live") {
        try { recognition.start(); } catch (e) { /* */ }
      }
    };

    recognition.onerror = () => {};
    try { recognition.start(); } catch (e) { /* */ }
  }, []);

  // ─── BUTTON PRESS (PTT) ───
  const pressButton = useCallback(() => {
    if (state === "off") {
      initAudio();
      return;
    }
    if (state !== "ready") return;

    setButtonDown(true);
    isLiveRef.current = true;
    startTimeRef.current = Date.now();
    setOnAir(true);
    setState("live");
    setScore(0);
    scoreRef.current = 0;
    setDetected(false);
    setDuration(0);
    setPeakVolume(0);
    setWarning(null);
    setWarningCount(0);

    // Warning cascade
    let wc = 0;
    warningIntervalRef.current = setInterval(() => {
      if (wc >= 10) { clearInterval(warningIntervalRef.current); return; }
      setWarning(WARNINGS[Math.floor(Math.random() * WARNINGS.length)]);
      setWarningCount(c => c + 1);
      wc++;
    }, 800 + Math.random() * 600);
  }, [state, initAudio]);

  const releaseButton = useCallback(() => {
    if (state !== "live") return;

    setButtonDown(false);
    isLiveRef.current = false;
    setOnAir(false);
    if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);

    const finalScore = scoreRef.current;
    const est = finalScore > 5000 ? Math.floor(30 + Math.random() * 150)
      : finalScore > 1000 ? Math.floor(5 + Math.random() * 25)
      : finalScore > 200 ? Math.floor(1 + Math.random() * 5) : 0;
    setListeners(l => l + est);
    setBestScore(b => Math.max(b, finalScore));
    setTotalGames(g => g + 1);
    setStreak(s => s + 1);

    setState("cooldown");
    setScreenText(`${finalScore.toLocaleString()} PTS`);

    setTimeout(() => {
      setState("ready");
      setScreenText("READY");
      setWarning(null);
      setDetected(false);
      setShakeX(0);
      setShakeY(0);
    }, 3000);
  }, [state]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      if (recognitionRef.current) try { recognitionRef.current.stop(); } catch (e) {}
      if (audioCtxRef.current) audioCtxRef.current.close();
      if (warningIntervalRef.current) clearInterval(warningIntervalRef.current);
    };
  }, []);

  // LED bar segments
  const ledCount = 16;
  const activeLeds = Math.floor((volume / 100) * ledCount);

  const rank = getRank(state === "cooldown" ? score : bestScore);

  return (
    <div style={{
      minHeight: "100vh",
      background: bgFlash ? "#1a0a0a" : "#080808",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Courier New', monospace",
      color: "#ddd",
      overflow: "hidden",
      transition: bgFlash ? "none" : "background 0.4s",
      padding: 20,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Special+Elite&family=Silkscreen:wght@400;700&display=swap" rel="stylesheet" />

      {/* ═══════════════════════════════════════ */}
      {/* THE DEVICE                              */}
      {/* ═══════════════════════════════════════ */}
      <div style={{
        transform: `translate(${shakeX}px, ${shakeY}px)`,
        transition: state === "live" ? "none" : "transform 0.3s",
      }}>
        {/* ─── DEVICE CHASSIS ─── */}
        <div style={{
          width: 420,
          maxWidth: "94vw",
          background: "linear-gradient(175deg, #1e1e24 0%, #16161b 40%, #111115 100%)",
          borderRadius: 20,
          padding: "28px 32px 32px",
          position: "relative",
          boxShadow: `
            0 20px 60px rgba(0,0,0,0.8),
            0 2px 0 rgba(255,255,255,0.03) inset,
            0 -1px 0 rgba(0,0,0,0.5) inset,
            ${onAir ? "0 0 80px rgba(255,40,40,0.08)" : "0 0 0 transparent"}
          `,
          border: "1px solid #2a2a30",
          // Brushed metal texture via repeating gradient
          backgroundImage: `
            linear-gradient(175deg, #1e1e24 0%, #16161b 40%, #111115 100%),
            repeating-linear-gradient(90deg, transparent, transparent 1px, rgba(255,255,255,0.003) 1px, rgba(255,255,255,0.003) 2px)
          `,
          transition: "box-shadow 0.3s",
        }}>

          {/* Corner screws */}
          {[
            { top: 10, left: 10 }, { top: 10, right: 10 },
            { bottom: 10, left: 10 }, { bottom: 10, right: 10 },
          ].map((pos, i) => (
            <div key={i} style={{
              position: "absolute", ...pos,
              width: 8, height: 8, borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #444 0%, #222 50%, #1a1a1a 100%)",
              boxShadow: "inset 0 1px 1px rgba(255,255,255,0.1), 0 1px 2px rgba(0,0,0,0.5)",
            }}>
              <div style={{
                width: 6, height: 1, background: "#333",
                position: "absolute", top: "50%", left: "50%",
                transform: `translate(-50%, -50%) rotate(${30 + i * 25}deg)`,
              }} />
            </div>
          ))}

          {/* ─── TOP ROW: Brand + Status ─── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
          }}>
            {/* Label tape */}
            <div style={{
              background: "#2a2a2e",
              padding: "4px 14px",
              borderRadius: 3,
              border: "1px solid #333",
              display: "flex",
              alignItems: "center",
              gap: 8,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.3)",
            }}>
              <div style={{
                fontFamily: "'Silkscreen', monospace",
                fontSize: 10,
                color: "#888",
                letterSpacing: 3,
                textTransform: "uppercase",
              }}>
                THE PENIS GAME
              </div>
            </div>

            {/* Status LEDs */}
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {/* POWER LED */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: devicePowered ? "#4ade80" : "#1a1a1a",
                  boxShadow: devicePowered ? "0 0 8px #4ade80, 0 0 2px #4ade80" : "inset 0 1px 1px rgba(0,0,0,0.5)",
                  transition: "all 0.3s",
                }} />
                <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 7, color: "#555" }}>PWR</span>
              </div>
              {/* REC LED */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: (state === "live" && recBlink) ? "#ff3333" : "#1a1a1a",
                  boxShadow: (state === "live" && recBlink) ? "0 0 10px #ff3333, 0 0 3px #ff3333" : "inset 0 1px 1px rgba(0,0,0,0.5)",
                  transition: "all 0.15s",
                }} />
                <span style={{ fontFamily: "'Silkscreen', monospace", fontSize: 7, color: "#555" }}>REC</span>
              </div>
            </div>
          </div>

          {/* ─── VU METER ─── */}
          <div style={{
            background: "linear-gradient(180deg, #f5f0e0 0%, #e8e0c8 100%)",
            borderRadius: 8,
            padding: "16px 20px 12px",
            marginBottom: 16,
            position: "relative",
            overflow: "hidden",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.05)",
            border: "1px solid #333",
          }}>
            {/* VU label */}
            <div style={{
              textAlign: "center",
              fontFamily: "'Silkscreen', monospace",
              fontSize: 8,
              color: "#999",
              letterSpacing: 4,
              marginBottom: 8,
            }}>
              VU
            </div>

            {/* Scale markings */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "0 10px",
              marginBottom: 4,
            }}>
              {["-20", "-10", "-7", "-5", "-3", "0", "+1", "+2", "+3"].map((label, i) => (
                <span key={i} style={{
                  fontFamily: "'Courier New', monospace",
                  fontSize: 7,
                  color: i >= 5 ? "#cc3333" : "#666",
                  fontWeight: i >= 5 ? "bold" : "normal",
                }}>
                  {label}
                </span>
              ))}
            </div>

            {/* Scale arc with tick marks */}
            <div style={{
              height: 50,
              position: "relative",
              marginBottom: 4,
            }}>
              {/* Tick marks */}
              {Array.from({ length: 25 }).map((_, i) => {
                const angle = -50 + (i / 24) * 100;
                const isRed = i > 15;
                const isMajor = i % 3 === 0;
                return (
                  <div key={i} style={{
                    position: "absolute",
                    bottom: 0,
                    left: "50%",
                    width: 1,
                    height: isMajor ? 8 : 4,
                    background: isRed ? "#cc3333" : "#888",
                    transformOrigin: "bottom center",
                    transform: `translateX(-50%) rotate(${angle}deg) translateY(-26px)`,
                  }} />
                );
              })}

              {/* Needle */}
              <div style={{
                position: "absolute",
                bottom: 0,
                left: "50%",
                width: 2,
                height: 44,
                background: "linear-gradient(180deg, #111 0%, #333 90%, #666 100%)",
                borderRadius: "1px 1px 0 0",
                transformOrigin: "bottom center",
                transform: `translateX(-50%) rotate(${needleAngle}deg)`,
                transition: state === "live" ? "transform 0.05s" : "transform 0.3s ease-out",
                zIndex: 2,
              }} />

              {/* Needle pivot */}
              <div style={{
                position: "absolute",
                bottom: -4,
                left: "50%",
                transform: "translateX(-50%)",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "radial-gradient(circle at 40% 40%, #555, #222)",
                zIndex: 3,
                boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
              }} />
            </div>

            {/* dB readout */}
            <div style={{
              textAlign: "center",
              fontFamily: "'Orbitron', monospace",
              fontSize: 9,
              color: "#999",
              letterSpacing: 2,
            }}>
              {volume > 0 ? `${Math.floor(volume)}` : "--"} dB
            </div>
          </div>

          {/* ─── LED LEVEL BAR ─── */}
          <div style={{
            display: "flex",
            gap: 3,
            justifyContent: "center",
            marginBottom: 16,
            padding: "8px 0",
          }}>
            {Array.from({ length: ledCount }).map((_, i) => {
              const active = i < activeLeds;
              const color = i < ledCount * 0.5 ? "#4ade80"
                : i < ledCount * 0.75 ? "#f0c674"
                : "#ff3333";
              return (
                <div key={i} style={{
                  width: 14,
                  height: 8,
                  borderRadius: 1,
                  background: active ? color : "#1a1a1a",
                  boxShadow: active ? `0 0 6px ${color}66, inset 0 1px 0 rgba(255,255,255,0.2)` : "inset 0 1px 2px rgba(0,0,0,0.5)",
                  transition: "all 0.05s",
                  border: `1px solid ${active ? color + "44" : "#222"}`,
                }} />
              );
            })}
          </div>

          {/* ─── LCD SCREEN ─── */}
          <div style={{
            background: "#0a1a0a",
            borderRadius: 4,
            padding: "8px 16px",
            marginBottom: 20,
            textAlign: "center",
            border: "1px solid #1a2a1a",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.5)",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* LCD pixel grid overlay */}
            <div style={{
              position: "absolute",
              inset: 0,
              background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.15) 1px, rgba(0,0,0,0.15) 2px)",
              pointerEvents: "none",
              zIndex: 1,
            }} />
            <div style={{
              fontFamily: "'Orbitron', monospace",
              fontSize: 22,
              fontWeight: 900,
              color: state === "live" ? "#ff4444" : state === "cooldown" ? "#f0c674" : "#3a8a3a",
              letterSpacing: 4,
              textShadow: state === "live"
                ? "0 0 10px #ff444488, 0 0 20px #ff444444"
                : state === "cooldown"
                ? "0 0 10px #f0c67488"
                : "0 0 8px #3a8a3a66",
              position: "relative",
              zIndex: 2,
            }}>
              {screenText}
            </div>
            {/* Subtitle */}
            {state === "cooldown" && (
              <div style={{
                fontFamily: "'Silkscreen', monospace",
                fontSize: 8,
                color: "#f0c67488",
                marginTop: 4,
                position: "relative",
                zIndex: 2,
                letterSpacing: 2,
              }}>
                {getRank(score).label} — {getRank(score).sub}
              </div>
            )}
          </div>

          {/* ─── WARNING DISPLAY ─── */}
          <div style={{
            height: 24,
            marginBottom: 16,
            textAlign: "center",
            overflow: "hidden",
          }}>
            {warning && state === "live" && (
              <div style={{
                fontFamily: "'Silkscreen', monospace",
                fontSize: 8,
                color: "#ff3333",
                letterSpacing: 2,
                animation: "warningSlide 0.2s ease-out",
                textShadow: "0 0 6px rgba(255,50,50,0.3)",
              }}>
                ⚠ {warning}
              </div>
            )}
          </div>

          {/* ═══ THE BUTTON ═══ */}
          <div style={{
            display: "flex",
            justifyContent: "center",
            marginBottom: 16,
          }}>
            <div style={{
              position: "relative",
              width: 160,
              height: 160,
            }}>
              {/* Outer chrome ring */}
              <div style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "conic-gradient(from 0deg, #444, #666, #444, #333, #555, #444)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.1)",
              }} />

              {/* Inner ring groove */}
              <div style={{
                position: "absolute",
                inset: 6,
                borderRadius: "50%",
                background: "#111",
                boxShadow: "inset 0 2px 4px rgba(0,0,0,0.8)",
              }} />

              {/* The actual button surface */}
              <button
                onMouseDown={pressButton}
                onMouseUp={releaseButton}
                onMouseLeave={() => { if (state === "live") releaseButton(); }}
                onTouchStart={(e) => { e.preventDefault(); pressButton(); }}
                onTouchEnd={(e) => { e.preventDefault(); releaseButton(); }}
                style={{
                  position: "absolute",
                  inset: 12,
                  borderRadius: "50%",
                  border: "none",
                  cursor: "pointer",
                  outline: "none",
                  background: state === "live"
                    ? "radial-gradient(circle at 40% 35%, #ff4444 0%, #cc2222 50%, #991111 100%)"
                    : state === "off"
                    ? "radial-gradient(circle at 40% 35%, #444 0%, #2a2a2a 50%, #1a1a1a 100%)"
                    : "radial-gradient(circle at 40% 35%, #dd3333 0%, #aa2222 50%, #881111 100%)",
                  boxShadow: buttonDown
                    ? "0 2px 4px rgba(0,0,0,0.6), inset 0 2px 8px rgba(0,0,0,0.4), 0 0 30px rgba(255,50,50,0.3)"
                    : "0 6px 16px rgba(0,0,0,0.6), inset 0 -2px 4px rgba(0,0,0,0.3), inset 0 2px 4px rgba(255,255,255,0.1)",
                  transform: buttonDown ? "translateY(3px)" : "translateY(0)",
                  transition: "transform 0.08s, box-shadow 0.08s, background 0.3s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                }}
              >
                {/* Button icon/text */}
                {state === "off" ? (
                  <div style={{
                    fontFamily: "'Silkscreen', monospace",
                    fontSize: 12,
                    color: "#666",
                    letterSpacing: 2,
                    textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                  }}>
                    POWER
                  </div>
                ) : (
                  <>
                    {/* Mic icon */}
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 4 }}>
                      <rect x="9" y="2" width="6" height="12" rx="3" fill={state === "live" ? "#fff" : "#ddd"} opacity={state === "live" ? 1 : 0.6} />
                      <path d="M5 10a7 7 0 0 0 14 0" stroke={state === "live" ? "#fff" : "#ddd"} strokeWidth="2" strokeLinecap="round" opacity={state === "live" ? 1 : 0.6} />
                      <line x1="12" y1="17" x2="12" y2="21" stroke={state === "live" ? "#fff" : "#ddd"} strokeWidth="2" strokeLinecap="round" opacity={state === "live" ? 1 : 0.6} />
                      <line x1="8" y1="21" x2="16" y2="21" stroke={state === "live" ? "#fff" : "#ddd"} strokeWidth="2" strokeLinecap="round" opacity={state === "live" ? 1 : 0.6} />
                    </svg>
                    <div style={{
                      fontFamily: "'Silkscreen', monospace",
                      fontSize: state === "live" ? 11 : 9,
                      color: state === "live" ? "#fff" : "#ffcccc",
                      letterSpacing: 2,
                      textShadow: state === "live" ? "0 0 10px rgba(255,255,255,0.5)" : "0 1px 2px rgba(0,0,0,0.5)",
                      transition: "all 0.15s",
                    }}>
                      {state === "live" ? "LIVE" : "HOLD"}
                    </div>
                  </>
                )}
              </button>

              {/* Glow ring when live */}
              {state === "live" && (
                <div style={{
                  position: "absolute",
                  inset: -4,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,50,50,0.3)",
                  boxShadow: "0 0 20px rgba(255,50,50,0.15), inset 0 0 20px rgba(255,50,50,0.05)",
                  animation: "pulseRing 1s ease-in-out infinite",
                  pointerEvents: "none",
                }} />
              )}
            </div>
          </div>

          {/* ─── ON AIR INDICATOR ─── */}
          <div style={{
            textAlign: "center",
            marginBottom: 12,
          }}>
            <div style={{
              display: "inline-block",
              background: onAir ? "#ff3333" : "#1a1a1a",
              padding: "4px 20px",
              borderRadius: 3,
              fontFamily: "'Silkscreen', monospace",
              fontSize: 10,
              color: onAir ? "#fff" : "#333",
              letterSpacing: 6,
              boxShadow: onAir ? "0 0 20px rgba(255,50,50,0.3), inset 0 1px 0 rgba(255,255,255,0.2)" : "inset 0 1px 2px rgba(0,0,0,0.5)",
              transition: "all 0.15s",
              border: `1px solid ${onAir ? "#ff3333" : "#222"}`,
            }}>
              ON AIR
            </div>
          </div>

          {/* ─── BOTTOM INFO ROW ─── */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            paddingTop: 8,
            borderTop: "1px solid #1a1a1a",
          }}>
            <div style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: 7,
              color: "#444",
              letterSpacing: 1,
            }}>
              BEST: {bestScore.toLocaleString()}
            </div>
            <button
              onClick={() => setShowBoard(true)}
              style={{
                background: "none",
                border: "1px solid #2a2a2e",
                padding: "4px 10px",
                fontFamily: "'Silkscreen', monospace",
                fontSize: 7,
                color: "#555",
                cursor: "pointer",
                borderRadius: 2,
                letterSpacing: 1,
              }}
            >
              LEADERBOARD
            </button>
            <div style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: 7,
              color: "#444",
              letterSpacing: 1,
            }}>
              🔥 {streak}
            </div>
          </div>
        </div>

        {/* ─── DEVICE SHADOW ON SURFACE ─── */}
        <div style={{
          width: 380,
          height: 16,
          margin: "0 auto",
          background: "radial-gradient(ellipse, rgba(0,0,0,0.4) 0%, transparent 70%)",
          marginTop: -4,
        }} />
      </div>

      {/* ─── INSTRUCTION TEXT ─── */}
      <div style={{
        textAlign: "center",
        marginTop: 24,
        maxWidth: 300,
      }}>
        {state === "off" && (
          <div style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 13,
            color: "#333",
            lineHeight: 1.8,
          }}>
            press the button to power on.<br />
            <span style={{ fontSize: 10, color: "#222" }}>requires microphone · no audio stored · just shame</span>
          </div>
        )}
        {state === "ready" && (
          <div style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: 14,
            color: "#444",
            lineHeight: 1.8,
          }}>
            hold the button.<br />
            say the word.<br />
            <span style={{ fontSize: 11, color: "#ff333388" }}>louder = more points.</span>
          </div>
        )}
        {state === "live" && (
          <div style={{
            fontFamily: "'Special Elite', monospace",
            fontSize: volume > 50 ? 18 : 14,
            color: "#ff3333",
            letterSpacing: volume > 30 ? volume * 0.06 : 1,
            transition: "all 0.1s",
            textShadow: `0 0 ${volume * 0.3}px rgba(255,50,50,0.4)`,
          }}>
            {volume > 70 ? "LOUDER." : volume > 40 ? "louder..." : detected ? "we heard that." : "say it."}
          </div>
        )}
        {state === "cooldown" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              fontFamily: "'Special Elite', monospace",
              fontSize: 14,
              color: "#f0c674",
              marginBottom: 4,
            }}>
              est. {score > 5000 ? Math.floor(30 + Math.random() * 100) : score > 1000 ? Math.floor(5 + Math.random() * 20) : Math.floor(Math.random() * 3)} people heard that
            </div>
            <div style={{
              fontFamily: "'Special Elite', monospace",
              fontSize: 11,
              color: "#444",
            }}>
              {detected ? "speech recognized. god help you." : "we didn't catch the word. try harder."}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        position: "fixed",
        bottom: 12,
        fontFamily: "'Silkscreen', monospace",
        fontSize: 7,
        color: "#1a1a1a",
        letterSpacing: 2,
      }}>
        {totalGames} SCREAMS · EST. {listeners} TOTAL HEARD · STREAK: {streak}
      </div>

      {/* ═══ LEADERBOARD MODAL ═══ */}
      {showBoard && (
        <div
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.92)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowBoard(false)}
        >
          <div onClick={e => e.stopPropagation()} style={{
            background: "#0d0d0d",
            border: "1px solid #1a1a1a",
            borderRadius: 8,
            padding: 24,
            width: 380,
            maxWidth: "92vw",
          }}>
            <div style={{
              fontFamily: "'Silkscreen', monospace",
              fontSize: 10,
              color: "#ff3333",
              letterSpacing: 2,
              marginBottom: 4,
            }}>
              DAILY LEADERBOARD
            </div>
            <div style={{
              fontFamily: "'Special Elite', monospace",
              fontSize: 12,
              color: "#444",
              fontStyle: "italic",
              marginBottom: 16,
            }}>
              these people committed.
            </div>

            {FAKE_BOARD.map((e, i) => (
              <div key={i} style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: "1px solid #111",
                alignItems: "center",
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 10,
                    color: i < 3 ? "#f0c674" : "#333",
                    width: 20,
                    fontWeight: "bold",
                  }}>{i + 1}</span>
                  <span style={{
                    fontFamily: "monospace",
                    fontSize: 11,
                    color: i < 3 ? "#ddd" : "#666",
                  }}>{e.name}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{
                    fontFamily: "'Orbitron', monospace",
                    fontSize: 10,
                    color: i < 3 ? "#ff4444" : "#444",
                    fontWeight: "bold",
                  }}>{e.score.toLocaleString()}</div>
                  <div style={{
                    fontFamily: "monospace",
                    fontSize: 8,
                    color: "#333",
                  }}>{e.dur} · {e.heard} heard</div>
                </div>
              </div>
            ))}

            {/* Your rank */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "10px 0",
              marginTop: 8,
              borderTop: "1px solid #ff333322",
              alignItems: "center",
            }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: "#ff3333", width: 20 }}>—</span>
                <span style={{ fontFamily: "monospace", fontSize: 11, color: "#ff6666" }}>you</span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 10, color: "#ff3333", fontWeight: "bold" }}>
                  {bestScore.toLocaleString()}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444" }}>
                  {getRank(bestScore).label.toLowerCase()}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowBoard(false)}
              style={{
                width: "100%",
                marginTop: 16,
                padding: 10,
                background: "none",
                border: "1px solid #222",
                color: "#555",
                fontFamily: "'Silkscreen', monospace",
                fontSize: 8,
                cursor: "pointer",
                borderRadius: 4,
                letterSpacing: 2,
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulseRing {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.02); }
        }
        @keyframes warningSlide {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #080808; }
        button:active { outline: none; }
        button:focus { outline: none; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #222; }
      `}</style>
    </div>
  );
}
