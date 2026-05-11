### 발견사항

---

**[WARNING] `loginHistory.record()` 를 인증 핫 패스에서 `await` 처리**
- 위치: `auth.service.ts` — `login()`, `verifyEmail()`, `loginWithTotp()`, `logout()`, `refresh()`, `issueTokensForOauthUser()`
- 상세: 각 인증 성공·실패 분기에서 `await this.loginHistory.record(...)` 를 호출한 뒤 토큰 또는 예외를 반환한다. `record()` 내부는 예외를 삼키도록(`try/catch`) 설계되어 있으므로 반환값·실패 여부가 호출자의 제어 흐름에 영향을 주지 않는다. 그럼에도 매번 `await` 하면 DB INSERT 완료까지 응답 지연이 발생한다. 로그인 실패 경로에서는 예외를 던지기 *전* 에도 awaiting 하므로 오류 응답 지연까지 동반된다.
- 제안: `record()` 호출부를 `void this.loginHistory.record(...)` (fire-and-forget)로 교체한다. 로그 기록 실패가 이미 warn 수준 로깅으로 충분히 처리되므로 호출자가 대기할 이유가 없다.

---

**[WARNING] `pruneOlderThanRetention` — LIMIT 없는 대량 DELETE**
- 위치: `login-history.service.ts:94-101`, `jobs/login-history-pruner.service.ts`
- 상세: `repository.delete({ createdAt: LessThan(cutoff) })` 는 조건에 해당하는 모든 행을 단일 트랜잭션으로 삭제한다. 서비스가 수개월 운영된 뒤 수십만 행이 누적되면 단번에 삭제 시 row-level lock 경합, WAL 팽창, autovacuum 지연이 발생한다.
- 제안: DELETE를 배치 루프로 교체한다.
  ```typescript
  let total = 0;
  const BATCH = 1000;
  let deleted: number;
  do {
    const res = await this.dataSource.query(
      `DELETE FROM login_history WHERE id IN (
         SELECT id FROM login_history WHERE created_at < $1 LIMIT $2
       )`,
      [cutoff, BATCH],
    );
    deleted = res[1]; // affected
    total += deleted;
  } while (deleted === BATCH);
  return total;
  ```

---

**[WARNING] `listActiveSessions` — 두 번의 순차적 DB 왕복**
- 위치: `sessions.service.ts:44-60`
- 상세: `find(...)` 로 활성 토큰 전체를 로드한 뒤, `currentRefreshToken` 이 있으면 `resolveCurrentFamilyId()` 에서 `findOne({ where: { tokenHash: hash } })` 를 별도로 호출한다. 두 쿼리는 독립적이므로 직렬 실행이 불필요한 왕복을 만든다.
- 제안: `Promise.all` 로 병렬 실행하거나, 첫 번째 `find` 에 해당 hash를 조건으로 추가해 단일 쿼리로 합친다.
  ```typescript
  const [rows, currentRow] = await Promise.all([
    this.refreshTokenRepository.find({ where: { ... }, order: { createdAt: 'DESC' } }),
    currentRefreshToken
      ? this.refreshTokenRepository.findOne({ where: { tokenHash: hash, isRevoked: false } })
      : Promise.resolve(null),
  ]);
  ```

---

**[WARNING] `listActiveSessions` — 페이지네이션 없는 전체 조회**
- 위치: `sessions.service.ts:44-55`
- 상세: `find({ where: { userId, isRevoked: false, expiresAt: MoreThan(...) } })` 에 LIMIT이 없다. refresh 회전 주기가 짧거나 보존 정책이 느슨하면 단일 사용자의 행이 수백~수천 개에 달할 수 있고, 전체를 메모리에 적재해 family 단위로 그룹핑한다. 정상 사용 패턴에서는 문제가 없지만, 클라이언트에서 노출할 세션 수는 십수 개 이하이므로 불필요한 메모리 할당이다.
- 제안: DB에서 `DISTINCT ON (family_id)` 또는 서브쿼리로 family별 최신 1개만 조회하도록 변경하면 메모리 적재량과 인-메모리 그룹핑 로직을 모두 제거할 수 있다.

---

**[INFO] `getLoginHistory` — null 폴백 시 매 행마다 `deriveDeviceLabel` 재실행**
- 위치: `sessions.controller.ts:185`
- 상세: `row.deviceLabel ?? deriveDeviceLabel(row.userAgent)` — `record()` 에서 이미 `deviceLabel` 을 파생·저장하므로 null이 되는 경우는 레거시 행 또는 저장 실패뿐이다. 정상 경로에서는 실행되지 않으므로 실질적 영향은 미미하나, 폴백 호출 비용이 없도록 `LoginHistoryService.record()` 가 항상 `deviceLabel` 을 채우도록 보장하면 컨트롤러에서 폴백을 제거할 수 있다.

---

**[INFO] 프런트엔드 — `flatMap` 이 매 렌더마다 새 배열 생성**
- 위치: `login-history-list.tsx:57`
- 상세: `query.data?.pages.flatMap((p) => p.data) ?? []` 가 `useMemo` 없이 렌더마다 실행된다. 무한 스크롤로 페이지가 누적될수록 비용이 증가한다.
- 제안: `const items = useMemo(() => query.data?.pages.flatMap((p) => p.data) ?? [], [query.data]);`

---

**[INFO] 프런트엔드 — 세션 쿼리에 `staleTime` 미설정**
- 위치: `sessions-panel.tsx:56-59`
- 상세: `staleTime` 이 없으면 컴포넌트가 언마운트→마운트될 때마다 백그라운드 refetch가 발생한다. 세션 목록은 실시간성이 낮아 30~60초 stale이 허용된다.
- 제안: `staleTime: 30_000` 추가.

---

### 요약

전반적으로 설계는 견고하다. 인덱스는 쿼리 패턴에 적합하게 배치되어 있고, cursor 기반 페이지네이션과 180일 보존 정책도 적절하다. 가장 시급한 성능 위험은 두 가지다. 첫째, 로그인·갱신 등 인증 핫 패스에서 `loginHistory.record()` 를 `await` 해 불필요한 응답 지연을 유발하는 것으로, fire-and-forget으로 전환하면 즉시 개선된다. 둘째, 보존 기간 초과 행 삭제가 LIMIT 없는 단일 DELETE로 구현되어 있어 운영 초기에는 무해하나 데이터가 누적되면 DB lock 부담이 된다. `listActiveSessions` 의 이중 왕복 쿼리와 페이지네이션 부재는 일반적인 세션 수(~10개)에서는 무시할 수준이지만 장기적으로는 개선할 가치가 있다.

### 위험도

**MEDIUM**