# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (4차 라운드, `10_34_51` 이후)

## 방법론 노트

프롬프트 번들에서 diff 가 생략된 `execution-engine.service.ts`/`.spec.ts`(55KB 초과)는
`git diff origin/main -- <path>` 로 직접 열어 전문을 대조했다. 이 PR 은 이미 3차례 리뷰
라운드(`09_58_24`→`10_18_38`→`10_34_51`)를 거쳤고, 그 라운드들의 side_effect 리뷰(특히
`10_18_38/side_effect.md` 의 MEDIUM — `driveCallStackResume` 형제 미적용)가 실제로
해소됐는지를 소스 재확인으로 검증하는 데 집중했다. 또한 이전 라운드들이 코드 diff 범위
안에서 다루지 않은 "durationMs 를 새로 쓰는 컬럼을 읽는 다운스트림 소비처"까지 저장소
전체를 grep 해 추적했다.

## 발견사항

- **[WARNING]** (이미 등재됨, 실측으로 재확인) 새로 채워지는 `duration_ms` 가 status 필터
  없는 평균 집계 3곳을 오염시킨다
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:96` (`avgExecutionTime`),
    `codebase/backend/src/modules/statistics/statistics.service.ts:95`·`:221` (`avgDurationMs`,
    요약 + workflow 랭킹, 프론트 렌더). 이 PR 의 diff 대상은 아니지만, 이 PR 이 쓰는 값의
    직접적 소비처다.
  - 상세: 이 PR 이전에는 park 취소·공개 위젯 idle-wait 취소·재개 실패 취소·큐 대기
    타임아웃 취소가 `duration_ms` 를 전혀 쓰지 않아 해당 execution 행은 `NULL` 로 남았고,
    위 세 쿼리의 `AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL)` 가 자연히
    그 행들을 평균에서 제외했다. 이 PR 이 그 5경로(4곳 DB write)에 `TERMINAL_DURATION_MS_SQL`
    로 실제 값을 채우면서, `NOT NULL` 필터를 통과하는 행이 새로 생긴다. 그런데 이 값의
    의미가 절반은 **대기 시간**이다(park 는 무기한, 위젯 idle-wait 은 기본 grace 1시간) —
    "실행 시간" 이라는 지표 정의와 다르다. `dashboard.service.ts:70-99`/
    `statistics.service.ts:88-98` 를 직접 읽어 확인한바 두 쿼리 모두 `status = 'completed'`
    필터가 없다(카운트 컬럼만 status 별 `FILTER` 를 쓰고 `avgDurationMs`/`avgExecutionTime`
    은 전체 status 대상). 오래 대기하다 취소된 execution 하나가 평균을 크게 왜곡할 수 있다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:175-190`
    ("`duration_ms` 에 '대기 시간' 이 섞여 집계를 오염시킨다", `10_34_51` W3)에 이미
    등재되어 있고 이 PR 범위 밖으로 명시적으로 미룬 상태다. 새로 발견한 것이 아니라
    실측으로 상태를 재확인한 것이다 — 트래커가 실제 소스와 여전히 일치함을 확인했다는
    의미로 남긴다.
  - 제안: 이미 트래커에 있는 대로(집계 쿼리에 `status = 'completed'` 필터 추가, 또는
    대기-시간 생성 경로를 구분하는 별도 신호 도입) 후속 PR 에서 처리. 재론 불필요.

- **[INFO]** `finalizeGuarded` CANCELLED 재진입 분기의 DB↔emit `durationMs` 값 불일치
  (이미 등재됨, 소스 재확인)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수
    `finalizeGuarded` — CANCELLED 분기(`COALESCE(duration_ms, :newDurationMs)`, 함수 내
    `target === ExecutionStatus.CANCELLED` 블록), 호출부 `failRetryExecution` 의 emit
    (`durationMs: resolveTerminalDurationMs(execution)`)
  - 상세: `stop()` 이 사용자가 Stop 을 누른 시각(T1)의 `duration_ms` 를 이미 DB 에 커밋해
    두면, 재진입한 턴이 나중에 자연 실패(429/timeout 등)해 `failRetryExecution` 에
    도달했을 때 `finalizeGuarded` 는 `COALESCE(duration_ms, …)` 로 DB 의 T1 값을
    보존한다(의도된 동작 — 주석에 §2.3 계약으로 명시). 그런데 그 직후 emit 은 in-memory
    `execution.durationMs`(재진입 시점 T2, DB 에 실제로 쓰인 값보다 큼)를
    `resolveTerminalDurationMs(execution)` 로 그대로 내보낸다 — WS/webhook 수신자가 받는
    `durationMs` 와 REST 재조회 시 보이는 `duration_ms` 가 갈릴 수 있다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:195-199`
    ("retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다", `10_34_51` W1)에 이미
    등재되어 있고, "COALESCE 반환값을 되읽는 구조 변경이 필요해 이 라운드에서 서두르면
    과잉 스코프를 반복한다" 는 근거로 명시적으로 미뤄졌다. 이 PR 이 새로 만든 회귀는
    아니다(재진입 경로 자체는 이 PR 이전부터 있던 로직) — 다만 이 PR 이 `durationMs` 를
    emit payload 에 처음 실으면서 **이 기존 불일치가 처음으로 wire 에 노출**되는 지점이다.
  - 제안: 이미 트래커에 있는 대로 후속 처리. 재론 불필요.

- **[INFO]** `driveCallStackResume` — 3차 라운드(`10_18_38`)가 MEDIUM 으로 지적한 형제
  미적용이 실제로 해소됨을 소스로 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2593`
  - 상세: `10_18_38/side_effect.md` 는 이 경로만 옛 무가드 뺄셈(`finishedAt.getTime() -
    startedAt.getTime()`)을 쓴다고 지적했다(MEDIUM). 현재 소스를 `Read` 로 직접 확인한
    결과 계산부·emit 부 모두 `resolveTerminalDurationMs(savedExecution) ??
    savedExecution.durationMs` / `resolveTerminalDurationMs(savedExecution)` 로 전환되어
    있다 — 형제 5경로(`driveResumeAwaited`·`runExecution`·`resumeGraphAfterRetry`·재로드·
    `completeRetryExecution`)와 동형이다. `grep -c "resolveTerminalDurationMs("` 로 셌을 때
    completed 계열 write 지점이 이제 전부 헬퍼를 거친다. 재발 없음.

- **[INFO]** `emitCancellationEvent` 시그니처 확장(`durationMs?: number | null` 추가)과
  raw UPDATE 5경로 `.returning([...])` 확장은 side-effect 관점에서 안전
  - 상세: `private` 메서드이고 5개 호출부 전부가 이번에 값을 채워 넘긴다(넘기지 않아도
    `opts.durationMs ?? null` 기본값으로 안전). `.returning()` 확장은 같은 트랜잭션/문장
    안의 부작용이라 새 외부 부작용을 만들지 않는다. `chat-channel.dispatcher.ts` 의
    3개 캐스팅 타입도 `10_18_38` W8 조치로 `{ durationMs?: number | null }` 로 정정되어
    `types.ts` 의 넓어진 계약과 일치한다(실측: `chat-channel.dispatcher.ts:534,572,589`).

- **[INFO]** `NodeExecution.durationMs` 관련 경로는 이번 PR 대상 밖으로 원상 유지 확인
  - 상세: `10_34_51` W2 가 지적한 "정규식이 스코프를 넘어 `NodeExecution` 8곳까지 바꿨다"
    회귀가 되돌려졌는지 직접 grep 으로 확인했다 — `nodeExecution.durationMs = … .getTime()
    - … .getTime()` 형태의 무가드 뺄셈이 8곳 모두 원래 형태로 남아 있고
    `resolveTerminalDurationMs` 를 쓰지 않는다. 스코프 이탈 재발 없음.

- **[INFO]** 신설 순수 함수/상수(`resolveTerminalDurationMs`/`toFiniteNumber`/
  `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM`)는 전역 상태·파일시스템·환경
  변수·네트워크를 건드리지 않는다. `terminal-duration.ts` 는 신규 파일이지만 export 외
  부작용이 없다.

## 요약

이번 4차 라운드에서 이전 라운드가 지적한 side-effect 항목(driveCallStackResume 형제
미적용, NodeExecution 스코프 이탈)은 소스 재확인 결과 모두 실제로 해소됐다. 새로 발견한
CRITICAL/WARNING 은 없으나, 이 PR 이 처음으로 wire 에 노출시키는 두 가지 **다운스트림
불일치**를 실측으로 재확인해 남긴다 — (1) `duration_ms` 를 새로 채우는 4개 raw-UPDATE
경로 중 다수가 "대기 시간"을 담는데 이를 status 필터 없이 평균 내는 소비처가 3곳(대시보드
`avgExecutionTime`, 통계 `avgDurationMs` 2곳) 있어 지표가 왜곡될 수 있고, (2) retry-turn
재진입 시 `finalizeGuarded` 의 `COALESCE` 로 DB 에는 옛 값(T1)이 보존되는데 emit 은
in-memory 새 값(T2)을 실어 DB↔wire 값이 갈릴 수 있다. 둘 다 이 PR 자신의 3차 라운드
(`10_34_51`)에서 이미 근거와 함께 정본 트래커(`plan/in-progress/
spec-sync-external-interaction-api-gaps.md`)에 등재·유예된 항목이고, 이번 라운드의 실측은
그 등재가 현재 소스와 여전히 정확히 대응함을 확인한 것이다. 나머지(emitCancellationEvent
시그니처 확장, dispatcher 캐스팅 타입, RETURNING 확장)는 optional 필드·private 메서드·
트랜잭션 내부 범위로 안전하게 통제되어 있다.

## 위험도

LOW
