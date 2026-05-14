export default function AppMockup() {
  const files = [
    { name: 'ch001_p001.jpg', done: true },
    { name: 'ch001_p002.jpg', done: true },
    { name: 'ch001_p003.jpg', active: true },
    { name: 'ch001_p004.jpg', done: false },
    { name: 'ch001_p005.jpg', done: false },
  ];

  return (
    <div className="w-full bg-[#111113] rounded-xl border border-white/10 overflow-hidden font-mono text-xs select-none" style={{ height: '480px', display: 'flex', flexDirection: 'column' }}>
      {/* Title bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0d0d0f] shrink-0">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <span className="mx-auto text-zinc-500 uppercase tracking-widest text-[10px]">Moxzk — Isekai Tensei ch.001</span>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-48 border-r border-white/5 bg-[#0d0d0f] flex flex-col shrink-0">
          {/* Album header */}
          <div className="px-3 py-2 border-b border-white/5">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Album</div>
            <div className="text-white text-xs font-semibold truncate">Isekai Tensei</div>
          </div>
          {/* File list */}
          <div className="flex-1 overflow-hidden py-1">
            {files.map((f, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 px-3 py-1.5 ${f.active ? 'bg-blue-600/20 text-blue-300' : 'text-zinc-400'}`}
              >
                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.done ? 'bg-green-400' : f.active ? 'bg-blue-400' : 'bg-zinc-600'}`} />
                <span className="truncate text-[10px]">{f.name}</span>
              </div>
            ))}
          </div>
          {/* Stats */}
          <div className="px-3 py-2 border-t border-white/5 space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-500">Processed</span>
              <span className="text-green-400">2 / 5</span>
            </div>
            <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '40%' }} />
            </div>
          </div>
        </div>

        {/* Main canvas area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#0f0f11] shrink-0">
            <button className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-semibold">Clean</button>
            <button className="px-2 py-1 rounded bg-zinc-700/60 text-zinc-300 text-[10px]">Translate</button>
            <button className="px-2 py-1 rounded bg-zinc-700/60 text-zinc-300 text-[10px]">Export</button>
            <div className="flex-1" />
            <span className="text-zinc-600 text-[10px]">Ollama · llama3.2-vision</span>
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          </div>

          {/* Page canvas */}
          <div className="flex-1 flex items-center justify-center bg-[#0a0a0c] p-4 overflow-hidden">
            <MangaPageMock />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-52 border-l border-white/5 bg-[#0d0d0f] flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-white/5 text-[10px] text-zinc-500 uppercase tracking-wider">Bubble Inspector</div>
          <div className="flex-1 overflow-hidden p-2 space-y-1.5">
            {[
              { id: '#1', ja: 'なんだと！', en: 'What?!', conf: 97 },
              { id: '#2', ja: 'お前は…', en: 'You are...', conf: 91 },
              { id: '#3', ja: '待って', en: 'Wait!', conf: 88 },
            ].map((b) => (
              <div key={b.id} className="bg-zinc-800/40 rounded p-2 border border-white/5">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-zinc-500 text-[9px]">{b.id}</span>
                  <span className="text-[9px]" style={{ color: b.conf > 95 ? '#4ade80' : b.conf > 85 ? '#facc15' : '#f87171' }}>{b.conf}%</span>
                </div>
                <div className="text-zinc-400 text-[10px]">{b.ja}</div>
                <div className="text-blue-300 text-[10px] mt-0.5">{b.en}</div>
              </div>
            ))}
          </div>
          <div className="px-3 py-2 border-t border-white/5">
            <div className="flex gap-1">
              <div className="flex-1 text-[9px] text-zinc-500">PanelCleaner</div>
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
            <div className="flex gap-1 mt-0.5">
              <div className="flex-1 text-[9px] text-zinc-500">manga-ocr</div>
              <div className="w-2 h-2 rounded-full bg-green-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MangaPageMock() {
  return (
    <svg viewBox="0 0 260 340" className="h-full max-h-full rounded-lg border border-white/10 shadow-2xl" style={{ maxHeight: '340px' }}>
      <rect width="260" height="340" fill="#f5f0e8" />
      {/* Panel borders */}
      <rect x="4" y="4" width="124" height="160" fill="#e8e0d0" stroke="#1a1a1a" strokeWidth="2" />
      <rect x="132" y="4" width="124" height="80" fill="#ddd5c5" stroke="#1a1a1a" strokeWidth="2" />
      <rect x="132" y="88" width="124" height="76" fill="#e8e0d0" stroke="#1a1a1a" strokeWidth="2" />
      <rect x="4" y="168" width="252" height="100" fill="#ddd5c5" stroke="#1a1a1a" strokeWidth="2" />
      <rect x="4" y="272" width="124" height="64" fill="#e8e0d0" stroke="#1a1a1a" strokeWidth="2" />
      <rect x="132" y="272" width="124" height="64" fill="#ddd5c5" stroke="#1a1a1a" strokeWidth="2" />

      {/* Manga character silhouettes */}
      <ellipse cx="66" cy="60" rx="18" ry="22" fill="#1a1a1a" opacity="0.15" />
      <rect x="50" y="80" width="32" height="70" rx="4" fill="#1a1a1a" opacity="0.1" />

      {/* Speech bubble panel 1 */}
      <ellipse cx="98" cy="28" rx="22" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <polygon points="80,36 72,44 85,38" fill="white" stroke="#1a1a1a" strokeWidth="1" />
      <text x="98" y="26" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">What?!</text>
      <text x="98" y="33" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">It can't be!</text>

      {/* Speech bubble panel 2 */}
      <ellipse cx="172" cy="26" rx="32" ry="14" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <polygon points="155,35 148,44 162,38" fill="white" stroke="#1a1a1a" strokeWidth="1" />
      <text x="172" y="24" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">You are...</text>
      <text x="172" y="31" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">the chosen one?</text>

      {/* Panel 3 bubble */}
      <ellipse cx="194" cy="114" rx="28" ry="12" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="194" y="112" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">Wait!</text>
      <text x="194" y="119" textAnchor="middle" fontSize="5" fill="#1a1a1a" fontFamily="sans-serif">Don't go!</text>

      {/* Wide panel text */}
      <rect x="60" y="192" width="140" height="44" rx="4" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
      <text x="130" y="208" textAnchor="middle" fontSize="6" fill="#1a1a1a" fontFamily="sans-serif" fontWeight="bold">In another world...</text>
      <text x="130" y="218" textAnchor="middle" fontSize="5" fill="#555" fontFamily="sans-serif">the hero awakens to his true power.</text>
      <text x="130" y="228" textAnchor="middle" fontSize="5" fill="#555" fontFamily="sans-serif">Nothing will ever be the same.</text>

      {/* Clean badge overlay */}
      <rect x="186" y="270" width="46" height="14" rx="3" fill="#3b82f6" />
      <text x="209" y="280" textAnchor="middle" fontSize="5.5" fill="white" fontFamily="sans-serif" fontWeight="bold">✓ Cleaned</text>
    </svg>
  );
}
