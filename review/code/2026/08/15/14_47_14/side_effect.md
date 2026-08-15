### 발견사항

- **[INFO]** `finalizeCancelledExecution` 의 이벤트 발행 조건이 "무조건" → "DB 재확인 후 조건부" 로 바뀜 (의도된 관측 가능 동작 변경)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4899-4934` (`finalizeCancelledExecution`)
  - 상세: `updateExecutionStatus` 의 guarded UPDATE 가 0행(동시 writer 가 이미 다른 terminal 상태로 선점)이면 종전엔 무조건 `EXECUTION_CANCELLED` 를 발행했으나, 이번 diff 는 `this.executionRepository.findOneBy(...)` 로 행을 재조회해 `CANCELLED` 일 때만 발행한다. 결과적으로 특정 동시성 레이스에서 webhook/SSE/WS 수신자가 종전에 받던 `execution.cancelled` 이벤트를 더 이상 받지 못하는 경우가 생긴다(대신 실제 선점한 종결자의 이벤트만 받는다). 이 함수의 두 호출부(`:2783`, `:4787`)는 반환값을 쓰지 않는 `void` 소비라 시그니처·호출자 코드 영향은 없다. `CHANGELOG.md`("수신자 영향" 절)와 `plan/in-progress/eia-db-wire-invariant.md` 에 명시적으로 고지돼 있어 은닉된 변경은 아니다.
  - 제안: 조치 불요 — 의도된 정합성 수정이고 문서화가 돼 있다.

- **[INFO]** `finalizeCancelledExecution` 0행 분기에서 새 DB round-trip(`findOneBy`)이 추가됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4915-4917`
  - 상세: 종전에는 guarded UPDATE 결과를 아예 안 읽고 바로 emit 했는데, 이제 0행일 때만 별도 SELECT 를 한 번 더 수행한다. 트랜잭션 밖의 단순 read 라 락 경합·데드락 위험은 없고, 0행 경로(동시 선점 레이스)에서만 발생해 hot path 빈도는 낮다. 이 read 와 emit 판정 사이에도 이론상 TOCTOU 창이 남지만(그 사이 상태가 다시 바뀔 수 있음), 알림 목적의 best-effort 판정이라 이 저장소의 기존 설계 수준과 일치한다(동일 패턴이 `concurrency.md` 리뷰에서 이미 확인됨).
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.ts` `finalizeGuarded` 의 CANCELLED 분기가 `execution` 파라미터를 in-place mutate (`durationMs`/`finishedAt` 되쓰기)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:658-674`
  - 상세: `.returning(['duration_ms', 'finished_at'])` 로 받은 DB 영속값을 호출자가 넘긴 `execution` 객체에 직접 대입한다. 이 객체 참조가 이후 다른 곳으로 전파돼 오염을 일으키는지 호출부(`failRetryExecution`, `:950-1003`)를 직접 추적 확인했다 — `finalizeGuarded` 반환 직후 같은 `execution` 으로 `emitExecution` payload(`durationMs: resolveTerminalDurationMs(execution)`, `:996`)를 만드는 용도로만 재사용되고, `finally` 블록(`:490-493`, `applyRetryLastTurn`)은 `execution` 을 건드리지 않는다. 의도된 "DB=wire" 동기화이며 부작용 전파 경로는 확인되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** `finalizeCancelledExecution` JSDoc 이 이전 라운드(`13_58_27`)에 지적된 "emit 은 항상 발행" 이라는 과대서술을 이번 diff 에서 정정함 — 코드-문서 모순 해소 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4869-4879`
  - 상세: 직접 `Read` 로 대조한 결과, 해당 JSDoc 은 `emit 조건 (2026-08-15 정정) — 종전엔 반환값과 무관하게 항상 발행했다 … 그러나 무조건 발행은 반대편 결함을 낳았다 …` 로 갱신돼 있어, 본문 코드(`:4899-4934`)의 조건부 emit 과 더 이상 모순되지 않는다. 이전 라운드 side_effect 리뷰의 WARNING(코드 인접 JSDoc 미동기화)이 이번 커밋에서 해소됐음을 확인.
  - 제안: 조치 불요(확인 완료).

- **[INFO]** 환경변수·전역 변수·네트워크 호출·파일시스템 부작용 없음
  - 상세: 변경된 6개 코드 파일(`execution-engine.service.ts`, `retry-turn.service.ts`, `terminal-duration.ts`, `interaction.service.ts`, `execution-status-response.dto.ts` 및 대응 `.spec.ts`) 전체에서 `process.env`, module-level mutable 변수 신설, 외부 서비스 신규 호출은 발견되지 않았다. `STATUS_PROJECTION_COLUMNS`/`durationMs` DTO 필드 추가는 기존 컬럼(`nullable: true`)을 select 목록에 포함하거나 재노출하는 것뿐이며 신규 마이그레이션·스키마 변경이 없다. `CHANGELOG.md`/`plan/*.md`/`spec/*.md`/`review/*.md` 는 문서·이전 리뷰 라운드 산출물 파일이며 런타임 부작용과 무관하다.

### 요약

이번 diff 의 실질적 부작용은 두 가지다 — (1) `finalizeCancelledExecution` 이 guarded UPDATE 반환값을 읽어 특정 동시성 레이스에서 `EXECUTION_CANCELLED` 이벤트 발행을 skip 하도록 바뀐 것(관측 가능한 외부 이벤트 스트림 변경), (2) `retry-turn.service.ts` `finalizeGuarded` 가 `RETURNING` 값을 caller 의 `execution` 객체에 되쓰는 것(in-place mutation). 둘 다 CHANGELOG·plan 문서에 명시적으로 고지된 의도된 변경이며, 시그니처·공개 인터페이스에는 영향이 없다(`updateExecutionStatus` 는 이미 `Promise<boolean>` 이었고 이번엔 그 반환값을 소비하기 시작했을 뿐). `execution` 객체 mutation 은 직접 호출 체인을 추적해 다른 곳으로 참조가 전파되지 않음을 확인했다. `ExecutionStatusDto.durationMs` 신규 필드는 additive/nullable 이라 하위 호환을 깨지 않는다. 이전 리뷰 라운드(`13_58_27`)가 지적한 유일한 side_effect WARNING(JSDoc 이 뒤집힌 emit 조건을 여전히 "항상 발행"으로 서술)은 이번 diff 에서 정정된 것을 소스 직접 대조로 확인했다. 환경변수·전역 변수·네트워크 호출·파일시스템 부작용, 새로운 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

### 위험도

LOW
