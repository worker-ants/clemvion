## 발견사항

- **[INFO]** `ai-agent-tool-connection-rewrite.md` — ConditionDef.id 는 간접 접점
  - target 위치: `spec-draft-port-id-uuid-slug.md` 변경안 #5 (`3-ai/1-ai-agent.md §2 ConditionDef.id` 줄에 slug-regex 통과 명료화 추가)
  - 관련 plan: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §3 Spec 작성 — `spec/4-nodes/3-ai/1-ai-agent.md` 에 신규 tool 연결 모델 명세 예정 (§결정 기록 전원 TBD, 미착수)
  - 상세: target 이 `1-ai-agent.md §2 ConditionDef.id` 행에 parenthetical 설명("UUID v4 는 slug-regex 통과 유효 포트 ID — 노드 §1.3")을 추가한다. tool-rewrite plan 은 미착수이며 §2(config 스키마 표)가 아닌 §6.1(dispatcher 분류 순서 표) 및 Tool Area 박스를 대상으로 하므로, 동일 파일 다른 섹션이다. hunk 충돌 위험은 낮다. 그러나 tool-rewrite plan §3 이 활성화될 때 `1-ai-agent.md` 전반을 편집하게 되므로, 본 target 의 §2 추가 parenthetical 을 그대로 보존하는지 유의해야 한다.
  - 제안: 양측 plan 이 다른 섹션을 건드려 즉각 충돌은 없음. tool-rewrite plan 이 활성화되는 시점에 §2 ConditionDef.id 행의 parenthetical 이 소실되지 않도록 tool-rewrite plan 체크리스트에 한 줄 메모를 추가하는 것이 좋다(INFO 수준, 차단 아님).

- **[INFO]** `node-output-redesign/switch.md` — Switch case.id 를 `port: <case.id>` 로 사용하는 설명이 slug-regex 혼합 모델과 정합임을 명시적으로 확인
  - target 위치: 변경안 #2 (`4-nodes/1-logic/0-common.md §7` — "생성 시 UUID v4 를 할당" 정정)
  - 관련 plan: `plan/in-progress/node-output-redesign/switch.md` — `port: <case.id> | 'default'` 를 사용하며 Principle 5+6 준수로 기록
  - 상세: switch.md 는 port 값이 `case.id` 형태라고 서술하며 uuid 또는 slug 포맷을 명시하지 않는다. target 이 `0-common.md §7` 을 "slug-regex 만족 stable id" 로 교정하면 `node-output-redesign/switch.md` 의 기술과 모순 없이 정합된다. 변경 충돌 없음.
  - 제안: 특별 조치 불필요. 정합 확인 메모 수준.

- **[INFO]** `spec-draft-conventions-code-data.md` — `4-nodes/0-overview.md §2.5` 를 이미 수정했으므로 target 의 신규 `## Rationale` 섹션과 동일 파일 편집 접점 존재
  - target 위치: 변경안 #6 (`4-nodes/0-overview.md ## Rationale 신설`)
  - 관련 plan: `plan/in-progress/spec-draft-conventions-code-data.md` — 이미 `spec/4-nodes/0-overview.md §2.5` 를 변경했으며, 해당 plan 은 완료 상태(체크박스 전부 ✅)
  - 상세: `spec-draft-conventions-code-data` plan 은 이미 머지된 것으로 보이며(체크박스 전부 완료), `0-overview.md §Rationale` 신설이 아닌 `§2.5` 포트 수 정정이 대상이다. 섹션이 달라 hunk 충돌 없음. 단, 해당 plan 이 아직 별도 worktree 에 있다면 rebase 시 0-overview.md 의 동일 파일 편집이 교차할 수 있으나, 섹션(`§2.5` vs `## Rationale`)이 달라 실제 충돌 가능성은 낮다.
  - 제안: 특별 조치 불필요. `spec-draft-conventions-code-data` 가 main 에 이미 반영됐다면 완전 무관.

## 요약

`spec-draft-port-id-uuid-slug.md` target 은 순수 spec-text 교정(코드 변경 없음) 으로, 미해결 결정을 우회하거나 충돌하는 측면이 없다. 가장 가까운 접점은 `ai-agent-tool-connection-rewrite.md` 인데 이 plan 의 핵심 설계 결정들(도구 등록 모델 등 5개 항목)은 전부 TBD 로 미착수이며 target 이 건드리는 `1-ai-agent.md §2 ConditionDef.id` 행과는 다른 섹션(§6.1 dispatcher 표 + Tool Area)이다. target 이 일방적으로 그 plan 의 미해결 결정을 내리는 내용은 없다. `1-logic/0-common.md §7` 의 "UUID v4 할당" 정정, `3-workflow-editor/1-node-common.md §1.5` 의 "UUID v4 할당" 정정, `4-nodes/0-overview.md ##Rationale` 신설은 모두 다른 in-progress plan 이 선점하거나 "결정 필요"로 남겨둔 사항과 교차하지 않는다. 후속 항목 누락이나 선행 plan 미해소 위험도 없다.

## 위험도

NONE
