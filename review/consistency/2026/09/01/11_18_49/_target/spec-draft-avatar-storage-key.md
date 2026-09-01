---
title: "spec draft — 아바타 S3 키에서 workspaceId 제외 (§2.7 Rationale 정정)"
worktree: .claude/worktrees/avatar-upload-public-url-be6022
started: 2026-09-01
owner: project-planner
status: in-progress
priority: P1
spec_impact:
  - spec/0-overview.md
  - spec/data-flow/0-overview.md
  - spec/data-flow/4-file-storage.md
  - spec/2-navigation/9-user-profile.md
  - spec/5-system/2-api-convention.md
  - spec/5-system/3-error-handling.md
---

## Overview

`POST /api/users/me/avatar` 구현이 `spec/0-overview.md` §2.7 의 **명시적 Rationale 결정과
충돌**해 `/consistency-check --impl-done` 이 **BLOCK: YES** 를 냈다
(`review/consistency/2026/09/01/01_51_41`). 이 draft 는 그 충돌을 **spec 쪽을 정정해** 해소한다.

**방향은 사용자 결정이다 (2026-09-01)**: 두 선택지 — (a) 코드를 spec 에 맞춰
`{workspaceId}/avatars/...` 로 바꾼다, (b) spec 을 코드에 맞춘다 — 중 **(b)** 를 택했다.
근거는 아래 `## Rationale`.

## 충돌의 정확한 위치

`spec/0-overview.md` `## Rationale` §"S3 객체 키 prefix 설계" 는 지금 이렇게 적는다:

> `:371` **배경**: … Form/**Avatar** 영역은 §2.7 의 키 구조와 같이 이 패턴을 따른다.
> `:372` **채택**: Knowledge Base 원본 문서 키**만** `kb/{kbId}/{documentId}/...` 로 두고
> workspaceId 를 prefix 에서 제외한다.

즉 **"workspaceId 를 빼는 예외는 KB 하나뿐"** 이라는 배타적 서술이다. 구현은
`avatars/{userId}/{uuid}.{ext}` 로 그 예외에 두 번째 항목을 추가했다.

**본문·표만 고치면 충돌이 남는다** — Rationale 이 여전히 "KB 만" 이라고 말하기 때문이다.
초판 위임 plan 이 본문·표만 지목하고 이 절을 빠뜨린 것을 `rationale_continuity` checker 가
지적했다.

---

## 변경안

### A. `spec/0-overview.md` §2.7 — 스토리지 레이아웃

**A-1. 트리** (`:265` 부근). `{workspaceId}/` 아래 있던 `avatars/` 를 밖으로 꺼낸다.

**주석 문구도 함께 고친다** — 실제 파일의 그 줄은 `# Form/Avatar 영역 (계획)` 이다.
"Avatar" 를 남긴 채 최상위 `avatars/` 노드를 더하면 **한 블록에 옛 서술과 새 서술이 공존**해,
이 draft 가 없애려는 오독을 스스로 재도입한다.

```diff
-  {workspaceId}/                   # Form/Avatar 영역 (계획)
+  {workspaceId}/                   # Form 영역 (계획)
     forms/                         # Form 노드 파일 업로드
       {executionId}/
         {fileId}_{originalName}
-    avatars/                       # 프로필 이미지
-      {userId}.{ext}
+  avatars/                         # 프로필 이미지 (구현됨) — workspaceId 없음
+    {userId}/
+      {uuid}.{ext}
```

**A-2. 표** (`:276`). 한 행을 둘로 가른다 — 상태가 갈렸다(Form 미구현 / Avatar 구현됨).

| 영역 | 키 패턴 | 상태 | 코드 |
|------|---------|------|------|
| Knowledge Base 원본 문서 | `kb/{kbId}/{documentId}/{sanitizedFilename}` | 구현됨 | `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:723` |
| Form 노드 업로드 | `{workspaceId}/forms/{executionId}/{fileId}_{originalName}` | 계획 (코드 미구현) | — |
| Avatar (프로필 이미지) | `avatars/{userId}/{uuid}.{ext}` | 구현됨 | `codebase/backend/src/modules/users/users.service.ts` (`avatarKeyPrefix`) |

**A-3. 표 아래 note** (`:278`). "KB 원본 키는" → "KB 원본 키와 Avatar 키는" 으로 넓히고,
**아바타만의 추가 제약**(공개 읽기 + 목록 차단)을 한 문장 덧붙인다. 앵커 링크도 갱신(§E).

> KB 원본 키와 Avatar 키는 `workspaceId` 를 prefix 로 두지 않는다(각각 `kb/...`,
> `avatars/...` 로 시작). 버킷 이름은 `S3_BUCKET` 환경변수(기본 `workflow-storage`,
> `codebase/backend/.env.example`)로 지정한다. **Avatar 키만 공개 읽기 대상**이며, 그
> 버킷 정책은 `avatars/` 접두에 익명 `GetObject` 만 허용하고 **`ListBucket` 은 허용하지
> 않는다**(정책 파일·실측: `scripts/minio/avatars-public-read.json`,
> `scripts/minio/README.md`). 키 설계 근거·기각된 대안은
> [Rationale § S3 객체 키 prefix 설계](#s3-객체-키-prefix-설계--kb-원본과-avatar-키에서-workspaceid-제외-27) 참조.

### B. `spec/0-overview.md` `## Rationale` — **BLOCK 의 핵심**

제목(`:369`)과 본문(`:371`~`:373`)을 함께 고친다.

**제목**: `### S3 객체 키 prefix 설계 — KB 원본 키에서 workspaceId 제외 (§2.7)`
→ `### S3 객체 키 prefix 설계 — KB 원본과 Avatar 키에서 workspaceId 제외 (§2.7)`

**본문**:

- **배경**: 멀티 테넌트 환경에서 S3 키를 `{workspaceId}/...` 로 prefix 하는 것이 일반적
  패턴이다(논리적 격리 + bucket policy 단위 권한 제어). **Form 영역은** §2.7 의 키 구조와
  같이 이 패턴을 따른다.
- **채택**: **두 영역**이 workspaceId prefix 에서 빠진다 — Knowledge Base 원본 문서 키와
  Avatar 키. 근거가 서로 다르다.
  - **KB 원본 문서** `kb/{kbId}/{documentId}/...` — `{workspaceId}/kb/...` 는 키 길이가
    늘어나고 KB list/delete 시 prefix scan 비용이 증가한다. **비용 근거**.
  - **Avatar** `avatars/{userId}/{uuid}.{ext}` — `User` 는 **워크스페이스 비종속
    리소스**다. 한 사용자가 여러 워크스페이스에 속하므로 키를 워크스페이스로 나누면 같은
    사람의 아바타가 워크스페이스마다 갈라지고, 워크스페이스를 옮기거나 추가할 때마다 다시
    올려야 한다. **소유 모델 근거** — 비용 최적화가 아니라 리소스의 귀속이 다르다.
- **Avatar 파일명이 `{userId}.{ext}` 가 아니라 `{uuid}.{ext}` 인 이유**: 아바타는 공개
  버킷에서 서빙되므로(§2.7 note) **키가 곧 접근 통제**다. `{userId}.{ext}` 는 예측
  가능해서, 워크스페이스 멤버 목록을 아는 사람이 다른 사용자의 아바타를 열거·열람할 수
  있다. UUID 는 장식이 아니라 통제 수단이고, 그래서 `ListBucket` 도 함께 막아야 의미가
  있다(둘 중 하나만으로는 통제가 성립하지 않는다).
- **trade-off**: `kbId` 는 KB 메타데이터의 FK 로 workspace 에 종속되므로 KB 쪽 워크스페이스
  격리는 application layer 가 보장한다(`kbId → workspaceId` 조회 후 권한 체크). Avatar 는
  **격리 대상이 아니다** — 공개 읽기가 제품 결정이다(2026-08-31 사용자 결정,
  [`9-user-profile.md §6.1`](2-navigation/9-user-profile.md)). 향후 bucket policy 만으로
  workspace 격리를 강제해야 하는 요구가 생기면 KB 쪽 prefix 재설계 비용이 발생한다. 현
  시점에서 그 요구는 없다.

### C. `spec/data-flow/4-file-storage.md`

**C-1. §1.2 제목·본문** — "(Spec 상 정의되지만 미구현) Form 첨부 / Avatar" 에서 Avatar 를
떼어내고, Avatar 는 **구현된 흐름**으로 §1.3 을 신설한다.

- §1.2 는 `Form 첨부` 만 남긴다(자기-참조 TODO "Form 노드 기능이 도입될 때 갱신" 유지).
- §1.3 **아바타 업로드 (구현됨)** 신설:
  - 진입점 `POST /api/users/me/avatar` (multipart `file`, 최대 2MB)
  - 확장자 화이트리스트 `png`/`jpg`/`jpeg`/`webp`/`gif` — **SVG 는 의도적 제외**(스크립트를
    품을 수 있는 유일한 이미지 포맷이라 공개 URL 서빙 시 저장형 XSS 표면)
  - `Content-Type` 은 **확장자에서 파생**한다(클라이언트 `mimetype` 을 신뢰하지 않는다)
  - 키 `avatars/{userId}/{uuid}.{ext}`, 응답의 `avatarUrl` 은 `s3.publicBaseUrl` 기준 공개 URL
  - 교체 시 옛 객체를 **DB 저장 뒤에** best-effort 로 정리(순서를 뒤집으면 저장 실패 시
    사용자에게 이미 지워진 URL 이 남는다)

**C-2. §2.1 표** — Avatar 행을 실제 패턴·상태로 갱신.

| Prefix / Key 패턴 | 흐름 | 사용 |
| --- | --- | --- |
| `kb/<kbId>/<docId>/<filename>` | KB 문서 | 현재 사용 |
| `<workspaceId>/forms/<executionId>/...` | Form 첨부 | spec 정의, 미구현 |
| `avatars/<userId>/<uuid>.<ext>` | 프로필 이미지 | **현재 사용 (공개 읽기)** |

**C-3. §2.2** — `user.avatar_url` 서술 갱신.

| `user` | `avatar_url VARCHAR(500)` | 외부 URL(OAuth 제공자 사진 등) **또는** 자체 업로드 아바타의 공개 URL. 두 경로가 같은 컬럼을 공유한다 — 자체 업로드 여부는 `avatars/{userId}/` 접두 포함으로 판별한다 |

**C-4. §2.3 ConfigService 표** — 신규 행.

| `s3.publicBaseUrl` | `S3_PUBLIC_BASE_URL` | 공개 오브젝트(아바타)를 **브라우저**가 가져갈 base URL. `s3.endpoint` 는 백엔드가 SDK 로 쓰는 내부 주소라 브라우저가 도달하지 못한다. 미설정 시 `S3_ENDPOINT` → `http://localhost:9000` 순 폴백(`resolvePublicBaseUrl`) |

**C-5. `:128` 앵커 링크** — §E 참조.

**C-6. `:129`~`:131` Rationale note** — "S3 GET 은 서버사이드 `s3Service.download` 뿐이다"
가 이제 **거짓**이다. 아바타 공개 URL 은 브라우저의 **익명 GetObject** 다. 한정을 단다:

> 현재 코드에는 클라이언트용 다운로드 엔드포인트나 presigned URL(`getSignedUrl`/presigner)
> 사용처가 없다 — 인증이 필요한 오브젝트의 S3 GET 은 worker 임베딩 단계의 서버사이드
> `s3Service.download` 뿐이다. **아바타는 예외다**: 공개 버킷 정책으로 브라우저가 직접
> 익명 `GetObject` 하며, 그래서 presigned URL 도 다운로드 엔드포인트도 필요 없다(§1.3).
> 인증 오브젝트에 대한 presigned URL 클라이언트 직접 다운로드는 **미구현 (Planned)** 이며,
> 도입 시 워크스페이스 격리는 DB 권한 검증과 결합해 보강한다.

**C-7. `:19` 상단 인라인 요약** — `s3.publicBaseUrl` 을 목록에 더한다(§2.3 표만 고치면
상단 요약이 stale 해진다).

> - ConfigService 키: `s3.bucket`, `s3.endpoint`, `s3.region`, `s3.accessKey`,
>   `s3.secretKey`, `s3.publicBaseUrl`

### D. `spec/2-navigation/9-user-profile.md`

**D-1. `:136` 아바타 행**:

> | 아바타 | O | 인라인 토글 | **이미지 파일 업로드**(§6.1 `POST /api/users/me/avatar`) 또는 `PATCH /users/me` 의 `avatarUrl` 로 외부 URL 설정/제거. 업로드된 이미지는 **공개 URL 로 서빙된다** — 아래 §6.1 참조 |

**D-2. `:334` 엔드포인트 행** — 취소선·"미구현" 해제:

> | POST | /api/users/me/avatar | 아바타 **이미지 파일** 업로드. `multipart/form-data` 의 `file` 필드, 최대 2MB, 허용 확장자 `png`/`jpg`/`jpeg`/`webp`/`gif`(**SVG 제외**). 성공 시 200 + `PATCH /users/me` 와 동일한 프로필 봉투. 파일 부재 400 `FILE_REQUIRED`, 확장자 불허 400 `INVALID_FILE_TYPE`, 크기 초과 413 |

**D-3. §6.1 에 "공개된다" 는 사실을 본문으로 적는다** — 배지만 뒤집으면 spec 이 "파일
업로드가 된다" 까지만 말하고 **공개 사실을 숨긴다.**

> **서빙 전략 — 공개 버킷 + 공개 URL** (2026-08-31 사용자 결정)
>
> 업로드된 아바타는 **URL 을 아는 누구나 접근할 수 있다.** 워크스페이스 멤버 전용이 아니다.
> 세 안(공개 URL / 서명 URL / 백엔드 프록시) 중 공개 URL 을 택한 대가다.
>
> 완화는 **키의 추측 불가능성** 하나뿐이다 — `avatars/{userId}/{uuid}.{ext}` 의 UUID.
> 그래서 버킷 정책은 `avatars/` 접두에 익명 `GetObject` 만 허용하고 **`ListBucket` 은
> 허용하지 않는다**. 목록이 열리면 추측할 필요가 없어져 통제가 통째로 무너진다.
>
> **배포 선행 조건**: 위 정책이 없으면 업로드는 **성공하고 이미지만 403** 이 된다 —
> 증상이 업로드가 아니라 표시에서 난다. 브라우저가 도달하는 `S3_PUBLIC_BASE_URL` 도 함께
> 필요하다([`data-flow/4-file-storage.md §2.3`](../data-flow/4-file-storage.md)).

**D-4. frontmatter `pending_plans` — 등재하지 않는다.**

첫 판은 `spec-update-avatar-upload-implemented.md` 를 4개 문서의 `pending_plans` 에 등재하려
했다. **그러면 등재 즉시 dangling 이 된다** — 이 draft 의 §A~§H 가 그 트래커의 할 일을
**전항목 소진**하기 때문이다. `plan-lifecycle.md §4` 는 "가리키던 plan 을 `complete/` 로
옮기면 같은 commit 에서 `pending_plans` 도 갱신" 하라고 한다.

대신 **같은 턴에** 트래커를 종결한다:

- 체크리스트 전항목 체크(§A~§H 가 각각 어느 항목을 해소했는지 명시)
- `plan/complete/` 로 이동
- 본문의 "대상은 세 문서다" 서술을 **실제 6개 문서**로 정정(consistency INFO 2)

`pending_plans` 는 **아직 열려 있는** 작업을 가리키는 필드다. 닫는 작업을 거기 적으면 안 된다.

### G. `spec/5-system/2-api-convention.md` §9 — **BLOCK 사유 (consistency Critical)**

`:284` 가 이렇게 적는다:

> 현재 파일 업로드 엔드포인트는 Knowledge Base 문서 업로드(`POST /api/knowledge-bases/:id/documents`)가
> **유일하다**. 유저 아바타는 multipart 업로드가 **아니라** `avatarUrl` URL 필드로
> 관리한다(**별도 업로드 엔드포인트 없음**).

세 군데가 전부 반증됐다. 정정:

> 파일 업로드 엔드포인트는 둘이다 — Knowledge Base 문서 업로드
> (`POST /api/knowledge-bases/:id/documents`)와 아바타 업로드
> (`POST /api/users/me/avatar`, [프로필 §6.1](../2-navigation/9-user-profile.md)).
> 아바타는 `PATCH /users/me` 의 `avatarUrl` 로 **외부 URL 을 넣는 경로도** 함께 유지한다 —
> 두 경로가 같은 컬럼을 공유한다.

**"최대 크기" 행도 함께 고친다** (`:280`) — 지금은 50MB 단일 값이라 아바타 2MB 와 어긋난다:

| 최대 크기 | **엔드포인트별 상이** — KB 문서 50MB, 아바타 2MB (각 `FileInterceptor` `limits.fileSize`) |

### H. `spec/data-flow/0-overview.md` `:273`

같은 배타적 서술이 자매 문서에도 있다:

> … 정합하며, **KB 원본 키만** `workspaceId` prefix 를 제외한다 …

→ "KB 원본 키와 Avatar 키가 `workspaceId` prefix 를 제외한다" 로 넓히고, 근거는
[`spec/0-overview.md` Rationale](../0-overview.md) 참조로 넘긴다(여기서 근거를 복제하면
세 번째 사본이 생긴다).

### E. 앵커 링크 동반 갱신 (제목이 바뀌므로 필수)

§B 가 Rationale 제목을 바꾸므로 그 앵커를 참조하는 **2곳**을 함께 고친다. 실측:

```
$ grep -rn "s3-객체-키-prefix-설계" spec/
spec/0-overview.md:278
spec/data-flow/4-file-storage.md:128
```

`#s3-객체-키-prefix-설계--kb-원본-키에서-workspaceid-제외-27`
→ `#s3-객체-키-prefix-설계--kb-원본과-avatar-키에서-workspaceid-제외-27`

**초판의 이 방법이 좁았고, 그게 첫 `--spec` BLOCK 의 원인이다.** 앵커 grep 은 **링크**만
잡고 같은 주장을 하는 **산문**은 못 잡는다. 실제로 §G(`2-api-convention.md:284`)와
§H(`data-flow/0-overview.md:273`)가 그 그물을 빠져나갔다. 주장 자체로 다시 훑었다:

```
$ grep -rn "아바타" spec --include="*.md" | grep -iE "미구현|없|아니라|planned|URL 필드"
spec/5-system/2-api-convention.md:284        ← §G

$ grep -rn "workspaceId" spec --include="*.md" | grep -iE "KB.*만|원본.*제외|제외한다"
spec/0-overview.md:278, :369, :372, :373     ← §A-3, §B
spec/data-flow/0-overview.md:273             ← §H
```

**교훈**: 문서 목록을 받아 적지 말고 **주장 문구로 전수 검색**한다. 링크는 주장의 일부일 뿐이다.

### F. `spec/5-system/3-error-handling.md` **§1.3** 에러 카탈로그 표 말미

§1.3(공통/검증 계열)에 넣는다 — 두 코드 모두 **범용 검증 에러**이지 KB 전용이 아니다
(`INVALID_FILE_TYPE` 은 이미 KB·아바타 공용이고, `FILE_REQUIRED` 도 향후 다른 업로드가
그대로 쓴다). §1.7~§1.9 의 도메인 특화 절이 아니다.

| `FILE_REQUIRED` | 업로드 요청에 파일이 없거나 내용이 비어 있음. 확장자 불허(`INVALID_FILE_TYPE`)와 **다른 코드**다 — 클라이언트가 취할 행동이 다르다("파일을 고르세요" vs "다른 형식으로 바꾸세요"). 규약이 메시지 문자열 파싱을 금지하므로 코드로 갈라야 분기할 수 있다 | 400 |
| `INVALID_FILE_TYPE` | 확장자 화이트리스트 불일치. **KB 문서 업로드와 아바타 업로드가 공용**으로 쓴다(허용 목록은 각 도메인이 정한다 — KB `txt`/`md`/`pdf`/`csv`, 아바타 `png`/`jpg`/`jpeg`/`webp`/`gif`) | 400 |

---

## Rationale

### 왜 코드가 아니라 spec 을 고치는가 (사용자 결정 2026-09-01)

두 선택지가 있었고 **spec 정정**을 택했다.

- **`User` 는 워크스페이스 비종속 리소스다.** 아바타는 사용자의 속성이지 멤버십의 속성이
  아니다. 키를 `{workspaceId}/` 로 나누면 같은 사람의 아바타가 워크스페이스마다 갈라져,
  워크스페이스를 추가할 때마다 다시 올려야 한다. 이건 최적화 문제가 아니라 **제품 동작이
  틀리는** 문제다.
- 코드를 spec 에 맞추려면 업로드 엔드포인트가 `workspaceId` 를 받아야 하는데, 현재
  `POST /users/me/avatar` 는 **사용자 스코프**다(`payload.sub` 만 쓴다). 워크스페이스를
  받게 하면 "내 프로필" 이라는 엔드포인트의 의미 자체가 바뀐다.
- 코드 리뷰 9라운드에서 requirement·cross_spec reviewer 가 모두 **"코드가 옳고 spec 이
  낡음"** 으로 독립 판정했다.

### 왜 Rationale 절까지 고쳐야 하는가

본문·표만 고치면 Rationale 이 여전히 "workspaceId 를 빼는 예외는 **KB 만**" 이라고 말한다.
그러면 다음 사람이 §2.7 표(Avatar 가 `avatars/...`)와 Rationale(KB 만 예외) 사이에서 어느
쪽이 정본인지 알 수 없고, **Rationale 이 더 강한 문서**이므로 표가 오기로 읽힐 수 있다.

`rationale_continuity` checker 가 이 누락을 잡은 것이 정확히 그 이유다 — 이 저장소는
"기각된 대안·채택 근거" 를 Rationale 에 두고 그걸 **결정의 정본**으로 다룬다.

### 두 예외의 근거를 나란히 적는 이유

KB 제외는 **비용**(prefix scan), Avatar 제외는 **소유 모델**(User 가 워크스페이스 비종속)
근거다. 축이 다르므로 "예외 둘" 로 뭉뚱그리면 다음에 세 번째 후보가 왔을 때 어느 기준으로
판단할지 알 수 없다. 각각의 근거를 분리해 적는다.

### 파일명 UUID 를 Rationale 에 올리는 이유

`{userId}.{ext}` → `{uuid}.{ext}` 는 키 **구조**가 아니라 **접근 통제**다. 구조 표에만
적으면 "그냥 유니크한 이름" 으로 읽혀, 다음 사람이 예측 가능한 이름으로 되돌려도 규칙 위반이
아니게 된다. `ListBucket` 차단과 **짝**이라는 점도 함께 적는다 — 둘 중 하나만으로는 통제가
성립하지 않는다.

### 기각한 대안

- **§2.7 표만 고치고 Rationale 은 그대로 둔다** — 위 §"왜 Rationale 절까지" 참조. 충돌이
  문서 안에 남는다.
- **Avatar 를 §2.7 에서 아예 빼고 `9-user-profile.md` 에만 적는다** — §2.7 은 스토리지
  레이아웃의 단일 진입점이다. 여기서 빠지면 버킷 정책을 설계하는 사람이 아바타 키의 존재를
  모른 채 정책을 만든다. 그게 이 BLOCK 을 만든 위험(운영자가 stale spec 대로 정책을 잡아
  "업로드 성공, 이미지 403")과 같은 종류다.
- **코드를 `{workspaceId}/avatars/...` 로 바꾼다** — 위 §"왜 코드가 아니라" 참조.

## 관련

- BLOCK 근거: `review/consistency/2026/09/01/01_51_41/SUMMARY.md`
- 구현·리뷰 이력: [`spec-sync-user-profile-gaps.md`](./spec-sync-user-profile-gaps.md) §6.1
- 위임 트래커: [`spec-update-avatar-upload-implemented.md`](./spec-update-avatar-upload-implemented.md)
