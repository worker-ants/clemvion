# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `processInBatches` 추출은 중복 제거 효과가 명확하나, 호출부의 후처리(`results.forEach` 집계/warn) 블록은 두 호출처(`interaction-token.service.reconcileTerminalRevocations`, `webchat-idle-reaper.service.reap`)에 여전히 구조적으로 유사한 형태로 남아 있다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:1208-1221`, `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:1784-1799`
  - 상세: 두 곳 모두 `results.forEach((r, idx) => { if (fulfilled) 집계 else logger.warn(...) })` 패턴이 반복된다. `plan/in-progress/refactor-reaper-dry.md` 에 "집계 형태가 달라(boolean count vs `.revoked` sum) 호출처 유지" 로 이미 트레이드오프가 문서화되어 있어 재작업을 요구하는 것은 아니나, 잔여 중복이라는 점은 기록해 둘 가치가 있다.
  - 제안: 현재 스코프에서는 수용 가능. 세 번째 호출처가 생기면 `(results, idsOrRows, onFulfilled, onRejectedMsg)` 형태의 집계 헬퍼 재검토를 권장.

- **[INFO]** `emitCancellationEvent` 의 `logContext: string` 파라미터는 실제 호출 메서드명과 수동 동기화가 필요한 자유 문자열이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:962-970` (선언), 941-944 / 1054-1057 / 2694-2698 / 2731-2735 (4개 호출부)
  - 상세: 본 PR 은 `markWebchatIdleTimeout` → `markWebChatIdleTimeout` 리네임과 함께 해당 `logContext` 문자열(`'markWebchatIdleTimeout'` → `'markWebChatIdleTimeout'`)도 정확히 동반 갱신해 현재는 4곳 모두 실제 메서드명과 일치한다. 다만 이 필드는 컴파일러가 보증하지 않는 수동 문자열이라, 향후 메서드명이 바뀌는데 `logContext` 갱신을 누락하면 로그만 stale 상태로 drift 할 수 있다.
  - 제안: 리스크는 낮음(private 헬퍼, 단일 파일, 호출부 4곳뿐). 필요하면 `logContext` 를 생략하고 helper 내부에서 `new Error().stack` 파싱 같은 과설계 대신, 현재처럼 명시적 문자열을 유지하되 각 호출부 근처 주석에 "메서드 리네임 시 함께 갱신" 한 줄을 남기는 정도로 충분.

- **[INFO]** 스코프 외 변경 1건이 이번 diff 에 섞여 있다: `verify()` 반환값의 명시적 타입 단언(`as { sub?: unknown; aud?: unknown; jti?: unknown }`) 제거.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:204-207`
  - 상세: `plan/in-progress/refactor-reaper-dry.md` 의 채택 스코프는 naming(`Webchat→WebChat`)·W4(청크 루프 DRY)·W3(emit 보일러플레이트 DRY) 3건으로 명시돼 있고, 이 타입 단언 제거는 그 어디에도 언급되지 않는다. 동작 자체에는 영향이 없어 보이나(변수 `payload` 의 명시적 타입 선언에 의해 할당 시 구조적 검증이 이뤄짐), "behavior-preserving 순수 구조 정리" 를 표방하는 리팩터 커밋에 스코프 외 변경이 조용히 섞이면 이후 diff 리뷰·bisect 시 원인 추적이 어려워진다.
  - 제안: 향후 유사 리팩터에서는 plan 문서의 "채택" 목록에 이런 부수 정리도 명시하거나, 별도 커밋으로 분리.

## 요약

이번 변경은 두 갈래로 명확히 나뉜다: (1) `Webchat` → `WebChat` 대소문자 정렬을 서비스 클래스명·메서드명(`markWebChatIdleTimeout`·`findIdleWebChatExecutionIds`·`resolveWebChatIdleReapGraceMs`)·모듈 wiring·6개 spec 파일·5개 spec 문서에 걸쳐 놓침 없이 동기화했고(grep 으로 잔여 `Webchat` 0건 확인), (2) 두 BullMQ sweep 경로가 공유하던 `for(chunk){allSettled}` 루프를 `common/utils/process-in-batches.ts` 로, execution-engine 의 4개 cancel 경로가 공유하던 `try{emit}catch{warn}` 블록을 `emitCancellationEvent` private 헬퍼로 각각 추출했다. 두 추출 모두 매직 넘버 없이 기존 named constant(`RECONCILE_CONCURRENCY`/`REAP_CONCURRENCY`)를 그대로 파라미터로 전달하고, 로그 메시지·payload 형태를 원문 그대로(또는 사소한 표현 통일 수준으로) 보존해 동작 회귀 위험이 낮다. `processInBatches` 는 순서 보존·fail-open·concurrency floor(1)·빈 입력 처리 등 엣지케이스를 6개 유닛 테스트로 촘촘히 검증했다. 함수 길이·중첩 깊이·순환 복잡도 모두 낮게 유지되며, 새 헬퍼들의 JSDoc 은 "왜"(추출 배경·불변 보존 사유)를 충실히 기록해 기존 코드베이스의 문서화 관례와 일관된다. 잔여 이슈는 모두 INFO 수준의 저위험 관찰(경미한 잔존 중복·수동 동기화 문자열 필드·스코프 외 1줄 변경)이며 병합을 막을 사유는 없다.

## 위험도
LOW
