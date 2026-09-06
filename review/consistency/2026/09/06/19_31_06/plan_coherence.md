# Plan 정합성 검토 — spec/2-navigation (impl-done)

## 조사 범위 요약

이 PR(`user-entity-column-defense`, 23파일/2765줄)은 `User` 엔티티 컬럼 유출 방어가
본체이며 `spec/2-navigation/` 자체는 델타 0(변경 없음)이다. 다만 `spec/2-navigation/
2-trigger-list.md` 의 `code:` 프런트매터가 지목하는 `triggers.controller.ts` /
`triggers.service.ts` 는 이번 diff 에 포함돼 있어(엔드포인트 충돌 처리 신설), 그 변경이
target 문서·`plan/in-progress/**` 의 미해결 항목과 충돌하는지를 실측했다.

- `git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/` 로 실제 변경 확인.
- `plan/in-progress/spec-draft-nullable-notation-followups.md` (spec_impact 에
  `spec/2-navigation/2-trigger-list.md`·`3-schedule.md` 명시) 의 `## 후속` 체크리스트 전수 확인.

## 발견사항

- **[INFO]** `2-trigger-list.md` 의 자기모순 3건은 이미 plan 에 정확히 계류돼 있고, 이 PR 은
  건드리지 않는다 — 새로운 충돌 아님
  - target 위치: `spec/2-navigation/2-trigger-list.md` R-2(276행대)/§3 각주(209행)/frontmatter
    `status: implemented` vs §3 본문(200행 "sort/order 반영은 미구현/Planned")/§2.3.1
    `botToken` 행(155행, "hasBotToken: boolean 만 노출" vs "마스킹 placeholder ····<last4>")
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속` 의
    미체크(`[ ]`) 3항목 — "R-2 가 폐기된 설계를 유효한 것처럼 남기고 있다"
    (`review/consistency/2026/09/06/15_31_00` W1) · "frontmatter status 가 본문의 자백과
    모순"(동 W3) · "botToken 행의 자기모순"(`14_59_49` W2)
  - 상세: 실측 결과 세 모순 모두 현재 target 본문에 그대로 남아 있음을 확인했다(예: R-2 가
    가리키는 `hmacSecret` 행은 현행 §2.3.1 매트릭스에 이미 없고 `authConfigId` 로 대체됨 —
    R-2 자체가 폐기된 설계를 유효한 듯 서술). 이 PR 의 diff(`isEndpointPathUniqueViolation`,
    `rethrowEndpointPathConflict` 신설)는 이 세 항목 중 어느 것도 건드리지 않았고, plan 은
    이미 각 항목을 담당(planner)·근거·수정안까지 등재해 둔 상태라 "충돌" 이 아니라
    "정상적으로 이월된 미결" 이다.
  - 제안: 조치 불요(이번 PR 범위 밖). 참고로 남긴다 — 다음 planner 턴이 그 plan 파일의
    체크박스를 그대로 이어받으면 된다.

- **[WARNING]** `2-trigger-list.md §2.3.1` 이 가리키는 `eia-trigger-edit-ui` plan 이 어디에도
  존재하지 않는다 — 이미 구현된 기능을 미완료로 착각하게 하는 죽은 포인터
  - target 위치: `spec/2-navigation/2-trigger-list.md:101` — "External Interaction
    (Notification) | `url`/`events`/`signing`/`retry` | edit | … 별 plan
    `eia-trigger-edit-ui` 가 구현"
  - 관련 plan: 없음(`plan/in-progress/` · `plan/complete/` 전수 검색, `eia-trigger-edit-ui`
    라는 이름의 파일이 존재하지 않음). 도입 커밋 `877e7b642679` (2026-05-22, #265) 가
    "Plan B(`trigger-detail-edit-meta.md`)는 `eia-trigger-edit-ui` 머지 후 진행" 이라 적었으나
    그 이름의 plan 파일 자체가 만들어진 적이 없다.
  - 상세: 실제로 그 기능(EIA notification/interaction 편집 UI)은 이미 구현돼 있다 —
    `codebase/frontend/src/components/triggers/cards/external-interaction-card.tsx`
    (최초 커밋 2026-06-23, #674) + backend `update-trigger.dto.ts` 의 `notification`/
    `interaction` 필드. 즉 target 문서가 "미완료·별도 plan 대기" 로 서술하는 선행조건은 이미
    3개월 전에 해소됐는데, 그 사실을 알려줄 plan 문서 자체가 없어 이 이월이 영구히 닫히지
    않는 상태다. 이번 PR 과는 무관한(diff 미포함) 선재(先在) 결함이라 이 PR 을 막을 사유는
    아니다.
  - 제안: 다음 planner 턴에서 "별 plan `eia-trigger-edit-ui` 가 구현" 문구를 제거하거나(이미
    구현됐으므로) `external-interaction-card.tsx` 를 가리키는 서술로 정정. `spec-impl-evidence.md`
    라이프사이클 관점에서도 이 행의 근거가 이제 코드로 대체됐음을 반영해야 한다.

## 요약

이 PR 의 diff 는 `spec/2-navigation/2-trigger-list.md §2.3.1/§3` 이 이미 계약으로 명시한
`TRIGGER_ENDPOINT_PATH_CONFLICT` 409 응답을 정확히 구현했고(`rethrowEndpointPathConflict`),
그 구현 과정에서 마주친 "top-level `code` 교체 vs `details.code`" 표현 방식 결정은 코드 주석에
남기고 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 항목으로
등재해 일방적으로 결정하지 않았다 — 미해결 결정 우회 없음. `spec/2-navigation` 영역에 이미
알려진 자기모순 3건은 그대로 plan 에 정확히 계류돼 있어 이 PR 이 새로 만든 문제가 아니다.
다만 `2-trigger-list.md` 의 `eia-trigger-edit-ui` plan 포인터는 참조 plan 이 존재한 적이
없고 실제로는 이미 구현된 기능을 여전히 "별 plan 대기" 로 서술하는 죽은 참조이며, 이는 이
PR 과 무관한 선재 결함으로 차단 사유는 아니다.

## 위험도

LOW
