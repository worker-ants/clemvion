이제 구현 파일들과 Rationale를 비교하여 연속성 점검 결과를 작성합니다.

---

## 발견사항

- **[INFO]** `connected → error(auth_failed)` 전이 — Private 앱 Rationale 적용 범위 미명시
  - target 위치: `integration-oauth.service.ts` — `markIntegrationCallbackError()`, `status='connected'` + `OAUTH_TOKEN_EXCHANGE_FAILED` 분기
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` § Rationale — "Cafe24 Private 앱의 callback 실패는 왜 status 를 보존하나"
  - 상세: pending_install 상태 보존의 근거로 "UI 가 reauthorize 액션을 권장하지만 실제로 그 액션이 무력하다"를 명시했다. 동일 논리가 connected→error(auth_failed) 전이에도 부분적으로 적용될 수 있으나, Rationale 은 `pending_install` 케이스에 한정되어 있고 `connected` 케이스는 언급이 없다. 구현은 `connected` 상태에서 `OAUTH_TOKEN_EXCHANGE_FAILED` 시 `error(auth_failed)`로 전이한다.
  - 제안: `spec/2-navigation/4-integration.md` Rationale 에 "connected 상태의 Private 앱이 reauthorize callback 실패 시 error(auth_failed)로 전이하는 이유" — 예컨대 "connected 는 이미 한 번 인증에 성공한 상태이므로 실패가 credentials 유효성 문제를 의미하며, pending_install 과 달리 외부 install flow 중간 단계가 아님" — 를 한 문장 추가하면 의도를 명확히 고정할 수 있다. UI 에서 Private 앱 error 상태의 reauthorize 버튼 비활성 여부도 併記 권장.

---

나머지 주요 결정들은 구현과 완전히 정합합니다:

| Rationale 결정 | 구현 상태 |
|---|---|
| `COALESCE(install_token_issued_at, created_at)` fallback (V044) | 스캐너 SQL에서 정확히 사용 ✓ |
| 재사용(change 3) 시 `installTokenIssuedAt=now` 갱신 | `createPrivatePendingIntegration` 에서 적용 ✓ |
| callback 성공 시 `installToken=null`, `installTokenIssuedAt=null` | `handleCallback` 에서 처리 ✓ |
| `(workspace_id, mall_id) WHERE service_type='cafe24' AND mall_id IS NOT NULL` 부분 UNIQUE | V045 migration 일치 ✓ |
| begin 핸들러 in-memory scheck + `credentials.mall_id` fallback (전환기) | 서비스 구현 일치 ✓ |
| `23505` constraint violation → 409 변환 | catch 블록 구현 ✓ |
| `status_reason` snake_case 저장 (`errorCode.toLowerCase()`) | 구현 일치 ✓ |
| pending_install callback 실패 → status 보존, status_reason+last_error 만 갱신 | `markIntegrationCallbackError` 일치 ✓ |
| callback backfill: pre-V045 NULL 행에 mallId 채움 | `handleCallback` backfill 로직 ✓ |
| `executeInTransaction=false` (CONCURRENT index) | V045.conf 일치 ✓ |

---

## 요약

V044(`install_token_issued_at`)와 V045(`mall_id` plain 컬럼) 구현은 Rationale 에 명시된 모든 결정 — TTL COALESCE fallback, 재사용 시 timestamp 갱신, callback 성공 시 NULL 처리, 부분 UNIQUE 인덱스, 전환기 in-memory fallback, 23505 변환, status_reason snake_case — 을 정확히 따르고 있다. 유일한 미명시 영역은 Cafe24 Private 앱의 `connected → error(auth_failed)` 전이로, pending_install 보존의 근거 논리가 부분 적용될 수 있음에도 Rationale 에 케이스 설명이 없다. 별도 차단 사유는 없으며 INFO 수준의 문서 보완으로 충분하다.

## 위험도

**LOW**