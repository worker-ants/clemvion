# 테스트(Testing) 리뷰 — masking-residuals-0b195b (12_28_26)

## 검토 방법

`mask-sensitive-fields.util.{ts,spec.ts}` · `handler-output.adapter.{ts,spec.ts}` ·
`execution-context.service.ts` 를 `Read` 로 전문 대조했고, 두 핵심 spec 파일을 직접
`npx jest` 로 실행해 GREEN(2 suites / 84 tests)을 확인했다. 이 PR 은 이미 3라운드
(`10_53_52` CRITICAL→수정, `11_25_15` 재검증, `12_00_05` WARNING→수정)를 거쳤으므로
이미 검증된 결론(포함관계 캐너리 파생 정상, 빈 문자열 대조군 정상)은 반복하지 않고,
**이번 diff 에서 새로 등장한 JSDoc 주장**(`execution-context.service.ts` 의 참조-전달
계약)을 표적으로 독립 뮤테이션을 수행했다.

## 발견사항

- **[WARNING]** `setStructuredOutput` 의 "참조로 저장(no defensive copy)" 계약이 인용된 캐너리로
  실제로는 pin 되지 않는다 (뮤테이션으로 재현)
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:141-148`
    (JSDoc), `:160` (구현 `context.structuredOutputCache[nodeId] = adapted;`)
  - 상세: 이번 diff 의 JSDoc 은 "`adapted` 를 참조로 저장한다 — 방어적 복사 없음. 2026-08-24부로
    load-bearing 이다(config echo 마스킹이 egress 로 옮겨지면서 어댑터가 만들던 fresh 객체가
    사라져, 이제 핸들러 자신의 객체가 그대로 이 장수명 캐시에 들어간다). `handler-output.adapter.spec.ts`
    가 `toBe` 캐너리로 이 참조-전달을 고정한다" 고 명시적으로 주장한다. 그런데 실제로 `handler-output.adapter.spec.ts` 의 `toBe` 캐너리(`[캐너리] config 는 clone 되지 않고 참조로 전달된다`, 118~172행)는 **`adaptHandlerReturn` 함수 하나만** 호출한다 — `ExecutionContextService`/`setStructuredOutput` 은 그 테스트 파일에서 import 조차 되지 않는다. 즉 그 캐너리는 "어댑터가 넘겨준 객체가 원본과 같은 참조인가" 만 고정할 뿐, "`setStructuredOutput` 이 그 참조를 그대로(복사 없이) `structuredOutputCache` 에 저장하는가" 라는 **JSDoc 이 실제로 주장하는 두 번째 절반**은 전혀 건드리지 않는다. `execution-context.service.spec.ts` 를 확인한 결과 `setStructuredOutput`/`setEngineResolvedConfig` 관련 어떤 테스트도 `toBe`/`not.toBe` 로 identity 를 단언하지 않고 전부 `toEqual`(값 동등성)만 쓴다 — 참조 보존 여부는 `toEqual` 로 구분되지 않는다.
    실측(뮤테이션, `cp` 백업 → 복원, `git checkout`/`reset` 미사용): `execution-context.service.ts:160` 을 `context.structuredOutputCache[nodeId] = adapted;` → `context.structuredOutputCache[nodeId] = { ...adapted };` 로 바꿔 JSDoc 이 "load-bearing" 이라 부르는 바로 그 참조-보존을 깼다. 이 상태에서 `npx jest src/modules/execution-engine/context/execution-context.service.spec.ts src/modules/execution-engine/handler-output.adapter.spec.ts` 실행 결과 **66 passed / 66 total** — 두 스위트 모두 조용히 GREEN 이었다. 원복 후 `git status --porcelain`/`git diff` clean 재확인함.
  - 이 저장소가 반복 지적해 온 "그럴듯한 인용이 실제 커버리지를 과대 대표한다" 클래스다 — JSDoc 이
    구체적인 파일명·assertion 종류(`toBe` 캐너리)까지 지목하며 "고정돼 있다"고 선언하지만, 그
    캐너리가 실제로 검사하는 코드 경로와 JSDoc 이 load-bearing 이라 부르는 코드 경로가 서로 다른
    파일의 서로 다른 함수다. 오늘 당장의 보안 유출은 아니다(현재 구현은 참조를 올바르게 보존한다)
    — 하지만 이 비대칭(`setStructuredOutput` 참조 vs `setEngineResolvedConfig` shallow-copy)이
    바로 이 PR 이 "load-bearing" 으로 격상시킨 성질이므로, 회귀가 생겨도 아무 테스트도 못 잡는
    상태로 두면 안 된다.
  - 제안: `execution-context.service.spec.ts` 에 `setStructuredOutput` 전용 identity 캐너리를
    추가한다. 예: `const adapted = { config: { a: 1 }, output: {} }; service.setStructuredOutput(id, node, adapted); expect(service.getContext(id)?.structuredOutputCache[node]).toBe(adapted);` — 필요하면 자매 `setEngineResolvedConfig` 쪽에도 대조군으로 `not.toBe` 를 추가해 JSDoc 이 명시한 비대칭 자체를 양쪽에서 고정한다.

- **[INFO — 확인 완료, 회귀 아님]** 핵심 회귀 스위트 재실행 결과 이상 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts`,
    `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts`
  - 상세: 직접 `npx jest` 실행 결과 **2 suites / 84 tests 전부 GREEN**. 포함관계 캐너리
    (`it.each(KEYS)`, `[...DEFAULT_SENSITIVE_KEYS]` 직접 순회)는 이전 라운드의 CRITICAL 을
    고친 정본 구현 그대로이고, "빈 문자열 대조군" 도 이전 WARNING(`12_00_05` W2, 타입만 확인하는
    vacuous 단언)이 값 단언(`toBe('')`)으로 교체돼 있음을 재확인했다. 새로 손댈 것 없음.
  - 제안: 없음(양호).

- **[INFO]** 저수준 유틸(`deepRedactSecrets` 직접 호출) vs 실제 egress 진입점 사이 간접 — 기존 갭, 신규 아님
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts` 의
    `[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다` 계열
  - 상세: 이 PR 의 안전 주장을 검증하는 캐너리 전부가 `redactStoredDataForResponse`/`maskWireEnvelope` 실제 진입점이 아니라 공유 저수준 함수 `deepRedactSecrets` 를 직접 호출한다. 여러 이전 라운드(`architecture`/`api_contract`/`11_25_15`·`12_00_05` testing)가 이미 같은 갭을 지적하고 "기존부터 있던 갭, 이 PR 이 새로 만든 것 아님"으로 판정했다 — 반복 확인만 하고 이번 라운드의 신규 발견으로 등재하지 않는다.
  - 제안: 없음(별건으로 이미 추적 대상).

## 각 점검 관점별 요약

1. **테스트 존재 여부**: 마스킹 제거·aliasing 변화·포함관계 전제는 대체로 전용 캐너리로 고정돼
   있으나, `execution-context.service.ts` 쪽 참조-저장 계약은 JSDoc 의 인용과 달리 직접 테스트가
   없다 (WARNING 참조).
2. **커버리지 갭**: 위 WARNING 이 이번 라운드의 유일한 신규 갭. 나머지는 기존에 추적된 저-우선순위
   간접 갭뿐(비차단).
3. **엣지 케이스**: null/undefined/circular/비-문자열/빈 문자열/짧은 값 모두 다뤄지고 있으며,
   이전 라운드의 vacuous 단언(빈 문자열 대조군)도 값 단언으로 교정된 상태를 재확인했다.
4. **Mock 적절성**: 신규/기존 테스트 모두 mock 없이 정본 구현(`deepRedactSecrets`,
   `maskSensitiveFields`, `adaptHandlerReturn`)을 그대로 호출 — 우수.
5. **테스트 격리**: `it.each` 각 반복이 매번 새 리터럴을 생성해 상호 간섭 없음(직접 코드 확인).
6. **테스트 가독성**: `[캐너리]`/`[대조군]`/`[메타]` 라벨과 JSDoc 으로 의도가 명확하다. 다만
   `execution-context.service.ts` 의 JSDoc 이 "다른 파일의 캐너리가 이걸 고정한다"고 구체적으로
   인용하면서 실제로는 그 범위 밖이라는 점은 가독성이 오히려 오도하는 방향으로 작용한다.
7. **회귀 테스트**: 두 핵심 spec 파일 직접 재실행 84/84 GREEN. `setStructuredOutput` 뮤테이션은
   `execution-context.service.spec.ts` + `handler-output.adapter.spec.ts` 66/66 GREEN 으로
   무방비 상태임을 실증했다.
8. **테스트 용이성**: `DEFAULT_SENSITIVE_KEYS` export(런타임 미소비, 테스트 전용 명시)는 좋은
   테스트 용이성 개선이다. `setStructuredOutput`/`setEngineResolvedConfig` 자체는 순수 함수에
   가까운 구조라 identity 캐너리를 추가하는 데 구조적 장애가 없다 — 제안대로 몇 줄이면 닫힌다.

## 요약

핵심 마스킹 제거 로직(`handler-output.adapter.ts`)과 그 안전 전제(포함관계 캐너리)는 이미 세 차례의
독립 검증(`10_53_52` CRITICAL 수정 → `11_25_15` 재현 확인 → `12_00_05` WARNING 수정)을 거쳐
견고하며, 이번 라운드 직접 재실행도 84/84 GREEN 이다. 다만 이번 diff 가 `execution-context.service.ts`
에 새로 추가한 JSDoc — "`setStructuredOutput` 은 참조로 저장하며 이는 이 PR 이후 load-bearing 이고
`handler-output.adapter.spec.ts` 의 `toBe` 캐너리가 이를 고정한다" — 은 인용이 가리키는 캐너리가
실제로는 다른 함수(`adaptHandlerReturn`)만 검사할 뿐 `setStructuredOutput` 코드 경로는 전혀 건드리지
않는다는 것을 뮤테이션으로 확인했다(참조 저장을 shallow-copy 로 바꿔도 66/66 GREEN). 오늘 당장의
결함은 아니지만, 이 PR 이 스스로 "load-bearing" 이라 격상시킨 성질에 대한 회귀 그물이 비어 있으므로
WARNING 으로 남긴다.

## 위험도

LOW
