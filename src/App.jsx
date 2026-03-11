import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import { WebHaptics } from "web-haptics";

const haptics = new WebHaptics();
const haptic = (type) => { try { haptics.trigger(type); } catch {} };

// ═══════════════════════════════════════════════════════════════
// SHADER BACKGROUND — Refik Anadol-inspired generative visuals
// ═══════════════════════════════════════════════════════════════
let shaderIntensity = 0;

const VERT_SRC = `#version 300 es
in vec2 a_pos;
void main(){gl_Position=vec4(a_pos,0.,1.);}`;

const FRAG_SRC = `#version 300 es
precision mediump float;
uniform float u_time;
uniform vec2 u_resolution;
uniform float u_intensity;
out vec4 O;

vec2 hash(vec2 p){
  p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));
  return fract(sin(p)*43758.5453);
}

float sdCap(vec2 p,vec2 a,vec2 b,float r){
  vec2 pa=p-a,ba=b-a;
  return length(pa-ba*clamp(dot(pa,ba)/dot(ba,ba),0.,1.))-r;
}

float sdPP(vec2 p){
  float sh=sdCap(p,vec2(0.,-.2),vec2(0.,.24),.09);
  float hd=length(p-vec2(0.,.28))-.12;
  float body=min(sh,hd);
  float b1=length(p-vec2(-.09,-.26))-.075;
  float b2=length(p-vec2(.09,-.26))-.075;
  return min(body,min(b1,b2));
}

void main(){
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float asp=u_resolution.x/u_resolution.y;
  vec2 st=uv*vec2(asp,1.);
  float t=u_time;
  vec3 col=vec3(.01,.002,.004);

  // Two layers of floating penises — depth illusion
  for(int layer=0;layer<2;layer++){
    float cs=layer==0?.55:.38;
    float bright=layer==0?1.:.5;
    float spd=layer==0?1.:1.4;
    float off=layer==0?0.:37.;
    vec2 gid=floor(st/cs);

    for(float j=-1.;j<=1.;j++){
      for(float i=-1.;i<=1.;i++){
        vec2 cell=gid+vec2(i,j);
        vec2 rnd=hash(cell+off);
        vec2 rnd2=hash(cell+off+73.);

        vec2 ctr=(cell+.12+rnd*.76)*cs;
        ctr+=vec2(
          sin(t*.1*spd+rnd.x*6.28)*.06,
          cos(t*.08*spd+rnd.y*6.28)*.05
        );

        vec2 lp=st-ctr;
        float ang=rnd.x*6.28+t*(.025+rnd.y*.02)*spd;
        float ca=cos(ang),sa=sin(ang);
        lp=vec2(lp.x*ca-lp.y*sa,lp.x*sa+lp.y*ca);

        float sc=layer==0?.28+rnd2.x*.16:.18+rnd2.x*.1;
        lp/=sc;

        float d=sdPP(lp);

        // Neon glow outline + soft halo + subtle fill
        float outline=exp(-abs(d)*20.)*.25;
        float glow=exp(-max(d,0.)*4.5)*.08;
        float fill=smoothstep(.01,-.1,d)*.03;
        float b=(outline+glow+fill)*(.35+rnd2.y*.65)*bright;

        col+=vec3(.3,.015,.01)*b*sc;
      }
    }
  }

  // Dark center vignette — UI lives in clean darkness
  float d=length((uv-.5)*vec2(1.,.85));
  float vig=smoothstep(.12,.65,d);
  col*=mix(.01,1.,vig);
  col+=vec3(.02,.002,.001)*vig;

  // Subtle breathing
  float breath=sin(t*.25)*.05+sin(t*.13)*.03;
  col*=1.+breath*.12;

  // Audio — penises come alive when you scream
  col*=1.+u_intensity*2.;
  col+=vec3(.15,.01,.005)*u_intensity;

  col*=.5+u_intensity*.3;
  col=col/(1.+col*.15);
  O=vec4(col,1.);
}`;

function ShaderBackground() {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const t0 = useRef(performance.now());

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const gl = c.getContext("webgl2", { alpha: false, antialias: false, preserveDrawingBuffer: false, powerPreference: "low-power" });
    if (!gl) return;

    const compile = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    const pg = gl.createProgram();
    gl.attachShader(pg, vs); gl.attachShader(pg, fs); gl.linkProgram(pg); gl.useProgram(pg);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(pg, "a_pos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(pg, "u_time");
    const uRes = gl.getUniformLocation(pg, "u_resolution");
    const uInt = gl.getUniformLocation(pg, "u_intensity");

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      c.width = Math.floor(window.innerWidth * dpr * 0.75);
      c.height = Math.floor(window.innerHeight * dpr * 0.75);
      gl.viewport(0, 0, c.width, c.height);
    };
    resize();
    window.addEventListener("resize", resize);

    let last = 0;
    const draw = (now) => {
      rafRef.current = requestAnimationFrame(draw);
      if (now - last < 33) return;
      last = now;
      gl.uniform1f(uTime, (now - t0.current) / 1000);
      gl.uniform2f(uRes, c.width, c.height);
      gl.uniform1f(uInt, shaderIntensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }} />;
}

// ═══════════════════════════════════════════════════════════════
// DEVICE FRAME — premium Nintendo Switch-quality handheld housing
// ═══════════════════════════════════════════════════════════════
function DeviceFrame({ children, controls, ledColor = "#e02020", ledActive = false, ledPulse = false, statusText, onStatusClick }) {
  // Fixed device dimensions — consistent across all screens like a real console
  const DEVICE_W = 380; // px — the "native" width of our device
  return (
    <div style={{
      position: "relative", zIndex: 10,
      width: DEVICE_W,
      maxWidth: "calc(100vw - 32px)",
      // Gentle Animal Crossing perspective — like a furniture item on a table
      transform: "perspective(1800px) rotateX(1.5deg)",
      transition: "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
    }}>
      {/* ── WRIST STRAP — like a Wii Remote ── */}
      <div style={{
        position: "absolute", top: -8, right: 28,
        width: 22, height: 16, zIndex: 2, pointerEvents: "none",
      }}>
        {/* Strap loop */}
        <div style={{
          width: 18, height: 14,
          border: "3px solid #3a3540",
          borderBottom: "none",
          borderRadius: "9px 9px 0 0",
          boxShadow: "0 -2px 6px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.06)",
        }} />
      </div>

      {/* ── DEVICE BODY — soft, pillowy, Animal Crossing furniture ── */}
      <div style={{
        width: "100%",
        // Warm dark plastic — like a black AC furniture variant
        background: "linear-gradient(175deg, #2c2a32 0%, #242228 25%, #1e1c24 50%, #18161e 75%, #141218 100%)",
        borderRadius: 36,
        padding: "16px 14px 20px",
        position: "relative", overflow: "visible", isolation: "isolate",
        // Soft, diffused shadow — AC items have pillowy drop shadows
        boxShadow: `
          0 4px 0 #0e0c14,
          0 8px 0 #0a0812,
          0 12px 0 #060510,
          0 16px 40px rgba(0,0,0,0.5),
          0 32px 80px rgba(0,0,0,0.3),
          inset 0 2px 0 rgba(255,255,255,0.08),
          inset 0 -1px 0 rgba(0,0,0,0.3)
        `,
        border: "2px solid #34303c",
      }}>
        {/* Soft highlight — the AC "shine" on furniture */}
        <div style={{
          position: "absolute", top: 6, left: 24, right: 24, height: 3, zIndex: 0,
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06) 30%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.06) 70%, transparent)",
          borderRadius: 2, pointerEvents: "none",
        }} />

        {/* Top bar — camera + speaker holes + LED */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 12, height: 18 }}>
          {/* Speaker holes — cute rounded */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#1a1820", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03)" }} />)}
          </div>

          {/* Camera lens — chunky, toy-like */}
          <div style={{
            width: 14, height: 14, borderRadius: "50%",
            background: "#1a1820",
            border: "2.5px solid #38343e",
            boxShadow: "inset 0 2px 4px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.05), 0 2px 4px rgba(0,0,0,0.3)",
            position: "relative",
          }}>
            {/* Inner lens */}
            <div style={{
              position: "absolute", inset: 2, borderRadius: "50%",
              background: "radial-gradient(circle at 40% 35%, #2a2840 0%, #0e0c16 60%, #080610 100%)",
            }} />
            {/* Lens glint — that AC sparkle */}
            <div style={{
              position: "absolute", top: 2, left: 3, width: 3, height: 2, borderRadius: "50%",
              background: "rgba(255,255,255,0.25)",
            }} />
          </div>

          {/* LED — round and friendly */}
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: ledActive ? ledColor : "#1a1820",
            border: `2px solid ${ledActive ? "#ff6666" : "#28242e"}`,
            boxShadow: ledActive ? `0 0 8px ${ledColor}66, 0 0 16px ${ledColor}33` : "inset 0 1px 2px rgba(0,0,0,0.5)",
            animation: ledPulse ? "breathe 2s ease-in-out infinite" : "none",
            transition: "all 0.3s ease",
          }} />

          {/* Speaker holes — cute rounded */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0,1,2].map(i => <div key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "#1a1820", boxShadow: "inset 0 1px 2px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.03)" }} />)}
          </div>
        </div>

        {/* Screen — real LCD display feel */}
        <div style={{
          background: "#050408",
          borderRadius: 20, overflow: "hidden",
          position: "relative",
          // Deep inset — screen recessed into plastic body
          boxShadow: "inset 0 4px 16px rgba(0,0,0,0.7), inset 0 1px 4px rgba(0,0,0,0.9), inset 0 0 40px rgba(0,0,0,0.3), 0 -1px 0 rgba(255,255,255,0.04), 0 2px 0 rgba(0,0,0,0.2)",
          border: "3px solid #0c0a12",
        }}>
          {/* Backlight glow — subtle warm edge bleed like a real LCD */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 17,
            background: "radial-gradient(ellipse at 50% 30%, rgba(60,50,80,0.06) 0%, transparent 60%)",
            pointerEvents: "none", zIndex: 2,
          }} />
          {/* Scanlines — subtle horizontal lines */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 17,
            backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)",
            pointerEvents: "none", zIndex: 3, opacity: 0.5,
          }} />
          {/* Screen inner vignette — darker at edges like a real display */}
          <div style={{
            position: "absolute", inset: 0, borderRadius: 17,
            boxShadow: "inset 0 0 60px rgba(0,0,0,0.4), inset 0 0 120px rgba(0,0,0,0.15)",
            pointerEvents: "none", zIndex: 2,
          }} />
          {/* Glass reflection — top highlight */}
          <div style={{
            position: "absolute", top: 0, left: "10%", right: "10%", height: 40,
            background: "linear-gradient(180deg, rgba(255,255,255,0.025) 0%, transparent 100%)",
            pointerEvents: "none", zIndex: 4, borderRadius: "0 0 50% 50%",
          }} />
          <div className="device-screen-content" style={{ padding: "14px 16px 12px", height: "clamp(300px, 50vh, 400px)", position: "relative", zIndex: 5, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </div>
        </div>

        {/* Physical controls area */}
        {controls && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 22, position: "relative", zIndex: 10, transform: "translateZ(0)" }}>
            {controls}
          </div>
        )}

        {/* Side bumpers — like Joy-Con rails but rounder */}
        <div style={{
          position: "absolute", left: 4, top: "35%", transform: "translateY(-50%)", pointerEvents: "none",
          width: 5, height: 50, borderRadius: 3,
          background: "linear-gradient(180deg, #e0202088, #e02020, #e0202088)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 0 6px #e0202022, -1px 0 0 rgba(0,0,0,0.3)",
        }} />
        <div style={{
          position: "absolute", right: 4, top: "35%", transform: "translateY(-50%)", pointerEvents: "none",
          width: 5, height: 50, borderRadius: 3,
          background: "linear-gradient(180deg, #e0202088, #e02020, #e0202088)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.15), 0 0 6px #e0202022, 1px 0 0 rgba(0,0,0,0.3)",
        }} />

        {/* Bottom branding — embossed, friendly */}
        {statusText && (
          <div onClick={onStatusClick} style={{
            textAlign: "center", marginTop: 14,
            fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 400,
            letterSpacing: 3,
            color: "#3a3640",
            textShadow: "0 1px 0 rgba(255,255,255,0.05)",
            cursor: onStatusClick ? "pointer" : "default",
            transition: "color 0.3s ease",
          }}>{statusText}</div>
        )}

        {/* Soft plastic texture */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 36, pointerEvents: "none", opacity: 0.015, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />
      </div>

      {/* ── DANGLING MICROPHONE — chunky, cute, AC-style ── */}
      <div style={{
        position: "absolute", bottom: -58, right: 32,
        display: "flex", flexDirection: "column", alignItems: "center",
        pointerEvents: "none",
        animation: "micSwing 4s ease-in-out infinite",
        transformOrigin: "top center",
      }}>
        {/* Cord — thick and friendly */}
        <svg width="12" height="24" viewBox="0 0 12 24" style={{ overflow: "visible" }}>
          <path d="M6 0 Q6 8, 4 14 Q2 20, 6 24" fill="none" stroke="#2e2a34" strokeWidth="3" strokeLinecap="round" />
          <path d="M6 0 Q6 8, 4 14 Q2 20, 6 24" fill="none" stroke="#3a3640" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {/* Mic body — chunky pill shape */}
        <div style={{
          width: 24, height: 36, borderRadius: 12,
          background: "linear-gradient(175deg, #38343e 0%, #2a2630 40%, #201e26 100%)",
          border: "2.5px solid #3e3a46",
          borderBottom: "2.5px solid #1a1820",
          position: "relative",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4), 0 2px 0 #141218, inset 0 2px 0 rgba(255,255,255,0.08)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 2.5,
        }}>
          {/* Mic grille — rounded dots instead of lines */}
          {[0,1,2].map(row => (
            <div key={row} style={{ display: "flex", gap: 3 }}>
              {[0,1,2].map(col => (
                <div key={col} style={{
                  width: 3, height: 3, borderRadius: "50%",
                  background: "#1a1820",
                  boxShadow: "inset 0 1px 1px rgba(0,0,0,0.4), 0 0.5px 0 rgba(255,255,255,0.03)",
                }} />
              ))}
            </div>
          ))}
          {/* Red recording light — chunky and cute */}
          <div style={{
            position: "absolute", bottom: 4,
            width: 6, height: 6, borderRadius: "50%",
            background: "#e02020",
            border: "1.5px solid #ff6666",
            boxShadow: "0 0 6px #e0202066, 0 0 12px #e0202033",
            animation: "blink 1.5s ease-in-out infinite",
          }} />
        </div>
      </div>

      {/* ── LITTLE ANTENNA — like an AC walkie-talkie ── */}
      <div style={{
        position: "absolute", top: -20, left: 32,
        display: "flex", flexDirection: "column", alignItems: "center",
        pointerEvents: "none",
      }}>
        {/* Antenna stick */}
        <div style={{
          width: 4, height: 16,
          background: "linear-gradient(180deg, #3a3640, #2a2630)",
          borderRadius: 2,
          boxShadow: "0 2px 4px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.08)",
        }} />
        {/* Antenna ball — the classic */}
        <div style={{
          width: 10, height: 10, borderRadius: "50%",
          background: "radial-gradient(circle at 40% 35%, #ff6666, #e02020, #aa1515)",
          border: "2px solid #ff8888",
          boxShadow: "0 2px 6px rgba(224,32,32,0.3), inset 0 1px 2px rgba(255,255,255,0.2)",
          marginTop: -2,
          order: -1,
        }} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME — play.fun edition
// say it loud. get points. go viral.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// SUPABASE — leaderboard + audio storage
// ═══════════════════════════════════════════════════════════════
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL !== "your-supabase-url-here"
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

async function uploadScream({ score, peakDb, rank, duration, chartData, audioBlob, playerName }) {
  if (!supabase) return null;
  let audioUrl = null;
  if (audioBlob) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from("screams")
      .upload(filename, audioBlob, { contentType: "audio/webm", upsert: false });
    if (!uploadErr && uploadData) {
      const { data: urlData } = supabase.storage.from("screams").getPublicUrl(filename);
      audioUrl = urlData?.publicUrl || null;
    }
  }
  const { data, error } = await supabase.from("screams").insert({
    score,
    peak_db: peakDb,
    rank_title: rank.title,
    rank_emoji: rank.em,
    duration,
    chart_data: chartData,
    audio_url: audioUrl,
    player_name: playerName || "anonymous",
  }).select().single();
  if (error) { console.error("upload error:", error); return null; }
  return data;
}

const TAUNTS = [
  "you won't.", "say it. we dare you.",
  "your neighbors can hear you. definitely.",
  "press the button, coward.", "it's just a word.",
  "everyone's done it. your turn.", "go on. we're waiting.",
  "you've been staring for a while.",
  "the button isn't going to press itself.",
  "still thinking about it?", "we believe in you. kind of.",
  "your boss is behind you. jk. or...",
  "you're overthinking a penis game.",
  "the internet is watching.",
  "do it for the culture.",
  "your ancestors didn't survive plagues for you to hesitate.",
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
  { min: -Infinity, title: "penis coward", sub: "you didn't even try", em: "🫣" },
  { minDb: -45, title: "penis whisperer", sub: "that barely counts", em: "🤫" },
  { minDb: -35, title: "penis mumbler", sub: "louder. we dare you.", em: "😶" },
  { minDb: -28, title: "penis sayer", sub: "the room heard that", em: "😳" },
  { minDb: -22, title: "penis announcer", sub: "the building heard that", em: "😤" },
  { minDb: -18, title: "penis broadcaster", sub: "the whole block knows", em: "📢" },
  { minDb: -14, title: "penis screamer", sub: "this can't be undone", em: "🗣️" },
  { minDb: -10, title: "penis menace", sub: "danger to society", em: "💀" },
  { minDb: -6, title: "penis legend", sub: "the internet heard", em: "👑" },
  { minDb: -3, title: "PENIS GOD", sub: "peak human courage", em: "✦" },
];

const getRank = (db) => { let r = RANKS[0]; for (const s of RANKS) if (s.minDb !== undefined && db >= s.minDb) r = s; return r; };
const getPhase = (db) => { if (db < -45) return 0; if (db < -35) return 1; if (db < -28) return 2; if (db < -22) return 3; if (db < -14) return 4; if (db < -8) return 5; return 6; };

const NUM_BARS = 40;
const GAME_DURATION = 6.9;
const MIN_DB = -60;
const MAX_DB = 0;
const CHART_POINTS = 120;
const AUDIO_CAPTURE_CONSTRAINTS = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
const VIDEO_CAPTURE_CONSTRAINTS = { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } };

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
  const [videoEnabled, setVideoEnabled] = useState(false);
  const [videoSetupState, setVideoSetupState] = useState("off");
  const previewStreamRef = useRef(null);
  const [previewStream, setPreviewStream] = useState(null);

  useEffect(() => { initSDK(); }, []);

  // Clean up preview stream on unmount
  useEffect(() => () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
    }
  }, []);

  const armVideoCapture = useCallback(async () => {
    if (videoSetupState === "requesting") return false;
    if (!navigator.mediaDevices?.getUserMedia) {
      setVideoEnabled(false);
      setVideoSetupState("denied");
      return false;
    }

    setVideoSetupState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CAPTURE_CONSTRAINTS,
        video: VIDEO_CAPTURE_CONSTRAINTS,
      });
      // Keep stream alive for preview
      previewStreamRef.current = stream;
      setPreviewStream(stream);
      setVideoEnabled(true);
      setVideoSetupState("ready");
      return true;
    } catch {
      setVideoEnabled(false);
      setVideoSetupState("denied");
      return false;
    }
  }, [videoSetupState]);

  const disarmVideoCapture = useCallback(() => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach(t => t.stop());
      previewStreamRef.current = null;
      setPreviewStream(null);
    }
    setVideoEnabled(false);
    setVideoSetupState("off");
  }, []);

  const onGameEnd = (res) => {
    savePoints(res.score);
    haptic("success");
    setResult(res);
    setScreen("result");
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      <ShaderBackground />
      <link href={FONT_LINK} rel="stylesheet" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />

      {screen === "home" && (
        <HomeScreen
          onPlay={() => setScreen("game")}
          onLeaderboard={() => setScreen("leaderboard")}
          videoEnabled={videoEnabled}
          videoSetupState={videoSetupState}
          onEnableVideo={armVideoCapture}
          onDisableVideo={disarmVideoCapture}
          previewStream={previewStream}
        />
      )}

      {screen === "game" && (
        <PenisGame onGameEnd={onGameEnd} autoStart videoEnabled={videoEnabled} />
      )}

      {screen === "result" && result && (
        <ResultScreen result={result}
          onAgain={() => setScreen("game")}
          onHome={() => setScreen("home")}
          onLeaderboard={() => setScreen("leaderboard")}
        />
      )}

      {screen === "leaderboard" && (
        <LeaderboardScreen
          onPlay={() => setScreen("home")}
          onHome={() => setScreen("home")}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// HOME SCREEN — the Nintendo treatment
// ═══════════════════════════════════════════════════════════════
function HomeScreen({ onPlay, onLeaderboard, videoEnabled, videoSetupState, onEnableVideo, onDisableVideo, previewStream }) {
  const [tauntIdx, setTauntIdx] = useState(0);
  const [tauntFade, setTauntFade] = useState(true);
  const [idleBounce, setIdleBounce] = useState(0);
  const [entered, setEntered] = useState(false);
  const [btnHover, setBtnHover] = useState(false);

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
  const cameraReady = videoSetupState === "ready";
  const cameraRequesting = videoSetupState === "requesting";
  const cameraDenied = videoSetupState === "denied";
  const cameraDot = cameraReady ? "#34c759" : cameraRequesting ? "#ff9f0a" : "#28242e";
  const cameraStatusText = cameraRequesting
    ? "approve cam + mic"
    : cameraReady
      ? "camera armed"
      : cameraDenied
        ? "camera blocked"
        : "records selfie replay";
  const startChips = [
    { label: "MODE", value: "SOLO", tone: "#e8e4e0" },
    { label: "ROUND", value: "6.9 SEC", tone: "#ffcc33" },
    { label: "CAPTURE", value: cameraReady ? "CAM ON" : cameraRequesting ? "ARMING" : "MIC ONLY", tone: cameraReady ? "#34c759" : cameraRequesting ? "#ff9f0a" : "#8a8694" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "transparent",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", userSelect: "none",
      padding: "20px 16px",
    }}>
      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      {/* Vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "inset 0 0 120px rgba(0,0,0,0.6)" }} />

      <div style={{
        transform: `translateY(${idleBounce}px)`,
        transition: "transform 0.3s ease-out",
      }}>
        <DeviceFrame
          ledActive={cameraReady || cameraRequesting}
          ledPulse={cameraReady || cameraRequesting}
          ledColor={cameraReady ? "#34c759" : "#ff9f0a"}
          statusText={supabase ? "LEADERBOARD" : undefined}
          onStatusClick={supabase ? onLeaderboard : undefined}
          controls={
            <>
              <div style={{
                textAlign: "center", marginBottom: 10,
                opacity: entered ? 1 : 0,
                transform: entered ? "translateY(0)" : "translateY(16px)",
                transition: "opacity 0.7s ease 0.18s, transform 0.7s ease 0.18s",
              }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: "#666", letterSpacing: 4, marginBottom: 5 }}>
                  PLAYER ONE
                </div>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "7px 12px", borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.22)",
                  animation: "pressPrompt 2.4s ease-in-out infinite",
                }}>
                  <span style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: accent,
                    boxShadow: "0 0 10px rgba(224,32,32,0.55)",
                    animation: "blink 1.2s ease-in-out infinite",
                  }} />
                  <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: "#d4d0cc", letterSpacing: 2.5, fontWeight: 500 }}>
                    PRESS THE RED BUTTON
                  </span>
                </div>
              </div>

              {/* ═══ THE BUTTON — big, juicy, Nintendo tactile ═══ */}
              <div style={{
                position: "relative", marginBottom: 16,
                opacity: entered ? 1 : 0,
                transform: entered ? "translateY(0) scale(1)" : "translateY(30px) scale(0.8)",
                transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.25s, transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 0.25s",
              }}>
                {/* Subtle glow ring */}
                <div style={{
                  position: "absolute", inset: btnHover ? -20 : -16, borderRadius: "50%",
                  background: "transparent", pointerEvents: "none",
                  boxShadow: btnHover
                    ? `0 0 30px ${accent}18, 0 0 60px ${accent}0a`
                    : `0 0 20px ${accent}08, 0 0 40px ${accent}04`,
                  animation: "breathe 3s ease-in-out infinite",
                  transition: "inset 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }} />
                {/* Pulse ring */}
                <div style={{
                  position: "absolute", inset: btnHover ? -12 : -8, borderRadius: "50%",
                  border: `1px solid ${btnHover ? accent + "20" : accent + "0a"}`,
                  pointerEvents: "none",
                  animation: "pulseRing 2.5s ease-in-out infinite",
                  transition: "inset 0.5s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.5s ease",
                }} />
                {/* Button housing */}
                <div style={{
                  width: 176, height: 176, borderRadius: "50%",
                  background: btnHover
                    ? "linear-gradient(145deg, #252530, #141418)"
                    : "linear-gradient(145deg, #1e1e28, #111116)",
                  border: `1px solid ${btnHover ? "#2a2a3a" : "#222230"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: btnHover
                    ? "0 12px 36px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.4)"
                    : "0 8px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
                  transition: "background 0.5s ease, border-color 0.5s ease, box-shadow 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
                }}>
                  <button
                    onClick={() => { haptic("nudge"); onPlay(); }}
                    onMouseEnter={() => setBtnHover(true)}
                    onMouseLeave={() => setBtnHover(false)}
                    style={{
                    width: 148, height: 148, borderRadius: "50%",
                    border: "none", cursor: "pointer", outline: "none",
                    position: "relative", zIndex: 50,
                    WebkitTapHighlightColor: "transparent",
                    background: btnHover
                      ? "radial-gradient(circle at 40% 28%, #ff3838 0%, #d42020 30%, #a81515 60%, #7a0e0e 100%)"
                      : "radial-gradient(circle at 38% 32%, #dd2828 0%, #b81818 35%, #8a1010 70%, #6a0c0c 100%)",
                    boxShadow: btnHover
                      ? "0 8px 24px rgba(224,32,32,0.2), 0 3px 8px rgba(0,0,0,0.4), inset 0 -5px 12px rgba(0,0,0,0.3), inset 0 5px 14px rgba(255,150,150,0.12)"
                      : "0 6px 20px rgba(200,20,20,0.15), 0 2px 6px rgba(0,0,0,0.35), inset 0 -5px 12px rgba(0,0,0,0.35), inset 0 5px 12px rgba(255,130,130,0.08)",
                    animation: btnHover ? "none" : "buttonBreathe 3s ease-in-out infinite",
                    transform: btnHover ? "scale(1.03)" : "scale(1)",
                    transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease, box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                  }}>
                    {/* Specular highlight — that Nintendo gloss */}
                    <div style={{
                      position: "absolute", top: btnHover ? "4%" : "6%", left: btnHover ? "12%" : "14%",
                      width: btnHover ? "48%" : "44%", height: btnHover ? "28%" : "24%", borderRadius: "50%",
                      background: btnHover
                        ? "radial-gradient(ellipse, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0.10) 40%, transparent 70%)"
                        : "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)",
                      pointerEvents: "none",
                      transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    }} />
                    {/* Secondary highlight — bottom rim light */}
                    <div style={{
                      position: "absolute", bottom: "8%", left: "30%",
                      width: "40%", height: btnHover ? "12%" : "8%", borderRadius: "50%",
                      background: btnHover
                        ? "radial-gradient(ellipse, rgba(255,180,180,0.12) 0%, transparent 70%)"
                        : "radial-gradient(ellipse, rgba(255,180,180,0.06) 0%, transparent 70%)",
                      pointerEvents: "none",
                      transition: "all 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                    }} />
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={btnHover ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.6)"} strokeWidth="1.5" style={{
                      marginBottom: 7,
                      filter: btnHover ? "drop-shadow(0 1px 6px rgba(255,200,200,0.4))" : "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
                      transition: "filter 0.4s ease, stroke 0.4s ease",
                    }}>
                      <rect x="9" y="2" width="6" height="12" rx="3" />
                      <path d="M5 10a7 7 0 0 0 14 0" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <span style={{
                      fontFamily: "'DM Sans'", fontSize: 13,
                      fontWeight: 600, letterSpacing: btnHover ? 5 : 3,
                      color: btnHover ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.8)",
                      textShadow: btnHover ? "0 0 12px rgba(255,180,180,0.5), 0 1px 4px rgba(0,0,0,0.3)" : "0 1px 4px rgba(0,0,0,0.3)",
                      transition: "color 0.4s ease, letter-spacing 0.5s cubic-bezier(0.16, 1, 0.3, 1), text-shadow 0.4s ease",
                    }}>SAY IT</span>
                  </button>
                </div>
              </div>

            </>
          }
        >
          {/* Camera preview background */}
          {previewStream && previewStream.getVideoTracks().length > 0 && (
            <>
              <video
                ref={el => {
                  if (el && el.srcObject !== previewStream) el.srcObject = previewStream;
                }}
                autoPlay muted playsInline
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 1,
                  transform: "scaleX(-1)",
                  animation: "fadeIn 0.5s",
                  pointerEvents: "none",
                  borderRadius: 20,
                }}
              />
              <div style={{
                position: "absolute", inset: 0, zIndex: 2,
                background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.7) 40%, rgba(0,0,0,0.85) 100%)",
                borderRadius: 20, pointerEvents: "none",
              }} />
            </>
          )}

          {/* ═══ SCREEN CONTENT — fills the screen like a real Game Boy ═══ */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", minHeight: 0, position: "relative", zIndex: 10 }}>

            {/* Trophy — leaderboard shortcut */}
            <button
              onClick={onLeaderboard}
              style={{
                position: "absolute", top: 8, right: 8,
                background: "none", border: "none", cursor: "pointer",
                padding: 6, opacity: entered ? 0.5 : 0,
                transition: "opacity 0.6s ease 0.4s, transform 0.2s ease",
                zIndex: 20,
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = "1"}
              onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c8a832" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2" />
                <path d="M18 9h2a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2" />
                <path d="M6 3h12v7a6 6 0 0 1-12 0V3z" />
                <path d="M9 21h6" />
                <path d="M12 16v5" />
              </svg>
            </button>

            {/* Title — centered hero */}
            <div style={{
              textAlign: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0) scale(1)" : "translateY(12px) scale(0.97)",
              transition: "opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)",
              marginBottom: 24,
            }}>
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: 11,
                fontWeight: 400, letterSpacing: 6, color: "#999",
                marginBottom: 2, textTransform: "uppercase",
              }}>the</div>
              <h1 style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 72,
                fontWeight: 600, fontStyle: "italic",
                letterSpacing: 5,
                color: "#f0ece8",
                lineHeight: 0.9, margin: 0,
                textShadow: "0 0 40px rgba(224,32,32,0.12), 0 2px 16px rgba(0,0,0,0.4)",
              }}>penis</h1>
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: 11,
                fontWeight: 400, letterSpacing: 6, color: "#999",
                marginTop: 4, textTransform: "uppercase",
              }}>game</div>
            </div>

            {/* Instructions */}
            <div style={{
              textAlign: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.6s ease 0.15s, transform 0.6s ease 0.15s",
              marginBottom: 20,
            }}>
              <div style={{
                fontFamily: "'DM Sans'", fontSize: 15,
                fontWeight: 400, color: "#999", lineHeight: 1.6,
              }}>scream <span style={{ color: "#f0ece8", fontWeight: 600 }}>PENIS</span> as loud as you can</div>
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: 11,
                fontWeight: 400, color: "#666", marginTop: 6,
              }}>you have <span style={{ color: "#ffcc33", fontWeight: 600 }}>6.9</span> seconds</div>
            </div>

            {/* Taunt — cycling */}
            <div style={{
              textAlign: "center", height: 20,
              opacity: entered ? 1 : 0,
              transition: "opacity 0.8s ease 0.5s",
            }}>
              <div style={{
                fontFamily: "'Cormorant Garamond'", fontSize: 15,
                fontWeight: 400, fontStyle: "italic", color: "#777",
                opacity: tauntFade ? 1 : 0,
                transform: tauntFade ? "translateY(0)" : "translateY(-3px)",
                transition: "opacity 0.3s, transform 0.3s",
              }}>{TAUNTS[tauntIdx]}</div>
            </div>

          </div>

          {/* REC toggle — bottom of screen */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: entered ? 1 : 0,
            transition: "opacity 0.8s ease 0.4s",
            flexShrink: 0, position: "relative", zIndex: 10,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: videoEnabled ? "#e8e4e0" : "#555", letterSpacing: 1, fontWeight: 500, transition: "color 0.2s" }}>
              REC
            </span>
            <button
              onClick={() => {
                if (cameraRequesting) return;
                if (videoEnabled) { onDisableVideo(); } else { onEnableVideo(); }
              }}
              aria-label={videoEnabled ? "Disable camera recording" : "Enable camera recording"}
              disabled={cameraRequesting}
              style={{
                width: 34, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
                background: videoEnabled ? "#e02020" : "#1a1820",
                position: "relative", transition: "background 0.2s",
                outline: "none", WebkitTapHighlightColor: "transparent",
                boxShadow: videoEnabled ? "0 0 8px #e0202033" : "inset 0 1px 2px rgba(0,0,0,0.4)",
                opacity: cameraRequesting ? 0.7 : 1,
              }}
            >
              <div style={{
                width: 16, height: 16, borderRadius: "50%", background: "#e8e4e0",
                position: "absolute", top: 2,
                left: videoEnabled ? 16 : 2,
                transition: "left 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
              }} />
            </button>
          </div>
        </DeviceFrame>
      </div>

      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
        @keyframes pulseRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
        @keyframes buttonBreathe { 0%, 100% { transform: scale(1); box-shadow: 0 8px 28px rgba(200,20,20,0.3), 0 2px 8px rgba(0,0,0,0.4), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 6px 14px rgba(255,130,130,0.1); } 50% { transform: scale(1.04); box-shadow: 0 10px 36px rgba(200,20,20,0.4), 0 2px 8px rgba(0,0,0,0.4), inset 0 -6px 14px rgba(0,0,0,0.35), inset 0 6px 14px rgba(255,130,130,0.12); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes pressPrompt { 0%, 100% { transform: translateY(0); box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 18px rgba(0,0,0,0.22); } 50% { transform: translateY(2px); box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 10px 24px rgba(0,0,0,0.28); } }
        @keyframes micSwing { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.93) !important; transition: transform 0.06s !important; }
        .leaderboard-link:hover { color: #888 !important; letter-spacing: 4px !important; }
        ::-webkit-scrollbar { width: 0px; }
        .device-screen-content { scrollbar-width: none; -ms-overflow-style: none; }
        .device-screen-content::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// THE PENIS GAME — the core. preserved. + audio recording + chart + speech
// ═══════════════════════════════════════════════════════════════
function PenisGame({ onGameEnd, autoStart, videoEnabled }) {
  const [gameState, setGameState] = useState(autoStart ? "countdown" : "idle");
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
  const [wordCount, setWordCount] = useState(0);
  const [countdown, setCountdown] = useState(autoStart ? 3 : null);

  const gameStateRef = useRef(autoStart ? "countdown" : "idle");
  const startTimeRef = useRef(0);
  const scoreRef = useRef(0);
  const peakDbRef = useRef(-60);
  const lastPhaseRef = useRef(0);
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
  const wordCountRef = useRef(0);
  const lastWordTimeRef = useRef(0);
  const lastPointsPush = useRef(0);

  // Video recording refs
  const videoStreamRef = useRef(null);
  const videoRecorderRef = useRef(null);
  const videoChunksRef = useRef([]);
  const videoPreviewRef = useRef(null);
  const videoMimeRef = useRef("video/webm");

  // Composite canvas for recording video + UI overlay
  const compositeCanvasRef = useRef(null);
  const compositeCtxRef = useRef(null);
  const compositeVideoElRef = useRef(null);

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
      const constraints = {
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      };
      if (videoEnabled) {
        constraints.video = { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } };
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (e) {
        // If video+audio failed, try audio only
        if (videoEnabled) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          });
        } else {
          throw e;
        }
      }

      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 2048; an.smoothingTimeConstant = 0.3;
      src.connect(an);
      analyserRef.current = an; audioCtxRef.current = ctx; streamRef.current = stream;
      pcmBufRef.current = new Float32Array(an.fftSize);
      freqBufRef.current = new Uint8Array(an.frequencyBinCount);

      // Audio recorder
      try {
        const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        recorderRef.current = rec;
      } catch {}

      // Video — set up composite canvas for recording UI + camera
      if (stream.getVideoTracks().length > 0) {
        videoStreamRef.current = stream;

        // Create offscreen canvas for compositing
        const canvas = document.createElement("canvas");
        canvas.width = 720; canvas.height = 1280;
        compositeCanvasRef.current = canvas;
        compositeCtxRef.current = canvas.getContext("2d");

        // Hidden video element to read camera frames
        const vid = document.createElement("video");
        vid.srcObject = stream;
        vid.muted = true; vid.playsInline = true;
        vid.play().catch(() => {});
        compositeVideoElRef.current = vid;

        // Record the composite canvas stream (with audio from mic)
        const canvasStream = canvas.captureStream(30);
        // Add audio track from original stream
        const audioTracks = stream.getAudioTracks();
        audioTracks.forEach(t => canvasStream.addTrack(t));

        const videoMime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(
          m => MediaRecorder.isTypeSupported(m)
        ) || "video/webm";
        videoMimeRef.current = videoMime;
        try {
          const vrec = new MediaRecorder(canvasStream, { mimeType: videoMime });
          vrec.ondataavailable = (e) => { if (e.data.size > 0) videoChunksRef.current.push(e.data); };
          videoRecorderRef.current = vrec;
        } catch {}
      }

      // Speech recognition
      try {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
          const sr = new SR(); sr.continuous = true; sr.interimResults = true;
          sr.onresult = (e) => {
            for (let i = e.resultIndex; i < e.results.length; i++) {
              const t = e.results[i][0].transcript.toLowerCase();
              if (/penis|peanut|peen|keen/.test(t)) {
                if (!wordBonusRef.current) { wordBonusRef.current = true; setWordDetected(true); }
                const now = Date.now();
                if (e.results[i].isFinal && now - lastWordTimeRef.current > 600) {
                  lastWordTimeRef.current = now;
                  wordCountRef.current += 1;
                  setWordCount(wordCountRef.current);
                  scoreRef.current += (e.results[i][0].confidence || 0.5) * 100;
                }
              }
            }
          };
          speechRef.current = sr;
        }
      } catch {}
      setMicReady(true);
      return true;
    } catch { setMicDenied(true); return false; }
  }, [videoEnabled]);

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

  // ─── COMPOSITE FRAME — draws video + UI to canvas for recording ───
  const drawCompositeFrame = useCallback((score, db, peakDb, norm, elapsed, chartArr, barsArr) => {
    const canvas = compositeCanvasRef.current;
    const ctx = compositeCtxRef.current;
    const video = compositeVideoElRef.current;
    if (!canvas || !ctx) return;

    const W = canvas.width, H = canvas.height;
    const phase = getPhase(peakDb);

    // Draw video frame (mirrored)
    if (video && video.readyState >= 2) {
      ctx.save();
      ctx.translate(W, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, W, H);
      ctx.restore();
    } else {
      ctx.fillStyle = "#0a0a10";
      ctx.fillRect(0, 0, W, H);
    }

    // Dark overlay
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(0,0,0,0.75)");
    grad.addColorStop(0.4, "rgba(0,0,0,0.6)");
    grad.addColorStop(1, "rgba(0,0,0,0.8)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // "penis" text
    const penisSize = Math.min(80, 48 + norm * 30);
    ctx.font = `italic ${Math.min(700, 300 + norm * 500)} ${penisSize}px 'Cormorant Garamond', serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = phase >= 5 ? "#fff" : phase >= 3 ? "#fff5f0" : "#f0ece8";
    ctx.shadowColor = `rgba(224,32,32,${0.2 + norm * 0.4})`;
    ctx.shadowBlur = 15 + norm * 40;
    ctx.fillText("penis", W / 2, H * 0.22);
    ctx.shadowBlur = 0;

    // Hero score
    const scoreSize = Math.min(100, 72 + norm * 30);
    ctx.font = `600 ${scoreSize}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = "#e02020";
    ctx.shadowColor = "rgba(224,32,32,0.3)";
    ctx.shadowBlur = 30 + norm * 40;
    ctx.fillText(Math.floor(score).toLocaleString(), W / 2, H * 0.42);
    ctx.shadowBlur = 0;

    // POINTS label
    ctx.font = "400 14px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#666";
    ctx.letterSpacing = "5px";
    ctx.fillText("POINTS", W / 2, H * 0.46);
    ctx.letterSpacing = "0px";

    // dB display
    const dbDisp = (60 + db).toFixed(0);
    const peakDisp = (60 + peakDb).toFixed(0);
    ctx.font = "200 36px 'JetBrains Mono', monospace";
    ctx.fillStyle = norm > 0.7 ? "#ff2222" : "#e02020";
    ctx.fillText(`${dbDisp}dB`, W / 2 - 80, H * 0.56);
    ctx.fillStyle = "#e8e4e0";
    ctx.fillText(`${peakDisp}dB`, W / 2 + 80, H * 0.56);

    ctx.font = "400 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#44444e";
    ctx.fillText("VOLUME", W / 2 - 80, H * 0.52);
    ctx.fillText("PEAK", W / 2 + 80, H * 0.52);

    // Timer
    const remaining = Math.max(0, GAME_DURATION - elapsed);
    ctx.font = "200 24px 'JetBrains Mono', monospace";
    ctx.fillStyle = remaining < 2 ? "#ff4444" : "#888";
    ctx.fillText(`${remaining.toFixed(1)}s`, W / 2, H * 0.64);

    // Frequency bars
    if (barsArr && barsArr.length > 0) {
      const barW = (W * 0.8) / barsArr.length;
      const barMaxH = H * 0.08;
      const barY = H * 0.72;
      const barX0 = W * 0.1;
      for (let i = 0; i < barsArr.length; i++) {
        const v = barsArr[i];
        const h = Math.max(1, v * barMaxH);
        ctx.fillStyle = v > 0.7 ? "#ff2222" : v > 0.4 ? "#e02020" : "rgba(224,32,32,0.4)";
        ctx.fillRect(barX0 + i * barW, barY - h, barW - 1, h);
      }
    }

    // Chart
    if (chartArr && chartArr.length > 3) {
      const cX0 = W * 0.08, cW2 = W * 0.84, cY0 = H * 0.78, cH2 = H * 0.12;
      ctx.beginPath();
      for (let i = 0; i < chartArr.length; i++) {
        const x = cX0 + (i / (CHART_POINTS - 1)) * cW2;
        const y = cY0 + cH2 - chartArr[i] * cH2;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#e02020";
      ctx.lineWidth = 2;
      ctx.stroke();

      // Fill under chart
      ctx.lineTo(cX0 + ((chartArr.length - 1) / (CHART_POINTS - 1)) * cW2, cY0 + cH2);
      ctx.lineTo(cX0, cY0 + cH2);
      ctx.closePath();
      const cGrad = ctx.createLinearGradient(0, cY0, 0, cY0 + cH2);
      cGrad.addColorStop(0, "rgba(224,32,32,0.25)");
      cGrad.addColorStop(1, "rgba(224,32,32,0)");
      ctx.fillStyle = cGrad;
      ctx.fill();

      // $PENIS label
      ctx.font = "400 12px 'JetBrains Mono', monospace";
      ctx.fillStyle = "#33333c";
      ctx.textAlign = "left";
      ctx.fillText("$PENIS", cX0, cY0 - 4);
      ctx.textAlign = "center";
    }

    // THE PENIS GAME watermark
    ctx.font = "300 12px 'JetBrains Mono', monospace";
    ctx.fillStyle = "rgba(224,32,32,0.25)";
    ctx.fillText("THE PENIS GAME", W / 2, H * 0.96);
  }, []);

  // ─── GAME LOOP ───
  const loop = useCallback(() => {
    if (gameStateRef.current !== "listening") return;
    const now = Date.now();
    const elapsed = (now - startTimeRef.current) / 1000;
    setDuration(elapsed);

    const db = computeRmsDb();
    const norm = Math.max(0, Math.min(1, (db - MIN_DB) / (MAX_DB - MIN_DB)));
    setDbLevel(db); setRmsNorm(norm); shaderIntensity = norm;
    if (db > peakDbRef.current) { peakDbRef.current = db; setPeakDb(db); }
    setBars(computeBars());

    chartRef.current.push(norm);
    setChartData(chartRef.current.slice(-CHART_POINTS));

    const phase = getPhase(peakDbRef.current);

    // Haptic pulse on dB threshold crossing
    if (phase > lastPhaseRef.current) {
      lastPhaseRef.current = phase;
      haptic([40 + phase * 15]);
    }

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

    // Draw composite frame for video recording
    drawCompositeFrame(scoreRef.current, db, peakDbRef.current, norm, elapsed, chartRef.current.slice(-CHART_POINTS), computeBars());

    frameRef.current = requestAnimationFrame(loop);
  }, [computeRmsDb, computeBars, drawCompositeFrame]);

  const launchGame = useCallback(() => {
    gameStateRef.current = "listening"; setGameState("listening");
    setCountdown(null);
    startTimeRef.current = Date.now();
    scoreRef.current = 0; peakDbRef.current = -60;
    warnIdxRef.current = 0; lastWarnRef.current = Date.now();
    lastFlashRef.current = 0; lastPointsPush.current = 0;
    wordBonusRef.current = false; wordCountRef.current = 0; lastWordTimeRef.current = 0;
    chunksRef.current = []; chartRef.current = []; videoChunksRef.current = [];
    setDuration(0); setDbLevel(-60); setPeakDb(-60); setRmsNorm(0); setScore(0);
    setWarnings([]); setOnAir(false); setResult(null);
    setWordScale(1); setListeners(0); setBars(new Array(NUM_BARS).fill(0));
    setTimeLeft(GAME_DURATION); setWordDetected(false); setWordCount(0); setChartData([]);
    if (recorderRef.current) try {
      recorderRef.current.start(500);
      setTimeout(() => { if (recorderRef.current?.state === "recording") try { recorderRef.current.stop(); } catch {} }, 8000);
    } catch {}
    // Start video recorder
    if (videoRecorderRef.current) try {
      videoRecorderRef.current.start(500);
      setTimeout(() => { if (videoRecorderRef.current?.state === "recording") try { videoRecorderRef.current.stop(); } catch {} }, 8000);
    } catch {}
    try { speechRef.current?.start(); } catch {}
    frameRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const startGame = useCallback(async () => {
    if (gameStateRef.current === "listening" || gameStateRef.current === "mic-prompt") return;
    if (!micReady) {
      gameStateRef.current = "mic-prompt"; setGameState("mic-prompt");
      const ok = await initMic();
      if (!ok) { gameStateRef.current = "idle"; setGameState("idle"); return; }
    }
    // Don't block on resume — it hangs without a user gesture (e.g. autoStart from useEffect)
    if (audioCtxRef.current?.state === "suspended") {
      try { await Promise.race([audioCtxRef.current.resume(), new Promise(r => setTimeout(r, 300))]); } catch {}
    }

    // ─── COUNTDOWN ───
    gameStateRef.current = "countdown"; setGameState("countdown");
    setCountdown(3);
    await new Promise(r => setTimeout(r, 900));
    if (gameStateRef.current !== "countdown") return;
    setCountdown(2);
    await new Promise(r => setTimeout(r, 900));
    if (gameStateRef.current !== "countdown") return;
    setCountdown(1);
    await new Promise(r => setTimeout(r, 900));
    if (gameStateRef.current !== "countdown") return;
    setCountdown("SAY PENIS");
    await new Promise(r => setTimeout(r, 700));

    if (gameStateRef.current !== "countdown") return; // user navigated away
    launchGame();
  }, [micReady, initMic, launchGame]);

  // ─── AUTO-START on mount ───
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStart && !autoStarted.current) {
      autoStarted.current = true;
      startGame();
    }
  }, [autoStart, startGame]);

  const [screenGlitch, setScreenGlitch] = useState(false);

  const endGame = useCallback(() => {
    // Screen glitch — the device "sighs" before showing results
    setScreenGlitch(true);
    setTimeout(() => setScreenGlitch(false), 400);
    gameStateRef.current = "result"; setGameState("result");
    shaderIntensity = 0;
    setOnAir(false); setShake(0); setWordScale(1); setWordShake(0);
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    try { speechRef.current?.stop(); } catch {}
    const fs = Math.floor(scoreRef.current);
    const fp = peakDbRef.current;
    const fd = (Date.now() - startTimeRef.current) / 1000;
    const chartSnapshot = [...chartRef.current];
    setBest(b => Math.max(b, fs)); setSessions(s => s + 1);
    const resultData = { duration: fd, score: fs, peakDb: fp, rank: getRank(fp), listeners, wordDetected: wordBonusRef.current, wordCount: wordCountRef.current, chartData: chartSnapshot };
    setResult(resultData);

    const finalize = (audioBlob, videoBlob) => onGameEnd({ ...resultData, audioBlob, videoBlob, videoMimeType: videoMimeRef.current });

    // Collect video blob
    const collectVideo = () => {
      if (videoRecorderRef.current?.state === "recording") {
        return new Promise(resolve => {
          videoRecorderRef.current.onstop = () => {
            resolve(videoChunksRef.current.length > 0 ? new Blob(videoChunksRef.current, { type: videoMimeRef.current }) : null);
          };
          try { videoRecorderRef.current.stop(); } catch { resolve(null); }
        });
      }
      return Promise.resolve(videoChunksRef.current.length > 0 ? new Blob(videoChunksRef.current, { type: videoMimeRef.current }) : null);
    };

    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = () => {
        const audioBlob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "audio/webm" }) : null;
        collectVideo().then(videoBlob => finalize(audioBlob, videoBlob));
      };
      try { recorderRef.current.stop(); } catch { collectVideo().then(vb => finalize(null, vb)); }
    } else {
      const audioBlob = chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "audio/webm" }) : null;
      collectVideo().then(videoBlob => finalize(audioBlob, videoBlob));
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
  const isMicPrompt = gameState === "mic-prompt";
  const cameraLive = videoEnabled && Boolean(videoStreamRef.current?.getVideoTracks().length);

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
      minHeight: "100vh", background: flash ? "rgba(255,17,17,0.03)" : "transparent",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      overflow: "hidden", position: "relative", userSelect: "none",
      transition: flash ? "none" : "background 0.5s",
      padding: "20px 16px",
    }}>
      {/* Grain */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: `inset 0 0 ${100 + phase * 25}px rgba(0,0,0,0.55)` }} />

      {isLive && rmsNorm > 0.05 && <div style={{
        position: "absolute", top: "35%", left: "50%",
        width: 250 + rmsNorm * 350, height: 250 + rmsNorm * 350,
        transform: "translate(-50%, -50%)", borderRadius: "50%",
        background: `radial-gradient(circle, ${glow} 0%, transparent 65%)`,
        pointerEvents: "none", zIndex: 1,
      }} />}

      <div style={{
        transform: `translate(${sx}px, ${sy}px)`,
        transition: shake > 0 ? "none" : "transform 0.2s",
        animation: screenGlitch ? "screenGlitch 0.4s ease-out" : "none",
      }}>
        <DeviceFrame
          ledActive={cameraLive || (isLive && rmsNorm > 0.02)}
          ledPulse={cameraLive ? false : isLive}
          ledColor={cameraLive ? "#34c759" : isLive && rmsNorm > 0.5 ? "#ff2222" : "#e02020"}
          statusText={cameraLive ? (isLive ? "CAM + MIC LIVE" : "CAM READY") : isLive ? (phase >= 4 ? "YOUR DIGNITY LEFT THE BUILDING" : "RECORDING") : "AN EXERCISE IN SHAMELESSNESS"}
          controls={
            <div style={{ position: "relative", opacity: isCountdown || isMicPrompt ? 0.3 : 1, transition: "opacity 0.3s", pointerEvents: isCountdown || isMicPrompt ? "none" : "auto" }}>
                {isIdle && <div style={{
                  position: "absolute", inset: -16, borderRadius: "50%",
                  background: "transparent", pointerEvents: "none",
                  boxShadow: `0 0 40px ${accent}10, 0 0 80px ${accent}06`,
                  animation: "breathe 3s ease-in-out infinite",
                }} />}
                {isIdle && <div style={{
                  position: "absolute", inset: -8, borderRadius: "50%",
                  border: `1.5px solid ${accent}18`, pointerEvents: "none",
                  animation: "pulseRing 2.5s ease-in-out infinite",
                }} />}
                {isLive && rmsNorm > 0.05 && <div style={{
                  position: "absolute", inset: -10, borderRadius: "50%", pointerEvents: "none",
                  border: `1.5px solid ${hotAccent}${Math.min(60, Math.floor(rmsNorm * 80)).toString(16).padStart(2, '0')}`,
                  boxShadow: `0 0 ${14 + rmsNorm * 30}px ${glow}`,
                }} />}
                {isLive && (
                  <svg width="180" height="180" style={{ position: "absolute", inset: -10, transform: "rotate(-90deg)", pointerEvents: "none" }}>
                    <circle cx="90" cy="90" r="84" fill="none"
                      stroke="#1a1c28" strokeWidth="2" />
                    <circle cx="90" cy="90" r="84" fill="none"
                      stroke={timeLeft < 2 ? "#ff4444" : hotAccent + "66"}
                      strokeWidth="2"
                      strokeDasharray="528 528"
                      strokeDashoffset="0"
                      strokeLinecap="round"
                      style={{
                        animation: `timerDrain ${GAME_DURATION}s linear forwards`,
                      }} />
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
                  <button onClick={isLive ? endGame : startGame} className="game-btn" style={{
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
                    transition: "transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.3s ease, box-shadow 0.4s ease",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    position: "relative", overflow: "hidden",
                  }}>
                    {/* Specular highlight */}
                    <div style={{
                      position: "absolute", top: "10%", left: "18%",
                      width: "38%", height: "20%", borderRadius: "50%",
                      background: "radial-gradient(ellipse, rgba(255,255,255,0.12) 0%, transparent 70%)",
                      pointerEvents: "none",
                      transition: "all 0.4s ease",
                    }} />
                    {/* Trapped star — inner core glow that intensifies with audio */}
                    {isLive && (
                      <div style={{
                        position: "absolute", inset: 0, borderRadius: "50%", pointerEvents: "none",
                        background: `radial-gradient(circle at 50% 50%, rgba(255,${180 - rmsNorm * 120},${180 - rmsNorm * 160},${0.05 + rmsNorm * 0.2}) 0%, transparent ${40 + rmsNorm * 20}%)`,
                        transition: "background 0.06s",
                      }} />
                    )}
                    {isLive ? (
                      <>
                        <div style={{
                          fontFamily: "'JetBrains Mono'", fontSize: 34,
                          fontWeight: 200, color: timeLeft < 2 ? "#ff4444" : "#fff",
                          letterSpacing: 2, lineHeight: 1,
                          textShadow: `0 0 ${8 + rmsNorm * 12}px rgba(255,255,255,${0.1 + rmsNorm * 0.15})`,
                          transition: "color 0.3s ease",
                        }}>{timeLeft.toFixed(1)}</div>
                        <div style={{
                          fontFamily: "'JetBrains Mono'", fontSize: 9,
                          fontWeight: 300, letterSpacing: 2,
                          color: "rgba(255,255,255,0.4)", marginTop: 3,
                          transition: "color 0.3s ease",
                        }}>{timeLeft < 2 ? "GO GO GO" : "SEC LEFT"}</div>
                      </>
                    ) : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.5" style={{
                          marginBottom: 6,
                          transition: "filter 0.3s ease",
                        }}>
                          <rect x="9" y="2" width="6" height="12" rx="3" />
                          <path d="M5 10a7 7 0 0 0 14 0" />
                          <line x1="12" y1="17" x2="12" y2="21" />
                        </svg>
                        <span style={{
                          fontFamily: "'DM Sans'", fontSize: 12,
                          fontWeight: 500, letterSpacing: 2,
                          color: "rgba(255,255,255,0.7)",
                          transition: "color 0.3s ease, letter-spacing 0.4s cubic-bezier(0.16, 1, 0.3, 1), text-shadow 0.3s ease",
                        }}>SAY IT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
          }
        >
          {/* ═══ SCREEN CONTENT ═══ */}

          {/* Selfie — full screen background with dark filter */}
          {videoStreamRef.current && (
            <>
              <video
                ref={el => {
                  if (el && el.srcObject !== videoStreamRef.current) {
                    el.srcObject = videoStreamRef.current;
                  }
                  videoPreviewRef.current = el;
                }}
                autoPlay muted playsInline
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 1,
                  transform: "scaleX(-1)",
                  animation: "fadeIn 0.5s",
                  pointerEvents: "none",
                  borderRadius: 20,
                }}
              />
              {/* Dark overlay so UI stays readable */}
              <div style={{
                position: "absolute", inset: 0, zIndex: 2,
                background: "linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.65) 40%, rgba(0,0,0,0.8) 100%)",
                borderRadius: 20, pointerEvents: "none",
              }} />
            </>
          )}

          {/* ═══ SCREEN CRACK — appears when screaming hard ═══ */}
          {isLive && phase >= 4 && (
            <svg style={{
              position: "absolute", inset: 0, zIndex: 45, pointerEvents: "none",
              opacity: Math.min(1, (phase - 3) * 0.3) * rmsNorm,
              transition: "opacity 0.1s",
            }} viewBox="0 0 380 400" preserveAspectRatio="none">
              {/* Hairline fractures radiating from center — the screen can't contain the sound */}
              <path d="M190 200 L165 140 L155 90 L148 40" fill="none" stroke="#ffffff08" strokeWidth="0.5" />
              <path d="M190 200 L220 150 L240 100 L260 55" fill="none" stroke="#ffffff06" strokeWidth="0.5" />
              <path d="M190 200 L140 220 L80 235 L30 240" fill="none" stroke="#ffffff05" strokeWidth="0.5" />
              <path d="M190 200 L230 240 L280 260 L340 265" fill="none" stroke="#ffffff06" strokeWidth="0.5" />
              <path d="M190 200 L200 270 L195 330 L190 380" fill="none" stroke="#ffffff04" strokeWidth="0.5" />
              {phase >= 5 && <>
                <path d="M190 200 L150 170 L100 150 L40 145" fill="none" stroke="#ff222208" strokeWidth="0.8" />
                <path d="M190 200 L250 190 L310 170 L360 160" fill="none" stroke="#ff222206" strokeWidth="0.8" />
                <path d="M190 200 L170 260 L140 320 L120 370" fill="none" stroke="#ff222205" strokeWidth="0.8" />
              </>}
            </svg>
          )}

          {/* ═══ OBSIDIAN DEPTH — the screen has depth, not flat black ═══ */}
          {isLive && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
              background: `radial-gradient(ellipse at ${50 + rmsNorm * 10}% ${40 + rmsNorm * 15}%, rgba(224,32,32,${0.02 + rmsNorm * 0.04}) 0%, transparent 50%)`,
              transition: "background 0.1s",
            }} />
          )}

          {/* ═══ MIC PERMISSION OVERLAY ═══ */}
          {isMicPrompt && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 50,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              borderRadius: 20,
            }}>
              <div style={{ textAlign: "center", animation: "fadeIn 0.5s", maxWidth: 320, padding: "0 24px" }}>
                {/* Pulsing mic icon */}
                <div style={{
                  width: 80, height: 80, borderRadius: "50%",
                  background: "radial-gradient(circle at 40% 34%, #1e1e28 0%, #111116 100%)",
                  border: "1px solid #222230",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 24px",
                  boxShadow: "0 0 40px #e0202015, 0 8px 30px rgba(0,0,0,0.4)",
                  animation: "breathe 2.5s ease-in-out infinite",
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#e02020" strokeWidth="1.5" style={{ filter: "drop-shadow(0 0 8px #e0202044)" }}>
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10a7 7 0 0 0 14 0" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>

                <h2 style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: 28, fontWeight: 300, fontStyle: "italic",
                  color: "#f0ece8", letterSpacing: 2, margin: "0 0 12px",
                }}>we need your mic</h2>

                <p style={{
                  fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 400,
                  color: "#555", lineHeight: 1.6, margin: "0 0 8px",
                }}>
                  the penis game requires audio to measure your courage.
                </p>

                <p style={{
                  fontFamily: "'Cormorant Garamond'", fontSize: 15,
                  fontWeight: 400, fontStyle: "italic",
                  color: "#333", margin: 0,
                }}>please allow microphone access to continue.</p>

                {/* Subtle animated dots */}
                <div style={{
                  marginTop: 28,
                  fontFamily: "'JetBrains Mono'", fontSize: 10,
                  fontWeight: 300, letterSpacing: 3, color: "#333",
                  animation: "blink 1.5s ease-in-out infinite",
                }}>WAITING FOR PERMISSION</div>
              </div>
            </div>
          )}

          {/* ═══ COUNTDOWN OVERLAY ═══ */}
          {isCountdown && countdown !== null && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 50,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              borderRadius: 20,
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

          {/* All flow content needs to sit above video background */}
          <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>

          <div style={{
            textAlign: "center", marginBottom: 2, flexShrink: 0,
            opacity: isCountdown ? 0 : 1,
          }}>
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 300, letterSpacing: 3, color: "#e0202066" }}>THE PENIS GAME</span>
          </div>

          {onAir && <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6, animation: "fadeIn 0.3s", marginBottom: 2, flexShrink: 0,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff2222",
              boxShadow: "0 0 6px #ff2222, 0 0 14px #ff222244", animation: "blink 1s infinite" }} />
            <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500, letterSpacing: 3, color: "#ff2222" }}>LIVE</span>
          </div>}

          {/* ═══ "penis" text — goes WILD during screaming (secondary hero) ═══ */}
          <div style={{
            textAlign: "center", marginBottom: isLive ? 2 : 4,
            opacity: isCountdown || isMicPrompt ? 0 : 1,
            transform: isLive
              ? `scale(${wordScale}) translate(${wordShake > 0 ? (Math.random()-.5)*wordShake : 0}px, ${wordShake > 0 ? (Math.random()-.5)*wordShake*0.3 : 0}px)`
              : isIdle ? `translateY(${idleBounce}px)` : "none",
            transition: isLive && wordShake > 0 ? "none" : "transform 0.3s ease-out, opacity 0.3s ease",
          }}>
            <h1 style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: isLive ? `clamp(24px, 5vh, ${Math.min(52, 32 + rmsNorm * 22)}px)` : 64,
              fontWeight: isLive ? Math.min(700, 300 + rmsNorm * 500) : 300,
              fontStyle: "italic",
              letterSpacing: isLive ? 3 + rmsNorm * 16 + phase * 2 : 5,
              color: isLive && phase >= 5 ? "#fff" : isLive && phase >= 3 ? "#fff5f0" : "#f0ece8",
              lineHeight: 0.85, margin: 0,
              textShadow: isLive && rmsNorm > 0.08
                ? `0 0 ${15 + rmsNorm * 40}px ${glow}, 0 0 ${rmsNorm * 80}px ${glow}, 0 4px 20px rgba(0,0,0,0.3)`
                : isIdle ? "0 4px 30px rgba(0,0,0,0.3)" : "none",
              filter: isLive && rmsNorm > 0.7 ? `blur(${(rmsNorm - 0.7) * 3}px)` : "none",
              transition: isLive ? "font-size 0.06s, letter-spacing 0.06s, font-weight 0.08s, color 0.2s" : "all 0.5s",
            }}>penis</h1>
          </div>

          {isIdle && (
            <div style={{ textAlign: "center", height: 20, marginBottom: 8 }}>
              <div style={{
                fontFamily: "'Cormorant Garamond'", fontSize: 15,
                fontWeight: 400, fontStyle: "italic", color: "#666",
                opacity: tauntFade ? 1 : 0,
                transform: tauntFade ? "translateY(0)" : "translateY(-4px)",
                transition: "opacity 0.3s, transform 0.3s",
              }}>{TAUNTS[tauntIdx]}</div>
            </div>
          )}

          {/* ═══ HERO SCORE — big red number climbing in real-time (like share card) ═══ */}
          {isLive && (
            <div style={{ textAlign: "center", marginBottom: 0, position: "relative" }}>
              {/* Red ambient glow behind score */}
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 220 + rmsNorm * 80, height: 80 + rmsNorm * 30,
                transform: "translate(-50%, -50%)",
                background: `radial-gradient(ellipse, rgba(224,32,32,${0.04 + rmsNorm * 0.08}) 0%, transparent 70%)`,
                pointerEvents: "none",
              }} />
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: `clamp(40px, 8vh, ${Math.min(72, 56 + rmsNorm * 20)}px)`,
                fontWeight: 600, color: "#e02020", lineHeight: 1,
                textShadow: `0 0 ${30 + rmsNorm * 40}px #e0202033, 0 0 ${60 + rmsNorm * 60}px #e0202018`,
                position: "relative",
                transition: "font-size 0.08s",
              }}>{score.toLocaleString()}</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, letterSpacing: 5, color: "#666", marginTop: 2, fontWeight: 400, position: "relative" }}>POINTS</div>
            </div>
          )}

          {/* ═══ dB DISPLAY — prominent, live ═══ */}
          {isLive && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginTop: 4, marginBottom: 2, flexShrink: 0 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 400, letterSpacing: 2, color: "#44444e" }}>VOLUME</div>
                <div style={{
                  fontFamily: "'JetBrains Mono'", fontSize: "clamp(18px, 3.5vh, 28px)", fontWeight: 200,
                  color: rmsNorm > 0.7 ? "#ff2222" : hotAccent, letterSpacing: 1,
                  transition: "color 0.1s",
                }}>{dbDisp}<span style={{ fontSize: 12, color: "#44444e", marginLeft: 2 }}>dB</span></div>
              </div>
              <div style={{ width: 1, height: 24, background: "#1a1a22" }} />
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 400, letterSpacing: 2, color: "#44444e" }}>PEAK</div>
                <div style={{
                  fontFamily: "'JetBrains Mono'", fontSize: "clamp(18px, 3.5vh, 28px)", fontWeight: 200,
                  color: "#e8e4e0", letterSpacing: 1,
                }}>{peakDisp}<span style={{ fontSize: 12, color: "#44444e", marginLeft: 2 }}>dB</span></div>
              </div>
            </div>
          )}

          {isLive && (
            <div style={{
              fontFamily: "'Cormorant Garamond'", fontSize: "clamp(11px, 2vh, 14px)",
              fontWeight: 400, fontStyle: "italic",
              color: "#444", textAlign: "center", marginBottom: 2, flexShrink: 0,
            }}>
              {phase <= 0 ? "we're listening..."
                : phase <= 1 ? "louder."
                : phase <= 3 ? "LOUDER."
                : phase <= 5 ? "WE CAN STILL HEAR YOUR SHAME."
                : "TRANSCENDENT."}
            </div>
          )}

          {isLive && wordDetected && (
            <div key={wordCount} style={{
              fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500,
              color: "#22cc66", letterSpacing: 2, marginBottom: 2, flexShrink: 0,
              padding: "2px 8px", background: "#22cc6612", borderRadius: 3,
              animation: "popIn 0.3s ease-out", textAlign: "center",
            }}>PENIS DETECTED{wordCount > 1 ? ` ×${wordCount}` : ""}</div>
          )}

          {/* ═══ FREQUENCY BARS ═══ */}
          {isLive && (
            <div style={{
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              gap: 1.5, height: "clamp(16px, 4vh, 32px)", width: "100%",
              marginBottom: 2, animation: "fadeIn 0.15s", flexShrink: 1, minHeight: 0,
            }}>
              {bars.map((v, i) => (
                <div key={i} style={{
                  width: Math.max(1.5, (280 / NUM_BARS) - 1.5),
                  height: `${Math.max(3, v * 100)}%`, borderRadius: 1,
                  background: v > 0.7 ? "#ff2222" : v > 0.4 ? hotAccent : `${hotAccent}66`,
                  boxShadow: v > 0.6 ? `0 0 3px ${hotAccent}44` : "none",
                  transition: "height 0.04s",
                }} />
              ))}
            </div>
          )}

          {/* ═══ LIVE CHART ═══ */}
          {isLive && chartData.length > 3 && (
            <div style={{ width: "100%", marginBottom: 2, animation: "fadeIn 0.3s", flexShrink: 1, minHeight: 0 }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, fontWeight: 400, color: "#33333c", letterSpacing: 2, marginBottom: 2 }}>$PENIS</div>
              <svg width="100%" viewBox={`0 0 ${cW} ${cH}`} preserveAspectRatio="none" style={{ display: "block" }}>
                <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={hotAccent} stopOpacity="0.25" /><stop offset="100%" stopColor={hotAccent} stopOpacity="0" /></linearGradient></defs>
                {chartFill && <path d={chartFill} fill="url(#cg)" />}
                {chartPath && <path d={chartPath} fill="none" stroke={hotAccent} strokeWidth="1.5" />}
                {chartData.length > 0 && <circle cx={(chartData.length - 1) / (CHART_POINTS - 1) * cW} cy={cH - chartData[chartData.length - 1] * cH} r="2.5" fill={hotAccent} style={{ filter: `drop-shadow(0 0 4px ${hotAccent})` }} />}
              </svg>
            </div>
          )}

          {isIdle && (
            <div style={{ textAlign: "center", animation: "fadeIn 0.5s" }}>
              {micDenied && <div style={{ fontFamily: "'DM Sans'", fontSize: 13, color: "#ef4444", marginBottom: 10 }}>microphone required to play</div>}
              {sessions > 0 && (
                <div style={{ display: "flex", justifyContent: "center", gap: 16, fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 300, color: "#44444e", marginBottom: 10 }}>
                  <span>BEST <span style={{ color: accent }}>{best.toLocaleString()}</span></span>
                  <span>SESSIONS <span style={{ color: "#555" }}>{sessions}</span></span>
                </div>
              )}
            </div>
          )}
          </div>{/* end flow content z-index wrapper */}
        </DeviceFrame>
      </div>

      {/* Selfie preview moved to inside device screen */}

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

      <style>{`
        @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
        @keyframes pulseRing { 0%, 100% { opacity: 0.3; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.04); } }
        @keyframes buttonBreathe { 0%, 100% { transform: scale(1); box-shadow: 0 6px 24px rgba(180,20,20,0.25), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.08); } 50% { transform: scale(1.03); box-shadow: 0 8px 32px rgba(180,20,20,0.35), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 10px rgba(255,120,120,0.1); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes micSwing { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes warnSlide { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes popIn { 0% { transform: scale(0.7); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes ringPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes countPop { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
        @keyframes timerDrain { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 528; } }
        @keyframes screenGlitch {
          0% { transform: translate(0); filter: none; }
          10% { transform: translate(-3px, 1px); filter: hue-rotate(90deg) saturate(3); }
          20% { transform: translate(2px, -1px); filter: none; }
          30% { transform: translate(-1px, 2px); filter: hue-rotate(-60deg) brightness(1.5); }
          40% { transform: translate(0); filter: none; }
          50% { transform: translate(3px, -2px) skewX(1deg); filter: saturate(0) brightness(2); }
          60% { transform: translate(-2px, 0); filter: none; }
          70% { transform: translate(1px, 1px); filter: hue-rotate(180deg); }
          80% { transform: translate(0); filter: none; }
          100% { transform: translate(0); filter: none; }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.96) !important; }
        .game-btn:hover { transform: scale(1.06) !important; box-shadow: 0 8px 32px rgba(200,20,20,0.35), 0 0 40px rgba(224,32,32,0.1), inset 0 -4px 10px rgba(0,0,0,0.3), inset 0 4px 12px rgba(255,130,130,0.12) !important; }
        .game-btn:hover span { color: rgba(255,255,255,0.9) !important; letter-spacing: 4px !important; text-shadow: 0 0 10px rgba(255,180,180,0.4) !important; }
        .game-btn:hover svg { filter: drop-shadow(0 1px 5px rgba(255,200,200,0.35)) !important; }
        ::-webkit-scrollbar { width: 0px; }
        .device-screen-content { scrollbar-width: none; -ms-overflow-style: none; }
        .device-screen-content::-webkit-scrollbar { display: none; }
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
  // Portrait format — matches on-screen results card
  const W = 640, H = 920;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");

  // ─── BACKGROUND — matches on-screen card ───
  ctx.fillStyle = "#0b0c12";
  ctx.fillRect(0, 0, W, H);

  // Subtle noise grain
  ctx.globalAlpha = 0.012;
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? "#fff" : "#000";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
  }
  ctx.globalAlpha = 1;

  // Vignette
  const vg = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, 500);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // Red ambient glow behind score
  const rg = ctx.createRadialGradient(W / 2, 420, 0, W / 2, 420, 300);
  rg.addColorStop(0, "rgba(224,32,32,0.05)");
  rg.addColorStop(1, "rgba(224,32,32,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";

  // ─── BRANDING (top) ───
  ctx.font = 'italic 300 32px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#f0ece8";
  ctx.fillText("the penis game", W / 2, 72);

  // ─── RANK ───
  ctx.font = "72px serif";
  ctx.fillStyle = "#f0ece8";
  ctx.fillText(result.rank.em, W / 2, 170);

  ctx.font = 'italic 300 52px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#f0ece8";
  ctx.fillText(result.rank.title, W / 2, 240);

  ctx.font = 'italic 400 22px "Cormorant Garamond", Georgia, serif';
  ctx.fillStyle = "#666";
  ctx.fillText(result.rank.sub, W / 2, 278);

  // ─── SCORE (hero) ───
  ctx.save();
  ctx.shadowColor = "rgba(224,32,32,0.2)";
  ctx.shadowBlur = 40;
  ctx.font = '600 130px "JetBrains Mono", monospace';
  ctx.fillStyle = "#e02020";
  ctx.fillText(result.score.toLocaleString(), W / 2, 440);
  ctx.restore();

  ctx.font = '400 18px "JetBrains Mono", monospace';
  ctx.fillStyle = "#666";
  ctx.fillText("P O I N T S", W / 2, 478);

  // ─── PEAK STAT ───
  ctx.font = '300 14px "JetBrains Mono", monospace';
  ctx.fillStyle = "#555";
  ctx.fillText("PEAK", W / 2, 536);
  ctx.font = '200 36px "JetBrains Mono", monospace';
  ctx.fillStyle = "#e8e4e0";
  ctx.fillText(`${Math.max(0, 60 + result.peakDb).toFixed(0)} dB`, W / 2, 580);

  // ─── CHART ───
  const cd = scaleChart(result.chartData);
  if (cd.length > 1) {
    const cx = 60, cy = 630, cw = W - 120, ch = 120;

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
    grd.addColorStop(0, "rgba(224,32,32,0.2)");
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

    // Glow
    ctx.strokeStyle = "rgba(224,32,32,0.15)";
    ctx.lineWidth = 8;
    ctx.stroke();

    // End dot
    const lastV = cd[cd.length - 1];
    const lx = cx + cw, ly = cy + ch - lastV * ch * 0.9 - ch * 0.05;
    ctx.beginPath(); ctx.arc(lx, ly, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#e02020"; ctx.fill();
  }

  // ─── BOTTOM BRANDING ───
  ctx.font = '300 11px "JetBrains Mono", monospace';
  ctx.fillStyle = "#222230";
  ctx.fillText("AN EXERCISE IN SHAMELESSNESS", W / 2, 890);

  return new Promise(resolve => c.toBlob(resolve, "image/png"));
}

// ═══════════════════════════════════════════════════════════════
// RESULT SCREEN
// ═══════════════════════════════════════════════════════════════
function ResultScreen({ result, onAgain, onHome, onLeaderboard }) {
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

  // Leaderboard submit
  const [playerName, setPlayerName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Video
  const videoUrlRef = useRef(null);
  const hasVideo = !!result.videoBlob;
  const shareText = `I just screamed "penis" at ${(60 + result.peakDb).toFixed(0)} dB and got ranked ${result.rank.em} ${result.rank.title}\n\n${result.score.toLocaleString()} pts — beat me if you dare\n\nthe penis game 🎙️`;

  useEffect(() => {
    if (!result.videoBlob) return;
    const url = URL.createObjectURL(result.videoBlob);
    videoUrlRef.current = url;
    return () => URL.revokeObjectURL(url);
  }, [result.videoBlob]);

  const shareVideo = async () => {
    if (!result.videoBlob) return;
    const ext = (result.videoMimeType || "video/webm").includes("mp4") ? "mp4" : "webm";
    const file = new File([result.videoBlob], `penis-game.${ext}`, { type: result.videoMimeType || "video/webm" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "The Penis Game",
          text: shareText,
        });
        return;
      } catch {}
    }
    // Fallback: download
    const url = URL.createObjectURL(result.videoBlob);
    const a = document.createElement("a");
    a.href = url; a.download = `penis-game-${result.score}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
      haptic("success");
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

  // Chart SVG — auto-scaled
  const chartData = scaleChart(result.chartData || []);
  const cW = 300, cH = 50;
  const chartPath = chartData.length > 1 ? chartData.map((v, i) => `${i === 0 ? "M" : "L"}${(i / (chartData.length - 1) * cW).toFixed(1)},${(cH - v * cH * 0.9 - cH * 0.05).toFixed(1)}`).join(" ") : "";
  const chartFill = chartPath ? chartPath + ` L${cW},${cH} L0,${cH} Z` : "";

  return (
    <div style={{
      minHeight: "100dvh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: "16px 20px 20px",
      background: "#08090c", position: "relative", overflow: "hidden",
    }}>
      {/* Grain + vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "inset 0 0 100px rgba(0,0,0,0.55)" }} />

      <div style={{ position: "relative", zIndex: 10, animation: "fadeIn 0.4s" }}>
        <DeviceFrame
          ledActive ledPulse
          ledColor="#22cc66"
          statusText={supabase ? "LEADERBOARD" : undefined}
          onStatusClick={supabase ? onLeaderboard : undefined}
          controls={
            <div style={{ position: "relative" }}>
              {/* Glow ring */}
              <div style={{
                position: "absolute", inset: -16, borderRadius: "50%",
                background: "transparent", pointerEvents: "none",
                boxShadow: "0 0 20px #e0202008, 0 0 40px #e0202004",
                animation: "breathe 3s ease-in-out infinite",
              }} />
              {/* Pulse ring */}
              <div style={{
                position: "absolute", inset: -8, borderRadius: "50%",
                border: "1px solid #e020200a", pointerEvents: "none",
                animation: "pulseRing 2.5s ease-in-out infinite",
              }} />
              {/* Button housing */}
              <div style={{
                width: 176, height: 176, borderRadius: "50%",
                background: "linear-gradient(145deg, #1e1e28, #111116)",
                border: "1px solid #222230",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 28px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.4)",
              }}>
                <button
                  onClick={() => { haptic("nudge"); onAgain(); }}
                  className="result-play-btn"
                  style={{
                    width: 148, height: 148, borderRadius: "50%",
                    border: "none", cursor: "pointer", outline: "none",
                    position: "relative", zIndex: 50,
                    WebkitTapHighlightColor: "transparent",
                    background: "radial-gradient(circle at 38% 32%, #dd2828 0%, #b81818 35%, #8a1010 70%, #6a0c0c 100%)",
                    boxShadow: "0 6px 20px rgba(200,20,20,0.15), 0 2px 6px rgba(0,0,0,0.35), inset 0 -5px 12px rgba(0,0,0,0.35), inset 0 5px 12px rgba(255,130,130,0.08)",
                    animation: "buttonBreathe 3s ease-in-out infinite",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    overflow: "hidden",
                    transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease, box-shadow 0.5s cubic-bezier(0.16, 1, 0.3, 1)",
                  }}>
                  {/* Specular highlight */}
                  <div style={{
                    position: "absolute", top: "6%", left: "14%",
                    width: "44%", height: "24%", borderRadius: "50%",
                    background: "radial-gradient(ellipse, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 40%, transparent 70%)",
                    pointerEvents: "none",
                  }} />
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" style={{
                    marginBottom: 7,
                    filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.3))",
                  }}>
                    <path d="M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 8 8" />
                    <polyline points="17.65 2 17.65 6.35 13.3 6.35" />
                  </svg>
                  <span style={{
                    fontFamily: "'DM Sans'", fontSize: 11,
                    fontWeight: 600, letterSpacing: 3,
                    color: "rgba(255,255,255,0.8)",
                    textShadow: "0 1px 4px rgba(0,0,0,0.3)",
                  }}>AGAIN</span>
                </button>
              </div>
            </div>
          }
        >
          {/* ═══ VIDEO REPLAY — full screen background ═══ */}
          {hasVideo && videoUrlRef.current && (
            <>
              <video
                src={videoUrlRef.current}
                autoPlay loop muted playsInline
                style={{
                  position: "absolute", inset: 0,
                  width: "100%", height: "100%",
                  objectFit: "cover", zIndex: 1,
                  transform: "scaleX(-1)",
                  borderRadius: 20, pointerEvents: "none",
                }}
              />
              <div style={{
                position: "absolute", inset: 0, zIndex: 2,
                background: "linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.75) 100%)",
                borderRadius: 20, pointerEvents: "none",
              }} />
            </>
          )}

          {/* ═══ SCREEN CONTENT — result card (flex layout, no scroll) ═══ */}
          <div
            onClick={copyCard}
            onMouseEnter={() => setCardHover(true)}
            onMouseLeave={() => setCardHover(false)}
            style={{ cursor: "pointer", position: "relative", zIndex: 10, flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}
          >
            {/* Copied overlay */}
            <div style={{
              position: "absolute", inset: 0, borderRadius: 8,
              background: copied ? "rgba(34,204,102,0.1)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "center",
              opacity: copied ? 1 : 0, transition: "opacity 0.15s",
              pointerEvents: "none", zIndex: 5,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 500,
                letterSpacing: 2, color: "#22cc66",
                background: "#22cc6620", padding: "8px 20px", borderRadius: 8,
              }}>COPIED!</span>
            </div>

            {/* Rank */}
            <div style={{ textAlign: "center", marginBottom: 2 }}>
              <div style={{ fontSize: 24, lineHeight: 1 }}>{result.rank.em}</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 300, fontStyle: "italic", color: "#f0ece8", letterSpacing: 2 }}>{result.rank.title}</div>
            </div>

            {/* Score — hero */}
            <div style={{ textAlign: "center", marginBottom: 0, position: "relative" }}>
              <div style={{
                position: "absolute", top: "50%", left: "50%",
                width: 200, height: 60,
                transform: "translate(-50%, -50%)",
                background: "radial-gradient(ellipse, rgba(224,32,32,0.06) 0%, transparent 70%)",
                pointerEvents: "none",
              }} />
              <div style={{
                fontFamily: "'JetBrains Mono'", fontSize: 48, fontWeight: 600,
                color: "#e02020", lineHeight: 1,
                textShadow: "0 0 40px #e0202033, 0 0 80px #e0202018",
                position: "relative",
              }}>{result.score.toLocaleString()}</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, letterSpacing: 5, color: "#666", marginTop: 1, fontWeight: 400, position: "relative" }}>POINTS</div>
            </div>

            {/* Peak dB */}
            <div style={{ textAlign: "center", marginTop: 2 }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 8, fontWeight: 400, letterSpacing: 2, color: "#555" }}>PEAK</div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 16, fontWeight: 200, color: "#e8e4e0" }}>{Math.max(0, 60 + result.peakDb).toFixed(0)} dB</div>
            </div>

            {/* Chart — full width */}
            {chartData.length > 3 && (
              <div style={{ width: "100%", marginTop: 2 }}>
                <svg width="100%" viewBox={`0 0 ${cW} ${cH}`} preserveAspectRatio="none" style={{ display: "block", height: 24 }}>
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
          </div>

          {/* Share actions — pinned to bottom */}
          <div style={{ display: "flex", gap: 5, marginTop: 4, position: "relative", zIndex: 10, flexShrink: 0 }}>
            {supabase && <button onClick={onLeaderboard} className="result-copy-btn" style={{
              flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500,
              letterSpacing: 1, color: "#888",
              background: "#ffffff08",
              border: "1px solid #ffffff12",
              padding: "7px 0", borderRadius: 6, cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>RANKS</button>}
            <a
              href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`}
              target="_blank" rel="noopener noreferrer"
              onClick={() => { copyCard(); }}
              className="result-share-btn"
              style={{
                flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500,
                letterSpacing: 1, color: "#000", background: "#fff",
                border: "none", padding: "7px 0", borderRadius: 6, cursor: "pointer",
                textDecoration: "none", textAlign: "center", display: "block",
                transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease",
              }}
            >SHARE</a>
            <button onClick={copyCard} className="result-copy-btn" style={{
              flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500,
              letterSpacing: 1, color: copied ? "#22cc66" : "#e02020",
              background: copied ? "#22cc6612" : "#e0202012",
              border: `1px solid ${copied ? "#22cc6630" : "#e0202030"}`,
              padding: "7px 0", borderRadius: 6, cursor: "pointer",
              transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}>{copied ? "COPIED!" : "COPY IMG"}</button>
            {hasVideo && <button onClick={shareVideo} className="result-play-btn" style={{
              flex: 1, fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 500,
              letterSpacing: 1, color: "#f0ece8", background: "#e02020",
              border: "none", padding: "7px 0", borderRadius: 6, cursor: "pointer",
              boxShadow: "0 2px 12px #e0202044",
              transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease",
            }}>SHARE VID</button>}
          </div>

          {/* Audio playback — compact, pinned bottom */}
          {result.audioBlob && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexShrink: 0,
              background: hasVideo ? "rgba(10,12,20,0.8)" : "#0a0c14", borderRadius: 5, padding: "5px 8px",
              border: `1px solid ${hasVideo ? "rgba(20,22,31,0.6)" : "#14161f"}`,
              position: "relative", zIndex: 10,
            }}>
              <button onClick={togglePlay} className="audio-play-btn" style={{
                width: 24, height: 24, borderRadius: "50%",
                background: playing ? "#e02020" : "#1a1c28",
                border: `1px solid ${playing ? "#e02020" : "#22242e"}`,
                color: "#f0ece8", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, flexShrink: 0,
                boxShadow: playing ? "0 0 8px #e0202033" : "none",
                transition: "background 0.2s ease, border-color 0.2s ease, box-shadow 0.3s ease",
              }}>
                {playing ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z" /></svg>
                )}
              </button>
              <div onClick={seekTo} style={{
                flex: 1, height: 20, borderRadius: 3,
                background: "#080a10", cursor: "pointer", position: "relative",
                overflow: "hidden",
              }}>
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${progress * 100}%`,
                  background: "linear-gradient(90deg, #e02020, #ff4444)",
                  borderRadius: 3,
                  transition: playing ? "width 0.05s linear" : "width 0.15s ease-out",
                }} />
                <div style={{
                  position: "absolute", top: 0, bottom: 0,
                  left: `${progress * 100}%`, width: 2,
                  background: "#fff", borderRadius: 1,
                  boxShadow: "0 0 4px rgba(255,255,255,0.3)",
                  transition: playing ? "left 0.05s linear" : "left 0.15s ease-out",
                }} />
              </div>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: "#666", flexShrink: 0 }}>
                {fmtTime(progress * audioDur)}
              </div>
            </div>
          )}

          {/* Submit to leaderboard — inside screen */}
          {supabase && !uploaded && (
            <div style={{
              background: hasVideo ? "rgba(10,12,20,0.8)" : "#0a0c14", borderRadius: 5, padding: "6px 8px", marginTop: 4,
              border: `1px solid ${hasVideo ? "rgba(20,22,31,0.6)" : "#14161f"}`,
              position: "relative", zIndex: 10, flexShrink: 0,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, letterSpacing: 2, color: "#555", marginBottom: 6 }}>SUBMIT TO LEADERBOARD</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="text"
                  placeholder="your name"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value.slice(0, 24))}
                  maxLength={24}
                  className="name-input"
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 5,
                    background: "#080a10", border: "1px solid #1a1c28",
                    color: "#e8e4e0", fontFamily: "'DM Sans'", fontSize: 13,
                    outline: "none",
                    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
                  }}
                />
                <button
                  disabled={uploading}
                  className="submit-btn"
                  onClick={async () => {
                    setUploading(true); setUploadError(null);
                    const res = await uploadScream({
                      score: result.score,
                      peakDb: result.peakDb,
                      rank: result.rank,
                      duration: result.duration,
                      chartData: result.chartData,
                      audioBlob: result.audioBlob,
                      playerName: playerName.trim() || "anonymous",
                    });
                    setUploading(false);
                    if (res) { haptic("success"); setUploaded(true); } else { haptic("error"); setUploadError("failed — try again"); }
                  }}
                  style={{
                    padding: "8px 14px", borderRadius: 5,
                    background: uploading ? "#333" : "#e02020",
                    border: "none", color: "#f0ece8", cursor: uploading ? "default" : "pointer",
                    fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 400, letterSpacing: 1,
                    whiteSpace: "nowrap",
                    transition: "transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, box-shadow 0.3s ease",
                  }}
                >{uploading ? "..." : "SUBMIT"}</button>
              </div>
              {uploadError && <div style={{ fontFamily: "'DM Sans'", fontSize: 12, color: "#ef4444", marginTop: 6 }}>{uploadError}</div>}
            </div>
          )}
          {supabase && uploaded && (
            <div style={{
              background: "#22cc6612", border: "1px solid #22cc6625",
              borderRadius: 6, padding: "8px 10px", marginTop: 8,
              textAlign: "center", position: "relative", zIndex: 10,
            }}>
              <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#22cc66", letterSpacing: 1 }}>SUBMITTED TO LEADERBOARD</div>
            </div>
          )}
        </DeviceFrame>
      </div>

      {/* ═══ SHARE MODAL ═══ */}
      {showShareModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20, animation: "fadeIn 0.2s",
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}>
          <div style={{ width: "100%", maxWidth: 380 }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, letterSpacing: 3, color: "#666", marginBottom: 14, textAlign: "center" }}>SHARE YOUR SCREAM</div>

            {cardUrl && (
              <div
                onClick={copyCard}
                style={{
                  position: "relative", cursor: "pointer",
                  borderRadius: 10, overflow: "hidden",
                  border: `1px solid ${copied ? "#22cc6625" : "#222"}`,
                  marginBottom: 16, transition: "border-color 0.2s",
                }}
              >
                <img src={cardUrl} alt="Share card" style={{ width: "100%", display: "block" }} />
                <div style={{
                  position: "absolute", inset: 0,
                  background: copied ? "rgba(34,204,102,0.15)" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  opacity: copied ? 1 : 0,
                  transition: "opacity 0.15s",
                  pointerEvents: "none",
                }}>
                  <span style={{
                    fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 500,
                    letterSpacing: 2, color: "#22cc66",
                    background: "#22cc6620",
                    padding: "8px 20px", borderRadius: 8,
                  }}>COPIED!</span>
                </div>
              </div>
            )}

            {/* Big share buttons */}
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={copyCard} className="result-copy-btn" style={{
                flex: 1, padding: "13px 0", borderRadius: 8,
                background: copied ? "#22cc6615" : "#e0202015",
                border: `1px solid ${copied ? "#22cc6630" : "#e0202030"}`,
                color: copied ? "#22cc66" : "#e02020",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 500, letterSpacing: 1,
                transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}>{copied ? "COPIED!" : "COPY IMAGE"}</button>
              <a href={`https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="result-share-btn" style={{
                flex: 1, padding: "13px 0", borderRadius: 8,
                background: "#fff", border: "1px solid #fff",
                color: "#000", cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 11, fontWeight: 500, letterSpacing: 1,
                textDecoration: "none", textAlign: "center", display: "block",
                transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.2s ease",
              }}>POST ON 𝕏</a>
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button onClick={downloadCard} className="modal-secondary-btn" style={{
                flex: 1, padding: "10px 0", borderRadius: 6,
                background: "#0e1018", border: "1px solid #1a1c28",
                color: "#666", cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 1,
                transition: "border-color 0.3s ease, color 0.3s ease",
              }}>SAVE IMAGE</button>
              {result.audioBlob && <button onClick={downloadAudio} className="modal-secondary-btn" style={{
                flex: 1, padding: "10px 0", borderRadius: 6,
                background: "#0e1018", border: "1px solid #1a1c28",
                color: "#666", cursor: "pointer",
                fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 1,
                transition: "border-color 0.3s ease, color 0.3s ease",
              }}>SAVE AUDIO</button>}
            </div>

            <button onClick={() => setShowShareModal(false)} className="modal-close-btn" style={{
              width: "100%", padding: "12px 0", borderRadius: 8,
              background: "none", border: "1px solid #333",
              color: "#666", cursor: "pointer",
              fontFamily: "'Cormorant Garamond'", fontSize: 15, fontStyle: "italic",
              transition: "border-color 0.3s ease, color 0.3s ease",
            }}>close</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes breathe { 0%, 100% { opacity: 0.4; transform: scale(1); } 50% { opacity: 0.8; transform: scale(1.06); } }
        @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }
        @keyframes micSwing { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.96) !important; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 0px; }
        .device-screen-content { scrollbar-width: none; -ms-overflow-style: none; }
        .device-screen-content::-webkit-scrollbar { display: none; }
        .result-share-btn:hover { transform: scale(1.03) !important; box-shadow: 0 4px 20px rgba(255,255,255,0.15) !important; background: #f0f0f0 !important; }
        .result-copy-btn:hover { transform: scale(1.03) !important; border-color: #e0202050 !important; background: #e0202018 !important; }
        .result-play-btn:hover { transform: scale(1.03) !important; box-shadow: 0 6px 28px #e0202066 !important; background: #ee2424 !important; }
        .submit-btn:hover { transform: scale(1.04) !important; box-shadow: 0 4px 16px #e0202044 !important; background: #ee2424 !important; }
        .name-input:focus { border-color: #e0202040 !important; box-shadow: 0 0 0 2px #e0202015 !important; }
        .result-lb-link:hover { color: #888 !important; letter-spacing: 4px !important; }
        .audio-play-btn:hover { transform: scale(1.1) !important; background: #e02020 !important; border-color: #e02020 !important; box-shadow: 0 0 14px #e0202044 !important; }
        .modal-secondary-btn:hover { border-color: #2a2c38 !important; color: #999 !important; }
        .modal-close-btn:hover { border-color: #555 !important; color: #aaa !important; }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LEADERBOARD SCREEN — hear the screams of others
// ═══════════════════════════════════════════════════════════════
const PAGE_SIZE = 20;

function LeaderboardScreen({ onPlay, onHome }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [playingId, setPlayingId] = useState(null);
  const audioRef = useRef(null);

  const fetchEntries = useCallback(async (offset = 0) => {
    if (!supabase) { setLoading(false); return; }
    const { data, error } = await supabase
      .from("screams")
      .select("*")
      .order("score", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) { console.error("leaderboard fetch error:", error); setLoading(false); return; }
    if (offset === 0) setEntries(data || []);
    else setEntries(prev => [...prev, ...(data || [])]);
    setHasMore((data || []).length === PAGE_SIZE);
    setLoading(false); setLoadingMore(false);
  }, []);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const loadMore = () => {
    setLoadingMore(true);
    fetchEntries(entries.length);
  };

  const togglePlay = (entry) => {
    if (!entry.audio_url) return;
    if (playingId === entry.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingId(null);
      audioRef.current.onerror = () => setPlayingId(null);
    }
    audioRef.current.src = entry.audio_url;
    audioRef.current.play().catch(() => setPlayingId(null));
    setPlayingId(entry.id);
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  const fmtDur = (s) => {
    if (!s || isNaN(s)) return "—";
    return `${s.toFixed(1)}s`;
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", padding: "32px 16px 40px",
      background: "transparent", position: "relative", overflow: "hidden",
    }}>
      {/* Grain + vignette */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
      }} />
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 2, boxShadow: "inset 0 0 100px rgba(0,0,0,0.55)" }} />

      <div style={{ position: "relative", zIndex: 10, width: "100%", maxWidth: 440, animation: "fadeIn 0.4s" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 36, fontWeight: 300, fontStyle: "italic",
            color: "#f0ece8", letterSpacing: 3, margin: 0, marginBottom: 4,
          }}>hall of fame</h1>
          <div style={{
            fontFamily: "'JetBrains Mono'", fontSize: 8,
            fontWeight: 300, letterSpacing: 3, color: "#333",
          }}>TOP SCREAMERS — RANKED BY SCORE</div>
        </div>

        {/* Play button — always visible */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={onPlay} className="lb-play-btn" style={{
            width: "100%", fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 400,
            fontStyle: "italic", color: "#f0ece8", background: "#e02020",
            border: "none", padding: "13px 0", borderRadius: 8, cursor: "pointer",
            boxShadow: "0 4px 20px #e0202044", letterSpacing: 1,
            transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, background 0.2s ease",
          }}>play again</button>
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#333", letterSpacing: 2 }}>LOADING...</div>
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontFamily: "'Cormorant Garamond'", fontSize: 18, fontStyle: "italic", color: "#444", marginBottom: 8 }}>no screams yet</div>
            <div style={{ fontFamily: "'JetBrains Mono'", fontSize: 9, color: "#333", letterSpacing: 1 }}>be the first</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {entries.map((entry, i) => (
              <LeaderboardEntry
                key={entry.id}
                entry={entry}
                position={i + 1}
                isPlaying={playingId === entry.id}
                onTogglePlay={() => togglePlay(entry)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && entries.length > 0 && !loading && (
          <button onClick={loadMore} disabled={loadingMore} className="lb-loadmore-btn" style={{
            width: "100%", padding: "12px 0", marginTop: 12,
            borderRadius: 6, background: "#0e1018", border: "1px solid #14161f",
            color: "#555", cursor: loadingMore ? "default" : "pointer",
            fontFamily: "'JetBrains Mono'", fontSize: 10, fontWeight: 400, letterSpacing: 2,
            transition: "border-color 0.3s ease, color 0.3s ease, background 0.3s ease",
          }}>{loadingMore ? "..." : "LOAD MORE"}</button>
        )}

      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #08090c; }
        button:focus { outline: none; }
        button:active { transform: scale(0.96) !important; }
        .lb-play-btn:hover { transform: scale(1.02) !important; box-shadow: 0 6px 28px #e0202066 !important; background: #ee2424 !important; }
        .lb-loadmore-btn:hover { border-color: #2a2c38 !important; color: #888 !important; background: #121420 !important; }
        .lb-entry { transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important; }
        .lb-entry:hover { background: #0e0e16 !important; border-color: #1a1a28 !important; transform: translateX(2px) !important; }
        .lb-audio-btn { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.2s ease, border-color 0.2s ease, box-shadow 0.3s ease !important; }
        .lb-audio-btn:hover { transform: scale(1.12) !important; background: #e02020 !important; border-color: #e02020 !important; box-shadow: 0 0 12px #e0202044 !important; }
      `}</style>
    </div>
  );
}

function MiniSparkline({ data, width = 60, height = 28 }) {
  const scaled = scaleChart(data);
  if (!scaled || scaled.length < 2) return null;

  const pad = 1;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (scaled.length - 1);
  const points = scaled.map((v, i) => `${pad + i * step},${pad + h - v * h}`);
  const polyline = points.join(" ");
  const fillPoints = `${pad},${pad + h} ${polyline} ${pad + (scaled.length - 1) * step},${pad + h}`;
  const gradId = `sg${Math.random().toString(36).slice(2, 6)}`;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, display: "block" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e02020" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#e02020" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill={`url(#${gradId})`} />
      <polyline points={polyline} fill="none" stroke="#e02020" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function LeaderboardEntry({ entry, position, isPlaying, onTogglePlay }) {
  const peakDisp = entry.peak_db != null ? Math.max(0, 60 + entry.peak_db).toFixed(0) : "—";
  const posColor = position === 1 ? "#ffcc33" : position === 2 ? "#c0c0c0" : position === 3 ? "#cd7f32" : "#444";

  return (
    <div className="lb-entry" style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "10px 12px", background: "#0b0b10",
      borderRadius: 6, border: "1px solid #111118",
    }}>
      {/* Position */}
      <div style={{
        fontFamily: "'JetBrains Mono'", fontSize: 13, fontWeight: 500,
        color: posColor, width: 28, textAlign: "center", flexShrink: 0,
      }}>#{position}</div>

      {/* Play button */}
      <button onClick={onTogglePlay} disabled={!entry.audio_url} className={entry.audio_url ? "lb-audio-btn" : ""} style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
        background: isPlaying ? "#e02020" : entry.audio_url ? "#1a1c28" : "#0e0e14",
        border: `1px solid ${isPlaying ? "#e02020" : entry.audio_url ? "#22242e" : "#14141c"}`,
        color: entry.audio_url ? "#f0ece8" : "#222",
        cursor: entry.audio_url ? "pointer" : "default",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11,
        boxShadow: isPlaying ? "0 0 10px #e0202033" : "none",
      }}>
        {isPlaying ? (
          <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor"><rect x="1" y="1" width="3" height="8" rx="0.5" /><rect x="6" y="1" width="3" height="8" rx="0.5" /></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor"><path d="M2 1l7 4-7 4V1z" /></svg>
        )}
      </button>

      {/* Name + rank */}
      <div style={{ minWidth: 0, flex: "1 1 0" }}>
        <div style={{
          fontFamily: "'DM Sans'", fontSize: 14, fontWeight: 500,
          color: "#f0ece8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          lineHeight: 1.2,
        }}>{entry.player_name || "anonymous"}</div>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 10, color: "#555",
          marginTop: 2, lineHeight: 1,
        }}>{entry.rank_emoji} {entry.rank_title}</div>
      </div>

      {/* Score + secondary stats */}
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 16, fontWeight: 600,
          color: "#e02020", lineHeight: 1.2,
        }}>{entry.score?.toLocaleString()}<span style={{ fontSize: 9, fontWeight: 400, color: "#555", marginLeft: 2 }}>pts</span></div>
        <div style={{
          fontFamily: "'JetBrains Mono'", fontSize: 9, color: "#444",
          marginTop: 2, lineHeight: 1,
        }}>{peakDisp}dB · {entry.duration != null ? `${entry.duration.toFixed(1)}s` : "—"}</div>
      </div>

      {/* Sparkline */}
      {entry.chart_data && entry.chart_data.length >= 2 && (
        <MiniSparkline data={entry.chart_data} width={60} height={28} />
      )}
    </div>
  );
}
