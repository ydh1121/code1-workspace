# CODE1 임시 내부웹 성능·이관 경계 v0.2

상태: ACTIVE / LIVE QA PENDING / 2026-09-08
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

### 1. 세션 복구

이전에는 `/api/session` 호출마다 Apps Script `account.self`를 다시 호출했다.

변경 후:

- `/api/session`은 Cloudflare edge에서 서명 세션만 확인한다.
- 계정 상태, 권한, `session_version`은 첫 실제 데이터 요청(`bootstrap` 등)에서 다시 검증한다.
- 계정 중지/권한 변경 보안 규칙은 데이터 접근 시 그대로 fail-closed다.

### 2. Apps Script 전역 Lock

- nonce 재사용 방지 부분만 짧게 lock.
- 조회(`bootstrap`, `getSubmission`, `media`, `mediaBatch`, `deckAssets`, 계정/정책 조회)는 장시간 전역 write lock을 잡지 않는다.
- 저장/검토/계정 변경/정책 변경 등 mutation은 기존대로 serialized write lock을 유지한다.

### 3. 농가 이미지 N+1 완화

`PerformanceRead.gs`의 `mediaBatch`를 추가했다.

- 같은 렌더 주기에 발생하는 개별 `media` 요청을 최대 32개까지 한 batch로 합친다.
- 각 media ID는 기존 권한을 다시 검사한다.
- 브라우저 세션 동안 이미 받은 media 응답은 메모리 캐시한다.
- `<img loading="lazy" decoding="async">`를 적용한다.

## 사용자 체감 피드백

1차 배포 후 사용자는 속도 개선 체감이 명확하지 않다고 피드백했다. 따라서 1차를 성능 PASS로 판정하지 않는다.

## 2026-09-08 성능 개선 2차

### 4. bootstrap 왕복 축소

이전 1차에서는 `bootstrap`과 `questionPolicy.effective`를 Cloudflare에서 병렬로 두 번 Apps Script 호출했다.

2차 변경 후:

- `performanceBootstrap_()` 한 번의 Apps Script 실행 안에서 계정/권한/농가/제출/질문카탈로그/제안서/질문정책을 구성한다.
- Cloudflare `functions/api/rpc.js`는 bootstrap 시 추가 bridge 호출을 하지 않는다.
- 질문 정책 실패 시 기존처럼 정책 기능만 fail-soft 처리하고 기본 업무 bootstrap은 유지한다.

목적: 네트워크 왕복 1회를 제거한다.

### 5. 제안서 read cache

기존 앱 UI 계약을 깨지 않기 위해 이번 단계에서는 제안서 자체를 bootstrap에서 제거하지 않는다. 대신 임시 Apps Script read cache를 둔다.

- `loadDeck_()` 결과를 5분 동안 chunked CacheService에 저장한다.
- `bootstrap`과 `deckAssets`가 같은 cached deck을 재사용한다.
- `saveDeck` 성공 직후 cache를 즉시 폐기한다.
- 캐시 크기 제한을 넘으면 자동으로 기존 uncached read로 동작한다.

이 캐시는 임시 내부웹 전용이며 정식 관리자 서버의 영구 설계가 아니다.

### 6. 질문 카탈로그 read cache

231개 질문 카탈로그는 2분짜리 read cache를 적용한다. 원본 Sheet는 계속 정본이며 cache는 읽기 가속용이다.

### 7. PDF 런타임 지연 로딩

기존에는 앱 초기 진입 시 jsPDF 번들을 항상 생성/다운로드/파싱했다.

변경 후 빌드 산출물:

- `pdf.bundle.js`: 아주 작은 loader
- `pdf.runtime.js`: 실제 jsPDF runtime

사용자가 농가 자료 요청서 PDF 기능을 실제 실행할 때만 runtime을 추가 로드한다. 일반 농가 입력/사진 업무에서는 PDF runtime 초기 비용을 지불하지 않는다.

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
- Drive 파일의 실제 저장 파일명
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

1. 2차 배포 후 로그인/새로고침/농가 열기/사진 5~20장 표기 시간을 실제 사용 체감으로 재확인한다.
2. 그래도 느리면 Apps Script `listSubmissions_`, `farms_`, `commits_` 계열의 전수 Sheet scan을 계측·단기 index/cache 대상으로 검토한다.
3. 제안서 자체를 bootstrap에서 완전히 빼는 true lazy-load는 `app.js` 상태 구조 변경이 필요하므로 별도 회귀 작업으로 진행한다.
4. 상용 수준 성능을 위해 임시 Apps Script 구조를 과도하게 고도화하지 않는다. 성능 한계가 명확해지면 정식 관리자 서버 이관 시 해결한다.

## 배포/검증 상태

GitHub main 구현 완료. 실제 Apps Script에는 최신 `CloudflareBridge.gs`와 최신 `PerformanceRead.gs` 반영이 필요하다.

Cloudflare Pages는 최신 main build에서 PDF loader/runtime 분리가 적용되어야 한다.

현재 실행환경에서는 github.com DNS 해석 실패로 `npm test` / `npm run build` 재실행이 불가능했다. 정적 회귀 테스트는 갱신했지만 LIVE/CI PASS로 기록하지 않는다.
