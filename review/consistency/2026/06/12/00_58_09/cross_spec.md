# Cross-Spec 일관성 검토 결과

검토 대상: `spec/conventions/error-codes.md`, `spec/conventions/node-output.md`, `spec/conventions/chat-channel-adapter.md`, `spec/4-nodes/5-data/2-code.md`, `spec/4-nodes/4-integration/1-http-request.md`, `spec/5-system/3-error-handling.md`

검토 기준: diff base = origin/main

---

## 발견사항

### **[WARNING]** `EXECUTION_TIMEOUT` 이중 의미 — 엔진 수준 vs 내부 legacy 코드

- **target 위치**: `spec/conventions/error-codes.md §3.1` (신규 추가) — `EXECUTION_TIMEOUT` 을 Code 노드 핸들러 내부 legacy 분류 코드로 등재하고 `CODE_TIMEOUT` 으로 정규화됨을 기술
- **충돌 대상**: `spec/5-system/3-error-handling.md §1.4` (미변경) — `EXECUTION_TIMEOUT` 을 **엔진 수준 에러** (execution status → `failed`) 테이블에 등재하고 "Code 노드 스크립트 실행 타임아웃 (`nodes/data/code/code.handler.ts`)" 으로 기술
- **상세**: `3-error-handling.md §1.4` 의 엔진 수준 테이블은 `EXECUTION_TIMEOUT` 을 공용 발행 코드처럼 보이게 남겨 둔다. 반면 신규 `error-codes.md §3.1` 은 이를 "클라이언트에 미노출되는 내부 legacy 분류 코드" 로 선언하고 `CODE_TIMEOUT` 으로 정규화됨을 명시한다. 두 문서가 같은 코드에 대해 레이어를 달리 기술하므로 독자가 `EXECUTION_TIMEOUT` 이 발행 코드인지 내부 코드인지 혼동할 수 있다.
- **제안**: `spec/5-system/3-error-handling.md §1.4` 의 `EXECUTION_TIMEOUT` 행에 "(내부 legacy 분류 코드 — `CODE_TIMEOUT` 으로 정규화 후 발행, SoT: `error-codes.md §3.1`)" 주석 추가, 또는 §1.4 엔진 수준 테이블에서 제거하고 각주로 처리.

---

### **[INFO]** `2-code.md §5.3` 인라인 표와 `error-codes.md §3.1` SoT 관계 미명시

- **target 위치**: `spec/conventions/error-codes.md §3.1` (신규) — `EXECUTION_TIMEOUT → CODE_TIMEOUT`, `EXECUTION_MEMORY_EXCEEDED → CODE_MEMORY_LIMIT`, `CODE_RUNTIME_ERROR → CODE_EXECUTION_FAILED` 매핑 표를 SoT 로 선언
- **충돌 대상**: `spec/4-nodes/5-data/2-code.md §5.3` (미변경) — 동일 매핑을 inline 요약 블록(`> | EXECUTION_TIMEOUT | CODE_TIMEOUT | ...`)으로 중복 보유
- **상세**: 동일 내용이 두 위치에 존재하지만 SoT 관계가 `2-code.md` 에서 명시되지 않아 이후 한쪽만 갱신될 경우 drift 위험이 있다. 기능적 충돌은 없으나 단일 진실 원칙 위반 가능성.
- **제안**: `spec/4-nodes/5-data/2-code.md §5.3` 인라인 표에 "(SoT: `spec/conventions/error-codes.md §3.1`)" 참조 추가, 또는 인라인 표를 `error-codes.md §3.1` 참조로 교체.

---

### **[INFO]** `node-output.md §D4` 앵커 갱신 — cross-spec 링크 정합 확인 필요

- **target 위치**: `spec/conventions/node-output.md` — `[1-http-request.md §5.8]` 링크 앵커가 `#58-d4-handlervalidate-실패만-throw-나머지-모두-53-으로-라우팅` 로 갱신
- **충돌 대상**: `spec/4-nodes/4-integration/1-http-request.md §5.8` 의 실제 heading slug
- **상세**: `spec-link-integrity.test.ts` build 가드가 런타임에 slug 를 검증하므로 테스트 통과 시 문제 없음. 별도 수동 조치 불필요.
- **제안**: build 가드 통과 확인으로 충분.

---

## 요약

이번 변경의 핵심은 Code 노드 내부 legacy 에러 분류 코드를 `error-codes.md §3.1` 에 공식 등재하고, `HTTP_TIMEOUT` 이 실제 미발행임을 `3-error-handling.md`, `chat-channel-adapter.md`, `1-http-request.md` 전반에 동기화한 것이다. 대부분의 변경은 cross-spec 일관성을 개선하는 방향이다. 주요 위험은 `error-codes.md §3.1` 이 `EXECUTION_TIMEOUT` 을 "내부 미노출 코드" 로 명시한 반면 `3-error-handling.md §1.4` 엔진 수준 테이블이 이를 공용 발행 코드처럼 보이게 그대로 남겨두어 독자 혼란을 유발할 수 있다는 점(WARNING 1건)과, `2-code.md` 인라인 표와의 중복 SoT 미명시(INFO 1건)다. 두 항목 모두 코드베이스 작동에는 영향이 없으나 문서 내 명확성을 위해 보완이 권장된다.

---

## 위험도

LOW
