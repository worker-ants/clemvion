# RESOLUTION — 18_32_41 (`changes` 잡 reusable workflow 추출)

**Critical 0 · WARNING 4 · INFO 8 · risk MEDIUM.** router 가 7명 선별(= forced 화이트리스트
전원), 7/7 리포트 확보 — `forced_missing=[]`, `unfinished=[]`.

**4건 전부 수정.** 둘은 문서 drift, 둘은 **내가 주석에서 이름까지 붙여 놓고 테스트로는 안
고정한 위험 클래스**다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | documentation | 이 커밋이 끝낸 작업이 **두 plan 에서 여전히 `[ ]`** — 저장소가 "plan 체크박스 = 실제 상태" 를 규약으로 세워 둔 바로 그 위반 | **수정.** 둘 다 `[x]` + 완료 근거. `backend-lint-gate` 쪽은 reviewer 제안대로 **범위를 쪼갰다** — `changes` 잡 추출은 완료, **셋업 보일러플레이트 추출은 별도 후속**으로 남겼다(잡마다 필요한 도구가 달라 composite action 쪽이 맞고, 그 판단은 4번째 워크플로의 셋업을 보고 하는 편이 낫다). `ci-required-check-skip-jobs` 쪽에는 **W8(clone 비용)이 이 추출로 해소되지 않는다**는 것도 명시했다 — 잡 수가 그대로라 clone 도 그대로다 |
| W2 | documentation | README 카탈로그의 `test_required_check_skip_jobs.py` 행이 같은 커밋이 그 파일에 넣은 신규 계약(인디렉션 추적 · 자기등재 요구 · YAML 파싱 전환)을 반영 못함 | **수정.** 세 가지를 다 적었다 — 특히 "호출부만 보면 그 한 파일이 출력 배선을 잃어도 세 스위트가 초록" 이라는 위험을 명시 |
| **W3** | testing | 워크플로 주석이 **이름으로 지목한** 파손 클래스("공백 포함 pathspec")에 회귀 테스트가 없다 | **수정.** `path with space.yaml` 케이스 추가. 지금 저장소 pathspec 에 공백이 없다는 사실은 **이 코드가 견딘다는 증거가 아니다** — 인용 없이 넘기면 인자 3개로 갈려 판정이 `false` 로 떨어진다 |
| **W4** | testing | `run:` 에 `${{ }}` 를 직접 끼워 넣지 않는다(인젝션 회피)는 불변식이 단언으로 고정돼 있지 않다 | **수정.** `assertNotIn("${{", detect_run_block())`. 한 줄 끼워 넣기가 쉬운 자리라 값이 셸 **코드**로 읽히는 경로가 조용히 열린다 |

### 미조치 (INFO 8건)

판단이 필요했던 셋만 기록한다:

- **INFO 1** (actions 를 SHA 가 아니라 이동 가능 태그 `@v7` 로 고정) — **하지 않았다.**
  이번 diff 가 만든 것이 아니라 **기존 10개 워크플로의 관례를 그대로 옮긴 것**이다. 여기
  하나만 SHA 로 바꾸면 저장소 안에 두 관례가 생긴다. 전역 정책으로 다룰 항목이다.
- **INFO 4** (인라인 잡 → reusable 호출 전환으로 GitHub **체크 이름 표시**가 바뀔 수 있다)
  — reviewer 도 위험을 낮게 봤지만, 이 저장소는 지금 required check 등록을 앞두고 있어
  이름이 바뀌면 등록이 어긋난다. **머지 후 Actions 에서 실제 표시 이름을 1회 확인**하는
  것을 plan §사용자 액션 에 남겼다. 코드로 미리 단언할 수 있는 값이 아니다.
- **INFO 3** (`run_with()` 의 임시 디렉터리 미정리) — 저장소 안에 정리/미정리가 혼재해
  관례가 없다. 테스트가 만드는 것은 파일 3개짜리 디렉터리 하나이고, 정리 코드를 넣으면
  실패 시 **증거가 사라져** 디버깅이 어려워지는 쪽이 더 비싸다고 봤다.

INFO 2(세 워크플로 간 주석 일관성)·5(서브셸 대신 파라미터 확장)·6(`on:` 파싱 헬퍼 중복)은
스타일이고, 7·8 은 이미 다른 항목으로 다뤘다.

## TEST 결과

- lint : **PASS** (68s)
- unit : **PASS** (95s)
- build : **PASS** (119s)
- e2e : **면제** — 변경 set 이 `.github/**` + `.claude/**` 뿐이다(`git diff --name-only`
  로 확인, `codebase/**`·`scripts/**` 0건). `PROJECT.md §e2e 면제 화이트리스트` 의
  「`.claude/**` (skills, hooks, agents 정의)」·「`.github/**` (CI 정의는 e2e 가 검증 대상
  아님)」·「`*.md` 본문」의 **부분집합**이다. 자가 영향 추정이 아니라 목록 대조다.
- harness : **975 tests OK** (fix 후 재실행. 신규 11건)

### 뮤테이션 — 새 가드가 실제로 잡는지

| 뮤턴트 | 결과 |
|---|---|
| `"${FILTERED[@]}"` → 인용 없이 `$PATHSPECS` | **RED** (글로브 조기 확장 테스트) |
| `workflow_call` 출력이 오타난 잡을 가리킴 | **RED** (배선 가드) |
| 호출부 pathspec 에서 `_changed-paths.yml` 등재 제거 | **RED** (등재 가드) |

두 번째 뮤턴트가 **내 주석의 주장을 반증**했다 — "인용 없이 넘기면 전부가 한 덩어리 인자
1개" 라고 적었으나 bash 는 IFS 에 개행이 있어 인자 수는 맞게 갈린다. 실제로 깨지는 것은
**글로브 확장**이다. 주석을 실측대로 정정했다.

## 보류·후속 항목

`plan/in-progress/backend-lint-gate-broken-on-main.md` §후속:

- 셋업 보일러플레이트(checkout·pnpm·setup-node·install) composite action 추출 —
  4번째 워크플로의 셋업을 보고 판단

`plan/in-progress/ci-required-check-skip-jobs.md` §후속:

- W8(`fetch-depth: 0` clone 비용)은 **미해소** — 해소하려면 세 워크플로를 합치거나 판정
  결과를 공유해야 하는데 required check 이름 구성을 바꾸는 별 축이다
- 머지 후 Actions 에서 **체크 표시 이름 1회 육안 확인** (INFO 4)
