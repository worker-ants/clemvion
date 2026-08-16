# 성능(Performance) 코드 리뷰

## 발견사항

- **[INFO]** WS emit 경로가 3-패스 마스킹 체인이 되었고, 세 패스 중 어느 것도 서로 캐시를 공유하지 않는다 — 이미 실측·수용된 트레이드오프이나 운영 모니터링 지점으로 남겨둘 필요가 있다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:253`-`304`(`emitExecutionEvent`) · `:326`-`354`(`emitNodeEvent`) · `:387`-`394`(`maskWireEnvelope`) · `:408`-`417`(`toFanoutEnvelope`). 캐시 정의는 `:91`(`SANITIZE_CACHE`, depth-0 전용) 및 `codebase/backend/src/shared/utils/sanitize-error-message.ts:158`(`DEEP_REDACT_CACHE`)·`:178`-`191`(`deepRedactSecrets`, 캐시 적용)·`:204`-`209`(`deepRedactSecretsPreserving`, **캐시 미적용** — JSDoc 이 명시적으로 밝힘).
  - 상세: 종전 `sanitizePayloadForWs`(키-이름, 1패스) → `stripExternalOnlyFields`(필드 제거, 1패스) 2단이었던 emit 파이프라인이 이번 diff 로 `maskWireEnvelope`(값-패턴, `deepRedactSecretsPreserving`) 가 중간에 추가돼 3단이 됐다. `deepRedactSecretsPreserving` 은 `deepRedactSecrets` 와 로직을 공유(`deepRedactCore`)하면서도 옵션 오염을 막기 위해 캐시를 의도적으로 쓰지 않는다(주석 확인). 다만 실측해 보면 이 지점의 캐시 부재 자체는 큰 손해가 아니다 — `wireEnvelope` 는 매 emit 마다 `seq`/`timestamp` 를 새로 붙여 스프레드하므로 **최상위 객체 identity 가 항상 새롭고**, `SANITIZE_CACHE`/`DEEP_REDACT_CACHE` 모두 depth-0(=최상위 인자) 에서만 캐시를 검사하는 구조라 어차피 이 호출 지점에서는 캐시가 히트할 수 없다. 즉 "캐시를 안 쓴다" 는 설계가 이 특정 호출부에는 실질적 비용을 더 얹지 않는다. 다만 세 패스 중 하나(`sanitizePayloadForWs(payload)`)만 최상위 `payload` 객체 identity 재사용 시 캐시 이득을 보고(ForEach 가 같은 `node.config` 를 반복 emit 하는 케이스), 나머지 두 패스(`maskWireEnvelope`/`stripExternalOnlyFields`)는 구조적으로 매번 풀 워크다. 저장소가 이미 `stripExternalOnlyFields` JSDoc(`:70`-`80` 부근 "비용 (실측)")에서 2-패스 오버헤드를 측정했고, 이번 PR 은 3-패스 오버헤드(`+0.0142ms/emit`, ForEach 5,000 emit 누적 `+71ms`)를 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 에 실측 기록하고 명시적으로 수용했다 — 방법론과 결정 모두 타당하다.
  - 제안: 조치 불요. 다만 이 벤치마크는 "8턴 turnDebugHistory, N=3000" 인 **개별 서로 다른 payload** 시나리오로 보이고, `SANITIZE_CACHE` 의 존재 이유로 명시된 "동일 `node.config` 5,000회 재emit" 캐시-히트 시나리오는 별도로 측정되지 않았다. 후자는 1번째 패스(`sanitizePayloadForWs`)가 거의 무료가 되는 반면 2·3번째 패스는 여전히 매번 풀 워크이므로, 캐시-히트가 지배적인 실제 ForEach 워크로드에서는 상대적 오버헤드 비율이 벤치마크의 1.78배보다 커질 수 있다. 프로덕션에서 대규모 ForEach fanout 지연이 관측되면 이 축(반복 payload identity)으로 별도 벤치마크를 권장.

- **[INFO]** 이번 diff 가 유지한 성능 관례가 견고하다 — 새 마스킹 관문 3곳(읽기 REST) 모두 copy-on-change 를 지켜 불필요한 shallow-copy 를 피했고, 목록 집계는 배치 쿼리를 유지했다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:72`-`77`(`maskIfPresent` — 값 없으면 원본 참조 그대로 반환) · `:675`-`696`(`findById` 의 `reconciledNodeExecutions` — 세 컬럼 모두 무변화면 행 참조 자체를 재사용, 대규모 ForEach 실행에서 O(n) shallow-copy 를 피함) · `:1052`-`1062`(`toResponseExecution`) · `codebase/backend/src/shared/utils/redact-stored-error.ts:66`-`71`(`redactStoredDataForResponse` — copy-on-change). `loadNodeExecutionCounts`(`executions.service.ts:782`-`816`)는 이번 diff 와 무관하게 이미 `IN (:...executionIds)` 단일 그룹 쿼리로 N+1 을 회피하고 있고, 이번 마스킹 추가가 이 배치 특성을 깨지 않았다.
  - 상세: 참고용 — 조치 불요. 종결 상태 실행은 `snapshotCache`(인스턴스 LRU)로 재계산 자체가 스킵되므로, 마스킹 3컬럼 확장의 반복 비용도 캐시 히트 시 완전히 무료다.
  - 제안: 없음.

## 요약

이번 diff(`inputData`/`outputData` 컬럼 egress 마스킹 6표면 + WS emit 값-패턴 마스킹 wire/fanout)는 성능 관점에서 상당히 절제되어 있다. 알고리즘 복잡도는 전부 O(n)(n=페이로드 노드 수/문자열 길이)이고 N+1 신규 유발이 없으며, 기존 copy-on-change·LRU 캐시·배치 카운트 쿼리 관례를 새 마스킹 관문에도 일관되게 적용했다. 유일하게 실측이 필요한 축(emit 당 순회 2→3회)은 팀이 이미 A/B 벤치마크(N=3000, +0.0142ms/emit, ForEach 5,000 기준 +71ms)로 측정하고 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 에 근거와 함께 수용 결정을 남겼다 — 리뷰 시점에 다시 계산할 필요가 없을 만큼 투명하다. 다만 그 벤치마크가 "서로 다른 payload N=3000" 시나리오라 `SANITIZE_CACHE`(동일 top-level 객체 재emit) 가 겨냥하는 캐시-히트 우세 시나리오와는 축이 다르고, 새로 추가된 값-패턴 층(`maskWireEnvelope`)은 그 캐시 이득을 구조적으로 받을 수 없는 지점(매 emit 마다 새 top-level 객체)이라는 점만 INFO 로 남긴다 — 현재 수용된 비용 범위 안에 있으나 프로덕션에서 대규모 ForEach 지연이 실제 관측되면 참고할 지점이다. CRITICAL/WARNING 급 성능 결함은 발견하지 못했다.

## 위험도
LOW
