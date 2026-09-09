# 2026-09-10 CODE1 Internal Workspace 성능 4차 — hot path 비동기화

상태: IMPLEMENTED_ON_MAIN / LIVE QA PENDING

## 사용자 확인

3차 최적화 적용 후에도 다음 작업이 모두 매우 느리다고 확인됐다.

- 아이디/비밀번호 로그인
- 농가 임시저장
- 입력한 텍스트 삭제 후 저장 반응
- 사진 삭제
- 다른 농가로 전환

따라서 1~3차의 미세한 Sheet scan/CacheService 최적화만으로는 체감 성능 문제를 해결하지 못했다고 판정한다.

## 4차 원칙

Apps Script + Google Sheets/Drive는 이 임시웹의 내구 저장소로 유지하되, 사용자가 자주 누르는 UI 동작 자체가 Apps Script 왕복 완료를 기다리지 않도록 분리한다.

### 농가 임시저장

- DRAFT saveSubmission은 브라우저에서 즉시 완료 응답을 만든다.
- 실제 Apps Script 저장은 즉시 백그라운드에서 시작한다.
- 연속 변경은 마지막 pending snapshot 기준으로 순차 저장한다.
- 실제 server revision을 별도로 추적해 다음 durable write의 baseRevision을 교정한다.
- 저장 중 탭을 닫으면 beforeunload 경고를 낸다.
- 화면에는 `저장 중 · 화면 이동 가능` → `서버 저장 완료 · rN`으로 구분한다.

### 농가 전환

- 이미 읽은 submission detail은 브라우저 메모리에서 즉시 재사용한다.
- bootstrap 뒤 submission detail을 concurrency 2로 background prefetch한다.
- dirty farm에서 다른 farm으로 이동할 때 UI는 DRAFT durable write 완료를 기다리지 않는다.
- upload/review/submit처럼 durable revision이 반드시 필요한 작업만 관련 pending write를 먼저 flush한다.

### 사진 삭제

- UI에서는 즉시 제거한다.
- Drive 휴지통 이동 + Sheet 상태 + history/audit은 백그라운드 durable mutation으로 계속 실행한다.
- durable deletion 실패는 화면에 명시적으로 표시하며 숨기지 않는다.

### 로그인

- 기존 `auth.begin → Cloudflare password proof → auth.finish → bootstrap` 구조를 fast path에서 단일 Apps Script 실행으로 줄인다.
- Apps Script `auth.fast`는 login throttle, credential, sanitized account, farm bootstrap bundle을 같은 실행에서 만든다.
- 비밀번호 PBKDF2/pepper 검증은 계속 Cloudflare에서 수행한다.
- 비밀번호 검증 성공 시에만 bootstrap을 브라우저에 반환한다.
- 클라이언트는 `/api/auth/password`에서 받은 bootstrap을 메모리에 보관하고 직후 app.js의 `bootstrap` RPC를 로컬 응답으로 대체한다.
- 최신 Apps Script가 아직 배포되지 않은 경우 Cloudflare endpoint는 legacy `auth.begin/auth.finish`로 자동 fallback한다.
- `PerformanceRead.gs` v5의 `performanceBootstrapAccount_()`를 사용해 같은 Apps Script 실행 안에서 계정 재조회 없이 bootstrap을 조립한다.

## 계측

브라우저 메모리에 최근 성능 이벤트를 `window.__CODE1_PERF__`로 남긴다. console에도 `[CODE1 perf]` 로그를 기록한다.

구분 예:

- `write-behind`: UI가 서버 저장을 기다리지 않은 작업
- `memory-cache`: 농가 상세 메모리 재사용
- `prefetch-join`: 이미 진행 중인 background prefetch에 합류
- `auth-prefetch`: 로그인 응답에 포함된 bootstrap 재사용
- `network` / `background`: 실제 네트워크 왕복

## 수동 Apps Script 반영 필요

4차 fast login까지 활성화하려면 기존 Apps Script 프로젝트에서 다음 두 파일을 최신 main 버전으로 교체한 뒤, 기존 `Cloudflare 데이터 연결` 배포를 같은 `/exec` URL의 새 버전으로 갱신한다.

- `bridge/PerformanceRead.gs` — v5
- `bridge/CloudflareBridge.gs`

Cloudflare Pages 쪽 `public/assets/question-help.js`와 `functions/api/auth/password.js`는 main 배포 대상이다.

## 주의

write-behind는 `저장 안 함`이 아니다. UI 대기와 durable 저장 완료를 분리한 것이다. 탭을 닫기 전 `서버 저장 완료`가 표시되는 것이 가장 안전하며, pending write가 있으면 브라우저 이탈 경고를 띄운다.

## 다음 판정

이 4차 적용 후에도 `임시저장/사진삭제/기방문 농가 전환` 자체가 수 초씩 멈춘다면 Apps Script 미세 최적화를 계속하지 않는다. Cloudflare에서 Sheets/Drive API를 직접 호출하거나 임시 업무 API를 Apps Script 밖으로 이동하는 구조 전환을 다음 후보로 삼는다.
