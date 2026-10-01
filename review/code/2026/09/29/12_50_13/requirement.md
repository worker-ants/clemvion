# 요구사항(Requirement) 리뷰 — NERV 스펙 미러 도입 (전환 단계 1)

## 발견사항

- **[WARNING]** 훅은 `spec/` 쓰기를 막는데 거버넌스 문서는 아직 그 쓰기를 시킨다 (훅 docstring 이 스스로 세운 순서 규칙과 어긋남)
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11-13`, `:34-37`
  - 상세: docstring 은 "거버넌스 문서가 그 경로의 쓰기를 더는 안내하지 않을 때 더한다 — 먼저 막으면 문서가 시키는 일을 훅이 막는다" 고 적는다. 그런데 이 변경에는 `CLAUDE.md` · `.claude/skills/**/SKILL.md` 갱신이 없다. `CLAUDE.md` 의 역할 표는 `project-planner` 의 쓰기 권한을 `spec/**` 으로 두고 developer 의 "자기-반증형 소정정" 도 `spec/` 직접 수정을 허용한다. `project-planner/SKILL.md` L14 · L22 · L36 도 `spec/` Read/Write 를 주 작업으로 안내한다. 병합 직후부터 planner 의 정상 흐름과 developer 의 소정정이 모두 훅에 막히고 `BYPASS_NERV_OWNED_PATHS=1` 만 남는다. 이 저장소의 거버넌스 문서는 `project-planner` 소유라 별도 PR 일 수 있으나 그 후속이 plan 이나 커밋 본문에 명시돼 있지 않다.
  - 제안: 같은 릴리스 창에 planner 턴으로 CLAUDE.md 와 planner/developer SKILL 의 `spec/` 안내를 NERV 초안 흐름으로 바꾼다. 늦어지면 후속 작업을 plan 에 못 박고 훅 docstring 에 "문서 갱신 대기 중" 을 적는다.

- **[WARNING]** `pull.py --all` 이 빈 export 를 받으면 미러 전체를 지우고 성공(exit 0)으로 끝난다
  - 위치: `.claude/tools/nerv-mirror/pull.py:183-195`, `:279-293`, `:169-174`
  - 상세: `docs_from_zip` 은 `specs/` 아래 문서가 없으면 `[]` 를 돌려준다. `apply(..., prune=True)` 는 `mirror_files()` 전부를 삭제한다. scratch 에서 `manifest.json` 만 든 zip 으로 재현했다(잔존 미러 0편, rc 0, README 는 다시 씀). 레이아웃 파라미터가 바뀌었거나 기준이 어긋난 200 응답에서 그대로 일어난다. 이 상태에서 `--check` 는 "미러 0편 · 문제 0" 으로 통과하므로 CI 도 잡지 못한다. 저장소 테스트 `test_the_repo_mirror_passes_its_own_check` 만 비어 있음을 본다.
  - 제안: `docs` 가 비었거나 기존 미러 대비 급감하면 `SystemExit` 로 중단한다. `--check` 도 미러가 0편이면 실패로 본다.

- **[WARNING]** `docs_from_zip` 이 zip 항목 이름을 검증하지 않아 `spec/` 밖에 쓰거나 검사망 밖 파일을 만든다
  - 위치: `.claude/tools/nerv-mirror/pull.py:187-194`, `:68-70`
  - 상세: `specs/../CLE-EVIL.md` 는 `area=".."` 로 읽혀 `relpath` 가 `../CLE-EVIL.md` 가 되어 `spec/` 밖에 쓴다(probe 확인). `KEY_RE` 를 통과하지 못하는 key 나 area 로 만든 파일은 `mirror_files()` 가 보지 못한다. 이후 prune 과 `--check` 대상에서도 영구히 빠진다. 출처가 인증된 NERV 서버라 위협은 낮다. 그래도 "입력 데이터 유효성" 관점에서 한 줄 방어가 빠졌다.
  - 제안: `KEY_RE.match(key)` 와 `area is None or KEY_RE.match(area)` 를 요구하고 어긋나면 그 항목을 건너뛰지 말고 오류로 중단한다.

- **[WARNING]** 문서가 약속한 CI 보장(셸 · 손 편집을 잡는다)이 `--check` 구현보다 넓다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:21-22`, `.claude/tools/nerv-mirror/pull.py:255-274`, `.github/workflows/spec-link-checks.yml` 의 `spec-mirror-integrity` 주석, `CHANGELOG.md` 신규 항목
  - 상세: `check()` 는 본문 sha256 과 `id`·`area` 위치만 본다. scratch 에서 세 가지를 동시에 만들어 `check()` 결과가 `[]` 인 것을 확인했다. (1) frontmatter 편집(`type: "feature"` → `"vision"`), (2) 미러 파일 삭제, (3) `CLE-*` 폴더 안 `KEY_RE` 밖 파일과 `CLE-STRAY/` 같은 임의 폴더. 본문과 `mirror_sha256` 을 함께 고친 편집도 통과한다(지문이 자기 자신이 든 파일에 있다). README 만 "본문 지문" 이라고 정확히 적었다. 훅 docstring · CHANGELOG · CI 주석은 "셸 편집 구멍은 CI 가 막는다" 로 더 넓게 쓴다.
  - 제안: 문구를 "본문 편집과 파일 이동" 으로 낮추거나 검사를 넓힌다(`CLE-*` 아래 비-미러 파일 경고, frontmatter 의 `id`·`type`·`area` 를 지문에 포함, 매니페스트 도입). 삭제 탐지는 export 대조 같은 별도 수단이 필요하다.

- **[WARNING]** `--task` 기본 경로가 실측하지 않은 NERV 응답 모양에 기대며 테스트 fixture 가 그 가정을 그대로 만든다
  - 위치: `.claude/tools/nerv-mirror/pull.py:298`, `:303-307`
  - 상세: 커밋 본문의 실측 목록은 export 배치 · ETag · 결정성이다. `GET /tasks/{id}` 의 `claims[].status`·`scope_spec_ids` 는 없다. 저장소 어디에도 이 필드 모양의 기록이 없다. fixture 는 `scope_spec_ids` 를 **key**(`"CLE-ACCT-SESSION"`)로 채운다. 같은 fixture 의 트리 노드는 `id`(`id-CLE-…`)와 `key` 를 따로 가진다. 실제 `scope_spec_ids` 가 노드 `id` 이면 `key not in areas` 로 매번 "NERV 에 없는 키" 종료가 된다. 그러면 결정 D3 의 기본 사용법(`--task <CLE-T-…>`)이 통째로 동작하지 않는다. 또 트리 · task 는 `/api/v1/projects/…`, export · md 는 `/api/projects/…` 로 접두가 갈리는데 이 불일치의 근거도 적혀 있지 않다.
  - 제안: 실제 클레임 응답으로 한 번 실측하고 그 결과를 docstring 에 적는다. 안전하게는 `by_id` 로 id → key 를 함께 해석한다(`areas` 의 키와 트리 `id` 둘 다 받는다).

- **[INFO]** 훅이 대소문자 무시 파일시스템과 심볼릭 링크 별칭을 통과시킨다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:79-80`, `:64-67`
  - 상세: `Spec/x.md` · `SPEC/x.md` 는 exit 0 이고 심볼릭 링크 `alias -> spec` 경유도 exit 0 이다(scratch probe). 이 저장소가 있는 볼륨은 case-sensitive APFS 라 지금 환경에서는 무해하다. macOS 기본(case-insensitive) 이나 Windows 체크아웃에서는 우회가 된다.
  - 제안: `first.casefold() in OWNED_ROOTS`. 심볼릭 링크는 `.git` 탐색 뒤 `Path.resolve()` 로 다시 상대 경로를 구하는 방안을 검토한다(우선순위 낮음).

- **[INFO]** 훅 docstring 문장이 깨져 있다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:11`
  - 상세: "막는 경로는 전환 단계를 따라 는다." 는 동사가 빠졌다("늘어난다" 로 읽힌다).
  - 제안: 문장을 고친다.

- **[INFO]** `--task` 는 손상된 미러 파일을 스스로 복구하지 못한다
  - 위치: `.claude/tools/nerv-mirror/pull.py:317-321`
  - 상세: 기존 파일의 frontmatter 가 깨져 있으면 `split_frontmatter`/`json.loads` 예외가 그대로 올라와 traceback 으로 끝난다. 복구는 `--all` 뿐이다.
  - 제안: 읽기에 실패하면 `etag=None` 으로 취급해 새로 받아 덮어쓴다.

- **[INFO]** consistency 코퍼스에서만 미러를 뺐고 대상(target)은 그대로다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:806-807`, 대상 수집 `:743`, `:754`
  - 상세: `--impl-prep spec/CLE-ACCT/` 처럼 미러를 대상으로 주면 대상은 미러이고 대조 코퍼스는 동결된 옛 트리가 된다. 코드 주석이 "코퍼스를 미러로 옮기는 일은 단계 4e" 라고 명시하고 있어 의도된 보류로 본다.
  - 제안: 조치 없음. 4e 착수 전까지 이 조합의 결과는 참고용으로만 읽는다.

## 확인한 항목 (이상 없음)

- 훅: `spec/` 를 main checkout · 워크트리 · 상대 경로 · 4개 편집 도구 모두에서 차단한다. `codebase/**/spec/`(더 깊은 이름) · `specs/` · `review/` · `plan/` · 저장소 밖은 허용한다. 우회 env 와 빈/깨진 페이로드 fail-open 도 동작한다.
- 배선: `.claude/settings.json` 에 `Write|Edit|MultiEdit|NotebookEdit` 매처로 한 번 등록된다. `harness-checks.yml` pathspec 에도 등재돼 배선만 지우는 PR 에서 가드가 돈다.
- 오케스트레이터 `is_nerv_mirror` 정규식과 프런트엔드 `inNervMirror` 는 같은 모양이다. `spec/5-system/CLE-x.md`·`spec/conventions/README.md` 같은 옛 트리 경로는 잡지 않는다.
- CI `spec-mirror-integrity` 잡: `changes` pathspec 이 `spec/**` · `.claude/**` 를 포함해 미러나 도구 변경에서 실행된다. `!cancelled()` 규약은 `test_workflow_yaml_structure.py` 가 고정한다.
- 실행 결과: `.claude/tests` 전체 통과, 미러 `pull.py --check` 169편 문제 0.
- TODO/FIXME/HACK 없음. 이 변경을 정의하는 `spec/` 본문은 없다(하네스 변경). SPEC-DRIFT 해당 없음.
- 저장소 트리는 수정하지 않았다(probe 는 scratchpad 에서 돌렸고 `git status` 는 리뷰 산출 디렉터리만 untracked).

## 요약

훅 · 오케스트레이터 · 프런트엔드 제외 규칙 · CI 잡의 핵심 동작은 의도대로 구현돼 있고 테스트와 실측(169편 일치, 결정성)도 충족한다. 남는 위험은 세 갈래다. 첫째 훅이 `spec/` 를 막는 시점과 거버넌스 문서(CLAUDE.md · planner/developer SKILL)가 그 쓰기를 안내하는 상태가 어긋나 planner 흐름이 병합 직후 막힌다. 둘째 `pull.py` 의 입력 방어가 얇고(빈 export 전체 삭제, zip 이름 미검증) `--check` 의 실제 보장(본문 지문 · 위치)이 문서가 말하는 범위보다 좁다. 셋째 `--task` 의 기본 경로가 실측하지 않은 claim 응답 모양을 전제한다. 어느 것도 즉시 데이터 손상을 일으키는 결함은 아니다. 다만 둘째 갈래의 빈 export 삭제는 수동 동기화 도중 실제로 나올 수 있다.

## 위험도

MEDIUM
