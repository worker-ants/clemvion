# RESOLUTION — 2026/07/26/23_05_48 (4차 라운드, 수렴 라운드)

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | 코드 | `6755ef0fe` | `assertActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` linkedNodeExec 분기의 `FOR UPDATE` 잠금 조회 중복 → `lockNonTerminalExecutionRow` private 헬퍼로 추출 |
| #2 | plan | `3590469d0` (draft 위임 아님 — 기존 plan 후속 재확인) | `plan/in-progress/ie-resume-turn-boundary-cancel.md` "4차 라운드 추가 후속" — 코드 변경 없음, 이미 3차 라운드부터 추적 중인 별도 후속 PR 항목 |
| #3 | plan | `3590469d0` | 상동 — public 표면 확대, WARNING#4 개명으로 위치만 갱신 |
| #4 | 코드 | `6755ef0fe` | `assertActiveExecutionAndSaveNodeExec` → `tryLockActiveExecutionAndSaveNodeExec` 개명(non-throwing/bool 반환 명시). 인터페이스·구현·호출부·테스트 전부 동반 갱신, 멤버 수 15/10 불변(rename-only) |
| #5 | 코드 | `6755ef0fe` | `assertLinkedTransitionApplied` 나머지 2개 소비처(첫 turn park·retry-last-turn RUNNING 재claim)에 phase 문자열 정규식 단언 추가 |
| #6 | 코드 | `6755ef0fe` | `applied`→`shouldProceed` rename 을 JSDoc `@throws` 4곳 + 테스트 주석 2곳(총 6곳) + `CHANGELOG.md` 메서드명 참조에 전파 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 412 suite / 8302 passed, 1 skipped — 사전 존재, 회귀 아님)
- build : 통과
- e2e   : 통과 (260 passed)

## 보류·후속 항목

- SUMMARY#2 (WS 이벤트 emit 순서 갭, requirement) — `plan/in-progress/ie-resume-turn-boundary-cancel.md`
  "4차 라운드 추가 후속" 절에 재확인 서술 등재. 3차 라운드부터 반복 발견 — 후속 PR 착수
  우선순위를 실질적으로 부여할 것을 권고(누적 미착수).
- SUMMARY#3 (`ExecutionEngineService` public 표면 확대, side_effect) — 상동, 조치 불요(설계
  의도) 재확인. WARNING#4 개명으로 코드 위치만 갱신.
- INFO: `EngineDriver` JSDoc 멤버 수 하드코딩이 3라운드 연속 stale 화 — "갱신 절차" 서술
  대체 리팩터 후속 등재(`plan/in-progress/ie-resume-turn-boundary-cancel.md`).
- INFO: `segmentStartMs` 진입/이탈 가드 비대칭 — 이탈 쪽도 `persisted` 확인 후로 이동 검토
  후속 등재(우선순위 낮음, DB 오염 없음).
- INFO: `markNodeCancelled` 비원자 save 크래시 창 — stalled-job recovery 백스탑 커버 확인
  후속 등재(3차 라운드부터 반복 확인, 저위험).

## 수렴 판단

Critical 0, 4라운드 연속. 이번 라운드 WARNING 6건 전부 저위험·기계적(구조 중복 추출,
명명 일관성, 테스트 완결성, 문서 rename 전파)이었고 전부 코드/테스트/문서로 닫혔다(2건은
사용자 지시대로 plan-only 로 처리 — 이미 3차 라운드부터 추적 중인 별도 스코프 항목이라
이번 PR 범위 밖). 발견의 성격이 동작 결함에서 구조·문서·테스트 완결성으로 완전히 이동한
상태를 재확인 — 코드 변경을 이 라운드로 수렴한다.
