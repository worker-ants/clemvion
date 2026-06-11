# Cross-Spec 일관성 검토 결과

**검토 대상**: `spec/4-nodes/4-integration/` (0-common / 1-http-request / 2-database-query / 3-send-email)  
**검토 모드**: 구현 완료 후 검토 (--impl-done), diff-base=origin/main  
**검토일**: 2026-06-11

---

## 발견사항

### 1. [INFO] `spec/5-system/3-error-handling.md` — HTTP_BLOCKED 에러 코드 표 이미 동기화됨

- **target 위치**: `1-http-request.md §6` 에러 코드 표에 `HTTP_BLOCKED` 추가
- **충돌 대상**: `spec/5-system/3-error-handling.md` §5 노드 에러 코드 카테고리 표
- **상세**: 이 브랜치에서 `3-error-handling.md`의 HTTP 카테고리 행이 이미 `HTTP_BLOCKED (SSRF 차단 — 전 인증 방식 공통)` 로 갱신되어 있다. target spec 과 정합하며 모순 없음.
- **제안**: 변경 없음 — 이미 동기화 완료.

---

### 2. [INFO] `spec/conventions/node-output.md` — D4 SSRF 차단 설명이 `HTTP_BLOCKED` 를 언급하나 `인증 방식' 범위는 미명시

- **target 위치**: `1-http-request.md §8.2 Rationale` — "전 인증 방식 공통" 결정 기록
- **충돌 대상**: `spec/conventions/node-output.md` §D4 주석 ("D4 (2026-05-17): Integration 계열 노드의 SSRF 차단(`HTTP_BLOCKED`)...")
- **상세**: `node-output.md` 의 D4 설명은 "SSRF 차단(`HTTP_BLOCKED`)"을 단순히 나열할 뿐 "어느 authentication 모드에 적용되는가" 를 명시하지 않는다. 2026-06-11 의 전 인증 방식 확장(none/custom 포함) 이후 독자가 구 정책과 혼동할 수 있다.
- **제안**: `node-output.md` D4 주석의 `HTTP_BLOCKED` 설명에 "전 인증 방식 공통 (none/integration/custom)" 주석 1줄 추가 권장. 모순은 아니므로 INFO 수준.

---

### 3. [WARNING] `spec/5-system/11-mcp-client.md §3.2` — Production fail-closed 에서 `ALLOW_PRIVATE_HOST_TARGETS` 의 정책 분류가 target 과 일치하나, 언급 범위가 http-request 전용으로 한정됨

- **target 위치**: `1-http-request.md §4 SSRF opt-out callout` — "HTTP Request(`none`/`integration`/`custom` 전부)·Database Query·Send Email 이 동일 플래그를 공유"
- **충돌 대상**: `spec/5-system/11-mcp-client.md §3.2` 하단 production fail-closed 박스: "정당한 self-host 용도(VPC 내부 호스트 등)가 있는 `ALLOW_PRIVATE_HOST_TARGETS`(http-request §4)는 정책이 달라 throw 가 아닌 warn 으로 분리"
- **상세**: `11-mcp-client.md` 의 해당 박스는 `ALLOW_PRIVATE_HOST_TARGETS` 를 "`http-request §4`" 라 링크하며 HTTP Request 단독 플래그인 것처럼 기술하지만, target spec 은 이 플래그가 HTTP Request·Database Query·Send Email **전반** 의 공통 플래그임을 명시한다. 독자가 mcp-client 를 먼저 읽으면 DB/Email 에서도 공유됨을 인지하지 못할 수 있다. 링크 경로 자체는 올바르나 서술이 좁다.
- **제안**: `11-mcp-client.md` 의 해당 박스에서 `(http-request §4)` → `(http-request §4 — http/db/email 공통 플래그)` 로 보완. 또는 0-common.md 로 링크 변경.

---

### 4. [INFO] `spec/5-system/3-error-handling.md` — `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 행 제거 (비-integration 변경)

- **target 위치**: N/A — target scope(`spec/4-nodes/4-integration/`) 외 변경
- **충돌 대상**: 이 브랜치가 `3-error-handling.md` 에서 `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 두 행을 제거함
- **상세**: 이는 이 브랜치의 target 변경(SSRF 전 인증 방식 확장) 과는 별도로 포함된 정리 작업이다. 제거된 두 코드가 `spec/5-system/7-llm-client.md` 의 에러 코드 표에는 여전히 `LLM_CONFIG_INVALID` 로 남아 있어 혼동 여지가 없다. (`LLM_CONFIG_INVALID` 는 다른 코드명이라 충돌 없음.) 단, 코드베이스(`model-config.service.ts`, `model-config.controller.ts`)가 실제로 `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 를 사용하고 있다면 spec 삭제 후 코드 참조가 부유 상태가 된다. spec 변경 범위 문서화 차원에서 INFO 기록.
- **제안**: 코드베이스에서 `MODEL_CONFIG_INVALID`·`MODEL_CONFIG_NOT_FOUND` 문자열이 실제로 사용 중인지 확인하고, 사용 중이면 spec 에 재등록하거나 코드도 rename 필요.

---

### 5. [INFO] `spec/4-nodes/4-integration/3-send-email.md` — send-email 포트 이름이 `out` 으로 다른 노드의 `success` 와 다름 — 본 브랜치 변경 없음, 기존 비일관성 확인

- **target 위치**: `3-send-email.md §3.2` 출력 포트 `out` / `5.1 port: 'out'`
- **충돌 대상**: `0-common.md §7` 색인 표 — "정상 케이스 = `§5.1 (success)`" 로 표시. `3-send-email.md §3.2` 는 포트 id 를 `out` 으로 선언하나 `0-common.md §7` 의 send_email 행에는 "§5.1 (`success`)" 가 아닌 "§5.1 (`out`)" 이라고 기재되어 있어 색인 자체는 정확하다.
- **상세**: `0-common.md §7` 색인을 재확인하니 send_email 행 정상 케이스가 "§5.1 (`success`)" 로 기재되어 있고, `3-send-email.md` 의 실제 포트 이름은 `out`이다. 이 비일관성은 이 브랜치 이전부터 존재했고 본 브랜치는 이 행을 수정하지 않았다.
- **제안**: `0-common.md §7` 의 send_email 행 "§5.1 (`success`)" → "§5.1 (`out`)" 으로 수정 권장. 기능 모순이 아닌 명명 비일관성이므로 INFO.

---

### 6. [WARNING] `spec/4-nodes/4-integration/2-database-query.md §4` — SSRF 차단 시 에러 코드가 `INTEGRATION_CALL_FAILED` (fallback)로 노출됨 — HTTP의 `HTTP_BLOCKED`, Email의 `EMAIL_HOST_BLOCKED` 와 비대칭

- **target 위치**: `2-database-query.md §4 SSRF 가드` 주석 — "차단 시 코드는 전용 코드 없이 `mapDbError` fallback 인 `INTEGRATION_CALL_FAILED` 로 surface 된다 (HTTP 의 `HTTP_BLOCKED`·Email 의 `EMAIL_HOST_BLOCKED` 와 달리 driver 도메인 전용 코드 미정의 — 향후 통일 후보)"
- **충돌 대상**: `spec/5-system/3-error-handling.md §5` 노드 에러 코드 표 — Database Query 카테고리에 SSRF 관련 코드 미등재. `1-http-request.md` 의 `HTTP_BLOCKED`, `3-send-email.md` 의 `EMAIL_HOST_BLOCKED` 와 대칭 항목 없음.
- **상세**: HTTP와 Email은 SSRF 차단 시 전용 코드(`HTTP_BLOCKED`, `EMAIL_HOST_BLOCKED`)를 가지나, Database Query는 `INTEGRATION_CALL_FAILED` fallback으로 흡수된다. `3-error-handling.md` 의 Database Query 행에는 이 비대칭이 반영되어 있지 않다. 워크플로우 개발자가 DB SSRF 차단을 `INTEGRATION_CALL_FAILED` 로 처리해야 함을 모르고 `DB_QUERY_FAILED` 만 체크할 수 있다.
- **제안**: `3-error-handling.md` Database Query 에러 코드 행에 `INTEGRATION_CALL_FAILED` (SSRF 차단 포함 fallback) 주석 추가. `2-database-query.md §6.2` 에 SSRF 차단용 코드를 명시하고, 장기적으로 `DB_HOST_BLOCKED` 또는 통합 `INTEGRATION_HOST_BLOCKED` 전용 코드 도입 검토.

---

### 7. [INFO] `spec/4-nodes/4-integration/1-http-request.md §5.8` — 구 `INTEGRATION_NOT_FOUND` 코드 제거 및 `INTEGRATION_CALL_FAILED` fallback 명시

- **target 위치**: `1-http-request.md §5.8` (D4 이전 목록에서 `INTEGRATION_NOT_FOUND` 삭제, `INTEGRATION_CALL_FAILED` 설명 추가)
- **충돌 대상**: `spec/4-nodes/4-integration/0-common.md §4.2` — `INTEGRATION_CALL_FAILED` 코드는 존재하나 `INTEGRATION_NOT_FOUND` 는 "현재 코드에 존재하지 않는다" 로 명시
- **상세**: origin/main 의 `1-http-request.md §5.8` 에는 `INTEGRATION_NOT_FOUND` 가 열거되어 있었으나 이 브랜치에서 제거되고 `INTEGRATION_CALL_FAILED` fallback으로 대체됨. `0-common.md §4.2` 의 기술과 정합. 다른 spec 파일(`5-makeshop.md`, `4-cafe24.md`)도 "별도 `INTEGRATION_NOT_FOUND` 코드 없음" 을 이미 명시하고 있어 일관.
- **제안**: 변경 없음. 전체 Integration 노드 간 일관성 확인됨.

---

### 8. [INFO] `spec/1-data-model.md §2.11` — legacy 컬럼 제거 예정 표기 변경 (비-integration 변경, scope 무관)

- **target 위치**: N/A
- **충돌 대상**: `spec/1-data-model.md §2.11` — `embedding_llm_config_id`, `embedding_model` 의 "PR4b 제거 예정" → "V092 제거 예정" 로 변경
- **상세**: target scope(integration 노드 spec) 외 변경이지만 이 브랜치에 포함. 의미 변화 없이 마이그레이션 버전 번호를 정확히 기재. 충돌 없음.
- **제안**: 변경 없음.

---

## 요약

이 브랜치의 핵심 변경사항 — HTTP Request SSRF 가드를 `authentication='integration'` 전용에서 `none`/`custom`/`integration` 전 인증 방식 공통으로 확장 + Config echo 를 spread 금지(명시 열거) 방식으로 강화 — 은 기존 spec(`spec/2-navigation/4-integration.md §SSRF`, `spec/5-system/3-error-handling.md`, `spec/conventions/node-output.md D4`, `spec/5-system/11-mcp-client.md §Production fail-closed`) 과 직접 모순 없이 정합한다. 단, Database Query의 SSRF 차단 코드가 HTTP/Email 과 달리 전용 코드 없이 `INTEGRATION_CALL_FAILED` fallback으로 흡수되는 비대칭이 `3-error-handling.md` 에 미반영되어 WARNING 수준의 비일관성이 남아 있다. `spec/5-system/11-mcp-client.md §3.2` 의 `ALLOW_PRIVATE_HOST_TARGETS` 서술이 "http-request 전용"처럼 읽혀 DB/Email 공유 사실이 누락된 점도 독자 혼동 가능성이 있어 WARNING으로 기록하나 기능 모순은 아니다.

## 위험도

LOW

---

*생성: cross-spec consistency sub-agent, 2026-06-11*
