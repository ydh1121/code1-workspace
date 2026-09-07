/* Shared model logic, packaged as a private server helper and a client script. */
var Code1Core = (() => {
  const clone=x=>JSON.parse(JSON.stringify(x));
  const finite=(x,min,max)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error('INVALID_GEOMETRY');return x;};
  const text=(x,max=10000)=>{if(typeof x!=='string'||x.length>max)throw Error('INVALID_TEXT');return x;};
  const id=x=>{text(x,100);if(!/^[A-Za-z0-9_-]+$/.test(x))throw Error('INVALID_ID');return x;};
  const color=x=>{if(!/^#[a-fA-F0-9]{6}$/.test(x))throw Error('INVALID_COLOR');return x;};
  const choice=(v,a)=>{if(!a.includes(v))throw Error('INVALID_OPTION');return v;};
  function style(s={}) {
    const out={};
    const numbers={fontSize:[8,400],fontWeight:[100,900],lineHeight:[0.8,3],letterSpacing:[-10,50],opacity:[0,1],borderRadius:[0,1000],rotation:[-180,180]};
    for(const [k,range] of Object.entries(numbers))if(s[k]!==undefined)out[k]=finite(s[k],...range);
    for(const k of ['color','backgroundColor'])if(s[k]!==undefined)out[k]=color(s[k]);
    if(s.fontFamily!==undefined)out.fontFamily=choice(s.fontFamily,['Pretendard Variable','Pretendard']);
    if(s.textAlign!==undefined)out.textAlign=choice(s.textAlign,['left','center','right']);
    if(s.fontStyle!==undefined)out.fontStyle=choice(s.fontStyle,['normal','italic']);
    if(s.textDecoration!==undefined)out.textDecoration=choice(s.textDecoration,['none','underline']);
    if(s.objectFit!==undefined)out.objectFit=choice(s.objectFit,['cover','contain','original']);
    if(s.objectPosition!==undefined)out.objectPosition=choice(s.objectPosition,['center','top','bottom','left','right']);
    return out;
  }
  function background(b={}) {
    const out={color:color(b.color||'#FFFFFF'),opacity:finite(b.opacity??1,0,1),overlayColor:color(b.overlayColor||'#FFFFFF'),overlayOpacity:finite(b.overlayOpacity??0,0,1),fit:choice(b.fit||'cover',['cover','contain']),position:choice(b.position||'center',['center','top','bottom','left','right']),zoom:finite(b.zoom??1,1,3)};
    if(b.mediaRef)out.mediaRef=id(b.mediaRef);return out;
  }
  function validateDeck(d) {
    if(!d||!Array.isArray(d.slides)||!d.slides.length||d.slides.length>40)throw Error('INVALID_DECK');
    let count=0;const ids=new Set();
    const result={deck_id:id(d.deck_id),version:Number(d.version)||0,version_label:text(d.version_label||'v0.1',30),status:'INTERNAL WORKING COPY',slides:d.slides.map(s=>{
      if(!Array.isArray(s.elements)||s.elements.length>180)throw Error('TOO_MANY_ELEMENTS');
      const sid=id(s.slide_id);if(ids.has(sid))throw Error('DUPLICATE_ID');ids.add(sid);
      return {slide_id:sid,width:1920,height:1080,background:background(s.background),elements:s.elements.map(e=>{
        const eid=id(e.element_id);if(ids.has(eid))throw Error('DUPLICATE_ID');ids.add(eid);count++;
        const out={element_id:eid,type:choice(e.type,['text','image','shape']),x:finite(e.x,0,1920),y:finite(e.y,0,1080),width:finite(e.width,1,1920),height:finite(e.height,1,1080),z:finite(e.z,-1000,10000),locked:e.locked===true,style:style(e.style)};
        if(out.x+out.width>1920.1||out.y+out.height>1080.1)throw Error('ELEMENT_OUTSIDE_SLIDE');
        if(e.source_layer_id)out.source_layer_id=text(e.source_layer_id,120);
        if(e.type==='text')out.content=text(e.content||'');
        if(e.type==='image')out.mediaRef=id(e.mediaRef);
        return out;
      })};
    })};
    if(count>2500||JSON.stringify(result).length>1200000)throw Error('DECK_TOO_LARGE');return result;
  }
  function move(e,dx,dy){if(e.locked)return e;e.x=Math.round(Math.max(0,Math.min(1920-e.width,e.x+dx)));e.y=Math.round(Math.max(0,Math.min(1080-e.height,e.y+dy)));return e;}
  function resize(e,dw,dh,aspect=false){if(e.locked)return e;let w=Math.max(20,e.width+dw),h=Math.max(20,e.height+dh);if(aspect)h=w*e.height/e.width;const factor=Math.min(1,(1920-e.x)/w,(1080-e.y)/h);e.width=Math.round(w*factor);e.height=Math.round(h*factor);return e;}
  class History {
    constructor(state){this.reset(state);}
    reset(state){this.past=[];this.future=[];this.present=clone(state);}
    record(next){if(JSON.stringify(next)===JSON.stringify(this.present))return false;this.past.push(clone(this.present));if(this.past.length>80)this.past.shift();this.present=clone(next);this.future=[];return true;}
    undo(){if(!this.past.length)return clone(this.present);this.future.push(this.present);this.present=this.past.pop();return clone(this.present);}
    redo(){if(!this.future.length)return clone(this.present);this.past.push(this.present);this.present=this.future.pop();return clone(this.present);}
  }
  function copyWarnings(d){
    const rules=[[/아자몰\s*최초|최초\s*난각번호/g,'최초 상품 표현'],[/파일럿|시험판매|테스트\s*판매|\bSKU\b/g,'외부 카피 금지 용어'],[/면역|질병|당뇨|건강에\s*더|영양이\s*더/g,'건강·영양 우월성 근거 확인'],[/공급단가\s*[:：]?\s*\d|정산계좌|350\s*원/g,'내부 정산값 노출 가능성']];
    const out=[];d.slides.forEach(s=>{const t=s.elements.filter(e=>e.type==='text').map(e=>e.content).join(' ');for(const [r,label]of rules){r.lastIndex=0;if(r.test(t))out.push(s.slide_id+': '+label);}});return out;
  }
  return {clone,validateDeck,move,resize,History,copyWarnings};
})();
