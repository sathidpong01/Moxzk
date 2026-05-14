import { useState } from 'react';

export default function ComparisonSlider() {
  const [sliderPos, setSliderPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const handleMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, x)));
  };

  return (
    <div
      className="relative w-full max-w-3xl mx-auto overflow-hidden rounded-2xl cursor-ew-resize select-none"
      style={{ border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 0 60px rgba(20,184,166,0.08)' }}
      onMouseDown={(e) => {
        setDragging(true);
        handleMove(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onMouseMove={(e) => {
        if (dragging) handleMove(e.clientX, e.currentTarget.getBoundingClientRect());
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchStart={(e) => {
        setDragging(true);
        handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
      }}
      onTouchMove={(e) => {
        if (dragging) handleMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect());
      }}
      onTouchEnd={() => setDragging(false)}
    >
      {/* Thai (right side — visible by default) */}
      <div className="relative w-full">
        <img
          src="/manga-th.png"
          alt="Thai translation output"
          className="w-full h-auto block"
          draggable={false}
        />
        <div
          className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
          style={{ background: 'linear-gradient(135deg,#14b8a6,#0ea5e9)' }}
        >
          ภาษาไทย
        </div>
      </div>

      {/* English (left side — clipped by slider) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img
          src="/manga-en.png"
          alt="English translation output"
          className="w-full h-auto block"
          draggable={false}
        />
        <div
          className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-white"
          style={{ background: 'rgba(30,30,40,0.85)', border: '1px solid rgba(255,255,255,0.15)' }}
        >
          English
        </div>
      </div>

      {/* Divider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 z-30 pointer-events-none"
        style={{ left: `${sliderPos}%`, background: 'rgba(255,255,255,0.9)', boxShadow: '0 0 8px rgba(255,255,255,0.4)' }}
      >
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full shadow-xl flex items-center justify-center"
          style={{ background: 'white', boxShadow: '0 2px 20px rgba(0,0,0,0.4)' }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 3L1 8l4 5M11 3l4 5-4 5" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
