# 정식 규약 준수 검토 — convention_compliance

## 검토 범위 및 방법

- 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- `spec/5-system/` 델타: **0개 파일** (이 브랜치는 그 spec 영역을 바꾸지 않았다 — 정상, 코드 전용 PR)
- 구현 diff: 22개 파일 / 1397줄. 프롬프트 번들에서 diff 본문이 예산 초과로 절단되어, 워킹트리
  (`/Volumes/project/private/clemvion/.claude/worktrees/spec-followups-batch-b-7c31ad`)에서
  `git diff origin/main...HEAD --stat` 및 개별 파일 diff 를 직접 열어 전수 확인했다.
- 확인한 파일: `http-exception.filter.ts`/`.spec.ts`, `source-scan.ts`/`.spec.ts`,
  `workspace-id-fixtures.ts`, `integration-oauth.service.ts`(cafe24/makeshop),
  `workflow-versions.service.ts`, `workspaces.service.ts`/`.spec.ts`,
  `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`(신규), `production-build-devdep.spec.ts`,
  `user-entity-exposure-guard.ts`/`.spec.ts`, `webhook-trigger.e2e-spec.ts`,
  `workspace-rbac.e2e-spec.ts`, `tsconfig.build.json`, `CHANGELOG.md`, `PROJECT.md`,
  `frontend/src/lib/api/workflows.ts`.
- `spec/conventions/**` 대조 대상: `error-codes.md`, `swagger.md`, `secret-store.md`,
  `egress-masking.md`, `node-output.md`, `spec/5-system/2-api-convention.md`,
  `spec/5-system/3-error-handling.md`(둘 다 프롬프트 번들에 전문 포함).

## 발견사항

없음 — CRITICAL/WARNING/INFO 모두 없다.

### 확인 근거 (등급 없음, 참고용 관찰)

이번 diff 는 다음 두 축으로 나뉘고, 둘 다 `spec/conventions/**` 이 규율하는 표면(명명·출력
포맷·문서 구조·API 문서 데코레이터·금지 패턴)을 건드리지 않는다.

1. **내부 테스트/가드/빌드 인프라 리팩터** — `source-scan.ts` 의 `enclosingScopeName` 승격,
   `user-entity-exposure-guard.ts`/`endpoint-path-conflict-wrap-guard.ts` 의 중복 제거,
   `tsconfig.build.json` exclude 확장, `production-build-devdep.spec.ts` 의 `it.each` 통합.
   전부 테스트 전용 코드이며 API 응답·이벤트 페이로드·에러 코드·DTO 를 생성하지 않는다.

2. **보안 하드닝 (DB 레벨 투영)** — `WorkspacesService.listMembers` 의 `relations: ['user']`
   전체 로드를 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 투영으로
   좁혔다. 응답 wire 계약(6키)은 **변경되지 않았다** — CHANGELOG 에도 "breaking change 가
   아니다" 로 명시. 데이터 모델 §2.1.1(`User` 민감 컬럼)·§Rationale(`select: false` 전역
   기각 이유)과 상충하지 않고 오히려 그 원칙을 강화하는 방향이다.

3. **`http-exception.filter.ts` 의 `isPostgresUniqueViolation` 전환** — 로컬
   `isUniqueViolation`(QueryFailedError 한정)을 SoT `pg-error.ts` 의 `isPostgresUniqueViolation`
   (두 표면 커버)으로 교체. 매핑된 top-level 코드는 그대로 `RESOURCE_CONFLICT`/`INTERNAL_ERROR`
   — `error-codes.md §1` 의 `UPPER_SNAKE_CASE` 원칙, §2 의 "정확성 향상만을 위한 rename
   금지" 원칙 모두 위반하지 않는다(코드 값 자체는 rename 되지 않았다).

4. **`WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명** — TypeScript 내부
   타입 이름으로, wire 로 노출되는 에러 코드·필드명·DTO 클래스가 아니다. `error-codes.md`
   의 rename 안정성 정책은 **클라이언트가 값으로 분기하는 wire-level 코드**에 적용되는
   정책이라 이 개명은 그 정책의 적용 대상이 아니다. Swagger 데코레이터가 달린 응답 DTO 도
   아니므로 `swagger.md` 의 DTO 명명 패턴도 적용 대상이 아니다.

5. **신규 e2e (`webhook-trigger.e2e-spec.ts` B4)** — `POST /api/triggers` 의
   `(workspace_id, endpoint_path)` UNIQUE 충돌을 `409 RESOURCE_CONFLICT` +
   `details: { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 로 단언한다.
   이는 **이미 spec 에 문서화된 계약을 그대로 따른 것**이다 —
   `spec/5-system/3-error-handling.md §1.10`(`TRIGGER_ENDPOINT_PATH_CONFLICT` |
   `RESOURCE_CONFLICT`/409 | `details.field='endpoint_path'`)·
   `spec/5-system/2-api-convention.md`("도메인 세부 사유를 어디에 싣는가" 표, 객체
   `details: { field, code, … }` 예시로 동일 코드 인용)와 값·구조가 정확히 일치한다.
   `field` 값이 DB 컬럼명(`endpoint_path`, snake_case)인 것도 일반 검증 오류의
   `details[].field`(요청 필드 경로, camelCase 가능)와는 **의도적으로 다른 레이어**임이
   §2-api-convention.md 본문에 이미 명시돼 있어 새로운 불일치가 아니다. 오히려 이전에
   없던 e2e 계약 검증을 신설해 이 문서화된 규약의 준수를 실측으로 뒷받침한다.

## 요약

이 PR 은 `spec/5-system/` 을 변경하지 않았고, 코드 diff 22개 파일도 대부분 백엔드 내부
테스트/가드/빌드 인프라의 구조적 리팩터(중복 제거·판정 로직 승격·타입체크 ratchet 이동)와
`User` 엔티티 과다 로드를 DB 레벨 `select` 투영으로 좁히는 보안 하드닝이다. 새로 추가된
API 응답 단언(webhook trigger 409 충돌 e2e)은 기존 `error-codes.md`/`2-api-convention.md`/
`3-error-handling.md` 에 이미 명문화된 `UPPER_SNAKE_CASE` 에러 코드·`details` 객체 형태
규약을 그대로 재확인하는 방향이라 위반이 없다. 새 DTO·Swagger 데코레이터·이벤트 페이로드·
API endpoint 명명이 도입되지 않았고, 내부 TS 타입 개명(`WorkflowVersionDetailProjection`)은
wire-level 이름이 아니라 `error-codes.md` rename 정책·`swagger.md` DTO 명명 패턴 어느
쪽의 적용 대상도 아니다. 정식 규약 준수 관점에서 이 변경 세트는 **위반 없음**으로 판정한다.

## 위험도

NONE
