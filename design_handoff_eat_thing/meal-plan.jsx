// Meal Plan page — weekly grid. Crisp + Persimmon system.
// The plan sits between Inventory (what you have) and Recipes (what you
// could cook) → it's where decisions get committed for the week.
//
// Read priority:
//  1. Per-day card: meal name, can-cook status, "uses N expiring" hint
//  2. Week summary strip: pantry-only days vs shop-needed days, $ estimate
//  3. Slot ideas / quick-fill suggestions from Recipes inventory match
//  4. Open seats — empty days you can drag a recipe onto

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

// "today" + 6 days. Per slot: meal + missing[] for inventory-match logic.
const WEEK = [
  { day:'Mon', date:'May 11', label:'today',    meal:{ slotId:'rx-r1', name:'Cacio e pepe',                   time:20, servings:2, missing:[],         tags:['pantry','pasta'] } },
  { day:'Tue', date:'May 12', label:'tomorrow', meal:{ slotId:'rx-r3', name:'Charred broccoli & lentils',     time:35, servings:4, missing:[],         tags:['veg','one-pan'] } },
  { day:'Wed', date:'May 13', label:'',         meal:{ slotId:'rx-r6', name:'Roast chicken, lemon, fennel',   time:90, servings:4, missing:['whole chicken','thyme','dijon'], tags:['sunday','roast'] }, shopDay:true },
  { day:'Thu', date:'May 14', label:'',         meal:{ slotId:'mp-leftover', name:'Chicken stock noodles',    time:25, servings:3, missing:[],         tags:['leftover','quick'] }, leftover:true },
  { day:'Fri', date:'May 15', label:'',         meal:{ slotId:'rx-r7', name:'Pizza, sausage & honey',         time:60, servings:4, missing:['mozzarella','italian sausage'], tags:['friday','dough'] } },
  { day:'Sat', date:'May 16', label:'',         meal:{ slotId:'rx-r4', name:'Saturday omelette, soft herbs',  time:15, servings:2, missing:[],         tags:['eggs','quick'] } },
  { day:'Sun', date:'May 17', label:'',         meal:null }, // open seat
];

const SUGGEST = [
  { id:'r5',  name:'Spaghetti aglio e olio',          time:18, missing:[],                 hint:'all pantry' },
  { id:'r8',  name:'Shakshuka',                       time:30, missing:['canned tomatoes','feta'], hint:'add to wed shop' },
  { id:'r2',  name:'Buttermilk biscuits + cilantro',  time:40, missing:[],                 hint:'uses 3 expiring' },
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

function StatusChip({ kind }) {
  // kind: 'cook' | 'shop' | 'leftover' | 'open'
  const styles = {
    cook:     { bg: MP.fresh,     fg: MP.paper, label: 'cook now' },
    shop:     { bg: MP.persimmon, fg: MP.paper, label: 'needs shop' },
    leftover: { bg: MP.ink,       fg: MP.paper, label: 'leftover' },
    open:     { bg: 'transparent',fg: MP.mute,  label: 'open seat', border: true },
  }[kind];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 8px', borderRadius: 999,
      background: styles.bg, color: styles.fg,
      border: styles.border ? `1px dashed ${MP.mute}` : 'none',
      fontFamily: MP_FONT.sans, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      {!styles.border && <span style={{ width: 4, height: 4, borderRadius: '50%', background: styles.fg, opacity: 0.9 }} />}
      {styles.label}
    </span>
  );
}

function DayCard({ d, isToday }) {
  const m = d.meal;
  const kind = !m ? 'open' : d.leftover ? 'leftover' : m.missing.length === 0 ? 'cook' : 'shop';

  return (
    <div style={{
      background: isToday ? MP.ink : MP.paper,
      color: isToday ? MP.paper : MP.ink,
      border: isToday ? 'none' : `1px solid ${MP.rule}`,
      borderRadius: 12, padding: '14px 14px 14px',
      display: 'flex', flexDirection: 'column', gap: 10,
      minHeight: 200, position: 'relative',
    }}>
      {/* day header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      }}>
        <div style={{
          fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: isToday ? MP.persimmon : MP.mute,
        }}>{d.day} · {d.date.split(' ')[1]}</div>
        {d.label && (
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 12, color: isToday ? `${MP.paper}99` : MP.ink3,
          }}>{d.label}</div>
        )}
      </div>

      {!m ? (
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
          <div style={{ fontSize: 11, marginTop: 6 }}>drop a recipe</div>
        </div>
      ) : (
        <>
          {/* image */}
          <image-slot
            id={m.slotId}
            shape="rounded"
            radius={8}
            placeholder={`drop ${m.name.split(',')[0].toLowerCase()}`}
            style={{
              width: '100%', height: 96, display: 'block',
              background: isToday ? '#1a2520' : MP.cream,
            }}
          />
          <div style={{
            fontFamily: MP_FONT.sans, fontSize: 18, fontWeight: 600,
            letterSpacing: '-0.012em', lineHeight: 1.18,
            color: isToday ? MP.paper : MP.ink,
          }}>{m.name}</div>

          {m.missing.length > 0 && (
            <div style={{
              fontFamily: MP_FONT.serif, fontStyle: 'italic',
              fontSize: 13, lineHeight: 1.35,
              color: isToday ? `${MP.paper}b3` : MP.ink3,
            }}>
              need {m.missing.slice(0, 2).join(', ')}{m.missing.length > 2 ? ` & ${m.missing.length - 2} more` : ''}
            </div>
          )}

          <div style={{ flex: 1 }} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: MP_FONT.sans, fontSize: 11,
            color: isToday ? `${MP.paper}b3` : MP.mute,
          }}>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{m.time}m</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>serves {m.servings}</span>
          </div>

          <div>
            <StatusChip kind={kind} />
          </div>
        </>
      )}
    </div>
  );
}

function MealPlan() {
  const pantryDays   = WEEK.filter(d => d.meal && d.meal.missing.length === 0 && !d.leftover).length;
  const leftoverDays = WEEK.filter(d => d.leftover).length;
  const shopDays     = WEEK.filter(d => d.meal && d.meal.missing.length > 0).length;
  const openDays     = WEEK.filter(d => !d.meal).length;
  const todayIdx     = 0;

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: MP.paper, color: MP.ink,
      fontFamily: MP_FONT.sans, fontSize: 14, lineHeight: 1.4,
      display: 'flex', flexDirection: 'column',
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
          }}>week 19 · 11 – 17 may</div>
          <div style={{
            fontFamily: MP_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em',
            marginTop: 6,
          }}>This week<span style={{ color: MP.persimmon }}>.</span></div>
          <div style={{ fontSize: 14, color: MP.ink2, marginTop: 8 }}>
            <span style={{ fontWeight: 600, color: MP.ink }}>{pantryDays} from the pantry</span> ·{' '}
            <span style={{ fontWeight: 600, color: MP.persimDeep }}>{shopDays} need a shop</span> ·{' '}
            <span style={{ fontFamily: MP_FONT.serif, fontStyle: 'italic', fontSize: 16 }}>{openDays} open seat</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            background: 'transparent', color: MP.ink2,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: MP_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>← last week</button>
          <button style={{
            background: 'transparent', color: MP.ink2,
            border: `1px solid ${MP.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: MP_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>next week →</button>
          <button style={{
            background: MP.persimmon, color: MP.paper, border: 'none',
            borderRadius: 8, padding: '10px 16px',
            fontFamily: MP_FONT.sans, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}>regenerate list <span style={{ fontFamily: MP_FONT.serif, fontStyle:'italic', fontSize: 16 }}>→</span></button>
        </div>
      </div>

      {/* Summary strip — proportions of pantry / leftover / shop / open */}
      <div style={{
        padding: '14px 36px 18px',
        borderTop: `1px solid ${MP.rule}`,
        borderBottom: `1px solid ${MP.rule}`,
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <div style={{
          flex: 1, height: 8, borderRadius: 999,
          background: MP.cream, overflow: 'hidden',
          display: 'flex',
        }}>
          <div style={{ flex: pantryDays,   background: MP.fresh }} />
          <div style={{ flex: leftoverDays, background: MP.ink }} />
          <div style={{ flex: shopDays,     background: MP.persimmon }} />
          <div style={{ flex: openDays,     background: 'transparent' }} />
        </div>
        <div style={{ display: 'flex', gap: 18, fontFamily: MP_FONT.sans, fontSize: 12 }}>
          {[
            ['cook now',  pantryDays,   MP.fresh],
            ['leftover',  leftoverDays, MP.ink],
            ['needs shop',shopDays,     MP.persimmon],
            ['open',      openDays,     MP.mute, true],
          ].map(([label, n, c, dashed], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: dashed ? 'transparent' : c,
                border: dashed ? `1.5px dashed ${c}` : 'none',
              }} />
              <span style={{ color: MP.ink2 }}>{label}</span>
              <span style={{ color: MP.mute, fontVariantNumeric: 'tabular-nums' }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{
          paddingLeft: 18, borderLeft: `1px solid ${MP.rule}`,
          fontFamily: MP_FONT.sans, fontSize: 12, color: MP.ink2,
        }}>
          <div style={{ fontSize: 11, color: MP.mute, letterSpacing: '0.06em', textTransform: 'uppercase' }}>wed shop</div>
          <div><span style={{ fontFamily: MP_FONT.serif, fontStyle: 'italic', fontSize: 16, color: MP.persimDeep }}>$48.20</span> · 13 items</div>
        </div>
      </div>

      {/* Scrollable plan */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 36px 32px' }}>
        {/* The week — 7 cards */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          gap: 12, marginBottom: 32,
        }}>
          {WEEK.map((d, i) => (
            <DayCard key={d.day} d={d} isToday={i === todayIdx} />
          ))}
        </div>

        {/* Lower row: suggestions + shop preview */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1.4fr 1fr',
          gap: 20,
        }}>
          {/* Slot ideas for sunday's open seat */}
          <section style={{
            background: MP.paper, border: `1px solid ${MP.rule}`,
            borderRadius: 14, padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 14 }}>
              <span style={{
                fontFamily: MP_FONT.serif, fontStyle: 'italic',
                fontSize: 24, lineHeight: 1, color: MP.ink,
              }}>Fill Sunday<span style={{ color: MP.persimmon }}>.</span></span>
              <span style={{
                fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 600,
                color: MP.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
              }}>three picks</span>
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
                  }}>place in sun <span style={{ fontFamily: MP_FONT.serif, fontStyle:'italic' }}>→</span></button>
                </div>
              ))}
            </div>
          </section>

          {/* Auto-shop preview */}
          <section style={{
            background: MP.ink, color: MP.paper, borderRadius: 14,
            padding: '20px 22px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>
            <div>
              <div style={{
                fontFamily: MP_FONT.sans, fontSize: 11, fontWeight: 700,
                color: MP.persimmon, letterSpacing: '0.14em', textTransform: 'uppercase',
              }}>auto-shop · queued</div>
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
