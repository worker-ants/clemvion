# 부작용(Side Effect) 리뷰 — rotate lost-update 수정 (fan-out 2회차: 원 구현 + 리뷰 조치 커밋 포함)

이번 리뷰는 `origin/main` 대비 `HEAD` 전체(구현 커밋 `5c694cc5f`·`f3ea25d02` + 1차 리뷰(`17_35_12`) 조치 커밋
`ab0988f7f`·`af6cc0d2c`·`154e17d31`·`d532184f5`·`7951d6e7a`)를 대상으로 했다. 1차 리뷰의 `side_effect.md`
(`review/code/2026/09/20/17_35_12/side_effect.md`)가 이미 낸 발견사항이 이번 조치 커밋으로 어떻게
바뀌었는지 재확인하는 데 집중했다. 저장소는 뮤테이션하지 않았다 — `Read`/`git diff`/`grep` 만으로 검증,
`git status --short` 오염 없음.

## 발견사항

- **[해소 확인] e2e `BEGIN`~`COMMIT` 구간의 try/finally 보호 (1차 리뷰 WARNING 6)**
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` — `try { ... } finally { await locker.query('ROLLBACK').catch(() => undefined); await pending?.catch(() => undefined); }` 블록 (커밋 `154e17d31`)
  - 상세: 1차 리뷰가 지적한 "구간 내 assertion 실패 시 미종결 트랜잭션이 `afterAll` 까지 락을 쥐고 대기 중이던 `pending` 요청도 정리되지 않는다"는 문제가 실제로 고쳐졌다. `finally` 가 `ROLLBACK`(정상 경로에서는 이미 COMMIT 됐으므로 no-op) 뒤 `pending` 을 `.catch()` 로 드레인해, 이 커넥션이 잡고 있던 행 락과 대기 중인 요청이 어떤 실패 경로에서도 정리된다.
  - 참고(INFO, 비차단): `await locker.query('BEGIN')` 자체는 `try` 블록 **밖**에 있어, `BEGIN` 이 던지면 `finally` 는 실행되지 않는다. 다만 그 시점엔 아직 트랜잭션도 락도 없으므로 정리할 대상 자체가 없다 — 실질적 위험은 없다.

- **[재확인, 영향 없음] `IntegrationsService` 생성자에 `DataSource` 추가 (1차 리뷰 INFO)**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (`constructor(..., private readonly dataSource: DataSource)`)
  - 상세: `@Injectable()` + NestJS DI 조립이라 프로덕션 경로는 영향 없음. `DataSource` 는 전역 TypeORM 토큰이라 별도 provider 등록이 불필요하고, 같은 모듈의 `IntegrationOAuthService` 가 이미 동일하게 주입받는다(`integration-oauth.service.ts:338`). 저장소 전체에서 `new IntegrationsService(` 로 수동 생성하는 곳은 `integrations.service.spec.ts` 뿐이며, 이번 조치 커밋(`ab0988f7f`) 이후에도 `dataSource` mock 과 생성자 인자가 계속 일관되게 갱신되어 있다(`grep -n "new IntegrationsService(" codebase/backend` 로 재확인, 1건).
  - 제안: 조치 불요.

- **[신규 확인, 영향 없음] `af6cc0d2c` (헬퍼 추출 리팩터)이 호출 순서·부작용 타이밍을 바꾸지 않았다**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` `rotate()` — `assertCanRotate()`/`mergeAndValidateCredentials()` 추출
  - 상세: 두 헬퍼 모두 순수(예외 throw 만 있고 I/O·전역 상태 변경 없음)하고, 호출 지점·순서(oauth2 체크 → 권한 재검사 → 병합·검증, 락 전/후 동일)는 추출 전과 동일하다. `auditLogsService.record()`·`broadcastCredentialChange()` 호출은 트랜잭션 커밋 후 정확히 1회씩, 추출 전과 같은 위치에 남아 있다 — 이벤트/콜백 중복 발행이나 순서 변경 없음.
  - 제안: 조치 불요.

- **[신규 확인, 영향 없음] `ab0988f7f` (뮤테이션 커버리지 테스트 추가)은 프로덕션 코드·공유 상태를 건드리지 않는다**
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts` (신규 `describe('동시 rotate (lost update)')` 내 두 테스트 + `findOne` 호출 횟수 검증 갱신)
  - 상세: 모든 신규 mock/state 는 `beforeEach` 안에서 지역적으로 재초기화되며(`dataSource = { transaction: jest.fn()... }` 등), 테스트 간 공유되는 전역 변수를 새로 도입하지 않았다.
  - 제안: 조치 불요.

- **[정보] 신규 e2e 는 API 계층을 우회해 `integration` 테이블에 직접 raw SQL 을 실행한다 — 의도적·선례 일치, 재확인**
  - 위치: `codebase/backend/test/integration-rotate-concurrency.e2e-spec.ts` (`locker.query('SELECT … FOR UPDATE')`, `UPDATE integration SET credentials = …`)
  - 상세: 이 파일시스템/DB 부작용은 컬럼 transformer(암호화) 때문에 API 를 통하지 않고는 "동시 커밋"을 결정론적으로 재현할 수 없어서 나온 의도적 선택이며(docblock 이 근거를 스스로 밝힘), 선례 `trigger-config-lost-update.md §C` 와 같은 기법이다. 테스트가 만든 workspace/integration/사용자 행은 이 저장소의 다른 e2e 와 동일하게 `make e2e-down`(-v) 전제 위에서 정리되는 관례를 따르며, 이번 PR 이 새로운 정리 패턴을 요구하지 않는다.
  - 제안: 조치 불요.

## 요약

1차 리뷰(`17_35_12`)가 낸 유일한 실질적 side-effect 발견(e2e `BEGIN`~`COMMIT` 무방비 구간)은 `154e17d31` 이 `try/finally` 로 정확히 고쳤다 — 실패 경로에서도 DB 락과 대기 요청이 정리된다. 이후 조치 커밋들(`af6cc0d2c` 헬퍼 추출, `ab0988f7f` 테스트 보강, `d532184f5` CHANGELOG, `7951d6e7a` 리뷰 문서화)은 순수 리팩터·테스트·문서 변경으로, 호출 순서·이벤트 발행 횟수·생성자 호출자·전역 상태 어느 것도 바꾸지 않았다. `DataSource` 생성자 주입은 여전히 NestJS DI 로 흡수되고 유일한 수동 생성 지점(spec 파일)도 계속 동기화돼 있다. 새로 도입된 Critical/Warning 급 부작용은 없다.

## 위험도
LOW
