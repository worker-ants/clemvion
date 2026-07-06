# 테스트 리뷰 — 스케줄 triggerId 필터 (commit 5b52b8b96)

리뷰 대상: `codebase/backend/src/modules/schedules/{schedules.service.ts,schedules.service.spec.ts,schedules.controller.ts,dto/query-schedule.dto.ts}`,
`codebase/frontend/src/app/(main)/schedules/{page.tsx,__tests__/schedules-page.test.tsx}`,
`codebase/frontend/src/lib/api/schedules.ts`, i18n dict, `spec/2-navigation/3-schedule.md`.

## 실험 방법

- backend: `if (triggerId) { qb.andWhere(...) }` 가드를 (a) 항상 실행되도록, (b) 항상 스킵되도록 임시 변형 후
  `cd codebase/backend && ../../node_modules/.bin/jest src/modules/schedules/schedules.service.spec.ts` 재실행 → 원복.
- frontend: `page.tsx`의 `...(focusTriggerId ? { triggerId } : {})` 스프레드, 배너 렌더 조건(`focusTriggerId && viewMode==="list"`)을
  각각 항상-true/항상-false 로 임시 변형 후
  `cd codebase/frontend && ../../node_modules/.bin/vitest run "src/app/(main)/schedules/__tests__/schedules-page.test.tsx"` 재실행 → 원복.
- 모든 실험 후 `git diff`/`git status`로 원본 상태 복원 확인 완료 (실험 파일 변경 없음, review 산출물 디렉토리만 untracked로 남음).

## 발견사항

- **[INFO]** backend `findAll` 의 `triggerId` 필터에 대한 컨트롤러/e2e 레벨 통합 테스트 부재
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts`, `dto/query-schedule.dto.ts`, `test/schedule-trigger.e2e-spec.ts`
  - 상세: unit(`schedules.service.spec.ts`)은 `QueryScheduleDto` 검증(`@IsUUID`)을 우회하고 서비스에 객체를 직접 전달한다. 실제 HTTP 경로에서 `GET /api/schedules?triggerId=<invalid-uuid>` 요청 시 전역 `CustomValidationPipe`가 400을 반환하는지, 정상 UUID 요청이 실제 DB JOIN 결과를 올바르게 필터링하는지 검증하는 e2e/컨트롤러 테스트가 없다. `schedule-trigger.e2e-spec.ts`에는 `triggerId` 쿼리 파라미터를 사용하는 케이스가 없다.
  - 제안: 필수는 아니나, e2e 스위트에 `GET /api/schedules?triggerId=<uuid>` 정상 케이스 1건과 `?triggerId=not-a-uuid` 400 케이스 1건을 추가하면 DTO validation·실제 SQL 필터링까지 end-to-end 로 보증된다.

- **[INFO]** FE 배너 표시가 `viewMode === "list"` 조건일 때만이라는 것을 검증하는 테스트 없음(calendar view 진입 시 배너 미표시 회귀 가드 부재)
  - 위치: `codebase/frontend/src/app/(main)/schedules/page.tsx:972` (`{focusTriggerId && viewMode === "list" && (...)}`)
  - 상세: 신규 4건 테스트는 모두 `viewMode` 를 건드리지 않아(기본 list 로 추정) `viewMode === "list"` 서브조건은 vacuous 하게 통과할 뿐 실제로 가드되는지 실험되지 않았다. 이 조건을 제거해도(즉 calendar 뷰에서도 배너가 뜨더라도) 현재 4건 중 아무것도 fail 하지 않을 가능성이 높다(직접 실험은 list-view 케이스만 확인함).
  - 제안: `viewMode`를 calendar 로 전환한 상태에서 `focusTriggerId` 가 있어도 배너가 안 뜨는 케이스를 하나 추가하면 완전해진다. 우선순위는 낮음(UI만 관련, 데이터 무결성과 무관).

## 검증된 사항 (결함 아님, 통과 확인)

- backend `findAll triggerId filter` 2건 모두 **non-vacuous** 확인:
  - "지정 시 필터 적용" 테스트: 가드를 스킵하도록(항상 andWhere 미호출) 바꾸면 fail.
  - "미지정 시 필터 미적용" 테스트: 가드를 제거(항상 andWhere 호출, `triggerId: undefined` 포함)하면 정확히 fail(`Received: ["t.id = :triggerId", {"triggerId": undefined}]`).
  - 원복 후 `jest schedules.service.spec.ts` 11/11 통과 재확인, `git status` clean.
- FE 신규 4건 모두 **non-vacuous** 확인, `apiGetMock.mock.calls`의 실제 `["/schedules", { params }]` 구조를 정확히 단언:
  - "param 전달" 테스트: `focusTriggerId` 스프레드 제거 시 fail.
  - "param 미전달" 테스트: `triggerId`를 상시 전송하도록 바꾸면 fail.
  - "배너 유" 테스트: 배너 렌더 조건 제거 시 `findByTestId` timeout 으로 fail.
  - "배너 무" 테스트: 배너를 상시 렌더하도록 바꾸면 fail(`queryByTestId` 가 non-null 반환).
  - `data-testid="schedules-clear-trigger-filter"` 는 `page.tsx`에 실제 존재하는 유효한 testid이며 다른 요소와 충돌하지 않음.
  - 원복 후 `vitest run schedules-page.test.tsx` 22/22 통과 재확인, `git status` clean.
- 기존 #833 계열 테스트(`highlights no row when ?triggerId= matches no schedule on the page`, `highlights no row when no ?triggerId= is present`, `does not blank-match a trigger-less schedule when ?triggerId= is empty` 등)는 이번 변경(파일 diff)에 의해 수정되지 않았고, 전체 22건 통과에 포함되어 회귀 없음 확인.
- i18n 키(`schedules.deepLink.filteredNotice`, `schedules.deepLink.showAll`)는 en/ko 양쪽 dict 에 동시 추가되어 있고 `page.tsx`의 `t()` 호출과 일치.
- `spec/2-navigation/3-schedule.md` §2.1, §4(API 표), Rationale 세 곳 모두 cross-page 필터 반영으로 갱신되어 코드와 정합.
- mock 구조(`makeQb`)는 TypeORM `QueryBuilder` 체이닝을 충실히 흉내내며(`andWhere` 를 별도로 캡처해 실제 SQL 절 문자열까지 단언), 과도한 mock 이나 실제 동작과의 괴리는 없음.
- 두 describe 블록(backend `findAll triggerId filter`, FE 신규 4건)은 각각 독립적인 `makeQb()`/`mockSchedulesResponse()`·`afterEach(cleanup)` 를 사용해 테스트 간 상태 누수 없이 격리됨.

## 요약

신규 backend 2건·FE 4건 테스트 모두 실제 가드/로직을 제거·반전하는 변형 실험으로 non-vacuous 함을 직접 확인했으며, 기존 #833 강조·blank-match 회귀 테스트도 그대로 유지되어 통과한다(FE 22/backend 11 재확인, 실험 후 전량 원복하여 git 상태 clean). 발견된 갭은 모두 INFO 수준으로, HTTP 계층(DTO validation·실제 SQL 필터링)의 e2e 커버리지 부재와 calendar-view 배너 억제 경로 미검증 정도이며, 어느 쪽도 현재 기능의 정확성을 훼손하지 않는 선택적 보완 사항이다.

## 위험도

NONE
