import React from 'react';
import { motion } from 'framer-motion';
import { Download, Cloud, Layout, Cpu, ArrowRight, Zap, Shield, Star } from 'lucide-react';
import ComparisonSlider from './ComparisonMockup';

const GithubIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
  </svg>
);

const FloatingCard = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <div
    className={`absolute glass-card px-3 py-2.5 shadow-xl text-xs pointer-events-none ${className ?? ''}`}
    style={{ backdropFilter: 'blur(16px)', background: 'rgba(13,13,16,0.85)', border: '1px solid rgba(255,255,255,0.08)' }}
  >
    {children}
  </div>
);

export default function App() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#050507', color: 'white' }}>

      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          zIndex: 0,
        }}
      />

      {/* Radial glow top */}
      <div
        className="fixed top-0 left-1/2 -translate-x-1/2 pointer-events-none"
        style={{
          width: '900px',
          height: '600px',
          background: 'radial-gradient(ellipse at top, rgba(20,184,166,0.12) 0%, transparent 70%)',
          zIndex: 0,
        }}
      />

      {/* ── NAV ──────────────────────────────── */}
      <nav
        className="fixed top-0 w-full z-50 flex items-center justify-between px-8 py-4"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', background: 'rgba(5,5,7,0.8)' }}
      >
        <div className="flex items-center gap-2.5 font-bold text-lg tracking-tight">
          <img src="/logo-mark.svg" alt="Moxzk" className="w-8 h-8 rounded-lg" />
          <span>Moxzk</span>
        </div>

        <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#compare" className="hover:text-white transition-colors">How it Works</a>
          <a href="https://github.com/sathidpong01/Moxzk/wiki" className="hover:text-white transition-colors">Docs</a>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://github.com/sathidpong01/Moxzk"
            className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            <GithubIcon size={18} />
            <span className="hidden md:inline">GitHub</span>
          </a>
          <a
            href="https://github.com/sathidpong01/Moxzk/releases/latest"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold text-black transition-all hover:opacity-90 active:scale-95"
            style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}
          >
            <Download size={14} />
            Download
          </a>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────── */}
      <section className="relative z-10 min-h-screen flex items-center pt-20">
        <div className="max-w-7xl mx-auto w-full px-8 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{ background: 'rgba(20,184,166,0.12)', border: '1px solid rgba(20,184,166,0.3)', color: '#2dd4bf' }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Free Download · Windows
            </div>

            <div className="space-y-4">
              <h1
                className="text-5xl lg:text-7xl font-black tracking-tighter leading-[1.05]"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Translate Manga
                <br />
                <span style={{ background: 'linear-gradient(90deg,#14b8a6,#38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  Like a Pro.
                </span>
              </h1>
              <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">
                AI-powered manga editor ที่รัน Local บนเครื่องคุณ — ทำความสะอาดบอลลูน, OCR, แปลภาษา และ sync ไปยัง Cloud ได้ในคลิกเดียว
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="https://github.com/sathidpong01/Moxzk/releases/latest"
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-full font-bold text-black text-sm transition-all hover:opacity-90 hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)', boxShadow: '0 0 32px rgba(20,184,166,0.35)' }}
              >
                <Download size={16} />
                Download for Windows
              </a>
              <a
                href="https://github.com/sathidpong01/Moxzk"
                className="flex items-center gap-2.5 px-7 py-3.5 rounded-full font-semibold text-sm text-zinc-300 transition-all hover:text-white hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <GithubIcon size={16} />
                View on GitHub
                <ArrowRight size={14} />
              </a>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-5 pt-2">
              <div className="flex -space-x-2">
                {['#14b8a6','#0ea5e9','#a78bfa','#f472b6','#fb923c'].map((c, i) => (
                  <div key={i} className="w-8 h-8 rounded-full border-2 border-zinc-900 flex items-center justify-center text-[10px] font-bold" style={{ background: c }}>
                    {String.fromCharCode(65 + i)}
                  </div>
                ))}
              </div>
              <div className="text-sm text-zinc-400">
                <span className="text-white font-semibold">200+</span> manga translators using it
              </div>
              <div className="flex items-center gap-1 text-yellow-400 text-sm">
                {[...Array(5)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
              </div>
            </div>
          </motion.div>

          {/* Right — App screenshot with floating cards */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="relative px-6 py-8"
          >
            {/* Glow behind mockup */}
            <div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.1) 0%, transparent 70%)' }}
            />

            {/* App screenshot — slight 3D tilt */}
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl"
              style={{
                transform: 'perspective(1200px) rotateY(-4deg) rotateX(2deg)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.06)',
              }}
            >
              <img
                src="/App.png"
                alt="Moxzk app — manga editor"
                className="w-full h-auto block"
                draggable={false}
              />
            </div>

            {/* Floating card — top left (inside padding) */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute left-0 top-4 z-20"
            >
              <FloatingCard>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(20,184,166,0.2)' }}>
                    <Zap size={14} style={{ color: '#2dd4bf' }} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-[11px]">98% accuracy</div>
                    <div className="text-zinc-500 text-[10px]">OCR · manga-ocr</div>
                  </div>
                </div>
              </FloatingCard>
            </motion.div>

            {/* Floating card — bottom right (inside padding) */}
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
              className="absolute right-0 bottom-12 z-20"
            >
              <FloatingCard>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'rgba(14,165,233,0.2)' }}>
                    <Cloud size={14} style={{ color: '#38bdf8' }} />
                  </div>
                  <div>
                    <div className="text-white font-semibold text-[11px]">Cloud synced</div>
                    <div className="text-zinc-500 text-[10px]">Cloudflare D1 · R2</div>
                  </div>
                </div>
              </FloatingCard>
            </motion.div>

            {/* Floating card — top right (inside padding) */}
            <motion.div
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
              className="absolute right-0 top-4 z-20"
            >
              <FloatingCard>
                <div className="flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-zinc-300 text-[11px]">Ollama <span className="text-white font-semibold">online</span></span>
                </div>
              </FloatingCard>
            </motion.div>

            {/* Floating card — bottom left (inside padding) */}
            <motion.div
              animate={{ y: [0, 5, 0] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
              className="absolute left-0 bottom-12 z-20"
            >
              <FloatingCard>
                <div className="text-[10px] text-zinc-500 mb-1">Pages this session</div>
                <div className="text-xl font-black text-white">47</div>
                <div className="text-[10px]" style={{ color: '#2dd4bf' }}>↑ 12 this week</div>
              </FloatingCard>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── LOGO STRIP ───────────────────────── */}
      <section className="relative z-10 py-16 border-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
        <div className="max-w-5xl mx-auto px-8">
          <p className="text-center text-xs text-zinc-600 uppercase tracking-widest mb-10 font-semibold">Powered by open-source tools</p>
          <div className="flex flex-wrap justify-center items-center gap-10">
            {[
              { name: 'PanelCleaner', color: '#14b8a6' },
              { name: 'Ollama', color: '#f97316' },
              { name: 'manga-ocr', color: '#a78bfa' },
              { name: 'Cloudflare', color: '#f97316' },
              { name: 'PySide6', color: '#38bdf8' },
            ].map((t) => (
              <div key={t.name} className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 transition-colors">
                <div className="w-2 h-2 rounded-full" style={{ background: t.color }} />
                <span className="text-sm font-semibold">{t.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── COMPARISON ───────────────────────── */}
      <section id="compare" className="relative z-10 py-28 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-4">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2"
              style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#2dd4bf' }}
            >
              Before → After
            </div>
            <h2 className="text-4xl font-black tracking-tight">เห็นผลทันที</h2>
            <p className="text-zinc-500 max-w-md mx-auto text-sm leading-relaxed">
              Drag เพื่อเปรียบเทียบ — จากภาพต้นฉบับ สู่งานแปลที่สะอาดพร้อมใช้
            </p>
          </div>
          <ComparisonSlider />
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────── */}
      <section id="features" className="relative z-10 py-28 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16 space-y-3">
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-2"
              style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.25)', color: '#38bdf8' }}
            >
              Features
            </div>
            <h2 className="text-4xl font-black tracking-tight">ทุกอย่างที่นักแปลมังงะต้องการ</h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">ครบ จบ ในแอปเดียว</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: Cpu,
                color: '#14b8a6',
                glow: 'rgba(20,184,166,0.12)',
                title: 'Local AI Power',
                desc: 'รัน PanelCleaner + Ollama บนเครื่องคุณ ข้อมูลไม่ออกนอกเครื่อง ความเร็วสูง ไม่มี rate limit',
              },
              {
                icon: Cloud,
                color: '#38bdf8',
                glow: 'rgba(56,189,248,0.12)',
                title: 'Cloud Persistence',
                desc: 'Album และ Metadata sync กับ Cloudflare D1/R2 — เปลี่ยนเครื่องทำงานได้ทันที ไฟล์ไม่หาย',
              },
              {
                icon: Layout,
                color: '#a78bfa',
                glow: 'rgba(167,139,250,0.12)',
                title: 'Batch Workspace',
                desc: 'จัดการหลายหน้าใน Workspace เดียว ประมวลผล Batch Review งานได้ต่อเนื่อง',
              },
              {
                icon: Zap,
                color: '#fbbf24',
                glow: 'rgba(251,191,36,0.12)',
                title: 'One-Click Pipeline',
                desc: 'Clean → OCR → Translate → Export ในคลิกเดียว ลด workflow จาก 10 ขั้นตอน เหลือ 1',
              },
              {
                icon: Shield,
                color: '#f472b6',
                glow: 'rgba(244,114,182,0.12)',
                title: 'Private by Design',
                desc: 'ไม่มี telemetry ไม่ส่งข้อมูลขึ้น server ใดๆ รูปภาพอยู่ในเครื่องคุณตลอด',
              },
              {
                icon: GithubIcon,
                color: '#94a3b8',
                glow: 'rgba(148,163,184,0.1)',
                title: 'Open Source',
                desc: 'MIT License ดู code ได้ทั้งหมด ส่ง PR ได้ ไม่มีค่าสมัคร ไม่มีแผน subscription',
              },
            ].map(({ icon: Icon, color, glow, title, desc }) => (
              <div
                key={title}
                className="rounded-2xl p-6 transition-all hover:scale-[1.02] group cursor-default"
                style={{ background: 'rgba(13,13,16,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                  style={{ background: glow, border: `1px solid ${color}30` }}
                >
                  <Icon size={18} color={color} />
                </div>
                <h3 className="font-bold text-base mb-2">{title}</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────── */}
      <section className="relative z-10 py-32 px-8">
        <div className="max-w-4xl mx-auto text-center relative">
          <div
            className="absolute inset-0 -m-12 rounded-3xl pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(20,184,166,0.08) 0%, transparent 70%)' }}
          />
          <div
            className="relative rounded-3xl p-16"
            style={{ background: 'rgba(13,13,16,0.8)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="inline-block px-3 py-1 rounded-full text-xs font-semibold mb-6"
              style={{ background: 'rgba(20,184,166,0.1)', border: '1px solid rgba(20,184,166,0.25)', color: '#2dd4bf' }}
            >
              Free Download · Windows
            </div>
            <h2 className="text-5xl font-black tracking-tight mb-5">พร้อมแล้วหรือยัง?</h2>
            <p className="text-zinc-500 mb-10 max-w-md mx-auto text-sm leading-relaxed">
              ดาวน์โหลด Moxzk ได้เลยผ่าน GitHub Releases ไม่ต้องสมัคร ไม่ต้อง login
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <a
                href="https://github.com/sathidpong01/Moxzk/releases/latest"
                className="flex items-center gap-2.5 px-8 py-4 rounded-full font-bold text-black text-sm transition-all hover:opacity-90 hover:scale-105 active:scale-95"
                style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)', boxShadow: '0 0 40px rgba(20,184,166,0.3)' }}
              >
                <Download size={16} />
                Download Latest Release
              </a>
              <a
                href="https://github.com/sathidpong01/Moxzk"
                className="flex items-center gap-2.5 px-8 py-4 rounded-full font-semibold text-sm text-zinc-300 hover:text-white transition-all hover:bg-white/10"
                style={{ border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <GithubIcon size={16} />
                View Source
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────── */}
      <footer
        className="relative z-10 py-12 px-8 text-sm"
        style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 font-bold">
            <img src="/logo-mark.svg" alt="Moxzk" className="w-6 h-6 rounded-md" />
            <span>Moxzk</span>
            <span className="text-zinc-600 font-normal ml-1">— Built for manga translators</span>
          </div>
          <div className="flex items-center gap-6 text-zinc-500">
            <a href="https://github.com/sathidpong01/Moxzk" className="hover:text-white transition-colors">GitHub</a>
            <a href="https://github.com/sathidpong01/Moxzk/wiki" className="hover:text-white transition-colors">Docs</a>
            <a href="https://github.com/sathidpong01/Moxzk/issues" className="hover:text-white transition-colors">Issues</a>
            <a href="https://github.com/sathidpong01/Moxzk/releases" className="hover:text-white transition-colors">Releases</a>
          </div>
          <div className="text-zinc-600 text-xs">© 2026 Moxzk · MIT License</div>
        </div>
      </footer>
    </div>
  );
}
