# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** `shared/utils` 레이어가 도메인 타입(`nodes/core`)에 의존하기 시작 — 단일 소비자 로직이 다중 소비자 유틸 파일에 혼입
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:1` (신규 `import type { NodeHandlerOutput } from '../../nodes/core/node-handler.interface';`), 신규 코드 블록 `codebase/backend/src/shared/utils/strip-external-only-fields.ts:138-192` (`NODE_OUTPUT_ALLOWED_KEYS` / `assertAllowlistCoversHandlerContract` / `allowlistNodeOutputKeys`)
  - 상세: `strip-external-only-fields.ts` 는 지금까지 순수 제네릭·무의존 유틸이었고 `interaction.service.ts` 와 `websocket.service.ts` 두 소비자가 공유했다(`grep` 확인). 이번 변경으로 이 파일이 `../../nodes/core/node-handler.interface` 의 `NodeHandlerOutput` 을 타입 임포트하기 시작했는데, 이 심볼 `allowlistNodeOutputKeys`/`NODE_OUTPUT_ALLOWED_KEYS` 는 실제로는 `interaction.service.ts` 한 곳만 소비한다(전수 grep 확인, `websocket.service.ts` 는 관여 없음). 결과적으로 "shared/utils = 하위 계층, 도메인 무관, 다중 소비자"였던 파일 하나에 "도메인(`nodes/core`)에 결속된 단일 소비자" 로직이 얹혔다 — 방향이 역전된 계층 의존(하위 계층이 상위/도메인 계층 타입을 참조)이며, 파일의 응집도도 두 개의 서로 다른 필터링 전략(범용 deny-list vs 도메인 결속 allow-list)으로 갈라진다. `import type` 이라 런타임 순환참조·번들 비용은 없음을 직접 확인했다(`node-handler.interface.ts` 가 참조하는 `shared/conversation-thread`·`shared/execution-resume` 타입 파일 모두 무의존 leaf 타입이라 순환 없음) — 그래서 CRITICAL 이 아니라 WARNING. 다만 컴파일타임 결합은 남고, "shared/utils" 가 향후 이런 도메인 결속 유틸의 흡수지가 되는 선례(God-utility 화)를 만든다.
  - 제안: `NODE_OUTPUT_ALLOWED_KEYS`/`assertAllowlistCoversHandlerContract`/`allowlistNodeOutputKeys` 를 별도 파일(예: `shared/utils/node-output-allowlist.ts`, 또는 소비자에 더 가까운 `external-interaction/` 하위)로 분리해 범용 `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 와 물리적으로 갈라둘 것. 그러면 `websocket.service.ts` 등 기존 다중 소비자는 여전히 도메인 무관 파일만 참조하게 되고, "shared" 계층이 `nodes/core` 를 향해 여는 문은 새 단일 파일로 국한된다.

- **[WARNING]** `getStatus()` 메서드 JSDoc 이 이번 변경으로 사실이 아니게 됐는데 갱신되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts:315`
  - 상세: `getStatus` 메서드 상단 JSDoc 이 "`outputData`/`nodeOutput` 키-allowlist 는 별개 잔여 항목." 이라고 명시한다. 그런데 바로 이 diff 가 그 메서드 본문 안(`codebase/backend/src/modules/external-interaction/interaction.service.ts:392-394`)에 `allowlistNodeOutputKeys(...)` 를 배선해 waiting `nodeOutput` 출구에 한해 그 "잔여 항목"을 실제로 구현했다. 메서드 JSDoc 은 diff 범위 밖(같은 파일의 다른 hunk)이라 그대로 남아, 이 메서드를 읽는 다음 개발자에게 "아직 미구현"이라는 잘못된 사실을 전달한다. `spec/5-system/14-external-interaction-api.md` §R17 은 이번 PR 에서 정확히 갱신됐는데(파일 15 diff, `~~미구현·잔여~~ 해소` + 3-출구 표), 같은 사실을 진술하는 코드 내부 JSDoc 한 줄만 누락됐다 — 이 저장소가 반복 겪은 "rationale 이 구현보다 stale 화"의 축소판.
  - 제안: 해당 줄을 spec R17 표와 동일한 취지로 정정 — 예: "`outputData`/`nodeOutput` 키-allowlist 는 `getStatus` waiting 출구 1곳에 fail-closed 로 적용됨(SSE/fanout·terminal 출구는 잔여, spec R17 표 참조)."

- **[INFO]** 내부 필드 제외 목록의 SoT 가 소비 지점에 있다 — 정의 지점과 분리
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts:160-164` (`type PublicHandlerOutputKey = Exclude<keyof NodeHandlerOutput, '_resumeState' | '_retryState'>`)
  - 상세: "`_resumeState`/`_retryState` 는 엔진 내부다" 라는 지식이 정작 그 필드를 선언하는 `NodeHandlerOutput`(`nodes/core/node-handler.interface.ts:304-336`) 이 아니라, 이를 소비하는 `shared/utils` 쪽 `Exclude<...>` 리터럴에 다시 적혀 있다. 지금은 컴파일타임 assertion 이 한쪽 방향(allowlist 가 타입의 공개 키를 다 덮는지)은 강제하지만, "이 두 필드가 internal이다"라는 사실 자체는 두 번째 손 동기화 지점이다 — `NodeHandlerOutput` 에 새 internal 필드가 추가되면 이 파일도 알아야 하는데, 그 요구가 타입 정의 쪽에는 전혀 드러나지 않는다(현재는 컴파일 에러로 강제되므로 안전하지만, "internal" 이라는 의미론은 원 타입 옆에 없다).
  - 제안: `node-handler.interface.ts` 에 `type PublicNodeHandlerOutput = Omit<NodeHandlerOutput, '_resumeState' | '_retryState'>` 같은 표준 별칭을 두고 `strip-external-only-fields.ts` 가 그것의 `keyof` 를 참조하게 하면, "무엇이 internal인가"의 SoT 가 타입이 선언된 자리 하나로 좁혀진다. 필수 아님(현재도 fail-closed·컴파일 강제로 안전).

## 요약

이번 변경은 `getStatus` 의 waiting `nodeOutput` 출구에 fail-open deny-list(`llmCalls` 한 칸) 위에 fail-closed allowlist 를 데코레이터처럼 얹는 구성으로, 기존 `stripAndRedact`/`stripExternalOnlyFields` 의 export 를 건드리지 않고(OCP 준수) `websocket.service.ts` 등 기존 소비자에게는 무영향이다. `NODE_OUTPUT_ALLOWED_KEYS` 를 `NodeHandlerOutput` 의 공개 키 집합에 컴파일타임으로 결속시킨 방식(`PublicHandlerOutputKey extends (typeof NODE_OUTPUT_ALLOWED_KEYS)[number] ? true : never`)은 union 전체 assignability 검사로 동작해(비-distributive, 직접 검증함) 실제로 키 누락을 컴파일 에러로 잡는 견고한 안전장치이며, 순환참조도 없다(직접 확인). 다만 이 신규 로직이 도메인 타입(`nodes/core`)에 결속된 단일 소비자 코드를 범용·다중 소비자 유틸 파일(`shared/utils/strip-external-only-fields.ts`)에 얹으면서 계층 방향(하위가 상위를 참조)과 응집도가 흔들리고, 같은 메서드 안에서 코드는 갱신됐는데 그 메서드의 JSDoc 한 줄은 정정되지 않아 rationale 이 stale 화됐다. 세 출구 중 한 곳만 적용한 것(terminal `result`/`error`, SSE/fanout 잔여)은 이미 consistency-checker 가 WARNING 으로 잡아 plan/spec 에 반영 중이므로 본 리뷰에서는 재론하지 않았다.

## 위험도
LOW
