# 문서화(Documentation) 리뷰

### 발견사항

- **[WARNING]** "셸 편집 구멍은 CI 가 막는다" 는 서술이 구현보다 넓다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:21-22`, `.claude/tools/nerv-mirror/pull.py:6-7`, `CHANGELOG.md:36`, `.github/workflows/spec-link-checks.yml:120-124`
  - 상세: 훅은 `spec/` 전체(동결한 옛 `spec/<영역>/` 트리 포함)를 막는다. 그런데 `pull.py --check` 는 `mirror_files()` 가 돌려주는 `CLE-*` 미러 파일만 훑는다(`pull.py:255-274`). 실측: scratch 루트에 미러 1편과 손으로 쓴 `spec/5-system/x.md` 를 두고 `pull.py --check --root <scratch>` 를 돌리면 "미러 1편 · 문제 0", exit 0 이다. 옛 트리의 셸 편집, 미러 파일 삭제, 미러 이름을 쓰지 않는 신규 파일은 CI 가 잡지 못한다. 위 네 곳은 "훅이 못 보는 셸 편집은 CI 가 막는다"·"셸 · 손 편집을 잡는다" 고 적어서 훅이 지키는 범위 전체를 CI 가 이어받는 것처럼 읽힌다. 짝 planner PR 의 `CLAUDE.md`(브랜치 `claude/nerv-cutover-1-docs-c46df0`, 52-53행)도 같은 문장이다.
  - 제안: "CI 는 미러 파일(`CLE-*`)의 본문 변조와 위치 이동만 잡는다. 옛 트리 동결 · 파일 삭제 · 신규 파일은 훅 밖에서는 강제되지 않는다" 로 좁혀 적는다. 짝 PR 의 `CLAUDE.md` 문장도 같이 좁힌다. 또는 `--check` 가 `spec/` 아래 `CLE-*` 도 옛 트리 이름도 아닌 신규 파일을 보게 넓히고 문서는 그대로 둔다.

- **[WARNING]** 가드 스코프를 서술한 `PROJECT.md` 가 미러 제외를 반영하지 않았다
  - 위치: `PROJECT.md:392`
  - 상세: "검사 스코프 3가지" 의 1번이 `spec/**.md` 본문 링크를 "(생성형 `*-api-catalog/` 제외)" 로만 적는다. 이 변경으로 `collectSpecMarkdown` 은 NERV 미러(`spec/CLE-*` · `spec/<영역 키>/**` · `spec/README.md`)도 뺀다. `spec/conventions/spec-impl-evidence.md` §4.2 표의 예외 칸(133-134행)도 같은 상태다. 이 spec 파일은 이제 NERV 정본이라 이 PR 이 직접 고칠 수 없으니 후속 처리 경로를 정해야 한다. 이 PR 의 consistency 리뷰(`review/consistency/2026/09/29/12_51_07/convention_compliance.md`)도 같은 지적을 했다.
  - 제안: `PROJECT.md:392` 를 "(생성형 `*-api-catalog/` 와 NERV 미러 `spec/CLE-*` · `spec/README.md` 제외 — 미러 무결성은 `pull.py --check`)" 로 고친다. `spec-impl-evidence.md` 표는 NERV 초안으로 고치거나, 어긋난 채 남는 구간을 Task 에 기록한다.

- **[INFO]** 훅 모듈 독스트링의 핵심 문장에 글자가 빠져 읽히지 않는다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11`
  - 상세: "막는 경로는 전환 단계를 따라 는다." 에서 동사가 잘렸다(바이트를 확인했다). 이 문단이 단계 1·2·3 으로 막는 경로가 늘어난다는 설계 근거를 담고 있어, 이 문장이 깨지면 뒤따르는 "더한다" 가 무엇을 받는지 흐려진다.
  - 제안: "막는 경로는 전환 단계에 따라 늘린다." 로 고친다.

- **[INFO]** 이 변경으로 낡은 코드 주석이 남았다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts:16`, `:36` / `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts:153-154`
  - 상세: `spec-area-index.test.ts` 는 `collectSpecMarkdown(root); // excludes catalogs` 와 "Generated `*-api-catalog/` trees are exempt" 라고 적지만 이제 미러도 빠진다. `tree-walk.test.ts` 의 비교 표는 `collectSpecMarkdown` 이 "`spec/` 루트 파일을 본다" 고 적는데 루트의 `spec/CLE-VISION.md` · `spec/README.md` 는 더 이상 보지 않는다. 표가 고정하려는 것은 옛 트리 기준의 차이라 결론은 유효하지만 표만 읽으면 오해한다.
  - 제안: 각각 "excludes catalogs and the NERV mirror" 로 바꾸고 표 아래에 "미러(`spec/CLE-*`, `spec/README.md`)는 양쪽 다 안 본다" 한 줄을 더한다.

- **[INFO]** 테스트 README 의 `test_consistency_bundle_priority.py` 행에 새 테스트 클래스가 없다
  - 위치: `.claude/tests/README.md:91`
  - 상세: 이 행은 스위트가 고정하는 것을 항목별로 적는다. 새 `NervMirrorStaysOutOfTheOldCorpusTest`(미러 169편이 `related_specs` · `conventions` 코퍼스에 섞이지 않음, `is_nerv_mirror` 판정)는 예산 순서와 다른 축인데 행에 없다. 새 스위트 두 개(`test_nerv_mirror_pull.py` · `test_guard_nerv_owned_paths.py`)는 66-67행에 잘 등재됐다.
  - 제안: 91행 끝에 "`NervMirrorStaysOutOfTheOldCorpusTest`: 미러(`spec/CLE-*` · `spec/README.md`)는 옛 코퍼스에 섞지 않는다. 섞으면 번들 순서 단언이 깨진다(2026-09-29 실측)" 를 덧붙인다.

- **[INFO]** `pull.py` 가 읽는 환경 변수가 모듈 문서에 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:9-14`, `:244-250`
  - 상세: `NERV_SERVER` · `NERV_TOKEN`(필수)과 `NERV_PROJECT`(기본 `clemvion`)는 `load_env()` 코드와 오류 메시지에서만 드러난다. 모듈 독스트링의 "모드" 목록에는 `--spec KEY`(scope 대신 지정한 키만 받기), `--basis`, `--from-zip`, `--root` 도 없다. 또 `--task` 의 metavar 가 `KEY` 라서 `--spec KEY` 와 같아 보이는데 실제 값은 Task 키(`CLE-T-…`)다. 이 값을 어디에 두는지는 `.claude/docs/worktree-policy.md` §8 에 있다.
  - 제안: 독스트링에 "환경: `NERV_SERVER` · `NERV_TOKEN`(필수), `NERV_PROJECT`(기본 clemvion). 값은 `.claude/settings.local.json` 의 `env`(worktree-policy §8)" 와 `--spec` 의 한 줄 설명을 더한다. `--task` 의 metavar 는 `TASK` 로 바꾼다.

- **[INFO]** 새 훅과 우회 환경 변수가 harness 정책 문서에 등재되지 않았다
  - 위치: `.claude/docs/worktree-policy.md` §5 Enforcement 표와 "우회" 목록
  - 상세: §5 는 `BYPASS_DEFAULT_BRANCH_GUARD=1` 만 우회로 적는다. 새 `BYPASS_NERV_OWNED_PATHS=1` 은 훅 독스트링과 차단 메시지에만 있다. 짝 PR 을 grep 해도(`CLAUDE.md` · `developer` · `project-planner` SKILL 에서 훅 이름만 나오고) 우회 변수는 어디에도 없다. 이 문서는 planner 소유라 이 PR 범위 밖이지만 편집 차단을 만난 개발자가 우회 방법을 찾는 곳은 여기다.
  - 제안: 짝 PR 이나 후속 planner 턴에서 §5 표에 편집 가드(`guard_nerv_owned_paths.py`, PreToolUse)를 더하고 우회 목록에 `BYPASS_NERV_OWNED_PATHS=1` 을 적는다. 이때 `spec/` 만 막고 `review/` · `plan/` 은 단계 2·3 에서 더한다는 것도 한 줄 적는다.

- **[INFO]** CI 워크플로 주석과 CHANGELOG 문구 두 곳이 사실보다 좁거나 어긋난다
  - 위치: `.github/workflows/spec-link-checks.yml:1-4`, `:133` / `CHANGELOG.md:34`
  - 상세: 파일 머리말은 이 워크플로를 "docs 가드 전체(vitest)를 돌린다" 로 설명하지만 이제 `pull.py --check` 를 돌리는 별도 잡이 있다. 133행의 no-op 메시지는 "spec · .claude 경로 변경 없음" 이라고 하는데 실제로 `relevant=false` 는 `codebase/**` · `plan/**` · 루트 `*.md` 도 함께 바뀌지 않았을 때다. CHANGELOG 34행은 "Write · Edit 로" 라고 적지만 훅은 `MultiEdit` · `NotebookEdit` 도 막는다. 이 항목은 훅을 우회하는 `BYPASS_NERV_OWNED_PATHS=1` 도 알리지 않는다.
  - 제안: 머리말에 "2026-09-29: NERV 미러 무결성 잡(`spec-mirror-integrity`)이 같은 파일에 붙었다" 한 문단을 더한다. no-op 메시지는 첫 잡과 같은 문구로 맞춘다. CHANGELOG 는 "Write · Edit 등 편집 도구로" 로 바꾸고 우회 변수를 한 줄 더한다.

### 요약

이 변경은 새 스위트 두 개를 테스트 README 에 등재했고 훅 · 도구 · 테스트 모듈 독스트링과 CHANGELOG 항목(개발 흐름 가드 신설에 해당하는 "가드 신설" 사례)을 갖춰 문서화 수준이 높다. 다만 가장 무거운 문제는 "훅이 못 보는 셸 편집은 CI 가 막는다" 는 반복된 서술이 구현보다 넓다는 점이다. `--check` 는 미러 파일만 훑기 때문에 동결한 옛 트리의 셸 편집과 미러 파일 삭제는 통과한다(실측 exit 0). 짝 planner PR 의 `CLAUDE.md` 도 같은 문장이라 함께 좁혀야 한다. 그 밖에는 `PROJECT.md:392` 의 가드 스코프 서술이 낡았고 훅 독스트링 11행에 글자가 빠졌으며 몇몇 코드 주석 · README 행 · 환경 변수 문서가 새 동작을 반영하지 않았다. 코드나 동작을 막는 결함은 없다.

### 위험도
LOW
