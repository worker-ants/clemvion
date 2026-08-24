### 발견사항

- **[WARNING]** 신규 등재한 harness 갭이 기존 harness 트래커와 단절돼 중복 진단 위험
  - target 위치: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의
    `--spec 번들러가 spec_impact 대상을 후보 집합에 넣지 못한다 (하네스)` 항목
    (target 문서 B4 절 "⚠️ 위 진단이 반증됐다" 문단이 이 등재를 유발)
  - 관련 plan: `plan/in-progress/harness-consistency-summary-downgrade-rule.md`
    (§"관련 관측 — `--impl-done` scope 가 실제 diff 와 무관한 번들을 싣는다", 특히
    2026-08-09 실측 절 line 179-206) + `plan/in-progress/harness-review-gate-followups.md:462`
  - 상세: target 이 이번 세션에서 *"`node-output.md` 는 `related_specs` 후보 선정 자체가
    도달 못 한다"*(bundle 113개·절단 목록 110개 모두 부재)를 새로 실측하고, 이를
    `spec-sync-external-interaction-api-gaps.md`(EIA spec 갭 전용 트래커)에 **신규 하네스
    항목**으로 등재하며 제안 처방으로 *"후보 선정이 `spec_impact` 를 무조건 포함하도록
    고치는 것"* 을 적었다. 그런데 정확히 같은 처방(`spec_impact` 우선 포함)이
    `harness-consistency-summary-downgrade-rule.md` 에 **2026-08-09 시점 이미 제안돼 있고
    미구현으로 남아 있다** — 그 문서는 `spec/5-system/`(`node-output.md` 포함 conventions)이
    "폴더 dump 와 diff 가 공존할 수 없다"·"어떤 실용 예산으로도 불가능"이라는 것을
    6~7회 재발로 실측·정량화(예: `12-workspace.md` 3.33MB 지점, 필요 예산 8.3MB)해 뒀고,
    `convention_compliance` 번들에서 `node-output.md` 가 cafe24 카탈로그에 밀려나는 동형
    증상도 이미 다뤘다(2026-07-31 tier-3 강등으로 그 축만 부분 해소). target 의 새 항목은
    이 축적된 진단·수치·미구현 처방을 인용하지 않고 처음부터 다시 쓴다. `harness-review-gate-
    followups.md:462` 도 *"기등재된 `--spec` 예산 항목(`related_specs` 가 `5-system/` 에
    도달 못 함)"* 이라는 문구로 같은 사실을 이미 가리키고 있다. target 문서 전체와
    `spec-sync-external-interaction-api-gaps.md` 어디에도 이 두 harness 트래커에 대한
    언급이 없다(grep 0건, 실측).
  - 제안: 새 항목에 `harness-consistency-summary-downgrade-rule.md`(스코프 사전확인·
    `spec_impact` 우선 포함 미구현 절) 및 `harness-review-gate-followups.md:462` 로
    상호 참조를 추가하거나, EIA 갭 트래커 대신 저 두 harness 트래커 중 하나로 항목을
    이관해 단일 진실을 유지할 것. 특히 target 의 진단(*"related_specs 후보 자체에 없음"*)은
    기존 트래커의 "잘림(truncation)" 진단보다 한 겹 더 근본적이라 — 그 축의 차이를
    기존 트래커에 **추가 실측**으로 병합하는 편이 harness 개선 우선순위 판단에 유리하다.

### 요약

`plan/in-progress/planner-doc-batch.md` 는 `spec-sync-external-interaction-api-gaps.md` 트래커
(B1~B7 7건)와 매우 촘촘하게 동기화돼 있다 — 실제 diff(4af06d951·dd8a17207)를 대조한 결과
각 항목의 "해소" 서술이 실제 spec 변경과 정확히 일치하고, `conversation-thread.md` §9.7 의
미해결 ⚠️ 캐비엇(`system_error` 배너 CRITICAL, 코드 미수정)이나 `egress-masking.md` line 84 의
`ws-event-types-extract.md` 미체크 캐비엇도 손대지 않고 보존했다. B3 각주는 2회차
`--spec` 게이트가 잡은 "기각된 대안(WS C3)을 재해석으로 되살릴 뻔한" 실수를 자체 발견해 정정한
이력까지 남아 있어, 미해결 결정 우회나 선행 plan 미해소 CRITICAL 은 발견되지 않았다. 유일한
실질적 갭은 이번 세션이 새로 진단한 harness(consistency 번들링) 결함이 이미 두 개의 harness
백로그 문서에 정량화돼 있는 것과 사실상 같은 증상·같은 처방인데도 교차 참조 없이 별도
트래커에 고립 등재된 것 — WARNING 수준의 후속 항목 정합성 문제다.

### 위험도
LOW
