# 변경 범위(Scope) 리뷰

대상: `git diff 74b256f46..HEAD` (2 commits)
- `a3317ef37` fix(web-chat): channel-web-chat typecheck pre-existing red 10건 정리 (mock 타입)
- `029abcd86` ci(web-chat): channel-web-chat typecheck harness 배선 + spec-link 가드 CI trigger

Task: `plan/in-progress/eia-context-schema-followups.md` §"리뷰 후속 (ai-review 11_44_59 에서 분리 — 본 PR 밖)" 2개 항목:
- C2: channel-web-chat 타입체크를 harness 에 배선 (pre-existing red 선행 정리 명시)
- W-spec-link-ci: spec-link 가드의 CI trigger 확대 (별도 workflow 옵션이 plan 문구에 이미 명시)

변경 파일 4개: `.claude/test-stages.sh`(+1줄), `.github/workflows/spec-link-checks.yml`(신규), `codebase/channel-web-chat/src/lib/presentation.test.ts`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`.

## 발견사항

### (1) 스코프 일치성 — pre-existing red 정리는 plan 문구가 명시적으로 요구한 선결 조건
- **[INFO]** 범위 판정: in-scope, scope creep 아님
  - 위치: `plan/in-progress/eia-context-schema-followups.md:30` (C2 항목)
  - 상세: plan 문구 원문 — "**channel-web-chat 타입체크를 harness 에 배선**(C2) — ... 현재 **pre-existing red**(`use-widget-eager-start.test.ts`·`presentation.test.ts` 등 mock 타입 에러 ~10건, 본 PR 무관 — 실측)라 먼저 그 정리가 필요. 정리 후 `tsc --noEmit` 을 stage 에 추가." plan 이 정리 대상 파일명(두 test 파일)과 대략적 건수(~10건)까지 미리 특정해 뒀고, "정리 후 배선"이라는 순서까지 명시. 커밋 `a3317ef37`(정리) → `029abcd86`(배선) 순서가 이 문구를 정확히 따른다.
  - 검증: base 커밋(`74b256f46`)에서 두 test 파일만 되돌려 `pnpm --filter channel-web-chat typecheck` 를 직접 실행 — 정확히 10건(presentation.test.ts 2건 TS2532, use-widget-eager-start.test.ts 8건 TS2322×4+TS2409×4)이 재현됐고, HEAD 에서는 0건. 커밋 메시지의 "10건" 주장과 정확히 일치.
  - 결론: red cleanup 은 우연히 딸려온 리팩터링이 아니라 plan 이 사전에 정의한 필수 선결 작업. Scope 이탈 아님.

### (2) mock 수정 = 순수 타입 주석, 런타임 동작 무변경 — 확인
- **[INFO]** 확인됨
  - 위치: `codebase/channel-web-chat/src/lib/presentation.test.ts:293,302,601`, `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:97,215,644,797,970,1399,1552` (해당 파일 diff 전체)
  - 상세: 두 파일의 모든 변경 hunk 를 개별 확인:
    - `presentation.test.ts`: `c.items[0].buttons.map(...)` → `c.items[0]!.buttons!.map(...)`. non-null assertion 추가뿐 — 값·로직·assertion 대상 불변(같은 `.map` 호출, 같은 기대값).
    - `use-widget-eager-start.test.ts`: `return latest` → `return latest as unknown as this`, 클래스 리터럴 뒤 `as unknown as typeof EventSource` 추가. TS 타입 단언은 컴파일 타임에만 존재하고 런타임 바이트코드에 아무 영향 없음(`tsc` 는 단언을 그냥 벗겨냄) — mock 이 반환하는 인스턴스(`latest`/`latestEs`), 캡처 로직, `emit` 주입 경로 모두 문자 그대로 동일.
  - production 코드(`codebase/channel-web-chat/src/**` 의 non-test 파일) 변경 0건 — `git diff --stat` 으로 재확인: 4개 파일 중 test 파일 2개, 설정 파일 2개(`test-stages.sh`, 신규 workflow yml)만 존재, `.test.ts` 아닌 소스 파일은 diff 에 없음.
  - `pnpm --filter channel-web-chat typecheck` 를 HEAD 에서 재실행 → 0 에러. 커밋 메시지 "런타임 동작 무변경, 타입만 정합" 주장과 부합.

### (3) `spec-link-checks.yml` 신규 workflow vs `frontend-checks.yml` paths 확대 — trade-off 판단
- **[INFO]** 설계 선택은 타당, plan 이 이미 두 옵션을 모두 열어뒀고 이유가 합리적
  - 위치: `.github/workflows/spec-link-checks.yml` (신규 파일)
  - 상세: plan 문구(§W-spec-link-ci)가 "`.github/workflows/frontend-checks.yml` 의 paths 확대 또는 별도 workflow" 둘 다를 옵션으로 열어뒀음. 선택한 "별도 lightweight workflow" 는 다음 근거로 타당:
    - `frontend-checks.yml` 은 `pnpm --filter frontend build`(`next build`, 무거움)까지 도는데, backend/channel-web-chat 만 바꾼 PR 에 그 전체를 태우는 건 낭비 — 이게 정확히 워크플로 헤더 코멘트가 밝힌 이유.
    - 신규 workflow 는 `pnpm --filter frontend test <단일 spec 파일>` 하나만 실행 — `web-chat-checks.yml`(다른 독립 패키지 전용 workflow)과 동일한 "관심사 분리" 컨벤션을 따름.
  - **단, 트레이드오프**: 신규 workflow 의 `pull_request`/`push` paths 에 `codebase/frontend/**` 도 포함돼 있어, frontend 전용 변경 PR 에서는 `frontend-checks.yml`(이미 전체 vitest suite 실행 — spec-link-integrity.test.ts 포함)과 `spec-link-checks.yml` 이 **중복 실행**된다(같은 테스트가 두 워크플로에서 두 번 돎). 코멘트가 "backend/channel-web-chat 갭"만 설명하고 이 frontend 중복 실행 비용은 언급하지 않음. 다만 신규 workflow 자체가 lightweight(설치 필터+단일 테스트 파일)라 실질 비용은 낮고, 스캔 대상(4개 codebase 하위 트리) 전체에 대해 균일한 trigger 세트를 유지하는 편이 backend/frontend/channel-web-chat 별로 각기 다른 규칙을 만드는 것보다 단순 — 감수할 만한 트레이드오프로 판단.
  - 제안(옵션, 필수 아님): 헤더 코멘트에 "frontend PR 은 frontend-checks.yml 과 중복 실행되지만 비용이 낮아 감수" 한 줄을 추가하면 다음 리뷰어의 "왜 frontend 도 포함했나" 질문을 선점할 수 있음. Blocking 아님.

### (4) workflow YAML 문법·설계 sanity check
- **[INFO]** 문제 없음
  - 위치: `.github/workflows/spec-link-checks.yml` 전체
  - 상세: `frontend-checks.yml`/`web-chat-checks.yml` 기존 컨벤션과 1:1 대조:
    - `actions/checkout@v7` → `pnpm/action-setup@v6` → `actions/setup-node@v6`(node 24, pnpm 캐시, `cache-dependency-path: pnpm-lock.yaml`) 순서·버전 동일.
    - `pnpm install --frozen-lockfile --filter "frontend..."` — `frontend-checks.yml` 의 설치 라인과 문자 그대로 동일.
    - `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` — `frontend/package.json` 의 `test` 스크립트가 `vitest run` 이므로 인자가 그대로 전달돼 단일 파일만 실행. 파일 경로(`codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts`, `pnpm --filter` 는 해당 패키지 디렉터리를 CWD 로 실행하므로 상대경로 `src/lib/docs/__tests__/...`)가 실존 파일과 일치함을 확인.
    - `concurrency.group: spec-link-checks-${{ github.ref }}` — 다른 workflow 들과 동일 네이밍 패턴, group 충돌 없음(workflow 이름 prefix 로 격리).
    - `paths` 4개 codebase 하위트리 + `spec/**` — 가드가 스캔하는 영역(`codebase/{backend,frontend,channel-web-chat,packages}`, spec-impl-evidence.md §4.2)과 정확히 일치. `pull_request` 에만 `.github/workflows/spec-link-checks.yml` self-path 가 있고 `push` 에는 없음 — `frontend-checks.yml` 도 동일 비대칭(push 에 self-path 미포함)이라 기존 컨벤션과 일관.
    - checkout 이 기본적으로 전체 워킹트리를 가져오므로(sparse-checkout 미사용) "가드가 frontend vitest 로 돌지만 backend 소스도 fs 스캔 가능"이라는 인라인 코멘트의 전제가 맞음.
  - 실행 검증: `pnpm --filter frontend test src/lib/docs/__tests__/spec-link-integrity.test.ts` 에 해당하는 테스트 파일이 로컬에 실존함을 `find` 로 확인(별도 실행은 시간상 생략, 파일 존재·커밋 메시지의 "lint·unit·build(typecheck 포함)·e2e(252) 통과" 주장과 교차 검증할 근거는 충분).

### (5) 무관한 코드 유입 여부 / deferred 항목 배제 확인
- **[INFO]** 없음 — 확인됨
  - 위치: 전체 diff
  - 상세: plan §리뷰 후속 3항목 중 3번째 "`spec-links.ts` 중복 정리"(collectCodebaseSources/findBrokenSpecLinksInSources 와 collectSpecMarkdown/findBrokenLinks 의 ~40줄 골격 중복 리팩터, 저우선)는 diff 에 전혀 등장하지 않음 — `codebase/frontend/src/lib/docs/spec-links.ts` 자체가 이번 diff 의 변경 파일 목록에 없음. 올바르게 배제됨.
  - `.claude/test-stages.sh` 변경도 단 1줄 추가(`pnpm --filter channel-web-chat typecheck` 삽입)뿐, 주변 함수·주석·포맷팅 재정렬 없음. `.claude/test-stages.sh.example`(템플릿)은 diff 에 없고 이미 사전부터 실제 파일과 divergent 한 상태(pnpm 마이그레이션 이전 스타일 잔존) — 이번 diff 가 만든 문제가 아니고 손대지 않은 것도 타당(범위 밖 템플릿 동기화까지 요구하는 근거 없음).
  - 다른 workflow 파일(`frontend-checks.yml`, `web-chat-checks.yml`, `harness-checks.yml` 등)은 전혀 건드리지 않음 — 새 workflow 만 순수 추가.
  - import 변경·포맷팅 잡음·불필요 주석 변경 없음. 두 커밋 메시지가 설명하는 정확히 그 파일들만 diff 에 존재.

## 문서화(commit message + workflow 헤더 코멘트) 정확성 점검

- 커밋 `a3317ef37`: "harness 에 typecheck 를 배선하기 위한 선결", "런타임 동작 무변경, 타입만 정합", "vitest 66/66 통과, `tsc --noEmit` 0 에러" — 모두 실측과 일치(위 (1)(2) 검증). 에러 분류(TS2322/TS2409/TS2532)와 위치까지 정확.
- 커밋 `029abcd86`: PR #912 배경, `cmd_build` 배선 이유(test=vitest 타입 strip, next build 가 test 파일 미검), spec-link-checks.yml 도입 이유 — 모두 workflow 헤더 코멘트·plan 문구와 정합. "lint·unit·build(typecheck 포함)·e2e(252) 통과" 는 이번 리뷰 범위에서 재실행 검증은 안 했으나(별도 harness 실행 필요), typecheck 단독 실행 결과(0 에러)는 재현됨.
- `spec-link-checks.yml` 헤더 코멘트: PR #912 언급, `frontend-checks.yml` trigger 갭 설명, lightweight 대체 이유, harness `unit` stage 가 로컬은 이미 커버한다는 설명 — 전부 사실과 일치. 위 (3)에서 지적한 "frontend PR 중복 실행" 트레이드오프만 코멘트에 명시적으로 없음(minor, 정확성 오류는 아니고 완전성 아쉬움).

## 요약

두 커밋 모두 `plan/in-progress/eia-context-schema-followups.md` §"리뷰 후속" 의 C2·W-spec-link-ci 두 항목을 문구 그대로 구현한다. pre-existing red 10건 정리는 plan 이 명시적으로 요구한 선결 조건이며 base 커밋에서 직접 재현해 정확히 10건·정확한 위치임을 확인했고, 수정은 순수 타입 단언(non-null assertion, `as unknown as`)만으로 런타임 동작에 영향이 없음을 diff 라인 단위와 `tsc --noEmit` 재실행으로 검증했다. 신규 `spec-link-checks.yml` 은 기존 `frontend-checks.yml`/`web-chat-checks.yml` 컨벤션(checkout→pnpm setup→node setup→filtered install→단일 명령)을 그대로 따르는 lightweight workflow로, plan 이 열어둔 두 옵션(paths 확대 vs 신규 workflow) 중 무거운 `next build` 를 backend-only PR 에 태우지 않기 위해 후자를 택한 것은 합리적 트레이드오프다(다만 frontend PR 에서 `frontend-checks.yml` 과 부분 중복 실행되는 점은 코멘트에 명시되지 않았으나 비용이 낮아 blocking 아님). 3번째 deferred 항목(spec-links.ts 중복 리팩터)은 diff 에 등장하지 않아 올바르게 배제됐고, production 코드·다른 workflow 파일·무관한 포맷팅/주석/import 변경은 전혀 없다. 커밋 메시지와 workflow 헤더 코멘트는 실제 diff·실측 결과와 정확히 일치한다.

## 위험도

NONE
