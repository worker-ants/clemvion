# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/3-ai/` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md) + `spec/conventions/cafe24-api-catalog/application.md` + 관련 field-level 파일
검토 모드: 구현 완료 후 검토 (`--impl-done`, `diff-base=origin/main`)

---

## 발견사항

### WARNING-1: `3-information-extractor.md` — config echo 필드명 불일치 (W-1 이연)
- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1 출력 표 (`config.schema` 열), §8 Rationale W-1
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 — "config echo 는 원본(pre-evaluation) 값을 그대로 echo 하는 필드. 원본 필드명 그대로 echo"
- **상세**: 노드 config 의 원본 키는 `outputSchema` 이나 doc 출력 예시·표 ~15곳에서 `config.schema` 로 노출된다. Principle 7 은 config echo 가 사용자가 UI 에서 입력한 필드명(= schema 정의 키) 과 1:1 이어야 함을 요구한다. `outputSchema` → `config.schema` 이름 변환은 Principle 7 직접 위반이다.
- **현황**: 문서 §8 Rationale 이 이를 "알려진 결함 W-1" 로 명시하고 이연 처리했음. 문서 자체는 위반을 인지하고 있으나 수정되지 않은 상태.
- **제안**: `config.schema` 를 `config.outputSchema` 로 전체 rename. 대상 위치: §5.1 출력 표, §5.2~5.6 출력 구조 표, expression 접근 예 (`$node["X"].config.schema` → `$node["X"].config.outputSchema`). 해당 handler 의 config echo 반환 키도 동시 갱신 필요. 이연 이유(~15곳 일괄 rename)가 정당하다면 별도 plan 으로 추적해야 하며 현재 `pending_plans:` 에 등록되어 있지 않다.

---

### WARNING-2: `3-information-extractor.md` — `status: implemented` 이나 W-1 결함이 추적 plan 에 미등록
- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (`status: implemented`, `pending_plans:` 없음)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `status: implemented` 는 "모든 약속 구현 완료" 를 의미하며 `pending_plans` 가 없어야 한다. 반면 `partial` 은 미구현 surface 를 책임지는 plan 경로를 `pending_plans:` 에 등록해야 한다.
- **상세**: doc §8 Rationale 이 `config.schema` → `config.outputSchema` rename 을 "후속 작업으로 이연" 한다고 명시했으나, 이 미완 작업이 어떤 plan 파일에도 추적되지 않고 있다. spec 이 W-1 을 "알려진 결함" 으로 자체 인정하면서도 `status: implemented` 를 유지한다는 것은 either (a) spec-impl-evidence 의 `status` 의미를 초과하거나, (b) plan 추적 없이 이연 처리한 것이다.
- **제안**: `plan/in-progress/` 에 `information-extractor-config-echo-rename.md` (또는 유사 이름) plan 을 생성하고, frontmatter 를 `status: partial` + `pending_plans: [...]` 로 갱신하거나, W-1 을 즉시 수정하고 `implemented` 를 유지한다.

---

### INFO-1: `1-ai-agent.md` — `pending_plans` 에 `ai-context-memory-followup-v2` 미등록 (구현 완료된 plan 정리)
- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `pending_plans`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3.1 — `partial → implemented` 전이 규칙: "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격 (가드)"
- **상세**: prompt_file(diff-base) 기준으로 `0-common.md` 에 `ai-context-memory-followup-v2.md` 가 `pending_plans` 에 있었으나 구현 완료 후 `0-common.md` 가 `status: implemented` 로 승격됐다. `1-ai-agent.md` 의 현재 `pending_plans` 는 `ai-agent-tool-connection-rewrite.md` 만 남아 있으며 해당 plan 은 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 로 실존한다. `spec-pending-plan-existence.test.ts` 가드는 통과 중이므로 직접적인 빌드 게이트 위반은 아니나, 완료된 plan 연결 상태를 추적하는 차원에서 현황이 정합적임을 확인.
- **제안**: 현재 상태는 `spec-pending-plan-existence.test.ts` 관점에서 정상. 별도 조치 불필요. (INFO 수준)

---

### INFO-2: `spec/conventions/cafe24-api-catalog/application.md` 내 field-level 링크 파일 frontmatter 형식
- **target 위치**: `spec/conventions/cafe24-api-catalog/application/apps.md` 등 field-level 파일 frontmatter (`resource`, `entity`, `cafe24_docs`, `source` 키 사용)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §1 제외 항목 — `spec/conventions/<name>-api-catalog/<resource>/**/*.md` 는 프론트매터 `id`/`status` 가드 **대상에서 명시 제외**된다. 해당 파일들은 생성기 산출물 (lifecycle 비추적 레퍼런스)이며 `resource`/`entity`/`cafe24_docs`/`source` frontmatter 를 갖는다.
- **상세**: field-level 파일의 frontmatter 형식은 `_overview.md §7.1` 에 정의된 규약을 따르며, spec-impl-evidence 가드 적용 제외 대상이다. 현재 파일 구조와 규약이 정합적이다.
- **제안**: 조치 불필요. (INFO 수준 — 현황 확인)

---

### INFO-3: `0-common.md` 문서 구조 — Overview 섹션 명시 없음
- **target 위치**: `spec/4-nodes/3-ai/0-common.md` 최상단 본문
- **위반 규약**: CLAUDE.md — "제품 정의·요구사항: `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`". Spec 문서 3섹션 권장: Overview / 본문 / Rationale
- **상세**: `0-common.md` 는 진입 문서이자 AI 노드 공통 규약 문서인데, 별도 `## Overview` 섹션을 갖지 않는다. 도입부 설명이 `>` blockquote 링크 뒤 단락으로만 존재한다. 이는 CLAUDE.md 가 권장하는 3섹션 구조에서 Overview 섹션이 명시적으로 구분되지 않는 상태다. 다만 Rationale 은 §Rationale 로 있고, 본문 내용은 §1~§11 로 충분히 구조화되어 있다.
- **제안**: 형식 일관성을 위해 `## Overview` 섹션을 명시적으로 추가 가능. 그러나 convention 에서 "권장(recommended)" 수준이므로 강제 아님.

---

## 요약

`spec/4-nodes/3-ai/` 의 정식 규약 준수 상태는 전반적으로 양호하다. Node Output Principle 0~11 의 적용(5-필드 불변, `output.result.*` wrapper, `output.error.details.retryable` 필수 등), spec-impl-evidence frontmatter(`id`/`status`/`code:` 정합), 문서 구조(Overview 본문 Rationale 3섹션), API 문서 규약(ConditionDef/McpServerRef 구조 표, 에러 코드 UPPER_SNAKE_CASE) 모두 규약을 따른다. 단, `3-information-extractor.md` 에서 config echo 필드명이 원본 config 키(`outputSchema`)와 달리 `config.schema` 로 노출되는 WARNING-1 이 Principle 7 직접 위반으로 남아 있으며, 이를 추적하는 plan 이 `pending_plans` 에 없는 WARNING-2 가 spec-impl-evidence 규약과 거리가 있다. 두 warning 은 같은 결함(W-1)에서 파생된다. cafe24-api-catalog field-level 파일은 규약에서 명시 제외된 대상으로 형식이 올바르다.

## 위험도

MEDIUM
