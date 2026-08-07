# 성능(Performance) 리뷰

## 발견사항

- **[WARNING]** `prepare` 스크립트 변경으로 로컬 `pnpm install` 마다 캐시(스킵) 없이 매번 전체 `tsc` 재컴파일이 발생 — dist 존재 여부에 의한 사실상의 빌드 캐시가 제거됨
  - 위치: `codebase/packages/ai-end-reason/package.json:9`, `codebase/packages/chat-channel-validation/package.json:9`, `codebase/packages/expression-engine/package.json:9`, `codebase/packages/graph-warning-rules/package.json:9`, `codebase/packages/node-summary/package.json:9`, `codebase/packages/sdk/package.json:9`, `codebase/packages/web-chat-sdk/package.json:12` — 각 `"prepare"` 라인
  - 상세: 기존 `[ -d dist ] || tsc` (sdk 는 `existsSync('dist')||execSync('tsc')` 로 동일한 존재-기반 스킵)는 `dist` 가 이미 있으면 `tsc` 를 건너뛰어, 결과적으로 "빌드 캐시"처럼 동작했다(부정확했지만 — stale dist 를 재사용하는 버그였다). 새 스크립트는 `typescript` 가 resolve 되면 `dist` 존재 여부와 무관하게 **항상** `execSync('tsc', {stdio:'inherit'})` 를 실행한다. 이건 의도된 정확성 수정이고 PR 문서(`test_packages_prepare_contract.py` 상단 docstring)에도 "typescript resolvable → run tsc ALWAYS" 로 명시돼 있어 결함이 아니라 트레이드오프다. 다만 성능 관점에서 실질적 비용이 있다: 7개 패키지 각각의 `tsconfig.json` 에 `"incremental"` / `tsBuildInfoFile` 설정이 없다(확인: `codebase/packages/sdk/tsconfig.json` 등) — 즉 매 `tsc` 호출이 **증분(incremental) 빌드가 아닌 전체 재컴파일**이다. `pnpm install` 은 워크스페이스 패키지마다 `prepare` 를 실행하므로(테스트 docstring: "pnpm runs it during `pnpm install` for workspace packages"), 소스가 전혀 바뀌지 않은 브랜치 전환·lockfile 갱신 시에도 개발자가 `pnpm install` 을 돌릴 때마다 7개 패키지 전체가 매번 처음부터 다시 컴파일된다. (CI 는 매번 fresh checkout 이라 `dist` 가 원래 없었으므로 이전에도 항상 `tsc` 가 돌았고, 이 변경으로 인한 CI 측 회귀는 없음 — 로컬 반복 설치 흐름에서만 새로 생기는 비용이다.)
  - 제안: 정확성은 유지하면서 반복 설치 비용을 줄이려면 각 패키지 `tsconfig.json` 에 `"incremental": true` + `"tsBuildInfoFile"` 를 추가하고 `tsc` 대신 `tsc --build`(또는 동일 효과의 `--incremental`) 를 쓰는 방법을 검토할 것. 이러면 소스 미변경 시 `tsc` 자체가 캐시를 보고 조기 종료해 "매번 전체 재컴파일"과 "stale dist 재사용" 둘 다 피할 수 있다. 지금 당장 막을 이슈는 아니며(의도적 트레이드오프로 문서화됨), 다음 라운드에서 검토할 개선 항목으로 남길 만하다.

- **[INFO]** `harness-checks.yml` 트리거를 `codebase/packages/*/package.json` (매니페스트만)로 좁힌 것은 올바른 판단
  - 위치: `.github/workflows/harness-checks.yml:69` (`- 'codebase/packages/*/package.json'`)
  - 상세: 소스 전체(`codebase/packages/**`)가 아니라 매니페스트만 등재해, 패키지 코드 변경마다 이 harness 스위트가 불필요하게 도는 것을 피했다(주석에 명시된 의도와 일치). CI 실행 총량을 불필요하게 늘리지 않는 스코핑으로, 성능/비용 관점에서 부정적 영향 없음 — 오히려 좋은 사례라 별도 조치 불필요.

- **[INFO]** 신규 테스트 `test_packages_prepare_contract.py` 자체의 실행 비용은 무시할 수준
  - 위치: `.claude/tests/test_packages_prepare_contract.py` (`PrepareBranchBehaviourTest` 클래스 전체, 특히 `_run()` 헬퍼)
  - 상세: `_manifests()` 가 `PACKAGES_DIR` 를 순회하며 각 `package.json` 을 매 테스트 메서드마다 다시 읽고 파싱하지만(디렉터리 iterate + JSON parse, 파일 수 ~7~9개) 이는 밀리초 단위이고 CI/로컬 스위트 규모에서 유의미한 부담이 아니다. 4개 행위 테스트는 각각 격리된 `tempfile.TemporaryDirectory()` 에서 `sh -c` 서브프로세스(스텁 `tsc`)를 `timeout=60` 으로 실행하며, 실제 컴파일 없이 즉시 종료하므로 실측 비용은 무시 가능. 문제 없음, 조치 불필요.

## 요약

이번 변경은 애플리케이션 런타임 코드가 아니라 harness 테스트·CI 워크플로·내부 패키지의 `prepare` 빌드 스크립트에 국한된다. 성능에 실질적 영향을 주는 부분은 단 하나 — `prepare` 가 이제 `dist` 존재 여부와 무관하게 매번 전체(비증분) `tsc` 컴파일을 강제한다는 점으로, 정확성 버그(stale dist)를 고치는 대가로 반복적인 로컬 `pnpm install` 마다 컴파일 비용이 늘어나는 의도된 트레이드오프다. CI 는 원래도 fresh checkout 이라 회귀가 없고, PR 문서에도 이 트레이드오프가 명시돼 있어 차단 사유는 아니지만, `tsconfig.json` 에 incremental 빌드를 추가해 두 마리 토끼(정확성 + 속도)를 모두 잡는 개선을 후속 과제로 남길 만하다. 그 외 항목(CI 트리거 스코핑, 신규 테스트 비용)은 성능 관점에서 문제 없다.

## 위험도
LOW
