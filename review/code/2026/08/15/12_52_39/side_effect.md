STATUS=success

===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (10차 누적 라운드)

## 방법론

프롬프트 번들이 핵심 소스(`execution-engine.service.ts`, `terminal-duration.ts`,
`executions.service.ts` 등)의 diff 를 예산 초과로 생략했다. `git diff origin/main --
codebase/ CHANGELOG.md spec/ plan/`, `git show <commit>`, `Read`/`Grep` 으로 실제 소스를
직접 열어 대조했다. 이 PR 은 오늘 이미 9차례 리뷰·수정을 거쳤고(`09_58_24`~`12_26_36`),
side_effect 관점만도 8차례 누적됐다. 가장 최근 코드 변경(`67ad84a54`, 12:50 — 직전
`12_26_36` 라운드가 남긴 W1/W7/W2/W3 조치)을 diff 로 직접 열어 재검증하는 데 집중하고,
과거 라운드가 WARNING 으로 남긴 항목(대시보드·통계 AVG 오염, 프런트 Duration 컬럼)의
현재 해소 상태를 코드 레벨로 다시 실측했다.

## 발견사항

- **[WARNING]** (계속 진행 중, 신규 아님) 프런트엔드 "Duration" 컬럼이 여전히 취소·타임아웃
  경로의 **대기 시간**을 실행 시간으로 표시한다 — 이번 diff 도 프런트엔드 코드를 건드리지
  않았다
  - 위치(원인, 쓰기 쪽): `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    의 `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/
    `markQueueWaitTimeout`/`finalizeStalledExhausted` — 취소·타임아웃 실행에 `duration_ms` 를
    처음 채운다
  - 위치(읽는 쪽, 미수정): `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:292`,
    `.../executions/[executionId]/page.tsx:379`, `components/editor/run-results/execution-history-panel.tsx:158` —
    전부 `formatDuration(execution.durationMs)` 를 status 구분 없이 그대로 렌더
  - 상세: `git diff origin/main --stat -- codebase/frontend` 는 `run-results.mdx`/`.en.mdx`
    두 문서 파일만 보여준다(재확인). 즉 이번 PR 은 REST 응답이 이제 취소·타임아웃 실행에도
    `duration_ms`(대기 경과)를 채워 넣는데, 그 값을 프런트가 status 무관하게 "소요 시간"으로
    렌더하는 기존 코드는 그대로다. **다만 이 라운드에서 "프런트 status 필터"가 정답이 아님을
    직접 확인했다** — `executions.service.ts:757-813` 의 `stop()` REST 취소도
    `ExecutionStatus.CANCELLED` 를 쓰는데(`stoppable: [RUNNING, PENDING]`), 이 경로의
    `duration_ms` 는 **진짜 실행 시간**이다(RUNNING 상태에서 멈춘 것이므로). 프런트는 직전
    상태를 모르므로 `status === 'cancelled'` 로 필터링하면 이 정상 케이스까지 지워버린다 —
    직전 커밋(`67ad84a54`)의 plan 트래커 갱신이 이 실측을 명시적으로 기록했고, 근본 해법은
    필드 분리(`waitMs` 등)로 별도 등재돼 있다. 즉 이번 라운드는 "새 결함"이 아니라 "왜
    간단한 수정이 오답인지"까지 실측으로 검증된, 의도적으로 유예된 side effect다.
  - 제안: 현재 상태(CHANGELOG 고지 + 유저 가이드 캐비엇 2개국어 + plan 트래커에 "프런트
    Duration 컬럼 4곳" 잔여로 명시)로 충분히 투명하다. 코드 수정 자체는 필드 분리 후속
    PR 로 미루는 것이 합리적 — 이번 라운드에서 추가로 요구할 것 없음.

- **[INFO]** `executions.service.ts` `stop()` 의 `duration_ms` 계산이 헬퍼로 교체되며
  "시계 역행(음수) → DB 에 그대로 쓰기"에서 "시계 역행 → `0`" 으로 지속(persisted) 값의
  동작이 바뀜 — 의도적이고 문서화됨, 회귀 아님
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:790-800`
  - 상세: 종전엔 `startedAt` 이 있으면 `finishedAt.getTime() - startedAtMs` 를 무가드로 DB
    에 썼다(음수 가능, 클램프 없음). 이번 diff 는 `resolveTerminalDurationMs({startedAt,
    finishedAt}) ?? 0` 로 바꿨는데, 그 헬퍼는 음수 span 을 `null` 로 흡수하므로 `?? 0` 를
    거쳐 최종적으로 `0` 이 써진다. `startedAt` 부재 시 `0` 이던 기존 동작은 인라인 주석대로
    보존된다. 순수하게 더 안전한 방향(클램프 부재로 인한 int4 오버플로 방지가 주 목적)이고
    커밋 메시지·인라인 주석에 명시돼 있어 재론할 필요는 없으나, "시계 역행 실행의 stop()
    duration 이 DB 에 어떤 값으로 남는가"가 바뀌는 지점이라 기록해 둔다.
  - 제안: 없음(의도된 변경, 이미 문서화·테스트됨).

- **[INFO]** 4개 종결 완료 경로(`execution-engine.service.ts`)+2개(`retry-turn.service.ts`)에서
  `finishedAt`/`durationMs` 대입이 `if (lastNodeId)` 블록 **밖으로** 이동 — 0-노드 그래프의
  영속 상태가 바뀐다(의도된 버그 수정, 신규 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2406-2412`,
    `:3557-3563`, `:4749-4755`, `:4878-4882`(`finalizeCancelledExecution`) 및
    `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:889-897`
  - 상세: 종전엔 `lastNodeId` 가 falsy(실행된 노드가 0개)면 `outputData` 뿐 아니라
    `finishedAt`/`durationMs` 도 세팅되지 않은 채 COMPLETED 로 영속·emit 됐다. 이번 diff 는
    `outputData` 만 조건부로 두고 `finishedAt`/`durationMs` 는 항상 세팅한다 — 인라인
    주석이 이 변경 이유(`durationMs` 를 payload 에 실으면 조건 밖에서 `undefined` 가 wire
    로 나가는 자리였다)를 명시한다. 이는 실제로 0-노드 그래프 완료 시 **영속되는 DB 값이
    달라지는** side effect 지만, 의도된 버그 수정이고 8차 라운드(`11_29_02`/`11_44_10`)
    까지 반복 검토·유예된 항목(W5 "0-노드 캐너리 부재")이다 — 헬퍼(`resolveTerminalDurationMs`)
    단위 테스트가 `startedAt`/`finishedAt` 부재 시 `null` 반환을 4-fixture 로 고정해 실패
    모드는 덮이지만, 이 정확한 호출 지점(0-노드 completion)을 직접 태우는 통합 테스트는
    이번 diff 에도 없다. 새로 지적할 항목이 아니라 기존 유예 결정 재확인.
  - 제안: 없음(이미 근거와 함께 유예됨).

- **[INFO]** (재확인) 종결 이벤트 wire 계약 확장은 순수 additive, 프런트엔드 WS 핸들러는
  애초에 `durationMs` 를 읽지 않아 영향 없음
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent`/
    `EiaFailedEvent`/`EiaCancelledEvent` `durationMs?: number | null`),
    `chat-channel.dispatcher.ts` 캐스트 3곳, `emitCancellationEvent` private 시그니처
  - 상세: `EiaCompletedEvent` 등 세 타입은 `chat-channel` 모듈 밖에서 재사용되지 않음을
    `grep` 으로 확인(사용처 0건). 프런트엔드 `use-execution-events.ts` 의
    `handleExecutionCompleted`/`handleExecutionFailed`/`handleExecutionCancelled` 세 핸들러를
    직접 읽은 결과 **`durationMs` 를 payload 에서 읽는 코드가 아예 없다** — `completeExecution()`/
    `failExecution()` 호출뿐이다. 따라서 CHANGELOG 의 "기존 파서는 무시하면 된다" 는 주장이
    실측으로도 맞다. (혼동 방지: `execution-store.ts:208` 의 `durationMs?: number` 는
    LLM/tool 호출별 필드로 이번 이벤트와 무관한 별개 개념임을 확인.) `emitExecution` 이
    `payload: unknown` 을 받아 webhook/SSE fan-out 이 타입 없이 그대로 직렬화하는 구조라
    이 경계에서도 컴파일 마찰이 없다(이 자체는 이미 별건으로 등재된 기존 기술부채이며 이번
    PR 이 새로 만든 것이 아니다).
  - 제안: 없음.

- **[INFO]** (재확인) 환경 변수·전역 변수·파일시스템·네트워크 — 신규 side effect 없음
  - 상세: `grep -n "process\.env"` 를 이번 diff 대상 프로덕션 파일 7개(`terminal-duration.ts`,
    `executions.service.ts`, `execution-engine.service.ts`, `retry-turn.service.ts`,
    `chat-channel.dispatcher.ts`, `dashboard.service.ts`, `statistics.service.ts`) 전수에
    돌린 결과, `execution-engine.service.ts` 의 두 히트는 모두 diff 밖(기존 주석,
    `git diff` 로 재확인)이다. 신규 파일 `terminal-duration.ts` 는 `const`/`function` 만
    export 하며 모듈 최상위 mutable 변수가 없다. 새 파일시스템 쓰기·신규 HTTP 호출도 없다.

- **[INFO]** (재확인) 대시보드·통계 AVG 집계의 `status = 'completed'` 필터 추가는 공개
  API 응답값을 바꾸는 side effect 지만 CHANGELOG 고지 + 회귀 테스트로 이미 처리됨
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:96-100`,
    `codebase/backend/src/modules/statistics/statistics.service.ts:95,225`
  - 상세: 이번 라운드에서 `alerts-evaluator.service.ts` 를 재확인한 결과 이미 자체
    `status = 'completed'` 필터를 갖고 있어(우연히 안전) 이번 변경의 영향권 밖임을 재검증.
    두 서비스 모두 회귀 테스트(`dashboard.service.spec.ts`/`statistics.service.spec.ts`)가
    SQL 문자열의 필터 존재를 고정한다.
  - 제안: 없음.

## 요약

이번(10차) 라운드는 신규 side effect 를 만들지 않았다. 가장 최근 코드 변경(`67ad84a54`)은
①테스트 mock 이 프로덕션 체인 메서드 추가를 따라가지 못해 회귀 테스트가 vacuous 해졌던
결함을 고치고(테스트 인프라 수정, 프로덕션 side effect 아님), ②`executions.service.ts`
의 `stop()` REST 경로에 남아 있던 int4 무가드 뺄셈을 공용 헬퍼로 클램프했다(음수 시계
역행 값이 이제 `0` 으로 흡수되는 의도된 동작 변화, 문서화됨). 종결 이벤트 wire 계약
확장(`durationMs?: number | null`)은 프런트엔드가 애초에 그 필드를 읽지 않는다는 사실을
실측으로 확인해 "무해한 additive 변경"이라는 CHANGELOG 의 주장이 검증됐다. 유일하게 아직
열려 있는 cross-module side effect 는 프런트엔드 실행 목록 "Duration" 컬럼이 취소·타임아웃
실행의 대기 시간을 그대로 노출하는 문제인데, 이번 라운드는 "단순 status 필터가 오답"이라는
사실이 실측(REST `stop()` 취소도 CANCELLED 지만 진짜 실행 시간)으로 이미 검증돼 있고, 근본
해법(필드 분리)은 plan 트래커에 등재된 채 CHANGELOG·유저 가이드(KO/EN)로 사용자에게
투명하게 고지된 상태다 — 코드 수정 없이 이 라운드를 통과시키는 것이 합리적이다. 환경
변수·전역 변수·파일시스템·네트워크 호출 축에서는 신규 위험이 없다.

## 위험도

MEDIUM
