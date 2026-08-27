# RESOLUTION — `17_52_44` (`/ai-review`, forced 7/7)

RISK=LOW · **CRITICAL 0** · WARNING 3 → **전부 반영**. INFO 3·4·5 도 반영, 나머지는 사유 기록.

## W2·W3 — **이 PR 의 존재 이유를 상시 가드가 안 지키고 있었다**

testing 리뷰어 지적이 정확하다. 이 PR 의 핵심 주장은

> *"`:(glob)` 없으면 `*` 가 `/` 를 넘어 17,202개, 있으면 루트 6개만"*

인데, 그 근거가 **내가 손으로 돌린 `git ls-files` 한 번**뿐이었다. 커밋된 것 중에는
그 동작을 무는 테스트가 없었다 — 내가 M-D7 뮤테이션으로 확인한 건 **그 순간의 확인**이지
상시 가드가 아니다.

### W2 — 판정 함수 boundary (`filter_covers_file`)

`FilterMatchBoundaryTest` 가 다른 모든 분기는 개별로 못박는데 `:(glob)` 스트립만
dead-filter 통합 테스트를 통해 **간접 실행**되고 있었다. 직접 케이스 추가:

- `:(glob)*.md` → `PROJECT.md`·`CLAUDE.md` **매치**
- `:(glob)*.md` → `spec/x.md`·`.claude/docs/y.md` **비매치** (세그먼트 경계 유지)
- `a:(glob)*.md` → **비매치** (접두일 때만 벗긴다 — 중간이면 리터럴)

### W3 — 실행 계층 (`ci-paths-changed.sh` → `git diff`)

`test_ci_paths_changed.py` 의 `_RepoFixture` 를 재사용해 두 케이스를 붙였다:

- 루트 `root-doc.md` 변경 → `relevant=true`
- `nested/deep.md` 변경 → `relevant=false`

**그리고 대조군을 하나 더 넣었다.** 위 둘만으로는 *"매직 덕분에 false"* 인지
*"`*.md` 가 원래 루트만 잡아서 false"* 인지 **구별되지 않는다** — 매직의 기여를 관측하지
못한다. 매직을 뺀 `*.md` 로 `nested/deep.md` 가 `true` 가 되는 것을 함께 못박아 두 축이
갈리게 했다.

## W1 (SPEC-DRIFT) — planner 턴

`spec-impl-evidence.md §4.2` 표가 scope (1)(2) 만 서술하는데, `PROJECT.md`·
`spec-link-integrity.test.ts`·`spec-links.ts` **세 곳이 그 절을 SoT 로 인용**한다.
표에 scope (3) 을 넣고, 비재귀인 이유와 스크립트 삭제 경위를 함께 실었다.

리뷰어가 *"PR 자신의 집행 체크리스트에도 이 표 갱신이 누락"* 이라 지적한 것도 맞다 —
트래커 체크리스트에 (f) 로 추가했다. `spec/` 편집이고 내가 쓴 예고 문장이 아니라
자기-반증형 소정정 요건을 못 채우므로 planner 턴으로 처리했다.

## INFO 4·5 — 반영. **"안 잡힌다" 만 단언하면 진입점이 죽어도 통과한다**

- **#4** `node_modules` 제외에 fixture 가 없어 지워져도 아무 테스트가 안 깨지는
  **죽은 방어**일 수 있다는 지적. fixture 에 `.claude/node_modules/pkg/readme.md`
  (깨진 링크 포함)를 넣어 `worktrees` 와 동등하게 고정했다.
- **#5** 진입점이 스코프 **안**의 깨진 링크를 실제로 검출하는 **양성** 케이스가 없었다.
  기존 세 케이스는 전부 *"안 잡힌다"* 라서, 스코프를 빈 배열로 만들면 **셋 다 초록**이다.
  루트에 깨진 링크를 심어 `DEAD` 1건이 정확히 올라오는지 못박았다.

### 뮤테이션 — 예측/실측

| | 예측 | 실측 | |
| --- | --- | --- | --- |
| M-D8 `node_modules` 스킵 제거 | 2 failed | **3 failed** | 어긋남 |

추가 1건은 **양성 테스트**다 — `violations.length === 1` 로 정확한 개수를 단언하는데
`node_modules` 쪽 위반이 더해져 2가 됐다. 관측이 내 가설로만 설명되고, 양성 테스트가
느슨하지 않다는 방증이기도 하다.

## INFO 3 — 반영

비-공허성 임계값 `20` 을 `MIN_CLAUDE_DOCS` 로 추출하고 근거(실측 52개)를 주석에 남겼다.

## 넘김 (사유)

- **INFO 1** CI 트리거 `.claude/**` 가 확장자 무관이라 non-md 변경에도 job 이 돈다 —
  **의도적**이다. 좁히면(`.claude/**/*.md`) 가드가 참조하는 **비-md 파일**(예: 이 가드의
  구현·fixture)이 바뀔 때 안 돌아, 이 워크플로가 막으려는 갭이 다른 형태로 재발한다.
  job 은 vitest 하나만 돌아 가볍다.
- **INFO 2** `17,202` 이 3곳에 하드코딩 — SoT 단일화 제안. 세 곳의 **독자가 다르고**
  (테스트 읽는 사람·워크플로 편집자·plan 독자) 각자 자리에서 왜 매직이 필요한지 알아야
  한다. 링크로 바꾸면 편집자가 그 이유를 못 보고 매직을 지울 수 있다 — 이 PR 이 막으려는
  바로 그 형태다. 유지한다.
- **INFO 6** `spec-link-checks.yml` 의 pathspecs 커버리지 회귀 테스트 — 좋은 제안이고
  이 PR 범위 밖이다. `harness-checks.yml` 이 같은 클래스를 codify 한 선례가 있으니
  후속으로 별건 등재 대상. (다만 W3 로 **매직 자체**는 실행 계층에 고정됐다.)
- **INFO 7** 두 파일의 인과관계 — 커밋 메시지에 이미 한 절을 할애했다.
- **INFO 8** `path.resolve` 리포 밖 경로 — 리뷰어도 *"실질 공격 표면 없음"* 판정.

TEST WORKFLOW 4단계 PASS — frontend **6,174 passed**(가드 13→19) · e2e 285.
하네스: `test_ci_paths_changed` 20 · `test_harness_checks_paths_coverage` 26 ·
`test_required_check_skip_jobs` 17 전부 OK.
