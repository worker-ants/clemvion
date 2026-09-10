# Rationale 연속성 검토 — chat-channel PATCH 토큰 우회 수정, 2라운드 fix 반영 (impl-done, spec/5-system)

## 발견사항

없음. CRITICAL/WARNING 대상 없음.

- **[INFO]** 이전 라운드 INFO(`details.field` 미확정 표기)가 이번 diff 에서 완전히 해소됨 — 단, "정정" 자체가 한 번 더 정정됐다
  - target 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts` Swagger 설명, `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `details.field` 실측 각주
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` §5.4.1 표 3행 / §5.4.1.1 표 2행 ("`details.field` 는 미확정 — 후속 e2e 확인 대기")
  - 상세: 직전 라운드(커밋 `771801fca`, 검토 `review/consistency/2026/09/10/23_54_09`)는 "5필드 전부 중첩 경로" 라고 트래커에 확정 인계했으나, 이번 커밋(`83d5f3f94`)이 그 실측이 **비어있지 않은 값만** 쟀다는 것을 스스로 발견해 "값의 형태(비어있음/아님)에 따라 중첩·flat 두 갈래" 로 정정했다. Rationale 자체를 위반·번복한 것이 아니라, planner 에게 넘길 실측치의 정밀도를 스스로 낮추지 않고 올바르게 좁힌 사례다 — target 이 자기 자신의 이전 결과를 검증 없이 확정으로 넘기지 않고 재확인했다는 점에서 오히려 Rationale 연속성 관행(§근거 실측 원칙)에 부합한다.
  - 제안: 없음 (이미 처리됨). 다음 planner 턴이 `15-chat-channel.md` §5.4.1/§5.4.1.1 을 정정할 때 이 커밋이 남긴 두 갈래 표(비어있지 않은 값 → 중첩 배열, `null`/`''` → flat 단일 object)를 그대로 옮기면 된다.

## 검토 근거 (요약)

이번 라운드(커밋 `83d5f3f94`, 직전 검토 대비 델타)는 `/ai-review --route=all`(`review/code/2026/09/10/23_55_23`)의 WARNING 6건에 대한 조치로, 내용은 (1) Swagger 문서·사용자 문서(mdx 4개) 정정, (2) `assertChatChannelInputSafe` 오버로드 2개 도입(타입 결속 강화), (3) null/빈 문자열 케이스 테스트 대칭 보강, (4) 트래커(`spec-draft-nullable-notation-followups.md`) 항목 추가·체크박스 마감이다. `spec/5-system/**` 자체에는 델타가 없다(scope 델타 0, 정상).

핵심 R-CC-21 관련 코드(`ChatChannelUpdateConfigDto`, `assertPatchCarriesNoSecrets`, `setupChatChannel` 의 `storeUserSuppliedSecrets`/`preservedInboundSigningRef` 게이팅)는 이전 라운드에서 이미 구현됐고 이번 라운드는 그 코드를 재수정하지 않았다(diff 확인 완료 — 이번 커밋의 `triggers.service.ts` 변경분은 오버로드 시그니처 추가뿐, 게이팅 로직 자체는 불변). 재확인한 결과:

- **R-CC-21 「기각한 대안」 3종** (botToken optional+침묵 무시 / `SecretResolver.rotate` 에만 빈값 가드 추가 / telegram 전용 `rotate-inbound-signing` API 신설) — 어느 것도 재도입되지 않음.
- **telegram carve-out** (§5.4.1.1 telegram 행 — server-issued 서명은 PATCH 에서도 무조건 재저장) — `setupChatChannel` 의 "쓰기 ③" 이 `storeUserSuppliedSecrets` 플래그와 무관하게 그대로 유지됨. 이 축은 R-CC-21 의 "재검토 신호" 표가 "v2 결정이 안 닿는 축" 으로 명시한 것과 정확히 일치.
- **R-CC-10 single-path** — 번복되지 않았고 (`chat-channel-config.dto.ts` JSDoc 이 명시), `trigger-workflow-ref.e2e-spec.ts` 캐너리도 `botToken` 제거로 결함 재현을 멈췄다(과거 rationale_continuity `15_23_41` W1 이 지적한 "캐너리가 결함을 고정" 문제의 해소가 유지됨).
- **spec 문서-코드 축 불일치**(`store()` 표기 vs 실제 `rotate()` 호출, `botToken` `@MinLength(1)` 부재, 동시 PATCH lost-update)는 이번 라운드에서 새로 등재됐지만 모두 사전 존재 상태에 대한 발견이고, SKILL §수렴 예외 (a)(b)(c) 를 인용해 중앙 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 명시적으로 등재됐다 — "결정을 뒤집으며 Rationale 부재" 패턴이 아니라 "새 갭 발견 → 트래커 등재 → 후속 위임"의 정상 절차.

## 요약

target(HEAD 워킹트리의 chat-channel PATCH 구현)은 `spec/5-system/15-chat-channel.md`의 `R-CC-10`(bot token single-path)을 번복하지 않고, `R-CC-21`(PATCH 는 비밀을 쓰지 않는다)이 정한 처방(D-1/D-2/D-3)을 정확히 구현하며, R-CC-21 이 명시적으로 기각한 대안들을 재도입하지 않는다. telegram server-issued 서명과 slack/discord provider-issued 서명·bot token 세 축을 혼동 없이 분리 처리해 §5.4.1.1의 carve-out 원칙도 지킨다. 이번 라운드(커밋 `83d5f3f94`)는 핵심 Rationale 구현 로직을 건드리지 않고, 이전 라운드가 트래커에 인계한 실측(`details.field` 형식)의 범위 오류를 스스로 재확인해 정정했으며 사용자 문서의 사전 존재 오류도 동반 수정했다 — 이는 Rationale 연속성이 요구하는 "근거의 정밀도" 원칙에 부합하는 행동이다. 새로 발견된 부수 갭(store/rotate 표기 drift, 동시성 lost-update, minLength 부재)은 결함이 아니라 트래커에 정식 등재된 후속 항목으로, target 자체의 Rationale 위반이 아니다.

## 위험도
NONE
