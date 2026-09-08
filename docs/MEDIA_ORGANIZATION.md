# CODE1 농가 미디어 자동정리 — v0.2

상태: ACTIVE / LIVE QA PENDING
최초 작성: 2026-09-08
최근 갱신: 2026-09-08
대상: CODE1 Internal Workspace 임시 운영웹

## 목적

농가 자료 화면의 사진·영상 원본을 압축하거나 품질을 낮추지 않고 보관하면서, Google Drive에 농가와 촬영항목 기준으로 자동 분류한다. 잘못 업로드한 자료는 감사 이력을 보존한 채 삭제할 수 있어야 한다.

기존 `Media.gs`의 소형 업로드/권리/미디어큐 기록 로직은 유지한다. 새 기능은 `MediaOrganizer.gs`와 `MediaLifecycle.gs`에 분리한다.

## 데이터 권위

- `12_WEB_미디어큐`: 미디어 메타데이터 정본. `file_name`은 사용자가 올린 원본 파일명을 보존한다.
- Google Drive 실제 파일명: 운영용 표준 파일명으로 변경한다. 파일 바이트는 변경하지 않는다.
- `24_WEB_미디어정리_이력`: 자동정리 성공/실패, 소급정리, 삭제를 append-only로 누적한다.
- `20_WEB_ACCESS_LOG`: 계정 기반 삭제/복구 작업 등 접근 이벤트를 보조 기록한다.

## 원본 업로드 정책

### 일반 파일

8MB 이하 JPG/JPEG/PNG/WebP/PDF/MP4는 기존 `Media.gs` 업로드 경로를 유지한다.

### 고화질 원본

다음은 브라우저에서 압축·리사이즈하지 않고 Google Drive resumable upload 경로로 자동 전환한다.

- 8MB 초과 파일
- HEIC/HEIF
- TIFF
- 카메라 RAW: DNG, CR2, CR3, NEF, ARW, RAF, RW2, ORF, PEF
- MOV

파일은 4MiB 단위로 나누어 전송하고 Drive에는 원본 바이트 그대로 저장한다. 웹 작업용 미리보기 생성은 원본 보존과 별개 기능으로 취급한다.

현재 임시웹 직접 원본 업로드 상한은 파일당 250MB다. 250MB를 넘는 대형 영상은 비공개 Drive 원본 연결을 사용한다. 이 값은 Drive 저장 용량 제한이 아니라 현재 Cloudflare→Apps Script 운영 경로의 실행 안정성을 위한 임시 운영 상한이다.

## 적용 범위

자동정리 적용:
- 농가 자료 화면의 새 소형 `upload`
- `MediaLifecycle.gs` resumable 원본 업로드 완료 파일
- 관리자가 명시적으로 실행한 기존 미정리 파일 복구

자동정리 미적용:
- 아자몰 제안서 `DECK` 이미지
- 일반 `linkDrive`로 다른 위치의 기존 파일을 연결하는 경우. 소유자가 관리하는 원본을 임의 이동하지 않는다.

## Drive 저장 구조

기준 루트는 `14_WEB_설정.MEDIA_ROOT_FOLDER_ID`다.

```text
MEDIA_ROOT/
  농가별/
    [farm_id] 농장명/
      01_사진/
        01_상품·포장/
        02_농장·환경/
        03_작업·공정/
        04_농장주·인물/
      02_영상/
        01_농장·환경/
        02_작업·공정/
        03_인터뷰/
        04_현장음/
      03_문서/
      09_기타/
```

동일 `farm_id`의 폴더가 있으면 재사용하고 농장명 변경 시 폴더 표시명만 갱신한다.

## 파일명 규칙

```text
{농장명}_{shot_code}_{shot_label}_{yyyyMMdd_HHmmss}_{upload_id 앞 8자}.{확장자}
```

예:

```text
애향방사유정란_PHOTO-P01_포장_정면_20260908_180516_3897a759.jpg
```

`M_<긴 upload_id>_<원본명>`은 기존 `Media.gs`가 최초 저장 시 사용하는 임시 파일명이다. Organizer가 정상 실행되면 위 운영용 표준 이름으로 바뀌어야 한다. 이 임시 이름이 최종 Drive 이름으로 남아 있으면 자동정리가 실행되지 않은 것으로 본다.

원래 사용자가 올린 파일명은 `12_WEB_미디어큐.file_name`과 `24_WEB_미디어정리_이력.original_file_name`에 보존한다.

## 자동 분류

사진:
- `PHOTO-P*` → 상품·포장
- `PHOTO-F*` → 농장·환경
- `PHOTO-W*` → 작업·공정
- `PHOTO-H*` → 농장주·인물

영상:
- `VIDEO-01~03` → 농장·환경
- `VIDEO-04~08` → 작업·공정
- `VIDEO-09~10` → 인터뷰
- `VIDEO-11` → 현장음

그 외에는 질문 카탈로그 분류 또는 촬영항목명을 사용한다.

## 삭제 정책

웹의 `자료 삭제`는 즉시 영구삭제하지 않는다.

1. 현재 계정의 농가 편집 권한을 다시 확인한다.
2. 승인/정본 반영 완료 자료에서는 삭제를 막는다.
3. 사용자에게 삭제 확인과 사유를 받는다.
4. Drive 원본을 휴지통으로 이동한다.
5. `12_WEB_미디어큐.status`를 `DELETED`로 바꾼다.
6. 기존 `review_note`에 삭제 사유·시각·계정을 남긴다.
7. `24_WEB_미디어정리_이력`에 `TRASHED` 행을 추가한다.
8. 이후 `getSubmission` 응답에서는 `DELETED` 자료를 제외한다.

향후 영구 삭제 또는 휴지통 복원 기능은 보존기간 정책을 정한 뒤 별도로 추가한다.

## 자동정리 실패와 진단

업로드 성공 자체와 자동정리 성공을 구분한다.

- 업로드 성공 + 정리 성공 → `organization.organized=true`, 이력 `ORGANIZED`.
- 업로드 성공 + Organizer 미설치 → 업로드는 유지하고 UI에 `MEDIA_ORGANIZER_NOT_INSTALLED` 상태를 표시.
- 업로드 성공 + 정리 실패 → 업로드는 유지하고 오류를 화면에 표시, 이력 `ERROR`.

더 이상 Organizer 호출 누락을 조용히 성공으로 표시하지 않는다.

## 기존 미정리 파일 복구

`mediaOrganizer.status`는 `24_WEB_미디어정리_이력`과 `12_WEB_미디어큐`를 대조해 미정리 수를 반환한다.

최고 관리자/서브 관리자는 화면의 `기존 미정리 파일 N개 정리`를 눌러 `mediaOrganizer.repair`를 실행할 수 있다. 복구는 원본 파일 바이트를 수정하지 않고 폴더 이동·파일명 변경·`ORGANIZED` 이력만 수행한다.

현재 2026-09-08 테스트에서 `12_WEB_미디어큐`에는 농가 업로드가 존재하지만 `24_WEB_미디어정리_이력`은 헤더만 존재하는 상태를 확인했다. 따라서 기존 업로드는 복구 대상이다.

## 향후 저장소 이전

Google Drive는 현재 임시 운영 저장소다. 농가/원본 수가 증가하면 회사 Object Storage 또는 별도 보안 저장소로 파일 바이트를 이전하고 Supabase/PostgreSQL에는 다음 논리 모델을 유지한다.

- `media_asset`
- `media_classification`
- `media_lifecycle_history`

`upload_id`, `farm_id`, `shot_code`, 저장소 객체 ID를 연결키로 유지하며 UI는 Drive 폴더 경로를 영구 식별자로 사용하지 않는다.

## QA

- 소형 JPG 업로드 → 표준 파일명/농가별 폴더/`ORGANIZED` 이력 확인.
- 8MB 초과 JPG 또는 HEIC/RAW → 분할 진행률, 원본 크기, 미디어큐, 자동정리 확인.
- 잘못 올린 테스트 파일 → `자료 삭제` → Drive 휴지통, 미디어큐 `DELETED`, 이력 `TRASHED`, 화면에서 제거 확인.
- `기존 미정리 파일 정리` → 현재 과거 파일의 `M_...` 이름이 표준 이름으로 바뀌고 `24`에 `ORGANIZED` 행 생성 확인.
- 250MB 초과 파일 → 직접 업로드 대신 Drive 원본 연결 안내 확인.
