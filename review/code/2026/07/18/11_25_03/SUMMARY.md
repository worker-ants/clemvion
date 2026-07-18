# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(모두 신규 drift 가드 테스트 파일 `internal-package-registration.test.ts` 자체의 유지보수성/테스트 정확도 관련). 나머지 4개 reviewer(security/requirement/scope + side_effect 의 대부분)는 INFO 수준 관찰만 보고. forced(router_safety) 화이트리스트 6명(maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트(testing) | `explicitFilterCalls()` 가 라인 컨텍스트(주석 `#`, 문자열 리터럴)를 구분하지 못해 `cmd_lint`/`cmd_unit`/`cmd_build` 본문의 설명용 주석이나 `echo` 로그 문자열 안에 `pnpm --filter <pkg> <script>` 형태 텍스트가 있으면 이를 "실제 실행"으로 오인식한다. 이는 이 가드 전체가 막으려는 실패 클래스(#968 급 "조용한 무검증 통과")를 파서 자신이 재현할 수 있다는 뜻(실측 재현 완료: 주석/echo 페이로드로 오탐 확인). 같은 파일의 YAML 파서(`listAtPath`)는 인라인 `#` 주석을 제거하는데 이 SH 파서만 그 처리가 없어 내부 일관성도 어긋남. 현재 `.claude/test-stages.sh` 본문엔 그런 주석/echo 가 없어 미발현, 합성 fixture 로도 이 케이스 회귀 방지력 0. | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` — `explicitFilterCalls()`(소비처 `missingFromStage()`) | YAML 파서와 동일하게 라인 스캔 전 `#` 이후 텍스트 제거(또는 문자열 리터럴 내부 매치 배제) + "주석 안의 `pnpm --filter` 는 커버로 치지 않는다"를 검증하는 합성 fixture 1건 추가하여 회귀 고정 |
| 2 | 유지보수성(maintainability) | 테스트 파일 하나(557줄)에 bash 파싱·커스텀 YAML 서브셋 파서·패키지 발견·비교 로직 등 10여 개 서로 다른 관심사 함수(`repoRoot`/`discoverPackages`/`collectPackages`/`workflowDepsOf`/`backendWorkflowDeps`/`internalPackages`/`fnBody`/`explicitFilterCalls`/`indentOf`/`isSkippable`/`blockRange`/`findKeyLine`/`listAtPath`/`packageDirsInPaths`/`missingFromStage`)가 모두 내장되어 단일 `.test.ts` 파일이 다중 책임을 짐. "vitest 가 `.test.ts` 를 glob 자동 발견"하는 특성 때문에 로직 분리를 미룬 것으로 보이나, 순수 로직 모듈 분리와 자동 발견은 무관한 문제. | `codebase/frontend/src/lib/repo-guards/__tests__/internal-package-registration.test.ts` 전체 | 파서/비교 순수 함수들을 `repo-guards/internal-package-registration-guard.ts` 같은 별도 모듈로 이동, `.test.ts` 는 그 모듈을 import 해 "실측 대조" + "합성 fixture 회귀"만 담당하도록 재구성(vitest 자동 발견 특성은 그대로 유지) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | 커스텀 정규식 파서가 대상하는 파일은 전부 저장소 자신의 커밋된 설정 파일(사용자/네트워크 입력 아님)이라 인젝션·경로탐색 표면 없음; `JSON.parse` 결과도 문자열 비교에만 사용돼 프로토타입 오염 경로 없음; 새 `js-yaml` 의존을 의도적으로 회피해 공급망 표면 최소화; 워크플로 yml 변경은 주석뿐이며 위험 패턴(`pull_request_target`, 신뢰불가 GH 컨텍스트 보간) 없음; 에러 메시지에 민감정보 노출 없음 | 전 3개 파일 | 조치 불요 |
| 2 | 요구사항 | `spec/` 전체에 이 3파일(harness 도구) 관련 규약 문서 없음 — CLAUDE.md 기준 정상(하네스 규약은 `.claude/docs/`·`PROJECT.md` 영역이라 spec 불일치 판단 대상 아님) | 전 3개 파일 | 조치 불요. 필요 시 `.claude/docs/` 에 4곳 drift 가드 관례 문서화 가능 |
| 3 | 요구사항 | `explicitFilterCalls` 는 `pnpm --filter <pkg> <script>` 가 한 줄에 있을 때만 인식 — 줄바꿈되면 실제로는 실행되는 패키지를 "누락"으로 오탐(false positive 방향, #968 급 false negative 와 반대 방향이라 안전성은 보존) | `internal-package-registration.test.ts` (`explicitFilterCalls`) | 조치 불요. 리팩터 시 참고 |
| 4 | 요구사항 | `discoverPackages()` 는 `package.json` 없는 패키지 디렉터리를 조용히 skip — pnpm workspace 판별 기준과 정합적이라 실질 결함 아님 | `internal-package-registration.test.ts` (`discoverPackages`) | 조치 불요 |
| 5 | 범위(scope) | 신규 `codebase/frontend/src/lib/repo-guards/__tests__/` 디렉터리는 이번 작업이 만든 첫 위치(사전 관례 없음) — 파일 헤더에 근거 명시돼 스코프 위반 아님 | `internal-package-registration.test.ts` 경로 | 조치 불요. 향후 유사 리포 메타 가드 추가 시 관례로 굳힐지 재검토 |
| 6 | 범위(scope) | 3개 커밋에 걸쳐 71→557줄로 누적 성장 — 전부 선행 `/ai-review` WARNING 대응(리뷰-수정 반복 수렴)이며 자발적 확장 아님 | `internal-package-registration.test.ts` (커밋 이력) | 조치 불요 |
| 7 | 부작용 | 신규 가드는 fs 를 읽기 전용으로만 사용(write/mkdir/rm 없음); `.claude/test-stages.sh`·`packages-checks.yml` diff 도 주석뿐이라 실행 경로·트리거·매트릭스 무변화 | 전 3개 파일 | 조치 불요 |
| 8 | 부작용 | 모듈 top-level(`repoRoot()`)과 `describe` 콜백 내부(비-`beforeAll`)에서 fs 읽기가 테스트 실행이 아닌 "수집" 시점에 즉시 실행됨 — 저장소 레이아웃이 예상과 다르면 개별 `it` 실패가 아니라 파일 전체가 로드 시점에 throw(설계된 fail-loud, 통상 vitest 관례와 다름) | `internal-package-registration.test.ts:940`(`ROOT = repoRoot()`), `:1164-1168`(describe 본문) | 현행 유지 가능. 전체 스위트 실행으로 다른 파일 리포팅에 영향 없는지 1회 확인 권장 |
| 9 | 부작용 | frontend vitest 가 자신의 워크스페이스 경계를 넘어 리포 루트(`.claude/`, `.github/workflows/`, backend/packages `package.json`)를 읽는 이례적 결합 — 파일 헤더 주석에 근거(Actions 비활성·frontend vitest 가 유일한 실질 게이트) 명시된 의도적 설계, read-only 라 오염 위험 없음 | `internal-package-registration.test.ts` 경로 상수들 | 조치 불요. 모노레포 구조 유지되는 한 안전 |
| 10 | 부작용 | `frontend-checks.yml` 의 CI 트리거 경로가 `.claude/**`/`.github/workflows/**` 를 커버하지 않아, 향후 `.claude/test-stages.sh` 만 단독 수정하는 PR 에서 이 가드가 CI 상 안 돌 수 있음 — 다만 GitHub Actions 자체가 repo 레벨에서 이미 비활성(런 수 0)이고 실질 게이트는 항상 로컬 `run-test.sh` 전체 스위트라 실질 영향 낮음 | `.github/workflows/frontend-checks.yml` (이번 diff 범위 밖) | 조치 불요(Actions 재활성화 시점에 재검토 메모) |
| 11 | 유지보수성 | `fnBody`/`missingFromStage` 의 동적 정규식 생성이 함수명/스크립트명을 메타문자 이스케이프 없이 보간 — 현재 전부 리터럴이라 안전하나 재사용 확장 시 일반적 위험 패턴 | `internal-package-registration.test.ts:463` 등 | 우선순위 낮음. 확장 시 `escapeRegExp` 헬퍼 권장 |
| 12 | 유지보수성 | 커스텀 YAML 서브셋 파서(`indentOf`/`isSkippable`/`blockRange`/`findKeyLine`/`listAtPath`)는 flow-style 배열·block scalar 등으로 포맷이 바뀌면 조용히 부분/오match 결과를 낼 수 있음 — vacuity 단언은 "완전히 못 찾음"만 방어, 문서화된 스코프 트레이드오프 | `internal-package-registration.test.ts:513-556` | 현재 스코프에서 실질 위험 낮음. yml 구조 복잡화 시 재검토 |
| 13 | 유지보수성 | `listAtPath(...)!` 등 non-null assertion 이 vacuity 테스트가 먼저 통과한다는 전제에 의존 — `vitest run` 은 타입 strip 이라 런타임 검사 없음, `-t` 필터로 vacuity 블록만 스킵 시 진단 없는 raw `TypeError` 가능 | `internal-package-registration.test.ts:688,698,1201` | 영향 적음(스위트 전체 실행이 기본 경로). 필요 시 `?? []` + 명시적 `not.toBeNull()` 대체 가능 |
| 14 | 테스트 | `repoRoot()` 는 다른 순수 함수들과 달리 합성 fixture 테스트가 없음 — 깨지면 모듈 로드 시 즉시 throw(시끄러운 실패)이라 CRITICAL/WARNING 아닌 완결성 차원 INFO | `repoRoot()` (L925-938) | 급하지 않음. 리팩터 시 `startDir`/`exists` 인자화로 테스트 용이성 대칭 확보 가능 |
| 15 | 테스트 | `listAtPath`/`blockRange` 의 5단계 중첩 경로(`jobs.packages.strategy.matrix.pkg`) 처리가 실제 yml 대조로만 검증되고 합성 fixture 는 2~3단계까지만 커버 — 깊은 경로만 깨지는 회귀는 합성 fixture 로 못 잡음 | `internal-package-registration.test.ts:1078-1104`, fixture `:1367-1399` | 5단계 중첩 fixture 1건 추가 권장 |
| 16 | 테스트 | heredoc 조기-닫힘 검출 정규식이 실제 heredoc 이 아닌 설명 주석(`<<`/`<<-` 문자열 포함)에도 무조건 throw — fail-closed 철학과 일치해 안전하나 잡음 실패 가능성 있음 | `internal-package-registration.test.ts` heredoc 검출 정규식 | 시급하지 않음(설계된 트레이드오프) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/공급망/민감정보 노출 표면 없음(전부 INFO) |
| requirement | NONE | spec 문서 부재는 정상 범위, 가드 실효성 실측(mutation 재현) 확인, 설계상 알려진 한계만 INFO |
| scope | NONE | 3파일·단일 주제로 변경 수렴, 스코프 크리프 없음 |
| side_effect | LOW | 전부 read-only, 모듈 로드시 즉시 fs I/O + 워크스페이스 경계 넘는 결합(둘 다 의도적 설계) |
| maintainability | LOW | WARNING: 단일 파일 다중 책임(10여 함수); 정규식 이스케이프·non-null assertion 등 INFO |
| testing | LOW | WARNING: `explicitFilterCalls` 주석/문자열 리터럴 오인식(가드 자신의 #968 급 재발); 35/35 테스트 실측 green 확인 |

## 발견 없는 에이전트

없음 — 6개 reviewer 전원 최소 INFO 수준 관찰사항을 보고했습니다("문제 전혀 없음"으로 분류할 에이전트 없음).

## 권장 조치사항
1. `explicitFilterCalls()` 가 주석(`#`)/문자열 리터럴 내부의 `pnpm --filter` 텍스트를 실제 호출로 오인식하는 것을 수정 — YAML 파서와 동일하게 라인 스캔 전 주석 제거 처리를 추가하고, 회귀 방지용 합성 fixture(주석 안 `pnpm --filter` 는 미커버로 판정)를 추가한다. 이 가드가 막으려는 실패 클래스가 가드 자신에게 재발할 수 있다는 점에서 우선순위가 가장 높다.
2. 파서/비교 순수 로직(bash 파싱·YAML 서브셋 파서·패키지 발견·비교)을 별도 모듈로 분리해 `.test.ts` 파일의 단일 책임 범위를 좁힌다(vitest 자동 발견 특성은 유지 가능).
3. (낮은 우선순위) 5단계 중첩 경로 합성 fixture 추가, `repoRoot()` 격리 테스트 추가, 동적 정규식 생성부에 이스케이프 헬퍼 적용 등 INFO 항목은 여유 있을 때 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (6명)
  - **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (forced 전원 결과 확보됨 — 누락 없음)
  - **제외**: 8명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 변경(주석 추가 + 신규 테스트 파일)과 무관 |
  | architecture | router 판단상 이번 변경과 무관 |
  | documentation | router 판단상 이번 변경과 무관 |
  | dependency | router 판단상 이번 변경과 무관(신규 런타임 의존 없음) |
  | database | router 판단상 이번 변경과 무관 |
  | concurrency | router 판단상 이번 변경과 무관 |
  | api_contract | router 판단상 이번 변경과 무관 |
  | user_guide_sync | router 판단상 이번 변경과 무관 |