# RESOLUTION — 19_26_54 (backend unit CI 실패 fix 타겟 라운드)

**Critical 0 · WARNING 1 · INFO 4 · risk LOW.** `REVIEW_AGENTS=testing,requirement,side_effect`
타겟 실행(3/3 success, forced 전원).

## 조치 항목

| # | 카테고리 | 발견 | 처분 |
|---|---|---|---|
| **W1** | testing | **테스트와 런타임이 다른 값을 본다.** bash 루프가 `IFS= read` 로 앞뒤 공백을 보존하는데, 하네스 가드 `pathspecs_of()` 는 `line.strip()` 으로 정규화한다. `pathspecs:` 항목에 공백이 하나 섞이면 **가드는 통과하고 런타임에서만 그 pathspec 이 무력화**된다 — 이 PR 이 통째로 막으려는 "초록인데 안 도는" 클래스 그 자체다. reviewer 가 실측(`"  a.yaml\nb.yaml  "` → `["  a.yaml", "b.yaml  "]`)으로 제시했다 | **수정.** `IFS=` 를 빼 `read` 가 앞뒤 공백을 떼게 했다 — 런타임이 가드와 같은 값을 본다. 항목 앞뒤 공백은 언제나 오타이지 의도가 아니다. **안쪽** 공백(`path with space.yaml`)은 그대로 살아남는 것도 기존 테스트가 계속 고정한다. **뮤테이션(트리밍 되돌림) RED 확인** |

### 미조치 (INFO 4건)

- **INFO 1** (체크 표시 이름 변경 가능성) — 코드로 사전 확정 불가. `ci-required-check-skip-jobs.md`
  §사용자 액션 에 "머지 후 Actions 에서 1회 확인" 으로 이미 등재돼 있다. **이번 PR 의 CI
  실행에서 실제 이름을 관측했다**: `변경 경로 판정 / 변경 경로 판정`(호출부 잡 이름 /
  reusable 잡 이름). required check 후보인 리프 잡(`backend lint`·`pnpm audit (moderate+)`·
  `test-and-build` 등)의 이름은 **바뀌지 않았다** — 등록에 영향 없음을 실측으로 확인했다.
- **INFO 3** (`http-request.handler.spec.ts` 의 죽은 `fetchPromise`/`_reject` 스캐폴딩) —
  **하지 않았다.** 이번 fix 는 CI 실패 1건을 닫는 최소 변경이고, 그 죽은 코드는 이 실패와
  무관하다. 같은 커밋에서 무관한 정리를 얹으면 "이 PR 이 왜 그 파일을 건드렸나" 가 흐려진다.
  다음에 그 파일을 만질 때 함께 치우는 편이 낫다.
- **INFO 2** (임시 디렉터리 미정리) — 직전 라운드에서 같은 판단을 기록했다: 실패 시 증거가
  사라지는 쪽이 더 비싸다.
- **INFO 4** (spec 문서 부재) — CI/하네스는 spec 대상이 아니다. 조치 불요.

## TEST 결과

W1 fix 는 `.github/**` + `.claude/**` 만 건드린다(`codebase/**` 0건). 따라서 아래 전량 실행은
직전 backend fix 기준이며, 이후 변경이 런타임에 닿지 않음을 harness 976건으로 확인했다.

- lint : **PASS** (49s)
- unit : **PASS** (73s)
- build : **PASS** (128s)
- e2e : **PASS** (475s — backend jest 46 suites/261 + playwright 51)
  > `codebase/backend` 변경(mock fix)이 있었으므로 **면제 대상이 아니다**. 1차 시도는
  > docker 디스크 부족(`initdb: No space left on device`)으로 postgres 가 안 떠 실패했고,
  > `docker builder prune -af` + image prune 후 통과 — 회귀가 아니라 인프라다.
- harness : **976 tests OK** (fix 후 재실행. 이 라운드 신규 1건)

## 보류·후속 항목

- `http-request.handler.spec.ts` 의 죽은 mock 스캐폴딩 제거 (INFO 3) — 다음에 그 파일을
  만질 때
- 머지 후 required check 등록 시 표시 이름 재확인 — 위 실측으로 리프 잡은 불변임을 확인했으나
  등록 화면에서 최종 대조 권장
