# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** WS 내부(에디터) wire 채널의 emit payload 가 이번 변경으로 **모든** `emitExecutionEvent`/`emitNodeEvent` 호출에서 값-마스킹을 통과한다 — 종전엔 fanout 분기에만 걸려 있던 처리(strip)가 wire 자체까지 확장됐다.
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts:254`, `:328` (호출부), `:380-387` (`maskWireEnvelope` 정의)
  - 상세: `gateway.broadcastToChannel(channel, eventType, wireEnvelope)` 로 나가는 값 자체가 이제 `deepRedactSecretsPreserving` 을 거친다. 이는 `execution:<id>` 채널을 구독하는 **모든** 내부(에디터) 클라이언트가 받는 실제 페이로드를 바꾸는 것으로, PR 문서(`plan/in-progress/eia-fanout-and-internal-data-masking.md` §A "왜 wire 가 아니라 fanout 인가")가 명시적으로 검토·결정한 트레이드오프이고 회귀 테스트(`websocket.service.spec.ts` ①~④, `llmCalls` 예외 테스트)로 고정돼 있다. 코드 자체의 결함은 아니지만, 이 diff 범위 밖에 있는 다른 내부 소비자(예: 에디터가 아닌 다른 자동화/모니터링 클라이언트가 `execution:<id>` 를 구독해 원문 `error`/`input`/`output` 값에 의존하는 경우)가 있다면 조용히 영향받는다.
  - 제안: 이 채널의 다른 구독자(신규 관리/모니터링 도구 등)가 없는지 한 번 더 확인하고, 없다면 정보 공유 목적으로만 남긴다.

- **[INFO]** `deepRedactSecrets` (및 내부 `deepRedactCore`) 의 마스킹 규칙이 "이미 마스킹된 마커 보존" 방향으로 바뀌었고, 이 함수는 이번 diff 에 포함되지 않은 다른 소비자에도 전역적으로 영향을 준다.
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:117-121` (`MASKED_MARKERS`), `:244-254` (`isMaskedMarker` 분기)
  - 상세: `deepRedactSecrets`/`deepRedactCore` 는 `terminal-error-payload.ts`·`redact-stored-error.ts`(이번 diff 포함) 외에도 plan 문서가 언급하는 `thread-renderer`·`ai-turn-orchestrator`·`interaction.service` 등 이 diff 에 나타나지 않는 모듈에서도 호출된다. 이번 변경으로 그 모든 호출부가 "credential-key 값이 이미 `***`/`[REDACTED]`/`[REDACTED_DEPTH]` 리터럴이면 재마스킹하지 않는다" 는 새 규칙을 함께 상속한다. 안전 방향이 한쪽(마스킹 완화 아님, unmask 아님)으로만 열려 있어 신규 유출을 만들지는 않지만, 공유 유틸의 동작 변경이 diff 에 보이지 않는 소비자에게까지 퍼진다는 점은 side-effect 관점에서 짚어둘 필요가 있다.
  - 제안: 이미 코드에 반영돼 있고 캐너리 테스트(`sanitize-error-message.spec.ts` `deepRedactSecrets — 기존 마스킹 마커 보존`)로 계약이 고정돼 있으므로 추가 조치는 불요. 파급 범위를 인지하고 있다는 점만 기록.

- **[INFO]** `ResponseExecution`/`ResponseNodeExecution` export 타입이 `inputData`/`outputData` 를 `Record<string, unknown> | null` 로 넓히면서, 이 타입을 import 하는 diff 밖의 다른 모듈이 있다면 컴파일 타임에 `| null` 처리를 새로 요구받는다.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:85-92` (`ResponseExecution`), `:100-108` (`ResponseNodeExecution`)
  - 상세: 이는 인터페이스(타입) 변경으로, 런타임 부작용은 아니지만 "시그니처/인터페이스 변경" 관점에서 호출자 영향이 있다. PR 기록(`plan/complete/eia-internal-rest-error-masking.md`)에 따르면 이전 라운드(`error` 필드 확장 시)에 `nest build` 가 이 클래스의 타입 확장으로 인한 오류를 실제로 잡아냈다는 언급이 있어, 이번 `inputData`/`outputData` 확장도 동일한 방식으로 빌드가 검증했을 가능성이 높다(TEST WORKFLOW 의 build 단계가 PASS 로 기록됨). 별도 조치 불요.

## 부작용 없음 확인 (양호한 지점)

- `deepRedactCore`/`deepRedactObject` 는 copy-on-change 를 일관되게 지켜 입력 객체를 변이하지 않는다(`redact-stored-error.ts` 두 함수, `deepRedactSecretsPreserving` 모두 동일 보장). DB 엔티티가 캐시나 이후 소비자에 의해 오염될 위험이 없다.
- `deepRedactSecrets` 의 depth-0 캐시(`DEEP_REDACT_CACHE`, 전역 `WeakMap`)는 리팩터 후에도 옵션이 있는 `deepRedactSecretsPreserving` 경로와 캐시를 공유하지 않도록 명시적으로 분리돼 있고(`sanitize-error-message.ts:171-202`), 이를 검증하는 캐너리 테스트(`sanitize-error-message.spec.ts` "캐시를 공유하지 않는다")가 존재한다.
- `WIRE_PRESERVED_FIELDS`(`websocket.service.ts:75-77`)는 `EXTERNAL_STRIPPED_FIELDS` 배열을 복사해 새 `Set` 을 만들어 `ReadonlySet` 으로 노출하므로, 원본 배열이나 이 Set 을 통한 외부 뮤테이션 경로가 없다.
- `toFanoutEnvelope`(`websocket.service.ts:401-410`)는 이미 broadcast 된 `wireEnvelope` 을 그대로 재사용하지 않고 `stripExternalOnlyFields` 가 새 객체를 반환하는 기존 계약을 유지해, wire 로 나간 객체가 이후 fanout 처리로 인해 사후 변경되지 않는다(주석에도 "WS copy 불변" 명시).
- 파일시스템/환경변수/네트워크 호출 관련 부작용은 코드 파일(1~9) 어디에도 없다. `plan/*.md` 신규·삭제(파일 10~13)는 프로젝트 워크플로 관례(작업 추적 문서 이동)이며 애플리케이션 코드 부작용이 아니다.
- `redactStoredDataForResponse` 시그니처는 자매 함수 `redactStoredErrorForResponse` 와 동형이라(`redact-stored-error.ts:66-71`) 기존 호출자에 영향이 없는 순수 추가다.

## 요약

이번 변경은 egress 마스킹 관문을 `inputData`/`outputData` 두 컬럼과 WS wire 단계까지 넓히는 의도된 리팩터로, 각 함수(`deepRedactCore`/`deepRedactSecretsPreserving`/`redactStoredDataForResponse`/`maskWireEnvelope`/`toFanoutEnvelope`)가 copy-on-change 를 일관되게 지켜 예기치 않은 상태 변이·전역 오염·파일시스템/네트워크/환경변수 부작용은 발견되지 않았다. 다만 (1) WS 내부 wire 채널의 emit payload 형태가 전면적으로 마스킹되도록 바뀌는 것과 (2) 공유 유틸 `deepRedactSecrets` 의 마커-보존 규칙 변경이 diff 에 나타나지 않는 다른 소비자에게도 전역적으로 적용된다는 점은 "인터페이스/이벤트 계약 변경" 성격이 있어 정보성으로 기록해 둔다 — 두 항목 모두 PR 문서에서 실측·전제 검증을 거쳐 의도적으로 결정됐고 회귀 테스트로 고정돼 있어 추가 조치를 요구하는 결함은 아니다.

## 위험도

LOW
