# Rationale 연속성 검토 결과

검토 모드: `--impl-prep`
대상 영역: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)
검토 일자: 2026-05-26

---

## 발견사항

### 1. INFO — `3-information-extractor.md` §1 config 표에서 `includeSystemContext` / `systemContextSections` 필드 필수 마커 불일치

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md §1 config 표` — `includeSystemContext Boolean?` / `systemContextSections String[]?` (물음표 붙인 nullable 표기)
- **과거 결정 출처**: `spec/4-nodes/3-ai/0-common.md §11.1` 및 `1-ai-agent.md §1` — 동일 필드가 `Boolean` / `String[]` 로 선언 (물음표 없음)
- **상세**: `0-common.md §11.1` 표와 `1-ai-agent.md §1` 표는 두 필드 타입을 `Boolean`, `String[]` 로 기술한다. 반면 `3-information-extractor.md §1` 은 `Boolean?`, `String[]?` 로 nullable 를 붙였다. "3 노드 공통 규약" 을 표방하는 `0-common.md §11.1` 의 필드 정의와 타입 표기가 달라 구현 시 schema 불일치 위험이 있다. `2-text-classifier.md §1` 도 마찬가지로 물음표 없이 `Boolean` / `String[]` 로 선언하여, `3-information-extractor.md` 만 비대칭이다.
- **제안**: `3-information-extractor.md §1` 의 두 필드 타입 표기를 `Boolean` / `String[]` 로 통일하거나, 의도적으로 optional 처리가 필요한 근거가 있다면 해당 노드 Rationale 에 명시.

---

### 2. INFO — `1-ai-agent.md §11 캔버스 요약` 예시에 `render` 카운터 언급 — `0-common.md §8 캔버스 요약` 표와 미등재 필드

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §11` — 예시 `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond · 3 render`
- **과거 결정 출처**: `spec/4-nodes/3-ai/0-common.md §8 캔버스 요약` — AI Agent 행 예시 `gpt-4o · 2 tools · 1 KB · 1 MCP · 3 cond` (single) / `Multi Turn · gpt-4o · 1 KB · 2 MCP · 2 cond` (multi). `render` 카운터 항목 없음
- **상세**: `1-ai-agent.md §11` 의 예시에는 `3 render` 가 포함되어 있으나 `0-common.md §8` 의 공통 캔버스 요약 표에는 presentation tool 수 (`render`) 카운터 항목이 등재되어 있지 않다. `presentationTools` 기능은 `1-ai-agent.md §12.4` (2026-05-22 결정) 에서 도입되었으나, 해당 결정 시 `0-common.md §8` 표의 갱신이 누락된 것으로 보인다. 캔버스 요약 규약의 단일 진실 위치(`0-common.md §8`)와 `1-ai-agent.md §11` 간 drift 가 발생한다.
- **제안**: `0-common.md §8` AI Agent 행에 `presentationTools.length > 0 시 · {N} render` 항목을 추가하거나, `1-ai-agent.md §11` 의 예시에서 `render` 카운터를 삭제하고 `§11` 본문에 "presentationTools 수는 단일 노드 로컬 표기" 임을 명시. 어느 쪽이든 `0-common.md §8` 이 단일 진실이 되도록 정합.

---

### 3. INFO — `1-ai-agent.md §12.4 (기각된 대안 E)` 과 현재 `2-text-classifier.md` 의 Rationale stub 상태

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §8 Rationale` / `spec/4-nodes/3-ai/3-information-extractor.md §8 Rationale`
- **과거 결정 출처**: `spec/4-nodes/3-ai/0-common.md §Rationale "시스템 컨텍스트 자동 주입 (2026-05-18)"` — 대안 C (기각): "각 노드별로 별도 필드 정의 → 3 노드 모두 동일 컨텍스트 필요, 단일 정의로 drift 방지"
- **상세**: 이 항목 자체가 Rationale 연속성을 위반하는 것은 아니다. 다만, `2-text-classifier.md §8` 와 `3-information-extractor.md §8` 는 모두 "본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다" 는 stub 형태만 존재한다. 구현 착수 전 검토 시점에서 향후 노드별 Rationale 이 필요한 시점에 (예: text_classifier 에 knowledge base 연동을 추가하는 결정) 해당 파일의 §8 에 해당 결정 근거가 바로 기록될 수 있도록 stub 구조가 준비되어 있음을 확인하는 INFO 수준의 관찰. Rationale 자체의 위반은 아님.
- **제안**: 구현 착수 전 단계에서는 별도 조치 불필요. 향후 text_classifier / information_extractor 에 노드 단독 설계 결정이 생기면 `§8 Rationale` 에 직접 기록할 것을 remind.

---

## 요약

`spec/4-nodes/3-ai/` 전반에 걸쳐 기각된 대안이 재도입되거나 합의된 invariant 가 위반된 사례는 발견되지 않았다. 2026-05-18 신설된 System Context Prefix (`0-common.md §11`, 대안 A·B·C·D 의 명시적 기각 근거 보존)와 2026-05-22 도입된 Presentation Tool Family (`1-ai-agent.md §12.4`, 기각된 A·B·C·D·E 의 완전한 비교 표 보존), 2026-05-24 결정된 `render_form` submit 가드 (`§12.6`) 등 핵심 결정 모두 신규 Rationale 와 함께 기록되어 있어 합의된 결정이 이유 없이 번복된 정황이 없다. 발견된 세 건은 모두 INFO 수준이며, 가장 주목할 부분은 `3-information-extractor.md §1` 의 `includeSystemContext` / `systemContextSections` 필드 타입 표기가 `0-common.md §11.1` 및 `2-text-classifier.md §1` 의 표기와 비대칭인 점과, `0-common.md §8` 캔버스 요약 표에 `render` 카운터 항목이 누락된 채 `1-ai-agent.md §11` 예시에만 등장하는 drift 이다. 두 건 모두 구현 시 schema 선언 불일치나 캔버스 요약 렌더링 오차로 이어질 수 있으므로 구현 착수 전 정합을 권장한다.

---

## 위험도

LOW
