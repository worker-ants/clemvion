# 부작용(Side Effect) 리뷰 — EIA/WS continuation 명령 ↔ 대기 노드 표면 매트릭스 가드

검토 대상: `resolveWaitingNodeExecutionId` 시그니처 확장(`waiting-surface-guard.ts` 신설) +
`hooks.service.forwardToInteractionService` graceful catch. 아래는 코드를 직접 추적해 검증한
결과다 (impl-prep 단계 5개 consistency 리포트가 이미 다룬 spec 정합성·명명 이슈는 중복 보고하지
않고, 실제 구현 코드의 부작용에만 집중).

## 발견사항

- **[WARNING] `hooks.service.forwardToInteractionService` 의 `ConflictException` catch 가 JSDoc 이 명시한 범위("표면 불일치")보다 넓은 원인을 동일하게 삼키고, 부기되는 진단 정보(`err.message`)가 실제로는 항상 무의미한 상수 문자열**
  - 위치: `codebase/backend/src/modules/hooks/hooks.service.ts:1397-1408` (`forwardToInteractionService` catch 블록)
  - 상세:
    1. `interactionService.interact()` 내부에서 `ConflictException(STATE_MISMATCH)` 을 던지는 지점은 **두 곳**이다 — `assertWaiting()`(execution 이 애초에 `waiting_for_input` 이 아님, race 포함)과 `dispatchContinuation()`(`InvalidExecutionStateError` 매핑). 후자는 다시 `resolveWaitingNodeExecutionId`/`assertCommandMatchesWaitingSurface` 내부의 **세 가지 다른 사유**를 포괄한다 — (a) WAITING_FOR_INPUT row 0건, (b) row 2건 이상("invariant 위반 — race 또는 데이터 손상 의심"이라고 소스 자체가 명시하는 심각한 케이스), (c) 이번 PR 이 추가한 진짜 "표면 불일치". 즉 신규 catch 는 `instanceof ConflictException` 만으로 4가지 서로 다른 원인을 구분 없이 동일하게 삼킨다. JSDoc(`hooks.service.ts:709-718`, "표면 불일치(409 STATE_MISMATCH) 는 graceful")은 표면 불일치 케이스만 언급하지만 실제 구현은 이보다 넓다.
    2. 로그에 붙이는 `err.message` 는 실제로 아무 정보도 주지 못한다. `interaction.service.ts` 의 두 throw 지점 모두 `new ConflictException({ error: { code, message } })` 형태로 **`message` 를 `error` 하위에 중첩**시켜 던지는데, NestJS `HttpException.initMessage()` (`@nestjs/common/exceptions/http.exception.js`) 는 `response.message` 가 **최상위**(top-level) 문자열일 때만 그것을 채택하고, 그렇지 않으면 `this.constructor.name` 을 기반으로 한 고정 문자열(`"Conflict Exception"`)로 fallback 한다. `response.message` 는 존재하지 않으므로(`response.error.message` 만 존재), `err.message` 는 **항상 `"Conflict Exception"`** 이 된다 — 실제 사유(`STATE_MISMATCH`, 원본 상세 문구)는 `err.getResponse()`(또는 `err.response`)를 통해서만 얻을 수 있는데 코드는 이를 조회하지 않는다.
    3. 결과적으로 실제 프로덕션 로그는 항상 `"chat-channel inbound 'submit_message' 이 현재 대기 표면과 맞지 않아 거부됨 (execution=... trigger=...): Conflict Exception"` 형태가 되어, (i) 실제로 표면 불일치가 아니라 "0건/다중 row invariant 위반"(데이터 손상 의심 케이스)이어도 똑같이 "표면과 맞지 않아 거부됨"으로 오귀속되고, (ii) 어느 쪽이든 부기된 상세문구는 항상 동일한 무의미 상수라 로그만으로는 원인 구분이 불가능하다. (다행히 "다중 row invariant 위반" 자체는 `resolveWaitingNodeExecutionId` 내부에서 별도로 `this.logger.warn`(rows.length 포함)을 이미 남기므로 — `execution-engine.service.ts:5210` — 완전한 정보 손실은 아니고, 서로 다른 logger context 를 상관관계로 엮어야만 진짜 원인을 알 수 있다는 문제다.)
  - 영향: 신규 테스트(`hooks.service.spec.ts` "표면 불일치(409 STATE_MISMATCH) forwarding 은 warn 후 삼킴")는 `err.message` 실제 값을 단언하지 않고 `warnSpy` 가 고정 한국어 문구를 포함하는지만 검증하므로 이 결함을 잡아내지 못한다.
  - 제안: (1) `err.getResponse()` 를 캐스팅해 실제 `error.code`/`error.message` 를 로그에 남길 것(`(err.getResponse() as {error?:{code?:string;message?:string}}).error`). (2) catch 조건을 `err.getResponse()?.error?.code === 'STATE_MISMATCH'` 로 좁혀 JSDoc 이 명시한 "표면 불일치"만 graceful 처리하고, "0건/다중 row invariant 위반"·"execution 이 이미 waiting 이 아님"(진짜 race) 은 별도 분기로 구분 로그(가능하면 `logger.error` 급)를 남길 것 — 특히 다중 row invariant 위반이 chat-channel 경로에서 조용히 뭉개지면 데이터 손상 조기 발견 기회를 잃는다.

- **[INFO] `resolveWaitingNodeExecutionId` chokepoint 의 DB 왕복이 매 continuation 호출마다 1회 증가 + 셀렉트 payload 확대**
  - 위치: `execution-engine.service.ts:5175-5260` (`resolveWaitingNodeExecutionId` → `assertCommandMatchesWaitingSurface`)
  - 상세: 기존에는 `nodeExecutionRepository.find({select:{id,nodeId,startedAt}})` 1회 조회만으로 `nodeExecutionId` 를 확정했다. 이번 변경으로 (a) 같은 조회에 `outputData`(JSONB, AI 대화 이력 등을 담을 수 있는 컬럼) 가 추가로 select 되고, (b) `assertCommandMatchesWaitingSurface` 가 매 호출마다 `nodeRepository.findOne()` 을 추가로 수행한다. `continueExecution`(form 경로)은 여기에 더해 기존 `assertFormSubmissionValid` 가 `nodeExecutionRepository.findOne` + `nodeRepository.findOneBy` 를 또 수행하므로, form 제출 경로는 이번 PR 이후 총 4회의 순차 DB 왕복(이전 3회)을 거친다. 이 chokepoint 는 EIA REST·WS gateway·REST `/continue` 3개 진입점이 모두 공유하므로 사실상 모든 continuation 명령에 지연이 추가된다.
  - 영향: 기능적 정합성 문제는 아니며(테스트로 커버됨), 고빈도 AI 멀티턴 대화 시나리오에서 매 turn 마다 추가 DB round-trip + 더 큰 payload(outputData) 를 읽게 되어 누적 latency 가 소폭 증가할 수 있다.
  - 제안: 필수 대응은 아님. 다만 `assertCommandMatchesWaitingSurface` 가 조회한 `node`(`{id,type}`)를 `assertFormSubmissionValid` 가 재사용할 수 있게 시그니처를 합치면 form 경로의 중복 `nodeRepository` 조회 1회를 줄일 수 있다(후속 최적화 후보로만 기록).

- **[INFO] `IDEMPOTENCY_KEY_CONFLICT` 는 이번 catch 경로로 도달 불가 — 그러나 이 사실이 암묵적 결합에 의존**
  - 위치: `hooks.service.ts:1397-1408` vs `codebase/backend/src/modules/external-interaction/idempotency.interceptor.ts`, `interaction.controller.ts:65-68`
  - 상세: `IdempotencyInterceptor` 는 `@UseInterceptors(IdempotencyInterceptor)` 로 **HTTP 컨트롤러 라우트**(`POST /external/executions/:id/interact`)에만 걸려 있고, `req.headers['idempotency-key']` 를 읽는 NestJS 인터셉터 파이프라인이다. `hooks.service.forwardToInteractionService` 는 `interactionService.interact()` 를 **in-process 직접 호출**(컨트롤러/인터셉터 파이프라인을 우회)하므로, 오늘 시점에는 `IDEMPOTENCY_KEY_CONFLICT` 코드의 `ConflictException` 이 이 경로로 던져질 수 없다 — orchestrator 가 우려한 "IDEMPOTENCY_KEY_CONFLICT 도 409" 오탐 가능성은 현재 코드 기준으로는 실현되지 않는다.
  - 영향: 다만 이는 "인터셉터가 컨트롤러 계층에만 걸린다"는 **암묵적** 아키텍처 결합에 의존한다. 위 첫 WARNING 에서 지적한 대로 catch 가 `err.getResponse().error.code` 를 확인하지 않고 `instanceof ConflictException` 만으로 판정하므로, 향후 누군가 idempotency 검사를 `InteractionService.interact()` 내부(서비스 계층)로 옮기거나 다른 이유로 `ConflictException` 을 서비스 레벨에서 던지게 되면, 이 catch 는 자동으로(그리고 아무 코드 변경 없이) 그 새 예외까지 조용히 삼키고 동일한("표면과 맞지 않아 거부됨") 오귀속 로그를 남기게 된다.
  - 제안: 위 WARNING 의 제안(코드 기반 분기)을 적용하면 이 잠재 리스크도 함께 해소된다.

- **[정보 확인 — 회귀 없음] `resolveWaitingNodeExecutionId` 시그니처 확장의 3개 진입점 전수 확인**
  - `private` 메서드이므로 외부(모듈 밖) 호출자에 대한 인터페이스 영향은 없음. 같은 파일 내 4개 호출부(`continueExecution`→`'form_submitted'`, `continueButtonClick`→`'button_click'`, `continueAiConversation`→`'ai_message'`, `endAiConversation`→`'ai_end_conversation'`) 모두 correctly 갱신됨 — `grep` 으로 5곳(정의 1 + 호출 4)만 존재함을 확인, 누락된 호출부 없음.
  - EIA REST(`interaction.service.ts` `dispatchContinuation`) / WS gateway(`websocket.gateway.ts:892-899`, 기존 `InvalidExecutionStateError` 범용 처리 재사용) / REST `/continue`(`executions.controller.ts:176-179`, 기존 `InvalidExecutionStateError`→422 `INVALID_STATE` 매핑 재사용) **세 진입점 모두 신규 코드 추가 없이** 기존 에러 매핑 경로를 그대로 타므로 자동으로 정합 — 실제로 관측 가능한 새 동작은 "이전에는 통과되던 표면-불일치 명령이 이제 409/422/WS-ack-에러로 거부된다"는 점 하나뿐이며, 세 진입점에 동일하게 적용된다. `continueExecution`(REST `/continue`, `formData` 전용)의 경우 `buttons` 표면 대기 중 호출 시 이제 거부되는 것이 신규 관측 동작(이전엔 `resolveButtonInteraction` (d) fallback 으로 `continue` 포트가 조용히 선택됐음) — 데이터 사이드이펙트가 "발생"에서 "거부"로 바뀌는 방향이라 안전한 방향의 변경.

- **[정보 확인 — 회귀 없음] chat-channel `button_callback` → `click_button` 가 `ai_conversation` 대기 중 stale `inline_keyboard` 로 도달하는 graceful re-park 경로는 유지됨**
  - `SURFACE_ALLOWED_COMMANDS.ai_conversation` 이 4종 명령을 모두 허용(`waiting-surface-guard.ts:902-913`)하므로, 대기 노드의 persisted `outputData.meta.interactionType` 이 `'ai_conversation'`/`'ai_form_render'` 인 상태에서 `button_click` 이 도착하면 `assertCommandMatchesWaitingSurface` 를 그대로 통과해 `continuationBus.publish({type:'button_click',...})` 까지 도달한다. 이후 worker 의 `dispatchResumeTurn`/`processAiResumeTurn` 이 담당하는 기존 stale-keyboard graceful re-park(상태 변경 없는 no-op park)은 이 가드가 전혀 건드리지 않는 하류 로직이라 변경 없음. `execution-engine.service.spec.ts` 신규 `it.each(['ai_conversation','ai_form_render'])` 테스트가 `continueButtonClick` 을 포함해 4종 명령 모두 publish 까지 도달함을 명시적으로 검증하므로 회귀 없음이 테스트로도 뒷받침된다.
  - 단, `outputData.meta.interactionType` 이 아직 영속되지 않은 극히 좁은 race(park 완료 직전)에서는 `resolveWaitingSurface` 가 `undefined` 를 반환해 fail-closed 로 거부된다 — 그러나 JSDoc 이 명시하듯 이 경우 가드가 없었어도 하류 `dispatchResumeTurn` 이 동일 신호로 매칭 실패해 `RESUME_CHECKPOINT_MISSING` 으로 어차피 실패했을 케이스라, 실질적으로 "비동기 실행 사망"에서 "동기 409"로 실패 시점만 앞당겨지는 것이며 새로운 회귀는 아니다.

## 요약

핵심 부작용 관점에서는 CRITICAL 급 문제가 발견되지 않았다. `resolveWaitingNodeExecutionId` 시그니처 확장은 `private` 메서드로 3개 진입점(EIA REST/WS gateway/REST `/continue`) 모두 기존 `InvalidExecutionStateError` 매핑 경로를 그대로 재사용해 자동 정합하며, chat-channel 의 stale `button_click` graceful re-park 은 `ai_conversation` 표면의 4종 허용 설계로 보존됨을 코드·테스트 양쪽에서 확인했다. 다만 `hooks.service.forwardToInteractionService` 의 신규 `ConflictException` catch 는 (1) JSDoc 이 서술한 "표면 불일치"보다 넓은 범위(0건/다중-row invariant 위반, execution 이 이미 waiting 을 벗어난 race 포함)를 동일하게 graceful 처리하고, (2) 부기하는 `err.message` 가 NestJS `HttpException` 의 nested-response 처리 방식 때문에 항상 `"Conflict Exception"` 이라는 무의미한 상수로 귀결돼 실제 진단 정보를 로그에 남기지 못한다 — 데이터 손상 의심 신호("다중 WAITING row")까지 동일한 오귀속 문구로 조용히 삼켜질 수 있다는 점에서 운영 가시성에 실질적 영향이 있다. `IDEMPOTENCY_KEY_CONFLICT` 자체는 이 in-process 호출 경로가 HTTP 인터셉터 파이프라인을 우회하므로 오늘은 도달 불가함을 확인했으나, catch 가 에러 코드가 아닌 클래스 전체로 판정하는 설계이므로 향후 idempotency 검사 위치가 바뀌면 같은 결함 계열이 재현될 소지가 있다. 그 외 매 continuation 호출당 DB 왕복이 소폭 늘어난 점은 기능적 리스크는 없는 성능성 INFO 로 기록한다.

## 위험도

LOW — CRITICAL 없음. WARNING 1건은 프로덕션 로그 정확성/가시성 이슈로, 기능 회귀나 데이터 무결성 훼손을 직접 유발하지는 않으나 `err.getResponse()` 기반 코드 분기로 다음 라운드에 수정 권고.
