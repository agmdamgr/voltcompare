import React, { useState } from 'react';

/* ─────────────────────────────────────────────────────────
   Inline SVG definitions
   All sprites share a 220×80 viewBox (barrel points left).
   ───────────────────────────────────────────────────────── */

const RifleSVG: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="100%" height="100%" aria-label="Rifle reference sprite">
    {/* BARREL (long and thin) */}
    <rect x="5" y="30" width="130" height="7" rx="1.5" fill="#2D3436"/>
    {/* MUZZLE DEVICE */}
    <rect x="5" y="28" width="13" height="11" rx="2" fill="#2D3436"/>
    <line x1="9"  y1="28" x2="9"  y2="39" stroke="#636E72" strokeWidth="1.2"/>
    <line x1="13" y1="28" x2="13" y2="39" stroke="#636E72" strokeWidth="1.2"/>
    {/* GAS TUBE */}
    <rect x="22" y="26" width="62" height="3.5" rx="1" fill="#3D4A4D"/>
    {/* FRONT SIGHT */}
    <rect x="22" y="22" width="4" height="6" rx="0.5" fill="#2D3436"/>
    {/* HANDGUARD */}
    <rect x="26" y="27" width="58" height="12" rx="3" fill="#795548"/>
    <line x1="35" y1="28" x2="35" y2="38" stroke="#A1887F" strokeWidth="0.8"/>
    <line x1="45" y1="28" x2="45" y2="38" stroke="#A1887F" strokeWidth="0.8"/>
    <line x1="55" y1="28" x2="55" y2="38" stroke="#A1887F" strokeWidth="0.8"/>
    <line x1="65" y1="28" x2="65" y2="38" stroke="#A1887F" strokeWidth="0.8"/>
    {/* UPPER RECEIVER */}
    <rect x="84" y="23" width="47" height="14" rx="2" fill="#2D3436"/>
    {/* CHARGING HANDLE */}
    <rect x="102" y="19" width="15" height="6" rx="1.5" fill="#636E72"/>
    <rect x="104" y="17" width="11" height="4" rx="1" fill="#4A4A4A"/>
    {/* REAR SIGHT */}
    <rect x="86" y="20" width="9" height="5" rx="1" fill="#2D3436"/>
    <rect x="88" y="21" width="5" height="3" rx="0.5" fill="#1A1A1A"/>
    {/* LOWER RECEIVER */}
    <rect x="84" y="37" width="47" height="10" rx="2" fill="#636E72"/>
    {/* TRIGGER GUARD */}
    <path d="M87 47 Q100 62 122 47" fill="none" stroke="#4A4A4A" strokeWidth="2.5"/>
    {/* TRIGGER */}
    <rect x="101" y="40" width="3" height="12" rx="1" fill="#B2BEC3"/>
    {/* MAGAZINE */}
    <path d="M90 47 L106 47 L108 69 L92 69 Z" fill="#2D3436"/>
    <line x1="94" y1="52" x2="104" y2="52" stroke="#636E72" strokeWidth="1"/>
    <line x1="94" y1="57" x2="104" y2="57" stroke="#636E72" strokeWidth="1"/>
    <line x1="94" y1="62" x2="104" y2="62" stroke="#636E72" strokeWidth="1"/>
    {/* PISTOL GRIP */}
    <path d="M122 47 L132 47 L135 62 L126 64 L120 55 Z" fill="#2D3436"/>
    {/* STOCK */}
    <path d="M131 23 L200 20 L213 36 L200 50 L131 48 Z" fill="#795548"/>
    <path d="M143 22 L190 20 L190 27 L143 29 Z" fill="#A1887F"/>
    {/* BUTTPLATE */}
    <rect x="210" y="20" width="6" height="31" rx="2" fill="#2D3436"/>
    {/* Wood grain */}
    <line x1="145" y1="22" x2="197" y2="21" stroke="#BCAAA4" strokeWidth="0.8"/>
    <line x1="145" y1="39" x2="195" y2="42" stroke="#5D4037" strokeWidth="0.8"/>
  </svg>
);

const ShotgunOptionA: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="100%" height="100%" aria-label="Pump-action shotgun sprite option A">
    {/* BARREL */}
    <rect x="5" y="27" width="90" height="10" rx="2" fill="#2D3436"/>
    {/* MUZZLE */}
    <rect x="5" y="25" width="9" height="14" rx="2.5" fill="#2D3436"/>
    {/* TUBE MAGAZINE */}
    <rect x="5" y="40" width="86" height="7" rx="3.5" fill="#636E72"/>
    <ellipse cx="7" cy="43.5" rx="3" ry="5.5" fill="#4A4A4A"/>
    <rect x="83" y="40" width="6" height="7" rx="1" fill="#4A4A4A"/>
    {/* PUMP FORE-END */}
    <rect x="26" y="25" width="38" height="24" rx="5" fill="#8D6E63"/>
    <line x1="32" y1="27" x2="32" y2="47" stroke="#BCAAA4" strokeWidth="1"/>
    <line x1="38" y1="27" x2="38" y2="47" stroke="#BCAAA4" strokeWidth="1"/>
    <line x1="44" y1="27" x2="44" y2="47" stroke="#BCAAA4" strokeWidth="1"/>
    <line x1="50" y1="27" x2="50" y2="47" stroke="#BCAAA4" strokeWidth="1"/>
    <line x1="56" y1="27" x2="56" y2="47" stroke="#BCAAA4" strokeWidth="1"/>
    {/* PUMP RAILS */}
    <rect x="20" y="38" width="52" height="3" rx="1" fill="#4A4A4A"/>
    {/* RECEIVER */}
    <rect x="91" y="22" width="44" height="28" rx="3" fill="#636E72"/>
    <rect x="91" y="20" width="44" height="6" rx="2" fill="#2D3436"/>
    {/* EJECTION PORT */}
    <rect x="100" y="25" width="16" height="10" rx="1" fill="#454545"/>
    {/* TRIGGER GUARD */}
    <path d="M95 50 Q108 64 128 50" fill="none" stroke="#4A4A4A" strokeWidth="2.5"/>
    {/* TRIGGER */}
    <rect x="108" y="43" width="3" height="12" rx="1" fill="#B2BEC3"/>
    {/* PISTOL GRIP (wood) */}
    <path d="M126 50 L135 50 L138 64 L129 66 L124 57 Z" fill="#795548"/>
    {/* STOCK */}
    <path d="M135 22 L202 19 L214 37 L202 52 L135 50 Z" fill="#795548"/>
    <path d="M147 21 L194 19 L194 27 L147 29 Z" fill="#A1887F"/>
    {/* BUTTPLATE */}
    <rect x="211" y="19" width="6" height="34" rx="2" fill="#2D3436"/>
    <line x1="149" y1="21" x2="199" y2="20" stroke="#BCAAA4" strokeWidth="0.8"/>
    <line x1="149" y1="39" x2="197" y2="44" stroke="#5D4037" strokeWidth="0.8"/>
  </svg>
);

const ShotgunOptionB: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="100%" height="100%" aria-label="Tactical semi-auto shotgun sprite option B">
    {/* BARREL */}
    <rect x="5" y="29" width="80" height="10" rx="2" fill="#2D3436"/>
    {/* MUZZLE BRAKE */}
    <rect x="5" y="27" width="11" height="14" rx="2" fill="#2D3436"/>
    <line x1="8"  y1="27" x2="8"  y2="41" stroke="#636E72" strokeWidth="1.2"/>
    <line x1="11" y1="27" x2="11" y2="41" stroke="#636E72" strokeWidth="1.2"/>
    {/* HEAT SHIELD with vent holes */}
    <rect x="14" y="26" width="64" height="6" rx="1.5" fill="#4A4A4A"/>
    <circle cx="20" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="27" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="34" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="41" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="48" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="55" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="62" cy="29" r="1.8" fill="#2D3436"/>
    <circle cx="69" cy="29" r="1.8" fill="#2D3436"/>
    {/* TUBE MAGAZINE */}
    <rect x="5" y="41" width="76" height="7" rx="3.5" fill="#636E72"/>
    <ellipse cx="7" cy="44.5" rx="3" ry="5" fill="#4A4A4A"/>
    {/* RECEIVER */}
    <rect x="83" y="22" width="44" height="28" rx="3" fill="#636E72"/>
    {/* PICATINNY RAIL */}
    <rect x="83" y="18" width="44" height="6" rx="1" fill="#2D3436"/>
    <rect x="87"  y="20" width="5" height="2.5" rx="0.5" fill="#4A4A4A"/>
    <rect x="95"  y="20" width="5" height="2.5" rx="0.5" fill="#4A4A4A"/>
    <rect x="103" y="20" width="5" height="2.5" rx="0.5" fill="#4A4A4A"/>
    <rect x="111" y="20" width="5" height="2.5" rx="0.5" fill="#4A4A4A"/>
    <rect x="119" y="20" width="5" height="2.5" rx="0.5" fill="#4A4A4A"/>
    {/* GHOST RING REAR SIGHT */}
    <rect x="120" y="14" width="9" height="7" rx="1" fill="#2D3436"/>
    <circle cx="124.5" cy="17.5" r="2.5" fill="none" stroke="#B2BEC3" strokeWidth="1"/>
    {/* GHOST RING FRONT SIGHT */}
    <rect x="17" y="21" width="5" height="10" rx="1" fill="#2D3436"/>
    {/* EJECTION PORT */}
    <rect x="92" y="25" width="18" height="11" rx="1" fill="#454545"/>
    {/* BOX MAGAZINE */}
    <path d="M86 50 L104 50 L106 67 L88 67 Z" fill="#2D3436"/>
    <line x1="90" y1="55" x2="102" y2="55" stroke="#636E72" strokeWidth="1"/>
    <line x1="90" y1="60" x2="102" y2="60" stroke="#636E72" strokeWidth="1"/>
    {/* PISTOL GRIP (polymer) */}
    <path d="M116 50 L126 50 L128 64 L120 66 L114 57 Z" fill="#1E1E1E"/>
    <line x1="117" y1="53" x2="125" y2="53" stroke="#3D3D3D" strokeWidth="1"/>
    <line x1="117" y1="57" x2="125" y2="57" stroke="#3D3D3D" strokeWidth="1"/>
    <line x1="117" y1="61" x2="124" y2="61" stroke="#3D3D3D" strokeWidth="1"/>
    {/* TRIGGER GUARD */}
    <path d="M87 50 Q100 63 116 50" fill="none" stroke="#3D3D3D" strokeWidth="2.5"/>
    {/* TRIGGER */}
    <rect x="100" y="43" width="3" height="12" rx="1" fill="#B2BEC3"/>
    {/* FOLDING STOCK (skeletal) */}
    <rect x="127" y="21" width="68" height="5" rx="2" fill="#3D3D3D"/>
    <rect x="127" y="45" width="68" height="5" rx="2" fill="#3D3D3D"/>
    <rect x="148" y="26" width="5" height="19" rx="1" fill="#3D3D3D"/>
    <rect x="170" y="26" width="5" height="19" rx="1" fill="#3D3D3D"/>
    {/* CHEEK REST PAD */}
    <rect x="127" y="26" width="68" height="8" rx="2" fill="#1E1E1E"/>
    {/* BUTTPAD */}
    <rect x="193" y="21" width="7" height="29" rx="2" fill="#2D3436"/>
  </svg>
);

const ShotgunOptionC: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" width="100%" height="100%" aria-label="Over-under double-barrel shotgun sprite option C">
    {/* TOP BARREL */}
    <rect x="5" y="20" width="100" height="9" rx="2" fill="#2D3436"/>
    {/* BOTTOM BARREL */}
    <rect x="5" y="32" width="100" height="9" rx="2" fill="#2D3436"/>
    {/* BARREL RIB (vent rib between and on top) */}
    <rect x="14" y="19" width="88" height="3" rx="1" fill="#636E72"/>
    <rect x="14" y="29" width="88" height="3" rx="1" fill="#636E72"/>
    {/* MUZZLE ENDS */}
    <rect x="5" y="18" width="10" height="25" rx="3" fill="#2D3436"/>
    {/* BEAD SIGHT */}
    <circle cx="16" cy="21" r="2.2" fill="#B2BEC3"/>
    {/* BARREL SHINE */}
    <line x1="15" y1="21" x2="103" y2="21" stroke="#636E72" strokeWidth="0.8"/>
    <line x1="15" y1="33" x2="103" y2="33" stroke="#636E72" strokeWidth="0.8"/>
    {/* HINGE BLOCK */}
    <rect x="102" y="17" width="14" height="30" rx="2" fill="#4A4A4A"/>
    {/* RECEIVER */}
    <rect x="113" y="18" width="36" height="28" rx="5" fill="#636E72"/>
    {/* RECEIVER ENGRAVING PANEL */}
    <rect x="117" y="22" width="28" height="18" rx="3" fill="#707070"/>
    <line x1="120" y1="24" x2="142" y2="38" stroke="#636E72" strokeWidth="0.8"/>
    <line x1="125" y1="22" x2="144" y2="36" stroke="#636E72" strokeWidth="0.8"/>
    <line x1="120" y1="32" x2="138" y2="22" stroke="#636E72" strokeWidth="0.8"/>
    {/* TOP LEVER */}
    <path d="M124 18 L134 18 L136 12 L126 10 Z" fill="#2D3436"/>
    <rect x="127" y="10" width="6" height="4" rx="1" fill="#4A4A4A"/>
    {/* EXPOSED HAMMERS */}
    <path d="M118 18 L126 18 L128 13 L122 11 L118 14 Z" fill="#2D3436"/>
    <path d="M131 18 L139 18 L141 13 L135 11 L131 14 Z" fill="#2D3436"/>
    {/* TRIGGER GUARD (gold-tone) */}
    <path d="M116 46 Q127 60 143 46" fill="none" stroke="#A0845C" strokeWidth="3"/>
    {/* FRONT TRIGGER */}
    <rect x="123" y="39" width="3" height="13" rx="1" fill="#B2BEC3"/>
    {/* REAR TRIGGER */}
    <rect x="131" y="39" width="3" height="13" rx="1" fill="#B2BEC3"/>
    {/* STOCK WRIST */}
    <rect x="147" y="22" width="10" height="24" rx="2" fill="#795548"/>
    {/* STOCK */}
    <path d="M155 22 L208 18 L214 34 L208 50 L155 46 Z" fill="#795548"/>
    {/* CHEEK PIECE */}
    <path d="M162 20 L202 18 L202 26 L162 28 Z" fill="#A1887F"/>
    {/* BUTTPLATE */}
    <rect x="210" y="18" width="6" height="33" rx="2" fill="#2D3436"/>
    <line x1="213" y1="21" x2="213" y2="49" stroke="#4A4A4A" strokeWidth="1"/>
    <line x1="164" y1="21" x2="206" y2="19" stroke="#BCAAA4" strokeWidth="0.8"/>
    <line x1="162" y1="36" x2="202" y2="42" stroke="#5D4037" strokeWidth="0.8"/>
  </svg>
);

/* ─────────────────────────────────────────────────────────
   Sprite option metadata
   ───────────────────────────────────────────────────────── */

interface SpriteOption {
  id: 'A' | 'B' | 'C';
  label: string;
  tagline: string;
  description: string;
  pros: string[];
  Component: React.FC;
  bgColor: string;
  accentColor: string;
}

const SHOTGUN_OPTIONS: SpriteOption[] = [
  {
    id: 'A',
    label: 'Option A — Pump-Action',
    tagline: 'Classic & rugged',
    description:
      'Traditional pump-action design (Remington 870 / Mossberg 500 style). ' +
      'Features a wooden pump fore-end, integral tube magazine, and full wooden stock. ' +
      'Closest in shape to the rifle but with a notably shorter, thicker barrel.',
    pros: ['Familiar silhouette', 'Warm wood tones', 'Clear pump-action readability'],
    Component: ShotgunOptionA,
    bgColor: '#FFF8EE',
    accentColor: '#795548',
  },
  {
    id: 'B',
    label: 'Option B — Tactical Semi-Auto',
    tagline: 'Modern & aggressive',
    description:
      'Semi-automatic tactical shotgun (Mossberg 930 / Benelli M4 inspired). ' +
      'Heat-shield barrel with vent holes, Picatinny top rail, ghost-ring sights, ' +
      'detachable box magazine, and a skeletonised folding stock.',
    pros: ['Modern polymer aesthetic', 'Rich tactical details', 'Distinct silhouette'],
    Component: ShotgunOptionB,
    bgColor: '#F0F4F8',
    accentColor: '#3D3D3D',
  },
  {
    id: 'C',
    label: 'Option C — Over/Under Double-Barrel',
    tagline: 'Elegant & classic',
    description:
      'Traditional over/under break-action shotgun. Stacked twin barrels with vent rib, ' +
      'engraved side-plate receiver, exposed hammers, dual triggers, and a classic ' +
      'English-style stock with cheek piece.',
    pros: ['Unique stacked-barrel silhouette', 'Decorative engraving detail', 'Classic elegance'],
    Component: ShotgunOptionC,
    bgColor: '#F5F0EB',
    accentColor: '#A0845C',
  },
];

/* ─────────────────────────────────────────────────────────
   Main component
   ───────────────────────────────────────────────────────── */

const ShotgunSpriteOptions: React.FC = () => {
  const [selected, setSelected] = useState<'A' | 'B' | 'C' | null>(null);

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', background: '#F8FAFC', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
          🔫 Shotgun Sprite Options
        </h1>
        <p style={{ color: '#555', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
          Three designs derived from the rifle reference sprite below. Pick the one that best fits the game's art direction.
        </p>

        {/* Rifle reference */}
        <div style={{
          background: '#fff', border: '1px solid #DDD', borderRadius: 10, padding: '1.25rem',
          marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1.5rem',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
        }}>
          <div style={{ flexShrink: 0 }}>
            <div style={{
              background: '#F0F0F0', borderRadius: 8, padding: '0.75rem',
              width: 264, height: 96, display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <RifleSVG />
            </div>
          </div>
          <div>
            <span style={{
              display: 'inline-block', background: '#E3F2FD', color: '#1565C0',
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
              padding: '2px 8px', borderRadius: 20, marginBottom: 6, textTransform: 'uppercase'
            }}>Reference</span>
            <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1A1A2E' }}>Rifle — Starting Point</h2>
            <p style={{ margin: '4px 0 0', color: '#666', fontSize: '0.85rem' }}>
              Long barrel with muzzle device, slim handguard &amp; gas tube, AR-style receiver,
              detachable magazine, pistol grip, and a straight wood stock.
              The shotgun options below are all adapted from this silhouette.
            </p>
          </div>
        </div>

        {/* Shotgun option cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {SHOTGUN_OPTIONS.map(opt => {
            const isSelected = selected === opt.id;
            return (
              <div
                key={opt.id}
                style={{
                  background: opt.bgColor,
                  border: isSelected ? `2.5px solid ${opt.accentColor}` : '2px solid transparent',
                  borderRadius: 12,
                  padding: '1.25rem',
                  boxShadow: isSelected
                    ? `0 4px 16px ${opt.accentColor}44`
                    : '0 2px 8px rgba(0,0,0,0.08)',
                  display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  transition: 'box-shadow 0.2s, border-color 0.2s',
                  cursor: 'pointer',
                  outline: 'none',
                  position: 'relative',
                }}
                onClick={() => setSelected(opt.id)}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setSelected(opt.id)}
                aria-pressed={isSelected}
                aria-label={`Select ${opt.label}`}
              >
                {/* Selected badge */}
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: opt.accentColor, color: '#fff',
                    fontSize: '0.7rem', fontWeight: 700,
                    padding: '2px 8px', borderRadius: 20, letterSpacing: '0.06em'
                  }}>
                    ✓ SELECTED
                  </div>
                )}

                {/* Label */}
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1A1A2E' }}>
                    {opt.label}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: opt.accentColor, fontWeight: 600 }}>
                    {opt.tagline}
                  </p>
                </div>

                {/* Sprite preview */}
                <div style={{
                  background: '#fff', borderRadius: 8, padding: '0.75rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `1px solid ${opt.accentColor}33`,
                  minHeight: 80
                }}>
                  <div style={{ width: '100%', maxWidth: 220 }}>
                    <opt.Component />
                  </div>
                </div>

                {/* Description */}
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#444', lineHeight: 1.5 }}>
                  {opt.description}
                </p>

                {/* Pros */}
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {opt.pros.map((pro, i) => (
                    <li key={i} style={{ fontSize: '0.8rem', color: '#555', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: opt.accentColor, fontWeight: 700 }}>✦</span> {pro}
                    </li>
                  ))}
                </ul>

                {/* Select button */}
                <button
                  onClick={e => { e.stopPropagation(); setSelected(opt.id); }}
                  style={{
                    marginTop: 'auto',
                    background: isSelected ? opt.accentColor : '#fff',
                    color: isSelected ? '#fff' : opt.accentColor,
                    border: `1.5px solid ${opt.accentColor}`,
                    borderRadius: 7, padding: '0.45rem 0.9rem',
                    fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                >
                  {isSelected ? '✓ Selected' : 'Select this option'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Selection summary */}
        {selected && (
          <div style={{
            marginTop: '1.5rem', padding: '1rem 1.25rem',
            background: '#fff', border: '1px solid #DDD', borderRadius: 10,
            boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
          }}>
            <strong style={{ fontSize: '0.9rem' }}>
              ✅ You selected:{' '}
              <span style={{ color: SHOTGUN_OPTIONS.find(o => o.id === selected)?.accentColor }}>
                {SHOTGUN_OPTIONS.find(o => o.id === selected)?.label}
              </span>
            </strong>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#555' }}>
              The corresponding SVG file is{' '}
              <code style={{ background: '#F0F0F0', padding: '1px 5px', borderRadius: 4 }}>
                public/sprites/shotgun-option-{selected.toLowerCase()}.svg
              </code>.
              Let the team know which option you prefer and it will be integrated as the game asset.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShotgunSpriteOptions;
