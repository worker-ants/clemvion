# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] resend 엔드포인트 응답 바디 구조 미검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L116 (`resend → 200` 테스트)
- 상세: `POST /api/users/me/email-change/resend` 성공 시 `res.status === 200` 만 검증하고 응답 바디 구조(`res.body`)를 전혀 검증하지 않는다. 다른 엔드포인트(request: 200 바디 미검증, verify: `res.body.data.accessToken` 검증, cancel: 200 바디 미검증)도 동일 패턴이지만, 이번 변경에서 새로 추가된 resend 케이스는 바디 형식을 한 번도 명시하지 않아 API 계약상 resend 성공 응답 shape 가 테스트 레벨에서 확정되지 않는다. 비차단이지만 다른 클라이언트가 성공 응답에서 특정 필드를 기대할 경우 회귀 탐지 불가.
- 제안: `expect(res.body).toHaveProperty('data')` 또는 `{ message }` 등 최소 형식 단언 추가 권장. 기존 cancel 테스트와 일관성을 맞추거나 spec의 응답 shape 를 테스트로 고정.

### [INFO] verify race 테스트에서 409 응답 바디 외 accessToken 미반환 단언 누락
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L141–177 (`verify 시점 신규 이메일 선점 → 409`)
- 상세: 409 케이스에서 `res.body.error.code === 'RESOURCE_CONFLICT'` 는 확인하지만, 응답에 `accessToken` 이나 새 refresh 쿠키가 **없음** 을 단언하지 않는다. 409 시 세션 재발급이 일어나지 않아야 한다는 계약이 테스트에 명시되어 있지 않아, 서비스 레이어 버그로 세션이 잘못 발급되더라도 이 테스트를 통과한다.
- 제안: `expect(res.body.data).toBeUndefined()` 또는 `expect(res.headers['set-cookie']).toBeUndefined()` 단언 추가 고려.

### [INFO] resend 응답의 만료 시각 갱신 단언 없음
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L118–128 (`resend → 200` 테스트)
- 상세: `after.rows[0].email_change_token` 이 변경됨을 검증하지만 `email_change_expires_at` 가 실제로 갱신됐는지는 검증하지 않는다. spec §1.1.B "pending 으로 재발송(토큰 재발급)"에는 만료 시각도 재발급되어야 함이 묵시적이다. `before.email_change_expires_at` 와 `after.email_change_expires_at` 비교가 있으면 API 계약이 더 완전하게 고정된다.
- 제안: `expect(after.rows[0].email_change_expires_at).not.toBe(before.rows[0].email_change_expires_at)` 단언 추가.

### [INFO] 프론트엔드 verify 페이지 테스트의 API 응답 구조 중첩 확인
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L545
- 상세: 성공 mock 이 `{ data: { data: { accessToken: "new-AT" } } }` 형태로 중첩 `data.data.accessToken` 구조를 사용한다. 이는 axios 응답 래퍼(`res.data`) + API 응답 바디(`{ data: { accessToken } }`) 이중 구조이며, 실제 백엔드 verify 응답 shape 가 `{ data: { accessToken: string } }` 임을 의미한다. 백엔드의 다른 엔드포인트 응답 래핑 패턴과 일치하는지 확인이 필요하다. 구조 자체는 e2e 테스트(L306: `res.body.data.accessToken`)와 일치하므로 현재는 정합.
- 제안: 별도 조치 불필요. 향후 응답 shape 변경 시 두 테스트 모두 수정 필요함을 인지.

---

## 요약

이번 변경은 신규 API 엔드포인트(`/resend`, `/verify` race 경로)를 추가하는 것이 아니라, 이미 구현된 엔드포인트에 대한 **E2E 테스트 케이스 3개와 단위 테스트 2개를 추가**한 것이다. API 계약 관점에서 breaking change, 버전 변경, 스키마 변경은 전혀 없다. 신규 테스트들은 spec §1.1.B 의 resend·race condition 계약을 실제 HTTP 레벨에서 검증하며, 에러 응답 코드(`VALIDATION_ERROR`, `RESOURCE_CONFLICT`)·HTTP 상태 코드(400, 409)·DB 상태 변화를 올바르게 단언한다. 다만 resend 성공 응답 바디 shape 단언 누락, 409 시 세션 미발급 단언 누락, resend 만료 시각 갱신 단언 누락 등 API 계약을 더 엄밀히 고정할 수 있는 세 가지 INFO 수준 개선 여지가 있다. SQL 마이그레이션(인덱스)과 plan/프론트엔드 단위 테스트는 API 계약과 직접 무관하다.

## 위험도

LOW
