import React, {useState, useEffect, useRef} from 'react';
const h = React.createElement;
const KEY = 'dev-null-globe-panel-collapsed';
export function ControlPanel({handle, mode, status, error, loading, nextUrl, autoPaused,
  countdown, switchUser, loadNextPage, toggleAutoLoad}) {
  const contentRef = useRef(null);
  const [input, setInput] = useState(handle);
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
    h('div',{className:'panel-heading'},
      h('h1',{id:'heading'},`🌍 ${handle}'s ${mode === 'followers' ? 'Followers' : 'Following'}`),
      h('button',{id:'collapse-toggle',className:'collapse-toggle',type:'button',
        'aria-expanded':String(!collapsed),'aria-controls':'panel-content',
        onClick:()=>setCollapsed(value=>!value)},collapsed?'Show ▼':'Hide ▲')),
    h('div',{id:'panel-content',className:'panel-content',ref:contentRef},
      h('form',{className:'lookup',id:'lookup',onSubmit:event=>{event.preventDefault();switchUser(input);}},
        h('input',{id:'handle','aria-label':'dev/null username',placeholder:'Enter username',
          value:input,onChange:event=>setInput(event.target.value),maxLength:64,required:true,pattern:'[A-Za-z0-9_-]+'}),
        h('button',{type:'submit'},'Show globe')),
      h('div',{className:'mode-switch',role:'group','aria-label':'Choose relationship'},
        h('button',{type:'button','data-mode':'following','aria-pressed':String(mode==='following'),onClick:()=>switchUser(handle,'following')},'Following'),
        h('button',{type:'button','data-mode':'followers','aria-pressed':String(mode==='followers'),onClick:()=>switchUser(handle,'followers')},'Followers')),
      h('div',{id:'status'},status),
      h('div',{id:'error'},error),
      h('div',{className:'actions'},
        h('button',{id:'more',type:'button',disabled:loading||!nextUrl,onClick:loadNextPage},nextUrl?'Load 30 more':'All pages loaded'),
        h('button',{id:'auto',type:'button','aria-pressed':String(!autoPaused),disabled:!nextUrl,onClick:toggleAutoLoad},autoPaused?'▶ Resume auto-load':'⏸ Pause auto-load')),
      h('div',{id:'countdown',className:'hint','aria-live':'polite'},countdown),
      h('div',{className:'hint'},'Drag to rotate · Scroll to zoom · Select a count to spread avatars'),
      h('div',{className:'credit'},'Vibe-coded by ',
        h('a',{href:'https://dev-null.sh/@richardkeep',target:'_blank',rel:'noopener noreferrer'},'@richardkeep'))));
}
