# 요구사항(Requirement) Review

## 검증 방법

정적 리뷰에 더해 워크트리에서 직접 실행 검증:
- `pnpm --filter @workflow/{expression-engine,graph-warning-rules,node-summary,chat-channel-validation,sdk} lint` — 5개 전부 신규 `eslint.config.mjs` 로 통과 (에러 0).
- `pnpm --filter @workflow/expression-engine test` — 123 tests pass (dead-import 제거 후 회귀 없음).
- `grep -rn "ManipulateUnit"` (repo 전체) → 0 hits, `grep -n "FunctionError" string.ts` → 0 hits — 두 dead-import 제거가 실제로 미사용이었음을 확인.
- `bash -n .claude/test-stages.sh` — 문법 OK.
- `python3 -c "yaml.safe_load(...)"` — 신규/수정 workflow yml 2개 모두 valid YAML.
- `pnpm list -r --filter "@workflow/expression-engine..." --filter "@workflow/graph-warning-rules..." --filter "@workflow/node-summary..." --filter "@workflow/chat-channel-validation..."` — `packages-checks.yml` 의 다중 `--filter` install 스텝이 4개 패키지 전부를 union 으로 선택함(교집합으로 빈 셋이 되는 흔한 pnpm 오해 아님)을 실측 확인.
- `pnpm install --frozen-lockfile` — pnpm-lock.yaml 이 5개 package.json devDependencies 변경과 완전히 동기화돼 있음(성공, lockfile 갱신 불요).

## 발견사항

- **[INFO]** 관련 spec 문서 없음(정상)
  - 위치: 전체 변경(`.claude/test-stages.sh`, `.github/workflows/*.yml`, 5개 패키지 `eslint.config.mjs`/`package.json`, `pnpm-lock.yaml`)
  - 상세: 이번 변경은 CI/lint harness 배선과 dead-import 정리로, `spec/` 는 제품 요구사항·API 계약을 다루고 내부 tooling 배선은 다루지 않는다(`spec/conventions/spec-impl-evidence.md`, `PROJECT.md` 어디에도 패키지명 개별 언급 없음 — grep 확인). spec fidelity 위반이 아니라 애초에 spec 범위 밖.
  - 제안: 없음 (조치 불요).

- **[INFO]** `packages-checks.yml` push 트리거가 pull_request 트리거보다 좁음(`pnpm-workspace.yaml`, 워크플로 자체 파일 경로 누락)이나 기존 sibling 패턴과 동일
  - 위치: `.github/workflows/packages-checks.yml` L196-214 (on.pull_request.paths vs on.push.paths)
  - 상세: push(`branches: [main]`) 트리거 paths 에는 `pnpm-workspace.yaml`·`.github/workflows/packages-checks.yml` 자체가 빠져 있다. 언뜻 비대칭으로 보이지만, 동일 PR 이 함께 수정한 `.github/workflows/web-chat-checks.yml` 의 기존(pre-existing) on.push.paths 도 정확히 같은 패턴(해당 두 항목만 push 에서 제외)이라 이번에 새로 도입된 불일치가 아니라 프로젝트의 기존 관행을 그대로 미러한 것.
  - 제안: 조치 불요(신규 결함 아님). 전역적으로 이 비대칭을 없애고 싶다면 별도 후속(모든 `*-checks.yml` workflow 동시 개정) 이슈로 분리.

## 요구사항 대비 커밋 메시지 교차 검증

커밋 메시지(`chore(packages): 내부 패키지 eslint 커버리지 + harness/CI 배선`)가 주장하는 항목을 모두 실측 확인:
1. "eslint.config.mjs 신설 5개" — sdk/expression-engine/graph-warning-rules/node-summary/chat-channel-validation 전부 생성 확인, 내용 backend/web-chat-sdk 선례와 정렬(Node env, eslint v9/tseslint v8, `argsIgnorePattern:'^_'`).
2. "harness 배선" — `.claude/test-stages.sh` cmd_lint/cmd_test/cmd_build 3곳 모두 4개 패키지 추가(sdk 는 기존 test/build 유지 + lint 신규 추가), diff 그대로 실 파일에 반영됨.
3. "CI: web-chat-checks.yml sdk job 에 Lint 스텝 추가 + 신규 packages-checks.yml" — 둘 다 확인. `web-chat-checks.yml` 의 옛 주석("lint 는 SDK 에 eslint.config 부재라 생략")이 정확히 이 PR 로 해소되는 대상이었음(`review/code/2026/07/11/13_35_47/RESOLUTION.md`, `review/code/2026/07/11/13_58_56/testing.md` 에서 그 주석 출처 확인됨).
4. "dead-import 2건 정리(string.ts FunctionError, date.ts ManipulateUnit)" — 둘 다 사용처 0건 확인, 제거로 인한 회귀 없음(123 tests pass).
5. plan 파일(`plan/in-progress/eia-context-schema-followups.md`) 체크박스 갱신이 실제 완료된 작업과 정확히 일치 — "다른 내부 packages harness 배선", "`packages/sdk` eslint 커버리지" 두 항목 모두 `[x]` 로 전환됐고 완료 설명이 실제 diff 내용과 부합.

## 요약

내부 backend-공유 패키지 4종 + SDK 의 eslint 커버리지 공백을 메우는 tooling/CI 배선 PR로, 코드 로직 변경은 dead-import 2건 제거뿐이라 기능적 리스크가 낮다. 신규 `eslint.config.mjs` 5개가 실제로 lint 를 통과시키고(직접 실행 검증), `.claude/test-stages.sh`·`web-chat-checks.yml`·신규 `packages-checks.yml` 배선이 커밋 메시지·plan 체크박스 서술과 정확히 일치하며, pnpm-lock.yaml 도 `--frozen-lockfile` 로 무결성 확인됨. dead-import 제거(ManipulateUnit 타입, FunctionError import)는 repo 전체 grep 으로 미사용 확인되어 behavior-preserving 주장이 실증됐다. spec fidelity 관점에서는 이 변경 자체가 `spec/` 범위 밖(제품 요구사항이 아닌 tooling 배선)이라 침묵이 정상이며, CRITICAL/WARNING 급 발견사항은 없다.

## 위험도
NONE
