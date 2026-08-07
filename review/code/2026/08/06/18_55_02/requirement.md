# 요구사항(Requirement) 리뷰

## 발견사항

- **[WARNING]** "컴파일 에러는 그대로 전파" 라는 핵심 계약이 신규 테스트에서 검증되지 않는다 — `tsc` 가 실제로 실패하는 시나리오(=이 스크립트가 존재하는 이유와 가장 가까운 실패 경로)가 테스트 스위트에 빠져 있다.
  - 위치: `.claude/tests/test_packages_prepare_contract.py:126-127` (`PrepareBranchBehaviourTest._run` 의 스텁 `tsc` 가 항상 `exit 0` 만 쓴다), 및 클래스 전체 `test_typescript_present_always_compiles_even_when_dist_exists` / `test_typescript_present_compiles_when_dist_is_missing` (147-156)
  - 상세: 신규 `prepare` 스크립트 docstring(파일 전체 컨텍스트 24-25행)은 "typescript resolvable → run tsc ALWAYS (stale dist is rebuilt; **a compile error propagates**)" 라고 명시한다. 실제 JS 의미론상 `execSync('tsc', {stdio:'inherit'})` 는 `tsc` 가 non-zero 로 종료하면 예외를 던지므로(로컬로 `node -e` 로 확인함: `execSync('exit 1')` → `THREW: status=1`) 이 클레임은 참이다. 하지만 새 테스트 4개는 전부 `binp/tsc` 스텁이 무조건 `exit 0` 를 반환하도록 되어 있어(126-127행), tsc 가 실제로 실패하는 경로를 한 번도 실행하지 않는다. 이 PR 의 존재 이유 자체가 "산출물 없이 조용히 성공하면 안 된다" 이므로, 정작 tsc 가 진짜로 실행되고 실패할 수 있는 branch(1)이 회귀 anchor 없이 남아 있다 — 예컨대 누군가 `execSync` 호출을 `try/catch` 로 감싸 실패를 삼키는 리팩터를 해도 이 스위트는 잡지 못한다.
  - 제안: `_run` 에 `fail: bool` 같은 파라미터를 추가해 스텁 `tsc` 가 `exit 1` 하는 케이스를 만들고, `typescript=True` 일 때 tsc 실패가 prepare 전체의 non-zero 종료로 전파되는지 단언하는 테스트를 추가.

- **[INFO]** `existsSync('dist')` 는 `[ -d dist ]` 와 달리 디렉터리가 아닌 존재(예: 손상되어 파일로 남은 `dist`)도 "있음"으로 판정한다 — typescript 미해소 + `dist` 가 디렉터리가 아닌 상태로 남아있는 극히 좁은 손상 시나리오에서, 구버전은 tsc 실행을 시도해 (tsc 부재로) 크게 실패했지만 신버전은 no-op 으로 조용히 exit 0 한다.
  - 위치: `codebase/packages/ai-end-reason/package.json:9` (7개 패키지 전부 동일 스크립트 문자열 — 대표로 인용)
  - 상세: `tsc` 컴파일 산출물은 정상적으로는 항상 디렉터리이므로 자연 발생 가능성은 사실상 없고, PR 문서·테스트 어디에서도 이 구분을 계약으로 명시하지 않았다 — spec 부재 영역의 회색지대(침묵)로 판단해 blocking 대상은 아님.
  - 제안: 조치 불필요(문서화된 계약 밖). 필요하면 `existsSync('dist') && statSync('dist').isDirectory()` 로 좁힐 수 있다는 정도만 기록.

- **[INFO] spec fidelity**: 이 변경 전체(`.claude/tests/**`, `.github/workflows/harness-checks.yml`, `codebase/packages/*/package.json` 의 `prepare`)는 `spec/` 이 다루는 제품 기능이 아니라 harness/빌드 툴링이다. `spec/` 아래 대응 문서를 찾지 못했다 — CLAUDE.md 규약상 이 영역의 "spec" 은 `.claude/tests/README.md` 자신이다. README 신규 행(69-71행 추가분)의 서술("It used to be `[ -d dist ] || tsc`… replacement names all three cases (compile / no-op / throw)")을 실제 테스트 파일·package.json diff 와 대조한 결과 line-level 로 일치하며 drift 없음. `harness-checks.yml` 신규 trigger glob(`codebase/packages/*/package.json`)도 `test_no_filter_is_dead`(실행 확인, PASS)로 dead filter 가 아님이 검증된다.

## 검증 (실행 근거)

- `python3 -m unittest discover -s .claude/tests -p 'test_*.py'` → **870 tests OK** (커밋 메시지의 "harness 스위트 870 tests OK." 주장과 일치, 직접 재현).
- `python3 -m unittest discover -s .claude/tests -p 'test_packages_prepare_contract.py' -v` → 8/8 PASS. 세 갈래(항상 compile / no-op / throw) 모두 실제 subprocess 로 재현·확인됨.
- `python3 -m unittest discover -s .claude/tests -p 'test_harness_checks_paths_coverage.py'` → PASS (`test_no_filter_is_dead` 포함 — 신규 glob 이 실제 파일과 매치함을 확인).
- `python3 -m unittest discover -s .claude/tests -p 'test_tests_readme_catalog.py'` → PASS (README 신규 행이 카탈로그 정합성 가드를 통과).
- 7개 `codebase/packages/*/package.json` 의 `prepare` 문자열이 byte-identical 임을 `grep` 로 직접 대조·확인 (테스트가 요구하는 `len(distinct) == 1` 불변식과 일치).
- 신규 `prepare` 인라인 JS 를 추출해 `node --check` 로 문법 유효성 확인 — 통과.
- `codebase/packages/*/package.json` 7개 전부 `json.load` 로 파싱 성공 (유효 JSON).

## 요약

7개 내부 패키지의 `prepare` 스크립트를 "디렉터리 존재만 확인"(`[ -d dist ] || tsc`)에서 "typescript 해소 가능 여부로 분기하는 3-branch 계약"(항상 compile / pruned-tree no-op / throw)으로 교체하고, 이를 지키는 신규 회귀 테스트(`test_packages_prepare_contract.py`)와 CI 트리거(`harness-checks.yml`), 카탈로그 문서(`README.md`)를 추가한 변경이다. 세 갈래 모두 실제 subprocess 로 실행해 검증하는 테스트 설계이고, 전수 실행 결과(870 tests) 및 커밋 메시지의 실측 주장이 그대로 재현되어 기능 완전성·spec(=README) 정합성 모두 확인됨. 유일한 실질적 갭은 "컴파일 에러가 그대로 전파된다"는 이 PR의 핵심 안전 주장 중 하나가 스텁 `tsc` 가 항상 성공만 하도록 짜여 있어 테스트로 pin 되어 있지 않다는 점(WARNING) — 코드 자체의 동작(Node `execSync` 의미론)은 옳다고 독립적으로 확인했으므로 기능 결함이 아니라 회귀 방지망의 구멍이다. 그 외 발견은 이론적 엣지 케이스(INFO)와 spec 부재에 대한 정보성 기록(INFO)뿐이다.

## 위험도

LOW
