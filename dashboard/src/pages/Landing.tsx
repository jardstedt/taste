import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// === COLOR TOKENS ===
const HUMAN = '#C084FC';
const AI = '#F9A8D4';
const ROUTE = '#A855F7';

interface Node {
  x: number; y: number; vx: number; vy: number;
  r: number; t: 'h' | 'a'; p: number; k: number;
}
interface Edge { a: number; b: number; cr: boolean; g: number }
interface Packet { f: number; to: number; t: number; s: number }
interface State {
  nodes: Node[]; edges: Edge[]; packets: Packet[];
  mouse: { x: number; y: number }; et: number; W: number; H: number;
}

function buildEdges(st: State) {
  st.edges = [];
  for (const n of st.nodes) n.k = 0;
  const md = Math.min(200, Math.max(95, st.W * 0.11));
  for (let i = 0; i < st.nodes.length; i++) {
    for (let j = i + 1; j < st.nodes.length; j++) {
      const dx = st.nodes[i].x - st.nodes[j].x;
      const dy = st.nodes[i].y - st.nodes[j].y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > md || st.nodes[i].k >= 3 || st.nodes[j].k >= 3) continue;
      const cr = st.nodes[i].t !== st.nodes[j].t;
      if (Math.random() < (cr ? 0.6 : 0.08)) {
        st.edges.push({ a: i, b: j, cr, g: 0 });
        st.nodes[i].k++;
        st.nodes[j].k++;
      }
    }
  }
}

function spawn(st: State) {
  const cr = st.edges.filter(e => e.cr);
  if (!cr.length) return;
  const e = cr[Math.floor(Math.random() * cr.length)];
  const ai = st.nodes[e.a].t === 'a';
  e.g = 140;
  st.packets.push({ f: ai ? e.a : e.b, to: ai ? e.b : e.a, t: 0, s: 0.005 + Math.random() * 0.007 });
}

export function Landing() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const s = useRef<State>({ nodes: [], edges: [], packets: [], mouse: { x: -9e3, y: -9e3 }, et: 0, W: 0, H: 0 });

  const init = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const st = s.current;
    st.W = cv.width = cv.offsetWidth * dpr;
    st.H = cv.height = cv.offsetHeight * dpr;
    st.nodes = []; st.edges = []; st.packets = []; st.et = 0;

    const n = Math.max(30, Math.floor(st.W * st.H / 22000));
    for (let i = 0; i < n; i++) {
      const h = Math.random() < 0.3;
      st.nodes.push({
        x: Math.random() * st.W, y: Math.random() * st.H,
        vx: (Math.random() - 0.5) * 0.28, vy: (Math.random() - 0.5) * 0.28,
        r: h ? 3.5 + Math.random() * 3 : 2 + Math.random() * 2,
        t: h ? 'h' : 'a',
        p: Math.random() * 6.28, k: 0,
      });
    }
    buildEdges(st);
  }, []);

  useEffect(() => {
    init();
    let raf: number;
    const loop = () => { draw(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', init);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init); };
  }, [init]);

  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const cx = cv.getContext('2d');
    if (!cx) return;
    const st = s.current;
    const { W, H, nodes, edges, packets, mouse } = st;

    cx.clearRect(0, 0, W, H);
    if (Math.random() < 0.022) spawn(st);
    st.et++;
    if (st.et > 350) { buildEdges(st); st.et = 0; }

    for (const n of nodes) {
      n.x += n.vx; n.y += n.vy; n.p += 0.013;
      const dx = n.x - mouse.x; const dy = n.y - mouse.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 120 && d > 0) { const f = (120 - d) / 120 * 0.4; n.vx += dx / d * f; n.vy += dy / d * f; }
      n.vx *= 0.993; n.vy *= 0.993;
      if (n.x < -30) n.vx += 0.04; if (n.x > W + 30) n.vx -= 0.04;
      if (n.y < -30) n.vy += 0.04; if (n.y > H + 30) n.vy -= 0.04;
    }

    for (const e of edges) {
      const a = nodes[e.a]; const b = nodes[e.b];
      if (e.g > 0) e.g -= 1.3;
      const ba = e.cr ? 0.12 : 0.05;
      const ga = e.g > 0 ? (e.g / 140) * 0.35 : 0;
      cx.beginPath(); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y);
      cx.strokeStyle = e.cr ? ROUTE : (nodes[e.a].t === 'h' ? HUMAN : AI);
      cx.globalAlpha = ba + ga;
      cx.lineWidth = e.g > 0 ? 1.2 : 0.7;
      cx.stroke();
    }
    cx.globalAlpha = 1;

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i]; p.t += p.s;
      if (p.t >= 1) { packets.splice(i, 1); continue; }
      const a = nodes[p.f]; const b = nodes[p.to];
      const px = a.x + (b.x - a.x) * p.t; const py = a.y + (b.y - a.y) * p.t;
      const g = cx.createRadialGradient(px, py, 0, px, py, 20);
      g.addColorStop(0, 'rgba(255,255,255,0.5)');
      g.addColorStop(1, 'rgba(168,85,247,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(px, py, 20, 0, 6.28); cx.fill();
      cx.fillStyle = '#fff'; cx.beginPath(); cx.arc(px, py, 2.5, 0, 6.28); cx.fill();
    }

    for (const n of nodes) {
      const pr = n.r + Math.sin(n.p) * 0.6;
      const g = cx.createRadialGradient(n.x, n.y, 0, n.x, n.y, pr * 5);
      g.addColorStop(0, n.t === 'h' ? 'rgba(192,132,252,0.15)' : 'rgba(249,168,212,0.12)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.beginPath(); cx.arc(n.x, n.y, pr * 5, 0, 6.28); cx.fill();
      cx.fillStyle = n.t === 'h' ? HUMAN : AI;
      cx.globalAlpha = 0.75;
      if (n.t === 'h') {
        cx.beginPath(); cx.arc(n.x, n.y, pr, 0, 6.28); cx.fill();
      } else {
        cx.save(); cx.translate(n.x, n.y); cx.rotate(0.785);
        cx.fillRect(-pr * 0.6, -pr * 0.6, pr * 1.2, pr * 1.2);
        cx.restore();
      }
      cx.globalAlpha = 1;
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    s.current.mouse.x = (e.clientX - rect.left) * dpr;
    s.current.mouse.y = (e.clientY - rect.top) * dpr;
  };

  return (
    <div className="landing-hero-wrapper">
      <div className="landing-bg" />
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { s.current.mouse.x = -9e3; s.current.mouse.y = -9e3; }}
        className="landing-canvas"
      />
      <div className="landing-vignette" />
      <div className="landing-cta-group">
        <LandingBtn filled label="I Taste" onClick={() => navigate('/login')} />
        <LandingBtn label="I've Taste" onClick={() => navigate('/apply')} />
      </div>
    </div>
  );
}

function LandingBtn({ filled, label, onClick }: { filled?: boolean; label: string; onClick: () => void }) {
  const [h, setH] = useState(false);
  const violet = '#C084FC';
  const violetLight = '#DDD6FE';
  return (
    <button
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      onClick={onClick}
      style={{
        position: 'relative',
        padding: '16px 44px',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        fontSize: 11, fontWeight: 400,
        letterSpacing: 3,
        textTransform: 'uppercase',
        color: filled ? '#0A0A0F' : (h ? '#0A0A0F' : '#E9D5FF'),
        background: filled ? (h ? violetLight : violet) : (h ? 'rgba(192,132,252,0.8)' : 'transparent'),
        border: `1px solid ${filled ? violet : 'rgba(192,132,252,0.4)'}`,
        cursor: 'pointer',
        transition: 'all 0.35s ease',
        boxShadow: h ? '0 0 50px rgba(192,132,252,0.3)' : 'none',
        minWidth: 160,
        outline: 'none',
        backdropFilter: filled ? 'none' : 'blur(4px)',
      }}
    >
      {(['top', 'bottom'] as const).map(v => (['left', 'right'] as const).map(h2 => (
        <span key={v + h2} style={{
          position: 'absolute', width: 7, height: 7,
          [v]: 3, [h2]: 3,
          borderStyle: 'solid',
          borderColor: filled ? 'rgba(10,10,15,0.3)' : (h ? 'rgba(10,10,15,0.3)' : 'rgba(192,132,252,0.35)'),
          borderWidth: `${v === 'top' ? 1 : 0}px ${h2 === 'right' ? 1 : 0}px ${v === 'bottom' ? 1 : 0}px ${h2 === 'left' ? 1 : 0}px`,
          opacity: h ? 1 : 0.6,
          transition: 'all 0.35s',
        }} />
      )))}
      {label}
    </button>
  );
}
