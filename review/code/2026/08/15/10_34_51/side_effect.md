# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING] 새로 `duration_ms` 를 쓰기 시작한 5개 취소/실패 경로가, 그 컬럼을 이미 소비하던 대시보드·통계·실행목록의 "평균/개별 실행 시간" 을 조용히 오염시킨다**
  - 위치(쓰기 측, 이번 diff 로 신규 도입 — 실제 파일에서 확인한 줄번호):
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036` (`cancelParkedExecution`, WAITING_FOR_INPUT→CANCELLED, park 취소)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1171` (`markWebChatIdleTimeout`, 위젯 idle 취소 — 기본 grace **1시간**, `webchat-idle-reaper.types.ts:20` `DEFAULT_WEBCHAT_IDLE_REAP_GRACE_MS`)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2828` (`markExecutionCancelled`, rehydration 실패 취소)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2899` (`markQueueWaitTimeout`, 큐 대기 타임아웃 — 기본 **5분**, `execution-limits.ts:73` `DEFAULT_QUEUE_WAIT_TIMEOUT_MS`. 이 경로는 PR 코멘트·spec·CHANGELOG 가 스스로 "실행 시간이 아니라 큐 대기 시간" 이라고 명시한다)
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3352` (`finalizeStalledExhausted`, stalled 소진 FAILED)
  - 위치(읽기 측, 이번 diff 밖 — 기존 코드, `Read`/`Grep` 으로 직접 열어 대조):
    - `codebase/backend/src/modules/dashboard/dashboard.service.ts:96` — `AVG(e.duration_ms) FILTER (WHERE e.started_at >= :sevenDaysAgo AND e.duration_ms IS NOT NULL)` → `avgExecutionTime`(대시보드 요약 API, `dashboard-response.dto.ts:27-29` "평균 실행 시간(ms)"). **status 필터가 없다.**
    - `codebase/backend/src/modules/statistics/statistics.service.ts:95` (`getSummary` → `avgDurationMs`) 와 `:221` (`getTopWorkflows` → `avgDurationMs`) — 둘 다 **status 필터 없이** `AVG(e.duration_ms) FILTER (WHERE e.duration_ms IS NOT NULL)`. 프론트 `codebase/frontend/src/app/(main)/w/[slug]/statistics/page.tsx:347,390-391,958` 이 이 값을 그대로 화면에 렌더한다 — **사용자가 실제로 보는 화면.**
    - `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:292` — 실행 목록 "Duration" 컬럼이 각 행의 `execution.durationMs` 를 `formatDuration()` 으로 그대로 표시한다(취소된 행 포함).
  - 상세: `execution.entity.ts:62-63` 의 `duration_ms` 는 `nullable: true`, 이번 PR 이전에는 위 5개 경로의 `.set()` 에 `durationMs` 자체가 없어 이 5개 전이(park 취소·idle 취소·rehydration 취소·큐 타임아웃·stalled 소진)를 거친 실행 행은 `duration_ms = NULL` 로 영구히 남았다 — 즉 위 세 곳의 `AVG(...) FILTER (WHERE duration_ms IS NOT NULL)` 에서 **자동으로 제외**돼 있었다.
    이번 PR 이 그 5곳 모두에 `durationMs: () => TERMINAL_DURATION_MS_SQL` 를 추가해 이제 값이 채워진다. 그런데 그 값의 의미는 경로마다 다르다 — `markQueueWaitTimeout` 은 PR 스스로 "실행 시간이 아니라 큐 대기 시간" 이라 명시했고(§6 표 정정: `spec/5-system/14-external-interaction-api.md`), `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled` 는 `started_at`(실행 시작)부터 "사용자 응답을 기다리며 park 되어 있던" 시간을 **전부 포함**한 wall-clock 이다 — 워크플로우 엔진이 실제로 일한 시간이 아니라 대부분 "대기" 시간이다. `markWebChatIdleTimeout` 은 기본 grace 가 **1시간**(3,600,000ms)이라, spec 예시의 정상 `avgExecutionTime` 값(`spec/2-navigation/0-dashboard.md:129` `4300`ms)과 비교하면 **단 1건**으로도 7일 평균을 수백~수천 배 끌어올릴 수 있다. 위젯을 쓰는 워크스페이스는 대화가 끝나지 않고 방치되면 이 경로를 상시적으로 타므로, 드문 예외가 아니라 상시 발생하는 케이스다.
    결과적으로 대시보드 `avgExecutionTime`(API 계약엔 있으나 카드 미노출 — `spec/2-navigation/0-dashboard.md:165`), 통계 페이지의 `avgDurationMs`(**화면에 실제로 렌더**), 실행 목록의 개별 행 "Duration" 컬럼(취소된 행에도 큰 숫자가 뜬다) 세 표면이 이 PR 이후로 조용히 "평균/개별 실행 소요 시간" 이 아니라 "실행+대기 시간" 을 섞어 보여주게 된다. 이는 사용자에게 오도된 성능 인식을 줄 수 있는 실질적 회귀이며, 이번 PR 의 의도("종결 이벤트 payload 에 필드 채우기")를 벗어나 기존에 안정적으로 동작하던 다른 기능(대시보드/통계 집계)의 의미론을 깨뜨리는 전형적인 **의도치 않은 부작용**이다. (대조: `alerts-evaluator.service.ts:162-166` 의 `computeAvgDuration` 은 `status = 'completed'` 필터가 있어 이 PR 의 영향을 받지 않는다 — 세 표면 중 이 한 곳만 우연히 안전했다.)
    plan/CHANGELOG/spec diff 전체를 확인했으나 대시보드·통계·실행목록에 미치는 이 영향은 어디에도 언급이 없다(`grep`: "dashboard"·"statistics"·"avgDurationMs"·"평균" 전수 확인, 매칭 없음) — 이번 라운드까지 두 차례의 ai-review(`09_58_24`, `10_18_38`)도 이 축을 다루지 않았다.
  - 제안: 최소한 (1) `TERMINAL_DURATION_MS_SQL` 을 쓰는 5경로 중 "실행 시간이 아닌" 것으로 판정되는 경로(특히 `markQueueWaitTimeout`·`markWebChatIdleTimeout`·`cancelParkedExecution`·`markExecutionCancelled`)의 값을 위 세 집계 쿼리에서 제외하도록 `status`/`error.code` 조건을 추가하거나, (2) 이 값들을 "실행 시간" 과 분리된 별도 필드로 관리(예: 순수 실행시간과 wall-clock 을 분리)하거나, (3) 최소한 이 비대칭을 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에 신규 항목으로 등재해 후속 조치 여부를 명시적으로 결정할 것. 지금처럼 조치도 등재도 없이 머지되면 두 화면(통계 페이지·실행목록)의 수치가 다음 배포부터 바로 왜곡된다.

- **[INFO] (확인 완료, 재발 아님) 직전 두 라운드가 지적한 "헬퍼 미적용 자매 함수" 는 이번 diff 상태 기준 전수 해소돼 있다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
  - 상세: `git diff origin/main` 전체와 `grep -n "getTime()"` 결과를 대조한 결과, 두 파일에서 `finishedAt.getTime() - startedAt.getTime()` 형태의 무가드 계산은 더 이상 남아 있지 않다(남은 `getTime()` 1건은 `execution-engine.service.ts:2958` 의 큐 대기 계측용으로 이 PR 과 무관한 기존 코드). `09_58_24` 라운드 WARNING(4곳 미적용)과 `10_18_38` 라운드 W1(`driveCallStackResume` 누락, 9곳으로 재집계)이 이번 상태에서 모두 반영됐다.
  - 제안: 없음(확인용 기록).

- **[INFO] `emitCancellationEvent` opts 시그니처 확장 — 호출자 전수 갱신, private 메서드라 외부 영향 없음**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1103-1114`(정의) — 호출부 5곳(`grep` 확인: 1077·1208·2858·2907·4884행) 전부 `durationMs` 를 넘긴다(값 없으면 `null`).
  - 제안: 없음.

- **[INFO] 종결 이벤트 payload 에 `durationMs` 필드 신규 추가 — 외부 구독자(webhook 등) 영향은 이미 문서화된 추적 대상**
  - 위치: `codebase/backend/src/modules/chat-channel/types.ts` `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` (`durationMs?: number` → `durationMs?: number | null`), `chat-channel.dispatcher.ts` 세 캐스팅 지점(`531-536`·`569-574`·`586-591` 부근, 원본 diff 게이트 기준).
  - 상세: 필드 추가는 additive(제거·rename 아님)이라 미지 필드를 무시하는 소비자에겐 안전하다. 프론트엔드 `codebase/frontend/src/lib/websocket/use-execution-events.ts` 의 `handleExecutionCompleted`/`handleExecutionFailed` 는 현재 payload 의 `durationMs` 를 아예 읽지 않아(코드 확인) 이번 타입 widening 으로 인한 즉시 런타임 영향은 없다. 외부 webhook 엄격 스키마 구독자 리스크는 `plan/in-progress/eia-terminal-payload.md` 의 "외부 구독자 breaking change" 절이 이미 추적 중.
  - 제안: 없음(추가 조치는 위 대시보드/통계 항목이 더 시급).

- **전역 변수 / 환경 변수 / 파일시스템 / 네트워크 호출**: `.ts` 프로덕션 코드 diff(6개 파일) 안에서 신규 전역 가변 상태·`process.env` 읽기/쓰기·파일 I/O·외부 네트워크 호출은 없다. `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 은 불변 `export const` 문자열 상수다. `plan/*.md`·`review/consistency/**`·`CHANGELOG.md`·`spec/**` 변경은 이 세션의 리뷰/기획 산출물 자체이며 런타임 부작용과 무관하다.

## 요약

이번 PR 의 핵심 목적(종결 이벤트 3종에 `durationMs` 배관)은 헬퍼 적용 범위·타입 nullable·SQL 클램프 등 이전 두 라운드가 지적한 문제를 모두 해소한 상태다. 그러나 이번 라운드에서 새로 발견한 부작용이 하나 있다 — DB 를 로드하지 않는 5개 취소/실패 경로(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout`·`finalizeStalledExhausted`)가 이번에 처음으로 `duration_ms` 컬럼을 채우면서, 그 컬럼을 이미 소비하고 있던 **다른 두 화면**(통계 페이지의 `avgDurationMs`, 실행 목록의 개별 "Duration" 컬럼)과 API 계약(대시보드 `avgExecutionTime`)의 의미론을 조용히 깨뜨린다. 이 5경로 중 다수(특히 idle-timeout 기본 1시간·park 취소·rehydration 취소)의 값은 "실행이 실제로 걸린 시간" 이 아니라 "사용자 응답을 기다리며 대기한 시간" 이라 정상 실행(초 단위)과 자릿수가 다르고, 아무 status 필터 없는 `AVG` 집계·개별 행 표시에 그대로 섞여 들어간다. 이 상호작용은 diff 밖의 기존 파일(`dashboard.service.ts`/`statistics.service.ts`/실행목록 page.tsx)에 있어 이번 PR 의 파일 목록만 보면 드러나지 않고, 실제로 두 차례의 이전 ai-review 라운드도 잡지 못했다. 그 외 시그니처/인터페이스 변경은 전부 additive 하고 호출자 전수 갱신이 확인되며, 전역 변수·환경 변수·파일시스템·의도치 않은 네트워크 호출은 없다.

## 위험도

MEDIUM
