/**
 * The landing-page eye: an almond-shaped eye drawn in SVG — tapered lids, sclera, a
 * fibred multi-tone iris, pupil and catch-lights — with a quiet scanning overlay.
 * Purely decorative (aria-hidden), no images, scales to any width.
 */
const FIBRES = Array.from({ length: 144 }, (_, i) => i * 2.5);

export default function HeroEye() {
  return (
    <svg className="rx-eyesvg" viewBox="0 0 640 400" aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="eye-open">
          <path d="M48 206 C150 70 490 70 592 206 C490 326 150 326 48 206 Z" />
        </clipPath>
        <radialGradient id="sclera" cx="50%" cy="52%" r="62%">
          <stop offset="0" stopColor="#F4F1F3" />
          <stop offset=".5" stopColor="#E2DADF" />
          <stop offset=".78" stopColor="#B9A9B4" />
          <stop offset="1" stopColor="#5E4A58" />
        </radialGradient>
        <radialGradient id="iris" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#140A14" />
          <stop offset=".34" stopColor="#3B0F2E" />
          <stop offset=".42" stopColor="#FB7185" />
          <stop offset=".55" stopColor="#F472B6" />
          <stop offset=".68" stopColor="#C026D3" />
          <stop offset=".8" stopColor="#7C3AED" />
          <stop offset=".9" stopColor="#3B1A78" />
          <stop offset="1" stopColor="#0E0820" />
        </radialGradient>
        <radialGradient id="irisShade" cx="50%" cy="20%" r="80%">
          <stop offset="0" stopColor="#000" stopOpacity=".55" />
          <stop offset=".45" stopColor="#000" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="lidShadow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1A0E16" stopOpacity=".75" />
          <stop offset=".35" stopColor="#1A0E16" stopOpacity="0" />
        </linearGradient>
        <filter id="soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>

      {/* ambient glow behind the eye */}
      <ellipse cx="320" cy="206" rx="230" ry="120" fill="#C026D3" opacity=".18" filter="url(#glow)" />

      <g clipPath="url(#eye-open)">
        <rect x="0" y="0" width="640" height="400" fill="url(#sclera)" />
        <g className="rx-eye-iris">
          <circle cx="320" cy="200" r="104" fill="url(#iris)" />
          <g opacity=".55">
            {FIBRES.map((a) => (
              <line
                key={a}
                x1="320" y1="162" x2="320" y2="100"
                stroke={a % 5 === 0 ? "#2A0A26" : "#FFE4F1"}
                strokeWidth={a % 5 === 0 ? 1.4 : 0.7}
                strokeOpacity={a % 5 === 0 ? 0.55 : 0.4}
                transform={`rotate(${a} 320 200)`}
              />
            ))}
          </g>
          <circle cx="320" cy="200" r="104" fill="none" stroke="#0B0614" strokeWidth="7" opacity=".85" />
          <circle cx="320" cy="200" r="44" fill="#050307" />
          <circle cx="320" cy="200" r="46" fill="none" stroke="#FB7185" strokeOpacity=".35" strokeWidth="2" />
          <circle cx="320" cy="200" r="104" fill="url(#irisShade)" />
          {/* catch-lights */}
          <ellipse cx="352" cy="164" rx="20" ry="13" fill="#fff" opacity=".92" transform="rotate(-22 352 164)" filter="url(#soft)" />
          <circle cx="290" cy="232" r="5" fill="#fff" opacity=".55" />
        </g>
        <rect x="0" y="0" width="640" height="400" fill="url(#lidShadow)" />
      </g>

      {/* lids */}
      {/* tapered upper lid: thick in the middle, fine at the corners */}
      <path d="M48 206 C150 70 490 70 592 206 C490 60 150 60 48 206 Z" fill="currentColor" fillOpacity=".92" />
      <path d="M48 206 C150 326 490 326 592 206" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M96 150 C200 30 440 30 544 150" fill="none" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" strokeLinecap="round" />

      {/* scanning overlay */}
      <g className="rx-eye-hud" fill="none">
        <circle cx="320" cy="200" r="132" stroke="currentColor" strokeOpacity=".22" strokeDasharray="2 7" />
        <circle className="rx-eye-arc" cx="320" cy="200" r="150" stroke="#F472B6" strokeOpacity=".6" strokeWidth="1.5" strokeDasharray="120 822" />
        <circle className="rx-eye-arc2" cx="320" cy="200" r="168" stroke="#A78BFA" strokeOpacity=".45" strokeWidth="1.2" strokeDasharray="70 986" />
        <path d="M320 20 v18 M320 362 v18 M120 200 h18 M502 200 h18" stroke="currentColor" strokeOpacity=".35" />
      </g>
    </svg>
  );
}
