# 의존성(Dependency) Review — masked-marker-contract-7d2e14

## 발견사항

- **[INFO]** `pnpm-lock.yaml` 에 이번 PR 목표(마커 SoT 패키지 추출)와 무관한 `eslint-config-next` peer-dependency 해석 그래프 재구성이 동반됐다
  - 위치: `pnpm-lock.yaml` — `importers` 섹션의 frontend `eslint-config-next` 항목(`specifier: ^16.3.0`) 및 `snapshots` 섹션의 `eslint-config-next@16.3.0(...)` / `eslint-import-resolver-typescript@...` / `eslint-module-utils@...` / `eslint-plugin-import@...` 키들(게이트 없는 대량 삭제·재작성 구간이라 hunk 헤더 `@@ -390,7 +393,7 @@`, `@@ -16220,33 +16253,13 @@` 로 기재).
  - 상세: `git diff origin/main -- pnpm-lock.yaml` 로 직접 대조. `eslint-config-next@16.3.0` 의 resolution key 가 `(@typescript-eslint/parser@8.67.0(...))(eslint@...)(typescript@...)` 3-파라미터에서 `(eslint@...)(typescript@...)` 2-파라미터로 줄고, `@typescript-eslint/parser` 는 `transitivePeerDependencies` 로 이동했다. 같은 파급으로 `eslint-import-resolver-typescript`/`eslint-module-utils`/`eslint-plugin-import` 의 스냅샷 키도 연쇄 재작성된다. **버전 번호 자체는 전부 불변**(`eslint-config-next@16.3.0`, `typescript-eslint@8.67.0` 등)이라 취약점·라이선스·호환성 리스크는 없다 — 새 workspace 패키지(`codebase/packages/masked-markers`) 추가로 `pnpm install` 이 전체 그래프를 재해석한 부수 효과로 보인다. 이 노이즈는 `scope.md`/`side_effect.md` (11_27_29 라운드)에서도 이미 INFO 로 확인됐다.
  - 제안: 조치 불필요(버전 불변, 정상적인 `pnpm install` 재해석). PR 설명에 "masked-markers 와 무관한 lockfile 재정렬 포함" 한 줄을 남기면 리뷰 노이즈를 줄일 수 있다.

- **[INFO]** 신규 `@workflow/masked-markers` 패키지는 런타임 `dependencies` 가 전혀 없고, `devDependencies` 8개가 형제 패키지(`@workflow/ai-end-reason`, `@workflow/graph-warning-rules`)와 **완전히 동일**하다 — 새 외부 패키지·버전 계열이 하나도 늘지 않았다 (긍정적 확인, 조치 불요)
  - 위치: `codebase/packages/masked-markers/package.json` (전체 `devDependencies` 블록) — `codebase/packages/ai-end-reason/package.json`/`codebase/packages/graph-warning-rules/package.json` 과 diff 없이 일치함을 `cat` 대조로 확인.
  - 상세: `@eslint/js ^9.18.0`, `@types/jest ^30.0.0`, `eslint ^9.18.0`, `globals ^17.9.0`, `jest ^30.0.0`, `ts-jest ^29.2.5`, `typescript ^5.7.3`, `typescript-eslint ^8.65.0` 전부 caret 고정이고, `pnpm-lock.yaml` 스냅샷에서 형제 패키지와 동일한 해석 버전(`eslint@9.39.4`, `typescript@5.9.3`, `typescript-eslint@8.67.0` 등)으로 수렴한다 — 버전 충돌·다중 계열 없음. `engines.node: ">=24"` 도 루트 `package.json`/두 Dockerfile 의 `node:24-alpine` 과 일치.
  - 제안: 없음. 이 패턴을 향후 신규 `@workflow/*` 패키지 템플릿으로 유지할 것.

- **[INFO]** 새 패키지 `package.json` 에 `license` 필드가 없다 — 다만 형제 패키지 대다수도 마찬가지라 이번 PR 이 만든 새 결함은 아니다
  - 위치: `codebase/packages/masked-markers/package.json`
  - 상세: `grep -n license codebase/packages/*/package.json` 로 확인한 결과 `sdk` 패키지만 `"license": "Apache-2.0"` 을 갖고 나머지(`ai-end-reason`, `graph-warning-rules` 등)는 필드 자체가 없다. 사내 workspace 전용 패키지(`private` 성격, npm publish 대상 아님)라 실질적 라이선스 호환성 리스크는 낮다.
  - 제안: 조치 불필요(기존 컨벤션 그대로 답습). 다만 저장소 전체에서 `private`/`license` 표기 정책을 한 번 정리하면 이런 반복 INFO 가 줄어든다 — 이번 PR 범위는 아님.

- **[INFO]** 등록 표면 8곳(`test-stages.sh` INTERNAL_PACKAGES · `packages-checks.yml` pathspec/matrix/주석 카운트 · backend/frontend `package.json` · backend/frontend/`Dockerfile.playwright-e2e` COPY · `pnpm-lock.yaml`)이 서로 정확히 정합하고, `@workflow/masked-markers` 는 backend `dependencies`(devDependencies 아님)로 등록돼 프로덕션 번들에 실제로 포함된다 — 배선 누락 없음 (조치 불요)
  - 위치: `codebase/backend/package.json:58` (`"@workflow/masked-markers": "workspace:*"`, `dependencies` 블록 내), `codebase/frontend/package.json:40` (동일)
  - 상세: `sanitize-error-message.ts` 는 프로덕션 egress 마스킹 유틸이라 `@workflow/masked-markers` 가 devDependency 가 아닌 `dependencies` 로 정확히 배치돼야 하는데 diff 상 정확히 그렇다. 패키지 자체는 런타임 의존성이 0개(순수 값 상수 + 함수 하나)라 backend/frontend 번들 크기 영향은 무시할 수준이다(문자열 3개 + 정수 1개 + 함수 1개). 빌드 시간 영향도 tsc 컴파일 1패키지 추가분(수 초) 수준으로 `packages-checks.yml` matrix 5→6 확장과 일치한다.
  - 제안: 없음.

- **[INFO]** 내부 의존 그래프(`backend`/`frontend` → `@workflow/masked-markers`)는 팬인(fan-in) 구조로 순환 의존이 없고, 패키지 자체가 다른 내부 `@workflow/*` 패키지를 참조하지 않는다 (조치 불요)
  - 위치: `codebase/packages/masked-markers/package.json` (`dependencies` 필드 자체가 없음), `codebase/packages/masked-markers/src/index.ts`
  - 상세: `@workflow/masked-markers` 는 leaf 노드로, backend·frontend 둘 다 단방향으로 의존한다. `@workflow/ai-end-reason` 과 동일한 "shared kernel" 형태를 반복해 저장소의 기존 내부 의존성 컨벤션과 일치한다.
  - 제안: 없음.

## 요약

이번 변경의 의존성 관점 핵심은 backend/frontend 에 손으로 복제되던 마스킹 마커 상수·판정 로직을 신규 내부 workspace 패키지 `@workflow/masked-markers` 로 추출한 것이다. **새 외부 npm 패키지는 하나도 추가되지 않았고**, 신규 패키지의 `devDependencies` 8개는 형제 패키지(`ai-end-reason`, `graph-warning-rules`)와 버전까지 완전히 동일해 계열 충돌·버전 고정 미비가 없으며, 런타임 `dependencies` 는 0개라 번들 크기·빌드 시간 영향도 미미하다. `pnpm-lock.yaml` 에 섞인 `eslint-config-next` peer-dep 해석 그래프 재구성은 버전 불변의 `pnpm install` 부수 효과로, 취약점·라이선스 리스크가 없음을 직접 diff 대조로 확인했다. 내부 등록 표면 8곳(CI pathspec·Dockerfile COPY·package.json·lockfile)은 기존 `@workflow/ai-end-reason` 패턴을 정확히 재사용해 배선 누락이 없고, backend 는 이 패키지를 프로덕션 `dependencies` 로 정확히 분류했다. license 필드 부재는 기존 형제 패키지 컨벤션을 그대로 따른 것이라 이 PR 의 신규 결함이 아니다. 차단 사유가 될 만한 발견은 없다.

## 위험도
NONE
