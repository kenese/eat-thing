// Meal Plan — date stream. Crisp + Persimmon system.
//
// New model: planning is no longer "this week, mon→sun". Any date can
// hold up to 4 recipes. The page opens with today as the 3rd visible
// day (2 past days on the left) and scrolls ~2 weeks forward. There's
// a "load date" affordance to jump anywhere.
//
// Read priority:
//  1. Per-day card: meal name(s), can-cook status, "uses N expiring" hint
//  2. Horizon strip up top: 16-day overview, today highlighted
//  3. Open-seat suggestions from inventory-aware recipes
//  4. Auto-shop preview — what gets bought on the next shop day

const MP = {
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

const MP_FONT = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
};

// 16 days: may 9 → may 24. Today = may 11 (mon), at index 2 → 3rd visible.
const DAYS = [
  { d:9,  wk:'sat', past:true,  meals:[
    { name:'Spaghetti aglio e olio', cooked:true, time:18 },
  ]},
  { d:10, wk:'sun', past:true,  meals:[
    { name:'Stock noodles · leftover', cooked:true, time:25 },
  ]},
  { d:11, wk:'mon', today:true, label:'today', meals:[
    { slotId:'mp-cacio',   name:'Cacio e pepe',
      time:20, servings:2, missing:[], tag:'all pantry' },
  ]},
  { d:12, wk:'tue', label:'tomorrow', meals:[
    { slotId:'mp-broc',    name:'Charred broccoli & lentils',
      time:35, servings:4, missing:[], tag:'one-pan' },
  ]},
  { d:13, wk:'wed', meals:[
    { slotId:'mp-roast',   name:'Roast chicken, lemon, fennel',
      time:90, servings:4, missing:['whole chicken','thyme','dijon'], tag:'sunday-y' },
  ], shopDay:true },
  { d:14, wk:'thu', meals:[
    { slotId:'mp-leftover',name:'Chicken stock noodles',
      time:25, servings:3, missing:[], tag:'leftover' },
  ], leftover:true },
  { d:15, wk:'fri', meals:[
    { slotId:'mp-pizza',   name:'Pizza, sausage & honey',
      time:60, servings:4, missing:['mozzarella','italian sausage'], tag:'dough' },
    {                       name:'Bitter greens salad',
      time:10, servings:4, missing:[], tag:'pantry side' },
  ]},
  { d:16, wk:'sat', meals:[
    { slotId:'mp-omel',    name:'Saturday omelette, soft herbs',
      time:15, servings:2, missing:[], tag:'eggs' },
  ]},
  { d:17, wk:'sun', meals:[] },
  { d:18, wk:'mon', meals:[] },
  { d:19, wk:'tue', meals:[
    { name:'Shakshuka', time:30, servings:3, missing:['canned tomato','feta'], tag:'eggs' },
  ]},
  { d:20, wk:'wed', meals:[] },
  { d:21, wk:'thu', meals:[] },
  { d:22, wk:'fri', meals:[] },
  { d:23, wk:'sat', meals:[] },
  { d:24, wk:'sun', meals:[] },
];

const SUGGEST = [
  { id:'r5', name:'Spaghetti aglio e olio',          time:18, missing:[],
    hint:'all pantry · 18m' },
  { id:'r8', name:'Shakshuka',                       time:30,
    missing:['canned tomatoes','feta'], hint:'add to next shop · 30m' },
  { id:'r2', name:'Buttermilk biscuits + cilantro',  time:40, missing:[],
    hint:'uses 3 expiring · 40m' },
];

function MpHeader() {
  return (
    <header style={{
      background: MP.ink, color: MP.paper,
      padding: '14px 36px',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      <div style={{
        fontFamily: MP_FONT.sans, fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}>
        Eat<span style={{
          color: MP.persimmon,
          fontFamily: MP_FONT.serif, fontStyle: 'italic',
          fontWeight: 400, fontSize: 28, marginLeft: 4,
        }}>thing</span>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 22, justifyContent: 'center' }}>
        {[['home',false],['inventory',false],['recipes',false],['plan',true],['list',false],['shops',false]].map(([t,active]) => (
          <div key={t} style={{
            fontSize: 13, fontWeight: 600,
            color: active ? MP.paper : `${MP.paper}99`,
            borderBottom: active ? `2px solid ${MP.persimmon}` : 'none',
            paddingBottom: 3, letterSpacing: '0.01em',
          }}>{t}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>mon · may 11</div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: MP.persimmon, color: MP.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>M</div>
      </div>
    </header>
  );
}

function StatusChip({ kind, small }) {
  // kind: 'cook' | 'shop' | 'leftover' | 'open'
  const styles = {
    cook:     { bg: MP.fresh,      fg: MP.paper, label: 'cook now' },
    shop:     { bg: MP.persimmon,  fg: MP.paper, label: 'needs shop' },
    leftover: { bg: MP.ink,        fg: MP.paper, label: 'leftover' },
    open:     { bg: 'transparent', fg: MP.mute,  label: 'open seat', border: true },
  }[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: small ? '2px 7px' : '3px 8px',
      borderRadius: 999,
      background: styles.bg, color: styles.fg,
      border: styles.border ? `1px dashed ${MP.mute}` : 'none',
      fontFamily: MP_FONT.sans,
      fontSize: small ? 9 : 10, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {!styles.border && (
        <span style={{
          width: 4, height: 4, borderRadius: '50%',
          background: styles.fg, opacity: 0.9,
        }} />
      )}
      {styles.label}
    </span>
  );
}

// Horizon strip — 16 day pills, today highlighted, past dimmed.
function HorizonStrip({ days }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`,
      gap: 6,
    }}>
      {days.map((day, i) => {
        const has = day.meals.length > 0;
        const multi = day.meals.length > 1;
        const isToday = day.today;
        const isPast = day.past;
        return (
          <div key={i} style={{
            padding: '8px 4px 7px', borderRadius: 10,
            background: isToday ? MP.ink : 'transparent',
            color: isToday ? MP.paper : isPast ? MP.mute : MP.ink,
            opacity: isPast ? 0.55 : 1,
            border: isToday ? 'none' : `1px solid ${isPast ? MP.rule2 : MP.rule}`,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 3, textAlign: 'center',
          }}>
            <div style={{
              fontFamily: MP_FONT.sans, fontSize: 9, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase',
              opacity: 0.85,
            }}>{day.wk}</div>
            <div style={{
              fontFamily: MP_FONT.serif, fontStyle: 'italic',
              fontSize: 18, lineHeight: 1, fontWeight: 400,
            }}>{day.d}</div>
            {has ? (
              multi ? (
                <div style={{
                  fontFamily: MP_FONT.sans, fontSize: 9, fontWeight: 700,
                  color: isToday ? MP.persimmon : MP.persimDeep,
                }}>{day.meals.length}×</div>
              ) : (
                <div style={{
                  width: 4, height: 4, borderRadius: '50%',
                  background: isToday ? MP.persimmon : MP.fresh,
                }} />
              )
            ) : (
              <div style={{ height: 4 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Compact stacked meal row — used when a day has 2+ meals, and as the
// secondary line(s) on a single-meal card if it's a past/cooked entry.
function MealRow({ meal, dark, past }) {
  const kind =
    meal.cooked ? 'cooked'
    : meal.missing && meal.missing.length > 0 ? 'shop'
    : 'cook';

  if (meal.cooked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 0',
        borderTop: `1px solid ${dark ? '#ffffff14' : MP.rule2}`,
      }}>
        <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
          <path d="M2 6.5L4.5 9L10 3.5"
            stroke={MP.fresh} strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div style={{
          flex: 1, fontSize: 13, fontWeight: 500,
          color: dark ? `${MP.paper}b3` : MP.ink2,
          textDecoration: 'line-through',
          textDecorationColor: dark ? '#ffffff33' : MP.rule,
          minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{meal.name}</div>
        <div style={{
          fontFamily: MP_FONT.serif, fontStyle: 'italic',
          fontSize: 11, color: MP.mute,
        }}>cooked</div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 0',
      borderTop: `1px solid ${dark ? '#ffffff14' : MP.rule2}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 600,
          letterSpacing: '-0.005em', lineHeight: 1.25,
          color: dark ? MP.paper : MP.ink,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{meal.name}</div>
        {meal.missing && meal.missing.length > 0 ? (
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 11, color: dark ? `${MP.paper}b3` : MP.ink3,
            marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>need {meal.missing[0]}{meal.missing.length > 1 ? ` & ${meal.missing.length - 1} more` : ''}</div>
        ) : meal.tag ? (
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 11, color: dark ? `${MP.paper}99` : MP.mute,
            marginTop: 2,
          }}>{meal.time}m · {meal.tag}</div>
        ) : null}
      </div>
      <StatusChip kind={kind} small />
    </div>
  );
}

function DayCard({ d }) {
  const isToday = d.today;
  const isPast = d.past;
  const meals = d.meals;
  const empty = meals.length === 0;
  const primary = meals[0];
  const rest = meals.slice(1);

  // Card-level chip for single-meal days
  const primaryKind = !primary ? 'open'
    : primary.cooked ? 'cooked'
    : d.leftover ? 'leftover'
    : primary.missing && primary.missing.length > 0 ? 'shop'
    : 'cook';

  return (
    <div style={{
      background: isToday ? MP.ink : MP.paper,
      color: isToday ? MP.paper : MP.ink,
      border: isToday ? 'none' : `1px solid ${MP.rule}`,
      borderRadius: 12, padding: '14px 14px 12px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 280, position: 'relative',
      opacity: isPast ? 0.6 : 1,
    }}>
      {/* day header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: isToday ? MP.persimmon : MP.mute,
        }}>{d.wk} · {d.d}</div>
        {d.label && (
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: isToday ? `${MP.paper}99` : MP.ink3,
          }}>{d.label}</div>
        )}
        {meals.length > 1 && (
          <div style={{
            fontFamily: MP_FONT.sans, fontSize: 10, fontWeight: 700,
            color: isToday ? MP.persimmon : MP.persimDeep,
            letterSpacing: '0.04em',
          }}>{meals.length} meals</div>
        )}
      </div>

      {empty ? (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          border: `1.5px dashed ${MP.rule}`, borderRadius: 10,
          padding: '16px 8px', color: MP.mute,
          background: MP.paper2,
        }}>
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 22, color: MP.ink3,
          }}>open seat</div>
          <div style={{
            fontFamily: MP_FONT.sans, fontSize: 11, marginTop: 8,
            color: MP.persimmon, fontWeight: 700, letterSpacing: '0.02em',
          }}>+ add recipe</div>
        </div>
      ) : primary.cooked ? (
        // Past day — no image, just check + name + cooked
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            padding: '4px 0 10px',
          }}>
            <svg width="16" height="16" viewBox="0 0 12 12" fill="none" style={{ marginTop: 2 }}>
              <path d="M2 6.5L4.5 9L10 3.5"
                stroke={MP.fresh} strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <div style={{
              flex: 1,
              fontFamily: MP_FONT.sans, fontSize: 15, fontWeight: 600,
              color: MP.ink2, lineHeight: 1.25,
              textDecoration: 'line-through', textDecorationColor: MP.rule,
            }}>{primary.name}</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 13, color: MP.mute,
          }}>cooked · {primary.time}m</div>
        </div>
      ) : (
        <>
          {/* primary meal — image + title */}
          <image-slot
            id={primary.slotId}
            shape="rounded"
            radius={8}
            placeholder={`drop ${primary.name.split(',')[0].toLowerCase()}`}
            style={{
              width: '100%',
              height: rest.length > 0 ? 70 : 96,
              display: 'block',
              background: isToday ? '#1a2520' : MP.cream,
            }}
          />
          <div style={{
            fontFamily: MP_FONT.sans,
            fontSize: rest.length > 0 ? 15 : 17,
            fontWeight: 600, letterSpacing: '-0.012em', lineHeight: 1.2,
            color: isToday ? MP.paper : MP.ink,
          }}>{primary.name}</div>

          {primary.missing && primary.missing.length > 0 && (
            <div style={{
              fontFamily: MP_FONT.serif, fontStyle: 'italic',
              fontSize: 12, lineHeight: 1.35,
              color: isToday ? `${MP.paper}b3` : MP.ink3,
            }}>
              need {primary.missing.slice(0, 2).join(', ')}
              {primary.missing.length > 2 ? ` & ${primary.missing.length - 2} more` : ''}
            </div>
          )}

          {/* additional meals stacked */}
          {rest.map((m, i) => (
            <MealRow key={i} meal={m} dark={isToday} />
          ))}

          <div style={{ flex: 1 }} />

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
          }}>
            <div style={{
              fontFamily: MP_FONT.sans, fontSize: 11,
              color: isToday ? `${MP.paper}b3` : MP.mute,
            }}>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>{primary.time}m</span>
              <span style={{ opacity: 0.5, margin: '0 6px' }}>·</span>
              <span>serves {primary.servings}</span>
            </div>
            <StatusChip kind={primaryKind} />
          </div>
        </>
      )}
    </div>
  );
}

function MealPlan() {
  // Day-strip is horizontally scrollable across all 16 days. Initial
  // scroll position lands with today as the 2nd visible card (1 past
  // day on the left, 5 future on the right). User can scroll further
  // left for prev days (future: auto-load more) and right for ~2 wks.
  const stripRef = React.useRef(null);
  React.useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    // Find today's card and align it to the 2nd slot.
    const cards = el.querySelectorAll('[data-day]');
    const todayEl = el.querySelector('[data-today="1"]');
    if (!todayEl || cards.length < 2) return;
    // Width of one card + gap → scroll today.offsetLeft minus one slot
    const cardW = cards[1].offsetLeft - cards[0].offsetLeft;
    el.scrollLeft = Math.max(0, todayEl.offsetLeft - cardW);
  }, []);

  // Summary across the next 7 days from today (today + 6)
  const todayIdx = DAYS.findIndex(d => d.today);
  const next7 = DAYS.slice(todayIdx, todayIdx + 7);
  const pantryMeals = next7.flatMap(d => d.meals).filter(m => !m.cooked && (!m.missing || m.missing.length === 0)).length;
  const shopMeals   = next7.flatMap(d => d.meals).filter(m => m.missing && m.missing.length > 0).length;
  const openDays    = next7.filter(d => d.meals.length === 0).length;

  // Open-seat suggestion targets — the first few empty future days
  const openSlots = DAYS.filter(d => !d.past && !d.today && d.meals.length === 0);

  // Total shop count across the horizon (used in the CTA badge)
  const needsShopMeals = DAYS.flatMap(d => d.meals).filter(m => m.missing && m.missing.length > 0).length;

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto', overflowX: 'hidden',
      background: MP.paper, color: MP.ink,
      fontFamily: MP_FONT.sans, fontSize: 14, lineHeight: 1.4,
    }}>
      <MpHeader />

      {/* Title row */}
      <div style={{
        padding: '24px 36px 16px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{
            fontFamily: MP_FONT.sans, fontSize: 11, color: MP.mute,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          }}>may 2026</div>
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em',
            marginTop: 6,
          }}>Plan<span style={{ color: MP.persimmon }}>.</span></div>
          <div style={{ fontSize: 14, color: MP.ink2, marginTop: 8 }}>
            <span style={{ fontWeight: 600, color: MP.ink }}>{pantryMeals} from the pantry</span> ·{' '}
            <span style={{ fontWeight: 600, color: MP.persimDeep }}>{shopMeals} need a shop</span> ·{' '}
            <span style={{ fontFamily: MP_FONT.serif, fontStyle: 'italic', fontSize: 16 }}>{openDays} open</span>
            <span style={{ color: MP.mute, marginLeft: 6 }}>· next 7 days</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* scroll back / today / scroll forward */}
          <button style={{
            background: 'transparent', color: MP.ink2,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            width: 38, height: 38, padding: 0,
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 18, fontWeight: 400, cursor: 'pointer',
          }}>←</button>
          <button style={{
            background: 'transparent', color: MP.ink,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            padding: '0 14px', height: 38,
            fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>today</button>
          <button style={{
            background: 'transparent', color: MP.ink2,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            width: 38, height: 38, padding: 0,
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 18, fontWeight: 400, cursor: 'pointer',
          }}>→</button>
          {/* load date — calendar icon */}
          <button style={{
            background: 'transparent', color: MP.ink2,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '0 12px', height: 38,
            fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 500,
            cursor: 'pointer',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="16" rx="2.5"
                stroke="currentColor" strokeWidth="1.6" />
              <line x1="3" y1="10" x2="21" y2="10"
                stroke="currentColor" strokeWidth="1.6" />
              <line x1="8" y1="3" x2="8" y2="7"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16" y1="3" x2="16" y2="7"
                stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <span>load date</span>
          </button>
          <button style={{
            background: MP.persimmon, color: MP.paper, border: 'none',
            borderRadius: 8, padding: '0 16px', height: 38,
            fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            add recipes to list
            <span style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 999,
              padding: '1px 7px', fontSize: 11, fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
            }}>{needsShopMeals}</span>
            <span style={{ fontFamily: MP_FONT.serif, fontStyle: 'italic', fontSize: 16 }}>→</span>
          </button>
        </div>
      </div>

      {/* Horizon strip — 16 day pills, today is 3rd */}
      <div style={{
        padding: '12px 36px 16px',
        borderTop: `1px solid ${MP.rule}`,
        borderBottom: `1px solid ${MP.rule}`,
        background: MP.paper,
      }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 10,
        }}>
          <div style={{
            fontFamily: MP_FONT.sans, fontSize: 10, fontWeight: 700,
            color: MP.mute, letterSpacing: '0.14em', textTransform: 'uppercase',
          }}>16-day horizon · 9 – 24 may</div>
          <div style={{
            display: 'flex', gap: 14,
            fontFamily: MP_FONT.sans, fontSize: 11, color: MP.ink2,
          }}>
            {[
              ['cook now',  pantryMeals, MP.fresh],
              ['needs shop', shopMeals,  MP.persimmon],
              ['leftover', next7.filter(d => d.leftover).length, MP.ink],
              ['open',     openDays,     MP.mute, true],
            ].map(([label, n, c, dashed], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: dashed ? 'transparent' : c,
                  border: dashed ? `1.5px dashed ${c}` : 'none',
                }} />
                <span>{label}</span>
                <span style={{ color: MP.mute, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
              </div>
            ))}
          </div>
        </div>
        <HorizonStrip days={DAYS} />
      </div>

      {/* Plan body — normal page flow, only the day-strip scrolls horizontally */}
      <div style={{ padding: '24px 0 32px' }}>
        {/* Horizontal day strip — all 16 days, scrolls left/right.
            Today is positioned as the 2nd visible card on mount.
            Negative margins + matching padding let cards bleed to the
            viewport edge while the lower content stays gutter-aligned. */}
        <div
          ref={stripRef}
          style={{
            overflowX: 'auto', overflowY: 'hidden',
            scrollSnapType: 'x proximity',
            padding: '4px 36px 16px',
            marginBottom: 32,
            // hide scrollbar visually but keep functional
            scrollbarWidth: 'thin',
          }}
        >
          <div style={{
            display: 'grid',
            gridAutoFlow: 'column',
            gridAutoColumns: '162px',
            gap: 12,
            paddingBottom: 4, // room for any scrollbar
          }}>
            {DAYS.map((d) => (
              <div key={d.d} data-day={d.d} data-today={d.today ? 1 : 0}
                style={{ scrollSnapAlign: 'start' }}>
                <DayCard d={d} />
              </div>
            ))}
          </div>
        </div>

        {/* Lower row: suggestions + shop preview — normal flow */}
        <div style={{
          padding: '0 36px',
          display: 'grid', gridTemplateColumns: '1.4fr 1fr',
          gap: 20,
        }}>
          {/* Fill open seats */}
          <section style={{
            background: MP.paper, border: `1px solid ${MP.rule}`,
            borderRadius: 14, padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{
                fontFamily: MP_FONT.serif, fontStyle: 'italic',
                fontSize: 24, lineHeight: 1, color: MP.ink,
              }}>Open seats<span style={{ color: MP.persimmon }}>.</span></span>
              <span style={{
                fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 600,
                color: MP.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>{openSlots.length} days ahead · three picks</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: MP.ink2 }}>based on what you have & what's expiring</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SUGGEST.map((s, i) => (
                <div key={s.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto auto',
                  alignItems: 'center', gap: 14,
                  padding: '12px 14px',
                  borderRadius: 10, background: i === 0 ? MP.cream : MP.paper2,
                  border: `1px solid ${MP.rule}`,
                }}>
                  <div>
                    <div style={{ fontFamily: MP_FONT.sans, fontSize: 15, fontWeight: 600 }}>{s.name}</div>
                    <div style={{
                      fontFamily: MP_FONT.serif, fontStyle: 'italic',
                      fontSize: 13, color: MP.ink3, marginTop: 2,
                    }}>{s.hint}</div>
                  </div>
                  <div style={{ fontSize: 12, color: MP.mute, fontVariantNumeric: 'tabular-nums' }}>{s.time}m</div>
                  <StatusChip kind={s.missing.length === 0 ? 'cook' : 'shop'} />
                  <button style={{
                    background: MP.ink, color: MP.paper, border: 'none',
                    borderRadius: 8, padding: '8px 12px',
                    fontFamily: MP_FONT.sans, fontSize: 12, fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  }}>pick day <span style={{ fontFamily: MP_FONT.serif, fontStyle:'italic' }}>→</span></button>
                </div>
              ))}
            </div>
          </section>

          {/* Auto-shop preview — next shop in the horizon */}
          <section style={{
            background: MP.ink, color: MP.paper, borderRadius: 14,
            padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div>
              <div style={{
                fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 700,
                color: MP.persimmon, letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>next shop · queued</div>
              <div style={{
                fontFamily: MP_FONT.serif, fontStyle: 'italic',
                fontSize: 34, lineHeight: 1.05, marginTop: 4,
              }}>Wednesday<span style={{ color: MP.persimmon }}>,</span> 4:30 pm</div>
              <div style={{ fontSize: 13, color: `${MP.paper}b3`, marginTop: 2 }}>whole foods · brooklyn</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['for wed roast',    'whole chicken, thyme, dijon, fennel, lemons', 5],
                ['for fri pizza',    'mozzarella, italian sausage, 00 flour',       3],
                ['weekly staples',   'butter, milk, eggs, olives, anchovies',       5],
              ].map(([reason, items, n], i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto',
                  gap: 12, alignItems: 'baseline', padding: '8px 0',
                  borderTop: i === 0 ? 'none' : `1px solid ${MP.paper}1f`,
                }}>
                  <div>
                    <div style={{
                      fontFamily: MP_FONT.serif, fontStyle: 'italic',
                      fontSize: 14, color: `${MP.paper}cc`,
                    }}>{reason}</div>
                    <div style={{ fontSize: 12, color: `${MP.paper}99`, marginTop: 2 }}>{items}</div>
                  </div>
                  <div style={{
                    fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                  }}>{n}</div>
                </div>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            <button style={{
              background: MP.persimmon, color: MP.paper, border: 'none',
              borderRadius: 10, padding: '13px 16px',
              fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span>review &amp; send to whole foods</span>
              <span style={{ fontFamily: MP_FONT.serif, fontStyle: 'italic', fontSize: 17 }}>→</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

window.MealPlan = MealPlan;
