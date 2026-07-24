# RESOLUTION — review/code/2026/07/24/10_47_09

대상: branch `claude/push-guard-worktree-scope-20044c`, 커밋 `26c8e86a3`(origin/main #1003 흡수).
판정: **RISK=CRITICAL / CRITICAL=1 / WARNING=4 / INFO=11**. forced 7/7 확보.

## CRITICAL 1 — **재현되지 않는다** (근거 있는 미조치)

security 리뷰어: *"`_is_git_push()` 가 길이 상한 검사보다 **먼저** 원본 전체에
`_GIT_PUSH.search()` 를 실행 → O(n²) ReDoS 재현(688KB 에서 **~58초**)"*.

**호출 순서는 맞다** — 실제로 `search` 가 `len(command) > _MAX_REDACTION_INPUT` 보다 앞에 있다.
그러나 **느리다는 결론이 실측과 어긋난다.** 리뷰어가 서술한 형태를 포함해 6가지 적대적 입력을
리뷰어 규모(~688KB)로 측정한 결과 **전부 0.000s**:

| 입력 형태 | 길이 | 시간 |
|---|---|---|
| 공백 없는 세그먼트 `;` 다수 | 697KB | 0.000s |
| `git ` 접두 세그먼트 `;` 다수 | 715KB | 0.000s |
| `git` + 공백 다수 | 484KB | 0.000s |
| 단일 긴 `git` 세그먼트 | 340KB | 0.000s |
| `\|` 구분 다수 | 715KB | 0.000s |
| env 접두 반복 | 627KB | 0.000s |

스케일링도 선형이다(세그먼트 2,000 → 16,000 에서 전부 0.000s).

**그리고 결정적으로, 이 함수는 내 diff 가 아니다**:
- `_is_git_push` 소스가 `origin/main` 과 **byte-identical**(`inspect.getsource` 비교 `True`).
- 두 버전을 같은 입력으로 벤치했을 때 **동일하게 빠르다**.

즉 (a) 결함이 재현되지 않고 (b) 설령 있더라도 origin/main 이 소유한 코드다. **미조치**하되,
재현 가능한 입력이 제시되면 그때 별건으로 다룬다. 조치했다면 origin/main 의 frozen 정규식
경로를 근거 없이 건드리는 셈이었다.

## WARNING 4건 — 2건 반영, 2건 근거 있는 미조치

| # | 조치 |
|---|---|
| **1** `README.md:47` GFM 표 파손 | **반영** — 실측: 구조 파이프가 `[0, 33, 1224]` 로 **셀 안에 리터럴 `\|`** 가 있고 닫는 파이프가 없다. GFM 은 헤더(2열) 초과분을 버리므로 §J 설명 문단이 렌더링에서 사라진다. `@1224` 를 `\\\|` 로 이스케이프하고 행 끝에 닫는 `\|` 추가 → 구조 파이프 3개(2열 정합). **`origin/main`(#1003) 유래**임을 `git show` 로 확인했고, 그쪽에도 같은 수정이 필요하다 |
| **4** fail-open 배너 co-occurrence 미검증 | **반영** — `test_per_target_fail_open_still_checks_remaining_targets` 가 exit code 와 blocked target 만 보고 **배너 출력은 안 봤다**. `main()` 의 `finally` 가 존재하는 이유가 바로 "차단하면서도 다른 게이트가 fail-open 이면 알려야 한다" 인데, `return 2` 는 성공처럼 보이는 유일한 경로라 배너 유실이 가장 놓치기 쉽다. `fail-open`·`REVIEW` assert 추가. **mutation 으로 실증**: `_report_fail_open` 무력화 시 이 테스트가 red(추가 전엔 green) |
| **2** `_run_gates` REVIEW/PLAN 블록 중복 | **미조치 (일관 유지)** — #999 가 소유한 구조다. 4개 라운드 연속 같은 지적을 받았지만 판단은 동일하다: 여기서 재추출하면 이 PR 이 #999 의 구조를 되돌리는 셈이고, 병합 표면만 키운다 |
| **3** 테스트 헬퍼 `_run` boilerplate 반복 | **미조치** — `extra_env`/`script` 인자 추가는 테스트 리팩터로 별건. 지금 5곳이 각자 명시적이라 읽기에는 오히려 낫다 |

## INFO 11건

전부 확인형이거나 낮은 우선순위(detached-HEAD pin, `result is None` unreachable 분기,
`_push_targets` 순수 단위 테스트, docstring 보강 등). INFO 1(fail-open·BYPASS 는 문서화된 정책),
INFO 2~4(subprocess·게이트 호출 증폭 모두 read-only·타임아웃·문서화)는 양성 확인.

## 검증

- harness 전체 **578 passed / 339 subtests**.
- mutation **11건 전수**: 전부 의도한 테스트만 red, 원복 후 base 와 byte-identical.
  M4 가 3 → **4건** kill 로 늘었다(README 수정이 아니라 W4 assert 추가분이 잡힌 것).
- 알려진 실패 1건(`test_line_anchors.py`)은 별건 task 로 등록됨 — #1003 편집으로 라인 번호만
  이동(406 → 452), 증상 동일.

## 교훈

**리뷰어의 실측 수치도 검증 대상이다.** "688KB 에서 58초" 는 구체적이고 그럴듯했지만 6가지 형태로
재현되지 않았고, 결정적으로 **그 함수가 내 diff 에 없었다**. 순서 지적(길이 검사가 뒤) 자체는
사실이라 더 설득력 있게 읽혔다 — 사실인 전제와 틀린 결론이 붙어 있을 때가 가장 위험하다.
