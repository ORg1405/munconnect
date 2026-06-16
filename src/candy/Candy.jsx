import { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { candies, steps, testimonials, faqs } from "./data.js";
import "./candy.css";

/* ------------------------------------------------------------------ */
/* Small reusable animated bits                                        */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] },
  }),
};

function Sparkle({ style }) {
  return (
    <span
      className="candy-twinkle"
      style={{
        position: "absolute",
        pointerEvents: "none",
        fontSize: 18,
        ...style,
      }}
    >
      ✨
    </span>
  );
}

/* Floating candy emoji that drifts in the hero */
function FloatingCandy({ emoji, top, left, size, dur, rot }) {
  return (
    <motion.div
      className="candy-float"
      style={{
        position: "absolute",
        top,
        left,
        fontSize: size,
        "--dur": `${dur}s`,
        "--rot": `${rot}deg`,
        filter: "drop-shadow(0 10px 18px rgba(180,90,60,0.18))",
        userSelect: "none",
      }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.random() * 0.6, type: "spring", stiffness: 120 }}
    >
      {emoji}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Navbar                                                              */
/* ------------------------------------------------------------------ */

function Navbar({ cartCount, onOpenCart }) {
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  useEffect(() => scrollY.on("change", (v) => setSolid(v > 40)), [scrollY]);

  return (
    <motion.nav
      initial={{ y: -90 }}
      animate={{ y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 16 }}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        transition: "background 0.3s, box-shadow 0.3s, padding 0.3s",
        background: solid ? "rgba(255,247,236,0.92)" : "transparent",
        backdropFilter: solid ? "blur(10px)" : "none",
        boxShadow: solid ? "0 6px 24px rgba(180,90,60,0.10)" : "none",
        padding: solid ? "10px 0" : "18px 0",
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: "0 auto",
          padding: "0 22px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <motion.a
          href="#topo"
          whileHover={{ scale: 1.05 }}
          className="candy-display"
          style={{
            fontSize: 26,
            fontWeight: 800,
            color: "var(--candy-pink)",
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <motion.span
            animate={{ rotate: [0, 14, -10, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            🍬
          </motion.span>
          Doce&nbsp;Mel
        </motion.a>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {[
            ["Sabores", "#sabores"],
            ["Como fazemos", "#como"],
            ["Avaliações", "#avaliacoes"],
            ["Dúvidas", "#duvidas"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="candy-nav-link"
              style={{
                display: "none",
                padding: "8px 14px",
                borderRadius: 999,
                color: "var(--candy-cocoa)",
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {label}
            </a>
          ))}

          <motion.button
            onClick={onOpenCart}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            style={{
              position: "relative",
              border: "none",
              cursor: "pointer",
              background: "var(--candy-pink)",
              color: "#fff",
              fontWeight: 600,
              fontFamily: "inherit",
              padding: "10px 18px",
              borderRadius: 999,
              fontSize: 16,
              boxShadow: "0 8px 18px rgba(255,111,165,0.4)",
            }}
          >
            🛒 Carrinho
            <AnimatePresence>
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 15 }}
                  style={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    minWidth: 24,
                    height: 24,
                    padding: "0 6px",
                    borderRadius: 999,
                    background: "var(--candy-amber)",
                    color: "#5b3a29",
                    fontSize: 13,
                    fontWeight: 700,
                    display: "grid",
                    placeItems: "center",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                  }}
                >
                  {cartCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </div>
      <style>{`@media (min-width: 860px){ .candy-nav-link{ display:inline-block !important; } .candy-nav-link:hover{ background: rgba(255,111,165,0.14); } }`}</style>
    </motion.nav>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ onShop }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const yTitle = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const yBlob = useTransform(scrollYProgress, [0, 1], [0, 160]);

  const headline = "Balas caseiras feitas com mel e carinho".split(" ");

  return (
    <header
      id="topo"
      ref={ref}
      className="candy-animated-bg"
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        paddingTop: 90,
      }}
    >
      {/* floating candies */}
      <FloatingCandy emoji="🍬" top="14%" left="8%" size={56} dur={6} rot={-12} />
      <FloatingCandy emoji="🍭" top="22%" left="84%" size={64} dur={7} rot={10} />
      <FloatingCandy emoji="🍯" top="64%" left="12%" size={50} dur={5.5} rot={6} />
      <FloatingCandy emoji="🍓" top="70%" left="80%" size={48} dur={6.5} rot={-8} />
      <FloatingCandy emoji="🌿" top="40%" left="92%" size={40} dur={8} rot={4} />
      <FloatingCandy emoji="🍬" top="48%" left="3%" size={38} dur={7.5} rot={14} />
      <Sparkle style={{ top: "30%", left: "30%" }} />
      <Sparkle style={{ top: "60%", left: "65%", "--dur": "3s" }} />
      <Sparkle style={{ top: "18%", left: "55%", "--dur": "2s" }} />

      {/* soft blob */}
      <motion.div
        style={{
          y: yBlob,
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,205,88,0.55), rgba(255,158,196,0.35))",
          filter: "blur(50px)",
          zIndex: 0,
        }}
      />

      <motion.div
        style={{ y: yTitle, position: "relative", zIndex: 2, textAlign: "center", padding: "0 22px", maxWidth: 880 }}
      >
        <motion.span
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="candy-display"
          style={{
            display: "inline-block",
            background: "#fff",
            color: "var(--candy-pink)",
            padding: "8px 18px",
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 22,
            boxShadow: "0 6px 16px rgba(180,90,60,0.12)",
          }}
        >
          🌟 Feito à mão, em pequenos lotes
        </motion.span>

        <h1
          className="candy-display"
          style={{
            fontSize: "clamp(2.6rem, 7vw, 5rem)",
            lineHeight: 1.02,
            fontWeight: 800,
            margin: "0 0 20px",
            color: "var(--candy-cocoa)",
          }}
        >
          {headline.map((word, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 30, rotate: -6 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.2 + i * 0.09, type: "spring", stiffness: 140 }}
              style={{
                display: "inline-block",
                marginRight: "0.28em",
                color:
                  word === "mel" ? "var(--candy-amber)" : word === "carinho" ? "var(--candy-pink)" : undefined,
              }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          style={{ fontSize: "clamp(1rem, 2.4vw, 1.3rem)", maxWidth: 560, margin: "0 auto 34px", lineHeight: 1.5 }}
        >
          Aquele sabor de infância, daquela bala da vovó. Sem conservantes,
          enroladas uma a uma e enviadas fresquinhas pra todo o Brasil.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.05 }}
          style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}
        >
          <motion.button
            onClick={onShop}
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="candy-shine"
            style={{
              position: "relative",
              overflow: "hidden",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 18,
              color: "#fff",
              background: "var(--candy-pink)",
              padding: "16px 34px",
              borderRadius: 999,
              boxShadow: "0 12px 26px rgba(255,111,165,0.45)",
            }}
          >
            Quero provar 🍬
          </motion.button>
          <motion.a
            href="#como"
            whileHover={{ scale: 1.06, y: -2 }}
            whileTap={{ scale: 0.95 }}
            style={{
              fontFamily: "inherit",
              fontWeight: 700,
              fontSize: 18,
              color: "var(--candy-cocoa)",
              background: "#fff",
              padding: "16px 30px",
              borderRadius: 999,
              textDecoration: "none",
              boxShadow: "0 8px 20px rgba(180,90,60,0.12)",
            }}
          >
            Como fazemos
          </motion.a>
        </motion.div>
      </motion.div>

      {/* scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 10, 0] }}
        transition={{ delay: 1.4, y: { duration: 1.6, repeat: Infinity } }}
        style={{ position: "absolute", bottom: 26, fontSize: 26, zIndex: 2 }}
      >
        ⌄
      </motion.div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Marquee                                                             */
/* ------------------------------------------------------------------ */

function Marquee() {
  const items = ["SEM CONSERVANTES", "🍯", "FEITO À MÃO", "🍬", "RECEITA DA VOVÓ", "🍓", "ENTREGA NACIONAL", "🌿", "INGREDIENTES NATURAIS", "🍭"];
  const row = [...items, ...items];
  return (
    <div
      style={{
        background: "var(--candy-pink)",
        color: "#fff",
        padding: "14px 0",
        overflow: "hidden",
        transform: "rotate(-1.5deg)",
        margin: "-10px 0",
      }}
    >
      <div className="candy-marquee">
        {row.map((t, i) => (
          <span key={i} className="candy-display" style={{ fontSize: 20, fontWeight: 700, margin: "0 22px" }}>
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Product card                                                        */
/* ------------------------------------------------------------------ */

function CandyCard({ candy, index, onAdd }) {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 200, damping: 18 });
  const sry = useSpring(ry, { stiffness: 200, damping: 18 });

  function handleMove(e) {
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 14);
    rx.set(-py * 14);
  }
  function reset() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.article
      custom={index}
      variants={fadeUp}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      whileHover={{ y: -10 }}
      style={{
        rotateX: srx,
        rotateY: sry,
        transformPerspective: 900,
        background: "#fff",
        borderRadius: 28,
        padding: 22,
        boxShadow: "0 16px 40px rgba(180,90,60,0.12)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {candy.badge && (
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          whileInView={{ scale: 1, rotate: -8 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 300, delay: 0.2 }}
          className="candy-display"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "var(--candy-amber)",
            color: "#5b3a29",
            fontWeight: 700,
            fontSize: 12,
            padding: "5px 11px",
            borderRadius: 999,
            zIndex: 3,
          }}
        >
          {candy.badge}
        </motion.span>
      )}

      <div
        style={{
          height: 150,
          borderRadius: 22,
          display: "grid",
          placeItems: "center",
          marginBottom: 18,
          background: `radial-gradient(circle at 50% 35%, ${candy.color}, ${candy.accent})`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <motion.span
          whileHover={{ scale: 1.2, rotate: 12 }}
          transition={{ type: "spring", stiffness: 300 }}
          style={{ fontSize: 76, filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.18))" }}
        >
          {candy.emoji}
        </motion.span>
      </div>

      <h3 className="candy-display" style={{ margin: "0 0 6px", fontSize: 21, fontWeight: 700 }}>
        {candy.name}
      </h3>
      <p style={{ margin: "0 0 14px", fontSize: 14.5, color: "#8a6a55", lineHeight: 1.4 }}>{candy.tagline}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
        {candy.notes.map((n) => (
          <span
            key={n}
            style={{
              fontSize: 12,
              fontWeight: 500,
              background: "var(--candy-cream)",
              color: "#a06a4a",
              padding: "4px 10px",
              borderRadius: 999,
            }}
          >
            {n}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="candy-display" style={{ fontSize: 24, fontWeight: 800, color: "var(--candy-cocoa)" }}>
          R$ {candy.price.toFixed(2).replace(".", ",")}
          <span style={{ fontSize: 13, fontWeight: 500, color: "#a08", opacity: 0.6 }}> /pacote</span>
        </span>
        <motion.button
          onClick={() => onAdd(candy)}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.9 }}
          style={{
            border: "none",
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 700,
            color: "#fff",
            background: candy.accent,
            padding: "10px 16px",
            borderRadius: 999,
            fontSize: 15,
            boxShadow: `0 8px 16px ${candy.accent}66`,
          }}
        >
          + Adicionar
        </motion.button>
      </div>
    </motion.article>
  );
}

function Products({ onAdd }) {
  return (
    <section id="sabores" style={{ padding: "84px 22px", maxWidth: 1120, margin: "0 auto" }}>
      <SectionTitle kicker="Nosso cardápio" title="Escolha o seu sabor favorito" />
      <div
        style={{
          display: "grid",
          gap: 26,
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          marginTop: 50,
        }}
      >
        {candies.map((c, i) => (
          <CandyCard key={c.id} candy={c} index={i} onAdd={onAdd} />
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Section title helper                                                */
/* ------------------------------------------------------------------ */

function SectionTitle({ kicker, title, light }) {
  return (
    <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto" }}>
      <motion.span
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="candy-display"
        style={{
          display: "inline-block",
          color: light ? "#fff" : "var(--candy-pink)",
          fontWeight: 700,
          letterSpacing: 1,
          textTransform: "uppercase",
          fontSize: 14,
          marginBottom: 10,
        }}
      >
        {kicker}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 26 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.05 }}
        className="candy-display"
        style={{
          fontSize: "clamp(1.9rem, 4.5vw, 2.9rem)",
          fontWeight: 800,
          margin: 0,
          color: light ? "#fff" : "var(--candy-cocoa)",
        }}
      >
        {title}
      </motion.h2>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* How it's made                                                       */
/* ------------------------------------------------------------------ */

function HowItsMade() {
  return (
    <section id="como" style={{ background: "#fff", padding: "84px 22px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <SectionTitle kicker="Do tacho pra você" title="Como nossas balas são feitas" />
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            marginTop: 54,
          }}
        >
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              style={{ textAlign: "center", position: "relative" }}
            >
              <motion.div
                whileHover={{ scale: 1.12, rotate: 8 }}
                transition={{ type: "spring", stiffness: 300 }}
                style={{
                  width: 92,
                  height: 92,
                  margin: "0 auto 18px",
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 42,
                  background: "var(--candy-cream)",
                  boxShadow: "0 10px 24px rgba(180,90,60,0.12)",
                }}
              >
                {s.icon}
              </motion.div>
              <span
                className="candy-display"
                style={{
                  position: "absolute",
                  top: -6,
                  left: "calc(50% + 30px)",
                  fontSize: 14,
                  fontWeight: 800,
                  color: "var(--candy-rose)",
                }}
              >
                0{i + 1}
              </span>
              <h3 className="candy-display" style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 14.5, color: "#8a6a55", lineHeight: 1.5, margin: 0 }}>{s.text}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Testimonials carousel                                               */
/* ------------------------------------------------------------------ */

function Testimonials() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((p) => (p + 1) % testimonials.length), 4200);
    return () => clearInterval(t);
  }, []);
  const t = testimonials[i];

  return (
    <section
      id="avaliacoes"
      style={{
        padding: "84px 22px",
        background: "linear-gradient(160deg, var(--candy-rose), var(--candy-pink))",
      }}
    >
      <SectionTitle kicker="Quem prova, ama" title="O que dizem nossos clientes" light />
      <div style={{ maxWidth: 640, margin: "46px auto 0", position: "relative", minHeight: 220 }}>
        <AnimatePresence mode="wait">
          <motion.blockquote
            key={i}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -30, scale: 0.96 }}
            transition={{ duration: 0.5 }}
            style={{
              background: "#fff",
              borderRadius: 28,
              padding: "34px 30px",
              margin: 0,
              textAlign: "center",
              boxShadow: "0 20px 50px rgba(120,40,70,0.25)",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 12 }}>{"⭐".repeat(t.rating)}</div>
            <p className="candy-display" style={{ fontSize: 21, lineHeight: 1.45, margin: "0 0 16px", fontWeight: 500 }}>
              “{t.text}”
            </p>
            <cite style={{ fontStyle: "normal", fontWeight: 700, color: "var(--candy-pink)" }}>— {t.name}</cite>
          </motion.blockquote>
        </AnimatePresence>
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 22 }}>
          {testimonials.map((_, k) => (
            <button
              key={k}
              onClick={() => setI(k)}
              aria-label={`Avaliação ${k + 1}`}
              style={{
                width: k === i ? 26 : 10,
                height: 10,
                border: "none",
                cursor: "pointer",
                borderRadius: 999,
                background: k === i ? "#fff" : "rgba(255,255,255,0.5)",
                transition: "width 0.3s, background 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Order CTA + form                                                    */
/* ------------------------------------------------------------------ */

function OrderCTA({ cartCount, total }) {
  const [sent, setSent] = useState(false);
  return (
    <section
      id="pedido"
      style={{ padding: "84px 22px", maxWidth: 760, margin: "0 auto", textAlign: "center" }}
    >
      <SectionTitle kicker="Bora adoçar o dia?" title="Faça seu pedido" />
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{
          marginTop: 40,
          background: "#fff",
          borderRadius: 30,
          padding: "36px 28px",
          boxShadow: "0 18px 44px rgba(180,90,60,0.14)",
        }}
      >
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ padding: "20px 0" }}
            >
              <motion.div
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200 }}
                style={{ fontSize: 64, marginBottom: 10 }}
              >
                🎉
              </motion.div>
              <h3 className="candy-display" style={{ fontSize: 26, margin: "0 0 8px" }}>
                Pedido recebido!
              </h3>
              <p style={{ color: "#8a6a55", margin: 0 }}>
                Logo entramos em contato pra combinar o envio. Obrigado pelo carinho 💛
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
              }}
              style={{ display: "grid", gap: 14, textAlign: "left" }}
            >
              {cartCount > 0 && (
                <div
                  style={{
                    background: "var(--candy-cream)",
                    borderRadius: 14,
                    padding: "12px 16px",
                    fontWeight: 600,
                    color: "var(--candy-cocoa)",
                  }}
                >
                  🛒 {cartCount} {cartCount === 1 ? "pacote" : "pacotes"} no carrinho — total R${" "}
                  {total.toFixed(2).replace(".", ",")}
                </div>
              )}
              <input required placeholder="Seu nome" style={inputStyle} />
              <input required placeholder="WhatsApp / telefone" style={inputStyle} />
              <input required placeholder="Cidade e estado" style={inputStyle} />
              <textarea placeholder="Quais sabores você quer? Alguma observação?" rows={3} style={inputStyle} />
              <motion.button
                type="submit"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="candy-shine"
                style={{
                  position: "relative",
                  overflow: "hidden",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontWeight: 700,
                  fontSize: 18,
                  color: "#fff",
                  background: "var(--candy-pink)",
                  padding: "15px",
                  borderRadius: 999,
                  marginTop: 4,
                  boxShadow: "0 12px 26px rgba(255,111,165,0.4)",
                }}
              >
                Enviar pedido 💌
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

const inputStyle = {
  fontFamily: "inherit",
  fontSize: 16,
  padding: "13px 16px",
  borderRadius: 14,
  border: "2px solid #f0e2cf",
  outline: "none",
  background: "var(--candy-cream)",
  color: "var(--candy-cocoa)",
  width: "100%",
};

/* ------------------------------------------------------------------ */
/* FAQ                                                                 */
/* ------------------------------------------------------------------ */

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="duvidas" style={{ padding: "84px 22px", maxWidth: 720, margin: "0 auto" }}>
      <SectionTitle kicker="Ainda na dúvida?" title="Perguntas frequentes" />
      <div style={{ marginTop: 40, display: "grid", gap: 12 }}>
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              style={{
                background: "#fff",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 8px 22px rgba(180,90,60,0.08)",
              }}
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "var(--candy-cocoa)",
                  padding: "18px 20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                {f.q}
                <motion.span animate={{ rotate: isOpen ? 45 : 0 }} style={{ fontSize: 24, color: "var(--candy-pink)" }}>
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    style={{ overflow: "hidden" }}
                  >
                    <p style={{ margin: 0, padding: "0 20px 18px", color: "#8a6a55", lineHeight: 1.55 }}>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Footer                                                              */
/* ------------------------------------------------------------------ */

function Footer() {
  return (
    <footer style={{ background: "var(--candy-cocoa)", color: "#ffe7c2", padding: "54px 22px 30px" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", textAlign: "center" }}>
        <div className="candy-display" style={{ fontSize: 28, fontWeight: 800, marginBottom: 10 }}>
          🍬 Doce Mel
        </div>
        <p style={{ opacity: 0.8, maxWidth: 420, margin: "0 auto 22px" }}>
          Balas artesanais feitas com amor, na medida certa de doçura. Adoçando o Brasil, um pacotinho por vez.
        </p>
        <div style={{ display: "flex", gap: 18, justifyContent: "center", marginBottom: 26, fontSize: 26 }}>
          {["📷", "💬", "📘"].map((ic) => (
            <motion.a
              key={ic}
              href="#"
              whileHover={{ scale: 1.3, y: -4 }}
              style={{ textDecoration: "none" }}
            >
              {ic}
            </motion.a>
          ))}
        </div>
        <p style={{ opacity: 0.55, fontSize: 13, margin: 0 }}>
          © {new Date().getFullYear()} Doce Mel · Feito à mão com 💛
        </p>
      </div>
    </footer>
  );
}

/* ------------------------------------------------------------------ */
/* Cart drawer + toast                                                 */
/* ------------------------------------------------------------------ */

function CartDrawer({ open, onClose, items, onInc, onDec, total }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: "fixed", inset: 0, background: "rgba(60,30,20,0.4)", zIndex: 60 }}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(380px, 90vw)",
              background: "var(--candy-cream)",
              zIndex: 61,
              padding: 22,
              display: "flex",
              flexDirection: "column",
              boxShadow: "-10px 0 40px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h3 className="candy-display" style={{ margin: 0, fontSize: 22 }}>
                Seu carrinho 🛒
              </h3>
              <button
                onClick={onClose}
                style={{ border: "none", background: "transparent", fontSize: 26, cursor: "pointer", color: "var(--candy-cocoa)" }}
              >
                ×
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 12, alignContent: "start" }}>
              {items.length === 0 && (
                <p style={{ color: "#8a6a55", textAlign: "center", marginTop: 40 }}>
                  Seu carrinho está vazio.<br />Que tal uma balinha? 🍬
                </p>
              )}
              <AnimatePresence>
                {items.map((it) => (
                  <motion.div
                    key={it.id}
                    layout
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "#fff",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 46,
                        height: 46,
                        borderRadius: 12,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 26,
                        background: `radial-gradient(circle, ${it.color}, ${it.accent})`,
                      }}
                    >
                      {it.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.2 }}>{it.name}</div>
                      <div style={{ fontSize: 13, color: "#a06a4a" }}>R$ {it.price.toFixed(2).replace(".", ",")}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => onDec(it.id)} style={qtyBtn}>−</button>
                      <span style={{ fontWeight: 700, minWidth: 16, textAlign: "center" }}>{it.qty}</span>
                      <button onClick={() => onInc(it.id)} style={qtyBtn}>+</button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div style={{ borderTop: "2px dashed #e7d4bb", paddingTop: 16, marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                <span style={{ fontWeight: 600 }}>Total</span>
                <span className="candy-display" style={{ fontWeight: 800, fontSize: 22 }}>
                  R$ {total.toFixed(2).replace(".", ",")}
                </span>
              </div>
              <motion.a
                href="#pedido"
                onClick={onClose}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: "block",
                  textAlign: "center",
                  textDecoration: "none",
                  background: items.length ? "var(--candy-pink)" : "#d9c4ac",
                  pointerEvents: items.length ? "auto" : "none",
                  color: "#fff",
                  fontWeight: 700,
                  padding: "14px",
                  borderRadius: 999,
                }}
              >
                Finalizar pedido →
              </motion.a>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

const qtyBtn = {
  width: 28,
  height: 28,
  borderRadius: 8,
  border: "none",
  cursor: "pointer",
  background: "var(--candy-cream)",
  color: "var(--candy-cocoa)",
  fontSize: 18,
  fontWeight: 700,
  lineHeight: 1,
};

function Toast({ msg }) {
  return (
    <AnimatePresence>
      {msg && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.8 }}
          transition={{ type: "spring", stiffness: 300, damping: 22 }}
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            translateX: "-50%",
            zIndex: 70,
            background: "var(--candy-cocoa)",
            color: "#fff",
            padding: "12px 22px",
            borderRadius: 999,
            fontWeight: 600,
            boxShadow: "0 12px 30px rgba(0,0,0,0.3)",
          }}
        >
          {msg}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/* Root app                                                            */
/* ------------------------------------------------------------------ */

export default function Candy() {
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef();

  function showToast(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }

  function addToCart(candy) {
    setCart((prev) => {
      const found = prev.find((p) => p.id === candy.id);
      if (found) return prev.map((p) => (p.id === candy.id ? { ...p, qty: p.qty + 1 } : p));
      return [...prev, { ...candy, qty: 1 }];
    });
    showToast(`${candy.emoji} ${candy.name} no carrinho!`);
  }
  const inc = (id) => setCart((p) => p.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id) =>
    setCart((p) => p.flatMap((i) => (i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i])));

  const count = cart.reduce((s, i) => s + i.qty, 0);
  const total = cart.reduce((s, i) => s + i.qty * i.price, 0);

  function goShop() {
    document.getElementById("sabores")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="candy-root candy-scroll-smooth">
      <Navbar cartCount={count} onOpenCart={() => setCartOpen(true)} />
      <Hero onShop={goShop} />
      <Marquee />
      <Products onAdd={addToCart} />
      <HowItsMade />
      <Testimonials />
      <OrderCTA cartCount={count} total={total} />
      <FAQ />
      <Footer />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={cart}
        onInc={inc}
        onDec={dec}
        total={total}
      />
      <Toast msg={toast} />
    </div>
  );
}
