# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 `prepare` 계약의 핵심 안전 속성("컴파일 에러가 조용히 삼켜지지 않고 전파된다")이 회귀 테스트로 pin 되어 있지 않은 점, 반복 `pnpm install` 시 항상 전체 재컴파일이 발생하는 성능 트레이드오프, 7개 `package.json` 간 인라인 스크립트 문자 그대로 중복 3건이 WARNING 이며 전부 blocking 은 아님. forced whitelist 8명(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/요구사항 | 신규 `prepare` 계약이 명시한 "typescript resolvable → tsc 항상 실행, 컴파일 에러는 그대로 전파" 중 후자(가장 안전-critical 한 속성)를 검증하는 테스트가 없음 — 4개 조합 테스트 전부 스텁 `tsc` 가 무조건 `exit 0` 만 반환해 tsc 실패 시 `prepare` 전체가 non-zero 로 전파되는지 관측하지 않음 | `.claude/tests/test_packages_prepare_contract.py:125-127`(스텁), `147-156`(`test_typescript_present_*`) | `_run()`에 tsc 실패 스텁 파라미터(예: `tsc_fails`)를 추가하고 `typescript=True, tsc_fails=True` 조합에서 `p.returncode != 0` 을 단언하는 테스트를 추가 |
| 2 | 성능 | `prepare` 가 `dist` 존재 여부와 무관하게 typescript resolve 시 항상 전체(비증분) `tsc` 재컴파일을 강제 — 각 패키지 `tsconfig.json` 에 `incremental`/`tsBuildInfoFile` 미설정이라 반복 `pnpm install` 마다 7개 패키지 전체가 매번 처음부터 재컴파일됨(CI 는 fresh checkout 이라 회귀 없음, 로컬 반복 설치에서만 비용 증가) | `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` 의 `prepare` 라인 | `tsconfig.json` 에 `"incremental": true` + `tsBuildInfoFile` 추가하고 `tsc --build` 사용 검토 (정확성 유지하며 반복 비용 절감) |
| 3 | 유지보수성 | 동일한 ~300-500자 인라인 `node -e` 스크립트가 7개 `package.json` 에 문자 그대로(byte-identical) 중복 — 로직 변경 시 사람이 7곳을 손으로 동일하게 고쳐야 하고 JSON 문자열이라 린트/포매터 도움을 못 받음. 신규 테스트(`test_every_package_that_builds_uses_the_same_prepare`)가 drift 는 사후 감지하지만 편집 부담 자체는 줄여주지 않음 | `codebase/packages/{ai-end-reason,chat-channel-validation,expression-engine,graph-warning-rules,node-summary,sdk,web-chat-sdk}/package.json` 의 `scripts.prepare` | 공유 스크립트 파일(예: `scripts/pnpm-package-prepare.cjs`)로 추출해 `"prepare": "node ../../scripts/pnpm-package-prepare.cjs"` 로 위임하는 방안 검토 — 단 `sdk`/`web-chat-sdk` 처럼 배포 가능한 패키지가 소비자 측에서 상대경로 스크립트에 의존해도 되는지 사전 확인 필요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `execSync('tsc', ...)` 가 PATH 기반으로 `tsc` 를 실행 — `require.resolve`로 typescript 존재만 확인하고 실제 실행 파일은 PATH 순서에 의존. 변경 전부터 존재하던 기존 패턴이라 이번 diff 가 새로 만든 위험 아님 | `codebase/packages/ai-end-reason/package.json:9` 등 7개 동일 패턴 | 조치 불필요(기존 패턴과 동등) |
| 2 | 요구사항 | `existsSync('dist')` 는 `[ -d dist ]` 와 달리 디렉터리가 아닌 손상된 `dist`(파일)도 "있음"으로 판정 — typescript 미해소 + `dist`가 디렉터리 아닌 극히 좁은 손상 시나리오에서 구버전은 실패, 신버전은 조용히 no-op | `codebase/packages/ai-end-reason/package.json:9` (7개 동일) | 조치 불필요(문서화된 계약 밖). 필요 시 `existsSync('dist') && statSync('dist').isDirectory()` 로 좁힐 수 있음을 기록만 |
| 3 | 유지보수성 | `PrepareBranchBehaviourTest.setUpClass` 가 정렬 후 첫 패키지의 `prepare` 하나만 골라 행위 검증 — 나머지 6개의 실제 동일성은 `PrepareIsUniformTest` 에 암묵적으로 의존(문서화되지 않은 클래스 간 결합) | `.claude/tests/test_packages_prepare_contract.py` `PrepareBranchBehaviourTest.setUpClass` | `setUpClass` 주석에 "uniqueness 는 `PrepareIsUniformTest` 가 보장" 한 줄 추가 검토 |
| 4 | 테스트 | `codebase/packages/*/package.json` CI 트리거 등재를 지키는 자동 가드가 없음 — `test_harness_checks_paths_coverage.py` 는 module-level 상수만 자동 추출하고 product paths 는 제외되어 이 항목은 순수 수동 등재(기존 관례와 동일 패턴, 새 문제 아님) | `.github/workflows/harness-checks.yml:69` | 우선순위 낮음. 누적되면 자동 커버리지 검사 스코프 확장을 별도 백로그로 고려 |
| 5 | 테스트 | `PrepareBranchBehaviourTest.setUpClass` 가 `prepares` 집합이 비면 `sorted(prepares)[0]` 에서 `IndexError` 로 불친절하게 죽음(`PrepareIsUniformTest` 가 같은 상황을 명시적 메시지로 잡아주긴 함) | `.claude/tests/test_packages_prepare_contract.py:112` | `assertTrue(prepares, ...)` 류 명시적 가드 추가 검토(낮은 우선순위) |
| 6 | 문서화 | 7개 `package.json` 에 복제된 `prepare` 계약(byte-identical 요구, 배경)의 문서 포인터가 `package.json` 자체에는 없음 — 실제 위반은 CI 가 잡아주므로 위험도 낮음 | `codebase/packages/*/package.json` 의 `"prepare"` 필드 | `"//prepare": "byte-identical — see .claude/tests/test_packages_prepare_contract.py"` 같은 pseudo-comment 키 추가 검토(같은 diff 의 `web-chat-sdk`가 이미 `"//name"` 관례를 사용 중) |
| 7 | User Guide Sync | `expression-engine/package.json` 이 doc-sync-matrix `expression-language-change` glob 에 형태상 매치하나, 실제로는 `prepare` 스크립트 한 줄만 변경되어 파서/평가기 소스나 사용자 가시 동작은 변경되지 않음 — false-positive 로 판단, 문서 갱신 의무 없음 | `codebase/packages/expression-engine/package.json` | 조치 불필요 |
| 8 | 아키텍처/부작용 | 7개 `package.json` 동시 변경은 넓은 blast radius 이나 `test_every_package_that_builds_uses_the_same_prepare` 로 drift 가 CI 에서 강제되고, backend Dockerfile 의 pruned production tree 흐름(typescript 제거 후에도 이미 빌드된 `dist` 존재)과도 정합함을 확인 | `.claude/tests/test_packages_prepare_contract.py` (`PrepareIsUniformTest`) | 조치 불필요 |
| 9 | 아키텍처/테스트 | 신규 테스트가 문자열 비교가 아니라 격리된 `tempfile.TemporaryDirectory()` + 스텁 `tsc` 로 실제 서브프로세스 실행을 통해 3갈래(compile/no-op/throw)를 행위 검증 — 이 저장소의 "정적 파싱이 아니라 행위로 증명" 원칙과 일관된 견고한 설계 | `.claude/tests/test_packages_prepare_contract.py:114-169` | 조치 불필요(긍정적 관찰) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 취약점 없음. PATH 기반 tsc 실행은 기존 패턴 유지(INFO) |
| performance | LOW | prepare 가 매번 비증분 전체 재컴파일 강제(WARNING) — 의도된 트레이드오프, incremental 빌드 미도입 |
| architecture | LOW | 7개 파일 인라인 스크립트 중복(INFO, 테스트로 drift 방지됨), 그 외 구조 문제 없음 |
| requirement | LOW | 컴파일 에러 전파 계약이 테스트로 pin 안 됨(WARNING), README(spec) 정합성 확인 |
| scope | NONE | 10개 파일 전부 단일 목적(prepare 결함 수정)에 정확히 종속, 이탈 없음 |
| side_effect | LOW | pnpm install 동작 계약 변경(문서화된 의도), 격리·중복 방지 확인 — 전부 INFO |
| maintainability | LOW | 7개 파일 인라인 스크립트 중복(WARNING), 변수명 축약·클래스 간 암묵 결합(INFO) |
| testing | LOW | 컴파일 실패 전파 미검증(WARNING, requirement 와 동일 이슈), 수동 CI 등재·에러 메시지 개선 여지(INFO) |
| documentation | LOW | 전반적으로 탄탄, package.json 문서 포인터 부재만 INFO |
| dependency | NONE | 신규 의존성 없음, stdlib-only 준수, 빌드시간/중복은 이미 테스트로 상쇄된 INFO |
| database | NONE | 해당 없음 |
| concurrency | NONE | 해당 없음 — 공유 뮤터블 자원 없음 |
| api_contract | NONE | 해당 없음 |
| user_guide_sync | NONE | expression-engine false-positive 판정(INFO), 동반 갱신 누락 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, scope(발견 없음, NONE), security(실질 발견 없음), dependency(신규 의존성/문제 없음)

## 권장 조치사항
1. `_run()` 헬퍼에 tsc 실패 스텁 경로를 추가하고, 컴파일 에러가 `prepare` 전체의 non-zero 종료로 전파되는지 단언하는 테스트를 추가한다 (WARNING #1 — 이 PR 의 핵심 안전 주장을 회귀로부터 지키는 가장 중요한 갭).
2. 각 패키지 `tsconfig.json` 에 `incremental`/`tsBuildInfoFile` 를 추가해 반복 `pnpm install` 비용을 줄이는 방안을 후속 과제로 검토한다 (WARNING #2).
3. 7개 `package.json` 의 인라인 `prepare` 스크립트를 공유 파일로 추출하는 방안을 검토하되, 배포 가능 패키지(sdk/web-chat-sdk)의 self-contained 요구사항이 실제 걸림돌인지 먼저 확인한다 (WARNING #3, 우선순위 낮음).
4. INFO 항목들(existsSync 디렉터리 판정 엣지케이스, setUpClass 암묵 의존/불친절한 실패, package.json 문서 포인터 부재 등)은 차단 사유 아님 — 여유 있을 때 반영.

## 라우터 결정

- `routing_status=skipped`: 라우터 미사용 — 전체 reviewer(14명) 실행. forced whitelist(dependency, documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 포함되어 결과 확보됨 — 누락 없음.