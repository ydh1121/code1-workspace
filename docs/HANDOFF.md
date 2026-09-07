# CODE1 Cloudflare 전환 인계 — 2026-09-08

## 최신 — 농가 입력 항목 정책과 수집 간소화

상태: **ACTIVE WORK / 실사이트 적용 전**

사용자 피드백: 농가 입력 화면에서 일부 텍스트가 보이지 않는 문제를 확인하고, 모든 농가에 231개 항목을 동일하게 요구하지 않도록 전체/농가별 수집 정책, 제외 사유 DB, 노출 체크박스 관리 화면, 향후 관리자단·Supabase/회사 서버 이전 가능한 구조를 추가하기로 함. 작업 과정은 기존 CODE1 AI 작업 하네스의 CURRENT/이력/QA 규칙을 따른다.

### 이번 변경

- 실제 `13_WEB_질문카탈로그` A:P를 확인. 현재 231개 행의 `item_label`, `plain_question`은 모두 존재함. 따라서 제목/질문 문구 소실이 아니라 렌더링/도움말 품질 문제를 별도로 추적. `help_text`는 다수 항목이 의도적으로 공란.
- 기존 질문 카탈로그를 삭제·수정하지 않고 정책 overlay를 분리.
- 실제 Google Sheet에 `22_WEB_질문정책`, `23_WEB_질문정책_이력` 생성 및 헤더 설치.
- `bridge/QuestionPolicy.gs` 추가. 전체/농가별 정책, 이유 코드, 버전 충돌, 관리자 권한, append-only 변경 이력 지원.
- `CloudflareBridge.gs`에 `questionPolicy.effective/list/save`만 별도 라우팅. 기존 `AccessControl.gs`, 제출·미디어·제안서 저장 로직은 재작성하지 않음.
- Cloudflare `bootstrap`에 유효 정책을 합치되 Apps Script가 아직 구버전이면 기존 농가/제안서가 중단되지 않도록 정책 기능만 비활성 fallback.
- 농가 모델에 `SHOW / OPTIONAL / HIDE / PERMANENT_EXCLUDE`, 농가별 `INHERIT / SHOW / OPTIONAL / HIDE / NOT_APPLICABLE` 적용.
- `OPTIONAL`은 화면에 보이지만 진행률과 미입력 요청서에서 제외. 숨김·해당없음·영구제외는 화면에서도 제외. 과거 답변은 삭제하지 않음.
- 최고 관리자와 서브 관리자에게 `입력 항목 관리` UI 제공. 범위 선택, 분류/검색, 노출 체크박스, 수집 상태, 사유 코드, 운영 메모, 변경 저장 지원.
- 정책 규칙과 향후 DB 이전 계약은 `docs/QUESTION_POLICY.md`에 정리.
- 정책 전용 DOM 테스트 추가. `OPTIONAL` 진행률 제외, 농가 override, 전역 영구제외 우선, 서브 관리자 메뉴 노출을 검증하도록 작성.

### 데이터/이관 경계

현재 Google Sheet는 임시 운영 저장소다. 논리 계약은 `question_catalog / question_policy / question_policy_history`로 분리되어 있어 이후 Supabase 또는 회사 서버로 저장 구현을 교체해도 UI 정책 의미를 유지할 수 있게 설계함. Sheet 행 번호를 외부 계약으로 사용하지 않음.

### 현재 적용 상태

- Google Sheet 22/23 탭: **생성 완료**.
- GitHub `main`: 정책 코드·UI·문서 반영 완료.
- Apps Script 실제 편집기: `QuestionPolicy.gs` 신규 파일과 최신 `CloudflareBridge.gs`를 아직 사용자가 적용/재배포해야 함.
- Cloudflare: GitHub 자동 배포가 먼저 되어도 기존 Apps Script에서는 정책 기능만 준비되지 않은 상태로 표시되고 기존 업무 bootstrap은 fallback하도록 함.
- 실사이트 정책 저장/진행률 변화: **미검증**. 실제 Apps Script 새 버전 배포 후 검증 필요.
- 이번 실행환경은 GitHub clone 네트워크가 차단되어 `npm test`를 직접 재실행하지 못함. 테스트 파일은 추가했으나 **PASS로 기록하지 않음**.

### 다음 정확한 시작점

1. Apps Script 기존 프로젝트에 GitHub `bridge/QuestionPolicy.gs` 전체를 새 파일로 추가.
2. 기존 `CloudflareBridge.gs`를 GitHub 최신본으로 교체.
3. 기존 `Cloudflare 데이터 연결` 배포를 **같은 배포 ID/URL 유지 + 새 버전**으로 갱신.
4. Cloudflare 최신 main 배포 후 최고 관리자와 서브 관리자 각각 `입력 항목 관리` 접근 확인.
5. 테스트 정책 1개를 `OPTIONAL`로 저장 → `22_WEB_질문정책`, `23_WEB_질문정책_이력` 행 생성 → 농가 진행률/미입력 요청서 변화 검증.
6. 실제 운영 자료를 보며 영구 제외 후보는 자동 적용하지 말고 우선 `OPTIONAL`부터 검토.

---

## 이전 — 계정 관리와 농가별 권한

사용자가 Cloudflare 사이트 배포 성공을 보고했으며 실제 사용 주소는 `https://code1-workspace.pages.dev`입니다. 데이터 브리지로 전달받은 URL은 `https://script.google.com/macros/s/AKfycbx1FJr3BfX3DgfYnMmKDFHzZBxoO8NPlWZ4y9I3M68X8UYoptIFoBhL1ufOzoCwInl7/exec`입니다. 아래 최초 전환 기록의 미배포 상태와 구분합니다.

이번 사용자 요구: 최고 관리자=소유자, 서브 관리자=전체 농가·제안서 업무 권한, 농가 계정=지정 페이지·지정 농가만 접근. 작업 범위는 GitHub `main` 반영까지이며 Cloudflare 설정은 사용자 담당입니다.

### 이번 변경

- 자체 ID·비밀번호 로그인과 관리자 계정 발급 화면. 최고 관리자 Google 로그인은 최초 설정/복구용으로 유지.
- 최고 관리자/서브 관리자/농가 계정. 서브 관리자는 전체 업무와 농가 계정 관리를 수행하며 관리자 권한 변경은 최고 관리자만 수행.
- 농가/제안서 페이지별 숨김·보기·입력/편집, 농가 ID 배정. 숨긴 자료는 서버 bootstrap·개별 조회·미디어 요청에서 반환하지 않음.
- 계정 중지·권한 변경·비밀번호 변경 시 세션 버전 증가. 모든 데이터 요청에서 최신 버전/정책을 재확인.
- 새 `bridge/AccessControl.gs`와 교체할 `CloudflareBridge.gs`. 승인된 기존 소유자의 Google 로그인 시에만 CODE1 계정용 19~21 탭을 생성. 기존 행/헤더 충돌은 덮어쓰지 않음.
- 예전 Google 두 번째 이메일 허용 경로는 최초 계정 설정 시 닫음 (`ALLOWED_USER_2` 공란, `CONTRIBUTOR_DECK_EDIT=FALSE`). 다른 계정은 새 관리 화면에서 발급. 기존 정본/제출/미디어/덱 저장 형식은 유지.
- 비밀번호는 서버에서 salt·PBKDF2·별도 pepper로 처리. 실제 비밀번호/검증값을 브라우저 계정 목록·로그·Git에 포함하지 않음. 로그인 시도 제한과 계정 변경 이력 기록.

### 이번에 확인한 결과

- 자동검증 **27개 PASS**: 이전 요청서·농가/덱 DOM 회귀, 새 계정 UI, 두 농가 간 직접 조회/수정/이미지 요청 차단, 읽기 전용 쓰기 차단, 관리자 전체 업무, 최고 관리자 보호, 권한 회수/중지/비밀번호 변경 후 기존 세션 거부, 단일 사용 로그인 확인값·반복 로그인 제한, HMAC 서명·요청 재사용 차단, 브라우저의 내부 인증 API 접근 차단, 실제 WebCrypto 비밀번호 비교 및 쿠키 검증.
- `node scripts/build.mjs` 통과. Cloudflare Functions 전체 번들, 브라우저 스크립트 구문 검사 통과.
- 테스트는 격리된 Sheet/Drive 모의 서비스와 DOM, 로컬 WebCrypto로 수행. 실제 Cloudflare 계정 발급·Google 저장·두 실계정 격리 검증은 **미완료**.
- 이번 작업에서 Google DB/Drive/Cloudflare 설정을 직접 변경하지 않음. 이전 정본 비교·PDF 시각 검증을 새 검증으로 다시 합산하지 않음.

### 남은 적용

[ACCOUNTS.md](ACCOUNTS.md)에 메뉴별 절차 작성: Cloudflare `PASSWORD_PEPPER` Secret 추가 → 기존 Apps Script의 브리지 파일 두 개 적용 → 기존 데이터 연결 배포를 새 버전으로 업데이트 → Cloudflare 환경값 반영 배포 → 소유자 Google 최초 로그인 → 최고 관리자 비밀번호 설정 → 실제 서브 관리자/농가 계정 발급 및 실사용 검증.

변경 전 main 기준은 `f8254a774c68ed807b888ad986c6ec34ecb13b7d`. 참고 India 프로젝트의 소스와 DB 탭 구조만 읽었으며 계정·비밀번호·문서 데이터는 가져오지 않음. 해당 프로젝트와 CODE1의 DB는 별개로 유지.

---

## 이전 기록 — 최초 화면 전환 당시

최신 사용자 지시: GitHub main 반영까지만 수행. Cloudflare 연결과 환경값 입력은 사용자가 직접 진행.

대상 저장소: `ydh1121/code1-workspace`. 기존 Google DB와 비공개 Drive 데이터는 이동·수정하지 않았습니다. 공개 저장소에는 기존 질문카탈로그의 실데이터, 제안서 원문·현장 이미지·복구 ZIP을 넣지 않습니다.

### 변경

- Cloudflare Pages의 독립 HTML/CSS/JS 화면과 서버 Functions.
- 같은 창 Google OAuth, PKCE·state·nonce 검사, 8시간 HttpOnly 서명 세션. 매 API 호출 기존 Sheet allowlist와 역할 재확인.
- 기존 Apps Script에 `CloudflareBridge.gs` 한 파일을 추가하는 구조. UI는 Apps Script를 벗어나지만 데이터 연결은 Apps Script 실행·할당량에 계속 의존합니다. 기존 잠금·쓰기 제한·제출/미디어 ID·제안서 버전 형식을 보존하기 위한 선택입니다.
- 농가 여섯 분류, 5개 단위 질문, 질문/답변 검색, 미입력 필터, 완료 개수, 답변 모아보기, 최근 자료 이어쓰기, 모바일용 큰 입력 컨트롤과 체크박스.
- 미입력 자료만 선택하는 직접 PDF 다운로드. 기존 자료를 자동으로 삭제하거나 요청 완료로 판정하지 않습니다. `미확인`과 반려 미디어는 요청 목록에 남습니다.
- 제안서 옆 패널 글 편집, 모바일 도구 노출, 이미지 입력 확인 팝업 삭제, 저장 팝업 삭제, 기술적 출력 오류가 없으면 인쇄창으로 이동. 원본 문구·이미지의 동일 재현은 이번에 실화면 검증하지 않았습니다.

### 이번 검증

- Cloudflare용 빌드 및 JavaScript 구문 검사.
- 자동검증 10개: 요청 목록과 검색, 숫자 0/미확인/첨부 판별, 세션 위조·만료, 교차 출처 요청, 익명 API 차단, 요청 서명, Apps Script 브리지 중복·권한 검사, 농가 DOM 입력·자동저장·검색·요청 목록, 제안서 DOM 글 편집·Undo/Redo·팝업 없음.
- 자동검증은 모의 서비스/DOM입니다. 실제 Google 저장·Cloudflare 로그인 PASS를 의미하지 않습니다.
- 동일 PDF 생성 코드로 가상 농가 9항목을 A4 2페이지 PDF로 출력. 두 페이지를 PNG로 렌더링하여 한글·줄바꿈·체크칸·페이지 번호를 눈으로 확인. 실제 사용자 기기에서 다운로드한 결과는 아직 미검증.
- 클라우드 브라우저의 로컬 화면 접근 `ERR_BLOCKED_BY_CLIENT`로 데스크톱/모바일 실제 브라우저 검증 미완료. 다른 브라우저 경로로 우회하지 않음.
- Cloudflare CLI `whoami`: 미인증. 대시보드는 보안 확인 화면이 반복되어 배포 설정 진입 불가. 배포 ID·실제 Cloudflare Web URL 아직 없음.

### 남은 소유자 연결

`CONNECT_CLOUDFLARE.md` 순서대로 Git 연동, 브리지 파일 설치 및 배포, 6개 환경값, OAuth 리디렉션 추가. 비밀값은 사용자 설정 화면에서만 입력합니다.

연결 후 실제 OWNER 로그인, 차단 계정, 농가 저장·제출·검토, 미디어 원본·큐 연결, 제안서 12장·저장 복원, 실제 PDF/인쇄와 모바일 확인이 필요합니다. 두 번째 계정은 지정 전까지 검증 미완료입니다. Cloudflare 구축 완료 후 저장소 비공개 전환은 사용자가 예정했으며 아직 수행하지 않았습니다.

### 기존 운영 대상 (연결 확인용)

- 기존 Apps Script ID: `1AoMVWNQIsUxIQc7QjBoHkKPWGgPhOiLWdxFlTYnCWe2t8eFbtmHfavrb`
- 기존 프런트 배포 ID: `AKfycbwoCKfytMz4wnrygDBcUo9DQ92bgqie8-hfWe_wnUddBdX1OqYUSRufRgc_KIPoNv5lCg`
- DB와 미디어 폴더 ID는 기존 Apps Script 코드·Sheet 설정을 그대로 사용. 새 Cloudflare 환경변수로 복사하지 않음.
- WRITE_MODE=STAGING_ONLY. Production, Public Frontend, Low-fi, HOOOO, 기존 아자몰 CURRENT 무변경.

이전 30개 모의검증과 과거 Sheet 설치 검증을 이번 신규 검증으로 합산하지 않았습니다.
