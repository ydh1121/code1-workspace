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

test('unknown runtime failures remain generic HTTP 400', async () => {
  const response=failure(Error('SOME_UNMAPPED_RUNTIME_FAILURE'));
  assert.equal(response.status,400);
  assert.equal((await response.json()).error,'REQUEST_FAILED');
});
