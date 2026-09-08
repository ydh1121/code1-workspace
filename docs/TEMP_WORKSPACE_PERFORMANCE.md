# CODE1 임시 내부웹 성능·이관 경계 v0.3

상태: ACTIVE / 3차 LIVE QA PENDING / 2026-09-08
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

## 2026-09-08 성능 개선 1차

### 세션 복구

- `/api/session`은 Cloudflare edge에서 서명 세션만 확인한다.
- 계정 상태, 권한, `session_version`은 첫 실제 데이터 요청에서 다시 검증한다.

### Apps Script 전역 Lock

- nonce 재사용 방지만 짧게 lock.
- 조회는 장시간 전역 write lock을 잡지 않는다.
- mutation은 기존 serialized write lock을 유지한다.

### 농가 이미지 N+1 완화

- 같은 렌더 주기의 media read를 최대 32개 batch로 합친다.
- 브라우저 세션 동안 받은 media 응답을 메모리 캐시한다.
- 이미지에 lazy loading/async decoding을 적용한다.

사용자 체감: 개선이 명확하지 않음. PASS 아님.

## 2026-09-08 성능 개선 2차 — 폐기/부분 유지

2차에서는 Apps Script 왕복을 줄이기 위해 deck/catalog 결과를 `CacheService`에 chunked JSON으로 저장하고 bootstrap에 정책까지 합쳤다. PDF runtime 지연 로딩도 추가했다.

사용자 체감: 여전히 느리고 오히려 조금 더 느려진 느낌이라고 피드백함. 따라서 2차 CacheService 전략은 성능 개선으로 채택하지 않는다.

유지하는 부분:

- edge-local session restore
- read/write lock 분리
- media batch/cache
- PDF runtime lazy load

폐기하는 부분:

- 대형 deck JSON의 chunked CacheService read/write
- catalog CacheService read/write
- 농가 화면 bootstrap에서 deck을 함께 구성하는 방식

## 2026-09-08 성능 개선 3차

사용자가 실제 느린 구간을 `로그인`, `농가 입력화면`, `입력 항목 관리`라고 특정했고 제안서 편집은 열지 않았다고 확인했다. 따라서 제안서 UI 자체는 병목 판정에서 제외하고 초기 bootstrap 경계를 재설계했다.

### 1. bootstrap에서 제안서 완전 제외

`performanceBootstrap_()`은 이제 다음만 반환한다.

- 현재 계정/권한
- 농가 선택 목록
- 제출 요약
- 질문 카탈로그
- 적용 질문 정책

`deck`은 `null`이며 `loadDeck_()`을 호출하지 않는다.

프런트도 로그인 직후 `deckAssets`를 자동 요청하지 않는다. 사용자가 실제 `아자몰 제안서` 메뉴를 눌렀을 때만 신규 `deckBootstrap` read로 deck + 참조 asset을 한 번에 가져온다.

목적: 농가 업무만 하는 사용자가 12장 제안서 Sheet 조립과 제안서 이미지 read 비용을 전혀 지불하지 않게 한다.

### 2. Apps Script 대형 CacheService 제거

`PerformanceRead.gs` v4에서 deck/catalog chunk cache를 제거했다. 현재 데이터량의 임시웹에서 JSON stringify/chunk put/get 비용이 실제 Sheet read 절감보다 더 클 가능성을 제거한다.

### 3. 농가 선택 목록 중복 scan 감소

기존 `accessFarmChoices_()`는 `farms_()`와 `commits_()`를 모두 다시 읽었다. 3차 bootstrap은 이미 읽은 submission summaries를 재사용하고 `farms_()`만 결합하여 농가 선택 목록을 만든다.

### 4. 제출 상세 조회 중복 scan 감소

기존 `getSubmission` 권한 검사는 `latest_()`로 한 번 읽고, 이후 `getSubmission_()`에서 다시 제출 자료를 읽을 수 있었다.

`performanceGetSubmission_()`은 먼저 상세 자료를 한 번 읽고 반환된 `farmId`로 권한을 검사한다. 권한 fail-closed 의미는 유지하면서 별도 `latest_()` 선행 scan을 제거한다.

### 5. 입력 항목 관리 추가 왕복 제거

최고 관리자/서브 관리자 bootstrap 시 현재 질문 정책과 사유 목록을 함께 반환하고 `questionPolicyPrefetched=true`로 표시한다.

`farm-model.js`는 이 데이터를 즉시 정책 관리 화면 데이터로 재사용한다. 따라서 `입력 항목 관리` 첫 진입에서 `questionPolicy.list`를 다시 Apps Script로 호출하지 않는다. 구버전 bridge 또는 prefetch 실패 시 기존 list 요청 fallback은 유지한다.

### 6. 질문 정책 lookup index

기존에는 진행률/카테고리 렌더 때 질문마다 `Array.find()`로 정책 row를 반복 탐색했다. 이제 `scope|farmId|itemKey` Map index를 만들어 일반 lookup을 O(1)로 처리한다.

### 7. 농가 첫 렌더 중복 계산 제거

기존 `renderFarm()`은 `renderGroupNavigation()` 호출 후 `renderCategory()`를 호출했고 `renderCategory()` 내부에서 다시 `renderGroupNavigation()`을 실행했다. 첫 렌더의 중복 호출을 제거했다.

### 8. 질문 도움말 DOM observer 완화

`question-help.js`의 MutationObserver는 mutation마다 즉시 전체 질문 도움말을 다시 순회하지 않고 requestAnimationFrame당 최대 한 번만 처리한다.

## 아직 남아 있는 로그인 병목 후보

비밀번호 로그인은 현재 구조상 Apps Script를 최소 두 번 사용한다.

1. `auth.begin`: 로그인 throttle + credential ticket
2. `auth.finish`: 검증 결과 확인 + 세션용 계정 반환
3. 로그인 성공 후 별도 `bootstrap`: 업무 데이터 로드

또한 `accessAuthBegin_()`은 `21_WEB_LOGIN_GUARD`를 IP와 username 각각 처리하면서 시트를 반복 읽고 쓸 수 있고, `accessAuthFinish_()`도 계정 row를 읽은 뒤 `accessAccount_()`에서 계정 시트를 다시 읽는다.

3차 배포 후에도 **로그인 자체**가 느리면 다음 작업은 캐시가 아니라 이 auth 경로를 합치는 것이다.

후보:

- 로그인 guard sheet 1회 read/write로 IP/user throttle 함께 처리
- `auth.finish`의 계정 중복 read 제거
- 성공한 `auth.finish` 실행 안에서 lightweight farm bootstrap까지 반환하여 로그인 성공 뒤 세 번째 Apps Script cold start 제거

이 변경은 인증 계약을 건드리므로 3차 LIVE QA 이후 독립 회귀 작업으로 진행한다.

## 현재 비목표

- Supabase/R2/회사 서버로 실제 이전
- 공개 웹용 CDN 자산 발행
- 원본 Drive 파일 공개
- Production Admin 구축
- 농가/회원/결제 등 상용 DB 스키마 확정
- Apps Script 데이터 계층 전면 재작성

상용 수준 성능을 만들기 위해 임시 Apps Script를 과도하게 고도화하지 않는다. 임시웹에 필요한 수준을 넘는 병목은 정식 관리자 서버 이관 단계에서 해결한다.

## 정식 관리자단 이전 시 유지할 논리 계약

- `account_id`
- `farm_id`
- `submission_id`
- `item_key`
- `upload_id`
- `shot_code`
- deck/slide/element logical IDs

영구 계약으로 사용하지 않는 값:

- Google Sheet row number
- Drive folder path
- Drive 파일의 실제 저장 파일명
- Apps Script deployment URL
- Apps Script CacheService key

정식 관리자단에서는 인증/권한, 업무 DB, 미디어 asset registry, 원본/공개 저장소를 서버 계층으로 분리한다.

## 공개 미디어의 미래 경계

현재 Drive 파일명은 내부 원본 추적용이다. 상용 웹은 Drive 파일명이나 Drive URL을 직접 참조하지 않는다.

향후 개념:

- source asset: 원본 및 감사용
- asset registry: `asset_id`, `farm_id`, 역할, 권리, 검증상태, checksum, version
- published asset: 검증 후 웹/CDN에 발행된 별도 객체

상용 저장소 선택과 R2/Supabase 비용 검토는 Production Admin 설계 단계에서 별도 결정한다.

## 3차 배포/검증 상태

GitHub `main` 구현 완료. 실제 Apps Script에는 최신 두 파일만 다시 반영하면 된다.

- `bridge/PerformanceRead.gs` v4
- `bridge/CloudflareBridge.gs`

Cloudflare Pages는 최신 main에서 `app.js`, `farm-model.js`, `question-help.js`, `functions/api/rpc.js`가 자동 배포되어야 한다.

실사이트에서 확인할 항목:

1. 로그인 후 농가 화면 표시 시간
2. 기존 농가 클릭 후 질문 5개가 나타날 때까지 시간
3. `입력 항목 관리` 클릭 후 정책 목록 표시 시간
4. 농가 ↔ 입력 항목 관리 반복 전환 시 두 번째부터 추가 서버 대기가 없는지
5. 아자몰 제안서를 열지 않은 상태에서 `deckBootstrap/deckAssets` 요청이 발생하지 않는지

현재 실행환경에서는 로컬 `npm test`/`npm run build`를 재실행하지 못했다. 정적 회귀 테스트는 3차 구조에 맞게 갱신했지만 LIVE/CI PASS로 기록하지 않는다.
