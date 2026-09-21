# 테스트(Testing) 리뷰 — model-config 동시 삭제 결함 수정 (직전 라운드 RESOLUTION 반영분)

## 검증 방법

`codebase/backend/src/modules/model-config/model-config.service.ts`,
`model-config.service.spec.ts`, `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts`
전문을 `Read`로 직접 열람했고, 형제 파일 `auth-config-delete-concurrency.e2e-spec.ts`와
`diff`로 1:1 대조했다. 이전 라운드(`review/code/2026/09/21/16_39_52`)가 남긴 테스트 관련
INFO(죽은 `mockRepo.remove` fixture, e2e 주석의 거짓 인과)가 실제로 해소됐는지
`grep -n "mockRepo\.remove"`(0건 확인)와 커밋(`6a5571e70`, `153152d85`) 대조로 검증했다.
저장소 파일은 뮤테이션하지 않았다 — `git status --short` 결과 세션 자신의 출력 디렉터리만
untracked.

## 발견사항

- **[INFO]** 레이스 패자(`affected: 0`) 단위 테스트가 `mockRepo.delete` 호출 인자를 단언하지 않는다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts` — `describe('remove — 동시 삭제', …)` 안의 `it('진 쪽은 404 MODEL_CONFIG_NOT_FOUND …')` (게이트 1104~1120)
  - 상세: 같은 파일의 승자 경로 테스트(게이트 363, `expect(mockRepo.delete).toHaveBeenCalledWith({ id: 'cfg-9', workspaceId: 'ws-1' })`)는 delete 호출 criteria(워크스페이스 스코프 포함)를 명시적으로 단언하는데, 패자 경로 테스트는 `affected: 0` mock 만 세팅하고 `mockRepo.delete`가 실제로 `{id, workspaceId}`로 호출됐는지는 단언하지 않는다. 코드 경로가 승자·패자 모두 같은 `this.repo.delete({ id, workspaceId })` 한 줄을 거치므로 실질 회귀 위험은 낮지만, 이 테스트만 단독으로 읽었을 때 "delete가 올바른 criteria로 불렸다"는 계약이 이 테스트 자체로는 증명되지 않는다.
  - 제안: `expect(mockRepo.delete).toHaveBeenCalledWith({ id: 'cfg-race', workspaceId: 'ws-1' })`를 한 줄 추가하면 승자/패자 두 테스트가 대칭을 이루고, 향후 criteria 구성이 실수로 바뀌는 것도 이 테스트가 단독으로 잡는다. 비차단.

- **[INFO]** `it.each([[undefined], [null]])` 블록의 `as unknown as DeleteResult` 캐스팅이 불필요해 보인다
  - 위치: `codebase/backend/src/modules/model-config/model-config.service.spec.ts` (게이트 1132~1135)
  - 상세: TypeORM `DeleteResult.affected`의 선언 타입은 이미 `number | null | undefined`다. `{ affected, raw: [] }`에서 `affected`가 `undefined | null`인 경우도 원래 타입과 구조적으로 일치하므로 `as unknown as DeleteResult`로 우회할 필요가 없어 보인다(반면 게이트 38~40의 `delete: jest.fn<Promise<DeleteResult>, [unknown]>()`는 주석이 근거를 명시한 의도된 조치와 다르다). 실행에는 무해하고, 타입 단언이 실수로 잘못된 shape을 숨기는 것도 아니다(같은 줄에서 `raw: []`까지 갖춘 정확한 shape).
  - 제안: 캐스팅 제거 시 타입체크가 그대로 통과하는지 확인 후 정리하면 노이즈가 준다. 비차단, 우선순위 낮음.

- **[INFO, 재확인]** 이전 라운드 WARNING 3(신규 e2e가 형제 8개와 거의 전문 동일)은 이번 diff에서 해소 대상이 아니라 "결정 시점 고정"으로 처리됨 — 테스트 관점에서도 재지적하지 않음
  - 위치: `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` 전체 vs `auth-config-delete-concurrency.e2e-spec.ts` (직접 `diff` 대조 결과 리소스명·라우트·에러코드·request body 필드만 다르고 구조 100% 동일)
  - 상세: `plan/in-progress/modelconfig-dup-delete.md` §"이 PR 이 하지 않는 것"이 아홉 번째(WebAuthn) PR **착수 시점**에 공용 헬퍼 추출 여부를 실제로 결정하는 것을 선행 조건으로 못박아 두었다. 이는 이전 라운드 maintainability WARNING을 코드 변경 없이 plan 재작성(`01c6130f5`)으로 처리한 것이며, RESOLUTION.md도 이를 "결정 고정(무수정)"으로 정확히 기록했다. 테스트 격리·독립 실행 가능성 자체에는 영향 없다(각 e2e 파일은 자체 `beforeAll`/`afterAll`로 완전히 독립).
  - 제안: 조치 불요(이미 처리된 결정). 다음 세션이 9번째 PR에서 선행 조건 이행 여부만 확인하면 된다.

## 이전 라운드 테스트 관련 항목 해소 확인

- INFO 1(죽은 `mockRepo.remove` fixture) — `153152d85`로 제거 확인(`grep -n "mockRepo\.remove"` 0건).
- INFO 2(e2e 주석의 거짓 인과 "default 스왑 경로를 함께 탄다") — `6a5571e70`로 정정 확인, 코드 동작(`remove()`가 `isDefault`/`saveWithDefaultSwap` 미참조)과 이제 일치.
- 두 커밋 모두 diff 범위가 딱 그 항목에 국한돼 있어 부수 변경 없음.

## 각 관점별 평가 (요약)

1. **테스트 존재 여부** — 충분. 승자/패자/드라이버 미보고 대조군 3갈래가 unit에, 실제 DB 행 락 기반 인터리빙이 e2e에 갖춰짐.
2. **커버리지 갭** — 실질적 갭 없음. 위 INFO 1(delete 호출 인자 미단언)만 완결성 측면의 사소한 비대칭.
3. **엣지 케이스** — 강점. `affected === 0`(패자) vs `undefined`/`null`(드라이버 미보고)을 `it.each`로 분리해, `!affected`로 되돌리면 실패하는 대조군을 마련(주석에 #1371 뮤턴트 32건 생존 근거를 남겨 재발 방지 이유가 검증 가능).
4. **Mock 적절성** — `jest.fn<Promise<DeleteResult>, [unknown]>()`로 반환 타입을 명시해 `mockResolvedValueOnce` 인자가 좁은 리터럴로 추론되는 것을 막았고, 실제 TypeORM `Repository.delete()` 반환 shape(`{affected, raw}`)과 일치. 위 INFO 2(불필요해 보이는 캐스팅)만 사소한 잡음.
5. **테스트 격리** — `beforeEach`가 매 테스트 `mockRepo`/`service`를 새로 만들고 `mockResolvedValueOnce`는 해당 테스트에 국한돼 누수 없음. e2e도 각자 `beforeAll`/`afterAll`로 독립.
6. **테스트 가독성** — 각 테스트 상단 주석이 "왜 이 형태인가"(흉내가 허구가 된 이유, 대조군이 막는 회귀, 뮤턴트 생존 이력)를 근거와 함께 명시해 의도가 뚜렷하다.
7. **회귀 테스트** — `remove(entity)`→`delete(criteria)` 전환으로 vacuous해질 뻔한 기존 단언 3건(승자 delete 호출, 패자 delete 미호출, kind 캡처 순서 흉내)을 모두 능동적으로 식별해 옮기거나 제거했다. "삭제 전에 읽은 kind" 순서-고정 테스트를 "여전히 참인 계약만" 남기도록 재작성한 판단이 타당하다(엔티티 파괴 흉내는 `delete(criteria)`에서 더 이상 사실이 아님).
8. **테스트 용이성** — `Repository<ModelConfig>` DI 주입 구조 그대로 유지, 신규 로직(`affected` 분기)도 순수 조건문이라 mock 값만 바꿔 분기 테스트가 용이했다.

## 요약

이번 diff는 이전 리뷰 라운드(`16_39_52`)가 지적한 테스트 관련 INFO 2건(죽은 mock, e2e 주석 오류)을 정확히 커밋 범위에 국한해 해소했고, 새로 도입한 테스트 코드나 회귀는 없다. 핵심 동시성 수정 자체(unit의 승자/패자/대조군 3갈래 + e2e의 실제 행 락 인터리빙)는 형제 7건과 동일한 검증된 패턴을 정확히 재사용하며, 뮤테이션 검증(`=== 0` → `!affected`, 404 분기 제거)이 예측대로 RED가 됐다는 plan 기록도 테스트 구조와 정합적이다. 새로 발견한 것은 완결성 측면의 사소한 INFO 2건(패자 테스트의 delete 호출 인자 미단언, 불필요해 보이는 타입 캐스팅)뿐이며 둘 다 비차단이다. e2e 파일의 형제 간 전문 중복은 이미 이전 라운드 WARNING으로 지적되고 plan 재작성(`01c6130f5`)으로 결정이 고정된 사안이라 이번 라운드에서 재지적하지 않는다.

## 위험도

NONE
