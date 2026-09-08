# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

- target 문서: `spec/5-system/` (impl-done 모드, diff-base `origin/main`)
- **scope(`spec/5-system`) 델타: 0개 파일** — 이 브랜치는 spec 을 바꾸지 않았다. 따라서 "target
  문서가 새로 도입하는 식별자" 자체가 spec 층위에는 존재하지 않는다.
- 실제 변경은 `codebase/**` 22개 파일(테스트·가드·소소한 서비스 수정)이며, prompt 번들의
  `<git diff origin/main...HEAD -- code_areas>` 섹션은 예산 초과로 생략되어 있었다. 따라서
  워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/spec-followups-batch-b-7c31ad`)에서
  `git diff origin/main...HEAD -- codebase/` 를 직접 실행해 22개 파일 전량을 확인했다.

## 발견사항

### [INFO] `WorkflowVersionDetail` 명명 충돌이 이번 PR 에서 실제로 해소됨 (신규 충돌 아님)

- target 신규 식별자: 없음 (spec 델타 0) — 다만 **코드 식별자 rename** 이 발생
- 기존 사용처:
  - `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (변경 전)
    — `WorkflowVersionDetail` (backend, `creator: {id,name,email}` 3필드 고정 · `createdAt: Date`)
  - `codebase/frontend/src/lib/api/workflows.ts:107-` — `WorkflowVersionDetail` (frontend,
    `creator` optional/nullable · `createdAt: string`)
- 상세: 두 영역에 **동명·이형(shape 이 다른) 타입**이 공유 타입 패키지 없이 손-미러로
  존재했다. 과거 세 라운드 연속 "유일 정의" 오판을 유발한 것으로 문서화되어 있다
  (`review/consistency/2026/09/06/13_39_25` W3, `review/consistency/2026/09/06/16_29_00` W5).
  이번 diff 는 backend 쪽만 `WorkflowVersionDetailProjection` 으로 **개명**하고, frontend
  쪽 헤더 주석도 "백엔드 대응 타입은 `WorkflowVersionDetailProjection`" 으로 동기화했다.
  `WorkflowVersionsService.findOne` 의 반환 타입도 함께 갱신됨을 확인했다
  (`codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` diff).
  공유 패키지로의 완전 통합(wire 계약 통일)은 범위 밖으로 명시적으로 defer 됨.
- 제안: 조치 불요 — 이번 변경은 **기존 충돌을 없애는 방향**이다. 다만 frontend 의
  `WorkflowVersionDetail` 은 여전히 존재하므로, 향후 다른 영역에서 같은 이름을 재사용할 때는
  이 rename 배경(§`workflow-versions.service.ts` 헤더 주석)을 참조하도록 남겨 둘 것.

### [INFO] `enclosingScopeName` 통합 — 중복 정의 제거, 잔존 동명 함수 없음

- 신규 식별자: `enclosingScopeName` (`codebase/backend/src/common/__test-utils__/source-scan.ts`)
- 기존 사용처: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 의
  로컬 `enclosingName` (동일 책임의 손-복제 알고리즘)
- 상세: 두 AST 워커(`user-entity-exposure-guard.ts`, `endpoint-path-conflict-wrap-guard.ts`)가
  같은 책임의 헬퍼를 각자 손으로 갖고 있던 것을 `source-scan.ts` 로 승격·단일화했다. 승격 시
  로컬 `enclosingName` 정의는 완전히 삭제되고 import 로 교체됨을 diff 로 확인 — 동명·이형
  잔존 정의는 없다.
- 제안: 조치 불요.

### [INFO] `TRIGGER_ENDPOINT_PATH_CONFLICT` — 신규 아님, 기존 spec 정의와 e2e 가 처음 정합 검증됨

- 코드 식별자: `TRIGGER_ENDPOINT_PATH_CONFLICT` (신규 e2e
  `codebase/backend/test/webhook-trigger.e2e-spec.ts` B4 케이스가 단언)
- 기존 사용처: `spec/5-system/3-error-handling.md` §1.10 "트리거 endpointPath 충돌 세부 코드"
  — `details.code = TRIGGER_ENDPOINT_PATH_CONFLICT`, 봉투 `code = RESOURCE_CONFLICT`(409),
  `details.field = 'endpoint_path'` 로 이미 문서화되어 있었다(이번 PR 이전부터, spec 델타 0 과
  일치).
- 상세: 신규 e2e 는 이 기존 spec 계약을 실제 DB unique 위반 경로에서 처음 검증하는 테스트를
  추가했을 뿐, 새 식별자를 도입하지 않았다. 값(`code`/`field`/status)이 spec 표와 정확히
  일치함을 확인했다 — 충돌 없음.
- 제안: 조치 불요.

### [INFO] 트리거 리포지토리 충돌 래퍼(`rethrowEndpointPathConflict`) — 신규 가드가 기존 private 메서드를 검증

- 신규 파일: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`,
  `endpoint-path-conflict-wrap.spec.ts`, `fixtures/endpoint-path-save.fixture.ts`
- 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts` (변경 없음, 이번
  diff 22 개 파일에 미포함) — `private rethrowEndpointPathConflict(err)` 가 이미 존재.
- 상세: 신규 가드가 상수 `CONFLICT_WRAPPER = 'rethrowEndpointPathConflict'` 로 그 기존
  메서드명을 스캔 타깃으로 삼는다. fixture(`endpoint-path-save.fixture.ts`)의
  `FixtureService`·`triggerRepo`·`scheduleRepo` 는 프로덕션 스캔 범위(`src/modules/triggers`)
  밖의 격리된 테스트 전용 선언이라 실제 프로덕션 식별자와 충돌하지 않는다.
- 제안: 조치 불요.

### 그 외 검토한 변경 — 충돌 없음

- `codebase/backend/src/common/filters/http-exception.filter.ts` — 로컬 `isUniqueViolation`
  을 제거하고 기존 공유 헬퍼 `isPostgresUniqueViolation`(`common/db/pg-error.ts`, 이미
  `origin/main` 에 존재, PR #1291/#1292 유래)로 교체. 신규 식별자 없음.
- `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — 로컬 인라인
  `constraint` 추출 로직을 기존 공유 헬퍼 `pgErrorConstraint`(동일 `pg-error.ts`, 기존
  export)로 교체. 신규 식별자 없음.
- `codebase/backend/tsconfig.build.json` — exclude 패턴에 `**/__test-utils__/**` 추가.
  ENV var 도, 설정 키 이름도 아닌 tsc exclude glob 이며 기존 `src/repo-guards/**`,
  `src/shared/testing/**` 패턴과 동일 계열(디렉터리명 기반) — 명명 충돌 없음.
- `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `TypeORM find()` 에
  `select` 프로젝션 객체 추가. 신규 엔티티/DTO/엔드포인트 없음.
- 나머지(`source-scan.spec.ts`, `workspace-id-fixtures.ts`, `oauth-config-mock.ts`,
  `production-build-devdep.spec.ts`, `user-entity-exposure.spec.ts`,
  `workspace-rbac.e2e-spec.ts`, `workflows.ts`(frontend)) — 전부 기존 식별자에 대한 주석
  정정·테스트 보강이며 신규 요구사항 ID·엔티티명·endpoint·이벤트명·ENV/설정키·파일 경로
  도입 없음.

## 요약

이번 PR 은 `spec/5-system/` 자체를 변경하지 않아(델타 0) target 문서 층위에서 새로 도입되는
요구사항 ID·엔티티명·API endpoint·이벤트명·ENV/설정키·spec 파일 경로가 없다. 실제 변경분인
`codebase/**` 22개 파일을 직접 diff 로 전수 검토한 결과, 새로 등장하는 코드 식별자는 모두
기존 공유 헬퍼(`isPostgresUniqueViolation`/`pgErrorConstraint`)의 재사용, 중복 헬퍼의
단일화(`enclosingScopeName`), 또는 **기존에 이미 flag 된 명명 충돌(`WorkflowVersionDetail`
backend/frontend 동명·이형)을 해소하는 rename**이었다. 신규 e2e 가 단언하는
`TRIGGER_ENDPOINT_PATH_CONFLICT` 도 spec §1.10 에 이미 정의된 값과 정확히 일치한다. 새로운
충돌을 유발하는 식별자는 발견되지 않았다.

## 위험도

NONE
