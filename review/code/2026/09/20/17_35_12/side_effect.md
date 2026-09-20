# 부작용(Side Effect) 리뷰 — rotate lost update 수정

## 발견사항

- **[WARNING] e2e 테스트가 락 트랜잭션을 try/finally 로 보호하지 않는다 — 중간 단언 실패 시 커밋되지 않은 트랜잭션과 미대기(unawaited) 요청이 남는다**
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts:80`-`122` (`locker.query('BEGIN')` ~ `locker.query('COMMIT')`)
  - 상세: `locker` 커넥션은 74번째 줄의 `it(...)` 블록 전체에 걸쳐 `BEGIN` 으로 트랜잭션을 열고(80줄) `SELECT … FOR UPDATE` 로 행 락을 쥔 뒤(81-83줄), 그 사이에 `expect(raced.settled).toBe(false)`(113줄) 를 포함한 여러 단언을 통과해야 122줄의 `COMMIT` 에 도달한다. 이 구간의 **어떤 단언이라도 실패하면** 예외가 던져져 `COMMIT`/`ROLLBACK` 없이 `it` 콜백이 즉시 종료된다. `locker` 는 `describe` 블록 전체에서 재사용되는 단일 커넥션이고 `afterAll`(48-51줄)에서만 `locker.end()` 로 닫히므로, 그 사이 이 커넥션은 미종결 트랜잭션인 채로 행 락을 계속 쥔다. 동시에, 락에 막혀 대기 중이던 `pending`(91-94줄, `rotateB` 프라미스)은 `afterAll` 이 이를 `await` 하지 않으므로 테스트 프로세스 종료 시 응답이 정리되지 않은 채로 남는다(Jest "open handle" 경고 또는 서버 측 요청 잔존으로 이어질 수 있음).
  - 참고: 같은 저장소의 선례 `codebase/backend/test/trigger-config-lost-update.e2e-spec.ts` 도 동일하게 `try/finally` 없이 `BEGIN`~`COMMIT` 을 감싸는 스타일이라(217줄 `COMMIT`), 이번 PR 이 처음 도입한 패턴은 아니다. 다만 같은 형태가 두 번째로 반복되며 표준 패턴처럼 굳어지고 있어, 인접 테스트가 잦아질수록 CI 에서 실패한 테스트 하나가 DB 커넥션/락을 오래 붙잡는 부작용이 누적될 수 있다.
  - 제안: `BEGIN` 이후 구간을 `try { ... } finally { await locker.query('ROLLBACK').catch(() => undefined); }` 로 감싸(성공 경로에서는 `finally` 전에 이미 `COMMIT` 이 수행되었으므로 `ROLLBACK` 은 no-op), 실패 시에도 락이 즉시 풀리고 `pending` 도 `finally` 안에서 `await` 하거나 최소한 `.catch()` 로 드레인하도록 한다.

- **[INFO] `IntegrationsService` 생성자 시그니처 변경 — 영향 범위 확인**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:434` (`private readonly dataSource: DataSource,` 추가, 9번째 위치 인자)
  - 상세: NestJS DI 로 관리되는 `@Injectable()` 클래스라 실제 런타임 조립은 컨테이너가 하므로 프로덕션 경로에는 영향이 없다. `DataSource` 는 별도 모듈 provider 등록 없이도 주입 가능한 전역 TypeORM 토큰이며, 같은 모듈의 `IntegrationOAuthService`(`integration-oauth.service.ts:338`) 가 이미 같은 방식으로 주입받고 있어 새 provider 등록이 필요 없음을 확인했다. 저장소 전체에서 `new IntegrationsService(` 로 직접 생성하는 곳은 `integrations.service.spec.ts:180` 뿐이며, 해당 diff 에서 `dataSource` mock(116줄 `let dataSource: { transaction: Mock };`, 171-178줄 초기화, 189줄 생성자 인자 추가)이 함께 갱신되어 일관성이 있다.
  - 제안: 조치 불요 — 확인 목적의 기록.

- **[INFO] 임계 구간에 신규 DB 트랜잭션 + row-level 락 도입(설계상 의도된 부작용)**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:1146`-`1209` (`this.dataSource.transaction(async (manager) => { ... })`)
  - 상세: 기존에는 `rotate()` 가 단일 `update()`/`findOne()` 호출만 했으나, 이제 `pessimistic_write` 행 락을 쥔 트랜잭션이 새로 열린다. 외부 HTTP/DB 연결 테스트(`dispatchTest`, 1120-1130줄)는 트랜잭션 **밖**에서 이미 끝난 뒤 호출되는 것을 확인했고(락 안에서는 `validateCredentials` 같은 순수 함수만 실행), 락 대기 상한도 의도적으로 두지 않았다(주석 1141줄). 동시 `rotate()` 호출이 잦은 통합에서는 이 락으로 인해 요청이 직렬화·대기하는 새로운 지연이 생기지만, 이는 PR 이 명시적으로 의도·검토한 트레이드오프(`plan/in-progress/rotate-lost-update.md` §B, `/consistency-check --impl-prep` INFO 2)이며 숨겨진 부작용은 아니다.
  - 제안: 조치 불요 — 설계 의도와 일치함을 확인.

- **[INFO] 관련 없는 plan 파일의 drive-by 수정 (범위 외 변경, 문서화됨)**
  - 위치: `plan/complete/spec-draft-integration-error-facts.md:1`-`2` (`title:` 값을 unquoted 문자열 → quoted 문자열로 변경)
  - 상세: 이 PR 의 주 스코프(rotate lost update)와 무관한, 이미 `complete` 처리된 다른 plan 문서의 frontmatter 를 수정한다. `plan/in-progress/rotate-lost-update.md` 체크리스트(118행)에 "main 의 red 를 고쳤다 — 직전 PR(#1367)이 넣은 draft 의 `title:` 안 `code:` 로 YAML 이 깨져 Gate C 가 실패하던 것을 고쳤고 `plan/**` 587건 전수 스캔으로 잔여 실패 0건 확인" 이라고 명시되어 있어, 의도적이고 근거가 기록된 부수 수정임을 확인했다. 별도 조치 불요하나, 리뷰 스코프 밖 파일 변경이라는 점은 기록해 둔다.
  - 제안: 조치 불요.

## 요약

핵심 변경(`integrations.service.ts` 의 `rotate()`)은 외부 네트워크 호출(연결 테스트)을 트랜잭션 밖에 유지하고 임계 구간을 "재읽기+검증+UPDATE" 로 좁혀, 같은 모듈의 기존 락 선례(CONC H-3)와 형태를 맞춘 의도적 설계다. 생성자에 `DataSource` 를 추가한 시그니처 변경은 NestJS DI 로 흡수되며 유일한 수동 생성 지점(spec 파일)도 함께 갱신되어 있어 호출자 영향은 없다. 유닛 테스트의 `findOne` mock 호출 횟수(2→3) 갱신도 실제 구현과 일치한다. 유일하게 실질적인 위험은 신규 e2e 테스트가 `BEGIN`~`COMMIT` 구간을 방어 없이 열어 두어, 구간 내 단언 실패 시 DB 커넥션이 미종결 트랜잭션인 채로 `afterAll` 까지 락을 쥐고 대기 중인 HTTP 요청도 정리되지 않는 점이다 — 다만 이는 저장소에 이미 있는 선례와 동일한 스타일이라 이번 PR 이 새로 만든 결함이라기보다는 반복되고 있는 기존 패턴의 위험이다. 그 외 plan 문서 하나에 대한 범위 외 수정은 원인·근거가 문서화되어 있어 문제로 보지 않는다.

## 위험도
LOW
