import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from './NeoButton';

/*
  BookLog's cast: a reading room of animals (a dog, a cat, a fox, a bear, an
  owl and a rabbit), each holding a hardcover up to its chin. Drawn as SVG so
  they can blink, sway and look at your cursor.
*/

const INK = 'var(--color-ink-line)';
const FUR = 'var(--color-fur)';

// Small deterministic random so every render draws the same coat
const rng = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

/** Scalloped, shaggy outline around an ellipse. */
const shaggy = (cx, cy, rx, ry, tufts, depth, seed, from = 0, to = Math.PI * 2) => {
  const r = rng(seed);
  const pts = [];
  for (let i = 0; i <= tufts; i += 1) {
    const t = from + ((to - from) * i) / tufts;
    pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, t]);
  }
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i += 1) {
    const [x, y] = pts[i];
    const tm = (pts[i - 1][2] + pts[i][2]) / 2;
    const push = depth * (0.7 + r() * 0.8);
    const qx = cx + Math.cos(tm) * (rx + push);
    const qy = cy + Math.sin(tm) * (ry + push);
    d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
};

/** Short curved strokes: the page edges that read as fur. */
const furStrokes = (cx, cy, rx, ry, n, seed, avoid = []) => {
  const r = rng(seed);
  const out = [];
  let guard = 0;
  while (out.length < n && guard < n * 20) {
    guard += 1;
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * 0.9;
    const x = cx + Math.cos(a) * rx * d;
    const y = cy + Math.sin(a) * ry * d;
    if (avoid.some(([ax, ay, ar]) => (x - ax) ** 2 + (y - ay) ** 2 < ar * ar)) continue;
    const len = 12 + r() * 16;
    const tilt = (r() - 0.5) * 0.9 + (x < cx ? 0.35 : -0.35);
    const x2 = x + Math.sin(tilt) * len * 0.5;
    const y2 = y + Math.cos(tilt) * len;
    const bend = (r() - 0.5) * 10;
    out.push(`M${x.toFixed(1)} ${y.toFixed(1)} Q${((x + x2) / 2 + bend).toFixed(1)} ${((y + y2) / 2).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`);
  }
  return out;
};

/** Pupils that drift toward the cursor. */
const useGaze = (ref, reach = 6) => {
  const x = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 });
  const y = useSpring(useMotionValue(0), { stiffness: 120, damping: 14 });
  useEffect(() => {
    const move = (e) => {
      const el = ref.current;
      if (!el) return;
      const b = el.getBoundingClientRect();
      const dx = e.clientX - (b.left + b.width / 2);
      const dy = e.clientY - (b.top + b.height * 0.4);
      const len = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, len / 400);
      x.set((dx / len) * reach * k);
      y.set((dy / len) * reach * k);
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [ref, reach, x, y]);
  return { x, y };
};

// ---------------------------------------------------------------------
// The cast: animals reading. Each one holds an open hardcover up to its
// chin, so you see the covers, the spine and the fanned pages on top.
// ---------------------------------------------------------------------
export const ANIMALS = ['dog', 'cat', 'fox', 'bear', 'owl', 'rabbit'];

const COAT = {
  dog: FUR, cat: '#AFD8FB', fox: '#E8553F', bear: '#F3C3CB', owl: '#2B6786', rabbit: FUR,
};
const COVER = {
  dog: '#E33529', cat: '#E33529', fox: '#2B6786', bear: '#2B6786', owl: '#E4EE6A', rabbit: '#2B6786',
};
// Where the top of each head is, so hats sit on it
const HEAD_TOP = { dog: 64, cat: 76, fox: 74, bear: 70, owl: 58, rabbit: 92 };
const PINK = '#F39CAE';
const S = { stroke: INK, strokeWidth: 3.2, strokeLinejoin: 'round', strokeLinecap: 'round' };

const Hat = ({ kind }) => {
  switch (kind) {
    case 'beret':
      return (
        <g {...S}>
          <path d="M120 82 C 130 40, 270 30, 286 76 C 262 92, 150 98, 120 82 Z" fill="#E33529" />
          <path d="M200 40 q4 -14 10 -16" fill="none" />
        </g>
      );
    case 'quill':
      return (
        <g {...S} strokeWidth="2.6">
          <path d="M276 96 C 300 40, 340 18, 362 10 C 352 40, 322 84, 284 104 Z" fill={FUR} />
          <path d="M282 100 L 352 22 M300 74 l14 -2 M312 58 l14 -2 M324 44 l12 -2" fill="none" />
        </g>
      );
    case 'bow':
      return (
        <g {...S} strokeWidth="3">
          <path d="M200 70 L 168 52 L 170 88 Z M200 70 L 232 52 L 230 88 Z" fill="#E33529" />
          <circle cx="200" cy="70" r="8" fill="#E33529" />
        </g>
      );
    case 'crown':
      return <path {...S} strokeWidth="3" d="M160 78 L 166 40 L 184 62 L 200 32 L 216 62 L 234 40 L 240 78 Z" fill="#E4EE6A" />;
    case 'cap':
      return (
        <g {...S}>
          <path d="M132 84 C 136 30, 264 30, 268 84 Z" fill="#E33529" />
          <path d="M240 82 C 270 78, 300 84, 312 96 C 290 98, 262 94, 240 90 Z" fill="#E33529" />
          <circle cx="200" cy="38" r="6" fill="#E33529" />
        </g>
      );
    default:
      return null;
  }
};

const Glasses = ({ y = 172, xs = [166, 234], r = 21 }) => (
  <g fill="none" stroke={INK} strokeWidth="3.2">
    <circle cx={xs[0]} cy={y} r={r} fill="rgba(175,216,251,0.25)" />
    <circle cx={xs[1]} cy={y} r={r} fill="rgba(175,216,251,0.25)" />
    <path d={`M${xs[0] + r} ${y - 2} q${(xs[1] - xs[0] - 2 * r) / 2} -8 ${xs[1] - xs[0] - 2 * r} 0`} />
    <path d={`M${xs[0] - r} ${y - 4} l-22 -8 M${xs[1] + r} ${y - 4} l22 -8`} />
  </g>
);

/** Two eyes that follow the cursor, blink, or sleep. */
const Eyes = ({ gaze, sleep, xs = [166, 234], y = 172, rx = 10, ry = 12.5 }) => (sleep ? (
  <g fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round">
    {xs.map((x) => <path key={x} d={`M${x - 14} ${y + 4} q14 10 28 0`} />)}
  </g>
) : (
  <motion.g style={{ x: gaze.x, y: gaze.y }}>
    {xs.map((x) => (
      <g key={x} className="blink">
        <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={INK} />
        <circle cx={x + rx * 0.35} cy={y - ry * 0.4} r={rx * 0.34} fill="#fff" />
      </g>
    ))}
  </motion.g>
));

const DogNose = () => (
  <g>
    <path d="M182 200 C 182 190, 218 190, 218 200 C 218 214, 206 222, 200 222 C 194 222, 182 214, 182 200 Z" fill={INK} />
    <ellipse cx="193" cy="198" rx="5" ry="3" fill="#fff" opacity="0.7" />
    <path d="M200 222 v10 M180 236 q20 16 40 0" fill="none" {...S} />
  </g>
);

/** Each animal's head, ears and face. */
const Head = ({ animal, coat, gaze, sleep, seed, glasses }) => {
  const fur = useMemo(() => ({
    head: shaggy(200, 168, 116, 104, 30, 13, seed),
    strokes: furStrokes(200, 150, 96, 80, 18, seed, [[166, 172, 30], [234, 172, 30], [200, 214, 34]]),
    ears: [0, 1].map((side) => shaggy(0, 86, 30, 88, 16, 6, seed + 5 + side)),
  }), [seed]);

  if (animal === 'dog') {
    return (
      <g>
        <path d={fur.head} fill={coat} {...S} />
        {fur.strokes.map((d) => <path key={d} d={d} fill="none" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />)}
        <Eyes gaze={gaze} sleep={sleep} />
        <path d="M146 148 q20 -14 40 -4 M214 144 q20 -10 40 4" fill="none" {...S} strokeWidth="3" />
        <DogNose />
        {glasses && <Glasses />}
        {/* floppy fur ears over the sides of the head */}
        {[0, 1].map((side) => {
          const sx = side ? 1 : -1;
          return (
            <motion.g key={side} style={{ originX: `${200 + sx * 104}px`, originY: '88px' }}
              animate={{ rotate: [sx * 2, sx * -6, sx * 2] }} transition={{ duration: 3 + side * 0.5, repeat: Infinity, ease: 'easeInOut' }}>
              <g transform={`translate(${200 + sx * 106} 84) rotate(${sx * -14})`}>
                <path d={fur.ears[side]} fill="#ECD5BD" {...S} />
                <path d={`M${sx * -8} 40 q${sx * 6} 30 0 64 M${sx * 8} 60 q${sx * 4} 20 0 46`} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
              </g>
            </motion.g>
          );
        })}
      </g>
    );
  }

  if (animal === 'cat') {
    return (
      <g>
        <path d="M100 132 L 110 34 L 180 86 Z M300 132 L 290 34 L 220 86 Z" fill={coat} {...S} />
        <path d="M118 112 L 123 60 L 160 88 Z M282 112 L 277 60 L 240 88 Z" fill={PINK} />
        <path d="M88 170 C 88 100, 140 76, 200 76 C 260 76, 312 100, 312 170 C 312 214, 330 232, 318 248 C 290 272, 250 282, 200 282 C 150 282, 110 272, 82 248 C 70 232, 88 214, 88 170 Z" fill={coat} {...S} />
        <path d="M186 84 l4 22 M200 80 v26 M214 84 l-4 22" fill="none" {...S} strokeWidth="2.6" />
        <Eyes gaze={gaze} sleep={sleep} ry={14} />
        <path d="M188 204 L 212 204 L 200 218 Z" fill={PINK} {...S} strokeWidth="2.6" />
        <path d="M200 218 v8 M182 228 q9 10 18 -2 q9 12 18 2" fill="none" {...S} strokeWidth="2.8" />
        <path d="M150 212 L 92 200 M150 222 L 92 228 M250 212 L 308 200 M250 222 L 308 228" fill="none" {...S} strokeWidth="2.4" />
        {glasses && <Glasses />}
      </g>
    );
  }

  if (animal === 'fox') {
    return (
      <g>
        <path d="M98 130 L 94 28 L 174 82 Z M302 130 L 306 28 L 226 82 Z" fill={coat} {...S} />
        <path d="M110 112 L 108 58 L 150 86 Z M290 112 L 292 58 L 250 86 Z" fill={FUR} />
        <path d="M94 28 L 98 62 L 118 50 Z M306 28 L 302 62 L 282 50 Z" fill={INK} />
        <path d="M92 150 C 92 96, 140 74, 200 74 C 260 74, 308 96, 308 150 C 308 176, 322 200, 346 214 C 300 238, 250 272, 200 284 C 150 272, 100 238, 54 214 C 78 200, 92 176, 92 150 Z" fill={coat} {...S} />
        <path d="M118 198 C 150 194, 182 204, 200 226 C 218 204, 250 194, 282 198 C 272 240, 240 270, 200 284 C 160 270, 128 240, 118 198 Z" fill={FUR} />
        <path d="M54 214 C 100 238, 150 272, 200 284 C 250 272, 300 238, 346 214" fill="none" {...S} />
        <Eyes gaze={gaze} sleep={sleep} y={166} />
        <ellipse cx="200" cy="230" rx="13" ry="9" fill={INK} />
        <path d="M200 239 v8 M188 252 q12 8 24 0" fill="none" {...S} strokeWidth="2.8" />
        {glasses && <Glasses y={166} />}
      </g>
    );
  }

  if (animal === 'bear') {
    return (
      <g>
        {[118, 282].map((x) => (
          <g key={x}>
            <circle cx={x} cy="94" r="38" fill={coat} {...S} />
            <circle cx={x} cy="96" r="19" fill={PINK} />
          </g>
        ))}
        <ellipse cx="200" cy="176" rx="114" ry="106" fill={coat} {...S} />
        <ellipse cx="200" cy="222" rx="50" ry="38" fill={FUR} {...S} strokeWidth="2.8" />
        <Eyes gaze={gaze} sleep={sleep} xs={[160, 240]} y={168} />
        <ellipse cx="200" cy="206" rx="15" ry="10" fill={INK} />
        <path d="M200 216 v12 M184 234 q16 12 32 0" fill="none" {...S} strokeWidth="2.8" />
        <circle cx="128" cy="210" r="12" fill={PINK} opacity="0.8" />
        <circle cx="272" cy="210" r="12" fill={PINK} opacity="0.8" />
        {glasses && <Glasses xs={[160, 240]} y={168} />}
      </g>
    );
  }

  if (animal === 'owl') {
    const xs = [156, 244];
    return (
      <g>
        <path d="M88 132 L 96 52 L 150 96 C 180 88, 220 88, 250 96 L 304 52 L 312 132 C 322 210, 288 276, 200 282 C 112 276, 78 210, 88 132 Z" fill={coat} {...S} />
        {xs.map((x) => <circle key={x} cx={x} cy="170" r="44" fill="#AFD8FB" {...S} strokeWidth="2.8" />)}
        {sleep ? (
          <g fill="none" stroke={INK} strokeWidth="3.4" strokeLinecap="round">
            {xs.map((x) => <path key={x} d={`M${x - 18} 172 q18 12 36 0`} />)}
          </g>
        ) : (
          <>
            {xs.map((x) => <circle key={x} cx={x} cy="170" r="27" fill={FUR} {...S} strokeWidth="2.6" />)}
            <motion.g style={{ x: gaze.x, y: gaze.y }}>
              {xs.map((x) => (
                <g key={x} className="blink">
                  <circle cx={x} cy="170" r="13" fill={INK} />
                  <circle cx={x + 5} cy="164" r="4.5" fill="#fff" />
                </g>
              ))}
            </motion.g>
          </>
        )}
        <path d="M124 120 q32 -16 62 4 M276 120 q-32 -16 -62 4" fill="none" {...S} strokeWidth="3.4" />
        <path d="M186 204 L 214 204 L 200 232 Z" fill="#E4EE6A" {...S} strokeWidth="2.8" />
        <path d="M150 238 q10 10 20 0 q10 10 20 0 M210 238 q10 10 20 0 q10 10 20 0" fill="none" stroke="#AFD8FB" strokeWidth="3" strokeLinecap="round" />
      </g>
    );
  }

  // rabbit
  return (
    <g>
      {[-1, 1].map((sx) => (
        <motion.g key={sx} style={{ originX: `${200 + sx * 42}px`, originY: '120px' }}
          animate={{ rotate: [sx * 6, sx * 14, sx * 6] }} transition={{ duration: 3.4 + (sx > 0 ? 0.6 : 0), repeat: Infinity, ease: 'easeInOut' }}>
          <ellipse cx={200 + sx * 42} cy="58" rx="26" ry="66" fill={coat} {...S} />
          <ellipse cx={200 + sx * 42} cy="64" rx="12" ry="46" fill={PINK} />
        </motion.g>
      ))}
      <ellipse cx="200" cy="186" rx="104" ry="96" fill={coat} {...S} />
      <Eyes gaze={gaze} sleep={sleep} xs={[164, 236]} y={176} />
      <path d="M190 210 q10 -8 20 0 q-10 12 -20 0 Z" fill={PINK} {...S} strokeWidth="2.4" />
      <path d="M200 216 v10 M184 228 q16 10 32 0" fill="none" {...S} strokeWidth="2.6" />
      <path d="M192 230 h16 v12 h-16 Z M200 230 v12" fill={FUR} {...S} strokeWidth="2.2" />
      <circle cx="132" cy="214" r="13" fill={PINK} opacity="0.7" />
      <circle cx="268" cy="214" r="13" fill={PINK} opacity="0.7" />
      <path d="M150 214 L 104 206 M150 222 L 104 230 M250 214 L 296 206 M250 222 L 296 230" fill="none" {...S} strokeWidth="2.2" />
      {glasses && <Glasses xs={[164, 236]} y={176} />}
    </g>
  );
};

/** The open hardcover each reader holds up, with its paws on the top corners. */
const HeldBook = ({ cover, coat, ribbon }) => (
  <motion.g style={{ originX: '200px', originY: '360px' }} animate={{ rotate: [-1.5, 1.5, -1.5], y: [0, -3, 0] }}
    transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}>
    {ribbon && (
      <motion.path d="M206 414 C 214 432, 198 444, 208 462 l-6 12 l10 -5 l6 9 l-2 -14" fill="none" stroke="#E33529" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"
        style={{ originX: '206px', originY: '414px' }} animate={{ rotate: [-6, 6, -6] }} transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
    )}
    {/* fanned page block above the covers */}
    <path d="M84 300 C 130 284, 176 292, 200 312 C 224 292, 270 284, 316 300 L 320 312 C 270 296, 226 304, 200 324 C 174 304, 130 296, 80 312 Z" fill="#FFFDF4" {...S} strokeWidth="2.6" />
    <path d="M100 302 C 140 292, 178 298, 198 314 M302 302 C 262 292, 222 298, 202 314" fill="none" stroke={INK} strokeWidth="1.4" opacity="0.5" />
    {/* covers and spine */}
    <path d="M78 310 Q 140 302 198 326 L 198 418 Q 140 398 84 404 Z" fill={cover} {...S} />
    <path d="M322 310 Q 260 302 202 326 L 202 418 Q 260 398 316 404 Z" fill={cover} {...S} />
    <path d="M194 324 L 206 324 L 206 420 L 194 420 Z" fill={cover} {...S} strokeWidth="2.8" />
    <path d="M194 324 L 206 324 L 206 420 L 194 420 Z" fill="rgba(0,0,0,0.22)" />
    <path d="M98 322 Q 144 318 184 334 L 184 404 Q 144 390 102 394 Z M302 322 Q 256 318 216 334 L 216 404 Q 256 390 298 394 Z" fill="none" stroke="rgba(255,255,251,0.55)" strokeWidth="2" />
    {/* title plate on the front cover */}
    <path d="M232 346 L 286 338 L 286 366 L 232 372 Z" fill="#FFFDF4" {...S} strokeWidth="2.4" />
    <path d="M242 352 l34 -4 M242 361 l24 -3" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
    {/* paws gripping the top corners */}
    {[96, 304].map((x) => (
      <g key={x}>
        <ellipse cx={x} cy="306" rx="24" ry="17" fill={coat} {...S} />
        <path d={`M${x - 7} 296 v10 M${x + 7} 296 v10`} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    ))}
  </motion.g>
);

/**
 * A reader: one of the animals, holding a book up to its chin.
 * animal: dog | cat | fox | bear | owl | rabbit (defaults from the seed)
 * prop: glasses | beret | quill | bow | crown | cap · sleep: eyes shut
 * body: draw the shoulders behind the book · cover / ears[0]: book colour
 */
export const DogEar = ({
  className, animal, ears, cover, prop, sleep = false, ribbon = true, body = true, seed = 7,
}) => {
  const ref = useRef(null);
  const kind = ANIMALS.includes(animal) ? animal : ANIMALS[Math.abs(seed) % ANIMALS.length];
  const gaze = useGaze(ref, kind === 'owl' ? 9 : 6);
  const coat = COAT[kind];
  const bookColour = cover || ears?.[0] || COVER[kind];
  const shoulders = useMemo(() => shaggy(200, 352, 150, 120, 26, 15, seed + 3, Math.PI * 1.02, Math.PI * 1.98), [seed]);
  const hat = prop === 'headphones' ? 'cap' : prop; // no headsets: readers get a cap instead

  return (
    <svg ref={ref} viewBox="0 0 400 430" className={cn('block overflow-visible', className)} aria-hidden="true">
      {body && (kind === 'dog'
        ? <path d={`${shoulders} L 350 430 L 50 430 Z`} fill={coat} {...S} />
        : <path d="M64 430 C 64 330, 118 278, 200 278 C 282 278, 336 330, 336 430 Z" fill={coat} {...S} />)}
      <Head animal={kind} coat={coat} gaze={gaze} sleep={sleep} seed={seed} glasses={prop === 'glasses' && kind !== 'owl'} />
      {hat && hat !== 'glasses' && <g transform={`translate(0 ${HEAD_TOP[kind] - 64})`}><Hat kind={hat} /></g>}
      <HeldBook cover={bookColour} coat={coat} ribbon={ribbon} />
      {sleep && (
        <motion.g fill="#E33529" className="font-display" style={{ fontSize: 34 }} animate={{ y: [0, -14, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity }}>
          <text x="306" y="70">Z</text><text x="334" y="40" style={{ fontSize: 24 }}>Z</text>
        </motion.g>
      )}
    </svg>
  );
};

export const Reader = DogEar;

/**
 * The logo: a book-dachshund trotting along. Its body is a closed book
 * (page lines along the belly), its ear is the cover flap, its tail the ribbon.
 */
export const Runner = ({ className, run = true, color = 'currentColor', detail = 'var(--color-bg-base)' }) => (
  <svg viewBox="0 0 120 64" className={cn('block overflow-visible', className)} aria-hidden="true">
    {/* legs */}
    {[[38, 0], [48, 0.15], [78, 0.1], [88, 0.25]].map(([x, delay]) => (
      <g key={x} style={{ transformOrigin: `${x}px 40px`, animation: run ? `trot 0.42s ${delay}s ease-in-out infinite` : 'none' }}>
        <path d={`M${x} 38 L${x} 56`} stroke={color} strokeWidth="5" strokeLinecap="round" />
      </g>
    ))}
    {/* tail = ribbon */}
    <g style={{ transformOrigin: '28px 30px', animation: run ? 'wag 0.5s ease-in-out infinite' : 'none' }}>
      <path d="M28 30 C 18 26, 14 14, 4 12" fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
      <path d="M2 8 l2 8 l6 -4 z" fill={color} />
    </g>
    {/* body = book */}
    <rect x="24" y="22" width="72" height="22" rx="10" fill={color} />
    <path d="M34 39 H 86 M34 34.5 H 86" stroke={detail} strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
    {/* head */}
    <path d="M88 26 C 88 10, 100 6, 108 10 L 118 18 C 120 22, 116 26, 112 26 L 100 30 C 94 32, 88 32, 88 26 Z" fill={color} />
    {/* ear = cover flap */}
    <g style={{ transformOrigin: '98px 12px', animation: run ? 'wag 0.42s ease-in-out infinite' : 'none' }}>
      <path d="M96 10 C 90 12, 86 22, 90 30 L 98 26 C 100 20, 100 14, 96 10 Z" fill={color} stroke={detail} strokeWidth="1.6" />
    </g>
    <circle cx="106" cy="16" r="1.8" fill={detail} />
    {/* collar */}
    <path d="M90 32 l6 -12" stroke={detail} strokeWidth="2" />
  </svg>
);

/** A floating white page-ball: a crumpled page with ruled lines. */
export const PageBall = ({ className, seed = 1, tone = FUR }) => {
  const lines = useMemo(() => {
    const r = rng(seed * 31);
    return Array.from({ length: 3 }, (_, i) => {
      const y = 40 + i * 12 + r() * 4;
      return `M${18 + r() * 8} ${y} Q 50 ${y + (r() - 0.5) * 14} ${82 - r() * 8} ${y + (r() - 0.5) * 6}`;
    });
  }, [seed]);
  return (
    <svg viewBox="0 0 100 100" className={cn('block', className)} aria-hidden="true">
      <circle cx="50" cy="50" r="48" fill={tone} />
      <path d="M10 30 C 40 50, 40 80, 22 92 M90 70 C 62 54, 62 24, 78 10" fill="none" stroke="var(--color-pink)" strokeWidth="1.2" opacity="0.8" />
      {lines.map((d) => <path key={d} d={d} fill="none" stroke="var(--color-pink)" strokeWidth="0.8" opacity="0.55" />)}
    </svg>
  );
};

/** A paw print, for small decoration. */
export const Paw = ({ className }) => (
  <svg viewBox="0 0 40 40" className={cn('block', className)} aria-hidden="true" fill="currentColor">
    <ellipse cx="20" cy="27" rx="10" ry="8" />
    <ellipse cx="9" cy="16" rx="4" ry="5" /><ellipse cx="17" cy="10" rx="4" ry="5" />
    <ellipse cx="25" cy="10" rx="4" ry="5" /><ellipse cx="32" cy="16" rx="4" ry="5" />
  </svg>
);

// ---------------------------------------------------------------------
// 3D book: front cover, spine, page block and back, tilting to the cursor
// ---------------------------------------------------------------------
export const Book3D = ({ book, width = 200, className, tilt = true, idle = -28, children }) => {
  const [hover, setHover] = useState(false);
  const rx = useSpring(useMotionValue(0), { stiffness: 140, damping: 16 });
  const ry = useSpring(useMotionValue(idle), { stiffness: 140, damping: 16 });
  useEffect(() => { if (!hover) { ry.set(idle); rx.set(0); } }, [hover, idle, rx, ry]);
  const h = Math.round(width * 1.5);
  const t = Math.max(14, Math.min(44, Math.round((book?.page_count || 300) / 11))) * (width / 200);
  const spine = 'linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.3))';
  const move = (e) => {
    if (!tilt) return;
    const b = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - b.left) / b.width - 0.5) * 50 - 8);
    rx.set(-((e.clientY - b.top) / b.height - 0.5) * 24);
  };
  return (
    <div
      className={cn('relative select-none', className)}
      style={{ width, height: h, perspective: width * 6 }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerMove={move}
    >
      <motion.div className="book3d absolute inset-0" style={{ rotateX: rx, rotateY: ry }}>
        {/* page block */}
        <div className="absolute top-[3px]" style={{ width: t, height: h - 6, left: (width - t) / 2, transform: `rotateY(90deg) translateZ(${width / 2 - 3}px)`, background: 'repeating-linear-gradient(90deg, #FBFBF4 0 2px, #E9E4D6 2px 3px)' }} />
        <div className="absolute left-[3px]" style={{ height: t, width: width - 6, top: (h - t) / 2, transform: `rotateX(90deg) translateZ(${h / 2 - 3}px)`, background: 'repeating-linear-gradient(0deg, #FBFBF4 0 2px, #E9E4D6 2px 3px)' }} />
        {/* spine */}
        <div className="absolute top-0 flex items-center justify-center overflow-hidden" style={{ width: t, height: h, left: (width - t) / 2, transform: `rotateY(-90deg) translateZ(${width / 2}px)`, background: 'var(--color-red-deep)' }}>
          <span className="absolute inset-0" style={{ background: spine }} />
          <span className="relative font-display text-[#FBFBF4] whitespace-nowrap" style={{ transform: 'rotate(90deg)', fontSize: Math.max(9, t * 0.45) }}>{book?.title?.slice(0, 40)}</span>
        </div>
        {/* back */}
        <div className="absolute inset-0 rounded-[3px] bg-red-deep" style={{ transform: `rotateY(180deg) translateZ(${t / 2}px)` }} />
        {/* front */}
        <div className="absolute inset-0 rounded-r-[4px] rounded-l-[2px] overflow-hidden bg-surface-white shadow-[0_30px_50px_-20px_rgba(80,20,12,0.6)]" style={{ transform: `translateZ(${t / 2}px)` }}>
          {children}
          <span className="absolute inset-y-0 left-0 w-[7%] bg-[linear-gradient(90deg,rgba(0,0,0,0.28),rgba(255,255,255,0.12)_45%,transparent)]" />
          <span className="absolute inset-0 bg-[linear-gradient(115deg,rgba(255,255,255,0.22),transparent_40%)]" />
        </div>
      </motion.div>
    </div>
  );
};
