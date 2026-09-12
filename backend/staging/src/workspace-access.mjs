import {parsePermissions} from './core.mjs';

export const ACCESS_CAPABILITIES=Object.freeze([
  'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
  'FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT',
  'PLANNING_EDIT','PLANNING_FEEDBACK','ACCOUNT_MANAGE','INPUT_POLICY_MANAGE',
  'EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT'
]);

export const ACCESS_CATALOG=Object.freeze([
  {group:'페이지',items:[
    ['PAGE_FARM','농가 자료','농가 자료 페이지를 표시합니다.'],
    ['PAGE_DECK','아자몰 제안서','제안서 페이지를 표시합니다.'],
    ['PAGE_PLANNING','경영·기획','경영 브리프·기획문서·피드백 페이지를 표시합니다.'],
    ['PAGE_INPUT_POLICY','입력 항목 관리','입력 항목 정책 관리 페이지를 표시합니다.'],
    ['PAGE_ACCOUNTS','계정','내 계정 또는 계정 관리 페이지를 표시합니다.']
  ]},
  {group:'농가 자료',items:[
    ['FARM_EDIT','농가 자료 입력·업로드','농가 답변 입력, 임시저장, 제출, 미디어 업로드를 허용합니다.'],
    ['FARM_REVIEW','농가 자료 검토','제출 자료와 미디어의 관리자 검토를 허용합니다.']
  ]},
  {group:'아자몰 제안서',items:[
    ['DECK_EDIT','제안서 편집·저장','웹덱 편집과 새 버전 저장을 허용합니다.'],
    ['DECK_EXPORT','제안서 PDF·인쇄','PDF 내보내기와 인쇄를 허용합니다.']
  ]},
  {group:'경영·기획',items:[
    ['PLANNING_EDIT','기획문서 수정','기획문서 Working Copy를 새 revision으로 저장합니다.'],
    ['PLANNING_FEEDBACK','경영진 피드백','기획문서 전체 또는 섹션에 피드백을 남깁니다.'],
    ['EXECUTIVE_BRIEF_VIEW','Executive Brief 조회','승인된 Executive Brief를 조회합니다.'],
    ['FACT_SUBMIT','Fact 접수','검증할 사업 Fact를 접수합니다.'],
    ['FACT_VERIFY','Fact 검증','증빙 요청·수신·검증 상태를 처리합니다.'],
    ['FACT_APPROVE_CURRENT','Fact 현재값 승인','검증된 Fact를 현재 승인값으로 확정합니다.']
  ]},
  {group:'관리',items:[
    ['ACCOUNT_MANAGE','계정 관리','계정 생성·수정·삭제와 권한 저장을 허용합니다.'],
    ['INPUT_POLICY_MANAGE','입력 항목 정책 수정','입력 항목 노출·수집 정책을 수정합니다.']
  ]}
]);

const capSet=rows=>new Set((rows||[]).filter(row=>row.effect==='ALLOW').map(row=>row.capability));

function legacyCapabilities(actor){
  const out=new Set(['PAGE_ACCOUNTS']);
  if(actor.row.role==='ADMIN'){
    ['PAGE_FARM','PAGE_DECK','PAGE_INPUT_POLICY','FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT','ACCOUNT_MANAGE','INPUT_POLICY_MANAGE'].forEach(x=>out.add(x));
    return out;
  }
  if(actor.row.role==='FARMER'){
    const p=parsePermissions(actor.row.permissions_json);
    if(p.farm!=='none')out.add('PAGE_FARM');
    if(p.farm==='edit')out.add('FARM_EDIT');
    if(p.deck!=='none'){out.add('PAGE_DECK');out.add('DECK_EXPORT');}
    if(p.deck==='edit')out.add('DECK_EDIT');
  }
  return out;
}

export async function resolveWorkspaceAccess(db,actor){
  if(actor.row.account_id==='OWNER'&&actor.row.role==='SUPER_ADMIN'){
    return {initialized:true,owner:true,capabilities:new Set(ACCESS_CAPABILITIES)};
  }
  const rows=await db.select('account_capabilities',`account_id=eq.${encodeURIComponent(actor.row.account_id)}&select=capability,effect`);
  const explicit=capSet(rows),initialized=explicit.has('ACCESS_PROFILE_INITIALIZED');
  return {initialized,owner:false,capabilities:initialized?explicit:legacyCapabilities(actor)};
}

export function accessHas(profile,capability){return !!profile?.capabilities?.has(capability);}
export function requireWorkspaceAccess(profile,capability){if(!accessHas(profile,capability))throw Error('FORBIDDEN');}

export function effectiveUserPermissions(actor,profile){
  const original=actor.user.permissions;
  let farm=accessHas(profile,'PAGE_FARM')?original.farm:'none';
  let deck=accessHas(profile,'PAGE_DECK')?original.deck:'none';
  if(farm==='edit'&&!accessHas(profile,'FARM_EDIT'))farm='view';
  if(deck==='edit'&&!accessHas(profile,'DECK_EDIT'))deck='view';
  return {...original,farm,deck};
}

export function publicAccess(profile){
  return {
    initialized:!!profile.initialized,
    owner:!!profile.owner,
    allowed:[...profile.capabilities].filter(x=>ACCESS_CAPABILITIES.includes(x)).sort()
  };
}
