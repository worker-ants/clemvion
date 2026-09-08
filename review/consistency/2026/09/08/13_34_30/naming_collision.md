# 신규 식별자 충돌 검토 — `spec/5-system/` (impl-done)

## 검토 방법 메모

`_prompts/naming_collision.md` 는 `spec/5-system` 델타 0개(코드 전용 PR, 예상대로 정상)를 실측했고,
"## 구현 변경 사항" diff 섹션은 예산 절단으로 프롬프트에 실리지 않았다(대신 `related_specs`
번들 — cafe24 API 카탈로그 수백 파일 — 이 예산을 채웠다). 프롬프트 지시에 따라 diff 를
재구성하지 않고, HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/spec-followups-batch-b-7c31ad`)를
`git diff origin/main...HEAD -- codebase/ spec/` 로 직접 열어 실제 변경분(16 files / 1042 lines,
프롬프트가 예고한 수치와 일치)을 확인했다.

## 발견사항

### 신규 spec 식별자 자체는 없음 — 코드 전용 변경

이 diff 는 `spec/**` 를 전혀 건드리지 않는다(0 파일). 새 요구사항 ID·엔티티/DTO 명·API
endpoint·이벤트명·ENV var·spec 파일 경로 중 **spec 문서 레벨에서 새로 도입된 것은 없다**.
diff 에 등장하는 유일한 spec 참조 식별자(`TRIGGER_ENDPOINT_PATH_CONFLICT`)는 신규가 아니라
기존에 이미 `spec/5-system/3-error-handling.md:238`·`spec/2-navigation/2-trigger-list.md:96,166`·
`spec/5-system/2-api-convention.md:200,211` 에 등재된 세부 에러 코드를 **재사용**하는 신규
e2e 테스트(`codebase/backend/test/webhook-trigger.e2e-spec.ts` B4)일 뿐이다. 값 충돌 없음.

### [INFO] `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 — 기존 충돌의 해소(신규 충돌 아님)

- target 신규 식별자: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts`
  의 `WorkflowVersionDetailProjection` (개명 전 `WorkflowVersionDetail`)
- 기존 사용처: `codebase/frontend/src/lib/api/workflows.ts` 의 `WorkflowVersionDetail` (프런트엔드,
  wire 계약이 다른 별도 손-미러 타입 — `creator` optional/nullable·`createdAt: string`)
- 상세: 두 파일이 동명(`WorkflowVersionDetail`)의 서로 다른 타입을 선언하고 있던 것이
  `review/consistency/2026/09/06/13_39_25`(W3)·`review/consistency/2026/09/06/16_29_00`(W5)
  에서 반복 지적된 **선행 충돌**이었다. 이번 diff 는 그 충돌의 **한쪽(백엔드)을 개명해 해소**한
  것이지, 새 충돌을 만드는 것이 아니다. `git grep`으로 확인한 결과 `WorkflowVersionDetailProjection`
  은 backend/frontend 어디에도 이전에 존재하지 않았고(완전 신규), spec 문서 어디에도 이 내부
  TS 타입명을 참조하지 않으므로 spec-코드 간 stale 참조도 없다. 프런트엔드 쪽 `WorkflowVersionDetail`
  은 개명하지 않고 유지 — 이제 이름이 갈렸으므로 grep 이 두 자리를 같은 정의로 잘못 보여주는
  문제도 함께 해소됐다.
- 제안: 없음 — 올바른 해소로 판단. 향후 두 타입을 공유 패키지로 합칠 경우(diff 주석이 명시한
  차기 과제) `WorkflowVersionDetailProjection` 명은 그대로 유지하거나 재차 확인 필요.

### [INFO] `SRC_ROOT` export 4중 반복 — 컨벤션상 정상, 충돌 아님

- target 신규 식별자: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`
  의 `export const SRC_ROOT = path.resolve(__dirname, '..', '..');`
- 기존 사용처: 형제 가드 파일 3곳이 동일 이름·동일 계산식으로 각자 `SRC_ROOT` 를 export 한다
  (`nullable-type-lie-cast-guard.ts`·`user-entity-exposure-guard.ts`·`dto-jsdoc-citation-guard.ts`).
- 상세: 이름은 동일하지만 각 파일이 자신의 모듈 스코프에서 독립적으로 export 하고, 소비처는
  항상 `from './<해당-guard-파일>'` 로 명시 경로 import 하므로 런타임/컴파일 충돌은 없다.
  이 저장소의 기존 가드 컨벤션(파일당 자기 완결 `SRC_ROOT`)을 그대로 따른 것이며, 새 패턴을
  도입한 것이 아니다.
- 제안: 없음(정보성). 다만 가드 파일이 더 늘어나면 공용 `SRC_ROOT` 계산 헬퍼로 추출하는 것을
  고려할 만하나, 이는 이번 diff 의 스코프 밖이며 새로운 충돌 위험도 아니다.

### 기타 신규 식별자 — 충돌 없음 확인

- `CONFLICT_WRAPPER`('rethrowEndpointPathConflict') · `TRIGGER_REPOSITORY`('triggerRepository') ·
  `TriggerSaveSite` · `findTriggerRepositorySaves` · `findUnwrappedTriggerSaves` ·
  `enclosingMethodName` · `isPropertyAccessNamed` · `callsConflictWrapper` ·
  `isWrappedByConflictCatch` (모두 `endpoint-path-conflict-wrap-guard.ts` 신규 파일) — 저장소
  전체에서 동명 함수/상수가 다른 의미로 쓰인 곳 없음을 `grep` 으로 확인. 테스트 인프라 내부
  식별자라 spec·API 표면과 무관.
- `pgErrorConstraint` — `common/db/pg-error.ts` 의 기존 export 를 신규 소비처
  (`integration-oauth.service.ts`)가 추가로 import 한 것뿐, 신규 도입 아님(사전 존재).
- 신규 파일 경로 3개 — `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts`·
  `endpoint-path-conflict-wrap.spec.ts`·`fixtures/endpoint-path-save.fixture.ts` — 기존
  `repo-guards/__tests__/{name}-guard.ts` + `{name}.spec.ts` + `fixtures/{name}.fixture.ts` 3분법
  컨벤션(`user-entity-exposure-guard.ts` 등과 동형)을 그대로 따르며 기존 파일과 겹치지 않는다.
- `tsconfig.build.json` 의 신규 exclude 패턴 `**/__test-utils__/**` — 기존 두 패턴
  (`repo-guards`·`shared/testing`)과 이름이 겹치지 않고, 대상 디렉터리도 다르다. 설정 키
  충돌 없음.
- 신규 테스트 케이스 이름·`it.each` 라벨 — 모두 파일 내부 스코프, 외부 충돌 표면 없음.

## 요약

이 target(`spec/5-system/`) 은 이번 브랜치에서 실제로 변경되지 않았고(spec 델타 0, 정상),
16개 파일·1042줄의 실제 코드 diff 도 신규 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·
ENV var·spec 파일 경로 중 어느 것도 새로 도입하지 않았다. diff 안에서 유일하게 식별자 이름이
바뀐 자리(`WorkflowVersionDetail` → `WorkflowVersionDetailProjection`, 백엔드)는 오히려 과거
컨시스턴시 라운드(W3/W5)에서 지적된 프런트/백엔드 동명 이형 타입 충돌을 **해소**하는 방향이며,
새 이름이 저장소 어디와도 겹치지 않음을 확인했다. 나머지 신규 식별자는 전부 테스트/가드
인프라 내부 스코프로 spec 표면에 노출되지 않는다. 신규 식별자 충돌 관점에서 이 target 은
충돌 없음(NONE) 이다.

## 위험도

NONE
