# Rationale 연속성 검토 결과

## 검토 범위 확인

`git diff origin/main...HEAD` 로 실측(절대경로 워크트리 기준). prompt bundle 은
`spec/5-system/` 전체를 담고 있으나, 실질 코드/spec 변경은 EIA 종결 이벤트(`completed`/
`failed`/`cancelled`) `durationMs` 3종 구현 전체 및 그 파급(대시보드/통계 집계 필터,
chat-channel 타입, Re-run `/v1/` 세그먼트 정정)이다. 워크트리 이름이 가리키는 R8
(Idempotency-Key 캐시 스코프) 관련 코드(`external-interaction/**`, `hooks/**`,
`triggers/**`)는 이번 diff 에 **0줄** 포함되어 있다 — 동일 세션 선행 네 라운드(`08_45_50`,
`09_00_27`, `09_58_31`, `10_52_07`)와 동일 결론.

이번 라운드는 직전 rationale_continuity 라운드(`10_52_07`, 10:52) 이후 추가된 커밋
(`a67ec89b7`~`c100602e0`, 11:02~13:06)을 반영해 (1) 그 라운드가 남긴 WARNING 이 해소됐는지,
(2) 그 이후 새로 들어온 변경(대시보드/통계 집계 필터, `stop()` REST 클램프, 유저 가이드
캐비엇)이 어느 spec 의 Rationale 과 충돌하는지를 추가로 확인했다.

## 발견사항

- **[WARNING]** `avgExecutionTime`/`avgDurationMs` 를 `status='completed'` 로 좁힌 결정이 해당 spec 의 `## Rationale` 에 기록되지 않음
  - target 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts` (`avg7d` 집계),
    `codebase/backend/src/modules/statistics/statistics.service.ts` (`avgDurationMs` 2곳) —
    커밋 `f79792621`(12:17). 대응 spec 본문은 `spec/2-navigation/0-dashboard.md:141`
    (`avgExecutionTime` 필드 설명, "duration_ms 평균을 정수 반올림" — 상태 스코프 언급 없음)과
    `spec/2-navigation/7-statistics.md:69` (`Avg Duration` 행, 동일하게 상태 스코프 없음).
  - 과거 결정 출처: `spec/2-navigation/0-dashboard.md` `## Rationale` §"Success Rate 분모 =
    7일 전체 실행 건수" — "진행 중·취소 건도 분모에 포함하는 현 구현을 SoT 로 채택" 라고
    **상태-비특정(broad inclusion) 이 이 문서의 기존 지표 설계 원칙**임을 명시한 문단이
    바로 옆에 있다. `avgExecutionTime` 자체는 과거 어떤 Rationale 도 "completed 만" 이라고
    못박은 적이 없었다(암묵적으로는 `duration_ms IS NOT NULL` 필터가 우연히 completed 를
    근사했을 뿐).
  - 상세: 이번 PR 이 종결 이벤트에 `durationMs` 를 채우기 시작하면서 취소·타임아웃 실행도
    `duration_ms` 가 non-null 이 됐고, 그 값은 "대기 경과 시간" 이라 기존 `IS NOT NULL` 필터만
    쓰면 평균이 오염된다. 그래서 코드에 `AND e.status = 'completed'` 를 **새로 추가**했다 —
    이는 지표 정의를 "duration_ms 가 있는 실행의 평균" 에서 "**completed 실행만의 평균**" 으로
    **의도적으로 좁힌 결정**이다. `CHANGELOG.md`(이번 diff) 는 이 변화를 스스로 인정한다:
    "지표 정의가 '완료된 실행의 평균' 으로 좁아졌다", "종전에 집계되던 정상 실패와 stop 취소의
    실제 소요 시간이 평균에서 빠진다", "대시보드 숫자가 이동한다". 즉 **결정과 근거 자체는
    존재**하지만 프로젝트 컨벤션상 SoT 위치(`CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서
    끝의 `## Rationale`")가 아니라 CHANGELOG/plan(`spec-sync-external-interaction-api-gaps.md`)
    에만 적혀 있다. `spec/2-navigation/0-dashboard.md`/`7-statistics.md` 의 필드 설명과
    `## Rationale` 은 무변경이라, 다음에 그 문서만 읽는 사람은 "completed 만 집계" 라는
    새 결정을 알 수 없다.
  - 제안: `spec/2-navigation/0-dashboard.md` `## Rationale` 에 짧은 항목 추가 — 예:
    "`avgExecutionTime` 은 `status='completed'` 로만 집계한다(2026-08-15) — EIA `durationMs`
    구현으로 취소/타임아웃 경로도 `duration_ms` 가 채워지기 시작했고, 그 값은 실행 시간이
    아니라 대기 경과 시간이라 포함하면 평균이 오염된다." 같은 문단을 `7-statistics.md` 에도
    cross-ref. (실제 SoT 결정 근거는 이미 CHANGELOG·plan 에 있으므로 옮겨적기만 하면 된다 —
    새로 조사할 내용은 없음.)

- **[INFO]** `spec/data-flow/3-execution.md` 시퀀스 다이어그램 미동기화 — 지속 이월(회귀 아님)
  - target 위치: (diff 밖, 미변경) `spec/data-flow/3-execution.md:111`
  - 과거 결정 출처: `plan/in-progress/eia-terminal-payload.md` frontmatter `spec_impact`
    (`09_00_27` plan_coherence W3 지적으로 4번째 항목 추가) + 본문 "spec 동반 변경(전수)" 표.
  - 상세: `git diff origin/main...HEAD -- spec/data-flow/3-execution.md` 는 이번 라운드도
    빈 결과 — 3개 선행 라운드(`09_58_31`, `10_52_07` 포함)와 동일 상태. 다이어그램이
    `cancelled` 에도 `duration_ms` 를 쓰는 것처럼 세 상태를 뭉쳐 표기하던 것이 이번 PR 로
    "우연히 참" 이 됐다는 판정도 그대로 유효하다 — Rationale 위반은 아니나, 새로 생긴
    캐비엇(취소 경로 값 = 대기 시간, retry-turn 재진입 예외)은 여전히 반영되지 않았다.
  - 제안: 이번 PR 범위에서 처리하지 않는다면, plan 항목에 "다음 턴 이연" 사유를 명시적으로
    남겨(이미 유사 항목엔 있음) 다음 세션이 반복 조사하지 않게 할 것.

## 재확인 — 문제 없음 (선행 라운드 대비 변경분)

- **직전 라운드(`10_52_07`) WARNING 해소 확인**: "§6 'DB 와 wire 가 같은 값' invariant 서술에
  retry-turn 재진입 예외가 캐비엇 없이 빠져 있다"는 지적이 커밋 `a67ec89b7`(11:02, "내가
  못박은 invariant 에 이미 아는 반례가 있었다")로 해소됐다. 현재 §6.5 blockquote
  (`spec/5-system/14-external-interaction-api.md` §6.5)는 "알려진 예외 1건: retry-turn
  처리 중 사용자가 Stop 하면 …" 을 R14·R17 과 동형 패턴으로 명시하고
  `spec-sync-external-interaction-api-gaps.md` 로 추적 링크를 건다. 이 문서의 반복 관행
  ("알려진 갭은 지우지 말고 invariant 옆에 적는다")을 그대로 따랐다.
- **R8 (Idempotency-Key 캐시 스코프) 결정 — 재확인, 회귀 없음** (5번째 라운드 동일 결론):
  `spec/5-system/14-external-interaction-api.md` §R8, EIA-IN-11, EIA-RL-02 — execution+route
  스코프, jti/전역 키 복귀 기각 — 이번 diff 어디에도 건드려지지 않음.
  `external-interaction/**`·`hooks/**`·`triggers/**` 코드 변경 0줄로 재확인.
- **"삭제된 약속"(`finalNodeId`/`finalPort`/`nodeCount`/`failedNodeId`) 재도입 없음**: 이번
  라운드에 추가된 커밋들도 이 캐비엇을 건드리지 않았다.
- **Planned→구현됨 "해소" 보존 관행**: §6 필드 표·§6.3/§6.4 예시·§6.5·convention
  (`chat-channel-adapter.md`) 전부 취소선 + "(2026-08-15 해소/구현)" 패턴을 유지 — 지우지
  않고 보존.
- **`stop()` REST 경로 int4 클램프**(`67ad84a54`): 종결 이벤트 경로에서 이미 CRITICAL 로
  두 번 잡힌 것과 같은 연산·같은 컬럼이라 같은 헬퍼(`resolveTerminalDurationMs`)를 재사용 —
  새 SoT 분기를 만들지 않고 기존 결정(공유 상수 `PG_INT4_MAX`)을 그대로 따름. Rationale
  충돌 없음.

## 요약

이번 PR 의 핵심 변경(EIA 종결 이벤트 `durationMs` 3종 구현)은 대상 spec
(`spec/5-system/14-external-interaction-api.md`) 의 기존 `## Rationale` 어느 항목도
재도입·번복하지 않는다 — R8 캐시 스코프, "삭제된 약속" 캐비엇, Planned→구현됨 "해소" 보존
관행이 모두 유지되고, 직전 라운드가 지적한 WARNING(retry-turn 재진입 예외 누락)도 이후
커밋에서 해소됐다. 다만 이번 PR 의 파급 효과로 대시보드/통계의 `avgExecutionTime`/
`avgDurationMs` 집계 스코프가 "completed 전용" 으로 실질적으로 좁혀졌는데, 그 결정의 근거는
CHANGELOG·plan 에는 있으나 프로젝트 컨벤션이 지정하는 SoT 위치인 해당 spec
(`spec/2-navigation/0-dashboard.md`/`7-statistics.md`) 의 `## Rationale` 에는 반영되지
않았다 — 새 결정에 대응하는 Rationale 이 없는 전형적 패턴이라 WARNING 으로 잡는다. 그 외
`spec/data-flow/3-execution.md` 다이어그램 미동기화는 4라운드째 동일 상태로 이월되는
INFO 항목이다.

## 위험도

LOW
