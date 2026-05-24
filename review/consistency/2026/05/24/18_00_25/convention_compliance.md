# 정식 규약 준수 검토 — `plan/in-progress/ai-agent-formdata-size-limit.md`

검토 모드: plan draft (`--plan`)
검토 일자: 2026-05-24

---

## 발견사항

### [WARNING] developer 역할이 `spec/` 직접 갱신을 self-authorize 하고 있음
- **target 위치**: `## 변경 범위 > ### Spec (spec/) — 작은 보강` 단락 (line 89)
  > "본 변경은 §12.6 의 직접 후속이라 dev skill 안에서 직접 갱신 (CLAUDE.md spec read-only 룰의 작은 보강 예외)"
- **위반 규약**: CLAUDE.md `spec/` read-only 정책, `.claude/skills/developer/SKILL.md §경로별 권한` ("spec/ — Read only — 수정 시 project-planner 위임. 갱신 제안은 plan/in-progress/spec-update-\<name\>.md")
- **상세**: developer SKILL.md 는 spec/ 에 대한 예외 경로를 열어두지 않는다. plan 자체가 "면적이 작으므로 project-planner 위임 비용 대비 효과가 낮다"고 자체 근거를 제시하며 예외를 선언하고 있으나, conventions 어디에도 변경 면적 소/대를 기준으로 spec 직접 갱신을 허용하는 조항이 없다. 규약 상 예외가 없는 상황에서 plan 이 스스로 예외를 선언하는 것은 규약 위반이다. 규약을 바꾸려면 project-planner 가 CLAUDE.md / developer SKILL.md 에 예외 조항을 먼저 추가하거나, 본 plan 의 spec 갱신 phase 를 project-planner 위임으로 분리해야 한다.
- **제안**: 
  1. (권장) `## 변경 범위 > Spec` 단락을 "spec 갱신은 별도 project-planner 위임 phase 로 진행한다" 로 교체 + 체크리스트 항목 2를 "- [ ] project-planner 위임: spec 보강 (`1-ai-agent.md §12.6` 또는 §12.7 신설)" 으로 교체.
  2. (규약 갱신 경로) 변경 면적이 작은 spec 갱신을 developer 가 허용받을 수 있도록 developer SKILL.md 에 명시적 예외 조항 추가 (project-planner 가 결정) → 그 이후에는 본 패턴이 허용됨. 규약 갱신을 원하면 이 절차를 먼저 밟아야 한다.

---

### [WARNING] `truncation` 메타 필드 명명이 기존 spec 상의 `truncation` 오브젝트와 shape 가 다름
- **target 위치**: `## 채택안` 단락
  > "tool_result content 에 `truncation` 메타 필드 추가 (LLM-facing): `{originalBytes, cappedBytes, truncatedFields: string[]}`"
- **위반 규약**: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` 의 `PresentationPayload.truncation` 정의 (`{itemsTruncated?, rowsTruncated?, itemsTotalCount?, rowsTotalCount?}`) 및 `spec/4-nodes/6-presentation/0-common.md §10.4` 의 `truncation` shape 패턴
- **상세**: spec 에서 이미 `truncation` 이라는 동일 이름의 필드가 `PresentationPayload` 에 사용되고 있으며, 그 shape 는 `{itemsTruncated, rowsTruncated, itemsTotalCount, rowsTotalCount}` 이다. 본 plan 이 제안하는 `{originalBytes, cappedBytes, truncatedFields}` 는 다른 layer (tool_result content) 에 붙는 별개 용도이지만, 동일 필드명 `truncation` 을 재사용하면서 shape 가 달라 혼동을 일으킨다. 특히 tool_result content 는 LLM 이 직접 보는 layer 이고 `PresentationPayload.truncation` 은 NodeOutput layer 이므로 두 layer 의 `truncation` shape 가 달라지면 spec 내 일관성이 깨진다.
- **제안**: tool_result layer 의 필드를 `formDataTruncation` 으로 명명해 `PresentationPayload.truncation` 과 의미역을 분리하거나, spec 갱신 시 두 truncation 의 shape 차이를 명확히 section 간 cross-ref 로 표기할 것. 최소한 `## 채택안` 에서 "기존 `PresentationPayload.truncation` 과 별개의 shape 임을 spec 에 명시" 라는 한 줄을 추가해 ambiguity 를 plan 단계에서 문서화할 것.

---

### [WARNING] spec 보강 대상 섹션이 기존 규약 문서 (presentation common §10.9 4-layer SSOT) 와 sync 를 명시하지 않음
- **target 위치**: `## 변경 범위 > Spec` 단락
  > "4-layer SSOT 의 다른 layer 영향 0 (LLM-facing layer 한정 — `presentation 공통 §10.9` (4) layer 의 cap 보강)"
- **위반 규약**: `spec/4-nodes/6-presentation/0-common.md §10.9` 4-layer SSOT 표 — "각 layer 는 본문이 SoT, 변경 시 동반 갱신 의무"; `spec/conventions/interaction-type-registry.md §3.2` Presentation type 분기 매트릭스 — form tool_result content shape 변경 시 분기 매트릭스 갱신 여부 확인 필요
- **상세**: plan 은 "4-layer SSOT 의 다른 layer 영향 0" 이라고 단언하나, `spec/4-nodes/6-presentation/0-common.md §10.9` 의 4-layer SSOT 표 (4) 항목은 tool_result content 의 shape 를 직접 정의한다. `truncation` 메타 필드가 tool_result 에 추가되면 (4)번 표의 `form_submitted` 케이스 cell 이 갱신돼야 하며, 해당 문서의 CHANGELOG 에도 기록 대상이다. "다른 layer 영향 0" 이라는 표현은 `presentation common §10.9` 자체를 갱신하지 않겠다는 의미로 읽힐 수 있어 표현이 부정확하다.
- **제안**: `## 변경 범위 > Spec` 단락에 "`presentation 공통 §10.9` (4) layer 의 `form_submitted` content shape 기술에 `truncation` 메타 필드 추가 명시" 를 별도 항목으로 추가하고, "다른 layer 영향 0" 을 "(4) layer 이외의 layer (외부 WS wire / internal bus sentinel / NodeOutput interaction.type) 에는 영향 없음" 으로 표현을 수정할 것.

---

### [INFO] `export const` 주석 "(테스트 import 용)" 이 상수 공개 근거로서 conventions 에 없는 패턴
- **target 위치**: `## 변경 범위 > 코드 > 1.` 항목
  > "`FORM_SUBMITTED_MAX_BYTES = 10 * 1024` 상수 신설 (`export const` — 테스트 import 용)"
- **위반 규약**: 명시적 금지 항목은 아님. `spec/conventions/node-output.md`, `spec/conventions/swagger.md` 등 코드 구조 규약에서 export 이유를 plan 에 주석으로 적는 패턴을 요구하거나 금지하지 않는다.
- **상세**: 대응하는 `PRESENTATION_MAX_BYTES` 는 `codebase/backend/src/nodes/ai/render-tool-provider.ts` 에 이미 `export const` 패턴으로 존재하며, 본 plan 도 그 패턴을 따른다고 명시한다. conventions 상 위반은 아니지만, 단지 테스트를 위해 내부 상수를 `export` 하는 패턴은 캡슐화 관점에서 INFO 수준 주의이다.
- **제안**: 변경하지 않아도 무방. 필요하다면 `PRESENTATION_MAX_BYTES` 와 동일 파일에 co-locate 하거나 공용 constants 모듈로 이동하는 방안을 검토할 수 있다.

---

### [INFO] 체크리스트 step 6 의 "REVIEW WORKFLOW — skip 검토" 가 developer SKILL.md 워크플로 의무와 충돌
- **target 위치**: `## 진행 체크리스트 > 6.`
  > "- [ ] REVIEW WORKFLOW — 변경 면적 작아 skip 검토"
- **위반 규약**: `.claude/skills/developer/SKILL.md §작업 워크플로` step 9 ("REVIEW WORKFLOW") — generic skeleton 에서 REVIEW WORKFLOW 는 필수 단계로 선언되어 있음
- **상세**: developer SKILL.md 에 REVIEW WORKFLOW skip 조건이 명시되어 있지 않다. 변경 면적이 작더라도 plan 이 임의로 skip 을 선언하는 것은 규약과 거리감이 있다. PROJECT.md 가 별도 skip 조건을 정의하고 있다면 그에 근거해야 한다.
- **제안**: "skip" 표현을 삭제하거나, PROJECT.md 에 skip 조건이 명시된 경우 그 조항을 명시적으로 인용할 것. 혹은 체크박스를 `[x]` 로 표시하되 근거 조항을 인용.

---

## 요약

target plan 문서 (`plan/in-progress/ai-agent-formdata-size-limit.md`) 는 frontmatter 스키마 (`worktree`, `started`, `owner`), 파일 위치 (`plan/in-progress/`), 파일명 kebab-case 등 기본 plan 규약을 올바르게 준수하고 있다. 다만 두 가지 WARNING 이 규약 준수 관점에서 주목된다. 첫째, developer 역할이 `spec/` 의 직접 갱신을 자체 근거로 허용하는 것은 CLAUDE.md 및 developer SKILL.md 의 spec read-only 정책을 위반하며, 이를 위해서는 project-planner 위임 phase 분리 또는 developer SKILL.md 예외 조항 선행 추가가 필요하다. 둘째, 제안하는 `truncation` 필드 shape(`{originalBytes, cappedBytes, truncatedFields}`) 가 spec 기존의 `PresentationPayload.truncation` 과 동일 명칭을 공유하면서 shape 가 달라 일관성 혼동을 야기하며, `presentation common §10.9` 4-layer SSOT 갱신 범위가 과소 기술되어 있다. 이 두 WARNING 을 해소하지 않고 구현에 착수하면 spec 문서 권위 체계와 LLM-facing layer 의 shape 일관성 invariant 가 깨질 수 있다.

---

## 위험도

MEDIUM
