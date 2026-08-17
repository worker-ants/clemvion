# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[WARNING]** 방금 도입한 `VALUE_MASK_MARKER`(`'***'`) 상수가 **자기 파일 안의 write-site 두 곳에서조차 쓰이지 않는다** — "마커 리터럴 중복" 문제를 부분적으로만 고쳤다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:226`(`if (depth >= MAX_REDACT_DEPTH) return '***';`), `:258`(`r = isMaskedMarker(v) ? v : '***';`). 정의는 `:118`(`export const VALUE_MASK_MARKER = '***';`), 인식 집합 구성은 `:124-128`(`MASKED_MARKERS`).
  - 상세: 이번 diff 는 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 export 상수로 승격하면서 그 JSDoc(`:96-116`)이 "이 값들을 다시 마스킹하지 않는다 … 한쪽만 바뀌면 재마스킹 방지가 조용히 깨진다" 고 명시적으로 경고한다. 실제로 `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 는 `websocket.service.ts` 의 **write-site**(`result[k] = KEY_MASK_MARKER`, `return DEPTH_MASK_MARKER`)에서 상수를 직접 참조하도록 고쳐졌다. 그런데 `VALUE_MASK_MARKER` 는 **어디에서도 write-site 에 쓰이지 않는다** — `grep -rn "VALUE_MASK_MARKER"` 결과 정의(`:118`)와 `MASKED_MARKERS` 구성(`:125`) 두 곳뿐이고, 실제로 `'***'` 를 만들어 내는 두 지점(depth 초과 시 전체 마스킹 `:226`, credential-key 값 마스킹 `:258`)은 여전히 하드코딩 리터럴을 쓴다. 같은 함수(`redactSecrets`, `:71`)의 `masked.replace(pattern, '***')` 도 마찬가지다. 즉 나중에 누군가 "값-마스킹 마커를 `'***'` 대신 다른 문자열로 바꾸자" 며 `VALUE_MASK_MARKER` 정의만 고치면, `MASKED_MARKERS`(인식 쪽)는 새 문자열을 기대하지만 실제 마스킹 결과(쓰기 쪽)는 여전히 옛 `'***'` 를 찍어내 — 이 PR 이 `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 에 대해 정확히 막으려 했던 그 회귀(마커 불일치로 재마스킹 오탐/오판)가 세 마커 중 가장 많이 쓰이는 하나에서 그대로 재발할 수 있는 상태로 남는다.
  - 제안: `:226`·`:258`·`:71` 세 곳의 하드코딩 `'***'` 을 `VALUE_MASK_MARKER` 로 교체한다. `sanitize-error-message.spec.ts` 의 "마커 보존" 캐너리도 `VALUE_MASK_MARKER` 를 import 해 리터럴 대신 상수를 단언에 쓰면, 향후 값이 바뀌어도 테스트가 계속 정합성을 지켜준다.

- **[WARNING]** 신설 헬퍼 `maskIfPresent` 의 타입 시그니처가 실제 null 가능성을 숨긴다 — 이 PR 이 반복적으로 경계하는 "타입이 침묵하면 결함을 놓친다" 패턴을 헬퍼 자신이 재현한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:72-77` (`function maskIfPresent(value: Record<string, unknown>, mask: …): Record<string, unknown> { return value == null ? value : (mask(value) ?? value); }`)
  - 상세: 파라미터 타입은 `Record<string, unknown>`(`| null` 없음)이고 반환 타입도 `Record<string, unknown>`(`| null` 없음)이다. 그런데 함수 본문은 `value == null` 을 실제로 체크하고, 그 분기에서 `value`(즉 `null`)를 그대로 리턴한다 — 선언된 반환 타입과 어긋나는 값을 돌려줄 수 있다는 뜻이다. 이 파일 바로 위 `ResponseExecution`/`ResponseNodeExecution` 의 JSDoc(같은 파일 `:93-131` 대역)은 정확히 이 문제를 겨냥해 "그 차이를 `as Execution` 로 덮으면 이후 소비자가 null-check 없이 만져도 컴파일러가 침묵한다 — 결함 클래스를 타입이 잡아줄 기회를 줄이는 셈이라 명시 타입으로 남긴다" 고 서술한다. `maskIfPresent` 는 바로 그 반대 방향으로 설계돼 있다 — 실제로는 null 을 받고 null 을 돌려줄 수 있는데 타입은 "항상 값이 있다" 고 주장한다. 현재는 호출부(`ne.inputData`/`ne.outputData`/`ne.error`)가 전부 같은 방식으로 "타입은 non-null 이라 주장하지만 실제로는 null 일 수 있는" 엔티티 필드이고, 대입 대상(`ResponseNodeExecution.inputData: Record<string, unknown> | null`)도 null 을 허용해 지금 당장 컴파일 오류나 런타임 결함으로 이어지진 않는다. 다만 이 헬퍼가 다른 non-null 강제 대상에 재사용되면 타입 체커가 조용히 통과시키는 채로 런타임에 `null` 이 새어나갈 수 있다.
  - 제안: 시그니처를 실제 계약에 맞춰 `value: Record<string, unknown> | null | undefined` → `Record<string, unknown> | null` 로 명시하거나, JSDoc 에 "엔티티 컬럼의 선언 타입이 실제 nullable 함을 알고 의도적으로 좁혔다" 는 한 줄을 남겨 이 파일의 다른 타입-엄격성 서술과의 불일치가 실수가 아님을 표시한다.

- **[INFO]** `redactStoredErrorForResponse`/`redactStoredDataForResponse` 함수 본문이 파라미터명(`err` vs `data`)만 다르고 완전히 동일하고, `executions.service.ts`/`background-runs.service.ts` 세 곳에 "세 컬럼 redact-and-assign" 3줄 블록이 문자 그대로 반복된다 — 다만 이 둘은 직전 라운드(`review/code/2026/08/16/23_08_19/maintainability.md` INFO 9·10)에서 이미 지적됐고 `RESOLUTION.md` 에서 "호출 여부의 개별성을 지키기 위한 의도적 미조치" 로 명시적으로 재확인됐으므로, 새 결정을 요구하지 않고 참고용으로만 남긴다.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`,`:66-71` / `codebase/backend/src/modules/executions/executions.service.ts` `toExecutionDto`·`toResponseExecution` / `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `toNodeExecutionDto`
  - 제안: 없음(재확인된 기존 결정 유지).

## 요약

이번 diff(`Execution.error` 마스킹의 자매 컬럼 `inputData`/`outputData` 확장 + WS emit 값-패턴 마스킹 신설)는 직전 라운드(`23_08_19`)에서 지적된 WARNING 2건(마커 리터럴 하드코딩 · `findById` 3회 반복 null-guard)을 각각 `MASKED_MARKERS`/`VALUE_MASK_MARKER` 등 이름 있는 상수 승격과 `maskIfPresent` 헬퍼로 실제로 해소했고, 새로 추가된 테스트(`redactStoredDataForResponse` 전용 describe, `⑥-b` 참조-동일성 검증)도 이전 라운드가 지적한 커버리지 갭을 메웠다 — 전반적으로 유지보수성 관점에서 견고한 후속 조치다. 다만 두 군데 새로운 균열이 남았다: (1) 방금 승격한 마커 상수 세 개 중 가장 많이 쓰이는 `VALUE_MASK_MARKER` 가 정작 자기 파일의 write-site 두 곳(그리고 `redactSecrets`)에서 쓰이지 않아 "마커 불일치로 재마스킹 회귀" 라는 이 PR이 막으려던 결함 클래스가 그 마커 하나에 대해서는 여전히 열려 있고, (2) 신설된 `maskIfPresent` 헬퍼의 타입 시그니처가 이 파일 자신이 다른 곳에서 여러 차례 강조하는 "타입으로 null 가능성을 숨기지 않는다" 원칙과 반대 방향으로 선언돼 있다. 둘 다 현재 동작을 깨뜨리지는 않지만(전자는 값이 아직 실제로 같고, 후자는 대입 대상이 이미 nullable) 향후 마커 값 변경이나 헬퍼 재사용 시 조용히 갈릴 수 있는 지점이라 WARNING 으로 분류한다. 그 밖의 반복(자매 함수 동일 본문·3줄 블록 반복)은 직전 라운드에서 이미 검토돼 의도적 미조치로 확정된 사항이라 재론하지 않는다.

## 위험도

LOW
