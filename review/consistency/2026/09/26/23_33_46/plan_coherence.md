### 발견사항

- **[INFO]** 트래커 항목이 아직 "해소" 로 갱신되지 않음 (완료 임박, 이미 plan 자체가 인지)
  - target 위치: 구현 diff (`codebase/backend/src/modules/workflows/dto/responses/workflow-response.dto.ts` 등, `ExportedNodeDto`/`ExportedEdgeDto` 신설)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:1315` — `**ExportWorkflowDto.nodes/.edges 도 타입 없는 객체 배열이다**` 항목이 여전히 `[ ]` 미체크이고, 본문도 "재사용할지 응답 전용 DTO 를 둘지... 정하는 것이 선행이다" 라는 **미결 문구 그대로** 남아 있다.
  - 상세: `export-workflow-typed` 브랜치(커밋 `b39ddd802`)가 이 항목이 제기한 결정(재사용 vs 응답 전용 DTO)을 실측으로 "응답 전용 DTO" 로 확정하고 실제로 구현까지 마쳤다. 그런데 트래커 항목 텍스트는 아직 그 해소를 반영하지 않아, 다른 독자가 보면 여전히 미결정처럼 읽힌다. 다만 이는 은폐된 갭이 아니라 — `plan/in-progress/export-workflow-typed.md` 자신의 체크리스트에 `- [ ] --impl-done` / `- [ ] 트래커 항목 닫기` 로 이미 다음 단계로 명시되어 있고, 자매 항목(같은 파일 1307~1313행 `CanvasSaveResultDto.nodes/.edges`)이 `canvas-save-typed` 완료 시 `[x]` + "해소" 문구로 갱신된 선례가 존재해 처리 패턴이 확립되어 있다.
  - 제안: `--impl-done` 통과 후 마무리 커밋에서 `spec-draft-nullable-notation-followups.md:1315` 항목을 `[x]` 로 체크하고, 자매 항목과 동일한 형식(`**2026-09-26 해소** plan/complete/export-workflow-typed.md — ...`)으로 본문을 갱신할 것. (plan `export-workflow-typed.md` 체크리스트가 이미 이 작업을 인지하고 있으므로 새 결정 필요 없음 — 실행 누락 방지 차원의 메모.)

기타 확인 사항 (문제 없음, 근거만 기록):
- `spec/2-navigation/` scope 델타 0, `export-workflow-typed.md` `spec_impact: none` — diff(`git diff --stat origin/main...HEAD`)가 `codebase/` 3파일 133줄, `plan/` 2파일 123줄뿐이고 `spec/` 변경 0으로 실측 일치. DTO 신설은 선언 정밀화(§5.4 nullable 표기)일 뿐 와이어 포맷 변경이 아니라 `spec/2-navigation/1-workflow-list.md §3.2`(SoT: `import-workflow.dto.ts`/`ExportWorkflowDto`)와 충돌 없음.
- `1-workflow-list.md` frontmatter `pending_plans: marketplace-and-plugin-sdk.md`(Phase A 가 "기존 워크플로 export/import 흐름 재사용" 전제) — 이번 PR 은 export JSON 포맷 자체를 바꾸지 않고 응답 DTO 선언만 정밀화했으므로 마켓플레이스 plan 의 전제와 충돌 없음.
- `2-trigger-list.md` frontmatter `pending_plans: spec-draft-nullable-notation-followups.md` — 같은 트래커 파일이지만 이 PR 이 건드린 §9.4 관련 보강(줄 3652~3655)은 기존 `planner` 소유 항목에 인용 추가로 붙인 것으로, 결정 권한을 developer 가 가로채지 않음(WARNING 성 충돌 아님).

### 요약
이번 PR(`export-workflow-typed`)은 `spec/2-navigation/` 을 전혀 건드리지 않는 코드 전용 변경으로, `spec_impact: none` 선언이 실측과 일치하고 해당 spec 이 문서화한 export DTO SoT 서술과도 충돌하지 않는다. 트래커 `spec-draft-nullable-notation-followups.md` 의 해당 결정 항목을 developer 역할 범위 안에서 정당하게 해소했으나, 그 트래커 항목의 체크박스·본문 갱신이 아직 반영되지 않은 상태다 — 다만 이는 plan 자신의 남은 체크리스트(`--impl-done`, `트래커 항목 닫기`)에 이미 명시된 예정된 마무리 작업이라 은폐된 정합성 결함은 아니다. 다른 in-progress plan(마켓플레이스, 트리거 목록 등)의 선행 조건이나 미해결 결정과의 충돌도 발견되지 않았다.

### 위험도
LOW
