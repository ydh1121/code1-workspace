# CODE1 농가 미디어 자동정리 — v0.1

상태: ACTIVE
최초 작성: 2026-09-08
대상: CODE1 Internal Workspace 임시 운영웹

## 목적

농가 자료 화면에서 새로 업로드한 사진·영상·PDF 등의 원본을 Google Drive 루트에 평평하게 쌓지 않고, 농가와 촬영항목 기준으로 자동 분류한다.

기존 `Media.gs`의 업로드/권리/미디어큐 기록 로직은 정본으로 유지한다. `MediaOrganizer.gs`는 업로드 성공 후 실행되는 후처리 레이어이며, 분류·이름변경 실패가 업로드 자체를 실패나 중복 재시도로 만들면 안 된다.

## 데이터 권위

- `12_WEB_미디어큐`: 업로드 원본 메타데이터 정본. `file_name`은 사용자가 업로드한 원본 파일명을 보존한다.
- Google Drive 실제 파일명: 운영용 표준 파일명으로 변경할 수 있다.
- `24_WEB_미디어정리_이력`: 자동정리 결과와 실패 이력을 append-only로 누적한다.

`12_WEB_미디어큐`의 기존 헤더는 이번 기능에서 변경하지 않는다.

## 적용 범위

적용:
- 농가 자료 화면에서 `upload`로 새로 업로드한 파일
- 사진, 영상, PDF 및 기타 업로드 파일

미적용:
- 아자몰 제안서 `DECK` 이미지
- 기존 `linkDrive`로 연결한 원본. 사용자가 다른 폴더에서 관리 중인 파일을 임의 이동하지 않는다.
- 과거 파일의 일괄 이동. 별도 승인 없는 자동 소급정리는 하지 않는다.

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
        ...
      02_영상/
        01_농장·환경/
        02_작업·공정/
        03_인터뷰/
        04_현장음/
        ...
      03_문서/
        {질문카탈로그 분류}/
      09_기타/
        {질문카탈로그 분류 또는 촬영항목}/
```

농장명이 바뀌더라도 동일 `farm_id` 폴더를 우선 찾아 폴더명만 갱신한다.

## 파일명 규칙

```text
{농장명}_{shot_code}_{shot_label}_{yyyyMMdd_HHmmss}_{upload_id 앞 8자}.{확장자}
```

예:

```text
정어네농장_PHOTO-F01_농장전경-Wide_20260908_160512_35f86c12.jpg
```

운영 파일명에 사용할 수 없는 문자와 제어문자는 `-`로 정리한다. 긴 이름은 Drive 운영성을 위해 제한한다.

원본 파일명은 `12_WEB_미디어큐.file_name` 및 `24_WEB_미디어정리_이력.original_file_name`에 남긴다.

## 자동 분류

사진 Shot List:
- `PHOTO-P*` → 상품·포장
- `PHOTO-F*` → 농장·환경
- `PHOTO-W*` → 작업·공정
- `PHOTO-H*` → 농장주·인물

영상 Shot List:
- `VIDEO-01~03` → 농장·환경
- `VIDEO-04~08` → 작업·공정
- `VIDEO-09~10` → 인터뷰
- `VIDEO-11` → 현장음

그 외 파일 질문은 `13_WEB_질문카탈로그`에서 해당 `item_key`의 `section_code + section_name`을 찾아 분류한다. 카탈로그에도 없는 경우 촬영항목명 또는 `기타`로 보관한다.

## 실패 처리

업로드 완료가 정본이다. 자동정리는 fail-soft다.

- 업로드 성공 + 정리 성공 → 사용자는 정상 성공 응답, 이력 `ORGANIZED`.
- 업로드 성공 + 정리 실패 → 사용자는 업로드 성공 상태 유지, 원본 파일은 기존 위치에 남고 이력 `ERROR`.
- 같은 `upload_id + drive_file_id`를 다시 처리하면 중복 이동·중복 이름변경을 하지 않는다.

이 원칙은 네트워크 재시도에서 동일 파일이 중복 업로드되는 위험을 줄이기 위한 것이다.

## `24_WEB_미디어정리_이력`

```text
at
actor_id
upload_id
drive_file_id
farm_id
farm_name
media_type
category
shot_code
shot_label
original_file_name
stored_file_name
folder_path
status
detail
version
```

## 향후 DB 이전

Google Drive는 현재 임시 운영 저장소다. 농가 수와 원본 파일 수가 증가하면 실제 파일은 회사 관리 Object Storage 또는 별도 보안 저장소로 이전하고, Supabase/PostgreSQL에는 다음 논리 데이터를 유지하는 구조를 권장한다.

- `media_asset`
- `media_classification`
- `media_organization_history`

현재 논리 키인 `upload_id`, `farm_id`, `shot_code`, `drive_file_id`는 저장소 교체 시 마이그레이션 연결키로 사용한다. UI나 정책 로직이 Drive 폴더 경로 자체를 영구 식별자로 사용하지 않도록 한다.

## OPEN ITEMS

- 실제 Apps Script에 `MediaOrganizer.gs` 추가.
- 최신 `CloudflareBridge.gs` 반영 후 기존 `Cloudflare 데이터 연결` 배포를 새 버전으로 갱신.
- 테스트 농가에서 사진 1장, 영상 1장 업로드 후 폴더/파일명/이력 검증.
- `linkDrive` 원본을 복사본으로 정리할지 여부는 추후 운영 필요성 확인 후 결정.
- 기존 과거 농가 파일 소급정리는 별도 승인 후 실행.
