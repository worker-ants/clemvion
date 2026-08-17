# 부작용(Side Effect) 코드 리뷰

## 발견사항

- **[INFO]** `deepRedactCore` 의 마커-멱등성 변경이 신규 호출부(`outputData`/`inputData`) 뿐 아니라 **이 헬퍼의 모든 기존 호출부**에 조용히 전파된다
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts` (`deepRedactCore` 내 credential-key 분기, `isMaskedMarker` 도입부)
  - 상세: `deepRedactSecrets`/`deepRedactObject` → `deepRedactCore` 리팩터링과 함께, credential 키로 판별된 값이 이미 `MASKED_MARKERS`(`'***'`/`'[REDACTED]'`/`'[REDACTED_DEPTH]'`) 중 하나면 재마스킹하지 않고 그대로 통과시키는 분기가 새로 생겼다. 이 변경은 `deepRedactSecrets` 라는 **공유 프리미티브** 내부에서 일어나므로, 이번 diff 가 명시적으로 겨냥한 두 호출부(`redactStoredDataForResponse`, WS `maskWireEnvelope`)뿐 아니라 기존에 이미 이 함수를 쓰던 다른 파일들 — `shared/utils/terminal-error-payload.ts`(`message`/`details`), `shared/conversation-thread/thread-renderer.ts`(`turn.data`/`payload`), `modules/execution-engine/ai-turn-orchestrator.service.ts`(`conversationConfig`/`messages`/`presentations`), `modules/external-interaction/interaction.service.ts`(`stripAndRedact` 경유) — 에도 그대로 적용된다. 실측 범위를 좁혀 보면, 영향은 credential-key 로 판별된 값이 **문자 그대로 마스킹 마커 문자열과 같을 때만** 달라지므로(그 외 값은 종전과 동일하게 `'***'` 로 치환됨) 보안이 약해지는 방향은 아니다. 다만 "이 PR 의 대상은 두 컬럼" 이라는 설명과 달리 실제 동작 변경 표면은 이 유틸을 참조하는 모든 기존 호출부라는 점은 기록해 둘 가치가 있다.
  - 제안: 조치 불요(영향 방향이 안전 쪽으로만 열려 있음을 확인함). 향후 `MASKED_MARKERS` 에 새 마커를 추가할 때는 이 유틸의 기존 호출부 전체(위 4곳)에 대해서도 영향 재확인 권장.

- **[INFO]** WS `execution:<id>` 채널의 wire envelope 이 인증된 내부(에디터) 구독자에게도 값-패턴 마스킹된 바이트로 나간다 — 문서화된 의도적 변경이나 실질적으로는 기존 WS 클라이언트가 수신하던 payload 바이트가 바뀌는 프로토콜 동작 변경이다
  - 위치: `codebase/backend/src/modules/websocket/websocket.service.ts` — `maskWireEnvelope`(private, `emitExecutionEvent`/`emitNodeEvent` 양쪽에서 `wireEnvelope` 조립 직후 호출)
  - 상세: 종전엔 `stripExternalOnlyFields` 만 fanout(외부) 분기에 걸려 있었고 wire(내부, `this.gateway.broadcastToChannel`) 분기는 원문 그대로였다. 이번 diff 로 wire 도 `deepRedactSecretsPreserving`(`llmCalls` 서브트리만 예외)를 거친다. `execution:<id>` 채널 구독 인가가 workspace 소유만 확인하고 role 을 보지 않는다는 근거(코드 주석의 `ExecutionChannelAuthorizer.verifyOwnership` 언급)로 REST 읽기 경로와 인구 대칭을 맞춘 결정이라 CHANGELOG·spec(§R17, WS §4.1)·유저 가이드에 이미 캐비엇이 반영돼 있다. `llmCalls` 는 `WIRE_PRESERVED_FIELDS`(= `EXTERNAL_STRIPPED_FIELDS` 재사용)로 예외 처리되어 에디터 디버깅 탈출구가 보존됨을 소스로 확인했다.
  - 제안: 조치 불요. 프런트엔드 에디터가 `error`/`input`/`output` 자유 텍스트 필드의 원문에 의존해 별도 파싱(예: 자격증명 자동추출 UI)을 하는 로직이 있는지는 이 PR 범위 밖이라 별도 확인 권장.

- **[INFO]** `ExecutionsService.stop()` 반환 계약 변경(엔티티 참조 → `toResponseExecution` 마스킹 관문을 통과한 복사본) — 내부 호출부 영향 없음을 grep 으로 재검증
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`stop`/`stopInternal`)
  - 상세: `grep` 으로 재확인한 결과 `hooks.service.ts:407` 와 `external-interaction/interaction.service.ts:226,248` 는 `await this.executionsService.stop(...)` 형태로 반환값을 캡처하지 않고, 반환값을 실제로 소비하는 곳은 `executions.controller.ts:145` (`return this.executionsService.stop(id);`, HTTP 응답)뿐이다. 즉 이 계약 변경의 관측 가능한 영향은 HTTP 응답 표면 하나로 국한된다.
  - 제안: 조치 불요.

- **[INFO]** `ResponseExecution`/`ResponseNodeExecution` (내부 타입) 시그니처 확장 — `outputData` non-null→nullable, `inputData`/`outputData` 신규 편입. 외부 소비자 0건을 grep 으로 재확인
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` (`ResponseExecution`, `ResponseNodeExecution` 타입 선언)
  - 상세: `grep -rl "ResponseExecution|ResponseNodeExecution" codebase/backend/src` 결과 이 두 타입을 실제로 **import** 하는 파일은 없다 — `background-runs.service.ts` 안의 매치는 주석 텍스트 언급 1건뿐이다. 두 타입 모두 `executions.service.ts` 내부 전용이라 이번 확장이 컴파일 타임 회귀를 유발할 표면이 없다.
  - 제안: 조치 불요.

- **[INFO]** 순수 변환 함수·불변 모듈 상수만 신설되어 있고, in-place mutation·신규 전역 가변 상태·환경변수 읽기/쓰기·신규 네트워크 호출·파일시스템 접근은 diff 전체에서 관찰되지 않았다
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(`redactStoredDataForResponse`), `codebase/backend/src/shared/utils/sanitize-error-message.ts`(`deepRedactSecretsPreserving`, `VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`/`MASKED_MARKERS` — 전부 `const`/`ReadonlySet`), `codebase/backend/src/modules/websocket/websocket.service.ts`(`WIRE_PRESERVED_FIELDS` — `ReadonlySet`, 기존 export 배열 재사용), `codebase/backend/src/modules/executions/executions.service.ts`(`maskIfPresent`, `MASKED_INPUT_DATA_REASON` — JSDoc 앵커 전용 상수, 런타임 읽기 없음)
  - 상세: `redactStoredDataForResponse`/`deepRedactSecretsPreserving` 모두 copy-on-change(바뀐 것이 없으면 같은 참조 반환)를 지켜 입력 객체를 변이하지 않는다 — `redact-stored-error.spec.ts` 의 "입력 객체를 변이하지 않는다" 캐너리로 고정됨을 직접 확인했다. `sanitize-error-message.ts` 는 이번 diff 이후에도 `import` 문이 전혀 없는 의존성-프리 리프 모듈이라, `websocket.service.ts` 가 여기서 새로 `import` 해도(마커 상수·`deepRedactSecretsPreserving`) 최근 정리된 WS 순환 의존성 문제(#1174/#1175)가 재발하지 않는다.
  - 제안: 조치 불요.

## 요약

리뷰 대상 diff(`Execution.inputData` 카브아웃 레벨 정정 + `outputData`/노드-레벨 `inputData` egress 마스킹 6표면 + WS emit 값-패턴 마스킹 wire/fanout)는 순수 함수·copy-on-change 원칙을 일관되게 지키고 있으며, in-place mutation·신규 가변 전역 상태·예기치 못한 파일시스템/환경변수/네트워크 접근은 발견되지 않았다. 시그니처 성격의 변경(`ResponseExecution`/`ResponseNodeExecution` 타입 확장, `stop()` 반환 계약, WS wire 바이트 변경)은 모두 존재하지만, 각각에 대해 실제 소비자를 grep 으로 독립 재검증한 결과 컴파일·런타임 영향이 없거나(내부 전용 타입, 반환값 미소비 호출부) 의도적으로 문서화된 프로토콜 변경(WS wire 마스킹)이었다. 유일하게 새로 짚을 만한 점은 `sanitize-error-message.ts` 의 마커-멱등성 수정이 `deepRedactSecrets` 라는 공유 프리미티브 내부에서 이뤄져 이번 diff 가 명시한 두 신규 호출부 밖의 **기존** 호출부(`thread-renderer.ts`·`terminal-error-payload.ts`·`ai-turn-orchestrator.service.ts`·`interaction.service.ts`)에도 동작 변경이 조용히 전파된다는 것인데, 영향 방향이 "이미 마스킹된 값을 다시 마스킹하지 않는다"는 안전한 쪽으로만 열려 있어 위험도는 낮다. 이번 세션(11_10_29)에 새로 커밋된 대량의 `review/**` 산출물 디렉토리는 프로젝트 컨벤션(`review/code/<timestamp>/`)이 규정한 정상 산출 경로이며 런타임 부작용과 무관하다. 앞선 6라운드 리뷰가 이미 CRITICAL(재제출 카브아웃 flip-flop 등)·WARNING 항목을 전부 해소했고, 이번 독립 재검증에서도 새로운 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
