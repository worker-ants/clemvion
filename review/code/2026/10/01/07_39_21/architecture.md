# 아키텍처(Architecture) 리뷰 — NERV 정본 전환 단계 1 라운드 2

범위는 `d82040273..8a45684cd`(단계 1 코드 전체)다. 라운드 1 SUMMARY 와 아키텍처 리포트를 먼저 읽고, 지적이 닫혔는지와 수정이 새 결함을 만들었는지를 봤다. 실험은 전부 scratch(`/private/tmp/claude-501/.../review-scratch-r2/architecture/`)에서 했다. 저장소 트리는 바꾸지 않았고 `git status --short` 에는 리뷰 산출 디렉터리만 보인다. `test_nerv_mirror_pull.py` · `test_guard_nerv_owned_paths.py` 는 `-p no:cacheprovider`, `PYTHONDONTWRITEBYTECODE=1` 로 돌려 58건 통과를 확인했다.

## 라운드 1 지적의 종결 상태

| 라운드 1 항목 | 상태 | 근거 |
| --- | --- | --- |
| W 304 단축이 링크 재작성 입력을 캐시 키에 안 넣음 | **부분 종결** | 이번 실행에서 받는 문서는 원문 캐시로 다시 렌더한다. 받지 않는 문서는 그대로다(발견사항 1) |
| W 문서가 말하는 CI 보장이 `check()` 범위보다 넓음 | 종결 | 지문이 `mirror_sha256` 줄을 뺀 파일 전체로 넓어졌고, 훅 docstring · 워크플로 주석 · `pull.py` docstring 이 추가 · 삭제 · 옛 트리 셸 편집은 못 잡는다고 적는다 |
| INFO 미러 판정 세 곳에 결속 없음 | 종결(한계 있음) | `MirrorPredicateParityTest` 가 실제 `spec/` 에서 세 집합의 일치를 본다(발견사항 5) |
| INFO 훅 정책을 `_lib` 로 | **미반영** | 정책이 여전히 스크립트 안에 있다(발견사항 3) |
| INFO `cmd_task` 클라이언트 주입 | 종결 | `cmd_task(..., nerv=None, cache=None)` |
| INFO `spec-mirror-integrity` 잡의 no-op 문구 | 종결 | 문구와 헤더 주석이 공유 `changes` 판정을 설명한다 |
| W 거버넌스 문서와 훅의 순서 어긋남 | 미해소(발견사항 7) | 이 브랜치의 CLAUDE.md 는 아직 planner 의 `spec/**` 쓰기를 안내한다 |

## 발견사항

- **[WARNING]** 옮겨진 문서를 가리키는 링크가, 같은 실행에서 받지 않은 문서에서는 옛 자리로 굳고 `--check` 도 못 잡는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:410-454` (`cmd_task`), `:356-383` (`check`), `:32-34` · `:44-46` (docstring)
  - 상세: 라운드 1 경고의 수정은 이번 실행의 `keys` 에 든 문서만 304 여도 다시 렌더한다. 미러 169편의 상대 `.md` 링크는 5,895개로 촘촘하고, D3 때문에 `--task` 는 한 번에 몇 편만 받는다. 그래서 문서 B 가 NERV 에서 다른 영역으로 옮겨진 뒤 B 만 받으면 B 를 가리키는 다른 문서 A 들은 그대로 남는다. scratch 사본(실제 미러 복사본)에서 재현했다. `CLE-ACCT-DATA` 를 `CLE-ACCT` 에서 `CLE-AI` 로 옮겨 그 문서만 `apply` 하니 `written: CLE-AI/CLE-ACCT-DATA.md`, `removed: CLE-ACCT/CLE-ACCT-DATA.md` 가 나왔다. `CLE-ACCT/CLE-ACCT-PROFILE.md` 등 세 문서의 링크는 `](CLE-ACCT-DATA.md)` 로 남아 더는 없는 파일을 가리켰고 `check()` 는 `[]` 였다. 옛 트리 링크 가드는 미러를 제외하므로(`inNervMirror`) 이 부패를 잡는 층이 없다. 부분 스냅샷이라 「대상 파일이 아직 없는 링크」는 의도지만, 이것은 있던 파일이 사라진 거짓 경로다. 커밋 메시지의 「다른 문서가 옮겨지면 링크가 따라간다」는 받은 문서에만 성립하는 문장이라 보장이 구현보다 넓다.
  - 제안: `--check` 에 오프라인 규칙 하나를 더한다. 「상대 링크의 대상 파일이 그 자리에 없는데 같은 키의 미러 파일이 다른 자리에 있으면 문제」다. 부분 스냅샷에서도 성립하는 형태라 「아직 안 받은 문서」는 걸리지 않는다. 실제 미러 169편에 이 규칙을 돌리면 5,895개 링크 중 위반이 0개라(`probe_links.py`, 끊긴 링크 0 · 「다른 자리에 존재」 0) 지금 켜도 오탐이 없다. 규칙을 넣지 않으면 `pull.py` 의 「보장 범위」 절에 「이번 실행에서 받지 않은 문서의 링크는 갱신되지 않는다」를 적는다.

- **[INFO]** `Nerv` 의 https 강제가 접두 비교라 닮은 호스트를 통과시킨다
  - 위치: `.claude/tools/nerv-mirror/pull.py:306`
  - 상세: `server.startswith(("http://127.0.0.1", "http://localhost"))` 는 포트 · 경로 구분자를 보지 않는다. scratch 사본에서 `http://localhost.evil.com` 과 `http://127.0.0.1.evil.com` 이 둘 다 통과했다(`example.com` 은 거부). 토큰이 평문 http 로 나간다는 이 검사의 목적이 닫히지 않는다. `NERV_SERVER` 는 사용자 본인의 `settings.local.json` 에서 오므로 실위협은 낮다. 이 검증을 생성자 경계에 둔 구조는 맞다.
  - 제안: `urllib.parse.urlsplit` 으로 scheme 과 `hostname` 을 따로 비교한다(`https` 이거나, `http` 이고 hostname 이 `127.0.0.1` · `localhost` 와 같을 때만). 보안 관점 리뷰어가 같은 줄을 볼 것이다.

- **[INFO]** 훅 정책이 스크립트에 남아 있고, 훅의 `MARKER` 는 실제 저장소와 묶는 테스트가 없다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:43-47` (`MARKER` · `OWNED_ROOTS`), `:73-91` (`checkout_root` · `owned_root`), `.claude/tests/test_guard_nerv_owned_paths.py:37` (`MARKER` 재선언), `:171`
  - 상세: 형제 훅 `guard_default_branch_edit.py` 는 스크립트를 얇게 두고 정책을 `_lib/branch_guard.py` 에 둔다. 새 훅은 그렇지 않아 테스트가 서브프로세스로만 돌고 `owned_root` 를 단위로 못 붙인다. 더 실질적인 문제는 표지 경로가 훅과 테스트에 각각 적혀 있고, 테스트는 임시 저장소에 자기가 선언한 `MARKER` 를 심어 쓴다는 점이다. 도구 폴더가 이름을 바꿔 `pull.py` 가 옮겨지면 `test_nerv_mirror_pull.py` 의 `PULL_SRC` 만 고쳐져 초록이 되고, 훅은 표지를 못 찾아 fail-open 으로 실제 저장소 `spec/` 을 조용히 열어 둔다. 171행의 `present = run(_harness.REPO_ROOT)` 도 대상은 임시 저장소 경로라 실제 저장소의 표지를 보지 않는다. 실제 `spec/CLE-VISION.md` 를 훅에 넣으면 exit 2 가 나오는 것은 직접 확인했다(지금은 맞다).
  - 제안: 정책을 `_lib/nerv_owned_paths.py` 로 옮기고 테스트가 거기서 `MARKER` 를 import 한다. 테스트 한 건을 더해 `(REPO_ROOT / MARKER).is_file()` 과 「실제 저장소 `spec/` 경로가 exit 2」를 단언한다. `_read_payload` 는 이 훅이 8번째 사본이지만 공용화는 별도 정리로 미뤄도 된다.

- **[INFO]** `test ! -f … || python3 …` 는 이 훅만의 땜질이고, 뿌리의 구조는 다음 훅에도 그대로다
  - 위치: `.claude/settings.json:38`
  - 상세: 원인은 등록(워크트리의 `settings.json`)과 실행 파일(하네스가 `$CLAUDE_PROJECT_DIR`, 즉 main checkout 에서 찾음)이 서로 다른 체크아웃에서 온다는 것이다. 이 PR 이 그 증상을 실제로 겪었고 형태는 맞게 고쳤다(파일이 없으면 통과, 있으면 exit 2 를 `test_registered_command_passes_when_the_hook_file_is_missing` 가 양쪽 다 고정). 다만 새 훅을 등록하는 다음 PR 이 같은 함정에 다시 빠진다는 사실이 어디에도 기록돼 있지 않다. 이 형태는 차단 가드를 영구히 fail-open 으로 만드는 대가도 있다. 그 대가는 위 테스트가 막아 주지만(실제 저장소에서 파일이 사라지면 RED) 이유가 코드 밖에 있다.
  - 제안: 훅 신설 시 등록 명령에 파일 존재 검사를 붙인다는 규칙을 `worktree-policy.md` 의 훅 절에 적는다(거버넌스 문서라 planner 턴). 구조 테스트로 「`settings.json` 이 부르는 훅 파일이 main 에 없을 때 어떻게 되는지」를 훅 전체에 일반화하는 것은 과하다. 기록만으로 충분하다.

- **[INFO]** 「미러를 어느 가드가 여전히 보는가」가 가드마다 흩어져 있고, 일치 테스트는 실제 데이터만 본다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-267`, `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` (`SCAN_ROOTS = ["plan", "spec"]`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205` · `:806-807`, `.claude/tests/test_nerv_mirror_pull.py:585-620`
  - 상세: 제외는 `collectSpecMarkdown` 한 곳(`inNervMirror`)과 오케스트레이터 후처리 필터로 구현됐다. 영역 폴더만 보는 `collectApplicableSpecs` 는 `INCLUDE_PREFIXES` 덕에 미러를 애초에 안 본다. 그런데 `stray-tool-tags.test.ts` 는 `walkTree` 로 `spec/` 전체를 직접 훑어 미러 170편을 대상에 그대로 둔다. 지금 통과하고(커밋 메시지의 3,711건) 의도된 선택일 수 있지만, 그 결정 흔적이 없다. 미러 문서에서 위반이 나오면 훅이 편집을 막으므로 고치는 길이 「NERV 에서 고치고 pull」뿐이다. 세 판정의 일치 테스트(`test_three_predicates_agree_on_the_real_tree`)는 실제 트리만 본다. 그래서 설계상 갈라지는 모양이 고정되지 않는다. 예를 들어 `spec/CLE-ACCT/notes.md` 는 TS · 오케스트레이터에서 「미러」(접두 `CLE-ACCT/`)이고 `pull.mirror_files` 에서는 아니다(키 형식이 아닌 줄기). 이런 파일은 링크 가드에서도 지문 검사에서도 빠진다. 추가는 어느 층도 안 본다고 이미 문서에 적혀 있어 한계 자체는 맞게 적혔다.
  - 제안: `stray-tool-tags.test.ts` 에 미러를 일부러 보는지 제외하는지 한 줄 적는다. 오케스트레이터 제외는 후처리 필터 대신 수집 함수의 skip 인자로 넣으면 세 호출부가 같은 필터를 쓴다(라운드 1 제안). 일치 테스트에는 합성 경로 몇 개(깊이 2, 비-키 줄기)를 더해 갈라지는 모양을 이름으로 고정한다.

- **[INFO]** `PullError(SystemExit)` 와 `RuntimeError` 가 섞여 오류 분류가 일관되지 않다
  - 위치: `.claude/tools/nerv-mirror/pull.py:85-89`, `:103-108` (`mirror_relpath`), `:321` · `:337` (`RuntimeError`), `:377-380` (`check` 의 `except PullError`)
  - 상세: 순수 함수(`mirror_relpath` · `area_map` · `docs_from_zip`)가 프로세스를 끝내는 `SystemExit` 하위 클래스를 던진다. `check()` 가 `except PullError` 로 그것을 잡는 것은 서브클래스라 동작하지만, 이 모듈을 불러 쓰는 다음 호출자는 `except Exception` 으로는 못 잡는다. curl 실패 · HTTP 해석 실패는 `RuntimeError` 라 사용자에게 traceback 이 나가고, 키 · 경로 검증 실패는 깔끔한 한 줄로 끝난다. 지금은 CLI 와 테스트만 쓰므로 영향은 작다.
  - 제안: `PullError(Exception)` 으로 바꾸고 `main()` 에서 한 번 잡아 `SystemExit` 로 바꾼다. curl · 해석 실패도 `PullError` 로 통일한다. 테스트의 `assertRaises(SystemExit)` 는 `PullError` 로 바꾼다.

- **[INFO]** 짝 planner PR 의 머지 순서 결합이 강제되지 않는다(라운드 1 경고의 잔존)
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:16-17` (「먼저 막으면 문서가 시키는 일을 훅이 막는다」)
  - 상세: 이 브랜치의 `CLAUDE.md` 와 planner SKILL 은 아직 `spec/**` 쓰기를 안내한다. 짝 브랜치 `claude/nerv-cutover-1-docs-c46df0` 는 워크트리로 존재하지만 `origin/main`(최신 `2df5c3373`)에는 없다. 이 PR 이 먼저 머지되면 훅이 스스로 세운 규칙을 어긴다. 차단 메시지가 `/nerv:spec edit` 를 안내하므로 최악이 마찰 수준이라 INFO 로 둔다. 머지 순서는 작업 명세에만 있고 어떤 게이트도 보지 않는다.
  - 제안: PR 본문 첫 줄에 머지 순서를 적는다. 두 PR 이 같은 창에 머지되지 않으면 훅 등록 줄만 짝 PR 뒤로 미룬다.

- **[INFO]** 합의가 문서에만 있는 두 곳: `paths_for` 의 주석과 `--task` 캐시의 공유
  - 위치: `.claude/tools/nerv-mirror/pull.py:278-281` (`paths_for`), `:396` (`cmd_all`), `:415` (캐시 경로)
  - 상세: `paths_for` 는 「`--all` 과 `--task` 가 같은 규칙으로 링크 대상을 만든다」고 적지만 `cmd_all` 은 그것을 부르지 않고 `{d.key: d.relpath}` 를 직접 만든다. 규칙은 `mirror_relpath` 로 같지만 입력이 다르다(내려받은 문서 대 트리 전체). `test_area_map_matches_the_export_layout` 이 합성 fixture 로만 묶는다. 또 워크트리에서 `.nerv` 가 main 의 `.nerv` 로 가는 심볼릭 링크라(`.gitignore` 의 `.nerv`) `.nerv/cache/mirror` 는 모든 세션이 공유한다. 캐시가 내용 해시(`etag` 대조)로만 쓰여 공유해도 안전하지만(다른 버전이면 조건부 요청을 생략하고, 읽다 끊긴 바이트도 해시가 틀려 같은 경로를 탄다) 이 성질이 어디에도 적혀 있지 않다. 기본 캐시 경로(`spec_root.parent / CACHE_DIR`)는 테스트가 `cache=` 를 직접 줘서 고정하지 못한다. `git check-ignore -v .nerv/cache/mirror/CLE-X.md` 는 `.gitignore:49` 로 무시됨을 확인했다.
  - 제안: `paths_for` 주석을 「같은 `mirror_relpath` 규칙」으로 고치거나 `cmd_all` 도 `paths_for` 를 쓰게 한다. 캐시 절에 「내용 해시로만 쓰므로 세션 간 공유가 안전하다」를 한 줄 적는다.

- **[INFO]** 단계 1 ~ 4e 사이 consistency 코퍼스는 동결된 옛 트리만 본다(코드 주석에만 있음)
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205`
  - 상세: 이 PR 부터 스펙 수정은 NERV 에서만 일어나는데 `related_specs` · `conventions` 는 동결된 옛 트리만 담는다. 미러로 옮기는 일은 단계 4e 로 미뤄 뒀다고 주석에 있다. 그 사이 `--impl-prep` 이 읽는 배경 코퍼스는 NERV 와 점점 어긋난다. 의도된 이월이고 「예산을 두 번 쓰지 않는다」는 근거도 실측이라 지금 고칠 일은 아니다.
  - 제안: `consistency-checker` SKILL 에 「단계 4e 전까지 코퍼스는 옛 트리다」를 적는다(거버넌스 문서라 planner 턴).

## 요약

단계 1 의 구조 방향은 맞다. 미러를 쓰는 주체가 도구 하나이고 도구 편집은 훅이, 나머지는 CI 가 받는 3층 방어는 문서가 말하는 보장과 실제 범위가 이제 맞는다(지문 범위 확대와 「추가 · 삭제는 못 잡는다」 명시). 라운드 1 경고 둘 중 하나(CI 보장 범위)는 완전히 닫혔고 다른 하나(304 링크 부패)는 받은 문서에만 닫혔다. 그 잔여가 이번의 유일한 경고다. 실제 미러 복사본에서 문서 하나를 옮겨 그 문서만 받자 인바운드 링크 세 개가 사라진 경로를 가리켰고 `--check` 는 통과했다. 같은 미러에서 5,895개 링크의 위반이 0개라 「대상이 그 자리에 없는데 같은 키의 파일이 다른 자리에 있다」를 `--check` 규칙으로 넣어도 오탐이 없다. 이번 라운드가 새로 만든 결함은 크지 않다. `http://localhost.evil.com` 이 https 강제를 통과하는 접두 비교(INFO)와 훅의 표지가 실제 저장소에 묶여 있지 않은 점(INFO)이 있다. 나머지 INFO 는 라운드 1 에서 안 닫힌 구조 정리(훅 정책 `_lib` 이동, 오류 분류, 제외 정책의 산재)와 머지 순서 결합이다. 순환 의존은 없고 레이어 경계(하네스 도구 · 훅과 codebase 테스트 헬퍼)도 지켜졌다.

## 위험도
LOW
