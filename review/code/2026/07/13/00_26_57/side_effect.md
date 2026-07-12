# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** harness 스크립트 실패 표면 확대 (의도된 강화, 부작용 표시 목적)
  - 위치: `.claude/test-stages.sh` `cmd_lint`/`cmd_unit`/`cmd_build`
  - 상세: 종전엔 `expression-engine`·`graph-warning-rules`·`node-summary`·`chat-channel-validation` 4개 패키지가 `&&` 체인에 없어 이 패키지들의 lint/test/build 실패가 harness 전체 종료 코드에 반영되지 않았다. 본 변경으로 이 4개(및 `sdk` lint)가 체인에 편입되어, 해당 패키지 중 하나라도 실패하면 `cmd_lint`/`cmd_unit`/`cmd_build` 전체가 non-zero 로 종료된다. 이는 PR 의도(누락된 CI 가드 보강)와 정확히 일치하는 **의도된** 부작용이며, 커밋 메시지(`23db40ea1`)에 "5 패키지 lint/test/build PASS · 전체 lint 스테이지 PASS" 로 사전 검증 기록이 있다. 다만 harness 를 공유하는 다른 개발자/worktree 입장에서는 이전에 조용히 통과하던 스테이지가 이제 실패할 수 있다는 행동 변화이므로 문서화 차원에서 표기.
  - 제안: 조치 불요(의도된 변경, 검증 완료). 후속 PR 에서 lint/test 회귀가 나면 "이 PR 이 원인" 이라는 오귀속을 막기 위해 커밋 메시지에 이미 명시돼 있음.

- **[INFO]** 신규 GitHub Actions 워크플로 추가 (`packages-checks.yml`)
  - 위치: `.github/workflows/packages-checks.yml` (신규)
  - 상세: `pull_request`/`push(main)` 트리거로 신규 CI job 이 추가된다. `paths` 필터가 4개 내부 패키지 소스 + `pnpm-lock.yaml`/`pnpm-workspace.yaml`/워크플로 파일 자체로 스코프돼 있어, 관련 없는 PR 에서 불필요하게 도는 부작용은 없다. `concurrency.group` 도 `github.ref` 기준으로 격리돼 있어 다른 워크플로와 충돌하지 않는다. 외부 서비스 호출은 `actions/checkout`·`pnpm/action-setup`·`actions/setup-node` 표준 액션과 `pnpm install --frozen-lockfile` 뿐으로, 기존 `web-chat-checks.yml`/`frontend-checks.yml` 패턴과 동일하다.
  - 제안: 조치 불요.

- **[INFO]** 기존 CI 워크플로에 스텝 추가 (`web-chat-checks.yml` sdk job Lint)
  - 위치: `.github/workflows/web-chat-checks.yml` sdk-client job
  - 상세: 기존 job 에 `pnpm --filter @workflow/sdk lint` 스텝만 추가. job 이름·트리거·타 스텝 순서 불변. 신규 실패 지점이 생기나 이는 갭 해소가 목적(§ai-review INFO 13_58_56 후속)이므로 의도된 변경.
  - 제안: 조치 불요.

- **[INFO]** dead-import/dead-type 제거 — public API 영향 없음 확인
  - 위치: `codebase/packages/expression-engine/src/functions/date.ts` (`ManipulateUnit` 타입 제거), `codebase/packages/expression-engine/src/functions/string.ts` (`FunctionError` import 제거)
  - 상세: 두 항목 모두 grep 으로 교차검증한 결과, (1) `ManipulateUnit` 은 codebase 전역에서 다른 참조가 없고, (2) `FunctionError` 는 `string.ts` 내부에서 사용되지 않았으며(`errors.ts`/`evaluator.ts` 에서만 사용), (3) 패키지 `src/index.ts` 의 공개 export 목록에도 이 두 식별자는 포함돼 있지 않다. 즉 순수 dead-code 제거이며 시그니처/인터페이스/런타임 동작에 영향 없음(behavior-preserving, 커밋 메시지에도 명시).
  - 제안: 조치 불요.

- **[NONE]** eslint.config.mjs 신규 4건 + package.json devDependency 추가/JSON 포맷 정규화 (5개 패키지)
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk}/{eslint.config.mjs,package.json}`, `pnpm-lock.yaml`
  - 상세: 순수 dev-tooling 추가(eslint·globals·typescript-eslint devDependency, flat config 파일). 런타임 의존성(`dependencies`)·`main`/`types`/`scripts.build`/`scripts.test` 등 기존 공개 스크립트 계약은 불변. `package.json` 의 배열(`moduleFileExtensions`, `files`, `keywords`) 멀티라인 재포맷은 순수 포맷팅으로 값 변경 없음. `pnpm-lock.yaml` 변경은 이 devDependency 추가를 그대로 반영한 것으로 예상 범위 내.
  - 제안: 조치 불요.

- **[NONE]** `plan/in-progress/eia-context-schema-followups.md` frontmatter `worktree` 필드 변경 + 체크박스 갱신
  - 위치: 해당 plan 파일
  - 상세: `worktree: eia-context-dev-cleanups-109831` → `eia-context-dev-residuals-df3de0` 는 plan lifecycle 컨벤션(진행 중인 작업의 현재 worktree 명시)에 부합. 체크박스는 실제 완료된 항목(본 diff 의 harness/CI/eslint 배선)에 한해 `[x]` 로 갱신됨 — 코드 아닌 문서이며 전역/런타임 상태에 영향 없음.
  - 제안: 조치 불요.

## 요약

이번 변경분은 내부 공유 패키지(expression-engine·graph-warning-rules·node-summary·chat-channel-validation·sdk)에 대한 lint 커버리지 신설과 이를 `.claude/test-stages.sh`·신규/기존 GitHub Actions 워크플로에 배선하는 tooling/CI 전용 변경이며, 유일한 production 코드 변경은 expression-engine 의 dead-import/dead-type 2건 제거(둘 다 공개 API 미포함·타 참조 없음을 grep 으로 확인, behavior-preserving)이다. 전역 상태·환경 변수·네트워크 호출·함수 시그니처·공개 인터페이스에 대한 의도치 않은 부작용은 발견되지 않았다. 유일하게 주목할 지점은 harness `&&` 체인에 4개 패키지가 새로 편입되어 이전에 조용히 스킵되던 lint/test/build 실패가 이제 전체 스테이지를 실패시킨다는 점인데, 이는 PR 의 명시적 목적(누락된 CI 가드 보강)과 정확히 일치하며 사전 검증(전체 green)도 기록돼 있어 위험이 아닌 의도된 효과로 판단한다.

## 위험도

NONE
