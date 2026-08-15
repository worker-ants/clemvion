# Plan 정합성 검토 — `spec/5-system/` (impl-done)

## 발견사항

- **[INFO]** `retry-turn-terminal-guard.md` #2 를 가리키는 줄 번호 인용이 이번 라운드로 더
  stale 해졌다
  - target 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
    `failRetryExecution` — 이번 durationMs 구현(`execution.durationMs = resolveTerminalDurationMs(...)`
    대입 2줄 + emit 필드 1줄 추가)으로 emit 블록이 더 아래로 이동했다. 실측 결과 현재
    `emitExecution(...)` 호출은 `:964`~`:977`(`result.cancelledBy` 미포함 상태 그대로 확인)이다.
  - 관련 plan: `plan/in-progress/eia-terminal-payload.md` `## 다른 plan 과의 관계` 절 —
    "같은 코드 블록(`retry-turn.service.ts` `failRetryExecution` `:956~965`)을 겨냥한다"
    라는 인용, 및 `retry-turn-terminal-guard.md` 코드 표 #2 행.
  - 상세: 직전 라운드(`09_58_31`)가 이미 같은 종류의 drift(당시 `:956~965`)를 INFO 로 지적
    하며 "함수 심볼로도 특정 가능해 실질 추적 실패 위험은 낮다 · 결정 충돌 아님 · 우선순위
    낮음" 이라 판정했다. 이번 durationMs 구현이 그 파일을 다시 건드리며 줄 번호가 한 번 더
    밀렸으나(`:956~965` 인용은 실제 emit 시작 위치 `:964` 와 여전히 근접), 겨냥하는 함수·
    emit 호출부 자체는 동일하고 `result.cancelledBy` 가 여전히 빠져 있다는 실질 내용도
    target(§6 필드 집합 표 "경로 1곳 누락")과 정합한다 — **결정 충돌·실질 추적 실패는 없다.**
  - 제안: 조치 불요(이전 라운드 판정 유지). `retry-turn-terminal-guard.md` #2 착수 시 자연히
    현재 코드를 다시 읽으므로 별도 대응 없이도 무방하다.

## 요약

이번 diff(`spec/5-system/14-external-interaction-api.md` — `durationMs` 를 `execution.cancelled`
payload 예시·§6.5 신규 blockquote 에 반영 + Re-run API 경로의 `/v1/` 세그먼트 제거)는 직전
consistency 라운드(`09_58_31`)가 WARNING 으로 지적한 "durationMs Planned→구현됨 전환이 자매
트래커에 미반영" 문제를 완전히 해소한 상태다 — `spec-sync-external-interaction-api-gaps.md`
의 `durationMs emit` 체크박스가 `[x]`(완료 근거 `0f0050dea`/`0dce2a83f` 명시)로, `spec-draft-
eia-notification-payload-contract.md` 의 (1) 표 `durationMs` 행이 `구현됨 (2026-08-15)` 으로,
`eia-terminal-payload.md` 의 `### 다음 PR (이연)` 체크박스도 `[x]` 로 전환돼 세 문서가 target
과 일치한다. 그 사이 두 ai-review 라운드(`10_18_38`·`10_34_51`)가 새로 낸 W1(retry-turn 재진입
duration 불일치)·W3(duration_ms 에 대기시간 혼입)·W4/W7/W10(durationMs 후속 3건) 도 전부
`spec-sync-external-interaction-api-gaps.md` 에 개별 항목으로 등재돼 있어, target 이 "결정
필요" 로 열어 둔 어떤 항목과도 충돌하지 않고 선행 plan(§6.2 봉투 정정 등)도 이미 해소된
상태에서 진행됐다. 남은 것은 줄 번호 인용의 경미한 staleness(위 INFO) 하나뿐이며, 이는 직전
라운드가 이미 저위험으로 판정한 것의 연장이다.

## 위험도

NONE
