# 유지보수성(Maintainability) 코드 리뷰

## 발견사항

- **[INFO]** `MASKED_INPUT_DATA_REASON` 상수명이 의미를 반대로 읽히게 한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:90`
  - 상세: 값은 `'inputData 는 Re-run/히스토리-로드가 재제출하는 값이라 egress 마스킹 대상이 **아니다**'` — 즉 "왜 마스킹 **안** 하는가"를 담은 카브아웃 근거인데, 이름은 `MASKED_INPUT_DATA_REASON`(직역: "마스킹된 inputData 의 이유")이라 "왜 마스킹 **하는가**"로 처음 읽힌다. 실제로 자매 파일 3곳(`background-run-response.dto.ts:51`, `execution-response.dto.ts:55` 부근, `background-runs.service.ts:304`)이 모두 이 이름을 그대로 인용하므로, 오독이 그 인용부에도 그대로 번진다.
  - 제안: `INPUT_DATA_MASK_CARVEOUT_REASON` 또는 `INPUT_DATA_UNMASKED_REASON` 처럼 "예외/비대상"임이 이름에서 드러나게 리네임을 고려. 기능 영향 없는 사소한 변경이라 이번 라운드에서 급히 처리할 필요는 없음.

- **[INFO]** 값-마스커 사이의 마커 상수는 이번 PR 이 통합했지만, 같은 두 파일의 깊이 상한 상수는 여전히 독립 중복이다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:70` (`MAX_SANITIZE_DEPTH = 10`) · `codebase/backend/src/shared/utils/sanitize-error-message.ts:93` (`MAX_REDACT_DEPTH = 10`)
  - 상세: 이번 PR 은 정확히 이 두 파일 사이에서 마커 리터럴(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`)이 각자 하드코딩되어 있으면 "한쪽만 바뀌었을 때 재마스킹 방지가 조용히 깨진다"는 이유로 `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER` 를 `sanitize-error-message.ts` 에 승격해 `websocket.service.ts` 가 import 해 공유하도록 고쳤다(`websocket.service.ts:6-10`, `:75-78`). 그런데 같은 두 파일에 있는 재귀 깊이 상한(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`)은 값이 우연히 둘 다 `10`으로 같을 뿐 여전히 별개 선언이라, 같은 클래스의 drift 위험(한쪽만 조정되면 두 마스킹 층의 방어 깊이가 갈림)이 그대로 남아 있다. 이번 diff 가 세운 "공유해서 drift 를 막는다"는 원칙을 마커에는 적용하고 깊이 상한에는 아직 적용하지 않은 비대칭이다.
  - 제안: 두 상수 중 하나(예: `sanitize-error-message.ts` 쪽)를 export 하고 다른 쪽이 재사용하도록 통합. 이번 PR 의 변경 범위 밖(두 줄 다 diff 에 포함되지 않은 기존 코드)이라 후속 항목으로 트래커 등재를 권장.

- **[INFO]** `redactStoredErrorForResponse`/`redactStoredDataForResponse` 두 함수의 본문이 완전히 동일하다.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:28-35`, `:66-71`
  - 상세: 둘 다 `if (x === null || x === undefined) return null; return deepRedactSecrets(x) as Record<string, unknown>;` 로 바이트 단위 동일. 이전 라운드(`23_50_03` 계열)에서 이미 지적됐고 "컬럼별 관문을 §R17 이 열거로 못박았기 때문에 강제 통합은 오히려 그 계약을 흐린다"는 근거로 의도적 미조치임이 JSDoc 과 RESOLUTION.md 에 기록돼 있다. 새로 지적하는 것이 아니라, 이번 diff 에서도 그대로 남아 있음을 확인차 기재한다.
  - 제안: 조치 불요(기존 결정 재확인). 세 번째 컬럼(`inputData` 등)이 `error`/`outputData` 와 다른 마스킹 로직을 요구하게 되는 시점에 이 판단을 재검토하면 됨.

- **[INFO]** 새로 추가된 테스트가 기존에도 있던 QueryBuilder 손수-mock 패턴을 계속 복제한다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.spec.ts:1176-1193`(`getChain`), `:1377-1392`(`⑧`) — 동일 패턴이 `:912-930`(기존 `error` 스위트의 `getChain`/`stop`)에도 있다.
  - 상세: `chainQB.leftJoinAndSelect = jest.fn().mockReturnValue(chainQB)` 류의 6~8줄짜리 체이닝 mock 조립이 이 파일 안에서 최소 4벌 반복된다(라인 912, 931, 1176, 1194, 1377, 1393 부근). 이번 diff 가 추가한 새 describe(`outputData 응답 마스킹`)는 기존 `error` 스위트가 이미 겪던 이 중복을 헬퍼로 뽑지 않고 그대로 재현했다. 파일 전체 스타일과는 일관되므로 회귀는 아니지만, 표면이 늘 때마다(이번처럼) 같은 보일러플레이트가 한 벌씩 늘어나는 구조다.
  - 제안: `buildChainQB(root)`/`buildStopQB(running, cancelled)` 같은 공용 테스트 헬퍼로 추출하면 향후 표면 추가 시 반복이 줄어든다. 이번 PR 의 필수 조치는 아님(기존 컨벤션과 동일 수준의 일관성은 지켜졌음).

## 긍정적으로 눈에 띄는 점

- "표면 목록/개수"를 여러 곳에 흩어 적지 않고 `ExecutionsService.toResponseExecution` 의 JSDoc 표 하나를 정본으로 두고 나머지(`background-runs.service.ts:302`, `executions.service.spec.ts` 신규 describe, `stop()` JSDoc)는 `{@link}`/문장으로 그 표를 가리키기만 하도록 리팩터링했다 — 이 저장소가 반복해서 겪은 "숫자가 소스 세 곳에 흩어져 하나만 갱신되는" 결함 클래스를 구조적으로 차단한 좋은 개선이다.
- `maskIfPresent`(`executions.service.ts:118-123`)로 컬럼별 반복 삼항을 헬퍼화하면서, 제네릭을 일부러 안 쓴 이유·`| null` 을 시그니처에 안 적은 이유를 JSDoc 에 명시해 실제로 겪었던 두 번의 빌드 실패(제네릭 추론 오염, non-null 타입 계약)를 재발 방지 문서로 남겼다.
- `maskWireEnvelope`/`toFanoutEnvelope`(`websocket.service.ts`)로 두 emit 경로(`emitExecutionEvent`/`emitNodeEvent`)의 마스킹·strip·routing 조립을 공용화해, 세 번째 emit 경로가 생겨도 구조적으로 관문을 안 빠뜨리게 했다.
- `deepRedactCore`/`DeepRedactOptions` 분리로 `deepRedactSecrets` 와 `deepRedactSecretsPreserving` 이 규칙을 한 곳에서 공유하면서도 캐시 오염(옵션이 다른 두 호출이 같은 WeakMap 캐시를 오염시키는 문제)을 구조적으로 피했다 — 원인·해결 모두 JSDoc 에 남아 있어 추적 가능하다.

## 요약

이번 diff(WS emit 값-패턴 마스킹 + 내부 REST `inputData`/`outputData` 마스킹 6표면 + 표면 수치 단일화)는 여러 차례의 리뷰 라운드를 거치며 이미 상당히 정제된 상태다. 함수 길이·중첩 깊이·순환 복잡도는 모두 양호한 수준이고(`maskIfPresent`, `maskWireEnvelope`, `toFanoutEnvelope`, `deepRedactCore` 모두 단일 책임·낮은 분기 수), 이 저장소가 반복해 겪은 "자매 표면 중 하나만 고쳐지는" 결함 클래스를 SoT 표·공유 헬퍼·공유 마커 상수로 구조적으로 막으려는 시도가 일관되게 보인다. CRITICAL/WARNING 급 유지보수성 결함은 발견하지 못했다. 남은 지적은 전부 INFO 수준의 사소한 개선 여지(카브아웃 상수 이름의 의미 반전 가독성, 마커는 통합했지만 깊이 상한은 아직 안 한 잔여 비대칭, 이미 문서화된 의도적 함수 중복 재확인, 테스트의 반복 boilerplate)이며 그중 다수는 이번 diff 이전부터 있던 패턴을 그대로 이어받은 것이라 회귀가 아니다.

## 위험도
LOW
