# 정식 규약 준수 검토 결과

**검토 모드**: `--impl-prep` (구현 착수 전 검토)
**검토 대상**: `spec/4-nodes/3-ai/` 전 문서 (`0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`)
**참조 규약**: `spec/conventions/node-output.md`, `CLAUDE.md` 명명 컨벤션

---

## 발견사항

### [CRITICAL] `text-classifier` · `information-extractor` error 출력에 `retryable` 필드 누락

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 error 출력 예시 및 필드 표 / `spec/4-nodes/3-ai/3-information-extractor.md` §5.3 error 출력 예시 및 필드 표
- **위반 규약**: `spec/conventions/node-output.md` §3.2.1 — "LLM 계열 노드 (`ai_agent` / `text_classifier` / `information_extractor`) 에서 `details.retryable: boolean` 필수. `details.retryAfterSec?: number` 는 `retryable === true` 일 때만 set 가능 — invariant."
- **상세**: `1-ai-agent.md` §7.3 (single error) 과 §7.9 (multi error) 에는 `details: { provider, statusCode, retryable: true, retryAfterSec: 30 }` 가 JSON 예시와 필드 표 양쪽에 명시되어 있다. 반면 `2-text-classifier.md` §5.3 의 JSON 예시 `details` 에는 `originalInput` 만 있고 `retryable` 이 없으며, 필드 표에도 해당 행이 존재하지 않는다. `3-information-extractor.md` §5.3 의 JSON 예시와 필드 표에도 `retryable` / `retryAfterSec` 가 누락되어 있다. Principle 3.2.1 에서 `retryable` 은 LLM 계열 3 노드 모두에서 `details` 의 **필수** 필드로 명시되어 있으므로 이 누락은 구현 담당자가 해당 invariant 를 인지하지 못하게 만드는 직접적 spec 위반이다.
- **제안**: `2-text-classifier.md` §5.3 JSON 예시 `details` 에 `"retryable": false` (타임아웃은 `true`) 추가. 필드 표에 `output.error.details.retryable` / `output.error.details.retryAfterSec?` 행 추가 (CONVENTIONS Principle 3.2.1 cross-ref 포함). `3-information-extractor.md` §5.3 동일 보강. `ai_agent` §7.3/§7.9 의 표현 방식을 기준으로 맞춤.

---

### [CRITICAL] `text-classifier` error 출력에 `status: "ended"` 누락

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §5.3 JSON 예시
- **위반 규약**: `spec/conventions/node-output.md` Principle 0 — "5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 이 불변." 및 Principle 11 — "JSON 예시는 5필드 (`config`/`output`/`meta?`/`port?`/`status?`) 외 top-level 키 금지."
- **상세**: §5.3 의 error 케이스 JSON 예시 마지막 줄이 `"port": "error"` 로 끝나며 `"status": "ended"` 가 없다. §5.1 단일-label 예시와 §5.2 multi-label 예시에도 `status` 키가 없다. `1-ai-agent.md` §7.3 에는 `"port": "error"`, `"status": "ended"` 가 명시되어 있다. Principle 11 에서 JSON 예시는 5필드 형식을 따르도록 요구하며, 종결 케이스의 `status: "ended"` 는 엔진 계약의 일부다. 구현 시 `status` 필드를 빠뜨릴 위험이 있다.
- **제안**: `2-text-classifier.md` §5.1, §5.2, §5.3 의 JSON 예시 각각에 `"status": "ended"` 추가. (`ai_agent` §7.1~§7.3 패턴에 맞춤.)

---

### [WARNING] `information-extractor` config echo 에서 필드명 불일치 — `config.schema` vs `outputSchema`

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §5.1 (config echo 표 `config.schema` 행), §5.3, §5.4, §5.5, §5.6 JSON 예시 내 `"schema": [/* … */]`
- **위반 규약**: `spec/conventions/node-output.md` Principle 7 — "config echo 는 사용자가 UI에서 설정한 원본 값을 그대로 echo. 필드명도 schema 선언 그대로." CLAUDE.md 단일 진실 원칙.
- **상세**: §1 config 표에서 해당 필드명은 `outputSchema` (TypeScript schema 키)이다. 그런데 §5.1 필드 표에는 `config.schema` 로, JSON 예시에도 `"schema": [...]` 로 기재되어 있다. §5.1 주석에 "config echo (= raw `outputSchema`)" 라는 메모가 있지만, Principle 7 에서 config echo 는 schema 선언 키명을 그대로 써야 하므로 echo 된 키명이 `schema` 이면 실제 handler 가 `rawConfig.schema` 로 읽는지 `rawConfig.outputSchema` 로 읽는지가 모호해진다. 구현 단계에서 혼란을 줄 수 있는 명명 불일치다.
- **제안**: §5.x 의 JSON 예시 및 필드 표 전체에서 `"schema"` 를 `"outputSchema"` 로 통일하거나, 또는 handler 가 의도적으로 `outputSchema` → `schema` 로 key-rename 하여 echo 한다면 §5.1 하단에 "config echo 시 `outputSchema` 키를 `schema` 로 rename 한다" 는 명시적 note 를 추가해 의도를 확정한다.

---

### [WARNING] `1-ai-agent.md` §12 Rationale — §4 (Tool Area) 내 계획 중단 영역에 대한 Rationale 부재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4 ("재작성 예정, 현재 제거됨" 경고 블록), §12 Rationale
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: §4 본문에 `toolNodeIds` / `toolOverrides` / Tool Area 연동 전체가 "재작성 예정 (현재 제거됨)" 으로 비활성 처리되어 있고, 사유 및 복원 절차는 `plan/complete/ai-agent-tool-connection-rewrite.md` 로만 포워드된다. §12 Rationale 에 "왜 Tool Area 연동을 일시 제거했는가" 또는 최소한 plan 문서 cross-ref 가 포함되어 있지 않다. CLAUDE.md 에 따르면 결정의 근거는 해당 spec 문서 끝 Rationale 에 있어야 한다.
- **제안**: `1-ai-agent.md` §12 Rationale 에 "Tool Area 연동 일시 제거 (§4)" 항목을 신설하고 결정 배경과 `plan/complete/ai-agent-tool-connection-rewrite.md` 링크를 명시한다. 또는 §4 경고 블록 안에 `> 결정 근거: §12 Rationale "Tool Area 연동 제거 배경"` cross-ref 를 추가한다.

---

### [WARNING] `0-common.md` §5 참조 — Principle 번호 불일치 ("Principle 11" vs 실제 섹션)

- **target 위치**: `spec/4-nodes/3-ai/0-common.md` §5 제목 "응답 형식 규약 (Principle 11)"
- **위반 규약**: `spec/conventions/node-output.md` — Principle 11 의 실제 내용은 "출력 예시 문서화 규칙" (JSON 예시 포맷 가이드)이며, `output.result.*` wrapper 규약은 별도 원칙들의 조합(Principle 1, 1.1, 8 등)이다.
- **상세**: `0-common.md` §5 섹션명이 "응답 형식 규약 (Principle 11)" 이고 하위 cross-ref 들도 "(CONVENTIONS Principle 11)" 을 wrapper 규약의 SoT 로 인용한다. 그러나 `spec/conventions/node-output.md` 에서 Principle 11 은 "출력 예시 문서화 규칙" — JSON 예시 markdown 포맷을 정의하는 섹션이다. output wrapper (`output.result.*` / `output.error.*` / `output.interaction.*`) 구조의 근거 원칙은 Principle 1, 3.2, 4, 8 의 조합이다. Principle 11 을 wrapper 규약의 단일 SoT 로 호칭하면 conventions 문서를 읽는 독자가 혼동한다.
- **제안**: §5 제목 및 본문의 "(CONVENTIONS Principle 11)" 호칭을 정확한 원칙 번호(Principle 1/3/8 등) 또는 보다 중립적인 "(CONVENTIONS)" 로 수정한다. 또는 `spec/conventions/node-output.md` 에서 LLM wrapper 규약에 새 Principle 번호를 부여하고 §5 의 참조를 그쪽으로 연결한다.

---

### [INFO] `2-text-classifier.md` §8 Rationale — 실질 내용 없이 stub 수준

- **target 위치**: `spec/4-nodes/3-ai/2-text-classifier.md` §8 Rationale
- **위반 규약**: CLAUDE.md "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" (3섹션 구성 권장)
- **상세**: §8 Rationale 의 내용이 "설계 결정의 SoT 는 다음 참조 (본 노드 단독 결정 없음 — 공통 규약을 그대로 따른다):" 와 cross-ref 3줄로만 이루어져 있다. `includeSystemContext` / `systemContextSections` 추가 결정 등 노드별 trade-off 는 실제로 공통 규약과는 다른 맥락이 있을 수 있다. stub 수준 Rationale 은 규약 위반은 아니나, 후속 수정자가 결정 근거를 spec 에서 바로 확인하기 어렵다.
- **제안**: 노드 단독 결정이 없다면 현재 표현으로 충분하나, 최소한 "왜 `text_classifier` 에 multi-turn 이 없는가" 같은 핵심 아키텍처 결정에 대한 한 문단 정도를 추가하면 3섹션 권장 취지에 더 부합한다. 즉각 차단 수준은 아님.

---

### [INFO] `3-information-extractor.md` §8 Rationale — stub

- **target 위치**: `spec/4-nodes/3-ai/3-information-extractor.md` §8 Rationale
- **위반 규약**: CLAUDE.md Rationale 3섹션 권장
- **상세**: `2-text-classifier.md` 와 동일하게 Rationale 이 공통 규약 cross-ref 만 담고 있다. `information_extractor` 는 `finalize_extraction` tool 설계, `output.partial` 슬롯 분리 등 노드 단독 결정이 있음에도 Rationale 가 비어있다.
- **제안**: `finalize_extraction` tool 설계 선택 이유, `output.partial` 과 `output.result` 슬롯 분리 결정 근거를 Rationale 에 추가 권고. 즉각 차단 수준은 아님.

---

## 요약

`spec/4-nodes/3-ai/` 전체는 Principle 0~11 의 5필드 출력 컨트랙트, `output.result.*` wrapper, config echo (Principle 7), 동적 포트 네이밍 (Principle 6), 에러 포트 컨트랙트 (Principle 3) 등 핵심 구조 규약을 전반적으로 잘 따르고 있다. 그러나 두 가지 CRITICAL 항목이 구현 착수 전 반드시 해소되어야 한다. `text_classifier` 와 `information_extractor` 의 error 출력에 `details.retryable: boolean` 이 누락되어 있어 Principle 3.2.1 의 "LLM 계열 노드 한정 필수" 조건을 위반하며, 구현 담당자가 해당 invariant 를 누락할 위험이 있다. `text-classifier` §5.x JSON 예시 전반에 `status: "ended"` 도 빠져 있어 Principle 0/11 의 5필드 계약이 문서 수준에서 지켜지지 않는다. WARNING 항목 중 `config.schema` vs `outputSchema` 명명 불일치는 handler 구현 시 key 오독을 유발할 수 있어 spec 확정 전 명시적 해소가 권고된다.

## 위험도

**HIGH**
