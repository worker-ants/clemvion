# Convention Compliance Review — spec/4-nodes/3-ai

검토 모드: `--impl-done` (구현 완료 후 검토), scope=`spec/4-nodes/3-ai`, diff-base=`origin/main`

---

## 발견사항

### 1. [WARNING] `meta.llmCalls` (text-classifier) vs `meta.turnDebug` (ai-agent, information-extractor) 필드명 불일치

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.1 JSON 예시 및 필드 표 (`meta.llmCalls`)
- **위반 규약**: `spec/4-nodes/3-ai/0-common.md §6` — "모든 AI 노드의 LLM 호출 결과 메타에는 다음 필드가 포함된다: `meta.turnDebug` (선택, 턴별 LLM 호출 트레이스)"
- **상세**: `0-common.md §6`은 LLM call trace 필드로 `meta.turnDebug[{ turnIndex, llmCalls, ... }]`를 정의한다. `information-extractor`와 `ai-agent` 는 이를 준수해 `meta.turnDebug`를 사용한다. 그러나 `2-text-classifier.md`는 §5.1 (성공), §5.2 (multi-label), §5.3 (에러) 의 모든 예시 JSON 및 필드 표에서 `meta.llmCalls` (flat 배열)를 직접 사용하며, `turnDebug` wrapper를 두지 않는다. Single-turn 이므로 `turnIndex` 가 1개뿐이라는 설계 의도가 있더라도, 공통 규약은 단일 turn을 길이 1의 `turnDebug` 배열로 표현하도록 `information-extractor §5.1`이 보여주고 있다 (`"turnDebug": [{ "turnIndex": 1, "llmCalls": [...], "totalDurationMs": 810 }]`). `text-classifier` 만 이 패턴에서 이탈하며, 그 이탈의 근거가 `0-common.md` 이나 `2-text-classifier.md Rationale` 어디에도 명시되지 않는다.
- **제안**: `2-text-classifier.md` §5.1/§5.2/§5.3 예시 JSON에서 `meta.llmCalls: [...]`를 `meta.turnDebug: [{ "turnIndex": 1, "llmCalls": [...], "totalDurationMs": N }]`로 교체하거나, 단일 turn이므로 flat `meta.llmCalls`를 text-classifier 한정으로 허용한다는 예외를 `0-common.md §6` 또는 `2-text-classifier.md §8 Rationale`에 명시한다.

---

### 2. [WARNING] `text-classifier` §5.3 에러 JSON 예시에 `details.retryable` 누락

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 "Case: 에러" JSON 예시
- **위반 규약**: `spec/conventions/node-output.md §3.2.1` — "LLM 계열 노드(`ai_agent`/`text_classifier`/`information_extractor`)에서 `details.retryable: boolean` 필수"
- **상세**: §5.3의 에러 JSON 예시(`code: "LLM_CALL_FAILED"`)는 `details` 객체 안에 `"originalInput": "환불 요청드립니다 …(truncated)"` 만 보여 주고 `retryable` 필드가 없다. 필드 표는 `details.retryable`을 정확히 기술하나, 예시 JSON이 해당 필드를 생략함으로써 문서가 불일치한다. Principle 11(출력 예시 문서화 규칙)은 "undefined 필드는 JSON 예시에서 생략"을 허용하나, `retryable`은 Principle 3.2.1에서 "필수(boolean)"로 지정되어 있어 undefined 취급이 아니다.
- **제안**: §5.3 JSON 예시의 `details` 블록에 `"retryable": true`(timeout/5xx 예시에서 true가 맞음)와, 해당 경우라면 `"retryAfterSec": 30`을 추가해 규약 예시와 일치시킨다. `ai-agent.md §7.3`이 보여주는 패턴(`"details": { "retryable": true, "retryAfterSec": 30, "provider": "openai", "statusCode": 503, ... }`)을 참고한다.

---

### 3. [INFO] `spec/4-nodes/3-ai/_product-overview.md` 파일명 — CLAUDE.md 명명 컨벤션 준수

- **target 위치**: `spec/4-nodes/3-ai/_product-overview.md` (파일명)
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "제품 정의·요구사항: `spec/<영역>/_product-overview.md`" (권장 명명)
- **상세**: `spec/4-nodes/3-ai/` 내에 `_product-overview.md`가 존재하며 올바른 명명을 따르고 있다. 동시에 공통 섹션 분류 문서는 `0-common.md`(`0-` prefix) 를 사용하는데, 이는 `spec/4-nodes/`의 `0-overview.md` 패턴과 일치한다. 명명 규약 준수 관점에서 이상 없음 — INFO로 기록하여 향후 검토 시 재확인 대상에서 제외하도록 한다.
- **제안**: 현행 유지. 조치 불필요.

---

### 4. [INFO] `spec/4-nodes/3-ai/1-ai-agent.md` — `## 12. Rationale` 위치 (다중 서브섹션 포함)

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12 Rationale
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`"
- **상세**: `1-ai-agent.md`는 `## 12. Rationale`을 문서 말미에 위치시키며, 하위 서브섹션 §12.1~§12.14 을 포함한다. 이는 3섹션 권장(Overview/본문/Rationale) 구조를 준수한다. 번호(`12.`)가 붙은 섹션이나 본질은 Rationale 로 사용되고 있어 규약 위반이 아니나, `0-common.md`나 `2-text-classifier.md`는 번호 없이 `## Rationale`을 쓴다. 일관성 차원의 관찰이며 기능적 위반이 아님.
- **제안**: 현행 유지 또는 `## Rationale`(번호 없이)로 헤딩을 맞추어 문서 간 일관성 향상. 강제 사항 아님.

---

### 5. [INFO] `text-classifier.md §8 Rationale` — 단독 결정 없음 명시

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md §8 Rationale`
- **위반 규약**: 없음 (위반 아님)
- **상세**: `2-text-classifier.md §8 Rationale`은 "설계 결정의 SoT는 다음 참조 (본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다)"라 명시하며 참조 링크로 대체한다. CLAUDE.md는 Rationale 섹션을 "권장"하나 강제 포맷을 규정하지 않으므로, 이 처리는 허용된다. INFO로 기록.
- **제안**: 조치 불필요.

---

## 요약

`spec/4-nodes/3-ai` 영역의 정식 규약 준수 수준은 전반적으로 양호하다. 네이밍(`0-common.md`, `_product-overview.md`, `0-` prefix), 에러 코드 형식(`UPPER_SNAKE_CASE`), 출력 wrapper(`output.result.*`/`output.error.*`/`output.interaction.*`), Principle 0 5필드 구조, `retryable` 의미 기술, `_resumeState`/`_resumeCheckpoint`/`_retryState` 등 핵심 불변식은 모두 conventions을 준수한다. 다만 두 가지 실질적 불일치가 존재한다: `text-classifier`가 공통 규약(`0-common.md §6`)에서 정의한 `meta.turnDebug` 대신 `meta.llmCalls` flat 배열을 사용하는 점(§1), 그리고 에러 JSON 예시에서 Principle 3.2.1이 필수로 지정한 `details.retryable` 필드를 누락한 점(§2)이다. 두 발견 모두 구현 코드가 아닌 spec 문서의 정합성 문제이며, 구현이 아닌 문서 수정으로 해소 가능하다.

## 위험도

LOW
