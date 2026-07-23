# Requirement Review — §F 잔여(I3/W5) e2e paths 화이트리스트 정합 + dependabot 등록 무결성 가드

## 발견사항

- **[INFO]** 신규 하네스 테스트 파일이 `.claude/tests/README.md` 커버리지 테이블(`## What's covered`)에 등재되지 않음
  - 위치: `.claude/tests/README.md` (변경 없음, 신규 항목 미등재) / 신규 파일 `.claude/tests/test_dependabot_npm_coverage.py`
  - 상세: README 는 harness 테스트 각 파일을 표로 나열해 "무엇을 지키는지"를 문서화하는 컨벤션을 유지해 왔다(`test_bootstrap_mermaid_install.py`, `test_mermaid_lint_ready.py` 등 최근 추가분도 모두 등재됨). 이번에 추가된 `test_dependabot_npm_coverage.py` 는 표에 없다. README 자체에 "신규 테스트는 반드시 등재하라"는 명시적 규범 문장은 없어 하드 위반은 아니지만, 기존 관행과의 불일치이며 발견성(discoverability)을 떨어뜨린다.
  - 제안: README 표에 한 행 추가(파일이 지키는 불변식 요약). 사소한 문서 완결성 항목이라 이 PR 을 막을 사유는 아님.

- **[INFO]** `_dependabot_npm_directories()` 의 `directory:` 정규식이 값 뒤 인라인 주석(`directory: "/foo" # note`)이 있으면 매칭 실패(값 손실)
  - 위치: `.claude/tests/test_dependabot_npm_coverage.py:77` (`d = re.search(r"""^\s*directory:\s*["']?([^"'#\n]+?)["']?\s*$""", block, re.M)`)
  - 상세: 정규식이 `$`(행 끝) 로 앵커링되어 있어, 닫는 따옴표 뒤에 트레일링 주석이 있으면 그 줄 전체가 매칭 실패해 해당 엔트리가 "미등록"으로 오분류될 수 있다(실제 실패 재현: 로컬 스크래치 파일로 직접 확인). 다만 현재 `dependabot.yml` 실제 내용에는 그런 줄이 없고, 파일 docstring 이 "손수 짠 파서는 stdlib-only 로 의도적으로 최소" 라고 명시하며 3건의 파서 sanity 테스트로 "빈 결과 → 항진명제" 를 막는 안전장치를 갖췄다. 향후 누군가 `directory:` 줄에 인라인 주석을 붙이면 이 가드가 그 엔트리를 (등록됐음에도) "미등록"으로 오탐 CI 실패시킬 잠재적 edge case.
  - 제안: 당장 수정 불요(설계상 허용된 트레이드오프). 재발 시 정규식에 `#.*$` 트레일링 주석 스트립 추가로 대응 가능.

## 검증 수행 내역 (요약)

- `test_dependabot_npm_coverage.py` 5건 + 하네스 전체 스위트 381건 실행 — 전부 통과 (`python3 -m unittest discover -s .claude/tests -p 'test_*.py'`).
- `_workspace_globs()`/`_dependabot_npm_directories()`/`_independent_trees()` 를 실제 `pnpm-workspace.yaml`/`.github/dependabot.yml` 에 대해 수동 정규식 트레이스 + 몽키패치 시뮬레이션으로 재검증: (a) mermaid-lint 를 dependabot 에서 제거한 뮤턴트 → `test_every_independent_npm_tree_is_registered` 가 실패함을 직접 재현·확인. (b) 존재하지 않는 경로를 등록한 stale 뮤턴트 → `test_no_stale_dependabot_npm_entry` 가 실패함을 재현·확인. 플랜 문서가 주장한 "비-vacuity: 3종 뮤턴트 전부 포착" 을 실측으로 뒷받침.
- `.github/workflows/e2e.yml`, `.github/workflows/harness-checks.yml` 을 `yaml.safe_load` 로 파싱해 문법 유효성 및 `paths`/`paths-ignore`/`workflow_dispatch` 반영 여부를 직접 확인 — diff 그대로 반영됨.
- `.github/dependabot.yml`, `pnpm-workspace.yaml` 실제 내용을 읽어 `harness-checks.yml` 신규 `paths:` 두 항목이 실존 파일을 가리킴을 확인.
- PROJECT.md §e2e 면제 화이트리스트 본문(93행 부근)에 `.github/**` 가 "CI 정의는 e2e 가 검증 대상 아님" 사유로 실제로 등재돼 있음을 확인 — e2e.yml 신규 주석의 spec 인용이 정확함(spec fidelity 일치, CRITICAL 없음).
- `review/code/2026/07/18/12_31_29` (test 파일 docstring 이 인용한 "W5" 출처)가 실제로 존재하고 dependabot 관련 리뷰 산출물을 담고 있음을 확인 — 근거 날조 없음.
- 커밋 `63a7250451f` 에 4개 변경 파일(테스트 신설·워크플로 2건·plan 체크박스)이 모두 함께 포함돼 있음을 `git show --stat` 로 확인 — "체크박스는 실제 작업과 같은 커밋에서만 체크" 컨벤션 준수.
- TODO/FIXME/HACK/XXX 주석 검색 결과 0건.

## 요구사항 충족 관점 항목별 평가

1. **기능 완전성**: `_independent_trees()` (workspace 밖 npm 트리 산출) ↔ `_dependabot_npm_directories()` (등록 여부) 양방향 검증(정방향 미등록 + 역방향 stale)이 모두 구현됨. plan 이 명시한 "역방향(stale 등록) 도 검사" 요구가 `test_no_stale_dependabot_npm_entry` 로 충족됨.
2. **엣지 케이스**: 빈 파싱 결과(vacuous pass)를 `ParserSanityTest` 3건으로 방어. 워크스페이스 루트 `package.json` 자체는 `_ROOT_MANIFEST` 로 명시 제외 — pnpm audit 커버리지 경계와 일치.
3. **TODO/FIXME**: 없음.
4. **의도-구현 괴리**: 함수명(`_independent_trees`, `_dependabot_npm_directories`, `_workspace_globs`)과 docstring 이 실제 구현과 일치. `workflow_dispatch` 추가 이유("paths-ignore 에서 특정 경로만 예외 처리 불가")도 GitHub Actions 실제 제약과 일치.
5. **에러 시나리오**: `subprocess.run(..., check=True)` 로 `git ls-files` 실패 시 예외 전파(무음 실패 방지). YAML 파일 부재 시 `read_text()` 가 `FileNotFoundError` 로 명확히 실패(무음 skip 없음).
6. **데이터 유효성**: 파서가 찾은 값이 없으면(빈 리스트/셋) sanity 테스트가 즉시 실패해 "실수로 아무것도 안 봄" 상태를 조기 검출.
7. **비즈니스 로직**: "pnpm 워크스페이스 밖 npm 트리는 반드시 dependabot 에 등록" 불변식이 정확히 코드화됨. `harness-checks.yml` trigger 확장도 "이 가드 자신이 안 도는" 실패 클래스를 선제 차단.
8. **반환값**: 모든 헬퍼 함수가 모든 경로에서 리스트/셋을 반환(암묵적 `None` 반환 경로 없음).
9. **spec fidelity**: 관련 "spec" 은 `spec/` 산하 제품 스펙이 아니라 `PROJECT.md §e2e 면제 화이트리스트`(하네스 정책 문서) — 본문과 line-level 대조 결과 완전 일치(`.github/** (CI 정의는 e2e 가 검증 대상 아님)`). `spec/` 자체에는 이 변경 영역을 정의하는 문서가 없음(하네스 self-governance 영역, 제품 스펙 대상 아님) — 결함 아님.

## 요약

`.claude/tests/test_dependabot_npm_coverage.py`(신규 커버리지 가드), `e2e.yml`(`.github/**` paths-ignore 누락 정정 + `workflow_dispatch` 탈출구), `harness-checks.yml`(신규 가드 트리거 경로 등재), `plan/in-progress/harness-guard-followups.md`(I3·W5 완료 체크) 네 파일 모두 plan 이 서술한 의도·PROJECT.md 상의 e2e 면제 화이트리스트 문언과 line-level 로 정확히 일치한다. 실행 검증(신규 테스트 5건 + 하네스 전체 381건 통과), YAML 파싱 검증, mutation 시뮬레이션(미등록·stale 뮤턴트 실측 재현)까지 모두 주장을 뒷받침했으며 CRITICAL/WARNING 급 결함은 발견되지 않았다. 발견한 두 건은 모두 INFO 수준(README 테이블 미등재로 인한 발견성 저하, 손수 짠 정규식의 인라인 주석 edge case)으로 이 변경을 막을 사유가 아니다.

## 위험도

NONE
