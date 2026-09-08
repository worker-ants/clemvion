# 요구사항(Requirement) 리뷰

## 발견사항

- **[INFO]** 전역 예외 필터의 unique-violation 판정 폭이 넓어짐 — 의도된 변경이며 검증됨
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`} else if (isPostgresUniqueViolation(exception)) {`)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 raw 표면(`err.code` 만 있는 wrap 안 된 23505) 오류를 500 `INTERNAL_ERROR` 로 떨어뜨렸다. 신설 `isPostgresUniqueViolation` (`codebase/backend/src/common/db/pg-error.ts:28`)은 `instanceof` 없이 `err.code ?? err.driverError?.code` 만 보므로, `GlobalExceptionFilter` 를 거치는 **모든** 엔드포인트에서 코드/스크립트가 던지는 임의의 `{code:'23505', ...}` 형태 객체가 409 로 매핑된다. `spec/5-system/3-error-handling.md` §1.10(details 형식)·§2 (에러 봉투 형식)과 직접 충돌하지 않고 오히려 SoT(`pg-error.ts`) 통합 방향에 부합한다. `codebase/backend/src/common/filters/http-exception.filter.spec.ts:127-159` 가 23505→409·23502→500 양방향을 새로 고정했고, `message` 에 원문(`'duplicate key value'`)이 새지 않음도 단언한다(CWE-209 마스킹 유지, 코드 확인함 — `message = 'Resource already exists or has been modified concurrently.'` 로 고정). `plan/in-progress/spec-followups-batch-b.md` B-3 이 "blast radius 실측 0"이라 적은 근거(우리 스키마를 치는 raw query 가 요청 경로에 없음)도 `grep` 으로 재확인했다 — `pg`/`Pool`/`Client` 직접 사용은 `database-query.handler.ts`(사용자 외부 DB 노드)뿐이고, `mcp-client.service.ts` 의 `new Client(...)` 는 Postgres 가 아니라 MCP SDK 클라이언트였다(오탐 배제 확인). 결함이 아니라 확인 완료 사항.
  - 제안: 없음 — 현재 상태 유지로 충분.

- **[INFO]** `WorkspacesService.listMembers` DB 레벨 `select` 투영이 spec §2.1.1 민감 7컬럼 목록과 정확히 정합함
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`(`select` 절), `user.entity.ts`(`id`·`email`·`name` 컬럼 확인)
  - 상세: `spec/1-data-model.md` §2.1.1 이 응답 노출 금지 대상으로 명시한 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 이번 `select: { user: { id: true, email: true, name: true } }` 어디에도 포함되지 않는다. `id`/`email`/`name` 은 `user.entity.ts` 에서 일반 `@Column`(select:false 없음)이라 애초에 값을 읽는 내부 경로를 깨뜨리지 않는다. `user-entity-exposure-guard.ts` 의 `hasProjectionFor()` 로직도 직접 읽어 확인했다 — `select.user` 값이 boolean 이 아니라 객체이므로 이 자리를 위반으로 잡지 않는 것이 코드 상 정확하고, 그래서 `EXPECTED_USER_RELATION_LOADS` 화이트리스트에서 `listMembers` 항목을 제거한 것이 결과와 일치한다(래칫 양방향 성립 확인).
  - 제안: 없음 — 확인 완료.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명이 저장소 전체에서 자기완결적임
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70,153`
  - 상세: `grep -rn "WorkflowVersionDetail\b" codebase/backend/src --include="*.ts"` 로 실측 — 남은 참조는 프런트엔드를 가리키는 JSDoc 주석 한 줄뿐이고, 실제 타입 참조·import 는 백엔드 파일 두 자리(선언·`findOne` 반환 타입)로 전부 개명됐다. 프런트엔드 `codebase/frontend/src/lib/api/workflows.ts` 의 동명 타입은 별개 선언(공유 패키지 아님)이라 이번 개명의 영향을 받지 않으며, JSDoc 만 상호 갱신됐다. 순수 rename 으로 동작 변화 없음 확인.
  - 제안: 없음.

- **[INFO]** 트리거 `endpointPath` 409 e2e(B4) 가 spec §1.10 wire 계약과 line-level 로 일치
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: `spec/5-system/3-error-handling.md` §1.10 은 "top-level `code` 는 상태 기본값 `RESOURCE_CONFLICT` 유지, 세부 사유는 `details` 에 객체 형태로(`details.field='endpoint_path'`, `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`)" 라고 명시한다. 신설 테스트는 `expect(dup.status).toBe(409)` · `error.code === 'RESOURCE_CONFLICT'` · `details` 를 `{ field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 객체 전체로 단언(부분 필드 단언 아님)해 spec 문구와 정확히 대응한다. 프로덕션 구현(`triggers.service.ts:1607` `rethrowEndpointPathConflict`)도 같은 리터럴을 던지는 것을 확인했다. `crypto` import 존재 확인(누락 아님).
  - 제안: 없음.

- **[INFO]** `.claude/test-stages.sh`/`PROJECT.md` 문서가 실제 `tsconfig.build.json` exclude 목록과 일치
  - 위치: `.claude/test-stages.sh:66-85` (`_cmd_typecheck_ratchets`), `codebase/backend/tsconfig.build.json:7-29`
  - 상세: 주석이 나열하는 4개 exclude 패턴(`*spec.ts`·`src/repo-guards/**`·`src/shared/testing/**`·`**/__test-utils__/**`)이 실제 `tsconfig.build.json` 내용과 일치함을 직접 열어 확인했다. `scripts/check-backend-typecheck-ratchet.py`·`check-frontend-typecheck-ratchet.py`·`_typecheck_ratchet.py`·두 baseline JSON 파일이 모두 이미 저장소에 존재해(이번 diff 대상 아님) `cmd_build()` 의 새 호출이 존재하지 않는 스크립트를 참조하는 문제는 없다.
  - 제안: 없음.

- **[INFO]** `RESOLUTION.md` 의 "won't-do" 처분(INFO#5 병렬화, INFO#8 배선 자동 테스트 부재) — 근거가 이 저장소의 기존 관례와 일치
  - 위치: `review/code/2026/09/08/12_53_08/RESOLUTION.md` (`### INFO#5`, `### INFO#8`)
  - 상세: `_cmd_typecheck_ratchets` 의 `cmd_build()` 내 배선 자체를 검증하는 harness 테스트가 없다는 지적에 대해, "이 저장소의 다른 `cmd_*` 조합도 전부 동일하게 미검증"이라는 근거를 `.claude/test-stages.sh` 를 직접 읽어 확인했다 — `cmd_lint`/`cmd_unit`/`cmd_build` 모두 `&&` 체인을 손으로 짠 셸 함수이고 이 조합 자체를 도는 별도 harness 단위 테스트는 존재하지 않는다. 실행 로그 확인(`OK: backend 타입 진단 197건/36파일` 등)으로 최소 1회 실행 검증은 이루어졌다는 서술도 타당한 위험 감수다. 새 결함 아님.
  - 제안: 없음(현행 유지 타당).

## 요약

배치 B(B-1~B-8) 8개 항목이 모두 소스에 반영돼 있고, 앞선 리뷰 라운드(`review/code/2026/09/08/12_53_08`)의 Warning 1건·INFO 4건(테스트 수정 대상) 처분도 코드에 정확히 구현돼 있음을 직접 읽어 확인했다. 핵심 변경 세 갈래 — (1) `GlobalExceptionFilter` 가 `pg-error.ts` SoT(`isPostgresUniqueViolation`)를 쓰도록 통합해 raw 표면 23505 를 409 로 승격, (2) `WorkspacesService.listMembers` 를 DB 레벨 `select` 투영으로 전환해 `User` 민감 컬럼 방어를 검출→강제로 격상, (3) `WorkflowVersionDetail`→`WorkflowVersionDetailProjection` 개명으로 프런트/백 동명 타입 혼동 제거 — 모두 관련 spec 문서(`spec/5-system/3-error-handling.md` §1.10, `spec/1-data-model.md` §2.1.1)와 line-level 로 일치했고, 회귀 테스트가 양방향(증가/감소, 정상/에러)으로 뮤테이션 검증까지 마쳐 있다. `endpoint-path-conflict-wrap-guard`·`user-entity-exposure-guard`·`production-build-devdep.spec.ts` 등 보조 가드 코드도 직접 열어 로직을 추적했으며 fail-open/fail-closed 방향의 엣지 케이스(대조군 fixture)가 갖춰져 있다. TODO/FIXME 류 미완성 표식은 발견되지 않았고, 반환값 누락이나 에러 시나리오 미정의도 없다. `plan/in-progress/spec-followups-batch-b.md` 와 자매 트래커(`spec-draft-nullable-notation-followups.md`)의 체크박스 상태도 실제 diff·문서 반영과 일치함을 grep 으로 확인했다. Critical/Warning 급 결함을 발견하지 못했다.

## 위험도

NONE
