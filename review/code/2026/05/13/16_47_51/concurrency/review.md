### 발견사항

- **[INFO]** `record()` 호출이 주 트랜잭션 외부에 존재
  - 위치: `auth.service.ts` — `registerWithInvitation()`, `verifyEmail()` 등 트랜잭션 블록 이후
  - 상세: `dataSource.transaction(...)` 이 커밋된 뒤 `await record()` 가 실행된다. 트랜잭션 성공 → `record()` DB 크래시 시나리오에서 감사 로그 누락이 가능하다. 단, `record()` 는 내부에서 예외를 삼키므로 인증 흐름에는 영향이 없다.
  - 제안: 현재 설계는 의도된 트레이드오프(감사 로그 유실 가능 vs. 인증 흐름 보호)로 보인다. 감사 로그의 durability를 강화하려면 `record()` 를 트랜잭션 내부로 이동하거나 outbox 패턴을 사용할 수 있으나, 현재 요구사항 범위 밖이다.

- **[INFO]** `pruneOlderThanRetention` 의 subquery DELETE 동시성
  - 위치: `login-history.service.ts` — `pruneOlderThanRetention()`
  - 상세: `SELECT id ... LIMIT N` → `DELETE WHERE id IN (subquery)` 이중 쿼리 패턴은 두 cron 인스턴스가 동시에 실행될 경우 같은 ID 셋을 두 번 삭제 시도할 수 있다. PostgreSQL에서는 이미 삭제된 행은 `affected=0` 으로 처리되므로 데이터 손상은 없으나, 삭제된 행 카운트(`total`) 가 과소 집계될 수 있다.
  - 제안: cron 단일 실행 보장(분산 락 또는 단일 인스턴스 스케줄러)이 없다면 `total` 반환값을 모니터링 지표로 직접 신뢰하지 않는 것이 좋다. 이번 변경과 무관한 사전 존재 이슈.

- **[INFO]** `token_reuse_detected` 경로의 revoke → audit 비원자성
  - 위치: `auth.service.ts` — `refresh()` 메서드
  - 상세: `refreshTokenRepository.update(isRevoked: true)` 커밋 직후 서버가 다운되면 `token_reuse_detected` 감사 로그 누락이 가능하다. 보안 관점에서 revocation 자체는 이미 커밋되므로 토큰 재사용 방어는 유지된다.
  - 제안: 허용 가능한 트레이드오프. 변경 불필요.

---

### 요약

이번 변경의 핵심인 `void` → `await` 전환은 동시성 측면에서 **정확한 픽스**다. `void` 패턴은 TypeORM connection pool이 INSERT와 SELECT를 서로 다른 connection으로 처리할 때 visibility를 보장하지 못해 e2e 테스트에서 관찰된 race를 유발했다. `await` 로 전환함으로써 HTTP 응답이 클라이언트에 도달하기 전에 INSERT가 커밋되어, 직후의 SELECT에서 새 row가 보이도록 ordering이 확립된다. `record()` 의 내부 예외 swallow 패턴은 그대로 유지되어 `await` 전환이 인증 흐름에 새로운 실패 경로를 만들지 않는다. 발견된 INFO 항목들은 이번 변경과 무관하거나 설계상 의도된 트레이드오프이며, 새로운 동시성 결함은 도입되지 않았다.

### 위험도

**LOW**