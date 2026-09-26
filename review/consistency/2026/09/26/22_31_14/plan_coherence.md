# Plan 정합성 검토 — canvas-save-typed (`--impl-done`, scope=spec/2-navigation/)

## 검토 범위 확인

- `spec/2-navigation/` 스코프 델타: 0 파일 (예상대로 — 이 PR 은 코드 전용).
- 구현 diff(3파일/165줄, `origin/main..HEAD`): `codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts`(+`.spec.ts`) · `codebase/backend/test/workflow-crud.e2e-spec.ts`. `CanvasSaveResultDto.nodes`/`.edges` 를 `Record<string, unknown>[]` → `NodeDto[]`/`EdgeDto[]` 로 선언 변경.
- 변경 파일은 `spec/2-navigation/1-workflow-list.md` 의 `code:` glob(`codebase/backend/src/modules/workflows/dto/**`)에 걸리지만, 실제로 바뀐 클래스(`CanvasSaveResultDto`)는 캔버스 저장·버전 복원(spec/3-workflow-editor 영역) 응답이지 워크플로우 목록 기능과 무관하다 — glob 의 우연한 광의성이며 충돌 아님.
- `CanvasSaveResultDto` 사용처는 `workflows.controller.ts` 의 save/restore 두 엔드포인트뿐(grep 확인) — plan 이 서술한 영향 범위와 일치, 숨은 소비자 없음.

## 발견사항

- **[WARNING] 트래커 항목을 닫기로 한 계획이 실행되지 않음(부분 이행)**
  - target 위치: `plan/in-progress/canvas-save-typed.md` `## 방향` 항목 5 — "**트래커** — 이 항목을 닫고, 조사 중 발견한 `ExportWorkflowDto.nodes`/`.edges` … 를 새 항목으로 등재한다."
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1307행 `- [ ] **CanvasSaveResultDto.nodes/.edges 가 타입 없는 객체 배열**` (이 파일은 `spec/2-navigation/2-trigger-list.md` frontmatter `pending_plans` 가 참조하는 바로 그 트래커)
  - 상세: `git diff origin/main -- plan/in-progress/spec-draft-nullable-notation-followups.md` 로 확인하면 이번 PR 은 신규 항목("`ExportWorkflowDto.nodes`/`.edges` 도 타입 없는 객체 배열이다", 1313행)만 **추가**했고, 자신이 닫겠다고 명시한 원본 1307행 항목은 여전히 `- [ ]`(미체크) 상태다. 구현(diff)·뮤턴트 3건 KILLED·e2e 413·`/ai-review` 2R Critical 0 · Warning 0 로 실질적으로 완료됐음에도, 그 사실이 트래커에 반영되지 않아 이 트래커를 참조하는 다른 세션(예: `2-trigger-list.md` 의 `spec-draft-nullable-notation-followups.md` 관련 작업자)이 "CanvasSaveResultDto 타입 미선언" 을 여전히 미해결 항목으로 오인할 수 있다.
  - 참고: `plan/in-progress/canvas-save-typed.md` 자체 체크리스트도 `[ ] 트래커 항목 닫기` 를 아직 미체크로 남겨 self-aware 하게 추적 중이므로 "누락을 못 알아챈" 상태는 아니다 — 다만 사용자가 "머지했어" 라고 선언한 시점 기준으로는 이 후속 조치가 아직 반영되지 않았다는 뜻이므로, 마무리 전에 닫아야 한다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1307행 항목을 체크(`[x]`)하고 "canvas-save-typed 로 해소(커밋 `04f603996`)" 등 처분 근거를 한 줄 추가. 이어서 `plan/in-progress/canvas-save-typed.md` 의 남은 체크리스트(`--impl-done` · `트래커 항목 닫기`)를 완료한 뒤 plan-lifecycle 절차대로 `plan/complete/` 로 이동.

## 요약

이 PR 은 `spec/2-navigation/` 본문·API 계약을 전혀 바꾸지 않는 코드 전용 변경(캔버스 저장/복원 응답의 `nodes`/`edges` 타입 선언)이며, `spec/2-navigation` 이 남겨둔 미해결 결정과 충돌하거나 그 전제 조건에 의존하는 지점은 없다. 유일한 정합성 결함은 이 PR 스스로가 "닫겠다" 고 선언한 `spec-draft-nullable-notation-followups.md` 1307행 트래커 항목이 실제로는 체크되지 않은 채 남아, 새로 등재한 후속 항목(`ExportWorkflowDto`)만 추가된 부분 이행 상태라는 점이다. 차단 사유는 아니며 마무리 커밋에서 트래커 체크박스만 동기화하면 해소된다.

## 위험도

LOW
