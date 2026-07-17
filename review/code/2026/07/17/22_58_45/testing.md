# 테스트(Testing) 리뷰

대상: `ai-agent.handler.ts` / `information-extractor.handler.ts` / `node-handler.interface.ts` /
`packages/ai-end-reason/src/index.ts` — `ResumableNodeHandler` 제네릭화(`endReason` 계약을
컴파일 타임 타입으로 잠그는 순수 타입 안전성 리팩터, 런타임 로직 변경 없음).

## 발견사항

- **[INFO]** 런타임 유닛테스트 미추가는 타당함 — 검증 위치가 올바르게 소스로 옮겨짐
  - 위치: 4개 변경 파일 전부 (`_endReasonDomainLock`, `_universalNonEmpty` 등)
  - 상세: 이 PR 은 `implements` 절 + 타입 전용 `const X: T = true; void X;` 단언만 추가하는 순수
    컴파일 타임 변경이라 런타임 동작이 전혀 바뀌지 않는다. plan 문서(결정 #6)가 주장하는 "backend
    ts-jest 는 spec 파일을 `isolatedModules`(tsconfig) 경로로 타입 체크하지 않는다" 는 근거는
    타당하다 — 검증 장치를 spec 이 아니라 소스(`nest build`/`tsc` 가 실제로 통과시키는 자리)에
    두는 설계 선택은 옳다. `.claude/test-stages.sh` 의 `cmd_build` 가 `pnpm --filter backend build`
    (`nest build` = 실제 tsc 전체 타입체크) 와 `_run_internal build`(`@workflow/ai-end-reason` 의
    `tsc` 빌드)를 모두 실행하므로, 이 두 단언은 CI/로컬 빌드 게이트에서 실제로 검사된다. plan 의
    TEST 체크리스트(lint/unit/build/e2e)가 모두 실행된 증거(`_test_logs/e2e-20260717-225316.log`,
    51 Playwright + 백엔드 e2e 통과)도 확인했다. 기존 `ai-agent.handler.spec.ts` /
    `information-extractor.handler.spec.ts` 의 `endMultiTurnConversation` / `buildMultiTurnFinalOutput`
    호출부는 `state as never` 캐스팅을 광범위하게 쓰고 있어 이번 diff 의 타입 변경에 영향받지
    않으며(런타임 값은 그대로 동작), `ai-turn-orchestrator.service.spec.ts` 의 handler mock 들도
    `as unknown as NodeHandler` 로 캐스팅되어 있어 회귀 없음을 확인했다.

- **[WARNING]** `AssertEndReasonDomain`/`UniversalEndReason` 의 "위반 시 실제로 잡는다"는 성질이
  저장소에 회귀 테스트로 고정되지 않음 — 검증기 자체의 무력화가 감지되지 않는다
  - 위치: `codebase/backend/src/nodes/core/node-handler.interface.ts` (`AssertEndReasonDomain` 정의),
    `codebase/packages/ai-end-reason/src/index.ts` (`UniversalEndReason`/`_universalNonEmpty`)
  - 상세: plan 체크리스트에 "비-vacuity 역실증 4축(A 범용 호출부 고유값 / B 구현 좁히기 / C 구현
    넓히기 / D 교집합 붕괴)"이 완료로 표시되어 있으나, 이 검증은 개발 세션 중 임시 프로브로만
    수행되고 저장소에 회귀 아티팩트로 남지 않았다. 리뷰 중 동일한 두 축(좁히기/넓히기)을 직접
    재현해 `nest build`(`tsc --noEmit -p tsconfig.json`) 로 확인한 결과, 현재 `AssertEndReasonDomain`
    은 실제로 두 위반 모두를 `TS2322: Type 'true' is not assignable to type 'never'` 로 정확히
    거부한다(양방향 `extends` 체크가 의도대로 동작) — **현재 구현은 sound 함을 직접 실증**했다.
    문제는 이 sound 함을 지키는 장치가 두 핸들러의 "현재 올바른 사용례" 뿐이라는 점이다: 두
    핸들러가 이미 정확한 도메인으로 구현돼 있으므로 `_endReasonDomainLock` 두 개는 항상 `true`
    로 통과하고, 누군가 나중에 `AssertEndReasonDomain` 의 이중 `extends`(mutual-assignability)
    체크를 실수로 단방향으로 "단순화"하거나 조건부 타입을 리팩터해도 **이 회귀를 잡을 방법이
    저장소 안에 없다** — 정확히 이 PR 이 고치려던 문제(계약이 타입으로 검사되지 않는 상태)가
    검증 유틸리티 자체에서 재발할 수 있다.
  - 제안: `AssertEndReasonDomain` 이 실제로 실패해야 하는 케이스(도메인보다 좁게 받는 구현체,
    넓게 받는 구현체)를 의도적으로 만들고 `// @ts-expect-error` 로 그 실패를 고정하는 네거티브
    fixture 를 **소스 트리**(spec 아님 — spec 은 타입 미검사이므로 무의미, 결정 #6과 동일 근거)
    에 추가해 `nest build` 가 게이트하도록 한다. 예: 이번 리뷰에서 임시로 작성해 검증하고 삭제한
    두 프로브(좁히기/넓히기 더미 핸들러 + `AssertEndReasonDomain<...> = true` 단언)를 참고해
    `// @ts-expect-error` 로 뒤집으면 된다. 이렇게 하면 검증기 자체가 무력화될 때 `nest build`
    가 "unused `@ts-expect-error` directive" 에러로 즉시 알려준다.

- **[INFO]** `isResumableNodeHandler` 가드 자체의 런타임 동작(narrowing 로직)은 이번 diff 로
  바뀌지 않음 — 반환 타입 시그니처만 `ResumableNodeHandler` → `ResumableNodeHandler<UniversalEndReason>`
  로 바뀌었다(컴파일 타임 전용). 기존 `ai-turn-orchestrator.service.spec.ts` 의 관련 테스트가
  이 가드를 간접적으로 exercise 하고 있어 회귀 위험 없음.

## 요약

이번 변경은 `ResumableNodeHandler.endReason` 계약을 런타임 duck-typing 의존에서 컴파일 타임
타입 검사로 전환하는 순수 타입-레벨 리팩터로, 실행 경로/출력 shape 는 전혀 바뀌지 않는다.
새로운 런타임 유닛테스트가 없는 것은 결함이 아니라 — 검증 장치(`implements` + 두 개의
`AssertEndReasonDomain`/`_universalNonEmpty` 컴파일 타임 단언)를 spec 이 아닌 소스에 배치하고
`nest build`/`tsc` 빌드 게이트로 검사되도록 한 설계가 이 프로젝트의 이미 확인된 제약(backend
ts-jest 가 spec 의 타입을 체크하지 않음)에 정확히 부합하기 때문이다. 리뷰 과정에서 두 개의
독립 프로브(도메인 좁히기·넓히기)로 `AssertEndReasonDomain` 이 실제로 위반을 거부함을 직접
재현·확인했고, 기존 회귀 테스트(`ai-agent.handler.spec.ts`, `information-extractor.handler.spec.ts`,
`ai-turn-orchestrator.service.spec.ts`)는 광범위한 `as never`/`as unknown as NodeHandler` 캐스팅
때문에 이번 타입 변경에 영향받지 않고 그대로 유효하다. 유일한 실질 갭은, 이 정교한 타입 검증
유틸리티(`AssertEndReasonDomain`) 가 미래에 실수로 무력화되는 것을 잡아줄 영구 네거티브 fixture
가 저장소에 없다는 점 — 현재는 정상 동작하지만 "검증기의 검증기"가 없는 상태다.

## 위험도

LOW
