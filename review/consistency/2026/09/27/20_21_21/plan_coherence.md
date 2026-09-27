# Plan 정합성 검토 — `spec/2-navigation/` (--impl-prep, cross-workspace-refs 재실행)

## 발견사항

- **[WARNING]** Rationale 정정 문단이 존재하지 않는(그리고 아직 완료되지 않은) plan 경로를 "완료됨"처럼 인용
  - target 위치: `spec/2-navigation/1-workflow-list.md:200` (`## Rationale` §3 "(2026-09-27 정정)" 문단) — `"`plan/complete/cross-workspace-refs.md` 가 생성에도 소속 검사를 더했다"`
  - 관련 plan: `plan/in-progress/cross-workspace-refs.md` (frontmatter `status: in-progress`, 체크리스트 `- [ ] 구현 · 단위 · CHANGELOG · 트래커` 등 5개 항목 미완료) / `plan/in-progress/spec-draft-nullable-notation-followups.md` 1483·1489행 (같은 잘못된 경로로 "PATCH null 후속" 트래커 항목의 "교차 워크스페이스 참조" 칸을 `> **닫음 (2026-09-27, `plan/complete/cross-workspace-refs.md`)**`으로 표시)
  - 상세: `plan/complete/cross-workspace-refs.md`는 이 worktree에 **존재하지 않는다**. 실제 파일은 두 개로 갈려 있다 — (a) planner의 spec draft `plan/complete/spec-draft-cross-workspace-refs.md`(완료, `status: complete`)와 (b) developer의 구현 plan `plan/in-progress/cross-workspace-refs.md`(진행 중, 구현 체크리스트 미완료). 커밋 `a8bfd1492`의 본문조차 "구현은 같은 PR(`plan/in-progress/cross-workspace-refs.md`)"이라고 정확히 적어 두었는데, 같은 커밋이 써 넣은 spec 문장(`1-workflow-list.md:200`)과 tracker 문장(`spec-draft-nullable-notation-followups.md:1483`)은 `plan/complete/cross-workspace-refs.md`라는 제3의(존재하지 않는) 경로를 인용하며 "더했다"(완료 시제)·"닫음"으로 서술한다. 폴더 **생성** 경로의 소속 검사는 spec에만 기술됐을 뿐 아직 코드로 구현되지 않았다(`plan/in-progress/cross-workspace-refs.md` §체크리스트 — "구현·단위·CHANGELOG·트래커" 미체크, "뮤턴트"·"TEST WORKFLOW"·`/ai-review`·`--impl-done` 전부 미완료). 즉 target 문서가 가정하는 선행 조건("plan이 이 구현을 완료해 닫혔다")이 plan에서 아직 해소되지 않은 상태다. `spec-draft-nullable-notation-followups.md`가 이 항목을 "닫음"으로 봉인해 두면, 이후 이 tracker만 보는 사람은 교차 워크스페이스 검사가 이미 코드에 반영된 것으로 오인할 수 있다(§2.3.1 필드 권한 매트릭스 등 다른 트리거/워크플로 API 서술도 같은 모델 설정 참조 규칙을 전제하므로 영향 범위가 넓다).
  - 제안: (1) `spec/2-navigation/1-workflow-list.md:200`의 인용 경로를 `plan/in-progress/cross-workspace-refs.md`로 정정하고, 구현이 아직 진행 중임을 반영하려면 "더했다"(완료형)를 "더한다"(계획/처방형)로 낮추거나 완료 후(`--impl-done` 통과 시점)에 확정하는 편이 안전하다. (2) `plan/in-progress/spec-draft-nullable-notation-followups.md:1483,1489`의 "닫음" 인용도 동일하게 `plan/in-progress/cross-workspace-refs.md`로 경로를 고치고, 실제 구현·리뷰·`--impl-done`이 끝난 뒤 "닫음"으로 표시하거나(그 전엔 "진행 중, 규칙은 spec에 반영됨" 정도로) 시제를 낮춘다. 두 문서 모두 developer 소유(plan/**)이므로 planner 턴 없이 developer가 직접 정정 가능한 범위다.

## 요약

이번 `--impl-prep` 재실행이 확인해야 할 두 Critical 문장(§3.1 폴더 생성·Rationale §3) 자체는 새 규칙(`spec/1-data-model.md` §1.1)과 내용상 정합하다 — spec-first로 목표 계약을 먼저 적어 두고 같은 PR에서 코드가 뒤따르는 것은 이 프로젝트의 정상적인 흐름이며 CLAUDE.md 위반이 아니다. 다만 Rationale §3의 "(2026-09-27 정정)" 문단과 `spec-draft-nullable-notation-followups.md` 트래커가 인용하는 `plan/complete/cross-workspace-refs.md`는 실재하지 않는 경로이며, 실제 구현 plan(`plan/in-progress/cross-workspace-refs.md`)은 구현·리뷰·`--impl-done` 모두 미완료 상태다. spec과 tracker가 "이미 닫힌 plan"인 것처럼 서술해 두면, 이 PR이 지연되거나 다른 세션이 tracker만 보고 판단할 때 "코드에 이미 반영됐다"는 거짓 전제를 심을 위험이 있다 — 선행 plan이 실제로는 미해소라는 점에서 WARNING으로 판정한다. 그 외 target 범위(`spec/2-navigation/**`)가 참조하는 다른 in-progress plan(marketplace-and-plugin-sdk.md의 미해결 결정 4건, spec-draft-nullable-notation-followups.md의 다른 미해소 칸들)과의 직접적 충돌은 발견하지 못했다.

## 위험도

MEDIUM
