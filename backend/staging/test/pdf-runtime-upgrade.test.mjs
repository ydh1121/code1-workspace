import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {requestDocument} from '../../../scripts/pdf-entry.js';

test('jsPDF 4 runtime generates CODE1 request PDF with bundled Korean font', async () => {
  const fontBytes = await readFile(new URL('../../../public/assets/RequestFont.ttf', import.meta.url));
  const fontData = fontBytes.toString('base64');
  const pdf = await requestDocument({
    name: 'CODE1 테스트 농가',
    items: [
      {section_name: '농장 정보', item_label: '농장 전경 사진', input_type: 'SHOT'},
      {section_name: '상품 정보', item_label: '대표 상품 설명', input_type: 'text'}
    ],
    due: '2026-09-30',
    contact: 'CODE1',
    note: '보안 의존성 업그레이드 PDF smoke test'
  }, fontData);

  assert.equal(typeof pdf.getNumberOfPages, 'function');
  assert.ok(pdf.getNumberOfPages() >= 1);

  const bytes = new Uint8Array(pdf.output('arraybuffer'));
  assert.ok(bytes.length > 1000, `expected non-trivial PDF bytes, got ${bytes.length}`);
  const magic = Buffer.from(bytes.subarray(0, 5)).toString('ascii');
  assert.equal(magic, '%PDF-');
});
