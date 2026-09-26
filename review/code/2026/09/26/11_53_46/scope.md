# 변경 범위(Scope) 리뷰 — forbidden-desc-codes

## 검토 요약

32개 파일, 843줄 추가 / 180줄 삭제. 커밋 이력(`175387b65`, `b03432baa`)이 밝히는 의도는 명확히 하나다 —
"`@ApiForbiddenResponse` 설명이 `RolesGuard` 가 낼 수 있는 거부 코드(`NOT_A_MEMBER`/`EDITOR_REQUIRED`/
`ADMIN_REQUIRED`/`OWNER_REQUIRED`)를 전부 싣는다" (129곳 수정) + 그것을 회귀 못 하게 지키는 reflection
저장소 가드 신설. 24개 컨트롤러의 변경분을 표본 검토한 결과 전부 이 의도 하나로 수렴한다 — 문자열 리터럴
403 `description` 을 공용 헬퍼 호출(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole(role)`)로 치환하고,
그 심볼을 쓰기 위한 import 추가뿐이다. 로직·라우트·데코레이터·응답 스키마는 건드리지 않았다.

## 발견사항

- **[INFO]** `lowestRequiredRole` 를 `roles.guard.ts` 에서 `workspace-roles.ts` 로 추출
  - 위치: `codebase/backend/src/common/constants/workspace-roles.ts:36` (신설), `codebase/backend/src/common/guards/roles.guard.ts:222` (호출부로 교체)
  - 상세: "403 설명 수정" 범위를 살짝 넘는 소규모 리팩터로 보일 수 있으나, 신설되는 reflection 가드
    (`forbidden-response-codes-guard.ts:135`)가 `RolesGuard.assertMember` 와 **동일한 문턱 계산**을 써야
    모델과 실제 가드가 갈리지 않는다는 근거가 함수 docstring(`workspace-roles.ts:30-32`)과 가드 파일
    docstring(`forbidden-response-codes-guard.ts:112-124`)에 명시돼 있다. 순수 함수 이동이고 동작 변경은
    없다(호출부 `roles.guard.ts:222`는 `reduce` 인라인을 함수 호출로 바꾼 것뿐). 이 작업(신규 가드)의 전제
    조건이라 범위 이탈로 보지 않는다.
  - 제안: 없음 — 근거가 코드에 남아 있어 향후 리뷰어가 "왜 옮겼나"를 추적할 수 있다.

- **[INFO]** `workflow-test-datasets.controller.ts` 의 두 곳(`update`/`remove`)은 단순 상수 치환이 아니라
    설명 문구 자체가 바뀌었다
  - 위치: `codebase/backend/src/modules/workflow-test-datasets/workflow-test-datasets.controller.ts` —
    diff 게이트 99, 119 (`@ApiForbiddenResponse({ description: '${forbiddenForRole('editor')}, 또는 데이터셋 소유자가 아님(FORBIDDEN — 서비스 판정)' })`)
  - 상세: 종전 문구는 `'소유자 아님'` 뿐이었고 `@Roles('editor')` 가 낼 수 있는 `EDITOR_REQUIRED`/`NOT_A_MEMBER`
    코드가 아예 빠져 있었다. 새 문구가 `forbiddenForRole('editor')` 를 앞에 붙인 것은 바로 이 PR 의 본
    목적("가드가 낼 수 있는 코드를 전부 싣는다")과 정확히 일치한다. 덧붙인 `FORBIDDEN` 코드도
    `workflow-test-datasets.service.ts:138` 에서 실제로 던지는 값과 일치함을 확인했다 — 지어낸 코드가
    아니다. 범위 내 정당한 수정으로 판단.
  - 제안: 없음.

- **[INFO]** import 순서 사소한 불일치
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` diff 게이트 34-35
    (`forbiddenForRole,\n  FORBIDDEN_NOT_A_MEMBER,`) — 다른 대다수 파일은 `FORBIDDEN_NOT_A_MEMBER` 를
    먼저 적었다.
  - 상세: 129곳에 걸친 기계적 치환이라 파일마다 import 나열 순서가 살짝 갈린다. 동작에 영향 없고
    lint 규칙 위반도 아니라(확인: 두 심볼 다 사용됨) 순수 스타일 편차 — 범위 위반은 아니다.
  - 제안: 없음. 언급만 해 둔다.

- **[INFO]** `integrations.controller.ts` / `workspaces.controller.ts` 에서 로컬 상수
    (`FORBIDDEN_MEMBER`, `FORBIDDEN_MEMBER_ROUTE`, `FORBIDDEN_ADMIN_ROUTE`, `FORBIDDEN_OWNER_ROUTE` 등)
    와 그 상수가 쓰던 `NOT_A_MEMBER` import 를 제거
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` diff 게이트 95-97,
    `codebase/backend/src/modules/workspaces/workspaces.controller.ts` diff 게이트(삭제 블록, `FORBIDDEN_MEMBER_ROUTE` 등)
  - 상세: 두 컨트롤러는 이미 컨트롤러-로컬로 "가드 코드를 상수에서 보간" 패턴을 손으로 구현해 두고
    있었다. 이번 변경은 그 로컬 구현을 신설 공용 헬퍼로 교체한 것 — PR 동기(문서에 적힌 "형식이
    컨트롤러마다 갈렸다")와 정확히 일치하는 통합이라 불필요한 리팩터가 아니라 이 작업의 핵심이다.
  - 제안: 없음.

## 요약

129곳의 403 `description` 치환 + 그 뒤를 받치는 공용 헬퍼 2개(`FORBIDDEN_NOT_A_MEMBER`,
`forbiddenForRole`) 신설 + reflection 저장소 가드 신설 + 가드와 신설 모듈이 공유해야 하는
`lowestRequiredRole` 추출, 이 네 조각이 전부 하나의 목표("403 설명이 가드 거부 코드를 빠짐없이
싣는다")로 수렴한다. 표본 검토한 24개 컨트롤러 diff는 예외 없이 (a) 헬퍼 심볼 import 추가, (b) 리터럴
문자열 → 헬퍼 호출 치환 두 종류의 hunk 뿐이었고, 로직·라우트·인가 분기·응답 스키마·무관 파일에는
손대지 않았다. 유일하게 "단순 치환을 넘는" 두 지점(`lowestRequiredRole` 추출, `workflow-test-datasets`
문구 변경)도 각각 신설 가드의 전제 조건이거나 PR 목적 그 자체와 일치해 범위 이탈로 보지 않는다.
포매팅·주석·설정 파일 변경, 요청 밖 기능 확장, 무관한 파일 수정은 발견되지 않았다.

## 위험도
NONE
