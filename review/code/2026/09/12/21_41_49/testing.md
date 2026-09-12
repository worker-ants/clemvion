# 테스트(Testing) 리뷰

## 발견사항

- **[INFO]** `param-uuid-pipe-guard.ts` 의 `@ApiParam` 형식 판정이 리터럴 값만 다룬다 — 비-리터럴 `format` 표현식은 fixture 로 검증되지 않음
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:93-97` (`apiParamUuidFlags`)
  - 상세: `format` 프로퍼티가 `ts.isStringLiteralLike` 가 아닌 형태(변수·삼항·스프레드)면 `uuid=false` 로 판정되어 실제로는 `'uuid'` 를 넘기는 자리도 위반으로 잡힐 수 있다. 저장소 실측(144건 전부 인라인 리터럴, 주석에 명시)이 참인 동안은 안전하지만, 이 경계는 `sample.controller.ts` fixture 8종 어디에도 없어 회귀 시 무엇이 깨졌는지 즉시 드러나지 않는다.
  - 제안: 현재는 실측이 뒷받침하므로 급하지 않음. fixture 에 `format: SOME_CONST` 형태 한 자리를 추가해 "리터럴이 아니면 보수적으로 위반 처리한다" 는 설계를 명시적으로 캐너리로 고정하면 다음 사람이 그 경계를 실수로 넓히는 것을 잡을 수 있다.

- **[INFO]** `backend-labels.ts` / `backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 이동이 회귀 안전한지 직접 대조 확인
  - 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts:327-361` (`P3-C-2` 테스트, `LOCALIZED_ERROR_CODES` 배열)
  - 상세: diff 는 배열 안에서 `TRIGGER_NOT_FOUND` 원소의 위치와 인접 주석만 바꾸고 값 자체(`"TRIGGER_NOT_FOUND"`)와 `backend-labels.ts` 의 `ERROR_KO.TRIGGER_NOT_FOUND` 문자열은 그대로다. 실제 비교 로직(`LOCALIZED_ERROR_CODES.filter((c) => !koKeys.has(c))`)은 순서 무관 멤버십 검사라 이 이동은 테스트 결과에 영향을 주지 않는다 — 직접 읽어 확인했다. 회귀 없음.
  - 제안: (조치 불요, 검증 결과 기록용)

- **[INFO]** 유저 가이드(MDX)가 서술하는 식별자(에러 코드 등)의 실재 여부를 자동으로 세는 가드가 아직 없다 — 이번 배치는 수작업 스윕으로만 고쳤다
  - 위치: `plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B, `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목, "가이드가 적는 식별자(에러 코드·환경변수)가 실재하는지 세는 가드가 없다")
  - 상세: `param-uuid-pipe` 결함 클래스는 AST 전수 가드로 고정됐지만, `TRIGGER_NOT_FOUND`/`MCP_INSECURE_URL_ALLOWED` 류의 문서-코드 불일치 클래스는 1회성 정규식 스윕으로만 처리되어 재발을 막는 장치가 없다. 이미 developer 자신이 같은 배치에서 이 갭을 등재해 두었다(신규 발견 아님).
  - 제안: 이미 plan 에 후속 항목으로 정확히 등재되어 있으므로 이 리뷰 라운드에서 추가 조치 불요 — 계속 추적만 확인.

## 점검 관점별 확인 사항

- **테스트 존재/커버리지**: `rotateBotToken` 의 `ParseUUIDPipe` 추가는 (1) 실제 Nest 파이프라인을 태우는 HTTP 왕복 테스트(`triggers.controller.spec.ts` 신규 `describe`) + (2) 저장소 전수를 훑는 AST 정적 가드(`param-uuid-pipe-guard.ts`/`.spec.ts`) 이중으로 커버된다. 기존 `new TriggersController(...)` 단위 테스트로는 Nest 파이프가 실행되지 않아 vacuous 하다는 점을 테스트 파일 자체의 JSDoc 이 정확히 지적하고 그 근거로 `Test.createTestingModule`+`supertest` 로 전환한 판단은 타당함 — 직접 소스(`RolesGuard`, `WorkspaceId` 데코레이터, `GlobalExceptionFilter.getCodeFromStatus`, 핸들러의 `INVALID_BOT_TOKEN` throw)를 추적해 세 테스트의 기대값(400 VALIDATION_ERROR / 400 INVALID_BOT_TOKEN / 200)이 실제 코드 경로와 정확히 일치함을 확인했다.
- **엣지 케이스**: 대조군 3종(파이프 거부/핸들러 거부/정상)이 "무엇이 400 을 냈는가"를 구분하도록 설계되어 있고, 가드 쪽 fixture 는 두 축(런타임/문서) × 양성/음성 × `@ApiExcludeEndpoint()` 면제의 정방향·역방향(반대 방향 캐너리 `excludedPipeless`)까지 8개 메서드로 갈라 놓아 판정 함수의 각 분기가 죽은 코드가 아님을 구조적으로 보장한다. vacuity floor(`scanned > 100`, `controllers.length > 30`)도 판정과 같은 루프에서 나온 값을 검사해 "0건 스캔인데 통과" 형태를 막는다.
- **Mock 적절성**: HTTP 왕복 테스트는 `TriggersService` 만 `useValue` stub 으로 대체하고 `GlobalExceptionFilter` 는 실제 클래스를 그대로 `useGlobalFilters` 로 붙여, 봉투(`error.code`) 생성 로직까지 실제 동작을 태운다 — mock 이 필요한 최소 경계(서비스)에서만 끊겼다.
- **테스트 격리**: `beforeAll` 로 앱을 1회 생성하고 `beforeEach` 에서 `mockClear()` 만 수행 — 호출 횟수/인자 단언만 쓰므로 앱을 매 테스트 재기동할 필요가 없고 테스트 간 상태 누출도 없다. `afterAll` 의 `app.close()` 로 핸들 누수도 막는다.
- **가독성**: 두 신규 spec 파일 모두 "왜 이 형태인가"를 표로 정리한 JSDoc(대조군 표, 두 축 표)을 갖추고 있어 의도가 코드만으로도 재구성 가능하다.
- **회귀**: `backend-labels.test.ts`/`.ts` 의 변경은 값이 아니라 주석·배열 원소 순서 이동뿐이며 비교 로직이 순서 무관이라 회귀 위험 없음(직접 확인). MDX 변경은 문서 전용. `auth.controller.ts` 의 `@ApiParam` 보강은 런타임 로직 변경이 없는 문서 데코레이터라 별도 단위 테스트가 필요하지 않고, `param-uuid-pipe` 가드가 이 자리를 전수 스캔 대상에 포함해 향후 회귀를 잡는다.
- **테스트 용이성**: `scanUuidParams` 가 `{violations, scanned}` 를 판정과 같은 루프에서 반환하도록 설계된 점(리뷰 이력상 이전 라운드에서 분리형 카운터를 지적받아 통합함)과 `collectMethodViolations` 로 순회/판정을 분리한 리팩터링은 테스트 용이성을 구조적으로 개선한 사례다.

## 요약

`rotateBotToken` 의 `ParseUUIDPipe` 누락 수정은 정적 AST 전수 가드(베이스라인 0, 허용목록 없음, 8종 대조군 fixture)와 실제 Nest 파이프라인을 태우는 HTTP 왕복 테스트(3종 대조군)로 이중 방어되어 있고, 두 테스트 모두 실제 소스(`GlobalExceptionFilter`, `RolesGuard`, `WorkspaceId`/`CurrentUser` 데코레이터, 핸들러의 수동 `BadRequestException`)를 직접 추적해 기대값이 정확함을 확인했다. `backend-labels.ts`/`.test.ts` 의 주석·순서 변경은 비교 로직이 순서 무관이라 회귀 없음을 검증했고, MDX/CHANGELOG 변경은 테스트 대상이 아니다. 남은 갭(가이드 식별자 실재성 검증 가드 부재, `format` 비-리터럴 fixture 미비)은 이미 developer 자신이 plan 백로그에 정확히 등재해 두었고 이번 배치의 스코프 밖이므로 차단 사유가 아니다.

## 위험도

LOW
