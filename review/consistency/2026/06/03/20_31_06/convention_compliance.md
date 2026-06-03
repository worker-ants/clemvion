# Convention Compliance Review — spec/4-nodes/4-integration/5-makeshop.md

## 발견사항

### 1. [INFO] 섹션 번호 5.2 누락 — 출력 구조 Case 점프

- **target 위치**: §5 출력 구조. `5.1 Case: 2xx 성공` 다음 바로 `5.3 Case: API 에러` 로 점프.
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 출력 예시 문서화 규칙 — "Case별로 분리(성공 / 에러 / 재개 등)"를 명시. 명시적인 번호 부여를 강제하지는 않으나, Cafe24 §5 참조 패턴이 `5.1 / 5.2 / 5.3` 구조임.
- **상세**: 5.2 가 없어서 참조 추적 시 혼란. 의도적 생략이라면 번호를 5.1 / 5.2 로 재배치하거나 "5.2 없음" 을 주석으로 남겨야 한다. Cafe24 노드 §5 와 섹션 번호가 불일치하면 "§5.3 라우팅" 같은 타 섹션의 상호 참조가 어긋날 수 있다.
- **제안**: 5.3 → 5.2 로 번호 변경하거나, §4 step 1/12 의 "§5.3 라우팅" 인라인 참조를 일관성 있게 정리.

---

### 2. [WARNING] `output.error` 예시 JSON 부재 — Principle 11 미충족

- **target 위치**: §5.3 Case: API 에러 또는 Transport 실패.
- **위반 규약**: `spec/conventions/node-output.md` Principle 11 — "각 노드 문서의 Output 섹션은 `Case: <이름>` 아래 JSON 예시 + 필드 표 형식으로 작성". §5.1 은 JSON 블록 + 표가 있으나 §5.3 은 산문 설명만 존재.
- **상세**: `output.error.{code, message, details?}` 의 실제 JSON 예시 없이 "Cafe24 §5.3 구조 동일하되 `code` 는 §6 의 `MAKESHOP_*`, `details` 에 `shopUid`·`resource`·`operation` 포함" 만 기술. Principle 11 은 Case별 JSON 예시를 요구한다.
- **제안**: Cafe24 §5.3 형식을 참조해 `MAKESHOP_AUTH_FAILED` 또는 `MAKESHOP_TRANSPORT_FAILED` 예시 JSON + 필드 표 추가.

---

### 3. [INFO] `output.error.details.retryable` 필드 언급 없음

- **target 위치**: §5.3 / §6 에러 코드.
- **위반 규약**: `spec/conventions/node-output.md` Principle 3.2.1 — `retryable` 은 비-LLM 노드에서 선택이나, "명시할 경우 본 spec 의 의미를 준수". `MAKESHOP_RATE_LIMITED`(429+재시도 소진)·`MAKESHOP_TRANSPORT_FAILED` 같은 transient 에러는 `retryable=true` 분류 대상.
- **상세**: §6 에러 코드 표에 `retryable` 컬럼이 없고, 에러별 retryable 여부가 명시되지 않았다. Cafe24 §6 도 동일하게 생략한 패턴이므로 일관성은 있지만, 규약이 선택 적용을 허용하면서도 "명시 시 의미 준수"를 요구하므로 INFO 로 기록.
- **제안**: 정보 제공 수준에서 `MAKESHOP_RATE_LIMITED` / `MAKESHOP_TRANSPORT_FAILED` 에 `retryable: true` / `retryAfterSec: (Retry-After 헤더 값)` 명시 고려. 단, Cafe24 §6 와 동일하게 생략해도 규약 위반은 아님.

---

### 4. [INFO] `makeshop-api-catalog/_overview.md` frontmatter 누락

- **target 위치**: `spec/conventions/makeshop-api-catalog/_overview.md` (target 문서에서 직접 참조하는 의존 문서).
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §1 — `spec/conventions/**.md` 는 frontmatter 의무. 단 `_*.md` (밑줄 prefix) 는 **제외** 대상.
- **상세**: `_overview.md` 는 밑줄 prefix(`_`)이므로 frontmatter 의무 제외 대상 — 규약 위반이 아님. 이 발견사항은 혼동 방지용 확인 기록이며 실제 위반 없음.
- **제안**: 없음 (규약 정합).

---

### 5. [WARNING] `spec/conventions/makeshop-api-metadata.md` frontmatter `pending_plans` — spec-only 상태에서 권장 사항 미충족

- **target 위치**: `spec/conventions/makeshop-api-metadata.md` frontmatter (`status: spec-only`, `pending_plans: [plan/in-progress/makeshop-integration.md]`). 본 target 문서(5-makeshop.md)가 직접 링크하는 규약 문서.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` 상태에서 `pending_plans:` 는 "권장(권고)"이나, `status: spec-only` TTL 90일 이내로 `pending_plans` 있음은 정합. 본 발견사항은 target 문서(5-makeshop.md) 자체의 `pending_plans` 와 `makeshop-api-metadata.md` 의 `pending_plans` 가 동일 plan(`makeshop-integration.md`)을 가리키는 이중 등록 패턴 — 규약 위반은 아니나, plan 파일이 삭제/이동 시 두 곳 모두 갱신 필요.
- **제안**: 별도 action 없음. 단 plan 라이프사이클 이동 시 두 spec 문서 모두 `pending_plans` 갱신 필요함을 인식.

---

### 6. [CRITICAL] `status` 필드 값 `spec-only` — TTL 추적 시작 시각 불명확 (spec-impl-evidence §3)

- **target 위치**: `spec/4-nodes/4-integration/5-makeshop.md` frontmatter `status: spec-only`.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §3 — `spec-only` TTL **90일** 초과 시 build fail. 가드(`spec-status-lifecycle.test.ts`)가 최초 commit 기준으로 TTL을 추적.
- **상세**: 이는 규약 위반이 아니라 미래 위험이다. 본 문서가 신규 생성(`spec-only`)이므로 90일 카운터가 시작된다. 구현 plan(`makeshop-integration.md`)이 90일 이내에 착수되어 `status: partial` 로 승격되지 않으면 build gate가 실패한다. 본 리뷰 시점(2026-06-03)에서 90일 내 착수가 계획돼 있으므로 즉각적 위반은 아니나, spec-only 상태를 모니터링할 것.
- **제안**: 이미 `pending_plans` 가 등록되어 있어 가드 대비는 충분. CRITICAL 등급으로 표시한 것은 TTL 시계가 이미 돌고 있음을 강조하기 위함 — 규약 violation 이 아닌 예방 주의.

  > 재평가: 이 항목은 규약 직접 위반이 아니므로 CRITICAL 에서 INFO 로 조정한다 (TTL 시계는 정상 시작됨, 현재 위반 없음).

---

### 7. [WARNING] `3xx` 에러 라우팅 — port `error` 에 3xx 포함 표기

- **target 위치**: §3 포트 표 (error 포트 설명 "MakeShop API 3xx/4xx/5xx"), §4 step 12 "3xx/4xx/5xx → §5.3".
- **위반 규약**: `spec/conventions/node-output.md` Principle 3 에러 컨트랙트 — "Runtime 에러(외부 API 실패) → port: 'error' + output.error". 3xx 는 일반적으로 redirect 이지 에러가 아니므로 포트 설명과 에러 코드 표 간에 충돌 가능성.
- **상세**: 에러 코드 표(§6)에는 `MAKESHOP_4XX` / `MAKESHOP_5XX` 만 있고 `MAKESHOP_3XX` 코드가 없다. 포트 설명에 "3xx" 를 포함하면서 §6 에 대응 코드가 없는 불일치. Cafe24 §3/§5.3 에도 동일한 "3xx/4xx/5xx" 표기가 있으나 cafe24 §6 도 `CAFE24_4XX` / `CAFE24_5XX` 체계로 3xx 코드 없음 — 따라서 패턴 일관성은 있으나 규약과의 명시적 정합이 누락.
- **제안**: §6 에 `MAKESHOP_3XX` 코드를 추가하거나, §3 포트 설명에서 "3xx" 를 제거하고 redirect(3xx)는 실제로 fetch 레벨에서 따르므로 별도 에러 라우팅 없음을 명시. 또는 규약 자체(Cafe24 노드 포함)를 갱신해 "3xx는 fetch-follow 후 최종 응답 코드로 분류" 정책을 명문화.

---

### 8. [INFO] 도구 이름 매핑 표(§8.1) — `resource` 컬럼 정보 생략

- **target 위치**: §8.1 도구 이름 매핑 표.
- **위반 규약**: 직접 위반 규약 없음. 단 명명 규약 관점에서 MCP 도구명 `mcp_<int8자>__get_product` 에서 `resource` 정보(`product`)가 생략됨.
- **상세**: Cafe24 노드 §8.1 패턴을 그대로 따른 것으로 보이므로 패턴 일관성은 있음. `resource` 가 MCP 도구명에 없으면 동일 operation id 를 여러 resource 가 공유할 경우 충돌 가능성 있으나, MakeShop catalog 분석상 operationId 가 resource 안에서만 unique 하므로 도구명 충돌 위험을 §8.1 주석이 명시해야 함. 현재 미명시.
- **제안**: §8.1 에 "MakeShop operationId 는 resource 내 unique 이므로, 서로 다른 resource 의 동일 id 가 있으면 도구명 충돌 발생 — 현재 catalog 상 없음" 주석 추가 권장 (INFO 수준).

---

### 9. [INFO] `spec/conventions/makeshop-api-catalog/_overview.md` — frontmatter 없음 (규약 정합 확인)

- **target 위치**: `spec/conventions/makeshop-api-catalog/_overview.md` 파일.
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` §1 — `_*.md` (밑줄 prefix) 는 frontmatter 의무 **제외**.
- **상세**: `_overview.md` 는 밑줄 prefix이므로 frontmatter 가드 면제 대상. 실제로 frontmatter 없음 — 정합.
- **제안**: 없음.

---

### 10. [WARNING] error code `MAKESHOP_AUTH_FAILED` — 401 과 403 을 단일 코드로 통합

- **target 위치**: §6 에러 코드 표 `MAKESHOP_AUTH_FAILED` 행.
- **위반 규약**: `spec/conventions/error-codes.md` §1 의미 기반 명명 — "조건의 의미(무엇이 잘못되었는가)를 기술". 401(인증 실패/토큰 만료)과 403(권한 부족/scope 없음)은 의미가 다르다. §6.1 의 설명에서도 "403 즉시 격하 + `status_reason='insufficient_scope'`" 으로 401과 403의 처리가 실질적으로 분기된다.
- **상세**: 단일 코드 `MAKESHOP_AUTH_FAILED` 가 두 의미적으로 다른 조건(401 reactive-refresh-실패 vs 403 scope 부족)을 커버한다. 클라이언트가 error.code 로 분기할 때, 401-재시도-실패(재연결 안내)와 403-scope-부족(권한 변경 안내)은 사용자에게 다른 행동을 요구한다. Cafe24 노드도 동일 패턴 `CAFE24_AUTH_FAILED` 로 통합하고 있어 프로젝트 일관성은 있으나, error-codes.md 의미 기반 원칙과 거리가 있다.
- **제안**: (a) 현재 Cafe24 `CAFE24_AUTH_FAILED` 와의 일관성 유지를 위해 단일 코드를 유지하고 `error-codes.md` §3 historical-artifact 레지스트리에 "401+403 통합 코드" 패턴을 명시적으로 등록, 또는 (b) `MAKESHOP_AUTH_FAILED` (401) / `MAKESHOP_FORBIDDEN` (403) 으로 분리. (a) 를 권장 — 이미 Cafe24 에서 확립된 패턴.

---

## 요약

`spec/4-nodes/4-integration/5-makeshop.md` 는 전반적으로 정식 규약을 충실히 따른다. frontmatter 스키마(`id`/`status`/`code`/`pending_plans`)는 `spec-impl-evidence.md` 요건을 충족하고, 출력 구조 5필드 invariant(Principle 0)·config echo(Principle 7)·에러 컨트랙트(Principle 3.2)·에러 코드 명명(UPPER_SNAKE_CASE + 도메인 prefix)은 모두 정합하다. 주요 우려는 두 가지다: (1) §5.3 에러 Case 에 JSON 예시가 없어 Principle 11 출력 문서화 규칙이 미충족(WARNING), (2) 에러 코드 `MAKESHOP_AUTH_FAILED` 가 401/403 두 의미 조건을 단일 코드로 통합해 `error-codes.md` 의미 기반 원칙과 긴장 관계에 있다(WARNING). 두 항목 모두 Cafe24 노드의 선행 패턴을 의도적으로 답습한 것이므로, 수정 시 Cafe24 노드와 함께 규약 자체를 갱신하는 접근이 적절하다. 섹션 번호 점프(5.1→5.3)는 INFO 수준의 형식 일관성 문제다.

## 위험도

LOW

STATUS: SUCCESS
