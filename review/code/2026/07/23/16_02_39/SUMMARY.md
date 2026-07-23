# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. 신규 harness 가드(`test_dependabot_npm_coverage.py`) 자체는 잘 설계됐으나, classifier 가 사용하는 `fnmatch` 가 pnpm 의 실제 glob 의미론과 달라 가드 자신이 막으려는 유형의 잠재적 사각지대를 재현할 수 있고(현재는 미노출), 자매 항목(I3)에는 W5 와 달리 회귀 가드가 없다는 점이 WARNING 급으로 남아 있다. forced(router_safety) 지정 7개 reviewer 전원의 전문을 확보했으며 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `_independent_trees()` 가 `fnmatch.fnmatch` 로 워크스페이스 glob 을 매칭하는데, pnpm(micromatch 기반)의 단일 `*` 는 `/` 를 넘지 않지만 `fnmatch` 의 `*` 는 `.*` 로 변환돼 경로 구분자를 넘어 매칭된다(`fnmatch.fnmatch('codebase/packages/foo/bar','codebase/packages/*')` → `True` 로 직접 재현됨). 향후 `codebase/packages/<pkg>/<sub>/package.json` 형태의 2단계 이상 중첩 독립 npm 트리가 생기면, 실제로는 pnpm 워크스페이스 밖인데도 "커버됨"으로 오분류돼 dependabot 미등록이 영구 무신호로 남을 수 있다 — 이 가드 자신이 막으려는 사고를 classifier 내부에서 재현하는 latent 결함(현재 저장소 구조에서는 미노출) | `.claude/tests/test_dependabot_npm_coverage.py:91` (`_independent_trees()`) | pnpm 의 실제 glob 의미론(단일 `*` 는 `/` 미포함, `**` 만 재귀)에 맞게 매칭 로직 정밀화, 또는 최소 fixture 기반 유닛 테스트(`tmp_path` 에 합성 workspace/tracked-path 로 중첩 트리 케이스 고정)로 이 경계를 pin |
| 2 | Testing / Requirement | 손수 짠 두 YAML 미니 파서(`_workspace_globs`, `_dependabot_npm_directories`)가 모듈 레벨 상수를 직접 읽어 텍스트 주입이 불가능(테스트 용이성 갭)하고, 실제 저장소 파일에 대해서만 검증된다. 특히 `_dependabot_npm_directories` 의 `directory:` 정규식(`^\s*directory:\s*["']?([^"'#\n]+?)["']?\s*$`)은 값 뒤에 인라인 주석이 붙으면(`directory: "/foo" # note`) `$` 앵커링 때문에 매칭 실패해 해당 항목이 조용히 손실된다(직접 재현 확인). 다행히 결과가 "미등록"으로 fail-loud 실패하긴 하나(vacuous pass 는 아님), 원인 파악에 혼선을 준다 | `.claude/tests/test_dependabot_npm_coverage.py:50-65`(`_workspace_globs`), `:68-80`/`:77`(`_dependabot_npm_directories`) | 두 파서가 경로 대신 `str` 텍스트를 인자로 받도록 시그니처 변경해 합성 문자열로 경계(주석·따옴표 변형) 검증. 최소 인라인 주석 케이스 1건 추가. 정규식에 `(?:\s*#.*)?` 트레일링 주석 허용 추가도 고려 |
| 3 | Testing | 같은 diff 의 자매 항목 W5(dependabot coverage)는 전용 회귀 가드를 새로 만든 반면, I3(e2e.yml `paths-ignore` 에 `.github/**` 누락) 수정은 값만 고치고 상응 가드가 없다. PROJECT.md §e2e 면제 화이트리스트와 실제 워크플로 `paths-ignore`/`paths` 목록 간 drift 가 재발해도 이를 잡아줄 자동 테스트가 없다(이 저장소가 이미 여러 번 겪은 "SoT 문서 ↔ 실제 설정 파일 수동 동기화 drift" 클래스와 동일 계열) | `.github/workflows/e2e.yml:8-21`, `.github/workflows/harness-checks.yml` paths 목록, `PROJECT.md` §e2e 면제 화이트리스트 | PROJECT.md 화이트리스트 항목과 `e2e.yml` `paths-ignore` 목록(push/pull_request 양쪽) 간 최소 부분집합 관계를 검증하는 유닛 테스트를 `test_dependabot_npm_coverage.py` 와 같은 패턴(stdlib 파서 + sanity pin)으로 추가하거나, 최소한 backlog 항목으로 명시 |
| 4 | Documentation | 신규 테스트 파일 `test_dependabot_npm_coverage.py` 가 `.claude/tests/README.md` 의 "What's covered" 표(기존 15개 파일 전부 등재)에 등재되지 않음. 이 표를 강제하는 별도 가드가 없어 CI 로는 잡히지 않는 순수 컨벤션 위반 | `.claude/tests/README.md` (표 미갱신), 신규 파일 `.claude/tests/test_dependabot_npm_coverage.py` | README 표에 한 행 추가. `plan/in-progress/harness-guard-followups.md` 의 W5 서술 문구를 요약으로 재사용 가능 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | 손수 짠 워크스페이스 glob 파서가 pnpm 의 negation 패턴(`!pattern`)을 지원하지 않음(그냥 무시됨). 현재 `pnpm-workspace.yaml` 에는 negation 이 없어 실질 위험 없으나, 향후 도입되면 이 가드 자체가 조용한 사각지대를 재현할 잠재 위험 | `.claude/tests/test_dependabot_npm_coverage.py:50-65`(`_workspace_globs`) | 미지원을 주석으로 명시하거나, negation 라인 존재 시 명시적 실패/경고하는 방어적 assertion 추가 고려 |
| 2 | Security / Side-effect | `.github/**` 를 e2e `paths-ignore` 에 추가하면서 `e2e.yml` 자신을 포함한 CI 정의 변경 PR 이 자동 e2e 검증 없이 머지될 수 있는 창이 생김. diff 주석과 `plan/in-progress/harness-guard-followups.md`(I3)에 트레이드오프가 명시돼 있고 `workflow_dispatch` 로 수동 실행 escape hatch 를 마련해 완화됨 | `.github/workflows/e2e.yml:15,21,29,34` | 이미 문서화된 수용 리스크. 브랜치 보호 규칙에 `e2e`/`e2e-frontend` 가 required status check 로 걸려 있다면 "필수 체크가 트리거되지 않아 머지 차단이 안 되는" GitHub 동작을 인지하고 있는지 확인 권장 |
| 3 | Scope | `e2e.yml` 의 `workflow_dispatch` 추가는 원 요청(I3: paths-ignore 누락 수정)보다 한 걸음 넓은 변경이나, 그 fix 자체가 유발하는 자기-회귀(향후 e2e.yml 변경이 검증되지 않음)를 막기 위한 필연적 부수 조치이며 diff·plan 양쪽에 인과관계가 명시돼 있어 정당화된 최소 확장으로 판단 | `.github/workflows/e2e.yml:34` | 별도 조치 불필요. 현재처럼 plan 에 "부수 결정"으로 명시된 상태 유지 |
| 4 | Maintainability | `_workspace_globs`/`_dependabot_npm_directories` 두 파서가 "선택적 따옴표 벗기기" 정규식 조각을 각각 독립적으로 재정의 — 완전한 중복은 아니나 YAML 인용 규칙 변경 시 두 곳을 따로 고쳐야 함 | `.claude/tests/test_dependabot_npm_coverage.py:59,77` | 우선순위 낮음. `_unquote(s)` 헬퍼로 후처리만 공유하고 라인/블록 매칭 정규식 자체는 유지하는 정도로 충분 |
| 5 | Maintainability / Side-effect | `harness-checks.yml` 에 `pnpm-workspace.yaml`, `.github/dependabot.yml` 을 트리거 paths 로 추가하면서, harness 와 무관한 워크스페이스 패키지 추가 PR 도 이 job(5분 timeout)을 추가로 태우게 됨. 신규 가드가 두 파일을 대조하므로 drift 방지를 위해 필요한 의도된 트레이드오프 | `.github/workflows/harness-checks.yml:35-36` | 조치 불요. 향후 `pnpm-workspace.yaml` 변경 빈도가 높으면 가드 전용 경량 job 분리 고려(이번 diff 범위 밖) |
| 6 | Documentation | `e2e.yml` 신규 주석이 "GitHub 은 paths-ignore 에서 특정 경로만 예외 처리하는 문법을 제공하지 않는다"고 단정하나, 실제 GitHub Actions 는 `!pattern` 부정 패턴을 지원해(패턴 순서에 따라) 동일 파일만 예외 처리할 여지가 있다. 결론(`workflow_dispatch` 도입)은 여전히 합리적이나 근거 서술이 부정확할 수 있어 향후 재판단자에게 오도된 전제를 줄 수 있음 | `.github/workflows/e2e.yml:15` | 필수 아님. "부정 패턴 조합 대안도 있으나 가독성상 workflow_dispatch 를 택했다" 정도로 완화 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | negation glob 미지원(잠재)·`.github/**` ignore 트레이드오프. 긍정적으로, 이번 변경 자체가 실제 의존성 스캔 사각지대(undici HIGH·dompurify moderate 무신호 이력)를 닫는 개선이라고 평가 |
| requirement | NONE | 신규 테스트 5건 + 하네스 전체 381건 통과, mutation 시뮬레이션(미등록/stale 등록 뮤턴트)으로 가드 실효성 실측. spec fidelity(PROJECT.md §e2e 면제 화이트리스트) line-level 일치 확인. INFO 2건(README 미등재, 인라인 주석 edge case) 외 결함 없음 |
| scope | LOW | 4개 파일만 변경, 스코프 밖 파일 없음. `workflow_dispatch` 확장은 자기-회귀 방지를 위한 정당화된 최소 확장 |
| side_effect | LOW | 신규 테스트는 read-only(git ls-files 조회만). CI 트리거 변경은 문서화된 트레이드오프 |
| maintainability | LOW | docstring·함수 분리 우수. 정규식 파서 간 경미한 패턴 중복 |
| testing | LOW | 신규 가드 설계는 양호(vacuity 방지 3종 sanity test)하나 fnmatch/pnpm glob 불일치 잠재 결함, 파서 fixture 테스트 부재, I3 회귀가드 부재 |
| documentation | LOW | 신규 파일 docstring·인라인 주석 수준 높음. README "What's covered" 표 미등재, 주석 근거 서술 부정확 가능성 |

## 발견 없는 에이전트

없음 — forced 7개 reviewer 전원이 최소 INFO 이상의 발견사항을 보고했음(대부분 LOW/NONE 위험도의 경미한 항목).

## 권장 조치사항

1. `_independent_trees()` 의 `fnmatch` 매칭을 pnpm 실제 glob 의미론에 맞게 정밀화하거나, 최소 fixture 기반 경계 테스트로 중첩 트리 오분류 가능성을 pin (WARNING #1 — 가드 자신의 잠재 사각지대이므로 최우선).
2. I3(e2e.yml paths-ignore) 에도 W5 와 동일한 패턴의 회귀 가드(PROJECT.md 화이트리스트 ↔ 실제 워크플로 paths 목록 drift 검증)를 추가하거나 backlog 화 (WARNING #3).
3. `_workspace_globs`/`_dependabot_npm_directories` 시그니처를 텍스트 주입 가능하도록 바꿔 인라인 주석 등 파서 엣지케이스를 fixture 로 고정 (WARNING #2).
4. `.claude/tests/README.md` "What's covered" 표에 `test_dependabot_npm_coverage.py` 행 추가 (WARNING #4, 즉시 적용 가능한 사소한 수정).
5. (경미) `e2e.yml` 주석 중 "GitHub 은 특정 경로 예외 문법 없음" 단정을 완화 서술로 교정 (INFO #6).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원 — 즉 이번 라운드는 router 1차 선별과 무관하게 router_safety 화이트리스트가 실행 대상 전원을 강제 포함시킨 것으로 판단됨). **forced 전원의 결과 전문을 확보했으며 누락 없음** — "forced 인데 결과 없음" 케이스는 발생하지 않았음.
  - **제외**: 표 (7명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 CI 설정/신규 unittest 파일로 성능 영향 경로 없음 |
  | architecture | router 판단 — 아키텍처 레이어 변경 없음(하네스 테스트 + CI YAML) |
  | dependency | router 판단 — 런타임 의존성 그래프 변경 없음(신규 의존성 추가 아님, dependabot 등록 정합성만 검사) |
  | database | router 판단 — DB 접근 코드 없음 |
  | concurrency | router 판단 — 동시성 관련 코드 경로 없음 |
  | api_contract | router 판단 — 공개 API/DTO 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 대상 문서·i18n 문자열 변경 없음(내부 하네스/CI 문서만) |