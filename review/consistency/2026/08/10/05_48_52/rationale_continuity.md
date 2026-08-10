# Rationale 연속성 검토 — plan-lifecycle-gates 티켓 종결 판정 (05_48_52, 최종 라운드)

## 조사 방법 메모

prompt_file 번들(2755줄)에 diff 섹션이 없다(알려진 결함 그대로 재현). 이번 라운드는
orchestrator 가 지목한 단일 질문 — `review/code/2026/08/10/05_39_08/RESOLUTION.md` §종결
판정의 등재 근거가, 같은 티켓에서 이미 두 번 반박된 유예 논리의 재발인지 — 을 판정하는
것이라 `spec/conventions/` 전체 재검토 대신 아래를 직접 실측했다:

- `git -C <worktree> diff origin/main...HEAD -- codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts`
  로 `hasValidSpecImpact`/`NONE_VALUES` 함수 바디가 이 PR 에서 변경됐는지 (선재 여부)
- `git -C <worktree> show origin/main:...spec-plan-completion.test.ts` 로 origin/main 원문 대조
- `plan/in-progress/docs-guard-walker-dedup.md` 원문 — W1(Gate C 함수 위치)·W2(`NONE_VALUES`)
  등재 문구
- 직전 두 라운드 원문: `review/consistency/2026/08/10/02_47_31/rationale_continuity.md`
  (WARNING②, 1차 반박) · `review/consistency/2026/08/10/04_07_54/rationale_continuity.md`
  (WARNING②, 2차 반박)
- `.claude/skills/developer/SKILL.md` §REVIEW WORKFLOW(줄 74~80) · §ISSUE FIX 정책(줄 133) —
  이 PR 안에서 무편집(`git log origin/main..HEAD -- .claude/skills/developer/SKILL.md` 결과 0건)
- `.claude/hooks/_lib/review_guard.py` — "게이트 freshness" 주장이 실제 메커니즘(commit
  author date 기반 staleness 재무장)에 근거하는지

---

## 발견사항

### [WARNING] RESOLUTION.md §종결 판정의 W2 등재 — "선재/스코프 밖" 반박은 피했으나, 두 라운드 전부터 미해결로 이월된 SKILL.md 문언-실무 간극을 세 번째로 그냥 지나쳤다

- target 위치: `review/code/2026/08/10/05_39_08/RESOLUTION.md` §"종결 판정 — 왜 #2 까지
  등재인가" (줄 19~40) + `plan/in-progress/docs-guard-walker-dedup.md` §"2026-08-10 추가"의
  "`NONE_VALUES` 정규화가 관측되지 않는다" 항목 (줄 82~87)
- 과거 결정 출처:
  1. `.claude/skills/developer/SKILL.md:74~75` (§REVIEW WORKFLOW) — "**강제 — 미루기 금지.**
     … `"범위가 커서" / "다음 턴에" / "PR 에서"` 미루는 것은 위반이며, hook 으로 강제된다."
  2. `.claude/skills/developer/SKILL.md:133` (§ISSUE FIX 정책) — "Warning 이상·테스트 누락은
     지시 범위 밖이라도 해결. TEST·REVIEW WORKFLOW 에서 발견된 사항은 기존부터 있던 것이라도
     조치."
  3. 이 티켓 자신의 직전 두 라운드가 이미 이 정확한 충돌을 두 번 지적함:
     `02_47_31/rationale_continuity.md` §WARNING② ("'선재 코드라 PR 밖' 근거는 SKILL.md 줄
     133 이 이미 배제한 변명 … (a) SKILL.md 에 명시적 예외 추가 또는 (b) 실제 fix, 둘 중
     하나를 **다음 라운드 전에 결정**") · `04_07_54/rationale_continuity.md` §WARNING②
     ("3라운드째 같은 미해결 상태로 넘어가고 있다 … **이번에 결정**").
- 상세:
  - **먼저 긍정적 차이부터.** 이번 등재는 앞선 두 라운드가 반박한 것과 표면 형태가
    다르다 — ① "선재 구조라 내 책임 아니다" (스코프 회피) 주장이 아니라 "4줄이면 닫히는 걸
    안다"고 비용이 낮음을 스스로 인정하면서도, ② 게이트 freshness(commit author date 기반
    staleness 재무장 — `review_guard.py` 실측 확인, 조작이 아니다) 때문에 지금 고치면 새
    리뷰 라운드가 또 열리고 그 라운드가 6번째 잔여를 낼 위험이 낮지 않다는 **수렴 리스크**
    논거를 편다. 이는 사용자 자신의 memory 교훈(`feedback_review_fix_stale_loop`: "수렴은
    '발견 0'이 아니라 발견의 성격(동작→구조→문서)으로 판단 … 미룬 항목은 그 턴에 plan 에
    적어라")의 정확한 적용이기도 하다 — RESOLUTION 표의 앞선 4건(캐시 우회·`isIsoDate`·SoT
    문서·`spec_impact` 존재/`spec/` 접두)은 전부 **동작 결함**이었고 실제로 이 PR 안에서
    고쳐졌다(`5860f295b`·`22b437873`·`4e1995cb8`·`6aacded22`). 반면 남은 W2 는 실데이터
    72+233건이 전부 정규 어휘만 쓰고 있어(RESOLUTION 인용) 정규화 누락은 **관측(테스트
    커버리지) 갭이지 재현된 동작 결함이 아니다** — 정확히 그 memory 가 말하는 "동작→구조→
    문서" 꼬리 단계로 넘어간 형태다. 즉 02_47_31·04_07_54 라운드가 반박했던 **바로 그
    핑계**(선재/스코프 밖)를 이번엔 쓰지 않았고, 항목 W1(Gate C 판정 함수가 `.test.ts`
    안에 상주)도 실측 결과 진짜 선재 구조다(`isGateCEnforced`/`hasValidSpecImpact` 는
    origin/main 부터 이미 `spec-plan-completion.test.ts` 안에 있었다 — `2d4775e28`, 이 PR
    은 시그니처만 바꿨다). 04_07_54 라운드가 "이 PR 이 만든 코드를 선재라 잘못 분류"했다고
    잡았던 항목 2건(`matter(raw,{})` 중복·Gate C 동등성 미보장)은 이번 라운드 전에 이미
    수정돼 plan 문서 자체가 "절반이 틀렸다 … 둘 다 그 PR 에서 해소했다"고 자기 정정까지
    해 뒀다(`docs-guard-walker-dedup.md:64~69`). 이 세 갈래(동작 결함 fix·오분류 자기 정정·
    W1 진짜 선재)는 모두 앞선 두 반박의 지적을 정확히 반영한 결과다.
  - **그럼에도 핵심 간극은 그대로 남았다.** `developer/SKILL.md:74~75` 는 정확히 "PR 에서"
    미루는 것을 명시적으로 위반이라 부른다. RESOLUTION 의 W2 disposition 은 문언 그대로
    "이 PR 안에서 끝낼 문제가 아니다 … plan/ 에 적어 두면 **다음 사람이** 한 번에 처리한다"
    — 이것은 "PR 에서 미루는 것" 그 자체다. `:133` 도 "기존부터 있던 것이라도 조치"라고
    예외 없이 못박는다. 앞선 두 라운드가 제시한 갈림길은 둘 중 하나였다 — (a) SKILL.md 에
    이런 수렴-리스크 예외를 **명문화**하거나, (b) 그냥 fix. 이번 최종 라운드는 **둘 중
    어느 쪽도 택하지 않았다**: `git log origin/main..HEAD -- .claude/skills/developer/SKILL.md`
    가 0건이라 SKILL.md 는 이 PR 안에서 전혀 편집되지 않았고, W2 자체도 fix 되지 않았다.
    게다가 RESOLUTION.md 본문에는 "rationale"·"SKILL.md"·"ISSUE FIX"·"미루기" 어느 문자열도
    등장하지 않는다(grep 확인) — 즉 이 disposition 은 앞선 두 라운드가 **같은 세션의 같은
    티켓 안에서** 이미 두 번 지적하고 "이번엔 결정하라"고 명시적으로 요청한 사안을, 인지한
    흔적조차 남기지 않고 세 번째로 그냥 지나쳤다.
  - **결론**: 이건 앞서 반박된 두 사례의 **문자 그대로의 재발은 아니다** — 근거의 성격이
    "회피(스코프 밖)"에서 "근거 있는 수렴 판단(freshness 재무장 비용 + convergence 신호)"
    으로 실질적으로 개선됐고, 사실관계 오류도 없다. 그러나 **구조적으로는 같은 결함의
    재발**이다 — `developer/SKILL.md` 의 명문 규칙("PR 에서 미루지 마라")을 뒤집는 결정을
    세 번째로 내리면서, 그 결정을 지지하는 새 Rationale 을 규칙 문서 자신에 한 줄도 남기지
    않았다. 이는 본 checker 의 판정 기준 ③"결정의 무근거 번복 — 과거 결정을 뒤집으면서 새
    Rationale 를 함께 작성하지 않고 있는가"에 정확히 해당한다("무근거"가 아니라 "새
    Rationale 미기재"가 문제라는 점에서 등급은 WARNING 이 맞다 — CRITICAL 기준인 "명시적으로
    기각된 대안의 채택"에는 못 미친다. 다만 `:74~75` 의 "PR 에서 … 위반" 문구가 이 disposition
    과 문자 그대로 겹친다는 점에서, **네 번째 반복 시엔 CRITICAL 로 재평가할 근거가 된다**).
- 제안:
  - **최소(권장, 지금 바로 가능)**: `developer/SKILL.md §ISSUE FIX 정책`(줄 133) 뒤에 짧은
    예외 조항을 추가한다 — 예: "단, 같은 PR 이 리뷰-fix 라운드를 반복하며 매 라운드 잔여가
    발견의 성격상 동작 결함이 아니라 테스트 커버리지 갭으로 수렴하고 있고, 게이트 freshness
    재무장으로 인해 fix 자체가 새 라운드를 강제하는 경우, `RESOLUTION.md`§종결 판정 에 근거를
    명시하고 `plan/in-progress/`에 즉시 등재하는 것으로 갈음할 수 있다." 이 한 문단이면 이번
    RESOLUTION 의 W2 disposition 이 "무근거 번복"에서 "명문화된 예외의 적용"으로 전환된다 —
    비용이 낮고, 이 티켓이 "마지막 라운드"를 자칭하는 지금이 가장 싼 시점이다.
  - **대안**: 예외를 문서화하지 않을 것이라면 W2 를 실제로 fix 하고(4줄, RESOLUTION 자신이
    이미 크기를 확인함) 그로 인한 6번째 라운드를 받아들인다 — SKILL.md 문언과 실무를
    일치시키는 원래 (b) 경로.
  - 둘 중 무엇을 택하든, 다음에 같은 상황이 재발하면 RESOLUTION.md 가 이 rationale-continuity
    라인(02_47_31·04_07_54·본 라운드)을 **직접 인용**해 "이미 검토·승인된 예외"임을
    명시하기를 권장한다 — 지금처럼 근거 없이 반복되면 그 자체가 다음 checker 에게는
    "패턴이니 관례"로 오인될 위험이 있다(04_07_54 §요약이 이미 경고한 바로 그 위험).

### [INFO] RESOLUTION.md 가 §RESOLUTION schema 의 필수 섹션 표제를 문자 그대로 쓰지 않음

- target 위치: `review/code/2026/08/10/05_39_08/RESOLUTION.md` 전체
- 과거 결정 출처: `developer/SKILL.md` §RESOLUTION.md schema (줄 111~115) — `## 조치 항목`·
  `## TEST 결과` 두 섹션 필수, `## 보류·후속 항목`은 있을 때만.
- 상세: 이 RESOLUTION.md 는 `## WARNING 4건 — 전부 … 등재` / `## 종결 판정` / `## 이 티켓이
  최종적으로 닫은 것` / `## 검증` 네 섹션으로 구성돼 있다. 내용상 `## 조치 항목`(각 WARNING
  의 처분)과 `## TEST 결과`(§검증에 lint/unit/e2e 수치 포함)에 해당하는 정보는 들어 있지만
  표제 문자열이 스키마와 다르다. push 전 자가 검증 체크리스트("`## 조치 항목`·`## TEST
  결과` 두 섹션 모두 있는가")를 문자 그대로 적용하면 실패로 읽힐 수 있다.
- 제안: 조치 불필요 수준이나, 다음에 이 파일을 건드릴 일이 생기면 표제만 스키마에 맞춰
  정정 권장 (`## 검증` → `## TEST 결과`, `## WARNING 4건…` 앞에 `## 조치 항목` 추가 또는
  이관 표를 그 표제 아래로).

---

## 요약

**판정: 재발이 아니다(문자 그대로는) — 그러나 재발이다(구조적으로는).** RESOLUTION.md
(05_39_08)의 W2 등재 근거는 이 티켓에서 두 번 반박된 "선재 구조/스코프 밖" 핑계를 이번엔
쓰지 않았다 — 비용이 낮음을 스스로 인정하고, 게이트 freshness 재무장이라는 실측 가능한
기술적 제약을 근거로 들며, 사용자 자신의 convergence 교훈("발견의 성격 변화로 판단")을
정확히 적용해 "동작 결함→테스트 커버리지 갭"으로 전환됐다는 관찰까지 뒷받침한다. 앞서
반박됐던 사실관계 오류(자기 PR 코드를 선재로 오분류)도 이번 라운드 전에 이미 자기 정정되고
fix 됐다. 이 점에서 이번 disposition 은 앞선 두 사례보다 근거 품질이 명확히 낫다. 그러나
`developer/SKILL.md:74~75`("PR 에서 미루는 것은 위반")·`:133`("기존부터 있던 것이라도
조치")의 명문 규칙을 뒤집는다는 사실 자체는 그대로이고, 앞선 두 라운드가 "이번 라운드
안에 (a) SKILL.md 예외 명문화 또는 (b) 실제 fix 중 하나를 결정하라"고 명시적으로 요청한
사안을 이번 최종 라운드도 — RESOLUTION.md 본문에 SKILL.md/ISSUE FIX/rationale 언급이
전혀 없다는 점에서 인지한 흔적조차 없이 — 세 번째로 그냥 넘겼다. `developer/SKILL.md
§ISSUE FIX 정책` 문언과 `feedback_review_fix_stale_loop` 수렴 교훈은 여기서 정확히
갈린다: 전자는 "발견되면 무조건 그 턴에 조치"를 요구하고, 후자는 "수렴 신호가 보이면
등재하고 넘어가라"고 가르친다. 이번 disposition 의 **실질적 판단**은 후자에 부합하지만,
**절차적으로** 전자를 명시적으로 개정하거나 반박하지 않은 채 세 번째로 침묵 속에 우회했다는
점에서 WARNING 이다.

## 위험도

MEDIUM (Critical 0 · WARNING 1 · INFO 1 — spec `## Rationale` 직접 위반이 아니라
`developer/SKILL.md` 공정 규칙 문언과의 세 번째 미해소 충돌이라 상한을 MEDIUM 으로 유지한다.
다만 "PR 에서 미루는 것은 위반" 문구와 문자 그대로 겹치는 형태가 다음에 또 무근거로
반복되면 CRITICAL 재평가 대상이다. 권고: 이번이 정말 "마지막 라운드"라면, 위 최소 제안
— SKILL.md 에 한 문단 예외 명문화 — 을 이 티켓이 실제로 닫히기 전에 반영할 것)

STATUS=success
