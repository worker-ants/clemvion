# 신규 식별자 충돌 검토 — `plan/in-progress/spec-draft-avatar-storage-key.md`

## 검토 범위 및 방법

target 문서는 이미 구현·배포된 코드(`POST /api/users/me/avatar`, `avatars/{userId}/{uuid}.{ext}`,
`S3_PUBLIC_BASE_URL` 등)를 spec 에 처음 등재하거나 상태 배지를 뒤집는 정정 draft다. 새로
"발명"되는 식별자보다는 **코드에는 이미 있었지만 spec 에는 없던 이름**이 대부분이라, 아래 6개
관점 각각에 대해 실제 저장소를 grep 하여 기존 사용처와 의미 충돌 여부를 실측했다.

## 실측 결과 (충돌 없음으로 확인된 항목)

- **`FILE_REQUIRED`** — `spec/5-system/3-error-handling.md` §1 카탈로그에 이 코드 없음(신규
  등재, 충돌처 0). 코드(`users.service.ts:95`)와 의미 일치.
- **`INVALID_FILE_TYPE`** — 이미 `spec/data-flow/4-file-storage.md:52` 에서 **KB 문서 업로드**
  용으로 등재돼 있었다. target 은 이를 "KB 문서 업로드와 아바타 업로드가 공용으로 쓴다"고
  **명시적으로 공유를 선언**하며 각 도메인의 화이트리스트를 구분해 적는다 — 코드
  (`knowledge-base.service.ts:928`, `users.service.ts:115`)도 실제로 같은 문자열을 던진다.
  의미 충돌이 아니라 **의도된 재사용**이고, target 이 그 사실을 숨기지 않고 명문화했다.
- **`S3_PUBLIC_BASE_URL` / `s3.publicBaseUrl`** — `spec/data-flow/4-file-storage.md` §2.3 의
  기존 ConfigService 키(`s3.bucket`·`s3.endpoint`·`s3.region`·`s3.accessKey`·`s3.secretKey`,
  `:84-87`)와 이름이 겹치지 않는다. `codebase/backend/.env.example:163`,
  `s3.config.ts`, `main.ts` 등 코드에는 이미 존재하나 spec 에는 아직 없어 신규 등재이며 충돌
  없음.
- **`POST /api/users/me/avatar`** — `spec/2-navigation/9-user-profile.md:334` 에 **이미
  이 method+path 로 예약**돼 있고(취소선 + "미구현 (Planned)"), target 은 그 동일 엔드포인트의
  상태만 구현됨으로 뒤집는다. 다른 도메인 spec 에서 같은 method+path 를 다른 의미로 쓰는
  곳은 없음(`grep -rn "users/me/avatar" spec/` 결과 이 1건뿐).
- **`avatars/{userId}/{uuid}.{ext}` 키 prefix** — `spec/` 전체에서 이 prefix 를 다른 의미로
  쓰는 곳 없음. `spec/2-navigation/_layout.md:52` 의 "User Avatar" UI 라벨은 같은 개념(사용자
  프로필 이미지)을 가리키는 동일 의미이며 충돌이 아니다.
- **Rationale 제목 앵커** `#s3-객체-키-prefix-설계--kb-원본과-avatar-키에서-workspaceid-제외-27`
  — 신규 슬러그이며 기존 문서 어디에도 동일 텍스트가 없어 앵커 충돌 없음. target §E 가 실측한
  참조처(`spec/0-overview.md:278`, `spec/data-flow/4-file-storage.md:128`) 2곳도 grep 으로
  재확인해 정확했다. (참고: `spec/data-flow/4-file-storage.md:119` 의 로컬 Rationale
  "S3 key 패턴: workspace prefix 를 두지 않는 이유"는 제목이 달라 앵커가 겹치지 않고, 내용도
  KB 전용으로 한정돼 있어 이 정정과 의미 충돌이 없다.)
- **`spec/data-flow/4-file-storage.md` §1.3 신설** — 현재 §1.2 다음은 바로 `## 2. Schema
  매핑`이라 기존 §1.3 이 없다. 번호 충돌 없음.
- **`pending_plans: spec-update-avatar-upload-implemented.md`** — 이미 존재하는 plan 파일을
  참조만 추가하는 것이라 신규 파일 경로 충돌 없음. `9-user-profile.md` 는 이미
  `pending_plans` 프론트매터 키를 갖고 있어(`:23`) 항목 추가일 뿐이고, 나머지 3개 문서
  (`0-overview.md`·`4-file-storage.md`·`3-error-handling.md`)는 이 키가 아직 없어 신규
  추가이며 이름 충돌 없음.
- **에러 카탈로그 테이블 포맷** — `spec/5-system/3-error-handling.md` §1 은 `코드 | 설명 |
  HTTP` 3열 포맷(`:74-90`)이며 target 의 `FILE_REQUIRED`/`INVALID_FILE_TYPE` 행이 이 포맷과
  일치한다. 기존 `VALIDATION_ERROR`(범용 400)와 개념적으로 겹칠 수 있어 보이지만, target 은
  이미 그 필요성(코드 문자열 파싱 금지 규약 하 클라이언트 분기)을 F 절 안에서 스스로 설명하고
  있어 이름 충돌이 아니라 의도된 세분화다.

## 발견사항

- **[WARNING]** A-1 트리 diff 의 context 텍스트가 현재 파일과 어긋난다 — 적용 시 "Avatar" 표기가
  두 곳에 중복 남을 위험
  - target 신규 식별자: `spec/0-overview.md` §2.7 트리에서 최상위로 승격되는 `avatars/` 노드
    (A-1 diff)
  - 기존 사용처: `spec/0-overview.md:265` 실제 현재 텍스트는
    `{workspaceId}/                   # Form/Avatar 영역 (계획)` 이다. 그런데 target A-1 의 diff
    hunk context 는 `{workspaceId}/                   # Form 영역 (계획)` (즉 "Avatar" 가 이미
    빠진 상태)로 적혀 있다.
  - 상세: 이 diff 는 검색-치환 방식으로 적용될 가능성이 높은데, context 줄이 실제 파일과
    글자 단위로 다르면(등호 없음: "Form/Avatar 영역" vs "Form 영역") 그대로 붙여넣기 매칭에
    실패하거나, 수작업으로 옮기는 사람이 원본의 "Avatar" 문구를 놓치고 그대로 둘 수 있다. 그
    경우 트리에는 `{workspaceId}/` 주석에 여전히 "Avatar" 라는 단어가 남고, 그 아래 새로
    승격된 최상위 `avatars/` 노드도 존재해 **같은 블록 안에 "Avatar" 라는 이름이 서로 다른
    두 위치를 가리키며 중복 등장**하게 된다 — 정확히 이 draft 가 해소하려는 "workspaceId 아래
    Avatar 가 있는 것처럼 보이는" 오독을 스스로 재도입할 위험.
  - 제안: A-1 을 실제 적용할 때 `{workspaceId}/` 줄의 주석에서도 "Form/Avatar 영역" →
    "Form 영역"으로 명시적으로 고쳐야 함을 diff 지시에 한 줄 덧붙인다(현재는 diff hunk 의
    context 줄이 이미 고쳐진 것처럼 적혀 있어 이 변경이 "diff 안에 포함됨"이라고 착각하기
    쉽다).

- **[INFO]** `s3.publicBaseUrl` 신규 키가 §2.3 표에만 추가되고 문서 상단 요약 줄에는 누락
  - target 신규 식별자: `s3.publicBaseUrl` / `S3_PUBLIC_BASE_URL` (C-4)
  - 기존 사용처: `spec/data-flow/4-file-storage.md:19` — "ConfigService 키: `s3.bucket`,
    `s3.endpoint`, `s3.region`, `s3.accessKey`, `s3.secretKey`" (인라인 요약, 5개만 나열)
  - 상세: 이름 충돌은 아니지만, C-4 가 §2.3 표에만 새 행을 추가하고 문서 최상단의 같은 목록을
    동반 갱신하라는 지시가 없다. 두 목록이 서로 다른 이름 집합을 말하게 되면(파일 안에서
    "ConfigService 키 목록"이 두 군데 존재) 다음 사람이 `:19` 만 보고 `s3.publicBaseUrl` 이
    존재하지 않는다고 오판할 수 있다.
  - 제안: C-4 지시에 `:19` 인라인 목록에도 `s3.publicBaseUrl` 을 추가하는 항목을 덧붙인다.

## 요약

target 이 도입하는 식별자(`FILE_REQUIRED`, `INVALID_FILE_TYPE`, `s3.publicBaseUrl`/
`S3_PUBLIC_BASE_URL`, `POST /api/users/me/avatar` 상태 변경, `avatars/{userId}/{uuid}.{ext}`
키 prefix, Rationale 제목 앵커)은 전수 grep 결과 spec/ 어디에서도 다른 의미로 이미 쓰이고 있지
않다 — `INVALID_FILE_TYPE` 는 KB 와 공유되지만 target 이 이를 스스로 명시해 의도된 재사용임을
밝혔고, `POST /api/users/me/avatar` 는 이미 예약돼 있던 동일 엔드포인트의 상태 플립일 뿐 새
의미 충돌이 아니다. CRITICAL 급 신규 식별자 충돌은 발견되지 않았다. 다만 A-1 트리 diff 의
context 문구가 실제 파일과 어긋나 있어 적용 과정에서 "Avatar" 표기가 옛 주석과 새 노드 두 곳에
중복 잔존할 위험이 있고(WARNING), `s3.publicBaseUrl` 신규 키가 §2.3 표에만 반영되고 문서 상단
인라인 요약 목록에는 빠져 있어 두 목록이 어긋날 소지가 있다(INFO). 둘 다 식별자 "충돌"이라기보다
반영 누락에 가까우므로 심각도는 낮다.

## 위험도

LOW
