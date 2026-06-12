### 발견사항

- **[WARNING]** `DB_HOST_BLOCKED` 신설이 `spec/5-system/3-error-handling.md` 에 미반영
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드` / `§6.2 런타임 에러 코드 표`
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.4 노드 수준 런타임 에러 카탈로그 (Database 행: `DB_QUERY_FAILED · DB_CONNECTION_ERROR · DB_CONSTRAINT_VIOLATION · DB_PERMISSION_DENIED` — `DB_HOST_BLOCKED` 미등재)
  - 상세: target 의 `2-database-query.md §4` SSRF 가드와 `§6.2` 에러 코드 표는 `DB_HOST_BLOCKED` 를 정의하고 "차단 시 전용 코드로 surface" 한다고 기술한다. 그러나 `spec/5-system/3-error-handling.md` §1.4 의 "노드 수준 런타임 에러" 카탈로그 Database 행에는 이 코드가 없다. `HTTP_BLOCKED` 는 HTTP 행에, `EMAIL_HOST_BLOCKED` 는 Email 행에 이미 등재됐는데, Database 행만 갱신되지 않아 3-error-handling 문서 내부에서도 SSRF 차단 코드 목록이 비대칭이 된다.
  - 제안: `spec/5-system/3-error-handling.md` §1.4 의 Database 행에 `DB_HOST_BLOCKED` (SSRF 가드 차단 — credentials.host 가 사설/loopback/CGNAT/IPv6 사설 대역, 기본 ON·`ALLOW_PRIVATE_HOST_TARGETS` opt-out) 를 추가한다. §3.2 의 "대표 에러 코드" 표 (Database 행)에도 동일하게 추가해 일관성을 유지한다.

- **[WARNING]** `spec/conventions/chat-channel-adapter.md` 의 `DB_*` wildcard 처리가 `DB_HOST_BLOCKED` 를 암묵적으로 포함하지만 명시적이지 않음
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md §4 SSRF 가드` — 새 에러 코드 `DB_HOST_BLOCKED` 신설
  - 충돌 대상: `spec/conventions/chat-channel-adapter.md` §3.1 execution-failed 분류 알고리즘 표 (`DB_*` wildcard → `executionFailedInternal` 매핑)
  - 상세: `chat-channel-adapter.md §3.1` 의 분류 표는 `DB_*` 와일드카드로 모든 DB 계열 코드를 `executionFailedInternal` 에 매핑하므로 `DB_HOST_BLOCKED` 는 추가 분류 표 갱신 없이도 올바르게 처리된다 (`DB_QUERY_FAILED` / `DB_CONNECTION_ERROR` 등과 동일 처리). 코드(`execution-failure-classifier.ts`)도 `DB_HOST_BLOCKED` 를 `INTERNAL_CODES` 에 이미 명시 추가한 상태다. 그러나 spec 의 `DB_*` wildcard 행은 실제로 어떤 코드가 포함되는지 독자가 추론해야 하는 암묵성이 있어, spec 의 최신성·명확성 측면에서 동기화가 권장된다.
  - 제안: `spec/conventions/chat-channel-adapter.md §3.1` 의 `DB_*` 행 주석 또는 inline 예시에 `DB_HOST_BLOCKED` 를 명시적으로 예거(예: `DB_QUERY_FAILED · DB_CONNECTION_ERROR · DB_HOST_BLOCKED(SSRF) · ...`)해 spec 독자가 가장 최신 코드를 파악할 수 있게 한다. 단 와일드카드 방식이 유지되는 한 기능적 충돌은 없다.

- **[INFO]** `spec/5-system/3-error-handling.md §3.2` 의 "대표 에러 코드" 표 Database 행에 `DB_HOST_BLOCKED` 미등재
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md §6.2` 에러 코드 표 — `DB_HOST_BLOCKED` 정의
  - 충돌 대상: `spec/5-system/3-error-handling.md §3.2` CONVENTIONS Principle 3.2 에러 envelope 섹션의 "대표 에러 코드" 표 (Database: `DB_QUERY_FAILED, DB_CONNECTION_ERROR, DB_CONSTRAINT_VIOLATION, DB_PERMISSION_DENIED`)
  - 상세: §1.4 와 별도로 §3.2 에도 노드 카테고리별 대표 에러 코드 목록이 있다. Database 행이 `DB_HOST_BLOCKED` 를 포함하지 않아 동일 파일 내 두 섹션 간 비일관이 발생한다.
  - 제안: WARNING(1번 항목)의 §1.4 갱신과 함께 §3.2 대표 에러 코드 표 Database 행도 동기화한다.

- **[INFO]** `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 체크박스가 미완료 상태로 남아 있음
  - target 위치: `spec/4-nodes/4-integration/2-database-query.md` — `DB_HOST_BLOCKED` 신설 완료
  - 충돌 대상: `plan/in-progress/http-ssrf-all-auth-followups.md` 17번째 줄 `"(기획 결정) DB_HOST_BLOCKED 신설"` 체크박스 (`[ ]` 미완료)
  - 상세: target spec 과 codebase 에 `DB_HOST_BLOCKED` 가 이미 정의·구현됐으므로 해당 plan 항목은 완료 처리가 필요하다. plan 체크박스가 미완 상태로 남으면 향후 재작업 혼란이 생긴다.
  - 제안: `plan/in-progress/http-ssrf-all-auth-followups.md` 의 `DB_HOST_BLOCKED` 항목을 `[x]` 로 체크한다.

---

### 요약

target(`spec/4-nodes/4-integration/`)이 도입한 `DB_HOST_BLOCKED` 에러 코드는 데이터 모델·API 계약·RBAC·상태 전이 관점에서 기존 spec 과 직접 모순되지 않는다. 핵심 위험은 동기화 갭 — `spec/5-system/3-error-handling.md` 의 노드 런타임 에러 카탈로그(§1.4 및 §3.2 두 곳)가 갱신되지 않아 `HTTP_BLOCKED` / `EMAIL_HOST_BLOCKED` 는 등재됐는데 `DB_HOST_BLOCKED` 만 빠진 비대칭이 발생한다. `spec/conventions/chat-channel-adapter.md` 는 `DB_*` wildcard 덕분에 기능적 충돌은 없으나 명시적 언급이 없어 spec 독자에게 암묵적이다. 두 WARNING 을 해소하려면 `3-error-handling.md §1.4·§3.2` Database 행에 `DB_HOST_BLOCKED` 를 추가하는 것이 전부이며, 작업 범위가 작아 즉시 반영할 수 있다. 별도 spec 영역이 작동 불가해지는 CRITICAL 충돌은 없다.

### 위험도

MEDIUM
