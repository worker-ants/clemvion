# 의존성(Dependency) 리뷰

## 발견사항

- **[INFO]** 5개 내부 패키지에 eslint 툴체인 devDependency 신규 추가
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk}/package.json`, `pnpm-lock.yaml`
  - 상세: `@eslint/js`(^9.18.0) · `eslint`(^9.18.0) · `globals`(^16.0.0) · `typescript-eslint`(^8.20.0) 4종이 5개 패키지 모두에 동일 range 로 추가됨. 전부 `devDependencies` 이며 런타임/번들에 포함되지 않음(각 패키지 `main`/`types` 는 `dist/*` 만 노출, `sdk` 는 `files: ["dist","README.md"]` 로 npm publish 시 devDependency 가 소비자에 전파되지 않음). `pnpm-lock.yaml` 상 5개 패키지 전부 동일 resolved 버전(`@eslint/js@9.39.4`, `globals@16.5.0`, `typescript-eslint@8.61.1(eslint@9.39.4(jiti@2.7.0))(typescript@5.9.3)`, `eslint@9.39.4(jiti@2.7.0)`)으로 수렴 — 버전 drift 없음. 코드 주석("backend·web-chat-sdk 와 동일 eslint v9 / typescript-eslint v8 라인")대로 이미 `codebase/backend`, `codebase/frontend`, `codebase/packages/web-chat-sdk`, `codebase/channel-web-chat` 가 쓰는 것과 같은 major line 이라 모노레포 전체 tooling 버전이 일관됨.
  - 제안: 없음. 필요성·스코프 모두 타당(plan `eia-context-schema-followups.md` #3/#5 항목이 명시한 "내부 패키지 lint 커버리지 갭" 을 닫는 devtool 추가).

- **[INFO]** 버전 고정(pinning) 스타일 — caret range, lockfile 이 재현성 보장
  - 위치: 위 5개 `package.json`
  - 상세: 신규 devDependency 4종 모두 `^` caret range 사용. 저장소 관례상 대다수 기존 의존성(backend/frontend 포함)도 caret range 이므로 편차 아님. 실제 재현성은 `pnpm-lock.yaml` 의 정확한 resolved 버전 고정 + CI/harness 의 `pnpm install --frozen-lockfile` 사용으로 확보됨(`test-stages.sh::_ensure_deps`, `packages-checks.yml::Install deps` 모두 `--frozen-lockfile`).
  - 제안: 없음.

- **[INFO]** 라이선스 호환성
  - 상세: `eslint`/`@eslint/js`/`typescript-eslint`/`globals` 는 전부 MIT. devDependency 로만 소비되고 각 패키지 publish 대상(`files`)에서 제외되어 있어(위 참고) 다운스트림 배포물에 라이선스 조항이 전파되지 않는다. `@workflow/sdk`(Apache-2.0), 내부 전용 패키지들과 충돌 없음.
  - 제안: 없음.

- **[INFO]** 알려진 취약점 여부
  - 상세: 추가된 `eslint@9.39.4` / `typescript-eslint@8.61.1` / `globals@16.5.0` / `@eslint/js@9.39.4` 는 review 시점 기준 상당히 최신 마이너/패치 버전이며, 이 리뷰 범위 내에서 알려진 CVE 매칭 근거를 확인하지 못했다. 설령 향후 취약점이 발견되어도 devDependency(빌드/lint 시점 전용, 런타임·번들 미포함)라 blast radius 가 CI/로컬 개발 환경으로 제한됨.
  - 제안: 정기 `pnpm audit` cadence 로 충분, 본 PR 자체를 막을 사유 아님.

- **[INFO]** 불필요한 의존성 여부 — 기존 패턴 재사용, 신규 anti-pattern 아님
  - 위치: `codebase/packages/{chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk}/eslint.config.mjs` (5개 파일, 거의 동일 ~27줄)
  - 상세: 5개 `eslint.config.mjs` 가 주석 헤더·`globals.node` vs `globals.browser`·`no-unused-vars` 규칙 유무 정도만 다르고 골격이 동일하다. 다만 이는 이번 PR 이 새로 만든 패턴이 아니라 `codebase/packages/web-chat-sdk/eslint.config.mjs`(선행 PR, eia-sdk-publish followup #7)에서 이미 확립된 per-package flat config 관례를 그대로 이어받은 것(diff 확인: 두 파일이 주석·globals 대상·규칙 블록만 다르고 나머지 완전 동일). 각 패키지가 독립 pnpm workspace/독립 lint 대상이라 공유 config 패키지로 추출하는 이득이 크지 않을 수 있어 blocking 사유는 아니다.
  - 제안: 5~9개로 늘어나면(신규 내부 패키지가 계속 추가되는 추세이므로) `@workflow/eslint-config` 류의 공유 base config 패키지 추출을 고려할 만하다 — 지금 시점엔 비차단 INFO.

- **[INFO]** 의존성 크기 · 빌드 시간 영향
  - 상세: 전부 devDependency 라 production 번들 크기 영향 없음. `pnpm-lock.yaml` 상 5개 패키지가 동일 리졸브 버전을 공유해 pnpm content-addressable store 재사용으로 추가 다운로드 비용은 미미. CI 측은 신규 `packages-checks.yml`(`timeout-minutes: 10`) job 1개가 추가되지만 `paths` 필터로 무관 PR 은 스킵되어 상시 비용이 아님. `.claude/test-stages.sh` 의 `cmd_lint`/`cmd_unit`/`cmd_build` 에 4개 패키지 실행이 추가되어 로컬/harness 실행 시간이 다소 늘어나나(신규 코드 없음, 패키지 자체는 기존 존재), 이는 "coverage 갭을 메운다"는 본 PR 의도된 트레이드오프.
  - 제안: 없음.

- **[INFO]** 기존 의존성과의 호환성
  - 상세: 5개 패키지 모두 `eslint ^9.18.0` / `typescript-eslint ^8.20.0` / `globals ^16.0.0` 로 동일 range, lockfile 상 동일 resolved 버전으로 수렴(위 참고) — 패키지 간 버전 충돌 없음. `typescript@5.9.3`(각 패키지 기존 `^5.7.3`)과 `typescript-eslint@8.61.1` peer 호환도 lockfile 상 확인됨. `codebase/backend`(기존 eslint v9/typescript-eslint v8 라인)와도 major line 일치 — 모노레포 전체 tooling 버전 파편화 없음. `.github/workflows/web-chat-checks.yml` 의 sdk job 에 추가된 `Lint` 스텝도 동일 config 재사용이라 별도 리스크 없음.
  - 제안: 없음.

- **[INFO]** 내부 의존성(내부 모듈 간 의존 관계) — 신규 엣지 없음, 기존 갭 커버리지만 추가
  - 위치: `.claude/test-stages.sh`, `.github/workflows/packages-checks.yml`, `.github/workflows/web-chat-checks.yml`
  - 상세: 이번 diff 는 `@workflow/expression-engine` · `@workflow/graph-warning-rules` · `@workflow/node-summary` · `@workflow/chat-channel-validation` · `@workflow/sdk` 의 실제 import 그래프를 변경하지 않는다. 이 4개 패키지는 이미 `codebase/backend` 의 `dependencies` 에 `workspace:*` 로 링크돼 소비되고 있었음(`pnpm-lock.yaml` backend importer 섹션에서 확인)에도 전용 CI job 이 없어 회귀가 PR 에서 검증되지 않던 기존 갭이었다(파일 주석에 명시). 본 PR 은 그 커버리지 갭만 닫는 harness/CI 배선이며 신규 내부 의존 엣지를 만들지 않는다. `packages-checks.yml`(4개) 과 `web-chat-checks.yml`(sdk/web-chat-sdk/channel-web-chat)이 대상 패키지를 겹치지 않게 분리해 CI job 중복 실행도 없음(`backend-checks.yml` 자체가 저장소에 없어 다른 워크플로와의 lint/test 중복 실행 우려도 없음).
  - 제안: 없음.

- **[INFO]** CI 트리거 범위 — lockfile 변경 시 워크플로 동시 발동
  - 위치: `.github/workflows/packages-checks.yml`, `.github/workflows/web-chat-checks.yml`
  - 상세: 두 워크플로 모두 `paths` 에 `pnpm-lock.yaml` 을 포함해, 무관한 패키지의 의존성만 바뀐 PR 이어도 두 워크플로가 함께 발동될 수 있다. 모노레포 단일 lockfile 구조상 불가피한 트레이드오프이며 오탐(false-positive) 실행 비용 정도로 CI 시간에 국한된 영향이라 비차단.
  - 제안: 없음(설계상 의도된 보수적 트리거로 판단).

## 요약

이번 변경은 새 런타임(production) 의존성을 전혀 추가하지 않는다. 5개 내부 패키지(`chat-channel-validation`, `expression-engine`, `graph-warning-rules`, `node-summary`, `sdk`)에 동일한 eslint v9 / typescript-eslint v8 devDependency 스택을 정확히 같은 버전 range 로 추가했고, `pnpm-lock.yaml` 상 실제 resolve 버전도 5개 패키지 전부 동일하게 수렴해 버전 drift·충돌 리스크가 없다. 이 스택은 이미 `backend`/`frontend`/`web-chat-sdk`가 사용 중인 것과 같은 major line 이며, MIT 라이선스로 devDependency 전용(publish 대상 제외)이라 라이선스·취약점 노출 모두 build/lint 시점으로 국한된다. 신규 CI job(`packages-checks.yml`)과 `test-stages.sh` 배선은 이미 backend 가 `workspace:*` 로 소비 중이던 4개 패키지의 기존 CI 커버리지 갭을 메우는 것으로, 새로운 내부 의존 엣지를 만들지 않는다. 5개 거의 동일한 `eslint.config.mjs` 파일의 중복은 이번 PR 이 만든 패턴이 아니라 선행 `web-chat-sdk` 관례를 그대로 이은 것이며, 공유 base-config 패키지 추출은 향후 내부 패키지가 더 늘었을 때 고려할 만한 비차단 개선 여지다. 전반적으로 의존성 관점에서 차단 사유는 없다.

## 위험도

LOW
