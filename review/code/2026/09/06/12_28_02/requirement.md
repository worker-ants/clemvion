# 요구사항(Requirement) 리뷰

## 개요

대상 plan 항목("`User` 엔티티에 컬럼 수준 방어를 둘지 결정", `plan/in-progress/spec-draft-nullable-notation-followups.md:285`)을 닫는 작업이다. 이 diff 는 이미 4차례의 `/ai-review`+`/consistency-check` 라운드(`review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36}`)를 거쳐 Critical 1건(`WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 투영 없이 반환)과 WARNING 다수를 이미 처분한 최종 상태다. 이번 라운드에서는 그 처분이 실제로 코드에 반영돼 있는지 최종 상태 기준으로 독립 검증했다 — RESOLUTION.md 의 서술을 그대로 믿지 않고 소스를 직접 열어 대조했다.

**검증한 것**:
- `npx jest user-entity-exposure user-secret-absence workflow-versions.service.spec` → 3 suites, **34 passed**.
- `npx eslint` (신규/변경 9개 파일) → clean.
- `WorkflowVersionsService.findOne`/`findByWorkflow` 가 `CREATOR_PROJECTION` 단일 상수를 공유하고, `workflow-versions.service.spec.ts` 가 그 키 집합을 `WorkflowVersionCreatorDto` 의 OpenAPI 스키마와 코드로 대조함을 확인.
- `WorkflowVersionsController.findOne`/`findByWorkflow` 가 `assertWorkspaceOwnership` 을 먼저 호출하고 서비스 반환값을 가공 없이 돌려줌을 확인 — 투영이 곧 보안 경계라는 주석이 실제 흐름과 일치.
- `grep ": User"` 로 엔티티 전수 재검증 — `collectUserRelationNames` 가 파생해야 할 집합(`creator`·`executor`·`owner`·`user`)과 일치.
- `audit-logs.service.ts` 가 `leftJoin`+`addSelect` 준수 형태로 이미 고쳐져 있음, `workspaces.service.ts#listMembers` 의 `joinedAt: m.joinedAt` 무조건 실기, `workspace_member` 생성 4자리(`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`)가 전부 `new Date()` 즉시 채움 — CHANGELOG/DTO 주석의 수치 주장과 실측이 일치.
- `workspace-rbac.e2e-spec.ts`(A,S,B,C,D,E,F,G,H,I,J — 유일·물리순서 일치)·`workflow-crud.e2e-spec.ts`(…G,H)의 테스트 레터가 중복·역전 없이 정리됨을 grep 으로 재확인.

## 발견사항

- **[INFO]** `user-entity-exposure-guard.ts` 의 일부 프로퍼티-이름 비교가 따옴표를 벗기지 않는다 — 이론적 사각 (fail-safe 방향)
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` — `findUserRelationLoads` 내부 `node.name.getText(sf) === 'relations'` (약 371행 부근, 함수 `findUserRelationLoads`), `hasProjectionFor` 내부 `prop.name.getText(sf) !== 'select'` (약 297행 부근, 함수 `hasProjectionFor`)
  - 상세: 같은 파일의 다른 지점들(`userRelationInInitializer` 의 `key = prop.name.getText(sf).replace(/['"]/g, '')`, `hasProjectionFor` 안쪽 `sel.name` 비교)은 프로퍼티 이름에서 따옴표를 벗기고 비교하는데, 위 두 지점은 벗기지 않은 원본 텍스트를 리터럴 `'relations'`/`'select'` 와 직접 비교한다. 만약 소스가 `'relations': {...}` 또는 `select: {..., 'select': {...}}` 처럼 키를 따옴표로 감싸면(문법적으로 유효, 이 저장소 eslint 설정에 `quote-props` 규칙 없음 확인) 이 두 자리는 매칭에 실패한다. 방향은 안전하다 — `relations` 검출 실패는 위반을 통째로 놓치는 게 아니라 그 자리 자체를 스캔에서 빠뜨리는 것이고, `select` 검출 실패는 실제로 투영이 있는데도 "투영 없음"으로 오판해 **거짓 위반**을 내는 쪽(과잉 탐지, 안전한 방향)이다. 이 저장소가 실제로 관찰된 모든 자리에서 unquoted 키만 쓰므로 실질 발생 가능성은 낮다.
  - 제안: 급하지 않음 — 두 비교도 `.replace(/['"]/g, '')` 로 통일하면 일관성이 생기고, 이 가드 자신이 다른 곳에서 강조하는 "표면 형태 변형에 취약하지 않게" 원칙과 맞는다.

- **[INFO]** spec 본문이 `creator` 응답 필드의 구체적 형태(3필드 투영)를 명시하지 않는다 — 회색지대, 이미 추적됨
  - 위치: `spec/3-workflow-editor/5-version-history.md` §7.1/§7.2 (표 "id · workflowId · version · changeSummary · createdBy · createdAt · creator | 포함")
  - 상세: spec 은 `creator` 가 "포함"된다고만 말하고 어떤 하위 필드를 싣는지는 말하지 않는다. 코드가 `{id, name, email}` 로 좁힌 것은 spec 위반이 아니라 spec 침묵 영역에 대한 합리적 보안 결정이지만, spec 이 필드 형태를 규정하지 않으므로 향후 누군가 이 투영을 넓혀도(예: `passwordHash` 추가) 이 spec 문서만으로는 걸리지 않는다. `review/code/2026/09/06/11_27_53/RESOLUTION.md` "남긴 것" 표(INFO#2)에 이미 "spec 쓰기 — planner 후속에 묶임" 으로 등재돼 있어 새 항목은 아니다.
  - 제안: 조치 불요(중복 등재 방지) — 기존 planner 백로그 항목이 처리되면 함께 해소된다.

- **[INFO]** 신규 검출 가드 2쌍(`user-entity-exposure-guard.ts`/`.spec.ts`, `user-secret-absence.ts`/`.spec.ts`)이 어떤 spec `code:` frontmatter 에도 등재되지 않아, 이 가드들을 무르게 고쳐도(예: `USER_SECRET_KEYS` 항목 삭제) `--impl-done` SPEC-CONSISTENCY 게이트가 걸리지 않는다 — 이미 추적됨
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:367-393` ("신규 검출 2축을 §5.4 「검증 층」과 `code:` 에 등재" 항목, 체크박스 미완료)
  - 상세: `spec/` 쓰기는 developer 권한 밖이라(CLAUDE.md) 이 diff 자체가 등재를 미루는 것은 정당한 처분이다. `review/consistency/2026/09/06/10_13_23` 부터 4차례 재확인된 항목이라 새로 지적할 것은 없다.
  - 제안: 조치 불요 — planner 턴에서 §5.4 표 + 두 spec 문서 `code:` glob 갱신 필요(이미 plan 에 구체적 지시 있음).

## 요약

핵심 요구사항("감사 로그 유출 이후 `User` 엔티티 자체에 컬럼 수준 방어/검출을 둔다")은 최종 코드 상태에서 충족돼 있다 — 구조 축(`findUserRelationLoads`/`collectUserRelationNames`/`findEagerUserRelations`)과 이름 축(`findUserSecretLeaks`/`expectNoUserSecrets`) 모두 양성·음성 대조군을 갖추고 실행 시 통과하며(34/34), 두 축이 처음 놓쳤던 실제 유출(`WorkflowVersionsService.findOne`)은 `CREATOR_PROJECTION` 투영으로 닫혔고 그 일치는 주석이 아니라 OpenAPI 스키마 대조 테스트로 강제된다. `WorkspaceMemberDto.joinedAt` 곁가지 추가도 실제 런타임 값(4곳 모두 `new Date()` 즉시 채움)과 DTO 선언이 정확히 일치함을 직접 확인했다. e2e 레터 중복·순서 역전 등 이전 라운드가 지적한 결함은 전부 소스 재확인으로 해소가 확인됐다. 새로 발견한 것은 이론적 위험도가 낮은 INFO 3건뿐이며(따옴표-키 비대칭 1건, spec 침묵 2건 — 후자 둘은 이미 등재된 planner 백로그와 동일 사안), 기능 완전성·엣지 케이스·에러 시나리오·반환값·spec 정합성 관점에서 새로운 Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
LOW
