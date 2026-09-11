export const DECK_ID='CODE1_AZA_INTERNAL';
export const DECK_STATUS='INTERNAL WORKING COPY';

const finite=(x,min,max)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)throw Error('INVALID_GEOMETRY');return x;};
const text=(x,max=10000)=>{if(typeof x!=='string'||x.length>max)throw Error('INVALID_TEXT');return x;};
const id=x=>{text(x,100);if(!/^[A-Za-z0-9_-]+$/.test(x))throw Error('INVALID_ID');return x;};
const color=x=>{if(!/^#[a-fA-F0-9]{6}$/.test(x))throw Error('INVALID_COLOR');return x;};
const choice=(v,a)=>{if(!a.includes(v))throw Error('INVALID_OPTION');return v;};

function style(s={}){
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

function background(b={}){
  const out={
    color:color(b.color||'#FFFFFF'),
    opacity:finite(b.opacity??1,0,1),
    overlayColor:color(b.overlayColor||'#FFFFFF'),
    overlayOpacity:finite(b.overlayOpacity??0,0,1),
    fit:choice(b.fit||'cover',['cover','contain']),
    position:choice(b.position||'center',['center','top','bottom','left','right']),
    zoom:finite(b.zoom??1,1,3)
  };
  if(b.mediaRef)out.mediaRef=id(b.mediaRef);
  return out;
}

export function validateDeck(d){
  if(!d||!Array.isArray(d.slides)||!d.slides.length||d.slides.length>40)throw Error('INVALID_DECK');
  let count=0;const ids=new Set();
  const result={
    deck_id:id(d.deck_id),
    version:Number(d.version)||0,
    version_label:text(d.version_label||'v0.1',30),
    status:DECK_STATUS,
    slides:d.slides.map(s=>{
      if(!Array.isArray(s.elements)||s.elements.length>180)throw Error('TOO_MANY_ELEMENTS');
      const sid=id(s.slide_id);if(ids.has(sid))throw Error('DUPLICATE_ID');ids.add(sid);
      return {
        slide_id:sid,
        width:1920,
        height:1080,
        background:background(s.background),
        elements:s.elements.map(e=>{
          const eid=id(e.element_id);if(ids.has(eid))throw Error('DUPLICATE_ID');ids.add(eid);count++;
          const out={
            element_id:eid,
            type:choice(e.type,['text','image','shape']),
            x:finite(e.x,0,1920),
            y:finite(e.y,0,1080),
            width:finite(e.width,1,1920),
            height:finite(e.height,1,1080),
            z:finite(e.z,-1000,10000),
            locked:e.locked===true,
            style:style(e.style)
          };
          if(out.x+out.width>1920.1||out.y+out.height>1080.1)throw Error('ELEMENT_OUTSIDE_SLIDE');
          if(e.source_layer_id)out.source_layer_id=text(e.source_layer_id,120);
          if(e.type==='text')out.content=text(e.content||'');
          if(e.type==='image')out.mediaRef=id(e.mediaRef);
          return out;
        })
      };
    })
  };
  if(count>2500||JSON.stringify(result).length>1200000)throw Error('DECK_TOO_LARGE');
  return result;
}

export function collectDeckAssetRefs(deck){
  const d=validateDeck(deck);
  const refs=new Set();
  for(const slide of d.slides){
    if(slide.background.mediaRef)refs.add(slide.background.mediaRef);
    for(const element of slide.elements)if(element.type==='image')refs.add(element.mediaRef);
  }
  return [...refs].sort();
}

export function prepareDeckSave(deck,{nextVersion,versionLabel,savedAt,savedBy}={}){
  const d=validateDeck(deck);
  if(d.deck_id!==DECK_ID)throw Error('INVALID_DECK');
  if(!Number.isInteger(nextVersion)||nextVersion<1)throw Error('INVALID_DECK_VERSION');
  if(typeof versionLabel!=='string'||!versionLabel||versionLabel.length>30)throw Error('INVALID_DECK_VERSION_LABEL');
  if(typeof savedAt!=='string'||!savedAt)throw Error('INVALID_SAVED_AT');
  if(typeof savedBy!=='string'||!savedBy)throw Error('INVALID_SAVED_BY');
  d.version=nextVersion;
  d.version_label=versionLabel;
  d.status=DECK_STATUS;
  d.updated_at=savedAt;
  d.saved_by=savedBy;
  const payloadText=JSON.stringify(d);
  if(payloadText.length>1200000)throw Error('DECK_TOO_LARGE');
  return {deck:d,payloadText,assetRefs:collectDeckAssetRefs(d)};
}
