# CODE1 Cloudflare 전환 인계 — 2026-09-07

## 구현 완료 / 실배포 미완료

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
