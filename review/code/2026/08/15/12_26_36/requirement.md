# 요구사항(Requirement) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (8차 라운드)

## 검토 방법

이 changeset 은 이미 7차례(`09_58_24`~`11_29_02`) ai-review 라운드를 거쳤고, 매 라운드 CRITICAL/WARNING 이
RESOLUTION.md 로 조치돼 있다(int4 오버플로 클램프 JS+SQL 양쪽, 음수 sentinel 통일, 타입 nullable화, mock
threading, AVG 집계 status 필터 2모듈 등). 프롬프트 diff 가 크기 제한으로 다수 파일에서 생략됐으므로, 핵심
소스는 `git diff origin/main`/`Read` 로 직접 전문 대조했다:

- `codebase/backend/src/shared/utils/terminal-duration.ts`(+108, 신규) / `.spec.ts`(+153)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(+152/-36, 전문 대조)
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(+24/-21, 프롬프트에 전문 포함)
- `codebase/backend/src/modules/chat-channel/{types.ts,chat-channel.dispatcher.ts,*.spec.ts}`
- `codebase/backend/src/modules/{dashboard,statistics}/*.service.ts` + spec
- `spec/5-system/14-external-interaction-api.md` §6, `spec/conventions/chat-channel-adapter.md`
- `plan/in-progress/eia-terminal-payload.md`, `spec-draft-eia-notification-payload-contract.md`

이번 라운드는 이미 검증된 부분(→ 6개 완료 경로/4개 실패 경로/6개 취소 경로 = 16 경로 전수, int4·음수
클램프 JS·SQL 대칭, `TERMINAL_DURATION_MS_SQL` 5회 사용 정확 일치, dispatcher 캐스팅 3곳 nullable화,
AVG 집계 `status = 'completed'`/`:completedStatus` 필터 4곳, spec §6 필드 표·예시 JSON·blockquote 정합)을
`grep`/`Read` 로 재실측해 회귀가 없음을 확인했고, **이전 7라운드가 보지 않은 인접 코드**를 추가로
훑어 새 발견 1건을 냈다.

## 발견사항

- **[WARNING]** 이 PR 이 정확히 같은 결함 클래스(int4 오버플로·시계 역행)로 두 번 CRITICAL 을 낸 그
  `duration_ms INTEGER` 컬럼에, **이 PR 이 손대지 않은 자매 write 경로**가 여전히 무가드 뺄셈을 쓴다
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts` — `stop()` 메서드,
    `const durationMs = finishedAt.getTime() - startedAtMs;` (라인 793) → 바로 아래
    `.set({ status: ExecutionStatus.CANCELLED, finishedAt, durationMs })` (라인 796~801)에서
    같은 `duration_ms INTEGER` 컬럼에 파라미터 바인딩으로 그대로 쓴다.
  - 상세: 이 경로는 프론트엔드 "실행 중지" 버튼이 호출하는 REST `stop()` 이며, `execution.status`
    가 `RUNNING`/`PENDING` 일 때만 이 분기를 탄다(`WAITING_FOR_INPUT` 은 별도로
    `executionEngineService.cancelWaitingExecution` → `cancelParkedExecution`/`markWebChatIdleTimeout`
    등 이번 PR 이 클램프를 넣은 경로로 위임되므로 안전하다). `git diff origin/main --stat -- codebase/backend/src/modules/executions/executions.service.ts` 실측 결과 이 파일은 **이번 diff 에 전혀 포함되지 않았다** — 완전히
    손대지 않은 pre-existing 코드다. 그러나 계산식(`finishedAt.getTime() - startedAtMs`)은 이 PR 이
    두 라운드(`09_58_24` CRITICAL, `11_09_44` CRITICAL)에 걸쳐 "JS·SQL 두 경로 모두에 클램프가
    필요하다" 고 확립한 것과 **글자 그대로 같은 형태**이고 상한·음수 가드가 전혀 없다.
    이론상 도달 경로: RUNNING 상태의 실행이 (긴 루프·배경 노드 대기 등으로) 24.8일을 넘겨 실행 중이거나,
    PENDING 상태가 `markQueueWaitTimeout` 이전에 비정상적으로 오래 남아 있는 상태에서 사용자가
    "중지" 를 누르면, 이 `UPDATE` 가 `integer out of range` 로 실패해 실행이 그 상태에 고착될 수
    있다 — 이 PR 의 CHANGELOG 가 명시한 실패 모드("통째로 실패해 그 실행이 영구 고착")와 동일하다.
    발생 확률은 낮지만(이 PR 스스로가 "낮은 확률의 edge case" 였던 것을 CRITICAL 로 취급했다), 같은
    컬럼에 같은 무가드 연산을 쓰는 형제가 diff 밖에 남아 있다는 사실 자체가 이 세션이 반복적으로
    자인한 패턴("형제 함수 미적용")과 일치한다.
  - 관련 spec: `spec/5-system/14-external-interaction-api.md` §6 필드 표는 `durationMs` 를 종결 3종
    payload 필드로만 규정하고, `stop()` REST 응답(`ExecutionDto`)의 `durationMs` 는 EIA 표면이 아니라
    내부 워크플로 에디터 API 라 이 spec 문서의 직접 규율 대상은 아니다 — 그래서 CRITICAL 이 아니라
    WARNING 으로 분류한다(spec 위반이 아니라 동일 DB 불변식의 커버리지 공백).
  - 제안: 이 PR 범위를 넓히기보다, `resolveTerminalDurationMs`(이미 `startedAt`/`finishedAt` 만으로
    계산 가능한 형태로 일반화돼 있다)를 `stop()` 에도 적용하거나 최소한 `Math.min(durationMs, PG_INT4_MAX)`
    클램프만 추가하는 후속 항목을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    "넘김" 트래커에 등재. 이미 그 트래커가 `stop()`(`finalizeGuarded` 의 `COALESCE(duration_ms, …)`)를
    다른 이유(retry-turn 재진입 DB≠emit)로 다루고 있어 같은 자리에 병기하면 두 번째 왕복을 줄인다.

- **[INFO]** REST `GET /api/external/executions/:id`(EIA §5.3, `EIA-IN-04`)에 `durationMs` 부재는
  spec 위반이 아님을 재확인 — 이미 트래커 등재·CHANGELOG 고지된 사항의 재확인
  - 위치: `spec/5-system/14-external-interaction-api.md:75` `EIA-IN-04` 표 행(`status / currentNode /
    context / result|error / seq / updatedAt` — `durationMs` 없음)
  - 상세: §5.3 의 normative 요구사항 목록 자체가 `durationMs` 를 포함하지 않으므로, 현재 구현
    (`ExecutionStatusDto` 에 `durationMs` 없음)은 spec 과 line-level 로 일치한다. CHANGELOG 가
    "push 계열만 채워졌다 · 재조회 시 사라지는 비대칭" 이라 자인한 것은 **제품 완결성 관점의 결함**이지
    이번 diff 가 spec 을 어긴 것은 아니다. 조치 불필요 — 이미 이전 라운드가 등재.

## 요약

핵심 요구사항("종결 이벤트 3종에 `durationMs` 를 싣는다, 알 수 없으면 `null`")은 16개 emit 경로
전수(completed 6 · failed 4 · cancelled 6)에 실제로 배관돼 있음을 코드 레벨로 재확인했다 — `grep` 카운트가
plan 문서의 주장과 정확히 일치한다(`emitCancellationEvent` 호출 5곳 + retry-turn 동적 분기 1곳 =
cancelled 6, `TERMINAL_DURATION_MS_SQL` 사용 정확히 5곳 = raw UPDATE 경로 수와 일치). int4 클램프·음수
sentinel 은 JS(`resolveTerminalDurationMs`)·SQL(`TERMINAL_DURATION_MS_SQL`) 양쪽에 대칭으로 존재하고
상수(`PG_INT4_MAX`)를 공유해 drift 가 구조적으로 봉쇄돼 있다. dispatcher 타입 캐스팅·`types.ts` 의
`number | null` 전환·통계/대시보드 AVG 집계의 `status='completed'` 필터도 diff 와 spec §6/§conventions
양쪽에 정합한다. TODO/FIXME/HACK/XXX 신규 도입 없음. 유일한 신규 발견은 이 PR 이 다루지 않은 인접
코드(`executions.service.ts` `stop()`)에 동일한 무가드 연산이 남아 있다는 것으로, spec 위반은 아니지만
이 PR 스스로 두 번 CRITICAL 로 취급한 결함 클래스와 동형이라 WARNING 으로 등재를 권한다. 이 PR 자체의
diff 범위 안에서는 CRITICAL 급 요구사항 미충족을 발견하지 못했다.

## 위험도

LOW
