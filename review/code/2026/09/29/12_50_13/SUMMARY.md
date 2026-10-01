# Code Review 통합 보고서

## 전체 위험도
**MEDIUM**. Critical 은 없다. 경고 14건은 `pull.py` 의 입력 검증 부재 3건(경로 이탈, curl 설정 인젝션, 빈 export 전체 삭제), 문서가 약속한 보장이 구현보다 넓은 것, 훅과 거버넌스 문서의 순서 어긋남이 핵심이다.

- 실행한 reviewer 9명(강제 7명 포함) 전원의 결과를 확보했다. 강제 화이트리스트 미이행과 결과 누락은 없다. 재시도 필요 0건.
- reviewer 파일 9개는 모두 디스크에 이미 있어 추가로 쓰지 않았다.
- 검토 범위는 NERV 정본 전환 단계 1(커밋 `de36badf7`, 14개 파일). 첫 미러 스냅샷 169편은 범위 밖이다.
- `[SPEC-DRIFT]` 로 태깅된 발견사항은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement / Testing | export.zip 항목 이름과 `/specs/tree` 응답의 `area` · `key` 를 `KEY_RE` 로 검증하지 않는다. `specs/../CLAUDE.md` 항목이 `spec/` 밖 저장소 루트 파일을 덮어쓰는 것을 scratch 에서 재현했다(Zip Slip, CWE-22). `KEY_RE` 밖 이름의 파일은 `mirror_files()` 가 못 봐서 prune 과 `--check` 대상에서도 영구히 빠진다. 4단계 이상 경로는 영역 없이 납작해진다. 이를 다루는 테스트도 없다. 신뢰 경계가 NERV 서버라 위협은 낮다 | `.claude/tools/nerv-mirror/pull.py:183-195`, `:68-70`, `:158-178`, `:200-216`, `:296-331` | `docs_from_zip` 과 `area_map` 에서 `key` · `area` 를 `KEY_RE` 로 검증하고 어긋나면 중단한다. `apply` 와 `write_if_changed` 는 `target.resolve().is_relative_to(spec_root.resolve())` 를 강제한다. zip 총 크기 상한을 둔다. 잘못된 이름 3종(`..`, 비-키, 깊이 이상)의 거부 테스트를 추가한다 |
| 2 | Security | `--task` 모드에서 미러 파일 frontmatter 의 `etag` 값이 `If-None-Match` 헤더로 curl 설정(`-K -`)에 그대로 들어간다. 큰따옴표와 개행이 든 `etag` 로 `url = "…"` 줄을 주입하면 `Authorization: Bearer` 가 공격자 서버로 나가는 것을 로컬 서버 두 대로 재현했다(exit 0, 사용자는 이상을 못 본다). `--check` 는 `etag` 를 보지 않아 PR 단계에서도 못 잡는다 | `.claude/tools/nerv-mirror/pull.py:226-231`, `:319-323`, `:255-274` | 사용 전에 `re.fullmatch(r'sha256-[0-9a-f]{64}', etag)` 로 검증하고 어긋나면 버린다. `NERV_TOKEN` 에도 개행·따옴표·제어문자 검사를 한다. curl 설정 이스케이프를 적용한다. `check()` 에서 `etag` 형식도 검증한다 |
| 3 | Requirement / Side Effect | `pull.py --all` 이 `specs/` 아래 문서가 없는 export(빈 zip)를 받으면 `prune` 으로 미러 169편을 전부 지우고 exit 0 으로 끝난다(`before 169 after 0 rc 0` 실측). `--check` 도 미러 0편이면 "문제 0" 으로 통과해 CI 가 공허하게 초록이 된다 | `.claude/tools/nerv-mirror/pull.py:183-195`, `:279-293`, `:169-174`, `:255-274` | `docs` 가 비었거나 지울 파일이 기존 미러 대비 급감하면 중단하고 `--force-prune` 같은 명시 옵션을 요구한다. `--check` 는 미러 0편이면 실패로 본다. 회귀 테스트 2건을 추가한다 |
| 4 | Requirement / Side Effect / Scope / Documentation | 훅은 `spec/` 쓰기를 이미 막지만 거버넌스 문서(`CLAUDE.md`, `project-planner` · `developer` SKILL)는 여전히 `spec/` 쓰기와 자기-반증형 소정정을 안내한다. 훅 docstring 이 스스로 세운 "문서가 안내하지 않을 때 더한다" 규칙과 어긋난다. 짝 planner PR(`claude/nerv-cutover-1-docs-c46df0`)은 이 브랜치의 조상이 아니라 머지 순서에 결합돼 있다. `worktree-policy.md` §5 에도 신규 훅과 `BYPASS_NERV_OWNED_PATHS=1` 이 등재되지 않았다 | `.claude/hooks/guard_nerv_owned_paths.py:11-15`, `.claude/settings.json:36-39`, `CLAUDE.md`, `.claude/skills/project-planner/SKILL.md`, `.claude/docs/worktree-policy.md` §5 | planner PR 을 먼저 머지하거나 같은 릴리스 창에 planner 턴으로 문서를 갱신한다. 머지 순서와 "문서 갱신 전까지 planner 의 `spec/` 쓰기가 막힌다" 를 PR 본문에 명시한다. 늦어지면 후속 작업을 plan 에 못 박는다 |
| 5 | Architecture / Requirement / Testing / Documentation | 「CI 가 셸 · 손 편집을 잡는다」는 서술이 `--check` 의 실제 범위(본문 sha256 과 `id`·`area` 위치)보다 넓다. scratch 실측에서 (1) frontmatter `status` · `type` 손편집, (2) 본문과 `mirror_sha256` 을 함께 고친 편집, (3) 미러 파일 삭제, (4) 지문을 맞춘 신규 `CLE-FAKE.md`, (5) 옛 트리 `spec/5-system/x.md` 의 셸 편집이 모두 통과했다. 훅은 `spec/` 전체를 막지만 CI 는 `CLE-*` 미러만 본다. README 만 "본문 지문" 이라고 정확히 적었다 | `.claude/hooks/guard_nerv_owned_paths.py:21-22`, `.claude/tools/nerv-mirror/pull.py:6-7`, `:255-274`, `.github/workflows/spec-link-checks.yml:120-124`, `CHANGELOG.md:36`, 짝 PR 의 `CLAUDE.md` 52-53행 | (a) 지문 범위를 `mirror_sha256` 줄을 뺀 파일 전체로 넓혀 frontmatter 까지 덮고, 또는 (b) 문구를 "미러 본문 손편집과 파일 이동을 잡는다. 추가·삭제와 옛 트리 셸 편집은 잡지 않는다" 로 낮춘다. (b) 를 택하면 `test_frontmatter_only_edit_is_not_caught` 로 한계를 고정한다. 짝 PR 의 문장도 함께 좁힌다 |
| 6 | Architecture (Side Effect 보강) | `--task` 의 ETag 304 단축이 링크 재작성의 입력인 트리 배치를 캐시 키에 넣지 않는다. 문서 B 가 다른 영역으로 옮겨져도 A 는 `ETag 같음` 으로 건너뛰어 링크가 `../CLE-IX/CLE-B.md` 로 굳는 것을 scratch 에서 재현했고 `check()` 는 `[]` 로 통과했다. 옛 트리 링크 가드는 미러를 제외하므로 이 부패를 잡는 층이 없다. `--all` 과 `--task` 의 `paths` 산출도 달라 링크 입력이 모드마다 다르다 | `.claude/tools/nerv-mirror/pull.py:317-326`, `:119-131`, `:255-274` | 캐시 키를 「원본 ETag + 참조 키별 상대 경로 지문」으로 넓힌다. 지문이 달라지면 `If-None-Match` 를 생략하고 재렌더한다. 두 모드가 같은 `paths` 산출 함수를 쓰게 맞춘다. 또는 `--check` 에 미러 상대 링크의 대상 존재 검사를 더한다 |
| 7 | Requirement | `--task` 기본 경로가 실측하지 않은 NERV 응답 모양에 기댄다. `GET /tasks/{id}` 의 `claims[].status` · `scope_spec_ids` 의 기록이 어디에도 없다. fixture 는 `scope_spec_ids` 를 key 로 채우는데 실제 값이 노드 `id` 면 `key not in areas` 로 매번 "NERV 에 없는 키" 종료가 되어 결정 D3 의 기본 사용법이 통째로 동작하지 않는다. 트리·task 는 `/api/v1/…`, export·md 는 `/api/…` 로 접두가 갈리는 근거도 적혀 있지 않다 | `.claude/tools/nerv-mirror/pull.py:298`, `:303-307` | 실제 클레임 응답으로 한 번 실측하고 결과를 docstring 에 적는다. `by_id` 로 id 와 key 를 모두 해석하게 한다. 접두 차이의 이유를 한 줄 적는다 |
| 8 | Side Effect | 편집 가드가 이 저장소를 식별하지 않고 "위로 올라가며 처음 만나는 `.git`" 의 첫 조각이 `spec` 인지만 본다. 스크래치의 무관한 git 저장소 `other-repo/spec/x.md` 가 exit 2 로 막히는 것을 실측했다. 같은 세션에서 다른 프로젝트의 `spec/` 를 편집하면 "NERV 가 정본" 이라는 잘못된 안내와 함께 막힌다 | `.claude/hooks/guard_nerv_owned_paths.py:62-80`, `.claude/tests/test_guard_nerv_owned_paths.py` | 체크아웃 루트에 `.claude/tools/nerv-mirror/pull.py` 가 있을 때만 막는다(main · 워크트리 모두 성립). fixture 에 표지 파일을 심고 "표지 없는 다른 저장소의 `spec/` 는 통과" 케이스를 추가한다 |
| 9 | Maintainability (Architecture / Side Effect / Testing 공통) | 「NERV 미러 경로」 판정이 세 언어 세 곳에 따로 있고 서로 묶는 테스트가 없다. 지금은 `spec/` 의 `*.md` 557개에서 세 판정이 잡은 집합이 모두 170개로 일치하지만 `_NERV_MIRROR_REL` · `NERV_MIRROR` 는 `CLE-[A-Z0-9-]+` 로 느슨하고 `KEY_RE` 는 더 엄격해 모양이 다르다. 키 형식이 바뀌면 각 스위트가 초록인 채 갈라진다 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-259`, `.claude/tools/nerv-mirror/pull.py:48`, `:140-146` | `test_mermaid_lint_ready` 의 교차 언어 결속 방식으로 실제 `spec/` 를 훑어 세 판정의 집합이 같음을 단언하는 테스트 1개를 둔다. 같은 케이스 표를 파이썬과 TS 가 함께 읽게 하는 방법도 있다. 최소한 세 정의의 주석에 서로의 위치를 적는다 |
| 10 | Maintainability | 오케스트레이터 회귀 테스트가 "미러가 실제로 트리에 있다" 를 확인하지 않아 공허하게 통과할 수 있다. 공허 방지 단언이 `heads` 비어 있지 않음만 본다. D3 부분 스냅샷이나 `--all` prune 으로 미러가 사라져도 "`spec/CLE-` 헤더 0개" 단언이 그대로 통과한다. 프런트 쪽은 `spec/CLE-VISION.md` 키 하나에 묶여 있어 그 키가 바뀌면 제외 로직과 무관하게 깨진다 | `.claude/tests/test_consistency_bundle_priority.py:978-979`, `codebase/frontend/src/lib/docs/__tests__/spec-link-integrity.test.ts:82-85` | 파이썬에 `glob(ROOT/spec/CLE-*.md)` 가 비어 있지 않다는 사전 단언을 더한다. 프런트는 특정 키 대신 `spec/CLE-*.md` 하나 이상을 찾게 바꾼다 |
| 11 | Testing | `Nerv.get`(curl 경계)이 `FakeNerv` 로 통째로 대체돼 `If-None-Match` 인용 형태, 응답 헤더 파싱, curl 실패 예외, "토큰은 argv 에 남기지 않는다" 주장이 무테스트다. `100 Continue` 나 CONNECT 응답처럼 헤더 블록이 둘이면 status 100 과 헤더가 body 로 섞이고 토큰에 `"` 가 있으면 설정 줄이 깨진다. `FakeNerv` 는 `/api/v1/` 와 `/api/` 접두 혼용도 구분하지 않는다 | `.claude/tools/nerv-mirror/pull.py:221-241`, `.claude/tests/test_nerv_mirror_pull.py:204-222` | PATH 앞에 가짜 `curl` 을 두는 서브프로세스 테스트 3건을 추가한다(argv 에 토큰 없음·stdin 설정에 있음, 304 파싱과 헤더 인용, exit≠0 이면 `RuntimeError`). `FakeNerv` 가 받은 접두를 단언한다 |
| 12 | Testing | 훅의 `..` 정규화(`normpath`)가 무테스트다. `normpath` 를 뺀 뮤턴트가 훅 테스트 전체를 통과했다(SURVIVED). 그 상태에서 `<루트>/codebase/../spec/x.md` 는 첫 조각이 `codebase` 라 허용된다. 하위 폴더에서 `../../spec/…` 를 쓰는 것이 에이전트가 만드는 실제 형태다 | `.claude/hooks/guard_nerv_owned_paths.py:59`, `.claude/tests/test_guard_nerv_owned_paths.py:63-65` | `cwd=<wt>/codebase` 에 `../spec/x.md`, 절대 경로 `<루트>/codebase/../spec/x.md` 케이스를 각각 exit 2 로 추가한다 |
| 13 | Testing | `pull.py` 뮤턴트 다수가 살아남아 문서에 적힌 불변식이 미고정이다. `EXCLUDED_AREAS` 에서 `CLE-MKS` 제거(D4 절반 무테스트), `is_excluded` 의 키 접두어 절 제거, CRLF 정규화 제거, 본문 끝 줄바꿈 보정 제거, `source_paths` 앞 5줄 창 확대, `check` 의 frontmatter 파싱 실패 분기 제거가 SURVIVED 다. 핵심 경로(P1·P7·P8·P10·P11)는 KILLED 라 견고하다 | `.claude/tools/nerv-mirror/pull.py:47`, `:73-75`, `:97-102`, `:119-131`, `.claude/tests/test_nerv_mirror_pull.py:114-116` | 픽스처에 `CLE-MKS` 영역, `CLE-MKS--X` 카탈로그 키, CRLF 문서(끝 줄바꿈 없음), `원문:` 없는 문서를 추가하고 결과를 단언한다. `check` 에는 frontmatter 없는 파일 1건을 넣는다 |
| 14 | Documentation | 가드 스코프를 서술한 `PROJECT.md` 의 「검사 스코프 3가지」 1번이 "(생성형 `*-api-catalog/` 제외)" 로만 적어 NERV 미러 제외를 반영하지 않았다. `spec/conventions/spec-impl-evidence.md` §4.2 표의 예외 칸(133-134행)도 같은 상태이고 이 spec 은 NERV 정본이라 이 PR 이 직접 고칠 수 없다. consistency 리뷰(`review/consistency/2026/09/29/12_51_07/convention_compliance.md`)도 같은 지적을 했다 | `PROJECT.md:392` | `PROJECT.md:392` 를 "(생성형 `*-api-catalog/` 와 NERV 미러 `spec/CLE-*` · `spec/README.md` 제외, 미러 무결성은 `pull.py --check`)" 로 고친다. `spec-impl-evidence.md` 표는 NERV 초안으로 고치거나 어긋난 구간을 Task 에 기록한다 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement / Testing / Architecture / Side Effect | 훅이 대소문자를 구분하고 심볼릭 링크를 풀지 않는다. `SPEC/x.md` · `Spec/x.md` 가 exit 0 이고(macOS 기본 APFS 에서는 같은 파일), 저장소 내부 링크 `docs -> spec` 도 통과한다. 이 저장소 볼륨은 case-sensitive 라 지금 환경에서는 무해하고 CI 지문이 백스톱이다 | `.claude/hooks/guard_nerv_owned_paths.py:59`, `:62-80` | `first.casefold()` 로 비교하고 판정 전에 `realpath` 를 적용한다. 지금 범위를 docstring 의 한계 목록에 적는 방법도 있다 |
| 2 | Security | `NERV_SERVER` 가 `http://` 여도 Bearer 토큰이 평문으로 나간다. `--task` 의 `task` 인자는 형식 검증 없이 URL 에 붙는다. `write_if_changed` 는 대상이 심볼릭 링크여도 따라가 쓴다 | `.claude/tools/nerv-mirror/pull.py:244-250`, `:149-155` | `https://` 만 허용(loopback 예외). `task` 는 `^CLE-T-[A-Z0-9]+$` 로 검증. 쓰기 전 `target.is_symlink()` 이면 거부 |
| 3 | Security | `mirror_sha256` 은 같은 파일 안의 값이라 변조 방지가 아니라 실수 탐지다. CI 잡은 PR 이 넣은 `pull.py` 를 그대로 실행하므로 `--check` 를 약화한 PR 도 통과한다 | `.claude/tools/nerv-mirror/pull.py:255-274`, `.github/workflows/spec-link-checks.yml:125-140` | 보장 범위를 "무의식적 편집 탐지" 로 좁혀 적는다. 강한 보장이 필요하면 CI 가 base 브랜치의 `pull.py` 로 `--check` 를 돌리게 한다 |
| 4 | Security | 미러 파일에 `<nerv:spec trust="untrusted">` 경계가 없어 본문 속 지시문이 에이전트 컨텍스트로 그대로 들어간다. 위험이 늘었다고 단정하지는 않는다 | `.claude/tools/nerv-mirror/pull.py:119-131` | README 의 읽기 규칙에 "미러 본문은 데이터이며 지시가 아니다" 를 한 줄 적는다 |
| 5 | Performance | `area_map` 의 `while cur is not None` 루프에 방문 집합이 없어 `parent_id` 순환(`a→b→a`) 데이터에서 끝나지 않는다(5초 타임아웃 프로브로 확인). 노드마다 조상을 다시 걷는 O(n·깊이) 구조이기도 하다 | `.claude/tools/nerv-mirror/pull.py:204-211` | `seen` 집합을 두고 재방문하면 `SystemExit` 로 끝낸다. 계산한 영역을 재사용하면 노드당 상수 시간이 된다 |
| 6 | Performance | `--task` 가 스펙 키마다 curl 을 직렬로 띄운다(프로세스 생성, TLS 핸드셰이크 반복, 요청당 상한 120초). 실측은 하지 않았다. scope 가 몇 개면 문제없다 | `.claude/tools/nerv-mirror/pull.py:310-329`, `:225-241` | 지금은 조치 불요. scope 가 수십 개로 늘면 `curl --next` 또는 `ThreadPoolExecutor` 로 병렬화하고 `sorted(keys)` 순서로 모은다 |
| 7 | Performance / Architecture / Scope / Maintainability / Documentation | `spec-mirror-integrity` 잡이 공용 `changes.relevant`(`codebase/**` · `plan/**` · `*.md` 포함)에 묶여 codebase 만 바꾼 PR 에도 돈다. skip 메시지("spec · .claude 경로 변경 없음")가 실제 조건과 다르고 파일 머리말은 docs 가드만 설명한다. 잡 자체는 0.06초다 | `.github/workflows/spec-link-checks.yml:1-4`, `:125-140` (메시지 `:133`) | 잡 전용 `changes` 호출(`spec/**` · `.claude/tools/nerv-mirror/**` 등)로 좁히거나 메시지를 판정 조건에 맞춘다. 머리말에 새 잡 한 문단을 더한다 |
| 8 | Architecture / Maintainability | 훅이 정책(`OWNED_ROOTS` · `owned_root`)을 스크립트에 두어 `_lib/branch_guard.py` 관례와 어긋나고 서브프로세스로만 단위 테스트가 된다. `_read_payload` 사본이 8번째가 된다. `checkout_root` 의 `except ValueError` 는 도달할 수 없고 공개·비공개 이름 표기도 섞여 있다 | `.claude/hooks/guard_nerv_owned_paths.py:34-80` | 정책을 `_lib/nerv_owned_paths.py` 로 옮겨 훅을 얇게 둔다. 죽은 분기를 제거한다. `_read_payload` 공용화는 별도 정리로 미뤄도 된다 |
| 9 | Architecture / Maintainability | `pull.py` 한 파일(396줄)이 여러 책임을 지고 `cmd_task` 는 클라이언트를 인자로 받지 않아 테스트가 전역 `load_env` 를 덮어쓴다. 상태 검사 4회 반복, API 경로 5곳 산재, `RuntimeError` 와 `SystemExit` 혼용, "영역 문서는 자기 폴더" 규칙이 세 곳(`docs_from_zip` · `area_map` · `check`)에 있다 | `.claude/tools/nerv-mirror/pull.py:244-250`, `:296-331`, `.claude/tests/test_nerv_mirror_pull.py:247-254` | `cmd_task(spec_root, task, keys, nerv=None)` 로 주입한다. `get_ok(path)` 와 URL 빌더를 둔다. 폴더 결정을 한 함수로 모은다. `EXCLUDED_AREAS` 옆에 D4 를 따른 결과임을 적는다 |
| 10 | Requirement / Maintainability / Documentation | 훅 docstring 의 핵심 문장 "막는 경로는 전환 단계를 따라 는다." 에서 동사가 빠졌다 | `.claude/hooks/guard_nerv_owned_paths.py:11` | "막는 경로는 전환 단계에 따라 늘어난다." 로 고친다 |
| 11 | Requirement | `--task` 는 기존 미러 파일의 frontmatter 가 깨져 있으면 traceback 으로 끝나 스스로 복구하지 못한다(복구는 `--all` 뿐) | `.claude/tools/nerv-mirror/pull.py:317-321` | 읽기에 실패하면 `etag=None` 으로 취급해 새로 받아 덮어쓴다 |
| 12 | Requirement | consistency 코퍼스에서만 미러를 뺐고 대상(target)은 그대로다. `--impl-prep spec/CLE-ACCT/` 는 대상이 미러이고 대조 코퍼스는 동결된 옛 트리가 된다. 코드 주석이 "단계 4e" 로 보류를 명시해 의도된 것으로 본다 | `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:806-807`, `:743`, `:754` | 조치 없음. 4e 착수 전까지 이 조합의 결과는 참고용으로만 읽는다 |
| 13 | Scope | `codebase/**` 를 건드렸다(테스트 헬퍼 필터 `inNervMirror` 한 곳과 그 테스트). Task 경계 "codebase 를 건드리지 않는다" 의 의도된 예외이고 최소 변경이다. 이 때문에 push 게이트(`/ai-review`)와 e2e 면제 화이트리스트 판정이 적용된다 | `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-265`, `spec-link-integrity.test.ts:79-100` | 조치 불필요. PR 본문에 예외의 근거를 한 줄 적는다 |
| 14 | Scope | `spec/README.md` 생성은 명세 산출물 목록에 없다. `README.md` 예외가 미러 제외 정규식 세 곳에 들어갔고 `--all` 에서만 갱신되며 `mirror_files()` 가 제외해 `--check` 가 손편집을 못 잡는다. 사용 규칙 산문이 거버넌스 문서와 이중 서술이다 | `.claude/tools/nerv-mirror/pull.py:291`, `:334-358` | 산문을 줄이고 스냅샷 시점 안내만 남기거나 `--check` 에 README 지문을 더한다. 최소한 두 보장의 범위 차이를 적는다 |
| 15 | Scope / Maintainability / Documentation | 명세에 없는 CLI 옵션 `--basis {approved,latest}` 와 `--spec KEY` 가 있다. `--basis latest` 는 미승인 초안을 미러에 들일 수 있다. `--task` 의 metavar 가 `KEY` 라 `--spec KEY` 와 헷갈리고 `--spec` · `--basis` · `--from-zip` 은 맞지 않는 모드에서 조용히 무시된다. `NERV_SERVER` · `NERV_TOKEN` · `NERV_PROJECT` 환경 변수가 모듈 문서에 없다 | `.claude/tools/nerv-mirror/pull.py:9-14`, `:244-250`, `:373-378` | `--basis` 는 `approved` 고정을 검토한다. metavar 를 `TASK` 로 바꾸고 안 맞는 조합은 `parser.error` 로 거절한다. docstring 에 환경 변수와 `--spec` 을 적는다 |
| 16 | Maintainability | `Nerv.get` 이 파싱한 응답 헤더를 호출부 4곳이 모두 버린다(죽은 코드). `is_excluded` 의 두 겹치는 조건에 설명이 없다. 매직 값이 이름 없이 남아 있다(`[:5]`, `--max-time 120`, `len(parts) == 3`, `parents[3]`). 단계 4e · 5 와 결정 D1·D3·D4 의 정의가 저장소 안에 없다 | `.claude/tools/nerv-mirror/pull.py:234-241`, `:73-75`, `:98`, `:190`, `:229-230`, `:380`, `consistency_orchestrator.py:199`, `spec-links.ts:254` | `(status, body)` 만 반환한다. 상수로 이름을 붙이고 깊이가 3이 아닌 zip 경로는 오류로 알린다. 단계·결정이 정의된 NERV 키를 한 번 적는다 |
| 17 | Testing | `--task` 가 활성 클레임이 없거나 `scope_spec_ids` 가 비면 `씀 0 · 그대로 0 · 지움 0` 으로 조용히 exit 0 이다. 그 밖에 "NERV 에 없는 키", 200 아님(tree·tasks·md·export), `load_env` 누락 오류 경로와 훅의 fail-open `except` 분기, `payload.get("input")` 별칭, `BYPASS=0` 처리가 무테스트다 | `.claude/tools/nerv-mirror/pull.py:302-307`, `:312`, `:249`, `.claude/hooks/guard_nerv_owned_paths.py:51-53`, `:84`, `:105-110` | 클레임 없음은 경고 또는 exit 1 로 정하고 테스트로 고정한다. 오류 경로는 `assertRaises(SystemExit)` 한 줄씩, 훅에는 `raw="[]"` 등을 fail-open 목록에 추가한다 |
| 18 | Documentation / Maintainability | 낡은 주석과 문서가 남았다. `spec-area-index.test.ts:16,36` 의 "excludes catalogs", `tree-walk.test.ts:153-154` 표의 "`spec/` 루트 파일을 본다", `.claude/tests/README.md:91` 행에 `NervMirrorStaysOutOfTheOldCorpusTest` 누락, `CHANGELOG.md:34` 가 "Write · Edit" 만 적고(실제는 `MultiEdit` · `NotebookEdit` 포함) `BYPASS_NERV_OWNED_PATHS=1` 을 알리지 않는다. 테스트 스위트에 사소한 중복과 결합(`pull_all(*extra)` 미사용 인자, `load_env` 직접 덮어쓰기, `CiWiringTest` 와 `test_spec_link_checks_scope.py` 중복)이 있다 | `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts:16`, `:36`, `tree-walk.test.ts:153-154`, `.claude/tests/README.md:91`, `CHANGELOG.md:34`, `.claude/tests/test_nerv_mirror_pull.py:92-95`, `:247-254` | 주석에 "and the NERV mirror" 를 더한다. README 행과 CHANGELOG 문구를 보완한다. 미사용 인자를 지우고 `mock.patch.object` 로 바꾼다 |
| 19 | Scope | 훅에 아직 쓰지 않는 확장 틀(`OWNED_ROOTS` 딕셔너리, 단계 2·3 로드맵 docstring)이 있다. 다음 단계의 diff 를 한 줄로 줄이는 정도라 허용 범위다 | `.claude/hooks/guard_nerv_owned_paths.py:11-15`, `:34-37` | 조치 불필요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `etag` 를 통한 curl 설정 인젝션(토큰 유출 재현), zip·트리 `area`/`key` 경로 이탈(`spec/../CLAUDE.md` 덮어쓰기 재현). 훅 대소문자·심볼릭 링크 우회, `--check` 는 변조 방지가 아님 |
| performance | LOW | 핫패스 훅 약 7ms, `--check` 0.06초로 허용. `area_map` 순환 무한 루프, `--task` curl 직렬, CI 잡 공용 트리거 |
| architecture | MEDIUM | 304 단축이 링크 재작성 입력을 놓쳐 링크 부패(`check()` 통과), CI 보장 문구가 `check()` 범위보다 넓음. 미러 판정 3곳 복제 |
| requirement | MEDIUM | 훅과 거버넌스 문서의 순서 어긋남, 빈 export 전체 삭제, zip 이름 미검증, `--task` 응답 모양 미실측 |
| scope | LOW | 14개 파일 전부 Task 산출물에 대응, `codebase/**` 예외는 최소. README 생성·`--basis`/`--spec` 옵션이 명세 밖, 짝 PR 머지 순서 결합 |
| side_effect | MEDIUM | 훅이 다른 git 저장소의 `spec/` 도 막음(실측), 문서 미갱신 충돌, 빈 export 전체 삭제(`169 → 0` 실측) |
| maintainability | LOW | 미러 판정 3곳 복제, 오케스트레이터 회귀 테스트 공허 가능성. 죽은 헤더 파싱, `cmd_task` 반복, 정의 없는 단계 번호 |
| testing | MEDIUM | frontmatter 손편집 미검출과 고정 테스트 부재, curl 경계 무테스트, `normpath` 뮤턴트 생존, `CLE-MKS`·CRLF 등 뮤턴트 생존, zip 이름 검증 테스트 부재 |
| documentation | LOW | "CI 가 셸 편집을 막는다" 서술 과대, `PROJECT.md:392` 미반영, 훅 docstring 깨진 문장, 주석·README·환경 변수 문서 누락 |

## 발견 없는 에이전트

없음. 실행한 9명 모두 최소 INFO 이상의 발견이 있다.

## 권장 조치사항

1. **`pull.py` 입력 검증을 한 번에 닫는다.** `key` · `area` 를 `KEY_RE` 로 검증하고 쓰기 경로가 `spec_root` 안인지 강제하며(경고 1), `etag` 를 `sha256-[0-9a-f]{64}` 로 검증하고 토큰의 개행·따옴표를 검사한다(경고 2). 빈 export 와 급감 prune 은 중단시키고 `--check` 는 0편을 실패로 본다(경고 3). 각각 거부 테스트를 함께 추가한다.
2. **머지 순서와 거버넌스 문서를 정리한다.** 짝 planner PR(`claude/nerv-cutover-1-docs-c46df0`)을 먼저 머지하거나 같은 창에 갱신하고 PR 본문에 순서를 명시한다. `worktree-policy.md` §5 에 훅과 `BYPASS_NERV_OWNED_PATHS=1` 을 등재한다(경고 4).
3. **`--check` 보장 문구를 구현에 맞춘다.** 훅 docstring, `pull.py` 상단, CI 주석, `CHANGELOG.md`, 짝 PR 의 `CLAUDE.md` 를 "미러 본문 손편집과 파일 이동" 으로 낮추거나 지문 범위를 frontmatter 까지 넓힌다. 낮추는 쪽이면 한계를 고정하는 테스트를 넣는다(경고 5).
4. **`--task` 경로를 실측으로 확인한다.** 실제 클레임 응답의 `scope_spec_ids` 가 key 인지 id 인지 확인해 docstring 에 적고(경고 7), ETag 304 가 링크 재작성 입력을 놓치는 문제를 캐시 키 확장이나 링크 대상 존재 검사로 닫는다(경고 6).
5. **훅을 이 저장소로 한정한다.** 체크아웃 루트의 표지 파일(`.claude/tools/nerv-mirror/pull.py`)을 확인하고 다른 저장소 통과 테스트와 `..` 정규화 테스트를 추가한다(경고 8, 12). 대소문자·심볼릭 링크는 `casefold` 와 `realpath` 를 적용하거나 한계로 문서화한다.
6. **테스트 결속과 공허 방지를 보강한다.** 미러 판정 세 곳을 묶는 교차 테스트 1개(경고 9), 오케스트레이터 테스트의 미러 존재 사전 단언(경고 10), PATH 가짜 `curl` 서브프로세스 테스트 3건(경고 11), `CLE-MKS`·CRLF 픽스처(경고 13)를 더한다.
7. **문서 후속을 마무리한다.** `PROJECT.md:392` 와 `spec-impl-evidence.md` 표(NERV 초안 또는 Task 기록)를 고치고(경고 14), 훅 docstring 11행 오타, 낡은 코드 주석, `.claude/tests/README.md` 행, CI 잡 skip 메시지를 함께 정리한다.
8. **후속 백로그로 미룰 것.** `area_map` 순환 방어, `--task` 병렬화, `cmd_task` 클라이언트 주입, 훅 정책 `_lib` 이동, `_read_payload` 공용화는 차단 사유가 아니다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (9명)
  - **제외**: `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (5명). 제외 사유는 호출 prompt 에 전달되지 않았다(라우터 산출물 참조).
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`. 7명 전원 결과를 확보했다.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 사유 미전달 |
  | database | 사유 미전달 |
  | concurrency | 사유 미전달 |
  | api_contract | 사유 미전달 |
  | user_guide_sync | 사유 미전달 |
