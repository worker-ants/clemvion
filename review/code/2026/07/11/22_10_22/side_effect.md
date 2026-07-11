# 부작용(Side Effect) Review

대상: `plan/in-progress/refactor-reaper-dry.md` 스코프 — (1) `Webchat`→`WebChat` 식별자 정규화(4종),
(2) `processInBatches` bounded-concurrency 헬퍼 추출(W4), (3) `emitCancellationEvent` private 헬퍼 추출(W3),
그 외 spec/plan 문서 동기화. 총 18개 파일(신규 2, 리네임 리팩터 위주).

검증을 위해 직접 실행한 것:
- `grep -rn "Webchat\b" codebase/ | grep -v 'webchat-idle-reaper\.\|WEBCHAT_'` → 0건 (구 네이밍 잔존 참조 없음)
- `markWebchatIdleTimeout`/`findIdleWebchatExecutionIds`/`resolveWebchatIdleReapGraceMs`/`WebchatIdleReaperService`(구 표기) 전체 codebase/spec grep → 0건
- `npx tsc --noEmit -p tsconfig.json` → 대상 5개 파일(`execution-engine.service.ts`, `interaction-token.service.ts`, `external-interaction.module.ts`, `webchat-idle-reaper.service.ts`, `process-in-batches.ts`) 자체에서 신규 에러 0건 (출력에 잡힌 기존 에러들은 전부 무관한 사전 존재 파일: `ai-turn-executor.spec.ts`, `carousel/*.spec.ts` 등)
- `npx jest src/common/utils/process-in-batches.spec.ts src/modules/external-interaction/webchat-idle-reaper.service.spec.ts src/modules/external-interaction/webchat-idle-reaper.types.spec.ts src/modules/external-interaction/interaction-token.service.spec.ts src/modules/execution-engine/execution-engine.service.spec.ts` → 5 suites / 470 tests 전부 PASS

## 발견사항

- **[INFO]** `processInBatches` 도입으로 개별 실패 warn 로그의 발화 시점이 "청크 단위 즉시" → "전체 sweep 완료 후 일괄"로 바뀜
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` `reconcileTerminalRevocations` (구 로직 라인 763-793 대응부), `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts` `reap()`
  - 상세: 리팩터 전에는 `for (i += CONCURRENCY) { ...; results.forEach(...warn...) }` 로 각 청크가 settle 될 때마다 그 청크의 실패 항목이 즉시 `logger.warn` 됐다. 리팩터 후에는 `processInBatches`가 **모든 청크를 순회한 뒤** 하나의 `results` 배열을 반환하고, 호출부는 그 전체 배열에 대해 한 번의 `forEach`로 warn 을 낸다. `processInBatches` 내부 동시성 상한(순차 청크·청크 내 병렬)은 동일하게 유지되므로 최종 카운트(`revoked`/`reaped`)·로그 내용·순서(`items[idx]` 매핑)는 모두 동일하다 — 달라지는 것은 **개별 실패 warn 로그가 sweep 전체가 끝날 때까지 지연**된다는 점뿐이다. 배치가 크고(예: `RECONCILE_BATCH_LIMIT=500`, concurrency 20 → 25청크) 도중 실패가 있으면, 운영 로그 tail 로 실시간 원인 추적할 때 마지막 청크까지 기다려야 로그가 보인다.
  - 제안: 실무 영향은 낮음(sweep 은 분 단위 백그라운드 잡이라 초 단위 지연은 무해)이나, plan 문서가 "동작 무변경"을 명시적으로 표방하므로 이 로그 타이밍 차이를 plan 문서 또는 함수 docstring에 한 줄 명시해두면 향후 "로그가 늦게 뜬다"는 오탐 조사를 예방할 수 있다.

- **[INFO]** 공개(exported) 심볼 4종 rename — 계약 표면(파일명/큐 문자열/env/wire)은 불변, 내부 호출부는 grep 전수 확인상 완전 동기화됨
  - 위치: `WebchatIdleReaperService`→`WebChatIdleReaperService`(`webchat-idle-reaper.service.ts`), `markWebchatIdleTimeout`→`markWebChatIdleTimeout`(`execution-engine.service.ts`, public 메서드), `findIdleWebchatExecutionIds`→`findIdleWebChatExecutionIds`(`interaction-token.service.ts`, public 메서드), `resolveWebchatIdleReapGraceMs`→`resolveWebChatIdleReapGraceMs`(`webchat-idle-reaper.types.ts`, exported 함수)
  - 상세: 이 4개는 모두 TS 모듈 export 또는 클래스 public 멤버라 형식적으로는 "시그니처/인터페이스 변경"에 해당하지만, (a) `codebase/{frontend,channel-web-chat,packages}` 어디에도 참조가 없어 백엔드 내부에 국한, (b) `external-interaction.module.ts`의 provider 배열은 class-token 기반 DI라 클래스명 변경 자체가 DI wiring 을 깨지 않음, (c) 큐 이름(`webchat-idle-reaper`)·env 변수명(`WEBCHAT_IDLE_REAP_*`)·wire `error.code`(`WEBCHAT_IDLE_TIMEOUT`)는 문자열 리터럴로 전부 보존되어 Redis/BullMQ 잔존 스케줄러·외부 클라이언트(위젯)에 영향 없음이 코드로 확인됨. tsc/jest 실측도 위와 같이 clean.
  - 제안: 없음 — 이미 안전하게 마감된 rename. 참고 기록 목적.

- **[INFO]** `interaction-token.service.ts` 의 `verify()` 반환값 타입 단언(`as {...}`) 제거가 plan 문서(`refactor-reaper-dry.md`)에 선언된 스코프(naming/W3/W4) 밖에서 함께 커밋됨
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:204-207` (`verifyPerExecution` 내부)
  - 상세: `payload = verify(...) as { sub?: unknown; aud?: unknown; jti?: unknown };` → `payload = verify(...);` 로 캐스트만 제거. `let payload: {...}` 선언 타입에 구조적으로 할당 가능해 `tsc --noEmit` 상 신규 에러 없음(직접 재실행 확인) — 런타임 부작용은 없다. 다만 plan 문서의 "채택 스코프" 3항목에 이 변경이 명시돼 있지 않아, 리뷰/추적 관점에서 "왜 이 줄이 같이 바뀌었는지"가 diff만으로는 불투명하다.
  - 제안: 기능상 문제는 아니므로 차단 사유 아님. 다음 커밋 메시지나 plan 문서에 "부수적으로 불필요 타입 단언 제거" 한 줄만 추가해두면 추적성이 개선된다.

## 요약

핵심 변경은 (1) 두 곳에서 중복되던 `for(i+=C){slice;allSettled;forEach}` 청크 루프를 `processInBatches` 순수 유틸로, (2) 네 곳에서 중복되던 `try{emitExecution}catch{warn}` 를 `emitCancellationEvent` private 헬퍼로 통합한 behavior-preserving 리팩터이며, 각 호출부의 payload 형태(`error` 유무 분기 포함)·warn 메시지 문자열(`logContext` prefix)·최종 반환값을 원본과 1:1 대조한 결과 동일함을 확인했다. `Webchat`→`WebChat` 식별자 rename 4종은 형식상 public 시그니처 변경이지만 전수 grep으로 잔존 구-참조가 없고 큐명/env/wire 문자열 등 실제 계약 표면은 전혀 건드리지 않아 외부 영향이 없다. 유일하게 실질적인 동작 차이는 배치 sweep 의 개별 실패 warn 로그가 청크 단위 즉시 발화에서 전체 sweep 종료 후 일괄 발화로 바뀐 타이밍 변화이며, 최종 카운트/내용에는 영향이 없는 관측성 수준의 미세한 차이다. 전역 변수 도입, 파일시스템 부작용, 신규 네트워크 호출, 환경 변수 신규 read/write 는 발견되지 않았다.

## 위험도

LOW
