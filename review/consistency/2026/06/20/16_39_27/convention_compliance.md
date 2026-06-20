# 정식 규약 준수 검토 — spec-draft-port-id-uuid-slug.md

검토 모드: spec draft (--spec)
대상 파일: `plan/in-progress/spec-draft-port-id-uuid-slug.md`
검토 일시: 2026-06-20

---

## 발견사항

### [INFO] frontmatter 에 비표준 필드 `spec_area` 사용
- **target 위치**: 파일 상단 frontmatter, 라인 5 (`spec_area: spec/4-nodes`)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2` + `.claude/docs/plan-lifecycle.md §4`
- **상세**: `plan-lifecycle.md §4` 는 top-level `plan/in-progress/*.md` 의 필수 frontmatter 를 `worktree`·`started`·`owner` 세 필드로 규정하며, 추가 필드로 `priority`/`status`/`title` 을 예시한다. `spec_area` 는 규약에 언급되지 않는 비표준 필드다. 규약에서 "추가 필드는 허용"이라 했으므로 **guard 차단은 아니지만**, 규약에 없는 키 이름 패턴이 다른 plan 에서도 산발적으로 쓰이고 있어(예: `agent-memory-model-select.md`) 일관성이 없다.
- **제안**: `spec_area` 를 `plan-lifecycle.md §4` 의 권장 추가 필드 예시 목록에 공식 등재하거나, 표준 필드가 아님을 주석으로 명시한다. 이 plan 자체는 수정 불필요.

---

### [INFO] plan 문서 본문 구조가 CLAUDE.md 권장 3섹션과 불일치
- **target 위치**: 본문 전체 섹션 구성 (`## 배경 + 방향 정정`, `## 변경안`, `## 제외`, `## Rationale`, `## 영향·side-effect`)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` (Overview / 본문 / Rationale 3섹션 권장)
- **상세**: CLAUDE.md 는 spec 문서의 3섹션 구성(Overview / 본문 / Rationale)을 권장하며, 이는 **spec 파일** 에 적용된다. 대상 파일은 `plan/in-progress/` 아래의 **plan 문서**이므로 spec 3섹션 구성 의무 대상이 아니다. 현행 섹션 구성(배경·변경안·제외·Rationale·영향)은 plan 문서로서 오히려 자연스럽다.
- **제안**: 위반 없음. 해당 규약이 plan 문서에 적용되지 않음을 확인.

---

### [INFO] `## Rationale` 섹션이 plan 본문에 포함되어 spec 파일과 혼동 가능성
- **target 위치**: `## Rationale` 섹션 (라인 38~49)
- **위반 규약**: CLAUDE.md §정보 저장 위치 ("결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`")
- **상세**: 본 plan 의 Rationale 섹션은 `4-nodes/0-overview.md` 에 **등재될 내용의 draft**임을 제목에 명시(`## Rationale (\`0-overview.md ## Rationale\` 등재 내용)`)하고 있어 의도가 명확하다. plan 문서 안에 draft 내용을 미리 써두는 것은 규약 위반이 아니다. 단, 변경안 #6 에서 신설하는 Rationale 의 최종 귀속 위치(`spec/4-nodes/0-overview.md`)가 명시되어 있으므로 SoT 분리 원칙(CLAUDE.md)에도 부합한다.
- **제안**: 위반 없음.

---

### [INFO] 변경안에서 참조하는 spec 파일 경로가 frontmatter `pending_plans` 나 `spec_impact` 로 연결되지 않음
- **target 위치**: `## 변경안` 표 전체
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4.2 Gate C` + `.claude/docs/plan-lifecycle.md §5 Gate C`
- **상세**: Gate C 는 **완료 시점**(`plan/complete/` 이동 시)에 `spec_impact` 선언을 의무화하며, in-progress 단계에서는 의무가 없다. 변경 대상 spec 파일(`4-nodes/0-overview.md`, `4-nodes/1-logic/0-common.md`, `3-workflow-editor/1-node-common.md`, `3-ai/_product-overview.md`, `3-ai/1-ai-agent.md`)이 변경안 본문에 상세히 기술되어 있으므로 완료 시 `spec_impact` 작성이 용이한 상태다.
- **제안**: 완료 이동 시 `spec_impact` 에 위 5개 파일 경로를 그대로 나열하면 Gate C 충족. 현 시점은 in-progress 이므로 수정 불필요.

---

## 요약

대상 plan 문서(`plan/in-progress/spec-draft-port-id-uuid-slug.md`)는 정식 규약의 직접 위반 사항이 없다. 필수 frontmatter 3필드(`worktree`·`started`·`owner`)가 모두 적절히 기재되어 있으며, 변경안 구조·Rationale draft 귀속 명시·제외 항목 설명 등 내용 구성도 규약에 반하지 않는다. 비표준 필드 `spec_area` 가 규약 예시 목록에 없는 점은 INFO 수준 일관성 이슈이나 guard 통과에 영향이 없다. 완료 이동 시 Gate C(`spec_impact`) 선언이 필요하나 이는 in-progress 단계에서 요구되지 않는다. 전반적으로 정식 규약 준수 상태 양호.

## 위험도

NONE
