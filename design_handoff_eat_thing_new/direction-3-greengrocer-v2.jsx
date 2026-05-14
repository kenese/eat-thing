// Greengrocer V2 — parameterized version. Same layout as v1, but palette and
// fonts come in as props so we can spawn variants cheaply.
//
// Less yellow per direction: paper whites with subtle cool tints, fresh
// green as the dominant color, a crisp blue for accents instead of tomato.

function GGv2({ palette, fonts, label }) {
  const C = palette;
  const F = fonts;

  const meals = [
    { day: 'mon', name: 'cacio e pepe',                tag: 'pantry'    },
    { day: 'tue', name: 'charred broccoli, lentils',   tag: 'pantry'    },
    { day: 'wed', name: 'roast chicken & fennel',      tag: 'shopping'  },
    { day: 'thu', name: 'chicken stock noodles',       tag: 'leftover'  },
    { day: 'fri', name: 'sausage & honey pizza',       tag: 'shopping'  },
  ];
  const expiring = [
    { name: 'buttermilk', d: 1, qty: '½ pt' },
    { name: 'cilantro',   d: 2, qty: '1 bunch' },
    { name: 'sourdough',  d: 2, qty: '½ loaf' },
    { name: 'goat cheese',d: 3, qty: '4 oz' },
  ];

  // Tag styling: the "shopping" day is the hot card; greens for pantry,
  // blue for the leftover.
  const tagColor = (t, i) => {
    if (i === 2) return C.blue;      // active hero card
    return C.cream;                   // muted card
  };

  function Tag({ children, bg = C.ink, fg = C.paper }) {
    return (
      <span style={{
        background: bg, color: fg,
        padding: '4px 10px', borderRadius: 999,
        fontFamily: F.sans, fontSize: 11, fontWeight: 600,
        letterSpacing: '0.01em', textTransform: 'lowercase',
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>{children}</span>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: C.paper, color: C.ink,
      fontFamily: F.sans,
      fontSize: 14, lineHeight: 1.4,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* top stripe */}
      <header style={{
        background: C.ink, color: C.paper,
        padding: '14px 36px',
        display: 'flex', alignItems: 'center', gap: 24,
      }}>
        <div style={{
          fontFamily: F.sans, fontSize: 22, fontWeight: 800,
          letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline',
        }}>
          Eat<span style={{
            color: C.blue,
            fontFamily: F.serif, fontStyle: 'italic',
            fontWeight: 400, fontSize: 28, marginLeft: 4,
          }}>thing</span>
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 22, justifyContent: 'center' }}>
          {['kitchen', 'recipes', 'plan', 'list', 'shops'].map((t, i) => (
            <div key={t} style={{
              fontSize: 13, fontWeight: 600,
              color: i === 0 ? C.paper : `${C.paper}99`,
              borderBottom: i === 0 ? `2px solid ${C.blue}` : 'none',
              paddingBottom: 3, letterSpacing: '0.01em',
            }}>{t}</div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontSize: 11, opacity: 0.7,
            letterSpacing: '0.04em', textTransform: 'uppercase',
          }}>sun · may 10</div>
          <div style={{
            width: 30, height: 30, borderRadius: '50%',
            background: C.blue, color: C.paper,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 13,
          }}>M</div>
        </div>
      </header>

      {/* hero band */}
      <div style={{
        padding: '36px 36px 24px',
        display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 36,
        alignItems: 'end',
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: C.cream, padding: '6px 12px',
            borderRadius: 999, fontSize: 12, fontWeight: 600,
            border: `1px solid ${C.ink}1a`, marginBottom: 14,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: C.fresh }} />
            you have what you need for monday & tuesday
          </div>
          <div style={{
            fontSize: 76, lineHeight: 0.95, fontWeight: 700,
            letterSpacing: '-0.035em', color: C.ink,
          }}>
            cook from{' '}
            <span style={{
              fontFamily: F.serif, fontStyle: 'italic',
              fontWeight: 400, color: C.green,
            }}>what's already</span>
            <br/>
            in the kitchen<span style={{ color: C.blue }}>.</span>
          </div>
          <div style={{
            fontSize: 15, color: C.ink2, marginTop: 14, maxWidth: 540,
          }}>
            127 things on hand · 4 won't make it past wednesday · the list builds itself.
          </div>
        </div>

        {/* Use it up */}
        <div style={{
          background: C.ink, color: C.paper,
          borderRadius: 14, padding: '20px 22px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>use this week</div>
            <div style={{
              fontFamily: F.serif, fontStyle: 'italic',
              fontSize: 16, color: C.fresh,
            }}>4 items</div>
          </div>
          {expiring.map((it, i) => (
            <div key={it.name} style={{
              display: 'flex', alignItems: 'baseline', gap: 12,
              padding: '8px 0',
              borderTop: i === 0 ? 'none' : `1px solid ${C.paper}24`,
            }}>
              <div style={{
                fontFamily: F.serif, fontStyle: 'italic',
                fontSize: 28, lineHeight: 1,
                color: it.d <= 1 ? C.fresh : C.paper,
                width: 40, fontVariantNumeric: 'tabular-nums',
              }}>{it.d}d</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>{it.qty}</div>
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: it.d <= 1 ? C.fresh : `${C.paper}b3`,
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>{it.d <= 1 ? 'today' : 'soon'}</div>
            </div>
          ))}
        </div>
      </div>

      {/* lower row — meals + shop */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: '1.6fr 1fr',
        gap: 24, padding: '8px 36px 28px',
        minHeight: 0,
      }}>
        {/* meals strip */}
        <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 22, letterSpacing: '-0.01em' }}>this week</div>
              <div style={{
                fontFamily: F.serif, fontStyle: 'italic',
                fontSize: 22, color: C.mute,
              }}>(5 + an open seat)</div>
            </div>
            <div style={{ fontSize: 12, color: C.ink2, fontWeight: 600 }}>edit plan →</div>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12, flex: 1, minHeight: 0,
          }}>
            {meals.map((m, i) => {
              const heroColor = i === 2 ? C.green : null;
              return (
                <div key={m.day} style={{
                  background: i === 2 ? heroColor : C.cream,
                  color: i === 2 ? C.paper : C.ink,
                  borderRadius: 10, padding: '14px 14px 14px',
                  border: i === 2 ? 'none' : `1px solid ${C.ink}14`,
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                  position: 'relative', overflow: 'hidden', minHeight: 0,
                }}>
                  <div style={{
                    fontFamily: F.serif, fontStyle: 'italic',
                    fontSize: 14, opacity: 0.7,
                    letterSpacing: '0.02em', textTransform: 'uppercase',
                    fontWeight: 400,
                  }}>{m.day}</div>
                  <div style={{
                    fontWeight: 700, fontSize: 17, lineHeight: 1.1,
                    letterSpacing: '-0.01em', marginTop: 28,
                  }}>{m.name}</div>
                  <div style={{ marginTop: 12 }}>
                    <Tag
                      bg={i === 2 ? C.paper : (m.tag === 'pantry' ? C.green : m.tag === 'leftover' ? C.blue : C.green)}
                      fg={i === 2 ? C.green : C.paper}
                    >
                      {m.tag}
                    </Tag>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* shop card */}
        <section style={{
          background: C.cream, borderRadius: 14,
          padding: '20px 22px', border: `1px solid ${C.ink}14`,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <div style={{
                fontSize: 11, color: C.ink2, fontWeight: 600,
                letterSpacing: '0.06em', textTransform: 'uppercase',
              }}>auto-shop · queued</div>
              <div style={{
                fontSize: 26, fontWeight: 700, marginTop: 4,
                letterSpacing: '-0.02em',
              }}>wed 4:30 pm</div>
              <div style={{ fontSize: 13, color: C.ink2 }}>whole foods · brooklyn</div>
            </div>
            <div style={{
              fontFamily: F.serif, fontStyle: 'italic',
              fontSize: 36, color: C.blue, lineHeight: 1,
            }}>$48<span style={{ fontSize: 18, color: C.mute }}>.20</span></div>
          </div>

          <div style={{ borderTop: `1px solid ${C.ink}14`, margin: '14px -22px 12px' }} />

          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            flex: 1, minHeight: 0, overflow: 'hidden',
          }}>
            {[
              { sec: 'produce', items: 'fennel · lemons · parsley · shallots', n: 4 },
              { sec: 'butcher', items: 'whole chicken · italian sausage', n: 2 },
              { sec: 'dairy',   items: 'butter · whole milk', n: 2 },
              { sec: 'pantry',  items: 'olives · anchovies · 00 flour', n: 3 },
            ].map((g, i) => (
              <div key={g.sec} style={{
                display: 'grid', gridTemplateColumns: '74px 1fr 28px',
                padding: '6px 0', alignItems: 'baseline', gap: 8,
                borderBottom: i < 3 ? `1px dashed ${C.ink}1a` : 'none',
              }}>
                <div style={{
                  fontFamily: F.serif, fontStyle: 'italic',
                  fontSize: 16, color: C.green,
                }}>{g.sec}</div>
                <div style={{ fontSize: 12, color: C.ink2 }}>{g.items}</div>
                <div style={{
                  fontFamily: F.sans, fontSize: 13,
                  fontWeight: 700, textAlign: 'right',
                }}>{g.n}</div>
              </div>
            ))}
          </div>

          <button style={{
            marginTop: 14, background: C.blue, color: C.paper,
            border: 'none', padding: '14px 16px',
            fontFamily: F.sans, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', borderRadius: 10, letterSpacing: '0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>check out for me, wednesday</span>
            <span style={{ fontFamily: F.serif, fontStyle: 'italic', fontSize: 18 }}>→</span>
          </button>

          {/* tiny font label badge — discreet, lower-left */}
          <div style={{
            position: 'absolute', display: 'none',
          }}>{label}</div>
        </section>
      </div>
    </div>
  );
}

// ─── Palettes ──────────────────────────────────────────────────────────────
// All share: cool paper, deep ink, fresh green, crisp blue.
// "cream" is the soft-card fill, "fresh" is the live/safe accent (slightly
// brighter green for contrast against ink), "green" is the workhorse, "blue"
// is the hot accent.

const GG_GARDEN = {
  paper:  '#eef2ec',   // cool off-white, slight green tint
  cream:  '#e3ebe2',
  ink:    '#0f1814',
  ink2:   '#3a4a40',
  green:  '#1d4d2d',
  fresh:  '#5fa54e',
  blue:   '#2454c0',
  mute:   '#6d7a6f',
};

const GG_CRISP = {
  paper:  '#f3f5f2',
  cream:  '#e6ebe4',
  ink:    '#0d1714',
  ink2:   '#3a443e',
  green:  '#1f5d33',
  fresh:  '#5aa758',
  blue:   '#2453d4',
  mute:   '#6e7872',
};

const GG_ATELIER = {
  paper:  '#e9efe8',
  cream:  '#dde6dc',
  ink:    '#131a16',
  ink2:   '#384038',
  green:  '#173a25',
  fresh:  '#4a8a3a',
  blue:   '#1f4fc0',
  mute:   '#6a7268',
};

// ─── Font pairings ─────────────────────────────────────────────────────────

const GG_FONTS_GEIST = {
  sans:  '"Geist", system-ui, sans-serif',
  serif: '"Newsreader", serif',
};

const GG_FONTS_SCHIBSTED = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Source Serif 4", serif',
};

const GG_FONTS_FUNNEL = {
  sans:  '"Funnel Display", system-ui, sans-serif',
  serif: '"Lora", serif',
};

const GG_FONTS_SCHIBSTED_LORA = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
};

// Accent studies on the Crisp palette — same green workhorse, four
// theory-grounded warm complements replacing the blue hot accent.
const _baseCrisp = {
  paper:  '#f3f5f2',
  cream:  '#e6ebe4',
  ink:    '#0d1714',
  ink2:   '#3a443e',
  green:  '#1f5d33',
  fresh:  '#5aa758',
  mute:   '#6e7872',
};

const GG_CRISP_TERRACOTTA = { ..._baseCrisp, blue: '#c25d39' };
const GG_CRISP_PERSIMMON  = { ..._baseCrisp, blue: '#d96e2e' };
const GG_CRISP_SAFFRON    = { ..._baseCrisp, blue: '#c98a1c' };
const GG_CRISP_PLUM       = { ..._baseCrisp, blue: '#6a2c4e' };

window.GGv2 = GGv2;
window.GG_GARDEN = GG_GARDEN;
window.GG_CRISP = GG_CRISP;
window.GG_ATELIER = GG_ATELIER;
window.GG_FONTS_GEIST = GG_FONTS_GEIST;
window.GG_FONTS_SCHIBSTED = GG_FONTS_SCHIBSTED;
window.GG_FONTS_FUNNEL = GG_FONTS_FUNNEL;
window.GG_FONTS_SCHIBSTED_LORA = GG_FONTS_SCHIBSTED_LORA;
window.GG_CRISP_TERRACOTTA = GG_CRISP_TERRACOTTA;
window.GG_CRISP_PERSIMMON = GG_CRISP_PERSIMMON;
window.GG_CRISP_SAFFRON = GG_CRISP_SAFFRON;
window.GG_CRISP_PLUM = GG_CRISP_PLUM;
