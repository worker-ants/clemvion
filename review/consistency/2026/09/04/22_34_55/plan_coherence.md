# Plan 정합성 검토 — `plan/in-progress/spec-draft-schedule-index.md`

## 발견사항

- **[WARNING]** 출처 plan(`spec-draft-nullable-notation-followups.md`)의 해당 열린 항목이 target 의 결론(선택지는 (c), (a)/(b) 둘 다 오답)을 반영하지 못한 채 그대로 남아 있다
  - target 위치: `plan/in-progress/spec-draft-schedule-index.md` 전체(특히 상단 인용문 L14-17, §2 L78-109) — 이 문서는 자신이 어느 항목을 "닫는지" 밝히지만 실제로 그 항목을 닫는 편집을 하지 않는다
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L379("`idx_schedule_next_run` — 부분 조건이 어떤 쿼리와도 맞지 않는다", `- [ ]` 미체크) 및 L397("코드만으로는 못 고른다 — 실제 실행 계획(`EXPLAIN`)과 테이블 크기가 필요하다"), 그리고 하단 `## 종결 조건` 표 L434(`| idx_schedule_next_run 부분 조건 불일치 | developer/DBA | EXPLAIN·테이블 크기 — (a) DROP 인가 (b) 조건 떼고 재생성인가 |`)
  - 상세: target 은 `spec-draft-nullable-notation-followups.md` 의 이 열린 항목이 요구한 선행 조건(EXPLAIN·테이블 크기)을 정확히 충족하며 등장했고, 그 답이 등재된 (a)/(b) 가 아니라 (c) `(workspace_id, next_run_at)` 임을 실측으로 밝혔다. 그런데 이 세션에서 `spec-draft-nullable-notation-followups.md` 는 **커밋 상태 그대로 미수정**이다(`git status` 확인 — 해당 파일은 untracked/modified 목록에 없음). 그 결과 두 `plan/in-progress/` 문서가 같은 인덱스에 대해 서로 다른 이야기를 한다: 하나는 "선택지는 (a)/(b), EXPLAIN 필요"(아직 미해결처럼 보임), 다른 하나는 "EXPLAIN 했고 답은 (c)"(사실상 해결됨). 이 항목은 track 이 `developer/DBA` 로 명시돼 있어, 이 draft 를 못 본 채 그 항목만 보고 작업을 집는 사람은 (a) DROP 이나 (b) 재생성을 실제로 마이그레이션할 위험이 있다 — 그러면 target 이 도출한 (c) 와 충돌하는 인덱스가 생긴다. 이는 사용자 메모리에 기록된 "체크박스 두 곳 동기화 누락" 실패 패턴과 같은 모양이다(`spec-draft-nullable-notation-followups.md` 자신도 `## 종결 조건` 절에 "개수 갱신을 두 번 잊었다"는 자기 경고를 이미 적어 둔 상태라 재발 민감도가 높다)
  - 제안: `spec-draft-nullable-notation-followups.md` L379-397 의 항목 본문을 "실측 완료 — 답은 (c), 상세는 `spec-draft-schedule-index.md` 참조"로 정정하고, L434 종결 조건 표의 해당 행도 같은 취지로 갱신한다(트랙을 `developer/DBA` → `developer`(마이그레이션 V110 실행만 남음)로, "선행 조건"을 "EXPLAIN·테이블 크기"에서 "V110 마이그레이션 적용"으로). 두 draft 가 한 PR 로 합쳐질 예정이면 병합 커밋에서 두 파일을 함께 갱신할 것 — target 의 §5 는 "구현은 같은 PR 의 developer 단계"라고만 적어 두었지 소스 plan 의 체크박스/표 동기화는 언급하지 않는다.

- **[INFO]** 항목 트랙 라벨(`developer/DBA`)과 실제 수행 주체(planner) 불일치
  - target 위치: `plan/in-progress/spec-draft-schedule-index.md` §5(L138-142), frontmatter `owner: planner`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` L379 `(developer/DBA, 2026-09-04 전제 교체)`
  - 상세: 소스 plan 은 이 항목을 `developer/DBA` 트랙으로 표시했는데(EXPLAIN 은 코드 변경이 아니라 devops 작업이라는 전제), 실제로는 planner 가 일회용 컨테이너로 EXPLAIN 측정과 spec 서술 변경까지 수행했다. target §5 는 "인덱스 교체 자체(마이그레이션)만 developer 트랙"이라고 명시해 역할 경계 위반은 아니지만, 소스 plan 의 트랙 라벨은 그 구분을 반영하지 않아 향후 "이 항목은 왜 planner 산출물인 spec-draft 파일로 처리됐는가"를 다시 추적해야 한다.
  - 제안: 위 WARNING 항목의 갱신과 함께 트랙 라벨도 "측정+spec 서술(planner, 완료) / 마이그레이션 실행(developer, 잔여)"로 분리 표기하면 향후 혼선을 없앤다.

## 요약
target 문서(`spec-draft-schedule-index.md`) 자체의 실측·결론(등재된 (a)/(b) 모두 기각, (c) `(workspace_id, next_run_at)` 채택)은 자신이 인용하는 선행 조건(`spec-draft-nullable-notation-followups.md` 의 EXPLAIN·테이블 크기 요구)을 정확히 충족하며, 다른 `plan/in-progress/` 문서와 새로운 충돌을 일으키지도 않는다. 다만 그 선행 plan 의 열린 항목 본문·종결 조건 표가 이 결론을 반영하도록 아직 갱신되지 않아, 두 in-progress 문서가 같은 인덱스에 대해 서로 다른(하나는 미해결, 하나는 해결) 상태를 동시에 주장하는 상태다 — track 이 `developer/DBA` 로 열려 있어 target 을 못 본 작업자가 (a)/(b) 로 갈 위험이 있으므로 병합 전 동기화가 필요하다.

## 위험도
LOW
