# 테스트(Testing) Review — auth-guard-reflection-hardening (2026-08-09 15:20:33 round)

## 검증 방법

`codebase/backend/src/common/{decorators,guards,utils}/**` 의 신규/변경 spec 5개 파일(`workspace-reflection-canary.spec.ts`·`workspace.decorator.spec.ts`·`roles.guard.spec.ts`·`uuid.spec.ts`·`workspace-context.util.spec.ts`)을 실제 소스(diff 가 생략된 `roles.guard.spec.ts`·`workspace-context.util.spec.ts` 포함) 전문 `Read` 로 대조했고, `npx jest`로 직접 실행해 **5 suites / 74 tests 전부 PASS** 확인했다. 본 PR 은 직전 라운드(`review/code/2026/08/09/14_36_39`)의 testing WARNING 2건(W5: RolesGuard 레벨 테스트 부재, W6: vacuous nil-UUID 테스트)에 대한 `RESOLUTION.md` 기록 수정을 포함하고 있어, 그 수정이 실제로 반영됐는지도 코드 레벨로 재확인했다.

## 발견사항

- **[INFO]** `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼가 이 PR 이 다른 두 파일(`workspace.decorator.spec.ts`, `workspace-context.util.spec.ts`)에서 명시적으로 기각한 "이중 호출 assert" 패턴을 그대로 재사용한다.
  - 위치: `codebase/backend/src/common/guards/roles.guard.spec.ts` — 함수 `expectValidationError` (`describe('형식이 깨진 X-Workspace-Id 는 가드에서 400 으로 전파된다', ...)` 블록 내부)
  - 상세: 이 헬퍼는 `canActivate(ctx)` 를 두 번 호출한다 — 1회는 `await expect(guard.canActivate(ctx)).rejects.toThrow(BadRequestException)` 로 타입만 검증하고, 2회는 별도 `buildGuard('owner')` 인스턴스로 다시 호출해 `catch` 로 에러를 캡처한 뒤 `getResponse()` 의 `code` 를 검증한다. 반면 같은 PR 의 `workspace.decorator.spec.ts`(`expectWorkspaceIdRequired`, 신규 "VALIDATION_ERROR" 테스트)와 `workspace-context.util.spec.ts`(`it.each` 블록, 주석에 "ai-review 2차 WARNING #4" 로 직접 인용)는 정확히 이 패턴을 "첫 단언이 실패하면 두 번째가 조용히 건너뛰어진다"는 이유로 기각하고, 클로저에 에러를 캡처해 재던지는 **단일 호출** 패턴으로 통일했다. `roles.guard.spec.ts` 의 이 3개 테스트(`@WorkspaceId()` 라우트 / `@Roles()` 라우트 / 403-vs-400 구분)는 각 guard·mock 인스턴스가 독립적(매 `buildGuard()` 호출마다 새 `jest.fn()`)이라 **정확성 버그는 아니다** — 두 호출이 서로 다른 상태를 공유하지 않으므로 첫 단언이 실패해도 테스트 자체는 정확히 실패로 잡힌다. 다만 (a) 매 테스트마다 가드 생성·`canActivate` 실행을 불필요하게 2배로 하고, (b) 같은 PR 안에서 "표준"으로 정착시키려던 캡처-재던지기 패턴이 세 번째 파일에서는 적용되지 않아 다음 리더가 "이 저장소의 표준은 무엇인가"를 다시 혼동하게 만든다 — `14_36_39` 라운드 maintainability WARNING("이중 호출 패턴이 다른 파일에서 무근거로 재사용")과 정확히 같은 성격의 결함이 세 번째 자리에 남아 있다.
  - 제안: `workspace.decorator.spec.ts`/`workspace-context.util.spec.ts` 와 동일한 캡처-재던지기(단일 `canActivate` 호출, closure 로 err 캡처 후 재-throw) 패턴으로 통일. `expectValidationError` 는 `async` 이므로 `await expect(async () => { try { await guard.canActivate(ctx); } catch (err) { caught = err; throw err; } }).rejects.toThrow(BadRequestException)` 형태로 바꾸면 guard 인스턴스 1개·호출 1회로 축소된다.

- **[INFO]** `assertWorkspaceIdReflectionWorks` 를 부팅 시퀀스의 올바른 지점(`app` 생성 직후, body-parser 등록 이전)에서 호출하는지를 직접 검증하는 단위/통합 테스트가 없다 — 직전 라운드에서 이미 지적·문서화된 한계이며 이번 라운드에서도 변화 없음
  - 위치: `codebase/backend/src/main.ts` (`bootstrap` 함수, `assertWorkspaceIdReflectionWorks(app)` 호출부) — `bootstrap` 은 export 되지 않고 `void bootstrap()` 으로만 호출됨(`main.ts` 최하단)
  - 상세: `find codebase/backend/src -iname "main*.spec.ts"` 실측 결과 대응 unit spec 파일 없음. 캐너리 로직 자체(`workspace-reflection-canary.spec.ts`)는 촘촘히 커버되지만, "main.ts 가 그 함수를 실제로 올바른 시점에 호출하는가"는 별개 관측 지점이고 이는 전적으로 e2e 스위트 전체 통과(간접 추론: 캐너리가 던졌다면 `app.listen` 에 도달 못해 전 e2e 가 연결 실패했을 것)에만 의존한다. `plan/in-progress/auth-guard-reflection-hardening.md` §체크리스트에 이 추론과 한계가 이미 명시적으로 기록돼 있어 새로 발견한 갭이 아니라 재확인이다.
  - 제안: 조치 필수는 아님(이미 인지·기록된 트레이드오프). 여유가 있다면 `bootstrap` 을 export 하거나 배선 부분만 별도 함수로 추출해 화이트박스 단위 테스트를 추가하는 방안을 고려.

- **[INFO]** `assertWorkspaceIdReflectionWorks` 의 기본 파라미터 로거(`new Logger('WorkspaceIdReflection')`) 로 성공 경로(`logger.log(...)` 실제 호출)를 거치는 테스트가 없다 — 직전 라운드 지적과 동일, 변화 없음
  - 위치: `codebase/backend/src/common/decorators/workspace-reflection-canary.spec.ts` — `describe('assertWorkspaceIdReflectionWorks', ...)` 의 성공 케이스 테스트(`'소비 라우트를 인식하면 개수를 돌려준다'`)는 커스텀 `logger: { log: (m) => logged.push(m) }` 를 항상 주입한다. 실패(throw) 경로만 기본 로거로 호출되는데, 그 경로는 `logger.log()` 도달 전에 throw 하므로 기본 로거 인스턴스화만 검증된다.
  - 상세: `Logger` 는 NestJS 내장 클래스라 위험은 낮다. 우선순위 낮음.
  - 제안: 조치 불요에 가까움. 필요시 기본 파라미터로 성공 케이스 1건 추가.

## 회귀/수정 확인 (문제 없음)

- 직전 라운드 W5(가드 레벨 400 테스트 부재)·W6(vacuous nil-UUID 테스트) 는 코드 레벨로 실제 반영을 확인했다: `roles.guard.spec.ts` 에 `@WorkspaceId()` 라우트/`@Roles()` 라우트/"403 아니라 400"(+ `getMemberRole` 미호출로 DB 미도달 단언) 3건이 추가됐고, 기존 "전역 라우트는 헤더와 무관하게 통과" 스위트에 `'not-a-uuid'`(형식상 실제로 깨진 값)를 쓰는 신규 케이스가 nil-UUID 케이스와 나란히 존재해 "early-return 이 건너뛴 것"과 "검증이 돌았는데 통과한 것"을 이제 구분한다. `RESOLUTION.md` 가 주장한 뮤테이션 실증(검증 제거 → 10 RED, 단축 이동 → 신규 테스트 1건만 RED)도 테스트 구조상 타당하다.
- `workspace-context.util.spec.ts` 의 `it.each` malformed-header 5종은 캡처-재던지기 패턴으로 이미 통일돼 있고, "중복 헤더 — 첫 값 유효/두 번째 값 유효" 양방향을 모두 테스트해 멀티암 연산자 순서별 관측 원칙을 지킨다.
- `uuid.spec.ts` 는 `isValidUuid`/`isUuidShaped` 두 술어의 실제 경계(nil UUID·v7·비-RFC variant, 상위집합 관계)를 교차 단언으로 고정했다.
- 픽스처를 임의 문자열(`'ws1'` 등)에서 실형태 UUID로 치환한 3개 spec 파일 모두 상수명 의미(`OWN`/`VICTIM`/`HEADER_WS` 등)를 그대로 보존했고 `npx jest` 실행 결과 회귀 없이 74건 전부 GREEN.
- Mock 적절성: `workspace-reflection-canary.spec.ts` 의 `appWith` 스텁은 `DiscoveryService.getControllers()`/`MetadataScanner.getAllMethodNames()` 최소 표면만 흉내내고, 판별 로직(`handlerConsumesWorkspaceId`)은 재구현하지 않고 실제 함수를 그대로 호출한다 — "캐너리가 자기 복제본만 검사"하는 안티패턴을 피했다. `roles.guard.spec.ts` 의 `WorkspacesService` mock 도 `getMemberRole` 단일 메서드만 필요해 과도한 mock 없이 최소로 유지된다.
- 테스트 격리: 각 테스트가 `buildGuard()`/`appWith()` 로 매번 새 mock·인스턴스를 만들어 전역 상태 공유가 없고, `beforeEach` 없이도 안전하게 독립 실행된다(직접 실행으로 순서 무관 GREEN 확인).

## 요약

이번 라운드는 직전 리뷰의 testing WARNING 2건(가드 레벨 400 테스트 부재, vacuous nil-UUID 테스트)이 실제 코드에 반영됐음을 확인했고, 뮤테이션 근거까지 뒷받침돼 신뢰할 만하다. 신규/변경 스펙 5개 파일 74건이 전부 GREEN 이며 경계값·mock·격리 모두 양호하다. 남은 지적은 전부 INFO 다: (1) `roles.guard.spec.ts` 의 `expectValidationError` 헬퍼가 같은 PR 이 다른 두 파일에서 이미 기각한 이중 호출 패턴을 그대로 쓰고 있어(정확성 버그는 아니지만 일관성·불필요한 중복 실행 문제) 통일이 바람직하고, (2)(3) `main.ts` 배선 직접 테스트 부재와 기본 로거 성공경로 미검증은 직전 라운드에서 이미 인지·문서화된 낮은 위험의 잔여 갭으로 새로 발견된 문제가 아니다. Critical/Warning 급 테스트 결함은 없다.

## 위험도

LOW
