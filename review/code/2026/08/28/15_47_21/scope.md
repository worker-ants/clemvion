# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** 서로 다른 두 개의 후속 항목이 한 changeset 에 묶임
  - 위치: `codebase/backend/package.json:49`(삭제된 `@eslint/eslintrc` 줄, diff 기준 원본 92행 뒤) / `plan/in-progress/deps-peer-gating-and-eslint10.md` 체크리스트(`(후속, INFO) cause 부착 판단 근거` 항목과 `(후속) @eslint/eslintrc 죽은 선언 제거` 항목)
  - 상세: 이번 diff 는 (1) 이전 리뷰 라운드가 남긴 INFO("cause 부착 근거를 테스트로 잠가라")를 닫는 테스트 2건 추가와, (2) `@eslint/eslintrc` 죽은 devDependency 제거(+ 그에 따른 `pnpm-lock.yaml` 재해석)라는, 성격이 다른 두 후속 작업을 함께 담고 있다. 각각은 plan 문서에 개별 체크박스로 사전 등재·근거(0건 사용처 grep, dependabot 노이즈 등)가 남아 있어 "의도 이상의 변경"이라 보기는 어렵지만, 엄밀히는 별개 커밋으로 쪼갤 수 있었던 두 결정이 한 diff 에 합쳐졌다.
  - 제안: 현재 근거 수준이면 그대로 두어도 무방하나, 이후 유사 상황에서는 "테스트 추가"와 "죽은 의존성 제거"처럼 독립적으로 되돌릴 수 있어야 하는 변경은 별도 커밋으로 분리하는 편이 리뷰 단위를 더 좁게 유지한다.

- **[INFO]** 신규 테스트 2건에 각 4~6줄의 한국어 근거 주석이 붙음
  - 위치: `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:133-140`(신규 `it` 블록 앞 주석) / `codebase/backend/src/nodes/data/code/code.handler.spec.ts:198-201, 216-220`
  - 상세: 테스트 코드 자체보다 주석이 더 길다. 다만 내용은 "왜 이 케이스가 필요한가(축)"와 "왜 두 파일의 단언 형태가 다른가(realm 차이)"라는 판별 기준을 그 자리에 못박는 것으로, 프로젝트가 다른 곳에서도 채택하는 근거-주석 관례와 일치한다. 불필요한 주석 변경(관점 6)으로 보지 않는다.
  - 제안: 조치 불필요.

- **[INFO]** `pnpm-lock.yaml` 의 부수 변경(jest-core/jest-config/jest-cli 중복 해소 제거)
  - 위치: `pnpm-lock.yaml` — hunk `@@ -11739,42 +11736,6 @@`, `@@ -17988,13 +17949,13 @@`, `@@ -18043,35 +18004,6 @@`, `@@ -18103,37 +18035,6 @@`, `@@ -18400,7 +18301,7 @@`, `@@ -18413,7 +18314,7 @@` (전부 `snapshots:` 섹션)
  - 상세: `@eslint/eslintrc` 제거로 backend 의 peer 해석 그래프가 바뀌면서, ts-node 파라미터가 없는 `@jest/core@30.4.2` / `jest-config@30.4.2` 중복 스냅샷이 사라지고 파라미터가 붙은 버전으로 통일됐다. 8개 hunk 전부가 이 재해석 범위(backend importer + jest 계열) 안에 있고, frontend·channel-web-chat 등 무관 워크스페이스는 건드리지 않는다 — `pnpm install` 재실행에 따른 정상적인 기계적 부산물로 판단.
  - 제안: 조치 불필요.

- **[관찰, 코드 결함 아님]** 리뷰 중 공유 worktree 에서 일시적 상태 오염 관측
  - 상세: 리뷰 중 `git status`/`git diff HEAD` 로 확인했을 때 한 시점에 `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.ts` 와 `codebase/backend/src/nodes/data/code/code.handler.ts` 두 파일에서 `cause: err` 가 제거된 상태(+ `expression-resolver.service.ts.bak` untracked 파일)가 잡혔고, 그 상태에서 이번 diff 가 추가한 신규 테스트 2건이 RED 였다. 수 초 뒤 재확인하니 두 파일 모두 `cause: err` 가 복원돼 있었고 `.bak` 파일도 사라졌으며, `git status` 는 완전히 clean(untracked review 산출물 제외)했고 두 테스트도 GREEN 으로 재현됐다. 이는 이번 리뷰 대상 diff(5개 파일)에는 애초에 포함되지 않은 파일들이며, plan 문서가 기록한 "뮤테이션 실측(cause: err 제거 → RED 확인 → 복원)" 절차를 **다른 병렬 서브에이전트가 검증 목적으로 shared worktree 에서 실행 중이었던 것**과 일치하는 타이밍이다(memory: "병렬 리뷰어가 저장소를 뮤테이션해 서로를 오염시킨다"). 이번 리뷰가 대상으로 하는 diff 자체의 결함이 아니라고 판단해 등급을 매기지 않는다.
  - 제안: 별도 조치 불필요. 다만 오케스트레이터가 여러 리뷰 서브에이전트를 같은 worktree 에서 동시 구동한다면, 뮤테이션 테스트(원본 삭제→검증→복원)를 수행하는 에이전트는 스스로 격리된 scratch 사본에서 수행하거나 최소한 복원을 원자적으로 마친 뒤 다음 단계로 넘어가도록 재확인할 것.

## 요약

리뷰 대상 5개 파일(`codebase/backend/package.json`, 신규 테스트 2건이 추가된 두 `*.spec.ts`, 이를 그대로 서술한 `plan/in-progress/deps-peer-gating-and-eslint10.md`, 그리고 그에 따른 기계적 `pnpm-lock.yaml` 재해석)은 모두 같은 plan 문서가 사전에 등재·정당화한 좁은 후속 작업(이전 리뷰 라운드 INFO 를 테스트로 닫기 + 죽은 `@eslint/eslintrc` devDependency 제거)에 정확히 대응한다. 무관한 파일·리팩토링·포맷팅·불필요한 임포트/주석 변경은 발견되지 않았고, lockfile 변경 범위도 package.json 변경과 정합한다. 유일한 지적은 성격이 다른 두 후속 항목이 한 changeset 에 합쳐진 점(INFO)이며, 리뷰 도중 관측된 소스 파일 뮤테이션은 이번 diff 와 무관한 병렬 리뷰어의 일시적 worktree 오염으로 판단돼 별도 등급을 매기지 않았다.

## 위험도

LOW
