# RESOLUTION — 21_08_01

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 | `157bfb887` | `finalizeAiNode` "이미 RUNNING" 분기가 짝 전이 choke point 를 거치지 않아 취소 가드가 미적용되던 결함 — `assertExecutionNotCancelled` 로 직접 재관측 후 `assertLinkedTransitionApplied` 절차에 위임 |
| Warning #1 | 코드(plan 재평가) | `fb3fcb4a1` | Form/Button 후속 PR 을 위한 가드 재사용성 이슈를 plan 후속 항목에 명시 (본 PR 범위 밖 — main 지시) |
| Warning #2 | 코드(plan 재평가) | `fb3fcb4a1` | "표시상 잔여" 위험 서술을 데이터 일관성 갭으로 재평가 (본 PR 범위 밖 — main 지시) |
| Warning #3 | 코드(plan 재평가) | `fb3fcb4a1` | form/button 회귀 테스트 부재를 후속 PR 선행 조치로 명시 (본 PR 범위 밖 — main 지시) |
| Warning #4 | 코드(선택, 미조치) | — | `updateExecutionStatus` 다중 책임 리팩터 — SUMMARY 권장사항 자체가 "(선택)" 표기이며 main 우선순위 지시에서도 제외됨. 조치 안 함(하단 "보류·후속 항목" 참조) |
| Warning #5 | 코드 | `157bfb887` | `assertLinkedTransitionApplied` 의 `nodeExec===null` mutation 사각지대 — re-park 소비처에 회귀 고정 |
| Warning #6 | 테스트(e2e) | `567152e39` | 턴 진행 중 실 HTTP `POST /stop` e2e 신설(`__e2e_delay_ms` 결정적 지연 마커로 관측 가능한 RUNNING 윈도우 확보) |
| Warning #7 | 코드 | `157bfb887` | 취소 에러 메시지의 고정 접미사 "— skipping park" 가 phase 와 무관하게 붙던 문제 — phase 값만으로 메시지 구성 |
| Warning #8 | plan 문서 | `fb3fcb4a1` | plan 상호참조 링크 3곳이 이동 시 깨지는 문제 — 이동 체크리스트 절 추가 |
| Warning #9 | 코드 | `e5882101a` | 거부된 RUNNING 전이에도 `segmentStartMs` 가 무조건 기록되던 in-memory 유령 항목 — `persisted===true` 확인 이후로 이동 |
| Warning #10 | 코드 | `157bfb887` | 취소 마킹 시 `outputData`/`error` 성공 전용 필드가 잔류하던 데이터 위생 문제 — terminal 마킹 전 명시적 초기화 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (backend 412 suite / 8298 passed — 신규 케이스 반영, 이전 대비 +12; internal packages 별도 통과)
- build : 통과
- e2e   : 통과 (260 passed — SUMMARY#6 신규 e2e 1건 포함, 이전 대비 +1)

## 보류·후속 항목

- Warning #4 (`updateExecutionStatus` 다중 책임 리팩터) — SUMMARY 권장사항 9번이 "(선택)"으로
  명시했고 main 우선순위 지시에도 포함되지 않아 이번 턴에 조치하지 않음. 후속 리팩터 PR 후보로
  자유롭게 재검토 가능(강제 추적 없음).
- Warning #1/#2/#3 — Form/Button interaction 경로로의 확장은 본 PR 범위 밖(main 지시).
  `plan/in-progress/ie-resume-turn-boundary-cancel.md` "## 후속 (본 PR 밖)" 절에 재평가된
  위험 서술로 갱신 완료 — 실제 코드 fix 는 별도 후속 PR.
- Warning #8 — plan 이동 시 함께 정정해야 할 상호참조 링크 3곳을
  `ie-resume-turn-boundary-cancel.md` "⚠️ 이 plan 을 `plan/complete/` 로 이동할 때" 절 +
  하단 체크리스트에 등재. 이동 커밋 담당자가 처리.
- spec 관련 항목 없음 — INFO #17 이 지목한 spec/conventions/node-cancellation.md,
  spec/5-system/4-execution-engine.md §1.1 의 stale 서술은 이미
  `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` #7 로 위임
  완료된 상태(SUMMARY 자신도 "신규 결함 아님" 으로 확인) — 이번 라운드에 추가 spec draft
  불필요.
