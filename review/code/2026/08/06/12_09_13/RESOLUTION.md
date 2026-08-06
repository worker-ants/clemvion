# RESOLUTION — 7R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 5 / WARNING 12.** RISK=CRITICAL.

## C4 가 이번 라운드의 실제 수확 — 가드 우회가 아니라 살아있는 결함

나머지 넷은 "가드가 뚫린다" 인데, **C4 는 이미 enforce 중인 로컬 push/stop 훅의 fail-open** 이다.

`_run_git` 이 stdout 전체에 `.strip()` 을 걸었다. `git status --porcelain` 에서 가장 흔한 형태 —
추적 중인 파일이 수정됐지만 스테이지 안 됨 — 는 **`" M path"`, 선행 공백**이다. 그 공백이
지워지면서 `_porcelain_path` 의 고정폭 파싱이 경로 첫 글자를 깎았다. 직접 재현:

```
strip 전: ' M codebase/backend/src/a.ts'
strip 후: 'M codebase/backend/src/a.ts'
파싱 결과: code='M ' path='odebase/backend/src/a.ts'   ← 첫 글자 유실
```

그 경로는 아무것과도 매칭되지 않으므로 파일이 "방금 편집됨" 신호를 잃고, 게이트는 변경을 못 본
채 통과한다. **공격이 아니라 "파일 하나 고치고 push"** 라는 일상 흐름이다.

`.rstrip()` 으로 고쳤다 — 다른 호출부(`rev-parse`/`merge-base`/`log`)는 후행 개행만 없으면 되고
의미 있는 선행 공백을 만들 수 없다. 회귀 테스트는 실제 임시 git 저장소로 세 형태를 고정한다
(`" M"` 미스테이지 / `"M "` 스테이지 / `"??"` 미추적) — 헬퍼만 부르면 `.strip()` 이 어디서
일어나는지를 못 본다.

## C1·C2 — 정적 스캔이 세 번째로 뚫렸고, 이번엔 행위로 반전했다

- **C1**: `_SCANNED` 가 게이트가 **위임하는** `_shared/report_paths.py`·`block_integrity.py` 를
  안 봤다. 거기에 `GITHUB_JOB == "gate"` 세 줄이면 강제 리뷰어가 리포트를 안 남긴 세션이
  CI 에서만 "완전 커버" 로 뒤집힌다(3명이 서로 다른 진입점으로 실증).
- **C2**: 스캔 대상 **안**에서도 `dict(os.environ.items()).get(...)`, `for k in os.environ`,
  동적 조립 키는 수집기가 인식하지 못한다.

열거를 늘리는 대신 **실물 게이트를 두 번 판정시켜 결과가 같은지** 본다 — 한 번은 최소 환경,
한 번은 GH Actions 컨텍스트 14개를 채운 환경. 어떤 파일에서 어떤 문법으로 환경을 읽든 그것이
판정을 바꾸면 어긋난다. 스텁이 아니라 실물이라 `_shared` 까지 실제로 돈다 —
`VerdictComesFromTheGateTest` 는 `review_guard.py` 를 통째로 교체해 그 둘을 한 번도 안 돌리고,
그 빈자리가 정확히 C1·C2 였다. 비교가 vacuous 해지지 않게 "픽스처가 실제로 차단을 만드는가" 도
함께 단언한다.

> **뮤테이션을 두 번 돌렸다.** 1차는 둘 다 GREEN 이었는데, 앵커로 쓴
> `os.environ.get("CLAUDE_PROJECT_DIR")` 줄이 `evaluate_review` 가 아니라
> `_resolution_marker_dir` 안이었다 — 뮤턴트가 적용은 됐지만 **판정을 안 바꾸는 무효 뮤턴트**
> 였다. AST 로 `evaluate_review` 의 첫 실행문을 찾아 다시 넣으니 둘 다 RED.
> 적용 여부만 확인하고 유효성을 안 보면 거짓 GREEN 이 된다.

## C3 — identity 정의가 GitHub 과 달랐다

`(name, job)` 유일성이 YAML **dict key** 를 봤는데, GitHub 이 체크 이름으로 노출하는 것은
`jobs.<id>.name` 이 있으면 그 값이다. `name: gate` override 로 `review-gate / gate` 를 참칭하는
always-green 워크플로를 심을 수 있었다. 여기에 `_PULL_REQUEST_KEYS` 가 **필터 없는 bare
`pull_request:`** 를 "dict 가 아니다" 는 이유로 건너뛴 결함이 겹쳤다 — 가장 위험한 형태인데
검사 대상 밖이었다. 둘 다 닫았다.

## C5 / WARNING

| # | 내용 | 처분 |
|---|---|---|
| C5 | 모듈 docstring 이 "Two invariants" 인데 실제 8개 이상 | 개수 비의존 문구로 |
| W8 | plan §배선가드 소제목 "네 라운드" 가 아래 표(1R~6R)와 모순 | 다음 커밋에서 함께 |
| W1·W2·W3~W7·W9~W12 | `permissions` 명시 · 등재제 공통 추상화 · 클래스/메서드 분해 · README 카탈로그 · 세션 디렉터리 원자성 · 동적 키 명시 실패 | 미처분 — 구조/문서이거나 별도 skill 범위 |

## 검증

- harness 스위트 **840 tests OK**.
- mutation **5종 전부 RED**: `.strip()` 회귀 · `_shared` env 분기 · `os.environ.items()` 우회 ·
  job `name:` override 참칭 · bare `pull_request:`.
