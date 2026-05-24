# 정식 규약 준수 검토 결과

**검토 모드**: 구현 착수 전 검토 (--impl-prep)
**검토 대상**: `spec/4-nodes/3-ai` (0-common.md, 1-ai-agent.md, 2-text-classifier.md, 3-information-extractor.md)
**검토 일시**: 2026-05-24

---

## 발견사항

### [WARNING] text-classifier §5.3 에러 출력에 `details.retryable` 필드 누락

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 에러 출력 JSON 예시 및 필드 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2.1 — "LLM 계열 노드 (`ai_agent` / `text_classifier` / `information_extractor`) 에서 `details.retryable: boolean` 필수"
- **상세**: §5.3 의 JSON 예시는 `output.error.details` 에 `originalInput` 만 포함하고 `retryable: boolean` 필드가 빠져있다. 필드 표에도 `retryable` / `retryAfterSec` 항목이 없다. `ai-agent` §7.3 및 §7.9 는 해당 필드를 명시적으로 기재한 반면 `text-classifier` 는 누락됐다.
- **제안**: §5.3 JSON 예시의 `details` 에 `"retryable": true` (또는 `false`, 케이스에 따라) 를 추가하고, 필드 표에 `output.error.details.retryable` / `output.error.details.retryAfterSec?` 행을 CONVENTIONS Principle 3.2.1 cross-ref 와 함께 추가한다. §6 에러 코드 표에도 각 code 별 `retryable` 컬럼을 추가하면 ai-agent §10 표와 형식이 통일된다.

---

### [WARNING] information-extractor §5.3 에러 출력에 `details.retryable` 필드 누락

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 에러 출력 JSON 예시 및 필드 표
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2.1 — LLM 계열 노드 에러 `details.retryable: boolean` 필수
- **상세**: §5.3 JSON 예시의 `output.error.details` 에 `attempts` / `originalInput` / `lastResponse` 는 있으나 `retryable` 이 없다. §5.6.4 max_retries 케이스의 `output.error.details` 에도 `retryable` 이 없다. 두 케이스 모두 Principle 3.2.1 을 따르지 않는다.
- **제안**: §5.3 과 §5.6.4 JSON 예시 및 필드 표에 각각 `retryable: boolean` (LLM_CALL_FAILED = `true`, LLM_RESPONSE_INVALID = `false`, MAX_COLLECTION_RETRIES_EXCEEDED = `false`) 를 추가한다. §6 에러 코드 표에도 `retryable` 컬럼 추가.

---

### [WARNING] text-classifier `meta.turnDebug` vs `meta.llmCalls` 필드 명명 불일치 — 공통 §6 규약과 상이

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.1, §5.2, §5.3 의 `meta` 블록
- **위반 규약**: `spec/conventions/node-output.md` Principle 2 (메타 필드 공통 규약), `spec/4-nodes/3-ai/0-common.md` §6 토큰 회계 표 — `meta.turnDebug` 를 AI 노드 공통 필드로 정의
- **상세**: text-classifier 의 `meta` 예시는 `meta.llmCalls` 라는 필드명을 사용한다. 그러나 0-common.md §6 은 `meta.turnDebug` 를 공통 표준으로 정의하고, ai-agent §7 및 information-extractor §5 는 모두 `meta.turnDebug` 를 사용한다. text-classifier 는 single-turn 노드여서 구조가 단순하지만 `turnDebug[0].llmCalls` 배열 형식을 사용해야 3 노드 공통 인터페이스를 유지할 수 있다.
- **제안**: text-classifier §5.x 의 `meta.llmCalls` 를 `meta.turnDebug: [{ turnIndex: 1, llmCalls: [...], totalDurationMs }]` 구조로 변경해 공통 §6 규약과 일치시킨다. 다운스트림 expression 에서도 `meta.turnDebug[0].llmCalls` 로 단일 경로 접근이 가능해진다.

---

### [WARNING] information-extractor config echo key가 `outputSchema` 아닌 `schema` — config echo 규약의 모호성

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1, §5.4, §5.5, §5.6 의 `config.schema`
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 — config echo 는 사용자가 설정한 raw 값을 그대로 echo. 식별자 동일성을 전제로 함
- **상세**: §1 설정 표에서 필드명은 `outputSchema` 이나, §5 출력 구조의 `config` echo 에서는 `config.schema` 로 짧게 쓴다. §5.1 필드 표에도 "config.schema (= raw outputSchema)" 라고 주석을 달아 의미는 명확하나, Principle 7 의 "사용자가 설정한 raw 값을 그대로" 라는 원칙에서 key 이름도 원래 필드명과 동일해야 한다. 다운스트림이 `$node["X"].config.schema` 로 접근한다면 `outputSchema` 와 다른 경로가 노출된다.
- **제안**: spec 에 `config.outputSchema` 로 통일하거나, `config.schema` 가 의도적인 alias 임을 명시적으로 정의하고 CONVENTIONS §7 의 "alias 허용" 여부를 규약에 추가한다. 현재로선 `config.outputSchema` 로 통일하는 것이 spec-to-impl 일관성 측면에서 권장된다.

---

### [INFO] text-classifier §3.2 포트 표에 `fallback` 이 `CONVENTIONS Principle 6` 시스템 예약어 충돌 여부 명시 없음

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §3.2 출력 포트 표 및 §3 하단 주석
- **위반 규약**: `spec/conventions/node-output.md` Principle 6 — 시스템 포트 예약어 목록에 `fallback` 이 포함됨. "사용자 설정 ID 가 이 값과 충돌하면 프런트엔드에서 거부"
- **상세**: Principle 6 의 예약어 목록에는 `fallback` 이 포함되어 있다. text-classifier 의 `fallback` 포트는 시스템 포트이므로 충돌이 아니라 올바른 사용이지만, §3 주석에서 "사용자 카테고리 이름·id 가 `fallback` 과 충돌하면 schema 가 거부한다" 는 언급이 있어 의도는 맞다. 다만 reserved 예약어 목록 인용 표현이 `__none__` 까지 포함하여 spec 에 별도로 나열하고 있는데, `fallback` 이 Principle 6 의 공식 예약어이기도 하다는 cross-ref 가 없어 spec 내 예약어 목록이 `node-output.md §Principle 6` 와 독립적으로 관리될 위험이 있다.
- **제안**: §3 하단 주석의 예약어 나열을 Principle 6 의 예약어 목록 cross-ref 로 대체하거나 "Principle 6 의 예약어 + `__none__`" 이라고 명시해 단일 진실 원칙을 유지한다.

---

### [INFO] 0-common.md §5 내 "CONVENTIONS §4.5" 참조가 정확한 섹션 경로를 안내하지 않음

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §4 (Multi-turn 차단 모드) 4번째 bullet 및 §5 표 내 `output.interaction` 행
- **위반 규약**: `spec/conventions/node-output.md` Principle 4.5 — `interaction.data` payload 규격
- **상세**: §4 의 "CONVENTIONS §4.5" 와 §5 표의 "Principle 4.5" 는 앵커 없이 짧게 인용되어 있다. 다른 위치 (ai-agent §7.5, information-extractor §5.5) 에서는 `(CONVENTIONS §4.5)` 에 실제 앵커 링크가 붙어 있는 경우가 많지 않아 일관성 차이가 있다. 규약 준수 검증 자동화 측면에서 앵커 링크가 붙어 있으면 drift 발견이 쉽다.
- **제안**: `[CONVENTIONS Principle 4.5](../../conventions/node-output.md#45-interactiondata-payload-규격)` 형태의 앵커 링크로 교체한다.

---

### [INFO] ai-agent §1 config 표에서 `contextScope` 의 `✓` 필수 표시가 공통 §10 기본값 설명과 약간 혼동 가능

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §1 config 표, `contextScope` 행 "필수" 컬럼 = `✓`
- **위반 규약**: 엄밀한 규약 위반이 아닌 문서 명확성 사항. `spec/conventions/node-output.md` Principle 1.1.1 — config/output 직교성
- **상세**: `contextScope` 에 `✓` (필수) 가 표시되어 있으나 기본값은 `none` 이다. schema 에서 `required` 일 수 있지만 default 가 존재하면 실질적으로 필수가 아닌 것처럼 읽힌다. `maxToolCalls` (`✓`, 기본 `10`) 와 `responseFormat` (`✓`, 기본 `text`) 도 동일 패턴이라 내부 일관성은 있다. 단, 읽는 사람이 "반드시 명시 설정해야 한다"고 오해할 수 있다.
- **제안**: 필수(`✓`) 표시의 의미를 각주나 범례에 "schema `required` (기본값으로 자동 충족 가능)" 으로 명시해 혼동을 줄인다. 또는 `ai_agent` §1 표 상단에 간단한 범례 한 줄을 추가한다.

---

## 요약

`spec/4-nodes/3-ai` 의 4개 문서는 전반적으로 `spec/conventions/node-output.md` 의 Principle 0~11 을 잘 따르며, 문서 구조(Overview·본문·Rationale 3섹션), 명명 규약, 출력 포맷 wrapper(`output.result.*` / `output.error.*` / `output.interaction.*`), config echo 원칙 등의 정식 규약을 충실히 준수하고 있다. 가장 중요한 발견은 LLM 계열 노드 필수 사항인 `details.retryable: boolean` 이 `text-classifier` 와 `information-extractor` 의 에러 출력 스펙에 누락된 점 (Principle 3.2.1 직접 위반)으로, 구현 시 이 두 필드를 빠뜨리면 `ai-agent` 와의 인터페이스 invariant 가 깨진다. `text-classifier` 의 `meta.llmCalls` 명명도 공통 §6 의 `meta.turnDebug` 표준과 어긋나 구현체가 이를 그대로 따를 경우 다운스트림 expression 경로가 노드마다 달라진다. 이 두 WARNING 은 구현 착수 전 spec 에서 수정하거나 구현 시 반드시 컨벤션 기준으로 맞춰야 한다.

---

## 위험도

MEDIUM
