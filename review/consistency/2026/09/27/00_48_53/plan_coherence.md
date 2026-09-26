# Plan 정합성 검토 — `spec/3-workflow-editor/` (workflow-version-creator, --impl-done)

## 발견사항

- **[INFO]** 트래커 두 항목의 종결(체크 처리)이 아직 반영되지 않음
  - target 위치: (spec 자체는 무변경 — `spec_impact: none`)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1026행(`workflow-versions.service.ts` 공유 `select` 6키 상수화) · 1036행(`WorkflowVersion*Dto.creator` §5.4 금지 조합) — 둘 다 여전히 `- [ ]`
  - 상세: `plan/in-progress/workflow-version-creator.md` 체크리스트는 두 항목을 이 PR 이 닫을 대상으로 명시했고, 구현(DTO 필수화·래칫 4행 감소·`VERSION_METADATA_SELECT` 상수화)은 diff 로 확인된다(`workflow-version-response.dto.ts`·`workflow-versions.service.ts`·`swagger-dto-contract.spec.ts` -4행). 그러나 트래커 파일의 해당 두 항목은 아직 완료 각주 없이 미체크 상태이고, `workflow-version-creator.md` 자체의 체크리스트도 `[ ] --impl-done` · `[ ] 트래커 두 항목 닫기` 를 미체크로 남겨 두었다. plan 자신이 "마무리 커밋에서 처리" 라고 이미 명시한 잔여 단계이므로 결함이 아니라 **정상적인 in-progress 상태**다.
  - 제안: 이번 `--impl-done` 통과 후 마무리 커밋에서 (1) 트래커 1026·1036행에 완료 각주 추가, (2) `workflow-version-creator.md` 의 남은 두 체크박스 처리 및 `plan/complete/` 이동을 함께 수행할 것 (별도 조치 불요, 확인 목적의 기록).

- **[INFO]** `5-version-history.md` 기존 spec 이격(§7.2 타입명 `WorkflowVersion`, `## Rationale` 부재)은 이 PR 범위 밖으로 올바르게 격리됨
  - target 위치: `spec/3-workflow-editor/5-version-history.md` §7.2 (108행 `응답: WorkflowVersion 단건…`), 문서 전체(`## Rationale` 섹션 없음)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1056~1062행 (2026-09-27 신규 planner 항목으로 등재, `workflow-version-creator` `--impl-prep` W1·W2 인용)
  - 상세: 실측 결과 §7.2 는 실제 응답 DTO 명(`WorkflowVersionDto`)이 아닌 엔티티명(`WorkflowVersion`)을 쓰고 있고(형제 §7.1 은 `WorkflowVersionListItemDto[]` 로 정확), 이 spec 문서에만 `## Rationale` 섹션이 없다 — 둘 다 사실이며 이 PR 이 만든 것이 아니라 기존 상태다. `developer` 는 `spec_impact: none` 을 선언했고 spec 을 고치지 않았다(자기-반증형 소정정 조건의 대상도 아님 — developer 가 쓴 예고 문장이 아니라 기존 spec 오기). planner 항목으로 소급 등재해 governance 경계(spec 변경은 planner)를 지켰다.
  - 제안: 조치 불요. 등재된 planner 항목이 이미 목적을 달성했다.

- **[INFO]** 미해결 결정과의 충돌 없음 / 다른 in-progress plan 과의 교차 참조 없음
  - target 위치: `spec/3-workflow-editor/*` 전체(diff 대상 코드는 `modules/workflow-versions/**`)
  - 관련 plan: 전체 `plan/in-progress/**` 중 "workflow-version"/"WorkflowVersion"/"workflow_version" 을 언급하는 파일은 `workflow-version-creator.md` 자신과 `spec-draft-nullable-notation-followups.md` 둘뿐이다. 트래커 전체에서 "결정 필요"/"미해결" 마커를 검색해도 이 PR 이 다루는 `creator`·`changeSummary`·공유 `select` 와 관련된 항목은 없다(트래커의 다른 "결정 필요" 항목들은 무관한 주제 — export 노출 창, 캔버스 저장 시 실행 이력 보존 정책 등).
  - 상세: 트래커 항목 1036 의 "프런트엔드 미러도 같은 턴에 봐야 한다" 지시는 plan 본문에서 실제로 검토됐고("바꾸지 않는다" + 근거: 프런트가 더 넓어 런타임 안전, 방어 코드·테스트 존재) — 지시를 우회한 것이 아니라 수행 후 비변경으로 귀결한 것이다.
  - 제안: 없음.

## 요약
이 PR 은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 두 계류 항목(1026·1036행)을 정확히 겨냥해 구현했고, 실행 방향·wire 불변 원칙·프런트엔드 미러 비변경 결정이 트래커 항목의 지시와 일치한다. spec 델타는 0(`spec_impact: none`)이며, 발견된 두 개 기존 spec 이격(§7.2 타입명·Rationale 부재)은 이번 PR 이 만든 것이 아니고 governance 경계를 지켜 planner 트래커 항목으로 소급 등재됐다. 다른 in-progress plan 과의 교차 의존·충돌도 없다. 유일하게 남은 것은 트래커 항목 체크 처리와 `workflow-version-creator.md` 자체의 마지막 두 체크박스인데, 이는 plan 이 스스로 "마무리 커밋에서" 라고 예고한 정상적인 잔여 단계이지 정합성 결함이 아니다.

## 위험도
NONE
