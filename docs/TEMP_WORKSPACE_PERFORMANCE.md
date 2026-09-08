# CODE1 임시 내부웹 성능·이관 경계 v0.1

상태: ACTIVE / 2026-09-08
대상: CODE1 Internal Workspace

## 전제

이 웹은 상용 관리자단이 아니다. 현재 목적은 내부 관계자가 농가 자료를 수집·검토하고 아자몰 제안서를 다루는 임시 운영 도구다.

현재 구조:

- UI/edge: Cloudflare Pages + Functions
- 인증 세션: Cloudflare 서명 쿠키 + Apps Script 계정 재검증
- 업무 데이터: Google Sheets
- 원본 미디어: Google Drive
- 업무 로직: 기존 Apps Script `Server.gs / Media.gs / Deck.gs` + 연결 레이어

향후 상용 단계에서는 이 임시 관리자단을 정식 회사 관리 서버/관리자 시스템으로 이전한다. 현재 Apps Script/Sheet/Drive 구현 자체를 영구 인프라로 간주하지 않는다.

## 2026-09-08 성능 개선

### 1. 세션 복구

이전에는 `/api/session` 호출마다 Apps Script `account.self`를 다시 호출했다.

변경 후:

- `/api/session`은 Cloudflare edge에서 서명 세션만 확인한다.
- 계정 상태, 권한, `session_version`은 첫 실제 데이터 요청(`bootstrap` 등)에서 다시 검증한다.
- 계정 중지/권한 변경 보안 규칙은 데이터 접근 시 그대로 fail-closed다.

목적: 로그인 화면 복구와 새로고침에서 불필요한 Google 왕복 제거.

### 2. Apps Script 전역 Lock

이전에는 read와 write가 모두 긴 `withLock_()` 구간에 들어갔다.

변경 후:

- nonce 재사용 방지 부분만 짧게 lock.
- 조회(`bootstrap`, `getSubmission`, `media`, `mediaBatch`, `deckAssets`, 계정/정책 조회)는 장시간 전역 write lock을 잡지 않는다.
- 저장/검토/계정 변경/정책 변경 등 mutation은 기존대로 serialized write lock을 유지한다.

목적: 이미지 조회와 화면 bootstrap이 서로 줄을 서는 현상 완화.

### 3. bootstrap 병렬화

`bootstrap`과 `questionPolicy.effective`를 Cloudflare Function에서 병렬 호출한다.

질문 정책 기능이 실패해도 기존 fallback 규칙을 유지한다.

### 4. 농가 이미지 N+1 완화

`PerformanceRead.gs`의 `mediaBatch`를 추가했다.

- 브라우저에서 같은 렌더 주기에 발생하는 개별 `media` 요청을 최대 32개까지 한 batch로 합친다.
- 각 media ID는 기존 `accessMediaRow_()`로 권한을 다시 검사한다.
- 브라우저 세션 동안 이미 받은 media 응답은 메모리 캐시해 같은 화면 재렌더 시 Apps Script를 다시 호출하지 않는다.
- `<img loading="lazy" decoding="async">`를 적용한다.

원본 Drive 접근권한 정책 자체는 변경하지 않는다.

## 현재 비목표

이번 단계에서는 아래를 하지 않는다.

- Supabase/R2/회사 서버로 실제 이전
- 공개 웹용 CDN 자산 발행
- 원본 Drive 파일 공개
- Production Admin 구축
- 농가/회원/결제 등 상용 DB 스키마 확정
- Apps Script 데이터 계층 전면 재작성

## 정식 관리자단 이전 시 유지할 논리 계약

현재 임시 구현에서 다음 식별자는 저장소 교체 후에도 연결 키로 유지할 가치가 있다.

- `account_id`
- `farm_id`
- `submission_id`
- `item_key`
- `upload_id`
- `shot_code`
- deck/slide/element logical IDs

반대로 다음은 영구 계약으로 사용하지 않는다.

- Google Sheet row number
- Drive folder path
- Drive 파일의 사람이 읽는 실제 파일명
- Apps Script deployment URL
- Apps Script CacheService key

정식 관리자단에서는 인증/권한, 업무 DB, 미디어 asset registry, 원본/공개 저장소를 서버 측 계층으로 분리한다.

## 공개 미디어의 미래 경계

현재 Drive 파일명은 내부 원본 추적용이다. 상용 웹은 Drive 파일명이나 Drive URL을 직접 참조하지 않는다.

향후에는 다음 개념을 별도 관리한다.

- source asset: 원본 및 감사용
- asset registry: `asset_id`, `farm_id`, 역할, 권리, 검증상태, checksum, version
- published asset: 검증 후 웹/CDN에 발행된 별도 객체

상용 저장소 선택과 R2/Supabase 비용 검토는 Production Admin 설계 단계에서 별도 결정한다.

## 남은 성능 작업

1. 실사이트에서 로그인/새로고침/농가 열기/사진 5~20장 표기 시간을 측정한다.
2. 이번 read-lock/mediaBatch 효과를 확인한다.
3. 제안서 `deckAssets`는 아직 최초 bootstrap 직후 eager load다. 실제 측정에서 병목이면 다음 독립 변경으로 lazy-load한다.
4. PDF bundle 등 큰 정적 자산의 초기 다운로드가 병목이면 기능 진입 시 dynamic import/load로 분리한다.
5. Apps Script 자체의 Sheet 전수 스캔이 병목으로 남으면 단기 cache/index를 추가하되, 정식 서버 이전 시 폐기 가능한 임시 최적화로 한정한다.

## 배포/검증 상태

GitHub main 구현 완료. 실제 Apps Script에는 최신 `CloudflareBridge.gs`와 신규 `PerformanceRead.gs` 반영이 필요하다.

현재 실행환경에서는 github.com DNS 해석 실패로 `npm test` / `npm run build` 재실행이 불가능했다. 따라서 LIVE/CI PASS로 기록하지 않는다.
