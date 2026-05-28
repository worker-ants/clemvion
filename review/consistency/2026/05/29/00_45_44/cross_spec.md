# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-ai-error-output-fields.md`  
검토 일시: 2026-05-29  
검토 관점: 데이터 모델 충돌 / API 계약 충돌 / 요구사항 ID 충돌 / 상태 전이 충돌 / 권한·RBAC 충돌 / 계층 책임 충돌

---

## 발견사항

### [INFO] text-classifier §5.3 에러 JSON 예시에 `"status": "ended"` 가 없음 — C-2 가 §5.3 도 포함하는지 명시 필요

- target 위치: `spec-draft-ai-error-output-fields.md §C-2`
- 충돌 대상: `spec/4-nodes/3-ai/2-text-classifier.md §5.3` (에러 case JSON 예시), `spec/conventions/node-output.md` Principle 0 (5-필드 invariant)
- 상세: target C-2 는 "§5.1 본 예시 + fallback 변형, §5.2 본 예시 + fallback 변형, §5.3 — 각 JSON 예시 top-level 에 `status: ended` 추가" 라고 명기한다. 현행 `text-classifier.md §5.3` 에러 JSON 에도 `"status"` 키가 없으므로 C-2 의 scope 가 에러 케이스까지 포함함을 draft 본문이 암시하지만 문장이 모호하다. `information-extractor.md §5.3` 에러 JSON 예시(`spec/4-nodes/3-ai/3-information-extractor.md §5.3`)에는 `"status": "ended"` 가 이미 있으므로 형제 노드와의 일관성 관점에서 text-classifier §5.3 에도 추가해야 한다. C-2 본문이 §5.3 포함을 명시하면 충돌 없음; 미명시이면 Principle 0 위반이 잔존한다.
- 제안: target C-2 설명에 §5.3 (에러 case) 도 `status: ended` 추가 대상임을 명시적으로 선언한다.

---

### [INFO] text-classifier §5.3 필드 표에 `status` 행 추가 대상 미포함 여부 — C-2 와 §5.1/§5.2 간 불일치 가능

- target 위치: `spec-draft-ai-error-output-fields.md §C-2`
- 충돌 대상: `spec/4-nodes/3-ai/2-text-classifier.md §5.1 / §5.2 / §5.3` 필드 표
- 상세: C-2 는 "§5.1 / §5.2 / §5.3 필드 표에 `status` 행 추가" 를 규정한다. 현행 text-classifier §5.3 필드 표에는 `status` 행 (`status | 'ended' | handler return | 종결 상태`) 이 없다. information-extractor §5.1 / §5.3 필드 표에는 이미 `status | 'ended'` 행이 존재한다. C-2 가 §5.3 필드 표도 포함하는 것인지 모호하지 않도록, 또는 에러 case 에서는 `status` 가 `'ended'` 로 고정이므로 생략 가능한지(하지만 다른 케이스와 일관성이 없어짐) 결정을 명시해야 한다.
- 제안: C-2 에서 "필드 표 추가 대상 케이스" 를 §5.1 / §5.2 에 한정할지 §5.3 포함할지 명시한다. information-extractor 의 §5.3 필드 표가 `status` 행을 보유하고 있으므로, 형제 노드 일관성 원칙상 §5.3 도 포함하는 것이 권장된다.

---

### [INFO] C-1 text-classifier 필드 표의 `retryAfterSec?` 설명 문구 — `retryable === true` invariant 출처 명세가 충분하지만 information-extractor 와 문구 차이 존재

- target 위치: `spec-draft-ai-error-output-fields.md §C-1 text-classifier §5.3`
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §C-1 (information-extractor §5.3)`, `spec/conventions/node-output.md §3.2.1`
- 상세: target 은 두 노드에 동일 문구로 `retryAfterSec?` 행을 추가한다고 명시("text-classifier 와 동일 문구"). 실제로 draft 에서 text-classifier 표기는 "invariant: `retryable === true` 일 때만 set (Principle 3.2.1)", information-extractor 표기는 "invariant: `retryable === true` 일 때만 set (Principle 3.2.1)". 두 문구가 동일하므로 충돌 없음. ai-agent §7.9 필드 표의 `retryAfterSec` 설명과도 동일 invariant 를 참조하여 일관성이 유지된다. 이 항목은 정상이나 향후 문구 갱신 시 세 노드를 함께 동기화해야 함을 기록한다.
- 제안: 표 문구 변경 시 ai-agent §7.9 / text-classifier §5.3 / information-extractor §5.3 세 곳을 함께 갱신한다.

---

### [INFO] W-1 (deferred) `config.schema` → `config.outputSchema` rename — information-extractor 기존 spec 에서 `config.schema` 가 이미 사용 중

- target 위치: `spec-draft-ai-error-output-fields.md §W-1 (deferred)`
- 충돌 대상: `spec/4-nodes/3-ai/3-information-extractor.md §5.1` (`config.schema` echo 포함), `spec/conventions/node-output.md` Principle 7 (config echo 는 원본 필드명 그대로)
- 상세: target 이 W-1 을 이번 PR scope 에서 제외하고 후속 backlog 로 남긴다고 명시한다. 현행 information-extractor spec 의 §5.1 JSON 예시 및 필드 표에서 `config.schema` 가 원본 config 필드명 `outputSchema` 대신 사용되고 있어 Principle 7 위반이다. target draft 는 이 문제를 인식하고 의도적으로 defer 한다. 따라서 본 draft 가 채택되어도 W-1 위반 상태가 그대로 잔존한다 — 충돌이 생기는 것이 아니라 기존 위반이 해소되지 않은 채 지속된다. 추후 별도 backlog 에서 `config.schema` → `config.outputSchema` rename 을 반드시 처리해야 한다.
- 제안: W-1 후속 backlog 생성 시 `spec/4-nodes/3-ai/3-information-extractor.md §5.1` 및 doc 전반 ~15곳 + expression 접근 예 모두 포함하도록 scope 를 명시한다.

---

## 요약

target draft 는 `spec/conventions/node-output.md §3.2.1` (retryable 필수 필드) 과 Principle 0 (5-필드 invariant `status`) 을 기존 text-classifier / information-extractor 에 보강하는 순수 문서 정합성 작업이다. 두 노드 모두 `status: spec-only, code: []` 이므로 구현 영향이 없으며, 보강 내용 자체가 ai-agent §7.9 / §10 및 node-output.md §3.2.1 의 기존 규약과 충돌하지 않는다. 발견된 사항은 모두 INFO 등급으로, C-2 scope 에서 §5.3 에러 case 의 명시적 포함 여부가 모호한 부분과 W-1 의 기존 위반이 이번 PR 에서 해소되지 않는다는 점만 확인되었다. CRITICAL·WARNING 등급 충돌은 없다.

---

## 위험도

LOW
