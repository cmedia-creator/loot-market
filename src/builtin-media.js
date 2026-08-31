const monsterDefs = {
  "builtin/stage-02/cart-ghost.svg": { kind:"ghost", primary:"#7c3aed", secondary:"#c4b5fd", accent:"#22d3ee" },
  "builtin/stage-02/coupon-bat.svg": { kind:"bat", primary:"#db2777", secondary:"#f9a8d4", accent:"#fde047" },
  "builtin/stage-02/shipping-slime.svg": { kind:"slime", primary:"#0891b2", secondary:"#67e8f9", accent:"#f8fafc" },
  "builtin/stage-02/review-zombie.svg": { kind:"zombie", primary:"#4d7c0f", secondary:"#bef264", accent:"#facc15" },
  "builtin/stage-02/checkout-golem.svg": { kind:"golem", primary:"#475569", secondary:"#94a3b8", accent:"#38bdf8" },
  "builtin/stage-02/nemurenine.svg": { kind:"king", primary:"#312e81", secondary:"#a5b4fc", accent:"#fbbf24" },
  "builtin/stage-02/deadline-reaper.svg": { kind:"reaper", primary:"#111827", secondary:"#6b7280", accent:"#f43f5e" },
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&apos;"})[c]);
}

function monsterSvg(def) {
  const { kind, primary, secondary, accent } = def;
  const common = `
    <ellipse cx="256" cy="448" rx="126" ry="24" fill="#020617" opacity=".28"/>
    <circle cx="214" cy="238" r="16" fill="#f8fafc"/><circle cx="298" cy="238" r="16" fill="#f8fafc"/>
    <circle cx="216" cy="242" r="7" fill="#0f172a"/><circle cx="296" cy="242" r="7" fill="#0f172a"/>
    <path d="M224 292 Q256 312 288 292" fill="none" stroke="#0f172a" stroke-width="10" stroke-linecap="round"/>
  `;
  let body = "";
  if (kind === "ghost") body = `
    <path d="M150 226 C150 130 362 130 362 226 V395 L322 364 286 399 250 364 214 399 178 364 150 392Z" fill="${primary}" stroke="#1e1b4b" stroke-width="12"/>
    <path d="M122 350 H390 L365 420 H160Z" fill="none" stroke="${accent}" stroke-width="14" stroke-linejoin="round"/>
    <circle cx="194" cy="432" r="15" fill="${accent}"/><circle cx="336" cy="432" r="15" fill="${accent}"/>
    ${common}`;
  if (kind === "bat") body = `
    <path d="M178 230 Q78 150 70 278 Q122 244 162 318Z" fill="${primary}" stroke="#831843" stroke-width="12"/>
    <path d="M334 230 Q434 150 442 278 Q390 244 350 318Z" fill="${primary}" stroke="#831843" stroke-width="12"/>
    <ellipse cx="256" cy="282" rx="104" ry="128" fill="${secondary}" stroke="#831843" stroke-width="12"/>
    <path d="M194 172 L222 104 250 176M262 176 L292 104 320 174" fill="${primary}" stroke="#831843" stroke-width="10" stroke-linejoin="round"/>
    <rect x="220" y="320" width="72" height="108" rx="14" fill="#0f172a" stroke="${accent}" stroke-width="8"/><circle cx="256" cy="402" r="7" fill="${accent}"/>
    ${common}`;
  if (kind === "slime") body = `
    <path d="M116 378 Q120 202 210 188 Q234 118 274 182 Q390 190 396 378 Q352 430 256 430 Q160 430 116 378Z" fill="${primary}" stroke="#164e63" stroke-width="12"/>
    <rect x="186" y="324" width="140" height="96" rx="8" fill="#e2e8f0" stroke="#334155" stroke-width="10"/>
    <path d="M186 350 H326 M256 324 V420" stroke="${accent}" stroke-width="8"/>
    ${common}`;
  if (kind === "zombie") body = `
    <circle cx="256" cy="208" r="92" fill="${secondary}" stroke="#365314" stroke-width="12"/>
    <path d="M148 420 V324 Q148 286 190 280 H322 Q364 286 364 324 V420Z" fill="${primary}" stroke="#365314" stroke-width="12"/>
    <path d="M168 172 l34 -24 18 30 38 -38 28 34 46 -18" fill="none" stroke="#365314" stroke-width="12"/>
    <text x="256" y="366" text-anchor="middle" font-size="62" font-family="Arial,sans-serif" font-weight="900" fill="${accent}">★1</text>
    ${common}`;
  if (kind === "golem") body = `
    <rect x="142" y="170" width="228" height="236" rx="34" fill="${primary}" stroke="#1e293b" stroke-width="14"/>
    <rect x="102" y="244" width="66" height="132" rx="22" fill="${secondary}" stroke="#1e293b" stroke-width="12"/>
    <rect x="344" y="244" width="66" height="132" rx="22" fill="${secondary}" stroke="#1e293b" stroke-width="12"/>
    <rect x="204" y="300" width="104" height="74" rx="12" fill="#0f172a" stroke="${accent}" stroke-width="8"/>
    <path d="M220 338 H292" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
    ${common}`;
  if (kind === "king") body = `
    <path d="M150 430 V260 Q150 146 256 146 Q362 146 362 260 V430Z" fill="${primary}" stroke="#1e1b4b" stroke-width="14"/>
    <path d="M174 162 L194 82 246 134 286 74 326 134 358 82 374 166Z" fill="${accent}" stroke="#92400e" stroke-width="10" stroke-linejoin="round"/>
    <path d="M146 300 Q78 342 96 430 L178 390M366 300 Q434 342 416 430 L334 390" fill="${secondary}" stroke="#1e1b4b" stroke-width="14"/>
    <rect x="214" y="312" width="84" height="116" rx="14" fill="#020617" stroke="${accent}" stroke-width="8"/><path d="M230 336 H282 M230 360 H272" stroke="${accent}" stroke-width="7" stroke-linecap="round"/>
    ${common}`;
  if (kind === "reaper") body = `
    <path d="M132 424 Q144 160 256 120 Q368 160 380 424Z" fill="${primary}" stroke="#020617" stroke-width="14"/>
    <path d="M182 244 Q190 138 256 138 Q322 138 330 244 Q292 204 256 204 Q220 204 182 244Z" fill="${secondary}" opacity=".8"/>
    <path d="M364 100 Q430 108 450 160 Q406 154 382 184 L366 418" fill="none" stroke="#cbd5e1" stroke-width="15" stroke-linecap="round"/>
    <path d="M394 100 Q440 104 466 138" fill="none" stroke="${accent}" stroke-width="18" stroke-linecap="round"/>
    <path d="M225 334 H287 M256 303 V366" stroke="${accent}" stroke-width="10" stroke-linecap="round"/>
    ${common}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img">
    <defs><radialGradient id="glow"><stop offset="0" stop-color="${esc(accent)}" stop-opacity=".32"/><stop offset="1" stop-color="${esc(accent)}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="256" cy="256" r="238" fill="url(#glow)"/>
    ${body}
  </svg>`;
}

function stageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 700" role="img">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#09051d"/><stop offset="1" stop-color="#24103e"/></linearGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#21183a"/><stop offset="1" stop-color="#080611"/></linearGradient>
      <radialGradient id="neon"><stop stop-color="#22d3ee" stop-opacity=".55"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1200" height="700" fill="url(#sky)"/>
    <circle cx="600" cy="260" r="280" fill="url(#neon)"/>
    <path d="M0 480 H1200 V700 H0Z" fill="url(#floor)"/>
    <path d="M0 510 H1200 M0 575 H1200 M0 640 H1200" stroke="#6d28d9" stroke-opacity=".45" stroke-width="3"/>
    <path d="M120 480 L260 0 M340 480 L420 0 M860 480 L780 0 M1080 480 L940 0" stroke="#4c1d95" stroke-width="18" opacity=".6"/>
    <g fill="#0f172a" stroke="#a855f7" stroke-width="7">
      <rect x="120" y="160" width="250" height="260" rx="18"/><rect x="830" y="160" width="250" height="260" rx="18"/>
    </g>
    <g fill="#22d3ee" opacity=".9"><rect x="150" y="205" width="190" height="18" rx="9"/><rect x="860" y="205" width="190" height="18" rx="9"/></g>
    <g fill="#f472b6" opacity=".85"><rect x="170" y="265" width="150" height="12" rx="6"/><rect x="880" y="265" width="150" height="12" rx="6"/></g>
    <path d="M520 430 H680 L720 480 H480Z" fill="#111827" stroke="#22d3ee" stroke-width="8"/>
    <circle cx="540" cy="505" r="15" fill="#f472b6"/><circle cx="660" cy="505" r="15" fill="#f472b6"/>
    <text x="600" y="110" text-anchor="middle" font-family="Arial,sans-serif" font-size="42" font-weight="800" letter-spacing="9" fill="#e9d5ff">2:00 AM</text>
  </svg>`;
}

export function getBuiltinMedia(key) {
  if (key === "builtin/stage-02/background.svg") return { body: stageSvg(), contentType: "image/svg+xml; charset=utf-8" };
  const def = monsterDefs[key];
  if (!def) return null;
  return { body: monsterSvg(def), contentType: "image/svg+xml; charset=utf-8" };
}
