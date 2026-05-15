### 발견사항

- **[WARNING]** `auth_oauth_state.state` 컬럼 인덱스 누락 가능성
  - 위치: `auth-oauth.service.ts` — `handleCallback` 내 raw SQL
  - 상세: `DELETE FROM auth_oauth_state WHERE state = $1 AND expires_at > NOW() RETURNING *` 쿼리가 `state` 컬럼으로 필터링하는데, 해당 컬럼에 인덱스가 없으면 테이블 풀스캔이 발생한다. OAuth 콜백은 latency-sensitive한 경로이므로 영향이 크다.
  - 제안: 엔티티 또는 마이그레이션에서 `@Index()` 또는 `CREATE UNIQUE INDEX ON auth_oauth_state(state)` 추가 (state 값은 cryptographic random이므로 유니크 인덱스 적합)

- **[INFO]** `auth_oauth_state.expires_at` 인덱스 누락 가능성
  - 위치: `auth-oauth.service.ts` — `purgeExpired`
  - 상세: `stateRepository.delete({ expiresAt: LessThan(new Date()) })` 는 `expires_at` 컬럼으로 필터링한다. fire-and-forget(`void`)으로 호출되므로 즉각적인 영향은 없지만, 테이블이 커질수록 cleanup 쿼리 비용이 증가한다.
  - 제안: `expires_at` 컬럼에 인덱스 추가. 단, 만료 row가 지속적으로 purge된다면 hot range 문제가 생기지 않으므로 partial index(`WHERE expires_at < now()`)도 고려할 수 있다.

- **[INFO]** `resolveUser`의 조건부 UPDATE가 트랜잭션 바깥에 있음
  - 위치: `auth-oauth.service.ts` — `resolveUser` 내 QueryBuilder update
  - 상세: `findByEmail` → 조건부 `UPDATE ... WHERE oauth_provider IS NULL` → `findById` 패턴이 트랜잭션 없이 실행된다. 동일 이메일 계정으로 두 개의 OAuth 요청이 동시에 들어오면 두 요청 모두 `findByEmail`에서 `oauth_provider IS NULL`인 row를 읽고 UPDATE를 시도한다. UPDATE의 WHERE 조건 덕분에 두 번째 UPDATE는 no-op이 되므로 데이터 무결성은 유지되지만, 두 요청 모두 같은 user를 반환하게 되어 어느 provider가 바인딩되었는지는 race 결과에 따라 결정된다. 현재 설계 의도(comment에서 언급)와 일치하는 동작이므로 Critical은 아니나, 의도된 동작임을 문서화하는 것이 좋다.
  - 제안: 코드 주석에 "last-write-wins race is intentional; the conditional WHERE ensures exactly one provider binding" 정도를 명시하거나, 완전한 원자성이 필요하다면 `SELECT ... FOR UPDATE`를 트랜잭션 안에서 사용.

- **[INFO]** 파라미터화된 raw SQL — SQL 인젝션 없음 (양호)
  - 위치: `handleCallback`의 `$1` 바인딩
  - 상세: `state` 값이 사용자 입력이지만 positional parameter `$1`로 바인딩되어 있어 SQL 인젝션 위험 없음.

---

### 요약

변경된 코드 중 데이터베이스 관련 로직은 `auth-oauth.service.ts`에 집중되어 있다. 전반적으로 atomic DELETE+RETURNING 패턴으로 race condition을 방지하고, 신규 유저 생성은 트랜잭션으로 묶는 등 설계가 적절하다. 주요 리스크는 `auth_oauth_state.state` 컬럼의 인덱스 존재 여부로, 없을 경우 콜백 처리 경로에서 풀스캔이 발생할 수 있다. 나머지는 정보성 수준이며 운영 초기에는 영향이 미미하지만 인덱스 추가를 권장한다. 프론트엔드·컨트롤러·스펙 파일은 데이터베이스와 무관하다.

### 위험도
**LOW**