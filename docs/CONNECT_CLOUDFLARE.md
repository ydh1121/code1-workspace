# CODE1 Cloudflare 연결 안내

**이미 사이트를 배포했다면 [계정 관리 업데이트 안내](ACCOUNTS.md)를 먼저 따르세요.** 아래는 이전 최초 연결 순서를 보존한 기록입니다. 현재 버전은 브리지 파일 두 개와 추가 `PASSWORD_PEPPER`가 필요하고, 일반 사용자는 ID·비밀번호로 로그인합니다. 예전 두 번째 이메일 설정은 새 계정 관리로 대체됩니다.

이 문서는 개발자가 아닌 소유자용입니다. 비밀번호·OAuth 보안 비밀값·연결 키는 채팅이나 GitHub에 올리지 말고 아래 설정 화면에 직접 입력하세요.

## 1. Cloudflare에 GitHub 저장소 연결

1. Cloudflare Dashboard에 로그인합니다.
2. **Workers & Pages → Create application → Pages → Connect to Git**을 엽니다. 새 화면에서는 **Create application → Get started → Import an existing Git repository**로 표시될 수 있습니다. 반드시 Pages 프로젝트를 선택합니다.
3. GitHub 계정 `ydh1121`에서 **code1-workspace** 저장소를 선택합니다.
4. 프로젝트 이름: `code1-workspace`.
5. Production branch: `main`.
6. Framework preset: `None`.
7. Build command: `npm run build`.
8. Build output directory: `public`.
9. Root directory는 비워 둡니다.
10. **Save and Deploy**를 누릅니다. 성공 화면에 표시되는 실제 `https://…pages.dev` 주소를 복사합니다. 아직 Google 연결을 하지 않았으므로 로그인 준비 안내가 나오는 것이 정상입니다.

## 2. 기존 Apps Script에 연결 파일 추가

기존 `CODE1 Internal Workspace` 프로젝트만 사용합니다. 새 프로젝트를 만들거나 설치 함수를 실행하지 않습니다.

1. 기존 Apps Script 편집기를 엽니다.
2. 왼쪽 **편집기 (`<>`)** 아이콘을 누릅니다.
3. **파일** 오른쪽 **+ → 스크립트**를 누릅니다.
4. 파일 이름에 `CloudflareBridge`를 입력합니다.
5. 자동으로 생긴 `myFunction` 내용을 모두 지웁니다.
6. 이 저장소의 `bridge/CloudflareBridge.gs`를 열고 **Raw**로 전체 코드를 복사하여 붙여넣습니다.
7. 저장 아이콘 또는 **Ctrl+S**를 누릅니다.
8. 왼쪽 **프로젝트 설정 (톱니바퀴) → 스크립트 속성 → 스크립트 속성 수정/추가**를 엽니다.
9. 속성 이름 `BRIDGE_SECRET`, 값은 비밀번호 관리자로 생성한 **32자 이상의 무작위 문자열**을 넣습니다. 이 값을 아래 Cloudflare에도 똑같이 넣습니다. 기존 OAuth 속성은 지우지 않습니다.
10. **스크립트 속성 저장**을 누릅니다.
11. 오른쪽 위 **배포 → 새 배포 → 유형 선택 (톱니바퀴) → 웹 앱**을 누릅니다. 기존 앱 주소를 보존하기 위해 데이터 연결용 배포를 하나 추가합니다.
12. 설명: `Cloudflare 데이터 연결`.
13. **다음 사용자 인증 정보로 실행: 나**, **액세스 권한이 있는 사용자: 모든 사용자 (Anyone)**를 선택하고 **배포**합니다.
14. Google 권한 검토가 나오면 OWNER 계정으로 승인합니다.
15. 표시되는 **웹 앱 URL (`/exec`로 끝남)**을 복사합니다. 이것이 `BRIDGE_URL`입니다.

`모든 사용자`는 Cloudflare 서버가 통신할 수 있도록 하는 전송 설정입니다. 새 `doPost`는 서명·시간·중복 요청·Sheet 계정 허용 목록을 모두 검사하며, 서명이 없는 요청은 데이터를 읽거나 쓰지 못합니다. 기존 Drive 폴더와 Sheet 공유 설정은 변경하지 않습니다. Apps Script의 기존 로그인 화면 역시 기존 인증 규칙을 따릅니다.

## 3. Cloudflare에 값 등록

1. Cloudflare **Workers & Pages → code1-workspace → Settings → Variables and Secrets**를 엽니다.
2. 환경은 **Production**을 선택합니다.
3. **Add**로 아래 항목을 각각 추가합니다. 비밀값 항목은 **Secret/Encrypt**로 저장합니다.

| 이름 | 넣을 값 | 종류 |
|---|---|---|
| `APP_ORIGIN` | 1단계에서 복사한 실제 사이트 주소. 끝 `/` 없이 입력 | Text |
| `GOOGLE_CLIENT_ID` | 기존 Google OAuth 웹 클라이언트 ID | Text |
| `GOOGLE_CLIENT_SECRET` | 해당 OAuth 클라이언트의 보안 비밀값 | Secret |
| `SESSION_SECRET` | 새로 생성한 32자 이상 무작위 문자열. BRIDGE_SECRET과 다른 값 | Secret |
| `BRIDGE_URL` | 2단계에서 복사한 데이터 연결 웹 앱 `/exec` 주소 | Secret |
| `BRIDGE_SECRET` | Apps Script에 넣은 BRIDGE_SECRET과 정확히 같은 값 | Secret |

Preview 환경에는 실제 Google 비밀값을 복사하지 않습니다. 미설정 Preview는 로그인 안내 화면만 표시합니다.

## 4. Google 로그인 돌아올 주소 추가

1. Google Cloud Console에서 기존 CODE1 OAuth 클라이언트가 있는 프로젝트를 선택합니다.
2. **Google Auth Platform → Clients (클라이언트)**를 엽니다. 구형 화면에서는 **API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID**입니다.
3. 현재 CODE1에서 쓰는 **웹 애플리케이션** 클라이언트를 누릅니다.
4. **승인된 리디렉션 URI → URI 추가**를 누릅니다.
5. 실제 사이트 주소 뒤에 `/api/auth/callback`을 붙입니다. 예: 사이트 주소가 `https://code1-workspace.pages.dev`일 때만 `https://code1-workspace.pages.dev/api/auth/callback`입니다.
6. **저장**합니다. 기존 Apps Script 리디렉션 URI는 남겨둡니다.
7. **Audience (대상) → Test users (테스트 사용자)**에 OWNER 이메일이 있는지 확인합니다. 두 번째 계정이 확정됐다면 해당 계정도 추가합니다.

## 5. 재배포 후 확인

1. Cloudflare 프로젝트 **Deployments**로 돌아갑니다.
2. 최근 배포 오른쪽 **… → Retry deployment**를 누릅니다. 변경한 환경변수를 적용하는 새 배포가 필요합니다.
3. 성공 후 실제 사이트 주소를 엽니다.
4. **Google 계정으로 로그인**을 누릅니다. 같은 창에서 로그인 후 농가 자료 화면으로 돌아옵니다.
5. 농가 이름을 선택해 기존 자료가 뜨는지 확인합니다.
6. 테스트임을 명확히 한 새 자료에서 임시저장·재접속·파일 업로드·요청서 PDF를 확인합니다.
7. 제안서를 열어 이미지·편집·저장·다시 불러오기·PDF/인쇄를 확인합니다.

이미지 업로드에서 이전 `API(drive)` 오류가 계속되면 기존 Google Cloud 프로젝트에서 **API 및 서비스 → 라이브러리 → Google Drive API → 사용 설정**이 필요합니다. CODE1 Cloudflare 화면 변경만으로 기존 Google API 권한 오류가 해결되지는 않습니다.

## 6. 함께 쓸 계정과 저장소 비공개

- 앱 상단 **계정 설정 → 함께 사용할 계정**에 두 번째 Google 이메일을 입력하고 저장합니다. 제안서 편집 허용 여부도 여기서 정합니다.
- Google OAuth가 Testing이면 위 테스트 사용자에도 같은 이메일을 추가합니다. Sheet나 Drive에 그 사람을 별도로 공개 공유할 필요는 없습니다.
- 실제 배포와 두 계정 사용 확인이 끝난 뒤 GitHub **code1-workspace → Settings → General → Danger Zone → Change repository visibility → Make private**로 변경합니다.
- Cloudflare GitHub 앱이 이 저장소에 계속 접근할 수 있어야 다음 변경도 자동 배포됩니다. 비공개 전환은 이 작업에서 아직 수행하지 않았습니다.

공식 안내: https://developers.cloudflare.com/pages/get-started/git-integration/
