STATUS=success documentation review complete — 3 files flagged (2 WARNING, 1 INFO/minor)
===REPORT_MARKDOWN_BELOW===
# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** plan 체크박스가 실제 상태(이 PR 에서 이미 구현됨)를 반영하지 못한다
  - 위치: `plan/in-progress/ci-required-check-skip-jobs.md:187` (`- [ ] **\`changes\` 잡을 reusable workflow(\`workflow_call\`)로 추출 — 트리거 도달, 다음 PR**`, 187~196행 블록)
  - 상세: 이 항목은 `backend-checks.yml`(#1109)이 "3번째 전환"이므로 다음 PR 에서 추출을 집행하라고 명시한 미체크 항목이다. 지금 리뷰 대상 커밋(`refactor(ci): skip-job \`changes\` 잡을 reusable workflow 로 추출 — 3중 복제 해소`)이 바로 그 작업이며, `.github/workflows/_changed-paths.yml` 신설 + 세 워크플로 전환으로 이미 완료됐다. 그런데도 체크박스는 여전히 `[ ]`다. 같은 항목이 `plan/in-progress/backend-lint-gate-broken-on-main.md:211`(`- [ ] **\`changes\` 잡 + 셋업 보일러플레이트를 reusable workflow 로 추출 — 트리거 이미 도달**`, 211~220행 블록)에도 중복 기재되어 있고 역시 미체크다. 이 저장소는 "plan 체크박스 = 실제 상태" 원칙을 여러 번 명시적으로 채택했고, 완료 후 미체크 상태로 방치되면 다음 세션이 "아직 안 됐다"고 오판해 중복 작업하거나, 반대로 이미 끝난 항목인지 몰라 놓칠 위험이 있다.
  - 제안: 이 PR/커밋과 같은 턴에 두 plan 파일의 해당 체크박스를 `[x]`로 갱신하고, 완료 근거(커밋 SHA/PR 번호)를 한 줄 남긴다. 두 파일에 중복 기재된 동일 항목이므로 양쪽 다 갱신이 필요하다.

- **[WARNING]** `.claude/tests/README.md` 의 `test_required_check_skip_jobs.py` 행이 같은 커밋에서 그 테스트 파일에 추가된 신규 계약을 반영하지 못한다
  - 위치: `.claude/tests/README.md:51`
  - 상세: 이 커밋은 `.claude/tests/test_required_check_skip_jobs.py` 를 상당히 재작성했다 — `pathspecs_of()` 헬퍼로 substring 매칭을 파싱으로 교체, `changes` 잡이 이제 `uses: ./.github/workflows/_changed-paths.yml` 로 위임하는지 확인하는 로직 추가, 공유 워크플로 자신의 `outputs.relevant`/`id: detect`/`workflow_call.outputs.relevant.value` 배선까지 따라 들어가 검증하는 로직 추가, 그리고 각 전환 워크플로의 pathspecs 에 `scripts/ci-paths-changed.sh` 뿐 아니라 **`.github/workflows/_changed-paths.yml` 자신도** 등재됐는지 요구하는 새 단언 추가(파일 컨텍스트 250~263행). 하지만 README 51행은 여전히 "a fifth requires each workflow to list `scripts/ci-paths-changed.sh` among its own globs" 라고만 서술해 새로 추가된 reusable-workflow 위임 검증·wiring 추적·`_changed-paths.yml` 자기등재 요구를 언급하지 않는다. 이 README 는 스스로 "harness 자기 테스트 카탈로그"를 표방하며 각 테스트가 정확히 무엇을 고정하는지 서술하는 것이 목적이므로, 같은 커밋에서 테스트가 바뀌었는데 행이 안 바뀐 것은 이 파일의 존재 이유와 어긋난다.
  - 제안: 51행에 "changes 잡이 이제 reusable workflow 로 위임되며, 그 위임(`uses:`)과 공유 워크플로 자신의 출력 배선, 그리고 각 워크플로가 `.github/workflows/_changed-paths.yml` 자신을 pathspecs 에 등재했는지까지 검증한다"는 취지를 추가한다.

- **[INFO]** 세 전환 워크플로 중 `backend-checks.yml` 에만 `.github/workflows/_changed-paths.yml` 자기등재 이유를 설명하는 주석이 있고, 나머지 둘에는 없다
  - 위치: `.github/workflows/backend-checks.yml:44-45`(설명 있음, 신규 추가) vs `.github/workflows/deps-security-checks.yml:40-46`+`:60`(설명 없이 항목만 존재) 및 `.github/workflows/frontend-checks.yml:27`+`:38`(설명 없이 항목만 존재, 주석 자체가 한 줄뿐)
  - 상세: `backend-checks.yml` 은 이번 diff 에서 "`_changed-paths.yml` 자신도 목록에 있다 — 판정 wiring 이 바뀌면 그것에 기대는 이 워크플로가 돌아야 한다(`scripts/ci-paths-changed.sh` 를 등재한 것과 같은 이유)."(44~45행) 라는 설명을 얻었다. 반면 `deps-security-checks.yml`·`frontend-checks.yml` 도 pathspecs 목록에 동일하게 `.github/workflows/_changed-paths.yml` 를 추가했지만(각 60행/38행), 그 항목이 왜 거기 있는지 설명하는 주석은 붙지 않았다. `test_required_check_skip_jobs.py::test_converted_workflows_pass_the_script_its_own_path` 가 세 파일 모두에서 이 항목의 존재를 강제하므로 기능은 동일하게 보호되지만, 세 파일 중 하나만 "왜"를 설명하는 비일관성은 — 이 저장소가 반복해서 겪은 "한 곳만 갱신되고 나머지가 조용히 stale 해지는" 클래스(예: `harness-checks.yml` paths 커버리지 갭 6회, router 정책 문서 미러 drift)와 같은 모양이다. 코드 정확성에는 영향이 없다.
  - 제안: `deps-security-checks.yml:40`, `frontend-checks.yml:27` 주석 블록에도 backend-checks.yml 과 동일한 한 줄("`_changed-paths.yml` 자신도 목록에 있다 — …")을 추가해 세 파일의 설명 수준을 맞춘다.

## 강점 (참고)

- `.github/workflows/_changed-paths.yml` 신규 헤더 주석은 추출 배경(#1106/#1109 PR 번호까지 정확), 2단계가 아닌 3단계 추출을 택한 근거, `workflow_call` 스칼라 제약과 그로 인한 멀티라인 문자열 전달, 가장 깨지기 쉬운 지점(글로브 조기 확장)까지 상세히 서술한다. 특히 "처음엔 '전부가 한 덩어리 인자 1개가 된다' 고 적었는데 뮤테이션으로 반증됐다"는 자기수정 기록은 문서가 실측을 따라가는 이 저장소의 관행과 일치한다.
- `.claude/tests/test_changed_paths_reusable.py` 의 모듈 docstring 은 "왜 정적 grep 이 아니라 실행 검증인가"를 이 저장소의 과거 사고(인자 목록이 한 덩어리로 전달된 사고)와 명시적으로 연결해 근거를 남긴다. `run:` 블록 내 `if` 사용 이유(`set -e` + `&&` 트랩) 등 비직관적 bash 동작에 대한 인라인 주석도 정확하다.
- `CHANGELOG.md` 는 이 저장소 관행상 `codebase/` 제품 변경에만 쓰이고 CI/하네스 전용 변경(선행 커밋 #1106·#1109 포함)에는 쓰이지 않으므로, 이번 변경이 CHANGELOG 를 건드리지 않은 것은 결함이 아니다. `PROJECT.md` §CI 게이트 표도 이번 diff 로 새 로컬 명령이나 게이트가 추가되지 않았으므로 갱신 불요가 맞다.

## 요약

핵심 기능 문서(신규 `_changed-paths.yml` 헤더, 신규 테스트 파일 docstring, 워크플로 인라인 주석)는 이 저장소의 높은 문서화 기준을 그대로 유지하며 근거·과거 사고·뮤테이션 검증까지 촘촘히 남겼다. 다만 같은 커밋 안에서 (1) 이 작업 자체를 가리키는 두 plan 파일의 체크박스가 미체크로 방치됐고, (2) `.claude/tests/README.md` 의 관련 테스트 카탈로그 행이 이번에 바뀐 테스트 계약(reusable workflow 위임 검증·자기등재 요구)을 반영하지 못했다. 둘 다 기능적 결함은 아니지만 이 저장소가 반복적으로 대가를 치른 "한쪽만 갱신되고 나머지가 stale 해지는" 문서 drift 클래스와 같은 모양이라 병합 전 정정을 권한다. 세 워크플로 파일 간 주석 커버리지 불일치는 부수적인 INFO 성격이다.

## 위험도

MEDIUM
