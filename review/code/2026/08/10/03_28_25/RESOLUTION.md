# RESOLUTION — 03_28_25 (03_12_29 W1 재리뷰)

리뷰 결과: RISK=MEDIUM · Critical 0 · WARNING 6 · reviewer 14명 전수

이 라운드는 `03_12_29` 가 **거짓 PASS** 였음이 드러나 4파일을 명시 지정해 다시 돌린 것이다.
그 판단이 옳았음을 결과가 보여준다 — 앞 라운드가 skip 한 reviewer 들이 WARNING 6건 중
**5건**을 냈다(side_effect MEDIUM 1 · testing 2 · maintainability 1 · documentation 1).

## W1 — gray-matter 캐시 우회를 한 곳에만 적용했다 (side_effect, MEDIUM)

**반영.** 내가 `checkPlanFrontmatter` 에서 방어한 그 hazard 를 같은 파일의
`findNonTerminalCompletedPlans` 와 `spec-plan-completion.test.ts` 2곳에는 적용하지 않았다.
4개 호출부 중 **1곳만** 고친 셈 — "고쳤다고 쓰고 절반만 고친" 형태다. 3곳 모두 `{}` 추가.

**다만 등급은 리뷰어 서술대로 조정해 기록한다.** 뮤테이션으로 실측하니
`findNonTerminalCompletedPlans` 의 `{}` 는 **어떤 테스트로도 관측되지 않는다**(지워도 초록).
그 경로에서는 파싱 실패(`catch` → skip)와 캐시 오염(`data={}` → `status` 부재 → skip)이
**같은 결과로 수렴**하기 때문이다. 리뷰어도 "현재는 관측 가능한 버그 없음" 이라고 썼다.

그래서 이 한 줄은 **버그 수정이 아니라 방어**이고, 주석에 그 사실과 남겨 두는 이유(한 파일
안에서 같은 hazard 를 한쪽만 막으면 다음 사람이 오독한다 · 파싱 실패와 빈 frontmatter 를
구분하게 되는 순간 갈린다)를 명시했다. **테스트가 지켜 준다고 오해하지 않도록** 적었다.

## W4 — 공백-only `worktree`/`owner` 가 통과했다 (testing)

**반영.** `length === 0` 만 봐서 `worktree: "   "` 가 무사통과했다. 이 가드의 존재 이유가
정확히 "살아있어 보이지만 죽은 값" 을 막는 것이라 정면 침해다. `.trim()` 추가 +
fixture(`"   "`·탭·개행 × worktree/owner) 6케이스. 뮤테이션 M12·M13 RED.

## W5 — 인덱스 면제가 디렉터리 이름에는 적용되지 않는다 (testing)

**반영(현재 동작을 pin).** `plan/complete/0-batch/child.md` 가 수집된다. 실 저장소에 그런
디렉터리가 **없어서**(실측) 데이터로는 의도와 사고가 갈리지 않는다.

현재 동작을 유지하기로 판단한 근거: 면제 근거가 "인덱스 **문서**는 작업 plan 이 아니다" 라
파일 단위로만 성립하고, 디렉터리까지 넓히면 그 안의 진짜 plan 들이 통째로 가드 밖으로
빠진다 — 이 PR 이 세운 게이트를 스스로 뚫는 방향이다. fixture 2건으로 고정하고 주석에
근거를 남겼다.

## W6 — placeholder 거부 근거가 폐기된 메커니즘을 가리켰다 (documentation)

**반영.** 주석이 "`plan-coherence` 충돌 검출을 오염시킨다" 를 근거로 들었는데 그 기능은
`3da85dc3b`(#576, "plan-coherence checker 에서 cross-worktree 충돌 검토 제거")에서 제거됐다.

> 처음엔 오탐으로 의심했다 — `plan-coherence-checker` 는 지금도 있고 이 PR 에서 직접
> 돌렸기 때문이다. `git log` 로 확인하니 **checker 는 남고 그 안의 충돌 검토만 빠진** 것이라
> 리뷰어가 정확했다. checker 존재만 보고 기각했으면 낡은 근거를 그대로 남겼을 것이다.

현재 유효한 소비처 둘로 교체했다 — `plan-stale-audit.sh` 의 worktree 실재 확인,
plan 게이트의 연결 판정(placeholder 는 **어떤 worktree 와도 매칭되지 않아** plan 이 게이트에서
사라진다).

**부수 발견**: SoT(`plan-lifecycle.md`)가 **자기모순**이었다 — §소비처 각주는 그 기능이
제거됐다고 적어 두고, 같은 문서의 `worktree` sentinel 절은 여전히 그 폐기된 근거를 쓴다.
내가 코드로 복제한 것이 그 낡은 쪽이었다. SoT 도 함께 정정했다.

## W3 — JSDoc 회고 서사 (documentation)

**반영.** `findBrokenPlanLinks` JSDoc 이 측정 날짜·건수(8/9번째/135)·초안 수정 이력을 담고
있었다. 이 PR 이 `plan-frontmatter.test.ts` 헤더에 적용한 원칙("코드 주석은 현재 규칙만")을
**같은 PR 의 다른 파일에는 적용하지 않은** 것이다. "무엇을·왜 좁게·어떤 예외" 만 남겼다.

## W2 — walker 3벌 중복 (maintainability)

**등재 유지.** [`docs-guard-walker-dedup.md`](../../../../../../plan/in-progress/docs-guard-walker-dedup.md)
가 이미 이 항목을 정확히 담고 있다(3벌 표 + "착수 전 필터 차이 실측 필수").

이번에는 등재가 옳다고 판단한 근거 — W1(rationale checker 가 등재를 반박한 건)과 성격이
다르다: 저쪽은 **이 PR 이 신설한 판정 로직의 vacuous 갭**이라 같은 파일·같은 축이었고,
이쪽은 `spec-links.ts` 의 spec/codebase walker 로 **이 PR 이 건드릴 이유가 없는 파일**이다.
게다가 그 plan 자신이 "필터 차이를 실측하지 않은 채 합치는 것이 더 큰 위험" 이라고
착수 조건을 걸어 뒀다.

## INFO 10건

전부 조치 불요. #9(`spec-links.test.ts` 가 testing reviewer 페이로드에서 누락)는 이번
라운드가 파헤친 orchestrator 결함과 같은 계열이라
[`harness-review-gate-followups.md`](../../../../../../plan/in-progress/harness-review-gate-followups.md)
에 이미 등재된 범위다.

## 검증

- 문서 가드 19파일 / **2856 tests PASS** · tsc clean
- 뮤테이션 **12 RED / 생존 1** — 생존한 M14 는 위 W1 에 적은 대로 **관측 불가가 정상**이다
  (두 경로가 skip 으로 수렴). M4 는 trim 도입으로 치환 대상이 사라져 **무효 뮤턴트**로
  보고됐다 — 하네스가 조용히 통과시키지 않고 잡아냈다
- e2e PASS (298s / 264) — `codebase/frontend/**` 변경으로 면제 불가
