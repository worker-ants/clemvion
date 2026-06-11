# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
대상 범위: `spec/conventions/` (Rationale SoT) vs 변경된 구현 (`codebase/backend/`)
diff base: `origin/main`

---

## 발견사항

### 발견사항 없음 — 주요 항목 검토 결과 적합

아래는 Rationale 연속성 관점에서 검토한 4개 축의 결과다.

---

### [INFO] `HTTP_BLOCKED` INTERNAL 분류 — 스펙 명시와 일치

- **target 위치**: `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` — `INTERNAL_CODES` set 에 `HTTP_BLOCKED` 추가
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §3.1` 카테고리 매핑 표 line 388
  > `HTTP_BLOCKED`(SSRF 차단) ... → `executionFailedInternal`
- **상세**: 스펙 분류표가 `HTTP_BLOCKED` 를 명시적으로 INTERNAL 군에 포함한다. 이번 구현 변경은 이 스펙 항목을 코드에 등재한 것으로, Rationale 을 위배하지 않는다.
- **제안**: 없음. 정합.

---

### [INFO] `CODE_MEMORY_LIMIT` INTERNAL 분류 — 스펙 명시와 일치

- **target 위치**: `execution-failure-classifier.ts` — `INTERNAL_CODES` set 에 `CODE_MEMORY_LIMIT` 추가
- **과거 결정 출처**: `spec/conventions/chat-channel-adapter.md §3.1` 카테고리 매핑 표 line 388
  > `CODE_MEMORY_LIMIT` ... → `executionFailedInternal`
- **상세**: 스펙 분류표가 `CODE_MEMORY_LIMIT` 를 명시적으로 INTERNAL 군에 포함한다. 정합.
- **제안**: 없음.

---

### [INFO] `EMAIL_HOST_BLOCKED` 분류표 미등재 — Rationale 명시와 일치

- **target 위치**: `execution-failure-classifier.ts` — `EMAIL_HOST_BLOCKED` 가 어느 set 에도 포함되지 않음
- **과거 결정 출처**: `spec/2-navigation/4-integration.md ## Rationale` — "SMTP SSRF 가드를 http/db 와 동일 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일" 항 (line 1124)
  > **chat-channel 분류표 영향 없음**: `EMAIL_HOST_BLOCKED` 는 노드 레벨 `output.error.code`(또는 연결테스트 result.code)로만 surface 된다. send_email 실패가 워크플로 종료로 격상되면 execution 레벨 `error.code` 는 `ERROR_PORT_FALLBACK`(이미 INTERNAL 군에 존재)이 되므로, 분류표 행 추가는 불필요하다.
- **상세**: Rationale 이 분류표 미등재를 명시적으로 정당화한다. `EMAIL_HOST_BLOCKED` 가 classifier 에서 누락된 것은 의도된 설계이며 Rationale 을 준수한다.
- **제안**: 없음.

---

### [INFO] `LEGACY_TO_NORMALIZED` 폴백 변경 (`?? errorCode` → `?? ErrorCode.CODE_EXECUTION_FAILED`) — Rationale 위반 없음

- **target 위치**: `codebase/backend/src/nodes/data/code/code.handler.ts` — LEGACY_TO_NORMALIZED 미등재 코드에 대한 fallback 을 pass-through 에서 `CODE_EXECUTION_FAILED` 로 교체
- **과거 결정 출처**: `spec/4-nodes/5-data/2-code.md §5.5` — 정규화 표; `spec/conventions/error-codes.md ## Rationale` — "왜 의미 기반인가"
- **상세**: Code 노드 스펙의 정규화 표는 3가지 내부 코드 → 3가지 공개 코드 매핑만 정의한다. 표에 없는 미등재 내부 코드가 raw 상태로 `output.error.code` 에 누출되면 스펙 계약 (`CODE_TIMEOUT / CODE_EXECUTION_FAILED / CODE_MEMORY_LIMIT` 3종) 에 위반된다. 폴백을 `CODE_EXECUTION_FAILED` 로 고정한 것은 "의미 기반 에러 코드가 클라이언트와의 장기 계약" 이라는 Rationale 원칙을 오히려 강화한다.
- **제안**: 없음. Rationale 을 준수하고 강화하는 변경.

---

### [INFO] `classifyError` → `classifyCodeNodeError` 함수 이름 변경 — Rationale 위반 없음

- **target 위치**: `code.handler.ts` — exported function rename + 모듈 선언 위치 이동 (클래스 위로 호이스팅)
- **과거 결정 출처**: 함수 이름은 spec 계약 대상이 아님. `code.handler.spec.ts` 에서 직접 import 되는 내부 export 이며 공개 API 아님.
- **상세**: 이름 변경은 grep 충돌 회피 목적 (cafe24/makeshop 의 동명 private 메서드와 구별)으로, spec 수준 계약 변경 아님. Rationale 위반 없음.
- **제안**: 없음.

---

## 요약

이번 변경(codebase/backend/ 한정, spec/conventions/ 미변경)은 spec/conventions/chat-channel-adapter.md §3.1 분류표, spec/2-navigation/4-integration.md Rationale, spec/conventions/error-codes.md Rationale 을 모두 준수한다. 특히 EMAIL_HOST_BLOCKED 의 분류표 미등재는 Rationale 에 명시된 의도적 설계이고, HTTP_BLOCKED / CODE_MEMORY_LIMIT 의 INTERNAL 등재는 스펙이 명문화한 매핑을 코드에 실현한 것이다. LEGACY_TO_NORMALIZED 폴백 강화는 "의미 기반 에러 코드는 장기 계약" 이라는 Rationale 원칙을 오히려 강화한다. 기각된 대안을 재도입하거나 합의된 invariant 를 우회하는 설계는 발견되지 않았다.

## 위험도

NONE
