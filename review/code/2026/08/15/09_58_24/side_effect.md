# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING] 새로 도입한 방어 헬퍼(`resolveTerminalDurationMs`)가 자매 함수 4곳에 적용되지 않았다 — 정확히 그 헬퍼가 막으려는 회귀 클래스가 그대로 남아 있다**
  - 위치:
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2578` (`driveCallStackResume`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4943-4944` (`finalizeFailedExecution`)
    - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:712-714` (`completeRetryExecution`)
    - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:947-949` (`failRetryExecution`)
  - 상세: 신규 파일 `codebase/backend/src/shared/utils/terminal-duration.ts` 의 `resolveTerminalDurationMs` 는 JSDoc 에서 스스로 겪은 회귀를 명시한다 — "이 필드를 계산하는 코드를 조건 블록 밖으로 옮겼더니 `startedAt.getTime()` 이 throw 해 **종결 emit 자체가 사라지는** 회귀가 났다(catch 가 삼켜 COMPLETED 가 FAILED 로 뒤집혔다)". 이번 diff 는 실제로 `driveResumeAwaited`(2412행)·`driveStuckRedrive`(3564행)·`runExecution`(4754행)·`finalizeCancelledExecution`(4882행, engine.service.ts) 와 `resumeGraphAfterRetry`(894행, retry-turn.service.ts) 5곳에서 field 대입을
    ```ts
    savedExecution.durationMs =
      resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;
    ```
    형태로 정정해 이 throw 를 흡수하도록 고쳤다(명시적으로 "조건 밖" 주석까지 남김). 그런데 같은 파일·같은 성격(EXECUTION_COMPLETED/FAILED emit 직전 종결 필드 세팅)의 4개 형제 함수는 여전히 예전 그대로
    ```ts
    savedExecution.finishedAt = new Date();
    savedExecution.durationMs =
      savedExecution.finishedAt.getTime() - savedExecution.startedAt.getTime();
    ```
    (또는 `execution.` 접두, retry-turn.service.ts 쪽)를 쓴다 — `startedAt` 이 없거나 `Invalid Date` 인 경우를 가드하지 않는다. 이 라인은 `updateExecutionStatus`/`finalizeGuarded`(DB 원자적 영속)와 emit 보다 **먼저** 실행되므로, 여기서 throw 하면 그 아래의 guarded UPDATE·`resolveTerminalDurationMs(savedExecution)` 를 쓴 emit 페이로드 코드 자체에 도달하지 못한다 — 즉 emit 쪽에서 헬퍼를 호출해 두어도 방어가 되지 않는다. 4곳 중 `finalizeFailedExecution`/`completeRetryExecution`/`failRetryExecution` 은 실 프로덕션 종결 경로(FAILED/CANCELLED 마킹, retry 실패 마킹)이고, `driveCallStackResume` 도 nested call-stack 완료 경로다. `execution.startedAt` 이 DB non-nullable + default 라 실제 트리거 확률은 낮지만, PR 이 스스로 "종결 emit 은 16 경로다" 라며 전수 점검을 표방하고 `plan/in-progress/eia-terminal-payload.md` 재판정 ④ 표도 "completed 6곳 · failed 3곳(그중 `finalizeFailedExecution` 포함) 전부 O" 라고 이미-계산됨으로 적어 두었을 뿐, 그 "이미 계산됨" 코드 자체가 이 PR 이 새로 만든 안전장치의 사각지대에 남아 있다는 사실은 어디에도 기록되지 않았다. 이 저장소가 반복적으로 지적해 온 "하드닝을 자매 함수에 미적용" 패턴과 정확히 같은 모양이다.
  - 대조(가드 적용된 선례, 정상): `execution-engine.service.ts:638-640` (`failFirstSegmentSetup`) 는 `if (row.startedAt) { row.durationMs = ... }` 로 이미 가드돼 있어 throw 위험이 없다 — 이 한 곳은 문제 없음.
  - 제안: 4곳 모두 이미 존재하는 패턴을 그대로 복제하면 된다 — `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` (또는 `execution.` 버전)로 교체. 비용이 0에 가까운 수정이고, 헬퍼가 이미 export 돼 두 파일 모두에서 import 돼 있다.

- **[INFO] 이벤트 페이로드 shape 변경(외부 구독자 영향) — 이미 별도로 플래그됨, 재확인만**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 내 `EXECUTION_COMPLETED`/`EXECUTION_FAILED`/`EXECUTION_CANCELLED` emit 지점 전부(예: 667-669행, 2593-2594행, 2860-2863행, 4966행), `retry-turn.service.ts` 730행·907행·971행.
  - 상세: WS/webhook 으로 나가는 종결 이벤트 payload 에 `durationMs` 필드가 신규로 추가된다(콜백/이벤트 계약 변경, 점검 관점 8). unknown 필드를 무시하는 기존 클라이언트에는 영향이 없으나, 엄격 스키마 검증을 하는 외부 구독자가 있다면 영향권이다. `plan/in-progress/eia-terminal-payload.md` 자체에 "⚠️ 외부 구독자 breaking change — 운영 확인 필요" 절이 이미 존재해 이 리스크가 인지·추적되고 있음을 확인했다 — 신규 발견 아님, 참고 기록.
  - 제안: 없음(이미 추적 중).

- **[INFO] 신규 DB 부작용 — 5개 raw UPDATE 에 `RETURNING` 절 확장 + SQL 계산식 도입**
  - 위치: `execution-engine.service.ts` 의 `cancelParkedExecution`(1043행)·`markWebChatIdleTimeout`(1178행)·`markExecutionCancelled`(2848행)·`markQueueWaitTimeout`(2905행)·`finalizeStalledExhausted`(3358행) — `.returning(['id', 'duration_ms'])` 로 확장, `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` + `.setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` 신규 추가.
  - 상세: 엔티티를 로드하지 않는 raw UPDATE 5곳 모두 `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 짝을 빠짐없이 사용한다(교차 확인 완료 — 5곳 전부 `setParameter` 존재, 파라미터 이름도 상수 재사용이라 오탈자 위험 없음, `terminal-duration.spec.ts` 가 이 매칭을 정적으로 단언). DB 왕복에 컬럼 하나(`duration_ms`)가 추가로 반환되는 것 외에 새로운 부작용은 없다 — 같은 트랜잭션 안에서 완결되고 별도 네트워크 호출·전역 상태 변경은 없다.
  - 제안: 없음(의도된 확장, 방어 테스트 존재).

- **[INFO] 조건부 블록 밖으로 이동한 필드 대입 — 이전엔 쓰이지 않던 경로(빈 그래프)에서 이제 항상 DB write 발생**
  - 위치: `execution-engine.service.ts:2408-2413`(`driveResumeAwaited`)·`3560-3565`(`driveStuckRedrive`)·`4752-4755`(`runExecution`)·`4879-4883`(`finalizeCancelledExecution`), `retry-turn.service.ts:893-896`(`resumeGraphAfterRetry`).
  - 상세: `if (lastNodeId) { ... }` 블록 안에 있던 `finishedAt`/`durationMs` 대입을 블록 밖으로 옮겨 **항상 실행**되게 했다 — PR 코멘트가 스스로 밝히듯, 노드 0개 그래프의 completed 경로에서 이 두 필드가 비어 있던(=DB 에 쓰이지 않던) 기존 버그를 고치는 의도된 변경이다. 결과적으로 이 경로가 이제 매 completed 마감마다 `finishedAt`/`durationMs` 를 무조건 write 하게 되어 지속 데이터의 shape 이 넓어진다 — 부작용이라기보다 의도된 수정이며, 신규 단위 테스트(`terminal-duration.spec.ts`)로 회귀 방지가 걸려 있다. 위 WARNING 항목과 짝을 이루는 지점이므로 참고용으로 함께 적는다.
  - 제안: 없음(WARNING 항목 수정 시 자연히 같은 안전장치를 공유하게 됨).

- **[INFO] 사설(private) 메서드 시그니처 변경 — 호출자 전수 갱신 확인됨**
  - 위치: `execution-engine.service.ts:1101-1113` (`emitCancellationEvent` opts 에 `durationMs?: number | null` 추가).
  - 상세: `private` 메서드라 클래스 밖 호출자가 없다. `grep` 으로 호출부 5곳(1077, 1208, 2859, 2908, 4885행)을 전수 확인했고 전부 `durationMs` 를 채워 넘긴다(값이 없는 경우 `null`). 외부 API 영향 없음.
  - 제안: 없음.

- **전역 변수·환경 변수·파일시스템·네트워크 호출**: 코드 diff(`.ts` 6개 파일) 안에서 신규 전역 변수·`process.env` 읽기/쓰기·파일 I/O·외부 네트워크 호출은 발견되지 않았다. `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 은 불변 `export const` 문자열 상수(SQL 조각/파라미터 이름)로, 가변 전역 상태가 아니다. `plan/*.md`·`review/consistency/**` 의 변경은 이 세션의 리뷰/기획 산출물 자체이며 프로덕션 코드 부작용과 무관하다.

## 요약

핵심 부작용은 새로 만든 방어 헬퍼 `resolveTerminalDurationMs` 가 완전히 적용되지 않았다는 점이다 — `execution-engine.service.ts`·`retry-turn.service.ts` 양쪽에서 5개 형제 종결 함수 중 4개(`driveCallStackResume`·`finalizeFailedExecution`·`completeRetryExecution`·`failRetryExecution`)가 여전히 `startedAt.getTime()` 을 가드 없이 직접 계산하고, 그 대입문은 guarded UPDATE·emit 보다 먼저 실행되므로 헬퍼가 emit 페이로드 쪽에서만 호출돼도 이 4곳의 throw 는 막지 못한다. 이는 정확히 이 PR 의 새 헬퍼가 JSDoc 에서 스스로 "실제로 겪었다"고 밝힌 회귀 클래스(계산 실패 → 종결 emit 자체가 사라짐)이며, `startedAt` 이 DB non-nullable+default 라 실제 트리거 확률은 낮지만 수정 비용이 거의 0(기존 형제 패턴 복제)인 만큼 놓칠 이유가 없다. 그 외에는 이벤트 payload 에 `durationMs` 가 추가되는 wire-format 변경(이미 plan 문서에 별도로 추적 중), raw UPDATE 5곳의 `RETURNING` 확장(일관되게 파라미터 매칭, 테스트로 방어), private 메서드 시그니처 확장(호출자 전수 갱신 확인) 모두 통제된 범위 안에 있고, 전역 변수·env·파일시스템·네트워크 부작용은 없다.

## 위험도

MEDIUM
