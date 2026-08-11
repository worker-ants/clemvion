# 변경 범위(Scope) 리뷰 — 델타 (커밋 `165960a92` + `7977f5c81`)

## 검증 절차

`git diff origin/main` 을 직접 실행해 `codebase/`·`spec/`·`plan/`·`review/` 전체 diff 를
재구성했고(저장소는 읽기만 함, 수정 없음), `git diff 91edf4f6e..165960a92` 로 **이번 라운드가
스스로 만든 델타만** 따로 분리해 "직전 라운드가 만든 텍스트를 자기 교정한 것"과 "새로 건드린
범위"를 구분했다. 세 커밋(`91edf4f6e`→`165960a92`→`7977f5c81`)은 `origin/main` 위 fast-forward
가능, 충돌 없음.

## 발견사항

- **[INFO]** `codebase/` diff 는 컨트롤러 19개 중 18개가 여전히 순수 추가, 1개(`llm-model-config.controller.ts`)만
  삭제 2줄을 포함한다 — **정당한 자기 교정**이다.
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts:118-122`
  - 상세: 이 파일의 `:id/models` 핸들러는 **1차 커밋(`91edf4f6e`, 51건)** 에서 이미
    `@ApiForbiddenResponse` 가 부착됐는데, 바로 위 클래스 주석은 "역할 제한이 없어
    `@ApiForbiddenResponse` 도 두지 않는다" 는 구 정책을 그대로 남기고 있었다(1차 라운드
    `api_contract.md` 가 이 모순을 INFO 로 지적). 이번 델타는 그 주석을 §5-4 확장 근거로
    정정했을 뿐, 데코레이터는 이번 델타에서 추가되지 않았다(1차 커밋에서 이미 부착됨). 자기
    자신이 낳은 결함을 자기 자신이 닫은 것이라 scope 밖 수정이 아니다.
  - 삭제 줄 2 (`역할 제한이 없어 ~ 인증 계층 책임이다`) 는 위 이유로 정당.

- **[INFO]** 13건 확장(`@Roles()` 보유 라우트 부착)은 **scope creep 이 아니라 정당한 완성**이다.
  - 상세: `swagger.md §5-4` 의 넓은 술어("`@Roles(...)` 가 붙었거나 `@WorkspaceId()` 를 소비하는
    엔드포인트")는 **이 PR 이전(2026-08-08, `auth-workspace-membership-guard` PR)** 에 이미
    `origin/main` 에 확정돼 있었다(`git show origin/main:spec/conventions/swagger.md` 로 직접
    확인). 반면 티켓 §2 문구("`@Roles()` 부재")는 그 확정된 규약보다 **좁게** 적힌 드래프팅
    갭이었다 — plan 자신도 "티켓이 규약보다 좁았다" 로 명시한다. 즉 13건은 새 기능·새 요구사항이
    아니라, 이 PR 이 원래 하려던 일("§5-4 를 실제 코드에 소급 반영")을 **1차 라운드가 덜 마친
    부분**을 마저 채운 것이다. security·api_contract·convention_compliance 3명의 독립 리뷰어가
    각각 다른 개수(6/3/12건)로나마 같은 갭을 수렴 지적한 것도 "인접하지만 무관한 작업"이 아니라
    "같은 결함의 다른 부분 관측"임을 뒷받침한다.
  - 13건 전수(`agent-memory.controller.ts` 2·`executions.controller.ts` 2·`knowledge-base.controller.ts` 1·
    `workflow-assistant.controller.ts` 4·`workflow-test-datasets.controller.ts` 3·`workflows.controller.ts` 1)를
    직접 열어 확인 — 전부 실제 `@Roles('viewer'|'editor'|'owner')` 가 붙어 있고, 설명 문자열도
    §5-4 대로 `'<role> 이상 권한 필요'` 로 파생돼 원 51건의 `'워크스페이스 멤버가 아님'` 관례와
    형태만 다를 뿐 같은 규칙의 다른 분기다. 새 데코레이터·새 헬퍼·새 추상화를 도입하지 않았다.
  - 제안: 없음. 다만 티켓 문서(§2) 자체의 문구가 규약보다 좁았던 근본 원인이므로, 향후 유사
    티켓 작성 시 "규약 원문을 그대로 인용"하는 습관을 권장할 수 있으나 이는 이번 diff 의 문제가
    아니다.

- **[INFO]** 13건 중 2건은 `@ApiExcludeEndpoint()` 라우트라 부착해도 생성된 Swagger 문서에
  드러나지 않는다 — 기계적이지만 실질 효과가 없는 부착.
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:221`,
    `codebase/backend/src/modules/executions/executions.controller.ts:242`
    (`triggerStuckRecoveryForTest` / `simulateExecutionRunRedeliveryForTest`, 둘 다
    `@ApiExcludeEndpoint()` e2e 테스트 훅)
  - 상세: `@ApiExcludeEndpoint()` 는 해당 라우트를 OpenAPI 스키마에서 통째로 제외하므로 그
    바로 아래 `@ApiForbiddenResponse` 는 생성 문서에 아무 영향을 주지 못한다. `swagger.md §5-4`
    가 `@ApiExcludeEndpoint()` 라우트에 대한 예외를 별도로 두지 않으므로 "규약을 예외 없이
    기계적으로 적용했다"는 점에서 일관성은 있으나, 실익 없는 부착이라는 점은 참고할 만하다.
  - 제안: 조치 불요 — 해가 없고, 규약이 예외를 두지 않는 이상 임의로 skip 하는 것이 오히려
    일관성을 깰 수 있다.

- **[INFO]** `swagger.md` 앵커 링크를 한 줄로 편 것은 티켓 §3("앵커 추가")의 문자 그대로는
  아니지만, **이 PR 자신의 1차 라운드가 한 뮤테이션 검증 주장을 실제로 참으로 만들기 위한
  직접 후속**이라 정당하다.
  - 위치: `spec/conventions/swagger.md:349-350`
  - 상세: 이 멀티라인 링크(`[` 와 `](` 가 다른 줄)는 **이 PR 이전부터 이미 존재**했다
    (`git show origin/main:spec/conventions/swagger.md` 로 확인 — origin/main 시점에도 이미
    2줄에 걸쳐 있었다). 1차 라운드(`91edf4f6e`)가 그 기존 멀티라인 링크에 앵커만 추가했고,
    1차 리뷰(`testing.md`)가 "가짜 앵커 주입 → RED 확인"이라는 저자의 주장이 실은 두 앵커를
    동시에 바꿔 놓고 하나만 검증한 것이며, 이 특정 링크는 `spec-link-integrity` 의 한 줄 단위
    정규식이 원천적으로 못 보는 사각지대임을 반증했다. 2차 라운드는 **바로 그 반증에 대한 응답**
    으로 이 링크를 한 줄로 펴 실제로 RED/GREEN 이 갈리게 만들었다(plan 실측표로 검증). 대상
    URL·앵커 프래그먼트는 변경되지 않았다 — 순수 줄바꿈 형태만 바뀌었다. 같은 사각지대를 가진
    나머지 5개 파일(`4-nodes/4-integration/2-database-query.md` 등)은 손대지 않고 "후속(범위
    밖)"으로만 등재해, 자신이 이미 건드린 이 파일 하나로 스코프를 의도적으로 한정한 절제도
    확인된다.
  - 제안: 없음 — 발견은 하되 이미 plan/RESOLUTION 에 근거가 명시돼 있어 추가 조치 불요.

- **[INFO]** 위 줄바꿈 정리 과정에서 링크 텍스트의 큰따옴표(`"멤버십 검증은 가드 1곳에서"`)까지
  함께 제거된 것은, 한 줄로 펴는 데 엄밀히 필요한 변경은 아니었다 — 아주 사소한 부수적 텍스트
  편집이 필요한 포맷 수정에 묻어갔다.
  - 위치: `spec/conventions/swagger.md:349-350`
  - 상세: `extractLinks()` 가 요구하는 조건은 "`[`와 `](`가 같은 줄"뿐이며, 큰따옴표 존재 여부와
    무관하다. 같은 대상을 인용하는 §Rationale 문단의 형제 링크(`swagger.md:398`)는 이미
    한 줄이었고 그대로 큰따옴표를 유지한 채 앵커만 추가됐다 — 두 인용의 텍스트 스타일이 이제
    서로 다르다(하나는 따옴표 유지, 하나는 제거). 기능·검증에는 영향 없다.
  - 제안: 없음 — 너무 사소해 조치를 요구할 정도는 아니다. 신경 쓰인다면 후속에서 두 인용의
    스타일을 통일할 수 있다.

- **[INFO]** `3-execution.md` 의 `**Editor+**` bold 제거, `node-cancellation.md`/`3-execution.md`
  의 `1-auth §3.2` 인용 서술 변경 모두 **이 PR 자신의 1차 라운드가 방금 추가한 문장**을
  2차 라운드가 스스로 교정한 것이다 — 사전에 존재하던 무관 텍스트를 건드리지 않았다.
  - 위치: `spec/3-workflow-editor/3-execution.md:178`, `spec/conventions/node-cancellation.md:63`
  - 상세: `git diff 91edf4f6e..165960a92 -- spec/` 로 확인 — 두 줄 모두 1차 커밋이 신설한
    바로 그 줄이며, origin/main 에는 존재하지 않던 텍스트다. 1차 라운드의 cross_spec 리뷰가
    "따옴표로 감싼 인용이 실제로는 verbatim 이 아니어서 grep 재검증자가 오판할 소지가 있다"
    고 지적했고, 2차 라운드는 정확히 그 두 줄만 표 참조 서술로 정정했다. bold 제거도 같은
    커밋에서 `13-replay-rerun.md` 선례에 맞춘 스타일 통일이며, 이 역시 1차 라운드가 막 추가한
    자기 텍스트에 대한 수정이다.
  - 제안: 없음.

- **[INFO]** PR 전체 규모(41 files, `+1675/-22`)는 숫자만 보면 크지만, 대부분(~857줄)이
  `review/code/2026/08/11/17_21_33/**` + `review/consistency/2026/08/11/17_21_43/**` 산출물이며,
  이는 `CLAUDE.md` 가 명시한 표준 저장 위치(`review/code/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/`)에
  이 저장소의 표준 워크플로(구현 완료 후 `/ai-review` 산출물을 함께 커밋)를 따른 것이라
  scope 밖 수정이 아니다. 실질 `codebase/`+`spec/` diff 는 여전히 작다(`+80/-7`, 22 파일).
  - 위치: 없음(디렉터리 단위 관찰)
  - 상세: `plan/in-progress/spec-sync-stop-editor-and-forbidden-routes.md` 도 이 작업 자신의
    추적 문서로, `plan-lifecycle.md` 관례상 실측·검증 근거를 본문에 남기는 것이 정상이다.
  - 제안: 없음.

- **[INFO]** 머지 가능성 — `origin/main` 이 현재 HEAD 의 ancestor(fast-forward 가능), 충돌 없음.
  plan 이 주장하는 lint/타입/문서가드 통과 수치는 이 리뷰(scope) 범위를 벗어나 별도 검증하지
  않았다(1차 라운드 scope 리뷰와 동일한 판단).

## 요약

이번 델타는 얼핏 "직전 라운드에서 NONE 을 받은 순수 추가 PR 에 삭제 줄과 13건의 추가 부착이
생겼다"는 점에서 스코프 재검토가 필요해 보였지만, 각 항목을 소스로 직접 대조한 결과 전부
**이 PR 자신의 1차 라운드가 만든 것을 2차 라운드가 스스로 교정하거나, 1차 라운드가 목표했던
동일 규약(§5-4)을 완성한 것**으로 확인됐다. 13건 확장은 티켓 문구가 아니라 사전에 이미 확정돼
있던 규약 원문을 기준으로 하며 3명의 독립 리뷰어가 수렴 지적했다는 점에서 정당한 스코프 완성이지
creep 이 아니다. `llm-model-config.controller.ts` 주석 정정과 spec 2곳의 인용 서술 정정은 1차
라운드가 방금 추가한 자기 텍스트에 대한 수정이며, 사전에 존재하던 무관 코드·문서를 건드리지
않았다. `swagger.md` 링크 평탄화도 1차 라운드 자신의 검증 주장을 실제로 참으로 만들기 위한
직접 후속이고, 같은 결함을 가진 나머지 5개 파일은 의도적으로 손대지 않고 후속 등재만 해 스코프를
스스로 제한했다. 유일하게 "엄밀히 필요하지는 않았던" 것은 그 평탄화 과정에서 함께 지워진
큰따옴표 두 개와, `@ApiExcludeEndpoint()` 라우트 2곳에 실익 없이 부착된 데코레이터인데, 둘 다
너무 사소해 실질적 위험이 아니다. `codebase/`+`spec/` 실질 diff 는 22개 파일 `+80/-7` 로 여전히
작고, `origin/main` 위 fast-forward 가능해 구조적으로 머지 가능하다.

## 위험도

LOW

STATUS: OK
