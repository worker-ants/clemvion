# 신규 식별자 충돌 검토 — Cafe24 request envelope spec 반영

검토 대상: `plan/in-progress/spec-draft-cafe24-request-envelope.md`
검토 일시: 2026-05-16

---

## 발견사항

### [WARNING] `cafe24-api-metadata.md` 의 §4 절 번호 충돌 — 기존 §4 가 다른 내용으로 사용 중
- **target 신규 식별자**: `## 4. Wire-format 규약 — POST/PUT request envelope` (신규 삽입 절)
- **기존 사용처**: `spec/conventions/cafe24-api-metadata.md` 라인 123 — `## 4. 신규 endpoint 추가 절차`
- **상세**: target draft 는 기존 §3(예시)과 §4(신규 endpoint 추가 절차) 사이에 새 §4 를 삽입하고 기존 §4–§7 을 §5–§8 로 일괄 +1 이동할 것을 명시하고 있다. 이 자체는 draft 가 인지하고 있는 충돌이며 처리 방안(번호 이동)까지 기술되어 있다. 그러나 `spec/conventions/cafe24-api-catalog/_overview.md` §4 의 동기 정책 절과 §6 절, 그리고 `spec/conventions/cafe24-api-catalog/_overview.md` 라인 3177(`spec/conventions/cafe24-api-metadata.md §4 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함`)에서 **§4 번호를 직접 인용**하고 있다. 절 번호 이동 후 이 외부 인용이 갱신되지 않으면 §4 앵커가 엉뚱한 절(Wire-format 규약)을 가리키게 된다.
- **제안**: spec 본문 반영 시 `spec/conventions/cafe24-api-catalog/_overview.md` 라인 3138, 3177 의 `§4` 인용을 `§5`(신규 번호) 로 함께 갱신해야 한다. draft 의 "영향 받지 않는 문서" 목록에 `spec/conventions/cafe24-api-catalog/_overview.md` 는 포함되어 있지 않으므로 누락 위험이 있다.

---

### [WARNING] `envelope` 단어 — 동일 파일 내 두 개념 공존 (노드 출력 envelope vs Cafe24 wire-format envelope)
- **target 신규 식별자**: "Cafe24 request envelope", "POST/PUT request envelope" (Wire-format 규약 절 전반)
- **기존 사용처**:
  - `spec/4-nodes/4-integration/0-common.md` 라인 33: `CONVENTIONS Principle 7 / §3 의 nested envelope`
  - `spec/4-nodes/4-integration/1-http-request.md` 라인 181: `CONVENTIONS Principle 3.2 의 표준 envelope output.error.{code, message, details?}`
  - `spec/4-nodes/4-integration/4-cafe24.md` 라인 174: `CONVENTIONS Principle 3.2 의 표준 envelope output.error.{code, message, details?}`
  - `spec/conventions/node-output.md`: Principle 0, Principle 7 등 — `NodeHandlerOutput` 5필드 구조를 envelope 로 지칭
- **상세**: draft 자체가 이 충돌을 인지하고 "용어 정리 — 기존 envelope 과 충돌 회피" 절에서 한정 표기 규약("Cafe24 request envelope" / "POST/PUT request envelope") 을 명문화하고 있다. 또한 각 신규 절 끝에 `> 용어 주의` 블록을 배치하여 두 개념을 구분하고 있다. 단, 4-cafe24.md 의 신규 §4.2 본문 중간에 한정 수식어 없이 단독 "envelope" 이 두 차례 등장한다 — `"DELETE / GET 에는 envelope 을 적용하지 않는다"` 및 `"§5 의 노드 출력 envelope"` (후자는 의도적 대비 표현이므로 괜찮으나 전자는 "Cafe24 request envelope" 으로 명시하는 것이 규약 일치). 완전한 일관성을 위해 단독 "envelope" 이 Cafe24 문맥에서 사용될 때도 "Cafe24 request envelope" 으로 표기하면 혼동 가능성이 0 이 된다.
- **제안**: `spec/4-nodes/4-integration/4-cafe24.md` 신규 §4.2 의 `"DELETE / GET 에는 envelope 을 적용하지 않는다"` 를 `"DELETE / GET 에는 Cafe24 request envelope 을 적용하지 않는다"` 로 수정한다.

---

### [INFO] `wrapInCafe24Envelope` 함수명 — spec 에 처음 등장하는 코드 식별자
- **target 신규 식별자**: `Cafe24ApiClient.wrapInCafe24Envelope` (신규 §4 본문에서 인용)
- **기존 사용처**: spec 내에는 해당 함수명이 이전에 등장하지 않음. 기존 `spec/4-nodes/4-integration/4-cafe24.md` 에서 wrapper(`Cafe24ApiClient`)는 §4.1 에서 언급되지만 `wrapInCafe24Envelope` 메서드명은 등장하지 않는다.
- **상세**: 함수명 자체는 충돌하지 않으며, 충분히 한정적인 이름이다. 그러나 코드 경로 `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 가 spec 에 처음 박제되므로, 이후 리팩토링 시 spec-code 불일치가 발생할 수 있다. 충돌이 아니라 유지보수 주의 사항이다.
- **제안**: 메서드명보다 동작("`Cafe24ApiClient` 가 POST/PUT 본문을 자동으로 wrap")을 기술하는 것이 spec 의 독립성을 높인다. 이미 draft 에서 함수명은 §4 제목부 설명에만 한 번 사용하고 나머지는 "wrapper" 로 추상화하고 있어 현재 방식도 수용 가능하다.

---

### [INFO] `§4.2` 절 식별자 — 4-cafe24.md 에 새로 도입
- **target 신규 식별자**: `### 4.2 Request body envelope (POST/PUT 전용)` (4-cafe24.md 에 신설)
- **기존 사용처**: 4-cafe24.md 에는 `### 4.1 Rate Limit 처리 상세` 만 존재하고 `4.2` 절은 없음. 충돌 없음.
- **상세**: 순수 신규 식별자이며 기존 사용처 없음. `spec/4-nodes/4-integration/0-common.md` 라인 85 에서 참조되는 `(공통 §4.2)` 는 `0-common.md` 자체의 `§4.2` 를 가리키므로 별개 파일의 §4.2 와 namespace 가 다르다. 실질 충돌 없음.
- **제안**: 별도 조치 불필요.

---

### [INFO] `§9.10` Rationale 절 — 4-cafe24.md 에 새로 도입
- **target 신규 식별자**: `### 9.10 Request envelope wrapping 의 위치 — wrapper 단일 책임`
- **기존 사용처**: `spec/4-nodes/4-integration/4-cafe24.md` 의 §9 Rationale 절은 §9.1~§9.9 까지 존재하고 `§9.10` 은 없음. 충돌 없음.
- **상세**: 순수 신규 식별자. 연번상 다음 번호이므로 충돌 없음.
- **제안**: 별도 조치 불필요.

---

### [INFO] `spec/conventions/cafe24-api-metadata.md` 의 §5~§8 (기존 §4~§7) 앵커 변경
- **target 신규 식별자**: 기존 §4 "신규 endpoint 추가 절차" → §5, 기존 §5 "MCP Bridge 와의 매핑" → §6, 기존 §6 "allowlist 와의 관계" → §7, 기존 §7 "CHANGELOG" → §8 으로 번호 이동
- **기존 사용처**:
  - `spec/conventions/cafe24-api-catalog/_overview.md` 라인 3138: `cafe24-api-metadata.md §4 의 신규 endpoint 추가 절차에 인용` (텍스트 참조)
  - `spec/conventions/cafe24-api-catalog/_overview.md` 라인 3177: `spec/conventions/cafe24-api-metadata.md §4 의 신규 endpoint 추가 절차도 본 카탈로그 row 갱신을 step 으로 포함한다` (텍스트 참조)
  - `spec/conventions/cafe24-api-metadata.md` §4 (현재) 라인 136: `spec 본문 수정 불요 — 4-cafe24.md 는 형식만 정의` (자기 참조, 이동 후에도 내용이 §5 로 이동하므로 텍스트 인용 갱신 필요)
- **상세**: 번호 이동이 발생하므로 위 3곳의 `§4` 텍스트 참조가 §5 로 갱신되어야 한다. draft 의 "영향 받지 않는 문서" 목록에 카탈로그 문서가 포함되지 않아 누락 우려가 있음 (위 WARNING 항목과 동일 근원).
- **제안**: spec 본문 반영 체크리스트에 `cafe24-api-catalog/_overview.md` 의 §4 인용 2건 갱신을 명시적으로 추가한다.

---

## 요약

target draft 가 도입하는 신규 식별자(`## 4. Wire-format 규약`, `### 4.2 Request body envelope`, `### 9.10 Request envelope wrapping`) 중 **기존 사용처와 의미가 충돌하는 동일 식별자는 없다**. draft 자체가 "envelope" 용어 중의성을 인지하고 한정 표기 규약을 명문화했으며, 각 절 말미에 `> 용어 주의` 블록도 배치되어 있다. 다만 cafe24-api-metadata.md 의 §4 절 번호가 이동함에 따라 외부 파일(`cafe24-api-catalog/_overview.md`) 2곳에서 `§4` 를 텍스트로 참조하는 부분이 `§5` 로 갱신되지 않으면 독자 혼선이 발생한다. 이 2건의 앵커 갱신 누락이 본 검토에서 발견된 주요 위험이며, 구현 전 해소가 필요하다. 나머지 발견사항(단독 "envelope" 표기 1건, 코드 식별자 유지보수 주의)은 INFO 수준의 보완 제안이다.

## 위험도

LOW
