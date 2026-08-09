# RESOLUTION — 2026-08-10 02:33:44

SUMMARY: Critical 0 · WARNING 3 · risk MEDIUM (reviewer 7/7, forced 전원).

## 세 WARNING 은 성격이 갈린다 — 둘은 조치, 하나는 등재

### W1 — 선재 3필드 검사가 positive-only (testing, MEDIUM) → **등재**

**지적**: `worktree`/`started`/`owner` 검사의 위반 분기가 CI 에서 한 번도 실행된 적이 없다.
이 PR 이 신설 검사(status·링크)에 적용한 처방(순수 함수 추출 + 합성 fixture)을 그쪽엔
적용하지 않은 비대칭.

**실측 — 이 PR 의 변경이 아니다**: `git show origin/main:<파일>` 에 세 `it()` 이 **전부
존재**한다. 선재 코드이고, 이 PR 은 그 파일에 검사를 **추가**했을 뿐 기존 셋을 건드리지
않았다.

**판단**: 인접 코드로의 범위 확대다. 이 PR 에서 같은 클래스를 이미 두 번 사양했고
(walker 3벌 통합 · `SpecMdFile` 타입명) 같은 근거가 그대로 적용된다 — **리뷰 라운드마다
인접 코드를 흡수하면 PR 이 수렴하지 않는다.**

→ [`docs-guard-legacy-fixture-coverage.md`](../../../../plan/in-progress/docs-guard-legacy-fixture-coverage.md)
**신설 등재**. 착수 시 뮤테이션으로 확인할 것(`WORKTREE_PLACEHOLDER` 를 지워도 초록일
가능성이 높다)까지 적었다. 같은 파일의 `ISO_DATE` 형식-only 검사(INFO 1)도 그 자리에 함께.

### W2 — `describe` 이름이 스코프를 못 담음 (maintainability) → **조치**

`describe("plan-frontmatter guard")` 안에 frontmatter 와 무관한 링크 무결성 테스트 2개가
있었다. 구분이 `// ── (b)` 주석뿐이라 테스트 출력이나 `-t` 필터로는 안 드러난다.
→ `"plan lifecycle guards (frontmatter + live-plan links)"` 로 포괄화.

### W3 — 헤더 주석에 회고 서사 누적 (maintainability/documentation/scope) → **조치**

38줄 헤더에 지속 규칙과 PR 번호(`#1108`·`#1117`)·라운드 내러티브가 섞여 있었다. 새 리더가
현재 불변식을 알기 전에 과거 리뷰 이력부터 읽어야 하는 상태.

→ **주석을 줄였다**(38줄 → 22줄). 3종 규칙·스코프·SoT 위임·판정 로직 소재만 남기고
회고는 커밋 메시지와 `plan/complete/` 산출물로 넘겼다.

> **이 지적이 이 PR 전체의 구조적 원인을 짚었다.** 나는 라운드마다 주석·RESOLUTION·plan 에
> **새 산문을 추가**했고, 리뷰어는 그 산문을 다시 검토했다. 발견이 마르지 않은 것이 아니라
> **내가 표면을 계속 만들어 냈다.** W3 조치는 그 방향을 처음으로 되돌린 것이다.

## INFO — 미조치

| # | 내용 | 판단 |
|---|---|---|
| 1 | `ISO_DATE` 가 형식만 검사(`2026-13-32` 통과) | W1 과 같은 자리 — 신설 plan 에 등재 |
| 2 | 하한 임계값이 실제 규모 대비 낮음 | **의도**다. 실제 개수에 가깝게 잡으면 grooming 마다 깨진다(`>20` 발화 전례) |
| 3 | Gate C walker 이원화 | `docs-guard-walker-dedup.md` 등재됨 |
| 4 | `collectTopLevelPlans` 위임 교체가 범위 내인지 | 범위 내로 판정됨(확인성) |
| 5·6·7 | 어휘 통일 · `repoRoot()` 중복 호출 · 캐너리 재스캔 | 선택. 지금 고치면 또 라운드를 산다 |
| 8·9·10 | 보안 3건 | 전부 "문제 없음" 확인 |

## 검증

- 문서 가드 **19파일 / 2849 tests PASS**
  > 2845 → 2849 의 **+4 는 신설 plan 파일 때문**이다 — 이 가드가 top-level plan 마다
  > `it` 4개(frontmatter 파싱·worktree·started·owner)를 만든다. 테스트를 추가한 것이 아니다.
- e2e — 아래 줄
