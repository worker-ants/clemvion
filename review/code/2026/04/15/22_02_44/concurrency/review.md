### 발견사항

- **[WARNING]** 신규 OAuth 사용자 동시 생성 시 경쟁 조건
  - 위치: `auth-oauth.service.ts` → `resolveUser()` (트랜잭션 블록)
  - 상세: 동일 이메일에 대해 두 개의 OAuth 콜백 요청이 동시에 도착할 경우, 두 요청 모두 `findByOauth` → null, `findByEmail` → null을 통과하고 각자 트랜잭션에서 사용자 생성을 시도한다. 선행 트랜잭션이 커밋되면 후속 트랜잭션은 이메일 유니크 제약 위반으로 실패하며, 이 오류가 그대로 전파되어 500 응답이 반환된다.
  - 제안: 트랜잭션 catch 블록에서 `unique constraint` 오류를 감지하여 재시도 또는 해당 사용자를 조회 후 반환하는 로직 추가:
    ```ts
    } catch (err) {
      if (isUniqueViolation(err)) {
        const existing = await this.usersService.findByEmail(profile.email);
        if (existing) return existing;
      }
      throw err;
    }
    ```

- **[INFO]** `void this.purgeExpired()` 미await 호출
  - 위치: `auth-oauth.service.ts` → `beginAuth()` 내
  - 상세: 동시 요청이 많으면 DB에 여러 병렬 purge 쿼리가 발생한다. 각 쿼리는 같은 만료 행을 대상으로 하므로 멱등적이고 데이터 정합성 문제는 없으나, 불필요한 DB 부하를 초래할 수 있다.
  - 제안: 현재 설계(fire-and-forget)는 허용 가능한 트레이드오프이나, 실행 주기를 제한하려면 스케줄러(`@nestjs/schedule`)를 활용하는 것이 더 적합하다.

- **[INFO]** 테스트 내 `process.env` 직접 변이 — 격리 불완전
  - 위치: `auth-oauth.service.spec.ts` → `getEnabledProviders` describe 블록
  - 상세: 각 테스트가 `process.env`를 직접 변이하지만 `afterEach`에서 복원하지 않는다. 현재는 `beforeEach`가 주요 변수를 덮어쓰므로 순차 실행에서는 문제가 없다. 그러나 향후 Jest `--runInBand` 옵션 없이 파일 간 병렬 실행 시, 동일 Worker 내에서 `process.env` 상태 충돌 가능성이 있다.
  - 제안: `afterEach`에서 테스트에서 사용한 env 키를 명시적으로 복원하거나, `jest.spyOn(process, 'env', 'get')`으로 모킹하는 방식 권장.

---

### 요약

전반적으로 동시성 설계는 양호하다. OAuth state 소비에 원자적 `DELETE ... RETURNING` 쿼리를 사용하고, 이메일 계정 연동 시 `AND oauth_provider IS NULL` 조건부 UPDATE로 중복 바인딩을 방지한 점은 올바른 설계다. 주요 위험은 신규 사용자 동시 생성 경로에서 유니크 제약 위반이 처리되지 않아 발생할 수 있는 500 오류이며, 실제 트래픽에서는 동일 신규 사용자의 동시 OAuth 콜백이 드물지만 방어 코드를 추가하는 것이 바람직하다. 나머지 항목은 운영 영향이 미미한 INFO 수준이다.

### 위험도

**LOW**