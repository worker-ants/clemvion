STATUS=success

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (8차 누적 라운드)

## 방법론

프롬프트 번들이 핵심 소스(`execution-engine.service.ts`/`retry-turn.service.ts`/
`terminal-duration.ts`)의 diff 를 예산 초과로 생략했다. `git diff origin/main` 으로 전문을
직접 열어 대조했고, 새로 채워지는 `duration_ms` 컬럼을 **읽는** 쪽(대시보드·통계 모듈)까지
따라가 실제로 영향이 있는지 코드로 확인했다(`grep`/`Read`).

## 발견사항

- **[WARNING]** 이번 PR 이 5경로에서 새로 채우는 `duration_ms` 값이, 이미 존재하는 두 모듈의
  status-무관 AVG 집계를 오염시킨다 — 코드로 재확인, 이 diff 에서 미수정
  - 위치(쓰기 쪽, 신규): `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `cancelParkedExecution`(1023) · `markWebChatIdleTimeout`(1152) ·
    `markExecutionCancelled`(2810) · `markQueueWaitTimeout`(2886) ·
    `finalizeStalledExhausted`(3334) — 전부 `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })`
    를 새로 추가해, 이전에는 `NULL` 로 남던 `duration_ms` 컬럼을 이제 채운다.
  - 위치(읽는 쪽, 이 PR 밖 기존 코드 — 영향 확인용): `codebase/backend/src/modules/dashboard/dashboard.service.ts:131-132`
    (`avgExecutionTime`, `execAgg.avg7d` — 대시보드 요약), `codebase/backend/src/modules/statistics/statistics.service.ts:95`
    (`getSummary` 의 `avgDurationMs`), `:221`(Top workflows `avgDurationMs`, **프론트 렌더**).
    두 쿼리 모두 `WHERE e.duration_ms IS NOT NULL` 만 걸고 `status` 필터가 없다(직접 `Read` 로
    확인 — `statistics.service.ts:97-99` 의 `WHERE` 절엔 workspace/date/workflowId 만 있음).
  - 상세: park 취소(대기 무기한) · 위젯 idle-wait 회수(grace 1시간) · 재개 실패 취소 ·
    큐 대기 타임아웃 · stalled 소진 — 이 5경로가 계산하는 "durationMs" 는 **실제 실행 시간이
    아니라 대기/타임아웃 경과 시간**이다. PR 이전엔 이 경로들이 `duration_ms` 를 아예 안 건드려
    `IS NOT NULL` 필터가 이 행들을 자동으로 걸러냈다. 이번 diff 로 그 컬럼이 채워지면서, 사용자에게
    노출되는 평균 실행 시간(대시보드 요약·통계 요약·Top workflows)이 조용히 대기시간과 뒤섞인다 —
    이 changeset 이 만든 코드는 한 줄도 건드리지 않은 두 모듈(대시보드·통계)의 표시값이 바뀌는
    **모듈 경계를 넘는 의도치 않은 상태 변화**다.
  - 이미 내부적으로 실측·등재돼 있음: `plan/in-progress/spec-sync-external-interaction-api-gaps.md:177-191`
    ("`duration_ms` 에 대기 시간이 섞여 집계를 오염시킨다", `10_34_51` W3). CHANGELOG 나 이 PR
    범위에서는 **미수정**이며 별도 트래커 항목으로만 남아 있다 — 즉 이 side-effect 는 "발견되지 않은
    새 결함"은 아니지만, 현재 diff 시점 기준으로 **여전히 살아있는 부작용**이다. 리뷰 관점 1(의도치
    않은 상태 변경)에 정확히 해당해 독립적으로 재확인해 기재한다.
  - 제안: 이미 등재된 트래커대로 두 집계 쿼리에 `status = 'completed'`(또는 `error.code`
    기반 제외) 필터를 추가하는 후속 작업을 이 PR 병합 전 또는 직후 우선순위로 처리 권장. 최소한
    CHANGELOG 의 "수신자 영향" 절에 이 다운스트림 오염도 명시적으로 언급하는 편이 좋다(현재
    CHANGELOG 는 wire 소비자에 대한 null 방어만 언급하고, 내부 집계 오염은 별도 plan 문서에만
    있다).

- **[INFO]** `markQueueWaitTimeout` 은 같은 wire 필드 `durationMs` 에 다른 의미(실행 시간이 아니라
  **큐 대기 시간**)를 싣는다 — 계약이 소스에 명시돼 있지만 수신자는 구분할 표지가 없다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2886` 부근
    주석("이 경로의 `durationMs` 는 **큐 대기 시간**이다") 및
    `codebase/backend/src/shared/utils/terminal-duration.ts` JSDoc.
  - 상세: CHANGELOG·spec §6.5 에 문서화돼 있고 EIA 계약상 "종결까지의 경과"로 일관되긴 하지만,
    수신 측(webhook/SSE/WS 구독자)이 `error.code === 'EXECUTION_QUEUE_WAIT_TIMEOUT'` 을 직접
    검사하지 않는 한 이 값을 실제 실행 시간으로 오인할 수 있다. 위 WARNING 과 같은 근본 원인의
    다른 표면(내부 집계 대신 외부 수신자가 오인하는 경우)이다.
  - 제안: 이미 CHANGELOG/spec 에 캐비엇으로 명시됐으므로 강제 조치는 아님 — 기록 목적.

- **[INFO]** `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent.durationMs` 타입이
  `number | undefined` → `number | null | undefined` 로 넓어짐 — 외부(webhook/SSE/WS) wire
  계약에 신규 필드가 추가되는 변경
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent` L392 부근,
    `EiaFailedEvent` L415 부근, `EiaCancelledEvent` L433 부근 — 세 곳 동형).
  - 상세: 순수 추가(필드 제거·이름 변경 없음)이며 CHANGELOG 가 "수신자 영향: 기존 파서는 무시하면
    되고, 값을 읽을 때 `null` 을 방어해야 한다"고 명시적으로 고지했다. `chat-channel.dispatcher.ts`
    3곳(completed/failed/cancelled)의 캐스팅도 `{ durationMs?: number }` → `{ durationMs?: number | null }`
    로 함께 정정돼 있어 내부 일관성은 확인됨. REST `GET /api/external/executions/:id` 에는 아직
    반영되지 않아 push(webhook/SSE/WS)와 재조회 응답 사이에 비대칭이 생기는 점도 CHANGELOG 가
    이미 고지·트래커 등재했다(§리뷰 관점 5, 인터페이스 변경 — 문서화된 breaking 아닌 additive 변경).
  - 제안: 없음 — 이미 적절히 문서화·전파됨.

- **[INFO]** `execution-engine.service.ts` 의 4개 completed 경로(및 `retry-turn.service.ts` 1곳)에서
  `finishedAt`/`durationMs` 계산이 `if (lastNodeId) { ... }` 블록 **밖**으로 이동 — `lastNodeId`
  가 없는 실행(0-노드 그래프 등)에서도 이제 무조건 `finishedAt`/`durationMs` 를 엔티티에 대입한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 상 4곳
    (diff 상 `savedExecution.outputData = ...` 직후, 예: 완료 처리 함수들), `retry-turn.service.ts`
    889-896 부근(`completeRetryExecution`/`failFirstSegmentSetup` 계열).
  - 상세: 코드 주석 자체가 "종전엔 셋 다 `if` 안에 있어서, 노드가 없는 그래프면
    `finishedAt`/`durationMs` 가 비어 있는 채로 emit 됐다"고 밝혀 **의도된 동작 변경**임을
    명시한다. 다만 `lastNodeId` 가 없는 완료 경로를 직접 태우는 e2e/unit 캐너리는 없다 —
    직전 라운드(`11_44_10`)가 "0-node 캐너리 부재"를 W5 로 넘기며 "헬퍼 spec 이 실패 모드
    자체는 덮는다"는 근거로 보류한 상태이고, 이번 diff 에도 신규 캐너리는 추가되지 않았다.
    상태 변경 자체는 의도적이고 문서화돼 있어 CRITICAL 로 보지 않으나, 새 무조건 대입이
    이 경로의 다른 필드(예: `outputData` 가 갱신 안 된 채 `finishedAt`/`durationMs` 만
    갱신되는 조합)에 연쇄하는지 직접 실행 경로 테스트는 여전히 없다.
  - 제안: 이미 리뷰 이력에서 근거와 함께 보류된 항목 — 강제 조치는 아니나, 후속 라운드에서
    0-노드/`lastNodeId` 부재 완료 경로의 e2e 캐너리 1건을 우선순위로 남겨 둘 것을 재확인 차원에서
    기재.

- **[INFO]** 시그니처 변경: private 메서드 `emitCancellationEvent` 의 `opts` 파라미터에
  `durationMs?: number | null` 추가 — 호출자 영향 없음(확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1101` 부근
    선언, 호출부 5곳(1077, 1210, 2860, 2909, 4886 — `grep -c` 로 실측 일치).
  - 상세: `private` 스코프이고 옵션 필드라 추가만 이뤄졌으며, 같은 커밋에서 5개 호출부 전부
    갱신됐다(누락 없음 확인). 외부 공개 API 가 아니므로 하위 호환성 문제 없음.
  - 제안: 없음.

- **[INFO]** 신규 raw UPDATE 5곳에 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)` +
  `.returning(['id', 'duration_ms'])` 추가 — DB 부작용은 있으나 트랜잭션/WHERE 가드는 불변
  - 상세: 동시성 리뷰(`11_29_02/concurrency.md`)가 이미 확인한 대로 WHERE 조건부 UPDATE +
    `affected` 체크 패턴은 그대로 유지되고, `RETURNING` 은 같은 문장 안에서 값을 되받을 뿐
    추가 왕복(SELECT)을 만들지 않는다. `duration_ms` 컬럼에 새로 쓰기가 생긴다는 사실 자체는
    위 WARNING 의 원인이지만, 원자성·격리 수준 자체에는 부작용이 없다.
  - 제안: 없음(위 WARNING 참조).

- **[INFO]** 환경 변수·네트워크 호출: 이번 diff 범위(`terminal-duration.ts`,
  `execution-engine.service.ts`, `retry-turn.service.ts`, `chat-channel.dispatcher.ts`,
  `chat-channel/types.ts`)에 신규 `process.env` 읽기/쓰기나 외부 HTTP 호출이 없음을 `grep`
  으로 확인.

## 요약

이번 changeset 은 종결 이벤트 3종에 `durationMs` 를 채우는 배관 작업으로, 원자성·트랜잭션
경계·인가 경로 등 핵심 불변식은 건드리지 않았고 타입 확장(`| null`)·시그니처 확장(옵션
필드)도 하위 호환적으로 처리됐다. 다만 5경로에서 새로 채우는 `duration_ms` 값이 **이 PR
밖의 두 모듈**(대시보드 `avgExecutionTime`, 통계 `avgDurationMs` — status 필터 없는 AVG
쿼리)의 표시값을 조용히 오염시키는 실제 크로스-모듈 부작용이 확인된다. 이미 내부 트래커
(`spec-sync-external-interaction-api-gaps.md`)에 등재돼 있어 "발견되지 않은 결함"은 아니지만,
현재 diff 시점에는 여전히 미해소 상태이므로 WARNING 으로 재확인 기재한다. 나머지(큐 대기
시간의 의미 오버로드, wire 타입 widening, 0-노드 경로 무조건 대입, private 시그니처 확장)는
전부 문서화·검토됐거나 위험이 낮은 INFO 급이다.

## 위험도

MEDIUM
