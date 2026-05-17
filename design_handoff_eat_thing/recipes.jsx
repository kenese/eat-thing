// Recipes page — image-led layout.
// Crisp + Persimmon, Schibsted Grotesk + Lora italic.
// Hero image, image-top cards, editorial "recipe of the week" portrait.
// Inventory match (can-cook / quick shop / library) is the dominant read on
// every card. Images are <image-slot>s — drop your own photos in.

const RX = {
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
};

const RX_FONT = {
  sans:  '"Schibsted Grotesk", system-ui, sans-serif',
  serif: '"Lora", serif',
};

const RECIPES = [
  { id:'r1',  name:'Cacio e pepe',                             servings:2, ingredientCount:4,  time:20, tags:['pasta','pantry'],     missing:[] },
  { id:'r2',  name:'Buttermilk biscuits with cilantro butter', servings:6, ingredientCount:7,  time:40, tags:['baking','use-up'],    missing:[], featured:true, hint:'uses buttermilk · cilantro · butter' },
  { id:'r3',  name:'Charred broccoli & lentils',               servings:4, ingredientCount:9,  time:35, tags:['veg','one-pan'],      missing:[] },
  { id:'r4',  name:'Saturday omelette, soft herbs',            servings:2, ingredientCount:6,  time:15, tags:['eggs','quick'],       missing:[] },
  { id:'r5',  name:'Spaghetti aglio e olio',                   servings:2, ingredientCount:5,  time:18, tags:['pasta','pantry'],     missing:[] },

  { id:'r6',  name:'Roast chicken, lemon, fennel',             servings:4, ingredientCount:10, time:90, tags:['sunday','roast'],     missing:['whole chicken','thyme','dijon'] },
  { id:'r7',  name:'Pizza, sausage & honey',                   servings:4, ingredientCount:11, time:60, tags:['friday','dough'],     missing:['mozzarella','italian sausage'] },
  { id:'r8',  name:'Shakshuka',                                servings:2, ingredientCount:9,  time:30, tags:['eggs','one-pan'],     missing:['canned tomatoes','feta'] },

  { id:'r9',  name:'Khao soi',                                 servings:4, ingredientCount:14, time:60, tags:['thai','noodle'],      missing:['coconut milk','curry paste','egg noodles','lime leaves','bean sprouts','shallots','soy'] },
  { id:'r10', name:'Beef ragu, pappardelle',                   servings:6, ingredientCount:13, time:180,tags:['italian','braise'],  missing:['chuck roast','pappardelle','tomato paste','red wine','pancetta'] },
  { id:'r11', name:'Lamb shanks, gremolata',                   servings:4, ingredientCount:12, time:210,tags:['braise','sunday'],   missing:['lamb shanks','red wine','tomato paste','rosemary'] },
  { id:'r12', name:'Banh mi, lemongrass pork',                 servings:4, ingredientCount:15, time:75, tags:['vietnamese'],         missing:['pork shoulder','lemongrass','baguettes','daikon','pickled carrot','fish sauce','pâté'] },
];

const cookable  = RECIPES.filter(r => r.missing.length === 0);
const shoppable = RECIPES.filter(r => r.missing.length > 0 && r.missing.length <= 3);
const library   = RECIPES.filter(r => r.missing.length > 3);

// <image-slot> drop-target. id MUST be unique to persist a drop.
function Slot({ id, w, h, radius = 12, placeholder = 'Drop a photo', style }) {
  return (
    <image-slot
      id={id}
      shape="rounded"
      radius={radius}
      placeholder={placeholder}
      style={{ width: w, height: h, display: 'block', background: RX.cream, ...style }}
    />
  );
}

function RxHeader() {
  return (
    <header style={{
      background: RX.ink, color: RX.paper,
      padding: '14px 36px',
      display: 'flex', alignItems: 'center', gap: 24,
    }}>
      <div style={{
        fontFamily: RX_FONT.sans, fontSize: 22, fontWeight: 800,
        letterSpacing: '-0.02em', display: 'flex', alignItems: 'baseline',
        whiteSpace: 'nowrap',
      }}>
        Eat<span style={{
          color: RX.persimmon,
          fontFamily: RX_FONT.serif, fontStyle: 'italic',
          fontWeight: 400, fontSize: 28, marginLeft: 4,
        }}>thing</span>
      </div>
      <div style={{ flex: 1, display: 'flex', gap: 22, justifyContent: 'center' }}>
        {[['home',false],['inventory',false],['recipes',true],['plan',false],['list',false],['shops',false]].map(([t,active]) => (
          <div key={t} style={{
            fontSize: 13, fontWeight: 600,
            color: active ? RX.paper : `${RX.paper}99`,
            borderBottom: active ? `2px solid ${RX.persimmon}` : 'none',
            paddingBottom: 3, letterSpacing: '0.01em',
          }}>{t}</div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>mon · may 11</div>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: RX.persimmon, color: RX.paper,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13,
        }}>M</div>
      </div>
    </header>
  );
}

function StatusBadge({ missing }) {
  const isCook = missing === 0;
  const isShop = missing > 0 && missing <= 3;
  const bg = isCook ? RX.fresh : isShop ? RX.persimmon : RX.ink;
  const label = isCook ? 'cook now' : isShop ? `missing ${missing}` : `missing ${missing}`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 9px', borderRadius: 999,
      background: bg, color: RX.paper,
      fontFamily: RX_FONT.sans, fontSize: 10, fontWeight: 700,
      letterSpacing: '0.1em', textTransform: 'uppercase',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: RX.paper, opacity: 0.9 }} />
      {label}
    </span>
  );
}

// Image-top card. variant: 'default' | 'dense' | 'tall'
function RecipeCard({ r, variant = 'default' }) {
  const missing = r.missing.length;
  const dense = variant === 'dense';
  const tall  = variant === 'tall';

  const imageH = tall ? 320 : dense ? 120 : 180;

  return (
    <div style={{
      background: RX.paper, border: `1px solid ${RX.rule}`,
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative' }}>
        <Slot
          id={`rx-${r.id}`}
          w="100%"
          h={imageH}
          radius={0}
          placeholder={`drop ${r.name.toLowerCase()} photo`}
        />
        <div style={{ position: 'absolute', top: 10, left: 10 }}>
          <StatusBadge missing={missing} />
        </div>
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          padding: '4px 9px', borderRadius: 999,
          background: 'rgba(13,23,20,0.78)', color: RX.paper,
          backdropFilter: 'blur(8px)',
          fontFamily: RX_FONT.sans, fontSize: 11, fontWeight: 600,
          letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums',
        }}>{r.time} min · serves {r.servings}</div>
      </div>

      <div style={{
        padding: dense ? '12px 14px 14px' : '14px 16px 16px',
        display: 'flex', flexDirection: 'column', gap: 8, flex: 1,
      }}>
        <div style={{
          fontFamily: RX_FONT.sans,
          fontSize: dense ? 15 : tall ? 22 : 18,
          fontWeight: 600,
          letterSpacing: '-0.012em', color: RX.ink, lineHeight: 1.2,
        }}>{r.name}</div>

        {!dense && r.missing.length > 0 && (
          <div style={{
            fontFamily: RX_FONT.serif, fontStyle: 'italic',
            fontSize: 13, color: RX.ink3, lineHeight: 1.35,
          }}>
            need {r.missing.slice(0, 2).join(', ')}{r.missing.length > 2 ? ` & ${r.missing.length - 2} more` : ''}
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: RX_FONT.sans, fontSize: 11, color: RX.mute,
        }}>
          <span>{r.ingredientCount} ingr</span>
          <span style={{ flex: 1 }} />
          {r.tags.slice(0, 2).map(t => (
            <span key={t} style={{
              padding: '2px 8px', borderRadius: 999,
              background: RX.cream, color: RX.ink2,
              fontSize: 10, fontWeight: 600, letterSpacing: '0.02em',
            }}>{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ title, count, accent, hint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', gap: 12,
      marginBottom: 14, marginTop: 4,
    }}>
      <span style={{
        fontFamily: RX_FONT.serif, fontStyle: 'italic',
        fontSize: 28, lineHeight: 1, color: RX.ink,
      }}>{title}<span style={{ color: accent }}>.</span></span>
      <span style={{
        fontFamily: RX_FONT.sans, fontSize: 11, fontWeight: 600,
        color: RX.mute, letterSpacing: '0.12em', textTransform: 'uppercase',
      }}>{count} {count === 1 ? 'recipe' : 'recipes'}</span>
      <span style={{ flex: 1 }} />
      <span style={{ fontFamily: RX_FONT.sans, fontSize: 12, color: RX.ink2 }}>{hint}</span>
    </div>
  );
}

// Big editorial hero — image on right, copy on left, persimmon CTA.
function FeaturedHero({ r }) {
  return (
    <div style={{
      borderRadius: 18, overflow: 'hidden',
      display: 'grid', gridTemplateColumns: '1fr 1.1fr',
      background: RX.ink, color: RX.paper, minHeight: 380,
    }}>
      <div style={{
        padding: '32px 36px 32px', display: 'flex',
        flexDirection: 'column', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(217,110,46,0.18)', color: RX.persimmon,
            padding: '5px 10px', borderRadius: 999,
            fontFamily: RX_FONT.sans, fontSize: 11, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase',
            marginBottom: 18,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: RX.persimmon }} />
            cook tonight · uses 3 expiring
          </div>
          <div style={{
            fontFamily: RX_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 0.98, fontWeight: 400,
            letterSpacing: '-0.015em', maxWidth: 480,
          }}>{r.name}<span style={{ color: RX.persimmon }}>.</span></div>
          <div style={{
            fontFamily: RX_FONT.sans, fontSize: 14,
            color: `${RX.paper}c0`, marginTop: 14, maxWidth: 440, lineHeight: 1.45,
          }}>
            Tender, tangy, and ready in {r.time} minutes. Pulls{' '}
            <em style={{ fontFamily: RX_FONT.serif, color: RX.paper }}>buttermilk</em>,{' '}
            <em style={{ fontFamily: RX_FONT.serif, color: RX.paper }}>cilantro</em>, and{' '}
            <em style={{ fontFamily: RX_FONT.serif, color: RX.paper }}>cultured butter</em>{' '}
            from the fridge — three things you'd otherwise throw out by Wednesday.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 22 }}>
          <button style={{
            background: RX.persimmon, color: RX.paper, border: 'none',
            borderRadius: 10, padding: '13px 18px',
            fontFamily: RX_FONT.sans, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            whiteSpace: 'nowrap',
          }}>open recipe <span style={{ fontFamily: RX_FONT.serif, fontStyle:'italic', fontSize: 17 }}>→</span></button>
          <button style={{
            background: 'transparent', color: RX.paper,
            border: `1px solid ${RX.paper}40`, borderRadius: 10,
            padding: '13px 16px',
            fontFamily: RX_FONT.sans, fontSize: 13, fontWeight: 600,
            cursor: 'pointer',
          }}>add to wednesday</button>
          <div style={{
            fontFamily: RX_FONT.sans, fontSize: 11,
            color: `${RX.paper}80`, letterSpacing: '0.04em',
          }}>{r.time} min · serves {r.servings} · {r.ingredientCount} ingredients</div>
        </div>
      </div>

      <Slot
        id="rx-hero"
        w="100%"
        h="100%"
        radius={0}
        placeholder="drop buttermilk biscuits photo"
        style={{ background: '#1a2520' }}
      />
    </div>
  );
}

// Tall editorial side card for "recipe of the week"
function PortraitFeature({ r }) {
  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      background: RX.paper, border: `1px solid ${RX.rule}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ position: 'relative' }}>
        <Slot id="rx-portrait" w="100%" h={260} radius={0} placeholder="drop omelette photo" />
        <div style={{
          position: 'absolute', top: 10, left: 10,
          fontFamily: RX_FONT.sans, fontSize: 10, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          padding: '4px 9px', borderRadius: 999,
          background: 'rgba(255,255,255,0.92)', color: RX.persimDeep,
        }}>editor's pick</div>
      </div>
      <div style={{ padding: '18px 18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{
          fontFamily: RX_FONT.serif, fontStyle: 'italic',
          fontSize: 24, lineHeight: 1.1, color: RX.ink,
        }}>{r.name}<span style={{ color: RX.persimmon }}>.</span></div>
        <div style={{ fontSize: 13, color: RX.ink2, lineHeight: 1.45 }}>
          Soft, custardy, three minutes from pan to plate. The Saturday lunch you'll keep coming back to.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <StatusBadge missing={0} />
          <span style={{ fontSize: 11, color: RX.mute }}>{r.time} min · serves {r.servings}</span>
        </div>
      </div>
    </div>
  );
}

function Recipes() {
  const featured = RECIPES.find(r => r.featured);
  const portrait = RECIPES.find(r => r.id === 'r4'); // Omelette
  const cookGrid = cookable.filter(r => !r.featured && r.id !== 'r4');

  return (
    <div style={{
      width: '100%', height: '100%', overflow: 'hidden',
      background: RX.paper, color: RX.ink,
      fontFamily: RX_FONT.sans, fontSize: 14, lineHeight: 1.4,
      display: 'flex', flexDirection: 'column',
    }}>
      <RxHeader />

      {/* Title row */}
      <div style={{
        padding: '24px 36px 16px',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24,
      }}>
        <div>
          <div style={{
            fontFamily: RX_FONT.sans, fontSize: 11, color: RX.mute,
            letterSpacing: '0.14em', textTransform: 'uppercase', fontWeight: 600,
          }}>monday · may 11</div>
          <div style={{
            fontFamily: RX_FONT.serif, fontStyle: 'italic',
            fontSize: 56, lineHeight: 1, fontWeight: 400, letterSpacing: '-0.02em',
            marginTop: 6,
          }}>Recipes<span style={{ color: RX.persimmon }}>.</span></div>
          <div style={{ fontSize: 14, color: RX.ink2, marginTop: 8 }}>
            <span style={{ fontWeight: 600, color: RX.ink }}>{cookable.length} cookable</span> with what you have ·{' '}
            <span style={{ fontWeight: 600, color: RX.persimDeep }}>{shoppable.length} a quick shop away</span> ·{' '}
            <span style={{ fontFamily: RX_FONT.serif, fontStyle: 'italic', fontSize: 16 }}>{RECIPES.length} in the library</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={{
            background: 'transparent', color: RX.ink2,
            border: `1px solid ${RX.rule}`, borderRadius: 8,
            padding: '10px 14px', fontFamily: RX_FONT.sans,
            fontSize: 13, fontWeight: 500, cursor: 'pointer',
          }}>↓ Import</button>
          <button style={{
            background: RX.persimmon, color: RX.paper, border: 'none',
            borderRadius: 8, padding: '10px 16px',
            fontFamily: RX_FONT.sans, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          }}><span style={{ fontSize: 16, lineHeight: 1 }}>+</span> new recipe</button>
        </div>
      </div>

      {/* Filter strip */}
      <div style={{
        padding: '14px 36px',
        borderTop: `1px solid ${RX.rule}`,
        borderBottom: `1px solid ${RX.rule}`,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            ['all', 'All', RECIPES.length],
            ['cookable', 'Cook now', cookable.length, RX.fresh],
            ['shoppable', 'Quick shop', shoppable.length, RX.persimmon],
            ['library', 'Library', library.length],
          ].map(([k, label, n, dot], i) => (
            <div key={k} style={{
              padding: '7px 12px', borderRadius: 999,
              background: i === 0 ? RX.ink : 'transparent',
              color: i === 0 ? RX.paper : RX.ink2,
              fontSize: 13, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 8,
              border: i === 0 ? 'none' : `1px solid ${RX.rule}`,
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
            border: `1px solid ${RX.rule}`, borderRadius: 8,
            background: RX.paper, color: RX.ink,
            fontFamily: RX_FONT.sans, fontSize: 13, outline: 'none',
          }} placeholder="Search recipes, ingredients, tags…" defaultValue="" />
          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: RX.mute, fontSize: 13 }}>⌕</div>
        </div>
        <div style={{
          fontFamily: RX_FONT.sans, fontSize: 12, color: RX.ink2,
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 10px', border: `1px solid ${RX.rule}`, borderRadius: 8,
        }}>
          <span>sort</span><span style={{ fontWeight: 600 }}>cookable first</span>
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '24px 36px 36px' }}>
        {/* Editorial hero + portrait side-by-side */}
        {featured && (
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr',
            gap: 16, marginBottom: 32,
          }}>
            <FeaturedHero r={featured} />
            <PortraitFeature r={portrait} />
          </div>
        )}

        <SectionHeader
          title="Cook tonight"
          count={cookable.length}
          accent={RX.fresh}
          hint="0 missing · uses what's on hand"
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginBottom: 36,
        }}>
          {cookGrid.map(r => <RecipeCard key={r.id} r={r} />)}
        </div>

        <SectionHeader
          title="One quick shop"
          count={shoppable.length}
          accent={RX.persimmon}
          hint="1–3 items away · auto-added to wednesday's list"
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16, marginBottom: 36,
        }}>
          {shoppable.map(r => <RecipeCard key={r.id} r={r} />)}
        </div>

        <SectionHeader
          title="The library"
          count={library.length}
          accent={RX.green}
          hint="all recipes"
        />
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14, marginBottom: 16,
        }}>
          {library.map(r => <RecipeCard key={r.id} r={r} variant="dense" />)}
        </div>
      </div>
    </div>
  );
}

window.Recipes = Recipes;
