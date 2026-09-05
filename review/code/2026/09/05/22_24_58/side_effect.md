# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `contractForDto()` 가 module-level 가변 `Map` (`contractCache`) 을 새로 도입해, 함수를 `async function`(호출마다 새 probe 부트스트랩) 에서 **결과를 캐시하는 일반 함수**로 바꿨다.
  - 위치: `codebase/backend/src/shared/testing/response-contract.ts` — `contractCache` 선언부(`const contractCache = new Map<Type<unknown>, Promise<DtoContract>>();`), `contractForDto` 함수 본문.
  - 상세: 이전에는 `contractForDto` 가 매번 `Nest` 테스트 모듈을 새로 부트스트랩해 신선한 `DtoContract` 를 반환했다. 이번 변경은 DTO 클래스(참조 동일성)를 키로 하는 module-level `Map` 에 진행 중/완료된 Promise 를 캐시해, 같은 파일 안의 반복 호출이 **같은 객체 인스턴스**를 공유하게 만든다. `DtoContract`/`schema` 는 현재 어느 호출부에서도 읽기 전용으로만 쓰이므로(변형 없음) 실질적 오염 경로는 확인되지 않았고, JSDoc 은 "격리 단위는 테스트 파일"(Jest 모듈 레지스트리가 파일마다 새로 생김)이라고 명시하며 실패한 Promise 는 캐시에서 제거해 영구 실패를 피한다. 다만 이는 **테스트 헬퍼 모듈에 새 전역 가변 상태를 도입**한 것이며(점검 관점 #1·#2), 향후 누군가 반환된 `DtoContract` 를 변형하는 코드를 추가하면 같은 파일 내 다른 `it()` 블록으로 그 변형이 조용히 새어 나갈 수 있다.
  - 제안: 현재 위험은 낮음(테스트 전용, 문서화·회귀 테스트 존재 — RESOLUTION.md 에 메모이제이션 테스트 2건 추가 기록). 다만 `DtoContract`/`schema` 를 반환 시 `Object.freeze` 하거나, JSDoc 에 "반환값을 변형하지 말 것"을 명시적으로 못 박아 두면 향후 회귀를 원천 차단할 수 있다.

- **[INFO]** `SchedulesController`/`TriggersService` 응답 경계 변경으로 `GET/POST/PATCH /api/schedules(:id)`·`GET/POST/PATCH /api/triggers(:id)` 의 wire 응답 형태가 좁아진다 (인터페이스 변경).
  - 위치: `codebase/backend/src/modules/schedules/schedules.controller.ts` (`toResponse` 신설 및 4개 핸들러에서 호출), `codebase/backend/src/modules/triggers/triggers.service.ts` (`sanitizeForResponse` 의 `workflow` 필드 좁히기).
  - 상세: 종전에는 `schedule.trigger`/`trigger.workflow` 가 조인된 엔티티 전체(비밀 컬럼 포함)를 그대로 실어 보냈는데, 이제 `trigger`→`{id, name, workflowId, workflow?}`, `workflow`→`{id, name}` 로 좁혀진다. 이는 기존에 응답을 소비하던 임의의 클라이언트(FE 외 다른 소비자가 있었다면)에게는 **필드 제거**로 관측될 수 있는 breaking change다. 다만 PR 자체(CHANGELOG.md, `schedules.controller.ts`/`trigger-response.dto.ts` 주석, `schedules.controller.spec.ts`)가 FE 소비처를 전수 실측(`schedules/page.tsx` 4곳, `triggers/page.tsx` 2곳)했고, 보안 목적(회전 secret 유출 차단)의 의도된 축소라고 명시하고 있어 은닉된 변경은 아니다. `api_contract.md`/`security.md` 리뷰어가 계약 관점에서 이미 다루고 있을 가능성이 높으므로 중복 판정 방지 차 INFO로 기록한다.
  - 제안: 조치 불요(의도된 보안 수정, CHANGELOG 에 "이미 나간 것은 회수되지 않는다" 경고와 로테이션 권고까지 명시됨). 다른 리뷰어(계약/보안)의 판정과 교차 확인만 권장.

- **[INFO]** `TriggersService.update()` 의 `Object.assign(trigger, rest, {...})` → `Object.assign(trigger, defined, {...})` 로, `rest` 중 `undefined` 값 필드를 필터링해 로드된 엔티티 필드를 더 이상 덮어쓰지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 메서드 내 `const defined = Object.fromEntries(...)` 및 그 다음 줄 `Object.assign(trigger, defined, { config: mergedConfig });`.
  - 상세: 이것은 버그 수정(부분 PATCH가 명시되지 않은 필드를 `undefined` 로 덮어써 응답에서 사라지던 문제)이며, `trigger` 엔티티에 대한 in-place mutation 자체는 이전에도 존재하던 패턴(load → assign → save)이라 새로운 부작용 클래스는 아니다. 다만 동작이 바뀌므로(이제 PATCH 시 명시되지 않은 필드는 기존 값을 보존) 이 메서드에 의존하는 다른 내부 호출부가 "assign 은 전체 덮어쓰기" 를 전제하고 있었다면 영향을 받을 수 있다. 코드 검토 결과 `update()` 내부에서만 쓰이고 `rest` 는 이 함수 스코프에 국한돼 다른 공유 상태를 건드리지 않는다.
  - 제안: 조치 불요. PATCH의 tri-state(생략=불변/`null`=초기화/값=설정) 의미를 지키는 올바른 방향이며 주석에 근거(`useDefineForClassFields`)가 실측으로 남아 있다.

- **[INFO]** `TriggersService.sanitizeForResponse()` 의 조기 return 제거로, "정화할 것이 없는" 트리거도 이제 항상 `Object.assign` 을 거쳐 **새 객체 참조**를 반환한다 (콜백/호출부 영향).
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `sanitizeForResponse()` 메서드 JSDoc("조기 return 을 없앤 뒤로는 정화할 것이 없는 트리거도 새 참조를 받는다, 그러니 호출부는 참조 동일성을 전제하지 말 것") 및 본문.
  - 상세: 코드 자신이 이 사실을 주석으로 명시하고 있어 은닉된 변경은 아니다. 호출부(`findAll`/`findOneDetail`/`create`/`update`)를 확인한 결과 반환값을 `===` 비교하거나 캐시 키로 쓰는 곳은 없어 실질 영향은 관측되지 않았다.
  - 제안: 조치 불요. 문서화가 이미 충분함.

## 조사했으나 문제 없음으로 판정한 항목

- `response-contract.ts` 의 `allowMissing` 옵션 신설 — 새 optional 파라미터 추가로 기존 `assertMatchesContract`/`findContractViolations` 호출부(옵션 미전달)는 동작 불변. 시그니처 확장은 하위 호환.
- `TRIGGER_RESPONSE_STRIP_COLUMNS`/`NOTIFICATION_SIGNING_STRIP_KEYS`/`CHAT_CHANNEL_RESPONSE_STRIP_KEYS` — 전부 module-level `readonly`/`Set` 상수이며 런타임에 mutate 되는 지점이 없음.
- `schedules.service.ts` 의 `saved.trigger = savedTrigger;` 를 `if (isActive)` 블록 밖으로 옮긴 것 — `saved` 는 그 함수 로컬 스코프에서 갓 생성된 반환 객체라 공유 상태 오염 없음. 조건에 따라 응답 형태가 갈리던 결함을 고정하는 수정.
- `swagger-dto-contract-guard.ts` 의 신규 `fs.readFileSync` — repo-guard 테스트 전용 정적 분석기로 파일을 읽기만 하고 쓰지 않음. 스캔 범위는 `src/modules` 로 한정, 프로덕션 런타임 경로 아님.
- `optional-nullable.fixture.ts` 신규 파일 — repo-guard 테스트의 양성 대조군으로만 참조되고 `src/modules` 스캔 범위 밖에 있어 프로덕션 베이스라인(래칫 목록)을 오염시키지 않음(테스트로 확인됨).
- e2e 스펙 다수(`agent-memory-admin`, `ai-agent-tool-payload-warning`, `alerts-threshold-wire-type` 등)에 추가된 `assertMatchesContract(...)` 호출 — 순수 읽기/단언이며 네트워크 호출·환경 변수 접근 없음.
- `git status --short` 로 작업 트리 확인 — 조사를 위해 저장소 파일을 수정하지 않았으므로 원복이 필요한 변경 없음.

## 요약

이번 변경은 §5.4 응답-계약 검증자 배선 확대와 트리거 회전 secret 유출 수정이 결합된 스윕이다. 실질적인 신규 전역 상태는 `response-contract.ts` 의 테스트 전용 `contractCache` (module-level `Map`) 하나뿐이며, 문서화·회귀 테스트가 갖춰져 있고 읽기 전용으로만 소비되어 위험은 낮다. `SchedulesController`/`TriggersService` 의 응답 경계 축소(`trigger`/`workflow` 필드 narrowing)는 공개 API 인터페이스를 바꾸는 breaking change이지만, PR 자체가 FE 소비처 전수 실측과 CHANGELOG 경고("이미 나간 것은 회수되지 않는다")로 그 영향을 명시적으로 문서화하고 있어 은닉된 부작용이 아니다. `TriggersService.update()` 의 `Object.assign` 필터링 변경은 undefined 값으로 기존 필드를 덮어쓰던 버그를 고치는 의도된 동작 변화다. 파일시스템 쓰기, 환경 변수 조작, 의도치 않은 네트워크 호출, 콜백/이벤트 배선 변경은 관측되지 않았다.

## 위험도
LOW
