# 변경 범위(Scope) 리뷰 — trigger-config-lost-update (14라운드, 01_42_04)

## 검토 방법

`git diff --stat origin/main...HEAD -- ':/codebase' ':/CHANGELOG.md'` 로 실제 코드 변경
18개 파일을 확인하고, 프롬프트에서 diff 가 생략된 파일은 `git show <commit> -- ':/<path>'`
로 원본을 직접 열어 대조했다. 이번 라운드(01_42_04)가 새로 보는 변경분은 직전 라운드
(`review/code/2026/09/15/01_09_53`) 이후의 마지막 커밋 `6ebc760d1`
("형제 경로엔 있고 여기엔 없던 것 — 상한 단언·반쯤 삭제 로깅") 하나이므로, 그 커밋의 실제
diff(`CHANGELOG.md` · `schedules.service.ts` · `schedules.service.spec.ts` ·
`trigger-transaction-mock.ts` · `plan/in-progress/trigger-config-lost-update.md`)를 커밋
메시지와 1:1로 대조했다. 나머지 224개 파일(전 라운드 `review/code/**`·`review/consistency/**`
산출물)은 이 저장소의 강제 워크플로(`consistency-check --impl-prep`, `/ai-review` 반복)가
남긴 이력 산출물이며 코드가 아니다.

## 발견사항

- **[INFO]** 최신 커밋(`6ebc760d1`)은 커밋 메시지가 약속한 범위와 정확히 일치한다
  - 위치: `codebase/backend/src/modules/schedules/schedules.service.ts`
    (`Logger` import·필드 추가, `remove()` 의 trigger 삭제 트랜잭션에 `.catch` 로깅 추가),
    `codebase/backend/src/modules/schedules/schedules.service.spec.ts`(락 순서 배열
    단언 + 실패 로깅 테스트 1건 신규), `codebase/backend/src/modules/triggers/__test-utils__/trigger-transaction-mock.ts`
    (JSDoc 의 "2 감쌈/4 안 감쌈" → "3 감쌈/3 안 감쌈" 숫자 정정), `CHANGELOG.md`(삭제 경로
    상한 서술을 "하나"에서 "둘"로 정정)
  - 상세: 커밋 메시지가 W1(락 순서·상한 미검증)·W2(반쯤 삭제 로깅 부재)·W3·W4(문서 두 문단이
    다른 집합을 가리킴)로 예고한 항목과 실제 diff 가 정확히 대응한다. `SchedulesService`
    쪽의 변경은 이미 `TriggersService.remove()` 에 존재하는 대칭 패턴(락 획득 상한 로깅·
    실패 시 `logger.error`+재던지기)을 형제 경로에 맞추는 것으로, 새 기능이나 새 설계
    결정이 아니다. import 추가(`Logger`)도 신규 사용처가 있어 정당하다. 무관한 리팩토링,
    포맷팅 전용 변경, 불필요한 주석/임포트 정리는 발견되지 않았다.
  - 제안: 조치 불요.

- **[INFO]** 누적 diff(18개 코드 파일, `+2338/-164`)는 여전히 단일 결함 클래스(트리거
  config lost-update + 그로 인한 인입 서명 fail-open)의 수정으로 좁게 유지된다
  - 위치: `plan/in-progress/trigger-config-lost-update.md` §A~§D, 14라운드 처분 이력
  - 상세: `chat-channel-binder.service.ts`·`trigger-config-lock.ts`(신규)·
    `triggers.service.ts`·`hooks.service.ts`·`schedules.service.ts` 다섯 프로덕션 파일과
    이에 대응하는 테스트·e2e·정적 가드(`endpoint-path-conflict-wrap-guard.ts`) 갱신이
    전부다. `endpoint-path-conflict-wrap-guard.ts`/`-wrap.spec.ts`/`endpoint-path-save.fixture.ts`
    변경은 "요청하지 않은 정적 가드 확장"처럼 보일 수 있으나, 본 PR 이 `save(trigger)` 를
    `manager.transaction` 안으로 옮기면서(창 1 을 락 안으로 넣는 필연적 변경) 수신자 이름이
    `this.triggerRepository` → `m` 으로 바뀌어 기존 가드가 오탐(래핑이 있는데 없다고 읽음)을
    냈고, 그 가드를 못 고치면 이 PR 자체가 회귀로 막힌다 — 파생적으로 필수인 변경이다.
  - 제안: 조치 불요.

- **[INFO]** plan(`in-progress/trigger-config-lost-update.md`)·과거 라운드 산출물
  (`review/code/2026/09/15/01_09_53/*`, `review/consistency/2026/09/14/17_10_16/*`)이
  코드와 같은 changeset 에 포함
  - 위치: 위 나열 파일들
  - 상세: 이 저장소의 developer 워크플로 규약이 `consistency-check --impl-prep`·
    `/ai-review` 산출물을 `review/**`(gitignore 대상 아님)에 남기고 plan 을
    `plan/in-progress/`에 두도록 강제한다. 14라운드에 걸친 반복 fix→review 루프의 이력이며,
    스코프 이탈이 아니라 규약이 요구하는 동반 아티팩트다(이전 라운드 scope 리뷰들도 동일하게
    판정).
  - 제안: 조치 불요.

- **[INFO]** 워킹트리에 커밋되지 않은 변경 2건 관찰 — 이번 diff(리뷰 대상) 밖이지만 기록
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md`(원본 트래커 항목을
    `[ ]` → `[x]` + "2026-09-15 해소" 각주로 정정), `plan/in-progress/trigger-config-lost-update.md`
    (동일 세션의 추가 편집으로 보임)
  - 상세: `git status --short` 로 관측했다. 이 변경은 프롬프트의 diff(=review 대상 커밋
    범위) 안에 없으므로 이번 라운드의 채점 대상은 아니지만, 내용은 오히려 이 PR 의 plan
    체크리스트가 이미 약속한 항목("트래커 항목 `[x]` + 실측 각주")과 13라운드 전 rationale_continuity
    리뷰가 권고한 항목("완료 시 원 트래커 체크박스를 실제로 같이 닫아라")을 정확히 이행하는
    것이라 스코프 이탈이 아니다. 다만 아직 커밋되지 않았으므로, 이 세션이 최종 커밋을 만들 때
    코드 커밋과 분리해 plan-only 커밋으로 반영해야 한다(리뷰 이후 plan 이동 관례와 일치).
  - 제안: 다음 커밋에서 이 두 plan 파일을 함께 커밋할 것. 코드 변경은 없으므로 fresh-review
    요구는 발생하지 않는다.

이 외에 요청 범위를 벗어난 기능 확장, 무관한 파일·설정 수정, 포맷팅 전용 변경은 발견되지
않았다.

## 요약

이번 라운드(14차, 01_42_04)가 새로 반영하는 유일한 코드 변경은 커밋 `6ebc760d1` 하나이며,
그 diff 는 커밋 메시지가 예고한 4개 항목(schedules 삭제 경로의 락 순서/상한 테스트 보강,
실패 시 반쯤-삭제 로깅 추가, CHANGELOG·mock JSDoc 의 낡은 숫자 서술 정정)과 정확히 일치한다
— 형제 경로(`TriggersService.remove()`)에 이미 있던 패턴을 `SchedulesService.remove()`
에 대칭적으로 맞추는 수정으로, 새 설계나 기능 확장이 아니다. 누적 diff 전체(18개 코드
파일)도 여전히 "동시 PATCH 로 인한 trigger.config lost-update / 인입 서명 fail-open" 이라는
단일 결함 클래스 수정에 좁게 머물러 있고, 정적 가드 확장(`endpoint-path-conflict-wrap-guard.ts`)
도 핵심 수정(창 1 을 트랜잭션 안으로 이동)이 필연적으로 요구하는 파생 변경이다. `review/**`·
`plan/**` 동반 파일은 이 저장소의 강제 워크플로 산출물이라 스코프 이탈로 보지 않는다. 워킹
트리에 남은 미커밋 plan 갱신 2건은 이번 diff 밖이지만 내용상 이 PR 이 스스로 약속한 트래커
종결 작업이라 문제가 아니며, 최종 커밋에 포함할 것을 권고한다. 범위 이탈·불필요한 리팩토링·
과도한 기능 확장·무관한 수정·의미 없는 포맷팅/주석/임포트/설정 변경은 발견되지 않았다.

## 위험도

NONE
