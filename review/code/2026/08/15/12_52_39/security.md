STATUS=success

===REPORT_MARKDOWN_BELOW===
# 보안(Security) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (5차 라운드 · `12_52_39`)

## 리뷰 범위 및 방법

프롬프트 번들에서 실 소스가 생략된(크기 제한) 파일은 `Read`/`git diff origin/main --`로 직접 열어 대조했다:
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts`,
`codebase/backend/src/shared/utils/terminal-duration.ts`,
`codebase/backend/src/modules/execution-engine/retry-turn.service.ts`,
`codebase/backend/src/modules/executions/executions.service.ts`,
`codebase/backend/src/modules/dashboard/dashboard.service.ts`,
`codebase/backend/src/modules/statistics/statistics.service.ts`.
그 외 시크릿 패턴(`api[_-]?key|secret|password|token|bearer|-----BEGIN`)을 `codebase/` 전체 diff 에 grep 했다 — 매치 없음.

이 세션은 이미 4차례(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`) 보안 라운드를 거쳤고, 이번 라운드는 그 위에 누적된 소규모 변경(int4 클램프 헬퍼 적용 확대, `dispatcher.ts`/`types.ts` nullable 타입 정합, CHANGELOG/plan/문서 갱신)이다. 코드 자체를 재대조했다.

## 발견사항

발견된 Critical/Warning 없음. 확인 결과(INFO)만 기록한다.

- **[INFO]** raw SQL 상수 삽입 구간(`.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })`)이 여전히 파라미터 바인딩만 사용 — 인젝션 표면 없음
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:102-105` (상수 정의) — 사용처 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted` (각 `.set({..., durationMs: () => TERMINAL_DURATION_MS_SQL})` + `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)`)
  - 상세: `TERMINAL_DURATION_MS_SQL`은 모듈 최상단 상수 문자열(`PG_INT4_MAX` 리터럴이 `${...}` 로 baked-in — 사용자 입력 아님)이고, 식 안의 유일한 가변 요소 `:terminalFinishedAt` 은 5곳 전부 서버가 생성한 `Date` 객체(`new Date()`)를 `.setParameter()` 로 바인딩한다. 문자열 결합(concatenation)이 전혀 없다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 `:id`/`:waiting`/`:pending`/`:running` 파라미터 바인딩을 유지한다.
  - 제안: 없음(현행 유지). `terminal-duration.spec.ts` 가 플레이스홀더 이름 drift 를 정적으로 잡아준다.

- **[INFO]** `executions.service.ts` `stop()` 의 신규 int4 클램프도 동일하게 파라미터 바인딩 경유
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` `stop()` — `resolveTerminalDurationMs({ startedAt, finishedAt }) ?? 0` 을 계산해 `.set({ durationMs })` 로 QueryBuilder 파라미터 객체에 넘긴다(원문 문자열 결합 없음).
  - 상세: 이 라운드에서 추가된 CRITICAL 수정(24.8일 초과 시 `integer out of range` → 취소 실패 → 실행 영구 고착)은 가용성(DoS 유사) 결함의 수정이며, 클램프 로직 자체가 사용자 입력을 신뢰하지 않고 서버 계산값(`Date` 차)만 다룬다. 새로운 인젝션·검증 우회 표면 없음.
  - 제안: 없음.

- **[INFO]** `RETURNING` 원본 값 흡수(`toFiniteNumber`)가 방어적으로 유지됨 — 변경 없음, 재확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:71-78`
  - 상세: pg 드라이버가 `numeric`/`bigint` 을 문자열로 반환하는 경우, `NaN`/`Infinity`/빈 문자열 등을 전부 `null` 로 흡수한다. wire 로 비정상 값이 노출되는 경로가 없다.

- **[INFO]** 집계 쿼리(`dashboard.service.ts`/`statistics.service.ts`)의 `status` 필터 추가는 파라미터 바인딩 또는 하드코딩 리터럴만 사용
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:100` (`e.status = :completedStatus`, `completedStatus: ExecutionStatus.COMPLETED` 로 line 107 에서 바인딩 — 기존 `success7d`/`total7d` 셀렉트가 이미 쓰던 동일 파라미터 재사용), `codebase/backend/src/modules/statistics/statistics.service.ts:97`·`225` (`e.status = 'completed'` — 같은 SELECT 리스트 안 인접 컬럼이 이미 쓰던 하드코딩 리터럴과 동일 패턴)
  - 상세: 두 경로 모두 사용자 입력이 SQL 문자열에 섞이지 않는다. 워크스페이스 격리(`w.workspace_id = :workspaceId`)도 그대로 보존되어 인가 경계에 영향 없음.
  - 제안: 없음.

- **[INFO]** `chat-channel.dispatcher.ts`/`types.ts` 의 `durationMs?: number` → `durationMs?: number | null` 변경은 순수 타입 확장
  - 위치: `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts` (`toChatChannelEvent` 세 분기), `codebase/backend/src/modules/chat-channel/types.ts` (`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)
  - 상세: 외부 채널(웹챗 등)로 나가는 payload 에 `null` 이 추가로 실릴 뿐, 새로운 필드 노출·인증 우회·검증 완화는 없다. 값의 출처는 여전히 서버 내부 계산(`resolveTerminalDurationMs`)이다.
  - 제안: 없음.

- **[INFO]** 에러 메시지·민감정보 노출 없음
  - 상세: 이번 diff 는 실행 소요시간(`durationMs`, 정수 ms 또는 `null`)만 payload/집계에 추가한다. 자격증명, 스택트레이스, 내부 경로 등을 새로 노출하는 지점은 없다.

- **[INFO]** 문서/plan/review 산출물(CHANGELOG.md, `*.mdx`, `plan/in-progress/**`, `review/code/2026/08/15/{09_58_24,10_18_38,10_34_51,10_52_08}/**`)은 코드가 아니며 보안 표면 없음. 시크릿 패턴 grep 결과도 0건.

## 요약

이번(5차) 라운드는 이전 4차례 보안 검토가 이미 NONE 위험도로 판정한 durationMs 배관 작업 위에 소규모 증분(실행 서비스 `stop()` 의 int4 클램프 적용, 채널 어댑터 타입 nullable 정합, 문서/CHANGELOG 갱신)을 얹은 것이다. 소스를 직접 재확인한 결과 raw SQL 삽입은 전부 하드코딩 상수 + 파라미터 바인딩(`setParameter`)이고 문자열 결합이 없어 SQL 인젝션 표면이 없으며, `RETURNING` 값은 방어적으로 파싱되고, 집계 쿼리의 신규 `status` 필터도 파라미터/리터럴만 사용해 워크스페이스 격리를 훼손하지 않는다. 하드코딩된 시크릿, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출 등 다른 항목에서도 새로운 취약점은 발견되지 않았다.

## 위험도

NONE
