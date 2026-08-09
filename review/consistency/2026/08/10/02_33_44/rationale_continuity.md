# Rationale 연속성 검토 — 5차 라운드 (종결 확인)

## 진단 메모

prompt_file 의 diff 섹션 부재(알려진 결함)로, 워킹트리 절대경로
(`/Volumes/project/private/clemvion/.claude/worktrees/plan-lifecycle-gates`)에서 직접
`git log`/`git show`/`git diff`로 실제 변경분을 재수집했다.

4차 라운드(`review/consistency/2026/08/10/02_18_34/rationale_continuity.md`, 판정 **NONE**,
baseline 커밋 `f5f454844`) 이후 반영된 변경을 확인했다:

```
$ git diff f5f454844 HEAD --stat -- . ':!review'
 .../lib/docs/__tests__/plan-frontmatter.test.ts | 26 +++++++++++++++-------
 1 file changed, 18 insertions(+), 8 deletions(-)
```

커밋 `6101a04b2`("fix(harness): non-vacuity 캐너리가 discovery 만 증명하던 것을 추출
단계로 강화 (ai-review W1)") 단 하나뿐이다. 그 뒤 `c703039ba`는 `review/**` RESOLUTION
문서(1개 파일, e2e 줄 확정) 뿐이라 코드·spec 변경이 아니다.

`spec/conventions/spec-impl-evidence.md` 자체는 이 구간에서 **바이트 단위로 무변경**임을
확인:

```
$ git diff f5f454844 HEAD -- spec/conventions/spec-impl-evidence.md
(출력 없음)
```

## 확인 대상 커밋 — `6101a04b2`

변경 파일 1개, `codebase/frontend/src/lib/docs/__tests__/plan-frontmatter.test.ts`(테스트
코드, spec 문서 아님):

1. `"the plan link scanner actually sees links (non-vacuity)"` — 종전엔
   `collectLivePlanMarkdown(root).length > 5` (파일 수 카운트)만 검사해, `extractLinks`
   가 상시 `[]` 를 반환해도 통과하는 vacuous 캐너리였다. 이번 변경은 `extractLinks` 를
   import 해 살아있는 plan 들에서 **실제로 추출된 링크 총수**를 세고 `> 50` 을 단언하도록
   단언을 추출 단계로 끌어올렸다.
2. `"finds completed plans to validate"` → `"finds completed plans to validate
   (discovery only)"` — 로직·임계값(`> 5`)은 그대로 두고, 이 단언이 discovery(파일 발견)
   만 증명하며 실제 위반 탐지 증명은 `plan-scan.test.ts`(합성 fixture 3건 주입/검출)
   소관이라는 사실을 이름·주석으로 명시했다.

## 점검 관점별 분석

### 1. 기각된 대안의 재도입

해당 없음. 이 변경은 새 대안을 채택한 것이 아니라 기존 non-vacuity 캐너리의 **약점을
메운 강화**다. `spec-impl-evidence.md` 의 어떤 R-1~R-10 도 이 테스트의 임계값·검증 대상
metric 을 규정한 적이 없으므로 "과거에 거부됐다가 되살아난 대안" 자체가 존재하지 않는다.

### 2. 합의된 원칙 위반

없음. 오히려 R-9("§4.2 지식저장소·plan 무결성 가드 — 별도 family 신설 근거")가 명시하는
"판정 로직이 실제로 위반을 잡는지는 별도 fixture 로 증명"(→ `plan-scan.test.ts` 가 그
소관)이라는 도메인 분리와 정합한다. 이번 커밋의 주석이 그 분업을 그대로 재확인한다:
"discovery(파일 발견)"은 본 테스트가, "탐지 로직 정확성"은 `plan-scan.test.ts` 가 각각
책임진다는 구도를 흐리지 않고 오히려 이름으로 명문화했다.

### 3. 결정의 무근거 번복

없음. `spec/conventions/spec-impl-evidence.md`(§4.2 표·Rationale) 는 이 구간에서
무변경이며, 이번 커밋도 spec 문서의 어떤 서술을 바꾸지 않는다. 바뀐 것은 테스트
어서션의 검증 단위(파일 수 → 추출된 링크 수)뿐이고, 이는 "설계 결정의 번복"이 아니라
자기 자신의 vacuity 결함을 고친 **품질 강화**다 — 새 Rationale 항목을 요구할 성격의
"결정"이 아니다.

### 4. 암묵적 가정 충돌

없음. 임계값 `> 50` 은 실제 링크 추출 총수에 근거한 하한이고(뮤테이션: `extractLinks →
[]` 로 RED 확인, 커밋 메시지에 명시), 자매 테스트의 `> 5` 하한("실제 개수에 가깝게
잡으면 grooming 때마다 깨진다")이라는 종전 원칙은 그대로 유지됐다(코드·주석 모두
불변). `spec-impl-evidence.md` 가 기록한 시스템 invariant(§4.2 도메인 분리, R-9) 를
우회하는 요소는 없다.

## 발견사항

새 발견 없음. 4차 라운드(NONE) 이후 유일한 변경(`6101a04b2`)은 테스트 코드 내부의
non-vacuity 어서션 강화이며, `spec/conventions/**` 어떤 spec 문서도 건드리지 않았다.
기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 — 네 관점 모두 해당
사항 없음. 게이트를 열어도 된다.

## 요약

5차 라운드는 종결 확인 라운드다. 직전(4차, `02_18_34`) NONE 판정 이후 반영된 유일한
변경은 `plan-frontmatter.test.ts` 의 non-vacuity 캐너리 하나를 discovery-only 검증에서
실제 추출 단계 검증으로 끌어올린 테스트 강화(`6101a04b2`)이며, `spec/conventions/
spec-impl-evidence.md` 는 이 구간에서 바이트 단위로 무변경임을 `git diff` 로 직접
확인했다. 이 변경은 설계 결정이 아니라 자기 캐너리의 vacuity 결함(파일 수만 세면
`extractLinks` 가 죽어도 통과)을 고친 단언 강화이고, R-9 가 정한 "discovery vs 탐지
로직 정확성" 도메인 분리를 오히려 명문화해 강화했다. Rationale 연속성 관점에서 이
게이트는 열려도 된다.

## 위험도

NONE

STATUS=success
