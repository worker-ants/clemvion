# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** REST `getStatus` 의 새 두-단계 처리에서 `deepRedactSecrets` 가 **먼저** 실행돼, 곧바로 `stripExternalOnlyFields` 가 통째로 삭제할 `llmCalls` 서브트리에까지 비싼 정규식 기반 값 마스킹을 수행한다 (버릴 데이터에 선행 비용을 쓰는 순서 문제)
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`
    ```
    const out = stripExternalOnlyFields(
      deepRedactSecrets(nodeExec.outputData ?? {}) as Record<string, unknown>,
      MAX_REDACT_DEPTH,
    );
    ```
  - 상세: 현재 호출 순서는 `stripExternalOnlyFields(deepRedactSecrets(X))` — 즉 (1) `deepRedactSecrets` 가 `nodeExec.outputData` 전체를 재귀 순회하며 모든 문자열 리프에 `SECRET_LEAK_PATTERNS`(정규식 6개)를 돌리고, JSON 형태 문자열(`looksLikeJson`)이면 `JSON.parse` → 재귀 → `JSON.stringify` 까지 수행한다(`codebase/backend/src/shared/utils/sanitize-error-message.ts` `deepRedactSecrets`/`redactSecretsInJsonString`). (2) 그 결과를 `stripExternalOnlyFields` 가 **다시** 순회하며 `llmCalls` 라는 이름의 키를 찾아 깊이 무관으로 삭제한다. `llmCalls` 는 "LLM provider 와의 원본 요청/응답(시스템 프롬프트·대화 이력·tool 정의·사용자 입력)" 을 통째로 담는, 이 트리에서 가장 큰 서브트리일 가능성이 높은 필드다(같은 파일 `strip-external-only-fields.ts` JSDoc 이 그렇게 서술한다). 그런데 (1) 단계가 바로 그 `llmCalls` 콘텐츠에도 값 마스킹 비용을 전부 지불한 뒤, (2) 단계가 그 결과를 통째로 버린다 — **삭제될 데이터에 가장 비싼 연산(정규식 스캔 + JSON 파싱/재직렬화)을 미리 써버리는 순서**다. `websocket.service.ts` 의 자매 경로(`sanitizePayloadForWs` → `stripExternalOnlyFields`)도 같은 순서지만 거기서 선행 단계는 키 이름 정규식 매칭(`CREDENTIAL_KEY_PATTERN.test(k)`)만 하는 훨씬 싼 연산이라 낭비폭이 작다. 이번에 새로 추가된 REST 경로는 값 자체를 정규식으로 훑는 `deepRedactSecrets` 를 선행시켜, 낭비되는 절대비용이 WS 경로보다 크다.
  - 제안: 두 함수의 순서를 바꿔 `deepRedactSecrets(stripExternalOnlyFields(nodeExec.outputData ?? {}, MAX_REDACT_DEPTH))` 로 호출한다. `stripExternalOnlyFields` 는 필드명만 보고 삭제하므로 가치 있는 데이터를 잃지 않으며(현재도 이후 `deepRedactSecrets` 결과에서 `llmCalls` 는 이미 사라져 있어야 정상), 순서를 바꾸면 `llmCalls` 서브트리는 애초에 `deepRedactSecrets` 가 방문하지 않아 그 안의 문자열에 대한 정규식 스캔·JSON 파싱 비용을 전부 절약한다. 최종 반환 값은 두 순서 모두 동일해야 한다(strip 은 값 변환이 아니라 키 삭제만 하므로 나머지 필드의 redact 결과에 영향을 주지 않는다) — 다만 이를 보장하는 회귀 테스트(양쪽 순서로 결과 동일함을 단언)가 없다면 순서 변경 시 함께 추가할 것을 권한다.

- **[WARNING]** 공유 유틸 추출(`strip-external-only-fields.ts` 신설) 과정에서, 직전 라운드들이 실측까지 해서 남긴 "왜 두 pass 를 합치지 않는가" 성능 트레이드오프 JSDoc(`## 비용 (실측)`: 0.0112ms → 0.0314ms, 2.80배, +20.2µs/emit)과 순환 참조 처리 근거가 새 파일로 옮겨지지 않고 소실됐다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:294-304` (남은 JSDoc — 이 자리에 있던 `## 비용 (실측)` 절이 통째로 빠졌다), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 전체(신규 파일, 벤치마크·순환참조 서술 없음)
  - 상세: `git log -S"비용 (실측)"` 로 확인한 결과, 커밋 `5df89cda6`/`b49ee4310` 시점의 `websocket.service.ts` 는 `stripDeep` 바로 위에 `## 비용 (실측)` 절을 두고 "`sanitizePayloadForWs` 가 이미 한 번 완전 순회하므로 hot path 에서 순회가 두 번" 이라는 지적(`10_32_27` performance W2)에 대한 실측 표(옛 depth-1 0.0112ms vs 현행 재귀 0.0314ms, 2.80배)와 "왜 합치지 않았는가"(wire/fanout 채널 분리, `SANITIZE_CACHE` 의미 훼손 우려) 근거, 그리고 "순환 참조는 다루지 않는다 — 어차피 `JSON.stringify` 가 `TypeError` 를 낸다" 는 근거를 명시하고 있었다. 이번 diff(`34e32e62f`, 공유 유틸 추출)는 이 함수 전체를 `strip-external-only-fields.ts` 로 옮기면서 `__proto__` 방어 근거(CWE-1321, 스프레드가 실제 방어라는 실측)는 인라인 주석으로 보존했지만, 이 두 절(성능 실측 + 순환참조 근거)은 새 파일 어디에도 옮기지 않았다(`grep -rn "0.0112\|비용 (실측)\|순환" codebase/backend/src/` 결과 코드베이스 안에는 더 이상 없고 `plan/`·`review/` 산출물에만 남아 있음을 확인). 더 나쁘게는, 이번 diff 가 바로 이 유틸의 **두 번째 호출자**(`interaction.service.ts`)를 추가하면서 그 호출자도 동일한 "두 pass" 패턴(위 첫 WARNING)을 새로 만들었는데, 정작 그 트레이드오프를 설명하던 유일한 문서가 이 타이밍에 사라졌다. 공유 유틸이 된 지금이야말로 이 비용 서사가 있어야 할 자리인데 비어 있다.
  - 제안: `## 비용 (실측)` 절(수치 포함)과 순환 참조 근거를 `strip-external-only-fields.ts` 의 JSDoc(또는 최소한 `stripExternalOnlyFields`/`stripDeep` 함수 주석)으로 이관한다. 이번 라운드에서 새로 생긴 REST 호출자(`interaction.service.ts`)의 비용 특성(값 마스킹 후 폐기되는 낭비, 위 첫 WARNING)도 같은 절에 함께 기록하면, 다음에 이 유틸을 만지는 사람이 "왜 이렇게 순서가 정해져 있는가" 를 재조사하지 않아도 된다.

- **[INFO]** REST 경로(`interaction.service.ts`)에는 WS 경로의 `SANITIZE_CACHE`/`DEEP_REDACT_CACHE` 같은 identity 캐시가 없지만, 문제로 보이지 않는다 — 확인 후 기록만
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:349-355`
  - 상세: `deepRedactSecrets` 자체는 depth-0 `DEEP_REDACT_CACHE`(WeakMap)를 갖고 있지만, `getStatus` 가 넘기는 `nodeExec.outputData ?? {}` 는 매 REST 요청마다 TypeORM 이 새로 하이드레이트한 객체라 캐시 키(객체 identity)가 매번 달라 적중할 일이 없다. WS 경로처럼 같은 객체를 N 회 반복 emit 하는 시나리오가 아니므로 캐시 부재가 실질적 손해는 아니다.

## 요약

핵심 수정(REST `getStatus` 스냅샷에도 `stripExternalOnlyFields` 를 적용해 `llmCalls` 누출을 fanout 과 동등한 수준으로 막은 것, 그리고 그 strip 로직을 `websocket.service.ts` 에서 `shared/utils/strip-external-only-fields.ts` 로 승격해 두 출구가 같은 구현을 공유하게 한 것)은 성능 관점에서 알고리즘 자체를 악화시키지 않았고(여전히 O(N) 트리 순회, lazy clone-on-write 유지), N+1 이나 블로킹 I/O 문제도 새로 만들지 않았다. 다만 이번 diff 가 REST 경로에 새로 배선한 `stripExternalOnlyFields(deepRedactSecrets(...))` 순서는 곧 삭제될 `llmCalls` 서브트리(잠재적으로 가장 큰 필드)에 정규식 다중 패스 + JSON 파싱까지 포함하는 비싼 값 마스킹을 먼저 돌리고 버리는 구조라, 순서만 바꾸면 거저 얻을 수 있는 최적화 여지가 남아 있다(WARNING). 또한 공유 유틸 추출 과정에서 이전 라운드가 실측까지 해서 남긴 "두 pass를 합치지 않는 이유"·"비용 실측치" JSDoc 이 새 파일로 이관되지 않고 소실된 점도, 정확히 이 시점에 두 번째 호출자가 같은 트레이드오프를 다시 안게 됐다는 점에서 가볍게 볼 문제는 아니다(WARNING). 두 지적 모두 정확성/가용성 리스크는 없고 수정 비용도 낮다(순서 스왑 1줄, JSDoc 이관).

## 위험도

LOW
