# 정식 규약 준수 검토 결과

검토 범위: `spec/4-nodes/3-ai` (구현 착수 전 --impl-prep)
검토 시각: 2026-06-21

---

## 발견사항

### [INFO] `0-common.md` frontmatter `id` 필드가 파일 basename 과 불일치

- target 위치: `spec/4-nodes/3-ai/0-common.md` frontmatter line 2 — `id: common`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — "파일 basename(확장자 제외) 기반 권장"
- 상세: 파일명은 `0-common.md`이나 id 는 `common`으로, basename 과 다르다. 같은 영역의 `1-ai-agent.md`(→`id: ai-agent`), `2-text-classifier.md`(→`id: text-classifier`), `3-information-extractor.md`(→`id: information-extractor`)는 모두 basename 기반을 따르고 있어 일관성이 어긋난다. `0-common`이 basename 기반 권장이며 충돌 회피 필요성도 없는 상황이다.
- 제안: `id: 0-common` 또는 `id: ai-common`으로 변경하거나, 현행 `id: common`이 의도적 약식 명칭이라면 규약 문서에 "번호 prefix 생략 허용" 예외를 명시한다. 규약을 갱신하는 쪽이 더 적절하다면 그 점도 기록 권장.

---

### [INFO] `1-ai-agent.md` 에 `## Rationale` 섹션이 없음

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` 전체 (1305줄)
- 위반 규약: CLAUDE.md "문서 구조 규약 — Overview / 본문 / Rationale 3섹션 권장"
- 상세: `0-common.md`에는 `## Rationale` 섹션이 있고, `3-information-extractor.md`도 확인된 범위에서 Rationale 을 포함하는 패턴인데, `1-ai-agent.md`는 `## 12. Rationale` 형태의 번호 붙은 섹션들(`§12.1`~`§12.14`)로 운영되고 있다. 이는 CLAUDE.md 권장 3섹션 구조(`## Rationale` 헤딩)와 형식이 달라 헤딩 기반 색인(링크·slug)에서 `#rationale`로 직접 접근이 불가능하다.
- 제안: `## 12. Rationale` → `## Rationale` 로 헤딩을 표준화하거나, 또는 번호 붙은 Rationale 하위 섹션을 유지하되 최상위 `## Rationale`를 추가해 3섹션 구조를 충족시킨다. INFO 등급으로 착수를 차단하지는 않는다.

---

### [INFO] `0-common.md` `§5` 에서 `CONVENTIONS Principle 11` 참조 — 실제 규약은 Principle 11 이 "Output 문서화 규칙" 임

- target 위치: `spec/4-nodes/3-ai/0-common.md §5` — "LLM 3 노드는 `output.result.*` / `output.error.*` / `output.interaction.*` wrapper 를 공유한다 (CONVENTIONS Principle 11)"
- 위반 규약: `spec/conventions/node-output.md` — Principle 11 은 "출력 예시 문서화 규칙"(각 노드 문서의 Output 섹션 작성 형식). `output.result.*` wrapper 채택 근거는 Principle 8 (`통일된 1차 네이밍 — LLM 계열 노드 한정 output.result 래핑`)에 해당한다.
- 상세: "CONVENTIONS Principle 11" 이라고 명시했으나 실제로 output.result wrapper 를 LLM 노드에 적용하는 근거는 Principle 8.2 이다. Principle 11 은 문서화 형식 규칙으로 링크 의미가 다르다. 같은 문서 내 `§9 출력 구조 색인` 주석에서도 "AI 노드의 출력 구조는 공통 §5 응답 형식 규약 (Principle 11)의 wrapper 컨트랙트를 따른다"고 반복된다.
- 제안: 해당 참조를 `(CONVENTIONS Principle 8.2)` 또는 `(CONVENTIONS Principle 8)` 로 수정하거나, Principle 11 링크가 의미하는 바를 명확히 보완 설명한다. 규약 문서 자체가 개정되어야 한다면 Principle 8 과 11 의 관계를 명시하는 편이 더 근본적 해결이다.

---

### [WARNING] `1-ai-agent.md` frontmatter `code:` 에 분할된 collaborator 파일 미등재

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 목록 (line 3~9)
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 필드는 "본 spec 이 약속한 surface 의 구현 경로"로 status:partial 에서 ≥1 매치 의무
- 상세: M-1 1단계(`AiConditionEvaluator`, commit `24ca3340`)·2단계(`AiMemoryManager`, commit `3369fcef`)로 분리된 신규 파일 `ai-condition-evaluator.ts`·`ai-memory-manager.ts`가 frontmatter `code:` 목록에 없다. 계획 문서(`plan/in-progress/refactor/02-architecture.md §M-1`)도 "planner 후속(비차단 SPEC-DRIFT): `1-ai-agent.md` frontmatter `code:` 에 `ai-condition-evaluator.ts`·`ai-memory-manager.ts` 등재"를 명시했다. 현 worktree(M-1 3단계)의 구현 착수 전 상태에서 이 spec-drift 가 미해소된 채로 진행 중이다.
- 제안: 3단계 착수 전 혹은 3단계 PR에서 frontmatter `code:` 에 두 파일을 등재한다.
  ```yaml
  code:
    - codebase/backend/src/nodes/ai/ai-agent/ai-agent.handler.ts
    - codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts
    - codebase/backend/src/nodes/ai/ai-agent/ai-agent.component.ts
    - codebase/backend/src/nodes/ai/ai-agent/ai-condition-evaluator.ts   # 추가
    - codebase/backend/src/nodes/ai/ai-agent/ai-memory-manager.ts        # 추가
    - codebase/backend/src/nodes/ai/ai-agent/tool-providers/*.ts
    ...
  ```
  이는 개발자 단독으로 처리 가능하고(`code:` 등재는 플래너 작업이 아닌 spec frontmatter 유지), build-guard `spec-code-paths.test.ts` 가드 통과에도 직결된다. 계획 문서도 이를 비차단 후속으로 명시했으므로 이번 착수를 막지 않으나 3단계 PR 전에 반드시 처리 권장.

---

### [INFO] `0-common.md` `§11` 의 "config echo" 참조에서 Principle 7 적용 방향 설명이 편향

- target 위치: `spec/4-nodes/3-ai/0-common.md §11.7 config echo`
- 위반 규약: `spec/conventions/node-output.md Principle 7` — "항상 echo" 대상은 "비민감 필드 전부"이며, "default 값과 일치하면 생략"은 Principle 7 자체에는 없는 해석
- 상세: `§11.7`은 "`includeSystemContext` / `systemContextSections` 는 default/미설정 값과 일치하면 echo 에서 생략"이라고 기술한다. 그런데 Principle 7 본문은 "비민감 값은 항상 echo" 원칙이고, 선택적 echo(생략)에 대한 정식 규약 조항이 없다. 두 필드가 optional이라 config 객체에서 undefined일 때 JSON 직렬화 시 생략되는 것과, 명시적 "default 와 일치하면 생략" 정책은 다른 의미다. 타 노드의 optional 필드가 있어도 undefined 포함 echo를 하는 Principle 7 기본 방향과 어긋날 수 있다.
- 제안: Principle 7 본문에 "optional 필드에 대한 선택적 echo" 조항을 명시하거나, `§11.7`에서 "undefined 인 경우 생략" 과 "값이 있지만 default 와 일치하면 생략"을 구분해 서술한다. INFO 등급으로 착수를 차단하지 않는다.

---

## 요약

`spec/4-nodes/3-ai` 영역은 전반적으로 `spec/conventions/node-output.md` Principle 체계(5-필드 invariant, output.result 래핑, error 컨트랙트, config echo)와 `spec/conventions/spec-impl-evidence.md` frontmatter 스키마를 준수하고 있다. frontmatter 의 `id`, `status`, `code:`, `pending_plans:` 구조는 모두 존재하며 규약 형식을 따른다. 주요 이슈는 두 가지다. 첫째, M-1 1·2단계 완료로 신설된 `ai-condition-evaluator.ts`·`ai-memory-manager.ts`가 `1-ai-agent.md` frontmatter `code:` 에 아직 미등재된 점(WARNING — 계획 문서도 이를 비차단 SPEC-DRIFT로 인지 중). 둘째, `§5`에서 `output.result` wrapper 근거를 "Principle 11"으로 오인용한 점(실제는 Principle 8.2, INFO). 나머지 사항은 경미한 형식 일관성 수준이다. 착수 차단 사유(CRITICAL)는 없다.

## 위험도

LOW

---

STATUS: SUCCESS
