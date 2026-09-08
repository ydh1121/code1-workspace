# 2026-09-08 · 농가 미디어 업로드 UX 개선

상태: IMPLEMENTED / LIVE QA PENDING

## 사용자 피드백

기존 사진·영상 화면은 촬영항목이 긴 단일 select로 노출되어 원하는 항목을 찾기 어렵고, 설명·사용권·원본 파일·기존 업로드 카드가 한 세로 흐름에 섞여 있어 반복 업로드 편의성이 낮았다.

특히 40개 이상 PHOTO/VIDEO Shot List가 한 드롭다운에 들어가 모바일/데스크톱 모두 탐색성이 낮았다.

## 변경

- 기존 `shot-select`는 데이터 소스로 유지하되 화면에서는 숨김 처리.
- `검색 + 분류 탭 + 촬영항목 카드` 선택기를 추가.
- 분류: 상품·포장 / 농장·환경 / 작업·공정 / 농장주·인물 / 영상 / 기타.
- 검색은 현재 분류에 갇히지 않고 전체 Shot List에서 찾음.
- 카드 선택 시 기존 `shot-select`를 갱신하고 change 이벤트를 발생시켜 기존 `app.js` 저장 계약을 그대로 사용.
- 선택 항목의 기존 `shot-guide`를 새 선택 카드 안으로 이동하여 촬영법과 필요 이유를 즉시 확인.
- 설명이 비어 있으면 촬영항목명을 caption 기본값으로 보조 입력. 사용자가 수정한 caption은 임의 덮어쓰기하지 않음.
- MediaOrganizer 저장 규칙과 동일한 `농가별 › 농가명 › 사진/영상 › 분류` 예상 경로를 업로드 전에 표시.
- 파일 input을 드래그앤드롭/클릭 업로드 영역으로 변경하고 이미지 미리보기, 파일명, MIME, 용량 표시.
- 8MB 초과 파일은 사전 경고를 보여주고 Drive 원본 연결 경로를 안내.
- 업로드 버튼 문구를 선택한 촬영항목 기준으로 변경.
- 기존 업로드 목록을 2열 카드형으로 재배치하고 썸네일/항목/파일명/검토상태/Drive·검토 액션을 한 카드에 배치.
- 모바일에서는 촬영항목·업로드 목록을 1열로 전환.

## 변경하지 않은 계약

- `Media.gs`, `upload_()`, `linkDrive_()` 저장 로직은 변경하지 않음.
- `12_WEB_미디어큐` 스키마 변경 없음.
- `MediaOrganizer.gs`의 자동 분류/파일명 규칙 변경 없음.
- 기존 `shot-select`, `media-form`, `media-file`, `media-status`, `media-list` ID 유지.
- Apps Script 재배포 불필요. 이번 변경은 Cloudflare 프론트 자산만 변경.

## 파일

- `public/assets/media-ux.js`
- `public/assets/media-ux.css`
- `public/index.html`
- `scripts/build.mjs`
- `test/media-ux.test.mjs`

## 검증 상태

- DOM 테스트 2개를 추가: 분류 카드 선택과 native select 동기화, 전체 검색과 자동 저장 경로 표시.
- 현재 실행환경은 `github.com` DNS 접근이 차단되어 clone 후 `npm test / npm run build`를 재실행하지 못함.
- 따라서 자동 테스트 PASS 또는 실사이트 PASS로 과장 기록하지 않음.

## 다음 QA

1. Cloudflare 최신 main 배포 확인.
2. 강력 새로고침 후 농가 자료 → 사진과 자료 진입.
3. 긴 드롭다운 대신 카드 선택기가 보이는지 확인.
4. `농장 전경` 검색 → `PHOTO-F01` 선택 → 저장 위치가 `01_사진 / 02_농장·환경`으로 표시되는지 확인.
5. 이미지 파일 선택 → 미리보기/파일명/용량 표시 확인.
6. 업로드 → 기존 저장 성공 + `24_WEB_미디어정리_이력` ORGANIZED 확인.
7. 모바일 폭에서 분류 탭 횡스크롤, Shot 카드 1열, 업로드 카드 1열 확인.
