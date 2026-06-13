# 데이터베이스(Database) Review

## 발견사항

- **[INFO]** 비밀번호 변경 flow 가 단일 트랜잭션이 아님 (다단계 쓰기)
  - 위치: `codebase/backend/src/modules/users/users.controller.ts` `changePassword` + `codebase/backend/src/modules/auth/auth.service.ts` `rotateSessionAfterPasswordChange`
  - 상세: 한 요청 안에서 (1) `users.update(passwordHash)` (2) `refresh_token` bulk revoke (3) `login_history` INSERT (4) 새 refresh_token INSERT (`generateTokens`) (5) `audit_log` INSERT 가 각각 독립 커밋된다. 단일 DB 트랜잭션으로 묶여 있지 않아, (2)~(5) 중간 실패 시 비밀번호는 이미 바뀐 채 세션 회전이 부분 적용될 수 있다.
  - 평가: 다만 이는 보안적으로 안전한 방향의 부분 실패다 — passwordHash 교체가 먼저 커밋되고 그 뒤 전 세션 revoke 가 일어나므로, 회전이 중간에 끊겨도 "비밀번호는 바뀌고 구 세션은 그대로 살아있는" 위험 구간만 존재한다. 그런데 revoke(2) 는 audit/token INSERT(3~5)보다 먼저 수행되므로 실제 노출 구간은 audit 누락 정도로 제한적이다. `audit_log.record` 는 기존 설계상 실패를 삼키는(주 동작 비차단) 구조라 의도된 best-effort 다.
  - 제안: 현 설계 의도(감사=best-effort, 보안은 fail-safe 방향)에 부합하므로 변경 필수는 아니다. 다만 비밀번호 교체 + 세션 revoke 를 강한 원자성으로 보장하려면 (1)+(2) 만이라도 `dataSource.transaction` 으로 묶는 것을 후속 고려. (현 코드베이스에 `dataSource.transaction` 사용 선례 있음 — `auth.service`)

- **[INFO]** `revokeAllFamilies` bulk UPDATE 의 인덱스 적합성 — 양호
  - 위치: `codebase/backend/src/modules/auth/sessions.service.ts:194` `refreshTokenRepository.update({ userId, isRevoked: false }, ...)`
  - 상세: WHERE 절이 `user_id = ? AND is_revoked = false`. `migrations/V002__indexes.sql:46` 의 `idx_refresh_token_user (user_id)` 가 user 당 토큰 수만큼만 스캔하도록 충분히 가지치기한다. 사용자별 활성 family 수는 소규모(디바이스 수준)라 대량 데이터 우려 없음. 추가 인덱스 불필요.

- **[INFO]** N+1 / 커넥션 / SQL 인젝션 — 해당 없음
  - 상세: 반복문 내 쿼리 없음(루프 없는 단건/단일 bulk update). 모든 DB 접근은 TypeORM repository 메서드(`update`/`findOne`/`findById`)·파라미터 바인딩이라 raw string 연결 없음. e2e 테스트(`test/users-change-password.e2e-spec.ts`)의 `db.query` 도 `$1` 파라미터 플레이스홀더 사용 — 인젝션 안전. 커넥션은 repository/DataSource 추상화가 풀을 관리, 수동 획득·해제 없음.

- **[INFO]** 스키마 변경 / 마이그레이션 — 없음
  - 상세: 본 변경은 엔티티·마이그레이션 파일을 건드리지 않는다. `audit_log.ip_address`·`login_history.family_id`·`refresh_token.is_revoked` 등 기존 컬럼을 채워 넣는 변경뿐이라 무중단 배포 lock·데이터 손실 우려 없음. DTO 변경(`PasswordChangeResultDto` success→accessToken)은 응답 형상 변경일 뿐 스키마 무관.

## 요약
이 변경은 비밀번호 변경 후 세션 회전(전 family revoke + 현재 디바이스 재발급)과 user.* 감사 이벤트에 ipAddress 를 동반시키는 리팩터링으로, 스키마·마이그레이션 변경이 전혀 없고 기존 컬럼을 채우는 쓰기뿐이다. bulk revoke 쿼리는 기존 `idx_refresh_token_user` 인덱스로 잘 가지치기되고, 모든 접근이 TypeORM 파라미터 바인딩이라 인젝션·N+1·커넥션 누수 우려가 없다. 유일하게 주목할 점은 비밀번호 변경 요청이 여러 독립 커밋(passwordHash update → token revoke → login_history → 신규 token → audit)으로 나뉘어 단일 트랜잭션이 아니라는 것이나, 쓰기 순서가 보안상 fail-safe 방향이고 audit 이 의도적 best-effort 라서 데이터 정합성 위험은 낮다.

## 위험도
LOW
