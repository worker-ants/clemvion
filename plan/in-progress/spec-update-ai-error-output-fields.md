---
worktree: (assigned at impl-start)
started: 2026-05-26
owner: project-planner (TBD)
status: backlog
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

- [ ] `2-text-classifier.md §5.3` JSON 예시 `details` 에 `"retryable": false` 추가 + 필드 표에 `output.error.details.retryable` / `output.error.details.retryAfterSec?` 행 추가 (Principle 3.2.1 cross-ref 포함)
- [ ] `3-information-extractor.md §5.3` 동일 보강
- [ ] `2-text-classifier.md §5.1, §5.2, §5.3` 각 JSON 예시 top-level 에 `"status": "ended"` 추가
- [ ] (선택) `3-information-extractor.md §5.x` 의 `"schema"` 키명을 `"outputSchema"` 로 통일 — Warning W-1 (`spec/conventions/node-output.md` Principle 7 — config echo 원본 필드명 그대로)

## 후속

`project-planner` 가 본 plan 을 picking 해 `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md` 갱신. `/consistency-check --spec` 통과 후 spec 반영.
