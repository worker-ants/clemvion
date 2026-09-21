# 유지보수성(Maintainability) 리뷰

> **작업 트리 이상 상태 관측 (내가 만든 변경 아님)** — 리뷰 도중 `git status --short` 로 확인한 결과
> `codebase/backend/src/modules/integrations/integrations.service.ts` 에 미커밋 수정이 하나 있다:
> `remove()` 의 사용처 검사(`ConflictException` 직전)에
> `await this.integrationRepository.delete({ id, workspaceId }); // MUTATION-PROBE` 한 줄이 추가돼 있다.
> 이 줄은 이 리뷰 세션이 넣은 것이 아니다 — 이 파일은 `Read` 만 했고 `Write`/`Edit` 를 하지 않았다.
> 병렬로 도는 다른 reviewer 의 뮤테이션-검증 흔적으로 보인다. 공유 워크트리를 더 오염시키지 않기 위해
> 되돌리는 조작(`checkout`/`restore`)을 하지 않았다 — 원복 여부는 그 세션 또는 orchestrator 가 판단해야
> 한다. 아래 발견사항은 이 뮤테이션이 나타나기 **전**에 `Read` 로 확보한 파일 내용을 기준으로 작성했다.

## 발견사항

- **[WARNING]** `IntegrationsService.remove()` 의 신규 404 분기가 `NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' })` 리터럴을 그대로 복제했다 — 같은 함수 안에서 8줄 위(기존 `!entity` 분기)와 완전히 동일한 객체를 두 번째로 손으로 다시 쓴 것이다. 이번 픽스와 같은 결함 클래스를 고친 형제 모듈 두 곳은 정확히 이 지점에서 재사용 헬퍼를 도입했다 — `schedules.service.ts:151` `private throwScheduleNotFound(): never`, `triggers.service.ts:412` `private throwTriggerNotFound(): never`(주석: "이 문구가 사는 유일한 자리"). `integrations.service.ts` 는 그 관례를 따르지 않아 동일 리터럴이 파일 전체에서 7곳(604, 733, 765, 806, 1199, 1232, 1498)으로 늘었다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:804-809` (신규 추가분). 대조: 같은 파일 `:765-770` (기존, `!entity` 분기).
  - 상세: 이 PR 이 참조하는 형제 PR(#1370 트리거, #1371 스케줄)이 바로 이 "0행 → 404" 패턴을 추가하면서 헬퍼로 뽑아냈다. `integrations.service.ts` 는 그 개선을 반영하지 않고 기존의 리터럴 중복 패턴을 하나 더 늘렸다. 4개 형제 중 2개(schedules·triggers)만 헬퍼를 쓰므로 "저장소 전체 규약 위반"까지는 아니지만, 이 diff 가 직접 인용하는 두 형제 커밋의 최신 관례와는 어긋난다.
  - 제안: `private throwIntegrationNotFound(): never { throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'Integration not found' }); }` 류의 헬퍼를 추출해 `findById`/`update`/`remove` 의 세 지점(및 `requireEntity` 계열)에서 재사용하면 이 함수와 형제 모듈의 관례가 정렬된다. 이번 diff 범위만 놓고 보면 필수는 아니나, 다음 사람이 이 패턴을 또 손으로 베낄 가능성을 낮춘다.

- **[INFO]** `remove()` 안의 신규 로직 6줄(`delete` 호출 + `affected === 0` 분기, `:800-809`) 위에 16줄짜리 인라인 주석 블록(`:784-799`)이 붙어 코드 대비 주석 비율이 높다. 다만 같은 커밋 계열의 형제 구현(`schedules.service.ts:312-340` 의 "Cascade delete trigger" 블록 등)도 동일한 밀도로 근거·기각된 대안·SoT 를 인라인에 남기는 것이 이 저장소의 확립된 관례이므로, 이 diff 만의 이상치는 아니다. 결함으로 보지 않고 참고로만 남긴다.

- **[INFO]** 신규 e2e `codebase/backend/test/integration-delete-concurrency.e2e-spec.ts` 는 구조·매직넘버(`1_500` ms `Promise.race` 타임아웃, `SELECT … FOR UPDATE` 락 기법, `beforeAll`/`afterAll` 커넥션 관리)까지 4개 형제 파일(`workflow-`/`workspace-`/`trigger-`/`schedule-delete-concurrency.e2e-spec.ts`)과 거의 동일하게 복제됐다(직접 diff 확인). 이 저장소는 이런 "형제 스펙 간 미러 중복"을 (cafe24/makeshop 미러처럼) 의도된 패턴으로 다뤄 온 선례가 있어 DRY 위반으로 보고하지 않는다. 다만 plan 문서(`plan/in-progress/integration-dup-delete.md`)가 이미 6번째 자리(`WorkspacesService.removeMember()`)를 예고했으므로, 그 PR 에서 5번째 반복이 되는 시점에는 공통 헬퍼(예: `raceTwoDeletes(url, id, lockTable)`)로 추출할 가치를 검토할 만하다 — 지금 이 PR 에서 강제할 사항은 아니다.

- **[INFO]** `integrations.service.spec.ts` 에 추가된 두 테스트 이름이 한국어(`동시 삭제의 진 쪽(0행)은...`, `affected 를 보고하지 않는 드라이버에서는...`)인 반면 같은 `describe('remove', ...)` 블록의 기존 테스트는 전부 영어다. 다만 `schedules.service.spec.ts`·`triggers.service.spec.ts` 를 확인한 결과 이 저장소는 스펙 파일 안에서 한국어/영어 테스트명을 자유롭게 섞는 것이 이미 광범위한 기존 관례이므로(예: `schedules.service.spec.ts:174`, `triggers.service.spec.ts:403`), 새로 지적할 불일치가 아니다.

- 함수 길이·중첩 깊이·순환 복잡도: `remove()` 는 순차적인 3개의 조건(존재 확인 → 사용처 확인 → `affected` 확인)만 가지며 중첩이 없다. 신규 대조군 테스트의 `for (const affected of [undefined, null])` 루프도 형제 스펙(`schedules.service.spec.ts:827-846`)과 동일한 형태로, 새로운 복잡도를 추가하지 않는다. 매직 넘버는 도입되지 않았다(`0`·`undefined`·`null` 은 판별자로서 의미가 명시적으로 주석·테스트에 설명됨).

- `plan/in-progress/integration-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` 및 `review/consistency/2026/09/21/10_27_27/*` 산출물은 애플리케이션 코드가 아니라 계획·리뷰 산출물이므로 함수/네이밍/복잡도 관점의 상세 평가 대상에서 제외했다.

## 요약

핵심 변경(`IntegrationsService.remove()` 의 `remove(entity)` → 원자적 `delete(criteria)` + `affected === 0` 판정 전환, 관련 유닛·e2e 테스트)은 함수 길이·중첩·복잡도 면에서 무리가 없고, 판정 로직과 대조군 테스트 모두 형제 PR(#1369~#1371)이 세운 관례(`=== 0` 명시 비교, 대조군 테스트, e2e 행 락 기법)를 잘 따른다. 유일하게 아쉬운 점은 형제 모듈(schedules·triggers) 이 같은 시점에 도입한 `throwXNotFound()` 헬퍼 추출 관례를 이 파일에는 적용하지 않아, 이미 여러 곳에 흩어져 있던 `RESOURCE_NOT_FOUND` 리터럴이 하나 더 늘었다는 것이다. 그 외 주석 밀도·e2e 구조 복제는 이 저장소가 반복적으로 채택해 온 의도된 패턴과 일치해 결함으로 보지 않는다. 전반적으로 유지보수성 리스크는 낮다.

리뷰와 무관하게, 이 세션이 만들지 않은 미커밋 뮤테이션(`integrations.service.ts` 의 `// MUTATION-PROBE` 줄)이 작업 트리에 남아 있다 — 위 경고 배너 참조.

## 위험도

LOW
