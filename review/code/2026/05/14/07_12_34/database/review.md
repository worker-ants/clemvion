### 발견사항

- **[WARNING]** JSONB 컬럼 타입과 암호화 트랜스포머 호환성 검증 필요
  - 위치: `V041__integration_oauth_state_provider_meta.sql:11`, `integration-oauth-state.entity.ts:81`
  - 상세: 마이그레이션은 `JSONB` 타입 컬럼을 생성하나, `encryptedJsonTransformer`의 `to()` 함수가 암호화된 평문 문자열(`"AES256GCM:iv:ciphertext"` 형태)을 반환하면 PostgreSQL의 JSONB 파서가 유효하지 않은 JSON이라고 거부한다. `Integration.credentials`, `IntegrationOAuthPreview.credentials`에서 동일한 트랜스포머를 사용하는 컬럼들의 실제 DB 타입(`text` 또는 `jsonb`)과 일치하는지 확인이 필요하다. 트랜스포머가 `'"<base64-ciphertext>"'` 형태의 JSON string literal을 반환하거나, 컬럼 타입을 `text`로 변경해야 할 수 있다.
  - 제안: `credentials-transformer.ts`의 `encryptedJsonTransformer.to()` 반환값이 유효한 JSONB(`"..."` JSON string 또는 `{"_enc":"..."}` JSON object)인지 확인 후, 맞지 않으면 마이그레이션과 엔티티 타입을 `text`로 변경할 것

- **[INFO]** 마이그레이션 무중단 안전성 — 적합
  - 위치: `V041__...sql:11`
  - 상세: `ALTER TABLE ... ADD COLUMN provider_meta JSONB NULL`은 PostgreSQL에서 메타데이터만 갱신하는 instant DDL로, 테이블 rewrite나 AccessExclusiveLock 장시간 점유 없이 실행된다. DEFAULT 없는 nullable 컬럼 추가이므로 무중단 배포에 안전하다.

- **[INFO]** JSONB GIN 인덱스 미생성 — 의도적이고 적합
  - 위치: `V041__...sql`
  - 상세: 컬럼 내용이 AES-256-GCM 암호문이므로 PostgreSQL이 JSON 경로를 파싱할 수 없어 GIN 인덱스가 실효성이 없다. 조회는 항상 `state` 토큰(기존 인덱스 있음)으로 이루어지고 `provider_meta`는 SELECT/DELETE 시 함께 읽히기만 하므로, 인덱스 부재는 설계상 올바르다.

- **[INFO]** OAuth 콜백 Double-redemption 방지 — DELETE-RETURNING 패턴 적합
  - 위치: `integration-oauth.service.cafe24.spec.ts:213`, `integration-oauth.service.ts` (diff 생략)
  - 상세: 테스트에서 `dataSource.query.mockResolvedValueOnce([stateRecord])`로 확인되는 raw SQL 사용 패턴이 `DELETE ... RETURNING ...` 구조를 시사한다. 단일 원자적 연산으로 상태 조회+삭제가 이루어지므로 동시 콜백 요청에서의 이중 소비(double-redemption) 경쟁 조건이 방지된다. 트랜잭션 설계가 적합하다.

- **[INFO]** TTL 기반 만료 데이터 정리 — 기존 인프라에 의존
  - 위치: `integration-oauth-state.entity.ts`
  - 상세: `provider_meta`는 state row와 동일한 TTL(10분)을 공유하며 row 삭제 시 함께 제거된다. 별도의 cleanup 메커니즘이 필요 없고, `expires_at` 컬럼에 인덱스가 기존에 있다면 배치 만료 쿼리도 효율적으로 동작한다. 신규 부채 없음.

---

### 요약

DB 변경의 핵심은 `integration_oauth_state` 테이블에 nullable JSONB 컬럼 하나를 추가하는 단순한 가산적 마이그레이션이다. PostgreSQL에서 nullable + no-default ADD COLUMN은 메타데이터 전용 변경이라 lock 이슈 없이 무중단 배포에 안전하다. 데이터 접근 패턴(state 토큰 조회 → DELETE-RETURNING → providerMeta 소비)도 경쟁 조건 방지 면에서 적절하게 설계되어 있다. 단, **`encryptedJsonTransformer`가 JSONB 컬럼에 실제로 쓸 수 있는 형식(유효한 JSON)을 반환하는지 코드 레벨에서 검증이 필요**하다 — 기존 `Integration.credentials` 컬럼과 실제 DB 스키마 타입이 `text`라면 이번 `jsonb` 선택은 런타임 오류를 유발할 수 있다.

### 위험도
**LOW** (JSONB 타입 호환성 WARNING 1건 확인 필요, 나머지는 설계 적합)