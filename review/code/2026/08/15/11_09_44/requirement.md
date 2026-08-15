# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` (2026-08-15 11:09 세션)

## 방법론 노트

프롬프트 diff 가 크기 제한으로 생략된 두 핵심 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`)은 `Read`/`Bash grep`으로 저장소를 직접 열어 현재 상태를
전수 대조했다. 이 변경 세트는 같은 브랜치 안에서 이미 4라운드(`09_58_24` → `10_18_38` →
`10_34_51` → `10_52_08`, RESOLUTION.md 들이 diff 에 포함됨)의 ai-review + fix 를 거쳤고, 이전
라운드가 지적한 CRITICAL(SQL int4 상한 미클램프)·WARNING(6곳 전수 전환 누락, `driveCallStackResume`
방어 우회, dispatcher 좁은 캐스팅, §6.3 JSON 트레일링 콤마 등)은 전부 이후 커밋에서 해소된 것을
`git log`/현재 소스 대조로 직접 확인했다. 본 라운드는 그 수렴 상태를 재검증하고, 신규 회귀나
누락된 요구사항이 있는지에 집중했다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 실측으로 확인한 사항(INFO)만 기록한다.

- **[INFO]** 종결 emit 16 경로(completed 6 + failed 4 + cancelled 6) 전수가 실제로 `durationMs`
  를 싣는지 카운트로 검증 — 선언된 수와 일치
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` /
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 상세: `grep -n "ExecutionEventType.EXECUTION_COMPLETED"` 6곳, `EXECUTION_FAILED` 4곳(그중
    `failFirstSegmentSetup` 포함), `emitCancellationEvent(`/직접 `EXECUTION_CANCELLED` emit 6곳 —
    `plan/in-progress/spec-draft-eia-notification-payload-contract.md:187-189`("completed 6곳 +
    failed 4곳 + cancelled 6곳")·`terminal-duration.ts` JSDoc("종결 emit 은 16 경로")과 정확히
    일치한다. 모든 emit 호출부가 `durationMs:` 키를 조건 없이 명시(`?? null` 로 항상 채움)하므로
    CHANGELOG 의 "키는 항상 존재한다" 주장도 코드로 확인된다.
  - 제안: 없음 (확인 목적).

- **[INFO]** `driveCallStackResume`(중첩 재개 top-level 완료 경로)가 형제 5경로와 동일하게
  `resolveTerminalDurationMs` 헬퍼를 거치는지 재확인 — 정상
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2578`(계산부),
    `:2593`(emit부)
  - 상세: 직전 라운드(`10_18_38` side_effect.md)가 이 경로만 무가드 뺄셈으로 남아 시계 역행 시
    음수 `durationMs` 가 그대로 wire 로 나갈 수 있다고 지적했고, 같은 세션의 RESOLUTION W1 이 9곳
    전환(`driveCallStackResume` 포함)으로 해소했다고 기록했다. 현재 소스를 직접 읽어 계산부·emit부
    둘 다 `resolveTerminalDurationMs(savedExecution)` 를 거치는 것을 확인했다 — 지적이 유효했고
    실제로 해소됐다.
  - 제안: 없음.

- **[INFO]** `NodeExecution.durationMs` 8곳(워크플로 에디터 노드별 실행시간 표시용, EIA 종결
  payload 와 무관)은 이 PR 스코프 밖으로 온전히 되돌려져 있음을 확인
  - 위치: `execution-engine.service.ts:4833-4834, 6042-6044, 6162-6164, 6195-6197, 6213-6215,
    6227-6229, 6303-6304` — 전부 원본 무가드 뺄셈(`nodeExecution.finishedAt.getTime() -
    nodeExecution.startedAt.getTime()`) 그대로.
  - 상세: `10_34_51` RESOLUTION W2 가 "정규식이 스코프를 조용히 넓혀 `NodeExecution` 8곳까지
    바꿨다 — 전량 되돌렸다" 고 기록했는데, 실측 결과 정확히 그 상태(헬퍼 미적용, 원본 계산)로
    남아 있다. `Execution`(종결 3종) 스코프만 헬퍼로 전환됐다는 이 PR 의 의도된 경계가 코드에
    정확히 반영돼 있다.
  - 제안: 없음.

- **[INFO]** 알려진 갭 2건은 spec/plan 트래커에 근거와 함께 등재돼 있고 신규 회귀가 아님을 확인
  - `retry-turn` 재진입 시 DB(`stop()` 커밋 T1)와 emit(재진입 시점 T2) 값 불일치 —
    `spec/5-system/14-external-interaction-api.md:810-814`("알려진 예외 1건")과
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204` 양쪽에 동일 근거로 명시.
  - REST `GET /api/external/executions/:id` 에 `durationMs` 부재(push 계열만 채움) —
    CHANGELOG.md:20-21 고지 + `spec-sync-external-interaction-api-gaps.md:220` 등재.
  - 둘 다 코드 결함이 아니라 **의도적으로 이번 PR 범위 밖에 둔** 갭이며, 문서화·트래킹이
    실측과 일치한다. 새로 생긴 요구사항 위반이 아니다.

- **[INFO]** `chat-channel.dispatcher.ts` 세 종결 이벤트 캐스팅이 이번 diff 로 `types.ts` 의
  `durationMs?: number | null` 확장과 일치하도록 정정됐음을 확인
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534-535,
    572-573, 589-590`
  - 상세: `10_18_38` side_effect.md 가 "타입은 넓혔는데 dispatcher 캐스팅은 좁은 `{durationMs?:
    number}` 그대로" 라고 지적했던 것이 이번 diff(파일 3)에서 세 곳 모두
    `{ durationMs?: number | null }` 로 정정돼 있다. `dispatcher.spec.ts`(파일 2) 신규 테스트가
    숫자/`null`/키부재(레거시) 세 상태를 각각 고정한다.
  - 제안: 없음.

- **[INFO]** `tsc --noEmit` 실측 — 타입 에러 199건, RESOLUTION 이 주장한 "래칫 동일" 수치와
  정확히 일치. `durationMs`/`terminal-duration`/`chat-channel` 관련 신규 타입 에러 0건.

## 요약

이 PR 은 종결 이벤트(`execution.completed`/`failed`/`cancelled`) 16개 emit 경로 전부에
`durationMs`(밀리초, 알 수 없으면 `null`)를 싣는 기능을 완전하게 구현했다. 엔티티를 로드하지
않는 5개 raw UPDATE 경로는 `TERMINAL_DURATION_MS_SQL` 로 DB 안에서 계산 후 `RETURNING` 으로
같은 값을 되받아 DB/wire 값 불일치를 구조적으로 차단하며, `LEAST(2147483647, …)` int4 클램프와
`GREATEST(0,…)`→`THEN NULL` 로의 sentinel 통일(음수=시계역행→`null`)이 SQL·JS 양쪽에 대칭으로
적용돼 있다. `resolveTerminalDurationMs`/`toFiniteNumber` 헬퍼는 `startedAt` 부재·Invalid
Date·문자열(pg bigint/numeric)·NaN/Infinity·시계 역행 등 엣지 케이스를 25개 단위 테스트로 고정하며,
throw 대신 `null` 로 흡수해 "계산 실패가 종결 emit 자체를 삼킨다"는 이 PR 이 실제로 겪은 회귀
클래스를 재발하지 않도록 설계돼 있다. `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`
타입의 `durationMs?: number | null` 확장은 producer(항상 키 존재)와 consumer(레거시 재생
이벤트는 키 부재 가능) 계약을 의도적으로 분리한 근거가 타입 옆 주석에 명시돼 있고, 실제
소비자(`chat-channel.dispatcher.ts`)의 캐스팅도 이번 diff 로 그 계약과 일치하도록 정정됐다.
spec(`5-system/14-external-interaction-api.md` §6/§6.5)과 plan 트래커의 서술(경로 수·큐 대기
시간 의미론·known exception)을 코드와 line-level 로 대조한 결과 전부 일치했다. 남은 두 갭
(retry-turn 재진입 시 DB/emit 값 어긋남, REST 상태 조회의 `durationMs` 비대칭)은 코드 결함이
아니라 이 PR 이 의도적으로 범위 밖에 두고 spec·트래커에 근거와 함께 등재한 항목이며, 신규
요구사항 위반으로 볼 근거가 없다. TODO/FIXME/HACK/XXX 주석 없음, `tsc --noEmit` 199건(래칫
동일, 신규 타입 에러 0건)으로 실측 확인했다.

## 위험도

NONE
