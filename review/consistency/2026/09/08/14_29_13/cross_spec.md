# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-done)

## 전제 확인

- target scope(`spec/5-system/`) 의 spec 파일 델타: **0개** — 이 브랜치(`spec-followups-batch-b`)는
  `plan/in-progress/spec-followups-batch-b.md` 에 `spec_impact: none` 으로 명시된 developer 배치이며,
  실측(`git diff origin/main...HEAD -- spec/`)도 0 파일로 일치한다. 델타 0 자체는 CRITICAL 근거가 아니다(코드 전용 PR).
- 구현 diff(20개 파일 전후 / `codebase/**` 기준 25파일·1,038줄)를 워킹트리에서 직접 확인했다(`git diff origin/main...HEAD`).
  내용은 다음 6건으로 요약된다:
  1. `http-exception.filter.ts` — 로컬 `isUniqueViolation` → SoT `isPostgresUniqueViolation` 교체 (raw 23505 표면 → 409)
  2. `workspaces.service.ts::listMembers` — `relations:['user']` 전체 로드 → `select` 투영으로 축소
  3. `integration-oauth.service.ts` (cafe24/makeshop) — 손-작성 constraint 추출 → `pgErrorConstraint()` 치환(동작 불변)
  4. `workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명(백엔드 내부 타입, wire 불변)
  5. `webhook-trigger.e2e-spec.ts` — endpointPath 409 충돌 e2e 신규 1건
  6. `.claude/test-stages.sh` / `tsconfig.build.json` / `PROJECT.md` / repo-guards — 타입체크 ratchet 배선·`__test-utils__` exclude·AST 가드 통합(순수 harness/dev-infra)

## 발견사항

교차 영역 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임의 6개 관점에서 위 6건을 개별 대조했으며, **spec 과 모순되는 항목은 발견되지 않았다.**

- 항목 1(raw 23505 → 409): [`spec/5-system/3-error-handling.md` §1.10](../../../../../spec/5-system/3-error-handling.md) · [§5.3](../../../../../spec/5-system/2-api-convention.md) 이 규정한 `RESOURCE_CONFLICT`/409 계약을 **더 정확히 충족**시키는 방향의 수정이다(종전 코드가 오히려 spec 미달이었다). 신설 e2e(`webhook-trigger.e2e-spec.ts` B4)가 `code=RESOURCE_CONFLICT`·`details={field:'endpoint_path', code:'TRIGGER_ENDPOINT_PATH_CONFLICT'}` 를 단언하며, 이는 §1.10 표와 정확히 일치한다. 충돌 없음.
- 항목 2(listMembers 투영): 투영 컬럼(`id, userId, role, joinedAt, user.{id,email,name}`)은 [`spec/1-data-model.md` §2.3 WorkspaceMember](../../../../../spec/1-data-model.md) 필드 정의와 일치하고, 응답 wire(6키: id/userId/email/name/role/joinedAt)는 변경 전과 동일하다(코드 주석·CHANGELOG 모두 "breaking change 아님" 명시). `User` 민감 7컬럼을 애초에 로드하지 않는 방향은 같은 문서의 `## Rationale`(`select: false` 기각·응답 경계 투영 채택)과 같은 축의 강화이며 모순되지 않는다.
- 항목 3(pgErrorConstraint 치환): 순수 리팩터(동일 두 표면 판정), 계약·데이터모델 변경 없음.
- 항목 4(WorkflowVersionDetailProjection 개명): 백엔드 내부 타입 이름만 바뀌었고, HTTP 응답 wire·필드 형태는 불변. 프런트엔드 `codebase/frontend/src/lib/api/workflows.ts` 의 동명 타입 JSDoc 도 같은 커밋에서 동반 갱신되어 두 문서가 서로를 정확히 가리킨다. API 계약 문서(`spec/5-system/2-api-convention.md`, 데이터 모델)에는 이 타입명이 노출되지 않으므로 영향 없음.
- 항목 5(e2e 신규): 위 항목 1 참조.
- 항목 6(harness/dev-infra): `PROJECT.md`(개발 방법론 문서)만 갱신되고 `spec/**` 는 건드리지 않는다. `PROJECT.md` 는 제품 spec 이 아니라 CLAUDE.md 의 "실제 명령·인프라" 카테고리이므로 Cross-Spec 검토 범위(제품 데이터모델/API/RBAC) 밖이다.

발견된 WARNING/CRITICAL 없음.

## 요약

이번 diff 는 `spec_impact: none` 으로 신고된 developer 배치이고 실측으로도 `spec/**` 델타가 0이며, 코드 변경 6건 모두 (a) 기존 spec 계약(에러 처리 §1.10/§5.3, 데이터 모델 §2.3·`User` 민감 컬럼 Rationale)을 어기지 않고 오히려 §1.10/§5.3 을 더 정확히 충족시키는 버그 수정이거나, (b) wire 계약이 불변인 내부 리팩터(투영·개명·중복 제거)이거나, (c) 제품 spec 범위 밖의 개발 인프라(타입체크 ratchet, e2e, AST 가드) 문서·코드다. 다른 spec 영역(데이터 모델·API 규약·에러 처리)과 대조한 결과 데이터 모델 필드, API 계약 shape, 요구사항 ID, 상태 전이, RBAC, 계층 책임 어느 관점에서도 모순이 발견되지 않았다.

## 위험도

NONE
