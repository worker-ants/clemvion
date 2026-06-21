# 신규 식별자 충돌 검토 결과

검토 범위: `spec/4-nodes/4-integration` (구현 완료 후 검토, diff-base=origin/main)

---

## 발견사항

### 발견사항 없음 — 주요 신규 식별자 모두 기존 사용처와 일치

아래는 정밀 대조 결과다.

#### 1. 에러 코드 (`DB_HOST_BLOCKED`, `EMAIL_HOST_BLOCKED`, `HTTP_BLOCKED`, `INTEGRATION_AUTH_UNSUPPORTED`, `INVALID_PARAMETERS`)

- `DB_HOST_BLOCKED`: `spec/5-system/3-error-handling.md` §1.4 Database 행 및 §3.2 대표 에러 코드 표 양쪽에 등재. `spec/2-navigation/4-integration.md` §9 표, `spec/conventions/chat-channel-adapter.md` §3.1 `DB_*` 와일드카드 매핑에 포함. 의미 충돌 없음.
- `EMAIL_HOST_BLOCKED`: `spec/5-system/3-error-handling.md` §1.4 Email 행(line 82)에 등재됨. 단, 동 파일 §3.2 "대표 에러 코드" 표(line 247)의 Email 행에는 `EMAIL_SEND_FAILED` 만 기재되어 있고 `EMAIL_HOST_BLOCKED` 가 누락되어 있다. `spec/conventions/chat-channel-adapter.md` §3.1 표에도 `EMAIL_SEND_FAILED` 만 명시적 행이 있고 `EMAIL_HOST_BLOCKED` 는 "그 외 모든 code" fallback 행(line 389)으로 흡수되어 있다(기능적으로는 `executionFailedInternal` 로 라우팅). 다른 의미로 쓰이는 기존 식별자와의 충돌은 없으나 등재 불완전함이 있다.
- `HTTP_BLOCKED`: 기존 spec(`spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`)에 이미 등재. 충돌 없음.
- `INTEGRATION_AUTH_UNSUPPORTED`: `spec/4-nodes/4-integration/1-http-request.md` 에만 등재. `spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`, `spec/2-navigation/4-integration.md` 에는 미등재. 충돌은 없으나 교차-참조 누락.
- `INVALID_PARAMETERS`: `spec/4-nodes/4-integration/2-database-query.md` 및 `spec/2-navigation/4-integration.md` §9 표에 일관되게 등재. `spec/5-system/3-error-handling.md` 및 `spec/conventions/chat-channel-adapter.md` 에는 미등재(fallback으로 흡수). 충돌 없음.

#### 2. 환경변수·설정키 (`ALLOW_PRIVATE_HOST_TARGETS`, `POOL_MAX_CONNECTIONS`, `POOL_IDLE_TIMEOUT_MS`)

- `ALLOW_PRIVATE_HOST_TARGETS`: 복수 spec 파일(`spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/2-navigation/4-integration.md`, 각 노드 spec)에서 동일 의미로 일관되게 사용. 충돌 없음.
- `POOL_MAX_CONNECTIONS`/`POOL_IDLE_TIMEOUT_MS`: `spec/4-nodes/4-integration/2-database-query.md` 내 하드코딩 상수로만 등장. `codebase/backend/src/common/config/database.config.ts` 의 `DB_POOL_IDLE_TIMEOUT_MS`(Prisma 메인 DB 풀 env var)와 이름이 유사하나 용도가 분명히 다르다(integration 쿼리 풀 로컬 상수 vs. 메인 DB 풀 설정 env). spec 에서 `POOL_IDLE_TIMEOUT_MS=30000` 를 상수값으로만 언급하고 있어 env var로 오해할 소지는 낮다. 충돌 없음.

#### 3. Redis 채널명 (`integration:cache:invalidate`)

- `spec/0-overview.md`, `spec/5-system/4-execution-engine.md`, `spec/data-flow/5-integration.md` 에 동일 채널명으로 일관 등재. 기존 채널(`execution-run`, `execution-continuation`, `background-execution`, `exec:recover:lock`)과 명명 패턴 및 의미가 구분됨. 충돌 없음.

#### 4. 상태값 (`requires_integration`, `meta.deliveryStatus`)

- `requires_integration`: `spec/5-system/4-execution-engine.md` NodeOutput.status 표에 이미 등재. send-email 전용 escape hatch 용도로 일관. 충돌 없음.
- `meta.deliveryStatus`: `spec/4-nodes/4-integration/3-send-email.md` 전용. 다른 노드 spec 에서 같은 이름이 다른 의미로 쓰이는 사례 없음. 충돌 없음.

#### 5. 파일 경로

- `spec/4-nodes/4-integration/` 하위 `0-common.md`, `1-http-request.md`, `2-database-query.md`, `3-send-email.md`, `4-cafe24.md`, `5-makeshop.md` 전부 기존 명명 컨벤션(`N-name.md`) 준수. 기존 파일과 중복 없음.

---

### [INFO] `EMAIL_HOST_BLOCKED` 가 `spec/5-system/3-error-handling.md §3.2` 두 번째 표에 누락

- target 신규 식별자: `EMAIL_HOST_BLOCKED` (send-email 노드 §5.3)
- 기존 사용처: `spec/5-system/3-error-handling.md` line 82 (§1.4 첫 번째 표 Email 행)에는 등재됨. 그러나 line 247 (§3.2 "대표 에러 코드" 두 번째 표) Email 행은 `EMAIL_SEND_FAILED` 만 기재.
- 상세: 동일 파일 두 표 간 등재 불일치. 의미 충돌이 아니라 등재 누락이다. `spec/conventions/chat-channel-adapter.md` §3.1 표에도 `EMAIL_HOST_BLOCKED` 의 명시적 행이 없어 "그 외" fallback(`executionFailedInternal`)으로 분류됨 — 기술적으로는 올바른 분류이나, `HTTP_BLOCKED`(같은 표에 명시적 행 존재)와의 처리 일관성이 시각적으로 불명확하다.
- 제안: `spec/5-system/3-error-handling.md` §3.2 Email 행에 `EMAIL_HOST_BLOCKED` 추가. `spec/conventions/chat-channel-adapter.md` §3.1 에 `EMAIL_HOST_BLOCKED` 를 `HTTP_BLOCKED` 와 동일 행(`executionFailedInternal`)에 명시적으로 등재. 이는 target 변경이 아니라 교차 spec 보완이다.

### [INFO] `INTEGRATION_AUTH_UNSUPPORTED` 가 교차 spec 에 미등재

- target 신규 식별자: `INTEGRATION_AUTH_UNSUPPORTED` (http-request 노드 §4.1, §5.8)
- 기존 사용처: `spec/4-nodes/4-integration/1-http-request.md` 에만 존재. `spec/5-system/3-error-handling.md`, `spec/2-navigation/4-integration.md` §9 표(다른 `INTEGRATION_*` 코드는 등재됨), `spec/conventions/chat-channel-adapter.md` 에 미등재.
- 상세: `INTEGRATION_TYPE_MISMATCH`, `INTEGRATION_NOT_CONNECTED`, `INTEGRATION_INCOMPLETE`, `INTEGRATION_CALL_FAILED` 는 `spec/2-navigation/4-integration.md` §9 표에 등재되어 있으나 `INTEGRATION_AUTH_UNSUPPORTED` 는 누락. HTTP Request 전용 코드이므로 기존 식별자와 충돌하지는 않는다.
- 제안: `spec/2-navigation/4-integration.md` §9 표에 `INTEGRATION_AUTH_UNSUPPORTED` 행 추가(`http_request` 한정 명시). 이는 target 내 식별자 충돌이 아닌 교차 등재 보완이다.

---

## 요약

`spec/4-nodes/4-integration` 영역이 도입·확정한 신규 식별자(에러 코드 `DB_HOST_BLOCKED`, `EMAIL_HOST_BLOCKED`, `INTEGRATION_AUTH_UNSUPPORTED`, `INVALID_PARAMETERS`, 환경변수 `ALLOW_PRIVATE_HOST_TARGETS`, Redis 채널 `integration:cache:invalidate`, 상태값 `requires_integration`, `meta.deliveryStatus`)는 기존 spec 내 다른 의미의 식별자와 충돌하지 않는다. 대부분은 교차 spec(`spec/5-system/3-error-handling.md`, `spec/conventions/chat-channel-adapter.md`, `spec/2-navigation/4-integration.md`, `spec/0-overview.md`)에 이미 동일 의미로 등재되어 있다. 발견된 이슈는 `EMAIL_HOST_BLOCKED` 의 두 번째 에러 코드 표 누락과 `INTEGRATION_AUTH_UNSUPPORTED` 의 교차 등재 누락 두 건으로, 모두 등재 불완전함이지 의미 충돌이 아니다.

## 위험도

LOW
