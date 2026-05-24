# Cross-Spec 일관성 검토 결과

target: `plan/in-progress/ai-agent-formdata-size-limit.md`

---

## 발견사항

### [WARNING] spec 쓰기 권한 자기-예외 주장 — CLAUDE.md 와 developer SKILL.md 에 근거 없음

- **target 위치**: plan 문서 §Spec (spec/) — 작은 보강 항목, 마지막 문단
  > "본 변경은 §12.6 의 직접 후속이라 dev skill 안에서 직접 갱신 (CLAUDE.md spec read-only 룰의 작은 보강 예외)"
- **충돌 대상**: `CLAUDE.md` Skill 체계 표 — `개발자 | codebase/**, plan/**, review/**/RESOLUTION.md. spec/ read-only` 및 `.claude/skills/developer/SKILL.md` §쓰기 권한 표 — `spec/ | Read only — 수정 시 project-planner 위임. 갱신 제안은 plan/in-progress/spec-update-<name>.md`
- **상세**: CLAUDE.md 와 developer SKILL.md 어디에도 "변경 면적이 한 단락 이하" 또는 "직접 후속이면 예외" 조항이 없다. developer SKILL.md §워크플로우 2단계에는 "기획 금지: spec/ 신규 정의·대규모 개정 안 함. 필요 시 project-planner 위임" 이 명시되어 있고, 위임 비용 대비 효과를 developer 가 스스로 판단하는 것은 정책 우회다. 과거 §12.6 자체가 PR #301 에서 spec 에 기록됐을 때도 해당 PR 에는 사용자 명시 결정("spec 동반 갱신을 본 PR 에 포함" — 1-ai-agent.md §12.6 Rationale)이 동반됐다.
- **제안**: plan 문서에서 "dev skill 안에서 직접 갱신" 주장을 제거하고 spec 보강은 `project-planner` 위임 경로를 명시. 또는 사용자가 명시적으로 예외를 승인한 경우 그 근거를 plan 에 기록.

---

### [WARNING] `presentation 공통 §10.9` (4) layer 참조의 의미 불일치

- **target 위치**: plan §Spec 항목, 마지막 문단
  > "4-layer SSOT 의 다른 layer 영향 0 (LLM-facing layer 한정 — `presentation 공통 §10.9` (4) layer 의 cap 보강)"
- **충돌 대상**: `spec/4-nodes/6-presentation/0-common.md §10.9` 표 — (4) layer SoT = `{ok: true, type: 'form_submitted', data: {…formData}, message: '…'}` shape; `spec/4-nodes/3-ai/1-ai-agent.md §12.6` Rationale 마지막 줄 — "본 변경은 §10.9 의 4-layer SSOT 중 (4) LLM tool_result content layer 한정"
- **상세**: §10.9 (4) layer 는 tool_result content 의 *shape* SoT 다 (현재 `{ok, type, data, message}` 가 확정 기재). plan 이 "cap 보강" 을 "(4) layer 한정" 으로 표현하면 새로 추가하는 `truncation` 메타 필드가 §10.9 (4) layer 의 기존 shape 에 추가되어야 함을 암시한다. 즉 spec 보강 범위는 `1-ai-agent.md §12.7 신설` 에 그치지 않고 `0-common.md §10.9` 표 (4) 행도 동반 갱신해야 한다는 의미다. 그런데 plan 의 "Spec 보강" 항목에는 `spec/4-nodes/3-ai/1-ai-agent.md §12.6 / 또는 §12.7 신설` 만 기재되어 있고, `spec/4-nodes/6-presentation/0-common.md §10.9` 의 동반 갱신이 누락됐다. 보강 범위가 두 문서에 걸치는데 한 쪽만 목록에 있어 불완전하다.
- **제안**: plan §Spec 항목에 `spec/4-nodes/6-presentation/0-common.md §10.9` 표 (4) 행 shape 에 `truncation?` 필드 추가 갱신을 포함. 또는 "§10.9 (4) 는 변경 없음, `truncation` 메타는 tool_result content 의 신규 optional 필드로 §10.9 와 호환" 임을 명시해 범위 불확실성 해소.

---

### [INFO] `PRESENTATION_MAX_BYTES` 위치 명명 혼동 — plan 이 `render-tool-provider.ts` 를 참조하지만 실제 정의는 다른 파일

- **target 위치**: plan §변경 범위 §코드 1항
  > "`render-tool-provider.ts` 의 `PRESENTATION_MAX_BYTES = 1MB` 패턴과 동형하게"
- **충돌 대상**: 실제 코드 — `PRESENTATION_MAX_BYTES = 1024 * 1024` 는 `codebase/backend/src/nodes/core/truncate-output.util.ts:13` 에 export 로 정의된다. `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts:77` 는 이 값을 **재선언** (`const PRESENTATION_MAX_BYTES = 1024 * 1024;`) 하고 있으며 `truncate-output.util.ts` 에서 import 하지 않는다.
- **상세**: plan 이 참조하는 "패턴" 은 render-tool-provider 의 로컬 상수인데, 실제로는 두 위치에 같은 값이 독립 존재한다. 새로 신설할 `FORM_SUBMITTED_MAX_BYTES` 의 위치를 결정할 때 이 중복 구조를 인지하지 못하면 세 번째 독립 상수가 생길 수 있다. 기능 충돌은 아니지만 "동형 패턴" 의 실제 위치가 plan 설명과 다르므로 구현 시 참조 파일이 어긋날 수 있다.
- **제안**: plan 에서 "render-tool-provider.ts 의 패턴" 을 "ai-agent.handler.ts 내 신설 상수, truncate-output.util.ts 의 기존 패턴과 동형" 으로 수정. 또는 구현 시 `FORM_SUBMITTED_MAX_BYTES` 를 `truncate-output.util.ts` 에 함께 정의해 단일 위치 원칙 적용.

---

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §12.6` 에 이미 존재하는 섹션과의 추가 위치 명명 혼선

- **target 위치**: plan §Spec 항목 — "`spec/4-nodes/3-ai/1-ai-agent.md` §12.6 본문에 한 단락 추가 (또는 §12.7 신설)"
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md` 현 상태 — `### 12.6` 은 이미 "`render_form` submit 후 LLM 의 동일 form 재호출 회귀 차단 (2026-05-24)" 로 존재하고 완성된 섹션이다. 12.7 은 미존재.
- **상세**: "§12.6 본문에 한 단락 추가" 는 현재 완성된 12.6 섹션에 삽입함을 의미하는데, 해당 섹션은 PR #301 의 회귀 차단 결정 근거를 담은 Rationale 성격의 항목이라 formData 크기 cap 내용을 그 안에 넣으면 단일 책임 원칙 위반이 생긴다. "또는 §12.7 신설" 이 더 자연스러운 선택이나 plan 이 둘 다 열어두어 모호하다. 구현 단계에서 잘못된 위치에 추가될 위험이 있다.
- **제안**: plan 에서 "§12.6 본문에 추가 또는 §12.7 신설" 중 하나를 명확히 결정. 현행 §12.6 의 성격(회귀 차단 Rationale)과 분리하여 §12.7 신설로 확정하는 것이 단일 책임 원칙에 부합한다.

---

## 요약

`plan/in-progress/ai-agent-formdata-size-limit.md` 는 코드 변경 범위 자체(ai-agent.handler.ts 에 `capFormDataBytes` 헬퍼 + 상수 신설, 단위 테스트 추가)는 기존 spec 과 직접 충돌하지 않는다. 그러나 spec 보강 방법론에서 두 가지 WARNING 이 존재한다. 첫째, developer 역할이 spec/ 를 직접 쓰는 것은 CLAUDE.md·developer SKILL.md 에 예외 조항이 없어 정책 위반이다. 둘째, spec 보강 대상 문서 목록이 `1-ai-agent.md` 만 기재하고 `presentation/0-common.md §10.9` 의 동반 갱신 여부를 명시하지 않아 갱신 범위가 불완전하다. 두 INFO 는 코드 참조 파일 위치 혼동(PRESENTATION_MAX_BYTES 의 실제 정의 위치)과 추가할 spec 섹션 번호의 모호성으로, 구현 단계에서 방향 오류를 유발할 수 있다. CRITICAL 충돌(데이터 모델 모순, API 계약 충돌, 상태 전이 불일치, RBAC 충돌)은 없다.

## 위험도

MEDIUM

STATUS: OK
