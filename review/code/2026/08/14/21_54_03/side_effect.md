### 발견사항

- **[INFO]** 외부 수신자(webhook/SSE/REST)로 나가는 응답 shape 가 의도적으로 변경된다 — `llmCalls` 계열 debug 필드가 더 이상 어떤 깊이에서도 노출되지 않음
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` (`stripAndRedact` 헬퍼 및 `getStatus` 의 waiting/`result`/`error` 세 호출부), `codebase/backend/src/modules/websocket/websocket.service.ts` (`emitExecutionEvent`/`emitNodeEvent` 의 fanout 경로)
  - 상세: 이 변경은 보안 결함(raw LLM 프롬프트/응답 유출)을 닫는 게 목적이라 "부작용"이 아니라 의도된 동작 정정이다. 다만 결과적으로 **외부 통합자(webhook 소비자·SSE 토큰 보유자)가 이전에 (의도치 않게) 수신하던 `llmCalls` 필드를 더 이상 받지 못하는** 인터페이스 변화이며, 이 자체는 이미 `CHANGELOG.md` "영향 범위" 절에 명시돼 있다. 새로운 발견은 아니고 side-effect 관점에서 재확인.
  - 제안: 조치 불요 — 이미 문서화됨.

- **[INFO]** `stripExternalOnlyFields` 시그니처가 `(envelope)` 단일 인자에서 `(value, maxDepth)` 2-인자로 바뀌었지만 breaking change 아님
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 신규 `export function stripExternalOnlyFields<T>(value: T, maxDepth: number): T`. 이전 정의는 `codebase/backend/src/modules/websocket/websocket.service.ts` 안의 **module-private**(`export` 없음) 함수였다.
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/modules/websocket/websocket.service.ts` 로 확인 — 삭제된 옛 `stripExternalOnlyFields`는 파일 밖에서 import 되지 않던 내부 헬퍼였다. 따라서 시그니처 변경의 실질 호출자 영향은 없고, 새 시그니처의 두 호출부(`websocket.service.ts` 2곳, `interaction.service.ts` `stripAndRedact` 1곳)는 전부 자매 sanitizer(`MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH`)와 정합된 값을 명시적으로 넘긴다. `maxDepth` 는 선택 인자가 아니라 필수라 누락 시 TS 컴파일 에러로 드러난다(런타임 조용한 실패 경로 없음).
  - 제안: 조치 불요.

- **[INFO]** `MAX_SANITIZE_DEPTH`/`MAX_REDACT_DEPTH` re-import 는 기존 공개 export 를 재사용한 것으로 신규 전역 노출 아님
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 상단 `import { deepRedactSecrets, MAX_REDACT_DEPTH } from '../../shared/utils/sanitize-error-message'`
  - 상세: `git diff origin/main...HEAD -- codebase/backend/src/shared/utils/sanitize-error-message.ts` 결과가 비어 있다 — 이 파일 자체는 변경되지 않았고 `MAX_REDACT_DEPTH` 는 이미 export 돼 있던 상수를 새 호출부가 import 한 것뿐이다. 새 전역 변수 도입이 아니다.
  - 제안: 조치 불요.

- **[INFO]** wire envelope(내부 WS 채널로 이미 broadcast 된 객체)은 strip 이후에도 변형되지 않는다 — clone-on-write 로 방어
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` `emitExecutionEvent`(`this.gateway.broadcastToChannel(channel, eventType, wireEnvelope)` 다음 줄에서 `stripExternalOnlyFields(wireEnvelope, MAX_SANITIZE_DEPTH)` 호출), `codebase/backend/src/shared/utils/strip-external-only-fields.ts` 의 `stripDeep`
  - 상세: `stripDeep` 은 대상 서브트리에 실제 삭제가 없으면 원본 참조를 그대로 반환하고, 삭제가 있을 때만 `{...obj}` 스프레드로 새 객체를 만든다(제거 대상이 없는 공통 경로는 할당 0). 이미 `broadcastToChannel` 로 전송된 `wireEnvelope` 참조를 이후 코드가 in-place 로 건드리지 않으므로, "내부 채널에는 full payload, 외부에는 strip 된 payload" 라는 계약이 실제로 지켜진다. 이 identity 보존은 신규 회귀 테스트(`websocket.service.spec.ts` "제거할 필드가 없으면 fanout payload 가 wire envelope 과 동일 객체다")로 고정돼 있다.
  - 제안: 조치 불요(positive finding).

- **[INFO]** `__proto__` 키 처리 시 bracket 대입 대신 `Object.defineProperty` 사용 — 프로토타입 오염/전역 상태 오염 방지
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts` `stripDeep` 함수 내부, `Object.defineProperty(out, k, {...})` 호출부
  - 상세: 순수 `out[k] = s` bracket 대입이었다면 `k === '__proto__'` 인 입력에서 반환 객체의 프로토타입이 갈리는 CWE-1321 부작용이 발생할 수 있었다. 이 구현은 own-property 로 안전하게 쓰기 위해 스프레드(`{...obj}` — CreateDataProperty 의미)로 `out` 을 만들고 `defineProperty` 로 이중 방어한다. `websocket.service.spec.ts` 의 "payload 에 __proto__ 키가 있어도 값 손실·프로토타입 오염이 없다" 테스트가 `Object.getPrototypeOf`·전역 `{}` 오염 여부까지 확인한다.
  - 제안: 조치 불요(positive finding).

- **[INFO]** `stripAndRedact` 의 null 처리 리팩터가 기존 3개 호출부의 null 분기 의미를 보존
  - 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` 신규 `function stripAndRedact(value: unknown): Record<string, unknown> | null`
  - 상세: 종전엔 `deepRedactSecrets(nodeExec.outputData ?? {})`(waiting, `{}` 기본값) vs `deepRedactSecrets(execution.outputData ?? null)`(terminal `result`/`error`, `null` 유지)로 두 갈래 기본값이 호출부마다 흩어져 있었는데, 이번에 `stripAndRedact` 로 통합되며 waiting 쪽만 `?? {}` 를 호출부에서 유지하고 terminal 쪽은 헬퍼가 반환한 `null` 을 그대로 쓴다. 즉 두 분기의 null 처리 차이가 헬퍼 밖에서 재현되어 동작이 보존된다 — 이 보존 여부는 코드 추적만으로는 불충분했다는 사실을 리뷰 이력(`spec-draft-eia-notification-payload-contract.md`/RESOLUTION 문서)이 스스로 짚었고, 새 회귀 테스트(`interaction.service.spec.ts` "`outputData` 가 null 이면 ... `{}` 가 아니라 null")가 각 경로를 개별 고정했다.
  - 제안: 조치 불요(이미 테스트로 고정됨).

- **[INFO]** 환경 변수·파일시스템·네트워크 호출 신규 도입 없음
  - 위치: `codebase/backend/src/shared/utils/strip-external-only-fields.ts`, `codebase/backend/src/modules/websocket/websocket.service.ts`, `codebase/backend/src/modules/external-interaction/interaction.service.ts` (diff 전체)
  - 상세: `git diff origin/main...HEAD -- 'codebase/**' | grep -n "process.env\|fs\.\|fetch(\|axios\|http\.\|require("` 결과 0건. 순수 함수(깊이 제한 재귀 strip)와 기존 DB repository 호출(변경 없음)만으로 구성돼 있다.
  - 제안: 조치 불요.

### 요약

이번 변경의 핵심(`stripExternalOnlyFields` 를 depth-1 shallow 에서 깊이 무관 재귀로 바꾸고, 같은 로직을 WS fanout 과 REST 스냅샷(`stripAndRedact`)이 공유하도록 승격)은 부작용 관점에서 안전하게 설계돼 있다. 이전에 파일 내부 전용(unexported)이던 함수를 공개 유틸로 승격하면서 시그니처(`maxDepth` 추가)가 바뀌었지만 외부 호출자가 없었으므로 breaking change 가 아니고, 두 새 호출부 모두 자매 sanitizer 와 정합된 깊이 상수를 명시적으로 전달한다. 입력 비파괴(clone-on-write)·`__proto__` 오염 방지·null 분기 보존이 각각 전용 회귀 테스트로 고정돼 있어 "고쳤다고 썼는데 실제로는 부분 집행"이라는 이 프로젝트의 반복 실패 패턴이 이번엔 테스트로 닫혀 있는 것이 확인된다. 전역 변수·환경 변수·파일시스템·네트워크 호출의 신규 도입은 없다. 유일한 실질적 "부작용"은 의도된 것 — 외부 수신자(webhook/SSE/REST)가 더 이상 `llmCalls` 를 받지 못하게 되는 인터페이스 변화이며, 이는 보안 수정의 목적 자체이고 CHANGELOG 에 이미 명시돼 있다.

### 위험도

LOW
