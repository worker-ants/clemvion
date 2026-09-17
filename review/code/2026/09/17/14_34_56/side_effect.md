# 부작용(Side Effect) 리뷰

## 범위 확인

이 라운드(`14_34_56`)의 diff(`origin/main...HEAD`, 46개 파일)에서 실질적 side-effect 표면이
있는 코드는 파일 1~6(`CHANGELOG.md`·`jest.config.ts`·`trigger-transaction-mock.ts`·
`triggers.service.spec.ts`·`triggers.service.ts`·`trigger-update-save-window.e2e-spec.ts`)뿐이고,
나머지(파일 7 plan, 파일 8~46 `review/code/2026/09/17/{13_44_39,14_11_48}/**`·
`review/consistency/2026/09/17/13_04_39/**`)는 이전 두 라운드의 리뷰·정합성 산출물과 plan
문서가 이번에 커밋되어 diff 에 나타난 것으로, 코드 동작에 영향이 없는 기록물이다.

**핵심 확인**: `git diff 6d845d8a2 d60cc65aa`(1라운드 disposition → 2라운드 disposition,
이번 라운드가 보는 최신 코드)로 대조한 결과, 이번 라운드가 실제 코드에 더한 변경은
`trigger-transaction-mock.ts` 의 JSDoc 뮤턴트 카운트 문구(`53`/`60`→"수십 건", 시점 의존
서술)와 `CHANGELOG.md`·`plan/in-progress/trigger-save-partial-patch.md` 의 문구 정정뿐이다.
`triggers.service.ts`·`triggers.service.spec.ts`·신규 e2e 스펙은 **1바이트도 바뀌지 않았다**
— 즉 `TriggersService.update()` 의 `save`/`Object.assign`/`written.updatedAt` 로직과 그
검증 테스트는 직전 라운드(`14_11_48`) 리뷰가 이미 본 상태 그대로다.

이를 근거로 이번 라운드는 이전 두 라운드가 이미 검증한 항목을 그대로 재서술하는 대신,
**독립적으로 추가 검증**을 수행했다:

- `codebase/backend/src` 전체에서 `@EventSubscriber`·`@BeforeInsert`/`@AfterInsert`·
  `@BeforeUpdate`/`@AfterUpdate`·`@BeforeRemove`/`@AfterRemove`·`@AfterLoad` 를 grep —
  `User` 엔티티(`bcrypt` 정규화용 `@BeforeInsert`/`@BeforeUpdate`)만 존재하고 `Trigger` 에는
  전무함을 재확인했다(이전 라운드는 `Trigger` 엔티티 파일만 grep 했는데, 이번엔 backend
  전체를 대상으로 넓혀 별도 `EventSubscriber` 클래스가 `Trigger` 를 감시하지 않음까지 확인).
- `trigger.entity.ts` 전문을 직접 읽어 `workspace`/`workflow` 관계에 `cascade: true` 옵션이
  없음(둘 다 `onDelete: 'CASCADE'` 는 DB FK 레벨 설정이고 TypeORM `save` cascade 와 무관)을
  확인 — 부분 객체 `save` 가 관계를 건드리지 않으므로 관계 cascade 부작용도 없다.
- 신규 e2e(`trigger-update-save-window.e2e-spec.ts`)의 원시 SQL 3건
  (`DELETE FROM workflow WHERE id = $1`, `UPDATE trigger SET … WHERE id = $1` ×2)이 모두
  `id = $1` 파라미터 바인딩으로 그 스펙이 직접 만든 행에만 좁혀져 있음을 확인 — 병렬 실행
  중인 다른 e2e 스펙의 공유 데이터를 건드리는 전역 SQL(WHERE 절 없는 `DELETE`/`UPDATE`,
  `TRUNCATE`)은 없다.

## 발견사항

- **[INFO]** `TriggersService.update()` 응답이 재읽기 **이후** 락 밖에서 커밋된 컬럼에 대해
  한 박자 늦은(pre-write) 값을 돌려주는 것은 여전히 유효한 관측 가능 인터페이스 동작
  변화다 — 1·2라운드 side_effect 리뷰가 이미 지적했고 코드는 이번 라운드에 변경되지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts`, 함수
    `TriggersService.update()` — `const patch = { ...defined, config: mergedConfig };` 부터
    `return target;` 까지 (트랜잭션 콜백 안, `written.updatedAt` 가드 포함).
  - 상세: DB 는 부분 객체 `save` 로 보존되지만(이 PR 의 목적), 같은 PATCH 의 HTTP 응답
    바디는 "재읽은 스냅샷 + 이번 요청 변경 + `save` 반환값의 `updatedAt` 하나" 만 반영한다.
    재읽기 이후 락 밖에서 커밋된 컬럼(형제 창이 쓴 값 등)은 DB 엔 살아 있지만 같은 응답엔
    안 보인다. 코드 주석·`CHANGELOG.md`·plan "이 PR 이 안 하는 것" §1(spec `2-trigger-list.md`
    ⚠️ 문단 정정을 planner 후속으로 위임)에 이미 근거가 있어 새 결함은 아니다.
  - 제안: 조치 불요(이미 트래킹됨) — planner 후속 PR 에서 spec 계약 문서에 반영.

- **[INFO]** 공유 테스트 유틸 `withTransactionMock` 의 `save` mock 이 `undefined` 반환을
  더 이상 통과시키지 않고 항상 `target` 으로 폴백하는 트레이드오프는 여전히 유효하다 —
  이번 라운드에 이 로직도 변경되지 않았다.
  - 위치: `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
    함수 `withTransactionMock` 내부 `save: jest.fn(async (_entity, target) => { const result =
    saveMock ? await saveMock(target) : undefined; return result ?? target; })`.
  - 상세: 이 파일은 `src/modules/triggers` 하위 321건 케이스가 공유하는 테스트 대역이라
    파급 범위가 이 PR 국한이 아니다. 폴백이 생기기 전엔 `triggerRepoMock.save` 를 설정하지
    않은 테스트에서 `m.save(...)` 가 `undefined` 를 돌려줘, 프로덕션 코드가 반환값의 필드를
    무가드로 읽으면 즉시 `TypeError` 로 터지는 "트립와이어" 역할을 했다. 이제는 항상 `target`
    으로 폴백하므로, 향후 `written` 에서 새 필드를 무가드로 읽는 회귀가 생겨도 이 mock 만으론
    즉시 드러나지 않을 수 있다(이번 PR 이 추가한 `updatedAt`·null-채움 케이스는 전용 테스트로
    고정되어 있어 이번 PR 범위의 회귀는 커버됨). 1·2라운드가 이미 지적하고 "기록 목적,
    조치 불요" 로 처분됨.
  - 제안: 조치 불요 — 트레이드오프 기록 유지.

- **[확인 완료 — 이슈 없음]** 엔티티 리스너·구독자 부재를 backend 전체로 확장 재검증.
  - 상세: `grep -rn "EventSubscriber\|@Before*\|@After*" codebase/backend/src` 로 전수
    확인한 결과 `Trigger` 관련 리스너·구독자는 0건이고(`User` 엔티티의 bcrypt 정규화
    hook 만 별개로 존재), `trigger.entity.ts` 의 `workspace`/`workflow` `@ManyToOne` 관계에는
    TypeORM `cascade` 옵션이 없다(`onDelete: 'CASCADE'` 는 DB FK 레벨). 부분 객체 `save` 가
    관계 필드를 아예 담지 않으므로 관계 cascade·리스너 부작용 모두 발생하지 않는다.
  - 제안: 없음.

- **[확인 완료 — 이슈 없음]** 신규 e2e 파일의 원시 SQL 은 모두 그 스펙이 만든 행에
  `id = $1` 로 좁혀져 있어 병렬 실행 중인 다른 e2e 스펙의 공유 데이터에 부작용을 주지 않는다.
  - 위치: `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` — `DELETE FROM
    workflow WHERE id = $1`, `UPDATE trigger SET … WHERE id = $1` (2곳).
  - 제안: 없음.

- **[확인 완료 — 이슈 없음]** `TriggersService.update()` 시그니처(파라미터·반환 타입)와
  유일 호출자(`triggers.controller.ts`)는 이번 라운드에서도 변경되지 않았다. 저장소를
  뮤테이션하는 검증(뮤턴트 적용 등)은 수행하지 않았다 — 코드 대조·전수 grep 만으로 판단
  가능했다. `git status --short` 로 확인한 결과 이 리뷰가 만든 저장소 변경은 없다(내
  output 파일 외 아무것도 건드리지 않았다).

## 요약

이번 라운드에서 새로 도입된 부작용은 없다. `git diff` 로 직접 대조한 결과 이번 라운드가
실제로 건드린 것은 주석/문서 문구(뮤턴트 카운트 표현, CASCADE 실측 범위 명시)뿐이고, side
effect 표면을 가진 실제 코드(`triggers.service.ts` 의 부분 객체 `save`,
`trigger-transaction-mock.ts` 의 async 대역, 신규 e2e)는 직전 라운드와 동일하다. 독립
검증으로 `Trigger` 엔티티 리스너·관계 cascade 부재를 backend 전체 범위로 재확인했고, 신규
e2e 의 원시 SQL 이 자기 자신이 만든 행에만 좁혀져 있음을 확인했다 — 둘 다 이슈 없음. 남은
INFO 두 건(응답의 one-beat-stale 반환값, 공유 mock 트립와이어 약화)은 1·2라운드에서 이미
근거와 함께 "조치 불요"로 처분된 상태 그대로이며 이번 라운드에서 그 판단을 바꿀 새 정보는
없었다. Critical·Warning 급 side effect 는 발견되지 않았다.

## 위험도
LOW
