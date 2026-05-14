// Shopping list — Crisp + Persimmon. The list is the bridge between the
// plan and Playwright's auto-checkout, so the screen has to communicate
// three things at once:
//   1. What's on it and why (each item has a reason: a meal, a low-stock
//      staple, manually added)
//   2. The store handoff: which supermarket, when, status of the agent
//   3. Editability: tick off, change qty, swap stores, skip
// Grouped by aisle (produce / butcher / dairy / pantry / frozen / other).

const SL = {
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

const SL_FONT = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
};

// reason: 'meal:Wed' | 'meal:Fri' | 'staple' | 'manual'
const SL_ITEMS = [
  { aisle:'produce',  name:'fennel',           qty:'2 bulbs',  price:4.80, reason:'meal:Wed', checked:false },
  { aisle:'produce',  name:'lemons',           qty:'4',        price:3.20, reason:'meal:Wed', checked:false },
  { aisle:'produce',  name:'parsley',          qty:'1 bunch',  price:1.80, reason:'meal:Wed', checked:true  },
  { aisle:'produce',  name:'shallots',         qty:'3',        price:2.10, reason:'meal:Wed', checked:false },
  { aisle:'produce',  name:'thyme',            qty:'1 bunch',  price:2.50, reason:'meal:Wed', checked:false },

  { aisle:'butcher',  name:'whole chicken',    qty:'4 lb',     price:14.40, reason:'meal:Wed', checked:false },
  { aisle:'butcher',  name:'italian sausage',  qty:'½ lb',     price:5.20,  reason:'meal:Fri', checked:false },

  { aisle:'dairy',    name:'unsalted butter',  qty:'1 lb',     price:6.50,  reason:'staple',   checked:false },
  { aisle:'dairy',    name:'whole milk',       qty:'1 qt',     price:3.80,  reason:'staple',   checked:false },
  { aisle:'dairy',    name:'fresh mozzarella', qty:'8 oz',     price:5.40,  reason:'meal:Fri', checked:false },

  { aisle:'pantry',   name:'castelvetrano olives', qty:'1 jar',price:6.20,  reason:'manual',   checked:false },
  { aisle:'pantry',   name:'anchovies',        qty:'1 tin',    price:3.40,  reason:'meal:Wed', checked:false },
  { aisle:'pantry',   name:'00 flour',         qty:'2 lb',     price:5.80,  reason:'meal:Fri', checked:false },
  { aisle:'pantry',   name:'dijon mustard',    qty:'1 jar',    price:4.20,  reason:'meal:Wed', checked:false },

  { aisle:'frozen',   name:'puff pastry',      qty:'1 box',    price:6.40,  reason:'manual',   checked:false },
];

const REASON_LABEL = {
  'meal:Wed':  { label: 'wed roast',    fg: SL.persimmon },
  'meal:Fri':  { label: 'fri pizza',    fg: SL.persimmon },
  'staple':    { label: 'low staple',   fg: SL.green },
  'manual':    { label: 'you added',    fg: SL.ink3 },
};

const AISLE_LABELS = {
  produce:  'Produce',
  butcher:  'Butcher',
  dairy:    'Dairy & cheese',
  pantry:   'Pantry & oils',
  frozen:   'Frozen',
  other:    'Other',
};

function SlHeader() {
  return (
    <header style={{
      background: SL.ink, color: SL.paper,
      padding: '14px 36px',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      <div style={{
        fontFamily: SL_FONT.sans, fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}>
        Eat<span style={{
          color: SL.persimmon,
          fontFamily: SL_FONT.serif, fontStyle: 'italic',
          fontWeight: 400, fontSize: 28, marginLeft: 4,
        }}>thing</span>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 22, justifyContent: 'center' }}>
        {[['home',false],['inventory',false],['recipes',false],['plan',false],['list',true],['shops',false]].map(([t,active]) => (
          <div key={t} style={{
            fontSize: 13, fontWeight: 600,
            color: active ? SL.paper : `${SL.paper}99`,
            borderBottom: active ? `2px solid ${SL.persimmon}` : 'none',
            paddingBottom: 3, letterSpacing: '0.01em',
          }}>{t}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>mon · may 11</div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: SL.persimmon, color: SL.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>M</div>
      </div>
    </header>
  );
}

function ReasonChip({ reason }) {
  const r = REASON_LABEL[reason] || REASON_LABEL.manual;
  return (
    <span style={{
      fontFamily: SL_FONT.serif, fontStyle: 'italic',
      fontSize: 12, color: r.fg, whiteSpace: 'nowrap',
    }}>{r.label}</span>
  );
}

function Check({ checked }) {
  return (
    <span style={{
      width: 18, height: 18, borderRadius: 5,
      border: `1.5px solid ${checked ? SL.green : SL.rule}`,
      background: checked ? SL.green : 'transparent',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {checked && (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.5L5 9L9.5 3.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </span>
  );
}

function AisleSection({ aisle, items }) {
  const subtotal = items.reduce((sum, it) => sum + it.price, 0);
  const checked = items.filter(i => i.checked).length;

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        marginBottom: 10, paddingBottom: 8,
        borderBottom: `1px solid ${SL.rule}`,
      }}>
        <span style={{
          fontFamily: SL_FONT.serif, fontStyle: 'italic',
          fontSize: 22, lineHeight: 1, color: SL.ink,
        }}>{AISLE_LABELS[aisle] || aisle}<span style={{ color: SL.persimmon }}>.</span></span>
        <span style={{
          fontFamily: SL_FONT.sans, fontSize: 11, fontWeight: 600,
          color: SL.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
        }}>{items.length} {items.length === 1 ? 'item' : 'items'}{checked > 0 ? ` · ${checked} in cart` : ''}</span>
        <span style={{ flex: 1 }} />
        <span style={{
          fontFamily: SL_FONT.sans, fontSize: 12, color: SL.ink2,
          fontVariantNumeric: 'tabular-nums',
        }}>${subtotal.toFixed(2)}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((it, i) => (
          <div key={`${aisle}-${i}`} style={{
            display: 'grid',
            gridTemplateColumns: '18px 1fr 90px 80px 24px',
            gap: 14, alignItems: 'center',
            padding: '10px 4px',
            borderBottom: i < items.length - 1 ? `1px solid ${SL.rule2}` : 'none',
            opacity: it.checked ? 0.55 : 1,
          }}>
            <Check checked={it.checked} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
              <span style={{
                fontFamily: SL_FONT.sans, fontSize: 15, fontWeight: 600,
                color: SL.ink,
                textDecoration: it.checked ? 'line-through' : 'none',
                letterSpacing: '-0.005em',
              }}>{it.name}</span>
              <span style={{ fontSize: 12, color: SL.mute, whiteSpace: 'nowrap' }}>{it.qty}</span>
            </div>
            <ReasonChip reason={it.reason} />
            <div style={{
              fontFamily: SL_FONT.sans, fontSize: 13, color: SL.ink2,
              fontVariantNumeric: 'tabular-nums', textAlign: 'right',
            }}>${it.price.toFixed(2)}</div>
            <div style={{
              color: SL.mute, fontSize: 16, cursor: 'pointer',
              display: 'flex', justifyContent: 'flex-end',
            }}>⋯</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ShoppingList() {
  const total = SL_ITEMS.reduce((s, it) => s + it.price, 0);
  const byAisle = {};
  SL_ITEMS.forEach(it => {
    (byAisle[it.aisle] ||= []).push(it);
  });
  const aisleOrder = ['produce', 'butcher', 'dairy', 'pantry', 'frozen', 'other'];

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: SL.paper, color: SL.ink,
      fontFamily: SL_FONT.sans, fontSize: 14, lineHeight: 1.4,
      display: 'flex', flexDirection: 'column',
    }}>
      <SlHeader />

      {/* Title row */}
      <div style={{
        padding: '24px 36px 16px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{
            fontFamily: SL_FONT.sans, fontSize: 11, color: SL.mute,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          }}>auto-built · last updated 9:14 am</div>
          <div style={{
            fontFamily: SL_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em',
            marginTop: 6,
          }}>The list<span style={{ color: SL.persimmon }}>.</span></div>
          <div style={{ fontSize: 14, color: SL.ink2, marginTop: 8 }}>
            <span style={{ fontWeight: 600, color: SL.ink }}>{SL_ITEMS.length} items</span> across {aisleOrder.filter(a => byAisle[a]).length} aisles · for{' '}
            <span style={{ fontFamily: SL_FONT.serif, fontStyle: 'italic', fontSize: 16 }}>this week's plan</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            background: 'transparent', color: SL.ink2,
            border: `1px solid ${SL.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: SL_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>+ add item</button>
          <button style={{
            background: 'transparent', color: SL.ink2,
            border: `1px solid ${SL.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: SL_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>print</button>
        </div>
      </div>

      {/* Sub-strip */}
      <div style={{
        padding: '14px 36px',
        borderTop: `1px solid ${SL.rule}`,
        borderBottom: `1px solid ${SL.rule}`,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            ['all',      'All',         SL_ITEMS.length],
            ['mealWed',  'Wed roast',   SL_ITEMS.filter(i => i.reason === 'meal:Wed').length, SL.persimmon],
            ['mealFri',  'Fri pizza',   SL_ITEMS.filter(i => i.reason === 'meal:Fri').length, SL.persimmon],
            ['staples',  'Staples',     SL_ITEMS.filter(i => i.reason === 'staple').length, SL.green],
            ['manual',   'You added',   SL_ITEMS.filter(i => i.reason === 'manual').length],
          ].map(([k, label, n, dot], i) => (
            <div key={k} style={{
              padding: '7px 12px', borderRadius: 999,
              background: i === 0 ? SL.ink : 'transparent',
              color: i === 0 ? SL.paper : SL.ink2,
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              border: i === 0 ? 'none' : `1px solid ${SL.rule}`,
            }}>
              {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: dot }} />}
              <span>{label}</span>
              <span style={{ opacity: i === 0 ? 0.7 : 0.5, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ flex: 1, position: 'relative' }}>
          <input style={{
            width: '100%', padding: '8px 12px 8px 32px',
            border: `1px solid ${SL.rule}`, borderRadius: 8,
            background: SL.paper, color: SL.ink,
            fontFamily: SL_FONT.sans, fontSize: 13, outline: 'none',
          }} placeholder="Search items…" />
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: SL.mute, fontSize: 13 }}>⌕</div>
        </div>
        <div style={{
          fontFamily: SL_FONT.sans, fontSize: 12, color: SL.ink2,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', border: `1px solid ${SL.rule}`, borderRadius: 8,
        }}>
          <span>group by</span><span style={{ fontWeight: 600 }}>aisle</span>
        </div>
      </div>

      {/* Two-pane: list + checkout sidebar */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', minHeight: 0 }}>
        <div style={{ overflowY: 'auto', minHeight: 0, padding: '24px 36px 36px' }}>
          {aisleOrder.filter(a => byAisle[a]).map(a => (
            <AisleSection key={a} aisle={a} items={byAisle[a]} />
          ))}
        </div>

        {/* Checkout sidebar */}
        <aside style={{
          borderLeft: `1px solid ${SL.rule}`,
          padding: '24px 26px 26px',
          background: SL.paper2,
          display: 'flex', flexDirection: 'column', gap: 18,
          overflowY: 'auto', minHeight: 0,
        }}>
          {/* Store picker */}
          <div>
            <div style={{
              fontFamily: SL_FONT.sans, fontSize: 11, color: SL.mute,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
              marginBottom: 8,
            }}>send to</div>
            <div style={{
              border: `1px solid ${SL.ink}`, borderRadius: 10,
              padding: '12px 14px', background: SL.paper,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, background: SL.green,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: SL.paper, fontWeight: 800, fontSize: 12,
              }}>WF</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Whole Foods · Brooklyn</div>
                <div style={{ fontSize: 11, color: SL.mute }}>connected · last run yesterday</div>
              </div>
              <div style={{ fontSize: 12, color: SL.ink2, fontWeight: 600 }}>change</div>
            </div>
            <div style={{
              fontFamily: SL_FONT.serif, fontStyle: 'italic',
              fontSize: 12, color: SL.ink3, marginTop: 6,
            }}>
              also connected: Trader Joe's, FreshDirect
            </div>
          </div>

          {/* Delivery window */}
          <div>
            <div style={{
              fontFamily: SL_FONT.sans, fontSize: 11, color: SL.mute,
              letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
              marginBottom: 8,
            }}>delivery window</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
            }}>
              {[
                ['Wed', '4:30 – 5:30 pm', true],
                ['Wed', '6:00 – 7:00 pm', false],
                ['Thu', '9:00 – 10:00 am', false],
                ['Thu', '11:00 – 12:00 pm', false],
              ].map(([d, t, sel], i) => (
                <div key={i} style={{
                  padding: '10px 12px', borderRadius: 8,
                  border: sel ? `1.5px solid ${SL.persimmon}` : `1px solid ${SL.rule}`,
                  background: sel ? '#d96e2e10' : SL.paper,
                }}>
                  <div style={{
                    fontFamily: SL_FONT.sans, fontSize: 11, fontWeight: 700,
                    color: sel ? SL.persimDeep : SL.mute,
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>{d}</div>
                  <div style={{
                    fontSize: 13, fontWeight: 600,
                    color: sel ? SL.ink : SL.ink2, marginTop: 2,
                  }}>{t}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div style={{
            border: `1px solid ${SL.rule}`, borderRadius: 10,
            background: SL.paper, padding: '14px 16px',
          }}>
            {[
              ['subtotal', `$${total.toFixed(2)}`],
              ['delivery', '$5.99'],
              ['est. tax', '$4.10'],
            ].map(([k, v], i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '4px 0', fontSize: 13, color: SL.ink2,
              }}>
                <span>{k}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
            ))}
            <div style={{
              borderTop: `1px solid ${SL.rule}`, margin: '8px 0 0',
              paddingTop: 10,
              display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            }}>
              <span style={{
                fontFamily: SL_FONT.serif, fontStyle: 'italic',
                fontSize: 18,
              }}>est. total</span>
              <span style={{
                fontFamily: SL_FONT.sans, fontWeight: 800, fontSize: 24,
                fontVariantNumeric: 'tabular-nums',
              }}>$58.29</span>
            </div>
          </div>

          {/* Send button */}
          <button style={{
            background: SL.persimmon, color: SL.paper, border: 'none',
            borderRadius: 10, padding: '14px 16px',
            fontFamily: SL_FONT.sans, fontSize: 14, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.01em',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>send to whole foods</span>
            <span style={{ fontFamily: SL_FONT.serif, fontStyle: 'italic', fontSize: 18 }}>→</span>
          </button>

          {/* Agent status */}
          <div style={{
            background: SL.ink, color: SL.paper, borderRadius: 10,
            padding: '14px 16px',
          }}>
            <div style={{
              fontFamily: SL_FONT.sans, fontSize: 10, fontWeight: 700,
              color: SL.fresh, letterSpacing: '0.14em', textTransform: 'uppercase',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: SL.fresh }} />
              playwright agent · idle
            </div>
            <div style={{
              fontFamily: SL_FONT.serif, fontStyle: 'italic',
              fontSize: 14, color: `${SL.paper}cc`, marginTop: 6,
              lineHeight: 1.4,
            }}>
              I'll log in, drop everything into your cart, choose the window, and stop before checkout for your okay.
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

window.ShoppingList = ShoppingList;
