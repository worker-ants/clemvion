# Cross-Spec 일관성 검토 결과

대상: `spec/5-system/14-external-interaction-api.md` (draft)
검토 시각: 2026-06-14

---

## 발견사항

### 1. **[WARNING]** `SCOPE_MISMATCH` vs `TOKEN_SCOPE_MISMATCH` — EIA §5.1과 data-flow/15 간 코드명 불일치

- **target 위치**: draft §5.1 에러 응답 표, 403 행
- **충돌 대상**: `/spec/5-system/14-external-interaction-api.md` 커밋 버전 §5.1 (line 316)
- **상세**: draft(검토 대상)는 `TOKEN_SCOPE_MISMATCH`(403)로 표기하고, 데이터 흐름 SoT인 `/spec/data-flow/15-external-interaction.md` §3.1도 `scope_mismatch→TOKEN_SCOPE_MISMATCH`를 명시한다. 그런데 현재 커밋된 EIA spec §5.1에는 `SCOPE_MISMATCH`(접두 없음, 403)로 적혀 있어 세 문서 사이에 코드명 불일치가 존재한다. draft와 data-flow/15는 `TOKEN_SCOPE_MISMATCH`로 일치하므로 커밋 EIA spec이 구버전 표기를 보존하고 있는 상태.
- **제안**: 커밋 EIA spec §5.1의 `SCOPE_MISMATCH`를 `TOKEN_SCOPE_MISMATCH`로 정정해 draft, data-flow/15, R13 Rationale과 일치시킨다. 동시에 `spec/conventions/error-codes.md`에 `TOKEN_SCOPE_MISMATCH` 등재 여부를 확인한다.

---

### 2. **[WARNING]** `scope_mismatch` HTTP 상태 코드 — data-flow/15는 401 컨텍스트, EIA spec은 403

- **target 위치**: draft §5.1 에러 응답 표, `TOKEN_SCOPE_MISMATCH` 행 (403 Forbidden)
- **충돌 대상**: `/spec/data-flow/15-external-interaction.md` §3.1 (lines 268–269): "검증 실패 사유 → 401 코드 매핑: ... `scope_mismatch→TOKEN_SCOPE_MISMATCH` ..."
- **상세**: data-flow/15는 scope_mismatch를 명시적으로 "401 코드 매핑"이라는 헤딩 아래 나열한다. draft와 커밋 EIA spec은 모두 403 Forbidden으로 정의한다. RFC 7235 기준으로 scope 불일치는 인가(Authorization) 실패이므로 403이 더 적합하지만, data-flow/15의 "401" 분류와 직접 모순된다.
- **제안**: `/spec/data-flow/15-external-interaction.md` §3.1의 scope_mismatch 항목을 "401" 그룹에서 분리해 "403 코드 매핑: `scope_mismatch→TOKEN_SCOPE_MISMATCH`"로 명시하거나, 또는 해당 항목에 "(HTTP 403)" 주석을 추가해 EIA spec §5.1과 정합시킨다.

---

### 3. **[WARNING]** data-flow/15의 `TOKEN_REVOKED` / `TOKEN_AUDIENCE_MISMATCH` — EIA §5.1 에러 표에 누락

- **target 위치**: draft §5.1 에러 응답 표 (401 행: `TOKEN_INVALID` / `TOKEN_EXPIRED`만 나열)
- **충돌 대상**: `/spec/data-flow/15-external-interaction.md` §3.1 (lines 268–270): `blacklisted→TOKEN_REVOKED`, `audience_mismatch→TOKEN_AUDIENCE_MISMATCH`
- **상세**: interaction.guard.ts가 생성하는 401 코드는 data-flow/15 기준으로 `TOKEN_EXPIRED`, `TOKEN_REVOKED`, `TOKEN_SCOPE_MISMATCH`, `TOKEN_AUDIENCE_MISMATCH`, `TOKEN_INVALID` 5종이다. draft §5.1의 401 행은 `TOKEN_INVALID / TOKEN_EXPIRED` 두 가지만 표기해 외부 API 클라이언트에게 실제 발생 가능한 에러 코드를 누락 안내한다.
- **제안**: draft §5.1 에러 표의 401 행에 `TOKEN_REVOKED`(jti 블랙리스트 적중, execution 종료 후) 및 `TOKEN_AUDIENCE_MISMATCH`(audience 필드 불일치)를 추가하거나, data-flow/15 §3.1을 전체 권위 목록으로 명시적으로 cross-reference한다.

---

### 4. **[WARNING]** `execution.node.cancelled` 이벤트 — WS §4.6 매핑 표에는 있으나 EIA §5.2 SSE 이벤트 목록에서 누락

- **target 위치**: draft §5.2 SSE 이벤트 종류 목록 (target lines 360–361)
- **충돌 대상**: `/spec/5-system/6-websocket-protocol.md` §4.6 Server→Client 이벤트 매핑 표 (line 789): `execution.node.cancelled` SSE 이벤트 명시
- **상세**: WS §4.6는 자신이 "권위적" 매핑 표이며 외부 spec §11 표가 이와 정합해야 한다고 명시한다. WS §4.6에는 `execution.node.cancelled → execution.node.cancelled` (notification 미발송)가 있다. draft §5.2는 `execution.node.started / completed / failed / skipped`만 열거하고 `cancelled`를 누락한다. SSE 어댑터가 실제로 이 이벤트를 외부로 fan-out하면 클라이언트가 예상치 못한 이벤트를 받게 된다.
- **제안**: draft §5.2 SSE 이벤트 목록에 `execution.node.cancelled`를 추가한다. WS §4.6 매핑 표가 권위 SoT이므로 EIA §5.2 및 §11 매핑 표도 동기화한다.

---

### 5. **[WARNING]** WS §4.6 매핑 표의 REST endpoint URL — `/api/executions/:id/...` vs `/api/external/executions/:id/...`

- **target 위치**: draft §11 WS 명령 ↔ 외부 명령 매핑 표 (correct: `/api/external/executions/:id/interact`)
- **충돌 대상**: `/spec/5-system/6-websocket-protocol.md` §4.6 (lines 767, 774, 782): 열 헤더와 alias 주석에서 `/api/executions/:id/interact`, `/api/executions/:id/cancel`, `/api/executions/:id/stream`으로 잘못 표기
- **상세**: EIA R11과 draft §10 구현 파일 구조 모두 prefix가 `/api/external/executions/...`임을 확정한다. WS §4.6 매핑 표는 여전히 내부 경로 `/api/executions/:id/...`를 외부 REST 명령 열 헤더에 기술하여 독자가 잘못된 경로를 사용하도록 오도할 위험이 있다.
- **제안**: `/spec/5-system/6-websocket-protocol.md` §4.6 매핑 표의 열 헤더 URL을 `/api/external/executions/:id/interact`, `/api/external/executions/:id/cancel`, `/api/external/executions/:id/stream`으로 수정한다. 본 수정은 target이 아닌 인접 spec 문서에서 이루어져야 한다.

---

### 6. **[INFO]** `notification_secret_v2` 컬럼의 저장 의미 — data-model은 "secret" 원문 암시, EIA §7.1은 "secretRef"만 보관

- **target 위치**: draft §7.1 Trigger 엔티티 확장, `notification_secret_v2` 설명 ("ref 만 보관")
- **충돌 대상**: `/spec/1-data-model.md` §2.8 Trigger 테이블 (line 232): `notification_secret_v2 | Text? | Secret rotation 기간(24h grace) 동안 사용되는 신규 secret`
- **상세**: data-model §2.8의 설명은 컬럼이 "신규 secret"을 저장한다고 기술하지만, draft §7.1은 `notification_secret_v2`도 `secret_store` 테이블의 `secret://triggers/{triggerId}/notification-signing.v2` ref만 보관한다고 명확히 밝힌다. secret-store convention(`spec/conventions/secret-store.md`) line 36이 실 구현 SoT이다.
- **제안**: `/spec/1-data-model.md` §2.8의 `notification_secret_v2` 설명에 "(SecretStore ref — `secret://triggers/{id}/notification-signing.v2` — plaintext 미저장, EIA §7.1)"을 추가해 EIA §7.1 및 secret-store convention과 동기화한다.

---

### 7. **[INFO]** Rationale R13 매핑 표 — 내부 REST `INVALID_STATE` (422)와의 관계 미기술

- **target 위치**: draft Rationale §R13 매핑 표 (EIA 외부 표면: `409 STATE_MISMATCH`)
- **충돌 대상**: `/spec/5-system/3-error-handling.md` §1.3 (line 55): `INVALID_STATE` → 422. `/spec/5-system/4-execution-engine.md` §7.5.1 (line 989): 내부 REST 진입점은 422 `INVALID_STATE`
- **상세**: execution-engine §7.5.1은 `InvalidExecutionStateError`의 세 표면을 정의한다 — WS는 `INVALID_EXECUTION_STATE`, 내부 REST는 422 `INVALID_STATE`, EIA 외부 REST는 409 `STATE_MISMATCH`. draft R13은 WS↔EIA 매핑만 기술하고, 동일 내부 에러가 내부 REST에서는 422 `INVALID_STATE`로 다르게 표출됨을 언급하지 않아 완전한 매핑 그림이 누락된다.
- **제안**: R13에 "아래 매핑은 EIA REST 외부 표면(`/api/external/...`) 한정 — 내부 워크스페이스 JWT 경로(`/api/executions/...`)는 error-handling §1.3의 `INVALID_STATE` (422)를 그대로 사용"을 각주로 추가한다.

---

## 요약

target draft(`spec/5-system/14-external-interaction-api.md`)는 전반적으로 실행 엔진·WebSocket·데이터 모델 spec과 잘 연계되어 있다. 그러나 403 `TOKEN_SCOPE_MISMATCH` 코드명이 현 커밋 EIA spec의 `SCOPE_MISMATCH`와 불일치하고, data-flow/15가 scope_mismatch를 401 컨텍스트로 나열해 HTTP 상태 코드 해석에 모호성이 남아 있다. WS §4.6 매핑 표는 외부 REST 경로를 `/api/executions/...`(내부 prefix)로 잘못 표기하고 있으며, `execution.node.cancelled` SSE 이벤트가 WS §4.6 권위 표에는 있으나 EIA §5.2에 누락되어 있다. data-flow/15의 `TOKEN_REVOKED`/`TOKEN_AUDIENCE_MISMATCH` 코드가 EIA §5.1 에러 표에 빠져 있고, `notification_secret_v2` 컬럼의 저장 의미(plaintext vs SecretStore ref)가 data-model과 EIA §7.1에서 달리 기술되는 INFO 수준 비일관성도 존재한다. CRITICAL 수준 직접 모순(두 영역 중 하나가 작동 불가)은 발견되지 않았다.

## 위험도

MEDIUM
