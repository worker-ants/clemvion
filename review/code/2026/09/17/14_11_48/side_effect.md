# 부작용(Side Effect) 리뷰

## 범위 확인

`origin/main...HEAD` 전체 diff(30개 파일, `codebase/backend/src/modules/triggers/triggers.service.ts` 및 관련 테스트·e2e·plan·이전 라운드 리뷰 산출물)를 대상으로 했다. 실질적 side-effect 표면은 파일 1~7(`triggers.service.ts` 창 1의 `save` 를 통째 엔티티 → 부분 객체로 좁힌 변경 + mock/테스트/e2e)뿐이고, 파일 8~30(`review/code/2026/09/17/13_44_39/**`, `review/consistency/2026/09/17/13_04_39/**`)은 이전 라운드의 리뷰·정합성 검토 산출물이 이번에 커밋되어 diff 에 나타난 것으로, 코드 동작에 영향이 없는 기록물이다.

또한 1라운드 disposition 커밋이 실측 원본 수정 위에 무엇을 더했는지 그 두 커밋 사이 diff 를 직접 대조했다 — 주석 갱신(뮤턴트 재측정치 53→60, 머리말 시제 정정)과 `const patch = { ...defined, config: mergedConfig }` 로의 리터럴 중복 제거뿐이며, `m.save`/`Object.assign`/`written.updatedAt` 가드에 넘어가는 **값 자체는 리팩터 전후로 동일**하다. 즉 1라운드 disposition 이 새로운 부작용을 만들지 않았다.

## 발견사항

> **작업 중 관측 — 저장소 뮤테이션(내가 만들지 않음)**: 리뷰 시작 시점에 이미 워킹트리에
> `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` 수정이
> 잡혀 있었다. 내용은 `withTransactionMock` 안에 `// MUTATION: transaction callback
> intentionally not executed (test probe)` 주석과 함께 조기 `return`을 삽입해 트랜잭션 콜백을
> 실행하지 않게 만드는 임시 변경이다 — 다른 병렬 reviewer가 이 PR의 mock JSDoc(파일 3, 게이트
> `63`~`64`: "transaction이 콜백을 실행하지 않게 바꾸면 60개 RED")을 검증하려고 만든 뮤턴트로
> 보인다. 이 뮤테이션은 **내가 만들지 않았고**, 규약상 `git checkout`/`restore`로 임의 원복하지
> 않았다(원복 시도가 그 reviewer의 진행 중 실험을 지울 수 있어서다). 이 리뷰는 이 파일을 뮤테이션
> 상태로 열람하지 않고 diff·직접 `Read`로만 판단했으므로 아래 발견사항에는 영향이 없지만, 이 사실
> 자체를 숨기지 않고 보고한다 — 조용히 넘어가면 다음 사람이 이 잔여물을 진짜 결함으로 오인해
> 조사할 수 있다.

- **[INFO]** `TriggersService.update()` 응답이 재읽기 이후 락 **밖**에서 커밋된 컬럼(`notificationSecretV2`·`chatChannelTokenV2`·형제 창이 쓴 값 등)에 대해 한 박자 늦은(pre-write) 값을 돌려주는 것은 여전히 유효한 관측 가능 인터페이스 동작 변화다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` 게이트 `680`~`717` (`const patch = …` ~ `return target;`)
  - 상세: DB 쪽은 부분 객체 `save` 로 보존되지만(이 PR 의 목적), HTTP 응답 바디는 "재읽은 스냅샷 + 이번 요청 변경 + `save` 반환값의 `updatedAt` 하나"만 반영한다. 이 성격은 원본 fix 커밋에서 이미 도입됐고 1라운드 side_effect 리뷰가 동일 항목을 INFO 로 지적했으며, plan 의 "이 PR 이 안 하는 것" §1(spec `2-trigger-list.md` ⚠️ 문단 정정을 planner 후속으로 위임)에 이미 반영되어 있다. 코드·CHANGELOG·plan 삼중으로 근거가 적혀 있어 새 결함은 아니다.
  - 제안: 조치 불요(이미 트래킹됨) — planner 후속 PR 에서 spec 계약 문서에 "응답은 DB 보다 한 박자 늦을 수 있다"를 명문화할 때 흡수.

- **[INFO]** 테스트 대역 `withTransactionMock` 의 `save` mock 이 `undefined` 를 더 이상 통과시키지 않고 항상 `target` 으로 폴백한다 — 다른 필드 무가드 접근 회귀에 대한 `TypeError` 트립와이어가 이 경로에서 약해진다는 트레이드오프는 여전히 유효하다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts` 게이트 `125`, `131`~`132` (`save: jest.fn(async (...) => { const result = saveMock ? await saveMock(target) : undefined; return result ?? target; })`)
  - 상세: 이 파일은 `schedules.service.spec.ts`·`triggers.web-chat.spec.ts` 등 diff 밖의 다른 spec 도 공유하는 테스트 유틸이라 파급 범위가 이 PR 국한이 아니다(1라운드 INFO#10 이 이미 지적, plan 체크리스트의 `run-test-all.sh` unit 14 전부 PASS 실측으로 뒷받침됨). 1라운드 disposition 은 이 mock 을 다시 건드리지 않았으므로 트레이드오프 자체는 그대로다.
  - 제안: 조치 불요(1라운드에서 이미 "기록 목적, 조치 불요"로 처분됨) — 향후 `written` 에서 새 필드를 무가드로 읽는 변경이 생기면 이 mock 이 그 회귀를 가려줄 수 있다는 점만 유지.

- **[확인 완료 — 이슈 없음]** `jest.config.ts` 의 "e2e 스펙은 `pg` Client 하나만 연다" 전제가 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)로 깨지는 지점은 1라운드에서 INFO 로 지적됐고, 이번 diff 에서 실제로 예외 문구 한 줄이 추가돼 해소됐다.
  - 위치: `codebase/backend/jest.config.ts` 게이트 `50`~`53`("One exception opens a TypeORM DataSource as well — trigger-update-save-window.e2e-spec drives the ORM directly … `ds.destroy()`")
  - 상세: 신규 e2e 파일의 `afterAll`(해당 파일 게이트 `102`~`105`)이 `ds.destroy()`와 `db.end()`를 모두 `.catch(() => undefined)`로 감싸 정리하므로 handle 누수 위험은 없다. 문서 전제와 구현이 이제 일치한다.
  - 제안: 없음.

- **[확인 완료 — 이슈 없음]** `TriggersService.update()` 시그니처(파라미터·반환 타입)·유일 호출자(`triggers.controller.ts`)는 이번 diff 로 변경되지 않았다. `Trigger` 엔티티에 `@Before*`/`@After*` 리스너·`@EventSubscriber`가 없음을 재확인했고(`grep` 0건), 부분 객체 `save`가 새로운 리스너·구독자 부작용을 유발하지 않는다. `UpdateTriggerDto`에 `id` 필드가 없고 전역 `ValidationPipe`가 `whitelist:true, forbidNonWhitelisted:true`이므로 `{ id: target.id, ...patch }`의 스프레드 순서가 사용자 입력으로 `id`를 덮어쓸 위험도 없다(패치 대상 `patch`가 `defined`에서 나오고 `defined`는 DTO 필터링을 거친 값이라 `id` 키를 포함할 수 없음).
  - 상세: 신규 e2e 파일이 만드는 `DataSource`(`synchronize: false`)는 실제 DDL을 실행하지 않고, unit(`testRegex: '.*\\.spec\\.ts$'`, `rootDir: 'src'`)과 e2e(`jest-e2e.json`, `.e2e-spec.ts$`) 테스트 경로가 서로 겹치지 않아 unit 실행 중 실 DB 커넥션이 열릴 위험도 없다.
  - 제안: 없음.

- **[확인 완료 — 이슈 없음]** 신규 e2e 스펙(`trigger-update-save-window.e2e-spec.ts`)의 원시 SQL(`DELETE FROM workflow …`, `UPDATE trigger SET notification_secret_v2 = …`)은 해당 테스트가 그 자리에서 새로 만든(`uniqueName`/`uniqueEmail` 기반) 워크스페이스·워크플로·트리거에만 작용하고, 병렬 실행 중인 다른 e2e 스펙의 고정 데이터를 건드리지 않는다.
  - 상세: `beforeAll` 이 매 스펙 실행마다 새 계정·워크스페이스를 등록하고, 각 `it`도 `createWorkflowAndTrigger(tag)`로 고유 태그 리소스를 새로 만들어 사용한다. DB 상태를 직접 조작하는 것은 "재읽기 뒤 경합"을 결정적으로 재현하기 위한 의도된 설계이며(파일 헤더 JSDoc 명시), 다른 스펙과 공유하는 전역 픽스처를 변경하지 않는다.
  - 제안: 없음.

## 요약

이번 라운드에서 새로 도입된 부작용은 없다 — 실질 코드 변경(창 1 `save` 를 부분 객체로 좁힘)의 부작용 표면은 1라운드에서 이미 3건(응답의 one-beat-stale 값·mock 트립와이어 약화·`jest.config.ts` 전제 붕괴) INFO 로 식별됐고, 그중 `jest.config.ts` 건은 이번 diff 에서 문서화로 해소됐으며 나머지 둘은 근거와 함께 "조치 불요"로 처분된 상태 그대로다. 1라운드 disposition 커밋은 원본 fix 위에 주석 정정과 리터럴 중복 제거(`const patch`)만 얹었고, `m.save`/`Object.assign`/`written.updatedAt` 가드로 흘러가는 실제 값은 리팩터 전후 동일함을 직접 diff 로 확인했다 — 새 Critical/Warning 급 side effect 는 없다. 시그니처·전역 상태·환경 변수·네트워크 호출·이벤트/콜백 어느 축에서도 이 PR 이 만든 새로운 결함은 발견되지 않았다. 단, 리뷰 시작 시점에 워킹트리에 이미 다른 reviewer 것으로 보이는 뮤테이션(`trigger-transaction-mock.ts`)이 남아 있었음을 위 발견사항 앞에 기록해 둔다 — 내가 만들지 않았고 원복하지 않았다.

## 위험도
LOW
