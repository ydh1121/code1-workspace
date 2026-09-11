import test from 'node:test';
import assert from 'node:assert/strict';
import {failure} from '../../../functions/_shared/security.js';

test('NOT_FOUND maps to HTTP 404 with stable error code', async () => {
  const response=failure(Error('NOT_FOUND'));
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{
    error:'NOT_FOUND',
    message:'요청한 항목을 찾을 수 없습니다.'
  });
});

test('DECK_WRITE_GATE_CLOSED keeps an explicit emergency read-only HTTP contract', async () => {
  const response=failure(Error('DECK_WRITE_GATE_CLOSED'));
  assert.equal(response.status,503);
  assert.equal((await response.json()).error,'DECK_WRITE_GATE_CLOSED');
});

test('DECK_DRIVE_LINK_DISABLED explicitly prevents runtime fallback to live Drive', async () => {
  const response=failure(Error('DECK_DRIVE_LINK_DISABLED'));
  assert.equal(response.status,503);
  assert.deepEqual(await response.json(),{
    error:'DECK_DRIVE_LINK_DISABLED',
    message:'STAGING Deck에서는 기존 Drive 파일 연결을 사용하지 않습니다. 이미지는 직접 업로드해 주세요.'
  });
});

test('unknown runtime failures remain generic HTTP 400', async () => {
  const response=failure(Error('SOME_UNMAPPED_RUNTIME_FAILURE'));
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'REQUEST_FAILED');
});
