## 발견사항

### [WARNING] `install_token` 컬럼에 인덱스 없음 — 성능 개선 근거 약화

- **위치**: `integration.entity.ts`, V042 migration (referenced), spec cross_spec reviews
- **상세**: 새 설계의 핵심 근거는 "기존 `mall_id` 기반 in-memory 100건 스캔 + trial HMAC → `install_token` 단일 row 조회"로의 성능 개선이다. 그러나 `install_token VARCHAR(64) NULL` 컬럼에 인덱스가 추가되지 않아 실제로는 full table scan이 발생한다. 여러 consistency review(`2026-05-14_17-49-11/cross_spec`, `2026-05-14_17-39-56/cross_spec`)도 이 문제를 WARNING으로 지적하였으나 코드에 반영되지 않았다.
- **제안**: `install_token` 컬럼에 UNIQUE 부분 인덱스 추가. `WHERE install_token IS NOT NULL` 조건을 달면 `NULL` 값(callback 성공 후 소거된 행)이 인덱스에서 제외되어 크기 절약 가능.
  ```sql
  CREATE UNIQUE INDEX idx_integration_install_token
    ON integration(install_token)
    WHERE install_token IS NOT NULL;
  ```

---

### [WARNING] `pending_install` 중복 방지가 애플리케이션 레벨에만 의존 — 경쟁 조건 취약

- **위치**: `integrations.controller.ts`, `integration-oauth.service.ts` (diff 생략)
- **상세**: `CAFE24_PRIVATE_APP_ALREADY_CONNECTED(400)` 에러는 `(workspaceId, mall_id, app_type='private')` 중복을 애플리케이션 레벨에서만 체크한다. 동시 요청이 도착하면 두 트랜잭션이 모두 check를 통과하고 중복 `pending_install` 행이 삽입될 수 있다. rationale_continuity review(`2026-05-14_17-21-35`)도 동일 우려를 제기했다.
- **제안**: DB 유니크 제약으로 강제하거나, `INSERT ... ON CONFLICT DO NOTHING`을 활용한다. 또는 최소한 plan에 "race condition 시나리오 e2e 테스트" 항목을 명시한다.

---

### [WARNING] `pending_install` TTL 스캐너 쿼리에 효율적 인덱스 없음

- **위치**: 스캐너 구현 (spec `data-flow/integration.md §1.4` 참조), `integration.entity.ts`
- **상세**: TTL 스캐너는 `WHERE status='pending_install' AND created_at < now - '24h'` 형태의 전역 쿼리를 실행한다. 기존 `(workspace_id, status)` 인덱스는 leading column이 `workspace_id`라 workspace 없는 전역 스캔에 비효율적이다. 테이블 행이 많아질수록 문제가 심화된다.
- **제안**: TTL 스캐너 전용 `(status, created_at)` 복합 인덱스 또는 `WHERE status='pending_install'` 부분 인덱스를 추가한다.

---

### [INFO] `markIntegrationCallbackError` 실패 시 에러 조용히 무시

- **위치**: `integrations.controller.ts:315-324`
- **상세**: callback 에러 처리 경로에서 `markIntegrationCallbackError`를 `await`하지만, 이 DB 쓰기가 실패하더라도 예외가 전파되지 않고 `renderCallbackHtml`이 그대로 실행된다. 관측성(observability) 이 목적인 기능인데, 정작 기록 실패 자체가 무음으로 처리된다.
- **제안**: DB 쓰기 실패를 로깅하거나, try/catch로 감싸 관측 가능하게 처리한다.
  ```typescript
  try {
    await this.oauthService.markIntegrationCallbackError(...);
  } catch (recordErr) {
    this.logger.error('Failed to record callback error', recordErr);
  }
  ```

---

### [INFO] `lastError` DTO에 `additionalProperties: true` — 암호화된 필드 노출 범위 불명확

- **위치**: `integration-response.dto.ts:47-52`
- **상세**: `lastError`가 `Record<string, unknown>`으로 정의되고 `additionalProperties: true`로 선언되어, DB에 저장된 암호화 해제 후 전체 내용이 API 응답에 포함된다. consistency review에서도 "OAuth 응답 본문에 token 일부가 포함될 수 있어 `last_error`도 암호화"라고 언급했는데, 복호화된 내용이 API로 노출되는 범위를 명시적으로 검토해야 한다.
- **제안**: DTO에서 `{ code, message, at }` 형태로 필드를 명시적으로 선언하고 `additionalProperties`를 제거하여 노출 범위를 제한한다.

---

## 요약

DB와 직접 관련된 코드 변경(`install_token` 컬럼 포맷 정리, `markIntegrationCallbackError` DB 쓰기, `lastError` 필드 추가)은 마이그레이션 안전성(nullable 컬럼 추가) 및 트랜잭션 구조 자체에는 큰 문제가 없다. 그러나 이번 변경의 설계 근거인 "단일 row 조회 → O(1) 성능"이 실제 인덱스 없이는 달성되지 않으며, `pending_install` 중복 방지도 경쟁 조건에 취약하다. TTL 스캐너 전용 인덱스 부재도 운영 규모가 커질수록 부담이 된다. 세 WARNING 모두 V042 또는 별도 마이그레이션으로 인덱스를 추가하면 해소 가능한 범위다.

## 위험도

**MEDIUM**