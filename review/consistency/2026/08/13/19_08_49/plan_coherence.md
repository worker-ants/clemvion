# Plan 정합성 검토 — spec/5-system/ (--impl-done, diff-base=origin/main)

## 조사 방법

프롬프트에 포함된 diff 목록이 예산 초과로 생략돼 있어, 절대경로 워크트리에서 직접
`git diff origin/main...HEAD --stat`(전체 및 `-- codebase/ spec/ plan/` 한정)을 재실행해
실제 변경 파일을 확정했다:

- `codebase/backend/src/common/utils/assert-row-array.{ts,spec.ts}` (신규)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.{ts,spec.ts}`
  (admission UPDATE 의 `rows` shape 가드 — `assertRowArray` 도입)
- `codebase/backend/src/modules/executions/executions.service.{ts,spec.ts}`,
  `executions-rerun.service.spec.ts` (자매 raw-query 지점 가드)
- `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.spec.ts`
  (테스트 스타일 정리 4건 — JSDoc 위치·pass-through 래퍼 제거·네이밍·캐스트 통합)
- `plan/in-progress/backend-lint-gate-broken-on-main.md`,
  `plan/in-progress/spec-draft-eia-notification-payload-contract.md` (plan 갱신)

**`spec/5-system/` 본문은 이번 diff 에서 1줄도 바뀌지 않았다.** 대상 지정이 그 영역인 것은
execution-engine 코드 변경(admission 가드)이 `4-execution-engine.md` 관할이기 때문으로 보이며,
그 자체는 정합성 이슈가 아니다.

## 검토 대상 plan (관련성 순)

- `plan/in-progress/backend-lint-gate-broken-on-main.md` — 이번 diff 의 직접 SoT. 잔여
  체크리스트("선재 테스트 공백 2건" · "admission `Array.isArray` 가드")를 이번 커밋들로
  완료 처리.
- `plan/in-progress/retry-turn-terminal-guard.md` — `failRetryExecution` 의 `cancelledBy`
  누락(P2, #2)이 여전히 미완료임을 실측으로 재확인하고 교차 참조만 추가(집행 아님).
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md` — EIA outbound payload
  CRITICAL(b) 종결의 "잔여는 반대 방향" 두 항목(durationMs·result.outputs emit / error 객체
  통일)이 실제로 등재돼 있음을 직접 확인.
- `plan/in-progress/execution-engine-residual-gaps.md`, `spec-draft-eia-r8-alignment.md` —
  이번 diff 와 무관한 별개 항목(G2 defer, R8 정합 draft 완료)으로 충돌 없음.

## 발견사항

특별한 발견사항 없음 — 아래는 확인한 잠재 리스크와 그 결과다(전부 문제 없음으로 판정).

1. **`retry-turn-terminal-guard.md` #2 (`cancelledBy`) 교차 참조** — 이번 라운드가 새로
   추가한 "[developer] `failRetryExecution` 이 `cancelledBy` 를 안 채운다" 항목은
   `retry-turn-terminal-guard.md` 의 §코드 표 #2 (P2, 미완료)를 정확히 가리킨다. 직접
   `retry-turn-terminal-guard.md:329`에서 실측 대조 — 상태(`developer` 권한 내, 미집행)와
   서술이 일치한다. 결정 충돌 없음, 새 결정을 내리지도 않았다(단순 교차 참조).

2. **plan 체크리스트 "잔재 제거" 가 실제 미완료 항목을 삭제했는지** — diff 가
   `spec-draft-eia-notification-payload-contract.md` 에서 8줄(`§6.3~§6.5 본문 축약` ·
   `WS §4.1 종결 3행` · `chat-channel-adapter.md §1.2 축약` · `15-chat-channel.md:76 line 536
   제거` · `Planned gap 2건 등재` 등)을 제거했다. 파일 전체를 대조한 결과 이 항목들은
   **이미 그 위(L230~L242)에서 `[x]` 로 완료 처리돼 있었다** — 제거된 것은 섹션 경계를
   문자열 포함(`"## Rationale"`)으로 찾다가 본문 인용문에 걸려 잘못 남은 **중복 잔재**였다
   (commit `7cc2a4082` 의 자기 서술과 일치). 실질 작업 유실 없음.

3. **신규 오픈 항목(raw-query 전역 감사 · `CONSUMING_QUERY` 사각지대 · `updateExecutionStatus`
   else 분기 트랜잭션화)** — `backend-lint-gate-broken-on-main.md` 에 새로 등재된 3건은 다른
   plan 과 항목 중복이나 결정 충돌이 없다(`consumeOAuthState` 등 인용 심볼이 다른 plan 에서
   추적되지 않음을 grep 으로 확인). 정규식이 아닌 AST 확장을 권고하는 문구도 저장소가 이미
   합의한 "정적 가드: blind 정규식 vs 정밀 파서" 경계와 정합적이다.

4. **EIA outbound notification payload CRITICAL(b) 종결** — `backend-lint-gate-broken-on-main.md`
   가 "(b) spec 을 실제에 맞춘다" 로 종결하며 "잔여는 반대 방향(구현을 문서에 맞추기)" 을
   `spec-sync-external-interaction-api-gaps.md` 에 등재했다고 서술한다.
   `spec-sync-external-interaction-api-gaps.md:8-16` 에서 두 항목
   (`result.outputs`·`durationMs` emit / `error` 객체 통일)이 실제로 등재돼 있음을 직접
   확인 — 서술과 실물이 일치한다.

이번 diff 자체(assertRowArray 하드닝, admission 가드, dispatcher 테스트 정리)는 spec 문서를
건드리지 않고, 미해결 결정을 우회하지도 않으며, 다른 plan 의 선행 조건에 의존하지도 않는다.

## 요약

이번 라운드의 실제 변경분(`assert-row-array` 하드닝 4곳 + execution-engine admission 가드 +
`chat-channel.dispatcher.spec.ts` 스타일 정리 4건)은 spec/5-system/ 본문을 건드리지 않으며,
plan 문서(`backend-lint-gate-broken-on-main.md`)가 자신의 체크리스트·교차 참조·plan 간
포인터를 정확히 갱신했다. `retry-turn-terminal-guard.md` P2 항목·
`spec-sync-external-interaction-api-gaps.md` 등재 항목과의 교차 참조를 직접 원본에서
대조했고 전부 일치했다. 체크리스트에서 삭제된 8줄도 실측 결과 이미 완료 처리된 항목의
중복 잔재였음을 확인했다(작업 유실 아님). Plan 정합성 관점에서 미해결 결정 우회·선행 plan
미해소·후속 항목 누락 중 어느 것도 발견되지 않았다.

## 위험도

NONE
