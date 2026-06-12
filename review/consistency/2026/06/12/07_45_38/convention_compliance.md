# Convention Compliance Review

**검토 대상**: `spec/4-nodes/4-integration/` (전체 6파일)
**검토 모드**: `--impl-done`, scope=`spec/4-nodes/4-integration/`, diff-base=origin/main
**검토 일시**: 2026-06-12

---

## 발견사항

### **[WARNING]** `send_email` 성공 포트 명 `'out'` — Principle 5 `port: undefined` 와 불일치

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §3.2 출력 포트 표, §5.1 JSON 예시, §5.5
- **위반 규약**: `spec/conventions/node-output.md` Principle 5 — "`port: undefined` | 기본 단일 출력 (노드 정의상 outputs가 1개) | `transform`, `send_email`, `manual_trigger`"
- **상세**: Principle 5 표는 `send_email` 의 성공 포트가 `port: undefined`(단일 출력, 명시 생략)라고 정의한다. 그러나 `3-send-email.md` 의 §3.2 포트 정의 표에는 `out` 포트 id 가 명시되어 있고, §5.1 JSON 예시에 `"port": "out"` 이 직접 포함되며, §5.5 dry-run 케이스 설명 역시 `port: 'out'` 을 명시한다. `send_email` 에 `error` 포트가 추가된 시점에 `out` 이 성공 포트 id 로 고정된 것으로 추정되나, conventions 의 Principle 5 표는 아직 갱신되지 않아 `send_email` 을 여전히 "단일 출력(port: undefined)" 노드로 기술한다.
- **제안**: (a) `3-send-email.md` 에서 `'out'` 을 유지하는 경우 — `spec/conventions/node-output.md` Principle 5 표에서 `send_email` 을 `port: undefined` 열에서 제거하고 "`port: 'out'` / `port: 'error'` 이중 포트" 형태로 갱신한다. (b) 단일 출력 모델을 유지하는 경우 — `send-email.md` 의 포트 id 를 `success` 로 변경하여 `http_request`, `database_query` 와 통일하고 Principle 5 표를 그에 맞게 조정한다. 규약 갱신이 적절.

---

### **[WARNING]** `EMAIL_HOST_BLOCKED` 가 `chat-channel-adapter` 코드 매핑 표에 없음

- **target 위치**: `spec/4-nodes/4-integration/3-send-email.md` §5.3 에러 코드 표, §6, §8.0 Rationale
- **위반 규약**: `spec/conventions/chat-channel-adapter.md` §3.1 카테고리 매핑 표 (에러 코드 → chat-channel `key` 분류) 의 정합성 요건
- **상세**: `send-email.md` §8.0 Rationale 은 DB_HOST_BLOCKED 가 chat-channel-adapter §3.1 의 `DB_*` 매핑에 포함돼 `executionFailedInternal` 로 분류된다고 자체 주석을 달았다. 그러나 `send_email` 의 `EMAIL_HOST_BLOCKED` 에 대해서는 동일한 분류 확인이 없다. `chat-channel-adapter.md` §3.1 표를 확인하면 `EMAIL_SEND_FAILED` 는 `executionFailedThirdParty` 로 명시 등재되어 있으나 `EMAIL_HOST_BLOCKED` 는 등재되어 있지 않다. `DB_*` wildcard 패턴처럼 `EMAIL_*` 를 포괄하는 행도 없고, fallback 행(그 외 모든 code)이 있지만 `executionFailedInternal` 로 흡수되는 것이 의도인지 명시되지 않았다.
- **제안**: `spec/conventions/chat-channel-adapter.md` §3.1 표에 `EMAIL_HOST_BLOCKED` 행을 `executionFailedInternal`(SSRF 차단은 우리 측 정책이므로 internal — `DB_HOST_BLOCKED` 와 동일 근거) 로 명시 추가한다. `HTTP_BLOCKED` 도 같은 열에 별도 행으로 이미 등재되어 있어 패턴 일관성이 확보된다.

---

### **[INFO]** `0-common.md` 에 `## Rationale` 섹션 없음

- **target 위치**: `spec/4-nodes/4-integration/0-common.md` 전체 구조
- **위반 규약**: `CLAUDE.md` "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" / 각 SKILL.md 의 "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)"
- **상세**: `0-common.md` 는 6개 섹션(`1. Integration 참조` ~ `7. 출력 구조 색인`)으로 끝나며 `## Rationale` 절이 없다. 본 문서에서 내린 주요 설계 결정(`meta.durationMs` 통일, D4 에러 라우팅 정책, 5필드 invariant 카테고리 해석 등)의 배경과 근거는 하위 노드 문서(1-http-request.md §8, 2-database-query.md ##Rationale, 3-send-email.md §8 등)에 분산되어 있고, `0-common.md` 에 귀속되어야 할 공통 결정 근거가 명시된 곳이 없다.
- **제안**: `0-common.md` 에 `## Rationale` 절을 추가하고, 공통 적용 결정(D4 에러 라우팅 정책·`meta.durationMs` 통일·5필드 invariant 카테고리 패턴 채택 이유 등)의 근거를 정리한다. 내용은 이미 하위 문서에 분산된 설명에서 발췌 가능.

---

### **[INFO]** `2-database-query.md` 의 `## Rationale` 헤딩 번호 누락

- **target 위치**: `spec/4-nodes/4-integration/2-database-query.md` 최하단 `## Rationale`
- **위반 규약**: 동 폴더 내 다른 문서와의 구조 일관성 (1-http-request §8 Rationale, 3-send-email §8 Rationale 등과의 번호 체계)
- **상세**: `1-http-request.md` 는 `## 8. Rationale`, `3-send-email.md` 는 `## 8. Rationale`, `4-cafe24.md` 는 `## 9. Rationale`, `5-makeshop.md` 는 `## 9. Rationale` 형식으로 번호를 붙여 주요 절과 동등 계층임을 명시한다. 반면 `2-database-query.md` 는 `## Rationale`(번호 없음)로 되어 있어 내부 스타일이 불일치한다.
- **제안**: `2-database-query.md` 의 `## Rationale` 를 `## 8. Rationale` 로 변경하여 동 폴더 문서 스타일과 통일한다.

---

## 요약

`spec/4-nodes/4-integration/` 의 6개 문서는 전반적으로 `spec/conventions/node-output.md` 의 5필드 invariant·Principle 3 에러 컨트랙트·Principle 7 config echo 규약·Principle 11 출력 예시 포맷을 정확히 준수하고 있다. `spec/conventions/error-codes.md` 의 `UPPER_SNAKE_CASE` 명명·의미 기반 코드 신설 원칙도 신규 `DB_HOST_BLOCKED` 코드에서 올바르게 적용됐다. `spec/conventions/spec-impl-evidence.md` frontmatter(`id`/`status`/`code`/`pending_plans`) 도 모든 파일에서 적합하다. 주요 규약 차이는 두 가지다: (1) `send_email` 성공 포트 id `'out'` 이 `node-output.md` Principle 5 의 `port: undefined` 정의와 충돌하고, (2) 신규 `EMAIL_HOST_BLOCKED` 코드가 `chat-channel-adapter.md` 매핑 표에 등재되지 않아 chat-channel 경로에서의 분류가 규약 수준에서 불명확하다. 두 항목 모두 target 문서보다 conventions 자체의 갱신이 더 적절하며, target 문서가 현실을 더 정확히 반영하고 있다.

---

## 위험도

**MEDIUM**

`EMAIL_HOST_BLOCKED` 의 chat-channel 분류 누락(WARNING)은 채팅 채널에서 이 에러가 발생할 때 분류가 스펙 문서 수준에서 불명확하여 chat-channel 어댑터 구현 또는 테스트 작성 시 의도와 다른 분기가 발생할 수 있다. `send_email` 포트 명 불일치(WARNING)는 해당 노드를 사용하는 워크플로 작성자나 expression autocomplete 구현에 혼선을 줄 수 있다. 나머지 두 항목(INFO)은 문서 형식 일관성 문제로 기능적 영향 없음.
