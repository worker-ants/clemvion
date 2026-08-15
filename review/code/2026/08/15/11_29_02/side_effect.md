STATUS=success

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (6차 라운드, `11_09_44` 이후)

## 방법론 노트

이 PR 은 이미 5차례 리뷰 라운드(`09_58_24`→`10_18_38`→`10_34_51`→`10_52_08`→`11_09_44`)를
거쳤다. `11_09_44` 가 지적한 CRITICAL("JS 클램프 누락 — SQL 경로만 int4 상한을 막았다")에
대한 fix 커밋(`2c9b490fd`)이 이번 라운드가 보는 diff 의 핵심이다. 프롬프트에서 diff 가
생략된 대형 파일(`execution-engine.service.ts` 등)은 `Read`/`grep` 으로 직접 열어 대조했고,
`git log`/`git show 2c9b490fd` 로 이번 라운드가 실제로 검토해야 할 신규 변경 범위를 확정했다.

## 발견사항

- **[INFO]** CRITICAL 재확인 — JS/SQL 두 경로가 이제 단일 상수(`PG_INT4_MAX`)를 공유해
  클램프가 동기화됐다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:34`(`export const
    PG_INT4_MAX = 2147483647`), `:55`(`resolveTerminalDurationMs` 의
    `Math.min(span, PG_INT4_MAX)`), `:103`(`TERMINAL_DURATION_MS_SQL` 의
    `` `ELSE LEAST(${PG_INT4_MAX}, …)` ``)
  - 상세: `11_09_44` architecture/`11_29_02` 이전 라운드가 잡은 CRITICAL(SQL 경로만
    `LEAST(2147483647, …)` 로 상한을 막고 JS 경로 `resolveTerminalDurationMs` 는 무제한
    뺄셈이라, 24.8일 넘게 대기한 실행이 JS 계산 경로를 타면 여전히 `integer out of range`
    로 영구 고착될 수 있었던 결함)가 두 경로가 리터럴을 각자 들고 있던 원인을 제거하는
    방식(단일 export + 문자열 보간)으로 해소됐다. 실측: `grep -n "PG_INT4_MAX"` 결과
    정의 1곳 + JS 클램프 1곳 + SQL 보간 1곳, 총 3개소 전부 같은 심볼을 참조 — 두 숫자가
    다시 갈릴 표면이 없다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 가 두 클램프 값을 각각 assert 하는
    한 회귀는 걸린다.

- **[INFO]** `driveCallStackResume` 완료 경로 — 형제 5경로와의 방어 불일치(2·3차 라운드
  WARNING)가 최종 상태에서 계속 해소돼 있음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2578-2579`
    (계산부), `:2595`(emit부)
  - 상세: `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ??
    savedExecution.durationMs;` 로 계산부가 헬퍼를 거친다 — `10_18_38` 라운드가 지적했던
    "이 경로만 무가드 뺄셈이라 시계 역행/오버플로 방어를 우회한다"는 결함이 이번 diff
    이전 커밋에서 이미 고쳐진 채 유지된다. `grep -n "resolveTerminalDurationMs("` 전수
    확인 결과 Execution-레벨 write 지점 9곳
    (`execution-engine.service.ts:639,2414,2578,3565,4295,4755,4883,4944` +
    `retry-turn.service.ts:713,895,948`) 전부 헬퍼 경유로 통일돼 있다.
  - 제안: 없음.

- **[INFO]** `NodeExecution.durationMs`(노드별 실행시간, EIA 종결 payload 와 무관한 별도
  필드) 경로는 이번 PR 스코프 밖으로 원상 유지 — int4 오버플로 표면도 재확인 결과 실재하지
  않음
  - 위치: `execution-engine.service.ts:4835-4836`(`markNodeCancelled`),
    `:6044-6046`·`:6164-6166`·`:6197-6199`·`:6215-6217`·`:6229-6231`·`:6305-6307`
    (`executeNode` 내부 완료 분기)
  - 상세: `10_34_51` W2 가 지적한 "정규식이 스코프를 넘어 `NodeExecution` 8곳까지 바꿨다"
    회귀가 되돌려진 채 무가드 뺄셈으로 남아 있다(EIA payload 와 무관하므로 정상). 이번
    라운드에서 별도로 확인한 것은 — park 취소 경로(`cancelParkedExecution`,
    `markWebChatIdleTimeout`, `finalizeStalledExhausted`)의 동반 `NodeExecution` raw
    UPDATE(`:1058-1069`, `:1192-1203`, `:3374-3389`)는 애초에 `duration_ms` 컬럼을
    `.set()` 하지 않는다(status/finishedAt 만) — 즉 "오래 대기한 NodeExecution 이
    무가드 계산으로 int4 오버플로를 낼 수 있는가" 가설을 세워 조사했으나, 그 경로들은
    애초에 계산 자체를 하지 않아(NULL 로 남김) 해당 결함이 없다. `markNodeCancelled` 의
    실제 호출부(`executeNode` catch, `ai-turn-orchestrator.service.ts` 의
    `assertLinkedTransitionApplied`) 도 전부 "활성 실행 중 취소"(짧은 startedAt~now 구간)
    시나리오라 24.8일 대기 시나리오에 도달하지 않는다.
  - 제안: 없음(조사 결과 새 리스크 아님, 기록 목적).

- **[INFO]** `terminal-duration.ts` 상단 JSDoc 블록이 `resolveTerminalDurationMs` 로부터
  분리됨(이번 CRITICAL fix 편집이 만든 부산물)
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:1-27`(원래
    `resolveTerminalDurationMs` 용 docstring, `@returns` 포함), `:28-33`(신규
    `PG_INT4_MAX` docstring), `:34`(`export const PG_INT4_MAX`), `:36`(`export function
    resolveTerminalDurationMs`)
  - 상세: 함수 시그니처 순서상 `PG_INT4_MAX` docstring+const 선언이 원래
    `resolveTerminalDurationMs` 설명 블록과 함수 사이에 끼어들었다. TSDoc/IDE
    hover 는 "바로 앞의 comment 블록"을 해당 심볼에 매핑하므로, 1~27행 블록은
    이제 어떤 심볼에도 붙지 않는 dangling comment 가 되고(바로 다음이 또 다른
    comment 블록), `resolveTerminalDurationMs` 자체는 hover 시 문서가 뜨지 않는다
    (바로 앞 줄이 `export const PG_INT4_MAX = 2147483647;` 뒤 빈 줄이라 comment
    가 없음). 런타임 동작에는 영향 없고 순수 문서 표시 문제다.
  - 제안: `PG_INT4_MAX` 의 docstring+선언을 파일 하단(다른 export 근처) 또는
    `resolveTerminalDurationMs` 함수 정의 뒤로 옮겨, 원래 docstring 이 함수 바로
    위에 남도록 정정. 이 PR 의 side-effect 관점에서 차단 사유는 아니다(문서화
    리뷰어 영역과 겹침 — 참고용으로 남긴다).

- **[WARNING]** (기존 등재, 신규 아님 — 최종 상태 재확인) retry-turn 재진입 시 DB 에
  영속된 `durationMs` 와 emit 값이 갈릴 수 있다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    함수 `failRetryExecution` 947-949행(계산부, in-memory), 968-971행(emit,
    `resolveTerminalDurationMs(execution)`) — DB 쪽 `COALESCE(duration_ms, …)`
    보존은 `finalizeGuarded`(별도 함수, 이 diff 밖)
  - 상세: `stop()` 이 이미 DB 에 커밋한 T1 값을 `finalizeGuarded` 의 CANCELLED
    분기가 `COALESCE` 로 보존하는데, in-memory `execution.durationMs` 는 갱신되지
    않아 그 뒤 자연 실패로 도달한 `failRetryExecution` 의 emit 은 재진입 시점
    T2(더 큰 값)를 wire 로 내보낸다. "retry-turn 처리 중 Stop" 이라는 일반 흐름에서
    결정적으로 재현되며, 희귀 레이스가 아니다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-216`
    (`10_34_51` W1, `11_09_44` 재확인)에 근거와 함께 등재돼 있고 이 PR 은 새 회귀를
    만든 것이 아니라(재진입 로직 자체는 선행 PR) 이번에 `durationMs` 를 emit payload
    에 처음 싣기 시작하면서 **이 기존 불일치를 처음으로 wire 에 노출**시켰다.
  - 제안: 트래커에 이미 명시된 처방(`CANCELLED` 분기에 `.returning(['duration_ms'])`
    추가해 persist 값을 되읽어 emit) 대로 후속 PR 에서 처리. 이번 라운드에서 새 조치
    요구 아님 — 상태 재확인 목적으로만 기재.

- **[WARNING]** (기존 등재, 신규 아님 — 최종 상태 재확인) 이 PR 이 새로 채우는
  `duration_ms` 가 status 필터 없는 평균 집계 3곳을 오염시킬 수 있다
  - 위치: 이 PR 의 diff 밖 — `codebase/backend/src/modules/dashboard/dashboard.service.ts`,
    `codebase/backend/src/modules/statistics/statistics.service.ts`
    (`AVG(e.duration_ms)` 계열, `status='completed'` 필터 없음)
  - 상세: park 취소·공개 위젯 idle-wait 취소·재개 실패 취소·큐 대기 타임아웃 취소 5경로가
    이 PR 이전엔 `duration_ms` 를 전혀 안 써 `NULL` 로 남았는데, 이제 값이 채워지면서
    "대기 시간"(실행 시간 아님)이 평균에 섞여 들어갈 수 있다.
  - 상태: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(`10_34_51` W3,
    `11_09_44` 재확인)에 이미 등재, PR 범위 밖으로 명시적으로 미룸.
  - 제안: 트래커대로 후속 PR 에서 집계 쿼리에 `status='completed'` 필터 추가. 재론 불필요.

- **[INFO]** `types.ts` nullable widening(`durationMs?: number` → `number | null`) +
  `chat-channel.dispatcher.ts` 캐스트 타입 확장은 side-effect 관점에서 안전
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts:397,420,438`,
    `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534,572,589`
  - 상세: 필드는 계속 optional(`?`)이고 허용값만 넓어져 기존 파서(필드 무시)는 그대로
    동작한다. dispatcher 의 3개 캐스트가 전부 `{ durationMs?: number | null }` 로
    `types.ts` 와 일치해, 이전 라운드(`10_18_38` W8)가 지적한 좁은 캐스트 불일치도
    남아 있지 않다. `EiaFailedEvent`/`EiaCompletedEvent`/`EiaCancelledEvent` 를 저장소
    내부에서 소비하는 유일한 자리(`execution-failure-classifier.ts`)는 `durationMs` 를
    읽지 않는다.
  - 제안: 없음.

- **[INFO]** `emitCancellationEvent` 시그니처 확장 및 raw UPDATE 5경로의
  `.returning([...])` 확장은 안전 (기존 라운드 재확인)
  - 상세: `private` 메서드이고 실제 호출부 5곳(`cancelParkedExecution:1077`,
    `markWebChatIdleTimeout:1210`, `markExecutionCancelled:2860`,
    `markQueueWaitTimeout:2909`, `finalizeCancelledExecution:4886`) 전부 값을 채워
    넘긴다. JSDoc 이 "호출부 4곳" 이라 적었지만(`:1107`) 실측은 5곳 — 문서 숫자 오류일
    뿐 기능에는 영향 없다(전부 안전하게 값을 넘김). `.returning()` 확장은 같은
    트랜잭션/문장 내부 부작용이라 새 외부 부작용 없음.

## 요약

이번 라운드의 핵심 신규 변경(`2c9b490fd`)은 직전 라운드(`11_09_44`)가 잡은 CRITICAL —
"int4 클램프를 SQL 경로에만 세우고 JS 경로엔 안 세웠다" — 를 두 경로가 단일 상수
(`PG_INT4_MAX`)를 공유하도록 고친 것이다. 실측 결과 이 fix 는 완전하고, 두 숫자가 다시
갈릴 표면이 없다. `driveCallStackResume` 형제 경로 하드닝, `NodeExecution` 스코프 격리,
`emitCancellationEvent`/타입 widening 안전성 등 이전 5개 라운드가 확인한 항목들도 최종
상태에서 그대로 유지됨을 재확인했다. 새로 조사한 "park 대기 NodeExecution 도 int4
오버플로 위험이 있는가" 가설은 실측으로 기각했다(해당 raw UPDATE 들이 애초에
`duration_ms` 를 계산하지 않음). 유일한 신규 관찰은 이번 fix 편집이 `terminal-duration.ts`
상단 JSDoc 을 `resolveTerminalDurationMs` 로부터 분리시킨 문서 표시 문제(INFO, 런타임
무관)다. 이미 트래커에 등재된 WARNING 2건(retry-turn 재진입 DB/emit 불일치, 대시보드
평균 집계 오염)은 이 PR 이 새로 만든 회귀가 아니라 이번에 `durationMs` 를 emit 하기
시작하면서 처음 wire 에 노출된 기존 결함이며, 명시적 근거와 함께 후속 트래커에 유예돼
있어 이번 라운드의 신규 차단 사유가 아니다.

## 위험도

LOW
