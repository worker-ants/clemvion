# 유지보수성(Maintainability) 리뷰 결과

대상: EIA-RL-07 `WebchatIdleReaperService`(공개 웹채팅 위젯 idle-wait execution 회수 reaper) 도입 PR.

## 발견사항

- **[WARNING]** `markWebchatIdleTimeout` 이 같은 파일의 두 기존 메서드와 ~40줄 분량의 거의 동일한 블록(조건부 `UPDATE ... WHERE status = :guard` → `affected` 체크 → guarded `emitExecution` try/catch → outer try/catch + `logger.error`)을 세 번째로 반복한다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:981-1058`(신규 `markWebchatIdleTimeout`) vs `:910-964`(`cancelParkedExecution`) vs `:2702-2745`(`markQueueWaitTimeout`). 참고로 `:2622-2694`(`markExecutionCancelled`)도 같은 골격의 네 번째 변형이다.
  - 상세: 신규 메서드의 JSDoc 자체가 "`cancelParkedExecution`(WAITING 가드 + NodeExecution cancel)와 `markQueueWaitTimeout`(`error.code` + emit)의 **합성**"이라고 명시하는데, 실제 구현은 두 메서드를 호출/합성하는 것이 아니라 로직을 처음부터 다시 타이핑한 독립 사본이다. 즉 문서(합성)와 코드(복제)가 어긋난다. 이 파일에는 이미 "WAITING/PENDING/RUNNING 조건부 UPDATE → affected 체크 → emit try/catch → outer try/catch" 패턴이 4곳 존재하며, 이번 PR은 그 안티패턴을 신규로 만든 것이 아니라 계승만 했다는 점에서 CRITICAL 은 아니지만, 로직 변경 시(예: emit payload 스키마 변경) 4곳을 수동 동기화해야 하는 리스크가 실제로 존재한다.
  - 제안: `status` 가드 값(WAITING_FOR_INPUT/PENDING/RUNNING 배열)·`set` 페이로드(code/message/cancelledBy)·NodeExecution cascade 여부·`releaseExecutionRouting` 호출 여부를 파라미터로 받는 private 헬퍼(예: `transitionToCancelled(executionId, { statusGuard, error, result, cascadeNode, releaseRouting })`)로 추출하고 4개 호출부를 얇게 재작성하는 후속 리팩터를 백로그에 남길 것을 권장한다. 이번 PR 범위에서 강제할 정도는 아니다.

- **[WARNING]** bounded-concurrency 청크 처리 루프(`for (i += CONCURRENCY) { Promise.allSettled(chunk.map(fn)); results.forEach(fulfilled/rejected 분기) }`)가 `InteractionTokenService.reconcileTerminalRevocations`(EIA-RL-06)와 `WebchatIdleReaperService.reap()`(신규 EIA-RL-07) 두 곳에 사실상 동일한 형태로 중복된다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:397-412` vs `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:929-946`.
  - 상세: 두 sweep 모두 "N개씩 청크 → `Promise.allSettled` → 성공/실패 분기 → 실패는 `logger.warn`으로 fail-open" 이라는 동일한 오케스트레이션 shape 를 갖는데, 공유 유틸리티 없이 각자 다시 작성됐다. `reap()` 자체의 순환 복잡도(for + allSettled + forEach + if/else)도 이 중복 때문에 불필요하게 커졌다.
  - 제안: `processInBatches<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>, onError: (item: T, err: unknown) => void): Promise<R[]>` 같은 공용 헬퍼(`common/` 또는 `external-interaction/` 내 유틸)로 추출하면 `reap()`과 `reconcileTerminalRevocations` 양쪽의 라인 수·복잡도가 함께 줄어든다. 이번 PR 자체는 기존 형제 sweep(EIA-RL-06)과 "동형"임을 의도적으로 명시하고 있어 스타일 일관성은 지켰으나, 그 일관성이 곧 중복이라는 점은 남는다.

- **[INFO]** 아키텍처 책임 분리가 형제 기능(EIA-RL-06)과 다르다: `TerminalRevokeReconcilerService`는 오케스트레이션(청크·동시성·revoke 호출)을 전부 `InteractionTokenService.reconcileTerminalRevocations`에 위임하는 얇은 어댑터인 반면, 신규 `WebchatIdleReaperService.reap()`은 청크·동시성 로직을 서비스 계층 자체에 둔다.
  - 위치: `codebase/backend/src/modules/external-interaction/terminal-revoke-reconciler.service.ts:71-80` vs `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:922-956`.
  - 상세: EIA-RL-07 은 판정(token service)과 취소(engine service) 두 개의 서로 다른 모듈을 오케스트레이션해야 하므로 단일 서비스 위임이 불가능하다는 점은 이해되나, 이로 인해 "reaper 서비스 = 얇은 스케줄러 어댑터"라는 형제 문서의 설명과 실제 코드(오케스트레이션 로직 보유)가 미묘하게 어긋난다. 기능적으로 문제는 없으나 다음에 이 패턴을 읽는 사람이 "reconciler 형제 패턴"이라는 docstring 만 보고 책임 분리까지 동일하다고 오해할 수 있다.
  - 제안: docstring 에 "판정/취소가 서로 다른 모듈이라 오케스트레이션을 이 서비스가 직접 담당(reconciler 와 달리 thin adapter 아님)"이라는 한 줄을 덧붙이면 향후 혼선을 예방할 수 있다.

- **[INFO]** `RECONCILE_BATCH_MAX` 상수(EIA-RL-06 전용으로 명명됨)가 EIA-RL-07 의 `findIdleWebchatExecutionIds` clamp 상한으로도 재사용된다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:54`(정의, 주석은 "batchLimit 인자 clamp 상한 — 과대 입력으로 인한 DB/Redis 과부하 방어"), `:381`(reconcile 사용), `:440`(신규 webchat idle 사용).
  - 상세: 값 자체(1000)와 의도(과대 입력 방어)는 두 sweep 에 그대로 맞아 재사용이 틀린 선택은 아니지만, 이름의 `RECONCILE_` 접두어가 코드를 읽는 사람에게 "이 상수는 reconcile 전용"이라는 잘못된 신호를 준다.
  - 제안: 이름을 `SWEEP_BATCH_MAX` 등 두 sweep 을 아우르는 중립적 이름으로 바꾸거나, 최소한 정의부 주석에 "EIA-RL-06/07 공용"이라는 문구를 추가.

- **[INFO]** 큐/서비스 명(`WEBCHAT_IDLE_REAPER_QUEUE`, `WebchatIdleReaperService`)은 명사형 `REAPER`를 쓰는 반면, 관련 설정 상수(`WEBCHAT_IDLE_REAP_GRACE_MS`, `WEBCHAT_IDLE_REAP_BATCH_LIMIT`, env `WEBCHAT_IDLE_REAP_GRACE_MS`)는 동사형 `REAP`을 쓴다.
  - 위치: `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.types.ts:16, 25, 39` vs 서비스/큐명.
  - 상세: 형제 기능인 EIA-RL-06 은 `TERMINAL_REVOKE_RECONCILE_QUEUE`(동사형)와 `TerminalRevokeReconcilerService`(명사형)로 이미 동일한 동사/명사 분기를 쓰고 있어, 이번 명명이 그 선례와 완전히 어긋나진 않는다. 다만 EIA-RL-06 은 큐 상수도 `RECONCILE`(동사형)로 통일한 반면, EIA-RL-07 은 큐 상수만 `REAPER`(명사형)로 갈라져 있어 두 형제 기능 간 명명 규칙이 완전히 대칭은 아니다. 사소한 스타일 편차로 기능에 영향 없음.

- **[INFO]** `CHANGELOG.md`의 신규 Unreleased 항목이 배경·판정 조건·구현 세부(엔진 메서드·grace env·soft-terminal·범위 제한)를 모두 한 문단짜리 단일 bullet 에 압축해 가독성이 낮다.
  - 위치: `CHANGELOG.md:34-38`.
  - 상세: 같은 파일의 인접 항목("웹채팅 위젯 '새 대화' single-flight coalesce…")도 유사하게 긴 단일 문단 스타일이라 리포지토리 관행 자체와는 일관되지만, 두 항목 모두 향후 변경 이력을 훑어볼 때 스캔하기 어렵다.
  - 제안: 필수는 아니나, 후속 changelog 항목부터는 "무엇을/왜/범위" 정도로 하위 bullet 을 나누는 편이 스캔성을 높인다.

## 요약

이번 PR(EIA-RL-07 공개 웹채팅 위젯 idle-wait reaper)은 새로 추가된 파일(`webchat-idle-reaper.types.ts`, `webchat-idle-reaper.service.ts`)만 놓고 보면 함수 길이·중첩 깊이·네이밍·매직넘버 모두 양호하다 — 상수는 의미 있는 이름과 근거 주석을 갖추고, env 파서는 기존 `resolveQueueWaitTimeoutMs`와 동일한 정규식 선검증 관례를 따르며, 서비스는 스케줄 등록/디스패치/집계라는 명확히 분리된 3개 메서드로 구성돼 있다. 테스트도 성공/실패/멱등/fail-open 케이스를 촘촘히 커버한다. 가장 눈에 띄는 유지보수성 리스크는 새 코드 자체보다 기존 `execution-engine.service.ts`에 이미 존재하던 "조건부 UPDATE + guarded emit" 패턴을 세 번째(넓게 보면 네 번째)로 복제했다는 점과, EIA-RL-06 형제 sweep 과 거의 동일한 청크 동시성 처리 루프를 다시 작성했다는 점이다. 둘 다 즉시 차단할 결함은 아니며 기존 코드베이스 스타일과의 "일관성"은 지켰지만, 다음에 이 계열 로직(취소 사유 추가, sweep 하나 더 추가 등)을 건드릴 사람에게는 4~5곳을 동기화해야 하는 부담을 남긴다. 리팩터를 이번 PR 에서 강제할 정도는 아니므로 백로그성 후속 작업으로 남기는 것을 권장한다.

## 위험도

LOW
