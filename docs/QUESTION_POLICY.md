# CODE1 농가 입력 항목 정책 — v0.1

상태: ACTIVE WORK
최초 작성: 2026-09-08
대상: CODE1 Internal Workspace 임시 운영웹

## 목적

`13_WEB_질문카탈로그`의 질문 원본은 유지하면서 실제 운영에서 받을 항목을 줄이고, 왜 필수로 받지 않는지 판단 근거를 데이터로 남긴다.

질문을 숨기거나 영구 제외해도 기존 답변과 카탈로그 행은 삭제하지 않는다. 다시 노출하면 기존 답변을 재사용할 수 있다.

## 권위와 역할

- `13_WEB_질문카탈로그`: 질문 원문·입력형·현재 수집 이유의 정본.
- `22_WEB_질문정책`: 현재 적용 중인 전역/농가별 수집 정책.
- `23_WEB_질문정책_이력`: 정책 변경 이력. 변경 전·후, 변경자, 시각, request_id를 누적한다.
- Git `docs/HANDOFF.md`: 앱 구현 버전과 실제 적용 상태를 누적한다.

정책 관리 권한은 `SUPER_ADMIN`, `ADMIN`까지 허용한다. 농가 계정은 정책을 조회·변경할 수 없다.

## 정책 모드

### 전체 기본값

- `SHOW`: 입력받기. 화면 노출, 진행률 포함, 미입력 요청서 포함.
- `OPTIONAL`: 선택 입력. 화면에는 노출하지만 진행률과 미입력 요청서에서는 제외.
- `HIDE`: 전역 숨김. 화면·진행률·미입력 요청서에서 제외.
- `PERMANENT_EXCLUDE`: 전체 영구 제외. 모든 농가에서 제외하되 질문 원본과 과거 답변은 보존.

### 농가별

- `INHERIT`: 전체 기본값 따름.
- `SHOW`: 해당 농가에서 입력받기.
- `OPTIONAL`: 해당 농가에서 선택 입력.
- `HIDE`: 해당 농가에서 숨김.
- `NOT_APPLICABLE`: 해당 농가/상품에는 적용되지 않음.

전역 `PERMANENT_EXCLUDE`는 농가별 `SHOW`로 되살릴 수 없다. 그 외 전역 정책은 농가별 정책이 우선한다.

## 제외·비필수 사유 코드

- `DUPLICATE`: 다른 항목에서 중복 확인 가능
- `DERIVED`: 다른 자료로 산출·확인 가능
- `NOT_APPLICABLE`: 해당 농가·상품에는 적용되지 않음
- `LATER_PHASE`: 초기 입점 단계에는 불필요
- `COLLECT_LATER`: 운영 이후 수집하는 편이 적절함
- `SENSITIVE`: 민감정보라 별도 경로로 수집
- `LOW_VALUE`: 운영 활용도가 낮음
- `OTHER`: 기타

`OPTIONAL`, `HIDE`, `NOT_APPLICABLE`, `PERMANENT_EXCLUDE`는 사유 코드와 운영 메모를 필수로 남긴다.

## 현재 화면 계약

관리자는 상단 `입력 항목 관리`에서 다음을 선택한다.

1. 적용 범위: 전체 기본값 또는 개별 농가.
2. 분류/검색으로 질문 선택.
3. `노출` 체크박스로 빠르게 표시 여부 변경.
4. 수집 상태에서 선택 입력·숨김·영구 제외·해당 없음 등 세부 의미 지정.
5. 필수 수집이 아닌 경우 사유 분류와 운영 메모 기록.
6. 변경사항 저장.

정책 저장 후 기존 답변은 삭제하지 않는다.

## 데이터 모델

`22_WEB_질문정책`

`policy_id, scope, farm_id, item_key, mode, reason_code, reason_note, version, status, updated_by, updated_at, request_id`

`23_WEB_질문정책_이력`

`at, actor_id, policy_id, scope, farm_id, item_key, before_mode, after_mode, reason_code, reason_note, version, request_id, before_json, after_json`

현재 Sheet는 임시 운영 저장소다. 이 구조는 향후 다음 테이블로 거의 그대로 이전할 수 있게 설계한다.

- `question_catalog`
- `question_policy`
- `question_policy_history`
- 기존 `submission_answer`, `media` 등은 별도 유지

Supabase/회사 서버 이전 시 UI가 Sheet 행 번호에 의존하지 않도록 `policy_id`, `item_key`, `farm_id`를 논리 키로 사용한다.

## 1차 간소화 검토 원칙

자동 영구 제외는 하지 않는다. 운영자가 정책 화면에서 근거를 확인한 뒤 적용한다.

우선 검토 가치가 높은 후보:

- `MEDIA` 촬영 Shot List: 촬영 가이드로는 유지하되 초기 입점 진행률의 필수 항목에서 제외할지 검토. 대량 항목이므로 `OPTIONAL` 후보.
- `S` 미디어 사용권 질문: 실제 미디어 업로드 폼의 파일별 권리 메타데이터와 중복되는 항목은 `OPTIONAL` 또는 `HIDE` 후보. 단, 농가 전체 포괄 동의가 필요한 항목은 유지 가능.
- `H-01` 출고 가능 요일 / `H-02` 출고 불가 요일: 서로 산출 가능한지 운영 예외를 확인한 뒤 한쪽을 `OPTIONAL` 후보로 검토.
- 계약·정산의 민감정보: 입점 초기 입력 폼보다 별도 보안 수집 경로가 적절한 값은 `SENSITIVE` 사유로 단계 분리 검토.

후보라는 이유만으로 현재 정책을 자동 변경하지 않는다.

## 향후 관리자단 연결

현재 임시웹의 정책 API 계약을 유지하고 저장소 구현만 교체할 수 있게 한다.

- `questionPolicy.effective`: 사용자가 볼 수 있는 농가의 유효 정책 조회
- `questionPolicy.list`: 관리자 정책·사유·농가·카탈로그 조회
- `questionPolicy.save`: 관리자 변경 저장 + 이력 누적

관리자단 고도화 시에는 정책 일괄 적용, 농가 템플릿, 품목별 템플릿, 승인 워크플로, 변경 diff, 통계(실제 입력률·활용률)를 추가할 수 있다.

## OPEN ITEMS

- 실제 Apps Script에 `QuestionPolicy.gs`와 최신 `CloudflareBridge.gs` 적용 후 기존 배포 새 버전 갱신.
- 실사이트에서 최고 관리자와 서브 관리자의 정책 화면 저장 검증.
- 정책 변경 후 농가 진행률/미입력 요청서가 실제로 즉시 달라지는지 검증.
- 첫 실제 농가 데이터 기준으로 `OPTIONAL/HIDE/PERMANENT_EXCLUDE` 후보를 운영 검토.
- 현재 질문 중 수집 이유·입력 도움말의 문구 품질 정리. `plain_question`과 `item_label`은 현재 231개 모두 존재함.
