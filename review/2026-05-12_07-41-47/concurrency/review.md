## 발견사항

### [WARNING] `refresh()` 내 TOCTOU 경쟁 조건
- **위치**: `auth.service.ts` — `refresh()` 메서드 전체 흐름
- **상세**: 동일 refresh token으로 동시에 두 요청이 도달하면:
  1. A, B 모두 `findOne` → `isRevoked = false` 확인 (통과)
  2. A가 `update(isRevoked: true, lastUsedAt, lastUsedIp)` 수행
  3. B도 동일한 update 수행 (이미 revoke된 row, no-op)
  4. A, B 모두 `generateTokens()`를 호출해 **같은 family에 새 토큰 2개 발급**

  이번 PR에서 `lastUsedAt`/`lastUsedIp` 업데이트가 추가되면서 비원자적 섹션이 길어졌다. 재사용 감지 로직이 실질적으로 작동하려면 `SELECT ... FOR UPDATE` 또는 낙관적 잠금이 필요하다.
- **제안**:
  ```sql
  -- 방법 1: SELECT FOR UPDATE (Repository 패턴에서는 queryRunner 사용)
  await queryRunner.manager
    .createQueryBuilder()
    .setLock('pessimistic_write')
    .where({ tokenHash })
    .getOne();

  -- 방법 2: UPDATE ... WHERE is_revoked = false RETURNING *
  -- 갱신 성공 여부로 reuse 판단 (원자적)
  ```

---

### [WARNING] `LoginHistoryPrunerService` 다중 인스턴스 동시 실행
- **위치**: `jobs/login-history-pruner.service.ts` — `@Cron(CronExpression.EVERY_DAY_AT_3AM)`
- **상세**: `@nestjs/schedule`은 기본적으로 모든 프로세스 인스턴스에서 cron을 실행한다. 수평 스케일아웃 시 새벽 3시에 N개 인스턴스가 동시에 `DELETE WHERE created_at < cutoff`를 실행한다. DELETE 자체는 멱등하므로 데이터 손상은 없으나, 불필요한 DB 락 경합과 I/O 중복이 발생한다.
- **제안**: 분산 잠금(예: Redis `SET NX EX`) 적용 또는 단일 워커 전용 인스턴스에서만 실행되도록 환경 플래그 제어. 단일 서버 배포라면 현재 설계로 충분하다.

---

### [WARNING] `revokeFamily()` / `revokeOtherFamilies()` 비트랜잭셔널 시퀀스
- **위치**: `sessions.service.ts` — `revokeFamily()`, `revokeOtherFamilies()`
- **상세**: `verifyReauth()` → `repository.update(isRevoked: true)` → `loginHistory.record()` 세 단계가 트랜잭션으로 묶이지 않았다. `update` 성공 후 프로세스가 재시작되면 revoke는 적용됐지만 `session_revoked` 이력 레코드가 누락된다. `loginHistory.record()`가 예외를 삼키므로 유실 여부조차 감지되지 않는다.
- **제안**: 보안 감사 목적이 강한 이벤트(`session_revoked`, `token_reuse_detected`)는 `loginHistory.record()`의 `catch` 블록을 **WARN 로그 + 무시** 대신 `ERROR` 수준으로 올리거나, DataSource 트랜잭션 안에서 같이 커밋하도록 변경.

---

### [INFO] `pruneOlderThanRetention()` 대량 단일 DELETE
- **위치**: `login-history.service.ts:97-101`
- **상세**: 서비스가 장기간 운영된 후 처음 pruner가 실행되면 수십만~수백만 row를 단일 `DELETE` 구문으로 처리할 수 있다. PostgreSQL은 삭제 대상 row에 대해 Row-level lock을 취득하므로 해당 사용자의 `findForUser` 쿼리 응답 지연이 발생할 수 있다.
- **제안**: 배치 크기 제한 루프 적용 (`DELETE ... LIMIT 1000` 반복) 또는 초기 운영 시 수동 백필 후 점진적 전환.

---

### [INFO] `loginHistory.record()` fire-and-forget 설계 — 보안 이벤트 유실 가능
- **위치**: `login-history.service.ts:47-62`, `auth.service.ts` 전반
- **상세**: `record()`는 DB 저장 실패를 `WARN` 로그로 삼키고 인증 흐름을 계속 진행한다. 설계 의도(`인증 흐름을 막아서는 안 됨`)는 이해되나, `token_reuse_detected` 같은 보안 이상 이벤트까지 조용히 유실되면 침해 탐지에 맹점이 생긴다.
- **제안**: 이벤트 유형별로 `swallow` 여부를 구분하는 옵션 파라미터 추가 검토 (`critical: true`면 예외 re-throw).

---

## 요약

이번 PR에서 가장 주목할 동시성 위험은 **`refresh()` 내 TOCTOU 패턴**이다. 재사용 감지 후 revoke → 신규 토큰 발급 사이가 원자적으로 보호되지 않아, 극히 드물지만 동시 요청 시 동일 family에 토큰이 중복 발급될 수 있다. 두 번째로 **수평 확장 시 pruner 중복 실행** 문제가 있으나 현재 단일 서버 운영이라면 즉각적 위험은 없다. 나머지 지적사항은 가용성·감사 일관성 관련으로, 서비스 동작 자체를 깨지는 않는다.

## 위험도

**MEDIUM**