# Plan 정합성 검토 — spec/5-system/ (impl-done)

## 대상
- 실제 diff: `spec/5-system/4-execution-engine.md` 1줄 변경 (§7.1, `finalizeStalledExhausted` 를
  "단일 트랜잭션" 으로 문서화). 대응 plan: `plan/in-progress/eia-stalled-atomicity.md`
  (정본 트래커: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"`finalizeStalledExhausted`
  만 트랜잭션 밖이다").

## 발견사항

- **[WARNING]** "실 DB e2e" 후속 항목이 실제로는 어디에도 등재돼 있지 않다
  - target 위치: `plan/in-progress/eia-stalled-atomicity.md` §"범위 밖" ("이 함수의 다른 열린
    항목(관용구 헬퍼 추출 · 단일 emit 관문 · **실 DB e2e**)은 정본 트래커에 등재돼 있고 이번
    PR 에서 건드리지 않는다") + §"판별력" 아래 "mock 은 롤백을 흉내내지 못한다... 실 DB 부분
    커밋 검증은 **자매 plan 의 실 DB e2e 트랙**과 같은 성격이라 그쪽에 묶인다"
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(정본 트래커),
    `plan/in-progress/retry-turn-terminal-guard.md`(추정되는 "자매 plan")
  - 상세: 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)를 전수 확인했으나
    `finalizeStalledExhausted` 의 2-테이블 트랜잭션(Execution UPDATE + NodeExecution cascade
    UPDATE)이 실 Postgres 에서 부분 커밋 시 실제로 롤백되는지 검증하는 항목이 **어디에도
    없다**. "관용구 헬퍼 추출"(§"종결 duration 관용구가 16곳에...")과 "단일 emit 관문"
    (§"동일 CANCELLED 전이에 독립 emit 이 여러 번 나갈 수 있다")은 정확히 매칭되는 항목이
    트래커에 있어 확인됐지만, "실 DB e2e" 항목만 매칭되는 것이 없다. `retry-turn-terminal-guard.md`
    에 있는 "실 DB e2e" 관련 항목(`COALESCE 경로의 실 DB 검증 부재` / 우선순위표 #3·#4,
    `plan/in-progress/retry-turn-terminal-guard.md:314-330,365-366`)은 **다른 함수·다른 SQL 패턴**
    (`finalizeGuarded` CANCELLED 분기의 `COALESCE(duration_ms, :p)` 대입, `retryLastTurn` 계열의
    JSONB `-`/`jsonb_exists` atomic-consume)을 겨냥한 것이지 `finalizeStalledExhausted` 의
    트랜잭션 원자성(부분 커밋/롤백)과는 무관하다. 즉 "자매 plan 의 실 DB e2e 트랙에 묶인다" 는
    서술은 **정본 트래커도 아니고, 가리키는 그 sibling plan 도 이 특정 갭을 다루지 않는다** —
    이 저장소가 반복 지적해 온 "미룬 항목은 그 턴에 plan 에 적어라" 형태의 재발이다.
  - 제안: `spec-sync-external-interaction-api-gaps.md` 에 `finalizeStalledExhausted` 트랜잭션의
    실 DB 부분 커밋/롤백 검증(e2e) 항목을 별도로 신설하거나, 정말 `retry-turn-terminal-guard.md`
    의 어떤 항목이 이를 포괄한다면 그 항목 텍스트에 `finalizeStalledExhausted` 를 명시적으로
    추가한다. 최소한 "정본 트래커에 등재돼 있고" 라는 서술은 사실과 다르므로 정정 필요.

- **[WARNING]** `eia-db-wire-invariant.md` 가 이미 머지된 PR(#1172)을 여전히 미완료로 표시
  - target 위치: (간접) `spec/5-system/4-execution-engine.md` 의 이번 커밋이 쌓인 base 자체가
    이 PR 을 포함한다
  - 관련 plan: `plan/in-progress/eia-db-wire-invariant.md` §체크리스트
  - 상세: `git log` 상 `161bae56e "fix(eia): DB 에 쓰이지도 않은 종결 이벤트를 발행하고
    있었다 (#1172)"` 커밋이 이미 `origin/main` 에 병합돼 있고, 커밋 본문(①②③)이
    `eia-db-wire-invariant.md` 의 ①②③ 항목과 정확히 일치한다(같은 worktree
    `eia-r8-cache-scope-4ae434` 위에서 이 PR 다음에 `eia-stalled-atomicity` 작업이 이어진 상태).
    그런데 `eia-db-wire-invariant.md` 의 체크리스트는 `- [ ] fix 이후 fresh /ai-review +
    --impl-done`, `- [ ] --impl-done BLOCK: NO`, `- [ ] push 게이트 통과 → PR` 세 항목이 여전히
    미체크 상태다 — 이미 병합된 작업인데 plan 문서만 "진행 중"으로 stale 하다. (이 저장소가
    이미 기록한 교훈 "plan 체크박스 = 실제 상태" 의 재발.)
  - 제안: 체크리스트 3항목을 `[x]` 로 갱신하고 병합 커밋(#1172)을 근거로 남긴 뒤,
    plan lifecycle 절차대로 `plan/complete/` 로 이관.

## 요약
target(`spec/5-system/4-execution-engine.md` 의 `finalizeStalledExhausted` 트랜잭션 문서화 1줄)
자체는 대응 작업 plan(`eia-stalled-atomicity.md`)·정본 트래커
(`spec-sync-external-interaction-api-gaps.md`)와 내용상 정합하며, 미해결 결정을 우회하거나
선행 plan 조건을 무시하는 지점은 없다. 다만 (1) 이번 변경이 만든 새 코드(트랜잭션 래핑)에
대한 실 DB 검증 후속 항목이 "등재돼 있다"고 주장되지만 실제로는 어느 plan 에도 정확히
매칭되지 않고, (2) 같은 worktree 의 선행 작업(`eia-db-wire-invariant`, PR #1172)이 이미
머지됐는데도 해당 plan 문서가 미완료로 stale 하게 남아 있다. 둘 다 기능적 위험은 낮은
plan 갱신 사안이다.

## 위험도
LOW
