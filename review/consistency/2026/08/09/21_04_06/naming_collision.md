# 신규 식별자 충돌 검토 — spec/5-system/ (impl-done)

## 조사 범위 확인

`git diff origin/main...HEAD -- code_areas` 를 확인한 결과, 이번 변경분은 `spec/5-system/` 을 포함해 **`spec/` 하위 어떤 파일도 건드리지 않는다** (`diff --git a/spec/...` 매치 0건). 실제 diff 는 아래 코드 파일에 한정된다:

- `codebase/backend/README.md` (문서 재구성 — 기존 env var 재서술)
- `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts` (신규, 테스트 전용 UUID 픽스처 모듈)
- `codebase/backend/src/common/decorators/workspace-reflection-canary.ts` (주석 정정 — 73건/142건 구분)
- `codebase/backend/src/common/decorators/workspace.decorator.spec.ts`, `roles.guard.spec.ts`, `workspace-context.util.spec.ts`, `uuid.spec.ts`, `uuid.ts` (기존 로컬 상수를 공유 fixture import 로 치환, 주석 정정)
- `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` (mock 강화)
- `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (dead code 제거)
- `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts` (신규 e2e 파일)

즉 이번 target 은 요구사항 ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·spec 파일 경로를 **하나도 새로 도입하지 않는다**. 아래는 그럼에도 "신규 식별자"에 해당할 수 있는 항목들을 개별 확인한 결과다.

## 확인한 개별 항목

1. **신규 파일 `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts`**
   - `__test-utils__` 디렉터리 명명은 기존 `codebase/backend/src/modules/integrations/__test-utils__` 컨벤션과 동일 — 충돌 없음, 오히려 일관성 강화.
   - export 되는 상수명(`HEADER_WS`, `TOKEN_WS`, `VICTIM_WS`, `OTHER_WS`, `DECOY_WS`, `SAME_WS`, `NIL_WS`)을 저장소 전체에서 `git grep` 했으나 이 신규 파일과 그 파일을 import 하는 3개 스펙(`workspace.decorator.spec.ts` · `roles.guard.spec.ts` · `workspace-context.util.spec.ts`) 외에는 사용처가 없다. 오히려 이 diff 는 종전에 파일마다 **다른 이름(`WS1`/`OWN_WS` 등)으로 흩어져 있던 동일 역할 상수**를 하나의 이름 체계로 통합하는 리팩터라 식별자 충돌을 줄이는 방향이다.

2. **신규 e2e 파일 `codebase/backend/test/secret-store-like-prefix.e2e-spec.ts`**
   - 기존 `codebase/backend/test/*.e2e-spec.ts` 40여 개 파일과 대조 — kebab-case + `.e2e-spec.ts` 접미사 컨벤션을 그대로 따르고, 동일 이름의 기존 파일 없음.

3. **README.md 의 `assertWorkspaceIdReflectionWorks` / `handlerConsumesWorkspaceId` 언급**
   - 두 함수 모두 이번 diff 이전(#1108)에 이미 구현·존재하는 식별자다(`git grep` 확인: `workspace-reflection-canary.ts` export, `main.ts` 에서 호출). README 변경은 기존 함수를 가리키는 설명 섹션을 재구성한 것뿐, 새 함수/새 ENV var 도입이 아니다.

4. **캐너리 카운트 "73건 → 142건" 정정**
   - 식별자가 아니라 수치 주석 정정이며, 오히려 "142건(reflection 전체) vs 73건(`@WorkspaceId()` ∧ `¬@Roles()` 서브셋, `spec/data-flow/12-workspace.md` SoT)" 을 명시적으로 구분해 두 수치의 혼동(과거 실제 발생했던 컨플레이션, `#1108` 2차 impl-done INFO 2)을 해소하는 방향의 수정이다. 두 수치가 가리키는 실제 SoT 문서(`spec/data-flow/12-workspace.md`)는 이번 diff 로 변경되지 않았고 주석의 재설명과 모순되지 않는다.

5. **`secret-resolver.service.spec.ts` 의 로컬 타입 `LastDeleteQuery` / `InMemoryRepository`**
   - 파일-스코프 전용(export 없음), 저장소 전체 검색 결과 다른 위치에서 동일 이름 재사용 없음 — 충돌 가능성 없음.

## 발견사항

없음 — 이번 target(spec/5-system/ impl-done)에서 spec 이 새로 부여하는 요구사항 ID·엔티티/DTO·API endpoint·이벤트명·ENV var·spec 파일 경로가 존재하지 않는다(diff 가 spec/ 를 전혀 건드리지 않음). 코드 diff 가 도입하는 소수의 신규 식별자(테스트 fixture 상수·신규 e2e 파일명)도 기존 컨벤션(`__test-utils__`, `*.e2e-spec.ts` 명명)을 그대로 따르고 저장소 전체에서 동명이의 사용처가 없음을 `git grep` 으로 확인했다.

## 요약

이번 target 은 `spec/5-system/` 영역에 대한 impl-done 검토 요청이지만 실제 diff 는 spec 문서를 전혀 변경하지 않고 backend 코드(테스트 fixture 통합, canary 주석 정정, secret-store LIKE prefix e2e 신설, dead code 제거)에 국한된다. 이 범위 안에서 새로 도입된 식별자는 테스트 전용 상수 7개와 신규 e2e 스펙 파일 1개뿐이며, 모두 기존 명명 컨벤션을 따르고 저장소 전역에서 검증한 결과 기존 사용처와 의미가 겹치는 동명이의 충돌이 없다. 오히려 이 변경은 과거 파일마다 다른 이름으로 흩어져 있던 동일 역할의 워크스페이스 UUID 상수를 하나로 통합하고, "73건 vs 142건" 수치 혼동을 명시적으로 구분해 식별자/수치 혼선을 줄이는 방향이다.

## 위험도

NONE
