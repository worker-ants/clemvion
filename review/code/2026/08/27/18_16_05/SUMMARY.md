# Code Review 통합 보고서

## 전체 위험도
**LOW** — 7개 reviewer 전원(security/requirement/scope/maintainability/testing/documentation=NONE, side_effect=LOW) 결과 확보, Critical 0건·Warning 0건. side_effect reviewer 가 명시적으로 LOW 를 부여(CI 트리거 스코프 확대의 실질 영향 때문, 아래 참고)했으므로 그 판정을 그대로 반영한다. forced whitelist(7명) 전원 결과 정상 확보 — 미이행 항목 없음.

> **프로세스 참고 (코드 결함 아님, 오케스트레이터 확인 요망)**: testing reviewer 가 뮤테이션 검증 과정에서 `cp` 백업 목적지 경로를 실수로 worktree 루트의 untracked 파일 `scratchpad_idem_backup.ts` 로 지정해 내용을 덮어썼다가 삭제로 정리했다고 보고했다. git 비추적 파일이라 커밋 이력으로 복구 불가능하며, 이 파일이 동시 실행 중이던 다른 프로세스(병렬 reviewer 등)의 산출물이었다면 유실됐을 수 있다. 실제로 이번 세션에서 `git status --short` 재확인 결과 해당 파일은 현재 저장소에 존재하지 않는다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (전회 라운드 `17_52_44` 의 WARNING 3건은 requirement/testing/documentation reviewer 가 각각 소스 대조·테스트 실행·뮤테이션 재현으로 전부 해소를 재확인함 — 아래 "에이전트별 위험도 요약" 참고.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security/SideEffect | `spec-link-checks.yml` 의 신규 pathspec(`.claude/**`, `:(glob)*.md`)이 CI job 트리거 범위를 `.claude/**` 하위 비-md 변경까지 확장 — 의도적(트리거 갭 재발 방지)이며 이미 리뷰·수용됨 | `.github/workflows/spec-link-checks.yml:57` | 조치 불요. CI 비용 문제 시 `.claude/**/*.md` 로 좁히는 선택지 존재 |
| 2 | Security | `path.resolve` 로 링크 타겟 해석 시 저장소 루트 하위로 confine 하지 않음 — CI 전용 dev 도구, 신뢰된 콘텐츠만 스캔, 응답 노출 없음 (전전 라운드부터 반복 확인된 기존 패턴, 이 PR 이 표면을 넓히지 않음) | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`findBrokenLinksInFiles`, `path.resolve(...)`) | 조치 불요. 신뢰되지 않은 입력 스캔으로 확장될 경우에만 가드 고려 |
| 3 | Documentation/Requirement | `PROJECT.md` §문서 링크 검증 요약이 `node_modules` 제외 규칙을 SoT(`spec-impl-evidence.md §4.2`)·구현(`GOVERNANCE_SKIP_DIRS`)과 달리 생략 — 요약 축약으로 실질 혼선 위험 낮음 | `PROJECT.md:350-351` | `PROJECT.md:351` 괄호에 `node_modules` 추가 언급 (병합 차단 아님) |
| 4 | Requirement | `GOVERNANCE_SKIP_DIRS` JSDoc 이 `"worktrees"` 제외 근거만 설명, `"node_modules"` 근거는 별도 서술 없음 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:286-291` | 조치 불요(자명). 다음 편집 때 한 줄 보강 가능 |
| 5 | Maintainability | 신규 fixture 헬퍼 함수명이 한 글자(`w`)라 의도가 이름으로 안 드러남 — 자매 파일 `spec-links.test.ts` 는 `mkLink` 등 의도 명시적 네이밍 사용 | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:143` | `writeFixture` 등으로 개명해 네이밍 관례 통일 |
| 6 | Maintainability | `collectGovernanceMarkdown` 안 `.md` 확장자 판별 predicate 가 두 `walkTree` 호출에 인라인 중복 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` (`collectGovernanceMarkdown`) | `const isMarkdown = (name) => name.endsWith(".md")` 로 추출해 재사용(선택, 비차단) |
| 7 | Maintainability | 실측 파일 수(17,202/52 등) 매직 넘버가 테스트 docstring·워크플로 주석·plan 문서 3곳에 하드코딩 유지 — 전회 라운드에서 "매직 지울 위험 회피" 근거로 **의도적 유지 결정**됨 | `.claude/tests/test_harness_checks_paths_coverage.py:206`, `.github/workflows/spec-link-checks.yml:58`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:845` | 조치 불요(재확인만, 신규 조치 대상 아님) |
| 8 | Testing | `test_ci_paths_changed.py` 신규 테스트 2건이 워크플로 YAML 을 직접 읽지 않고 `:(glob)*.md` 값을 스위트 내부에 재입력(하드코딩)해 검증 — YAML↔실행 경로 연결 자체는 `test_required_check_skip_jobs.py::DeadFilterTest` 가 실 YAML 을 읽어 별도 커버 중이라 실질 공백 아님 | `.claude/tests/test_ci_paths_changed.py:119-161` | 조치 불요(정보성). 우려 시 `DeadFilterTest` 에 segment-bound 단언 추가는 이 PR 범위 밖 |
| 9 | SideEffect | 신규 vitest fixture(`os.tmpdir()` + `mkdtempSync`)는 `afterAll`/`finally` 로 정리되나, 프로세스 강제종료 시 임시 디렉터리 잔존 가능(CI 환경에서는 실질 위험 낮음) | `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts` (`beforeAll`/`afterAll`) | 조치 불요(표준 테스트 격리 패턴) |
| 10 | SideEffect | 공유 함수 `filter_covers_file` 이 `:(glob)` 접두 입력에 한해 신규 동작 추가 — 기존 호출자(비-`:(glob)`) 영향 없음, 63 테스트 전부 PASS 로 회귀 없음 확인 | `.claude/tests/test_harness_checks_paths_coverage.py:212-224` | 조치 불요 |
| 11 | SideEffect | `spec-links.ts` 에 `collectGovernanceMarkdown`/`findBrokenGovernanceLinks` 신규 export 추가(기존 export 시그니처 변경 없음), 현재 소비처는 `spec-link-integrity.test.ts` 하나뿐 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:300,324` | 조치 불요 |
| 12 | SideEffect | `scripts/check-doc-links.py` 삭제 — 저장소 전체 grep 결과 활성 참조(`.github/`·`Makefile`·hook) 없음, 남은 참조는 `plan/`·`review/` 의 과거 기록뿐 | `scripts/check-doc-links.py` (삭제) | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. `path.resolve` 미확정 경로·CI pathspec 확장 모두 INFO, 기존 패턴 재확인 |
| requirement | NONE | 전회 WARNING 3건(SPEC-DRIFT §4.2 표, `:(glob)` boundary 테스트, 실행계층 pin 테스트) **전부 해소 확인** — 소스 대조 + vitest 19/19 + unittest 63/63 + 뮤테이션 재현으로 검증 |
| scope | NONE | 22개 파일 전부가 "governance 문서를 doc-link 가드 스코프에 편입"이라는 단일 목적으로 수렴, 무관한 변경 없음 |
| side_effect | LOW | CI 트리거 스코프 확대(`.claude/**`, 의도적)가 유일한 실질 부작용. 그 외 삭제/신규 export/공유함수 변경 모두 안전 확인 |
| maintainability | NONE | 신규 함수 2쌍이 기존 컨벤션과 대칭적. 사소한 네이밍(`w`)·predicate 중복만 INFO |
| testing | NONE | 전회 testing WARNING 2건 뮤테이션으로 fix 유효성 직접 검증(RED 확인 후 원복). 신규 Critical/Warning 없음 |
| documentation | NONE | 링크 수정 4건 전부 대상 파일 실재 확인. SPEC-DRIFT 반영 재확인. `PROJECT.md` node_modules 언급 누락만 INFO |

## 발견 없는 에이전트

없음 — 전원 최소 1건 이상의 INFO 관찰을 보고했으나 Critical/Warning 은 전원 0건.

## 권장 조치사항

1. (선택, 비차단) `PROJECT.md:351` 요약절 괄호에 `node_modules` 제외 규칙을 함께 언급해 SoT(`spec-impl-evidence.md §4.2`)와 완전히 정합시킨다.
2. (선택, 비차단) `spec-link-integrity.test.ts:143` 의 fixture 헬퍼명 `w` 를 `writeFixture` 등으로 개명해 자매 파일 네이밍 관례와 통일한다.
3. (선택, 비차단) `collectGovernanceMarkdown` 의 `.md` 판별 predicate 를 상수로 추출해 두 `walkTree` 호출 간 중복을 제거한다.
4. (프로세스, 오케스트레이터 조치) `scratchpad_idem_backup.ts` 유실 가능성을 확인 — 병렬 세션/다른 작업 산출물이었는지 대조하고, 향후 mutation 백업은 반드시 세션 scratch 디렉터리(`/private/tmp/claude-*/.../scratchpad`)로 강제하는 프롬프트 가드를 검토한다.

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용. `forced (router_safety)`: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) 전원 강제 실행 및 결과 확보. 전체 reviewer 실행됨(제외 없음).