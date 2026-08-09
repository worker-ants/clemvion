# Rationale 연속성 검토 — plan-lifecycle-gates (impl-done, 마지막 라운드)

## 조사 방법 메모

prompt_file 번들에 diff 섹션이 없어(알려진 결함), 워킹트리
`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates` 에서
`git diff origin/main...HEAD` 를 직접 실행해 실제 변경분을 확인했다. orchestrator 가 지시한
3개 질문을 각각 커밋 diff·git blame·git log -S 로 실측했다:

1. `bc10e215e` (vacuous-test → 실 fix 전환) 의 내용 검증
2. `docs-guard-walker-dedup.md` 2026-08-10 절의 신규 등재 4건이 직전 라운드에 반박당한
   유예 근거와 같은 것인지 판정
3. `worktree` placeholder 근거 교체(`plan_coherence` → 현재 소비처)가 정당한 승계인지
   확인 — `3da85dc3b`(#576) 원 커밋과 대조

---

## 발견사항

### [정보] ① vacuous-test 전환(`bc10e215e`) — 직전 WARNING 을 제대로 반영함

- target 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts`(신규) +
  `plan-scan.test.ts`(신규) + `plan-frontmatter.test.ts`(호출부만 남김)
- 과거 결정 출처: 직전 라운드(`review/consistency/2026/08/10/02_47_31/rationale_continuity.md`
  §②) — "`docs-guard-legacy-fixture-coverage.md` 등재는 `developer/SKILL.md §ISSUE FIX 정책`
  ('TEST·REVIEW WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도 조치')과 문언 충돌" WARNING
- 상세: 실측 결과 지적을 정면으로 반영했다.
  - `worktree`/`started`/`owner` 판정이 `checkPlanFrontmatter(raw, relPath)` 순수 함수로
    추출됐고, `plan-scan.test.ts`(§`checkPlanFrontmatter`, 11개 `it`)가 각 필드의
    **negative-path**(placeholder 거부, 공백-only 거부, 잘못된 날짜(`2026-13-32` 등 js-yaml
    이 조용히 굴리는 값) 거부, owner 누락 거부)를 합성 fixture 로 직접 단언한다.
  - `plan-frontmatter.test.ts:82`~`99` 는 이제 `checkPlanFrontmatter` 결과를 필드별로
    가르기만 하고, 판정 로직 자체는 갖지 않는다 — positive-only vacuous 문제의 원인이던
    "가드가 자기 판정을 스스로 갖고 fixture 없이 실 파일만 본다" 구조가 제거됐다.
  - 등재했던 `docs-guard-legacy-fixture-coverage.md` 는 삭제됐다(`git show HEAD --stat` 확인).
  - 커밋 메시지가 "등재가 아니라 fix 인 이유" 를 `developer/SKILL.md §ISSUE FIX 정책` 문언을
    직접 인용해 명시했다 — 결정을 뒤집으면서 새 근거를 함께 적는다는 원칙에 부합.
  - 부수로 fixture 작성 과정에서 실 결함 2건(js-yaml 의 잘못된 날짜 조용한 정규화, gray-matter
    캐시가 부분 초기화 객체를 남기는 문제)이 드러나 같이 고쳐졌다 — vacuous 지적이 실제로
    유효했음을 사후 증명한다.
- 제안: 조치 불필요.

### [WARNING] ② `docs-guard-walker-dedup.md` 2026-08-10 절 — "선재 구조" 근거가 등재 4건 중 2건에서 사실과 어긋난다 (직전 라운드에 반박된 것과 부분적으로 같은 패턴의 재발, 게다가 이번엔 전제 자체가 틀렸다)

- target 위치: `plan/in-progress/docs-guard-walker-dedup.md` §"2026-08-10 추가" (4개 체크박스)
  + `review/code/2026/08/10/03_47_21/RESOLUTION.md` §"W1·W2·W3·W4 — 성능·중복 → 등재"
- 과거 결정 출처: 직전 라운드 WARNING(위 ①과 같은 출처, `02_47_31/rationale_continuity.md`
  §②) — "'선재 코드라 PR 밖' 근거는 `developer/SKILL.md §ISSUE FIX 정책`이 이미 배제한
  변명" 판정
- 상세: `RESOLUTION.md`(03_47_21)는 이번 등재가 직전에 반박당한 것과 "성격이 갈린다" 고
  스스로 주장한다 — "저쪽(W1, 03_28_25)은 이 PR 이 신설한 판정 로직의 vacuous 갭이라 같은
  파일·같은 축이었다. 이쪽 넷은 `spec-links.ts`/`spec-plan-completion.test.ts` 의 **선재
  구조**". 이번 라운드 orchestrator 프롬프트도 같은 문장("이것들은 이 PR 이 만든 결함이
  아니라 선재 구조")을 근거로 반복한다. **이 전제를 소스 레벨로 검증했더니 4건 중 2건에서
  거짓이다**:

  1. **`matter(raw, {})` 4곳 복제** — 실제 위치는 `plan-scan.ts:139,253`(신규 파일, 이 PR
     이 `bc10e215e` 에서 처음 작성) + `spec-plan-completion.test.ts:104,126`. 후자 2곳도
     origin/main 대조 결과 `matter(raw)`(옵션 없음)였다가 이 PR 자신의 커밋
     `be9a8fdb2`("재리뷰가 WARNING 6건을 더 잡았다")에서 `{}` 를 **새로 추가**한 것이다
     (원문: `git show origin/main:...spec-plan-completion.test.ts | grep matter` →
     `matter(fs.readFileSync(abs, "utf8"))`, 옵션 없음). 즉 4곳 전부가 **이 PR 의 커밋
     안에서 생겨난 코드**이며 "선재 구조" 가 아니다. 게다가 이 항목은 이름이 다른 walker
     들의 "제외 필터 차이" 와 무관한 단순 파싱 관용구 중복이라, plan 이 스스로 건 착수
     전제("필터 차이를 실측하지 않은 채 합치면 위험")도 적용되지 않는다 — `parseFrontmatterSafe`
     헬퍼 추출에는 의미론적 위험이 전혀 없다.
  2. **Gate C `collectCompletePlans` vs `collectCompletePlanMarkdown` 동등성 미보장** —
     `collectCompletePlans`(구, `spec-plan-completion.test.ts:59`)는 그대로지만
     `collectCompletePlanMarkdown`(신규, `plan-scan.ts:94`)은 이 PR 이 `findNonTerminalCompletedPlans`
     (신규 status 게이트)를 위해 **새로 작성**한 함수다. "동등성이 자동 검증 안 됨" 이라는
     결함은 이 PR 이 기존 함수를 재사용하는 대신 **병렬 구현을 새로 만든 선택** 에서
     비롯됐다 — 결함의 존재 자체가 이 PR 산물이다.

  반대로 항목 3(`spec-links.ts` 내부 `collectSpecMarkdown`/`collectCodebaseSources` DFS
  중복)과 항목 4(`extractLinks` 전수 스캔)는 실측상 정확히 "선재 구조" 다 — 두 함수 바디는
  origin/main 대비 **한 글자도 바뀌지 않았다**(diff 확인, 이 PR 은 그 파일에 신규 함수
  `findBrokenPlanLinks` 를 추가만 했다). 이 둘에 대해서는 disposition 이 정확하다.

  즉 이번 등재는 직전에 반박된 패턴과 "완전히 같지도, 완전히 다르지도" 않다 — 절반(③④)은
  진짜 선재 구조에 대한 정당한 유예이고, 절반(①②)은 **이 PR 자신이 만든 코드를 "선재
  구조" 로 잘못 분류**해 같은 회피를 반복한 것이다. `developer/SKILL.md §ISSUE FIX 정책`
  문언("TEST·REVIEW WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도 조치")은 애초에
  "선재냐 아니냐" 로 예외를 두지 않으므로, ③④ 조차도 직전 라운드가 지적한 문언-실무 간극이
  여전히 미해소 상태로 남아 있다(제안 (a)/(b) 중 어느 쪽도 아직 선택되지 않음). 다만 이번에
  새로 발견된 문제는 그보다 한 단계 더 심각하다 — ①②는 실무 판단(스코프 밖이라 유예)이 아니라
  **사실관계 오분류**(이 PR 코드를 선재 코드라고 잘못 씀)다.
- 제안:
  (a) 최소: `docs-guard-walker-dedup.md` §"2026-08-10 추가" 의 항목 1(`matter(raw,{}`)과
  항목 2(Gate C 동등성)에서 "선재 구조" 문구를 정정하고, 이 PR 이 만든 코드임을 명시.
  특히 항목 1 은 "필터 차이 실측" 전제와 무관하므로 그 전제에 얹지 말고 독립 항목으로
  분리할 것 (`parseFrontmatterSafe(raw)` 헬퍼 추출은 지금 당장 해도 위험이 없다 — 다음
  라운드로 미룰 이유가 약하다).
  (b) 근본: 직전 라운드 제안 (a)/(b) 중 하나를 이번에 결정 — `developer/SKILL.md §ISSUE FIX
  정책` 에 "동일 PR 이 반복적으로 인접 스코프를 흡수하면 수렴 못 한다" 는 명시적 예외 조항을
  추가하거나, 남은 항목들을 실제로 fix. 3개 라운드째 같은 미해결 상태로 넘어가고 있다.

### [WARNING] ③ `worktree` placeholder 근거 교체는 정당한 승계이나, 동일 폐기 사실을 여전히 반대로 서술하는 자매 문서가 남아 있다

- target 위치: `.claude/docs/plan-lifecycle.md:75`~`76`(이번 PR 이 수정) 및
  `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:152`~`166`(같은 정정을 코드
  주석에도 반영) — 이 둘 자체는 **문제 없음**.
  대조 대상(미수정 상태로 남은 자매 문서): `.claude/docs/worktree-policy.md:24`
- 과거 결정 출처: `3da85dc3b`("refactor(consistency): plan-coherence checker 에서
  cross-worktree 충돌 검토 제거 (#2 중복 작업·#5 worktree 충돌) (#576)", 2026-06-13) —
  "병렬 작업이 다른 머신/세션이면 로컬에 반영 안 돼 신뢰 불가 + 매 검토마다 git/gh 조회로
  토큰만 소모" 를 근거로 `plan_coherence` checker 의 cross-worktree 충돌 검출(중복 작업·
  worktree 충돌 두 항목)을 **명시적으로 제거**. 현재의 권위 있는 agent spec
  `.claude/agents/plan-coherence-checker.md:18` 도 "다른 worktree·branch 와의 동시 작업
  충돌… 은 검토 대상이 아니다" 라고 이 폐기를 정확히 반영하고 있음(실측 확인).
- 상세:
  - **본류(`plan-lifecycle.md`) 정정은 legitimate**. 종전 문구("placeholder 는 죽은
    worktree 처럼 보여 `plan_coherence` 충돌 검출을 오염시키므로 guard 가 거부한다")는
    `#576` 이 바로 그 `plan_coherence` 충돌 검출 기능을 제거한 뒤에도 **2개월간** 갱신되지
    않고 남아 있던 stale reference였다(`#576` 커밋 자체는 같은 문서의 다른 절 — "용도"
    bullet — 만 갱신했고, "worktree sentinel" bullet 은 놓쳤음을 `git show 3da85dc3b --
    .claude/docs/plan-lifecycle.md` 로 확인). 이번 PR 은 이 stale reference 를 실제
    소비처(`plan-stale-audit.sh` 의 `.claude/worktrees/$wt_value` 존재 판정 + §3 "연결
    판정" 의 worktree/branch 매칭)로 교체했고, `plan-scan.ts` 의 `WORKTREE_PLACEHOLDER`
    상수 주석에도 같은 교정 이력을 남겼다. 두 소비처 모두 코드로 실측 확인됨
    (`plan-stale-audit.sh:136` `[[ -d ".claude/worktrees/$wt_value" ]]`,
    `plan-lifecycle.md:55` "연결 판정" 정의). **기각된 대안의 재도입이 아니라, 이미
    죽은 근거를 실제로 죽은 대로 문서에 반영한 정당한 승계**다.
  - **다만 같은 사실을 반대로 말하는 자매 문서가 그대로 남아 있다.** `worktree-policy.md:24`
    "공유 자원 직렬화: 동일 `spec/` 파일·코드 영역을 두 worktree 가 동시 수정 중이면 plan
    에 명시하고 직렬화 (`consistency-checker plan_coherence` **가 사전 검출**)." 이 줄은
    `#576` 이전(`73dea0864`, 2026-05-19)에 작성된 뒤 `#576` 이후에도, 그리고 이번 PR
    에서도 손대지 않은 채 그대로다(`git log -S"공유 자원 직렬화"` 로 최초·유일 도입 커밋
    확인). 즉 지금 저장소 안에는 같은 사실(`plan_coherence` 의 cross-worktree 충돌
    검출 여부)에 대해 **셋 중 둘(agent spec, 새로 고친 plan-lifecycle.md)이 "없다"고,
    하나(worktree-policy.md)가 "있다(사전 검출한다)"고 말하는 상태**가 만들어졌다.
    사용자가 "SoT 문서도 함께 정정했다" 고 했을 때 가리킨 것은 `plan-lifecycle.md`
    (plan frontmatter 규약의 SoT)로 보이는데, `worktree-policy.md` 는 worktree 운영
    규약의 또 다른 SoT 성격 문서(CLAUDE.md §0 이 가리키는 문서)라 이번 정정 범위 밖에
    남았다. 이 문서는 build 가드가 읽지 않는 산문이라 즉시 장애는 없지만, "동시 작업은
    plan_coherence 가 사전 검출해 준다" 는 잘못된 안전감을 다음 세션에 줄 수 있다는 점에서
    운영상 오탐 유발 가능성이 있다.
- 제안: `worktree-policy.md:24` 를 `#576`·이번 PR 의 `plan-lifecycle.md` 교정과 같은
  방향으로 정정 — "동시 작업 직렬화는 사용자/`/merge-coordinate`(cross-branch-spec-analyzer)
  책임" 으로 바꾸고, `plan_coherence` 의 "사전 검출" 서술을 제거. 이번이 "마지막 정합
  라운드" 라면 이 한 줄 정정은 비용이 낮으니 이번 PR 안에서 같이 처리하는 편을 권장한다.

---

## 요약

세 질문 모두 실측 결과를 종합하면: (1) vacuous-test 전환은 직전 WARNING 을 제대로 반영한
진짜 fix 다(negative-path fixture·실결함 2건 발견으로 사후 검증됨). (2) 이번 라운드의 신규
등재 4건은 disposition 이 주장하는 것처럼 "직전에 반박된 유예 근거와 완전히 다른 성격" 이
아니다 — 4건 중 2건(`matter(raw,{})` 중복, Gate C 동등성 미보장)은 실제로 **이 PR 자신이
작성한 코드**인데 "선재 구조" 로 잘못 분류돼 있어, 직전 라운드에 반박된 것과 실질적으로
같은 회피 패턴이 사실관계 오류까지 얹혀 재발했다. 나머지 2건(`spec-links.ts` 내부 DFS
중복·`extractLinks` 전수 스캔)은 진짜 선재 구조라 disposition 이 정확하지만, `developer/
SKILL.md` 문언과의 근본 긴장은 여전히 미해결로 3라운드째 이월 중이다. (3) `worktree`
placeholder 근거 교체 자체는 `#576` 원 커밋과 대조해 검증된 **정당한 승계**이며 코드
주석까지 일관되게 갱신됐다 — 기각된 대안의 재도입이 아니다. 다만 같은 폐기 사실을 여전히
반대로 서술하는 자매 문서(`worktree-policy.md:24`, `#576` 이전부터 미수정)가 남아 있어
"SoT 를 함께 정정했다" 는 주장은 부분적으로만 참이다.

## 위험도

MEDIUM (Critical 0 · WARNING 2 — 둘 다 spec `## Rationale` 자체의 직접 위반이 아니라
process 규칙 문언과의 충돌·자매 문서 간 사실 불일치라 상한을 MEDIUM 으로 유지한다. 다만
②의 사실관계 오분류와 ③의 3개월 가까이 방치된 모순은 다음 세션이 그대로 물려받으면
누적되므로, 이번 "마지막 라운드" 안에서 최소 조치(②-a, ③)를 반영할 것을 권고한다)

STATUS=success
