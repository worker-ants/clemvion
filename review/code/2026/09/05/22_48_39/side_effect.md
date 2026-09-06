# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `contractForDto()` 가 module-level 가변 `Map`(`contractCache`)을 새로 도입해, 함수를 `async function`(호출마다 새 probe 부트스트랩)에서 **결과를 캐시하는 일반 함수**로 바꿨다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts:386`(`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), `contractForDto` 본문(`:412-425`).
  - 상세: DTO 클래스(참조 동일성)를 키로 진행 중/완료된 `Promise<DtoContract>` 를 캐시한다. `src`/`test` 전체에서 이 모듈은 `.spec.ts`/`.e2e-spec.ts` 파일에서만 import 되는 것을 확인했다(프로덕션 런타임 경로 아님). 실패한 promise 는 `.catch` 에서 `contractCache.delete(Dto)` 후 rethrow 하므로 영구 실패로 굳지 않는다(`response-contract.spec.ts` 의 "실패한 promise 는 캐시에 남지 않는다" 테스트가 이를 회귀 고정). JSDoc 은 "격리 단위는 테스트 파일"(Jest 가 파일마다 모듈 레지스트리를 새로 만듦)이라 명시한다. `DtoContract`/`schema` 는 현재 어떤 호출부에서도 읽기 전용으로만 소비되어(`assertMatchesContract`, `findContractViolations`) 변형 경로는 없다.
  - 제안: 조치 불요(테스트 전용, 회귀 테스트·문서화 존재, 반환값이 현재 immutable 하게 소비됨). 향후 반환된 `DtoContract`/`schema` 를 변형하는 코드가 추가되면 같은 파일 내 다른 `it()` 로 조용히 새어 나갈 수 있으니, 그 시점엔 `Object.freeze` 또는 JSDoc 에 "반환값 불변" 명시를 고려.

- **[INFO]** `SchedulesController`/`TriggersService` 응답 경계 축소로 `GET/POST/PATCH /api/schedules(:id)`·`GET/POST/PATCH /api/triggers(:id)` 의 wire 응답 형태가 바뀐다 (공개 API 인터페이스 변경).
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts`(`toResponse` 신설 — 진입점 66행 부근, 4개 핸들러 `findAll`/`findOne`/`create`/`update` 에서 호출), `codebase/backend/src/modules/triggers/triggers.service.ts`(`sanitizeForResponse` 의 `workflow` 필드 좁히기 + 이번 diff 에서 추가된 `INTERACTION_RESPONSE_STRIP_KEYS` 로 `config.interaction.triggerToken` 도 제거).
  - 상세: 종전 `schedule.trigger`/`trigger.workflow` 는 조인된 엔티티 전체(비밀 컬럼 포함)를 그대로 실었는데, 이제 `trigger`→`{id, name, workflowId, workflow?}`, `workflow`→`{id, name}` 로 좁혀지고, `trigger.config.interaction.triggerToken`(영구 평문 bearer 토큰)도 이번 diff 의 마지막 커밋에서 추가로 제거된다. 이는 응답을 소비하던 임의의 클라이언트에게는 필드 제거로 관측될 수 있는 breaking change 다. CHANGELOG.md(신규 섹션)가 FE 소비처 전수 실측(`schedules/page.tsx`·`triggers/page.tsx`)과 함께 "이미 나간 것은 회수되지 않는다 — 로테이션 권고" 경고를 명시하고 있어 은닉된 변경은 아니다.
  - 제안: 조치 불요(의도된 보안 수정, 문서화·경고 존재). API 계약 관점 판정은 `api_contract.md`/`security.md` 리뷰어와 교차 확인 권장.

- **[INFO]** `TriggersService.update()` 의 `Object.assign(trigger, rest, {...})` → `Object.assign(trigger, defined, {...})` (`defined` = `rest` 에서 `undefined` 값 필드를 필터링)로, 로드된 엔티티 필드를 더 이상 `undefined` 로 덮어쓰지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 내 `const defined = Object.fromEntries(...)` 및 다음 줄 `Object.assign(trigger, defined, { config: mergedConfig });`.
  - 상세: 버그 수정(부분 PATCH가 명시되지 않은 필드를 `undefined` 로 덮어써 응답에서만 사라지던 문제, DB 는 TypeORM 이 undefined 를 skip 해 무사)이다. `trigger` 에 대한 in-place mutation 패턴(load → assign → save) 자체는 기존과 동일해 새 부작용 클래스는 아니다. `rest`/`defined` 는 이 메서드 스코프 로컬이라 다른 공유 상태를 건드리지 않는다. `triggers.service.spec.ts` 에 "PATCH 에서 생략된 필드는 로드된 값을 유지한다" 회귀가 추가돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `TriggersService.sanitizeForResponse()` 의 조기 return 제거로, 정화할 것이 없는 트리거도 이제 항상 `Object.assign` 을 거쳐 **새 객체 참조**를 반환한다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse()` JSDoc("**엔티티를 변경하지 않는다 — 항상 새 객체를 돌려준다**… 호출부는 참조 동일성을 전제하지 말 것") 및 본문.
  - 상세: 코드 자신이 이 사실을 문서화하고 있어 은닉된 변경이 아니다. 호출부(`findAll`/`findOneDetail`/`create`/`update`)를 확인한 결과 반환값을 `===` 비교하거나 캐시 키로 쓰는 곳은 없다.
  - 제안: 조치 불요.

- **[INFO]** 이번 diff 의 마지막 커밋(`66a2510fd`)이 `ScheduleDto.trigger` **필드** JSDoc 안에 있던 내부 리뷰 경로 참조(`review/consistency/... W1`)를 `//` 라인 코멘트로 옮겼다 — 필드 JSDoc 은 `introspectComments` 를 통해 **공개 OpenAPI `description`** 으로 노출되기 때문(클래스 JSDoc 과 달리 승격된다).
  - 위치: `codebase/backend/src/modules/schedules/dto/responses/schedule-response.dto.ts` — `ScheduleDto.trigger` 필드 바로 위 주석 블록(`trigger: ScheduleTriggerRefDto;` 선언 직전).
  - 상세: 커밋 전 상태였다면 내부 리뷰 산출물 경로 문자열이 공개 API 문서(Swagger UI 등)에 노출됐을 것 — 사용자에게 무관한 내부 정보 유출이다. 이번 diff 자체가 이를 인지하고 고친 것으로, **새로 만든 문제가 아니라 같은 diff 안에서 도입 후 수정된 것**이다. 다른 4개 DTO(`alert-rule`, `integration`, `knowledge-base`, `trigger` response dto)에 반복되는 "이미 응답에 실려 나가고 있었다…" 서술 블록은 **클래스 필드가 아니라 필드 그룹 상단의 `//` 코멘트**로 이미 작성돼 있어 같은 문제가 없음을 확인했다.
  - 제안: 조치 불요(이미 고쳐짐). 향후 응답 DTO 필드에 `/** */` JSDoc 을 추가할 때 내부 경로·리뷰 참조를 넣지 않도록 하는 체크리스트 항목화를 고려할 수 있음(사소, 차단 사유 아님).

## 조사했으나 문제 없음으로 판정한 항목

- `response-contract.ts` 의 `allowMissing` 옵션 신설 — `ContractCheckOptions` 에 필드 추가 + `assertMatchesContract`/`findContractViolations` 세 번째 인자에 기본값 `{}` 부여. 기존 호출부(옵션 미전달)는 동작 불변 — 시그니처 확장은 하위 호환.
- `contractForDto` 를 `async function` → 캐시하는 일반 함수로 변경 — 반환 타입은 여전히 `Promise<DtoContract>` 이고 모든 실제 호출부가 `await contractForDto(...)` 형태라 시그니처 변경의 관측 가능한 영향 없음.
- `TRIGGER_RESPONSE_STRIP_COLUMNS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`INTERACTION_RESPONSE_STRIP_KEYS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` — 전부 module-level `readonly`/`Set` 상수, 런타임 mutate 지점 없음.
- `schedules.service.ts` 의 `saved.trigger = savedTrigger`(create)/`saved.trigger = trigger ?? schedule.trigger`(update) 를 `if (isActive)` 블록 밖으로 옮긴 것 — `saved` 는 함수 로컬 스코프의 갓 생성된 반환 객체이고, `registerJob`/`removeJob` 은 각각 `saved`(트리거 포함 객체)·`saved.id` 만 소비해 이동으로 인한 하류 부작용 없음을 확인.
- `swagger-dto-contract-guard.ts` 의 `findOptionalNullableResponseFields` 신규 `fs.readFileSync` — repo-guard 테스트 전용 정적 분석기, 파일을 읽기만 하고 쓰지 않으며 스캔 범위가 `src/modules` 로 한정돼 프로덕션 런타임 경로가 아님.
- `optional-nullable.fixture.ts` 신규 파일 — repo-guard 테스트 양성 대조군으로만 참조되고, 래칫의 실제 스캔 범위(`src/modules`) 밖에 있어 프로덕션 베이스라인을 오염시키지 않음(테스트로 확인됨).
- 14개 e2e 스펙에 추가된 `assertMatchesContract(...)`/`contractForDto(...)` 호출 — 순수 읽기·단언이며 네트워크 호출·환경 변수 접근·파일 쓰기 없음.
- DB 마이그레이션·엔티티 스키마 변경 없음(`git diff origin/main...HEAD --name-only | grep migrat` 결과 없음) — 이번 DTO 필드 추가는 전부 이미 존재하는 컬럼/파생값의 선언 보정이라 wire 형태 자체는 불변.
- 조사 중 저장소 파일을 직접 수정하지 않았음 — `git status --short` 결과 이번 리뷰 세션 자신의 출력 디렉터리(`review/code/2026/09/05/22_48_39/`, `review/consistency/2026/09/05/22_48_40/`)만 untracked 로 나타나며, 소스 파일 변경 없음.

## 요약

이 diff(§5.4 응답-계약 검증자 배선 확대 + 트리거 회전 secret/영구 토큰 유출 수정)에서 실질적인 신규 전역 상태는 `response-contract.ts` 의 테스트 전용 `contractCache`(module-level `Map`) 하나이며, 프로덕션 코드에서 import 되지 않고 문서화·회귀 테스트가 갖춰져 있어 위험이 낮다. `SchedulesController`/`TriggersService` 의 응답 경계 축소(`trigger`/`workflow`/`interaction.triggerToken` narrowing)는 공개 API 인터페이스를 바꾸는 breaking change 이지만, PR 자체가 소비처 전수 실측과 CHANGELOG 경고로 그 영향을 명시적으로 문서화해 은닉된 부작용이 아니다. `TriggersService.update()` 의 `Object.assign` 필터링과 `sanitizeForResponse()` 의 조기 return 제거는 각각 의도된 버그 수정과 문서화된 참조 동일성 변경이며 호출부 영향이 확인되지 않았다. 이번 diff 의 마지막 커밋이 필드 JSDoc → 공개 OpenAPI description 유출 경로 하나를 스스로 발견해 고쳤다(새로 만든 문제 아님). 파일시스템 쓰기, 환경 변수 조작, 의도치 않은 네트워크 호출, DB 마이그레이션, 이벤트/콜백 배선 변경은 관측되지 않았다.

## 위험도

LOW
