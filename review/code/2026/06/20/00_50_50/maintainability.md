# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[INFO]** `_ensure_deps` 함수의 단순화는 가독성 향상에 기여함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.claude/test-stages.sh` (구 `_ensure_web_chat_deps` 제거 부분)
  - 상세: 기존의 `_ensure_web_chat_deps`는 두 패키지를 별도로 조건부 설치하는 복잡한 로직이었으나, `_ensure_deps`로 단일 `pnpm install --frozen-lockfile` 호출로 대체됨. 함수의 책임이 명확해지고 조건문 중첩이 제거되어 가독성이 개선됨.

- **[INFO]** `cmd_lint/unit/build`의 패턴이 일관되고 반복 구조가 명료함
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.claude/test-stages.sh`
  - 상세: 각 `cmd_*` 함수가 `_ensure_deps && pnpm --filter <pkg> <cmd>` 패턴을 4회 반복한다. 반복 자체는 의도적이고 일관된 구조이나, 패키지 목록(`backend`, `frontend`, `@workflow/web-chat`, `channel-web-chat`)이 `cmd_lint`, `cmd_unit`, `cmd_build` 세 곳에 모두 중복 하드코딩되어 있다. 패키지 추가/제거 시 3곳을 동시에 수정해야 하는 유지보수 부담이 있음.
  - 제안: 패키지 목록을 배열 변수(`WORKSPACE_PKGS`)로 상단에 한 번 선언하고 반복문으로 실행하거나, 현재 구조를 유지하더라도 허용 가능한 수준임(패키지 수가 적고 변경 빈도가 낮으므로 CRITICAL 수준은 아님).

- **[INFO]** `docker-compose.e2e.yml`의 playwright-runner 볼륨 목록 하드코딩
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/docker-compose.e2e.yml` (playwright-runner volumes 섹션)
  - 상세: 내부 패키지(`expression-engine`, `node-summary`, `chat-channel-validation`, `graph-warning-rules`)의 `node_modules` anonymous volume이 개별 경로로 나열됨. 새 내부 패키지가 `codebase/packages/`에 추가되면 이 목록도 수동으로 갱신해야 하며, `pnpm-workspace.yaml`의 `packages/*` glob과 연동되지 않음.
  - 제안: 주석으로 "새 내부 패키지 추가 시 이 목록도 보충해야 함"을 명시하거나, 장기적으로 공통 설치 전략 통일을 고려. 단기 허용 범위 내.

- **[INFO]** `backend/Dockerfile`의 runner 단계에서 devDeps 포함 경고 주석
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/codebase/backend/Dockerfile` (runner 단계 주석)
  - 상세: `# devDeps 까지 포함 — 이미지 크기 최적화는 후속 과제.`라는 주석이 명시적으로 TODO를 인정함. 이는 현재 PR 범위에서 의도적으로 defer된 사항이므로 차단 이슈는 아니나, 후속 plan이 없으면 잊힐 위험이 있음.
  - 제안: `plan/` 에 이 후속 최적화를 추적하는 항목이 있는지 확인 권장.

- **[INFO]** `package.json`의 `pnpm.overrides` 내 `//` 주석 키 패턴
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/package.json`
  - 상세: `"//overrides"`, `"//swagger-pin"`, `"//onlyBuiltDependencies"` 세 개의 `//` 주석 키가 `pnpm` 객체 안에 혼재함. JSON에서 주석을 표현하는 관용 방식이나, 키 이름이 제각각(`//overrides` vs `//swagger-pin`)이어서 일관성이 다소 부족함. 또한 `//swagger-pin` 주석이 `onlyBuiltDependencies` 배열과 `overrides` 사이에 위치해 있어 논리적 연결이 불명확함.
  - 제안: 주석 키 네이밍을 `"//note-overrides"`, `"//note-swagger-pin"` 등으로 통일하거나, 관련 설정 직전에 배치하는 방식으로 일관성 확보.

- **[INFO]** `.nvmrc`의 메이저 버전만 기재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.nvmrc`
  - 상세: `.nvmrc`에 `24`만 기재됨. `packageManager`에는 `pnpm@10.23.0`으로 패치 버전까지 고정하는 반면, Node 버전은 메이저만 선언. 이는 의도된 정책(advisory)으로 `PROJECT.md §Node floor`에 명시되어 있으므로 허용 가능.

- **[INFO]** `web-chat-checks.yml`의 `codebase/packages/sdk/**` 트리거 경로 추가
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/migrate-pnpm-7c3a/.github/workflows/web-chat-checks.yml`
  - 상세: `codebase/packages/sdk/**` 경로가 PR 트리거에 추가됨. 그러나 이 경로가 실제로 존재하는 패키지(`@workflow/sdk`)인지, `web-chat-sdk`와 어떤 관계인지 주석이 없음. `sdk` job의 이름은 `web-chat-sdk (lint/test/build)`이나 새 경로와의 연관이 불명확.
  - 제안: `codebase/packages/sdk/**` 트리거 경로 옆에 "packages/sdk = @workflow/sdk, web-chat-sdk의 의존성" 등 간략한 주석 추가 권장.

## 요약

이번 변경은 npm에서 pnpm workspace로의 대규모 마이그레이션으로, 전반적으로 유지보수성이 향상되었다. 핵심 개선 사항은 패키지별 개별 `npm ci + build` 반복 코드 제거, `_ensure_web_chat_deps` 특수처리 폐기, overrides 분산에서 루트 통합으로의 집중화다. 발견된 이슈는 모두 INFO 수준으로, 주로 패키지 목록 3중 중복(`cmd_lint/unit/build`), playwright-runner의 내부 패키지 node_modules 수동 열거, `package.json` 내 주석 키 명명 불일관성 등 소규모 유지보수 부담이다. 이 변경이 도입하는 단순성(단일 lockfile, 단일 install, workspace 프로토콜)이 이러한 사소한 중복보다 훨씬 큰 유지보수성 이득을 제공하므로, 전체적으로 긍정적인 변경으로 평가된다.

## 위험도

NONE
