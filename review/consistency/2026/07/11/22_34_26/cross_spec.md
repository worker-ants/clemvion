# Cross-Spec 일관성 검토 — EIA (External Interaction API) 영역

검토 모드: impl-done (diff-base=origin/main, scope=spec/5-system/14-external-interaction-api.md)
Target: 코드 리팩터(`WebchatIdleReaperService` 등 `Webchat`→`WebChat` 리네이밍, `processInBatches` 공용 헬퍼 추출, `emitCancellationEvent` 공용 헬퍼 추출). 이번 diff 는 `spec/5-system/14-external-interaction-api.md` 본문 변경을 동반하지 않는 순수 구현 리팩터다.

## 발견사항

검증 결과 다른 spec 영역과의 충돌은 발견되지 않았다. 아래는 확인 근거다 (모두 non-issue 로 판정, 참고용).

- **[INFO]** 리네이밍은 신규 drift 가 아니라 기존 drift 해소
  - target 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts` 외 5개 파일 (diff 전역)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md:145`, `spec/7-channel-web-chat/1-widget-app.md:91`, `spec/7-channel-web-chat/3-auth-session.md:127`, `spec/data-flow/15-external-interaction.md:263`, `spec/data-flow/0-overview.md:205`
  - 상세: 위 5개 spec 문서는 이미 `WebChatIdleReaperService` / `markWebChatIdleTimeout` / `findIdleWebChatExecutionIds` / `resolveWebChatIdleReapGraceMs` (대문자 `WebChat`, camelCase) 표기를 SoT 로 사용 중이었다. diff 이전 코드는 `Webchat`(소문자 `chat`) 로 표기되어 있어 코드가 spec 표기와 어긋나 있었다 — 즉 이번 diff 는 새 불일치를 만드는 것이 아니라 **기존 spec-코드 네이밍 drift 를 해소**한다. `grep -rln "Webchat" spec/` 결과 0건, `grep -rln "Webchat" codebase/backend/src codebase/backend/test`(구 소문자 표기, `WEBCHAT_` 상수 제외) 결과 0건으로 리네이밍이 spec 표기와 코드베이스 전역에 완전히 수렴했음을 확인.
  - 제안: 조치 불필요. (구조적 완결성 관점에서도 잔존 참조 없음 확인됨.)

- **[INFO]** `cancelledBy`/`error` payload 계약 — 헬퍼 추출 후에도 spec 계약 유지
  - target 위치: `execution-engine.service.ts` 신설 `emitCancellationEvent` 사설 헬퍼 (4개 호출부 `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout` 통합)
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md:647,1262`(닫힌 3값 union `cancelledBy: 'user'|'system'|'timeout'`, 확장 금지 규약), `spec/5-system/6-websocket-protocol.md:179`(`execution.cancelled` payload — user cancel 은 `error` 부재, system/timeout 은 `error` 동행), `spec/conventions/chat-channel-adapter.md:133,342`
  - 상세: 신설 헬퍼의 `opts.cancelledBy: 'user'|'system'|'timeout'` 은 spec 의 닫힌 union 과 정확히 일치하며 새 값을 추가하지 않는다. `...(opts.error ? {error: opts.error} : {})` 스프레드로 `cancelParkedExecution`(user, error 없음)만 error 키 부재, 나머지 3경로(system/timeout)는 error 동행 — spec 이 규정한 "일반 user cancel 에는 error 부재" 규칙과 일치. 신설 unit 테스트(`execution-engine.service.spec.ts` cancelParked 케이스)가 `emitSpy` 로 정확 payload(`error` 키 미존재)를 assert 해 회귀를 방지한다.
  - 제안: 조치 불필요.

- **[INFO]** 헬퍼 타입이 wire 계약보다 다소 엄격 (message 필수)
  - target 위치: `execution-engine.service.ts` `emitCancellationEvent(opts: { error?: { code: string; message: string } })`
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md:179` (`error?: { code, message? }` — `message` optional)
  - 상세: 신설 사설 헬퍼의 TS 타입은 `error` 객체가 존재할 경우 `message` 를 필수로 요구하지만, wire 계약(spec)은 `message` 를 optional 로 허용한다. 실제 4개 호출부는 모두 `message` 를 채워 호출하므로 현재 런타임 동작에는 영향이 없고, 이 리팩터가 새로 만든 제약도 아니다(호출부 각각이 이미 항상 message 를 구성해 왔음). 코드 리뷰 관점의 타입-엄격도 노트일 뿐 cross-spec 모순은 아니다.
  - 제안: 조치 불필요(참고만). 향후 `error.message` 없이 emit 하는 신규 경로가 생기면 헬퍼 타입을 `message?: string` 으로 완화 검토.

- **[INFO]** `processInBatches` 공용 헬퍼 추출 — 동작 불변, spec 미참조 항목이라 갱신 대상 아님
  - target 위치: `codebase/backend/src/common/utils/process-in-batches.ts` (신규), 호출부 `interaction-token.service.ts`(`reconcileTerminalRevocations`), `webchat-idle-reaper.service.ts`(`reap`)
  - 충돌 대상: 없음 — `RECONCILE_CONCURRENCY`/`REAP_CONCURRENCY` 상수값(둘 다 기존 값 유지, 변경 없음)과 청크 처리 방식(고정 크기 chunk + `Promise.allSettled` + fail-open)이 리팩터 전후 동일. `spec/data-flow/15-external-interaction.md` §EIA-RL-06/EIA-RL-07 흐름 서술과 상충 없음. `spec/**` 어디에도 `RECONCILE_CONCURRENCY`/`REAP_CONCURRENCY`/`processInBatches` 를 직접 참조하는 문구가 없어(grep 0건) 구현 세부사항으로 spec 갱신 대상이 아니다.
  - 제안: 조치 불필요.

## 요약

이번 diff 는 `spec/5-system/14-external-interaction-api.md` 본문 변경 없이 코드 레벨에서 (1) `Webchat`→`WebChat` 네이밍을 여러 spec 문서(EIA §3.4 EIA-RL-07, channel-web-chat §1/§3, data-flow §0/§15)가 이미 확정해 둔 표기에 맞춰 정정하고, (2) 4개 취소 경로가 중복 구현하던 `try{emit}catch{warn}` 및 배치 처리 루프를 각각 `emitCancellationEvent`/`processInBatches` 공용 헬퍼로 통합한 순수 리팩터다. `cancelledBy` 닫힌 3값 union, `error` 키 존재/부재 규칙(user=부재, system/timeout=동행), 배치 concurrency 상수 등 관찰 가능한 계약은 모두 그대로 보존되며 신설 unit 테스트가 이를 회귀 방지 형태로 고정한다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임 6개 관점 어디에서도 다른 spec 영역과의 직접 모순(CRITICAL) 또는 우선순위 결정이 필요한 잠재 충돌(WARNING) 을 발견하지 못했다.

## 위험도

NONE
