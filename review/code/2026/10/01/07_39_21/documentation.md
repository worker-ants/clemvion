# 문서화(Documentation) 리뷰 (라운드 2)

라운드 1 문서화 리뷰(`review/code/2026/09/29/12_50_13/documentation.md`)의 지적 8건이 닫혔는지 먼저 대조했고, 그다음 수정이 만든 새 서술을 코드와 대조했다. 저장소 파일은 건드리지 않았다. 실측은 scratch 사본(`--root`)에서만 했다.

## 라운드 1 지적의 종결 여부

| 라운드 1 지적 | 상태 | 확인한 곳 |
| --- | --- | --- |
| CI 가 셸 편집을 막는다는 서술이 구현보다 넓다 | 닫힘 | 훅 28-30행, `pull.py` 35-37행, CHANGELOG 39-40행, `spec-link-checks.yml` 124-131행이 모두 "손편집 · 이동만 잡는다" 로 좁아졌다 |
| `PROJECT.md` 스코프 서술에 미러 제외 누락 | 부분 닫힘 | 392-393행은 고쳐졌다. 같은 파일 305-306행과 378-388행은 그대로다(아래 INFO 3) |
| 훅 독스트링 11행의 잘린 문장 | 닫힘 | 훅 16행 "늘어난다" |
| 낡은 코드 주석 | 닫힘 | `spec-area-index.test.ts` 16-17 · 37행, `tree-walk.test.ts` 156-157행 |
| 테스트 README 의 bundle_priority 행 | 닫힘 | `.claude/tests/README.md` 91행 |
| `pull.py` 환경 변수 · `--spec` · metavar | 닫힘 | `pull.py` 19-20행, 12행, `--task` metavar `TASK` |
| 새 훅 · 우회 변수가 `worktree-policy.md` 에 없음 | 열림 | planner 소유 문서. 짝 브랜치 `claude/nerv-cutover-1-docs-c46df0` 에도 없다(아래 INFO 6) |
| CI 머리말 · no-op 문구 · CHANGELOG 의 도구 목록 | 닫힘 | `spec-link-checks.yml` 34-36 · 140행, CHANGELOG 35-36행 |

## 발견사항

- **[WARNING]** `MirrorPredicateParityTest` 가 약속하는 "세 판정이 갈라지지 않는다" 를 CI 는 한 방향에서 지키지 못한다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:585-593`, `.github/workflows/harness-checks.yml:74-76`
  - 상세: 독스트링은 "키 형식이 바뀌면 각 스위트가 초록인 채 갈라지는 것을 막는다" 고 적고, 테스트 README 66행도 세 판정을 "binds" 한다고 적는다. 그런데 이 테스트는 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 의 `NERV_MIRROR` 리터럴과 실제 `spec/` 트리를 읽는다. `harness-checks.yml` 의 `changes.pathspecs` 에는 이 두 경로가 없다(`grep` 으로 `spec/**` · `spec-links` · `codebase/frontend` 를 찾으면 141행 `tsconfig.typecheck.json` 하나뿐이다). `.claude/tests` 를 돌리는 워크플로는 `harness-checks.yml` 하나뿐이라서, `spec-links.ts` 의 정규식만 고친 PR 은 이 테스트를 돌리지 않는다. `test_harness_checks_paths_coverage.py` 는 모듈 수준 경로 상수만 읽는데 여기 `TS` 는 클래스 속성이라 그 가드도 못 잡는다. `orchestrator` 쪽(`.claude/skills/**`)과 `pull.py` 쪽(`.claude/tools/**`)은 이미 덮여 있어 빠진 것은 TS 쪽 한 방향이다. 이 파일이 "여섯 번 새어 나갔다" 고 스스로 적은 바로 그 갭 형태다. 같은 PR 이 `.claude/settings.json` 은 같은 이유로 등재했다(74-76행).
  - 제안: `harness-checks.yml` 에 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 를 한 줄 주석("`MirrorPredicateParityTest` 가 `NERV_MIRROR` 리터럴을 읽는다. 이 파일만 고친 PR 에서 세 판정의 동치 검사가 빠진다")과 함께 더한다. 등재를 원하지 않으면 테스트 독스트링과 README 문구를 "harness 전체 실행에서 동치를 본다. `spec-links.ts` 단독 수정은 CI 가 트리거하지 않는다" 로 좁힌다.

- **[INFO]** 미러 파일의 "추가" 는 잡지 않는다는 서술이 실측보다 좁다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:29-30`, `.claude/tools/nerv-mirror/pull.py:35-37`, `CHANGELOG.md:39-40`, `.github/workflows/spec-link-checks.yml:128-130`
  - 상세: 네 곳이 "미러 파일의 추가 · 삭제는 어느 층도 잡지 않는다" 고 적는다. scratch 에 미러 169편을 복사하고 지문 없는 `spec/CLE-ACCT/CLE-NEWONE.md` 를 더한 뒤 `pull.py --check --root <scratch>` 를 돌렸다. 결과는 "내용이 mirror_sha256 과 다르다 … 미러 170편 · 문제 1", exit 1 이었다. `mirror_files()` 가 `CLE-*.md` 이름을 전부 주워서 지문이 없는 새 파일도 걸린다. 실제로 못 잡는 것은 미러 이름이 아닌 새 파일(`spec/new.md`), 미러 파일 삭제, 지문까지 계산해 넣은 위조 파일이다. 틀린 방향이 안전한 쪽이라 해는 작지만, 이 경계를 근거로 새 가드를 설계하는 사람이 이미 덮인 것을 다시 만들 수 있다.
  - 제안: 네 곳의 문구를 "미러 이름이 아닌 새 파일 · 미러 파일 삭제 · 옛 `spec/<영역>/` 트리의 셸 편집은 잡지 않는다(지문 없는 `CLE-*.md` 추가는 잡는다)" 로 맞춘다. 같은 경계를 `test_nerv_mirror_pull.py` 의 `CheckTest` 에 테스트로 고정하면 문서와 동작이 같이 묶인다.

- **[INFO]** CHANGELOG 의 "미러 넣기 전 실측" 은 시점이 거꾸로다
  - 위치: `CHANGELOG.md:42`
  - 상세: 커밋 본문(`de36badf7`)은 "제외 전 실측: docs 가드 49건 RED" 다. 미러를 트리에 둔 채 제외 규칙만 없을 때 잰 값이다. "미러 넣기 전" 으로 읽으면 미러가 없던 때라 깨질 것이 없다. 49 라는 숫자가 이 문장의 유일한 근거라서 시점이 틀리면 수치도 읽을 수 없다.
  - 제안: "미러를 넣은 채 제외 규칙이 없을 때 실측: docs 가드 49건 RED, 번들 순서 단언 RED" 로 고친다.

- **[INFO]** CHANGELOG 의 "ETag 가 같으면 건너뜀" 은 `--task` 의 실제 동작과 다르다
  - 위치: `CHANGELOG.md:31-32`
  - 상세: `cmd_task` 는 304 를 받으면 본문을 다시 받지 않을 뿐 캐시 원문을 지금 트리로 다시 렌더해 쓴다(`pull.py` 446-447행, 테스트 `test_304_re_renders_links_when_a_target_moved`). 다른 문서가 옮겨졌다면 304 여도 파일이 바뀐다. "건너뜀" 은 파일을 안 건드린다는 뜻으로 읽힌다.
  - 제안: "(ETag 가 같으면 본문을 다시 받지 않고 캐시 원문으로 링크만 다시 만든다)" 로 바꾼다.

- **[INFO]** `PROJECT.md` 에 미러 도구의 실행 명령과 새 CI 잡이 없고, 이웃 서술 두 곳이 미러 제외를 반영하지 않았다
  - 위치: `PROJECT.md:305`, `PROJECT.md:306`, `PROJECT.md:378-388`
  - 상세: CLAUDE.md 는 "실제 명령" 을 `PROJECT.md` 에 두라고 한다. 이 변경은 세 모드(`--all` · `--task` · `--check`)와 필수 환경 변수가 있는 CLI, 새 CI 잡 `spec-mirror-integrity` 를 들였는데 `PROJECT.md` 에는 393행의 괄호 안 한 구절뿐이다. 305행(`spec-link-integrity` 스코프 "(1) `spec/**.md` 본문")과 306행(`spec-area-index`)은 392행과 달리 미러 제외를 적지 않는다. 378-388행은 "`spec-link-checks` 워크플로가 docs 가드 전체를 돌린다" 고만 적어서 같은 워크플로의 두 번째 잡이 보이지 않는다.
  - 제안: 문서 링크 검증 절 아래에 "### NERV 스펙 미러" 를 두고 `python3 .claude/tools/nerv-mirror/pull.py --check`(CI 와 같은 명령)와 `--task <CLE-T-…>`(필요 env: `NERV_SERVER` · `NERV_TOKEN`, 값은 `.claude/settings.local.json`)를 적는다. 305-306행에는 392행과 같은 제외 문구를 한 줄씩 더한다.

- **[INFO]** 차단 메시지가 "옛 경로에서 NERV 키를 찾는 법" 을 알려 주지 않는다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:45-46`
  - 상세: 안내는 `/nerv:spec edit <KEY>` 인데, 동결된 옛 트리(`spec/5-system/1-auth.md` 등)를 고치려다 막힌 사람은 KEY 를 모른다. 옛 경로에서 키로 가는 역색인은 미러 frontmatter 의 `source_paths` 이고 `pull.py` 독스트링 28행만 이것을 설명한다(예: `spec/5-system/1-auth.md` 를 담은 미러가 `spec/CLE-ACCT/` 아래 3편 있다). 렌더되는 `spec/README.md` 에도 이 안내가 없다.
  - 제안: `OWNED_ROOTS["spec"]` 문구에 "옛 경로의 키는 `grep -l '<옛 경로>' spec/CLE-*/*.md` 로 미러 frontmatter `source_paths` 에서 찾는다" 를 더하고, `render_readme` 의 목록에도 같은 줄을 한 줄 넣는다.

- **[INFO]** 이 PR 밖 문서 두 곳이 새 구현과 어긋난다(planner 소유, 짝 PR 에서 처리)
  - 위치: `.claude/docs/worktree-policy.md` §5 Enforcement 표와 우회 목록, 짝 브랜치 `claude/nerv-cutover-1-docs-c46df0` 의 `CLAUDE.md:52-53`
  - 상세: 첫째, `worktree-policy.md` 는 `BYPASS_DEFAULT_BRANCH_GUARD=1` 만 우회로 적는다. 새 훅과 `BYPASS_NERV_OWNED_PATHS=1` 은 훅 독스트링 · 차단 메시지 · CHANGELOG 에만 있고 짝 브랜치 어디에도 없다(`git grep` 으로 확인했다). 편집이 막힌 사람이 우회법을 찾는 곳이 이 문서다. 둘째, 짝 브랜치 `CLAUDE.md` 는 "셸 · 손 편집은 CI `spec-mirror-integrity` 가 막는다" 고 적는다. 이 저장소에는 등록된 required check 가 없다고 같은 워크플로의 92-96행이 적으므로 이 잡이 실패해도 머지가 기계적으로 막히지는 않는다. 이 PR 의 문구("잡는다")가 더 정확하다.
  - 제안: 짝 PR 이나 다음 planner 턴에서 §5 에 편집 가드와 우회 변수를 더하고, `CLAUDE.md` 의 "막는다" 를 "잡는다" 로 맞춘다.

- **[INFO]** "단계 4e" 는 저장소 안에 정의가 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:199`, `.claude/tests/test_consistency_bundle_priority.py:961`
  - 상세: 훅 독스트링이 설명하는 전환 단계는 1 · 2 · 3 이고 `spec-links.ts` 와 렌더되는 README 는 단계 5 를 말한다. "4e" 는 어느 문서에도 풀이가 없다. 결정 ID D1 · D2 · D4 는 쓰인 자리에서 뜻을 풀어 줘서 읽히지만 4e 는 그렇지 않다.
  - 제안: "(코퍼스를 미러로 옮기는 일은 단계 4e 다)" 뒤에 "— NERV Task `CLE-T-VA4YA1` 후속" 처럼 찾을 곳을 한 구절 붙인다.

- **[INFO]** 테스트 README 의 `test_nerv_mirror_pull.py` 행에 `CiWiringTest` 가 없다
  - 위치: `.claude/tests/README.md:66`
  - 상세: 이 행은 스위트가 고정하는 것을 클래스별로 나열한다. `CiWiringTest`(`spec-mirror-integrity` 잡이 `pull.py --check` 를 실제로 부른다, 커밋된 미러가 자기 검사를 통과한다)는 CI 잡이 빠지면 셸 편집을 못 잡는다는 별도 축인데 행에 없다.
  - 제안: 행 끝에 "`CiWiringTest` 는 `spec-link-checks.yml` 의 `spec-mirror-integrity` 잡이 `pull.py --check` 를 부르는지, 커밋된 `spec/` 미러가 자기 검사를 통과하는지 고정한다" 를 더한다.

## 확인했지만 문제 없던 것

- 훅 독스트링의 판정 규칙(체크아웃 루트 탐색, 표지 파일, `realpath`, 대소문자 무시, 우회 변수 `=1` 만)은 코드와 테스트(`test_guard_nerv_owned_paths.py`)에 일치한다. 차단 대상이 `spec/` 뿐이고 `review/` · `plan/` 은 단계 2 · 3 에서 더한다는 서술도 테스트 README 67행, 테스트 독스트링 13-14행과 같다.
- `pull.py` 독스트링의 API 경로(트리 · Task 는 `/api/v1/…`, md · export 는 `/api/projects/…`), 환경 변수 출처(`.claude/settings.local.json` 의 `env`)는 코드와 `worktree-policy.md` §8 에 일치한다. 금지된 문체 표현은 변경된 문서 줄에서 찾지 못했다.
- CHANGELOG 항목은 기준 3(개발 흐름: 훅 · CI 잡 신설, 가드 제외 규칙으로 느슨해지는 범위)에 해당하고 머리말 형식(`## Unreleased — …`)과 우회 변수 · 훅 없는 main checkout 동작을 적었다. 새 환경 변수는 없다.

### 요약

라운드 1 의 문서화 지적 8건 중 6건이 닫혔고, 1건은 일부만 닫혔고(`PROJECT.md`), 1건은 planner 소유 문서라 열려 있다. 수정으로 새 결함이 생긴 곳은 없고 독스트링 · 주석 · README 행은 코드와 대체로 일치한다. 남은 가장 무거운 문제는 `MirrorPredicateParityTest` 가 약속하는 동치 검사를 CI 가 `spec-links.ts` 단독 수정에서는 돌리지 않는다는 점이며, 이 저장소가 여러 번 겪은 paths 커버리지 갭과 같은 형태다. 나머지는 `--check` 가 잡는 범위를 네 곳이 실측보다 좁게 적은 것, CHANGELOG 문구 두 곳(실측 시점 · `--task` 304 동작), `PROJECT.md` 의 명령 · 이웃 서술 누락, 차단 메시지의 키 찾기 안내 부재 같은 참고 사항이다. 동작을 막는 결함은 없다.

### 위험도
LOW
