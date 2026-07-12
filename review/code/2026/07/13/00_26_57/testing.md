# 테스트(Testing) 리뷰

## 발견사항

- **[WARNING]** `.claude/test-stages.sh` 자체의 wiring 정확성을 검증하는 회귀 가드가 없음
  - 위치: `.claude/test-stages.sh` (cmd_lint/cmd_unit/cmd_build), `.github/workflows/harness-checks.yml`
  - 상세: 본 PR 의 핵심 산출물은 "내부 packages 가 harness 에서 누락(orphaned)됐던" 결함(sdk 가 과거 미배선이었던 것과 동일 클래스)을 고치는 것인데, 그 결함 클래스 자체를 재발 방지하는 자동 테스트가 없다. `.claude/test-stages.sh` 는 어떤 GitHub Actions workflow 의 `paths` trigger 에도 등재돼 있지 않다 (`harness-checks.yml` 은 `.claude/tools/**`·`.claude/hooks/**`·`.claude/skills/**` 등만 커버하고 `.claude/test-stages.sh` 자체는 빠져 있음, `grep -rln "test-stages" .github/workflows/` 결과 0건 — 직접 확인). 유일한 harness 관련 unittest(`test_run_test_watchdog.py`)도 실제 파일이 아니라 stub config 를 주입해 watchdog(timeout/kill) 로직만 검증하며 cmd_lint/cmd_unit/cmd_build 의 실제 내용(어떤 패키지가 배선됐는지)은 검증하지 않는다. 신설된 `packages-checks.yml` 도 `test-stages.sh` 를 호출하는 게 아니라 `pnpm --filter` 커맨드를 독립적으로 재선언(중복)하므로, 두 파일이 향후 drift(예: 새 내부 패키지 추가 시 한쪽만 배선)해도 서로 검증해주지 않는다.
  - 제안: `pnpm-workspace.yaml` 의 `codebase/packages/*` glob 을 파싱해 `test-stages.sh` 의 cmd_lint/cmd_unit/cmd_build 가 모든 workspace 패키지를 참조하는지 확인하는 harness unittest 추가(`.claude/tests/`), 또는 최소한 `.claude/test-stages.sh` 를 `harness-checks.yml` 의 trigger paths 에 등재.

- **[WARNING]** `packages-checks.yml` 단일 job 순차 실행이 다중 패키지 동시 실패 시 불완전한 신호를 준다
  - 위치: `.github/workflows/packages-checks.yml` (Lint/Test/Build 각 step 의 4줄 `run: |` 블록)
  - 상세: GitHub Actions 의 기본 bash 실행은 `set -e` 라 멀티라인 `run: |` 블록에서 한 줄이 실패하면 이후 줄은 실행되지 않고 step 이 즉시 실패한다. 4개 패키지(expression-engine/graph-warning-rules/node-summary/chat-channel-validation)의 lint/test/build 를 각각 하나의 스텝에 순서대로 나열했으므로, 예컨대 expression-engine 과 chat-channel-validation 이 동시에 깨지면 CI 한 번의 실행으로는 expression-engine 실패만 보고되고 chat-channel-validation 실패는 앞의 것을 고쳐 재실행해야 드러난다. 같은 저장소의 `web-chat-checks.yml` 은 sdk/widget/sdk-client 를 독립 job(matrix 유사)으로 분리해 이 문제가 없다 — 패턴 일관성도 아쉽다.
  - 제안: 4개 패키지를 `strategy.matrix` 로 분리해 병렬·독립 job 화하면 실패 신호가 완전해지고(모든 패키지 결과 동시 확인) CI 시간도 단축된다.

- **[INFO]** dead-code 제거(`date.ts`/`string.ts`) 안전성 — 실측으로 회귀 위험 없음 확인
  - 위치: `codebase/packages/expression-engine/src/functions/date.ts`(미사용 `type ManipulateUnit` 제거), `string.ts`(미사용 `FunctionError` import 제거)
  - 상세: 두 변경 모두 순수 dead-code 제거(동작 변화 없음). 직접 검증: 저장소 전체에서 `ManipulateUnit` 참조 0건(`grep -rn`), `string.ts` 내 `FunctionError` 사용 0건. 신규 `eslint.config.mjs`(`@typescript-eslint/no-unused-vars`)가 실제로 이 데드코드를 처음 잡아낸 것으로 보인다. Negative-case 로 직접 검증(임시로 미사용 var 삽입 후 lint 실행 → `'unusedTestVar' is assigned a value but never used` 에러로 정확히 fail, 이후 원복해 clean 확인) — 새 lint 가드가 실제로 작동하는 살아있는 가드임을 실증했다(과거 "타입 가드 테스트가 실제 실행되는지" 류의 회귀 클래스에 해당하지 않음).
  - 제안 없음(참고용, 문제 아님).

- **[INFO]** 4개 `eslint.config.mjs` 파일이 사실상 동일한 보일러플레이트(27줄) 반복
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary}/eslint.config.mjs` (sdk 것까지 포함하면 5개)
  - 상세: 상단 주석 1줄(패키지명)만 다르고 나머지는 완전히 동일(rules·globals·ignores). 향후 공통 규칙 변경 시 5곳을 각각 수동 동기화해야 하는 drift 위험이 있다. 다만 각 패키지가 독립 배포 단위라 공유 config 팩토리를 두면 devDependency 배선이 복잡해지는 trade-off가 있어 우선순위는 낮다.
  - 제안: 필요 시 `.claude/tools/` 또는 루트에 `createInternalPackageEslintConfig(name)` 같은 공유 팩토리 추출 검토(당장 강제할 사안은 아님).

- **[INFO]** 회귀 테스트 — 직접 실행으로 clean 확인
  - 위치: `.claude/test-stages.sh` cmd_lint 전체, 개별 `pnpm --filter <pkg> lint/test`
  - 상세: `bash -c 'source .claude/test-stages.sh && cmd_lint'` 전체 체인을 직접 실행해 backend/frontend/web-chat/sdk/4개 신규 패키지/channel-web-chat 까지 end-to-end 로 clean 통과(사전 존재하던 channel-web-chat 무관 warning 1건 제외) 확인. `expression-engine test` 123 tests pass. package.json 의 `moduleFileExtensions`/`files`/`keywords` 배열 개행 포맷 변경은 순수 포맷팅이며 기능 영향 없음.

## 요약

본 변경은 신규 애플리케이션 로직이 아니라 내부 공유 패키지(expression-engine/graph-warning-rules/node-summary/chat-channel-validation/sdk) 의 lint/CI 하네스 배선이며, 소스 변경은 순수 dead-code 제거 2건뿐이다. 로컬에서 lint/test 를 직접 재실행해 새 eslint 설정과 하네스 배선이 실제로 작동함(positive case)과 lint 가 실제 위반을 fail 시킴(negative case)을 모두 실증했고, dead-code 제거도 참조 0건으로 안전함을 확인했다. 다만 이번 PR 이 고치는 "패키지가 harness 에서 누락되는" 결함 클래스 자체를 막아줄 자동 회귀 가드(test-stages.sh 내용 검증)가 없어 동일 결함이 재발할 여지가 남아 있고, 신규 CI job 이 4개 패키지를 단일 순차 스텝에 몰아 실패 신호를 불완전하게 만드는 점은 개선 여지가 있다. 두 사항 모두 차단 사유는 아니다.

## 위험도

LOW
