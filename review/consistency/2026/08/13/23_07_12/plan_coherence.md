# Plan 정합성 검토 — plan_coherence

## 검토 범위 메모

- 이번 diff(`origin/main...HEAD`)는 실제로 `spec/5-system/**` 를 한 줄도 바꾸지 않았다 —
  변경은 전부 `codebase/backend/src/{common/utils,modules/{auth,execution-engine,knowledge-base}}/**`
  와 `plan/in-progress/{ie-resume-turn-boundary-cancel,update-returning-tuple-shape}.md`,
  `review/**` 에 한정된다(`git diff origin/main...HEAD --stat` 로 확인). 따라서 target
  (`spec/5-system/`) 이 미해결 plan 결정과 "직접" 충돌하는 자리는 없다 — 아래 발견은
  이 developer 세션이 만든 diff(`update-returning-tuple-shape.md`)와 **다른 in-progress
  plan 의 완결성 주장 사이**의 정합성이다(§3 후속 항목 누락 관점).
- `plan/in-progress/update-returning-tuple-shape.md`(SoT: `updateExecutionStatus`
  `persisted` shape 버그 수정) · `ie-resume-turn-boundary-cancel.md`(소급 정정 대상) ·
  `retry-turn-terminal-guard.md`(소급 영향 대상으로 지목됐으나 미반영) · 워크트리 슬러그와
  일치하는 `spec-draft-eia-r8-alignment.md`(전 항목 완료 확인) 를 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `retry-turn-terminal-guard.md` 가 "소급 정정 배너를 넣었다" 는 claim 이 사실이 아니다 — 실제로는 `ie-resume-turn-boundary-cancel.md` 한 곳에만 반영됐다
  - target 위치: (target=spec/5-system/ 자체는 무관 — 아래 두 plan 문서 사이의 불일치)
  - 관련 plan:
    - `plan/in-progress/update-returning-tuple-shape.md:105-107` — "→ 두 plan 모두에 소급
      정정 배너를 넣고, `ie-resume-turn-boundary-cancel.md` 는 뮤턴트 항목의 진단도
      바로잡았다." (교훈 문단, "두 plan 모두" 명시)
    - `plan/in-progress/update-returning-tuple-shape.md:94-103` — 두 번째 대상으로
      `retry-turn-terminal-guard.md` 를 명시 지목: "`retry-turn.service.spec.ts:101` 이
      `updateExecutionStatus: jest.fn().mockResolvedValue(true)` 로 boundary mock 을
      둔다 … 고친 지금은 `updateExecutionStatus` 가 `false` 를 돌려줄 수 있으므로, 그
      분기를 타는 retry-turn 경로가 실제로 있는지 **재검증해야 한다**."
    - `plan/in-progress/retry-turn-terminal-guard.md` — 이 파일 전체(681줄)에
      "update-returning-tuple-shape" · "8332d9a20" · "updateReturningRows" · "튜플" 어떤
      키워드도 없음(grep 확인, 0 매치). 마지막 코드 관련 커밋은 `9a4d3e32b`(2026-07-27
      계열, 본 세션과 무관한 EIA 문서 커밋)이고, "체크리스트"(L76-83)·"12차 라운드
      … 수렴 종료"(L621)·"`complete/` 로 옮기지 말 것"(L85) 어디에도 이번 발견(persisted
      상수-`true` 버그가 이 plan 이 12라운드에 걸쳐 "닫았다"고 판정한 guarded-UPDATE
      기반 동시-cancel 방어의 실제 검증 범위를 좁혔을 가능성)이 등재돼 있지 않다.
  - 상세: `update-returning-tuple-shape.md` 가 고친 `updateExecutionStatus` 의 `persisted`
    버그(`updated.length > 0` 이 튜플 shape 때문에 항상 `true`)는 `linkedNodeExec` 분기가
    아니라 **else 분기**(단순 guarded 전이, `retry-turn.service.ts` 의
    `failRetryExecution`/`completeRetryExecution` 이 바로 이 경로를 통해
    `driver.updateExecutionStatus` 를 호출)에 있었다. 즉 이 버그는
    `ie-resume-turn-boundary-cancel.md` 뿐 아니라 `retry-turn-terminal-guard.md` 가
    12라운드에 걸쳐 "동시 cancel 방어가 완성됐다" 고 수렴 판정한 guarded-UPDATE 의
    false 반환 분기에도 동일하게 적용된다 — 그런데 그 plan 의 회귀 테스트가
    `mockResolvedValue(true)` 로 driver 경계를 고정해 뒀으므로, 12라운드 내내 "실제
    `persisted=false`" 경로는 **한 번도 실행/검증되지 않았다**(코드에서도, 테스트에서도).
    이는 `ie-resume-turn-boundary-cancel.md` 가 스스로 진단한 것과 같은 클래스의 결함
    (등가 뮤턴트/불변 mock 이 실제로는 버그를 인코딩)이며, `update-returning-tuple-shape.md`
    자신도 이를 정확히 지목했다. 그런데 실제 반영은 한쪽 plan(ie-resume-turn-boundary-cancel)
    에만 이뤄졌고, 정작 지목당한 `retry-turn-terminal-guard.md` 에는 배너도 후속 항목도
    등재되지 않았다 — plan 간 "완료" 서술과 실제 상태가 어긋난다.
  - 제안: `retry-turn-terminal-guard.md` 상단에 `ie-resume-turn-boundary-cancel.md:87-99`
    와 동형의 소급 정정 배너를 추가하고, "실제 `persisted=false`(동시 cancel 선점) 분기가
    `failRetryExecution`/`completeRetryExecution` 경로에서 실제로 타는지, mock 경계 밖에서
    재검증할 것" 을 체크리스트 미완료 항목으로 등재한다. 동시에
    `update-returning-tuple-shape.md:105-107` 의 "두 plan 모두에 소급 정정 배너를 넣고"
    문구를 실제 상태(현재는 한 곳만)에 맞게 정정하거나, 위 반영을 완료해 문구를 사실로
    만들 것.

## 요약

이번 diff 는 `spec/5-system/` 을 직접 건드리지 않아 target 문서가 plan 의 미해결 결정을
우회하는 CRITICAL 급 충돌은 없다. 다만 diff 가 고친 `updateExecutionStatus` `persisted`
버그의 소급 영향 범위를 다루면서, 작업 plan(`update-returning-tuple-shape.md`) 스스로 "두
plan 모두에 배너를 넣었다" 고 적어 놓고 실제로는 `ie-resume-turn-boundary-cancel.md` 한
곳에만 반영했다 — `retry-turn-terminal-guard.md` 가 12라운드에 걸쳐 "수렴" 판정한 동시-cancel
방어 검증도 같은 shape 버그로 인해 mock 경계 밖 실측이 빠져 있었을 가능성이 높은데, 그 사실이
해당 plan 에 기록되지 않았다. plan 간 "완료" 주장과 실제 문서 상태의 불일치이며, 코드 자체를
다시 열 필요는 없지만(guarded UPDATE 의 SQL 자체는 항상 정확했다 — 데이터 안전은 위협받지
않았다) 검증 범위에 대한 재확인과 plan 갱신이 필요하다.

## 위험도
LOW
