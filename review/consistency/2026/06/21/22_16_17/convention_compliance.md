# 정식 규약 준수 검토 결과

검토 대상: `spec/4-nodes/3-ai` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
검토 모드: --impl-done (scope=spec/4-nodes/3-ai, diff-base=origin/main)
검토 일시: 2026-06-21

---

## 발견사항

### INFO-1: `0-common.md` — `id: common` 은 basename 과 동일하나 단독으로 의미가 약함

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` frontmatter `id: common`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — "같은 basename 이 영역을 달리해 중복될 때 후발 문서가 영역 prefix 로 충돌 회피"
- **상세**: `id: common` 은 다른 영역 폴더에서도 동일 basename(`0-common.md` → `id: common`)으로 사용될 수 있다. 현재는 충돌이 없으나 명세에서는 충돌 시 영역 prefix 채택을 권고한다. 단순 INFO — 현재 다른 `id: common` 를 가진 spec 파일이 존재하면 충돌 가드 대상이 됨.
- **제안**: 충돌이 현재 없다면 유지 가능. 예방 차원에서 `id: ai-node-common` 으로 명시적 prefix 부여를 고려할 수 있다. 가드 자동 통과 여부는 `spec-frontmatter.test.ts` 가 결정하며, 이 수정은 규약 위반이 아닌 drift 예방이다.

---

### INFO-2: `2-text-classifier.md` — `status: implemented` 이나 `memoryStrategy` 미구현 선언 상태와 맞지 않을 수 있음

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter `status: implemented`, `pending_plans:` 없음
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` — `implemented` 는 "모든 약속 구현 완료" 를 의미하며, `partial` 이면 `pending_plans` 의무
- **상세**: `0-common.md §10` 에서 Text Classifier 는 `contextScope` (manual) 만 갖고 `memoryStrategy` 필드가 없다고 명시되어 있으며, `2-text-classifier.md §1` 은 memory strategy 관련 필드를 갖지 않는다. 해당 필드가 의도적으로 제외된 설계이므로 `implemented` 가 맞다. 그러나 `0-common.md §10` 에서 언급하는 "자동메모리 주입은 ai_agent + information_extractor" 라는 스코프 제한이 text-classifier spec 본문에는 명시적으로 거울되지 않는다. 현재 구현 완료 선언은 해당 노드의 의도적 축소 범위를 커버하므로 기술적으로 위반 아님.
- **제안**: 현 상태 유지. 단, text-classifier 가 의도적으로 `memoryStrategy` 를 제외한 근거를 §1 `memoryStrategy` 필드가 없음 노트에 한 줄로 명시하면 향후 drift 탐지 시 오탐을 줄일 수 있다.

---

### INFO-3: `1-ai-agent.md §4` 비활성 필드 정의 문서 잔존

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §4 (Tool Area 연동)` — `toolNodeIds`, `toolOverrides`, `ToolOverride` 구조 표
- **위반 규약**: 규약 직접 위반은 아님. `spec/conventions/spec-impl-evidence.md §3` 의 `implemented`/`partial` 판단 맥락에서, 비활성 기능에 대한 정의가 spec 본문에 남아 있어 `code:` 의 글로브 매칭 결과에 허위 포함이 생길 수 있음
- **상세**: §4 본문에 `⚠ 재작성 예정 (현재 제거됨)` 경고가 있으나, `toolNodeIds` / `toolOverrides` / `ToolOverride` 구조 표가 spec 본문에 여전히 정의되어 있다. 이는 비활성 사양을 spec 에 남겨 둔 것으로, 구현 커버리지 추적 시 실제 구현되지 않은 부분이 spec 에 포함되어 있다. `status: partial` 에 해당 필드를 포함한 `pending_plans` 가 있으므로 (`ai-agent-tool-connection-rewrite.md`) 라이프사이클은 올바르다.
- **제안**: 현 상태 유지 (pending_plans 가 커버). §4 비활성 섹션에 "구현 후 이 섹션 삭제/갱신 예정" 메모가 있으므로 plan 완료 시점에 반드시 spec 동기 갱신 필요.

---

### WARNING-1: `_product-overview.md` — spec frontmatter (`id`/`status`) 없음

- **target 위치**: `spec/4-nodes/3-ai/_product-overview.md`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` 제외 기준 — `spec/<영역>/_*.md` (밑줄 prefix) 는 가드 면제
- **상세**: `_product-overview.md` 는 밑줄 prefix 이므로 `spec-impl-evidence.md §1` 기준으로 frontmatter 가드에서 **의도적으로 면제**된다. 가드 위반 아님. 다만 해당 파일이 구현 상태 추적 없이 "PRD" 성격의 문서로 운용되고 있으므로, 본문의 "구현 완료(✅)" 상태 서술이 실제 구현 상태와 일치하는지 별도 검증 경로가 없음을 인지해야 한다.
- **제안**: 경고라기보다 인지 사항. `_product-overview.md` 의 구현 상태 기술은 spec frontmatter `status` 와 달리 자동 가드 대상이 아니므로, 대규모 리팩터링 후 PRD 본문의 ✅ 표시를 수동으로 동기화해야 한다.

---

### INFO-4: `0-common.md §5` 에서 에러 코드 표기 방식 확인

- **target 위치**: `spec/4-nodes/3-ai/0-common.md §5` 및 `1-ai-agent.md §7.3`, `§7.9`
- **위반 규약**: `spec/conventions/node-output.md §3.2` — `code` 는 `UPPER_SNAKE_CASE`; `spec/conventions/error-codes.md §1`
- **상세**: `§7.3` 예시의 `"code": "LLM_CALL_FAILED"`, `§7.9` 의 에러 코드들이 `UPPER_SNAKE_CASE` 를 준수하고 있다. `3-information-extractor.md §1` 의 `output.error.code: 'MAX_COLLECTION_RETRIES_EXCEEDED'` 도 올바른 형식. 규약 준수 확인.
- **제안**: 없음. 에러 코드 표기 규약을 올바르게 따르고 있음.

---

### INFO-5: `1-ai-agent.md §7` — `output.result.messages` 필드가 `output` 레벨에서 `result.*` 아래로 올바르게 이동됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §7` D6 결정 노트
- **위반 규약**: `spec/conventions/node-output.md §4.4` — Waiting 상태에서 구 `output.messages`·`output.message` 의 폐기
- **상세**: D6 결정 노트에서 "옛 top-level `output.messages` / `.message` / `.turnCount` 는 폐기 — 다운스트림 expression 은 `$node["X"].output.result.messages` 처럼 단일 경로로 접근" 이라고 명시하며 규약과 정합한다. `spec/conventions/node-output.md §4.3` 의 ai_agent (multi) Waiting `output` 표에서도 `{ result: { messages, message, turnCount } }` 형태를 확인하므로 규약 준수.
- **제안**: 없음.

---

### INFO-6: `1-ai-agent.md §1` — `contextScope` 필드의 `✓` 필수 표시

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md §1` 설정 표 — `contextScope | ... | ✓ | none`
- **위반 규약**: 직접 위반 아님. 단, `spec/conventions/node-output.md §4.3` 의 Waiting output 비교표에서 ai_agent multi 의 `maxTurns` 를 output 에 echo 하지 않는다고 명시하는 것과 동일 패턴으로, `contextScope` 가 `✓` (필수) 로 표시되나 `memoryStrategy ≠ manual` 시 무효인 점에 대한 주석 ("memoryStrategy ≠ manual 시 무효") 이 이미 추가되어 있다.
- **상세**: 필수 표시 `✓` 는 스키마 레벨 필수(기본값 `none` 이 있더라도 반드시 포함해야 하는 필드)를 의미하는 것으로 보이며, spec 본문 규약에서 "필수" 컬럼 정의가 별도로 명시되어 있지 않다. 공통 패턴(`0-common.md §10` 표) 에서는 `✓` 열 자체가 있으나 `1-ai-agent.md §1` 에서 `contextScope | ... | ✓ | none` 는 기본값 있는 필드에 `✓` 를 주어 혼동을 줄 수 있다.
- **제안**: INFO 수준. 관행 유지 가능하나 "필수" 컬럼의 의미를 spec 표 범례에 한 줄 명시하면 혼동을 방지할 수 있다.

---

## 요약

`spec/4-nodes/3-ai` 영역(0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)의 정식 규약 준수 수준은 전반적으로 양호하다. frontmatter(`id`/`status`/`code:`/`pending_plans:`) 는 `spec-impl-evidence.md` 규약에 따라 올바르게 작성되어 있으며, `_product-overview.md` 는 밑줄 prefix 면제 규정을 정상 적용받는다. 출력 포맷(`output.result.*`/`output.error.{code, message, details}`/`output.interaction.*`)은 `node-output.md` Principle 3.2.1 의 LLM 계열 필수 필드(`retryable`, `retryAfterSec invariant`) 를 포함해 준수하고 있다. 에러 코드는 `UPPER_SNAKE_CASE` 를 유지하고, `_resumeState`/`_resumeCheckpoint`/`_retryState` 의 top-level 허용 예외(Principle 0 예외)도 명시적으로 문서화되어 있다. 발견된 항목은 모두 INFO 또는 WARNING(인지 사항) 수준으로, CRITICAL 위반은 없다.

---

## 위험도

LOW
