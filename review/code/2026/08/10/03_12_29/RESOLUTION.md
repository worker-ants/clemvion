# RESOLUTION — 03_12_29

리뷰 결과: RISK=MEDIUM · Critical 0 · WARNING 4

## WARNING #1 — 이 라운드의 changeset 이 직전 코드 커밋 2건을 통째로 누락 (requirement)

**반영 (재리뷰 수행).** 리뷰어가 자기 라운드의 무효성을 짚었다. 실측으로 확정했다:

- `meta.json` files **27건 중 `plan-scan.ts`/`plan-scan.test.ts`/`plan-frontmatter.test.ts`
  는 0건**. 목록은 전부 `review/**` 와 spec 문서
- 두 커밋 `bc10e215e`(03:07:38)·`e64b1218b`(03:10:27) 은 세션 준비(**03:12:29**)보다
  **먼저**다 → 타이밍 레이스가 아니다
- 27 < 배치 상한 50 이고 배치 로그도 없다 → 알려진 "배치 분할" 형태와도 다르다

그 결과 router 가 "소스 코드 변경 없음(문서 전용)" 으로 판정해 security·testing·scope·
maintainability 등 **12명을 skip** 했다. **거짓 PASS** 다 — 게이트는 "리뷰됨" 으로 닫히는데
정작 그 라운드는 새 코드를 보지 않았다.

조치:
1. 해당 3파일을 **명시 지정**해 별도 라운드를 수행했다 (아래 §재리뷰).
2. 이 형태를 [`harness-review-gate-followups.md`](../../../../../../plan/in-progress/harness-review-gate-followups.md)
   에 실측과 함께 등재했다. 가설: 파일 선별이 "이전 세션에서 리뷰된 파일" 을 제외하는데
   **"그 뒤에 또 바뀌었는가" 를 보지 않는다**(3파일 모두 직전 세션 `02_47_31` 의 대상이었다).
   회귀 테스트 형태와 router 쪽 fail-closed 방어까지 항목으로 적었다.

## WARNING #2 — `02_47_31` RESOLUTION.md 결손 (requirement)

**반영.** 작성했다 — [`../02_47_31/RESOLUTION.md`](../02_47_31/RESOLUTION.md). 지적대로
WARNING #1·SPEC-DRIFT #1 이 `bc10e215e`/`e64b1218b` 로 해소됐음을 명문화하고, W2(prettier)는
기각 근거(설정·의존성·설치본 3중 부재 실측)를 남겼다.

## WARNING #3 — `spec-links.ts` JSDoc 오귀속 (documentation)

**반영.** `findBrokenPlanLinks` 를 설명하는 대형 JSDoc 이 `export { collectLivePlanMarkdown };`
에 붙어 있었다. IDE hover·TypeDoc 은 다음 선언에 귀속시키므로 무관한 설명이 뜨고 정작
`findBrokenPlanLinks` 는 문서 없는 것처럼 보인다. `export {}` 구문과 그 2줄 주석을 JSDoc
**위로** 올려 원래 대상에 붙였다.

## WARNING #4 — consistency SUMMARY 2건의 죽은 상대링크 (documentation)

**반영.** `review/consistency/2026/08/10/<세션>/SUMMARY.md` 에서 저장소 루트까지는 6단계인데
`../` 4개만 썼다 — resolve 하면 `review/consistency/plan/in-progress/...` 로 존재하지 않는
경로가 된다. 두 파일(`02_18_34`, `02_33_44`) 모두 6단계로 정정했다.

> **이 PR 의 게이트가 왜 못 잡았나**: 링크 검사 스코프는 top-level
> `plan/in-progress/*.md` 이고 `review/**` 는 대상이 아니다. 시점 기록 산출물이라
> `plan/complete/**` 를 뺀 것과 같은 이유로 뺀 자리다 — 다만 **`review/**` 의 back-link 은
> 시점 기록이 아니라 살아있는 참조**라 성격이 다르다. 스코프 확대 판정은 이 PR 범위 밖이라
> 하지 않았고, 대신 위 §후속으로 남기지 않았다 — 두 링크가 모두 정정된 지금 관측된 사례가
> 없어 근거 없는 확대가 된다.

## INFO

- #2 (`harness-env-value-subpattern-dedup.md:64` blockquote 공백) — **반영**. 1자 정정.
- #1·#3 — 조치 불요.

## 재리뷰 (WARNING #1 후속)

3파일 명시 지정으로 별도 라운드를 수행했다. 결과는 그 세션의 SUMMARY 를 볼 것.

## 검증

- 문서 가드 19파일 PASS · tsc clean
- harness 995 tests OK
- **e2e PASS** — 298s / 264. `codebase/frontend/**` 변경으로 면제 불가
