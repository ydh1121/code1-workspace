import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Window} from 'happy-dom';

function fixture(){
  const w=new Window({url:'https://qa.example.test',settings:{disableCSSFileLoading:true,disableJavaScriptFileLoading:true}});
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.document.body.innerHTML=`
    <input id="farm-name" value="정어네농장">
    <section id="media-panel">
      <h2>사진·영상과 사용권</h2><p class="muted">안내</p>
      <label>촬영 항목<select id="shot-select">
        <option value="PHOTO-P01">포장 정면</option>
        <option value="PHOTO-F01">농장 전경 — Wide</option>
        <option value="PHOTO-W03">선별 과정 — Wide</option>
        <option value="PHOTO-H01">농장주 정면 Portrait</option>
        <option value="VIDEO-09">농장주 한 문장 인터뷰</option>
      </select></label>
      <div id="shot-guide" class="shot-guide">촬영 가이드</div>
      <form id="media-form">
        <div class="fields-grid">
          <label>설명<textarea id="media-caption"></textarea></label>
          <label>촬영자<input id="media-photographer"></label>
          <label>촬영일<input type="date" id="media-date"></label>
          <label>원본 권리자<input id="media-rights"></label>
          <label>인물 얼굴 포함<select id="media-face"><option>미확인</option></select></label>
          <label>인물 사용 동의<select id="media-consent"><option>미확인</option></select></label>
          <label>제안서 사용권<select id="media-usage"><option>미확인</option></select></label>
          <label>개인정보 확인<select id="media-privacy"><option>미확인</option></select></label>
        </div>
        <details><summary>추가 사용권 확인</summary><div class="fields-grid"></div></details>
        <label>원본 파일<input type="file" id="media-file"></label>
        <button type="submit" class="primary">비공개 원본 업로드</button>
        <button type="button" id="link-drive">Drive 연결</button>
        <output id="media-status"></output>
      </form>
      <div id="media-list"></div>
    </section>`;
  w.eval(fs.readFileSync('public/assets/media-ux.js','utf8'));
  return w;
}

test('media upload UX replaces long select with grouped searchable shot cards',async()=>{
  const w=fixture();
  try{
    const d=w.document;
    assert.ok(d.getElementById('media-shot-picker'));
    assert.ok(d.querySelector('label.media-native-shot-select'));
    assert.equal(d.querySelectorAll('.media-shot-card').length,1); // defaults to selected product group
    const farmTab=[...d.querySelectorAll('.media-shot-group')].find(b=>b.dataset.group==='farm');
    farmTab.click();
    assert.equal(d.querySelectorAll('.media-shot-card').length,1);
    const farmCard=d.querySelector('.media-shot-card');
    assert.equal(farmCard.dataset.shot,'PHOTO-F01');
    farmCard.click();
    assert.equal(d.getElementById('shot-select').value,'PHOTO-F01');
    assert.match(d.getElementById('media-selected-title').textContent,/농장 전경/);
    assert.match(d.getElementById('media-storage-preview').textContent,/정어네농장/);
    assert.match(d.getElementById('media-storage-preview').textContent,/02_농장·환경/);
    assert.match(d.querySelector('#media-form button[type="submit"]').textContent,/농장 전경/);
  }finally{await w.happyDOM.close();}
});

test('media shot search finds items across categories and keeps native select synchronized',async()=>{
  const w=fixture();
  try{
    const d=w.document,search=d.getElementById('media-shot-search');
    search.value='인터뷰';search.dispatchEvent(new w.Event('input',{bubbles:true}));
    const cards=d.querySelectorAll('.media-shot-card');assert.equal(cards.length,1);assert.equal(cards[0].dataset.shot,'VIDEO-09');
    cards[0].click();
    assert.equal(d.getElementById('shot-select').value,'VIDEO-09');
    assert.match(d.getElementById('media-storage-preview').textContent,/02_영상/);
    assert.match(d.getElementById('media-storage-preview').textContent,/03_인터뷰/);
  }finally{await w.happyDOM.close();}
});
