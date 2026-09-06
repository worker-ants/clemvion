# Plan 정합성 검토 — `spec-draft-review-citations-enforcement.md`

## 검토 방법

- target 문서(`plan/in-progress/spec-draft-review-citations-enforcement.md`) 전문을 읽고,
  주장하는 실측(전제 반증·가드 스코프·`code:` 정의)을 실제 저장소 상태와 대조했다.
- 번들에 전문이 실린 `plan/in-progress/spec-draft-nullable-notation-followups.md`(자매 plan)
  · `plan/in-progress/spec-draft-api-convention-verifier-registration.md`(완료 주장 검증
  대상)를 전문 대조했다.
- 컨텍스트 예산으로 절단된 63개 plan 파일은, `grep -rl "review-citations"` /
  `grep -rl "spec-impl-evidence"` /`grep -rl "dto-jsdoc-citation"` 를 저장소 전체(번들이
  아니라 파일시스템)에 돌려 target 이 건드리는 두 spec 문서·세 가드 파일을 언급하는 모든
  in-progress plan 을 실측으로 특정했다 — "번들에 없다" 를 "관련 plan 이 없다" 의 근거로
  쓰지 않았다.

## 발견사항

이번 라운드에서 CRITICAL/WARNING 급 plan 정합성 결함을 찾지 못했다. 아래는 확인 과정에서
나온 INFO 항목이다.

- **[INFO]** 자매 plan 동기화 체크박스는 이미 워킹트리에 반영돼 있다 (target 종결 조건
  4번째 항목)
  - target 위치: `## 종결 조건` 4번째 미체크 항목 — *"자매 plan 동기화 … 이 draft 가
    선행 집행한다는 사실과 같은 glob 폭을 반영"*
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 「신규 검출
    3축 등재」 항목 (라인 571~573) — *"JSDoc 축은 `spec-draft-review-citations-enforcement.md`
    가 선행 집행한다 … 이 항목이 남기는 것은 §5.4 쪽 두 축(구조·이름)이다"*
  - 상세: `git status` 로 확인하면 `spec-draft-nullable-notation-followups.md` 는 현재
    워킹트리에서 **수정됨(M)** 상태이고, 그 수정에 위 인용문이 이미 포함돼 있다. 즉 target
    의 미체크 항목이 요구하는 동기화는 (같은 세션 안에서) 이미 텍스트로 반영된 상태다 — 두
    문서가 서로 다른 폭을 지시하는 실제 충돌은 없다.
  - 제안: 실질적 불일치는 없으므로 급하지 않다. 다만 target 을 커밋할 때 이 체크박스를
    미체크 상태로 남기면 다음 사람이 "아직 안 됐다" 로 오독할 수 있으니, 커밋 시점에
    체크 여부를 실제 diff 와 맞춰 정리할 것을 권한다.

- **[INFO]** "함께 처리할 것" 3번 항목(`spec-draft-api-convention-verifier-registration.md`
  를 `plan/complete/` 로 이동)의 전제는 실측 확인됨 — 조치는 비구속 권고
  - target 위치: `## 함께 처리할 것` 3번
  - 관련 plan: `plan/in-progress/spec-draft-api-convention-verifier-registration.md`
  - 상세: 해당 파일을 전문 대조한 결과 열린 체크박스(`- [ ]`)가 **0건**이고, `## `--spec`
    반영`` 절이 W1~W3·INFO 전부를 반영 완료로 기록하며 `2-api-convention.md`/`swagger.md`
    양쪽에 검증자 등재가 끝났음을 커밋(`21182db02` 등)으로 확인할 수 있다. target 의 전제가
    맞다. target 자신도 이 항목을 종결 조건이 아니라 권고로 명시했으므로 구속력 문제는 없다.
  - 제안: 없음 (그대로 두어도 무방, 이동은 별도 정리 커밋에서).

## 교차 확인 결과 (결함 없음, 기록용)

- `spec/conventions/review-citations.md` 의 `## Rationale` 첫 소절과
  `spec/conventions/spec-impl-evidence.md:81` 의 괄호 안 선례 인용은 **현재도 target 이
  지적한 그 낡은 문구 그대로**다 — target 의 반증 전제가 실측과 일치한다.
- `dto-jsdoc-citation-guard.ts` 는 `isResponseDtoFile()`(→ `swagger-dto-contract-guard.ts`
  에서 import)로 스코프를 좁히고 있어, target 이 변경안 (A) 표에서 "§3 컨트롤러 JSDoc =
  강제 안 됨" 이라 적은 서술과 실제 코드가 일치한다.
- `spec/**` · `plan/in-progress/**` 전체에서 "시행하는 코드가 없다"/"주석 형태를 강제하는
  가드가 없다" 류 문구가 나오는 자리는 target 이 이미 열거한 두 곳(`review-citations.md`
  Rationale, `spec-impl-evidence.md:81`) **뿐**이다 — target 밖에 놓친 자리는 없다.
- `plan/in-progress/spec-sync-external-interaction-api-gaps.md:507` 의 2026-08-24
  won't-do 판정(`code:` = "구현 경로" 이지 "인용 추적성" 아님)은 target 이 §2.1 을 다루는
  근거(변경안 C)와 **같은 방향**이고 충돌하지 않는다 — 오히려 그 선례를 강화한다.
- `harness-review-gate-followups.md` 의 열린 항목(*"신규 가드를 `spec-impl-evidence.md
  §4.2` SoT 에 등재"*)은 `stray-tool-tags.test.ts` family 를 가리키는 별개 항목이며
  `dto-jsdoc-citation*` 계열과 무관하다 — 오인 충돌 없음.
- `spec/5-system/2-api-convention.md` §5.4 「검증 층」과 `spec/conventions/swagger.md
  §5-1` 의 "두 검증자" 문구는 현재도 그대로 남아 있고(target 이 세 번째 축을 추가하지 않으므로
  이 문구를 건드리지 않는 것이 맞다), 그 문구를 "나열형으로" 고치는 책임은
  `spec-draft-nullable-notation-followups.md` 「신규 검출 3축 등재」 항목이 이미 소유하고
  있다고 양쪽 문서가 일치해서 적고 있다 — 역할 분담에 gap 이나 중복이 없다.

## 요약

target(`spec-draft-review-citations-enforcement.md`)이 반증한다고 주장하는 전제 — 
`review-citations.md` Rationale 과 `spec-impl-evidence.md §2.1` 의 "시행 코드 없음" 서술 — 
은 실측으로 재확인해도 여전히 저장소에 그대로 남아 있어 target 의 출발점이 유효하다. target
이 열어 둔 미해결 결정(변경안 A/B/C, glob 폭)은 다른 in-progress plan 이 이미 내린 결정과
충돌하지 않으며, 오히려 `spec-sync-external-interaction-api-gaps.md` 의 기존 won't-do
판정과 `spec-draft-api-convention-verifier-registration.md` 의 이미 완료된 "양쪽 `code:`
등재" 선례를 그대로 따르고 있다. 자매 plan(`spec-draft-nullable-notation-followups.md`)과의
역할 분담(JSDoc 축=target, 구조·이름 축=자매 plan)도 두 문서가 서로 일치해서 서술하고
있어 후속 항목 누락이나 중복이 없다. 컨텍스트 예산으로 절단된 63개 plan 파일 중 target 이
다루는 두 spec 문서·세 가드 파일을 언급하는 파일을 저장소 전체 grep 으로 별도 특정했고,
그 결과에서도 충돌 소지를 찾지 못했다.

## 위험도

NONE
