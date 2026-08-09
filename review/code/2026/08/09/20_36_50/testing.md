# 테스트(Testing) 리뷰 — backend-hygiene-followups

## 검증 방법
프롬프트의 unified diff·전체 파일 컨텍스트 외에, 잘려서 표시되지 않은 3개 파일
(`roles.guard.spec.ts`, `secret-resolver.service.spec.ts`, `http-request.handler.spec.ts`)은
`Read` 로 직접 열어 전문을 확인했다. 또한 변경된 4개 unit spec 파일(81 tests) +
`http-request.handler.spec.ts`(74 tests)를 로컬에서 실제로 `npx jest` 실행해 전부 GREEN 을
확인했고, 변경된 소스 6개 파일에 `eslint`를 돌려 lint 오류가 없음을 확인했다. `deleteByPrefix`
프로덕션 코드(`secret-resolver.service.ts`)를 직접 열어 테스트가 단언하는 쿼리 형태
(`ref LIKE :prefix`, `${prefix}%`, 메타문자 정규식 `/[%_\\]/`)가 실제 구현과 정확히 일치함을 대조했다.
`V063__secret_store.sql`을 확인해 e2e 스펙의 ref 값이 `chk_secret_store_ref_format` CHECK 제약을
만족하고 `workspace_id`에 FK 가 없어(격리 문제 없음) 시드 데이터가 유효함을 확인했다.

## 발견사항

- **[INFO]** `deleteByPrefix` mock 자기-전제 단언 테스트는 서비스가 아니라 mock 자체를 검증한다
  - 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.spec.ts` — `it('mock 이 자기 전제를 단언한다 — 메타문자 패턴에서 조용히 적게 지우지 않고 throw', ...)` (파일 내 라인 324~335, `createInMemoryRepository()` 반환값을 `SecretResolverService` 없이 직접 호출)
  - 상세: 이 테스트는 `SecretResolverService.deleteByPrefix()`를 거치지 않고 `repo.createQueryBuilder().delete().where(...)`를 직접 호출해, in-memory mock 이 LIKE 메타문자를 만나면 조용히 `startsWith`로 적게 지우는 대신 throw 하는지를 검증한다. 이는 프로덕션 로직이 아니라 "테스트 더블의 자기 검증"이라, 커버리지 도구에서는 `deleteByPrefix`에 대한 새 커버리지로 집계되지 않는다. 다만 주석에 "가드가 사라지면 이 스위트가 조용히 GREEN 으로 남는 대신 throw 로 드러난다"는 목적과, 실측 근거(문구 충돌로 47/47 GREEN 됐던 사고)까지 상세히 남겨 둬 오독 위험은 낮다.
  - 제안: 조치 불요 — 다만 향후 이 파일을 유지보수할 사람이 "이 테스트가 실서비스를 통과했다"고 오해하지 않도록, 테스트명에 이미 "mock 이"를 명시해 둔 현재 표현을 유지할 것.

- **[INFO]** 캐너리 "142건" 수치는 어떤 자동 테스트로도 고정되지 않는다 (기존 한계의 연장, 신규 갭 아님)
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:26-27`(JSDoc), `codebase/backend/README.md:57`
  - 상세: 두 문서 모두 "부팅 시 실측한 값(142건)"을 명시적 수치로 박아 두었는데, 이 수치를 검증하는 단위/e2e 어서션은 없다(설계상 의도 — 목록 하드코딩을 피하려고 "0 이 아님"만 단언). 따라서 향후 라우트가 추가/제거돼 142라는 숫자가 stale 해져도 CI 는 이를 감지하지 못하고, 문서만 조용히 부정확해진다. 이는 이번 diff 가 새로 만든 갭이 아니라 캐너리 설계 자체의 알려진 한계(코드 주석에도 명시)를 문서에 그대로 반영한 것뿐이라 심각도는 낮다.
  - 제안: 조치 불요(설계상 트레이드오프로 문서화됨). 참고로만 남김.

- **[INFO]** 공유 픽스처 모듈(`workspace-id-fixtures.ts`) 자체에는 값 유일성을 강제하는 테스트가 없다
  - 위치: `codebase/backend/src/common/__test-utils__/workspace-id-fixtures.ts:25-54`
  - 상세: 7개 상수(`HEADER_WS`~`NIL_WS`)가 서로 달라야 한다는 것이 세 스위트의 암묵적 전제인데, 이를 지키는 어서션(예: `new Set([...]).size === 7`)이 fixture 모듈 자체에는 없다. plan 문서(`plan/in-progress/auth-guard-reflection-hardening.md`)에 "`OTHER_WS`를 `TOKEN_WS`와 같은 값으로 바꾸자 2 suite/3 test RED"라는 뮤테이션 실측 기록이 있어 실질적으로는 소비 스위트들이 간접적으로 유일성을 검증하고 있지만, 이는 우연적 커버리지지 명시적 계약은 아니다.
  - 제안: 선택적. `workspace-id-fixtures.spec.ts`에 `Set` 크기 단언 한 줄을 추가하면 향후 실수로 값이 겹쳐도 fixture 모듈 자체에서 즉시 RED 가 나 소비 스위트 3곳을 순회하며 원인을 찾을 필요가 없어진다. 비용이 매우 낮으므로 다음 터치 시 권장하되, 이번 PR 을 막을 사유는 아니다.

## 항목별 평가

1. **테스트 존재 여부**: 프로덕션 로직 변경은 사실상 없고(README·JSDoc 수치 정정, 픽스처 통합, 죽은 코드 제거) 유일한 신규 커버리지 대상인 `deleteByPrefix`의 LIKE 와일드카드 위험은 유닛(쿼리 형태 연결점) + e2e(실 Postgres 의미론) 양쪽에 신규 테스트가 추가됐다. 갭 없음.
2. **커버리지 갭**: 위 INFO 3건 외 실질적 코드 경로 누락 없음. `roles.guard.spec.ts`/`workspace-context.util.spec.ts`는 헤더-우선·토큰-폴백·중복헤더·빈배열·nil UUID·형식오류 5종을 모두 교차 커버.
3. **엣지 케이스**: `it.each`로 메타문자 4종(`%`, `_`, `\`, 전체와일드카드), 형식 오류 5종(빈문자열/공백/잘린UUID/하이픈없음/SQL조각)을 표로 커버. nil UUID(형식은 유효하나 멤버십 없음) 케이스를 403↔400 혼동 방지 관점에서 명시적으로 분리해 둔 점이 특히 꼼꼼함.
4. **Mock 적절성**: `secret-resolver.service.spec.ts`의 in-memory mock 이 "메타문자를 만나면 조용히 적게 지우는" 실제 Postgres 와의 괴리를 스스로 감지해 throw 하도록 설계했고, 에러 문구가 프로덕션 가드의 문구(`메타문자`)와 겹치지 않게 의도적으로 갈라 vacuous-pass(뮤턴트 47/47 GREEN)를 실측으로 잡아낸 이력이 주석에 남아 있다 — 이 프로젝트가 반복 지적해 온 "mock 이 실동작과 괴리되는데도 GREEN" 클래스의 결함을 스스로 예방하는 모범 사례.
5. **테스트 격리**: 각 유닛 테스트가 `createInMemoryRepository()`/`buildGuard()`로 매번 새 상태를 만든다. e2e(`secret-store-like-prefix.e2e-spec.ts`)는 `uniqueName('like')` 네임스페이스로 ref 를 격리하고 `beforeEach`/`afterAll` 양쪽에서 정리해 다른 스펙의 row 를 건드리지 않는다. `workspace_id`에 FK 가 없어 `randomUUID()` 시드도 유효하다.
6. **테스트 가독성**: describe/it 이름이 "무엇을·왜"를 한국어로 명확히 서술하고, 캡처-재던지기 패턴(`toThrow` + `getResponse()` 이중 호출로 인한 vacuous 방지)처럼 과거 리뷰에서 지적된 패턴을 코드 곳곳에서 주석으로 재설명해 재발을 막고 있다.
7. **회귀 테스트**: 픽스처 통합으로 상수명이 바뀐 3개 spec 파일(`workspace.decorator.spec.ts`, `roles.guard.spec.ts`, `workspace-context.util.spec.ts`) 모두 로컬 실행에서 전량 GREEN(81/81). `http-request.handler.spec.ts`의 죽은 코드 제거도 74/74 GREEN이며, 제거된 블록이 실제로 `_reject` 미존재 속성이라 no-op 였음을 소스로 확인했다 — 회귀 없음.
8. **테스트 용이성**: `SecretResolverService`가 `Repository`를 생성자 주입받는 구조라 in-memory mock 교체가 쉽고, `RolesGuard`도 `WorkspacesService`를 주입받아 `getMemberRole` 하나만 stub 하면 된다. `assertWorkspaceIdReflectionWorks`는 `DiscoveryService`/`MetadataScanner`를 인자로 받고 판별 로직(`countWorkspaceIdConsumingRoutes`)을 순수 함수로 분리해 둬 테스트 용이성이 높다(다만 이 diff 자체는 이 파일의 로직을 바꾸지 않고 JSDoc 수치만 정정).

## 요약
production 로직 변경이 거의 없는 "테스트/문서 위생" PR 로, 유일한 신규 커버리지 대상(`deleteByPrefix`의 LIKE 와일드카드 과다삭제 위험)을 유닛(쿼리 형태 연결점)과 e2e(실 Postgres 의미론) 양쪽에서 근거 있게 닫았고, 3개 spec 파일에 흩어져 있던 워크스페이스 UUID 픽스처를 이름-값 1:1 대응으로 통합하면서 뮤테이션 실측으로 vacuous 하지 않음을 확인했다. mock 자기-검증 테스트가 프로덕션 가드와 문구가 겹쳐 뮤턴트를 놓쳤던 사고를 스스로 기록·재발방지한 점, 캡처-재던지기 패턴을 반복 준수한 점 등 이 저장소가 과거 리뷰에서 반복 지적해 온 "vacuous test"·"mock-reality drift" 클래스의 결함을 이번 PR 이 선제적으로 막고 있다. 로컬 재실행(81+74 tests 전량 GREEN, eslint 클린)으로 회귀도 없음을 확인했다. 발견된 3건은 모두 INFO 등급으로, 즉시 조치가 필요한 결함은 없다.

## 위험도
NONE
