# 유지보수성(Maintainability) 리뷰 — 라운드 2

대상은 NERV 정본 전환 단계 1의 `d82040273..8a45684cd` 범위다(미러 커밋 d82040273 · ad8662bd5 는 범위 밖).
라운드 1 유지보수성 리뷰(`review/code/2026/09/29/12_50_13/maintainability.md`)를 먼저 읽고 닫힘 여부를 확인했다.
저장소 파일은 건드리지 않았다. 읽기 전용으로 `pytest test_guard_nerv_owned_paths.py test_nerv_mirror_pull.py` 를 1회 돌렸고 58건 통과, 작업 트리 상태 변화 없음(`git status --short` 동일).

## 라운드 1 지적의 닫힘 여부

| 라운드 1 지적 | 상태 | 근거 |
| --- | --- | --- |
| 미러 판정 세 곳에 결속 테스트 없음 | 닫힘 | `MirrorPredicateParityTest`(`test_nerv_mirror_pull.py:585`)가 실제 `spec/` 위에서 세 판정을 대조한다 |
| 오케스트레이터 회귀 테스트 공허 | 닫힘 | `test_consistency_bundle_priority.py:966-967` 이 미러 존재를 먼저 단언한다. 프런트도 특정 키 대신 `inNervMirror` 로 고른다 |
| 훅 docstring 깨진 문장 | 닫힘 | "늘어난다" 로 고쳐졌다 |
| `Nerv.get` 이 버리는 헤더 파싱 | 닫힘 | `(status, body)` 만 반환한다 |
| `cmd_task` 4번 반복 오류 처리 · 경로 접두 혼재 | 부분 | `get_ok` 로 반복은 줄었다. 접두 혼재 이유는 docstring 에 적혔다(`pull.py:41-42`). `cmd_task` 는 오히려 커졌다(아래 W1) |
| 매직 값 | 부분 | `SOURCE_LINE_WINDOW` · `CURL_MAX_TIME` 이 생겼다. UA 문자열(`:318`)과 `parents[3]`(`:508`)은 남았다. 깊이 3 초과 zip 경로는 이제 오류다(`:244`) |
| CLI metavar · 모드 밖 옵션 | 닫힘 | `TASK` 로 고쳤고 `parser.error` 로 거절한다 |
| 훅 죽은 `except ValueError` | 닫힘 | 제거됐다. 이름 규칙 · `import traceback` 위치는 남았다(I7) |
| 단계 · 결정 번호 정의 없음 | 부분 | D1~D4 는 본문이 뜻을 풀어 쓴다. "단계 4e" · "단계 5" 는 여전히 정의가 없다(I3) |
| 테스트 중복 · 결합 | 부분 | `nerv=` 주입으로 `load_env` 교체는 사라졌고 `FakeNerv` 는 접두를 단언한다. 나머지는 I5 · I6 |

## 발견사항

- **[WARNING]** `cmd_task` 가 라운드 1 이후 더 커졌고, ETag 결정 블록이 4단 중첩에 같은 계산이 두 곳에 있다
  - 위치: `.claude/tools/nerv-mirror/pull.py:410-454`(블록은 `:433-444`), 같은 계산 `:178` · `:443`, 형식 검증 `:441` · `:314-315`
  - 상세: 함수가 약 45줄이고 `for` → `if cached … exists` → `try`/`if`/`if` 로 4단까지 내려간다. 블록 하나가 "조건부 요청을 할지" 를 정하는데 `etag = None` 이 네 곳(`:435`, `:440`, `:442`, `:444`)에 흩어져 있다. 이 블록이 `--task` 의 핵심 불변식(캐시가 미러와 같은 버전일 때만 304 를 믿는다)이라 가장 자주 읽힐 자리다. 또 `"sha256-" + hashlib.sha256(raw).hexdigest()` 가 `render`(`:178`)와 `cmd_task`(`:443`)에 따로 있고 테스트도 같은 식을 세 번 적는다. ETag 형식 검증은 `cmd_task` 가 조용히 버리고(`:441`) `Nerv.get` 이 예외로 막는다(`:314`). 같은 입력에 두 가지 반응이라 한쪽만 바뀌어도 테스트가 모른다.
  - 제안: `etag_of(raw: bytes) -> str` 하나와 `_conditional_etag(existing: Path, cached: bytes | None) -> str | None` 을 뽑는다. `cmd_task` 루프는 "etag 구하기 → 요청 → 304 면 캐시 재사용 → 캐시 쓰기 → Doc 추가" 다섯 줄이 된다. 그러면 `ETAG_RE` 검증은 `_conditional_etag` 한 곳에만 둘 수 있다.

- **[INFO]** 훅이 이 저장소를 알아보는 표지(`MARKER`)가 `pull.py` 경로에 묶여 있는데 그 결합이 어디에도 적혀 있지 않다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:42-43`, `.claude/tests/test_guard_nerv_owned_paths.py:37`
  - 상세: `pull.py` 를 옮기거나 이름을 바꾸면 훅이 조용히 꺼진다(`owned_root` 가 None 을 돌려주고 fail-open). 테스트는 `MARKER` 를 자기 사본으로 임시 저장소에 심어서 실제 저장소에 표지가 있는지 묻지 않는다. 다행히 `test_nerv_mirror_pull.py:44-45` 가 import 시점에 `pull.py` 를 읽어 그 경로가 바뀌면 그쪽이 먼저 깨진다. 그러나 그 실패 메시지는 훅을 고치라고 알려 주지 않는다. 훅의 주석은 "main checkout 과 워크트리 모두 루트에 있다" 까지만 적는다.
  - 제안: 훅 주석에 "이 경로를 옮기면 훅이 꺼진다" 를 한 줄 적고, 테스트에 `(REPO_ROOT / MARKER).is_file()` 단언 하나를 더한다. 훅 모듈에서 `MARKER` 를 읽어 오면 사본 두 벌도 없어진다.

- **[INFO]** 코드 docstring 에 "이 PR" · "이 세션" 이 들어 있어 머지 뒤에는 가리키는 대상이 없다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:10`, `.claude/tests/test_guard_nerv_owned_paths.py:19`, `.claude/tests/README.md:67`(`the session that wrote this hook`)
  - 상세: CHANGELOG 는 시점 문서라 괜찮지만 모듈 docstring 은 오래 남는다. "2026-10-01 이 PR 을 만들던 세션에서 실측" 은 몇 달 뒤에 읽으면 어느 PR 인지 알 수 없다.
  - 제안: "2026-10-01 실측(Task `CLE-T-VA4YA1`)" 처럼 날짜와 Task 키로 바꾼다. 커밋 해시를 적어도 된다.

- **[INFO]** "단계 4e" · "단계 5" 가 저장소 안에서 정의되지 않는다. 생성물에도 들어간다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:199`, `.claude/tests/test_consistency_bundle_priority.py:961`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:254`, `.claude/tools/nerv-mirror/pull.py:475`
  - 상세: 훅 docstring 은 단계 1~3 만 정의한다(`:16-20`). 4e · 5 는 NERV 쪽 계획에만 있다. `pull.py:475` 는 이 문구를 `spec/README.md` 출력에 박아 넣으므로 `--all` 을 돌릴 때마다 정의 없는 단계 번호가 미러에 다시 쓰인다. plan/ 이 사라지는 흐름이라 나중에 근거를 찾을 곳이 없다.
  - 제안: 단계 목록이 있는 NERV 키(Task 또는 스펙)를 한 번 적는다. 훅 docstring 의 단계 목록을 4e · 5 까지 늘려 저장소 안의 기준으로 삼아도 된다.

- **[INFO]** `PullError(SystemExit)` 와 `RuntimeError` 가 섞여 있고, 테스트는 넓은 `SystemExit` 으로 받는다
  - 위치: `.claude/tools/nerv-mirror/pull.py:85`, `:321`, `:337`, `.claude/tests/test_nerv_mirror_pull.py:209`, `:232`, `:245`, `:253`, `:255`, `:260`, `:271`, `:421`
  - 상세: 사용자 오류는 `SystemExit` 의 하위 클래스라 `mirror_relpath` · `area_map` 같은 작은 함수가 `BaseException` 계열을 던진다. `main` 은 `RuntimeError`(curl 실패, 응답 해석 실패)를 잡지 않아 네트워크 실패만 traceback 으로 끝난다. 테스트 대부분은 `assertRaises(SystemExit)` 만 쓴다. `pull_all` 이 `main` 을 거치므로 인자 해석 오류(argparse 의 `SystemExit(2)`)도 같은 단언을 통과한다.
  - 제안: `PullError(Exception)` 으로 바꾸고 `main` 이 `PullError` 와 `RuntimeError` 를 잡아 `pull: …` 한 줄과 exit 1 로 끝낸다. 테스트는 `assertRaises(pull.PullError)` 로 좁힌다. 지금 구조를 유지하면 적어도 메시지 정규식을 더한다(이미 몇 곳은 그렇게 한다).
  - 참고(보안 쪽 영역): `Nerv.__init__` 의 로컬 예외(`pull.py:306`)는 접두 비교라 `http://localhost.evil.example` 도 통과한다. 호스트 경계까지 보는 비교가 필요하다. 유지보수성 관점에서는 같은 줄의 조건이 길어 `LOCAL_HTTP_PREFIXES` 같은 이름이 있으면 읽기 쉽다.

- **[INFO]** "영역 문서는 자기 폴더" 규칙이 세 곳에 따로 있고, 경로 맵 구성도 여러 모양이다
  - 위치: `.claude/tools/nerv-mirror/pull.py:246`(zip 깊이), `:270-272`(`type == "area"`), `:369-370`(`check`), `:396`(`paths = {d.key: d.relpath …}`), `:182`(`head.insert(len(head) - 1, …)`), 테스트 `.claude/tests/test_nerv_mirror_pull.py:146`
  - 상세: 라운드 1 이 지적한 세 곳이 그대로다. `check` 에는 이유 주석이 생겼지만 규칙이 바뀌면 여전히 세 곳을 고쳐야 한다. `{d.key: d.relpath for d in docs}` 는 `cmd_all` 과 테스트가 각자 짠다. `render` 는 `head` 를 리스트로 만든 뒤 "지문은 etag 앞" 이라는 자리를 인덱스 산술로 끼워 넣어서, `MIRROR_FIELDS` 의 순서(`:77`)와 이 삽입 위치가 암묵적으로 같아야 한다. 필드가 하나 더 생기면 조용히 어긋난다.
  - 제안: 폴더 결정을 `folder_of(key, type_, area)` 한 함수로 모으고 세 곳이 부른다. `paths_of(docs)` 를 `cmd_all` 과 테스트가 공유한다. `render` 는 `{필드: 값}` 순서 있는 dict 로 만든 뒤 마지막에 한 번 직렬화하면 삽입 인덱스가 필요 없다.

- **[INFO]** 미러 판정 세 정의가 서로와 결속 테스트를 가리키지 않는다
  - 위치: `.claude/skills/consistency-checker/scripts/consistency_orchestrator.py:197-205`, `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:251-259`, `.claude/tools/nerv-mirror/pull.py:190-194`
  - 상세: 라운드 1 의 제안 중 "최소한 주석" 은 받아들여지지 않았다. 결속 테스트가 있어 어긋나면 RED 가 나지만, 그 RED 는 `test_nerv_mirror_pull.py` 에서 난다. 오케스트레이터나 TS 만 고치는 사람은 자기 정의 옆에서 그 테스트의 존재를 모른다. 테스트 쪽도 `test_is_nerv_mirror`(7건), 프런트 `inNervMirror` 테스트(9건), 프런트의 인라인 정규식(`spec-link-integrity.test.ts:89`)이 제각각 케이스 표를 든다.
  - 제안: 두 정의의 주석에 "`MirrorPredicateParityTest`(test_nerv_mirror_pull.py)가 pull.py · 프런트와 같은 집합을 고르는지 본다" 를 한 줄 적는다.

- **[INFO]** 테스트 비계(scaffolding) 세부
  - 위치: `.claude/tests/test_consistency_bundle_priority.py:971-973`, `.claude/tests/test_nerv_mirror_pull.py:514-528` · `:618` · `:74-77`, `codebase/frontend/src/lib/docs/__tests__/tree-walk.test.ts:118-123` · `:156-157`
  - 상세:
    - 새 테스트가 `class Args: spec = plan = … = None` 스니펫을 여섯 번째로 복사했다(`:971-973`, 기존 다섯 곳은 `:490` · `:612` · `:695` · `:852` · `:907`). 같은 파일의 `_PREAMBLE` 이 이미 `extra=` 로 공용 헬퍼(`five_system_copy`)를 싣는다.
    - `CurlBoundaryTest.setUp` 은 환경 변수 저장 · 복원을 손으로 짜고(`:519-528`) `self.env` 는 어디서도 읽지 않는다(`:514`). 라운드 1 이 `mock.patch` 관례를 짚었고 `mock.patch.dict(os.environ, …)` 면 `_saved` · `_restore` 가 사라진다.
    - `assertGreater(len(tool), 100)`(`:618`)의 100 은 지금 미러 169편에서 고른 값이다. D3 로 미러가 부분 스냅샷이 되는 흐름과 어긋날 수 있다. 공허함을 막는 용도라면 `> 0` 이면 충분하다.
    - `CLE-ACCT-NOTE` 픽스처 설명("여섯째 줄 뒤에 나오는 원문", `:76`)이 실제와 다르다. 이 문장은 본문 3번째 줄(머리 5줄 안)에도 나온다. 그래서 `>` 없는 줄이 무시됨을 검증하지만 설명만 읽으면 머리 밖 줄을 검증하는 것으로 읽힌다.
    - `tree-walk.test.ts` 는 "각 수집기의 옵션 배선을 합성 트리에서 양성으로 겨눈다" 는 규칙을 스스로 적어 두었다(`:107-110`). 새 `inNervMirror` 필터는 합성 트리(`:118-123`)에 미러 파일이 없고 주석만 고쳤다(`:156-157`). 실저장소 기반 검증은 `spec-link-integrity.test.ts` 가 하므로 공허하지는 않지만, 이 파일의 규칙에는 맞지 않는다.
  - 제안: `Args` 는 `_PREAMBLE` 의 `extra=` 로 `make_args(**kw)` 를 싣는다. 나머지는 각 항목의 한 줄 수정이다. `tree-walk.test.ts` 는 합성 트리에 `spec/CLE-X.md` · `spec/README.md` 를 심고 기대 목록을 그대로 두면 된다.

- **[INFO]** 테스트 모듈 docstring · README 행이 같은 목록을 두 번 적고 이미 어긋났다
  - 위치: `.claude/tests/test_nerv_mirror_pull.py:9-22`, `.claude/tests/README.md:66`
  - 상세: 모듈 docstring 의 "고정하는 것" 목록에는 `CiWiringTest` 와 `MirrorPredicateParityTest` 가 없다. README 행에는 Parity 는 있고 `CiWiringTest` 가 없다. 같은 내용을 한 곳만 원문으로 두지 않으면 다음 테스트 클래스가 생길 때 둘 중 하나가 또 빠진다. README 의 다른 행도 길게 적는 것이 이 저장소의 관례라 독립된 결함은 아니다.
  - 제안: README 행을 docstring 요약 한두 문장으로 줄이고 나머지는 모듈 docstring 을 가리키게 한다. 최소한 두 곳에 빠진 클래스를 더한다.

- **[INFO]** 훅 내부 이름 규칙 · `import` 위치가 형제 훅과 다르다
  - 위치: `.claude/hooks/guard_nerv_owned_paths.py:50` · `:61` · `:73` · `:81` · `:115-121`
  - 상세: `_read_payload` · `_target` 은 비공개 표기인데 `checkout_root` · `owned_root` 는 공개 표기다(테스트는 서브프로세스로만 부르므로 공개 이유가 없다). `import traceback` 이 `except` 안에 있다. 형제 `guard_default_branch_edit.py` 는 파일 상단에서 import 한다. 라운드 1 이 짚었고 죽은 `except` 만 고쳐졌다.
  - 제안: `checkout_root` · `owned_root` 앞에 `_` 를 붙이고 `import traceback` 을 상단으로 올린다.

## 좋은 점

- 훅은 docstring 을 빼면 코드가 약 90줄이고 책임이 하나다. 판정 함수(`owned_root`)가 입출력과 분리돼 있다. 차단 메시지는 대상 · 이유 · 대안 · 우회 네 줄로 읽기 쉽다.
- `pull.py` 는 순수 함수(`render` · `rewrite_links` · `area_map` · `check`)와 I/O(`Nerv` · `write_if_changed`)가 나뉘어 있고 대부분 25줄 안이다. `cmd_task` 만 예외다.
- 테스트가 공허 방지 단언(`assertTrue(mirror, …)`, `assertIsNotNone(literal, …)`, `assertEqual(…, 0)` 전의 타깃 존재 확인)을 습관처럼 갖고 있다.
- 새 CI 잡의 생략 메시지가 공유 pathspec 범위와 맞게 고쳐졌다(라운드 1 지적 해소).

### 요약

라운드 1 의 유지보수성 지적은 대부분 닫혔고, 고친 과정에서 새로 생긴 구조적 문제는 `cmd_task` 하나다. 테스트 주입(`nerv=` · `cache=`)과 `get_ok` 로 구조가 나아졌지만 ETag 결정 로직이 한 함수 안에서 4단 중첩으로 불어났고, 같은 해시 계산과 형식 검증이 두 곳에 있다. 이것을 작은 함수 둘로 뽑으면 이 파일에서 가장 자주 읽힐 자리가 정리된다. 나머지는 모두 참고 수준이다. 대표적으로 훅 표지와 `pull.py` 경로의 숨은 결합, 정의 없는 단계 번호 "4e · 5", 에러 모델 혼재, 테스트 비계의 사소한 중복이 있다. 동작을 해치거나 이후 작업을 막는 항목은 없다.

### 위험도
LOW
