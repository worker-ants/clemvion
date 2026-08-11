# 테스트(Testing) 리뷰 — 후속 검증 라운드

이 라운드는 새 코드가 아니라 **직전 라운드(`17_21_33`)에서 testing 리뷰어(나)가 낸 두 WARNING 의 처분 여부**와,
그 처분 과정에서 새로 생긴 주장(전수 측정치·테스트 무결성)을 검증하라는 요청이다. 지시받은 4개 항목을 순서대로
scratch 사본(저장소 밖)에서 재현·독립 측정했다. 실 워크트리는 읽기만 했고(`Read`/`git show`/`tsc`/`eslint`/`jest`
전부 비파괴), 어떤 파일도 남기거나 `git restore`/`checkout` 을 쓰지 않았다.

## 검증 방법 요약

1. **뮤테이션 재현** — `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 를 esbuild 로 **그대로**(수기
   재작성 없이) 번들해 scratch 의 미니 fake-repo(`root/spec/conventions/swagger.md` + `root/spec/data-flow/12-workspace.md`)
   에서 실제 `findBrokenLinks()` 를 호출했다. 세 시나리오(A: 350-멀티라인 상태 / B: 350-한줄 상태 / C: 398)를
   각각 **격리**해 앵커 하나씩만 깨고 판정했다.
2. **regression 가드 타당성** — `workspace-roles-attachment.spec.ts`(`@Roles()` 전용 회귀 가드)를 읽고, 저장소
   전체에서 `ApiForbiddenResponse`/`ApiUnauthorizedResponse`/`ApiNotFoundResponse` 등 문서 전용 데코레이터를
   대상으로 한 회귀 테스트가 그 밖에 존재하는지 `grep` 전수 확인.
3. **backend 테스트 파손 여부** — 변경된 19개 컨트롤러 전체에 대해 `tsc --noEmit`, `eslint`, 관련 `.spec.ts`
   11개 스위트, 그리고 **backend 전체 unit 스위트**를 직접 실행.
4. **멀티라인 링크 전수 측정** — regex 가드가 아니라 **CommonMark 표준 파서**(`mdast-util-from-markdown`, 가드가
   앵커 슬러그 계산에 실제로 쓰는 렌더러 계열)로 `spec/**.md` 134개 파일 전체를 파싱해 "링크 노드의 시작줄 ≠
   끝줄"을 직접 판별했다 — 가드 자신의 버그에 좌우되지 않는 독립 ground truth.

## 발견사항

- **[INFO] 검증 완료 — 뮤테이션 3주장 전부 재현됨 (핵심 항목).**
  - 위치: `spec/conventions/swagger.md:349-350`(신설 앵커 링크), `spec/conventions/swagger.md:398`(신설 앵커 링크) — 둘 다 프롬프트 파일41 게이트와 대조해 확인(신·구 두 링크 모두 `../data-flow/12-workspace.md` 타깃).
  - 상세: 실제(수기 재구현 아님) `findBrokenLinks()` 를 scratch fake-repo 에서 실행한 결과:

    | 시나리오 | 조건 | 결과 |
    | --- | --- | --- |
    | A | 350-앵커, PR 이전 원문(commit `91edf4f6e`, `[` 와 `](` 가 서로 다른 줄)을 그대로 두고 앵커만 오염 | **GREEN — violations 0건, 생존** |
    | B | 350-앵커, HEAD(한 줄로 편 뒤) 상태에서 앵커만 오염 | **RED — `[ANCHOR] swagger.md:350` 1건 검출** |
    | C | 398-앵커, HEAD 상태에서 앵커만 오염 (350 은 손대지 않음) | **RED — `[ANCHOR] swagger.md:398` 1건 검출** |

    세 시나리오 모두 이전 라운드가 적은 표와 **정확히 일치**한다. 특히 A 는 "멀티라인이면 가드가 원천적으로
    못 본다"는 주장의 핵심 근거인데, `extractLinks()` 가 라인 단위 정규식(`LINK_RE`)을 한 줄씩만 돌리는 구조를
    코드로 다시 확인했고(`spec-links.ts:104-131`), 그 구조가 예측한 그대로 동작함을 실행으로 확인했다.
  - 제안: 없음 — 주장이 참임을 확인. RESOLUTION.md/plan 의 해당 서술을 그대로 신뢰해도 된다.

- **[INFO] `@ApiForbiddenResponse` 회귀 가드 부재 — "이 PR 밖 후속" 판단은 타당하다.**
  - 위치: `codebase/backend/src/repo-guards/__tests__/workspace-roles-attachment.spec.ts`(기존 가드, 비교 대상) / 저장소 전체 `grep -rl ApiForbiddenResponse **/*.spec.ts` → **0건**.
  - 상세: `workspace-roles-attachment.spec.ts` 는 `@Roles()`(런타임에 `RolesGuard` 가 실제로 소비하는, 인가 동작을 바꾸는 데코레이터)의 메타데이터 소실을 reflection 으로 고정한다 — 회귀 시 **보안 동작**이 깨지기 때문에 정당하다. 반면 `@ApiForbiddenResponse` 는 OpenAPI 문서 메타데이터일 뿐이고, 이번 diff 로 도달 가능한 것을 api_contract 리뷰어가 `RolesGuard` 소스로 직접 확인했듯 **런타임 wire 응답에는 영향이 없다**(핸들러·상태코드·바디 불변). 나 역시 `tsc`/`eslint`/전체 unit 스위트로 독립 확인했다 — 아래 항목 참조. 더 결정적으로, 저장소 전체를 뒤져도 `@ApiUnauthorizedResponse`(156곳, 이번 diff 전부 동반 인접) · `@ApiNotFoundResponse` · `@ApiBadRequestResponse` 등 **다른 어떤 문서 전용 Api*Response 데코레이터에도 존재 여부를 지키는 회귀 테스트가 단 하나도 없다.** `@ApiForbiddenResponse` 만 골라 신규 가드를 도입하면 그 자체가 "63+156곳 중 방금 만진 51+13곳만" 비대칭적으로 지켜지는 결과라, 이번 스코프에서 강제할 근거가 약하다(이 저장소가 반복 지적한 "opt-in 규칙을 규약 레벨에서 반복하지 말라"는 §5-4 확장의 정신과도, 실제로는 "전수 자동 검증 없이 사람이 다시 규칙을 기억해야 하는" 이 회귀-가드 부재 자체가 같은 결이긴 하다).
  - 제안: plan 후속으로 미룬 판단에 동의한다. 다만 후속을 착수한다면 `@ApiForbiddenResponse` 단독이 아니라 **"`@Roles()`|`@WorkspaceId()` 소비 라우트 ⇒ 403 문서화"라는 §5-4 규칙 자체를 코드모드 검증기(스캐너)의 CI 화**로 스코프를 잡는 편이 낫다 — 이번 plan 이 이미 "데코레이터 블록 파서" 스캐너를 두 번 만들었으므로 그것을 상시 gate 로 승격하는 쪽이, `Reflect.getMetadata` 개별 유닛 64+개를 나열하는 것보다 유지비가 낮다.

- **[INFO] 새로 부착된 결정자(64건: 1차 51 + 2차 13) — backend 테스트를 깨지 않는다. 0건 실패, 선재 결함과 무관.**
  - 위치: 변경된 19개 컨트롤러 전체(`codebase/backend/src/modules/**/*.controller.ts`, 프롬프트 파일 1~19).
  - 상세: 직접 실행한 결과.
    - `npx tsc --noEmit -p tsconfig.build.json` (전체 프로그램) → **0 errors**.
    - `npx eslint` (19개 변경 컨트롤러 전체) → **0 errors/warnings** (exit 0).
    - 변경 모듈에 대응하는 `.spec.ts` 11개 스위트(`agent-memory`·`auth-configs`·`executions`·`background-runs`·`folders`·`llm-model-config`·`model-config`·`schedules`·`workflow-versions`·`workflows`·`workspace-roles-attachment` 회귀가드) → **11 suites / 114 tests 전부 PASS**.
    - **backend 전체 unit 스위트**(`npx jest`, 격리 없이 전수) → **418 suites / 8511 passed, 1 skipped(무관), 0 failed**.
    - `backend-lint-gate-broken-on-main.md` 가 추적하는 선재 결함(테스트 파일 209건 type-error ratchet baseline, lint warning 47건)은 **둘 다 비차단(warning/ratchet)이고 변경 파일과 무관** — 이번 diff 는 애초에 그 선재 결함을 끌어들일 필요조차 없을 만큼 tsc/eslint/전체 unit 이 전부 클린하다. plan/RESOLUTION 의 "컨트롤러 타입 오류 0·lint 0" 서술을 전체 unit 스위트 실행으로 한 단계 더 강하게 재확인한 셈이다.
  - 제안: 없음. 다만 관찰: `alerts`·`dashboard`·`integrations`·`knowledge-base`(`graph`·`knowledge-base` 둘 다)·`notifications`·`statistics`·`workflow-assistant`·`workflow-test-datasets` 8개 컨트롤러는 애초에 `.controller.spec.ts` 자체가 없다(순수 CRUD/조회 컨트롤러 스타일 — 이 저장소의 기존 패턴). 이는 이번 diff 가 만든 갭이 아니라 착수 전부터 있던 상태이므로 이번 PR 을 막을 이유는 아니지만, "13건이 테스트를 깨지 않았다"는 결론이 이 8개 파일에 대해서는 "테스트가 아예 없어서 깨질 것도 없었다"는 의미임은 기록해 둔다.

- **[INFO] 멀티라인 링크 사각지대 "6건/6파일" — 정확하다. CommonMark 파서로 독립 재검증.**
  - 위치: `spec/4-nodes/4-integration/2-database-query.md:413-414`, `spec/5-system/1-auth.md:783-784`, `spec/7-channel-web-chat/4-security.md:100-101`, `spec/conventions/secret-store.md:361-362`, `spec/data-flow/12-workspace.md:345-346`, `spec/conventions/swagger.md`(commit `91edf4f6e` 기준 349-350, 이번 PR 이 해소).
  - 상세: `mdast-util-from-markdown` 으로 `spec/**.md` 134개 파일(가드가 스캔하는 것과 동일 파일셋, `collectSpecMarkdown()` 재사용)을 전수 파싱해 링크 노드의 `position.start.line !== position.end.line` 을 직접 판별했다(가드의 regex 로직에 의존하지 않는 ground truth). **현재(HEAD, swagger.md 해소 후) 상태에서 5건/5파일**이 나왔고, swagger.md 의 PR-이전 원문(`91edf4f6e`)을 동일 파서로 별도 스캔하니 정확히 **1건**이 잡혔다(PR 이후 HEAD 상태로 같은 스캔을 하면 0건 — 즉 이번 PR 이 그 1건을 없앴다). `5(현재) + 1(swagger.md, 이번에 해소) = 6건/6파일` — plan 의 실측과 정확히 일치한다. 파일당 정확히 1건씩이라 "6건"과 "6파일"이 같은 수인 것도 일치.
  - 제안: 없음. 억지로 다른 숫자를 만들지 않았다 — 실측이 그대로 6/6 이었다.

## 요약

직전 라운드에서 내(testing)가 반증했던 "가짜 앵커 → RED" 뮤테이션 주장을, 이번엔 developer 가 격리해 낸 세 값
(350-멀티라인=GREEN, 350-한줄=RED, 398=RED)을 scratch 미니 fake-repo 에서 **실제(수기 재구현 아닌) 가드 함수**로
그대로 재현했다 — 3/3 일치. `@ApiForbiddenResponse` 회귀 가드 부재를 이 PR 밖으로 미룬 판단도, 저장소 전체에
문서 전용 `Api*Response` 데코레이터를 지키는 회귀 테스트가 이 하나뿐 아니라 **하나도 없다**는 사실과 이 데코레이터가
wire 응답에 영향이 없다는 사실(직접 확인)에 비춰 타당하다고 판정한다. 새로 부착된 13건(및 1차 51건 포함 총 64건)은
`tsc`/`eslint`/변경 모듈 spec 11스위트/backend 전체 unit 스위트(418 suites·8511 tests) 전부 그린으로, 실제로
어떤 backend 테스트도 깨지 않았다 — 선재 결함(`backend-lint-gate-broken-on-main`)을 끌어들일 필요조차 없다.
마지막으로 멀티라인 링크 사각지대 "6건/6파일"은 가드의 regex 가 아니라 CommonMark 표준 파서로 독립 재측정해도
정확히 일치했다. 억지로 새 결함을 만들지 않았고, 4개 지시 항목 모두 "주장이 맞다"는 결론으로 수렴한다.

## 위험도
LOW

STATUS: OK
