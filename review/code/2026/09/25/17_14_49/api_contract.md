# API 계약(API Contract) 리뷰

## 컨텍스트

이 changeset(`codebase/**` 27개 파일)은 워크스페이스 RBAC 강화 작업의 3라운드 리뷰다.
핵심 변경은 세 갈래다.

1. `RolesGuard` 의 멤버십·역할 거부를 `false`(전역 필터 기본값 `FORBIDDEN`)에서 코드가 실린
   `ForbiddenException({code, message})`(`NOT_A_MEMBER` / `EDITOR_REQUIRED` / `ADMIN_REQUIRED` /
   `OWNER_REQUIRED`)로 바꾼다 — **`@Roles()` 가 붙은 전 라우트(2026-09-25 실측 editor 66 · admin 9 ·
   owner 7 · viewer 5)에 적용**.
2. 경로로 워크스페이스를 받는 15곳(`/api/workspaces/:id/...` 14 · `POST /api/auth/workspaces/:id/switch`)을
   평범한 `@Param('id', ParseUUIDPipe)` 대신 신설 `@WorkspaceParam('id')` 로 바꿔, `RolesGuard` 가 헤더·
   토큰이 아니라 **경로 값**을 인가 대상으로 판정하게 한다.
3. 이를 뒷받침하는 CI 정적 가드(`workspace-param-binding-guard` 신설, `param-uuid-pipe-guard` 확장)와
   부트 캐너리(`workspace-reflection-canary`) 확장, 그리고 `workspaces.service.ts` 서비스 계층의
   2차 방어선 동기화.

이미 1·2라운드에서 Warning 16건이 처분됐고, 이번 changeset 은 CHANGELOG(`## Unreleased — 워크스페이스
권한 거부가 코드를 싣고…`)와 `spec/data-flow/12-workspace.md` §Rationale·`spec/5-system/3-error-handling.md`·
`spec/conventions/error-codes.md` §3 이 함께 갱신되어 있어, 아래 관찰 대부분은 이미 disclose·governance
된 상태다. 새로운 CRITICAL/WARNING 은 발견하지 못했다.

## 발견사항

- **[INFO]** `error.code` 전역 breaking change — 이미 disclose 됨, 외부 소비자 확인 필요
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` (클래스 docstring "## 거부 코드
    (2026-09-25~)", `assertMember` 메서드)
  - 상세: `@Roles()` 가 붙은 **모든** 라우트의 403 본문 `error.code` 가 `FORBIDDEN`(구체적 근거 없음)에서
    `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 로 바뀐다. 이 자체는 이번 diff
    가 손대는 27개 파일보다 훨씬 넓은 표면(저장소 전체 `@Roles()` 소비처)에 적용되는 cross-cutting
    breaking change 다. `error.code` 로 분기하는 클라이언트 입장에서는 하위 호환 계약이 깨진다.
  - 확인한 완화 근거: CHANGELOG 에 "`error.code` 로 분기하는 클라이언트는 확인할 것" 이라고 명시
    disclose 돼 있고, `spec/5-system/3-error-handling.md`·`spec/conventions/error-codes.md` §3 이 코드
    카탈로그를 함께 갱신했으며, 1st-party frontend 는 `error.code === 'FORBIDDEN'` 리터럴에 의존하는
    자리가 없음을 grep 으로 확인했다(`OWNER_REQUIRED` 한 자리만 분기, CHANGELOG 서술과 일치). e2e
    (`workspace-rbac.e2e-spec.ts`, `workspace-path-guard.e2e-spec.ts`)도 새 코드 값을 전수 갱신했다.
  - 제안: 코드 변경 자체는 문제 없음. 다만 이 저장소 밖의 제3자/파트너 API 소비자가 있다면 이 항목이
    실제 breaking-change 공지(버전 노트·API changelog 배포)의 대상인지 배포 전 재확인할 것 — 이건
    코드 리뷰로 확인 불가능한 부분이라 INFO 로 남긴다.

- **[INFO]** `POST /:id/transfer-ownership` · `POST /:id/leave` 런타임 201 vs OpenAPI 문서 200 — 기존 불일치, 이번 diff 로 신규 발생 아님
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`transferOwnership`,
    `leave` — `@HttpCode` 없이 `@Post`), `codebase/backend/test/workspace-path-guard.e2e-spec.ts:253`
    (신규 e2e 가 실측 201 을 그대로 단언하며 "OpenAPI 는 200 을 광고한다(기존 불일치, 트래커 등재)" 라고
    직접 주석에 명시)
  - 상세: `@ApiOkWrappedResponse` 는 200 을 광고하지만 `@HttpCode` 데코레이터가 없어 Nest 기본값인 201 이
    실제로 나간다. 이 diff 가 만든 문제는 아니고(`@WorkspaceParam` 전환은 바인딩만 바꿨을 뿐 상태 코드
    로직은 그대로), `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 트래킹돼
    있음을 확인했다. 다만 이번 라운드에서 **새로 작성된 e2e 가 이 불일치를 직접 관측·단언**하므로,
    OpenAPI 로 코드를 생성하는 클라이언트라면 여전히 실제 상태 코드(201)와 문서(200)가 갈린다는 점을
    다시 표면화해 둔다.
  - 제안: 이번 PR 범위에서 고칠 필요는 없음(별도 트래커 항목). 다음에 그 트래커를 처리할 때 이 e2e 의
    주석을 갱신 지점으로 참조하면 된다.

- **[INFO]** 경로 워크스페이스 vs 헤더/토큰 워크스페이스 — 요청 검증 우선순위 문서화 확인, 문제 없음
  - 위치: `codebase/backend/src/common/guards/roles.guard.ts` `canActivate` (경로 파라미터 분기,
    `pathParamNames.length > 0`)
  - 상세: 가드가 파이프보다 먼저 원문을 보므로 형식이 아닌 경로 값(`not-a-uuid`)은 판정 없이 넘기고
    `@WorkspaceParam` 내장 `ParseUUIDPipe` 가 400 을, 형식은 맞는 값(nil UUID 포함)은 가드가 조회해
    403 을 낸다. 이 비대칭은 `common/utils/uuid.ts` 의 `isUuidShaped`/`isValidUuid` 구분과 일관되고,
    e2e(`workspace-path-guard.e2e-spec.ts` "형식이 아닌 경로 값은 400…")로 양쪽 다 실측 커버된다.
    요청 검증 관점에서 결함 없음 — 참고로만 기재.

## 점검 관점별 요약

1. **하위 호환성**: 위 INFO#1 참조 — 의도된, 문서화된 breaking change. 1st-party 클라이언트 영향 없음
   확인. 외부 소비자 영향은 코드 리뷰 범위 밖.
2. **버전 관리**: 별도 API 버저닝(예: `/v1/`) 체계가 없는 기존 구조 그대로이며 이번 diff 가 이를 바꾸지
   않는다 — 새로운 이슈 없음.
3. **응답 형식**: `GlobalExceptionFilter` 의 `{error:{code, message, requestId}}` 봉투는 그대로 유지되고
   `code`/`message` 값만 구체화된다 — 봉투 계약은 깨지지 않는다. INFO#2(상태 코드/문서 불일치)는 기존
   결함.
4. **에러 응답**: `NOT_A_MEMBER`/`EDITOR_REQUIRED`/`ADMIN_REQUIRED`/`OWNER_REQUIRED` 가 가드·서비스
   두 계층에서 동일 상수 테이블(`workspace-roles.ts`)을 공유해 같은 실패에 다른 본문을 내는 문제를
   구조적으로 닫았다 — 이전 리뷰가 지적했을 법한 "코드 있는 경로 vs 코드 없는 경로 불일치" 클래스가
   이 diff 로 해소됨.
5. **요청 검증**: `@WorkspaceParam` 이 `ParseUUIDPipe` 를 내장해 누락 가능성을 구조적으로 차단하고,
   `workspace-param-binding` CI 가드가 평범한 `@Param` 우회를 fail-closed 로 막는다. 충분함.
6. **URL/경로 설계**: 라우트 경로 자체(`/workspaces/:id/...`)는 변경 없음 — 파라미터 바인딩 방식만
   교체.
7. **페이지네이션**: 이 changeset 에 목록 API 페이지네이션 변경 없음 — 해당 없음.
8. **인증/인가**: 이 PR 의 핵심. `@Roles()` 신규 부착(예: `PATCH :id`, `POST :id/members` 등)은 기존
   `@ApiForbiddenResponse` 문서·서비스 계층 `assertAdmin`/`assertWorkspaceType` 호출과 대조했을 때
   **이미 문서·서비스 수준에서 요구되던 권한을 가드 레벨로 앞당긴 것**이라 클라이언트가 관측하는 "허용/
   거부" 여부 자체는 바뀌지 않는다(단, 거부 코드는 위 INFO#1 처럼 바뀐다). `workspace-roles-attachment.spec.ts`
   가 15개 경로 라우트 전부의 `@WorkspaceParam`/`@Roles()` 메타데이터를 reflection 으로 직접 고정해
   회귀를 구조적으로 막는다.

## 요약

워크스페이스 RBAC 를 가드 레벨로 중앙화하는 대규모 리팩터로, 두 가지 실질적인 API 계약 변화
(① 전 `@Roles()` 라우트의 403 에러 코드 변경, ② 경로 워크스페이스 라우트의 인가 판정 기준을 헤더/
토큰에서 경로 값으로 전환)가 있으나 둘 다 CHANGELOG·spec(`12-workspace.md` §Rationale·
`3-error-handling.md`·`error-codes.md` §3)에 상세히 disclose 되어 있고, e2e·unit 테스트가 새 계약을
전수(15개 경로 라우트 + 대표 모듈별 역할 메타데이터) 고정한다. 코드 자체에서 새로운 CRITICAL/WARNING
급 API 계약 결함은 찾지 못했다 — 남은 항목은 이미 알려져 트래킹 중인 사소한 불일치(transfer-ownership
상태 코드/문서 불일치)와, 코드 리뷰만으로는 확인 불가능한 외부 소비자 영향(에러 코드 breaking change)
을 기록해 두는 수준이다.

## 위험도

LOW
