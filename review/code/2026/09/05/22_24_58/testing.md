# 테스트(Testing) 리뷰

이 PR 은 이미 4라운드(`18_23_02`·`19_08_18`·`20_45_37`·`21_40_37`)의 코드 리뷰 + 4라운드의
consistency 리뷰를 거쳤고, 그 라운드들이 지적한 테스트 갭(래칫 vacuity, `contractForDto`
메모이제이션 미검증, `allowMissing` 미검증, `findOneDetail` secret fixture 부재, 목록·PATCH
트리거 계약 미배선 등)은 실제로 이 라운드의 코드에 반영되어 있음을 `Read`/`grep`으로 직접
확인했다. 아래는 그 위에서 새로 발견한 갭이다.

## 발견사항

- **[WARNING]** `TriggersService.update()` 의 "PATCH 생략 필드가 `undefined` own-property 로
  존재해 로드된 값을 덮어쓴다" 수정에 대응하는 **unit 회귀 테스트가 없다** — 방어선이 e2e
  하나뿐이다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:371-380`
    (`Object.entries(rest).filter(([, v]) => v !== undefined)` → `Object.assign(trigger, defined, ...)`),
    대응 테스트 부재 자리는 `codebase/backend/src/modules/triggers/triggers.service.spec.ts` 의
    `update` 관련 `it()` 들(`:741-859`, `:2105-2175`, `:2415`, `:2623`).
  - 상세: 이 fix 는 `review/code/2026/09/05/21_40_37`에서 실측한 실제 버그(`target: ES2023`
    + `useDefineForClassFields` 로 DTO 의 미지정 optional 필드가 `undefined` own-property 로
    존재 → `Object.assign(trigger, rest)` 가 `trigger.name` 같은 기존 값을 `undefined` 로
    덮어씀 → PATCH 응답에서 `name` 이 사라짐)를 고친다. 그 RESOLUTION 은 "뮤턴트가 따로
    필요 없다 — 수정 전 상태가 곧 뮤턴트이고, 그 상태의 e2e 가 `name [missing]` 으로 RED 였다"
    고 적으며 **unit 테스트는 추가하지 않았다**. 실제로 `triggers.service.spec.ts` 를 전수
    확인한 결과, `update()` 를 필드 일부만 담은 PATCH(예: `{ isActive: false }`,
    `{ name: 'renamed' }` 뒤 다른 필드 검사 없음)로 호출하고 **응답의 다른 필드(`name` 등)가
    보존되는지 단언하는 테스트는 하나도 없다** — `line 741`의 유일하게 근접한 테스트도
    `{ name: 'new' }` 처럼 `name` 을 **명시적으로 포함**해서 보내므로 이 버그 클래스(생략된
    필드가 사라짐)를 재현하지 못한다. `.filter(([, v]) => v !== undefined)` 를 삭제하는
    뮤턴트를 넣으면 backend unit 전체가 GREEN 으로 남을 가능성이 높다(e2e 만 잡는다). e2e 는
    느리고 특정 트리거로만 돈다 — 이 클래스의 버그(스프레드/`Object.assign` 이 `undefined`
    own-property 로 덮어씀)는 유사 패턴이 있는 다른 서비스에도 재발할 수 있는 만큼, 빠른
    unit 계층에도 최소 1건("PATCH 가 `name` 을 생략하면 응답의 `name` 이 그대로 유지된다")을
    두는 편이 다음 회귀를 더 싸게 잡는다.
  - 제안: `triggers.service.spec.ts` 의 `update` 관련 describe 에 `{ isActive: false }` 처럼
    `name` 을 생략한 PATCH 를 보낸 뒤 `result.name` 이 로드된 원래 값과 같음을 단언하는 케이스
    1건을 추가한다.

- **[WARNING]** `TriggersService.findAll` 의 schedule enrichment 경로(`sanitizeForResponse` 를
  타는 두 번째 호출부)는 비밀 컬럼(`notificationSecretV2`/`chatChannelTokenV2`) 스트립을
  검증하는 unit fixture 가 없다 — 이번에 `findOneDetail` 에만 보강됐다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.spec.ts:322-489`
    (`describe('TriggersService.findAll — schedule 목록 enrichment (V-10)')`, `mockQb()` 로
    구성하는 트리거 fixture 3곳: `:402` 이하), 대비 대상은 새로 보강된
    `:196-256`(`findOneDetail` 의 두 신규 `it()`), 그리고 프로덕션 코드
    `codebase/backend/src/modules/triggers/triggers.service.ts:190-204`(`findAll` 안에서
    `sanitizeForResponse` 를 호출하는 두 분기)와 `:585`(`sanitizeForResponse` 정의).
  - 상세: 이번 diff 의 JSDoc(`triggers.service.spec.ts:189-195`)과 RESOLUTION 문서들은 "종전
    unit fixture 에 비밀 필드가 없어 스트립 로직을 통째로 되돌려도 그린이었다" 는 결함을
    **`findOneDetail` 한 자리**에 대해서만 고쳤다고 명시한다. 그런데 `sanitizeForResponse` 는
    `findAll` 안에서도 **동일하게** 호출된다(`:194`, `:203` — 한쪽은 schedule enrichment
    매핑 안, 한쪽은 매핑 없는 행). `findAll` 의 unit fixture(`mockQb([...])` 에 넘기는
    객체 3종, `:402-420`)는 `id`/`workspaceId`/`type`/`name` 만 있고
    `notificationSecretV2`/`chatChannelTokenV2` 를 채우는 곳이 전혀 없다 — `grep` 으로
    파일 전체를 확인한 결과 이 두 컬럼명이 `findAll` describe 블록 안에 한 번도 등장하지
    않는다. 즉 `findAll` 경로에서만 발생하는 스트립 회귀(예: 배열 매핑 쪽 `sanitizeForResponse`
    호출이 실수로 제거되거나 다른 함수로 바뀌는 경우)는 **unit 테스트로는 절대 못 잡는다** —
    e2e(`schedule-trigger.e2e-spec.ts` C-2, `assertMatchesContract(row, TriggerDto)`)만
    유일한 방어선이다. 이는 이 PR 이 반복적으로 스스로 지적해 온 "고친 자리 옆의 자매
    코드가 방치된다" 패턴과 같은 형태이고, 직전 라운드(`21_40_37/testing.md`)가 "unit 이
    비밀 fixture 로 잘 잠갔다" 고 적은 서술을 findAll 경로에는 적용할 수 없음을 실측이
    보여준다.
  - 제안: `findAll` 의 `mockQb()` fixture 중 최소 1건(예: `s-trig-1`)에
    `notificationSecretV2`/`chatChannelTokenV2` 를 채우고, `result.data` 에서 그 두 키가
    없음을 단언하는 케이스를 추가한다.

- **[INFO]** `schedules.controller.spec.ts` 의 `update` 테스트는 비밀 컬럼을 채운
  `scheduleWithSecretTrigger()` mock 을 반환하도록 설정해 두고도, 정작 컨트롤러 응답의
  `trigger` 형태를 단언하지 않는다 — 같은 파일의 `create` 테스트와 비대칭이다.
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.spec.ts:81-88`
    (`it('update 는 id·workspaceId·dto·userId 순서를 지킨다', ...)`), 대비 대상은
    `:59-79`(`create` 테스트 — `res.trigger` 의 키·비밀 부재를 양성으로 단언).
  - 상세: `beforeEach`(`:47-54`)가 `service.update` mock 을
    `scheduleWithSecretTrigger()`(트리거에 `notificationSecretV2`/`chatChannelTokenV2` 를
    채운 realistic mock)로 바꿔 두었지만, `update` 테스트 본문은
    `controller.update(...)` 의 **반환값을 변수로 받지도 않고** `service.update` 가
    올바른 인자로 불렸는지만 확인한다. 즉 이 mock 의 비밀 필드는 이 테스트에서 아무것도
    검증하지 않는 죽은 설정이다. `toResponse()` 가 `create`/`update`/`findOne`/`findAll`
    네 경로에서 공유되는 사설 메서드라 실질 위험은 낮고(같은 자리를 `create` unit +
    `schedule-trigger.e2e-spec.ts` 의 `D`/`C-3` PATCH 케이스가 덮는다), 다만 나란히 있는
    `create` 테스트가 이미 그 패턴(양성 단언)을 확립해 둔 만큼 `update` 도 같은 형태로
    맞추는 편이 "이 mock 이 왜 이렇게 정교한가" 를 읽는 사람에게 더 명확하다.
  - 제안: `update` 테스트에도 `controller.update(...)` 반환값을 받아 `create` 테스트와
    같은 3종 단언(`Object.keys(res.trigger).sort()` · `notificationSecretV2` 부재 ·
    `chatChannelTokenV2` 부재)을 추가하거나, 최소한 왜 생략했는지 주석으로 남긴다.

## 확인한 것 (재확인, 새 결함 아님)

- `response-contract.ts` 의 `allowMissing`(얕은 이름 vs 중첩 경로 구분) · `contractForDto`
  메모이제이션(동일 promise 재사용, 실패 promise 축출)은 각각
  `response-contract.spec.ts:205-260`·`:484-521` 에 전제/양성/음성 케이스가 갖춰져 있고
  vacuous 하지 않다(실패 축출 테스트는 같은 객체 참조를 재사용해 캐시 히트 여부를 실제로
  가른다).
- `swagger-dto-contract-guard.ts` 의 신규 §5.4 금지-조합 래칫(`findOptionalNullableResponseFields`)
  은 `swagger-dto-contract.spec.ts:483-505` 에서 실재하는 양성/음성 fixture
  (`optional-nullable.fixture.ts`)로 판별력을 직접 확인하고, 프로덕션 스캔 범위(`src/modules`)
  밖에 있어 베이스라인을 오염시키지 않음을 별도 테스트로 고정한다 — 종전 라운드가 지적한
  "존재하지 않는 fixture 참조로 인한 vacuous 통과"는 실제로 고쳐졌다.
- `triggers.service.spec.ts`·`schedules.controller.spec.ts`의 모든 신규/변경 `describe` 블록은
  `beforeEach` 로 매번 새 Nest 테스트 모듈을 부트스트랩해 테스트 간 상태 공유가 없다.
- `schedule-trigger.e2e-spec.ts` 는 스케줄 생성(활성/비활성)·단건 조회·목록·PATCH 네 경로
  전부에서 `assertMatchesContract` 를 배선했고(`:137,145,161,207,221,262,288,365`), 목록·PATCH
  트리거 엔드포인트의 계약 미배선(직전 라운드 지적)이 실제로 해소되어 있음을 확인했다.

## 요약

핵심 인프라(계약 검증자·§5.4 래칫·기존 e2e 배선)는 여러 라운드에 걸쳐 뮤테이션으로 검증되며
성숙했고, 이번 라운드에서 새로 도입된 코드에 대한 새 결함은 발견하지 못했다. 다만 두 군데
남은 **unit-only 커버리지 갭**을 확인했다 — 둘 다 e2e 로는 막혀 있지만(그래서 WARNING 이지
CRITICAL 은 아니다), unit 계층만 보면 규약이 반증하는 그 정확한 버그 클래스에 여전히
취약하다: (1) `TriggersService.update()` 의 "PATCH 생략 필드 → `undefined` 덮어쓰기" 수정에
대응하는 unit 회귀 테스트가 없고, (2) `TriggersService.findAll` 의 스케줄 enrichment 분기는
`findOneDetail` 과 달리 비밀 컬럼 스트립을 검증하는 unit fixture 가 없다 — 직전 라운드가
"unit 이 비밀 fixture 로 잘 잠갔다" 고 적었지만 그 서술은 `findAll` 에는 적용되지 않는다.
`schedules.controller.spec.ts` 의 `update` 테스트가 정교한 secret mock 을 준비해 두고도
응답을 단언하지 않는 비대칭은 INFO 수준이다.

## 위험도

MEDIUM
