### 발견사항

제공된 변경 파일 중 직접적인 데이터베이스 코드는 포함되어 있지 않습니다. 프론트엔드 컴포넌트(`override-registry.ts`, `mcp-server-selector.tsx`, `integrations.ts`), 문서(`.mdx`), 상수 파일(`mcp-capable-service-types.ts`), plan/review 마크다운 파일만 포함되어 있습니다.

단, `review/2026-05-14_01-29-47/database/review.md`와 `RESOLUTION.md`에서 확인된 실제 데이터베이스 변경(V041 마이그레이션, `integration-oauth-state.entity.ts`, `cafe24-api.client.ts`)에 대한 내용을 교차 검토합니다.

---

- **[INFO]** V041 마이그레이션 무중단 안전성 — 이미 검토됨
  - 위치: `V041__integration_oauth_state_provider_meta.sql` (diff 미포함, RESOLUTION.md 참조)
  - 상세: `ALTER TABLE ... ADD COLUMN provider_meta JSONB NULL`은 PostgreSQL에서 테이블 리라이트 없이 메타데이터 잠금만 짧게 점유. Nullable + 기본값 없음 조합으로 zero-downtime 배포 기준에 적합.
  - 제안: 없음

- **[INFO]** `client_secret` 암호화 적용 — RESOLUTION C4로 처리됨
  - 위치: `RESOLUTION.md` C4 항목
  - 상세: `IntegrationOAuthState.providerMeta`에 `encryptedJsonTransformer` (AES-256-GCM) 적용으로 평문 저장 문제가 조치됨. V041 컬럼 코멘트에서 민감 필드명(`client_secret`) 열거도 추상화됨.
  - 제안: 없음 (이미 조치)

- **[INFO]** 토큰 갱신 비관적 잠금 누락 — follow-up으로 분리됨
  - 위치: `cafe24-api.client.ts` — `ensureFreshToken()` (diff 미포함)
  - 상세: `findOne → save` 패턴에서 `pessimistic_write` 락(`SELECT FOR UPDATE`) 없이 트랜잭션만 사용. 멀티 인스턴스 배포 시 동시 refresh 시도로 1회성 refresh token 소진 → `auth_failed` 전이 가능. RESOLUTION W1에서 "현재 단일 인스턴스 전제 (spec §9.6) 명시"로 인정하고 follow-up 처리됨.
  - 제안: 멀티 인스턴스 배포 전환 시점에 `findOne`에 `lock: { mode: 'pessimistic_write' }` 추가 필요.

- **[INFO]** OAuth state 원자적 소비 패턴 — 적절
  - 위치: `integration-oauth.service.ts` (diff 미포함)
  - 상세: DELETE-RETURNING 패턴으로 OAuth state row를 원자적으로 소비. Replay attack 방어 올바름.
  - 제안: 없음

- **[INFO]** N+1 없음 — `lookupMcpServers` 변경
  - 위치: `candidate-lookup.service.ts` (diff 미포함, `mcp-server-selector.tsx` 연동)
  - 상세: `serviceType: ['mcp', 'cafe24']` 확장이 단일 `findAll` 쿼리로 처리됨. 반복문 내 개별 쿼리 없음.
  - 제안: 없음

---

### 요약

제공된 diff 파일들은 대부분 프론트엔드 컴포넌트와 문서 파일로 직접적인 데이터베이스 코드를 포함하지 않습니다. 실제 데이터베이스 변경(V041 마이그레이션, entity 암호화, OAuth state 처리)은 별도 파일에 존재하며, 기존 `database/review.md`와 `RESOLUTION.md`에서 주요 이슈들이 이미 식별·조치되었습니다. 잔여 위험은 멀티 인스턴스 환경에서의 토큰 갱신 동시성 문제뿐이며, 이는 현재 아키텍처(단일 인스턴스)에서는 해당하지 않아 follow-up으로 적절히 분리된 상태입니다.

### 위험도
**LOW** (직접 변경된 파일 기준 NONE, 연관 DB 변경 참조 기준 LOW)