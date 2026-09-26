# Plan 정합성 검토 — `spec/2-navigation/` (impl-prep, 실질 대상 `plan/in-progress/canvas-save-typed.md`)

## 검토 범위

번들 예산으로 `spec/2-navigation/` 하위 15개 파일 중 본문이 실린 것은 `1-workflow-list.md` ·
`2-trigger-list.md` · `3-schedule.md`(일부) 뿐이었다. 나머지는 "의도된 절단" 표시만 있어 직접
`Read` 로 확인했어야 하나, 이번 구현 대상(`canvas-save-typed.md`)이 건드리는 코드
(`workflows.service.ts` `saveCanvas`/`restoreVersion`, `CanvasSaveResultDto`)의 소유 spec 은
`1-workflow-list.md`(frontmatter `code: modules/workflows/dto/**`) 로 한정되므로, 이 문서와
그 `pending_plans`(`marketplace-and-plugin-sdk.md`, 완료된 `workflow-duplicate-nodes-edges.md`),
`2-trigger-list.md` 의 `pending_plans`(`spec-draft-nullable-notation-followups.md`), 그리고
`plan/in-progress/canvas-save-typed.md` 자신 + 이 plan 이 닫으려는 트래커 항목을 실제로 열어
대조했다.

## 발견사항

없음 — CRITICAL/WARNING 급 불일치를 찾지 못했다.

아래는 조사했으나 기각한 후보들이다 (판단 근거를 남긴다):

- **트래커 항목 자체는 "결정 필요" 가 아니다.** `plan/in-progress/spec-draft-nullable-notation-followups.md:1307`
  의 `CanvasSaveResultDto.nodes`/`.edges` 항목은 같은 문서의 "종결 조건" 표(`§5.4 drift 2단계`)가
  이미 "남은 것은 선행 조건이 아니라 스윕이다" 라고 명시한 대상이다. `canvas-save-typed.md` 가 이
  항목을 미해결 결정 우회 없이 닫는 것으로 판단했다.
- **`ExportWorkflowDto.nodes`/`.edges` 후속 등재 — 이미 계획에 반영됨.** `canvas-save-typed.md`
  "방향 §5" 가 조사 중 발견한 `ExportWorkflowDto` 의 동일 갭(단, index 정규화라 새 DTO 필요)을
  새 트래커 항목으로 등재하겠다고 명시한다. 트래커에 기존 중복 항목이 없음을 확인했다
  (`grep -n "ExportWorkflowDto" spec-draft-nullable-notation-followups.md` → `formatVersion` 항목
  1건뿐, nodes/edges 항목 없음) — 후속 항목 누락이 아니라 이미 처리 경로가 계획돼 있다.
- **`NodeDto`/`EdgeDto` 명명 충돌 이슈는 무관.** `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md`
  의 "추가 위임 #11" 이 Graph RAG 시각화의 "노드/엣지" 가 캔버스 `NodeDto`/`EdgeDto` 와 이름이
  겹친다는 문서화 누락을 지적하지만, 이는 **다른 도메인(KB Graph 시각화)의 별칭 문서화 요청**이고
  기존 `NodeDto`/`EdgeDto` 클래스 자체의 이름을 바꾸자는 결정이 아니다. `canvas-save-typed.md` 는
  기존 `NodeDto`/`EdgeDto` 를 그대로 참조만 하므로 충돌하지 않는다.
  - `plan/in-progress/spec-sync-auth-gaps.md:48` 의 `saveCanvas`/`restoreVersion` 감사 로깅
    미구현 항목도 같은 함수를 걸지만 층이 다르다(감사 기록 여부 vs 응답 DTO 타입 선언) — 이
    plan 이 그 열린 항목을 무효화하거나 전제하지 않는다.
- **`1-workflow-list.md` frontmatter `pending_plans` 미포함은 이 plan 탓이 아니다.** 이 문서의
  `pending_plans` 에는 `spec-draft-nullable-notation-followups.md` 가 없다(`2-trigger-list.md` 만
  갖고 있음). 하지만 `1-workflow-list.md` 본문이 "미구현 (Planned)" 으로 명시한 건 §2.7 마켓
  템플릿 링크 하나뿐이고, `CanvasSaveResultDto` 타입 선언 갭은 spec 본문이 약속한 기능 surface 가
  아니라 내부 OpenAPI 선언 정확도 문제라 `spec-impl-evidence.md` R-5 의 "미구현 surface" 판정
  대상이 아니다 — `pending_plans` 누락으로 보지 않는다. `canvas-save-typed.md` 의
  `spec_impact: none` 과도 정합적이다(spec 본문이 원소 형태를 서술하지 않으므로 변경 불필요).

## 요약

`plan/in-progress/canvas-save-typed.md` 는 `spec-draft-nullable-notation-followups.md` 가 이미
"선행 조건 없는 스윕" 으로 분류해 둔 단일 항목(`CanvasSaveResultDto.nodes`/`.edges` 타입 선언)을
닫는 좁은 범위의 작업이며, 같은 코드를 건드리는 다른 in-progress plan(감사 로깅, GraphViz 명명)과는
층이 달라 충돌하지 않는다. spec 본문(`1-workflow-list.md`, `3-workflow-editor/5-version-history.md`
§7.3)도 응답 원소 형태를 규정하지 않으므로 `spec_impact: none` 판단이 정합적이고, 발견하면서 나온
새 후속 항목(`ExportWorkflowDto`)도 plan 자체에 등재 경로가 이미 있다. Plan 정합성 관점에서 차단
사유를 찾지 못했다.

## 위험도

NONE
