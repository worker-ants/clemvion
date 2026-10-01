# 아키텍처(Architecture) 리뷰 — NERV 정본 전환 단계 1 (spec 미러 · 편집 가드 · CI 무결성)

### 발견사항

- **[WARNING]** `--task` 의 ETag 304 단축이 링크 재작성 입력(트리 배치)을 캐시 키에 넣지 않아, 링크가 옛 경로로 굳고 `--check` 도 못 잡는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:317-326` (etag 조회 · 304 skip), `:119-131` (`render` 의 링크 재작성), `:255-274` (`check`)
  - 상세: 본문 링크는 `rewrite_links(body, here, paths)` 로 **트리 전체 배치**에 의존해 바뀐다. 그런데 증분 판정은 원본 md 의 ETag 하나뿐이다. 문서 A 가 문서 B 를 링크하고 B 가 웹에서 다른 영역으로 옮겨지면, A 원본은 그대로라 A 는 304 로 건너뛰고 링크는 옛 자리를 가리킨 채 남는다. scratch 사본에서 실측했다(`--root` 대신 임시 디렉터리, 저장소는 건드리지 않음). B 를 `CLE-IX` 에서 `CLE-ACCT` 로 옮긴 뒤 A 를 다시 pull 하면 출력이 `그대로 CLE-A — ETag 같음` 이고 A 의 링크는 `../CLE-IX/CLE-B.md` 그대로였다(새 자리는 `CLE-ACCT/CLE-B.md`). 그때 `check()` 는 `[]` 로 통과했다. 옛 트리 링크 가드는 미러를 제외(`inNervMirror`)하므로 이 부패를 잡는 층이 없다. 부분 스냅샷(D3) 때문에 「대상 파일이 아직 없는 링크」는 의도지만, 이것은 존재했던 파일을 가리키는 **거짓 경로**라 성격이 다르다. `--all` 은 `paths` 를 내려받은 문서로만 만들고 `--task` 는 `paths_for(트리)` 로 만들어 두 모드의 링크 입력도 다르다.
  - 제안: 캐시 키를 「원본 ETag + 이 문서가 참조하는 키들의 배치」로 넓힌다. 예를 들어 렌더 시 참조 키별 상대 경로의 지문을 frontmatter 에 더하고(`mirror_fields` 확장), 다음 pull 에서 ETag 가 같아도 그 지문이 달라지면 재렌더한다(원본 바이트를 다시 받아야 하므로 If-None-Match 를 생략). 또는 `--task` 가 304 여도 지문이 어긋난 문서는 강제 재조회한다. 두 모드가 같은 `paths` 산출 함수를 쓰게 맞추는 것도 함께 한다.

- **[WARNING]** 문서가 말하는 「CI 가 셸·손 편집을 막는다」가 `check()` 의 실제 검사 범위보다 넓다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:21-22` (「그 구멍은 CI … 가 막는다」), `.claude/tools/nerv-mirror/pull.py:255-274` (`check`), `.github/workflows/spec-link-checks.yml:120-124`, `CHANGELOG.md` 신규 항목 「셸 · 손 편집을 잡는다」
  - 상세: `check()` 는 본문 지문(`mirror_sha256`)과 파일 위치(frontmatter 의 `id`·`area`·`type` 로 계산)만 본다. scratch 사본에서 세 경우를 실측했고 모두 `[]` 로 통과했다. (1) frontmatter `status: "draft"` 를 `"approved"` 로 손편집, (2) 본문 지문을 스스로 맞춘 신규 `CLE-FAKE.md` 추가, (3) 미러 파일 삭제. frontmatter 는 `status` · `read_as` · `etag` · `source_paths` 처럼 미러를 읽는 쪽이 소비할 수 있는 값을 담는데 무결성 대상이 아니다. 추가·삭제는 D3(중앙 매니페스트 없음) 때문에 원리적으로 못 잡는다. 또 훅은 `spec/` 전체(옛 트리 포함)를 「동결」로 막지만 CI 는 `CLE-*` 미러만 보므로, 옛 트리를 셸로 고치는 구멍은 훅 docstring 의 주장과 달리 어떤 층도 막지 않는다.
  - 제안: (1) 지문 범위를 「`mirror_sha256` 줄을 뺀 파일 전체」로 넓혀 frontmatter 까지 덮는다(결정성·`render` 의 삽입 순서는 그대로). (2)(3) 과 옛 트리 셸 편집은 의도된 한계로 문서에 못 박는다. 훅 docstring·워크플로 주석·CHANGELOG 문구를 「본문(과 frontmatter) 손편집·이동을 잡는다. 추가·삭제와 옛 트리 셸 편집은 잡지 않는다」로 낮춘다. 옛 트리 동결을 CI 로 지키려면 `spec/` 의 비미러 경로가 base 대비 바뀌었는지 보는 별도 잡이 필요하다.

- **[INFO]** 「NERV 미러 경로」 판정이 세 언어·세 곳에 따로 있고 서로 묶는 테스트가 없다
  - 위치: `.claude/tools/nerv-mirror/pull.py:48,140-146` (`KEY_RE` · `mirror_files`), `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205` (`_NERV_MIRROR_REL`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-259` (`NERV_MIRROR`)
  - 상세: 지금은 일치한다. 이 저장소 `spec/` 의 `*.md` 557개에서 세 판정이 잡은 집합이 모두 170개(미러 169 + README)로 같았고 차이는 0이었다. 그러나 각 테스트는 자기 판정만 고정한다(`test_is_nerv_mirror`, `inNervMirror matches only mirror paths`). 단계 4e·5 에서 미러 규칙(폴더 깊이, 키 문자)이 바뀌면 세 곳을 따로 고쳐야 하고 하나만 놓쳐도 조용히 갈라진다. 같은 이유로 `spec/` 를 훑는 다른 walker(예: `stray-tool-tags.test.ts` 의 `SCAN_ROOTS` 에 `spec`)는 제외 대상에 넣을지 판단한 흔적이 없다(그 가드가 미러에서 통과하는지는 이 리뷰에서 확인하지 않았다).
  - 제안: `test_mermaid_lint_ready.py` 의 교차 언어 결속 방식을 따라, 저장소 `spec/` 를 실제로 훑어 `pull.mirror_files` 집합과 orchestrator·TS 판정 집합이 같음을 단언하는 테스트 하나를 둔다. orchestrator 는 지금 `collect_markdown_files` 로 전부 훑은 뒤 버리는데(`:806-807`), 판정을 수집 함수의 skip 인자로 넣으면 세 호출부가 같은 필터를 쓴다.

- **[INFO]** 훅이 정책과 입력 파싱을 스크립트에 그대로 두어 `_lib` 관례와 어긋나고 `_read_payload` 사본이 8번째가 된다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:34-80`
  - 상세: 형제 훅(`guard_default_branch_edit.py`)은 스크립트를 얇게 두고 정책을 `_lib/branch_guard.py` 에 둔다. 여기는 `OWNED_ROOTS` · `checkout_root` · `owned_root` 가 스크립트 안에 있다. 테스트가 서브프로세스로만 돌려 `owned_root` 를 단위로 못 붙는다. `_read_payload` 는 같은 본문이 이미 7곳에 있고(`_lib/failopen_state.py` 도크스트링이 스스로 경고한 복제 클래스), 이 파일이 더한다. 단계 2·3 에서 `OWNED_ROOTS` 에 `review`·`plan` 을 더하는 확장 축(딕셔너리 한 줄)은 잘 잡혀 있다. 또 `first in OWNED_ROOTS` 비교가 대소문자를 구분한다. macOS 기본(APFS 대소문자 무시)에서는 `Spec/…` 로 쓴 파일이 실제 `spec/` 에 들어가 통과한다(에이전트가 그렇게 쓸 가능성은 낮다).
  - 제안: 정책(`OWNED_ROOTS` · `owned_root`)을 `_lib/nerv_owned_paths.py` 로 옮기고 훅은 얇게 둔다. `first.casefold()` 로 비교한다. `_read_payload` 공용화는 별도 정리로 미뤄도 된다.

- **[INFO]** `pull.py` 한 파일이 여러 책임을 지고 `cmd_task` 는 모듈 전역 `load_env` 를 바꿔 끼워야 테스트된다
  - 위치: `.claude/tools/nerv-mirror/pull.py:244-250` (`load_env`), `:296-331` (`cmd_task`), `.claude/tests/test_nerv_mirror_pull.py:247-254` (`pull.load_env = lambda: fake`)
  - 상세: 순수 렌더(파싱·링크·frontmatter), 파일 적용(`apply`), HTTP(`Nerv`), 환경 로딩, README 생성, `--check`, CLI 가 396줄 한 파일에 있다. 규모에서는 감당되지만 `cmd_task` 가 클라이언트를 인자로 받지 않고 전역 함수로 얻어 테스트가 모듈 속성을 덮어쓰고 복구한다. 이미 `Nerv.get` 이 대역 경계 역할을 하므로 `cmd_task(spec_root, task, keys, nerv=None)` 로 주입하면 전역 패치가 사라진다. 「영역 폴더」 규칙도 `docs_from_zip`(zip 경로), `area_map`(트리), `check`(frontmatter)에 세 벌 있다. `test_area_map_matches_the_export_layout` 과 저장소 미러 자기검사가 묶고 있어 지금은 문제가 없다.
  - 제안: `cmd_task` 에 클라이언트 주입 인자를 추가한다. 카탈로그 영역 목록(`EXCLUDED_AREAS`)이 상수로 박혀 있어 새 카탈로그 영역이 생기면 코드를 고쳐야 하는 점은 D4 를 따른 결과이므로 그대로 두되, 그 사실을 상수 옆에 적어 두면 좋다.

- **[INFO]** `spec-mirror-integrity` 잡이 링크 가드용 `changes` 판정을 공유해 no-op 문구가 실제 조건과 다르다
  - 위치: `.github/workflows/spec-link-checks.yml:125-140` (특히 `:133`)
  - 상세: `changes` 의 pathspec 은 `codebase/**` · `plan/**` 을 포함한다. 그래서 이 잡은 코드만 바꾼 PR 에서도 실행되고(5초 안팎이라 비용은 무시할 수준), skip 문구 「spec · .claude 경로 변경 없음」은 실제 판정 조건과 맞지 않는다. 워크플로 이름·헤더는 여전히 「docs 가드」 설명뿐이라 두 번째 관심사가 들어온 흔적이 없다. 잡의 필요 경로는 `spec/**` · `.claude/tools/nerv-mirror/**` 로 더 좁다.
  - 제안: 별도 `changes` 호출(좁은 pathspec)을 쓰거나 skip 문구를 판정 조건에 맞춘다. 헤더 주석에 미러 무결성 잡을 한 줄 더한다.

### 요약

단계 1 의 구조는 방향이 옳다. 미러를 쓰는 주체를 도구 하나(`pull.py`)로 좁히고, 도구 편집은 훅, 나머지는 CI 가 받는 3층 방어에 `OWNED_ROOTS` 확장 축과 결정적 출력 · 지문 · ETag 라는 검증 가능한 계약이 붙어 있다. 순환 의존은 없고 레이어 경계(하네스 도구/훅과 codebase 테스트 헬퍼)도 지켜졌다. 남는 문제는 두 가지다. 첫째, 증분 갱신의 캐시 키가 링크 재작성의 입력(트리 배치)을 빠뜨려 실측으로 링크 부패가 재현되고 `--check` 도 통과한다. 둘째, 무결성 검사의 범위(본문 지문 · 위치)가 문서·CHANGELOG 가 말하는 보장(셸·손 편집 차단, 옛 트리 동결)보다 좁아 frontmatter 편집이 그대로 통과한다. 미러 판정이 세 곳에 복제된 점은 지금 일치(170/170/170)하므로 결속 테스트 하나로 닫을 수 있다. 실험은 전부 scratch(`/private/tmp/.../review-scratch/architecture/`)와 임시 디렉터리에서 했고 저장소 트리는 바꾸지 않았다(`git status --short` 에는 리뷰 산출 디렉터리만 보인다).

### 위험도
MEDIUM
