# Plan 정합성 검토 — target: `spec/conventions/` (scope, `--impl-done`)

## 검토 맥락

`--impl-done` 시점 재검토다. 직전 `--impl-prep` 게이트(`review/consistency/2026/09/18/22_44_08/plan_coherence.md`,
위험도 NONE)와 대상·구조가 동일하므로, 그 결론이 구현 완료(V121~V130 적용 + 트래커 반영 진행 중)로 무효화됐는지를
중심으로 재확인했다.

`spec/conventions/` 는 `origin/main` 대비 diff 0 — 이번 PR 은 이 영역을 건드리지 않는다. 실제 diff 는
`codebase/backend/migrations/V121~V130` (10쌍 `.sql`/`.conf`) · `spec/1-data-model.md` · `spec/data-flow/*.md` 6개 ·
`plan/in-progress/spec-draft-fk-remaining-dispositions.md` · `plan/in-progress/spec-draft-nullable-notation-followups.md` ·
`plan/complete/spec-draft-deletion-cascade-indexes.md` · `review/**` 산출물이다. `spec/conventions/migrations.md`
는 `code:` 에 `codebase/backend/migrations/**` 를 걸어 두어(=`code:` 매칭으로) 스코프에 들어온 target 이다.

## 대조한 것

- `spec/conventions/migrations.md`(target, 변경 없음) §2 "신규 V번호는 항상 main 의 max+1" · §5 "인덱스를 만드는
  마이그레이션은 별도 패턴" (DROP-먼저) vs 실제 구현 — `git diff origin/main...HEAD --stat -- codebase/backend/migrations/`
  로 V121~V130 파일 20개(각 `.sql`+`.conf`) 확인.
- `plan/in-progress/spec-draft-fk-remaining-dispositions.md` (현재 작업 draft, `--impl-done` 직전 상태 — 체크리스트
  마지막 두 항목 `[ ] --impl-done` · `[ ] 트래커·부록 반영·이동` 만 미완).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (상위 트래커) — grep `V121\|V122\|…\|V130`,
  `선두 인덱스가 없는 FK`, `웹훅 트리거`, `3섹션 구조 편차`.
- `plan/in-progress/**` 전수 grep `V12[1-9]|V130` — draft·트래커 두 파일 외 어디도 이 번호를 언급/선점하지 않음.
- 작업 트리 uncommitted diff(`plan/complete/spec-draft-deletion-cascade-indexes.md` 부록 갱신,
  `spec-draft-nullable-notation-followups.md` 트래커 갱신) — draft 의 "트래커 반영" 절이 예고한 내용과 실제 갱신
  내용을 줄 단위로 대조.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** V121~V130 실제 파일명·컬럼 매핑이 draft 처분표와 정확히 일치 — 정합 확인
  - target 위치: `spec/conventions/migrations.md` §1(명명 규약)·§2(V번호 정책)
  - 관련 plan: `plan/in-progress/spec-draft-fk-remaining-dispositions.md` "## 처분 — 31개" 표
  - 상세: draft 표의 V121=`edge.target_node_id` … V130=`model_config.workspace_id`(workspace_id, kind) 매핑이
    `codebase/backend/migrations/V121__edge_target_node_id_index.sql` … `V130__model_config_workspace_kind_index.sql`
    실물과 1:1 일치. 착수 시점(main `6f97cb619`, max V120) 이후 다른 in-progress plan 이 V121+ 를 선점하지 않아
    §2 "max+1 단조 증가" 와 충돌 없음(`check-migration-versions.py` 실행 결과도 draft 체크리스트에 `OK: 130
    migration(s), max V130` 로 기록).
  - 제안: 조치 불요.

- **[INFO]** "트래커 반영" 마지막 체크리스트 항목이 예고대로 실행 중 — 정합
  - target 위치: 없음(target 비변경)
  - 관련 plan: `plan/in-progress/spec-draft-fk-remaining-dispositions.md` "## 트래커 반영" 절 vs
    uncommitted `plan/complete/spec-draft-deletion-cascade-indexes.md`(부록 28행 갱신 + 셈법 보정 3행 추가) ·
    uncommitted `spec-draft-nullable-notation-followups.md`(라인 4616 `[x]` 해소, 라인 4632·4644 새 항목 2건 추가)
  - 상세: draft 가 예고한 네 가지("«선두 인덱스가 없는 FK» `[x]` 해소" · "웹훅 트리거 조회 새 항목" ·
    "`WorkflowAssistantSession` `@Index` 누락 새 항목" · "spec/conventions/ 3섹션 구조 편차 새 planner 항목" ·
    "부록 28행 + 놓친 셋 갱신")이 현재 작업 트리에 정확히 반영돼 있다. `spec/conventions/` 3섹션 편차 항목은
    "결정할 것: 관례로 맞출지 예외로 둘지"로 **미해결 결정으로 정직하게 남겨져** 있고, target(`migrations.md`
    등)도 이 결정을 우회해 구조를 바꾸지 않았다 — 목표하는 정합 상태.
  - 제안: 조치 불요 — draft 체크리스트의 남은 두 항목(`--impl-done` 자체, draft `complete/` 이동)이 완료되면
    이 시퀀스는 종결된다.

- **[INFO]** `spec/conventions/` 3섹션 구조 편차 미해결 결정은 이번 target 상태와 계속 무충돌
  - target 위치: `spec/conventions/migrations.md` §7 "폐기 대안 (Rationale)" + `## 참고`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 라인 4644~4648
  - 상세: target(`migrations.md`)은 여전히 번호 붙은 `## 7. 폐기 대안 (Rationale)` 뒤에 `## 참고` 가 오는 기존
    구조 그대로다. 트래커는 이를 "결정할 것(관례로 맞출지/예외로 둘지)"으로만 등재했고, 이번 PR 은 이 구조에
    손대지 않았다 — 미해결 결정을 일방적으로 정하거나 우회하지 않았다.
  - 제안: 조치 불요.

## 요약

target(`spec/conventions/`)은 이번 PR 에서 diff 0 이며, 실제 변경(코드 마이그레이션 V121~V130 + `spec/1-data-model.md`·
`data-flow/*` 6개 + `plan/**` 트래커 반영)은 `spec/conventions/migrations.md` 가 정한 V번호 정책·CONCURRENTLY
재실행 패턴과 충돌 없이 그 규약을 그대로 따른다. `plan/in-progress/spec-draft-fk-remaining-dispositions.md` 의
"트래커 반영" 마지막 단계는 예고한 내용 그대로 진행 중이며, 새로 등재한 "spec/conventions/ 3섹션 구조 편차"·
"웹훅 트리거 조회" 두 미해결 결정 항목도 target 이 우회하지 않고 그대로 열어 둔 상태다. `--impl-prep` 단계에서
확인된 무충돌 지점(V번호 할당·CONCURRENTLY 패턴·`mixed=true` 미도입 결정)은 구현 완료 후에도 그대로 유지된다.
미해결 결정 우회, 선행 plan 미해소, 후속 항목 누락 어느 것도 발견되지 않았다.

## 위험도

NONE
