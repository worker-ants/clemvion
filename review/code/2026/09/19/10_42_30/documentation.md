# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** spec Rationale 이 아직 존재하지 않는 `plan/complete/` 경로를 인용한다 (전방 참조·잠재적 broken link)
  - 위치: `spec/1-data-model.md:1002`("근거: `plan/complete/spec-draft-code-guards-and-change-summary.md`.") ·
    `spec/3-workflow-editor/0-canvas.md:809`("정정했다. 근거: `plan/complete/spec-draft-code-guards-and-change-summary.md`.")
  - 상세: 두 spec 파일의 새 Rationale(§`code:` 에 전용 e2e 가드 셋 / R-5)이 근거로 인용하는 plan 문서는 이 diff 시점에 `plan/complete/spec-draft-code-guards-and-change-summary.md` 가 아니라 `plan/in-progress/spec-draft-code-guards-and-change-summary.md` 에 있다(실측: `plan/complete/` 하위에 해당 파일 부재, `plan/in-progress/` 에만 존재). 그 plan 자신의 체크리스트도 "spec 반영"·"가이드 정정 · lint · unit · build · `/ai-review`"·"트래커 두 항목 닫기 · 이 draft `plan/complete/` 로" 세 항목이 아직 `[ ]`(미완료)로 남아 있어, 이동이 아직 일어나지 않았음을 스스로 확인해 준다. `spec/1-data-model.md` 안의 다른 기존 Rationale 항목 6개는 전부 `plan/complete/spec-draft-*.md` 형태로 실재하는(이미 이동된) 경로를 인용한다 — 이번 두 신규 인용만 그 관례를 깨고 아직 없는 경로를 가리킨다. `.claude/docs/plan-lifecycle.md §3` 은 "이동은 마지막 작업 PR 안에서"(체크박스 전부 `[x]` + 이동을 같은 PR 마지막 커밋에서) 라고 규정하므로, 이 상태는 그 마지막 커밋이 아직 오지 않은 정상적인 중간 상태일 가능성이 높다 — 그러나 그 마무리 커밋(체크리스트 갱신 + `git mv plan/in-progress/... plan/complete/...`)이 빠진 채 머지되면 두 Rationale 의 "근거" 링크는 영구히 깨진 참조로 남는다.
  - 제안: 이 PR 을 마무리하기 전에 (1) plan 체크리스트의 "spec 반영"·"가이드 정정" 항목을 실제 상태(이미 diff 에 반영됨)에 맞게 `[x]` 로 갱신하고, (2) 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`) 두 항목을 닫고, (3) `plan/in-progress/spec-draft-code-guards-and-change-summary.md` 를 `plan/complete/` 로 `git mv` 해 두 spec 인용이 실재 경로를 가리키게 할 것. 세 동작을 같은 PR 의 마지막 커밋으로 묶는다(별도 PR 로 분리 금지 — plan-lifecycle.md §3).

## 요약

이번 변경은 사용자 가이드(`version-history.mdx`/`.en.mdx`)와 두 spec 문서(`1-data-model.md`, `3-workflow-editor/0-canvas.md`)가 존재하지 않는 "저장 시 changeSummary 수동 입력" 기능을 계속 약속하던 드리프트를 실제 코드 동작(저장 API 는 `changeSummary` 를 받지 않고, 복원만 서버가 `Restored from vN` 을 채운다 — `save-canvas.dto.ts`·`workflows.service.ts`·`workflows.ts` 로 직접 대조 확인)에 맞춰 정정하는 문서 전용 PR이다. ko/en 가이드 문구는 의미·구조가 정확히 대응하고, spec Rationale 은 근거(코드 인용·타 spec 대조 10줄 전수)를 충실히 남겼으며, `code:` frontmatter 신규 3개 e2e 경로도 전부 실존하고 다른 spec 의 `code:` 와 충돌하지 않는다. 유일한 결함은 두 spec Rationale 이 아직 `plan/in-progress/` 에 머물러 있는 plan 을 `plan/complete/` 경로로 앞서 인용한 것 — 이 저장소의 기존 6개 선례와 어긋나는 전방 참조이며, PR 마무리 커밋(plan 이동 + 체크리스트 갱신)이 뒤따르지 않으면 깨진 링크로 굳는다. README·API 문서·CHANGELOG 업데이트는 이번 변경 범위(순수 문서/spec 정정, 동작 변경 없음)에 해당하지 않으며, 직전 유사 `docs(spec)` 커밋(`cef3687f2`)도 CHANGELOG 를 건드리지 않아 관례와 일치한다.

## 위험도

LOW
