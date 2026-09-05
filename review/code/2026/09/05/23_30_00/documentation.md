# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** `SchedulesController.toResponse()` 의 인라인 주석이 여전히 "생성·수정 양쪽 다 `trigger.workflow` 가 로드되지 않는다" 는 **이미 반증된** 옛 서술을 담고 있다 — 같은 PR 이 두 DTO 파일에서 정확히 이 문장을 "생성 응답에만 없다(수정은 로드된다)" 로 고쳤는데, 컨트롤러의 자매 주석은 갱신되지 않았다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts:74` (`// 반면 \`trigger.workflow\` 는 **키 생략형**이다 — 생성·수정 경로에서는 로드되지 않는다.`)
  - 상세: 이 PR 의 마지막 커밋(`48704becd`, `--ai-review 22_48_39` W3 조치)은 `schedule-response.dto.ts:37-43` 의 `ScheduleTriggerRefDto.workflow` JSDoc 을 "**생성 응답에만 없다.** … 조회(`findById`)와 **수정**(`update()` 가 `findById` 로 시작한다)에는 채워진다 … 종전 이 주석은 *"생성·수정 응답에는 로드되지 않는다"* 고 적었는데 **수정 쪽이 틀렸다**" 로 명시적으로 정정했다(`trigger-response.dto.ts:93` 도 동일하게 정정됨). 그런데 같은 파일 트리 안, 바로 이 형태를 실제로 조립하는 `schedules.controller.ts:74` 의 주석은 옛 서술("생성·수정 경로에서는 로드되지 않는다")을 그대로 두고 있다. `git blame` 으로 확인하면 이 줄은 `7e85da873f`(22:24:50, "계약 대조를 목록·PATCH 로 넓히자 drift 2건이 나왔다")가 추가했고, 그 뒤 23:29:52 의 정정 커밋이 이 줄을 건드리지 않았다. 실제 동작도 DTO 쪽 정정이 맞다 — `schedules.service.ts:129` 의 `findById` 가 `relations: ['trigger', 'trigger.workflow']` 를 로드하고, `update()`(`schedules.service.ts:276` 부근)는 `findById` 로 시작하므로 PATCH 응답에도 `trigger.workflow` 가 채워진다. 즉 `schedules.controller.ts:74` 는 지금 코드가 실제로 하는 일과 반대로 "수정 응답에도 없다" 고 다음 독자에게 알려준다 — 이 PR 이 스스로 "같은 실수를 여러 번 했다" 고 반성하며 두 곳을 고친 바로 그 오류가 세 번째 자리에 남아 있는 형태다.
  - 제안: `schedules.controller.ts:74` 를 "`trigger.workflow` 는 **키 생략형**이다 — **생성 응답에만 없다**(`create()` 는 방금 저장한 트리거를 붙여 관계가 로드되지 않는다). 조회·수정에는 채워진다." 로 정정한다. `ScheduleTriggerRefDto` JSDoc 과 문구를 맞추면 다음에 한쪽만 갱신되는 재발을 줄일 수 있다.

- **[INFO]** `swagger-dto-contract-guard.ts` 의 신설 export 함수 `findOptionalNullableResponseFields` 자체에는 파라미터·반환값을 설명하는 JSDoc 이 없다 — 바로 위 `OptionalNullableOffender` 인터페이스에 큰 배경 설명 블록이 있고 `isResponseDtoFile` 에도 한 줄 설명이 있지만, 실제로 스캔을 수행하는 이 함수는 무주석이다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract-guard.ts:264` (`export function findOptionalNullableResponseFields(...)`)
  - 상세: 이 파일의 다른 export 함수들(`findSwaggerContractMismatches`, `findNumericAsNumber`, `scanNumericExposure`)은 대체로 함수 선언 바로 위에 JSDoc 을 두는 관례를 따르는데, 이 함수만 그 관례에서 벗어나 있다. 위 인터페이스의 JSDoc 이 "왜 이 축이 필요한가/래칫이 어떻게 동작하는가"는 충분히 설명하지만, 함수 자체의 계약(입력 `files`/`srcRoot`, 반환 배열의 정렬 여부·중복 처리 등)은 코드를 직접 읽어야 알 수 있다.
  - 제안: 급하지 않음. 다음에 이 함수를 수정할 일이 생기면 짧은 한 줄 JSDoc(`/** 응답 DTO 전수에서 §5.4 금지 조합(required:false + nullable:true)을 찾는다. */`)을 추가하는 것을 고려.

## 요약

이 라운드가 리뷰하는 마지막 커밋(`48704becd`, 23:29:52)은 직전 6라운드의 코드 리뷰·2라운드의 consistency 리뷰가 지적한 문서화 결함(JSDoc-대상 분리 4회 재발, `contractForDto` 캐시 격리 단위 오기술, `ScheduleTriggerRefDto`/`TriggerWorkflowRefDto` 의 "update() 도 workflow 를 로드하지 않는다" 는 틀린 서술, plan 트래커의 "23필드가 금지 조합" 합산 오류, CHANGELOG 의 `appUrl` 형태 서술 등)을 대부분 실제로 바로잡았음을 `Read`/`git blame`/직접 실행 대조로 확인했다. `response-contract.ts`, `triggers.service.ts` 의 4개 strip 상수, DTO 파일들의 JSDoc 은 현재 대상 선언 바로 위에 정확히 붙어 있고, CHANGELOG 의 "78건"·"17개" 등 정량 서술도 실제 `EXPECTED_OPTIONAL_NULLABLE_DRIFT` 배열 길이·가드 JSDoc 서술과 일치한다. 다만 이 최종 커밋이 두 DTO 파일에서 정정한 "생성 응답에만 `workflow` 가 없다(수정에는 있다)" 는 사실이 그 값을 실제로 조립하는 `SchedulesController.toResponse()` 의 인라인 주석에는 반영되지 않은 채 남아 있다 — 이 PR 이 반복적으로 자기 지적한 것과 정확히 같은 유형(서술이 코드 변경을 못 따라간 stale 주석)의 새 사례이며, 어느 리뷰 라운드도 이 자리를 짚지 않았다. 기능 영향은 없다(코드 자체는 옳게 동작한다) — 순수 문서 정확성 문제다.

## 위험도

LOW
