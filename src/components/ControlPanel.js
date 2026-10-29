import React, {useState, useEffect} from 'https://esm.sh/react@18.3.1';
const h = React.createElement;
const KEY = 'dev-null-globe-panel-collapsed';
export function ControlPanel() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem(KEY);
    return saved === null ? matchMedia('(max-width: 650px)').matches : saved === 'true';
  });
  useEffect(() => {
    try { localStorage.setItem(KEY, String(collapsed)); } catch {}
    const content = document.getElementById('panel-content');
    if (content) content.inert = collapsed;
  }, [collapsed]);
  return h('div',{className:'panel' + (collapsed ? ' collapsed' : '')},
    h('div',{className:'panel-heading'},
      h('h1',{id:'heading'},"🌍 Tom's Following"),
      h('button',{id:'collapse-toggle',className:'collapse-toggle',type:'button',
        'aria-expanded':String(!collapsed),'aria-controls':'panel-content',
        onClick:()=>setCollapsed(value=>!value)},collapsed?'Show ▼':'Hide ▲')),
    h('div',{id:'panel-content',className:'panel-content'},
      h('form',{className:'lookup',id:'lookup'},
        h('input',{id:'handle','aria-label':'dev/null username',placeholder:'Enter username',
          defaultValue:'tom',maxLength:64,required:true,pattern:'[A-Za-z0-9_-]+'}),
        h('button',{type:'submit'},'Show globe')),
      h('div',{className:'mode-switch',role:'group','aria-label':'Choose relationship'},
        h('button',{type:'button','data-mode':'following','aria-pressed':'true'},'Following'),
        h('button',{type:'button','data-mode':'followers','aria-pressed':'false'},'Followers')),
      h('div',{id:'status'},'Loading users…'),
      h('div',{id:'error'}),
      h('div',{className:'actions'},
        h('button',{id:'more',type:'button',disabled:true},'Load 30 more'),
        h('button',{id:'auto',type:'button','aria-pressed':'true'},'⏸ Pause auto-load')),
      h('div',{id:'countdown',className:'hint','aria-live':'polite'}),
      h('div',{className:'hint'},'Drag to rotate · Scroll to zoom'),
      h('div',{className:'credit'},'Vibe-coded by ',
        h('a',{href:'https://dev-null.sh/@richardkeep',target:'_blank',rel:'noopener noreferrer'},'@richardkeep'))));
}
