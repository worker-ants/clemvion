# RESOLUTION — 11_40_34 (required check skip-job 전환)

**Critical 0 · WARNING 10 · INFO 12 · risk MEDIUM.** reviewer 14/14 success,
forced 화이트리스트 7명 전원 결과 확보.

**8건 수정 · 2건 후속.** W1·W2 는 **이 PR 이 막으려는 것과 같은 클래스를 내가 재현한 것**이라
특히 값이 컸다.

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| W1 | testing/requirement | 판정 스크립트의 fail-safe 분기를 **실행 검증하는 테스트가 없다**. 정적 YAML 검사뿐이라, under-match 시 "초록인데 검사는 안 도는" 상태가 재발 가능 | **수정.** `test_ci_paths_changed.py` 신설 — 임시 git 저장소 + subprocess 로 16건. 양방향 판정 · `**` 가 `/` 를 넘는지 · `$GITHUB_OUTPUT` 기록 · fail-safe 4분기 · 인자 없음이 `false` 가 아니라 exit≠0. **뮤테이션(merge-base fail-safe 를 false 로) 2건 RED** |
| W2 | requirement | `scripts/ci-paths-changed.sh` 가 `harness-checks.yml` 의 `paths:` 에 없다 — 판정자가 바뀌어도 그 가드가 CI 에서 안 돈다 | **수정.** 등재. 이 저장소가 **여섯 번** 겪었다고 기록한 클래스를 초판이 그대로 재현했다 |
| W3 | requirement/concurrency/side_effect | `changes` 잡이 실패·취소되면 하위 잡이 `skipped` → **"skipped 가 required check 를 만족하는가" 라는, 이 PR 이 정확히 피하려던 모호함이 다른 경로로 재발** | **수정.** 두 축으로 닫았다: 잡에 `if: ${{ !cancelled() }}` (needs 실패로 skip 되지 않음) + 스텝 조건을 `== 'true'` → **`!= 'false'`** 로 반전(빈 값이면 실제 검사를 돌린다). 뮤테이션(방향 되돌림) 6건 RED |
| W4 | side_effect | `push` 의 `paths:` 가 사라졌는데 대체 비교가 없어 **main 으로의 모든 push 가 전체 잡 실행** — PR 데드락 해소라는 목적 범위를 넘는 광역화 | **수정.** `github.event.before`/`after` 를 넘겨 push 도 실제 diff 로 판정. all-zero(신규 브랜치)는 fail-safe. `PushEventTest` 4건으로 고정 |
| W5 | testing/dependency/architecture | 전환 목록이 3곳(`CONVERTED`·`_SKIP_JOB_WORKFLOWS`·`_PULL_REQUEST_KEYS` 빈집합)에 독립 존재 — 한쪽만 갱신해도 조용히 통과 | **수정.** `test_the_two_registries_agree` 로 세 집합을 `assertEqual` 바인딩 |
| W6 | testing | `test_changes_job_publishes_relevant` 가 키 **존재**만 봐 step id 오타를 통과시킨다(그 경우 출력이 빈 문자열 → 게이팅 무력화) | **수정.** 참조 문자열 정확 일치 + `id: detect` 존재를 함께 단언 |
| W9 | maintainability | 테스트 클래스가 저장소 컨벤션 `*Test` 접미사 미준수 | **수정.** `RequiredCheckSkipJobContractTest` |
| W10 | documentation | README 카탈로그의 `test_workflow_yaml_structure.py` 행이 이번에 그 파일이 받은 변경(빈집합 허용·규칙 예외)을 반영 못해 stale | **수정.** 해당 행에 두 예외와 보상 통제를 명시하고 신설 가드와 상호참조 |

### 후속 (수정하지 않음)

| # | 발견 | 근거 |
|---|---|---|
| W7 | `changes` 잡 wiring 이 두 워크플로에 복제 | reviewer 자신이 **"3번째 워크플로 전환 시점에 reusable workflow/composite action 추출 검토"** 를 권고했다. 2개 시점에 추상화하면 아직 안 드러난 변형을 추측으로 설계하게 된다 — 전환 plan에 등재 |
| W8 | `fetch-depth: 0` 전체 clone 을 매 PR 지불(같은 PR 에 2회) | 의도된 트레이드오프. 종전엔 무관 PR 이 비용 0 이었으나 그 대가가 required check 데드락이었다. W7 의 단일 `changes` 잡 통합이 이것도 함께 해소하므로 같은 시점에 본다 |

INFO 12건은 전부 조치 불요 또는 기존 저장소 관례(actions major 태그 핀 · `permissions:` 미명시)다.
그중 하나만 반영했다 — 스크립트 헤더에 이벤트별 비교 기준을 문서화(INFO 9·10).

## TEST 결과

- lint : **PASS** (68s)
- unit : **PASS** (92s)
- build : **PASS** (148s)
- e2e : **PASS** (286s, 261 tests)
  > **e2e 를 돌린 근거**: 변경 set 의 `scripts/ci-paths-changed.sh` 가
  > `PROJECT.md §e2e 면제 화이트리스트` **밖**이다(`scripts/**` 항목 없음). "CI 스크립트라
  > e2e 와 무관" 은 자가 영향 추정이고, 화이트리스트는 부분집합 판정이지 판단이 아니다.
- harness : **939 tests OK** (fix 후 재실행. 신규 25건 = `test_ci_paths_changed` 16 +
  `test_required_check_skip_jobs` 9)

fix 는 워크플로·테스트·CI 스크립트에 한정돼 `codebase/**` 를 건드리지 않는다 — 위 4단계는
fix 이전 실행분이며, 이후 변경이 런타임에 닿지 않음을 harness 939건으로 확인했다.

## 보류·후속 항목

`plan/in-progress/ci-required-check-skip-jobs.md` §후속에 등재:

- W7·W8 — 3번째 전환 시점에 reusable workflow 로 `changes` 잡 통합
- 나머지 8개 워크플로 전환 (전환 시 두 등록부 동시 갱신이 계약 — 이제 테스트가 강제한다)
- 사용자 액션: branch protection 에 check 이름 등록
