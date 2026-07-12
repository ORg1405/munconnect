import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export default function Hero({ onStart, onLogin }) {
  const phrases = [
    'Enter <span class="highlight">prepared</span>. Leave <span class="highlight">unforgettable</span>.',
    'Don’t join the simulation — <span class="highlight">lead</span> it.',
    'Think <span class="highlight">faster</span>. Speak <span class="highlight">better</span>. Win <span class="highlight">every time</span>.',
    'From <span class="highlight">beginner</span> to <span class="highlight">standout</span> in just a few sessions.',
    'Every decision. Every speech. Closer to the <span class="highlight">top</span>.',
    '<span class="highlight">Own the room</span> before you walk in.',
    'Diplomacy is the art of being <span class="highlight">right</span> without making <span class="highlight">enemies</span>.',
    'Here, <span class="highlight">rhetoric</span> is <span class="highlight">power</span>.',
    'Listen. Argue. <span class="highlight">Win</span>.',
    'Details make the <span class="highlight">difference</span>.'
  ];

  const [text, setText] = useState('');

  useEffect(() => {
    const random = phrases[Math.floor(Math.random() * phrases.length)];
    setText(random);
  }, []);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-[#020617] text-white">
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="relative z-10 px-6 text-center"
      >
        <h1 className="text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
          <span className="bg-gradient-to-r from-white via-blue-200 to-blue-400 bg-clip-text text-transparent">
            Domine o MUN
          </span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-xl text-lg text-slate-400"
          dangerouslySetInnerHTML={{ __html: text }}
        />

        <div className="mt-10 flex justify-center gap-4">
          <button
            onClick={onStart}
            className="rounded-full bg-white px-6 py-3 font-medium text-black transition hover:scale-105"
          >
            Comecar
          </button>

          <button
            onClick={onLogin}
            className="rounded-full border border-white/20 px-6 py-3 text-white transition hover:bg-white/10"
          >
            Entrar
          </button>
        </div>
      </motion.div>
    </section>
  );
}