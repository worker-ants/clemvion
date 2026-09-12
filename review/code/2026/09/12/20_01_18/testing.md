# 테스트(Testing) 리뷰 — trigger-uuid-and-guide-codes

## 발견사항

- **[WARNING]** `@ApiExcludeEndpoint()` 면제가 "런타임 축은 그대로 묻는다"고 주장하지만, 그 주장을 실제로 가르는 fixture 가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts:142` (`if (!excluded && declared.get(param) !== true) { missing.push(...) }`), `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts:57-65` (`excluded` 핸들러), `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:93-96` (`'@ApiExcludeEndpoint 핸들러는 문서 축을 면제받는다 (런타임 축은 아니다)'`)
  - 상세: 현재 `excluded` fixture 는 `@ApiExcludeEndpoint()` + `@Param('id', ParseUUIDPipe)` (파이프 **있음**) 조합만 존재한다. 테스트는 이 조합에서 위반이 0건임을 확인하지만, 이는 "문서 축이 면제됐다"만 증명하고 "런타임 축은 면제되지 않는다"(주석·테스트명이 명시적으로 주장하는 바)는 증명하지 못한다 — 파이프가 애초에 있으니 그 축이 실제로 검사됐는지, 아니면 `excluded=true` 일 때 통째로 스킵되는지 이 fixture 만으로는 구분할 수 없다. 코드 구현(`!excluded &&`가 `@ApiParam` 체크에만 걸려 있고 파이프 체크는 무조건 실행됨) 자체는 올바르지만, 만약 향후 리팩터로 `if (!excluded) { checkPipe(); checkApiParam(); }` 형태로 두 체크가 함께 게이팅되는 회귀가 생겨도 이 테스트 스위트는 이를 잡아내지 못한다 — `excluded` fixture 가 파이프를 항상 갖고 있어 그 방향의 뮤턴트가 관측 불가능하다. plan 의 뮤테이션 표(M4: `@ApiExcludeEndpoint` 면제를 항상 `false`로 무력화)도 반대 방향(면제=true 일 때 파이프 체크까지 스킵)은 다루지 않는다.
  - 제안: `sample.controller.ts` 에 `@ApiExcludeEndpoint()` + 파이프 **없음** 조합의 fixture(예: `excludedPipeless`)를 추가하고, "파이프 누락은 여전히 위반으로 잡힌다"를 단언하는 케이스를 넣는다. 두 가드가 다르게 판정하는 입력이어야 이 축이 진짜로 독립적으로 검사됨을 증명한다.

- **[INFO]** `rotateBotToken` 의 비-UUID → 400 전환은 정적 선언 검증뿐, 런타임 왕복(e2e/HTTP)으로 확인되지 않는다
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string,`)
  - 상세: plan(`plan/in-progress/trigger-uuid-and-guide-error-codes.md` §A "처분")이 이미 이 갭을 인지하고 있다 — `triggers.controller.spec.ts` 는 `new TriggersController(...)` 직접 생성이라 Nest 파이프가 전혀 실행되지 않으므로 그 파일에 400 단언을 추가하면 vacuous 하고, `rotate-bot-token` 를 타는 e2e 는 현재 0개(실측)다. 이 PR 이 실제로 보장하는 것은 "`ParseUUIDPipe` 데코레이터가 선언돼 있다"는 정적 사실뿐이며, `ParseUUIDPipe` 자체가 비-UUID 입력에 400을 내는지는 Nest 프레임워크 계약에 위임한다. 이 트레이드오프는 문서화돼 있고 합리적이지만, "500 마스킹 → 400" 이라는 실제 동작 변화 자체를 검증하는 실행 가능한 테스트는 이 diff 안에 없다.
  - 제안: 당장 이 PR 을 막을 사유는 아니다(문서화된 의도적 스코프). 다만 `rotate-bot-token` 경로에 e2e 가 생기는 시점에 비-UUID `:id` → 400 `VALIDATION_ERROR` 케이스를 반드시 포함해야, 이 diff 가 세운 계약(§5.4 `VALIDATION_ERROR` 문서화)이 실제로 왕복 검증된다.

- **[INFO]** 유저 가이드(MDX) 의 에러 코드 서술과 실제 런타임 코드 간 정합성을 지키는 자동 가드가 없다
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx:130`, `telegram.en.mdx:117`, `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` Callout, `triggers.en.mdx` Callout
  - 상세: 이번 배치가 고친 `TRIGGER_NOT_FOUND` → `RESOURCE_NOT_FOUND` 오기는 2026-05-23(`#282`)부터 4개월간 아무 가드에도 걸리지 않고 방치됐다(plan 자체가 이를 인정). `backend-labels.test.ts` 는 **코드 안의** `ERROR_KO`/`LOCALIZED_ERROR_CODES` 파리티는 정적으로 가드하지만, MDX 산문 안의 `NNN \`CODE\`` 서술까지는 검사 범위 밖이다. 이번에도 발견은 수동 "전수 스윕"(사람이 정규식으로 97개 토큰을 센 것)이었지, 회귀를 막는 실행 가능한 테스트가 아니다.
  - 제안: 이 PR 의 스코프는 아니지만, `param-uuid-pipe` 가드와 같은 패턴(AST/정규식 기반 전수 스캔 + baseline 0)으로 "`content/docs/**` 의 `NNN \`CODE\`` 서술이 실제 컨트롤러의 `@Api*Response` 선언과 일치하는가"를 검사하는 가드를 후속 과제로 등재할 가치가 있다. (plan 에 이미 등재 여부는 미확인 — `spec-draft-nullable-notation-followups.md` 참조 요망.)

- **[INFO]** repo-guard 테스트는 의도적으로 "격리되지 않은" 테스트다 — 특이사항 아님, 설계 확인
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts:49-53` (`SCAN_ROOT = .../modules`, `collectTsFiles(SCAN_ROOT)`)
  - 상세: 이 스위트는 실제 프로덕션 `src/modules/**/*.controller.ts` 전체를 스캔 대상으로 삼아, 이 PR 과 무관한 향후 컨트롤러 변경도 이 테스트를 깨뜨릴 수 있다. 이는 "베이스라인 0, 허용목록 없음" 원칙에 따른 의도된 ratchet 설계이며 결함이 아니다 — 다만 실패 시 "이 PR 의 회귀"가 아니라 "다른 곳에서 새로 추가된 위반"일 수 있음을 리뷰어가 인지해야 한다. 대조군(`fixtures/param-uuid-pipe/`)은 스캔 루트(`src/modules`) 밖에 두어 fixture 오염을 피한 점은 적절하다(형제 가드 `dto-class-name-collision` 의 선례를 따름).
  - 제안: 조치 불필요. 기록용 확인.

## 요약

핵심 변경(`rotateBotToken` 의 `ParseUUIDPipe`/`@ApiParam format:'uuid'` 부착과 이를 고정하는 `param-uuid-pipe` 리포-가드)은 테스트 관점에서 상당히 견고하다 — AST 기반 순수 함수로 분리돼 테스트 용이성이 높고, vacuity 방지 플로어(스캔 대상 30개·136개 초과 단언)를 갖췄으며, 대조군 fixture 가 위반 3형태(파이프만 누락·문서만 누락·둘 다 누락)와 클린 4형태(양축 충족·인스턴스화 파이프·비-id 이름·인자 없는 `@Param`)를 각각 다른 사유로 가르는 것을 검증하고, 주석·문자열 안의 데코레이터 모양(decoy)에 안 속는 것까지 확인한다. plan 에 기록된 6종 뮤테이션(예측/실측 병기)도 이 리뷰가 요구하는 "GREEN 은 증거가 아니다" 원칙에 부합한다. 다만 `@ApiExcludeEndpoint()` 예외의 "런타임 축은 면제 안 된다"는 주장을 독립적으로 증명하는 fixture 가 빠져 있어 특정 방향의 회귀(면제 시 파이프 체크까지 함께 스킵되는 버그)를 잡아내지 못하는 점(WARNING)과, `rotateBotToken` 의 실제 400 응답을 왕복 검증하는 e2e/통합 테스트가 없는 점·유저 가이드 MDX 의 에러 코드 서술 정합성을 지키는 자동 가드가 없는 점(둘 다 INFO, 문서화된 의도적 스코프)이 남은 갭이다. 문서/주석(`backend-labels.ts`, `backend-labels.test.ts`) 수정은 순수 재배치·귀속 정정이라 기존 테스트의 유효성에 영향이 없다.

## 위험도

LOW
