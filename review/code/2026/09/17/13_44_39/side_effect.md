# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `update()` 응답이 이제 "락 밖에서 재읽기 뒤 커밋된 컬럼"에 대해 한 박자 늦은(stale) 값을 반환한다 — 이는 이번 PR 의 의도된 설계이지만 관측 가능한 인터페이스 동작 변화다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 내부, 게이트 `707`~`714` (`const written = await m.save(Trigger, {...})` ~ `return target;`)
  - 상세: 종전엔 재읽은 엔티티를 통째로 `save` 해 형제 창의 커밋을 "다시 실어" 보호하려다 오히려 되돌리는 lost-update 를 냈다. 수정 후에는 저장 대상을 이 요청이 바꾸는 필드로 좁혀 DB 보존은 확실해졌지만, `TriggersService.update()`(→ `PATCH /api/triggers/:id` 컨트롤러 응답)가 돌려주는 `Trigger` 객체는 **재읽은 시점 스냅샷 + 이번 요청 변경 + `save` 반환값의 `updatedAt`** 만 반영한다. 재읽기 *이후* 락 밖에서 커밋된 컬럼(`notificationSecretV2`·`chatChannelTokenV2`·`chatChannelHealth`·형제 창이 쓴 값 등)은 DB 에는 보존되지만, 같은 PATCH 의 HTTP 응답 바디에는 반영되지 않는다. `TriggersService.update()`의 유일한 호출자는 `triggers.controller.ts:147` 이므로 이 변화는 그대로 API 응답 계약에 노출된다.
  - 제안: 의도된 트레이드오프이고 코드 주석·CHANGELOG·plan 문서에 이미 상세히 근거가 적혀 있어 결함으로 보진 않는다. 다만 이 "응답은 DB 보다 한 박자 늦을 수 있다"는 계약이 `spec/2-navigation/2-trigger-list.md` 등 API 계약 문서에 명시적으로 옮겨지는지 확인할 가치가 있다 (plan 상 이미 planner 후속으로 예정된 ⚠️ 문단 갱신 범위에 포함될 수 있음).

- **[INFO]** 신규 e2e 스펙이 `jest.config.ts` 의 "e2e 스펙은 spec 당 `pg` Client 하나만 연다"는 주석 전제를 깨는 두 번째 리소스 종류(TypeORM `DataSource`)를 도입한다 — 정리는 되지만 주석 문구가 stale.
  - 위치: `codebase/backend/jest.config.ts` (`testEnvironment: 'node'` 아래 handle-leak 관련 comment 블록, "e2e specs ... only a `pg` Client per spec" 문구) ↔ `codebase/backend/test/trigger-update-save-window.e2e-spec.ts:41-42`(`let db: Client; let ds: DataSource;`), `beforeAll`/`afterAll` (게이트 `74`~`105`)
  - 상세: 이 신규 파일은 기존 e2e 관례(`pg.Client` 하나)에 더해 TypeORM `DataSource`(자체 커넥션 풀)를 직접 열어 락 밖 컬럼 경합을 재현한다. `afterAll` 에서 `ds.destroy()`·`db.end()` 를 모두 `.catch(() => undefined)` 로 감싸 정리하므로 실행상 handle 누수는 없어 보이지만, `jest.config.ts` 주석이 "e2e 스펙은 pg Client 만 연다"를 향후 hang 진단의 전제로 깔아 둔 상태라 이 파일이 그 전제의 첫 예외가 된다. 전제가 깨진 채로 방치되면 다음 hang 조사에서 "pg Client 만 확인하면 된다"는 잘못된 지름길로 이어질 수 있다.
  - 제안: `jest.config.ts` 해당 주석에 "단, TypeORM `DataSource` 를 직접 여는 특성 테스트(`trigger-update-save-window.e2e-spec.ts`)는 예외 — 둘 다 닫는다" 정도의 한 줄 갱신을 고려. 차단 사유는 아님.

- **[INFO]** 테스트 대역(`withTransactionMock`)의 `save` mock 이 `undefined` 반환을 더 이상 통과시키지 않고 항상 `target` 으로 폴백한다 — 실제 TypeORM 충실도는 올라가지만, 다른 필드 접근 회귀에 대한 "TypeError 트립와이어" 역할은 이 경로에서 사라진다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` 게이트 `125`~`133` (`save: jest.fn(async (...) => {... return result ?? target; })`)
  - 상세: 종전엔 바깥 `triggerRepoMock.save` 가 `undefined` 를 돌려주면(대부분의 `jest.fn()` 기본값) `m.save(...)` 호출부도 `undefined` 를 받아, 프로덕션 코드가 반환값의 아무 필드나 무가드로 읽으면 즉시 `TypeError` 로 터졌다. 이번 변경은 그 간극을 메워 `updatedAt` 읽기(`written.updatedAt`)가 mock 에서도 정상 동작하도록 했는데, 동시에 "반환값에서 새 필드를 무가드로 읽기 시작하는" 유형의 향후 회귀는 이 mock 만으로는 더 이상 즉시 드러나지 않는다(새로 추가된 "save 반환값의 null 이 재읽은 값을 덮지 않는다" 테스트가 `updatedAt`·null 채움 케이스는 전용으로 고정했으므로 이번 PR 범위의 회귀는 커버됨).
  - 제안: 결함이 아니라 트레이드오프 기록 차원의 참고. 향후 `written` 에서 새 필드를 읽는 변경이 생기면 이 mock 의 `result ?? target` 폴백이 그 자리를 조용히 통과시킬 수 있다는 점을 염두에 둘 것.

- **[확인 완료 — 이슈 없음]** `TriggersService.update()` 시그니처(파라미터·반환 타입) 자체는 변경되지 않았고, 유일한 호출자(`triggers.controller.ts:147`)도 그대로다. `Trigger` 엔티티에는 `@Before*`/`@After*` 리스너나 `@EventSubscriber` 가 없음을 직접 확인했고(`grep` 0건), STI 디스크리미네이터도 없어 부분 객체 `save` 가 리스너·구독자 부작용을 새로 유발하지 않는다. `UpdateTriggerDto` 에는 `id` 필드가 없고 전역 `ValidationPipe` 가 `whitelist:true, forbidNonWhitelisted:true` 로 걸려 있어, `m.save(Trigger, { id: target.id, ...defined, config })` 의 스프레드 순서가 `id` 를 사용자 입력으로 덮어쓸 위험은 없다. 단위 테스트 `makeService()` 는 매 테스트마다 새 `repoMock` 을 생성하므로 신규 테스트의 `repo.save.mockImplementation(...)` 이 다른 테스트를 오염시키지 않는다. 신규 e2e 파일은 `synchronize: false` 를 명시했고 unit(`jest.config.ts`, `testRegex: '.spec.ts$'`, `rootDir: 'src'`)과 e2e(`jest-e2e.json`, `testRegex: '.e2e-spec.ts$'`) 구성이 서로 겹치지 않아 unit 실행 중 실제 DB 커넥션이 열릴 위험도 없다.

## 요약

이번 변경의 핵심(락 밖 컬럼을 보존하기 위해 `save` 대상을 부분 객체로 좁히고, 응답에서는 `save` 반환값의 `updatedAt` 만 취하는 것)은 부작용 관점에서 안전하게 설계·검증되어 있다. 엔티티 리스너·구독자 부재, DTO 화이트리스트, 테스트 mock 격리 등 잠재적 위험 지점을 직접 확인했고 실질적 결함을 찾지 못했다. 다만 (1) `update()` 응답이 재읽기 이후 락 밖 커밋 컬럼에 대해 의도적으로 한 박자 늦은 값을 돌려주는 인터페이스 동작 변화, (2) 신규 e2e 파일이 `jest.config.ts` 의 "pg Client 하나만 연다"는 문서화된 전제를 깨면서도 정리는 제대로 하는 점, (3) 테스트 mock 의 fallback 강화가 다른 회귀에 대한 안전망을 미세하게 낮추는 점은 문서 기록·가시성 차원에서 짚어 둘 가치가 있다. 셋 다 차단 사유는 아니다.

## 위험도
LOW
