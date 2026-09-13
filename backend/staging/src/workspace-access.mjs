import {parsePermissions} from './core.mjs';

export const ACCESS_CAPABILITIES=Object.freeze([
  'PAGE_FARM','PAGE_DECK','PAGE_PLANNING','PAGE_PLANNING_MATERIALS','PAGE_INPUT_POLICY','PAGE_ACCOUNTS',
  'FARM_EDIT','FARM_REVIEW','DECK_EDIT','DECK_EXPORT',
  'PLANNING_EDIT','PLANNING_FEEDBACK',
  'MATERIAL_REQUEST_MANAGE','MATERIAL_REVIEW','MATERIAL_TEMPLATE_MANAGE','MATERIAL_UPLOAD_ASSIGNED',
  'ACCOUNT_MANAGE','INPUT_POLICY_MANAGE',
  'EXECUTIVE_BRIEF_VIEW','FACT_SUBMIT','FACT_VERIFY','FACT_APPROVE_CURRENT'
]);

export const ACCESS_CATALOG=Object.freeze([
  {group:'페이지',items:[
    ['PAGE_FARM','농가 자료','농가 자료 화면을 볼 수 있습니다.'],
    ['PAGE_DECK','아자몰 제안서','아자몰 제안서 화면을 볼 수 있습니다.'],
    ['PAGE_PLANNING','경영·기획','기획문서, 해야 할 일, 사업 정보 등 경영·기획 화면을 볼 수 있습니다.'],
    ['PAGE_PLANNING_MATERIALS','상세페이지 및 제안서 파일','상세페이지·납품 제안서용 자료요청 화면을 볼 수 있습니다.'],
    ['PAGE_INPUT_POLICY','입력 항목 관리','농가 자료의 입력 항목 관리 화면을 볼 수 있습니다.'],
    ['PAGE_ACCOUNTS','계정','내 계정 또는 계정 관리 화면을 볼 수 있습니다.']
  ]},
  {group:'농가 자료 기능',items:[
    ['FARM_EDIT','농가 자료 입력·업로드','농가 답변을 입력하고 임시저장·제출하거나 사진·파일을 업로드할 수 있습니다.'],
    ['FARM_REVIEW','농가 자료 검토','제출된 농가 자료와 첨부파일을 확인하고 검토 상태를 처리할 수 있습니다.']
  ]},
  {group:'아자몰 제안서 기능',items:[
    ['DECK_EDIT','제안서 편집·저장','웹 제안서를 수정하고 새 버전으로 저장할 수 있습니다.'],
    ['DECK_EXPORT','제안서 PDF·인쇄','제안서를 PDF로 내보내거나 인쇄할 수 있습니다.']
  ]},
  {group:'경영·기획 기능',items:[
    ['PLANNING_EDIT','기획문서 수정','기획문서를 수정하고 새 revision으로 저장할 수 있습니다.'],
    ['PLANNING_FEEDBACK','경영진 피드백','기획문서 전체 또는 특정 섹션에 의견을 남길 수 있습니다.'],
    ['MATERIAL_REQUEST_MANAGE','자료요청 만들기·담당자 배정','상세페이지나 납품 제안서 제작에 필요한 자료요청을 만들고, 제출 담당 계정을 지정·변경할 수 있습니다.'],
    ['MATERIAL_REVIEW','제출 자료 검토','제출된 입력 내용과 첨부파일을 확인하고 보완 요청·검증 완료·반려 상태를 처리할 수 있습니다.'],
    ['MATERIAL_TEMPLATE_MANAGE','요청 항목 구성 관리','자료요청에 표시할 항목을 분류별로 추가·이름 변경·순서 변경하고 필수 여부와 사용 여부를 설정할 수 있습니다.'],
    ['EXECUTIVE_BRIEF_VIEW','승인된 경영 브리프 보기','승인된 요약 보고서(Executive Brief)를 볼 수 있습니다.'],
    ['FACT_SUBMIT','사업 정보 등록','검증이 필요한 사업 정보(Fact)를 등록할 수 있습니다.'],
    ['FACT_VERIFY','사업 정보 검증','사업 정보에 필요한 증빙을 요청하고 받은 자료를 확인해 검증 상태를 변경할 수 있습니다.'],
    ['FACT_APPROVE_CURRENT','현재값 확정','검증이 끝난 사업 정보를 현재 기준값으로 확정할 수 있습니다.']
  ]},
  {group:'자료 제출 권한',items:[
    ['MATERIAL_UPLOAD_ASSIGNED','배정받은 자료 제출','자신에게 배정된 자료요청만 열어 내용을 입력하고 파일을 첨부할 수 있습니다. 다른 경영·기획 화면이나 다른 사람의 요청은 볼 수 없습니다.']
  ]},
  {group:'관리 기능',items:[
    ['ACCOUNT_MANAGE','계정 관리','계정을 만들거나 수정·삭제하고 접근 권한을 저장할 수 있습니다.'],
    ['INPUT_POLICY_MANAGE','입력 항목 정책 수정','농가 자료에서 어떤 입력 항목을 표시하고 수집할지 변경할 수 있습니다.']
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
  // PARTNER intentionally receives no business page from legacy fallback.
  // OWNER must initialize an explicit access profile before assigned request upload is available.
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
