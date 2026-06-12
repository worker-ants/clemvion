# Testing 관점 코드 리뷰

## 발견사항

### 파일 1 & 2: execution-failure-classifier.spec.ts / execution-failure-classifier.ts

- **[INFO]** `DB_HOST_BLOCKED` → `executionFailedInternal` 분류 테스트 중복
  - 위치: `execution-failure-classifier.spec.ts` lines 174–186 및 lines 190–198
  - 상세: `it.each` 배열에 `DB_HOST_BLOCKED` 가 이미 포함되어 있고(line 175), 바로 아래 별도 `it` 케이스에서도 같은 코드로 동일한 `key` 를 검증한다. `it.each` 의 각 케이스는 독립적으로 실행되므로 기능적으로 중복이다.
  - 제안: 별도 `it` 케이스가 추가하는 고유 가치(warn 로그 미발생 단언)는 정당하나, `it.each` 배열에서 `DB_HOST_BLOCKED` 를 제거하고 별도 케이스에서 key + warn 로그 양쪽을 모두 검증하거나, 반대로 `it.each` 에는 유지하고 별도 케이스에서는 warn 로그 단언만 남겨 의도를 분리한다.

- **[INFO]** warn spy 격리 패턴
  - 위치: `execution-failure-classifier.spec.ts` lines 47–53
  - 상세: `Logger.prototype.warn` 에 spy 를 씌우고 `mockRestore()` 로 복원하는 패턴은 동일 파일 내 다른 describe 블록(`Unknown fallback`, `W#5`)에서도 동일하게 사용된다. `beforeEach` 에서 공통 spy 초기화를 하지 않고 케이스별로 생성/복원하므로 테스트 간 간섭 위험은 없다. 적절하다.

---

### 파일 4: database-query.handler.spec.ts (SSRF 가드 블록 추가)

- **[WARNING]** MySQL 드라이버에 대한 `DB_HOST_BLOCKED` 경로 테스트 누락
  - 위치: `database-query.handler.spec.ts` — `SSRF host guard` describe 블록
  - 상세: `pgIntegrationWithHost` 헬퍼는 `driver: 'postgres'` 로 고정되어 있어 모든 `it.each` 케이스가 PostgreSQL 경로만 검증한다. `database-query.handler.ts` 의 SSRF 가드 코드는 드라이버 분기(`driver = creds.driver ?? 'postgres'`) 이전에 실행되므로 MySQL 에서도 동일하게 차단되어야 하는데, MySQL credential 로 private host 를 시도하는 테스트가 없다.
  - 제안: `pgIntegrationWithHost` 와 대응하는 `mysqlIntegrationWithHost` 헬퍼를 추가하고 `it.each` 에 MySQL 케이스(최소 1개, e.g. `127.0.0.1`)를 포함시킨다.

- **[WARNING]** `ALLOW_PRIVATE_HOST_TARGETS` env-mutation 의 병렬 실행 간섭 가능성
  - 위치: `database-query.handler.spec.ts` lines 744–765
  - 상세: `process.env.ALLOW_PRIVATE_HOST_TARGETS = 'true'` 를 `try/finally` 로 복원하는 패턴은 동일 프로세스 내 테스트 간 격리는 보장하나, Jest 워커 격리(`--workers` 기본값)가 파일 단위이면 같은 워커 안 다른 파일이 같은 env key 를 읽을 수 있다. `execute` 가 비동기라 Promise resolve 전에 다른 코루틴이 env 를 읽을 가능성은 낮지만, 명시적 격리 보장이 없다.
  - 제안: `process.env` mutation 테스트에 `jest.isolateModules` 를 적용하거나, 해당 describe 블록을 `--runInBand` 실행되는 별도 파일로 분리한다. 단, 현재 프로젝트 Jest 설정이 워커 격리를 파일 단위로 보장한다면 현 수준으로 충분하다.

- **[INFO]** `connectMock` not-called 단언
  - 위치: `database-query.handler.spec.ts` line 733
  - 상세: 가드가 pool 연결 전에 실행됨을 `expect(connectMock).not.toHaveBeenCalled()` 로 명시적으로 검증한다. `beforeEach` 에서 `connectMock.mockReset()` 이 호출되므로 테스트 간 격리도 정확하다. 적절하다.

- **[INFO]** 차단 메시지 host 미노출 단언
  - 위치: `database-query.handler.spec.ts` line 730
  - 상세: `expect(out.output.error.message).not.toContain(host)` 와 `expect(out.output.error.message).toMatch(/SSRF policy/i)` 로 보안 요구사항(정찰 면 축소)을 검증한다. spec 코멘트가 `literal IP/localhost fast-path` 를 명시하므로 DNS resolve 없이 결정론적으로 동작한다. 적절하다.

- **[INFO]** `logUsage` DB_HOST_BLOCKED 단언
  - 위치: `database-query.handler.spec.ts` lines 735–740
  - 상세: 활동 로그에 `{ status: 'failed', error: { code: 'DB_HOST_BLOCKED' } }` 가 기록됨을 검증한다. 서버 로그에 차단 상세가 남는다는 spec 요구사항을 커버한다. 적절하다.

---

### 파일 3: error-codes.ts

- **[INFO]** `ErrorCode.DB_HOST_BLOCKED` 에 대한 별도 단위 테스트 불필요
  - 위치: `error-codes.ts`
  - 상세: const 객체의 literal 값 추가는 TypeScript 타입 시스템이 보호하며, 소비 측(handler/classifier) 테스트에서 `'DB_HOST_BLOCKED'` 문자열이 실제로 흐르는지 검증된다. 별도 테스트 추가가 필요하지 않다.

---

## 요약

`DB_HOST_BLOCKED` 신설에 대한 테스트 커버리지는 전반적으로 충실하다. `execution-failure-classifier.spec.ts` 에서는 INTERNAL_CODES 등재 확인과 warn 로그 미발생 단언이 추가되었으며, `database-query.handler.spec.ts` 에서는 IPv4 loopback·RFC1918·IMDS·localhost 의 4개 교차 케이스와 opt-out 케이스가 포함된다. 보안상 핵심인 host 미노출 단언과 DB 연결 미발생 단언도 올바르게 포함되어 있다. 다만 MySQL 드라이버에 대한 `DB_HOST_BLOCKED` 경로 테스트가 없어 드라이버 독립성을 검증하지 못하며(WARNING), env-mutation 의 병렬 실행 간섭 가능성이 있고(WARNING), `it.each` 와 별도 `it` 에서의 key 단언 중복 정리가 필요하다(INFO).

## 위험도

LOW
