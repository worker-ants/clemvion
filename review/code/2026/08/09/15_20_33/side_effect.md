# 부작용(Side Effect) Review — auth-guard-reflection-hardening

## 검토 범위 및 방법

핵심 코드 변경 11개 파일(`CHANGELOG.md`, `app.module.ts`, `workspace-reflection-canary.ts`(+spec, 신규),
`workspace.decorator.spec.ts`, `roles.guard.spec.ts`, `uuid.ts`(+spec), `workspace-context.util.ts`(+spec),
`main.ts`)을 실제 소스를 `Read`/`git diff origin/main`으로 직접 열어 대조했다. 나머지 32개 파일은
`plan/**` 이동과 `review/code/2026/08/09/14_36_39/**`·`review/consistency/2026/08/09/{14_01_15,15_09_04}/**`
산출물(전(前) 라운드 리뷰·consistency-check 결과 문서)이라 런타임 부작용 표면이 없어 범위에서 제외했다(단,
그 안에 이번 관점과 겹치는 선행 발견을 교차 확인해 중복 지적을 피했다).

이 PR 은 전(前) 라운드(`14_36_39`)의 side_effect 리뷰(LOW, INFO 5건)가 이미 다룬 코드 위에 W1~W6 수정을
얹은 상태다. 아래는 그 이후 실제로 반영된 코드를 재확인한 결과이며, 이미 검토·수용된 항목은 새로 지적하지
않고 "확인함" 으로만 표기했다.

## 발견사항

- **[INFO]** 부팅 시퀀스에 무조건적(env 무관) fail-closed 정지 지점이 새로 생김
  - 위치: `codebase/backend/src/main.ts:168` (`assertWorkspaceIdReflectionWorks(app)` 호출), 정의부
    `codebase/backend/src/common/decorators/workspace-reflection-canary.ts:91-116`
  - 상세: `app` 생성 직후(바디 파서 등록보다 먼저) 호출되며, 등록된 컨트롤러 전수를 훑어
    `@WorkspaceId()` 소비 라우트가 0건이면 `WorkspaceIdReflectionBrokenError` 를 throw 해 부팅을
    멈춘다. `main.ts:239` 는 여전히 `void bootstrap();` 이고 `unhandledRejection`/`uncaughtException`
    핸들러가 저장소에 없음을 재확인했다(`grep -rn "unhandledRejection\|uncaughtException" src` 0건) —
    즉 이 fail-closed 보장은 Node 기본 동작에 암묵적으로 위임된다. 이 사실은 전 라운드
    security.md/side_effect.md 가 이미 INFO 로 지적했고 `RESOLUTION.md` INFO-1 에서 "지금은 의도대로
    동작하며 캐너리 docstring 에 위임 관계를 남기는 선"으로 의도적으로 유보됐다 — 코드는 그 결정 그대로다
    (재발/회귀 없음, 새 지적 아님).
  - 제안: 조치 불요(이미 판단됨). 재확인 목적.

- **[INFO]** `app.module.ts` 전역 `imports` 에 `DiscoveryModule` 추가
  - 위치: `codebase/backend/src/app.module.ts:9`(import), `:81`(imports 배열 등록)
  - 상세: `DiscoveryService`/`MetadataScanner` 를 루트 인젝터에 등록한다. `@Global()` 모듈이 아니므로
    다른 feature 모듈에 자동 노출되지 않고, 실제 소비처는 `main.ts:168` 의 `app.get(DiscoveryService)`/
    `app.get(MetadataScanner)` 1회 호출뿐임을 `grep -rn "DiscoveryService\|MetadataScanner"
    codebase/backend/src` 로 재확인했다 — `APP_GUARD`/`APP_INTERCEPTOR`/`APP_PIPE` 등 요청 경로 provider
    목록에는 관여하지 않는다. 전역 모듈 목록에 새 항목이 늘었다는 것 자체는 표면적이나, 런타임 요청
    경로에 미치는 부작용은 없다.
  - 제안: 조치 불요.

- **[INFO]** `resolveRequestWorkspaceContext` — "순수 계산" → "조건부 `throw`" 로 동작 계약 확장 (시그니처 타입은 불변)
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79`(신규 throw 블록), 함수
    선언부 `:69-72`
  - 상세: TS 시그니처(`(headers, tokenWorkspaceId) => WorkspaceContext`)는 그대로지만, 형식이 깨진
    `X-Workspace-Id` 헤더에 대해 `BadRequestException` 을 던지도록 동작이 넓어졌다. 소비처를
    `grep -rn resolveRequestWorkspaceContext codebase/backend/src --include="*.ts" | grep -v spec.ts` 로
    전수 확인한 결과 `roles.guard.ts:124`·`workspace.decorator.ts:33` 단 2곳이며, 둘 다 try/catch 없이
    호출해 예외가 Nest 의 표준 가드/파라미터-데코레이터 예외 전파 경로를 그대로 타고
    `GlobalExceptionFilter` 까지 도달한다(삼켜지는 지점 없음, 직접 확인). `common/utils/` 라는 위치상
    "순수 함수" 로 오인하고 새 호출부가 추가될 경우 이 throw 가능성을 놓치기 쉽다는 점은 JSDoc(`:50-67`)
    이 상세히 남겼으나 `@throws` 태그는 없다 — 전 라운드 side_effect.md 가 이미 동일하게 INFO 로 지적한
    항목이라 새 지적이 아니며, 이번 라운드에서 세 번째 호출부가 추가되지 않았음을 재확인했다.
  - 제안: 조치 불요(경미). 여유가 있으면 JSDoc 에 `@throws {BadRequestException}` 한 줄 추가.

- **[INFO]** 클라이언트 관측 가능 HTTP 응답 코드 변경 (마스킹된 500 → 400, 의도된 변경)
  - 위치: `codebase/backend/src/common/utils/workspace-context.util.ts:74-79`, `CHANGELOG.md`
    (게이트 39-44 부근 "형식이 깨진 `X-Workspace-Id`... 400 `VALIDATION_ERROR`" 문단)
  - 상세: 형식이 깨진 `X-Workspace-Id` 를 보내는 호출자는 이제 500 대신 400 을 받는다. 정상 클라이언트
    (FE `apiClient`, 유효 UUID 발급)에는 영향이 없고, 종전 500 이 결함(SQLSTATE 22P02 마스킹)이었다는
    근거가 `CHANGELOG.md`·JSDoc·`api_contract.md`(전 라운드) 에 모두 일치되게 기록돼 있다. 이 응답 코드
    전환 자체는 side-effect 관점의 신규 위험이 아니라 이미 문서화·리뷰된 계약 변경이다.
  - 제안: 조치 불요.

- **[INFO]** `main.ts` 는 `AppModule` 부트스트랩의 유일한 진입점 — CLI 스크립트는 캐너리를 우회하지만 HTTP 라우트를 노출하지 않음 (재확인)
  - 위치: `codebase/backend/src/scripts/generate-golden-set.ts`, `codebase/backend/src/scripts/eval-retrieval.ts`
    (`NestFactory.createApplicationContext(EvalCliModule, …)`, `app.listen()` 미호출)
  - 상세: `grep -rln "NestFactory.create(AppModule" codebase/backend --include="*.ts"` 결과
    `main.ts`·`bootstrap/hooks-body-parser.ts` 두 곳뿐이며, 후자는 `main.ts` 내부에서 파서 팩토리로
    쓰이는 헬퍼일 뿐 별도 부트스트랩 경로가 아니다. e2e 스위트도 별도 test-app 인스턴스가 아니라
    `main.ts` 빌드 산출물이 구동하는 Docker 컨테이너(`backend-e2e:3011`)를 대상으로 함을 재확인했다 —
    캐너리를 우회하는 경로가 HTTP 라우트를 열지 않는다는 전 라운드 결론이 그대로 성립한다.
  - 제안: 조치 불요 — 확인 목적의 기록.

## 확인했으나 문제 없음 (부작용 없음 재확인)

- 전역 변수 신규 도입 없음 — `workspace-reflection-canary.ts`·`uuid.ts`·`workspace-context.util.ts`
  전부 모듈 스코프 mutable state 없음(함수 로컬 `count`/정규식 상수뿐).
- 환경 변수 읽기/쓰기 없음 — 신규 코드 어디도 `process.env` 를 참조하지 않는다(`assertProductionConfig`
  는 기존 코드, 이번 diff 밖).
- 네트워크 호출 없음 — `resolveRequestWorkspaceContext`·`isUuidShaped`·캐너리 모두 순수 계산 또는
  in-process reflection 뿐, HTTP/DB 호출 없음("DB 왕복 없음" 서술은 코드와 일치).
- 이벤트/콜백 표면 변경 없음 — 새 emitter/listener 등록이나 기존 콜백 시그니처 변경 없음.
- 파일시스템 부작용 없음 — 신규 런타임 코드가 파일을 생성·수정·삭제하지 않는다(`plan/**` 문서 이동은
  이번 PR 의 diff 산출물이지 코드 실행의 부작용이 아니며, `scope.md`(전 라운드)가 이미 별도 관점에서
  다뤘다).
- 테스트 스펙(`roles.guard.spec.ts`, `workspace-context.util.spec.ts`) diff 를 직접 대조한 결과
  `process.env`/`jest.mock`/`global.*`/`beforeAll`/`afterAll` 등 전역·환경 조작이 없고, 픽스처 상수
  치환(임의 문자열→UUID)만 있어 테스트 격리에도 영향 없음.

## 요약

이번 변경의 실질 부작용은 (1) 부팅 시 reflection 무결성 캐너리가 fail-closed 로 프로세스를 종료시킬 수
있는 새 정지 지점을 연 것과 (2) 공용 헬퍼 `resolveRequestWorkspaceContext` 가 조건부 `BadRequestException`
을 던지도록 계약이 넓어진 것 두 가지이며, 둘 다 전역 상태·환경 변수·파일시스템·네트워크·이벤트 콜백에는
관여하지 않는다. 두 항목 모두 전(前) 라운드 리뷰에서 이미 발견·문서화·수용됐고, 이번 라운드에서 실제
반영된 코드(소비처 grep, 예외 전파 경로, CLI 스크립트 우회 경로)를 직접 재대조한 결과 새로운 부작용이나
회귀는 없었다. Critical/Warning 급 발견 없음.

## 위험도

LOW
