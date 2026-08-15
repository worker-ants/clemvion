# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (5차/최종 라운드, `10_52_08` 이후)

## 방법론 노트

프롬프트 번들에서 diff 가 생략된 대형 파일(`execution-engine.service.ts`/`.spec.ts` 등)은
`git diff origin/main -- <path>` 로 직접 열어 전문을 대조했다. 이 PR 은 이미 4차례 리뷰
라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`)를 거쳤고, 그 라운드들이 지적·해소·
등재한 side-effect 항목이 최종 상태(`bd611be81`, 이 라운드가 보는 HEAD)에서도 그대로
유지되는지를 소스 재확인으로 검증하는 데 집중했다. `10_52_08` 이후 유일한 신규 커밋
(`bd611be81`)은 테스트 2건 추가뿐이고 production 코드 변경이 없어, 프로덕션 표면 자체는
`10_52_08` 라운드가 본 것과 동일하다.

## 발견사항

- **[WARNING]** (이미 등재됨, 최종 상태로 재확인) retry-turn 재진입 시 DB 에 영속된
  `durationMs` 와 emit 되는 값이 갈릴 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 함수
    `finalizeGuarded` — `target === ExecutionStatus.CANCELLED` 분기(637행),
    `COALESCE(duration_ms, :newDurationMs)`(643행). 이 분기를 거친 뒤의 emit 은
    `failRetryExecution`(971행) 이 `durationMs: resolveTerminalDurationMs(execution)` 로
    in-memory 값을 그대로 싣는다.
  - 상세: 사용자가 `stop()` 을 누른 시각(T1)의 `duration_ms` 를 이미 DB 가 COALESCE 로
    보존해 두면(§2.3 계약, 의도된 동작), 그 뒤 재진입한 턴이 자연 실패해 `failRetryExecution`
    에 도달했을 때 emit 은 DB 에 실제로 쓰인 T1 이 아니라 in-memory `execution.durationMs`
    (재진입 시점 T2, 더 큰 값)를 내보낸다. WS/webhook 수신자가 받는 `durationMs` 와 REST
    재조회 시의 `duration_ms` 가 갈릴 수 있다. 희귀 레이스가 아니라 "retry-turn 처리 중
    Stop" 이라는 일반 흐름에서 결정적으로 발생한다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-216` (`10_34_51`
    W1)에 명시적 근거("DB write 경로를 또 바꾸는 변경이고, 서두르면 같은 라운드가 지적한
    과잉 스코프를 반복한다")와 함께 등재돼 있고, `10_52_08` 라운드가 재확인했다. 이 PR 이
    새로 만든 회귀는 아니다(재진입 로직 자체는 선행 PR) — 다만 이 PR 이 `durationMs` 를
    emit payload 에 처음 싣기 시작하면서 **이 기존 불일치가 처음으로 wire 에 노출**된다.
  - 제안: 이미 트래커에 있는 대로(CANCELLED 분기에 `.returning(['duration_ms'])` 추가해
    실제 persist 값을 되읽어 emit) 후속 PR 에서 처리. 재론 불필요 — 새 조치 요구 아님.

- **[WARNING]** (이미 등재됨, 최종 상태로 재확인) 이 PR 이 새로 채우는 `duration_ms` 가
  status 필터 없는 평균 집계 3곳을 오염시킨다
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:96`
    (`AVG(e.duration_ms) ... AS avgExecutionTime` 계열),
    `codebase/backend/src/modules/statistics/statistics.service.ts:95`,`:221`
    (`AVG(e.duration_ms) ... AS "avgDurationMs"`, 요약 + workflow 랭킹). 이 PR 의 diff
    대상은 아니지만, 이 PR 이 새로 쓰는 값의 직접 다운스트림 소비처다.
  - 상세: 이 PR 이전에는 park 취소·공개 위젯 idle-wait 취소·재개 실패 취소·큐 대기
    타임아웃 취소가 `duration_ms` 를 전혀 쓰지 않아 해당 execution 행은 `NULL` 로 남았고,
    `FILTER (WHERE ... duration_ms IS NOT NULL)` 이 그 행들을 자연히 평균에서 제외했다.
    이 PR 이 그 경로들에 `TERMINAL_DURATION_MS_SQL` 로 실제 값을 채우면서 `NOT NULL`
    필터를 통과하는 행이 새로 생기는데, 그 값의 상당수는 "실행 시간"이 아니라 **대기
    시간**(park 는 무기한, 위젯 idle-wait 은 기본 grace 1시간)이다. 두 쿼리 모두
    `status = 'completed'` 필터가 없어(카운트 컬럼만 status 별 FILTER, avg 는 전체
    status 대상) 오래 대기하다 취소된 execution 하나가 평균을 크게 왜곡할 수 있다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:175-190`(`10_34_51`
    W3)에 이미 등재되어 있고 이 PR 범위 밖으로 명시적으로 미룬 상태다. 새로 발견한 것이
    아니라 최종 상태에서도 그대로 유효함을 재확인한 것이다.
  - 제안: 이미 트래커에 있는 대로 후속 PR 에서 집계 쿼리에 `status = 'completed'` 필터
    추가(또는 대기-시간 경로를 구분하는 별도 신호 도입). 재론 불필요.

- **[INFO]** `driveCallStackResume` — 2·3차 라운드가 지적한 "형제 경로 하드닝 미적용"이
  최종 상태에서도 해소된 채로 유지됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2593`
  - 상세: 계산부(`resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs`,
    2576~2577행)·emit부(`resolveTerminalDurationMs(savedExecution)`, 2593행) 모두 헬퍼를
    경유한다. `grep -n "resolveTerminalDurationMs("` 로 재확인한 결과 completed 계열 write
    지점 전부(639, 2413, 2577, 3564, 4294, 4754, 4882, 4943, retry-turn 714/896/949)가
    헬퍼를 거친다 — 자매 미적용 재발 없음.

- **[INFO]** `NodeExecution.durationMs` (노드별 실행시간, 별도 필드) 경로는 이번 PR
  스코프 밖으로 원상 유지 확인
  - 상세: `10_34_51` W2 가 지적한 "정규식이 스코프를 넘어 `NodeExecution` 8곳까지 바꿨다"
    회귀가 되돌려졌는지 재확인했다 — `grep -n "getTime() -"` 결과 `nodeExecution.durationMs`/
    `nodeExec.durationMs` 무가드 뺄셈 8곳(`execution-engine.service.ts:4834,6043,6163,
    6196,6214,6228,6304,7943`)이 원래 형태로 남아 있고 `resolveTerminalDurationMs` 를
    쓰지 않는다. EIA 종결 payload 와 무관한 표면이 오염되지 않았다.

- **[INFO]** `emitCancellationEvent` 시그니처 확장(`durationMs?: number | null` 추가)과
  raw UPDATE 5경로의 `.returning([...])` 확장은 side-effect 관점에서 안전
  - 상세: `private` 메서드이고 5개 호출부(`cancelParkedExecution` 1077행,
    `markWebChatIdleTimeout` 1208행, `markExecutionCancelled` 2858행, `markQueueWaitTimeout`
    2907행, `finalizeCancelledExecution` 4884행) 전부가 이번에 값을 채워 넘긴다(넘기지
    않아도 `opts.durationMs ?? null` 기본값 처리로 안전). `.returning()` 확장은 같은
    트랜잭션/문장 안의 부작용이라 새로운 외부 부작용을 만들지 않는다.
    `chat-channel.dispatcher.ts` 의 3개 캐스팅 타입(534/572/589행)도 `{ durationMs?: number
    | null }` 로 `types.ts` 의 넓어진 계약과 일치한다.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent.durationMs` 타입 widening
  (`number?` → `number | null | undefined`)은 기존 소비자 하위호환
  - 상세: 필드가 `optional` 로 유지되고(`?`), 넓어진 것은 값의 허용 범위(`null` 추가)뿐이라
    기존 파서가 `durationMs` 를 무시하면 그대로 동작한다. 저장소 내부 소비처 중
    `execution.durationMs`/`e.durationMs` 를 읽는 자리(예: `executions.service.ts:852`,
    `explore-tools.service.ts:270/461/481`, `background-runs.service.ts:295`)는 이미 전부
    `?? null` 로 null-safe 하게 읽고 있어 이번 타입 확장으로 새로 깨지는 내부 소비자는
    없다.

- **[INFO]** 신설 순수 함수/상수(`resolveTerminalDurationMs`/`toFiniteNumber`/
  `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM`, `codebase/backend/src/shared/
  utils/terminal-duration.ts`)는 전역 상태·파일시스템·환경 변수·네트워크를 건드리지 않는다.
  모듈 레벨 mutable 변수도 없다.

## 요약

이번 5차(최종) 라운드는 `10_52_08` 이후 프로덕션 코드 변경이 없어(신규 커밋은 테스트
2건 추가뿐), 이전 라운드가 확인한 side-effect 상태가 그대로 유지됨을 재확인하는 데
집중했다. 새로 발견한 CRITICAL/WARNING 은 없다. 남은 WARNING 2건 — (1) retry-turn
재진입 시 `finalizeGuarded` 의 `COALESCE` 로 DB 에는 T1 값이 보존되는데 emit 은 in-memory
T2 값을 실어 DB↔wire 가 갈릴 수 있는 것, (2) 이 PR 이 새로 채우는 `duration_ms`(그 중 다수가
"대기 시간")를 status 필터 없이 평균 내는 대시보드/통계 소비처 3곳이 오염될 수 있는 것 —
은 둘 다 이 PR 자신의 3차 라운드(`10_34_51`)에서 이미 근거와 함께 정본 트래커
(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 등재·유예된 항목이고,
이번 라운드는 그 등재가 현재 소스와 여전히 정확히 대응함을 확인했다 — 신규 차단 사유가
아니다. 그 외 시그니처 확장(`emitCancellationEvent`)·타입 widening(`durationMs?: number |
null`)·raw SQL RETURNING 확장은 전부 optional 필드·private 메서드·트랜잭션 내부 범위로
안전하게 통제되어 있고, 형제 경로 하드닝 누락(`driveCallStackResume`)·스코프 이탈
(`NodeExecution` 8곳)도 재발하지 않았다.

## 위험도

LOW
