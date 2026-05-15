### 발견사항

- **[INFO]** in-memory 중복 가드의 `app_type === 'private'` 필터 vs SQL UNIQUE 범위 불일치
  - target 위치: `integration-oauth.service.ts:876` `row.credentials?.app_type === 'private'` 조건
  - 과거 결정 출처: `spec/2-navigation/4-integration.md § Rationale "CAFE24_PRIVATE_APP_ALREADY_CONNECTED 의 mall_id 비교 경로"` — "한 workspace 안에서 같은 mall_id 의 cafe24 통합은 최대 1행 (public 과 private 동시 보유 불가)"
  - 상세: SQL UNIQUE 인덱스는 `service_type='cafe24'`인 모든 행(public + private)을 대상으로 한다. 그러나 in-memory 사전 체크는 `app_type === 'private'`만 필터링한다. 동일 mall_id의 public 통합이 connected 상태로 존재할 때 private 통합을 새로 시도하면 in-memory 체크를 통과하고 SQL UNIQUE가 23505로 차단한다. 이 경우 409가 반환되는 결과는 동일하지만, 에러 메시지가 "A Cafe24 integration for mall_id ... already exists in this workspace"(SQL 경로)로 달라져 "public app과의 충돌"임을 사용자에게 명시하지 못한다.
  - 제안: public ↔ private 교차 중복 케이스를 in-memory 체크에서도 잡으려면 `app_type` 필터를 제거하거나, SQL UNIQUE 위반 메시지를 더 구체적으로 분기 처리. 현재 동작(409 반환)은 올바르므로 즉각 차단 불필요.

---

### 요약

`install_token_issued_at` (V044) 과 `mall_id` plain 컬럼 (V045) 구현은 Rationale 에 기록된 모든 설계 결정을 정확히 따른다. COALESCE 스캐너 fallback, in-memory 사전 체크 + SQL UNIQUE 이중 방어, 23505 → 409 변환, callback 성공 시 `installToken`·`installTokenIssuedAt` 동시 클리어, backfill 전략 모두 기각된 대안(O(N) decrypt 스캔, 삭제 전이)을 재도입하지 않고 Rationale 원칙을 충실히 구현하고 있다. 경미한 INFO 하나(public ↔ private 교차 중복의 in-memory 체크 미커버)가 있으나 SQL UNIQUE backstop이 동작을 보장하므로 실질적 위험은 없다.

### 위험도

**LOW**