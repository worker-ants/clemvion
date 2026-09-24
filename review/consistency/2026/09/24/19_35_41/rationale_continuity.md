# Rationale 연속성 검토 — target: `spec/conventions` (--impl-prep)

## 검토 범위 및 방법

이번 impl-prep 은 `spec/conventions` 를 scope 로 지정했으나, 실제 diff(HEAD `c288c7aaf` vs
`origin/main`)는 spec 문서를 건드리지 않고 `spec-frontmatter-parse.ts` / 관련 테스트 /
`plan/in-progress/pending-plan-is-plan.md` 만 바꾼다. 즉 이 검토는 **"`pending_plans` 가드를
그게 실제 plan 문서인지 검사하도록 고치는" 구현이, `spec/conventions/spec-impl-evidence.md`
및 상호 참조되는 spec 들의 `## Rationale` 과 continuity 가 있는가**를 확인하는 성격이다.

번들에서 전문이 제공된 문서: `spec-impl-evidence.md`(R-1~R-11 전체), `audit-actions.md`,
`cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, 그리고
`5-system/10-graph-rag.md`·`0-overview.md`·`1-data-model.md`·`2-navigation/1-workflow-list.md`·
`2-trigger-list.md`·`3-schedule.md` 의 `## Rationale` 절. 나머지 268개 `spec/conventions/**`
파일은 컨텍스트 예산 초과로 헤더만 제공됐다 — 이 판정에서는 그 부재를 "충돌 없음" 의 근거로
쓰지 않았고, 실제로 그 파일들(cafe24/makeshop API 카탈로그 field-level 레퍼런스)은 이번 변경
(pending_plans 가드) 과 도메인이 겹치지 않는다.

## 발견사항

이번 구현·plan(`plan/in-progress/pending-plan-is-plan.md`)이 도입하는 판정 —
`isPendingPlanPath`: `plan/in-progress/**.md` · `plan/complete/**.md` 만 참, `plan/research/**`
는 의도적으로 거짓, 접두 검사 전 경로 정규화 — 을 `spec-impl-evidence.md` 의 기존 Rationale
과 대조한 결과 **기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 중 어느
것도 발견되지 않았다.** 오히려 이 변경은 아래처럼 **기존에 이미 선언된 계약을 구현이
뒤늦게 따라잡는** 성격이라 Rationale 연속성 관점에서는 정합 방향이다.

- `spec-impl-evidence.md` §2.1 `pending_plans` 필드 정의는 이미 "`plan/in-progress/` 또는
  `plan/complete/`(in-progress 경로를 complete 로 치환) 에 실존 의무" 라고 명시하고 있고,
  §4 가드 표의 `spec-pending-plan-existence.test.ts` 서술도 동일하다. 종전 구현
  (`fs.existsSync` 로 디스크 어디든 파일이 있으면 통과)은 이 문구보다 **좁지 않고 더 넓게**
  허용했던 것이므로("문서한 보장이 구현보다 넓다" — `feedback_documented_guarantee_wider_than_built`
  패턴과 정확히 대칭), 이번 수정은 spec 문구를 바꾸지 않고 구현만 그 문구에 맞춘 것이다.
  → R-5(`pending_plans` 의 존재 이유: plan 라이프사이클 역방향 강제, 텔레그램 chat-channel
  "빈 약속" 재발 방지)의 원취지를 그대로 강화한다.
- `plan/research/` 를 거짓으로 판정하는 근거로 plan 이 인용한 것은 `CLAUDE.md` "정보 저장
  위치" 표(`plan/research/` = "완료 종착점이 없어 참조되는 문서")이며, `spec-impl-evidence.md`
  자체에는 `plan/research/` 를 명시적으로 언급하는 문장이 없다. 그러나 §2.1 의 "`pending_plans`
  = 미구현 surface 를 **책임지는** plan 경로" 라는 정의와 §3.1 승격 규칙("마지막 `pending_plans`
  가 `complete/` 로 이동하는 commit 에서 승격")은 애초에 "종착점이 있는 plan" 만을 전제하므로,
  `plan/research/` 배제는 **기존 정의의 자연스러운 함의**를 코드로 확정한 것이지 새 원칙의
  창설이 아니다.
- R-11 이 이미 "가드가 보던 자리를 사람이 본다" — 즉 `spec-status-lifecycle.test.ts` 는
  "전부 `complete/` ⇒ 승격" 한 방향만 기계로 강제하고, 반대 방향(공유 트래커의 문서별 몫
  판정)은 사람이 판정 근거를 commit 에 남기는 방식으로 보완한다고 선언해 두었다. 이번 plan 의
  §D("완료된 plan 을 가리키는 항목을 거부하는 것은 하지 않는다 — 규약을 바꾸는 판단이라
  planner 몫")는 이 "가드는 좁게, 판단은 사람에게" 원칙과 같은 결을 유지한다 — 가드 범위를
  임의로 넓히지 않고 별도 트래커 항목으로 명시적으로 분리해 둔 점도 R-8(Gate C 설계에서
  "build 테스트가 결정적으로 검증 가능한 것만 가드로, 판단이 필요한 것은 사람의 선언으로"
  택했던 것)과 같은 패턴이다.

## 경미한 보완 제안 (INFO)

- **[INFO]** `pending_plans` 의 `plan/research/` 명시적 배제 근거가 `spec-impl-evidence.md`
  자체의 `## Rationale` 에는 없다
  - target 위치: `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행 / §4 가드 설명
  - 과거 결정 출처: 없음(신규 근거가 `plan/in-progress/pending-plan-is-plan.md` §B·D 와
    `CLAUDE.md` 정보 저장 위치 표에만 존재)
  - 상세: 현재 §2.1 문구("`plan/in-progress/` 또는 `plan/complete/`… 실존 의무")는 결과적으로
    `plan/research/` 를 배제하지만, "왜 `research/` 는 안 되는가"(완료 종착점이 없어 `partial`→
    `implemented` 전이의 근거가 될 수 없음)를 명시적으로 언급하지 않는다. 가드 구현
    (`isPendingPlanPath`)이 이 사실을 판정 로직으로 확정한 지금, spec 문서 쪽에는 그 이유가
    여전히 암묵적이다. 다음 사람이 "왜 research 는 막혀 있나"를 다시 발굴해야 할 수 있다.
  - 제안: R-5 또는 새 항목(R-12)에 "`pending_plans` 는 완료 종착점이 있는 `plan/in-progress/`·
    `plan/complete/` 만 인정하고 `plan/research/`(참조 전용, 완료 상태 없음)는 제외한다" 는
    한 문장을 추가하면, 가드·spec·plan 세 자리의 서술이 완전히 맞물린다. 다만 이는 이번
    plan 의 결함 수정 범위를 넘는 문서 보강 성격이라 이번 PR 을 막을 사안은 아니다.

## 요약

이번 impl-prep 대상은 `pending_plans` 가드가 "존재 검사" 에서 "그게 plan 인지 검사" 로
좁아지는 변경으로, `spec-impl-evidence.md` §2.1·§3.1·§4·R-5·R-11 어디와도 충돌하지 않는다 —
오히려 구현이 이미 문서화된 계약(§2.1 의 in-progress/complete 실존 의무)을 뒤늦게 따라잡는
"구현을 spec 에 맞추는" 방향이며, 판단이 필요한 부분(완료된 plan 을 가리키는 항목의 거부
여부)은 R-11 이 이미 확립한 "가드는 좁게, 결정은 사람이 기록" 원칙을 그대로 따라 별도
트래커 항목으로 명시적으로 분리해 두었다. spec/conventions 나머지 268개 파일은 예산 초과로
본문이 제공되지 않았으나 이번 변경(pending_plans 존재 판정)과 도메인이 겹치는 근거는 없다.
발견된 것은 spec 자체의 Rationale 문구를 조금 더 명시적으로 만들면 좋겠다는 INFO 수준
보완 제안 하나뿐이다.

## 위험도

NONE
