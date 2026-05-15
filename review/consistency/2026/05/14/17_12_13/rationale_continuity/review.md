이제 발견사항을 정리합니다.

---

## Rationale Continuity Check — 결과

### 발견사항

---

**[WARNING] DRAFT 3B: `pending_install` status_reason 값이 UPPER_SNAKE_CASE로 기재 — DRAFT 1C의 명시적 snake_case 정책 위반**

- **target 위치:** DRAFT 3B (`spec/data-flow/integration.md` §3.2 status_reason 매핑 replace 패치)
- **과거 결정 출처:** DRAFT 1C (`spec/1-data-model.md` §2.10 status_reason 행 replace) — 본 draft 안에서 "DB 저장값은 `snake_case`, API 응답 에러 코드는 `UPPER_SNAKE_CASE` (의도적 분리)"를 명시
- **상세:**
  DRAFT 1C는 `pending_install` status_reason 후보로 `oauth_token_exchange_failed` / `oauth_state_mismatch` / `oauth_state_expired` / `resource_not_found` (all snake_case)를 기재하고, "DB 저장값은 snake_case" 원칙을 명시적으로 선언한다. 그런데 DRAFT 3B의 `spec/data-flow/integration.md` §3.2 replace 패치는 동일 값들을 `OAUTH_TOKEN_EXCHANGE_FAILED` / `OAUTH_STATE_MISMATCH` / `OAUTH_STATE_EXPIRED` / `RESOURCE_NOT_FOUND` (UPPER_SNAKE_CASE)로 기재한다. 기존 §3.2 테이블(`insufficient_scope`, `auth_failed`, `token_expired` 등)의 snake_case 컨벤션과도 충돌한다. 이 상태로 적용되면 두 spec 파일이 같은 DB 컬럼의 저장값에 대해 상충하는 컨벤션을 기술하게 되어 구현 불일치를 유발한다.
- **제안:** DRAFT 3B의 `pending_install` 행을 DRAFT 1C와 일치하는 snake_case로 수정:
  ```diff
  - | `pending_install` | callback 실패 분기 코드 (예: `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`) ... |
  + | `pending_install` | callback 실패 분기 코드 (예: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found`) ... |
  ```

---

**[WARNING] DRAFT 3C: sequence diagram `status_reason=OAUTH_TOKEN_EXCHANGE_FAILED` — DB 저장값 컨텍스트에서 UPPER_SNAKE_CASE 사용**

- **target 위치:** DRAFT 3C `spec/data-flow/integration.md` §1.2.1 sequence diagram 내 `Svc->>PG: UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, ...` 라인
- **과거 결정 출처:** DRAFT 1C 동일 정책 + 기존 `spec/data-flow/integration.md` §3.2 테이블 (snake_case 일관)
- **상세:** Mermaid sequence diagram 내에서 PostgreSQL 갱신 pseudocode로 `status_reason=OAUTH_TOKEN_EXCHANGE_FAILED`를 표기하면 DB 저장값을 UPPER_SNAKE_CASE로 오독할 수 있다. DRAFT 2G §10.4 에러 매핑은 동일 값을 `status_reason='oauth_token_exchange_failed'`로 올바르게 기재하고 있어 일관성이 없다.
- **제안:** diagram 라인을 `status_reason=oauth_token_exchange_failed`로 수정. 또는 diagram note에 "DB 저장값은 snake_case" 주석 추가.

---

**[INFO] 기존 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "식별 전략" Rationale 번복 — 새 Rationale 동반으로 수용 가능**

- **target 위치:** DRAFT 2J-2 §9.8 식별 전략 전면 갱신
- **과거 결정 출처:** 현행 `spec/4-nodes/4-integration/4-cafe24.md` §9.8 "식별 전략" 항 — "HMAC 이 `client_secret` 에 묶여 있어, 같은 `mall_id` 에 복수의 `pending_install` Integration 이 있어도 HMAC 검증을 통과한 것이 정확한 타깃이다"
- **상세:** 현행 §9.8은 in-memory HMAC trial-scan을 의도된 설계로 명시했다. DRAFT 2J-2가 이를 `install_token` 단일 조회로 대체한다. draft 내부 §2I Rationale에서 W3(비결정적 매칭), O(N) 비용 두 가지 운영 위험을 근거로 번복 이유를 명시하고 있어 "근거 없는 번복" 기준엔 해당하지 않는다. 기준 충족 확인 완료.

---

**[INFO] DRAFT 2F: HMAC 에러 분리(404 + 403) — 기존 "정보 노출 방지" 원칙 번복, Rationale 동반으로 수용 가능**

- **target 위치:** DRAFT 2F `CAFE24_INSTALL_INVALID_TOKEN(404)` 신설
- **과거 결정 출처:** 현행 `spec/2-navigation/4-integration.md` §9.2 — `CAFE24_INSTALL_INVALID_HMAC(403, pending 미발견 포함 — 정보 노출 방지)`로 두 케이스를 통합
- **상세:** 기존 설계는 토큰 미존재·HMAC 불일치 두 케이스를 동일 403으로 통합해 정보 노출을 방지했다. DRAFT는 이를 404와 403으로 분리하며 §2I Rationale에서 "install_token 추측 불가능(32바이트 random) 가정 하에 정보 노출 위험 제거"를 근거로 제시한다. 보안 가정의 타당성은 별도 검토가 필요하나, Rationale 동반 번복으로 수용 기준 충족.

---

**[INFO] `spec/data-flow/integration.md` Rationale: `last_error` 암호화 — 신규 pending_install 실패 기록과 정합**

- **target 위치:** DRAFT 3C sequence diagram, DRAFT 2D §6 전이 표
- **기존 Rationale:** `spec/data-flow/integration.md` Rationale — "OAuth 응답 본문에 token 일부가 포함될 수 있어 `last_error` 도 동일 transformer로 암호화한다"
- **상세:** draft는 callback 실패 시 `last_error = {code, message, at}`를 기록한다. 기존 암호화 정책이 이에 그대로 적용되어야 한다. DRAFT에서 명시적으로 언급하지는 않으나 기존 transformer가 자동 처리하므로 위반은 아님. 구현 시 주의 필요.

---

### 요약

draft는 전반적으로 기존 합의 원칙을 성실히 문서화하고 있으며, 주요 번복(TTL 만료 시 삭제→expired 전환, install_token 기반 식별, HMAC 에러 분리)에 대해 모두 §2I Rationale에 근거를 제시한다. **CRITICAL 위배는 없다.** 단, DRAFT 3B와 3C가 `pending_install` status_reason 저장값을 UPPER_SNAKE_CASE로 기재해 DRAFT 1C의 명시적 snake_case 정책과 충돌하는 WARNING 2건이 있다. 이 불일치를 수정하지 않으면 두 spec 파일이 동일 DB 컬럼에 대해 상충하는 컨벤션을 기술하게 된다.

### 위험도

**LOW** — WARNING 2건 모두 동일 draft 내부의 표기 불일치이며, 수정 범위가 DRAFT 3B 1행 + DRAFT 3C 1행으로 한정된다. 수정 후 spec 적용 가능.