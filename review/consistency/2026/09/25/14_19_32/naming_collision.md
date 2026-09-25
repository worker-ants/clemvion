# 신규 식별자 충돌 검토 — spec-draft-workspace-path-guard

## 발견사항

- **[INFO]** `@WorkspaceParam()` 표기가 두 곳에서 인자 유무가 다르다
  - target 신규 식별자: `@WorkspaceParam(name)` (C-1(c), D-1·D-2) vs `@WorkspaceParam()` (C-5, swagger 체크리스트 문구)
  - 기존 사용처: draft 자신의 C-1(c) "**`@WorkspaceParam('<name>')`** 로 바인딩한다" / D-1 "`@WorkspaceParam(name)` 파라미터 데코레이터" — 이름 인자를 받는 팩토리로 정의
  - 상세: C-5 가 `spec/conventions/swagger.md` §5-4 체크리스트에 적으려는 문구는 "`@WorkspaceId()` · `@WorkspaceParam()` 을 소비하는" 으로, 형제 `@WorkspaceId()` 와 나란히 인자 없는 표기를 썼다. 외부 식별자와의 충돌은 아니지만 같은 draft 안에서 데코레이터 시그니처 표기가 갈려, 이 문서만 보고 구현하는 사람이 "인자 없는 버전도 있나" 헷갈릴 수 있다.
  - 제안: C-5 문구를 `@WorkspaceParam('id')` 또는 `@WorkspaceParam(...)` 형태로 통일해 인자를 받는 팩토리임을 일관되게 표기.

## 확인한 항목 (충돌 없음)

- **`@WorkspaceParam`** — `spec/`, `codebase/backend/src/`, `plan/in-progress/` 전수 grep 0건. 기존 `@WorkspaceId()`(`common/decorators/workspace.decorator.ts`)와 이름이 겹치지 않고 역할도 명확히 분리(헤더/토큰 컨텍스트 vs 경로 파라미터). 신규 식별자로서 충돌 없음.
- **`EDITOR_REQUIRED`** — spec(`error-codes.md`, `3-error-handling.md`) 및 codebase(`backend`, `frontend`) 전수에 기존 사용처 없음. 기존 카탈로그의 `ADMIN_REQUIRED`/`OWNER_REQUIRED`/`AUTH_REQUIRED` 명명 패턴(`<ROLE>_REQUIRED`)과 정합.
- **`OWNER_REQUIRED`** — spec 에는 등재 이력이 없으나(§C-2 가 스스로 "지금 spec 어디에도 없는데 코드 · frontend 가 쓴다" 고 명시) 코드에는 이미 존재(`workspaces.service.ts:507,646`, `workspaces.controller.spec.ts:197`, `workspace-store` 소비 없음, `workspace/settings/page.tsx:1010` 는 `OWNER_REQUIRED` 아니라 재확인 필요 — 실측: frontend 는 `OWNER_REQUIRED` 문자열로 분기). draft 가 새로 발명한 코드가 아니라 **이미 코드가 발행 중인 값을 spec 에 처음 등재**하는 것이라, 다른 의미로 쓰이는 기존 사용처와의 충돌이 아니라 갭 해소다.
- **`NOT_A_MEMBER`** — `spec/5-system/3-error-handling.md:49`, `spec/data-flow/12-workspace.md` 에 이미 "워크스페이스 비멤버(403)" 로 정의돼 있고, draft 는 그 정의를 헤더 위조·경로 워크스페이스·부재 워크스페이스까지 **확장 재사용**한다(같은 의미의 합집합). 다른 의미로의 재정의가 아니므로 충돌 아님.
- **`ADMIN_REQUIRED`** — 기존 정의(`WorkspacesService.assertAdmin()` 발행) 그대로 두고 발행 주체만 `RolesGuard` 를 추가하는 서술이라 의미 변경 없음.
- **Rationale 신설 제목** — "경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)", "가드 거부의 오류 코드 (2026-09-25)" 둘 다 `spec/data-flow/12-workspace.md` 의 기존 9개 Rationale 서브섹션 제목(활성 워크스페이스=토큰 클레임 / 멤버십 검증은 가드 1곳에서 / URL slug=FE 라우팅 SoT / `X-Workspace-Id` 헤더 vs `:id` 경로 파라미터 / `workspace.deleted` 감사 제외 / `workspace_invitation.email` 일치 강제 / 명칭 통일 범위 / personal 워크스페이스 유일성)와 겹치지 않아 앵커 충돌 없음.
- **API endpoint** — draft 는 기존 엔드포인트 15곳의 인가 계층만 바꾸며 새 method+path 를 추가하지 않는다. 충돌 대상 자체가 없음.
- **이벤트/메시지명** — webhook·queue·sse 신규 이벤트 없음(대상 외 관점).
- **환경변수·설정키** — 신규 ENV/config key 없음(대상 외 관점).
- **파일 경로** — draft 는 기존 6개 spec 파일(`spec/data-flow/12-workspace.md`, `spec/5-system/3-error-handling.md`, `spec/5-system/1-auth.md`, `spec/conventions/error-codes.md`, `spec/conventions/swagger.md`, `spec/2-navigation/9-user-profile.md`)만 수정하며 새 spec 파일을 만들지 않음. 새 코드 식별자(`@WorkspaceParam` 데코레이터 파일 등)는 D절의 "후속 developer PR" 구현 범위라 이 draft 자체는 파일 경로를 신설하지 않음.
- **인접 관련 plan 과의 병행 충돌** — `plan/in-progress/auth-guard-reflection-hardening.md` (같은 `RolesGuard`/`@WorkspaceId()` reflection 영역을 다루는 병행 plan)를 대조했으나 `@WorkspaceParam`·`EDITOR_REQUIRED`·`OWNER_REQUIRED` 어떤 식별자와도 겹치지 않음. 남은 미완 항목(§2 메모이제이션)은 이 draft 와 무관한 영역.

## 요약

target 이 새로 도입하는 핵심 식별자는 데코레이터 `@WorkspaceParam(name)` 과 에러 코드 `EDITOR_REQUIRED` 두 개이며, `spec/`·`codebase/`·`plan/in-progress/` 전수 검색 결과 기존에 다른 의미로 쓰이는 동명 식별자는 없다. `OWNER_REQUIRED` 는 이미 코드·frontend 가 발행/소비 중인 값을 spec 카탈로그에 처음 등재하는 것으로, draft 스스로 그 선재 사용을 실측·명시했으므로 "숨은 충돌" 이 아니라 문서화 갭 해소다. `NOT_A_MEMBER`/`ADMIN_REQUIRED` 재사용도 기존 정의의 의미를 유지한 채 발행 지점만 넓히는 것이라 재정의 충돌이 아니다. 두 개의 신설 Rationale 제목도 기존 9개 서브섹션 제목과 겹치지 않아 앵커 충돌이 없다. 유일한 지적은 CRITICAL/WARNING 이 아닌 INFO 수준으로, draft 내부에서 `@WorkspaceParam()` 표기가 인자 유무 두 형태로 섞여 있다는 명명 일관성 보완 제안뿐이다.

## 위험도

NONE
