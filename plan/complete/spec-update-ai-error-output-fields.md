---
worktree: spec-update-ai-error-output-fields-594d0a
started: 2026-05-26
completed: 2026-05-29
owner: project-planner
status: complete
---

# AI 노드 error output spec 본문 결함 보강 — `text-classifier` / `information-extractor`

`/consistency-check --impl-prep spec/4-nodes/3-ai/` (2026-05-26 17:18, `review/consistency/2026/05/26/17_18_37/`) 에서 발견된 Critical 2건. 별도 작업으로 분리 — `auto-form-multiselect-widget` PR 과 무관함이 명확하여 한 PR 에 섞지 않는다.

## 결함 내용

### C-1. `details.retryable` 필수 필드 누락 (CRITICAL)

- `spec/conventions/node-output.md §3.2.1` 가 LLM 계열 3노드 (`ai_agent` / `text_classifier` / `information_extractor`) 모두에서 error output 의 `details.retryable: boolean` 을 **필수** 로 규정.
- `1-ai-agent.md §7.3 / §7.9` 는 충족.
- `2-text-classifier.md §5.3` / `3-information-extractor.md §5.3` 의 error JSON 예시 및 필드 표 양쪽에서 `retryable` (및 `retryAfterSec?`) 누락.
- 구현자가 spec 본문만 보고 작성하면 invariant 위반 코드를 만들 위험.

### C-2. `text-classifier` JSON 예시에 `"status": "ended"` 누락 (CRITICAL)

- `spec/conventions/node-output.md` Principle 0 (5필드 invariant), Principle 11 (JSON 예시 5필드 외 top-level 키 금지) 위반.
- `2-text-classifier.md §5.1, §5.2, §5.3` JSON 예시 전반에 누락. `1-ai-agent.md §7.1~§7.3` 패턴이 기준.

## 보강 항목

- [x] `2-text-classifier.md §5.3` JSON 예시 `details` 에 `"retryable": true` 추가 + 필드 표에 `output.error.details.retryable` / `output.error.details.retryAfterSec?` 행 추가 (Principle 3.2.1 cross-ref 포함). **값 정정**: 본 예시는 timeout (`LLM_CALL_FAILED`) 이므로 §3.2.1 + ai-agent §10 분류상 `true` (backlog 초안의 `false` 는 timeout 의미와 상충 → 교정).
- [x] `3-information-extractor.md §5.3` 동일 보강 — 본 예시는 JSON 파싱 실패 (`LLM_RESPONSE_INVALID`) 이므로 `retryable: false`. **추가**: §5.6.4 (`MAX_COLLECTION_RETRIES_EXCEEDED`) error envelope 에도 동일 결함이 있어 `retryable: false` 함께 보강.
- [x] `2-text-classifier.md §5.1, §5.2, §5.3` 각 JSON 예시 top-level 에 `"status": "ended"` 추가 (fallback 변형 포함) + §5.1/§5.2/§5.3 필드 표에 `status` 행 추가.
- [~] (선택, **이연**) `3-information-extractor.md` 의 `config.schema` 키명을 `config.outputSchema` 로 통일 — Warning W-1 (Principle 7). doc 전반 ~15곳 + expression 접근 예에 걸쳐 별도 작업으로 분리. §8 Rationale 에 이연 결정 기록. → 후속 backlog 필요.

## 완료 기록 (2026-05-29)

- consistency-check `--spec`: `review/consistency/2026/05/29/00_45_44/` — **BLOCK: NO** (Critical 0, Warning 4 = draft 문서 형식·추적 메모, INFO 9). spec 내용 충돌 없음.
- spec 반영: `spec/4-nodes/3-ai/2-text-classifier.md` (§5.1/§5.2/§5.3 + CHANGELOG), `spec/4-nodes/3-ai/3-information-extractor.md` (§5.3/§5.6.4/§8 Rationale/CHANGELOG).
- side-effect 추적 메모: `multiturn-error-preserve.md` 영향 spec 표 + `node-output-redesign/text-classifier.md` 병렬 편집 주의.
- 두 노드 모두 `status: spec-only`, `code: []` — 구현 영향 없음 (순수 문서 정합성).
