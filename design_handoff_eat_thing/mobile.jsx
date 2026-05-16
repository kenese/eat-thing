// Mobile screens — Eat Thing
// Crisp + Persimmon, Schibsted Grotesk + Lora italic.
// iPhone-sized renders at 402×874.

const M = {
  paper:   '#f3f5f2',
  paper2:  '#eaeee7',
  cream:   '#e6ebe4',
  ink:     '#0d1714',
  ink2:    '#3a443e',
  ink3:    '#5a6359',
  green:   '#1f5d33',
  fresh:   '#5aa758',
  persimmon: '#d96e2e',
  persimDeep:'#b6541d',
  mute:    '#6e7872',
  rule:    '#0d171414',
  rule2:   '#0d17140a',
};

const M_FONT = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
};

// ── Shared atoms ─────────────────────────────────────────────────────────

function MTitle({ children, size = 40 }) {
  return (
    <h1 style={{
      fontFamily: M_FONT.serif, fontStyle: 'italic',
      fontSize: size, lineHeight: 1, fontWeight: 400,
      letterSpacing: '-0.02em', color: M.ink, margin: 0,
    }}>{children}<span style={{ color: M.persimmon }}>.</span></h1>
  );
}

function MEyebrow({ children, color = M.mute }) {
  return (
    <div style={{
      fontFamily: M_FONT.sans, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color,
    }}>{children}</div>
  );
}

function MStatusChip({ kind, dark = false }) {
  // Same vocabulary as desktop
  const cfg = {
    cook:     { bg: M.fresh,     fg: '#fff',    label: 'cook now' },
    shop:     { bg: M.persimmon, fg: '#fff',    label: 'needs shop' },
    leftover: { bg: M.ink,       fg: '#fff',    label: 'leftover' },
    open:     { bg: 'transparent', fg: M.mute,  label: 'open seat', dashed: true },
  }[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 999,
      background: cfg.bg, color: cfg.fg,
      border: cfg.dashed ? `1px dashed ${M.mute}` : 'none',
      fontFamily: M_FONT.sans, fontSize: 9, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>{cfg.label}</span>
  );
}

function MTabBar({ active }) {
  const tabs = [
    ['home',      'home',      M_home_icon],
    ['inventory', 'pantry',    M_pantry_icon],
    ['recipes',   'recipes',   M_recipe_icon],
    ['plan',      'plan',      M_plan_icon],
    ['list',      'list',      M_list_icon],
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0,
      paddingTop: 8, paddingBottom: 28,
      borderTop: `1px solid ${M.rule}`,
      background: 'rgba(243,245,242,0.94)',
      backdropFilter: 'blur(20px)',
      display: 'flex', justifyContent: 'space-around',
      alignItems: 'flex-start',
    }}>
      {tabs.map(([k, label, Icon]) => {
        const on = k === active;
        return (
          <div key={k} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            color: on ? M.ink : M.mute, paddingTop: 2,
          }}>
            <Icon active={on} />
            <span style={{
              fontFamily: M_FONT.sans, fontSize: 10,
              fontWeight: on ? 700 : 500, letterSpacing: '0.01em',
            }}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// Simple line-icons (drawn inline, single weight to match Lora rhythm)
function M_home_icon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 11L12 3l9 8v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9z"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinejoin="round"
        fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
    </svg>
  );
}
function M_pantry_icon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="4" y="3" width="16" height="18" rx="1.5" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
      <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="4" y1="15" x2="20" y2="15" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}
function M_recipe_icon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 4h11a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
      <line x1="8" y1="9" x2="14" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="8" y1="13" x2="14" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function M_plan_icon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth={active ? 2 : 1.5} fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0}/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" strokeWidth="1.5"/>
      <line x1="8" y1="3" x2="8" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16" y1="3" x2="16" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}
function M_list_icon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <line x1="9" y1="6" x2="20" y2="6" stroke="currentColor" strokeWidth={active ? 2.5 : 1.7} strokeLinecap="round"/>
      <line x1="9" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth={active ? 2.5 : 1.7} strokeLinecap="round"/>
      <line x1="9" y1="18" x2="20" y2="18" stroke="currentColor" strokeWidth={active ? 2.5 : 1.7} strokeLinecap="round"/>
      <circle cx="5" cy="6" r="1.5" fill="currentColor"/>
      <circle cx="5" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="5" cy="18" r="1.5" fill="currentColor"/>
    </svg>
  );
}

// Image slot helper
function MSlot({ id, h, placeholder, radius = 12 }) {
  return (
    <image-slot
      id={id}
      shape="rounded"
      radius={radius}
      placeholder={placeholder}
      style={{
        width: '100%', height: h, display: 'block',
        background: M.cream,
      }}
    />
  );
}

// ── Screen 1 — Home ──────────────────────────────────────────────────────

function MHome() {
  return (
    <div style={{
      width: 402, height: 874, position: 'relative',
      background: M.paper, color: M.ink,
      fontFamily: M_FONT.sans, overflow: 'hidden',
    }}>
      {/* Scroll area */}
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, bottom: 84,
        overflow: 'hidden', padding: '8px 20px 16px',
      }}>
        {/* page top */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <MEyebrow>monday · may 11</MEyebrow>
            <MTitle size={44}>Tonight</MTitle>
          </div>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: M.persimmon, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14,
          }}>M</div>
        </div>

        {/* Tonight card */}
        <div style={{
          marginTop: 18, borderRadius: 16, overflow: 'hidden',
          background: M.ink, color: '#fff', position: 'relative',
        }}>
          <MSlot id="m-tonight" h={180} placeholder="drop biscuits photo" radius={0} />
          <div style={{ position: 'absolute', top: 12, left: 12 }}>
            <span style={{
              padding: '4px 9px', borderRadius: 999,
              background: 'rgba(217,110,46,0.92)', color: '#fff',
              fontFamily: M_FONT.sans, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
            }}>cook tonight · uses 3 expiring</span>
          </div>
          <div style={{ padding: '14px 16px 16px' }}>
            <div style={{
              fontFamily: M_FONT.serif, fontStyle: 'italic',
              fontSize: 26, lineHeight: 1.05, fontWeight: 400,
            }}>Buttermilk biscuits with cilantro butter<span style={{ color: M.persimmon }}>.</span></div>
            <div style={{
              fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 8,
              lineHeight: 1.4,
            }}>40 min · serves 6 · uses{' '}
              <em style={{ fontFamily: M_FONT.serif, color: '#fff' }}>buttermilk</em>,{' '}
              <em style={{ fontFamily: M_FONT.serif, color: '#fff' }}>cilantro</em>,{' '}
              <em style={{ fontFamily: M_FONT.serif, color: '#fff' }}>butter</em>
            </div>
            <button style={{
              marginTop: 12, width: '100%',
              background: M.persimmon, color: '#fff', border: 'none',
              padding: '12px 14px', borderRadius: 10,
              fontFamily: M_FONT.sans, fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>open recipe</span>
              <span style={{ fontFamily: M_FONT.serif, fontStyle: 'italic', fontSize: 17 }}>→</span>
            </button>
          </div>
        </div>

        {/* use this week */}
        <div style={{ marginTop: 22 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: M_FONT.serif, fontStyle: 'italic',
              fontSize: 22, color: M.ink,
            }}>Use this week<span style={{ color: M.persimmon }}>.</span></div>
            <MEyebrow>4 items</MEyebrow>
          </div>
          <div style={{
            display: 'flex', gap: 10, overflow: 'hidden',
            marginLeft: -20, marginRight: -20, padding: '0 20px',
          }}>
            {[
              ['buttermilk', '½ pt', 1, true],
              ['cilantro',   '1 bn', 2],
              ['sourdough',  '½ lf', 2],
              ['goat cheese','4 oz', 3],
            ].map(([name, qty, d, urgent], i) => (
              <div key={i} style={{
                flex: '0 0 auto', width: 110,
                background: urgent ? M.ink : M.paper2,
                color: urgent ? '#fff' : M.ink,
                borderRadius: 12, padding: '12px 12px 14px',
                border: urgent ? 'none' : `1px solid ${M.rule}`,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{
                  fontFamily: M_FONT.serif, fontStyle: 'italic',
                  fontSize: 26, lineHeight: 1,
                  color: urgent ? M.persimmon : M.green,
                }}>{d}<span style={{ fontSize: 12, color: urgent ? 'rgba(255,255,255,0.6)' : M.mute, fontStyle: 'normal', marginLeft: 2 }}>d</span></div>
                <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.15 }}>{name}</div>
                <div style={{ fontSize: 10, color: urgent ? 'rgba(255,255,255,0.6)' : M.mute }}>{qty}</div>
              </div>
            ))}
          </div>
        </div>

        {/* the week, condensed */}
        <div style={{ marginTop: 24 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 10,
          }}>
            <div style={{
              fontFamily: M_FONT.serif, fontStyle: 'italic',
              fontSize: 22, color: M.ink,
            }}>This week<span style={{ color: M.persimmon }}>.</span></div>
            <span style={{
              fontSize: 12, fontFamily: M_FONT.sans, color: M.ink2, fontWeight: 600,
            }}>see plan →</span>
          </div>
          {[
            ['tue', 'Charred broccoli & lentils', 'cook'],
            ['wed', 'Roast chicken, fennel',     'shop'],
            ['thu', 'Stock noodles',              'leftover'],
          ].map(([day, name, kind], i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 0',
              borderTop: i === 0 ? `1px solid ${M.rule}` : `1px solid ${M.rule2}`,
            }}>
              <div style={{
                fontFamily: M_FONT.sans, fontSize: 10, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase',
                color: M.mute, width: 32,
              }}>{day}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{name}</div>
              <MStatusChip kind={kind} />
            </div>
          ))}
        </div>
      </div>

      <MTabBar active="home" />
    </div>
  );
}

// ── Screen 2 — Inventory ─────────────────────────────────────────────────

function MInventory() {
  const items = [
    { name:'buttermilk',  qty:'½ pt',    spot:'fridge · top',    d:1 },
    { name:'cilantro',    qty:'1 bn',    spot:'fridge · crisper',d:2 },
    { name:'sourdough',   qty:'½ lf',    spot:'counter',          d:2 },
    { name:'goat cheese', qty:'4 oz',    spot:'fridge · door',   d:3 },
    { name:'whole milk',  qty:'¾ qt',    spot:'fridge · top',    d:4 },
    { name:'spinach',     qty:'5 oz',    spot:'fridge · crisper',d:4 },
    { name:'fennel',      qty:'2 ea',    spot:'fridge · crisper',d:5 },
    { name:'heavy cream', qty:'1 pt',    spot:'fridge · top',    d:5 },
    { name:'lemons',      qty:'4 ea',    spot:'fridge · crisper',d:10 },
    { name:'eggs',        qty:'12 ea',   spot:'fridge · door',   d:14 },
  ];
  return (
    <div style={{
      width: 402, height: 874, position: 'relative',
      background: M.paper, color: M.ink,
      fontFamily: M_FONT.sans, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, bottom: 84,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '8px 20px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <MEyebrow>9:14 am · reconciled</MEyebrow>
              <MTitle size={42}>Pantry</MTitle>
            </div>
            <button style={{
              background: M.persimmon, color: '#fff', border: 'none',
              width: 38, height: 38, borderRadius: 19,
              fontSize: 22, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
          <div style={{ fontSize: 13, color: M.ink2, marginTop: 6 }}>
            <span style={{ fontWeight: 600 }}>29 on hand</span> ·{' '}
            <span style={{ color: M.persimDeep, fontWeight: 600 }}>9 expiring</span>
          </div>
        </div>

        {/* Search */}
        <div style={{ padding: '0 20px 12px', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)',
            color: M.mute, fontSize: 14,
          }}>⌕</div>
          <input style={{
            width: '100%', padding: '11px 14px 11px 36px',
            border: `1px solid ${M.rule}`, borderRadius: 12,
            background: M.paper2, color: M.ink,
            fontFamily: M_FONT.sans, fontSize: 14, outline: 'none',
            boxSizing: 'border-box',
          }} placeholder="search items, brands, spots…" />
        </div>

        {/* Tabs */}
        <div style={{
          padding: '0 20px 12px',
          display: 'flex', gap: 8, overflow: 'hidden',
        }}>
          {[
            ['all',    'All',     29, true],
            ['expir',  'Expiring', 9, false, M.persimmon],
            ['fridge', 'Fridge',  10],
            ['pantry', 'Pantry',  10],
            ['freezer','Freezer',  6],
          ].map(([k, label, n, active, dot], i) => (
            <div key={k} style={{
              flex: '0 0 auto', padding: '6px 12px', borderRadius: 999,
              background: active ? M.ink : 'transparent',
              color: active ? '#fff' : M.ink2,
              border: active ? 'none' : `1px solid ${M.rule}`,
              fontFamily: M_FONT.sans, fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot }} />}
              {label}
              <span style={{ opacity: 0.6, fontSize: 11 }}>{n}</span>
            </div>
          ))}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '0 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            padding: '6px 0',
            borderBottom: `1px solid ${M.rule}`,
          }}>
            <span style={{
              fontFamily: M_FONT.serif, fontStyle: 'italic',
              fontSize: 18, color: M.green,
            }}>by expiry</span>
            <span style={{ flex: 1 }} />
            <MEyebrow>10 shown</MEyebrow>
          </div>
          {items.map((it, i) => {
            const tone = it.d <= 1 ? M.warn || '#c2412e' : it.d <= 3 ? M.persimmon : it.d <= 7 ? M.persimDeep : M.fresh;
            return (
              <div key={i} style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                gap: 10, alignItems: 'baseline',
                padding: '11px 0',
                borderBottom: i < items.length - 1 ? `1px solid ${M.rule2}` : 'none',
              }}>
                <div>
                  <div style={{
                    fontFamily: M_FONT.sans, fontSize: 15, fontWeight: 600,
                    letterSpacing: '-0.005em',
                  }}>{it.name}<span style={{ color: M.mute, fontWeight: 400, marginLeft: 6 }}>{it.qty}</span></div>
                  <div style={{ fontSize: 11, color: M.mute, marginTop: 2 }}>{it.spot}</div>
                </div>
                <div style={{
                  fontFamily: it.d <= 3 ? M_FONT.serif : M_FONT.sans,
                  fontStyle: it.d <= 3 ? 'italic' : 'normal',
                  fontSize: it.d <= 3 ? 18 : 13,
                  fontWeight: it.d <= 3 ? 400 : 600,
                  color: tone, fontVariantNumeric: 'tabular-nums',
                }}>{it.d}d</div>
              </div>
            );
          })}
        </div>
      </div>

      <MTabBar active="inventory" />
    </div>
  );
}

// ── Screen 3 — Recipes ───────────────────────────────────────────────────

function MRecipes() {
  return (
    <div style={{
      width: 402, height: 874, position: 'relative',
      background: M.paper, color: M.ink,
      fontFamily: M_FONT.sans, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, bottom: 84,
        overflow: 'hidden', padding: '8px 20px 16px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <MEyebrow>5 cookable now</MEyebrow>
            <MTitle size={42}>Recipes</MTitle>
          </div>
          <button style={{
            background: M.persimmon, color: '#fff', border: 'none',
            width: 38, height: 38, borderRadius: 19,
            fontSize: 22, fontWeight: 600, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>+</button>
        </div>

        {/* Filter chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, overflow: 'hidden' }}>
          {[
            ['all','All',12,true],
            ['cook','Cook now',5,false,M.fresh],
            ['shop','Quick shop',3,false,M.persimmon],
            ['lib','Library',12],
          ].map(([k, label, n, active, dot], i) => (
            <div key={k} style={{
              flex: '0 0 auto', padding: '6px 11px', borderRadius: 999,
              background: active ? M.ink : 'transparent',
              color: active ? '#fff' : M.ink2,
              border: active ? 'none' : `1px solid ${M.rule}`,
              fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {dot && <span style={{ width: 5, height: 5, borderRadius: '50%', background: dot }} />}
              {label}<span style={{ opacity: 0.6, fontSize: 11 }}>{n}</span>
            </div>
          ))}
        </div>

        {/* Hero recipe */}
        <div style={{
          marginTop: 16, borderRadius: 14, overflow: 'hidden',
          background: M.paper, border: `1px solid ${M.rule}`,
        }}>
          <div style={{ position: 'relative' }}>
            <MSlot id="m-rx-hero" h={180} placeholder="drop biscuits" radius={0} />
            <div style={{ position: 'absolute', top: 10, left: 10 }}>
              <MStatusChip kind="cook" />
            </div>
            <div style={{
              position: 'absolute', bottom: 10, right: 10,
              padding: '3px 9px', borderRadius: 999,
              background: 'rgba(13,23,20,0.78)', color: '#fff',
              fontFamily: M_FONT.sans, fontSize: 10, fontWeight: 600,
              letterSpacing: '0.02em',
            }}>40 min · serves 6</div>
          </div>
          <div style={{ padding: '12px 14px 14px' }}>
            <div style={{
              fontFamily: M_FONT.sans, fontSize: 16, fontWeight: 600,
              letterSpacing: '-0.012em', lineHeight: 1.2,
            }}>Buttermilk biscuits with cilantro butter</div>
            <div style={{
              fontFamily: M_FONT.serif, fontStyle: 'italic',
              fontSize: 12, color: M.ink3, marginTop: 4,
            }}>uses 3 expiring · today's pick</div>
          </div>
        </div>

        {/* 2-up grid */}
        <div style={{
          fontFamily: M_FONT.serif, fontStyle: 'italic',
          fontSize: 20, color: M.ink, marginTop: 20, marginBottom: 10,
        }}>Cook tonight<span style={{ color: M.fresh }}>.</span></div>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
        }}>
          {[
            ['m-rx-cacio',   'Cacio e pepe',                '20m'],
            ['m-rx-broc',    'Charred broccoli & lentils',  '35m'],
            ['m-rx-omel',    'Saturday omelette',           '15m'],
            ['m-rx-aglio',   'Spaghetti aglio e olio',      '18m'],
          ].map(([id, name, time]) => (
            <div key={id} style={{
              borderRadius: 12, overflow: 'hidden',
              border: `1px solid ${M.rule}`, background: M.paper,
            }}>
              <div style={{ position: 'relative' }}>
                <MSlot id={id} h={104} placeholder={name.toLowerCase()} radius={0} />
                <div style={{ position: 'absolute', top: 6, left: 6 }}>
                  <MStatusChip kind="cook" />
                </div>
              </div>
              <div style={{ padding: '8px 10px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{name}</div>
                <div style={{ fontSize: 10, color: M.mute, marginTop: 2 }}>{time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <MTabBar active="recipes" />
    </div>
  );
}

// ── Screen 4 — Shopping List (the phone-first screen) ───────────────────

function MList() {
  const groups = [
    { aisle: 'Produce',  items: [
      { name: 'fennel',     qty: '2 bulbs',  reason: 'wed roast', checked: true },
      { name: 'lemons',     qty: '4',        reason: 'wed roast', checked: true },
      { name: 'parsley',    qty: '1 bunch',  reason: 'wed roast', checked: false },
      { name: 'shallots',   qty: '3',        reason: 'wed roast', checked: false },
      { name: 'thyme',      qty: '1 bunch',  reason: 'wed roast', checked: false },
    ]},
    { aisle: 'Butcher',  items: [
      { name: 'whole chicken', qty: '4 lb', reason: 'wed roast', checked: false },
      { name: 'italian sausage', qty: '½ lb', reason: 'fri pizza', checked: false },
    ]},
    { aisle: 'Dairy',    items: [
      { name: 'unsalted butter', qty: '1 lb', reason: 'low staple', checked: false },
      { name: 'fresh mozzarella', qty: '8 oz', reason: 'fri pizza', checked: false },
    ]},
  ];
  return (
    <div style={{
      width: 402, height: 874, position: 'relative',
      background: M.paper, color: M.ink,
      fontFamily: M_FONT.sans, overflow: 'hidden',
    }}>
      {/* Top */}
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0,
        padding: '8px 20px 10px',
        background: M.paper, zIndex: 2,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <MEyebrow>auto-built · for wed shop</MEyebrow>
            <MTitle size={42}>The list</MTitle>
          </div>
          <div style={{
            fontFamily: M_FONT.serif, fontStyle: 'italic',
            fontSize: 32, color: M.persimmon, lineHeight: 1,
          }}>$48<span style={{ fontSize: 14, color: M.mute }}>.20</span></div>
        </div>
        <div style={{ fontSize: 12, color: M.ink2, marginTop: 4 }}>
          <span style={{ fontWeight: 600 }}>15 items</span> · 2 ticked · Whole Foods, Brooklyn
        </div>

        {/* filter chips */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12, overflow: 'hidden' }}>
          {[
            ['all','All',15,true],
            ['roast','Wed roast',8],
            ['pizza','Fri pizza',3],
            ['staples','Staples',2],
          ].map(([k, label, n, active]) => (
            <div key={k} style={{
              flex: '0 0 auto', padding: '6px 11px', borderRadius: 999,
              background: active ? M.ink : 'transparent',
              color: active ? '#fff' : M.ink2,
              border: active ? 'none' : `1px solid ${M.rule}`,
              fontSize: 12, fontWeight: 600,
            }}>
              {label}<span style={{ opacity: 0.6, marginLeft: 5, fontSize: 11 }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{
        position: 'absolute', top: 218, left: 0, right: 0, bottom: 156,
        overflow: 'hidden', padding: '12px 20px 8px',
      }}>
        {groups.map((g, gi) => (
          <div key={g.aisle} style={{ marginBottom: 18 }}>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10,
              padding: '4px 0 8px',
              borderBottom: `1px solid ${M.rule}`,
            }}>
              <span style={{
                fontFamily: M_FONT.serif, fontStyle: 'italic',
                fontSize: 19, color: M.ink,
              }}>{g.aisle}<span style={{ color: M.persimmon }}>.</span></span>
              <span style={{ flex: 1 }} />
              <MEyebrow>{g.items.length}</MEyebrow>
            </div>
            {g.items.map((it, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 0',
                borderBottom: i < g.items.length - 1 ? `1px solid ${M.rule2}` : 'none',
                opacity: it.checked ? 0.5 : 1,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  border: `1.5px solid ${it.checked ? M.green : M.rule}`,
                  background: it.checked ? M.green : 'transparent',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {it.checked && (
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 15, fontWeight: 600, letterSpacing: '-0.005em',
                    textDecoration: it.checked ? 'line-through' : 'none',
                  }}>{it.name}<span style={{ color: M.mute, fontWeight: 400, marginLeft: 8 }}>{it.qty}</span></div>
                  <div style={{
                    fontFamily: M_FONT.serif, fontStyle: 'italic',
                    fontSize: 12, color: M.ink3, marginTop: 2,
                  }}>{it.reason}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Sticky bottom CTA */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 84,
        padding: '12px 20px 12px',
        background: 'rgba(243,245,242,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${M.rule}`,
      }}>
        <button style={{
          width: '100%', padding: '14px 16px', borderRadius: 12,
          background: M.persimmon, color: '#fff', border: 'none',
          fontFamily: M_FONT.sans, fontSize: 15, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>send to Whole Foods</span>
          <span style={{ fontFamily: M_FONT.serif, fontStyle: 'italic', fontSize: 18 }}>$58.29 →</span>
        </button>
        <div style={{
          fontFamily: M_FONT.sans, fontSize: 11, color: M.mute,
          textAlign: 'center', marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: M.fresh }} />
          playwright agent · idle · wed 4:30 pm slot
        </div>
      </div>

      <MTabBar active="list" />
    </div>
  );
}

// ── Screen 5 — Meal Plan ─────────────────────────────────────────────────
//
// New model: planning is no longer "this week, mon→sun". It's any date
// with up to 4 recipes assigned. Plan opens with today as the 3rd entry
// (2 past days visible above) and you can scroll ~2 weeks forward.
//
// Layout:
//  • Title + "load date" (calendar) + add-recipe (+) buttons
//  • Horizontal date strip — quick visual orientation, today highlighted
//  • Vertical day stream — past days dimmed, today is an ink hero, future
//    days are compact rows. Empty days are an "open seat + add" target.
//  • Sticky bottom: "add recipes to list" — promotes missing ingredients
//    from the planned recipes into the shopping list.

function MPlanDayPill({ day }) {
  const has = day.meals.length > 0;
  const multi = day.meals.length > 1;
  const isToday = day.today;
  const isPast = day.past;
  return (
    <div style={{
      flex: '1 0 0', minWidth: 0, height: 64,
      padding: '8px 2px 6px',
      borderRadius: 12,
      background: isToday ? M.ink : 'transparent',
      color: isToday ? '#fff' : isPast ? M.mute : M.ink,
      opacity: isPast ? 0.55 : 1,
      border: isToday ? 'none' : `1px solid ${isPast ? M.rule2 : M.rule}`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 3, textAlign: 'center',
    }}>
      <div style={{
        fontFamily: M_FONT.sans, fontSize: 9, fontWeight: 700,
        letterSpacing: '0.12em', textTransform: 'uppercase',
        opacity: isToday ? 0.85 : 0.9,
      }}>{day.wk}</div>
      <div style={{
        fontFamily: M_FONT.serif, fontStyle: 'italic',
        fontSize: 22, lineHeight: 1, fontWeight: 400,
      }}>{day.d}</div>
      {has ? (
        multi ? (
          <div style={{
            fontFamily: M_FONT.sans, fontSize: 9, fontWeight: 700,
            color: isToday ? M.persimmon : M.persimDeep,
            letterSpacing: '0.04em',
          }}>{day.meals.length}×</div>
        ) : (
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: isToday ? M.persimmon : M.fresh,
            marginTop: 1,
          }} />
        )
      ) : (
        <div style={{ height: 5, marginTop: 1 }} />
      )}
    </div>
  );
}

function MPlanDayLabel({ day }) {
  const isToday = day.today;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 0 6px',
    }}>
      <div style={{
        fontFamily: M_FONT.sans, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: isToday ? M.persimmon : M.mute,
      }}>{day.wk} · may {day.d}</div>
      {isToday && (
        <div style={{
          fontFamily: M_FONT.serif, fontStyle: 'italic',
          fontSize: 13, color: M.ink2,
        }}>today<span style={{ color: M.persimmon }}>.</span></div>
      )}
      <div style={{
        flex: 1, marginLeft: 2,
        borderTop: `1px solid ${isToday ? `${M.persimmon}55` : M.rule2}`,
      }} />
      {day.meals.length > 1 && (
        <div style={{
          fontFamily: M_FONT.sans, fontSize: 10, fontWeight: 600,
          color: M.mute, letterSpacing: '0.04em',
        }}>{day.meals.length} meals</div>
      )}
    </div>
  );
}

function MPlanTodayMeal({ meal }) {
  return (
    <div style={{
      background: M.ink, color: '#fff', borderRadius: 12,
      padding: 10, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <image-slot
        id={meal.slotId}
        shape="rounded"
        radius={8}
        placeholder={meal.name.split(',')[0].toLowerCase()}
        style={{ width: 64, height: 64, display: 'block', background: '#1a2520', flexShrink: 0 }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: M_FONT.serif, fontStyle: 'italic',
          fontSize: 19, lineHeight: 1.1, fontWeight: 400,
        }}>{meal.name}<span style={{ color: M.persimmon }}>.</span></div>
        <div style={{
          fontFamily: M_FONT.sans, fontSize: 11,
          color: 'rgba(255,255,255,0.65)', marginTop: 4,
        }}>
          {meal.time}m · serves {meal.servings} · <span style={{ fontFamily: M_FONT.serif, fontStyle: 'italic' }}>{meal.tag}</span>
        </div>
      </div>
      <MStatusChip kind={meal.kind} />
    </div>
  );
}

function MPlanMealRow({ meal, past }) {
  if (meal.cooked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 0',
      }}>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3.5" stroke={M.fresh} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div style={{
          flex: 1, fontSize: 14, color: M.ink2,
          textDecoration: 'line-through', textDecorationColor: M.rule,
        }}>{meal.name}</div>
        <div style={{
          fontFamily: M_FONT.serif, fontStyle: 'italic',
          fontSize: 12, color: M.mute,
        }}>cooked</div>
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '8px 0',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: M_FONT.sans, fontSize: 14, fontWeight: 600,
          letterSpacing: '-0.005em', lineHeight: 1.25,
        }}>{meal.name}</div>
        {meal.missing && meal.missing.length > 0 && (
          <div style={{
            fontFamily: M_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: M.ink3, marginTop: 2, lineHeight: 1.3,
          }}>
            need {meal.missing.slice(0, 2).join(', ')}
            {meal.missing.length > 2 ? ` & ${meal.missing.length - 2} more` : ''}
          </div>
        )}
        {meal.tag && !meal.missing?.length && (
          <div style={{
            fontFamily: M_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: M.ink3, marginTop: 2, lineHeight: 1.3,
          }}>{meal.time}m · {meal.tag}</div>
        )}
      </div>
      <MStatusChip kind={meal.kind} />
    </div>
  );
}

function MPlanOpenSeat() {
  return (
    <div style={{
      padding: '11px 14px', borderRadius: 10,
      border: `1.5px dashed ${M.rule}`, background: M.paper2,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <span style={{
        fontFamily: M_FONT.serif, fontStyle: 'italic',
        fontSize: 14, color: M.ink3,
      }}>open seat</span>
      <span style={{
        fontFamily: M_FONT.sans, fontSize: 12, fontWeight: 700,
        color: M.persimmon, letterSpacing: '0.02em',
      }}>+ add recipe</span>
    </div>
  );
}

function MPlanDayBlock({ day }) {
  const isToday = day.today;
  const isPast = day.past;
  const has = day.meals.length > 0;
  return (
    <div style={{
      marginBottom: isToday ? 14 : 10,
      opacity: isPast ? 0.5 : 1,
    }}>
      <MPlanDayLabel day={day} />
      {!has ? (
        <MPlanOpenSeat />
      ) : isToday ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {day.meals.map((m, i) => <MPlanTodayMeal key={i} meal={m} />)}
        </div>
      ) : (
        <div>
          {day.meals.map((m, i) => (
            <div key={i} style={{
              borderTop: i > 0 ? `1px solid ${M.rule2}` : 'none',
            }}>
              <MPlanMealRow meal={m} past={isPast} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MPlan() {
  // 16 days: may 9–24. Today = may 11 (mon, idx 2 → 3rd in row).
  const days = [
    { d: 9,  wk: 'sat', past: true,  meals: [
      { name: 'Spaghetti aglio e olio', cooked: true },
    ]},
    { d: 10, wk: 'sun', past: true,  meals: [
      { name: 'Stock noodles · leftover', cooked: true },
    ]},
    { d: 11, wk: 'mon', today: true, meals: [
      { slotId: 'mp-m-cacio', name: 'Cacio e pepe', kind: 'cook',
        time: 20, servings: 2, tag: 'all pantry' },
    ]},
    { d: 12, wk: 'tue', meals: [
      { name: 'Charred broccoli & lentils', kind: 'cook', time: 35, tag: 'one-pan' },
    ]},
    { d: 13, wk: 'wed', meals: [
      { name: 'Roast chicken, lemon & fennel', kind: 'shop', time: 90,
        missing: ['whole chicken', 'thyme', 'dijon'] },
    ]},
    { d: 14, wk: 'thu', meals: [
      { name: 'Chicken stock noodles', kind: 'leftover', time: 25, tag: 'from wed' },
    ]},
    { d: 15, wk: 'fri', meals: [
      { name: 'Pizza, sausage & honey', kind: 'shop', time: 60,
        missing: ['mozzarella', 'italian sausage'] },
      { name: 'Bitter greens salad', kind: 'cook', time: 10, tag: 'pantry side' },
    ]},
    { d: 16, wk: 'sat', meals: [
      { name: 'Saturday omelette', kind: 'cook', time: 15, tag: 'eggs' },
    ]},
    { d: 17, wk: 'sun', meals: [] },
    { d: 18, wk: 'mon', meals: [] },
    { d: 19, wk: 'tue', meals: [
      { name: 'Shakshuka', kind: 'shop', time: 30, missing: ['canned tomato', 'feta'] },
    ]},
    { d: 20, wk: 'wed', meals: [] },
    { d: 21, wk: 'thu', meals: [] },
    { d: 22, wk: 'fri', meals: [] },
    { d: 23, wk: 'sat', meals: [] },
    { d: 24, wk: 'sun', meals: [] },
  ];

  // For the horizontal strip: 2 past + today + 4 future = 7 visible
  const stripDays = days.slice(0, 7);

  // Summary across the next 7 days from today (today + 6)
  const next7 = days.slice(2, 9);
  const shopCount = next7.reduce((n, d) => n + d.meals.filter(m => m.kind === 'shop').length, 0);
  const cookCount = next7.reduce((n, d) => n + d.meals.filter(m => m.kind === 'cook').length, 0);

  // Recipes that contribute to the list (anything with missing items)
  const needsShop = days.flatMap(d => d.meals).filter(m => m.missing && m.missing.length > 0);

  return (
    <div style={{
      width: 402, height: 874, position: 'relative',
      background: M.paper, color: M.ink,
      fontFamily: M_FONT.sans, overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 50, left: 0, right: 0, bottom: 84,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
      }}>
        {/* Title + actions */}
        <div style={{
          padding: '8px 20px 10px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        }}>
          <div>
            <MEyebrow>may 2026</MEyebrow>
            <MTitle size={42}>Plan</MTitle>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Load date — calendar icon */}
            <button style={{
              width: 38, height: 38, borderRadius: 19,
              background: 'transparent', border: `1px solid ${M.rule}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: M.ink, padding: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="5" width="18" height="16" rx="2.5"
                  stroke="currentColor" strokeWidth="1.6" />
                <line x1="3" y1="10" x2="21" y2="10"
                  stroke="currentColor" strokeWidth="1.6" />
                <line x1="8" y1="3" x2="8" y2="7"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                <line x1="16" y1="3" x2="16" y2="7"
                  stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
            <button style={{
              background: M.persimmon, color: '#fff', border: 'none',
              width: 38, height: 38, borderRadius: 19,
              fontSize: 22, fontWeight: 600, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>+</button>
          </div>
        </div>

        {/* Date strip — today is 3rd, 2 past on the left, scroll right for 2 weeks */}
        <div style={{
          padding: '4px 20px 6px',
          display: 'flex', gap: 6,
        }}>
          {stripDays.map((d, i) => <MPlanDayPill key={i} day={d} />)}
          {/* Edge fade to suggest more days off-screen */}
          <div style={{
            flex: '0 0 auto', width: 16, alignSelf: 'stretch',
            background: 'linear-gradient(to right, rgba(243,245,242,0), rgba(243,245,242,1))',
            marginLeft: -16, pointerEvents: 'none',
          }} />
        </div>

        {/* Summary */}
        <div style={{
          padding: '10px 20px 4px',
          fontSize: 12, color: M.ink2,
          display: 'flex', alignItems: 'baseline', gap: 6,
        }}>
          <span style={{ fontWeight: 700, color: M.ink, fontVariantNumeric: 'tabular-nums' }}>{cookCount}</span>
          <span style={{ color: M.ink3 }}>ready</span>
          <span style={{ color: M.mute }}>·</span>
          <span style={{ fontWeight: 700, color: M.persimDeep, fontVariantNumeric: 'tabular-nums' }}>{shopCount}</span>
          <span style={{ color: M.ink3 }}>need a shop</span>
          <span style={{ flex: 1 }} />
          <span style={{
            fontFamily: M_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: M.mute,
          }}>next 7 days</span>
        </div>

        {/* Day stream */}
        <div style={{
          flex: 1, overflow: 'hidden',
          padding: '10px 20px 14px',
        }}>
          {days.map((day) => <MPlanDayBlock key={day.d} day={day} />)}
        </div>
      </div>

      {/* Sticky CTA — add recipes to list */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 84,
        padding: '10px 20px 10px',
        background: 'rgba(243,245,242,0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: `1px solid ${M.rule}`,
      }}>
        <button style={{
          width: '100%', padding: '13px 16px', borderRadius: 12,
          background: M.persimmon, color: '#fff', border: 'none',
          fontFamily: M_FONT.sans, fontSize: 14, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer',
        }}>
          <span>add recipes to list</span>
          <span style={{
            fontFamily: M_FONT.sans, fontSize: 12, fontWeight: 600,
            opacity: 0.85, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>{needsShop.length} need shop</span>
            <span style={{ fontFamily: M_FONT.serif, fontStyle: 'italic', fontSize: 17 }}>→</span>
          </span>
        </button>
      </div>

      <MTabBar active="plan" />
    </div>
  );
}

Object.assign(window, { MHome, MInventory, MRecipes, MList, MPlan });
