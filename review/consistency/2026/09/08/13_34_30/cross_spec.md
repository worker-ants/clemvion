# Cross-Spec 일관성 검토 — 배치 B (`spec/5-system/`, impl-done)

## 검토 범위 요약

- diff-base `origin/main` 대비 코드 diff: **16개 파일 / 1042줄** (`git diff origin/main...HEAD --stat -- codebase/` 로 재확인, 프롬프트 예산 절단분과 개수 일치). `spec/5-system/**` 자체 델타는 **0개 파일** — 순수 코드 PR.
- 16개 파일 전수를 워킹트리 절대경로 diff 로 직접 열어 확인함: `http-exception.filter.ts`(+spec) · `integration-oauth.service.ts`(+ cafe24/makeshop spec) · `workflow-versions.service.ts` · `workspaces.service.ts`(+spec) · `repo-guards/__tests__/endpoint-path-conflict-wrap-*`(신규 3파일) · `production-build-devdep.spec.ts` · `user-entity-exposure.spec.ts` · `webhook-trigger.e2e-spec.ts` · `tsconfig.build.json` · `frontend/src/lib/api/workflows.ts`.
- 성격: `plan/in-progress/spec-followups-batch-b.md` B-1~B-8 — 전부 developer 스코프의 버그 수정·중복 제거·명명 충돌 해소이며 신규 요구사항·신규 API 계약을 도입하지 않는다.
- **plan frontmatter 확인**: `spec_impact: none` (착수 시점에 `2-trigger-list.md` 오기재를 스스로 정정한 이력이 plan 본문에 기록돼 있음 — 이전 라운드 `review/consistency/2026/09/08/13_22_38` cross_spec/plan_coherence WARNING#1 이 이미 해소됨). 이번 라운드에서 재확인한 결과 동일 결론 유지.

## 발견사항

6개 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임) 전부에서 **CRITICAL/WARNING 급 충돌 없음**. 상세 대조:

### 확인 1 — 트리거 `endpointPath` 409 계약 (신규 e2e B4) vs `spec/5-system/3-error-handling.md` §1.10 / `spec/2-navigation/2-trigger-list.md`

- 코드: `webhook-trigger.e2e-spec.ts` 신규 B4 케이스는 `(workspace_id, endpoint_path)` UNIQUE 위반 시 `409 RESOURCE_CONFLICT` + `details = { field: 'endpoint_path', code: 'TRIGGER_ENDPOINT_PATH_CONFLICT' }` 를 단언(드라이버 원문 미노출도 함께 확인).
- spec 대조: `spec/5-system/3-error-handling.md` §1.10(1741~1747행 부근)이 정확히 이 조합(top-level `RESOURCE_CONFLICT` 유지 + `details.field='endpoint_path'` + 세부 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT`)을 이미 문서화하고 있음. UPPER_SNAKE_CASE 명명도 `spec/conventions/error-codes.md` 규약과 일치.
- 판정: **정합**. 새 e2e 는 문서로만 존재하던 계약을 실 DB 유니크 제약 경로로 처음 검증할 뿐 신규 계약을 만들지 않는다.

### 확인 2 — `User` 민감 컬럼 vs `WorkspacesService.listMembers` DB 투영

- 코드: `listMembers` 쿼리가 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 로 좁혀짐. 반환 매핑(`id, userId, email, name, role, joinedAt` 6키)은 이전과 동일 — wire 계약 불변(CHANGELOG 도 "breaking change 아니다"로 명시).
- spec 대조: `spec/1-data-model.md` §2.1.1 이 정의하는 응답 노출 금지 민감 7컬럼(`passwordHash`·`twoFactorSecret`·`totpRecoveryCodes`·`webauthnRecoveryCodes`·`emailVerifyToken`·`passwordResetToken`·`emailChangeToken`)은 이 투영에 하나도 포함되지 않는다. 같은 절이 금지하는 것은 "**엔티티 전역** 컬럼 수준 `select: false`"(내부 값-소비 경로 fail-silent화)인데, 이번 변경은 **쿼리 하나에 한정된 요청측 투영**이라 그 금지 대상과 다르다 — 코드 주석이 이 구분을 §2.1.1 자체를 인용해 명시.
- 판정: **정합**. §2.1.1 의 "응답 경계에서 지운다" 원칙을 검출→강제 축으로 한 단계 강화.

### 확인 3 — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명

- 코드: 백엔드 내부 타입만 개명(2026-09-08). wire 응답 필드·shape 은 변경 없음.
- spec 대조: `spec/**` 전체에 `WorkflowVersionDetail` 문자열을 참조하는 곳 없음(grep 0건) — 이 이름은 spec 표면이 아니라 backend/frontend 손-미러 코드 사이에서만 존재했다. frontend 쪽(`workflows.ts`)은 이름을 유지한 채 JSDoc 만 갱신해 두 자리를 잇는 참조를 살려 둠.
- 판정: **정합**. 순수 명명 충돌 해소이며 cross-spec 표면에 영향 없음(오히려 과거 W3·W5 "유일 정의" 오판의 원인을 제거).

### 확인 4 — 전역 예외 필터 `isPostgresUniqueViolation` 표면 확장 (raw `err.code` 도 409)

- 코드: 로컬 `isUniqueViolation`(QueryFailedError 인스턴스만 인정) → `pg-error.ts` SoT(`err.code` / `err.driverError.code` 두 표면)로 교체. 양방향 회귀 테스트(23505→409, 23502→500 유지) 확인.
- spec 대조: `spec/5-system/3-error-handling.md` §1.3 이 `RESOURCE_CONFLICT`/409 를 "리소스 충돌(이름 중복 등)" 일반 카테고리로 이미 정의 — 새 표면 검출은 그 카테고리 판정 폭을 넓히는 버그 수정이지 새 계약이 아니다. CHANGELOG 가 "실측 blast radius 0"(요청 경로에 이 표면을 만드는 raw query 없음)을 명시하며, 다른 spec 영역에 "raw 23505 는 500 이어야 한다"는 상충 규정 없음.
- 판정: **정합**.

### 확인 5 — `endpoint-path-conflict-wrap-*` 신규 repo-guard 3파일

- 코드: `triggerRepository.save()` 호출부가 `rethrowEndpointPathConflict` 로 래핑됐는지 세는 정적(AST) 가드. 순수 테스트 인프라, 프로덕션 계약 변경 없음.
- spec 대조: 참조하는 헬퍼 이름(`rethrowEndpointPathConflict`)·에러 코드(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 확인 1 의 기존 spec 정의를 재사용할 뿐 신규 식별자를 spec 레벨에 만들지 않는다. `tsconfig.build.json` 의 `**/__test-utils__/**` exclude 추가도 기존 `repo-guards/**`·`shared/testing/**` exclude 패턴과 동형 — 컨벤션 문서(`conventions/*`)와 충돌 없음.
- 판정: **정합**.

### 확인 6 — cafe24/makeshop OAuth 서비스 리팩터·spec 테스트 이중화(flat/wrapped 두 표면)

- 코드: `constraint` 추출 로직을 `pgErrorConstraint()` 헬퍼로 통합(순수 DRY), 콜사이트 테스트가 flat/`driverError` 두 표면 모두를 케이스로 추가.
- spec 대조: cafe24/makeshop 두 spec 파일 간 구조적 중복은 기존에 의도된 패턴(메모: "cafe24/makeshop 미러 중복은 의도")이고, 이번 변경은 그 패턴을 유지한 채 커버리지만 넓힌다. 도메인 spec(`spec/4-nodes/4-integration/4-cafe24.md`·`5-makeshop.md`, 이번 세션 예산상 본문 미확보)에 영향 주는 API·에러코드 변경 없음(에러코드 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 자체는 불변, 판정 경로만 강화).
- 판정: **정합** (본문 미확보 파일에 대해서는 diff 가 식별자·계약을 하나도 새로 만들지 않으므로 델타 없음으로 판단).

## 요약

이번 배치는 `spec/5-system/` 를 포함해 `spec/**` 를 전혀 수정하지 않는 순수 backend/frontend 버그 수정·중복 제거·타입 명명 충돌 해소·테스트 하드닝 PR 이다. diff 16개 파일 전수를 워킹트리 절대경로에서 직접 대조한 결과, 인용된 두 spec 앵커(`spec/5-system/3-error-handling.md` §1.10·`spec/1-data-model.md` §2.1.1)와 코드의 주장이 정확히 일치했고, 리네임된 내부 타입(`WorkflowVersionDetail`)은 애초에 spec 표면에 등장하지 않아 충돌 여지가 없었다. 이전 라운드(`review/consistency/2026/09/08/13_22_38`)가 지적한 plan `spec_impact` 오기재(WARNING#1)는 이번 착수 시점에 이미 `none` 으로 정정된 상태로 확인됐다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 전부에서 CRITICAL/WARNING 급 발견 없음.

## 위험도

NONE
