# 부작용(Side Effect) 리뷰 — `masking-residuals-0b195b` (12_52_43, 5라운드)

## 검토 방법

이 diff 는 `10_53_52`→`11_25_15`→`12_00_05`→`12_28_26` 4라운드 리뷰의 최종 산출물을 포함한
누적본이다. 4라운드 모두 side_effect 관점(`adaptHandlerReturn` 계약 변경 전파, `setStructuredOutput`
참조-저장 aliasing)을 이미 상세히 추적했고 `12_28_26` 이 CRITICAL 0 · WARNING 2(둘 다 비차단)로
수렴 판정했다. 이번 라운드는 그 수렴 결과를 독립적으로 재확인하고, 4라운드가 다루지 않은 각도를
추가로 탐색했다.

핵심 소스 4개를 `Read` 로 직접 열어 현재 상태를 대조했다:
`mask-sensitive-fields.util.ts`, `handler-output.adapter.ts`, `execution-context.service.ts`,
`execution-context.service.spec.ts`. 추가로 `adaptHandlerReturn`/`maskSensitiveFields`/
`DEFAULT_SENSITIVE_KEYS` 의 전체 소비처를 `grep` 으로 전수 확인했다.

## 발견사항

- **[INFO]** `setStructuredOutput` 참조-저장(aliasing) 계약 변경 — 이미 정확히 문서화·캐너리 완비 확인
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:141-168` (`setStructuredOutput` JSDoc + `context.structuredOutputCache[nodeId] = adapted;`)
  - 상세: 직접 `Read` 로 대조한 결과, JSDoc(141-156)이 서술하는 두 개의 별개 hop(①`adaptHandlerReturn`이 핸들러의 `config` 객체 자체를 반환 ②이 메서드가 `adapted` 래퍼 전체를 참조로 저장)이 실제 구현(168행 `context.structuredOutputCache[nodeId] = adapted;`)과 정확히 일치한다. `execution-context.service.spec.ts` 의 두 신규 캐너리(`toBe` identity + "반환 후 변형이 캐시에 보인다")도 `toBe`/값 변형 후 재확인으로 실제 aliasing 을 정확히 단언한다(vacuous 아님). `12_28_26` W1(JSDoc 이 근거 없는 캐너리를 인용하던 결함)은 이번 diff 에서 완전히 재작성되어 해소됐다.
  - 제안: 없음(양호 확인).

- **[WARNING]** (신규 관찰, 미확증) 장기 참조 유지되는 `config` 객체와 egress 측 **identity 기반 WeakMap 캐시**의 상호작용이 4라운드 리뷰에서 분석되지 않았다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:202,222-234` (`DEEP_REDACT_CACHE`, `deepRedactSecrets` depth-0 캐시) / `codebase/backend/src/modules/websocket/websocket.service.ts:102,115-129` (`SANITIZE_CACHE`, `sanitizePayloadForWs`) — 이 두 파일은 이번 diff 대상이 **아니다** (참조용 인접 코드, 실제 줄 번호는 `Read` 로 직접 확인)
  - 상세: 이번 PR 이전에는 어댑터의 `maskSensitiveFields(r.config ?? {})` 가 매 호출마다 **새 top-level 객체**를 반환했다(`mask-sensitive-fields.util.ts:94` `const out: Record<string, unknown> = {}`). 이번 변경으로 `config` 는 핸들러가 반환한 객체를 **참조 그대로** 캐리하며, `execution-context.service.ts` JSDoc 이 스스로 명시하듯 "a handler that mutates its config after returning would mutate the cache too" — 즉 이 객체가 오랫동안 여러 지점에서 공유되는 것이 이제 **의도된 설계**다. 그런데 egress 마스킹 두 곳(`deepRedactSecrets`/`sanitizePayloadForWs`)은 모두 "동일 객체 identity 재방문 시 캐시에서 O(1) 조회"하는 `WeakMap` 캐시를 쓰며, 그 설계 전제는 "동일 identity ⇒ 동일 content"(주석: "unchanged structures keep their identity")다. 이 전제는 masking 이 매번 fresh 객체를 만들던 종전 세계에서는 자연히 성립했지만, 이번 PR 이후 `config` 가 참조로 장기 캐시(`structuredOutputCache`)에 눕고 "다음 emit cycle / REST polling reconciliation" 을 위해 재사용됨(코드 주석, `ai-turn-orchestrator.service.ts` waiting 분기)을 감안하면, **같은 객체 identity 가 두 번째로 redact 될 때 그 사이에 내용이 바뀌었어도 첫 호출의 캐시된(stale) 마스킹 결과가 재사용될 수 있는 이론적 경로**가 생긴다. WS 쪽 `emitExecutionEvent(executionId, eventType, payload)` 는 `payload` 객체 identity 를 그대로 캐시 키로 쓴다(`websocket.service.ts:331-334`).
  - **미확증 범위**: 실제로 동일 top-level 객체가 서로 다른 시점의 두 emit/redact 호출에 **동일 identity 로** 전달되는 구체적 호출 경로(예: 같은 `nodeExec.outputData`/`adaptedNext` 참조가 래핑 없이 재사용되는 지점)를 이 예산 안에서 끝까지 추적하지 못했다 — 각 emit 호출부가 매번 새 envelope 객체 리터럴을 구성하는 것으로 보여 실제 재현 가능성은 낮을 수 있다. 이미 문서화된 "핸들러가 반환 후 config 를 변형하면 캐시도 변형된다"는 리스크의 **연장선**(같은 aliasing 이 egress 캐시 무효화 실패로도 번질 수 있다는 각도)이며, 별개의 신규 결함이 아니라 그 리스크의 부속 표면이다.
  - 제안: 차단 사유는 아니다. 다만 "핸들러가 config 를 변형하지 않는다"는 현재의 정적 전제(4라운드가 이미 grep 으로 확인)가 미래에 깨질 경우, 단순히 캐시에 stale reference 가 눕는 것을 넘어 **egress 마스킹 결과 자체가 stale 해질 수 있다**는 점을 트래커(예: `spec-sync-external-interaction-api-gaps.md` 의 "자격증명을 노드 config 에 평문으로 담는 노드 타입" 항목 인근)에 한 줄 부기하는 것을 권장한다. 확정하려면 동일 execution 의 같은 노드에 대해 두 번째 emit/REST 조회 시 실제로 같은 `config` 객체 identity 가 재사용되는지 구체적 통합 테스트로 재는 것이 다음 단계다.

- **[INFO]** `DEFAULT_SENSITIVE_KEYS` export 는 순수 additive 인터페이스 변경 — 기존 소비처 영향 없음
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts:10` (`export const DEFAULT_SENSITIVE_KEYS`)
  - 상세: 종전엔 모듈-스코프 `const`(비-export)였고 이제 `export` 만 추가됐다. `grep` 전수 확인 결과 이 export 를 소비하는 곳은 같은 파일의 테스트(`mask-sensitive-fields.util.spec.ts`)뿐이고, 런타임 소비처(`explore-tools.service.ts`)는 여전히 `maskSensitiveFields` 함수만 import 한다(JSDoc 의 "런타임 소비처는 이 export 를 쓰지 않는다" 주장과 실측 일치). barrel re-export 도 없다. 새 public export 추가는 하위 호환을 깨지 않는다.
  - 제안: 없음(양호).

- **[INFO]** `adaptHandlerReturn` 반환 계약 변경(마스킹 제거)의 6개 호출부 전파는 이전 라운드가 이미 전수 추적 — 이번 diff 에 새 호출부 없음
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts:53` (`config: r.config ?? {},`)
  - 상세: `grep` 재확인 결과 `adaptHandlerReturn` 호출부는 `execution-engine.service.ts` 2곳(6047, 6625) · `ai-turn-orchestrator.service.ts` 4곳(835, 1086, 1129, 1194)으로 `10_53_52`/`side_effect.md` 가 추적한 것과 동일하며 이번 diff 로 새로 생긴 호출부는 없다. `maskSensitiveFields`/`handler-output.adapter.ts` 사이의 re-export 도 없어 이 계약 변경이 그 외 파일로 은밀히 전파될 경로는 없다.
  - 제안: 없음(재확인 완료).

- **[INFO]** `ai-turn-executor.ts` 는 주석/JSDoc 만 변경 — 실행 경로·시그니처·이벤트 발생 변경 없음
  - 위치: `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts` (`buildRetryState` 인근 주석, 함수명으로 특정 — diff 상 게이트가 컨텍스트 라인이라 코드 자체의 변경은 없음)
  - 상세: `_retryState`/`_resumeState` 가 credential 을 배제하는 실제 메커니즘(allow-list)은 이번 PR 이전부터 이미 allow-list 기반이었고, 주석이 부정확하게 "`maskSensitiveFields` boundary 와 동일 정책"이라 인용하던 것을 정정한 것뿐이다. 런타임 동작(무엇이 `_retryState`/`_resumeState` 에 포함되는가)은 이 diff 로 전혀 바뀌지 않는다.
  - 제안: 없음.

## 각 점검 관점별 요약

1. **의도치 않은 상태 변경**: `structuredOutputCache`/`nodeOutputCache` 에 참조가 aliasing 되는 것은 의도된 설계이며 캐너리로 고정됨. 위 WARNING(egress 캐시와의 상호작용)은 그 설계의 부속 리스크이지 새 결함은 아님.
2. **전역 변수**: `DEFAULT_SENSITIVE_KEYS` 가 module-scope `const`→`export const` 로 가시성만 확장. 새 전역 상태 도입 아님.
3. **파일시스템 부작용**: 해당 없음 — 코드 diff 는 파일 생성/삭제 로직을 건드리지 않는다.
4. **시그니처 변경**: `adaptHandlerReturn`/`maskSensitiveFields`/`setStructuredOutput` 시그니처(매개변수·반환 타입) 자체는 불변 — 반환값의 **내용물 정책**(마스킹 여부)만 바뀌었고, 그 파급은 6개 호출부 전수 확인됨.
5. **인터페이스 변경**: `DEFAULT_SENSITIVE_KEYS` export 추가는 additive, 하위 호환 유지.
6. **환경 변수**: 관련 변경 없음.
7. **네트워크 호출**: 관련 변경 없음.
8. **이벤트/콜백**: WS emit/콜백 호출 자체(호출 시점·인자 구조)는 바뀌지 않음 — emit 되는 **payload 내용**(config 마스킹 여부)만 바뀌며, egress 마스킹이 그 자리에서 재적용됨.

## 요약

핵심 부작용(공유 boundary 함수 `adaptHandlerReturn` 의 반환 계약 변경, `setStructuredOutput` 의
참조-저장 aliasing)은 4라운드에 걸쳐 이미 상세히 추적·문서화·캐너리로 고정됐고, 이번 라운드에서
직접 `Read` 로 재대조한 결과 JSDoc 과 구현이 정확히 일치함을 확인했다. 새로 발견한 것은 하나 —
장기 참조로 유지되는 `config` 객체와 egress 측 identity 기반 `WeakMap` 캐시(`DEEP_REDACT_CACHE`/
`SANITIZE_CACHE`)의 "동일 identity ⇒ 동일 content" 전제가, 이번 aliasing 설계 변경으로 이론적으로
약해질 수 있다는 점이다 — 다만 실제 재현 경로를 이 예산 안에서 끝까지 확증하지 못해 WARNING(비차단,
후속 확인 권장)으로만 남긴다. `DEFAULT_SENSITIVE_KEYS` export 는 순수 additive 이며 기존 소비처에
영향이 없다. CRITICAL 신규 발견 없음.

## 위험도

LOW
