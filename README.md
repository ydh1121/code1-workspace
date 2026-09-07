# CODE1 Internal Workspace

Google Sheets·비공개 Drive를 유지하는 Cloudflare Pages 내부 운영웹입니다.

## 이번 전환

- 화면과 로그인: GitHub → Cloudflare Pages + Pages Functions.
- 데이터: 기존 Apps Script는 **화면이 아닌 데이터 연결 어댑터**로만 재사용합니다. Sheets 저장 형식, 잠금, 버전 충돌 확인, 제출·미디어 연결을 보존합니다. Apps Script 의존성이 완전히 제거된 구성은 아닙니다.
- 공개 저장소에는 농가 실데이터·제안서 카피·현장 이미지·Google 비밀값을 포함하지 않습니다. 기존 12장 제안서와 자산은 인증된 요청으로만 Google에서 불러옵니다.

## 기능

- 농가 자료: 여섯 업무 묶음, 한 번에 다섯 질문, 전체 질문·답변 검색, 입력/미입력 필터, 진행 현황, 작성 내용 모아보기, 자동 임시저장, 최근 자료 이어쓰기.
- 요청서: 이미 받은 답변·증빙·사진을 제외하고 필요한 항목을 선택합니다. 연락처·기한·메모를 넣어 한글 글꼴이 포함된 A4 PDF를 직접 다운로드합니다. `미확인`·거절된 사진은 아직 필요한 항목으로 남습니다. [가상 농가 출력 예시](docs/request-example.pdf).
- 제안서: 기존 독립 요소 모델 유지, 옆 패널에서 글 편집, 이동·크기·색·배경·레이어·잠금, Undo/Redo, 저장·새 버전, PDF/인쇄. 이미지 권리 확인 팝업과 일반 저장의 메모 팝업을 제거했습니다. 권리 승인 상태를 임의로 승인으로 바꾸지 않습니다.
- 모바일: 큰 글씨와 버튼, 질문 분할, 가로로 넘기는 분류, 접히지 않는 편집 도구. 정밀 슬라이드 편집은 넓은 화면이 더 편리합니다.

## 시작

```sh
npm ci
npm run build
npm test
npm run dev
```

Cloudflare의 빌드 명령은 `npm run build`, 출력 폴더는 `public`입니다. 루트 `functions/`가 서버 API로 배포됩니다. **Git 연동 및 비밀값 설정이 필요하며, 코드 업로드만으로 실사용 배포가 끝나지는 않습니다.**

[비개발자용 연결 안내](docs/CONNECT_CLOUDFLARE.md) · [검증과 남은 작업](docs/HANDOFF.md)

## 구조

```text
public/       화면, 폰트, 브라우저 코드
functions/    Google 로그인, HttpOnly 세션 쿠키, 인증된 API
bridge/       기존 Apps Script에 추가할 파일 1개
scripts/      PDF 번들 및 빌드
 test/        모델·서버·DOM 모의 검증
```

## 보존 규칙

`STAGING_ONLY` 유지. 기존 00~10 정본 자동 쓰기, Production/Public Frontend/HOOOO 수정, CURRENT 원본 교체, Drive 공개 공유를 하지 않습니다. 두 번째 사용자는 기존 Sheet 설정에 지정된 계정만 허용하며 매 요청 재확인합니다.

## 참고 구조

사용자 소유 [indiadesk-business-hub](https://github.com/ydh1121/indiadesk-business-hub)의 `public/ + functions/`, 서버 전용 비밀값, HttpOnly 쿠키, Git 배포 구성을 참고했습니다. 해당 프로젝트의 DB·계정·문서·기기 제한은 복제하지 않았습니다.
