# 요구사항(Requirement) 리뷰 — 라운드 2

범위는 NERV 정본 전환 단계 1 코드(`d82040273..ad8662bd5` 중 `de36badf7`, `8a45684cd` 의 코드)다. Task `CLE-T-VA4YA1` 명세와 라운드 1 SUMMARY 를 기준으로 봤다.

## 검증한 것

- `python3.11 -m pytest .claude/tests` 전체가 통과한다. 훅·pull 테스트는 58건, 서브테스트 31건이다.
- frontend `src/lib/docs/__tests__/` 전체가 통과한다(23파일, 3711건).
- `pull.py --check` 는 python3.11 과 시스템 python3.9 에서 모두 `미러 169편 · 문제 0` 이다. 훅도 3.9 에서 exit 2 로 막는다.
- 커밋된 미러의 상대 링크 5895개는 대상이 전부 실재한다. `CLE-*` 원문 링크가 남은 125개는 전부 카탈로그 키다(D4 와 R-12 기술과 일치).
- 훅 입력을 13가지 변형해 돌렸다. `..` · 대소문자 · 트레일링 슬래시 · 한글 파일명 · `input` 별칭은 기대대로 동작했고, 모양이 틀린 입력은 fail-open 이다.

## 라운드 1 경고 14건의 닫힘 여부

| 라운드 1 | 판정 | 근거 |
| --- | --- | --- |
| W1 경로 이탈 | 닫힘 | `KEY_RE` 검증, `is_relative_to`, 심볼릭 링크 거부, 거부 테스트가 있다. |
| W2 curl 설정 주입 | 닫힘 | `ETAG_RE` 와 `_curl_value` 가 있다. 다만 서버 주소 검증에 새 구멍이 있다(아래 W2). |
| W3 빈 export 삭제 | 닫힘 | 빈 export 중단, 절반 초과 삭제 중단, `--check` 0편 실패가 모두 있다. |
| W4 문서 순서 | 조건부 | 짝 planner PR(`0c3d549ed`)은 있으나 `origin/main` 에 아직 없다(`merge-base --is-ancestor` 실측). 머지 순서 전제가 남아 있다. |
| W5 보장 범위 | 닫힘 | 지문을 파일 전체로 넓혔고 서술도 맞췄다. 단 NERV spec 한 곳이 낡았다(아래 W3). |
| W6 304 링크 부패 | 닫힘 | 원문 캐시로 다시 렌더한다. `test_304_re_renders_links_when_a_target_moved` 가 고정한다. |
| W7 scope 실측 | 닫힘 | id 와 key 를 모두 푼다. docstring 에 실측이 있다. |
| W8 타 저장소 오탐 | 닫힘 | 표지 파일 검사와 테스트가 있다. |
| W9 판정 3곳 복제 | 부분 | 동치 테스트는 생겼으나 CI 트리거가 빠졌다(아래 W1). |
| W10~W14 | 닫힘 | 사전 단언, curl 경계 테스트, `..` 테스트, `PROJECT.md:392` 가 반영됐다. |

## 발견사항

- **[WARNING]** 세 곳 판정 동치 테스트(`MirrorPredicateParityTest`)의 CI 트리거가 빠져 있다.
  - 위치: `.github/workflows/harness-checks.yml:74-76`(이 PR 이 더한 항목), `.claude/tests/test_nerv_mirror_pull.py:596`(`TS = ROOT / "codebase" / ... / "spec-links.ts"`)
  - 상세: 이 테스트는 `spec-links.ts` 의 `NERV_MIRROR` 리터럴을 읽어 Python 두 판정과 같은 집합인지 본다. 그런데 `harness-checks.yml` 의 `pathspecs` 에는 `spec-links.ts`, `codebase/frontend/src/lib/docs/**`, `spec/**` 가 없다(grep 으로 `spec-links`, `spec/**` 0건 확인, `codebase/` 항목은 `tsconfig.typecheck.json` 과 `packages/*/package.json` 뿐). 그래서 `NERV_MIRROR` 만 고친 PR 은 `harness-checks` 가 no-op 으로 통과해 이 테스트가 돌지 않는다. `spec-link-checks` 는 프런트 테스트와 `pull.py --check` 만 돌린다. 이 파일이 여섯 번 겪었다고 적은 "가드가 지키는 파일이 단독 수정되면 가드가 안 돈다" 와 같은 클래스다. `test_harness_checks_paths_coverage.py` 가 잡지 못한 이유는 이 경로가 클래스 속성이어서다(그 가드는 모듈 수준 상수만 읽는다). 같은 PR 에서 `.claude/settings.json` 은 등재했는데 이 파일은 빠졌다.
  - 제안: 파일 단위로 `codebase/frontend/src/lib/docs/__tests__/spec-links.ts` 를 등재하고 이유를 주석으로 적는다. `.claude/settings.json` 항목과 같은 방식이다. `TS` 를 모듈 수준 상수로 올려 커버리지 가드가 읽게 하는 방법도 있다.

- **[WARNING]** `Nerv.__init__` 의 loopback 예외가 접두어 비교라서 "https 강제" 가 뚫린다. 토큰이 평문으로 나갈 수 있다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:306`
  - 상세: `server.startswith(("http://127.0.0.1", "http://localhost"))` 는 호스트 이름 전체를 보지 않는다. scratch 에서 돌려 보니 `http://localhost.evil.example`, `http://127.0.0.1.evil.example`, `http://localhostx` 가 모두 통과했다. 코드 주석은 "토큰이 평문으로 나간다" 를 이유로 든다. `NERV_SERVER` 는 사용자 로컬 설정이 주므로 공격 가능성은 낮고 오설정 방어가 목적이다. 그래도 명세(`https` 강제, loopback 만 예외)와 구현이 어긋난다. `test_plain_http_is_rejected` 는 `http://nerv.example.invalid` 하나만 본다. 스킴 대소문자도 구분해서 `HTTPS://…` 는 거부된다.
  - 제안: `urllib.parse.urlsplit` 로 스킴과 `hostname` 을 떼어 `hostname in {"127.0.0.1", "localhost", "::1"}` 로 비교한다. 위 세 문자열을 거부 테스트에 넣는다.

- **[WARNING][SPEC-DRIFT]** NERV 스펙이 미러 지문을 "본문 지문" 이라고 적었으나 구현은 파일 전체(frontmatter 포함)다.
  - 위치: `spec/CLE-ENG/CLE-ENG-SPECEVIDENCE.md:364`(Rationale R-12. "무결성은 미러 도구의 `--check`(본문 지문 `mirror_sha256` 과 파일 위치)로 본다")
  - 상세: 코드는 `mirror_sha256` 줄을 뺀 파일 전체를 지문으로 쓴다(`pull.py:163-166`, `:182`). frontmatter 손편집도 잡고 `test_frontmatter_edit_is_caught` 가 고정한다. 라운드 1 W5 가 요구한 방향이라 코드가 맞다. `spec/README.md` 와 CI 주석, CHANGELOG 는 이미 "본문 · frontmatter" 로 고쳐졌고, NERV 원문만 낡았다. 일부러 넓힌 동작이므로 코드를 되돌릴 일이 아니다.
  - 제안: 코드 유지. NERV 스펙 `CLE-ENG-SPECEVIDENCE` R-12 를 "파일 전체(frontmatter 포함, `mirror_sha256` 줄 제외)의 지문과 파일 위치" 로 고치는 초안을 NERV 에서 쓴다. `spec/` 미러는 손으로 고치지 않으므로 고친 뒤 `pull.py --task` 로 받는다.

- **[WARNING]** 동결한 옛 트리가 plan 라이프사이클 가드와 아직 묶여 있어서 훅이 가드가 요구하는 편집을 막는다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:44-47`(`OWNED_ROOTS`), `:16-17`("문서가 시키는 일을 훅이 막는다" 원칙)
  - 상세: 훅은 `spec/` 전체를 막고 옛 트리를 동결한다. 그런데 옛 트리 문서는 아직 빌드 가드의 대상이다. `spec-status-lifecycle` (c) 는 `pending_plans` 가 전부 `plan/complete/` 로 옮겨지면 `implemented` 로 승격하라고 강제한다. `spec-pending-plan-existence` 와 링크 규칙 17(`CLE-ENG-SPECEVIDENCE.md:184`)은 spec 이 가리키는 plan 경로가 실재해야 한다고 본다. 측정하니 옛 트리 문서 19개가 `pending_plans` 를 갖고, 34개가 `plan/in-progress/` 를 링크한다. `plan/in-progress/` 에 39건이 있다. 그중 하나라도 `complete/` 로 옮기면 옛 spec frontmatter·링크 수정이 필요한데 도구 편집이 막힌다. 남는 길은 `BYPASS_NERV_OWNED_PATHS=1` 뿐이고, 이 변수는 세션 환경변수라 호출 단위 우회가 아니다. 이 우회는 훅 stderr 와 CHANGELOG 에만 있고 `plan-lifecycle.md` 같은 거버넌스 문서에는 없다. 차단 메시지의 "NERV 초안으로 고친다" 도 이 경우에는 맞지 않는다. 의도한 동결의 부작용이라 단정하지 않고 경고로 둔다.
  - 제안: 다음 중 하나를 정한다. (a) planner 턴에서 `plan-lifecycle.md` 의 완료 이동 단계에 "옛 트리 spec 갱신이 필요하면 `BYPASS_NERV_OWNED_PATHS=1` 세션으로" 를 적는다. (b) 단계 3 전까지 옛 트리 가드 (c) 와 링크 규칙 17 을 미러와 같이 빼는 안을 NERV Task 에 올린다. (c) 그대로 두되 이 결합을 CHANGELOG 에 적는다.

- **[INFO]** 짝 planner PR 머지가 선행 조건이다. 지금은 충족되지 않았다.
  - 위치: `.claude/settings.json:36-39`, 브랜치 `claude/nerv-cutover-1-docs-c46df0`(`0c3d549ed`)
  - 상세: 훅은 main 을 pull 하는 순간부터 main 과 모든 새 워크트리에서 `spec/` 쓰기를 막는다. 현재 `CLAUDE.md` 는 project-planner 의 `spec/**` 쓰기를 안내한다. 짝 PR 은 커밋 메시지에서 시행 시점을 이 PR 머지로 못 박았지만 `origin/main` 에는 아직 없다. 먼저 머지하면 planner 가 막힌다. 훅 docstring 스스로 세운 "먼저 막으면 문서가 시키는 일을 훅이 막는다" 원칙과 같은 문제다.
  - 제안: 짝 PR 을 먼저 머지한다. PR 본문에 머지 순서를 적는다.

- **[INFO]** `check()` 가 frontmatter 의 `id` · `area` 가 문자열이 아닐 때 문제 줄 대신 traceback 으로 끝난다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:377-380`
  - 상세: scratch 에서 `id: ["CLE-VISION"]`, `id: 5`, `area: 5` 로 바꿔 돌리니 `mirror_relpath` 안의 `KEY_RE.match` 가 `TypeError` 를 냈다. `except PullError` 만 있어서 못 잡는다. CI 는 exit 1 이라 탐지는 된다. 출력만 읽기 어렵다.
  - 제안: `isinstance(key, str)` 와 `isinstance(folder, (str, type(None)))` 를 먼저 보고 아니면 문제 줄로 보고한다.

- **[INFO]** `fingerprint()` 가 `mirror_sha256: ` 로 시작하는 줄을 전부 뺀다. 줄 하나를 더 끼워도 `--check` 가 통과한다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:163-166`
  - 상세: scratch 에서 `etag:` 앞에 `mirror_sha256: "x"` 를 한 줄 더 넣었더니 `check()` 가 `[]` 였다. 본문 줄도 같다. 코드와 CI 주석이 "무의식적 편집 탐지이지 변조 방지가 아니다" 라고 적은 범위 안이고, 우연히 생기는 편집은 아니다.
  - 제안: 지금은 조치 불요. 필요하면 frontmatter 안의 첫 `mirror_sha256` 줄만 빼고, 그 줄이 둘 이상이면 문제로 센다.

- **[INFO]** `source_paths` 역색인이 일부 문서에서 불완전하다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:73-74`(`SOURCE_PATH_RE`), 미러 `spec/CLE-NODE/CLE-NODE-FLOW.md`, `CLE-CHAT.md`, `CLE-WF.md`
  - 상세: 미러 169편을 읽어 보니 원문 경로 335개 중 2개가 글롭(`spec/3-workflow-editor/*.md`, `spec/4-nodes/7-trigger/providers/*.md`)이라 실제 파일이 아니다. `CLE-NODE-FLOW` 는 원문이 디렉터리(`spec/4-nodes/2-flow/`)라 `.md` 만 잡는 정규식에 걸리지 않아 `[]` 다. 나머지 13편의 빈 값은 "원문 없음" 이라 정상이다.
  - 제안: 글롭은 `source_paths` 에서 빼거나 별도 표기한다. 디렉터리 원문은 `/` 로 끝나는 경로도 받는다. 역색인 사용처가 생길 때 고쳐도 된다.

- **[INFO]** 훅이 `tool_input` 이 dict 가 아니거나 `file_path` · `cwd` 가 문자열이 아닐 때 traceback 을 stderr 에 찍고 exit 0 이다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:61-70`, `.claude/tests/test_guard_nerv_owned_paths.py:146-152`
  - 상세: fail-open 이라 세션은 안 막힌다. 테스트 주석은 "모양이 틀린 페이로드는 traceback 없음" 이라 하지만 고정한 모양은 최상위(`[]`, `null`, `tool_input` 없음)뿐이다. 하네스가 실제로 그런 모양을 보내지는 않는다.
  - 제안: 조치 불요. 문구를 "최상위 모양" 으로 좁히거나 `isinstance(tool_input, dict)` 한 줄을 더한다.

- **[INFO]** 표지 파일이 없는 옛 워크트리는 가드 밖이다.
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:86-88`
  - 상세: 이 PR 머지 전에 만든 워크트리는 루트에 `pull.py` 가 없어 `spec/` 편집이 통과한다. rebase 하면 표지가 생겨 그때부터 막힌다. 의도한 완화로 보인다. 머지 전 세션이 옛 트리를 고친 내용은 CI 도 잡지 않는다(CI 는 옛 트리를 안 본다).
  - 제안: 조치 불요.

- **[INFO]** `spec/README.md` 의 옛 트리 설명이 루트 파일을 빠뜨렸다.
  - 위치: `.claude/tools/nerv-mirror/pull.py:474-475`(`render_readme`), 미러 `spec/README.md:13-14`
  - 상세: `0-overview.md` · `<숫자>-<영역>/` · `conventions/` · `data-flow/` 만 적었고 `spec/1-data-model.md`, `spec/6-brand.md` 는 없다. 같은 문장이 "이 폴더의 ... 는 옛 트리" 라서 읽는 사람이 두 파일을 미러로 오해할 수 있다.
  - 제안: "이 폴더에서 `CLE-*` 로 시작하지 않는 것은 옛 트리" 처럼 일반형으로 쓴다.

- **[INFO]** consistency 오케스트레이터의 미러 제외는 NERV 스펙에 기술이 없다(회색지대).
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205`, `:806-807`
  - 상세: `CLE-ENG-SPECEVIDENCE` 는 두 docs 가드(링크, 영역 index)만 다루고 consistency 코퍼스 제외는 말하지 않는다. 코드 주석은 "단계 4e" 로 미뤘다고 하지만 그 정의가 저장소 안에 없다. `--impl-prep spec/CLE-…/` 는 대상이 미러이고 코퍼스가 동결된 옛 트리가 된다(라운드 1 INFO 12, 의도된 보류).
  - 제안: 조치 불요. 단계 4e 를 NERV Task 키와 함께 한 번 적어 두면 좋다.

## 요약

라운드 1 의 경고 14건은 대부분 실제로 닫혔다. `pull.py` 의 입력 검증, 빈 export 와 대량 삭제 중단, 304 재렌더, scope id 해석, 훅의 저장소 한정과 `realpath` 는 scratch 프로브와 전체 테스트로 확인했다. 수정이 만든 새 결함은 크지 않다. 다만 네 가지가 남았다. 동치 테스트의 CI 트리거 누락(W1), 서버 주소 접두어 검증이 만드는 https 강제의 구멍(W2), NERV 스펙 R-12 의 낡은 "본문 지문"(W3, 코드 유지 후 NERV 초안으로 반영), 동결한 옛 트리와 plan 가드의 충돌(W4)이다. 짝 planner PR 이 `origin/main` 에 아직 없으므로 머지 순서도 확인해야 한다. Critical 은 없다.

### 위험도
LOW
