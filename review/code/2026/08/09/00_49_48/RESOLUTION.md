# RESOLUTION — backend-lint-gate ai-review (세션 A `00_49_48` + 세션 B `00_50_08`)

74파일 changeset 을 **두 세션으로 나눠** 리뷰했다 — orchestrator 의 `--prepare` 가 큰
changeset 을 배치 분할하면서 배치들이 같은 타임스탬프 세션 디렉터리를 공유해 뒤 배치만
남기 때문이다(실측·증거는 [`harness-review-gate-followups.md`](../../../../../plan/in-progress/harness-review-gate-followups.md)
의 "형제 파일 부분 추출" 항목에 기록). 목록을 직접 40 + 34 로 쪼개 각 세션이
`meta.json` files = 40 / 34 를 갖도록 했고, 합이 74 로 **전량 커버**됨을 확인했다.

| 세션 | 파일 | reviewer | Critical | Warning | risk |
|---|---|---|---|---|---|
| A `00_49_48` | 40 | 14/14 success | **0** | 1 | LOW |
| B `00_50_08` | 34 | 14/14 success | **0** | 1 | LOW |

forced 화이트리스트(7명) 양쪽 모두 전원 결과 확보 — 미이행 없음.

## 조치 항목

| # | 세션 | 카테고리 | 발견 | 처분 |
|---|---|---|---|---|
| A-W1 | A | scope / 문서-코드 불일치 | `secret-resolver.service.ts:60` 주석이 "캐스트가 `never` 로 좁혀지는 것을 방지한다" 고 설명하는데 **그 캐스트는 이 PR 이 제거**했다 | **수정.** 실제 동작으로 갱신 — `isSecretRef` 가 `value is string` 타입가드라 false branch 에서 `ref` 는 `never` 로 좁혀지고, `never` 는 bottom type 이라 `string` 에 그대로 대입되므로 **캐스트가 애초에 불필요**했다. 제거 후 `nest build` 통과를 실측했다는 근거도 함께 남겼다 |
| B-W1 | B | 문서화 (plan lifecycle) | `backend-lint-gate-broken-on-main.md:3` 의 `worktree: (unstarted)` 가 실제 상태(커밋 5건 + 실재 worktree)와 불일치 → `plan_guard` 가 이 worktree 를 plan 에 미연결로 오판할 수 있다 | **수정.** `worktree: backend-lint-gate-b72fdd` 로 갱신 |

> B-W1 은 **내가 오늘 다른 plan 에서 고쳤던 것과 같은 결함 클래스**다(`harness-review-gate-ci-backstop.md`
> 의 Gate C `spec_impact` 누락). 그때 "죽은 worktree 이름을 두면 가드가 무장 해제된다" 고 적어
> 놓고 정작 이 plan 을 신설할 때 `(unstarted)` 로 두었다 — 신설 시점엔 참이었으나 착수 후
> 갱신하지 않았다.

INFO 는 양쪽 합쳐 13건이며 전부 조치 불요 또는 이미 추적 중이다. 그중 값이 있는 둘:

- **A-INFO4 / spec 파일 타입체크 부재** — `tsc --noEmit -p tsconfig.json` 전체 프로그램
  체크 시 `*.spec.ts` 에 **선재 타입 에러 319줄**. `tsconfig.build.json` 이 `test/`·
  `*.spec.ts` 를 exclude 하고 jest 는 타입을 강제하지 않아 **어떤 게이트에서도 잡히지 않는다.**
  이 PR 밖이라 plan 에 별 항목으로 등재했다(§부수 발견)
- **양쪽 INFO / 프롬프트 커버리지** — 각 세션 프롬프트가 실제 diff 의 일부만 담았으나
  **reviewer 다수가 `git diff origin/main...HEAD` 로 직접 대조**해 나머지를 확인했다고
  보고했다. 내가 배치를 쪼개 전량 커버한 것과 별개의 이중 안전망

## TEST 결과

- lint : **PASS** (56s) — 이 PR 의 목적. `run-test.sh lint` wrapper 경로로 확인
- unit : **PASS** (88s) — backend 416 suites / 8,463 tests (1 skipped)
- build : **PASS** (155s)
- e2e : **PASS** (297s, 261 tests)

두 WARNING fix 는 **주석 1줄 + plan frontmatter 1줄**로 런타임 영향이 없으며, 변경 파일
`npx eslint` exit 0 · `prettier --check` 통과를 확인했다.

## 보류·후속 항목

- `spec` 파일 타입체크 부재(319줄) → [`backend-lint-gate-broken-on-main.md`](../../../../../plan/in-progress/backend-lint-gate-broken-on-main.md) §부수 발견
- 잔여 lint warning 47건(`no-unsafe-*` 등) → 같은 plan §잔여 warning. **비차단**이며
  `--max-warnings 0` 도입 여부가 선행 결정이다
- orchestrator 배치 분할 시 세션 덮어쓰기 → [`harness-review-gate-followups.md`](../../../../../plan/in-progress/harness-review-gate-followups.md)
