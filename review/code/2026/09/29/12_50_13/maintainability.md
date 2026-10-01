# 유지보수성(Maintainability) 리뷰

대상은 NERV 정본 전환 단계 1이다(`guard_nerv_owned_paths.py`, `pull.py`, 옛 트리 가드 제외 규칙, CI 잡, 테스트). 첫 미러 169편(d82040273)은 범위 밖이다.
검증은 `pull.py --check` 를 읽기 전용으로 1회 돌렸다(미러 169편, 문제 0). 저장소 파일은 건드리지 않았다.

### 발견사항

- **[WARNING]** "NERV 미러 경로" 판정이 세 언어 네 곳에 따로 있는데 서로 묶는 테스트가 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:200`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:255`, `.claude/tools/nerv-mirror/pull.py:48` · `:142`
  - 상세: 오케스트레이터의 `_NERV_MIRROR_REL`, 프런트 `NERV_MIRROR`, pull.py 의 `KEY_RE` 와 `mirror_files` 가 같은 개념("어느 파일이 미러인가")을 각자 정규식으로 갖는다. 앞의 둘은 `CLE-[A-Z0-9-]+` 로 느슨하고 pull.py 는 더 엄격해서 이미 모양이 다르다. 각 테스트도 거의 같은 케이스 표를 따로 들고 있다(`test_is_nerv_mirror` 의 7개, 프런트 `inNervMirror` 의 9개). NERV 키 형식이 바뀌면 세 곳을 손으로 맞춰야 하며 어긋나도 각 스위트는 초록이다. 주석도 서로를 가리키지 않는다(오케스트레이터와 프런트 주석은 pull.py 만 언급한다).
  - 제안: 같은 케이스 표 하나(JSON 등)를 파이썬과 TS 테스트가 함께 읽게 한다. 이 저장소가 이미 쓰는 교차 언어 결속 테스트(`test_mermaid_lint_ready` 의 ConsumerBindingTest) 형태로 묶어도 된다. 최소한 세 정의의 주석에 나머지 두 곳의 위치를 적는다.

- **[WARNING]** 오케스트레이터 회귀 테스트가 "미러가 실제로 트리에 있다" 를 확인하지 않아 공허하게 통과할 수 있다
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:978` · `:979`
  - 상세: 공허 방지 단언은 `heads` 가 비어 있지 않은지만 본다. 미러가 없어도 옛 트리 헤더는 나오므로 `spec/CLE-` 로 시작하는 헤더가 0개라는 단언이 그대로 통과한다. 이 테스트는 `ROOT = REPO_ROOT`(실제 저장소)를 쓴다. D3 로 미러가 부분 스냅샷이 되거나 `--all` 이 prune 하면 미러가 사라질 수 있다. 같은 PR 의 형제 테스트는 이 점을 지킨다(`test_nerv_mirror_pull.py:322` 는 미러 존재를 먼저 단언하고 프런트 `spec-link-integrity.test.ts:82-85` 도 그렇다). 다만 프런트는 `spec/CLE-VISION.md` 라는 키 하나에 묶여 있어서 그 키가 NERV 에서 바뀌거나 빠지면 제외 로직과 무관하게 깨진다.
  - 제안: 파이썬 쪽에 `glob(ROOT/spec/CLE-*.md)` 가 비어 있지 않다는 사전 단언을 더한다. 프런트는 특정 키 대신 `spec/CLE-*.md` 하나 이상을 찾는 방식으로 바꾼다.

- **[INFO]** 훅 docstring 의 핵심 규칙 문장이 깨져 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11`
  - 상세: "막는 경로는 전환 단계를 따라 는다." 동사가 빠져 있다("늘어난다" 로 보인다). 이 문단은 단계 2와 3에서 `review/` · `plan/` 을 언제 더하는지 알려 주는 유일한 설명이라 다음 유지보수자가 반드시 읽는다.
  - 제안: "막는 경로는 전환 단계를 따라 늘어난다." 로 고친다.

- **[INFO]** `Nerv.get` 이 파싱한 응답 헤더를 호출부 4곳이 모두 버린다
  - 위치: `.claude/tools/nerv-mirror/pull.py:234` ~ `:241` (호출부 `:284`, `:298`, `:303`, `:322`)
  - 상세: 헤더 파싱 7줄과 3-튜플 반환이 죽은 코드다. ETag 는 응답 헤더가 아니라 받은 바이트의 sha256 으로 직접 계산한다(`:129`). `-D -` 출력을 `\r\n\r\n` 한 번으로 나누는 가정도 쓰지 않는 기능에 위험만 더한다.
  - 제안: `(status, body)` 만 반환한다. 쓸 계획이 있다면 그 소비처를 만든다.

- **[INFO]** `cmd_task` 가 여러 책임을 한 함수에 담고 상태 검사와 URL 이 반복된다
  - 위치: `.claude/tools/nerv-mirror/pull.py:296` ~ `:331`
  - 상세: 트리 조회, 클레임에서 scope 키 추출, ETag 조회, md 요청, 파일 쓰기가 한 함수(약 35줄)에 있다. `if status != 200: raise SystemExit(f"pull: … 응답 {status}")` 가 4번 반복된다(`:286`, `:299`, `:304`, `:327`). API 경로 문자열도 5곳에 흩어져 있으며 접두가 `/api/`(`:285`, `:323`)와 `/api/v1/`(`:298`, `:303`)로 섞여 있다. 의도라면 이유가 어디에도 적혀 있지 않다. 테스트의 `FakeNerv` 는 `endswith` 로만 맞추기 때문에 접두 오타를 못 잡는다. 오류 방식도 `RuntimeError`(`:233`)와 `SystemExit` 이 섞여 있다.
  - 제안: `Nerv` 에 `get_ok(path)` 와 경로 빌더(`export_url`, `tree_url`, `md_url`)를 둔다. 클레임 scope 추출과 문서 1편 조회는 작은 함수로 뺀다. 접두가 다른 이유를 한 줄 적는다.

- **[INFO]** `is_excluded` 는 겹치는 두 조건을 설명 없이 이어 붙였고 "영역 문서는 자기 폴더" 규칙이 세 곳에 따로 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:73` ~ `:75`, `:190`, `:206` ~ `:209`, `:265`
  - 상세: `is_excluded` 는 (영역 또는 키)가 제외 목록에 있거나 키가 `제외영역-` 로 시작하면 제외한다. 실측으로 `CLE-C24-Z`(영역 `CLE-ACCT`)도 제외됨을 확인했다. docstring 이 없어서 두 조건의 역할을 읽어서는 알 수 없다. 영역 문서의 폴더 규칙은 `docs_from_zip`(zip 경로 깊이), `area_map`(type == "area" 이면 자기 키), `check`(같은 판정을 다시)에 각각 구현돼 있다. 규칙이 바뀌면 세 곳을 함께 고쳐야 한다.
  - 제안: `is_excluded` 에 두 조건의 의미를 주석으로 적는다. 폴더 결정은 한 함수로 모은다.

- **[INFO]** pull.py 의 매직 값이 이름 없이 남아 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:98`(`[:5]`), `:229` ~ `:230`(`--max-time 120`, UA 문자열), `:190`(`len(parts) == 3`), `:380`(`parents[3]`)
  - 상세: `[:5]` 는 docstring 의 "본문 첫 인용 줄" 보다 넓은 범위를 조용히 훑는다. `len(parts) == 3` 은 더 깊은 zip 경로를 영역 없음(`None`)으로 흘려보내 루트에 잘못 배치한다. `parents[3]` 은 파일 위치에 의존한다.
  - 제안: `SOURCE_LINE_SCAN_LINES`, `HTTP_TIMEOUT_SECONDS` 같은 상수로 이름을 붙인다. 깊이가 3이 아닌 zip 경로는 오류로 알린다.

- **[INFO]** CLI 인자 표기가 헷갈리며 모드에 안 맞는 옵션은 조용히 무시된다
  - 위치: `.claude/tools/nerv-mirror/pull.py:373`, `:375`
  - 상세: `--task` 는 Task 키(`CLE-T-…`)를 받는데 metavar 가 `KEY` 이고 스펙 키를 받는 `--spec` 도 `KEY` 다. `--spec` 은 `--task` 와만 쓸 수 있고 `--basis` · `--from-zip` 은 `--all` 전용인데 맞지 않는 모드에서 써도 오류 없이 무시된다.
  - 제안: metavar 를 `TASK` 로 바꾼다. 모드에 안 맞는 옵션 조합은 `parser.error` 로 거절한다.

- **[INFO]** 훅에 도달할 수 없는 분기와 표기 불일치가 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:62`, `:70`, `:75` ~ `:78`, `:40`, `:107` ~ `:109`
  - 상세: `checkout_root` 는 `path` 의 조상에서 루트를 찾으므로 `relative_to` 는 실패할 수 없다. `except ValueError` 는 죽은 분기다. 같은 파일에서 `_read_payload` 와 `_target` 은 비공개 이름인데 `checkout_root` 와 `owned_root` 는 공개 이름이다(테스트는 서브프로세스로만 부른다). `import traceback` 이 except 안에 있는 점도 기존 훅(파일 상단 import)과 다르다. `_read_payload` 는 이제 훅 8개 파일에 복사돼 있다. 기존 관례이고 `_lib` 도 있지만 이 훅은 표준 라이브러리만 쓰는 편을 택했다.
  - 제안: `try/except ValueError` 를 없애고 이름 규칙을 통일한다. `_read_payload` 를 `_lib` 로 모으는 일은 별도 정리로 둬도 된다.

- **[INFO]** 단계 번호와 결정 번호의 정의가 저장소 안에 없다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:199`("단계 4e"), `.claude/tests/test_consistency_bundle_priority.py:961`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:254`("단계 5"), `.claude/tools/nerv-mirror/pull.py:11` ~ `:17`("결정 D1·D3·D4")
  - 상세: 단계 1~3 은 훅 docstring(`:13` ~ `:15`)이 정의하지만 4e · 5 와 D1·D3·D4 는 어디에도 없다. plan/ 이 사라지는 흐름이라 나중에 읽는 사람이 근거를 찾을 곳이 없다.
  - 제안: 단계와 결정이 정의된 NERV 키(Task 또는 스펙)를 한 번 적는다.

- **[INFO]** 미러 pull 테스트 스위트에 사소한 중복과 결합이 있다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:92` ~ `:95`, `:121` ~ `:123`, `:212` ~ `:222`, `:247` ~ `:254`, `:305` ~ `:323`
  - 상세: `pull_all(*extra)` 의 `extra` 는 어느 호출도 넘기지 않는다. `test_second_pull_writes_nothing` 은 `cmd_all` 의 배선(`{d.key: d.relpath …}`)을 그대로 다시 짠다. 같은 맵이 `pull.py:289` 와 이 파일 `:258` 에도 있으니 `paths_of(docs)` 로 뽑을 만하다. `_run` 은 `pull.load_env` 를 직접 바꿨다가 되돌리는데 harness 테스트 13개 파일은 `unittest.mock.patch` 를 쓴다. `FakeNerv` 는 URL 을 문자열 분해로 읽는다(`:218`). `CiWiringTest` 는 `spec-link-checks.yml` 의 잡을 보는데 같은 워크플로를 지키는 `test_spec_link_checks_scope.py` 가 따로 있다.
  - 제안: 미사용 인자를 지운다. `mock.patch.object` 로 바꾼다. 워크플로 배선 검사는 `test_spec_link_checks_scope.py` 로 옮길지 검토한다.

- **[INFO]** 새 CI 잡의 "생략" 메시지가 실제 실행 조건보다 범위를 좁게 적었다
  - 위치: `.github/workflows/spec-link-checks.yml:133`
  - 상세: `spec-mirror-integrity` 는 공유 `changes` 잡의 pathspec(`codebase/**`, `plan/**`, `*.md`, `.claude/**`, `spec/**` 등)을 그대로 쓰므로 codebase 만 바뀌어도 돈다. 그런데 생략 메시지는 "spec · .claude 경로 변경 없음" 이라고 한다. 형제 잡의 메시지는 공유 pathspec 과 맞다(`:103`). 워크플로 상단 주석(`:1` ~ `:32`)도 여전히 docs 가드만 설명한다.
  - 제안: 메시지를 형제 잡과 같은 범위로 고치거나 이 잡 전용 pathspec 을 둔다. 상단 주석에 새 잡 한 줄을 더한다.

- **[INFO]** CHANGELOG 가 훅의 적용 범위를 좁게 적었다
  - 위치: `CHANGELOG.md:34`
  - 상세: "Write · Edit 로 `spec/` 을 고치려 하면 막는다" 라고 썼지만 훅과 배선 테스트는 `MultiEdit` · `NotebookEdit` 까지 네 도구를 막는다.
  - 제안: "편집 도구(Write · Edit · MultiEdit · NotebookEdit)" 로 고친다.

### 요약
구조는 전반적으로 건강하다. 가드 훅은 짧고(110줄) 단일 책임이다. pull.py 는 함수가 대체로 짧으며 결정적 출력과 무결성 검사를 분리해 두었다. 테스트는 실측 근거와 공허 방지 장치를 갖췄다. 눈에 띄는 약점은 두 가지다. 하나는 "미러 경로" 판정이 파이썬, TS, pull.py 에 따로 있고 서로 묶는 테스트가 없어서 NERV 키 규칙이 바뀌면 조용히 어긋날 수 있다는 점이다. 다른 하나는 오케스트레이터 회귀 테스트가 미러 존재를 확인하지 않아 공허하게 통과할 수 있다는 점이다. 나머지는 죽은 헤더 파싱, `cmd_task` 의 반복, 이름 없는 매직 값, 정의 없는 단계 번호, 훅 docstring 의 깨진 문장 같은 정리 수준이다. 어느 것도 동작을 해치지 않는다.

### 위험도
LOW
