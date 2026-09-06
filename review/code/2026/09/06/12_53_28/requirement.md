# 요구사항(Requirement) 리뷰

## 개요

이 diff(`origin/main..HEAD`, 6개 커밋: `96d3856a9`→`4529812c6`)는 plan 항목
(`plan/in-progress/spec-draft-nullable-notation-followups.md:285` "`User` 엔티티에 컬럼
수준 방어를 둘지 결정")을 닫는 작업이며, 이미 5차례의 `/ai-review`+`/consistency-check`
라운드(`review/code/2026/09/06/{10_13_22,10_53_48,11_27_53,11_55_36,12_28_02}`)를 거쳐
Critical 1건(`WorkflowVersionsService.findOne` 이 `User` 전 컬럼을 투영 없이 반환)과
다수의 WARNING/INFO 를 이미 처분한 최종 상태다. 마지막 커밋(`4529812c6`)이 직전
라운드(`12_28_02`) WARNING 3 + INFO 3, consistency INFO 1 을 처분한 fix 다.

**독립 검증한 것** (RESOLUTION.md 서술을 그대로 믿지 않고 소스를 직접 열어 대조):
- `WorkflowVersionsService.findOne`/`findByWorkflow` 가 `CREATOR_PROJECTION` 단일 상수를
  공유하고, `workflow-versions.service.spec.ts` 가 그 키 집합을 `WorkflowVersionCreatorDto`
  의 OpenAPI 스키마와 코드로 대조함을 확인 — 값이 아니라 스키마 대조라 "손으로 적은 둘이
  같이 틀리는" 경우도 잡는다.
- `dto-jsdoc-citation-guard.ts`/`.spec.ts` — `EXPECTED_DTO_JSDOC_CITATIONS` 의 두 항목이
  실제 소스(`schedule-response.dto.ts#ScheduleTriggerWorkflowRefDto`,
  `trigger-response.dto.ts#TriggerWorkflowRefDto`)의 클래스 JSDoc 과 정확히 일치함을 확인.
  `collectTsFiles` 가 `includeSpec` 기본값 `false` 라 `dto/responses/*.spec.ts` (예:
  `execution-response.dto.spec.ts` — 우연히 같은 디렉터리에 있고 `StubController` JSDoc 에
  리뷰 인용이 있음)는 스캔 대상에서 자동으로 빠져 오탐이 없음을 실제 스캔 함수 시그니처로
  확인.
- `findUserRelationLoads`/`findEagerUserRelations` 의 fixture(`user-relation-load.fixture.ts`,
  `user-eager-relation.fixture.ts`)가 spec 의 기대 목록·kind 개수와 정확히 일치.
- `tsconfig.build.json` 이 `src/repo-guards/**`·`src/shared/testing/**` 를 제외해 신규
  가드 4파일이 프로덕션 dist 로 안 나감을 확인.
- `workspace-rbac.e2e-spec.ts`(A,S,B,C,D,E,F,G,H,I,J)·`workflow-crud.e2e-spec.ts`(…G,H)
  테스트 레터가 중복·역전 없이 물리적 순서와 일치함을 grep 으로 재확인. `J.` 블록의 `rbac-f-*`
  잔존 문자열도 `rbac-j-*` 로 전부 치환됐음을 확인(파일 다른 곳의 `rbac-f-own` 과 안 겹침).
- `1-auth.md §3`(인가) 이 실제로 RBAC 를 다루고, `§1.3`(구 인용)은 "셀프 호스팅 추가 인증
  (미구현)"으로 무관함을 spec 원문으로 확인 — 정정이 정확하다.
- `WorkspaceMemberDto.joinedAt` 의 `nullable: true` + `string | null` 선언이
  `spec/5-system/2-api-convention.md §5.4` "상시 존재 → `null` 이 기본형" 규칙과 line-level
  로 일치하고, 근거로 든 실측(`workspace_member` 생성 4자리가 전부 `new Date()` 즉시 채움)도
  `workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471` grep 으로 재확인.

## 발견사항

- **[INFO]** `hasProjectionFor` 가 **중첩** `relations`/`select` 조합에서는 안전한 방향으로만
  어긋난다 — 나중에 실제로 나타나면 오탐(과잉 탐지)을 낸다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts` 함수
    `hasProjectionFor` (내부 루프 `for (const sel of prop.initializer.properties)` 가
    `select` **최상위** 프로퍼티만 본다)
  - 상세: `userRelationInInitializer` 는 `relations: { workflow: { creator: true } }` 처럼
    **중첩된** `User` 관계를 재귀로 찾아 `relation = 'creator'` 를 돌려준다(`10_53_48` W2 에서
    확장됨). 그런데 짝이 되는 `hasProjectionFor` 는 같은 옵션 객체의 `select` 를 **한 겹만**
    본다 — TypeORM 에서 이런 중첩 관계를 실제로 좁히려면 `select: { workflow: { creator:
    {...} } }` 처럼 `select` 도 같은 깊이로 중첩해야 하는데, 이 함수는 `select` 의 최상위
    키에서만 `relation`(`'creator'`)을 찾는다. 즉 누군가 `relations: { workflow: { creator:
    true } }` 와 함께 **올바르게 중첩된** `select: { workflow: { creator: CREATOR_PROJECTION
    } } }` 를 써도 이 가드는 투영을 못 찾아 위반으로 잡는다. 방향은 안전하다(false
    positive → 시끄럽게 실패, 실제 유출을 놓치는 false negative가 아니다) — 실측
    (`grep -rn "relations: {" src/modules`)상 현재 저장소에 이런 중첩+중첩투영 조합은
    0건이라 지금 당장 걸리는 자리는 없다.
  - 제안: 급하지 않음(안전한 방향의 이론적 사각) — 실제로 중첩 `User` 관계에 중첩 투영을
    쓰는 자리가 생기면 그때 재귀로 확장한다. 지금 fixture(`compliantProjectedRelations`
    류)에는 이 조합의 양성 대조군이 없어, 확장 시점에 fixture 를 함께 추가해야 한다.

## 요약

핵심 요구사항("감사 로그 유출 이후 `User` 엔티티 자체에 컬럼 수준 방어/검출을 둔다" +
직전 라운드가 찾은 Critical 1·WARNING 다수의 처분)은 최종 코드 상태에서 완전히 충족돼
있다. 구조 축(`findUserRelationLoads`/`collectUserRelationNames`/`findEagerUserRelations`)과
이름 축(`findUserSecretLeaks`/`expectNoUserSecrets`)이 양성·음성 대조군을 갖추고, 실제
유출 지점(`WorkflowVersionsService.findOne`)은 `CREATOR_PROJECTION` 투영 + OpenAPI 스키마
대조 테스트로 닫혔다. 이번 라운드에서 새로 추가된 `dto-jsdoc-citation-guard`(같은 위반이
세 번 나던 JSDoc 리뷰 인용 유출 문제)도 스캔 대상 판정(`isResponseDtoFile`)과
`.spec.ts` 제외 기본값이 정확해 오탐·누락 없이 기존 두 자리를 그대로 재현했다. e2e 레터
중복·순서 역전, spec §1.3/§3 오인용 등 이전 라운드가 지적한 결함은 전부 소스 재확인으로
해소가 확인됐다. TODO/FIXME/HACK/XXX 는 신규 파일 전체에서 0건이다. 새로 발견한 것은
안전한 방향의 이론적 사각(중첩 `select` 미대응) INFO 1건뿐이며, 기능 완전성·엣지 케이스·
에러 시나리오·반환값·spec 정합성 관점에서 Critical/Warning 급 결함은 발견되지 않았다.

## 위험도
LOW
