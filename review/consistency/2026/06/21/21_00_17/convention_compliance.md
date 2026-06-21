# 정식 규약 준수 검토 결과

**검토 대상**: `spec/4-nodes/3-ai` (0-common.md · 1-ai-agent.md · 2-text-classifier.md · 3-information-extractor.md)
**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 일시**: 2026-06-21

---

## 발견사항

### [CRITICAL] `3-information-extractor.md` — `status: implemented` 와 `pending_plans` 부재 충돌 가능성

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` frontmatter (lines 1–9)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 라이프사이클 표 — `status: partial` 인 경우 `pending_plans:` **의무**, `status: implemented` 인 경우 `pending_plans` 없음 OK
- **상세**: `3-information-extractor.md` 는 `status: implemented` 로 선언되어 있으나, `code:` 에는 `agent-memory-injection.ts` / `agent-memory-schema.ts` 가 포함되어 있다. 이 파일들은 AI Agent 와 Information Extractor 가 공유하는 **persistent 메모리** 기능(§7 Persistent 메모리 recall / extraction)의 구현 경로다. 그런데 현재 이 worktree(`refactor-m1-memory-manager`)가 바로 이 메모리 관련 리팩토링을 진행 중이다. `plan/in-progress/ai-context-memory-followup-v2.md` 가 `0-common.md` 와 `1-ai-agent.md` 의 `pending_plans`에 등재되어 있지만, `3-information-extractor.md` 에는 해당 plan 이 `pending_plans` 에 없다. 만약 information-extractor 의 persistent memory 기능이 여전히 진행 중이라면 `status: partial` + `pending_plans` 선언이 필요하다.
- **제안**: 구현 착수 전 Information Extractor 의 persistent memory 기능이 실제로 완전히 구현되었는지 확인한다. 미완 surface 가 있다면 `status: partial` 로 변경하고 `pending_plans: [plan/in-progress/ai-context-memory-followup-v2.md]` 를 추가한다. 완전히 구현됐다면 `status: implemented` 유지가 정당하며 별도 조치 불필요.

---

### [WARNING] `0-common.md` — `pending_plans` 의 plan 경로 실존 확인 필요

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter `pending_plans` (line 39)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` 가드 — `spec-pending-plan-existence.test.ts` 가 `pending_plans` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/` 에 실존함을 강제
- **상세**: `0-common.md` 의 `pending_plans` 에 `plan/in-progress/ai-context-memory-followup-v2.md` 가 등재되어 있다. 이 worktree 가 해당 plan 의 후속 구현을 진행 중이므로, 구현 완료 후 plan 이 `plan/complete/` 로 이동하면 frontmatter 의 경로도 갱신되어야 하며 `spec-pending-plan-existence.test.ts` 가 통과해야 한다. 구현 착수 전 시점에 path 가 유효한지 확인이 필요하다.
- **제안**: 구현 완료 후 plan 이 complete 로 이동할 때 `0-common.md` / `1-ai-agent.md` 의 `pending_plans` 에서 해당 path 를 제거하거나 경로를 `plan/complete/...` 로 갱신한다. `pending_plans` 가 모두 완료로 이동하면 `status: partial` → `status: implemented` 로 승격 의무(`spec-status-lifecycle.test.ts` 강제).

---

### [WARNING] `1-ai-agent.md` — 문서 구조 3섹션 중 `## Rationale` 누락

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` 전체 (확인한 범위: §1~§7 이상)
- **위반 규약**: CLAUDE.md "정보 저장 위치" 표 — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`". Spec 문서 3섹션 권장 (Overview / 본문 / Rationale)
- **상세**: `1-ai-agent.md` 는 §12.x 번호가 붙은 Rationale-성격의 내용이 본문 안에 분산되어 있다 (§12.5, §12.6, §12.9, §12.10, §12.11, §12.12 등 인라인 Rationale). 반면 `0-common.md` 는 문서 끝에 별도 `## Rationale` 섹션을 두고 있다. CLAUDE.md 권장 패턴은 Rationale 를 문서 끝 단일 섹션에 모으는 것이다.
- **제안**: `1-ai-agent.md` 의 §12.x 소제목들이 **이미 `## 12. Rationale` 를 포함하거나 그에 해당하는 섹션으로 구성되어 있다면** 현행 유지 가능하다. 단, 신규 Rationale 항목 추가 시 `## Rationale` 최상위 섹션 안의 하위 섹션으로 배치해 일관성을 유지한다. 현재 형태가 관례적으로 이미 수용된 패턴이면 규약 자체를 "본문 내 번호 섹션 허용" 으로 명시하는 것도 검토.

---

### [WARNING] `0-common.md §5` — `output.error.details.retryable` CONVENTIONS 참조 표기 확인

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §5 응답 형식 규약 (Principle 11) 표, `output.error.{code, message, details?}` 행의 각주
- **위반 규약**: `spec/conventions/node-output.md §3.2.1` — "LLM 계열 노드는 `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택. `retryable === true` 일 때만 set"
- **상세**: `0-common.md §5` 표의 `output.error.{code, message, details?}` 행 각주에서 "LLM 계열 노드는 `details.retryable: boolean` 필수, `details.retryAfterSec?: number` 선택 — `retryable === true` 일 때만 set ([CONVENTIONS Principle 3.2.1](...#321-details-의-공통-표준-필드-llm-계열-노드-한정-필수))" 이라고 명시하고 있다. 이는 CONVENTIONS §3.2.1 의 invariant를 올바르게 참조하고 있다. 다만 `retryAfterSec` 의 invariant("**`retryable === true` 일 때만 set 가능 — `false` 와 함께 set 시 spec 위반**") 가 `0-common.md` 에서는 암묵적으로만 언급되고 명시 표현이 약하다.
- **제안**: `0-common.md §5` 의 각주 또는 표 열에 "`retryAfterSec` 는 `retryable === true` 일 때만 set 가능" 이라는 invariant 를 한 줄 명시해 구현자가 놓치지 않도록 강화한다. 현재 참조만으로도 규약 위반은 아니지만 명시도를 높이면 impl-prep 단계에서 회귀를 줄일 수 있다.

---

### [INFO] `3-information-extractor.md` — 문서 구조에 `## Rationale` 섹션 부재

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` 전체
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: `3-information-extractor.md` 는 본문 섹션이 잘 구성되어 있으나 문서 끝에 `## Rationale` 섹션이 보이지 않는다. `0-common.md` 는 `## Rationale` 를 가지고 있으며, `1-ai-agent.md` 는 §12.x 형태로 Rationale 를 분산한다.
- **제안**: `summary_buffer` 제외 결정(`information_extractor` 는 `manual`/`persistent` 2값만), `memoryStrategy` 별도 필드 채택 등 이 문서 고유의 설계 결정에 대한 `## Rationale` 섹션을 추가한다. 현재 이미 §Rationale 마커가 없으므로 추가 시 CLAUDE.md 권장 패턴과 일치한다.

---

### [INFO] `2-text-classifier.md` — `memoryStrategy` 필드 비보유 사실 명시 명확도

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §1` 설정 표
- **위반 규약**: 직접적 규약 위반 없음. `spec/conventions/node-output.md` 및 `0-common.md §10` 참조
- **상세**: `2-text-classifier.md §1` 설정 표에는 `memoryStrategy` 필드가 없다. 이는 `0-common.md §10` 에서 "`text_classifier` 는 본 필드를 갖지 않으며 항상 `contextScope` 가 적용된다" 고 명시된 설계 의도와 일치한다. 현재 `2-text-classifier.md` 설정 표에는 `contextScope` 5필드가 있으나 `memoryStrategy` 부재에 대한 설명 각주가 없어 구현자가 의도적으로 제외된 것인지 혼동할 수 있다.
- **제안**: `2-text-classifier.md §1` 설정 표 아래 각주에 "`text_classifier` 는 `memoryStrategy` 필드를 갖지 않으며 항상 `contextScope` 기반 manual 동작만 적용된다 ([공통 §10](./0-common.md#10-conversation-context-자동-컨텍스트-주입))" 한 줄을 추가해 의도적 제외임을 명확히 한다.

---

### [INFO] 문서 구조 — `spec/4-nodes/3-ai/0-common.md` 번호 prefix 규약 확인

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` 파일명
- **위반 규약**: CLAUDE.md "정보 저장 위치" — "제품 전체 개요·시스템 아키텍처·cross-cutting 진입: `spec/0-overview.md` (루트, `0-` prefix)"
- **상세**: `0-common.md` 의 `0-` prefix 는 CLAUDE.md 에서 루트 레벨 진입 문서 패턴으로 언급된다. 그러나 `spec/4-nodes/3-ai/0-common.md` 는 AI 서브 영역의 공통 규약 문서로 `0-` prefix 를 사용하고 있다 — 이는 기존 관례(`spec/4-nodes/0-overview.md` 도 `0-` 사용)를 따른 것으로 보이며, 단순 개요 진입 문서(`0-overview.md`)가 아닌 공통 규약 문서에 `0-` 를 사용한 것이 미세하게 다르다.
- **제안**: 현재 파일명은 이미 정착된 패턴이므로 변경보다는 규약 자체에 "영역 내 공통 규약 문서에도 `0-` prefix 허용" 을 명시하거나 현행 유지한다. 규약 위반보다는 불명확한 적용 경계 문제다.

---

## 요약

`spec/4-nodes/3-ai` 영역은 전반적으로 CONVENTIONS 참조 체계(Principle 0~11, §3.2.1 `retryable` invariant, §4.5 interaction.data 등)를 충실히 따르고 있으며, frontmatter `id`/`status`/`code:`/`pending_plans:` 구조도 `spec-impl-evidence.md` 규약에 대체로 부합한다. 가장 주의가 필요한 사항은 `3-information-extractor.md` 의 `status: implemented` 선언이 실제 persistent memory 기능의 구현 완료 여부와 정합하는지 확인하는 것이다 — 이 worktree 가 바로 메모리 리팩토링을 진행 중이므로, 구현 중인 surface 가 있다면 `status: partial` + `pending_plans` 선언이 필요하다. `0-common.md` 와 `1-ai-agent.md` 의 `pending_plans` 는 구현 완료 후 plan 경로 갱신 및 status 승격 의무를 놓치지 않도록 관리가 필요하다.

---

## 위험도

**MEDIUM** — CRITICAL 등급 1건(information-extractor status 선언 정합성)이 구현 완료 여부 확인 없이 진행될 경우 build-time 가드(`spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts`)에서 실패가 발생할 수 있다. 나머지는 WARNING/INFO 수준으로 즉각적 invariant 파괴는 없다.
