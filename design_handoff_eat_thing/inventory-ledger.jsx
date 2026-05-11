// Inventory — Pantry Ledger
// Crisp palette · Persimmon accent · Schibsted Grotesk + Lora italic.
// Real data shape: matches packages/shared InventoryRow (foodName, qty,
// unit, brand?, location, purchasedAt, expiresAt). Mobile-first the route
// will need its own treatment; this is the desktop view.

const INV = {
  paper:   '#f3f5f2',
  paper2:  '#eaeee7',
  cream:   '#e6ebe4',
  ink:     '#0d1714',
  ink2:    '#3a443e',
  ink3:    '#5a6359',
  green:   '#1f5d33',
  fresh:   '#5aa758',
  persimmon: '#d96e2e',
  persimDeep: '#b6541d',
  mute:    '#6e7872',
  rule:    '#0d171414',
  rule2:   '#0d17140a',
  warn:    '#c2412e',
};

const INV_FONT = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
  mono:  '"JetBrains Mono", ui-monospace, monospace',
};

// ─── Sample data (~40 items across all locations) ────────────────────────
const NOW = new Date('2026-05-10T09:14:00Z');
const dPlus = (d) => {
  const dt = new Date(NOW); dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
};
const dMinus = (d) => dPlus(-d);

const ITEMS = [
  // Fridge — soonest first
  { id:'1',  foodName:'buttermilk',     qty:0.5, unit:'pt', brand:'Strauss',     location:'fridge',  spot:'top shelf',     purchasedAt:dMinus(5),  expiresAt:dPlus(1) },
  { id:'2',  foodName:'cilantro',       qty:1,   unit:'bn', brand:null,          location:'fridge',  spot:'crisper',        purchasedAt:dMinus(3),  expiresAt:dPlus(2) },
  { id:'3',  foodName:'goat cheese',    qty:4,   unit:'oz', brand:'Vermont Cr.', location:'fridge',  spot:'door',           purchasedAt:dMinus(10), expiresAt:dPlus(3) },
  { id:'4',  foodName:'whole milk',     qty:0.75,unit:'qt', brand:'Maple Hill',  location:'fridge',  spot:'top shelf',      purchasedAt:dMinus(2),  expiresAt:dPlus(4) },
  { id:'5',  foodName:'spinach',        qty:5,   unit:'oz', brand:'Olivia\u2019s', location:'fridge',  spot:'crisper',     purchasedAt:dMinus(2),  expiresAt:dPlus(4) },
  { id:'6',  foodName:'fennel',         qty:2,   unit:'ea', brand:null,          location:'fridge',  spot:'crisper',        purchasedAt:dMinus(2),  expiresAt:dPlus(5) },
  { id:'7',  foodName:'heavy cream',    qty:1,   unit:'pt', brand:'Strauss',     location:'fridge',  spot:'top shelf',      purchasedAt:dMinus(2),  expiresAt:dPlus(5) },
  { id:'8',  foodName:'lemons',         qty:4,   unit:'ea', brand:null,          location:'fridge',  spot:'crisper',        purchasedAt:dMinus(3),  expiresAt:dPlus(10) },
  { id:'9',  foodName:'eggs · large',   qty:12,  unit:'ea', brand:'Vital Farms', location:'fridge',  spot:'door',           purchasedAt:dMinus(2),  expiresAt:dPlus(14) },
  { id:'10', foodName:'unsalted butter',qty:1,   unit:'lb', brand:'Kerrygold',   location:'fridge',  spot:'door',           purchasedAt:dMinus(8),  expiresAt:dPlus(30) },

  // Pantry
  { id:'11', foodName:'sourdough',      qty:0.5, unit:'lf', brand:'She Wolf',    location:'pantry',  spot:'counter',        purchasedAt:dMinus(2),  expiresAt:dPlus(2) },
  { id:'12', foodName:'bananas',        qty:4,   unit:'ea', brand:null,          location:'pantry',  spot:'counter',        purchasedAt:dMinus(4),  expiresAt:dPlus(3) },
  { id:'13', foodName:'00 flour',       qty:2,   unit:'lb', brand:'Caputo',      location:'pantry',  spot:'shelf A2',       purchasedAt:dMinus(20), expiresAt:dPlus(90) },
  { id:'14', foodName:'olive oil',      qty:750, unit:'ml', brand:'Frantoio',    location:'pantry',  spot:'shelf A1',       purchasedAt:dMinus(40), expiresAt:dPlus(180) },
  { id:'15', foodName:'castelvetrano',  qty:6,   unit:'oz', brand:'Divina',      location:'pantry',  spot:'shelf B1',       purchasedAt:dMinus(15), expiresAt:dPlus(90) },
  { id:'16', foodName:'anchovies',      qty:4,   unit:'oz', brand:'Ortiz',       location:'pantry',  spot:'shelf B1',       purchasedAt:dMinus(60), expiresAt:dPlus(365) },
  { id:'17', foodName:'spaghetti',      qty:16,  unit:'oz', brand:'De Cecco',    location:'pantry',  spot:'shelf C1',       purchasedAt:dMinus(40), expiresAt:dPlus(365) },
  { id:'18', foodName:'basmati rice',   qty:5,   unit:'lb', brand:'Tilda',       location:'pantry',  spot:'shelf C2',       purchasedAt:dMinus(70), expiresAt:dPlus(300) },
  { id:'19', foodName:'kosher salt',    qty:3,   unit:'lb', brand:'Diamond',     location:'pantry',  spot:'shelf D',        purchasedAt:dMinus(120),expiresAt:null },
  { id:'20', foodName:'honey',          qty:12,  unit:'oz', brand:'Local',       location:'pantry',  spot:'shelf D',        purchasedAt:dMinus(40), expiresAt:null },

  // Freezer
  { id:'21', foodName:'pizza dough',    qty:4,   unit:'ea', brand:'homemade',    location:'freezer', spot:'top drawer',     purchasedAt:dMinus(8),  expiresAt:dPlus(22) },
  { id:'22', foodName:'whole chicken',  qty:4,   unit:'lb', brand:'D\u2019Artagnan', location:'freezer', spot:'middle',     purchasedAt:dMinus(20), expiresAt:dPlus(60) },
  { id:'23', foodName:'italian sausage',qty:0.5, unit:'lb', brand:'Faicco\u2019s', location:'freezer', spot:'middle',       purchasedAt:dMinus(20), expiresAt:dPlus(40) },
  { id:'24', foodName:'frozen peas',    qty:16,  unit:'oz', brand:'365',         location:'freezer', spot:'side bin',       purchasedAt:dMinus(15), expiresAt:dPlus(150) },
  { id:'25', foodName:'chicken stock',  qty:1,   unit:'qt', brand:'homemade',    location:'freezer', spot:'side bin',       purchasedAt:dMinus(10), expiresAt:dPlus(50) },
  { id:'26', foodName:'frozen blueberries', qty:12, unit:'oz', brand:'365',      location:'freezer', spot:'side bin',       purchasedAt:dMinus(15), expiresAt:dPlus(150) },

  // Other
  { id:'27', foodName:'coffee beans',   qty:12,  unit:'oz', brand:'Sey',         location:'other',   spot:'countertop',     purchasedAt:dMinus(6),  expiresAt:dPlus(14) },
  { id:'28', foodName:'shallots',       qty:6,   unit:'ea', brand:null,          location:'other',   spot:'counter basket', purchasedAt:dMinus(4),  expiresAt:dPlus(12) },
  { id:'29', foodName:'garlic',         qty:2,   unit:'hd', brand:null,          location:'other',   spot:'counter basket', purchasedAt:dMinus(7),  expiresAt:dPlus(20) },
];

// ─── Helpers ─────────────────────────────────────────────────────────────
function daysUntil(iso) {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - NOW.getTime();
  return Math.ceil(ms / 86_400_000);
}
function fmtQty(qty, unit) {
  const n = qty % 1 === 0 ? qty : qty.toFixed(qty < 1 ? 2 : 1);
  return `${n} ${unit}`;
}
function urgency(days) {
  if (days == null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'soon';
  if (days <= 7) return 'thisweek';
  return 'fresh';
}

// ─── Header (shared with home) ────────────────────────────────────────────
function InvHeader() {
  return (
    <header style={{
      background: INV.ink, color: INV.paper,
      padding: '14px 36px',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      <div style={{
        fontFamily: INV_FONT.sans, fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}>
        Eat<span style={{
          color: INV.persimmon,
          fontFamily: INV_FONT.serif, fontStyle: 'italic',
          fontWeight: 400, fontSize: 28, marginLeft: 4,
        }}>thing</span>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 22, justifyContent: 'center' }}>
        {[
          ['home',     false],
          ['inventory', true],
          ['recipes',  false],
          ['plan',     false],
          ['list',     false],
          ['shops',    false],
        ].map(([t, active]) => (
          <div key={t} style={{
            fontSize: 13, fontWeight: 600,
            color: active ? INV.paper : `${INV.paper}99`,
            borderBottom: active ? `2px solid ${INV.persimmon}` : 'none',
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
          background: INV.persimmon, color: INV.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>M</div>
      </div>
    </header>
  );
}

// ─── Use-it-up chip strip ────────────────────────────────────────────────
function UseItUpStrip() {
  const soon = ITEMS
    .map(i => ({ ...i, d: daysUntil(i.expiresAt) }))
    .filter(i => i.d != null && i.d <= 3)
    .sort((a, b) => a.d - b.d)
    .slice(0, 5);
  return (
    <div style={{
      background: INV.ink, color: INV.paper,
      borderRadius: 12, padding: '14px 18px',
      display: 'grid',
      gridTemplateColumns: '180px repeat(5, 1fr)',
      gap: 16, alignItems: 'center',
    }}>
      <div>
        <div style={{
          fontFamily: INV_FONT.serif, fontStyle: 'italic',
          fontSize: 18, lineHeight: 1.1,
        }}>use this week</div>
        <div style={{
          fontFamily: INV_FONT.sans, fontSize: 11,
          color: `${INV.paper}99`, letterSpacing: '0.04em',
          textTransform: 'uppercase', marginTop: 2,
        }}>soonest to expire · {soon.length}</div>
      </div>
      {soon.map(it => (
        <div key={it.id} style={{
          display: 'flex', flexDirection: 'column', gap: 4,
          paddingLeft: 16, borderLeft: `1px solid ${INV.paper}24`,
        }}>
          <div style={{
            fontFamily: INV_FONT.serif, fontStyle: 'italic',
            fontSize: 28, lineHeight: 1, color: it.d <= 1 ? INV.persimmon : INV.paper,
            fontVariantNumeric: 'tabular-nums',
          }}>{it.d}<span style={{ fontSize: 13, marginLeft: 2 }}>d</span></div>
          <div style={{ fontWeight: 600, fontSize: 13, lineHeight: 1.2 }}>{it.foodName}</div>
          <div style={{ fontSize: 11, color: `${INV.paper}99` }}>{fmtQty(it.qty, it.unit)} · {it.spot}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Inventory rows ───────────────────────────────────────────────────────
function ItemRow({ it, hovered }) {
  const d = daysUntil(it.expiresAt);
  const u = urgency(d);
  const expColor = u === 'expired' ? INV.warn
                 : u === 'soon'    ? INV.persimmon
                 : u === 'thisweek'? INV.persimDeep
                 : u === 'fresh'   ? INV.fresh
                 : INV.mute;
  const dotColor = expColor;
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '90px 1fr 140px 130px 110px 60px',
      gap: 18, padding: '11px 24px', alignItems: 'baseline',
      borderTop: `1px solid ${INV.rule2}`,
      background: hovered ? INV.cream : 'transparent',
      cursor: 'default',
    }}>
      <div style={{
        fontFamily: INV_FONT.sans, fontSize: 14, fontWeight: 600,
        fontVariantNumeric: 'tabular-nums', color: INV.ink,
      }}>{fmtQty(it.qty, it.unit)}</div>

      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: INV_FONT.sans, fontSize: 15, fontWeight: 500,
          color: INV.ink, letterSpacing: '-0.005em',
        }}>{it.foodName}</div>
        {it.brand && (
          <div style={{
            fontFamily: INV_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: INV.ink3, marginTop: 1,
          }}>{it.brand}</div>
        )}
      </div>

      <div style={{
        fontFamily: INV_FONT.sans, fontSize: 12, color: INV.ink2,
      }}>{it.spot}</div>

      <div style={{
        fontFamily: INV_FONT.sans, fontSize: 12, color: INV.mute,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {(() => {
          const da = daysUntil(it.purchasedAt);
          if (da == null) return '—';
          if (da === 0) return 'today';
          if (da > -1 && da < 0) return 'today';
          return `${-da}d ago`;
        })()}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%', background: dotColor,
          opacity: u === 'fresh' || u === 'none' ? 0.5 : 1,
        }} />
        <span style={{
          fontFamily: u === 'soon' || u === 'expired' ? INV_FONT.serif : INV_FONT.sans,
          fontStyle: u === 'soon' || u === 'expired' ? 'italic' : 'normal',
          fontSize: u === 'soon' || u === 'expired' ? 16 : 13,
          fontWeight: u === 'soon' || u === 'expired' ? 400 : 500,
          color: expColor,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {d == null ? 'no exp' : d < 0 ? `${-d}d ago` : `${d}d`}
        </span>
      </div>

      <div style={{
        opacity: hovered ? 1 : 0,
        display: 'flex', justifyContent: 'flex-end', gap: 4,
        fontFamily: INV_FONT.sans, fontSize: 11, color: INV.ink2,
        transition: 'opacity .15s',
      }}>
        <span style={{ padding: '4px 8px', borderRadius: 4, background: INV.paper, border: `1px solid ${INV.rule}` }}>edit</span>
      </div>
    </div>
  );
}

function LocationGroup({ location, label, items, hoveredId, defaultOpen = true }) {
  const open = defaultOpen;
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        padding: '10px 24px',
        borderBottom: `1px solid ${INV.rule}`,
        background: INV.paper2,
      }}>
        <span style={{
          fontFamily: INV_FONT.serif, fontStyle: 'italic',
          fontSize: 22, color: INV.green, lineHeight: 1,
        }}>{label}</span>
        <span style={{
          fontFamily: INV_FONT.sans, fontSize: 12, color: INV.mute,
          letterSpacing: '0.04em',
        }}>{items.length} items</span>
        <span style={{ flex: 1 }}/>
        <span style={{
          fontFamily: INV_FONT.sans, fontSize: 11, color: INV.mute,
          letterSpacing: '0.06em', textTransform: 'uppercase',
        }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && items.map(it => (
        <ItemRow key={it.id} it={it} hovered={it.id === hoveredId} />
      ))}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────
function InventoryLedger() {
  const counts = ITEMS.reduce((acc, i) => { acc[i.location] = (acc[i.location] || 0) + 1; return acc; }, {});
  const total = ITEMS.length;
  const expSoon = ITEMS.filter(i => { const d = daysUntil(i.expiresAt); return d != null && d <= 7; }).length;
  // make one row "hovered" so the hover affordance is visible in the artboard
  const hoveredId = '3';

  const sectionDef = [
    ['fridge',  'fridge'],
    ['pantry',  'pantry'],
    ['freezer', 'freezer'],
    ['other',   'other'],
  ];

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: INV.paper, color: INV.ink,
      fontFamily: INV_FONT.sans, fontSize: 14, lineHeight: 1.4,
      display: 'flex', flexDirection: 'column',
    }}>
      <InvHeader />

      {/* Page title row */}
      <div style={{
        padding: '24px 36px 16px',
        display: 'flex', alignItems: 'flex-end',
        justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{
            fontFamily: INV_FONT.sans, fontSize: 11, color: INV.mute,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            fontWeight: 600,
          }}>the kitchen · 9:14 am</div>
          <div style={{
            fontFamily: INV_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 1, fontWeight: 400,
            letterSpacing: '-0.02em', marginTop: 6,
          }}>Inventory<span style={{ color: INV.persimmon }}>.</span></div>
          <div style={{
            fontSize: 14, color: INV.ink2, marginTop: 8,
          }}>
            <span style={{ fontWeight: 600, color: INV.ink }}>{total} items</span> on hand ·{' '}
            <span style={{ color: INV.persimDeep, fontWeight: 600 }}>{expSoon} expiring this week</span> ·{' '}
            <span style={{ fontStyle: 'italic', fontFamily: INV_FONT.serif, fontSize: 16 }}>last reconciled today, 9:14 a.m.</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            background: 'transparent', color: INV.ink2,
            border: `1px solid ${INV.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: INV_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>scan receipt</button>
          <button style={{
            background: INV.persimmon, color: INV.paper,
            border: 'none', borderRadius: 8,
            padding: '10px 16px', fontFamily: INV_FONT.sans,
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> add item
          </button>
        </div>
      </div>

      {/* Use-it-up strip */}
      <div style={{ padding: '0 36px 16px' }}>
        <UseItUpStrip />
      </div>

      {/* Action strip — tabs + search + sort */}
      <div style={{
        padding: '14px 36px',
        borderTop: `1px solid ${INV.rule}`,
        borderBottom: `1px solid ${INV.rule}`,
        background: INV.paper,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {[
            ['all',     'All',     total],
            ['fridge',  'Fridge',  counts.fridge || 0],
            ['pantry',  'Pantry',  counts.pantry || 0],
            ['freezer', 'Freezer', counts.freezer || 0],
            ['other',   'Other',   counts.other || 0],
          ].map(([k, label, n]) => (
            <div key={k} style={{
              padding: '7px 12px', borderRadius: 999,
              background: k === 'all' ? INV.ink : 'transparent',
              color: k === 'all' ? INV.paper : INV.ink2,
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'baseline', gap: 6,
              border: k === 'all' ? 'none' : `1px solid ${INV.rule}`,
            }}>
              <span>{label}</span>
              <span style={{
                fontFamily: INV_FONT.sans, fontSize: 11,
                opacity: k === 'all' ? 0.7 : 0.5,
                fontVariantNumeric: 'tabular-nums',
              }}>{n}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1, position: 'relative' }}>
          <input style={{
            width: '100%', padding: '8px 12px 8px 32px',
            border: `1px solid ${INV.rule}`, borderRadius: 8,
            background: INV.paper, color: INV.ink,
            fontFamily: INV_FONT.sans, fontSize: 13,
            outline: 'none',
          }}
          placeholder="Search items, brands, spots…"
          defaultValue=""
          />
          <div style={{
            position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: INV.mute, fontSize: 13,
          }}>⌕</div>
        </div>

        <div style={{
          fontFamily: INV_FONT.sans, fontSize: 12, color: INV.ink2,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', border: `1px solid ${INV.rule}`,
          borderRadius: 8,
        }}>
          <span>sort by</span>
          <span style={{ fontWeight: 600 }}>expiry ↑</span>
        </div>
      </div>

      {/* Column header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '90px 1fr 140px 130px 110px 60px',
        gap: 18, padding: '10px 24px',
        fontFamily: INV_FONT.sans, fontSize: 10,
        letterSpacing: '0.14em', textTransform: 'uppercase',
        color: INV.mute, fontWeight: 600,
        background: INV.paper,
      }}>
        <div>qty</div>
        <div>item</div>
        <div>spot</div>
        <div>added</div>
        <div style={{ textAlign: 'right' }}>expires</div>
        <div></div>
      </div>

      {/* Scrollable list */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sectionDef.map(([loc, label]) => (
          <LocationGroup
            key={loc}
            location={loc}
            label={label}
            items={ITEMS.filter(i => i.location === loc).sort((a, b) => {
              const da = daysUntil(a.expiresAt);
              const db = daysUntil(b.expiresAt);
              if (da == null && db == null) return 0;
              if (da == null) return 1;
              if (db == null) return -1;
              return da - db;
            })}
            hoveredId="3"
          />
        ))}
        <div style={{ height: 24 }} />
      </div>
    </div>
  );
}

window.InventoryLedger = InventoryLedger;
