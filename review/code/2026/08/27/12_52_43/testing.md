# 테스트(Testing) 리뷰 — masking-residuals-0b195b (12_52_43)

## 검토 방법

`mask-sensitive-fields.util.{ts,spec.ts}` · `handler-output.adapter.{ts,spec.ts}` ·
`execution-context.service.{ts,spec.ts}` 를 `Read` 로 전문 대조했다. 이 PR 은 이미 4라운드
(`10_53_52` CRITICAL→수정, `11_25_15` 재검증, `12_00_05` WARNING→수정, `12_28_26` WARNING→수정,
"수렴" 판정)를 거쳤으므로, 반복 검증 대신 **직전 라운드(`12_28_26`)가 새로 추가했다고 주장하는
캐너리가 실제로 이번 diff 에 반영돼 그 주장대로 동작하는지**를 독립 재현으로 확인하는 데 집중했다.

- `npx jest src/modules/execution-engine/context/execution-context.service.spec.ts
  src/modules/execution-engine/handler-output.adapter.spec.ts
  src/common/utils/mask-sensitive-fields.util.spec.ts` 직접 실행 → **3 suites / 111 tests 전부
  GREEN**.
- `explore-tools.service.spec.ts`(`DEFAULT_SENSITIVE_KEYS` 의 유일한 잔존 런타임 소비처)도
  직접 실행 → **18/18 GREEN**, 이번 export-only 변경으로 인한 회귀 없음.
- **뮤테이션 재현**(`cp` 백업 → 복원, `git checkout`/`reset` 미사용): `execution-context.service.ts`
  의 `context.structuredOutputCache[nodeId] = adapted;` 를 `= { ...adapted };` 로 바꿔
  `12_28_26` WARNING 이 지적한 바로 그 미검증 회귀(참조 저장이 shallow-copy 로 후퇴)를
  재현했다. 결과: `execution-context.service.spec.ts` 의 신규
  `[캐너리] adapted 래퍼와 그 config 를 참조 그대로 캐시에 눕힌다` 가 **정확히 RED** 로 잡았다
  (`1 failed / 68 passed`, 나머지 스위트는 영향 없음). `12_28_26` 라운드 시점엔 이 뮤테이션이
  `66/66 GREEN`(무방비)이었던 것과 대조된다 — **이번 라운드에서 그 갭이 실제로 닫혔음을
  직접 재현으로 확인**했다. 원복 후 `git status --porcelain`/`git diff` clean 재확인함.

## 발견사항

- **[정보 — 확인 완료]** `12_28_26` W1(`setStructuredOutput` 참조-저장 계약 무방비)이 이번
  diff 에서 실제로 닫혔다 (독립 뮤테이션 재현)
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts:236-272`
    (`describe('setStructuredOutput — 참조 저장 (방어적 복사 없음)'`, 캐너리 2건),
    `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:168`
    (`context.structuredOutputCache[nodeId] = adapted;`)
  - 상세: 신규 캐너리 두 건이 각각 `toBe(adapted)`/`toBe(rawConfig)` identity 단언과 "반환 후
    변형이 캐시에 보인다" 단언으로 구성돼, 이전 라운드가 지적한 "JSDoc 이 인용한 캐너리가 실제
    범위 밖" 문제를 해소한다. 위에서 서술한 대로 mutation 으로 직접 재현해 RED 를 확인했다.
  - 제안: 없음(양호). 종전 WARNING 을 CLOSED 로 표기 가능.

- **[INFO]** 안전 주장 캐너리 전량이 여전히 실제 egress 진입점이 아니라 공유 저수준 함수를
  직접 호출한다 (기존 갭, 여러 라운드에 걸쳐 이미 추적됨 — 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.spec.ts:179-194`
    (`[캐너리] 어댑터가 남긴 원문을 egress 마스커가 가린다`), `:201-215`
    (`[캐너리] 비-문자열 자격증명 값도...`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts:145-153`
    (`it.each(KEYS)`)
  - 상세: 이 PR 의 핵심 안전 주장("어댑터가 원문을 남겨도 REST/WS egress 가 가린다")을 검증하는
    모든 캐너리가 `deepRedactSecrets` 를 직접 호출할 뿐, 실제 진입점
    (`redactStoredDataForResponse`/`redactNodeExecutionRow`, `maskWireEnvelope`)을 통과시키는
    통합 테스트는 이 diff 범위에 없다. `architecture`/`api_contract`/`11_25_15`·`12_00_05`·
    `12_28_26` testing 리뷰가 이미 동일 갭을 반복 지적했고 "기존부터 있던 갭, 신규 아님"으로
    판정된 바 있어 이번 PR 을 막을 사유는 아니다 — 재확인만 하고 신규 발견으로 등재하지 않는다.
  - 제안: 없음(별건으로 이미 추적 대상, `api_contract.md` WARNING 이 동일 항목 등재).

## 각 점검 관점별 요약

1. **테스트 존재 여부**: 이 라운드에서 diff 에 새로 반영된 코드(마스킹 제거, aliasing 변화,
   포함관계 전제, `setStructuredOutput` 참조-저장 계약)가 각각 전용 캐너리로 고정돼 있다 — 양호.
2. **커버리지 갭**: 4라운드에 걸쳐 지적된 CRITICAL 1건·WARNING 5건이 이번 diff 시점 기준
   전부 독립 재현으로 해소가 확인됐다. 남은 갭은 저수준 유틸 vs 실제 egress 진입점 간접
   (기존 INFO, 비차단, 위 참조).
3. **엣지 케이스**: null/undefined/circular/비-문자열/빈 문자열/짧은 값/참조 aliasing 모두
   전용 캐너리·대조군으로 다뤄진다.
4. **Mock 적절성**: mock 없이 정본 구현(`deepRedactSecrets`, `maskSensitiveFields`,
   `adaptHandlerReturn`, `ExecutionContextService`)을 그대로 호출 — 우수. 새 참조-저장 캐너리도
   실제 서비스 인스턴스에 대해 동작한다.
5. **테스트 격리**: `execution-context.service.spec.ts` 최상단 `beforeEach` 가 매 테스트마다
   `new ExecutionContextService()` + `createContext` 로 완전히 새 인스턴스를 만든다(직접
   확인) — `setStructuredOutput`/`setEngineResolvedConfig` 신규 describe 블록도 이 격리를
   그대로 상속해 테스트 간 상태 누수가 없다.
6. **테스트 가독성**: `[캐너리]`/`[대조군]`/`[메타]` 라벨과 "왜 이 테스트가 있는가"를 설명하는
   JSDoc/주석이 일관되게 유지된다. `setStructuredOutput`/`setEngineResolvedConfig` 자매 대조군
   쌍(참조 저장 vs shallow-copy)이 나란히 배치돼 비대칭이 우연이 아니라 계약임을 시각적으로도
   드러낸다.
7. **회귀 테스트**: 핵심 3개 spec 파일 직접 재실행 111/111 GREEN, 잔존 유일 런타임 소비처
   (`explore-tools.service.spec.ts`) 18/18 GREEN 으로 export-only 변경의 무회귀를 확인했다.
   `setStructuredOutput` 참조-저장 회귀를 뮤테이션으로 재현해 신규 캐너리가 정확히 RED 를
   내는 것도 독립 확인했다(직전 라운드 시점엔 66/66 GREEN 이던 것과 대조).
8. **테스트 용이성**: `DEFAULT_SENSITIVE_KEYS` export(런타임 미소비, 이유를 JSDoc 에 명시)로
   테스트가 상수에서 직접 파생하는 구조가 됐다. `setStructuredOutput`/`setEngineResolvedConfig`
   모두 순수 setter 에 가까워 identity 캐너리 추가에 구조적 장애가 없었다.

## 요약

이번 diff 는 `10_53_52`~`12_28_26` 4라운드에 걸쳐 누적 지적된 CRITICAL 1건(포함관계 캐너리
미파생)·WARNING 5건(미러 스윕 누락 3회, vacuous 빈 문자열 캐너리, `setStructuredOutput`
참조-저장 계약 무방비)의 최종 반영분이다. 핵심 3개 spec 파일을 직접 재실행해 111/111 GREEN
을 확인했고, 가장 최근(`12_28_26`) WARNING 이 지적한 참조-저장 무방비 상태를 재현하는
뮤테이션을 독립적으로 다시 걸어 신규 캐너리가 정확히 RED 로 잡는 것을 확인했다(직전 라운드
시점엔 같은 뮤테이션이 66/66 GREEN 으로 무방비였다). 남은 것은 여러 라운드에 걸쳐 이미
추적된 저-우선순위 INFO(저수준 유틸 vs 실제 egress 진입점 간 통합 테스트 부재)뿐이며, 이는
이 PR 이 새로 만든 갭이 아니다. 테스트 격리·가독성·mock 미사용(정본 구현 직접 호출) 모두
양호하다.

## 위험도

LOW
