import { useState, useCallback, useEffect, useRef } from "react";

const C = {
  bg0:'#06060F', bg1:'#0C0C1A', bg2:'#111122', bg3:'#181830', bg4:'#1F1F38',
  b1:'rgba(255,255,255,0.06)', b2:'rgba(255,255,255,0.10)', b3:'rgba(255,255,255,0.16)',
  gold:'#E9A832', goldF:'rgba(233,168,50,0.10)', goldB:'rgba(233,168,50,0.22)',
  teal:'#0FD4B8', tealF:'rgba(15,212,184,0.10)',
  purple:'#9880F5', purpleF:'rgba(152,128,245,0.10)',
  green:'#22D57A', greenF:'rgba(34,213,122,0.10)',
  red:'#F06464',
  t1:'#EEECEA', t2:'#8A8899', t3:'#4E4D60',
};
const Fd = "'Syne',system-ui,sans-serif";
const Fb = "'Plus Jakarta Sans',system-ui,sans-serif";

// ─── Initial habit data ───────────────────────────────────────────
const initHabits = () => [
  { id:'faith', label:'Faith & Spirit', icon:'🕌', color:C.purple, faint:C.purpleF,
    habits:[
      { id:'fajr',   label:'Fajr Prayer',      note:'5:10 AM',      done:false },
      { id:'dhuhr',  label:'Dhuhr Prayer',      note:'12:30 PM',     done:false },
      { id:'asr',    label:'Asr Prayer',        note:'3:45 PM',      done:false },
      { id:'maghrib',label:'Maghrib Prayer',    note:'Sunset',       done:false },
      { id:'isha',   label:'Isha Prayer',       note:'Night',        done:false },
      { id:'quran',  label:'Read Quran',        note:'30 min',       done:false },
      { id:'mulk',   label:'Surah Al-Mulk',     note:'Before sleep', done:false },
    ]},
  { id:'study', label:'Mind & Study', icon:'📚', color:C.teal, faint:C.tealF,
    habits:[
      { id:'am',    label:'Morning Study Block', note:'9–11 AM',    done:false },
      { id:'pm',    label:'Afternoon Session',   note:'2–5 PM',     done:false },
      { id:'night', label:'Night Review',        note:'8–9 PM',     done:false },
      { id:'read',  label:'Read 20 Pages',       note:'Non-textbook',done:false },
    ]},
  { id:'body', label:'Body & Health', icon:'💪', color:C.green, faint:C.greenF,
    habits:[
      { id:'workout', label:'Workout',           note:'4×/week',    done:false },
      { id:'water',   label:'Drink 2L Water',    note:'Daily',      done:false },
      { id:'sleep',   label:'Sleep by 11 PM',    note:'7–8 hrs',    done:false },
      { id:'skin',    label:'Skincare Routine',  note:'AM + PM',    done:false },
    ]},
  { id:'life', label:'Life & Discipline', icon:'✅', color:C.gold, faint:C.goldF,
    habits:[
      { id:'shower', label:'Cold Shower',        note:'Morning',    done:false },
      { id:'clean',  label:'Clean Space',        note:'Daily',      done:false },
      { id:'plan',   label:'Plan Tomorrow',      note:'Before sleep',done:false },
      { id:'hydrate',label:'No Phone First 30m', note:'After waking',done:false },
    ]},
];

// ─── Ring ─────────────────────────────────────────────────────────
function Ring({ pct, size=110, sw=10, color=C.gold }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={sw}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={c} strokeDashoffset={c*(1-pct/100)} strokeLinecap="round"
        style={{ transition:'stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1), stroke 0.4s' }}/>
    </svg>
  );
}

// ─── TODAY ────────────────────────────────────────────────────────
function TodayScreen({ cats, onToggle }) {
  const [expandedCat, setExpandedCat] = useState(null);
  const all = cats.flatMap(c => c.habits);
  const done = all.filter(h => h.done).length;
  const pct = Math.round(done / all.length * 100);
  const ringColor = pct >= 80 ? C.gold : pct >= 50 ? C.teal : C.purple;

  const today = new Date().toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const msg = pct === 100 ? '🔱 Flawless. You are elite.'
    : pct >= 80 ? '🔥 Excellent discipline today.'
    : pct >= 50 ? '⚡ Strong effort. Keep pushing.'
    : '🌅 Rise. Your discipline is waiting.';

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'0 16px 100px' }}>
      {/* Header */}
      <div style={{ padding:'16px 0 14px' }}>
        <div style={{ fontFamily:Fb, fontSize:11, color:C.t3, letterSpacing:'0.06em',
          textTransform:'uppercase', marginBottom:4 }}>{today}</div>
        <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1 }}>
          {greeting}, Ahmad
        </div>
      </div>

      {/* Score Card */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b2}`, borderRadius:22,
        padding:18, marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
        <div style={{ position:'relative', flexShrink:0 }}>
          <Ring pct={pct} size={110} sw={9} color={ringColor}/>
          <div style={{ position:'absolute', inset:0, display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontFamily:Fd, fontSize:28, fontWeight:800, color:ringColor, lineHeight:1 }}>{pct}%</div>
            <div style={{ fontFamily:Fb, fontSize:10, color:C.t3, marginTop:2 }}>done</div>
          </div>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontFamily:Fd, fontSize:15, fontWeight:700, color:C.t1, marginBottom:4 }}>
            Discipline Score
          </div>
          <div style={{ fontFamily:Fb, fontSize:12.5, color:C.t2, lineHeight:1.55, marginBottom:12 }}>{msg}</div>
          <div style={{ display:'inline-flex', alignItems:'center', gap:6,
            background:C.goldF, border:`1px solid ${C.goldB}`, padding:'5px 12px', borderRadius:20 }}>
            <span style={{ fontSize:14 }}>🔥</span>
            <span style={{ fontFamily:Fb, fontSize:12, fontWeight:700, color:C.gold }}>14 Day Streak</span>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
        {[
          { label:'Done', val:`${done}/${all.length}`, color:ringColor },
          { label:'Streak', val:'14d', color:C.gold },
          { label:'Best', val:'21d', color:C.purple },
        ].map(s => (
          <div key={s.label} style={{ background:C.bg3, border:`1px solid ${C.b1}`,
            borderRadius:14, padding:'12px 10px', textAlign:'center' }}>
            <div style={{ fontFamily:Fd, fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
            <div style={{ fontFamily:Fb, fontSize:10.5, color:C.t3, marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Habit categories */}
      <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
        letterSpacing:'0.10em', textTransform:'uppercase', marginBottom:10 }}>
        Today's Checklist
      </div>

      {cats.map(cat => {
        const catDone = cat.habits.filter(h => h.done).length;
        const isOpen = expandedCat === cat.id;
        return (
          <div key={cat.id} style={{ background:C.bg2, border:`1px solid ${C.b1}`,
            borderRadius:18, marginBottom:10, overflow:'hidden' }}>
            {/* Category header */}
            <div onClick={() => setExpandedCat(isOpen ? null : cat.id)}
              style={{ display:'flex', alignItems:'center', gap:10,
                padding:'14px 16px', cursor:'pointer' }}>
              <span style={{ fontSize:18 }}>{cat.icon}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:Fb, fontSize:12.5, fontWeight:700, color:cat.color,
                  letterSpacing:'0.04em', textTransform:'uppercase' }}>{cat.label}</div>
              </div>
              {/* Mini progress */}
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:48, height:4, background:C.b1, borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', borderRadius:2, background:cat.color,
                    width:`${catDone/cat.habits.length*100}%`, transition:'width 0.4s' }}/>
                </div>
                <span style={{ fontFamily:Fb, fontSize:11, color:catDone===cat.habits.length?cat.color:C.t3,
                  fontWeight:600, minWidth:28 }}>{catDone}/{cat.habits.length}</span>
                <span style={{ color:C.t3, fontSize:12, transform:`rotate(${isOpen?90:0}deg)`,
                  transition:'transform 0.2s', display:'inline-block' }}>›</span>
              </div>
            </div>

            {/* Habits list */}
            {isOpen && (
              <div style={{ borderTop:`1px solid ${C.b1}` }}>
                {cat.habits.map((h, i) => (
                  <div key={h.id} onClick={() => onToggle(cat.id, h.id)}
                    style={{ display:'flex', alignItems:'center', gap:12,
                      padding:'13px 16px', cursor:'pointer',
                      borderBottom: i < cat.habits.length-1 ? `1px solid ${C.b1}` : 'none',
                      background: h.done ? `${cat.color}08` : 'transparent',
                      transition:'background 0.18s' }}>
                    {/* Checkbox */}
                    <div style={{ width:24, height:24, borderRadius:8, flexShrink:0,
                      border: h.done ? 'none' : `1.5px solid ${C.b3}`,
                      background: h.done ? cat.color : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.18s' }}>
                      {h.done && (
                        <svg width="12" height="9" viewBox="0 0 12 9">
                          <path d="M1 4.5 4.5 8 11 1" fill="none" stroke={C.bg0}
                            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:Fb, fontSize:14, fontWeight:500,
                        color: h.done ? C.t3 : C.t1,
                        textDecoration: h.done ? 'line-through' : 'none',
                        transition:'all 0.18s' }}>{h.label}</div>
                      {h.note && <div style={{ fontFamily:Fb, fontSize:11, color:C.t3, marginTop:1 }}>{h.note}</div>}
                    </div>
                    {h.done && <span style={{ fontSize:16 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Collapsed preview */}
            {!isOpen && catDone > 0 && (
              <div style={{ padding:'0 16px 12px', display:'flex', gap:5 }}>
                {cat.habits.slice(0,6).map(h => (
                  <div key={h.id} style={{ width:8, height:8, borderRadius:4,
                    background: h.done ? cat.color : C.b1 }}/>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── PROGRESS ─────────────────────────────────────────────────────
function ProgressScreen({ cats }) {
  const all = cats.flatMap(c => c.habits);
  const done = all.filter(h => h.done).length;
  const pct = Math.round(done / all.length * 100);
  const ringColor = pct >= 80 ? C.gold : pct >= 50 ? C.teal : C.purple;

  const days = ['M','T','W','T','F','S','S'];
  const bars = [72,88,64,91,78,95,pct];
  const heat = [
    [85,90,72,95,88,100,30],[60,78,85,70,92,88,45],
    [90,85,92,78,88,95,72],[72,88,64,91,78,pct,0],
  ];
  const hc = v => v>=90?C.gold:v>=70?'rgba(233,168,50,.55)':v>=50?'rgba(233,168,50,.28)':v>0?'rgba(233,168,50,.10)':C.b1;

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 100px' }}>
      <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1, marginBottom:4 }}>Progress</div>
      <div style={{ fontFamily:Fb, fontSize:12, color:C.t2, marginBottom:20 }}>
        {new Date().toLocaleDateString('en-US',{month:'long',year:'numeric'})} · Week {Math.ceil(new Date().getDate()/7)}
      </div>

      {/* Discipline Score */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b2}`, borderRadius:22,
        padding:22, marginBottom:14, textAlign:'center' }}>
        <div style={{ fontFamily:Fb, fontSize:10, color:C.t3, letterSpacing:'0.12em',
          textTransform:'uppercase', marginBottom:16 }}>Discipline Score™</div>
        <div style={{ display:'flex', justifyContent:'center', position:'relative', marginBottom:14 }}>
          <Ring pct={82} size={130} sw={11} color={C.gold}/>
          <div style={{ position:'absolute', inset:0, display:'flex',
            flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ fontFamily:Fd, fontSize:42, fontWeight:800, color:C.gold, lineHeight:1 }}>82</div>
            <div style={{ fontFamily:Fb, fontSize:11, color:C.t3 }}>/100</div>
          </div>
        </div>
        <div style={{ display:'inline-block', fontFamily:Fb, fontSize:13, fontWeight:600,
          color:C.gold, background:C.goldF, border:`1px solid ${C.goldB}`,
          padding:'5px 16px', borderRadius:20 }}>🔱 Elite Level — Top 8%</div>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          { l:'Current Streak', v:'14 days', icon:'🔥', c:C.gold   },
          { l:'Personal Best',  v:'21 days', icon:'🏆', c:C.purple },
          { l:'Monthly Avg',    v:'78%',     icon:'📊', c:C.teal   },
          { l:'Habits Done',    v:'312',     icon:'✅', c:C.green  },
        ].map(s => (
          <div key={s.l} style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:16, padding:16 }}>
            <div style={{ fontSize:22, marginBottom:8 }}>{s.icon}</div>
            <div style={{ fontFamily:Fd, fontSize:20, fontWeight:700, color:s.c }}>{s.v}</div>
            <div style={{ fontFamily:Fb, fontSize:11, color:C.t3, marginTop:3 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16, marginBottom:14 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:14 }}>This Week</div>
        <div style={{ display:'flex', gap:6, alignItems:'flex-end', height:72 }}>
          {bars.map((v,i) => (
            <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
              <div style={{ width:'100%', borderRadius:6,
                height:Math.max(4, Math.round(v/100*56)),
                background: i===6 ? (v>0?C.teal:C.b1) : v>=80?C.gold:'rgba(233,168,50,.32)',
                transition:'height 0.5s' }}/>
              <div style={{ fontFamily:Fb, fontSize:10, color:i===6?C.teal:C.t3 }}>{days[i]}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.08em', textTransform:'uppercase', marginBottom:12 }}>Monthly Heatmap</div>
        <div style={{ display:'flex', gap:4, marginBottom:8 }}>
          {days.map(d => <div key={d} style={{ flex:1, textAlign:'center',
            fontFamily:Fb, fontSize:9.5, color:C.t3 }}>{d}</div>)}
        </div>
        {heat.map((row,ri) => (
          <div key={ri} style={{ display:'flex', gap:4, marginBottom:4 }}>
            {row.map((v,ci) => (
              <div key={ci} style={{ flex:1, aspectRatio:'1', borderRadius:4, background:hc(v) }}/>
            ))}
          </div>
        ))}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:12 }}>
          <span style={{ fontFamily:Fb, fontSize:9.5, color:C.t3 }}>Less</span>
          {[.10,.28,.55,1].map((op,i) => (
            <div key={i} style={{ width:12, height:12, borderRadius:3,
              background:`rgba(233,168,50,${op})` }}/>
          ))}
          <span style={{ fontFamily:Fb, fontSize:9.5, color:C.t3 }}>More</span>
        </div>
      </div>
    </div>
  );
}

// ─── POMODORO ──────────────────────────────────────────────────────
function PomodoroScreen() {
  const [mode, setMode] = useState('focus');
  const [running, setRunning] = useState(false);
  const [secs, setSecs] = useState(25*60);
  const [sessions, setSessions] = useState(0);
  const intervalRef = useRef(null);

  const totals = { focus:25*60, short:5*60, long:15*60 };
  const total = totals[mode];
  const pct = ((total - secs) / total) * 100;
  const modeColor = mode==='focus' ? C.teal : mode==='short' ? C.gold : C.purple;
  const fmt = s => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSecs(s => {
          if (s <= 1) {
            setRunning(false);
            if (mode === 'focus') setSessions(prev => Math.min(4, prev+1));
            return totals[mode];
          }
          return s - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, mode]);

  const switchMode = m => { setMode(m); setSecs(totals[m]); setRunning(false); };

  const modes = [
    { id:'focus', label:'Focus', dur:'25m' },
    { id:'short', label:'Break', dur:'5m'  },
    { id:'long',  label:'Rest',  dur:'15m' },
  ];

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'16px 16px 100px', overflowY:'auto' }}>
      <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1, marginBottom:20 }}>Study Timer</div>

      {/* Mode selector */}
      <div style={{ display:'flex', background:C.bg4, borderRadius:14, padding:3, marginBottom:28, gap:3 }}>
        {modes.map(m => (
          <div key={m.id} onClick={() => switchMode(m.id)}
            style={{ flex:1, padding:'10px 0', borderRadius:11, textAlign:'center', cursor:'pointer',
              background: mode===m.id ? C.bg2 : 'transparent',
              border: `1px solid ${mode===m.id ? C.b2 : 'transparent'}`,
              transition:'all 0.2s' }}>
            <div style={{ fontFamily:Fb, fontSize:13, fontWeight:700,
              color: mode===m.id ? modeColor : C.t3 }}>{m.label}</div>
            <div style={{ fontFamily:Fb, fontSize:10, color:C.t3, marginTop:1 }}>{m.dur}</div>
          </div>
        ))}
      </div>

      {/* Ring + timer */}
      <div style={{ display:'flex', justifyContent:'center', position:'relative', marginBottom:28 }}
        onClick={() => setRunning(r => !r)}>
        <Ring pct={pct} size={220} sw={14} color={modeColor}/>
        <div style={{ position:'absolute', inset:0, display:'flex',
          flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
          <div style={{ fontFamily:Fd, fontSize:52, fontWeight:800, color:C.t1, lineHeight:1 }}>{fmt(secs)}</div>
          <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, marginTop:6 }}>
            {running ? 'Tap to pause' : 'Tap to start'}
          </div>
        </div>
      </div>

      {/* Session dots */}
      <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, marginBottom:24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{ width:12, height:12, borderRadius:6,
            background: i<sessions ? C.teal : C.b2, transition:'all 0.3s' }}/>
        ))}
        <span style={{ fontFamily:Fb, fontSize:12, color:C.t3, marginLeft:4 }}>
          {sessions}/4 sessions
        </span>
      </div>

      {/* Controls */}
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={() => { setSecs(total); setRunning(false); }}
          style={{ flex:1, padding:'14px', borderRadius:14, background:C.b1,
            border:`1px solid ${C.b2}`, cursor:'pointer',
            fontFamily:Fb, fontSize:13, fontWeight:600, color:C.t2 }}>
          ↺ Reset
        </button>
        <button onClick={() => setRunning(r => !r)}
          style={{ flex:2, padding:'14px', borderRadius:14, border:'none', cursor:'pointer',
            background:modeColor, fontFamily:Fd, fontSize:15, fontWeight:700, color:C.bg0 }}>
          {running ? '⏸ Pause' : '▶ Start'}
        </button>
      </div>

      {/* XP info */}
      <div style={{ background:C.tealF, border:`1px solid rgba(15,212,184,0.2)`,
        borderRadius:14, padding:14, marginTop:16, display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>⚡</span>
        <div>
          <div style={{ fontFamily:Fb, fontSize:13, fontWeight:600, color:C.teal }}>+25 XP per session</div>
          <div style={{ fontFamily:Fb, fontSize:11.5, color:C.t3, marginTop:2 }}>Sessions auto-log to your dashboard</div>
        </div>
      </div>
    </div>
  );
}

// ─── JOURNAL ───────────────────────────────────────────────────────
function JournalScreen() {
  const [mood, setMood] = useState(null);
  const [entry, setEntry] = useState('');
  const [gratitude, setGratitude] = useState('');
  const [saved, setSaved] = useState(false);

  const moods = ['😔','😐','🙂','😊','🤩'];
  const mLabels = ['Rough','Meh','Okay','Good','Elite'];

  const prompts = [
    "What habit did you resist most today — and what does that reveal about you?",
    "Name one moment today where you chose discipline over comfort.",
    "What would your most disciplined self say about today's effort?",
    "Where did you lose focus today, and what was the trigger?",
    "What's one thing you did today that your future self will thank you for?",
  ];
  const prompt = prompts[new Date().getDay() % prompts.length];

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 100px' }}>
      <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1, marginBottom:4 }}>Reflection</div>
      <div style={{ fontFamily:Fb, fontSize:12, color:C.t2, marginBottom:20 }}>
        {new Date().toLocaleDateString('en-US',{weekday:'long', month:'long', day:'numeric'})}
      </div>

      {/* Daily prompt */}
      <div style={{ background:'linear-gradient(135deg,rgba(152,128,245,.13),rgba(15,212,184,.07))',
        border:`1px solid rgba(152,128,245,.22)`, borderRadius:20, padding:20, marginBottom:14 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.purple,
          letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:12 }}>Today's Prompt</div>
        <div style={{ fontFamily:Fb, fontSize:15, fontWeight:500, color:C.t1, lineHeight:1.65 }}>
          "{prompt}"
        </div>
      </div>

      {/* Mood */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16, marginBottom:14 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:14 }}>Mood Check-in</div>
        <div style={{ display:'flex', gap:6 }}>
          {moods.map((m,i) => (
            <div key={i} onClick={() => setMood(i)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                padding:'10px 0', borderRadius:12, cursor:'pointer',
                background: mood===i ? C.tealF : 'transparent',
                border: `1px solid ${mood===i ? C.teal : 'transparent'}`,
                transition:'all 0.18s' }}>
              <span style={{ fontSize:22 }}>{m}</span>
              <span style={{ fontFamily:Fb, fontSize:9.5, color: mood===i ? C.teal : C.t3 }}>{mLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Free write */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16, marginBottom:14 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:12 }}>Free Write</div>
        <textarea value={entry} onChange={e => setEntry(e.target.value)} rows={5}
          placeholder="Write anything about your day..."
          style={{ width:'100%', resize:'none', background:C.bg1, border:`1px solid ${C.b1}`,
            borderRadius:12, padding:14, color:C.t1, fontFamily:Fb, fontSize:14,
            outline:'none', boxSizing:'border-box', lineHeight:1.65,
            caretColor:C.gold }}/>
        <div style={{ fontFamily:Fb, fontSize:11, color:C.t3, marginTop:6, textAlign:'right' }}>
          {entry.length} characters
        </div>
      </div>

      {/* Gratitude */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16, marginBottom:20 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:6 }}>Gratitude</div>
        <div style={{ fontFamily:Fb, fontSize:12, color:C.t3, marginBottom:12 }}>Today I am grateful for...</div>
        <textarea value={gratitude} onChange={e => setGratitude(e.target.value)} rows={3}
          placeholder="e.g. The focus I had during my morning study block..."
          style={{ width:'100%', resize:'none', background:C.bg1, border:`1px solid ${C.b1}`,
            borderRadius:12, padding:14, color:C.t1, fontFamily:Fb, fontSize:14,
            outline:'none', boxSizing:'border-box', lineHeight:1.65,
            caretColor:C.gold }}/>
      </div>

      <button onClick={handleSave}
        style={{ width:'100%', padding:'16px', borderRadius:16, border:'none', cursor:'pointer',
          background: saved ? C.green : C.gold,
          fontFamily:Fd, fontSize:15, fontWeight:700, color:C.bg0,
          transition:'background 0.3s' }}>
        {saved ? '✓ Reflection Saved' : 'Complete Reflection'}
      </button>
    </div>
  );
}

// ─── PROFILE ───────────────────────────────────────────────────────
function ProfileScreen() {
  const [darkMode] = useState(true);
  const xp = 2450; const maxXp = 3500;
  const badges = [
    { icon:'🔥', label:'14-Day Streak',   color:C.gold   },
    { icon:'📚', label:'Study Champion',  color:C.teal   },
    { icon:'🕌', label:'Faith Pillar',    color:C.purple },
    { icon:'💪', label:'Gym Warrior',     color:C.green  },
    { icon:'🧊', label:'Cold Shower',     color:C.blue||C.teal },
    { icon:'🌙', label:'Night Routine',   color:C.purple },
  ];
  return (
    <div style={{ flex:1, overflowY:'auto', padding:'16px 16px 100px' }}>
      {/* Avatar + name */}
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', marginBottom:24 }}>
        <div style={{ width:80, height:80, borderRadius:24, flexShrink:0,
          background:`linear-gradient(135deg,${C.purple},${C.teal})`,
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:36, marginBottom:12, boxShadow:`0 0 30px rgba(152,128,245,0.3)` }}>
          🧑‍💻
        </div>
        <div style={{ fontFamily:Fd, fontSize:22, fontWeight:700, color:C.t1 }}>Ahmad Al-Rashid</div>
        <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, marginTop:4 }}>Level 7 — Discipline Warrior</div>
        <div style={{ display:'flex', gap:8, marginTop:10 }}>
          <div style={{ background:C.goldF, border:`1px solid ${C.goldB}`, borderRadius:20,
            padding:'4px 14px', fontFamily:Fb, fontSize:12, fontWeight:700, color:C.gold }}>
            🔥 14 Day Streak
          </div>
          <div style={{ background:C.tealF, border:`1px solid rgba(15,212,184,0.2)`, borderRadius:20,
            padding:'4px 14px', fontFamily:Fb, fontSize:12, fontWeight:700, color:C.teal }}>
            ⭐ Top 8%
          </div>
        </div>
      </div>

      {/* XP Progress */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b2}`, borderRadius:20, padding:20, marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
          <div style={{ fontFamily:Fb, fontSize:12, color:C.t2 }}>Progress to Level 8</div>
          <div style={{ fontFamily:Fb, fontSize:12, fontWeight:700, color:C.gold }}>
            {xp.toLocaleString()} XP
          </div>
        </div>
        <div style={{ height:8, background:C.b1, borderRadius:4, overflow:'hidden', marginBottom:8 }}>
          <div style={{ height:'100%', background:`linear-gradient(90deg,${C.gold},${C.teal})`,
            borderRadius:4, width:`${xp/maxXp*100}%`, transition:'width 1s' }}/>
        </div>
        <div style={{ fontFamily:Fb, fontSize:11, color:C.t3 }}>
          {(maxXp-xp).toLocaleString()} XP to next level
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
        {[
          { label:'Days Active', val:'42',  color:C.teal   },
          { label:'Badges',      val:'6',   color:C.gold   },
          { label:'Total XP',    val:'12K', color:C.purple },
        ].map(s => (
          <div key={s.label} style={{ background:C.bg3, border:`1px solid ${C.b1}`,
            borderRadius:14, padding:'14px 10px', textAlign:'center' }}>
            <div style={{ fontFamily:Fd, fontSize:20, fontWeight:700, color:s.color }}>{s.val}</div>
            <div style={{ fontFamily:Fb, fontSize:10.5, color:C.t3, marginTop:3 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Badges */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, padding:16, marginBottom:14 }}>
        <div style={{ fontFamily:Fb, fontSize:10, fontWeight:700, color:C.t3,
          letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:14 }}>Badges Earned</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10 }}>
          {badges.map(b => (
            <div key={b.label} style={{ display:'flex', flexDirection:'column', alignItems:'center',
              gap:6, padding:'12px 8px', background:C.bg4, borderRadius:14 }}>
              <span style={{ fontSize:26 }}>{b.icon}</span>
              <span style={{ fontFamily:Fb, fontSize:10, color:b.color, textAlign:'center',
                fontWeight:600, lineHeight:1.4 }}>{b.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Settings */}
      <div style={{ background:C.bg3, border:`1px solid ${C.b1}`, borderRadius:18, overflow:'hidden' }}>
        {[
          { icon:'🔔', label:'Notifications', val:'Morning + Evening' },
          { icon:'🌙', label:'Appearance', val:'Dark Mode' },
          { icon:'🔒', label:'Privacy', val:'Journal encrypted' },
          { icon:'📤', label:'Export Data', val:'→' },
          { icon:'💌', label:'Feedback', val:'→' },
        ].map((s,i,arr) => (
          <div key={s.label} style={{ display:'flex', alignItems:'center', gap:14,
            padding:'15px 16px', borderBottom: i<arr.length-1?`1px solid ${C.b1}`:'none',
            cursor:'pointer' }}>
            <span style={{ fontSize:18, width:26 }}>{s.icon}</span>
            <div style={{ flex:1, fontFamily:Fb, fontSize:14, color:C.t1 }}>{s.label}</div>
            <div style={{ fontFamily:Fb, fontSize:12, color:C.t3 }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BOTTOM NAV ────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id:'today',    label:'Today',    icon:(on,c)=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/>
    </svg>
  )},
  { id:'progress', label:'Progress', icon:(on,c)=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/>
    </svg>
  )},
  { id:'pomodoro', label:'Focus',    icon:(on,c)=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  )},
  { id:'journal',  label:'Journal',  icon:(on,c)=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
    </svg>
  )},
  { id:'profile',  label:'Profile',  icon:(on,c)=>(
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  )},
];

// ─── ONBOARDING ────────────────────────────────────────────────────
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [persona, setPersona] = useState(null);
  const [pillars, setPillars] = useState([]);

  const personas = [
    { id:'student', icon:'🎓', label:'University Student', sub:'Study, deadlines, campus life' },
    { id:'pro',     icon:'💼', label:'Young Professional', sub:'Career growth & balance' },
    { id:'fitness', icon:'🏋️', label:'Fitness-First',     sub:'Training & performance' },
    { id:'custom',  icon:'⚙️', label:'Build My Own',      sub:'Start from scratch' },
  ];
  const cols = [
    { id:'faith', icon:'🕌', label:'Faith & Spirit',   color:C.purple },
    { id:'study', icon:'📚', label:'Mind & Study',     color:C.teal   },
    { id:'body',  icon:'💪', label:'Body & Health',    color:C.green  },
    { id:'mind',  icon:'🧘', label:'Mental Wellness',  color:C.blue||C.teal  },
    { id:'life',  icon:'✅', label:'Life & Discipline',color:C.gold   },
  ];
  const togglePillar = id => setPillars(p => p.includes(id) ? p.filter(x=>x!==id) : [...p,id]);

  const steps = [
    // Step 0 — Welcome
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:32, textAlign:'center' }}>
      <div style={{ fontFamily:Fd, fontSize:64, fontWeight:800, color:C.t1,
        letterSpacing:'-0.04em', lineHeight:1, marginBottom:8 }}>
        DNY<span style={{ color:C.gold }}>.</span>
      </div>
      <div style={{ fontFamily:Fb, fontSize:11, color:C.t2, letterSpacing:'0.22em',
        textTransform:'uppercase', marginBottom:28 }}>Discipline · Next Level · You</div>
      <div style={{ fontFamily:Fb, fontSize:15, color:C.t2, lineHeight:1.75, marginBottom:48, maxWidth:300 }}>
        The app built for people who take their whole life seriously.
      </div>
      <button onClick={() => setStep(1)} style={{ width:'100%', maxWidth:300, padding:'17px',
        borderRadius:16, background:C.gold, border:'none', cursor:'pointer',
        fontFamily:Fd, fontSize:16, fontWeight:700, color:C.bg0 }}>
        Start Building →
      </button>
      <div style={{ fontFamily:Fb, fontSize:12, color:C.t3, marginTop:16 }}>
        Already have an account? <span style={{ color:C.gold }}>Sign in</span>
      </div>
    </div>,

    // Step 1 — Name
    <div style={{ flex:1, display:'flex', flexDirection:'column', padding:'40px 24px 32px' }}>
      <div style={{ fontFamily:Fd, fontSize:26, fontWeight:700, color:C.t1, marginBottom:8 }}>What's your name?</div>
      <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, marginBottom:32 }}>We'll personalise your daily greeting.</div>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your first name"
        autoFocus style={{ fontFamily:Fd, fontSize:22, fontWeight:600, color:C.t1,
          background:'transparent', border:'none', borderBottom:`2px solid ${name?C.gold:C.b2}`,
          outline:'none', padding:'12px 0', marginBottom:40, caretColor:C.gold,
          transition:'border-color 0.2s' }}/>
      <button onClick={() => name.trim() && setStep(2)} style={{ width:'100%', padding:'16px',
        borderRadius:16, border:'none', cursor:'pointer',
        background: name.trim() ? C.gold : C.b1,
        fontFamily:Fd, fontSize:15, fontWeight:700,
        color: name.trim() ? C.bg0 : C.t3, transition:'all 0.2s' }}>
        {name.trim() ? `Continue, ${name.trim().split(' ')[0]} →` : 'Enter your name'}
      </button>
    </div>,

    // Step 2 — Persona
    <div style={{ flex:1, overflowY:'auto', padding:'32px 20px 32px' }}>
      <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1, marginBottom:6 }}>Who are you right now?</div>
      <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, marginBottom:24 }}>We'll pre-load your habit library instantly.</div>
      {personas.map(p => (
        <div key={p.id} onClick={() => setPersona(p.id)}
          style={{ display:'flex', alignItems:'center', gap:14, padding:'15px 16px',
            borderRadius:16, marginBottom:10, cursor:'pointer',
            border:`1.5px solid ${persona===p.id ? C.gold : C.b2}`,
            background: persona===p.id ? C.goldF : C.bg4, transition:'all 0.18s' }}>
          <span style={{ fontSize:26 }}>{p.icon}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:Fb, fontSize:14, fontWeight:600, color:C.t1 }}>{p.label}</div>
            <div style={{ fontFamily:Fb, fontSize:12, color:C.t2, marginTop:2 }}>{p.sub}</div>
          </div>
          {persona===p.id && <div style={{ color:C.gold, fontSize:18, fontWeight:700 }}>✓</div>}
        </div>
      ))}
      <button onClick={() => persona && setStep(3)} style={{ width:'100%', marginTop:12, padding:'16px',
        borderRadius:16, border:'none', cursor:'pointer',
        background: persona ? C.gold : C.b1,
        fontFamily:Fd, fontSize:15, fontWeight:700,
        color: persona ? C.bg0 : C.t3 }}>
        {persona ? 'Looks Good →' : 'Select your type'}
      </button>
    </div>,

    // Step 3 — Pillars
    <div style={{ flex:1, overflowY:'auto', padding:'32px 20px 32px' }}>
      <div style={{ fontFamily:Fd, fontSize:24, fontWeight:700, color:C.t1, marginBottom:6 }}>Pick your pillars</div>
      <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, marginBottom:24 }}>Choose everything that applies to your life.</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:20 }}>
        {cols.map(c => {
          const on = pillars.includes(c.id);
          return (
            <div key={c.id} onClick={() => togglePillar(c.id)}
              style={{ padding:'18px 12px', borderRadius:16, cursor:'pointer', textAlign:'center',
                border:`1.5px solid ${on ? c.color : C.b2}`,
                background: on ? `${c.color}14` : C.bg4, transition:'all 0.18s' }}>
              <div style={{ fontSize:28, marginBottom:8 }}>{c.icon}</div>
              <div style={{ fontFamily:Fb, fontSize:13, fontWeight:600,
                color: on ? c.color : C.t2, lineHeight:1.4 }}>{c.label}</div>
            </div>
          );
        })}
      </div>
      <button onClick={() => pillars.length > 0 && setStep(4)} style={{ width:'100%', padding:'16px',
        borderRadius:16, border:'none', cursor:'pointer',
        background: pillars.length > 0 ? C.gold : C.b1,
        fontFamily:Fd, fontSize:15, fontWeight:700,
        color: pillars.length > 0 ? C.bg0 : C.t3 }}>
        {pillars.length > 0 ? `Build My Checklist (${pillars.length} pillars) →` : 'Select at least 1'}
      </button>
    </div>,

    // Step 4 — Go live
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent:'center', padding:32, textAlign:'center' }}>
      <div style={{ marginBottom:24 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform:'rotate(-90deg)' }}>
          <circle cx="60" cy="60" r="50" fill="none" stroke={C.b2} strokeWidth="10"/>
          <circle cx="60" cy="60" r="50" fill="none" stroke={C.gold} strokeWidth="10"
            strokeDasharray={314} strokeDashoffset={314} strokeLinecap="round"/>
        </svg>
      </div>
      <div style={{ fontFamily:Fd, fontSize:28, fontWeight:800, color:C.t1, marginBottom:10 }}>
        Day 1 starts now{name ? `, ${name.trim().split(' ')[0]}` : ''}.
      </div>
      <div style={{ fontFamily:Fb, fontSize:16, color:C.gold, fontWeight:600, marginBottom:24 }}>
        "Let's see what you're made of."
      </div>
      <div style={{ background:C.goldF, border:`1px solid ${C.goldB}`, borderRadius:16,
        padding:18, marginBottom:32, maxWidth:300 }}>
        <div style={{ fontFamily:Fb, fontSize:13, color:C.t2, lineHeight:1.7 }}>
          Your checklist is ready. Streak is at 0. That ring is empty. Fill it.
        </div>
      </div>
      <button onClick={onDone} style={{ width:'100%', maxWidth:300, padding:'17px',
        borderRadius:16, background:C.gold, border:'none', cursor:'pointer',
        fontFamily:Fd, fontSize:16, fontWeight:700, color:C.bg0 }}>
        Open My Checklist →
      </button>
    </div>,
  ];

  const showBack = step > 0;
  const progress = step / (steps.length - 1);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', background:C.bg0 }}>
      {/* Progress bar */}
      {step > 0 && step < steps.length-1 && (
        <div style={{ padding:'52px 20px 0', flexShrink:0 }}>
          <div style={{ display:'flex', gap:6 }}>
            {steps.slice(1,-1).map((_,i) => (
              <div key={i} style={{ flex:1, height:3, borderRadius:2,
                background: i < step ? C.gold : i === step-1 ? C.gold : C.b2,
                transition:'background 0.3s' }}/>
            ))}
          </div>
          {showBack && (
            <div onClick={() => setStep(s=>s-1)} style={{ fontFamily:Fb, fontSize:13, color:C.t3,
              cursor:'pointer', marginTop:14, display:'inline-flex', alignItems:'center', gap:4 }}>
              ← Back
            </div>
          )}
        </div>
      )}
      {steps[step]}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [onboarded, setOnboarded] = useState(() => {
    try { return localStorage.getItem('dny_onboarded') === '1'; } catch { return false; }
  });
  const [tab, setTab] = useState('today');
  const [cats, setCats] = useState(initHabits);
  const [prevTab, setPrevTab] = useState('today');

  const handleOnboardDone = () => {
    try { localStorage.setItem('dny_onboarded','1'); } catch {}
    setOnboarded(true);
  };

  const toggle = useCallback((catId, habId) => {
    setCats(prev => prev.map(c => c.id !== catId ? c : {
      ...c, habits: c.habits.map(h => h.id === habId ? { ...h, done:!h.done } : h),
    }));
  }, []);

  const switchTab = t => { setPrevTab(tab); setTab(t); };

  if (!onboarded) return <Onboarding onDone={handleOnboardDone}/>;

  const screens = {
    today:    <TodayScreen cats={cats} onToggle={toggle}/>,
    progress: <ProgressScreen cats={cats}/>,
    pomodoro: <PomodoroScreen/>,
    journal:  <JournalScreen/>,
    profile:  <ProfileScreen/>,
  };

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column',
      background:C.bg0, maxWidth:480, margin:'0 auto', position:'relative' }}>
      {/* Status bar spacer */}
      <div style={{ height:'env(safe-area-inset-top, 44px)', background:C.bg1, flexShrink:0 }}/>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 20px 8px', background:C.bg1, flexShrink:0,
        borderBottom:`1px solid ${C.b1}` }}>
        <div>
          <div style={{ fontFamily:Fd, fontSize:18, fontWeight:800, color:C.t1, letterSpacing:'-0.02em' }}>
            DNY<span style={{ color:C.gold }}>.</span>
          </div>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ background:C.goldF, border:`1px solid ${C.goldB}`,
            borderRadius:20, padding:'4px 12px', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ fontSize:13 }}>🔥</span>
            <span style={{ fontFamily:Fb, fontSize:12, fontWeight:700, color:C.gold }}>14</span>
          </div>
          <div style={{ width:32, height:32, borderRadius:10,
            background:`linear-gradient(135deg,${C.purple},${C.teal})`,
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:17, cursor:'pointer' }}
            onClick={() => switchTab('profile')}>
            🧑‍💻
          </div>
        </div>
      </div>

      {/* Screen */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {screens[tab]}
      </div>

      {/* Bottom nav */}
      <div style={{ display:'flex', background:C.bg1, borderTop:`1px solid ${C.b2}`,
        padding:`10px 0 env(safe-area-inset-bottom, 10px)`, flexShrink:0 }}>
        {NAV_ITEMS.map(item => {
          const on = tab === item.id;
          const color = on ? C.gold : C.t3;
          return (
            <div key={item.id} onClick={() => switchTab(item.id)}
              style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center',
                gap:4, cursor:'pointer', padding:'4px 0', userSelect:'none' }}>
              {item.icon(on, color)}
              <span style={{ fontFamily:Fb, fontSize:10, fontWeight: on ? 700 : 400,
                color, transition:'color 0.18s' }}>{item.label}</span>
              {on && <div style={{ width:4, height:4, borderRadius:2,
                background:C.gold, marginTop:-2 }}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
