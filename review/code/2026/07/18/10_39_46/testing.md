# 테스트(Testing) 리뷰 — `ResumableNodeHandler` 제네릭화 (재검토, 이전 WARNING #1 조치 확인)

대상: `ai-agent.handler.ts` / `information-extractor.handler.ts` / `node-handler.interface.ts` /
`assert-end-reason-domain.type-fixture.ts`(신규) / `packages/ai-end-reason/src/index.ts` /
`plan/in-progress/resumable-handler-generic-typing.md` + `review/code/2026/07/17/22_58_45/**`(이전
리뷰 세션의 산출물 — 이번 diff 에 신규 파일로 포함됨).

이 세션은 2026-07-17 22:58:45 리뷰(`review/code/2026/07/17/22_58_45/testing.md`)가 낸
**testing WARNING #1**(`AssertEndReasonDomain` 위반을 잡는 회귀 fixture 부재)에 대한 조치
결과(`assert-end-reason-domain.type-fixture.ts` 신설, 커밋 `b612cae74`)를 포함한 전체 diff 를
재검토한다.

## 발견사항

- **[INFO]** 이전 testing WARNING #1 해소 확인 — 신규 회귀 fixture 정상 동작
  - 위치: `codebase/backend/src/nodes/core/assert-end-reason-domain.type-fixture.ts` (신규 파일)
  - 상세: `NarrowingViolationHandler`(좁히기 위반) / `WideningViolationHandler`(넓히기 위반) 두
    네거티브 케이스에 `// @ts-expect-error` 를 걸고, `ExactMatchHandler` 로 sanity 케이스(항상
    `never` 로 붕괴하는 자기확증 함정 차단)까지 갖췄다. 배치 위치(`src/**` 의 plain `*.ts`, `*.spec.ts`
    아님)도 문서화된 근거(backend `ts-jest` 가 `isolatedModules` 로 타입을 검사하지 않음 —
    `const n: number = '문자열'` 이 spec 스위트에서 통과한다는 실측 / `tsconfig.build.json` 이
    `**/*spec.ts` 를 exclude)와 정확히 일치한다. 직접 재확인:
    `npx tsc --noEmit -p codebase/backend/tsconfig.build.json` 를 현재 워크트리에서 실행한 결과
    **0 에러**로 통과했다 — 이는 두 `@ts-expect-error` 지시어가 실제 에러와 정확히 매칭됨을
    의미한다(매칭 실패 시 tsc 는 "Unused '@ts-expect-error' directive" 로 빌드를 깨뜨린다). 이전
    리뷰가 요구한 "검증기 자체의 무력화를 저장소가 감지하게 하라"는 목적을 충족하는 적절한 조치다.

- **[INFO]** 신규 `*.type-fixture.ts` 가 커버리지 수집 대상에 편입되어 항상 0%로 보고됨
  - 위치: `codebase/backend/jest.config.ts` (`collectCoverageFrom: ['**/*.(t|j)s']`, 별도
    `coveragePathIgnorePatterns` 없음) vs 신규 `assert-end-reason-domain.type-fixture.ts`
  - 상세: 이 파일은 어떤 프로덕션 모듈에서도 import 되지 않고 `*.spec.ts` 로도 실행되지 않으므로,
    `pnpm test -- --coverage`(`test:cov`) 실행 시 Istanbul 이 이 파일을 "0% statements/branches"
    파일로 영구히 보고한다. 현재 `coverageThreshold` 설정이 없어 CI 를 깨뜨리지는 않지만, 향후
    커버리지 %를 추적하거나 diff 로 비교하는 사람에게는 설명 없는 노이즈로 보일 수 있다.
  - 제안 (선택): `jest.config.ts` 에 `coveragePathIgnorePatterns: ['\\.type-fixture\\.ts$']` 추가,
    혹은 커버리지 리포트를 참고하는 문서에 "타입 전용 fixture 는 0% 가 정상" 이라는 1줄 코멘트만
    남겨도 충분. Blocking 아님.

- **[INFO]** `*.type-fixture.ts` 컨벤션이 공유 테스트 규약 문서에 등재되지 않음
  - 위치: `spec/conventions/` 에 테스트 관련 전용 문서 없음(확인: `*test*` glob 매치 0건).
    패턴의 근거는 신규 파일 자체의 docblock 에만 존재.
  - 상세: 이 패턴(타입 레벨 가드의 회귀를 `*.spec.ts` 가 아니라 `src/**` 의 plain `.ts` + `nest
    build` 게이트로 고정)은 이 저장소에서 **최초** 사례다(기존엔 패키지의 `_universalNonEmpty`/
    `_exhaustive` 처럼 SoT 소스 파일 안에 인라인으로만 있었고, 별도 파일로 분리된 전용 fixture
    는 없었다). 향후 다른 타입 레벨 가드(예: 다른 판별 유니온·조건부 타입)에 동일 패턴이 필요할
    때, 이 파일의 존재를 몰라 실수로 `*.spec.ts` 안에 넣어 no-op 이 되는 것(바로 이 파일이 막으려는
    실수)이 반복될 수 있다.
  - 제안 (선택, 후속): 이 패턴을 재사용 가능한 컨벤션으로 명문화하려면 `PROJECT.md`/개발자 워크플로
    문서에 "타입 전용 회귀 fixture 는 `*.type-fixture.ts` 로, `src/**` 안에" 한 줄만 추가해도 충분.
    지금 당장 이 PR 의 스코프는 아님.

- **[INFO]** fixture 가 커버하는 위반 형태는 2가지(엄격한 좁히기/넓히기) — "부분 겹침(양방향 모두
  아님)" 케이스는 별도로 없으나 실질적 갭 아님
  - 위치: 같은 파일의 `NarrowingViolationHandler`/`WideningViolationHandler`
  - 상세: `AssertEndReasonDomain` 의 바깥쪽 `[Actual] extends [TDeclared]` 체크는 Actual 이
    TDeclared 의 부분집합이 아닌 모든 경우(엄격히 넓은 경우든, 일부만 겹치고 나머지가 벗어난
    경우든)에 대해 **동일한 분기**로 즉시 `never` 를 반환한다. 따라서 "부분 겹침" 전용 케이스를
    추가해도 `WideningViolationHandler` 와 다른 코드 경로를 타지 않아 커버리지상 실질적 이득이
    없다. 현재 3케이스(정확히 일치/엄격히 좁음/엄격히 넓음)로 두 분기(narrow-check, wide-check)
    를 모두 실측했으므로 충분하다고 판단.

- **[INFO]** 런타임 회귀 테스트 미추가는 타당함 — 기존 스위트가 이미 충분히 커버
  - 위치: `ai-agent.handler.spec.ts` (`endMultiTurnConversation`/`buildMultiTurnFinalOutput` describe
    블록, 2870~3260행 근방 + `_retryState` 관련 describe), `information-extractor.handler.spec.ts`,
    `ai-turn-orchestrator.service.spec.ts`, `execution-engine.service.spec.ts`
  - 상세: 이번 diff 는 `implements` 절 + 제네릭 파라미터 + phantom 컴파일 타임 상수만 추가하는
    순수 타입 변경이며 런타임 분기·값·시그니처 바디는 전혀 바뀌지 않는다. 직접 확인한 결과 위
    기존 스위트들이 `endMultiTurnConversation` 의 `user_ended`/`max_turns`/`error`/`condition`
    fallback 라우팅, `errorPayload` 병존(spec §7.9), `_retryState` TTL 엣지 케이스(음수·0·비숫자
    env 값)까지 이미 폭넓게 커버하고 있어 새 런타임 테스트가 필요 없다는 plan/이전 리뷰의 결론은
    유효하다. `ai-turn-orchestrator.service.spec.ts` / `execution-engine.service.spec.ts` 의 handler
    mock 은 `as unknown as NodeHandler` 캐스팅을 쓰므로 인터페이스 제네릭화에 영향받지 않는다.

- **[INFO]** 리뷰 산출물 파일(파일 8~20, `review/code/2026/07/17/22_58_45/**`)은 비-코드 문서로,
  테스트 관점에서 조치 불요
  - 위치: `SUMMARY.md`, `RESOLUTION.md`, `_resolution_state.json`, `_retry_state.json`,
    `architecture.md`/`documentation.md`/`maintainability.md`/`meta.json`/`requirement.md`/
    `scope.md`/`security.md`/`side_effect.md`/`testing.md` 등
  - 상세: 이전 `/ai-review` 세션의 산출물이 프로젝트 컨벤션(CLAUDE.md — 코드 리뷰 산출물은
    `review/code/<date>/` 에 커밋)에 따라 diff 에 포함된 것뿐이다. 실행 가능한 코드가 아니므로
    테스트 존재·커버리지·mock·격리 관점에서 검토할 대상이 없다.

## 요약

이번 diff 의 핵심은 이전 세션(2026-07-17 22:58:45) testing 리뷰가 낸 WARNING #1 을 해소하는
`assert-end-reason-domain.type-fixture.ts` 신설이며, 실제로 검증했다 — 현재 워크트리에서
`tsc --noEmit -p tsconfig.build.json` 이 0 에러로 통과해 두 `@ts-expect-error` 지시어가 진짜
에러와 매칭됨(=vacuous 아님)을 독립적으로 재확인했다. 나머지 파일 변경(인터페이스 제네릭화,
두 핸들러의 `implements`/`_endReasonDomainLock`, 패키지의 `UniversalEndReason`)은 런타임 로직을
전혀 바꾸지 않는 순수 컴파일 타임 강화이고, 기존 `ai-agent.handler.spec.ts` /
`information-extractor.handler.spec.ts` / `ai-turn-orchestrator.service.spec.ts` /
`execution-engine.service.spec.ts` 가 `endMultiTurnConversation` 의 런타임 동작(port 라우팅,
errorPayload 병존, retry-state TTL 엣지케이스)을 이미 폭넓게 커버하므로 신규 런타임 테스트는
불필요하다는 설계 판단은 타당하다. 남은 사항은 전부 INFO 수준의 방어적 개선 여지(신규 fixture
파일이 커버리지 리포트에 영구 0%로 잡히는 점, `*.type-fixture.ts` 패턴이 공유 컨벤션 문서에
아직 등재되지 않은 점)이며 블로킹 결함은 없다.

## 위험도

LOW
