# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
검토 일시: 2026-05-23

---

## 발견사항

### 1. **[WARNING]** "normalize button ids" 용어가 기존 `normalizeNodeButtonIds` 와 혼동 가능

- **target 신규 식별자**: `spec/4-nodes/6-presentation/0-common.md §10.5` 본문에 삽입되는 "누락된 `button.id` 를 UUID v4 로 자동 보완" 동작 및 관련 단계 명칭. target 은 이 동작을 "normalize" / "정규화" 로 표현
- **기존 사용처**: `codebase/backend/src/nodes/core/button-slug.util.ts` 의 `normalizeNodeButtonIds()` 함수. 이 함수는 Workflow AI Assistant 편집 모드(`shadow-workflow.ts`)에서 `button.id` 가 비어 있거나 유효하지 않을 때 **label → kebab-case slug** 를 생성해 채운다. UUID v4 가 아니라 label-slug 방식이다
- **상세**: 같은 레이어(presentation 노드 버튼)에서 두 가지 서로 다른 "normalize" 로직이 존재하게 된다. ① AI Assistant 편집 모드: `normalizeNodeButtonIds()` → slug (`btn_confirm`, `items_0_btn_1` 등). ② LLM tool 모드(target 이 제안): `render-tool-provider` pipeline → UUID v4. 이름·용어가 유사하나 생성 전략이 달라 구현자·리뷰어가 혼동할 수 있다. 특히 향후 `render-tool-provider.ts` 에 "normalize" 함수를 추가할 때 기존 `normalizeNodeButtonIds` 를 잘못 재사용하면 UUID 대신 slug 가 삽입된다
- **제안**: target draft 및 spec §10.5 신규 step 3 본문에서 "정규화" 보다 구체적인 표현("LLM tool 모드 button.id UUID v4 보완" 또는 "button.id UUID backfill")을 사용하고, 구현 파일 함수명도 `normalizeNodeButtonIds` 와 명확히 구분되는 이름(`fillMissingButtonIds` 또는 `backfillButtonUuids` 등)을 spec 본문에 선명히 제안할 것

---

### 2. **[WARNING]** §10.5 섹션 제목 변경이 기존 내부 cross-ref 와 불일치 가능성

- **target 신규 식별자**: 섹션 제목 "Schema 위반 처리 및 정규화" (기존: "Schema 위반 처리")
- **기존 사용처**: `spec/4-nodes/6-presentation/0-common.md §10.4` 본문 — "§10.5 의 schema 위반 흐름을 따른다" 라는 section-number 앵커 참조가 존재. `spec/4-nodes/3-ai/1-ai-agent.md` 에서도 Presentation 공통 §10.5 를 여러 곳에서 cross-ref 함 (검색 결과상 §10.5 cross-ref 가 `4-nodes/6-presentation/0-common.md:299` 에 명시적으로 존재)
- **상세**: 섹션 번호(`§10.5`)는 변하지 않으므로 anchor-by-number 참조는 안전하다. 그러나 GitHub Markdown 의 slug-anchor 는 섹션 제목에서 생성되므로, 제목이 바뀌면 `#105-schema-위반-처리` → `#105-schema-위반-처리-및-정규화` 로 변경된다. 현재 spec 내에서 title-slug 기반 링크를 사용하는 곳이 있다면 깨진다. 검색 결과에서 `presentation/0-common.md` 의 §10.5 를 외부에서 title-anchor 로 직접 링크하는 사례는 확인되지 않았으나, 향후 추가 시 주의가 필요하다
- **제안**: spec 적용 시 `##10.5 Schema 위반 처리 및 정규화` 제목 변경과 동시에, 동일 파일 §10.4 의 "§10.5 의 schema 위반 흐름" 문구가 여전히 의미상 정확한지 확인 (정규화가 추가된 뒤에도 §10.4 가 §10.5 를 참조하는 맥락이 schema 위반 처리 흐름에 대한 것이므로, 제목 변경은 가독성 향상이며 의미 충돌은 없다). 단, CHANGELOG 에 anchor 변경을 명시해둘 것

---

### 3. **[INFO]** §10.5 기존 step 3·4 재번호 — 코드·스펙 산문에 step-number 참조 없음 (안전)

- **target 신규 식별자**: 기존 step 3 ("LLM 이 같은 turn 안에서 재시도 가능...") → step 4, 기존 step 4 ("AI Agent 의 error 포트는 발화하지 않는다...") → step 5 로 재번호
- **기존 사용처**: `spec/4-nodes/3-ai/1-ai-agent.md` 및 `codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts` 등에서 §10.5 를 section-level 로만 참조하며, "step N" 단위 번호 참조는 발견되지 않음
- **상세**: 재번호 자체는 충돌을 유발하지 않는다. 다만 향후 구현 PR 에서 handler 주석이나 단위 테스트 설명에 "step 3" 을 명시한 경우 spec 과 불일치가 생길 수 있다. 현재 코드베이스에서 해당 패턴은 확인되지 않음
- **제안**: 구현 단계 시작 전 `render-tool-provider.ts` 의 inline 주석이 step 번호를 참조하지 않도록 주의. spec CHANGELOG 에 "step 3 신설, 기존 3·4 → 4·5 재번호" 를 명시

---

### 4. **[INFO]** "normalize" 단계 위치 — "validate 후 / overlay 후 / cap 후" 순서가 기존 step 기술과 정합

- **target 신규 식별자**: 새 step 3 삽입 위치는 "validate 통과 + defaults overlay + 1MB cap 적용 이후"
- **기존 사용처**: `spec/4-nodes/6-presentation/0-common.md §10.5` 기존 step 1 (validate) · 기존 step 2 (위반 시 error 회신) · `§10.3` (defaults overlay) · `§10.4` (1MB cap)
- **상세**: draft Rationale 에서 "validate → overlay → cap → normalize" 순서를 명시했고 §10.4 가 §10.5 를 참조하는 구조와 정합한다. 기존 식별자와 순서 의미 충돌 없음. 단, draft 본문 step 3 서술에서 "validate 통과 + defaults overlay + 1MB cap 적용 이후" 라고 명시했으나 §10.5 의 기존 step 1~2 는 validate + error 회신만 다루고, overlay 와 cap 은 §10.3~§10.4 에서 다룬다. 실제 step 3 본문에는 "cap 이후 적용" 이라는 시점 명시가 포함되어 있어 독자가 §10.3·§10.4 와의 흐름 순서를 파악할 수 있다
- **제안**: 추가 혼동 방지를 위해 step 3 앞에 "§10.3 defaults overlay 와 §10.4 1MB cap 적용 완료 후" 식의 명시적 phase 주석을 추가하는 것을 권장 (현재 draft 는 step 본문 내에 포함하여 충분하나, section 간 흐름이 한 단계 더 명확해짐)

---

## 요약

target 이 도입하는 신규 식별자(섹션 제목 변경, step 재번호, "normalize/정규화" 용어)는 요구사항 ID·API endpoint·이벤트명·환경변수·파일 경로 차원에서 직접 충돌이 없다. 가장 주목할 점은 "normalize button id" 개념이 기존 Workflow AI Assistant 편집 모드의 `normalizeNodeButtonIds()` 함수(label-slug 생성)와 동일 도메인(presentation 노드 button.id)에서 유사한 이름·목적을 공유하면서도 생성 전략(slug vs UUID v4)이 달리 적용된다는 것이다. spec 본문과 구현 코드에서 두 normalize 개념을 명확히 구별하지 않으면 향후 구현자가 잘못된 함수를 재사용할 위험이 있으므로, spec 용어 및 구현 함수명을 명확히 차별화하도록 권고한다.

## 위험도

MEDIUM

---

_검토 범위: `spec/4-nodes/6-presentation/0-common.md`, `spec/4-nodes/3-ai/1-ai-agent.md`, `spec/3-workflow-editor/4-ai-assistant.md`, `codebase/backend/src/nodes/core/button-slug.util.ts`, `codebase/backend/src/nodes/ai/ai-agent/tool-providers/render-tool-provider.ts`, `plan/in-progress/ai-presentation-tools.md`, 관련 corpus 일체_
