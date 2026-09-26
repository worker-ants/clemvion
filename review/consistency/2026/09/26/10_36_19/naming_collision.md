# 신규 식별자 충돌 검토 — post-status-openapi

## 대상 요약

이 변경(`plan/in-progress/post-status-openapi.md`)은 POST 액션 14곳에 `@HttpCode(HttpStatus.OK)` 를
추가하고, 초대 취소 DELETE 의 OpenAPI 광고를 204→200(`ApiOkWrappedResponse(OkResultDto)`)으로 정정하며,
신규 정적 가드 `http-status-advertised`(+ fixture)와 신규 e2e `action-success-status.e2e-spec.ts`, 기존
`inviteAndAccept` 헬퍼에서 `createInvitation` 을 분리하는 리팩터를 포함한다. **새 API endpoint·spec
요구사항 ID·엔티티는 도입하지 않는다** — 기존 endpoint 의 응답 코드/광고만 바꾼다. 이 PR 의
`code_areas` diff(1515줄)와 `spec/conventions/swagger.md` 반영분(플래너 커밋 완료분 포함)을 직접 절대경로로
읽어 검토했다.

## 발견사항

### 1. 요구사항 ID 충돌 — 해당 없음

`spec/2-navigation/2-trigger-list.md`, `3-schedule.md` 의 기존 Rationale ID(R-1~R-17)는 이 PR 이
건드리지 않는다. `spec/conventions/swagger.md` 의 새 문단(`### §2-4 광고한 성공 코드 ↔ 실제 성공 코드 —
왜 가드로 세는가 (2026-09-26)`)은 **기존** `### 2-4. 상태 코드 응답 규칙` 절 본문에 이어 붙는 Rationale
추가이지 새 섹션 번호를 만든 것이 아니다 — `§2-4` 재사용은 같은 주제(상태 코드 규칙)의 근거 보강이라
번호 충돌이 아니다. 신규 요구사항 ID 부여 없음.

### 2. 엔티티/타입명 충돌 — 없음 (검증 완료)

신규 export 타입 `ResponseStatusMap` · `HttpStatusViolation` · `HttpStatusUnresolved` · `HttpStatusScan`
(`codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`), 신규 클래스
`HttpStatusAdvertisedFixtureController` · `FixtureResultDto` · `ResStatusCanaryController` 를 전체
`codebase/` 대상으로 grep — 이 파일들 밖에서 동명 식별자 0건. `FixtureResultDto`/`ResStatusCanaryController`
는 테스트 파일 내부에 로컬 정의되고 실제 `AppModule` 어디에도 wiring 되지 않아 런타임 라우트 충돌
가능성도 없음(`@Controller('fixture')`, `@Controller('canary')` 모두 미등록 경로).

- **INFO** — `createInvitation` 헬퍼명이 기존 `WorkspacesController.createInvitation` 핸들러명과 동일
  - target 신규 식별자: `codebase/backend/test/helpers/auth.ts` 의 `export async function createInvitation(...)`
    (이번 PR 이 `inviteAndAccept` 에서 추출)
  - 기존 사용처: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:468`
    `async createInvitation(...)` — `POST /api/workspaces/:id/invitations` 핸들러
  - 상세: 동일 문자열이지만 계층이 다르다(서버 액션 vs e2e 클라이언트 헬퍼). 이 저장소의 기존 관례
    (`createTeamWorkspace`, `registerAndLogin` 등)도 도메인 동사를 그대로 헬퍼명으로 쓰므로, 이 자체가
    새로운 패턴은 아니다. TypeScript 스코프(`test/helpers/auth.ts` export vs `NestJS` 컨트롤러 메서드)가
    분리돼 있어 컴파일·런타임 충돌은 없음.
  - 제안: 실질 위험은 낮으나, 두 식별자가 같은 도메인 동작(초대 생성)을 가리키므로 "무엇을 호출하는
    헬퍼인지" 를 더 분명히 하려면 `createInvitationViaApi` 류로 변경할 수 있음(강제 아님, 기존 자매
    헬퍼들의 명명 관례를 따른 결과라 이대로도 무방).

### 3. API endpoint 충돌 — 없음

이 PR 은 신규 endpoint 를 추가하지 않는다. 14개 POST + 1개 DELETE 모두 **기존** endpoint 의 성공
상태 코드/광고만 바꾼다 (`@HttpCode(HttpStatus.OK)` 추가, `ApiNoContentResponse`→`ApiOkWrappedResponse`).
`spec/2-navigation/3-schedule.md §4` 의 `POST /api/schedules/preview` 행은 상태 코드를 명시하지
않으므로 이 변경과 충돌하는 선언이 없음. `spec/5-system/11-mcp-client.md` 의 `preview-test`
"HTTP 200 OK"·`spec/2-navigation/4-integration.md` 의 `:id/test` "200 + {success:false}" 는 이 PR 이
코드를 그 기존 spec 서술에 맞춘 방향이라 충돌이 아니라 정합화.

### 4. 이벤트/메시지명 충돌 — 없음

신규 webhook/queue/SSE 이벤트명 도입 없음. SSE 스트림(`workflow-assistant sendMessage`)은 상태 줄만
바뀌고 이벤트 페이로드 형식(`error` 이벤트 등)은 그대로.

### 5. 환경변수·설정키 충돌 — 없음

새 e2e(`action-success-status.e2e-spec.ts`)가 쓰는 `E2E_BASE_URL` 은 기존 다른 e2e 파일 전반에서
동일 의미로 이미 쓰이는 환경변수(`agent-memory-admin.e2e-spec.ts` 등)로, 신규 도입이 아니다. 신규
config key 없음.

### 6. 파일 경로 충돌 — 없음, 컨벤션 정합 확인

신규 파일 4개:

- `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`
- `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts`
- `codebase/backend/test/action-success-status.e2e-spec.ts`

`codebase/backend/src/repo-guards/__tests__/` 기존 24개 가드 전수 대조 결과 `<name>-guard.ts` +
`<name>.spec.ts` + `fixtures/<name>/` 3-way 명명 관례를 그대로 따름(예: `param-uuid-pipe-guard.ts` /
`.spec.ts` / `fixtures/param-uuid-pipe/`). 기존 파일명과 겹치는 것 없음. `action-success-status.e2e-spec.ts`
도 `codebase/backend/test/` 기존 목록과 대조해 이름 충돌·오인 소지(`system-status.e2e-spec.ts` 는
System Status API 스펙용으로 도메인이 달라 혼동 낮음) 없음. `spec/conventions/swagger.md` frontmatter
`code:` 목록에도 `http-status-advertised*.ts` glob 이 이미 등재됨(§2-4 인접 코멘트로 확인).

## 요약

이 PR 은 신규 spec 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 도입하지 않으며, 유일한 신규
식별자 표면(정적 가드 `http-status-advertised` 계열 파일·타입, e2e 헬퍼 `createInvitation`)은 전수
grep 대조 결과 기존 코드베이스의 다른 의미로 이미 쓰이는 이름과 충돌하지 않는다. 유일하게 주목할
점은 새 e2e 헬퍼 `createInvitation` 이 이미 존재하는 컨트롤러 핸들러 `WorkspacesController.createInvitation`
과 문자열이 같다는 것인데, 계층이 분리돼 있고 저장소의 기존 헬퍼 명명 관례(도메인 동사 재사용)와
일치해 혼선 리스크가 낮다(INFO). 신규 가드·fixture·e2e 파일은 기존 저장소 명명 컨벤션을 정확히
따른다.

## 위험도

LOW
