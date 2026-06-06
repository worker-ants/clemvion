# Convention Compliance Review

**Target**: `plan/in-progress/spec-draft-kb-unsearchable-warning.md`
**Review mode**: spec draft (--spec)
**Date**: 2026-06-06

---

## 발견사항

### 1. **[WARNING]** plan frontmatter 에 `owner` 필드 누락

- **target 위치**: `plan/in-progress/kb-unsearchable-warning.md` frontmatter (plan draft 가 참조하는 실행 plan)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — `worktree`·`started`·`owner` 세 필드 모두 top-level `plan/in-progress/*.md` 에서 **필수**, build guard `plan-frontmatter.test.ts` 가 강제
- **상세**: 실행 plan(`plan/in-progress/kb-unsearchable-warning.md`) 의 frontmatter 가 `name`·`worktree`·`started`·`spec_impact` 만 가지고 `owner` 필드를 포함하지 않는다. 또한 `name` 키는 spec 정의 스키마에 없는 비표준 키이며 관례는 별도 `name` 없이 세 필수 필드만 쓴다. `owner` 누락은 build guard 실패를 유발한다.
- **제안**: frontmatter 에 `owner: project-planner` (또는 담당자 역할) 추가. `name:` 키는 제거하거나 보조 필드로만 유지.

---

### 2. **[WARNING]** `§2.2` 신규 봉투의 `reason` 값 표기 — 현행 spec 키 집합과 이질적

- **target 위치**: `변경 1: spec/5-system/9-rag-search.md §2.2 KB tool 결과 포맷 — 신규 봉투 추가` 내 JSON 예시
- **위반 규약**: `spec/conventions/node-output.md §3.2` — `error.code` 는 `UPPER_SNAKE_CASE`. `spec/conventions/error-codes.md §1` — 에러 코드 이름은 의미 기반 명명.
- **상세**: 현행 `spec/5-system/9-rag-search.md §2.2` 의 기존 에러 봉투는 `"error": "search_failed"` (snake_case 문자열)와 `"grounding": "none"` 패턴을 사용한다. draft 가 제안하는 `"reason": "reembedding_required"` / `"reembedding_in_progress"` 도 동일 레이어(tool_result content)에서 snake_case 를 따르므로 내부 일관성은 있다. 그러나 `node-output.md §3.2` 의 `output.error.code` 는 `UPPER_SNAKE_CASE` 규약이다. tool_result content 는 `NodeHandlerOutput.output.error` 와 동일 레이어는 아니지만, `reason` 값의 표기가 `search_failed`(기존 snake_case)와 일관하는지, 또는 `UPPER_SNAKE_CASE` 로 맞춰야 하는지 spec 에서 명시되지 않은 상태다. 기존 `grounding:"none"` 선례를 따른다고 draft 가 명시하고 있으므로 의도는 명확하나, 기존 `error:"search_failed"` 값도 `error-codes.md §3` Historical-artifact 예외에 등재되지 않은 lower_snake_case 값이다. 신규 값 `reason:"reembedding_required"` 을 도입할 때 표기 정책 SoT 를 명시하거나 기존 snake_case tool_result 값 규약을 확인·선언해야 한다.
- **제안**: draft 가 spec 에 추가되는 `§2.2` 절에 "tool_result content 의 문자열 값은 snake_case (기존 `search_failed`·`none` 선례와 일관)" 한 줄을 명시. 또는 `error-codes.md` 에 tool_result content 의 에러 코드 표기 정책을 위임 대상으로 추가. 어느 쪽이든 규약과의 정합을 명문화.

---

### 3. **[WARNING]** `ragDiagnostics.skipReason` 에 `kb_unsearchable` 추가 시 기존 enum 정의와 표기 충돌 가능성

- **target 위치**: `변경 1 §4.2 ragDiagnostics — skipReason 확장`
- **위반 규약**: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`. `spec/conventions/error-codes.md §1` — 의미 기반 명명.
- **상세**: `spec/5-system/9-rag-search.md §4.2` 현행 `skipReason` 값은 `empty_kb_list`·`no_results` (snake_case). draft 는 `kb_unsearchable` 을 추가한다. 이 필드가 `output.error.code` 레이어가 아닌 진단 메타 필드(`meta.ragDiagnostics`)임을 감안해도, node-output 규약이 `UPPER_SNAKE_CASE` 를 에러 코드에 강제하는 맥락에서 `ragDiagnostics` 의 에러/상태 코드성 값 표기 정책이 명확하지 않다. 기존 `skipReason` 도 snake_case 이므로 내부 일관성은 유지되지만, 이 패턴 자체가 규약과 어긋나는 기존 선례를 답습하는 것인지 의도적 예외인지 spec 에 선언이 없다.
- **제안**: `ragDiagnostics` 의 코드성 값(예: `skipReason`, `rerank.error`)은 표기 정책이 `UPPER_SNAKE_CASE` 이거나 snake_case 예외임을 spec(9-rag-search.md §4.2 또는 node-output.md) 에서 1줄 명시. 신규 `kb_unsearchable` 은 기존 snake_case 선례와 일관성은 있으므로, 선언만 보강하면 WARNING 해소.

---

### 4. **[INFO]** `spec-draft-*.md` 파일 자체는 `plan/in-progress/` 에 위치 — CLAUDE.md 정보 저장 위치 규칙과 일치

- **target 위치**: 파일 경로 `plan/in-progress/spec-draft-kb-unsearchable-warning.md`
- **위반 규약**: 없음 (확인용)
- **상세**: 진행 중 작업은 `plan/in-progress/<name>.md` 에 위치해야 하며, 본 파일은 이를 준수한다. "spec draft" 라는 이름 prefix 는 spec 변경의 draft 성격을 명확히 표현하나, plan-lifecycle 에서 이름 규약을 특별히 제한하지 않으므로 허용 범위 안이다.
- **제안**: 해당 없음 (INFO 기록 목적).

---

### 5. **[INFO]** 문서 구조 — Overview / 본문 / Rationale 3섹션 권장에서 Overview 섹션 부재

- **target 위치**: `plan/in-progress/spec-draft-kb-unsearchable-warning.md` 전체 구조
- **위반 규약**: CLAUDE.md `Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)`. 단, 본 문서는 `spec/` 문서가 아니라 `plan/in-progress/` 에 위치한 작업 draft 이므로 spec 문서 구조 규약의 직접 적용 대상이 아님.
- **상세**: 본 draft 는 plan 문서이며 최종 반영 대상은 `spec/5-system/9-rag-search.md` 등 별도 spec 파일이다. spec 파일 자체에 반영 시 Overview·Rationale 섹션을 갖추어야 하며, draft 는 그 지침을 각 변경 섹션 끝의 Rationale 블록으로 충실히 포함하고 있다. 실제 spec 반영 시 3섹션 구조 준수가 필요하나 draft 단계에서는 위반이 아니다.
- **제안**: 실제 spec 반영 PR 에서 `## Rationale` 가 각 spec 파일에 적절히 포함되도록 확인.

---

### 6. **[INFO]** `plan/in-progress/kb-unsearchable-warning.md` `spec_impact` — `spec/5-system/8-embedding-pipeline.md` 미선언

- **target 위치**: `plan/in-progress/kb-unsearchable-warning.md` frontmatter `spec_impact`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §5 Gate C` — 완료 plan 의 `spec_impact` 는 본 작업이 건드린 spec 파일 목록 실존 의무. (in-progress 단계에서는 Gate C 미강제이나 draft 의 `변경 3` 이 `spec/5-system/8-embedding-pipeline.md` 를 명시적 side-effect 정합 대상으로 지목함)
- **상세**: spec-draft 가 `변경 3: spec/5-system/8-embedding-pipeline.md` 를 명시적으로 포함하나, 실행 plan 의 `spec_impact` 에는 `spec/5-system/9-rag-search.md`·`spec/2-navigation/5-knowledge-base.md` 만 선언되어 있고 `spec/5-system/8-embedding-pipeline.md` 가 누락됐다. in-progress 단계에서는 Gate C 가 강제되지 않지만, 완료 이동 전 `spec_impact` 에 추가해야 Gate C 를 통과한다.
- **제안**: plan 완료 전 `spec_impact` 에 `spec/5-system/8-embedding-pipeline.md` 추가.

---

## 요약

target 문서(`spec-draft-kb-unsearchable-warning.md`)는 plan 파일로서의 구조는 적절하며, 제안하는 변경 내용이 기존 `grounding:"none"` 선례 패턴을 따르는 등 spec 내 일관성을 의식하고 있다. 단, 실행 plan(`kb-unsearchable-warning.md`)의 frontmatter 에서 plan-lifecycle 규약이 강제하는 `owner` 필드가 누락되어 build guard 실패 위험이 있다(WARNING). 또한 신규 도입하는 `status:"not_searchable"`, `reason:` 값, `skipReason:"kb_unsearchable"` 이 tool_result content 레이어에서 snake_case 를 따르는 것이 기존 선례와 일관하나, 해당 레이어의 표기 정책 SoT 가 규약(`node-output.md`, `error-codes.md`)에 명시되지 않아 규약과의 정합 선언이 부재하다(WARNING 2건). `spec_impact` 에서 `8-embedding-pipeline.md` 가 누락된 것은 완료 전 보완이 필요한 INFO 수준 갭이다.

## 위험도

LOW
