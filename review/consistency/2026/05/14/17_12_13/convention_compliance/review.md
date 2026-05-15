---

## Convention Compliance Check — 결과

### 발견사항

---

**[CRITICAL] DRAFT 3B: `status_reason` 값이 `UPPER_SNAKE_CASE` — DB 컨벤션 위반**

- **target 위치**: DRAFT 3B (`spec/data-flow/integration.md` §3.2 replace), 315행
- **위반 규약**: 본 draft 자신의 DRAFT 1C (line 32)에서 명시한 규약 — *"상태별 사유 코드 (모두 `snake_case`)"*, 및 Rationale(2I) — *"`status_reason` 의 저장값은 callback 에러 코드를 `snake_case` 로 표기한다"*
- **상세**:
  ```diff
  + | `pending_install` | callback 실패 분기 코드 (예: `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`) |
  ```
  DRAFT 1C·2D·2G·2I에서는 동일 값을 일관되게 `snake_case`로 표기하지만(`oauth_token_exchange_failed`, `oauth_state_mismatch` 등), DRAFT 3B만 `UPPER_SNAKE_CASE`로 작성됨. `status_reason`은 DB 저장 컬럼이므로 반드시 `snake_case`.
- **제안**: 아래로 교정
  ```diff
  - | `pending_install` | callback 실패 분기 코드 (예: `OAUTH_TOKEN_EXCHANGE_FAILED`, `OAUTH_STATE_MISMATCH`, `OAUTH_STATE_EXPIRED`, `RESOURCE_NOT_FOUND`) — ...
  + | `pending_install` | callback 실패 분기 코드 (예: `oauth_token_exchange_failed`, `oauth_state_mismatch`, `oauth_state_expired`, `resource_not_found`) — ...
  ```

---

**[CRITICAL] DRAFT 3C 시퀀스 다이어그램: DB UPDATE 문에 `UPPER_SNAKE_CASE` 사용**

- **target 위치**: DRAFT 3C mermaid sequenceDiagram (`spec/data-flow/integration.md` §1.2.1), 354행
- **위반 규약**: 동일 (DRAFT 1C·2I의 `snake_case` DB 저장 규약)
- **상세**:
  ```
  Svc->>PG: UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, ...
  ```
  `UPDATE integration SET` 은 DB 쓰기 컨텍스트이므로 `status_reason` 값은 `snake_case`여야 함. 같은 다이어그램 아래 본문(363행)에서는 `status_reason='install_timeout'`으로 올바르게 표기함 — 불일치.
- **제안**:
  ```diff
  - Svc->>PG: UPDATE integration SET status_reason=OAUTH_TOKEN_EXCHANGE_FAILED, last_error={code,message,at} ...
  + Svc->>PG: UPDATE integration SET status_reason=oauth_token_exchange_failed, last_error={code,message,at} ...
  ```

---

**[INFO] DRAFT 2D 상태 전이 다이어그램: `statusReason` camelCase 표기**

- **target 위치**: DRAFT 2D mermaid 다이어그램 (102행)
- **위반 규약**: 본문 전반의 `status_reason` snake\_case 표기 일관성
- **상세**: `(statusReason='install_timeout')` — DB 컬럼명 `status_reason`과 표기 불일치. mermaid 레이블이라 치명적이진 않으나 spec 독자에게 혼란 유발.
- **제안**: `(status_reason='install_timeout')`으로 통일

---

### 요약

draft 전체는 DB 저장값 `snake_case` / API 응답 `UPPER_SNAKE_CASE` 분리 원칙을 명확히 의도하고 있으며 대부분의 위치에서 올바르게 적용됐다. 그러나 `spec/data-flow/integration.md`를 타깃으로 하는 DRAFT 3B와 3C 두 곳에서 DB 컨텍스트임에도 `UPPER_SNAKE_CASE`가 혼입됐다. 이 두 위치가 그대로 spec에 적용되면 data-flow 문서만 표기가 달라져 혼선이 발생한다. DRAFT 1C에서 명시한 규약을 두 군데만 교정하면 draft 전체는 일관성을 갖춘다.

### 위험도

**MEDIUM** — Critical 위반 2건이 존재하나 모두 로컬 수정(한 행씩 교정)으로 해소 가능하며 다른 시스템 invariant를 깨지는 않는다. 교정 후 spec 파일 적용을 진행해도 무방하다.