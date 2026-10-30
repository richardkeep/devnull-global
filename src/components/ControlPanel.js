import React, {useState, useEffect, useRef} from 'react';
const h = React.createElement;
const KEY = 'dev-null-globe-panel-collapsed';
export function ControlPanel({handle, mode, status, error, loading, nextUrl, autoPaused,
  countdown, switchUser, loadNextPage, toggleAutoLoad}) {
  const contentRef = useRef(null);
  const [input, setInput] = useState(handle);
  const metrics = status.match(/^(\d+) on globe · (\d+) not plotted · (\d+) fetched(.*)$/);
  useEffect(() => setInput(handle), [handle]);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved !== null) return saved === 'true';
    } catch {}
    return matchMedia('(max-width: 650px)').matches;
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, String(collapsed)); } catch {}
    contentRef.current.inert = collapsed;
  }, [collapsed]);
  return h('div',{className:'panel' + (collapsed ? ' collapsed' : '')},
    h('div',{className:'panel-eyebrow'},h('span',{className:'live-dot','aria-hidden':true}),'DEV/NULL',h('span',{className:'eyebrow-divider'},'/'),'COMMUNITY GLOBE'),
    h('div',{className:'panel-heading'},
      h('h1',{id:'heading'},`🌍 ${handle}'s ${mode === 'followers' ? 'Followers' : 'Following'}`),
      h('button',{id:'collapse-toggle',className:'collapse-toggle',type:'button',
        'aria-expanded':String(!collapsed),'aria-controls':'panel-content',
        onClick:()=>setCollapsed(value=>!value)},collapsed?'Show ▼':'Hide ▲')),
    h('div',{id:'panel-content',className:'panel-content',ref:contentRef},
      h('p',{className:'panel-intro'},'Your network. Around the world.'),
      h('label',{className:'field-label',htmlFor:'handle'},'Explore a developer'),
      h('form',{className:'lookup',id:'lookup',onSubmit:event=>{event.preventDefault();switchUser(input);}},
        h('div',{className:'handle-field'},h('span',{'aria-hidden':true},'@'),
          h('input',{id:'handle','aria-label':'dev/null username',placeholder:'Enter username',autoComplete:'off',spellCheck:false,
            value:input,onChange:event=>setInput(event.target.value),maxLength:64,required:true,pattern:'[A-Za-z0-9_-]+'})),
        h('button',{type:'submit'},'Show globe')),
      h('div',{className:'mode-switch',role:'group','aria-label':'Choose relationship'},
        h('button',{type:'button','data-mode':'following','aria-pressed':String(mode==='following'),onClick:()=>switchUser(handle,'following')},'Following'),
        h('button',{type:'button','data-mode':'followers','aria-pressed':String(mode==='followers'),onClick:()=>switchUser(handle,'followers')},'Followers')),
      h('div',{id:'status',className:metrics?'network-stats':'',role:'status'},metrics ?
        [h('div',{className:'stat',key:'plotted'},h('strong',null,metrics[1]),' on globe'),
          h('span',{className:'stat-separator',key:'separator-1'},' · '),
          h('div',{className:'stat',key:'skipped'},h('strong',null,metrics[2]),' not plotted'),
          h('span',{className:'stat-separator',key:'separator-2'},' · '),
          h('div',{className:'stat',key:'loaded'},h('strong',null,metrics[3]),' fetched'),
          metrics[4] && h('span',{className:'restored-note',key:'restored'},metrics[4])] : status),
      h('div',{id:'error'},error),
      h('div',{className:'actions'},
        h('button',{id:'more',type:'button',disabled:loading||!nextUrl,onClick:loadNextPage},nextUrl?'Load 30 more':'All pages loaded'),
        h('button',{id:'auto',type:'button','aria-pressed':String(!autoPaused),disabled:!nextUrl,onClick:toggleAutoLoad},autoPaused?'▶ Resume auto-load':'⏸ Pause auto-load')),
      h('div',{id:'countdown',className:'hint','aria-live':'polite'},countdown),
      h('div',{className:'hint globe-instructions'},h('span',{'aria-hidden':true},'↔'),' Drag to rotate',h('span',{className:'hint-divider'},'·'),'Scroll to zoom'),
      h('div',{className:'hint cluster-instructions'},'Select a count to spread avatars'),
      h('div',{className:'credit'},
        h('span',null,'Vibe-coded by ',h('a',{href:'https://dev-null.sh/@richardkeep',target:'_blank',rel:'noopener noreferrer'},'@richardkeep')),
        h('a',{className:'repo-link',href:'https://github.com/richardkeep/devnull-global',target:'_blank',rel:'noopener noreferrer'},
          h('svg',{width:14,height:14,viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},
            h('path',{d:'M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.1 1.15A10.8 10.8 0 0 1 12 6.16c.96 0 1.92.13 2.82.38 2.15-1.46 3.1-1.15 3.1-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.28-5.14 5.56.4.35.76 1.03.76 2.08v3.1c0 .3.2.65.78.54A11.25 11.25 0 0 0 12 .75Z'})),
          'GitHub',h('span',{'aria-hidden':true},'↗')))));
}
